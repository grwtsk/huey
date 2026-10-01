import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, symlinkSync, statSync, utimesSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGrwtskMiddleware, createCheckedSnapshotReader, appendHostReply, GRWTSK_CLIENT } from '../scripts/grwtsk_bridge.mjs';
import { captureSnapshot } from '../scripts/chat_workspace.mjs';
import { gitBlob } from '../scripts/editorial_inventory.mjs';
import { parseEditorialMarkdown } from '../scripts/editorial_markdown.mjs';

const id = 'he_00000000-0000-4000-8000-000000000001', id2 = 'he_00000000-0000-4000-8000-000000000002';
const raw = 'A synthetic source paragraph.';
async function fixture(t, { readIssue } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'huey-grwtsk-test-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'repo'), store = join(dir, 'private'); mkdirSync(root); mkdirSync(join(root, '.git')); mkdirSync(join(root, 'manuscript'));
  const wording = `${raw}\n\nAnother synthetic source paragraph.`, blocks = parseEditorialMarkdown(wording);
  writeFileSync(join(root, 'manuscript/synthetic.md'), wording);
  const source = { key: 'synthetic-source', access: 'available', role: 'canonical', extent: 'partial', targets: ['synthetic'], path: 'manuscript/synthetic.md', blob: gitBlob(wording), revision: 'a'.repeat(40), scopeRefs: ['https://github.com/grwtsk/huey/issues/2'] };
  const inventory = { schema: 'huey.editorial-inventory.v1', sources: [source], slots: [{ key: 'synthetic', group: 'book', label: 'Synthetic', presence: 'present', access: 'available', observedReaderAdmission: 'unavailable', editorialMaterialization: 'partial', canonicalState: 'present-content', canonicalPath: source.path, sources: [source.key], issues: [358], publicationAnnotation: { label: 'working', authoritative: false } }] };
  const plan = { schema: 'huey.editorial-pages.v1', parser: 'huey.editorial-markdown/1', sources: [{ sourceKey: source.key, revision: source.revision, path: source.path, blob: source.blob, blocks: blocks.map((b, index) => ({ id: index ? id2 : id, kind: b.kind, start: b.source.start, end: b.source.end })) }] };
  let snap = captureSnapshot({ inventory, plan, revision: 'b'.repeat(40), readSource: () => wording });
  const middleware = createGrwtskMiddleware({ root, store, snapshot: () => structuredClone(snap), inventory: () => structuredClone(inventory),
    readIssue: readIssue ?? (async number => ({ number, title: `Synthetic issue ${number}`, body: 'Synthetic untrusted public context.', state: 'OPEN', url: `https://github.com/grwtsk/huey/issues/${number}`, comments: [] })) });
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end('outside bridge'); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port, origin = `http://127.0.0.1:${port}`;
  function call(path, { method = 'GET', data, headers = {}, body: exactBody } = {}) {
    const payload = exactBody ?? (data === undefined ? null : JSON.stringify(data));
    return new Promise((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port, path, method,
        headers: { 'X-Huey-Client': GRWTSK_CLIENT, ...(token ? { 'X-Huey-Session': token } : {}),
          ...(method === 'POST' ? { Origin: origin, 'Content-Type': 'application/json' } : {}), ...headers } }, res => {
        let bytes = ''; res.setEncoding('utf8'); res.on('data', chunk => { bytes += chunk; }); res.on('end', () => {
          let value; try { value = JSON.parse(bytes); } catch { value = bytes; }
          resolve({ status: res.statusCode, headers: res.headers, value });
        });
      }); req.on('error', reject); req.end(payload);
    });
  }
  let token;
  const session = await call('/__grwtsk/session'); assert.equal(session.status, 200); token = session.value.token;
  const propose = async (changes = {}) => {
    const current = (await call(`/__grwtsk/read?id=${id}`)).value;
    return call('/__grwtsk/propose', { method: 'POST', data: { id, baseVersion: current.version, beforeDigest: current.rawDigest,
      after: 'A revised synthetic paragraph.', key: 'synthetic-1', requestRef: 'test request', ...changes } });
  };
  const decide = (op, changes = {}) => call('/__grwtsk/decide', { method: 'POST', data: { operationId: op.id, reviewDigest: op.digest,
    approvalRef: `Local editor Apply click ${session.value.session}`, status: 'applied-private', ...changes } });
  const chat = async (message, changes = {}) => { const current = (await call(`/__grwtsk/read?id=${id}`)).value;
    return call('/__grwtsk/chat', { method: 'POST', data: { id, message, basis: current.basis, baseVersion: current.version, beforeDigest: current.rawDigest, ...changes } }); };
  return { root, store, dir, port, origin, call, propose, decide, chat, session, mutate(fn) { fn(snap); }, sourceFile: join(root, 'manuscript/synthetic.md'), wording };
}

