/** Opt-in loopback editor bridge. Private overlays and a queue for the existing Codex host; no model/provider or GitHub writes. */
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, lstatSync, realpathSync, readFileSync, writeFileSync, openSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatWorkspace, loadSnapshot } from './chat_workspace.mjs';
import { loadInventory, safePath, validateRegistry } from './editorial_inventory.mjs';
import { canonical, profile } from './literary_model.mjs';
import { DraftCheckpointError } from './draft_checkpoint.mjs';

export const GRWTSK_CLIENT = 'huey-grwtsk-editor/1';
const exec = promisify(execFile);
const MAX_BODY = 262144, MAX_DRAFT_BODY = 1024 * 1024, MAX_THREAD = 16 * 1024 * 1024;
const entityID = new RegExp(profile.entityID);
const requestID = /^request_[0-9a-f-]{36}$/;
const hash = value => `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`;
const check = (ok, message, status = 400) => { if (!ok) { const error = new Error(`GRWTSK: ${message}`); error.status = status; throw error; } };
const text = (value, max = 1000) => typeof value === 'string' && value.isWellFormed() && value.trim().length > 0 && value.length <= max;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function fields(value, required, optional = []) {
  check(plain(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => [...required, ...optional].includes(key)), 'missing or unknown request fields');
}

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const within = (parent, path) => { const child = relative(parent, path); return child === '' || !isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`); };
function checkedBytes(root, path, missing = false) {
  const full = resolve(root, path);
  try {
    const stat = lstatSync(full);
    check(stat.isFile() && !stat.isSymbolicLink() && within(root, realpathSync(full)), 'unsafe checked context path');
    return readFileSync(full);
  } catch (error) { if (missing && error.code === 'ENOENT') return null; throw error; }
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
/** Reuse parsing, never an unchecked file observation: hash exact inputs on every call. */
export function createCheckedSnapshotReader(root = ROOT) {
  root = realpathSync(root);
  let cached = null;
  const git = (args, input) => execFileSync('git', args, { cwd: root, encoding: 'utf8', input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' } });
  const fingerprint = paths => {
    const sum = createHash('sha256');
    const add = (name, bytes) => { sum.update(`${name}\0${bytes === null ? 'missing' : bytes.length}\0`); if (bytes !== null) sum.update(bytes); };
    const [head, indexPath] = git(['rev-parse', 'HEAD', '--git-path', 'index']).trim().split('\n');
    check(/^[0-9a-f]{40}$/.test(head) && text(indexPath, 10000), 'Git snapshot unavailable');
    add('HEAD', Buffer.from(head));
    const fullIndex = resolve(root, indexPath);
    if (existsSync(fullIndex)) {
      const stat = lstatSync(fullIndex); check(stat.isFile() && !stat.isSymbolicLink(), 'unsafe Git index'); add('index', readFileSync(fullIndex));
    } else add('index', null);
    const registryBytes = checkedBytes(root, 'planning/editorial-inventory/registry.json');
    const registry = validateRegistry(JSON.parse(registryBytes.toString('utf8')));
    add('registry', registryBytes);
    for (const path of ['planning/editorial-pages/plan.json', 'book.yaml', 'reader/content/book.json']) add(path, checkedBytes(root, path));
    // Batch-check both pinned commits and commit:path resolution. Missing Git
    // objects/tree paths change the fingerprint even when HEAD is unchanged.
    const objects = registry.sources.flatMap(source => [`${source.revision}^{commit}`, `${source.revision}:${source.path}`, source.blob]);
    add('pinned-Git-state', Buffer.from(objects.length ? git(['cat-file', '--batch-check'], `${objects.join('\n')}\n`) : ''));
    for (const path of paths) { check(safePath(path) && path.startsWith('manuscript/'), 'unsafe source cache path'); add(path, checkedBytes(root, path, true)); }
    return sum.digest('hex');
  };
  const read = () => {
    const observed = fingerprint(cached?.paths ?? []);
    if (cached && observed === cached.fingerprint) return cached.snapshot;
    // This full guard validates metadata/coverage before choosing any new file
    // paths. Changed input must pass the original loadSnapshot checks again.
    const coreBefore = fingerprint([]), checkedInventory = loadInventory(root);
    const tracked = new Set(git(['ls-files', '-z', '--', 'manuscript']).split('\0'));
    const paths = [...new Set(checkedInventory.slots.map(slot => slot.canonicalPath).filter(path => path && tracked.has(path)))].sort();
    const before = fingerprint(paths), snapshot = loadSnapshot(root), inventory = loadInventory(root), after = fingerprint(paths);
    check(before === after && coreBefore === fingerprint([]), 'context changed during snapshot capture; retry against current bytes', 409);
    cached = { paths, fingerprint: after, snapshot: freeze(snapshot), inventory: freeze(inventory) };
    return cached.snapshot;
  };
  read.inventory = () => { read(); return cached.inventory; };
  return read;
}

// Match ChatWorkspace's outside-Git, no-symlink, owner-only store rules for the
// additional thread file. No caller-provided filename enters this boundary.
function inspectPrivate(path, directory = false) {
  const stat = lstatSync(path);
  check(!stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1), 'unsafe private thread entry');
  check(stat.uid === process.getuid() && (stat.mode & 0o7777) === (directory ? 0o700 : 0o600),
    'private thread permissions must be exactly owner-only 0700 directories and 0600 files');
  check(directory || stat.size <= MAX_THREAD, 'private thread exceeds size limit');
}
class PrivateThread {
  constructor(workspace) { this.workspace = workspace; this.file = resolve(workspace.store, 'grwtsk-thread.json'); }
  state() {
    inspectPrivate(this.workspace.store, true);
    if (!existsSync(this.file)) return { schema: 'huey.private-grwtsk-thread.v1', repository: this.workspace.root, messages: [], requests: [] };
    inspectPrivate(this.file);
    const data = JSON.parse(readFileSync(this.file, 'utf8'));
    fields(data, ['schema', 'repository', 'messages', 'requests']);
    check(data.schema === 'huey.private-grwtsk-thread.v1' && data.repository === this.workspace.root, 'thread belongs to another repository or schema');
    check(Array.isArray(data.messages) && Array.isArray(data.requests) && data.requests.length <= 500 && data.messages.length <= 1000, 'invalid thread collections');
    check(new Set(data.requests.map(r => r.id)).size === data.requests.length && new Set(data.messages.map(m => m.id)).size === data.messages.length, 'duplicate thread identity');
    for (const r of data.requests) {
      fields(r, ['id', 'entityId', 'message', 'requestRef', 'selected', 'status', 'createdAt', 'digest']);
      check(requestID.test(r.id) && entityID.test(r.entityId) && text(r.message, 12000) && text(r.requestRef), 'invalid queued request');
      check(plain(r.selected) && r.selected.id === r.entityId && ['pending-host', 'answered'].includes(r.status) && text(r.createdAt), 'invalid queued selection or status');
      check(r.digest === hash(Object.fromEntries(Object.entries(r).filter(([key]) => key !== 'digest'))), 'queued request integrity mismatch');
    }
    for (const m of data.messages) {
      fields(m, ['id', 'role', 'text', 'requestId', 'selectedEntityId', 'createdAt'], ['hostRef']);
      const request = data.requests.find(r => r.id === m.requestId);
      check(/^message_[0-9a-f-]{36}$/.test(m.id) && request && request.entityId === m.selectedEntityId && text(m.text, 12000) && text(m.createdAt), 'invalid thread message');
      check(m.role === 'user' ? !Object.hasOwn(m, 'hostRef') && m.text === request.message : m.role === 'assistant' && text(m.hostRef), 'invalid message role or host reference');
    }
    for (const r of data.requests) {
      check(data.messages.filter(m => m.requestId === r.id && m.role === 'user').length === 1, 'request has no unique user message');
      check(data.messages.filter(m => m.requestId === r.id && m.role === 'assistant').length === (r.status === 'answered' ? 1 : 0), 'request/reply status mismatch');
    }
    return data;
  }
  transaction(fn) {
    inspectPrivate(this.workspace.store, true);
    const lock = resolve(this.workspace.store, 'grwtsk-thread.lock'), tmp = resolve(this.workspace.store, `${randomUUID()}.thread.tmp`);
    let fd;
    try { fd = openSync(lock, 'wx', 0o600); } catch { check(false, 'thread locked; inspect another writer or interrupted operation', 409); }
    try {
      const data = this.state(), result = fn(data);
      const bytes = `${JSON.stringify(data, null, 2)}\n`;
      check(Buffer.byteLength(bytes) <= MAX_THREAD, 'private thread exceeds size limit', 413);
      writeFileSync(tmp, bytes, { flag: 'wx', mode: 0o600 }); renameSync(tmp, this.file);
      return result;
    } finally {
      if (existsSync(tmp)) unlinkSync(tmp);
      closeSync(fd); unlinkSync(lock);
    }
  }
  queue({ id, message, basis, baseVersion, beforeDigest, requestRef }) {
    check(typeof id === 'string' && entityID.test(id) && text(message, 12000), 'select an available paragraph and supply a message of 1–12000 characters');
    check(requestRef === undefined || text(requestRef), 'invalid request reference');
    return this.transaction(data => {
      const current = this.workspace.read(id);
      check(current.basis === basis && current.version === baseVersion && current.rawDigest === beforeDigest, 'stale displayed paragraph context; read and review the current selection', 409);
      check(data.requests.length < 500, 'thread request limit reached', 413);
      const request = { id: `request_${randomUUID()}`, entityId: id, message,
        requestRef: requestRef ?? `local-editor-request/${randomUUID()}`,
        selected: { id, basis: current.basis, slot: current.slot, version: current.version, sourceVersion: current.sourceVersion,
          raw: current.raw, source: current.source, scopeRefs: current.scopeRefs, privateOperation: current.privateOperation,
          evidence: current.evidence }, status: 'pending-host', createdAt: new Date().toISOString() };
      request.digest = hash(request); data.requests.push(request);
      data.messages.push({ id: `message_${randomUUID()}`, role: 'user', text: message, requestId: request.id, selectedEntityId: id, createdAt: request.createdAt });
      return data;
    });
  }
  reply({ requestId, text: wording, hostRef }) {
    check(typeof requestId === 'string' && requestID.test(requestId) && text(wording, 12000) && text(hostRef), 'exact request, actual host reply and host reference required');
    return this.transaction(data => {
      const request = data.requests.find(r => r.id === requestId);
      check(request, 'unknown pending host request');
      const prior = data.messages.find(m => m.requestId === requestId && m.role === 'assistant');
      if (prior) { check(prior.text === wording && prior.hostRef === hostRef, 'request already has a different host reply', 409); return data; }
      request.status = 'answered'; request.digest = hash(Object.fromEntries(Object.entries(request).filter(([key]) => key !== 'digest')));
      data.messages.push({ id: `message_${randomUUID()}`, role: 'assistant', text: wording, requestId, selectedEntityId: request.entityId,
        hostRef, createdAt: new Date().toISOString() });
      return data;
    });
  }
}

function chatView(data) {
  return { ...data, host: 'existing local Codex host; replies require an explicit host append',
    scope: 'private local context and host replies; no model invocation, public transfer, source write or literary acceptance' };
}
/** Existing Codex host only: append its actual reply on the same restricted local surface. Not available over HTTP. */
export function appendHostReply({ root, store, requestId, text: wording, hostRef }) {
  const workspace = new ChatWorkspace({ root, store });
  return chatView(new PrivateThread(workspace).reply({ requestId, text: wording, hostRef }));
}

async function readPublicIssue(number, root) {
  const { stdout } = await exec('gh', ['issue', 'view', String(number), '--repo', 'grwtsk/huey', '--json', 'number,title,body,state,url,comments'],
    { cwd: root, timeout: 15000, maxBuffer: 1024 * 1024, env: { ...process.env, GH_PROMPT_DISABLED: '1' } });
  const issue = JSON.parse(stdout);
  check(issue.number === number && text(issue.title) && typeof issue.body === 'string' && ['OPEN', 'CLOSED'].includes(issue.state)
    && issue.url === `https://github.com/grwtsk/huey/issues/${number}` && Array.isArray(issue.comments), 'invalid public issue response');
  return { number, title: issue.title, body: issue.body, state: issue.state, url: issue.url,
    comments: issue.comments.map(c => ({ body: typeof c.body === 'string' ? c.body : '', url: typeof c.url === 'string' ? c.url : null })) };
}

