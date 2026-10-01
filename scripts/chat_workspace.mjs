/** Local assistant adapter. No network, canonical writes, evidence grants or AI provider. */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, realpathSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadInventory, gitBlob, safePath } from './editorial_inventory.mjs';
import { parseEditorialMarkdown } from './editorial_markdown.mjs';
import { canonical, seal, profile } from './literary_model.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = (ok, message) => { if (!ok) throw new Error(`CHAT_WORKSPACE: ${message}`); };
const validLink = url => typeof url === 'string' && /^https:\/\/github\.com\/grwtsk\/huey\/(issues|pull)\/[1-9]\d*$/.test(url);
const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1000;
const hash = value => `sha256:${createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex')}`;
const within = (parent, child) => { const p = relative(parent, child); return p === '' || (!isAbsolute(p) && p !== '..' && !p.startsWith(`..${sep}`)); };
const paragraph = raw => {
  check(typeof raw === 'string' && raw.isWellFormed() && raw.length <= 100000, 'invalid replacement text');
  const blocks = parseEditorialMarkdown(raw);
  check(blocks.length === 1 && blocks[0].kind === 'Paragraph' && blocks[0].source.start === 0 && blocks[0].source.end === raw.length,
    'replacement must be exactly one supported Markdown paragraph, without a terminal newline');
  return blocks[0];
};

function sourcePatch(path, before, after) {
  check(safePath(path) && path.startsWith('manuscript/'), 'unsafe source patch path');
  const lines = text => { const parts = text.split('\n'); if (text.endsWith('\n')) parts.pop(); return parts; };
  const old = lines(before), next = lines(after);
  const body = (text, parts, prefix) => parts.map((line, index) => `${prefix}${line}\n${index === parts.length - 1 && !text.endsWith('\n') ? '\\ No newline at end of file\n' : ''}`).join('');
  return `--- ${JSON.stringify(`a/${path}`)}\n+++ ${JSON.stringify(`b/${path}`)}\n@@ -1,${old.length} +1,${next.length} @@\n${body(before, old, '-')}${body(after, next, '+')}`;
}

/** Validate only already-allocated source occurrences; never initialize/reconcile a plan. */
export function captureSnapshot({ inventory, plan, revision, readSource }) {
  check(plan.schema === 'huey.editorial-pages.v1' && plan.parser === 'huey.editorial-markdown/1', 'unsupported source plan');
  check(inventory.schema === 'huey.editorial-inventory.v1', 'expected checked inventory');
  const ids = plan.sources.flatMap(s => s.blocks.map(b => b.id));
  check(new Set(ids).size === ids.length && ids.every(id => new RegExp(profile.entityID).test(id)), 'invalid or duplicate occurrence identity');
  const entries = [], slots = [], sourceTexts = {};
  for (const slot of inventory.slots) {
    const selected = inventory.sources.filter(s => ['canonical', 'unplaced'].includes(s.role) && s.targets.includes(slot.key));
    const source = selected[0];
    let status = 'unavailable';
    if (source && selected.length === 1 && source.access === 'available' && slot.access === 'available' && slot.canonicalState === 'present-content') {
      check(source.targets.length === 1 && source.path === slot.canonicalPath && slot.sources.includes(source.key), 'ambiguous source selection');
      check(source.role === 'unplaced' ? slot.group === 'unplaced' : ['book', 'front', 'back'].includes(slot.group), 'source placement mismatch');
      const mappings = plan.sources.filter(p => p.sourceKey === source.key);
      check(mappings.length <= 1, 'duplicate source plan');
      const mapping = mappings[0];
      status = !mapping ? 'unmapped' : ['revision', 'path', 'blob'].some(k => mapping[k] !== source[k]) ? 'stale-plan' : 'mapped';
      if (status === 'mapped') {
        const raw = readSource(source);
        check(typeof raw === 'string' && raw.isWellFormed() && gitBlob(raw) === source.blob, 'source bytes drifted');
        sourceTexts[source.key] = raw;
        const blocks = parseEditorialMarkdown(raw);
        check(blocks.length === mapping.blocks.length, 'source block coverage drifted');
        blocks.forEach((block, index) => {
          const mapped = mapping.blocks[index];
          check(mapped.kind === block.kind && mapped.start === block.source.start && mapped.end === block.source.end, 'source occurrence drifted');
          if (block.kind !== 'Paragraph') return;
          const entity = seal({ id: mapped.id, kind: 'Paragraph', state: block.state });
          entries.push({ id: entity.id, version: entity.version, slot: slot.key, raw: raw.slice(mapped.start, mapped.end),
            source: { key: source.key, revision: source.revision, path: source.path, blob: source.blob,
              utf16: { start: mapped.start, end: mapped.end }, lines: { start: block.source.startLine, end: block.source.endLine } },
            scopeRefs: source.scopeRefs });
        });
      }
    }
    slots.push({ key: slot.key, label: slot.label, status, paragraphs: entries.filter(e => e.slot === slot.key).length });
  }
  return { revision, basis: hash({ revision, inventory, plan }), entries, slots, sourceTexts };
}