test('HTTP bridge requires loopback Host/port, editor header, session and same origin', async t => {
  const f = await fixture(t);
  assert.equal(f.session.headers['cache-control'], 'no-store'); assert.equal(f.session.headers['x-content-type-options'], 'nosniff');
  assert.equal(f.session.headers['access-control-allow-origin'], undefined);
  for (const headers of [{ Host: `evil.test:${f.port}` }, { Host: `127.0.0.1:${f.port + 1}` }, { 'X-Huey-Client': '' },
    { Origin: 'http://evil.test' }, { 'X-Huey-Session': 'wrong' }]) {
    assert.equal((await f.call('/__grwtsk/catalog', { headers })).status, 403);
  }
  assert.equal((await f.call('/__grwtsk/session', { headers: { Origin: 'http://evil.test' } })).status, 403);
  assert.equal((await f.call('/__grwtsk/chat', { method: 'POST', data: { id, message: 'Synthetic request.' }, headers: { Origin: '' } })).status, 403);
  assert.equal((await f.call('/__grwtsk/chat', { method: 'OPTIONS', headers: { Origin: 'http://evil.test' } })).status, 403);
  assert.equal((await f.call('/__grwtsk/catalog', { method: 'POST', data: {} })).status, 405);
  assert.equal((await f.call('/__grwtsk/unknown')).status, 404);
  assert.equal((await f.call('/unrelated')).status, 404);
});