function body(req, maximum = MAX_BODY) {
  check(/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? ''), 'JSON content type required', 415);
  check(!req.headers['content-encoding'] || req.headers['content-encoding'] === 'identity', 'encoded request body unsupported', 415);
  const declared = req.headers['content-length'];
  check(declared === undefined || /^\d+$/.test(declared) && Number(declared) <= maximum, 'request body exceeds size limit', 413);
  return new Promise((done, fail) => {
    let bytes = 0, chunks = [], finished = false;
    req.on('data', chunk => {
      if (finished) return;
      bytes += chunk.length;
      if (bytes > maximum) { finished = true; chunks = []; const error = new Error('GRWTSK: request body exceeds size limit'); error.status = 413; fail(error); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (finished) return;
      try { done(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { fail(new Error('GRWTSK: invalid JSON request')); }
    });
    req.on('error', fail);
  });
}
const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
function boundary(req, token) {
  const port = req.socket.localPort, host = req.headers.host;
  check(loopback(req.socket.localAddress) && loopback(req.socket.remoteAddress), 'loopback connection required', 403);
  check(typeof host === 'string' && [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host), 'exact loopback Host and server port required', 403);
  check(req.headers['x-huey-client'] === GRWTSK_CLIENT, 'editor client header required', 403);
  const origin = req.headers.origin;
  check(origin === undefined || origin === `http://${host}`, 'same-origin request required', 403);
  check(req.method !== 'POST' || origin === `http://${host}`, 'explicit same-origin Origin required for POST', 403);
  if (token !== null) check(req.headers['x-huey-session'] === token, 'current local session required', 403);
}
function query(url, name, optional = false) {
  check([...url.searchParams.keys()].every(key => key === name) && url.searchParams.getAll(name).length === (optional && !url.searchParams.has(name) ? 0 : 1), 'missing or unknown query parameters');
  return url.searchParams.get(name);
}

/** Trusted server options may inject checked fixtures; no HTTP request can select roots, stores, snapshots or executables. */
export function createGrwtskMiddleware({ root = ROOT, store, snapshot, inventory, readIssue = readPublicIssue }) {
  const checkedSnapshot = snapshot ? null : createCheckedSnapshotReader(root);
  snapshot ??= checkedSnapshot;
  inventory ??= checkedSnapshot?.inventory ?? (() => loadInventory(root));
  const workspace = new ChatWorkspace({ root, store, snapshot }), thread = new PrivateThread(workspace);
  const token = randomBytes(32).toString('hex'), session = `local-editor-session/${randomUUID()}`, actor = `local-editor-client/uid-${process.getuid()}`;
  return async function grwtskMiddleware(req, res, next = () => {}) {
    if (!(req.url ?? '').startsWith('/__grwtsk/')) { next(); return; }
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Referrer-Policy', 'no-referrer');
    const respond = (value, status = 200) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, 'http://localhost'), route = url.pathname;
      boundary(req, route === '/__grwtsk/session' ? null : token);
      const getRoutes = ['/__grwtsk/session', '/__grwtsk/catalog', '/__grwtsk/read', '/__grwtsk/inspect', '/__grwtsk/draft', '/__grwtsk/draft-index', '/__grwtsk/queue', '/__grwtsk/review', '/__grwtsk/handoff', '/__grwtsk/issues', '/__grwtsk/chat'];
      const postRoutes = ['/__grwtsk/propose', '/__grwtsk/decide', '/__grwtsk/resume-source', '/__grwtsk/draft-save', '/__grwtsk/draft-discard', '/__grwtsk/draft-restore', '/__grwtsk/link', '/__grwtsk/chat'];
      check(getRoutes.includes(route) || postRoutes.includes(route), 'unknown endpoint', 404);
      check(req.method === 'GET' && getRoutes.includes(route) || req.method === 'POST' && postRoutes.includes(route), 'method unavailable', 405);
      let result;
      if (req.method === 'POST') {
        check(!url.search, 'query parameters unavailable for POST'); const input = await body(req, route === '/__grwtsk/draft-save' ? MAX_DRAFT_BODY : MAX_BODY);
        if (route === '/__grwtsk/propose') {
          fields(input, ['id', 'baseVersion', 'beforeDigest', 'after', 'requestRef', 'key']);
          result = workspace.propose({ ...input, actor, session });
        } else if (route === '/__grwtsk/decide') {
          fields(input, ['operationId', 'reviewDigest', 'approvalRef', 'status']); result = workspace.decide(input);
        } else if (route === '/__grwtsk/resume-source') {
          fields(input, ['id', 'reviewDigest', 'decisionRef', 'key']); result = workspace.resumeSource(input);
        } else if (route === '/__grwtsk/draft-save') {
          fields(input, ['id', 'basis', 'revision', 'sourceVersion', 'baseVersion', 'beforeDigest', 'privateOperation', 'draft', 'key', 'expectedDigest', 'generation']);
          result = workspace.saveDraft(input);
        } else if (route === '/__grwtsk/draft-discard') {
          fields(input, ['id', 'expectedDigest', 'generation']); result = workspace.discardDraft(input);
        } else if (route === '/__grwtsk/draft-restore') {
          fields(input, ['id', 'checkpointDigest', 'generation']); result = workspace.restoreDraft(input);
        } else if (route === '/__grwtsk/link') {
          fields(input, ['operationId', 'url']); result = workspace.link(input.operationId, input.url);
        } else {
          fields(input, ['id', 'message', 'basis', 'baseVersion', 'beforeDigest'], ['requestRef']); result = chatView(thread.queue(input));
        }
      } else if (route === '/__grwtsk/session') {
        check(!url.search, 'session accepts no query');
        result = { token, clientHeader: GRWTSK_CLIENT, session, mode: 'private local editor', hostReplies: 'pending until the existing Codex host appends an actual reply', authority: 'local editor session; no authenticated literary acceptance' };
      } else if (route === '/__grwtsk/catalog') {
        check(!url.search, 'catalog accepts no query');
        const listing = workspace.list(), meta = inventory(), state = workspace.state();
        result = { ...listing,
          slots: listing.slots.map(slot => { const item = meta.slots.find(s => s.key === slot.key); return { ...slot,
            group: item?.group ?? null, presence: item?.presence ?? null, access: item?.access ?? null,
            editorialMaterialization: item?.editorialMaterialization ?? null, materialization: item?.editorialMaterialization ?? null,
            observedReaderAdmission: item?.observedReaderAdmission ?? null,
            sourceStatus: item?.canonicalState ?? null, issues: item?.issues ?? [], publicationAnnotation: item?.publicationAnnotation ?? null,
            sources: meta.sources.filter(s => s.targets.includes(slot.key)).map(s => ({ key: s.key, role: s.role, extent: s.extent, access: s.access, revision: s.revision, path: s.path, scopeRefs: s.scopeRefs })) }; }),
          paragraphs: listing.paragraphs.map(p => {
            const retired = state.reconciliations?.filter(r => r.target === p.id).at(-1)?.retiredOperationIds ?? [];
            return { ...p, privateOperation: state.decisions.filter(d => d.status === 'applied-private' && !retired.includes(d.operationId) && state.proposals.some(op => op.id === d.operationId && op.target === p.id)).at(-1)?.operationId ?? null };
          }),
          operations: state.proposals.map(op => ({ id: op.id, target: op.target, createdAt: op.createdAt, status: state.decisions.find(d => d.operationId === op.id)?.status ?? 'proposed-private' })),
          authority: 'source/publication labels are observations, not permissions or acceptance; overlay freshness is checked when a paragraph is read' };
      } else if (route === '/__grwtsk/read') result = workspace.read(query(url, 'id'));
      else if (route === '/__grwtsk/inspect') result = workspace.inspect(query(url, 'id'));
      else if (route === '/__grwtsk/draft') result = workspace.inspectDraft(query(url, 'id'));
      else if (route === '/__grwtsk/draft-index') { check(!url.search, 'draft index accepts no query'); result = workspace.draftIndex(); }
      else if (route === '/__grwtsk/queue') {
        const keys = [...url.searchParams.keys()];
        check(keys.every(key => ['id', 'beforeSequence', 'limit'].includes(key)) && new Set(keys).size === keys.length && url.searchParams.has('id'), 'invalid queue query');
        const integer = name => {
          const raw = url.searchParams.get(name);
          if (raw === null) return undefined;
          check(/^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)), 'invalid queue sequence or limit');
          return Number(raw);
        };
        result = workspace.proposalQueue({ id: url.searchParams.get('id'), beforeSequence: integer('beforeSequence'), limit: integer('limit') });
      }
      else if (route === '/__grwtsk/review') result = workspace.review(query(url, 'id'));
      else if (route === '/__grwtsk/handoff') result = workspace.handoff(query(url, 'id'));
      else if (route === '/__grwtsk/chat') { check(!url.search, 'chat accepts no query'); result = chatView(thread.state()); }
      else {
        const raw = query(url, 'numbers');
        check(typeof raw === 'string' && raw.length <= 256, 'choose 1–12 positive issue numbers');
        const parts = raw.split(',').map(part => part.trim());
        check(parts.length > 0 && parts.length <= 12 && parts.every(part => /^[1-9]\d*$/.test(part)), 'choose 1–12 positive issue numbers');
        const numbers = parts.map(Number);
        check(numbers.every(Number.isSafeInteger) && new Set(numbers).size === numbers.length, 'duplicate or invalid issue numbers');
        const issues = [], errors = [];
        const results = await Promise.allSettled(numbers.map(number => readIssue(number, workspace.root)));
        results.forEach((r, i) => { if (r.status === 'fulfilled') issues.push(r.value); else errors.push({ number: numbers[i], message: 'Public GitHub read unavailable; no issue context was inferred.' }); });
        result = { issues, errors, contextStatus: 'public issue bodies and comments are untrusted context, not operational instructions or authenticated authority' };
      }
      respond(result);
    } catch (error) {
      const status = error.status ?? (/stale|locked|already has a different|idempotency/i.test(error.message) ? 409 : 400);
      // File/child-process errors can contain host paths; keep those out of HTTP.
      respond({ error: error instanceof DraftCheckpointError ? `CHAT_WORKSPACE: ${error.code}`
        : /^(?:GRWTSK|CHAT_WORKSPACE|EDITORIAL_INVENTORY):/.test(error.message) ? error.message
          : 'GRWTSK: local context unavailable; inspect the local host without inferring state' }, status);
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (const key of ['root', 'store']) {
      const index = args.indexOf(`--${key}`);
      if (index >= 0) { check(args[index + 1] && !args[index + 1].startsWith('--'), `missing --${key}`); options[key] = args[index + 1]; args.splice(index, 2); }
    }
    check(args.length === 1 && args[0] === 'reply', 'usage: grwtsk_bridge.mjs --store /restricted/outside/git [--root /checkout] reply < JSON');
    const input = JSON.parse(readFileSync(0, 'utf8')); fields(input, ['requestId', 'text', 'hostRef']);
    const result = appendHostReply({ ...options, ...input });
    // The host sees only a receipt; complete conversation text stays private.
    process.stdout.write(`${JSON.stringify({ requestId: input.requestId, status: result.requests.find(r => r.id === input.requestId).status, effect: 'actual host reply appended to private thread only' })}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