export function loadSnapshot(root = ROOT) {
  root = realpathSync(root);
  const inventory = loadInventory(root);
  const plan = JSON.parse(readFileSync(resolve(root, 'planning/editorial-pages/plan.json'), 'utf8'));
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return captureSnapshot({ inventory, plan, revision, readSource(source) {
    check(safePath(source.path) && source.path.startsWith('manuscript/'), 'source outside manuscript');
    const path = resolve(root, source.path), info = lstatSync(path);
    check(info.isFile() && !info.isSymbolicLink() && within(root, realpathSync(path)), 'unsafe source path');
    return readFileSync(path, 'utf8');
  } });
}

function inspectPrivate(path, directory = false) {
  const stat = lstatSync(path);
  check(!stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1), 'unsafe private store entry');
  check(stat.uid === process.getuid() && (stat.mode & 0o077) === 0, 'private store must be owned by this user with no group/other permissions');
}

export class ChatWorkspace {
  constructor({ root = ROOT, store, snapshot = () => loadSnapshot(root) }) {
    check(typeof store === 'string' && store.length > 0, '--store is required; choose a restricted directory outside every Git checkout');
    this.root = realpathSync(root);
    const requested = resolve(store);
    // Resolve parents before mkdir; no recursive creation through unknown paths.
    const parent = realpathSync(dirname(requested));
    this.store = resolve(parent, requested.split(sep).at(-1));
    check(!within(this.root, this.store), 'private store must be outside the repository');
    for (let p = this.store; ; p = dirname(p)) {
      const marker = resolve(p, '.git');
      // Sandboxes can expose an empty, read-only .git placeholder. Only a real
      // worktree marker or Git directory with HEAD denotes a checkout.
      const gitMarker = existsSync(marker) && (lstatSync(marker).isFile() || existsSync(resolve(marker, 'HEAD')));
      check(!gitMarker, 'private store must be outside every Git checkout');
      if (p === dirname(p)) break;
    }
    if (!existsSync(this.store)) mkdirSync(this.store, { mode: 0o700 });
    inspectPrivate(this.store, true);
    this.snapshot = snapshot;
    this.file = resolve(this.store, 'workspace.json');
  }
  state() {
    inspectPrivate(this.store, true);
    if (!existsSync(this.file)) return { schema: 'huey.private-chat-workspace.v1', repository: this.root, proposals: [], decisions: [], links: [] };
    inspectPrivate(this.file);
    const data = JSON.parse(readFileSync(this.file, 'utf8'));
    check(data.schema === 'huey.private-chat-workspace.v1' && data.repository === this.root, 'store belongs to another repository or schema');
    check(['proposals', 'decisions', 'links'].every(k => Array.isArray(data[k])), 'invalid private state');
    for (const op of data.proposals) check(op.digest === hash(Object.fromEntries(Object.entries(op).filter(([k]) => k !== 'digest'))), 'proposal integrity mismatch');
    check(new Set(data.proposals.map(p => p.id)).size === data.proposals.length && new Set(data.proposals.map(p => p.key)).size === data.proposals.length, 'duplicate proposal identity or key');
    for (const op of data.proposals) {
      check(/^op_[0-9a-f-]{36}$/.test(op.id) && new RegExp(profile.entityID).test(op.target) && nonempty(op.key), 'invalid proposal identity');
      check(op.kind === 'ReplaceInscription' && op.schema === 'huey.private-chat-proposal.v1' && [op.actor, op.session, op.requestRef].every(nonempty), 'invalid proposal provenance');
      check(hash(op.before) === op.beforeDigest && seal({ id: op.target, kind: 'Paragraph', state: paragraph(op.after).state }).version === op.afterVersion, 'invalid proposal wording or version');
    }
    check(new Set(data.decisions.map(d => d.operationId)).size === data.decisions.length, 'duplicate decision');
    for (const d of data.decisions) {
      const op = data.proposals.find(p => p.id === d.operationId);
      check(op && d.reviewDigest === op.digest && nonempty(d.approvalRef) && ['applied-private', 'rejected', 'cancelled'].includes(d.status), 'invalid decision receipt');
    }
    for (const link of data.links) check(Object.keys(link).sort().join(',') === 'operationId,url' && data.proposals.some(p => p.id === link.operationId) && validLink(link.url), 'invalid local GitHub link');
    return data;
  }
  transaction(fn) {
    inspectPrivate(this.store, true);
    const lock = resolve(this.store, 'workspace.lock');
    let fd;
    try { fd = openSync(lock, 'wx', 0o600); } catch { throw new Error('CHAT_WORKSPACE: store locked; another writer or interrupted operation needs inspection'); }
    const tmp = resolve(this.store, `${randomUUID()}.tmp`);
    try {
      const data = this.state();
      const result = fn(data, this.snapshot());
      writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      renameSync(tmp, this.file);
      return result;
    } finally {
      if (existsSync(tmp)) unlinkSync(tmp);
      closeSync(fd); unlinkSync(lock);
    }
  }
  current(id, data, snap) {
    const original = snap.entries.find(e => e.id === id);
    check(original, 'paragraph unavailable or unmapped');
    const applied = data.decisions.filter(d => d.status === 'applied-private' && data.proposals.find(p => p.id === d.operationId)?.target === id);
    let current = { ...original, sourceVersion: original.version, rawDigest: hash(original.raw), privateOperation: null };
    for (const decision of applied) {
      const op = data.proposals.find(p => p.id === decision.operationId);
      check(op.basis === snap.basis && op.baseVersion === current.version && op.beforeDigest === current.rawDigest, 'private overlay is stale; reconcile explicitly');
      current = { ...original, sourceVersion: original.version, version: op.afterVersion, raw: op.after, rawDigest: hash(op.after), privateOperation: op.id };
    }
    return current;
  }
  list(slot) {
    const snap = this.snapshot();
    return { revision: snap.revision, basis: snap.basis, scope: 'mapped working paragraphs; not a complete manuscript', slots: snap.slots,
      paragraphs: snap.entries.filter(e => !slot || e.slot === slot).map(({ id, version, slot, source }) => ({ id, sourceVersion: version, slot, lines: source.lines })) };
  }
  read(id) {
    const snap = this.snapshot(), data = this.state();
    return { basis: snap.basis, ...this.current(id, data, snap), evidence: 'source references only; private changes inherit no evidence or admission' };
  }
  search({ slot, query, limit = 20 }) {
    check(typeof slot === 'string' && slot.length > 0, 'choose a specific slot before searching');
    check(typeof query === 'string' && query.length > 0 && query.length <= 1000, 'nonempty literal query required');
    check(Number.isInteger(limit) && limit > 0 && limit <= 20, 'search limit must be 1–20');
    const snap = this.snapshot(), data = this.state();
    check(snap.slots.some(s => s.key === slot && s.status === 'mapped'), 'slot unavailable or unmapped');
    const matches = snap.entries.filter(e => e.slot === slot).map(e => this.current(e.id, data, snap)).filter(e => e.raw.includes(query));
    return { slot, basis: snap.basis, total: matches.length, matches: matches.slice(0, limit),
      scope: 'literal, case-sensitive search of this slot, including applied private overlays' };
  }
  propose({ id, baseVersion, beforeDigest, after, actor, session, requestRef, key }) {
    check([actor, session, requestRef, key].every(v => typeof v === 'string' && v.trim() && v.length <= 1000), 'actor, session, requestRef and idempotency key required (host-supplied, not authentication)');
    const block = paragraph(after);
    return this.transaction((data, snap) => {
      const request = { target: id, baseVersion, beforeDigest, after, actor, session, requestRef, key };
      const existing = data.proposals.find(p => p.key === key);
      if (existing) { check(existing.requestDigest === hash(request), 'idempotency key reused for another request'); return existing; }
      const current = this.current(id, data, snap);
      check(current.version === baseVersion && current.rawDigest === beforeDigest, 'stale paragraph version or exact wording');
      check(current.raw !== after, 'empty change');
      const siblings = snap.entries.filter(e => e.slot === current.slot), index = siblings.findIndex(e => e.id === id);
      const op = { schema: 'huey.private-chat-proposal.v1', id: `op_${randomUUID()}`, kind: 'ReplaceInscription', target: id,
        basis: snap.basis, revision: snap.revision, baseVersion, beforeDigest, before: current.raw, after,
        afterVersion: seal({ id, kind: 'Paragraph', state: block.state }).version, source: current.source,
        neighbors: { before: siblings[index - 1]?.id ?? null, after: siblings[index + 1]?.id ?? null },
        actor, session, requestRef, key, requestDigest: hash(request), clientSequence: data.proposals.length + 1,
        createdAt: new Date().toISOString(), disposition: 'proposed-private; no source write or permission grant' };
      op.digest = hash(op); data.proposals.push(op); return op;
    });
  }
  review(operationId) {
    const data = this.state(), op = data.proposals.find(p => p.id === operationId);
    check(op, 'unknown operation');
    const snap = this.snapshot();
    let conflict = null;
    const decision = data.decisions.find(d => d.operationId === operationId) ?? null;
    try {
      const current = this.current(op.target, data, snap);
      // Applied history can have later valid edits; the complete overlay chain
      // has just been checked. Compare base wording only for unapplied proposals.
      check(op.basis === snap.basis && (decision?.status === 'applied-private' ||
        current.version === op.baseVersion && current.rawDigest === op.beforeDigest), 'stale proposal');
    } catch (error) { conflict = error.message; }
    return { operation: op, decision, conflict,
      diff: { before: op.before, after: op.after }, reviewDigest: op.digest, links: data.links.filter(l => l.operationId === operationId),
      warning: 'Private review only. Approval reference is a host assertion, not authenticated human assent. Evidence and public disclosure require separate review.' };
  }
  decide({ operationId, reviewDigest, approvalRef, status }) {
    check(['applied-private', 'rejected', 'cancelled'].includes(status), 'invalid disposition');
    check(typeof approvalRef === 'string' && approvalRef.trim() && approvalRef.length <= 1000, 'exact user decision reference required');
    return this.transaction((data, snap) => {
      const op = data.proposals.find(p => p.id === operationId);
      check(op && op.digest === reviewDigest, 'unknown operation or changed review payload');
      const prior = data.decisions.find(d => d.operationId === operationId);
      if (prior) { check(prior.status === status && prior.approvalRef === approvalRef, 'operation already has a different decision'); return prior; }
      if (status === 'applied-private') {
        const current = this.current(op.target, data, snap);
        check(snap.basis === op.basis && current.version === op.baseVersion && current.rawDigest === op.beforeDigest, 'stale proposal; source/overlay changed');
      }
      const receipt = { operationId, reviewDigest, approvalRef, status, recordedAt: new Date().toISOString(),
        effect: status === 'applied-private' ? 'local private overlay only' : 'no text effect',
        authority: 'host-supplied decision reference; not independently authenticated' };
      data.decisions.push(receipt); return receipt;
    });
  }
  link(operationId, url) {
    check(validLink(url), 'expected exact Huey issue or PR URL');
    return this.transaction(data => {
      check(data.proposals.some(p => p.id === operationId), 'unknown operation');
      const entry = { operationId, url };
      if (!data.links.some(l => l.operationId === operationId && l.url === url)) data.links.push(entry);
      return { ...entry, effect: 'local reference only; no GitHub write or verified external disposition' };
    });
  }
  sourcePreview(operationId) {
    const data = this.state(), op = data.proposals.find(p => p.id === operationId);
    check(op && data.decisions.some(d => d.operationId === operationId && d.status === 'applied-private'), 'source preview requires an applied private operation');
    const snap = this.snapshot();
    check(op.basis === snap.basis, 'stale source basis');
    const before = snap.sourceTexts?.[op.source.key];
    check(typeof before === 'string' && gitBlob(before) === op.source.blob, 'exact source unavailable');
    const edits = snap.entries.filter(e => e.source.key === op.source.key).map(original => ({ original, current: this.current(original.id, data, snap) }))
      .filter(({ original, current }) => original.raw !== current.raw).sort((a, b) => b.original.source.utf16.start - a.original.source.utf16.start);
    let after = before, previousStart = before.length;
    for (const { original, current } of edits) {
      const { start, end } = original.source.utf16;
      check(start >= 0 && end <= previousStart && before.slice(start, end) === original.raw, 'source preview range mismatch');
      after = after.slice(0, start) + current.raw + after.slice(end); previousStart = start;
    }
    check(parseEditorialMarkdown(before).length === parseEditorialMarkdown(after).length, 'source preview changed structural block count');
    return { schema: 'huey.private-source-preview.v1', source: op.source, basis: snap.basis, before, after,
      afterBlob: gitBlob(after), patch: sourcePatch(op.source.path, before, after), affectedEntities: edits.map(e => e.original.id),
      operationIds: data.decisions.filter(d => d.status === 'applied-private' && data.proposals.some(p => p.id === d.operationId && p.source.key === op.source.key)).map(d => d.operationId),
      effect: 'private cumulative source candidate only; canonical source and identity/pin metadata unchanged',
      blockers: ['explicit source correspondence and pin reconciliation (#353/#360)', 'review exact public payload before Git materialization (#355/#361)'] };
  }
  handoff(operationId) {
    const review = this.review(operationId);
    return { destination: 'grwtsk/huey', base: 'pre-release', draft: true, links: review.links,
      operationId, localDisposition: review.decision?.status ?? 'proposed', conflict: review.conflict,
      publicText: 'Private editorial candidate prepared in an authorized local workspace. No manuscript wording, source locator or private fingerprint is included. Separate exact-payload disclosure review is required before any source patch can be shared.',
      gates: ['payload disclosure review', 'source reconciliation (#353/#360)', 'reverse materialization (#355)', 'Git adapter (#361)', 'human editorial acceptance is separate'],
      effect: 'preview only; no network, commit, push or PR creation' };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (const name of ['store', 'root']) {
      const index = args.indexOf(`--${name}`);
      if (index >= 0) { check(args[index + 1] && !args[index + 1].startsWith('--'), `missing --${name} value`); options[name] = args[index + 1]; args.splice(index, 2); }
    }
    const [command, target, extra] = args;
    const ws = new ChatWorkspace(options);
    const input = () => JSON.parse(readFileSync(0, 'utf8'));
    let result;
    if (command === 'list' && args.length <= 2) result = ws.list(target);
    else if (command === 'read' && args.length === 2) result = ws.read(target);
    else if (command === 'search' && args.length === 1) result = ws.search(input());
    else if (command === 'propose' && args.length === 1) result = ws.propose(input());
    else if (command === 'review' && args.length === 2) result = ws.review(target);
    else if (command === 'decide' && args.length === 1) result = ws.decide(input());
    else if (command === 'link' && args.length === 3) result = ws.link(target, extra);
    else if (command === 'source-preview' && args.length === 2) result = ws.sourcePreview(target);
    else if (command === 'handoff' && args.length === 2) result = ws.handoff(target);
    else throw new Error('usage: chat_workspace.mjs --store /restricted/outside/git [list [slot]|read ID|search < JSON|propose < JSON|review OP|decide < JSON|link OP URL|source-preview OP|handoff OP]');
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