test('catalog and exact source/overlay review stay local and preserve canonical bytes', async t => {
  const f = await fixture(t), catalog = await f.call('/__grwtsk/catalog');
  assert.equal(catalog.value.revision, 'b'.repeat(40)); assert.equal(catalog.value.paragraphs[0].id, id);
  assert.equal(catalog.value.slots[0].materialization, 'partial'); assert.deepEqual(catalog.value.slots[0].issues, [358]);
  assert.equal(catalog.value.slots[0].presence, 'present'); assert.equal(catalog.value.slots[0].editorialMaterialization, 'partial');
  assert.equal(catalog.value.slots[0].observedReaderAdmission, 'unavailable');
  assert.equal(catalog.value.slots[0].publicationAnnotation.authoritative, false);
  const proposed = await f.propose(); assert.equal(proposed.status, 200); const op = proposed.value;
  assert.match(op.actor, /^local-editor-client\/uid-/); assert.match(op.session, /^local-editor-session\//);
  assert.equal((await f.call(`/__grwtsk/read?id=${id}`)).value.raw, raw);
  const review = (await f.call(`/__grwtsk/review?id=${op.id}`)).value;
  assert.deepEqual(review.diff, { before: raw, after: op.after }); assert.equal(review.conflict, null);
  const receipt = await f.decide(op); assert.equal(receipt.status, 200); assert.equal(receipt.value.effect, 'local private overlay only');
  const current = (await f.call(`/__grwtsk/read?id=${id}`)).value;
  assert.equal(current.raw, op.after); assert.equal(current.sourceVersion, catalog.value.paragraphs[0].sourceVersion); assert.equal(current.privateOperation, op.id);
  assert.equal(readFileSync(f.sourceFile, 'utf8'), f.wording);
  assert.equal((statSync(join(f.store, 'workspace.json')).mode & 0o777), 0o600);
  assert.equal((await f.call('/__grwtsk/catalog')).value.paragraphs[0].privateOperation, op.id);
  const linked = await f.call('/__grwtsk/link', { method: 'POST', data: { operationId: op.id, url: 'https://github.com/grwtsk/huey/issues/358' } });
  assert.equal(linked.value.effect, 'local reference only; no GitHub write or verified external disposition');
  const handoff = (await f.call(`/__grwtsk/handoff?id=${op.id}`)).value;
  assert.equal(handoff.localDisposition, 'applied-private'); assert.equal(handoff.base, 'pre-release');
  for (const privateValue of [raw, op.after, op.source.path, op.beforeDigest, op.digest]) assert.equal(JSON.stringify(handoff).includes(privateValue), false);
});

test('HTTP stale checks reject altered source basis and competing local edits', async t => {
  const f = await fixture(t), first = (await f.propose()).value;
  const competing = (await f.propose({ key: 'competing', after: 'A competing synthetic paragraph.' })).value;
  assert.equal((await f.decide(first)).status, 200); assert.equal((await f.decide(competing)).status, 409);
  assert.match((await f.call(`/__grwtsk/review?id=${competing.id}`)).value.conflict, /stale/);
  f.mutate(s => { s.basis = 'changed-basis'; });
  assert.equal((await f.call(`/__grwtsk/read?id=${id}`)).status, 409);
  assert.match((await f.call(`/__grwtsk/review?id=${first.id}`)).value.conflict, /stale/);
  assert.equal(readFileSync(f.sourceFile, 'utf8'), f.wording);
});

test('private recovery exposes three versions and resumes source without rewriting applied history', async t => {
  const f = await fixture(t), op = (await f.propose()).value;
  await f.decide(op);
  const original = JSON.parse(readFileSync(join(f.store, 'workspace.json'), 'utf8'));
  f.mutate(s => { s.basis = 'changed-basis'; s.revision = 'c'.repeat(40); });
  const inspection = await f.call(`/__grwtsk/inspect?id=${id}`);
  assert.equal(inspection.status, 200); assert.equal(inspection.value.status, 'stale-overlay');
  assert.equal(inspection.value.previous.before, raw);
  assert.equal(inspection.value.previous.after, op.after);
  assert.equal(inspection.value.source.raw, raw);
  assert.equal(inspection.value.source.revision, 'c'.repeat(40));
  assert.equal(inspection.value.current, null);
  const input = { id, reviewDigest: inspection.value.reviewDigest, decisionRef: 'Synthetic explicit resume click', key: 'recovery-1' };
  assert.equal((await f.call('/__grwtsk/resume-source', { method: 'POST', data: input, headers: { Origin: 'http://evil.test' } })).status, 403);
  assert.equal((await f.call('/__grwtsk/resume-source', { method: 'POST', data: { ...input, actor: 'author' } })).status, 400);
  const resumed = await f.call('/__grwtsk/resume-source', { method: 'POST', data: input });
  assert.equal(resumed.status, 200);
  assert.deepEqual((await f.call('/__grwtsk/resume-source', { method: 'POST', data: input })).value, resumed.value);
  assert.equal((await f.call('/__grwtsk/resume-source', { method: 'POST', data: { ...input, decisionRef: 'Changed decision' } })).status, 409);
  const current = (await f.call(`/__grwtsk/read?id=${id}`)).value;
  assert.equal(current.raw, raw); assert.equal(current.privateOperation, null);
  assert.equal((await f.call('/__grwtsk/catalog')).value.paragraphs[0].privateOperation, null);
  const retained = JSON.parse(readFileSync(join(f.store, 'workspace.json'), 'utf8'));
  for (const key of ['proposals', 'decisions', 'links']) assert.deepEqual(retained[key], original[key]);
  assert.equal(retained.reconciliations.length, 1);
  const next = (await f.propose({ key: 'after-resume', after: 'Synthetic new private edit after explicit recovery.' })).value;
  assert.equal((await f.decide(next)).status, 200);
  assert.equal((await f.call(`/__grwtsk/read?id=${id}`)).value.raw, next.after);
  assert.equal(readFileSync(f.sourceFile, 'utf8'), f.wording);
});

test('recovery refuses drift after comparison and cannot replace unavailable source with private text', async t => {
  const f = await fixture(t), op = (await f.propose()).value;
  await f.decide(op); f.mutate(s => { s.basis = 'drift-1'; });
  const inspected = (await f.call(`/__grwtsk/inspect?id=${id}`)).value;
  const input = { id, reviewDigest: inspected.reviewDigest, decisionRef: 'Synthetic comparison', key: 'drifting-recovery' };
  f.mutate(s => { s.basis = 'drift-2'; });
  assert.equal((await f.call('/__grwtsk/resume-source', { method: 'POST', data: input })).status, 409);
  assert.equal((await f.call(`/__grwtsk/read?id=${id}`)).status, 409);
  const refreshed = (await f.call(`/__grwtsk/inspect?id=${id}`)).value;
  assert.notEqual(refreshed.reviewDigest, inspected.reviewDigest);
  f.mutate(s => { s.entries = []; });
  const unavailable = (await f.call(`/__grwtsk/inspect?id=${id}`)).value;
  assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.source, null); assert.equal(unavailable.current, null);
  assert.equal(unavailable.previous.after, op.after);
  assert.notEqual((await f.call('/__grwtsk/resume-source', { method: 'POST', data: { ...input, reviewDigest: refreshed.reviewDigest } })).status, 200);
  assert.equal(readFileSync(f.sourceFile, 'utf8'), f.wording);
});

test('selected private queue survives uncertain responses and immutable cancellation without exposing wording', async t => {
  const f = await fixture(t), first = (await f.propose()).value;
  const second = (await f.propose({ key: 'saved-2', after: 'Another synthetic saved candidate.' })).value;
  const saved = await f.call(`/__grwtsk/queue?id=${id}&limit=1`);
  assert.equal(saved.status, 200); assert.equal(saved.value.target, id);
  assert.deepEqual(saved.value.operations.map(op => op.id), [second.id]);
  assert.equal(saved.value.operations[0].status, 'proposed-private');
  assert.equal(saved.value.operations[0].conflict, null);
  for (const wording of [raw, first.after, second.after, first.beforeDigest, first.source.path]) assert.equal(JSON.stringify(saved.value).includes(wording), false);
  const older = await f.call(`/__grwtsk/queue?id=${id}&limit=1&beforeSequence=${saved.value.nextBeforeSequence}`);
  assert.deepEqual(older.value.operations.map(op => op.id), [first.id]); assert.equal(older.value.nextBeforeSequence, null);
  const review = (await f.call(`/__grwtsk/review?id=${second.id}`)).value;
  assert.equal(review.diff.after, second.after);
  const cancelled = await f.decide(second, { status: 'cancelled', approvalRef: 'Synthetic explicit cancellation' });
  assert.equal(cancelled.status, 200);
  assert.deepEqual((await f.decide(second, { status: 'cancelled', approvalRef: 'Synthetic explicit cancellation' })).value, cancelled.value);
  assert.equal((await f.decide(second)).status, 409);
  const reloaded = (await f.call(`/__grwtsk/queue?id=${id}`)).value;
  assert.equal(reloaded.operations[0].status, 'cancelled');
  assert.equal((await f.call(`/__grwtsk/read?id=${id}`)).value.raw, raw);
  assert.equal((await f.call(`/__grwtsk/review?id=${second.id}`)).value.diff.after, second.after);
  f.mutate(s => { s.basis = 'changed-queue-basis'; });
  const stale = (await f.call(`/__grwtsk/queue?id=${id}`)).value;
  assert.match(stale.operations.find(op => op.id === first.id).conflict, /stale/);
  f.mutate(s => { s.entries = []; });
  const unavailable = (await f.call(`/__grwtsk/queue?id=${id}`)).value;
  assert.match(unavailable.operations.find(op => op.id === first.id).conflict, /unavailable|unmapped/);
  assert.equal(readFileSync(f.sourceFile, 'utf8'), f.wording);
});

test('queue query and target scope are bounded under the existing local capability', async t => {
  const f = await fixture(t); await f.propose();
  assert.equal((await f.call(`/__grwtsk/queue?id=${id}`, { headers: { 'X-Huey-Session': 'wrong' } })).status, 403);
  for (const query of [`id=${id}&id=${id2}`, `id=${id}&path=/etc/passwd`, `id=${id}&limit=21`, `id=${id}&limit=0`,
    `id=${id}&beforeSequence=-1`, `id=${id}&beforeSequence=1.2`, `id=${id}&limit=1&limit=2`, 'id=../../private', '']) {
    assert.equal((await f.call('/__grwtsk/queue?' + query)).status, 400);
  }
  assert.equal((await f.call(`/__grwtsk/queue?id=${id2}`)).value.operations.length, 0);
  assert.equal((await f.call(`/__grwtsk/queue?id=${id}&limit=2&beforeSequence=1`)).value.operations.length, 0);
  assert.equal((await f.call('/__grwtsk/queue', { method: 'POST', data: { id } })).status, 405);
});

test('bounded JSON rejects arbitrary paths, actor spoofing, multi-block replacement and inauthentic acceptance status', async t => {
  const f = await fixture(t);
  assert.equal((await f.propose({ actor: 'author' })).status, 400);
  assert.equal((await f.propose({ after: 'One.\n\nTwo.' })).status, 400);
  assert.equal((await f.propose({ id: '../../private/file' })).status, 400);
  assert.equal((await f.call('/__grwtsk/read?id=x&id=y')).status, 400);
  assert.equal((await f.call('/__grwtsk/read?id=x&path=/etc/passwd')).status, 400);
  const op = (await f.propose()).value;
  assert.equal((await f.decide(op, { status: 'author-accepted' })).status, 400);
  assert.equal((await f.decide(op, { approvalRef: '' })).status, 400);
  assert.equal((await f.call('/__grwtsk/chat', { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.call('/__grwtsk/chat', { method: 'POST', body: '{invalid' })).status, 400);
  assert.equal((await f.call('/__grwtsk/chat', { method: 'POST', body: ' '.repeat(262145) })).status, 413);
  assert.equal((await f.call('/__grwtsk/chat', { method: 'POST', data: { id, message: 'hello', hostRef: 'spoof' } })).status, 400);
});

test('chat captures exact selected context, stays pending and displays only explicitly appended actual host replies', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/__grwtsk/chat')).value.messages.length, 0);
  const queued = await f.chat('Inspect this synthetic paragraph.', { requestRef: 'synthetic-local-selection' });
  assert.equal(queued.status, 200); assert.equal(queued.value.messages.length, 1); assert.equal(queued.value.messages[0].role, 'user');
  const request = queued.value.requests[0]; assert.equal(request.status, 'pending-host'); assert.equal(request.entityId, id);
  assert.equal(request.selected.raw, raw); assert.equal(request.selected.source.path, 'manuscript/synthetic.md');
  assert.equal((statSync(join(f.store, 'grwtsk-thread.json')).mode & 0o777), 0o600);
  const later = (await f.call('/__grwtsk/chat')).value;
  assert.equal(later.requests[0].status, 'pending-host'); assert.equal(later.messages.filter(m => m.role === 'assistant').length, 0);
  assert.equal((await f.call('/__grwtsk/reply', { method: 'POST', data: { requestId: request.id, text: 'Invented browser reply.', hostRef: 'spoof' } })).status, 404);
  const actualReply = 'Actual synthetic test-host response; this is a fixture, not manuscript prose.';
  const answered = appendHostReply({ root: f.root, store: f.store, requestId: request.id, text: actualReply, hostRef: 'synthetic-existing-Codex-host-test' });
  assert.equal(answered.requests[0].status, 'answered'); assert.equal(answered.messages[1].text, actualReply);
  assert.equal(answered.messages[1].selectedEntityId, id);
  assert.equal((await f.call('/__grwtsk/chat')).value.messages[1].hostRef, 'synthetic-existing-Codex-host-test');
  assert.deepEqual(appendHostReply({ root: f.root, store: f.store, requestId: request.id, text: actualReply, hostRef: 'synthetic-existing-Codex-host-test' }).messages, answered.messages);
  assert.throws(() => appendHostReply({ root: f.root, store: f.store, requestId: request.id, text: 'Changed host reply.', hostRef: 'synthetic-existing-Codex-host-test' }), /different host reply/);
  assert.equal(readFileSync(f.sourceFile, 'utf8'), f.wording);
});

test('chat source drift is explicit; unsafe private thread entries and writer locks fail closed', async t => {
  const f = await fixture(t);
  const op = (await f.propose()).value; await f.decide(op);
  const displayed = (await f.call(`/__grwtsk/read?id=${id}`)).value; f.mutate(s => { s.basis = 'changed'; });
  assert.equal((await f.call('/__grwtsk/chat', { method: 'POST', data: { id, message: 'Cannot silently use stale context.', basis: displayed.basis, baseVersion: displayed.version, beforeDigest: displayed.rawDigest } })).status, 409);
  const threadFile = join(f.store, 'grwtsk-thread.json'); writeFileSync(threadFile, '{}', { mode: 0o644 });
  assert.equal((await f.call('/__grwtsk/chat')).status, 400); chmodSync(threadFile, 0o600); rmSync(threadFile);
  const target = join(f.dir, 'unrelated.json'); writeFileSync(target, '{}', { mode: 0o600 }); symlinkSync(target, threadFile);
  assert.equal((await f.call('/__grwtsk/chat')).status, 400); rmSync(threadFile);
  f.mutate(s => { s.basis = op.basis; }); writeFileSync(join(f.store, 'grwtsk-thread.lock'), '', { mode: 0o600 });
  assert.equal((await f.chat('Locked fixture request.')).status, 409);
});

test('chat rejects displayed context after a competing private apply or wrong exact wording', async t => {
  const f = await fixture(t), displayed = (await f.call(`/__grwtsk/read?id=${id}`)).value;
  const before = { id, message: 'Synthetic selected request.', basis: displayed.basis, baseVersion: displayed.version, beforeDigest: displayed.rawDigest };
  assert.equal((await f.call('/__grwtsk/chat', { method: 'POST', data: { ...before, beforeDigest: 'wrong' } })).status, 409);
  assert.equal((await f.call('/__grwtsk/chat', { method: 'POST', data: { id, message: 'No displayed basis.' } })).status, 400);
  const op = (await f.propose()).value; await f.decide(op);
  assert.equal((await f.call('/__grwtsk/chat', { method: 'POST', data: before })).status, 409);
  assert.equal((await f.call('/__grwtsk/chat')).value.requests.length, 0);
  const fresh = await f.chat('Current overlay request.'); assert.equal(fresh.status, 200);
  assert.equal(fresh.value.requests[0].selected.raw, op.after); assert.equal(fresh.value.requests[0].selected.privateOperation, op.id);
});

function cacheFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'huey-grwtsk-cache-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'repo'); mkdirSync(root);
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '--initial-branch=main']);
  for (const path of ['manuscript', 'planning/editorial-inventory', 'planning/editorial-pages', 'reader/content']) mkdirSync(join(root, path), { recursive: true });
  const wording = `${raw}\n`, sourceFile = join(root, 'manuscript/synthetic.md'), placeholder = join(root, 'manuscript/placeholder.md');
  writeFileSync(sourceFile, wording); writeFileSync(placeholder, '<!-- Pending synthetic material. -->\n');
  const book = { schema: 'huey.book.v1', items: [
    { id: 'C01', movement: 'preamble', title: 'Synthetic first', path: 'manuscript/synthetic.md' },
    { id: 'C02', movement: 'interlude', title: 'Synthetic second', path: 'manuscript/placeholder.md' },
  ] };
  writeFileSync(join(root, 'book.yaml'), JSON.stringify(book));
  const reader = { chapters: [{ id: 'C01', status: 'admitted' }, { id: 'C02', status: 'unavailable' }] };
  const readerFile = join(root, 'reader/content/book.json'); writeFileSync(readerFile, JSON.stringify(reader));
  const commit = () => { git(['add', '--', '.']); git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'Synthetic cache fixture']); return git(['rev-parse', 'HEAD']); };
  const revision = commit();
  const entity = n => `he_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const slot = (key, n, sources) => ({ key, entityId: entity(n), kind: 'Chapter', group: 'book', label: null, optional: null,
    presence: 'present', publicationAnnotation: { label: 'working', authoritative: false }, unmaterializedAccess: null, sources, issues: [358], omissionRef: null });
  const source = { key: 'synthetic-source', role: 'canonical', extent: 'full', targets: ['C01'], path: 'manuscript/synthetic.md', blob: gitBlob(wording), revision,
    scopeRefs: ['https://github.com/grwtsk/huey/issues/2'] };
  const registry = { schema: 'huey.editorial-registry.v1', basisRevision: revision,
    containers: { work: entity(10), front: entity(11), body: entity(12), back: entity(13), movements: { preamble: entity(14), interlude: entity(15), excursion: entity(16) } },
    slots: [slot('C01', 20, [source.key]), slot('C02', 21, [])], sources: [source], supportPaths: [] };
  const registryFile = join(root, 'planning/editorial-inventory/registry.json'); writeFileSync(registryFile, JSON.stringify(registry));
  const blocks = parseEditorialMarkdown(wording);
  const plan = { schema: 'huey.editorial-pages.v1', parser: 'huey.editorial-markdown/1', sources: [{ sourceKey: source.key, revision, path: source.path,
    blob: source.blob, blocks: blocks.map(block => ({ id, kind: block.kind, start: block.source.start, end: block.source.end })) }] };
  const planFile = join(root, 'planning/editorial-pages/plan.json'); writeFileSync(planFile, JSON.stringify(plan)); commit();
  return { root, git, commit, registry, registryFile, plan, planFile, sourceFile, placeholder, wording, reader, readerFile };
}

test('checked snapshot cache reuses parsing only while exact source and metadata inputs remain current', t => {
  const f = cacheFixture(t), read = createCheckedSnapshotReader(f.root), first = read();
  assert.equal(first.entries[0].raw, raw); assert.equal(read(), first); assert.equal(read.inventory().slots[0].observedReaderAdmission, 'admitted');
  const timestamp = statSync(f.sourceFile).mtime;
  writeFileSync(f.sourceFile, f.wording.replace('source', 'candle')); utimesSync(f.sourceFile, timestamp, timestamp);
  assert.throws(() => read(), /differs from pinned source/); writeFileSync(f.sourceFile, f.wording);
  assert.equal(read(), first);
  writeFileSync(f.placeholder, 'Unpinned synthetic prose.\n'); assert.throws(() => read(), /pinned canonical source/);
  writeFileSync(f.placeholder, '<!-- Pending synthetic material. -->\n');
  const changedPlan = structuredClone(f.plan); changedPlan.sources[0].blocks[0].id = id2;
  writeFileSync(f.planFile, JSON.stringify(changedPlan)); const second = read();
  assert.notEqual(second, first); assert.equal(second.entries[0].id, id2); assert.equal(read(), second);
  f.reader.chapters[0].status = 'unavailable'; writeFileSync(f.readerFile, JSON.stringify(f.reader));
  const third = read(); assert.notEqual(third, second); assert.equal(read.inventory().slots[0].observedReaderAdmission, 'unavailable');
  f.registry.slots[0].issues = [358, 360]; writeFileSync(f.registryFile, JSON.stringify(f.registry));
  assert.notEqual(read(), third); assert.deepEqual(read.inventory().slots[0].issues, [358, 360]);
  const oldHead = read().revision, newHead = f.commit(); assert.notEqual(newHead, oldHead); assert.equal(read().revision, newHead);
  rmSync(f.sourceFile); symlinkSync(f.placeholder, f.sourceFile); assert.throws(() => read(), /unsafe checked context path/);
});

test('checked cache refreshes Git index coverage and refuses newly tracked undeclared manuscript', t => {
  const f = cacheFixture(t), read = createCheckedSnapshotReader(f.root); read();
  writeFileSync(join(f.root, 'manuscript/undeclared.md'), 'Synthetic undeclared manuscript.');
  f.git(['add', '--', 'manuscript/undeclared.md']); assert.throws(() => read(), /unclassified tracked manuscript/);
});

test('checked cache does not reuse prior source availability when a pinned Git blob disappears', t => {
  const f = cacheFixture(t), read = createCheckedSnapshotReader(f.root), first = read(); assert.equal(first.entries.length, 1);
  const blob = f.registry.sources[0].blob, object = join(f.root, '.git/objects', blob.slice(0, 2), blob.slice(2));
  const held = join(f.root, 'held-synthetic-object'); renameSync(object, held);
  try { const unavailable = read(); assert.notEqual(unavailable, first); assert.equal(unavailable.entries.length, 0); }
  finally { renameSync(held, object); }
  assert.equal(read().entries[0].id, id);
});

test('public issue reads are selected, bounded and return unavailable context without inferred authority', async t => {
  const calls = [], f = await fixture(t, { readIssue: async number => { calls.push(number); if (number === 14) throw new Error('synthetic unavailable');
    return { number, title: 'Synthetic issue', body: 'Untrusted context.', state: 'OPEN', url: `https://github.com/grwtsk/huey/issues/${number}`, comments: [{ body: 'Synthetic comment.', url: null }] }; } });
  const response = await f.call('/__grwtsk/issues?numbers=2,%2014,%20358');
  assert.equal(response.status, 200); assert.deepEqual(calls, [2, 14, 358]); assert.deepEqual(response.value.issues.map(i => i.number), [2, 358]);
  assert.equal(response.value.errors[0].number, 14); assert.match(response.value.contextStatus, /untrusted/);
  for (const numbers of ['0', '-1', '1,1', '1;touch', '1,2,3,4,5,6,7,8,9,10,11,12,13', '9007199254740992']) {
    assert.equal((await f.call(`/__grwtsk/issues?numbers=${encodeURIComponent(numbers)}`)).status, 400);
  }
  assert.deepEqual(calls, [2, 14, 358]);
});
