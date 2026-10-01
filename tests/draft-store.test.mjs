import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, symlinkSync, linkSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatWorkspace } from '../scripts/chat_workspace.mjs';
import { seal } from '../scripts/literary_model.mjs';
import { parseEditorialMarkdown } from '../scripts/editorial_markdown.mjs';

// Synthetic paragraphs exercise the admitted metadata boundary without reading
// any real manuscript or restricted store. This fixture asserts no source truth.
const uid = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const entity = n => `he_${uid(n)}`;
const version = (id, raw) => seal({ id, kind: 'Paragraph', state: parseEditorialMarkdown(raw)[0].state }).version;
const moduleURL = new URL('../scripts/chat_workspace.mjs', import.meta.url).href;
function fixture(t, count = 1) {
  const dir = mkdtempSync(join(tmpdir(), 'huey-draft-store-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'repo'), store = join(dir, 'private');
  mkdirSync(root); mkdirSync(join(root, '.git'));
  let snap = { basis: `sha256:${'a'.repeat(64)}`, revision: 'b'.repeat(40),
    slots: [{ key: 'C08A', status: 'mapped', paragraphs: count }], entries: [] };
  for (let n = 1; n <= count; n++) {
    const id = entity(n), raw = `A synthetic checkpoint base paragraph ${n}.`;
    snap.entries.push({ id, raw, version: version(id, raw), slot: 'C08A',
      source: { key: 'synthetic-admitted-source', revision: 'c'.repeat(40),
        path: 'manuscript/02-interlude/baptism-in-the-color-of-rain.md',
        blob: 'e28d4b10c74f8ed6ec6e66b5131e0b25ab5479e1', lines: { start: n, end: n }, utf16: { start: 0, end: raw.length } },
      scopeRefs: ['https://github.com/grwtsk/huey/issues/2#issuecomment-5782472575'] });
  }
  const snapshot = () => structuredClone(snap), ws = new ChatWorkspace({ root, store, snapshot });
  const file = join(store, 'workspace.json');
  const request = (n = 1, overrides = {}) => {
    const current = ws.read(entity(n));
    return { id: current.id, basis: current.basis, revision: current.revision, sourceVersion: current.sourceVersion,
      baseVersion: current.version, beforeDigest: current.rawDigest, privateOperation: current.privateOperation,
      draft: 'An unfinished synthetic draft *\n\n', key: uid(n), expectedDigest: null, generation: ws.inspectDraft(entity(n)).generation, ...overrides };
  };
  return { dir, root, store, file, ws, request, snapshot, mutate(fn) { fn(snap); },
    bytes: () => readFileSync(file), reopen: () => new ChatWorkspace({ root, store, snapshot }) };
}
const save = (ws, request) => ws.saveDraft(request).checkpoint;
const discard = (ws, request) => ws.discardDraft({ generation: ws.inspectDraft(request.id).generation, ...request });
const restore = (ws, request) => ws.restoreDraft({ generation: ws.inspectDraft(request.id).generation, ...request });
const immutable = state => Object.fromEntries(['proposals', 'decisions', 'links', 'reconciliations'].map(key => [key, state[key]]));

test('explicit save survives restart, exact retry is stable and restoration remains unreviewed', t => {
  const f = fixture(t), req = f.request(), saved = save(f.ws, req), bytes = f.bytes();
  assert.equal(saved.before, f.ws.read(entity(1)).raw); assert.equal(saved.draft, req.draft);
  assert.equal(saved.key, req.key); assert.match(saved.requestDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(save(f.ws, req), saved); assert.deepEqual(f.bytes(), bytes);
  const reopened = f.reopen(), inspected = reopened.inspectDraft(entity(1));
  assert.deepEqual(inspected.checkpoint, saved); assert.equal(inspected.compatibility.status, 'current'); assert.equal(inspected.eligible, true);
  assert.deepEqual(restore(reopened, { id: entity(1), checkpointDigest: saved.digest }), { checkpointDigest: saved.digest, draft: req.draft });
  assert.deepEqual(f.bytes(), bytes); assert.equal(reopened.state().proposals.length, 0); assert.equal(reopened.state().decisions.length, 0);
  assert.equal(statSync(f.file).mode & 0o777, 0o600); assert.equal(statSync(f.store).mode & 0o777, 0o700);
  assert.throws(() => reopened.saveDraft({ ...req, draft: 'Different synthetic retry.' }));
  assert.throws(() => reopened.saveDraft({ ...req, expectedDigest: saved.digest }));
  assert.deepEqual(f.bytes(), bytes);
});

test('replacement and discard compare exact prior digest and never modify immutable histories', t => {
  const f = fixture(t), current = f.ws.read(entity(1));
  const op = f.ws.propose({ id: current.id, baseVersion: current.version, beforeDigest: current.rawDigest,
    after: 'Synthetic separately reviewed private application.', actor: 'synthetic-test', session: 'synthetic-session',
    requestRef: 'synthetic request', key: 'synthetic-proposal' });
  f.ws.decide({ operationId: op.id, reviewDigest: op.digest, approvalRef: 'synthetic private click', status: 'applied-private' });
  f.ws.link(op.id, 'https://github.com/grwtsk/huey/issues/359');
  const history = immutable(f.ws.state()), firstReq = f.request(), first = save(f.ws, firstReq), firstBytes = f.bytes();
  assert.equal(first.privateOperation, op.id); assert.notEqual(first.sourceVersion, first.baseVersion);
  assert.throws(() => f.ws.saveDraft(f.request(1, { key: uid(2), draft: 'Competing unconfirmed replacement.' })));
  assert.throws(() => discard(f.ws, { id: entity(1), expectedDigest: `sha256:${'0'.repeat(64)}` }));
  assert.deepEqual(f.bytes(), firstBytes);
  const replacementReq = f.request(1, { key: uid(2), expectedDigest: first.digest, draft: 'Synthetic explicit replacement.' });
  const second = save(f.ws, replacementReq), secondBytes = f.bytes();
  assert.notEqual(second.digest, first.digest); assert.deepEqual(save(f.ws, replacementReq), second);
  assert.throws(() => f.ws.saveDraft(f.request(1, { key: uid(3), expectedDigest: first.digest, draft: 'Stale synthetic replacement.' })));
  assert.throws(() => discard(f.ws, { id: entity(1), expectedDigest: first.digest }));
  assert.deepEqual(f.bytes(), secondBytes);
  const receipt = discard(f.ws, { id: entity(1), expectedDigest: second.digest }); assert.equal(receipt.status, 'discarded');
  assert.equal(f.ws.inspectDraft(entity(1)).checkpoint, null);
  assert.equal(discard(f.ws, { id: entity(1), expectedDigest: second.digest }).status, 'absent');
  assert.deepEqual(immutable(f.ws.state()), history);
  const empty = f.bytes();
  assert.throws(() => f.ws.saveDraft(firstReq));
  assert.throws(() => f.ws.saveDraft(replacementReq));
  assert.deepEqual(f.bytes(), empty);
  assert.equal(f.ws.inspectDraft(entity(1)).checkpoint, null);
  for (const secret of [second.before, second.draft, second.id, second.digest, second.beforeDigest]) assert.equal(JSON.stringify(receipt).includes(secret), false);
});

test('global generation fences old restoration and deleted retries while preserving active exact retries', t => {
  const f = fixture(t, 2), request = f.request(), first = f.ws.saveDraft(request);
  assert.equal(first.generation, 1);
  f.ws.saveDraft(f.request(2));
  const bytes = f.bytes(), inspected = f.ws.inspectDraft(entity(1));
  assert.equal(inspected.generation, 2);
  assert.deepEqual(f.ws.saveDraft(request).checkpoint, first.checkpoint);
  assert.deepEqual(f.bytes(), bytes);
  assert.throws(() => f.ws.restoreDraft({ id: entity(1), checkpointDigest: first.checkpoint.digest, generation: first.generation }));
  assert.throws(() => f.ws.discardDraft({ id: entity(1), expectedDigest: first.checkpoint.digest, generation: first.generation }));
  for (const generation of [undefined, null, -1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => f.ws.saveDraft(f.request(1, { generation, key: uid(3), expectedDigest: first.checkpoint.digest })));
  }
  assert.deepEqual(f.bytes(), bytes);
  const receipt = discard(f.ws, { id: entity(1), expectedDigest: first.checkpoint.digest });
  assert.equal(receipt.generation, 3);
  const deleted = f.bytes(); assert.throws(() => f.ws.saveDraft(request)); assert.deepEqual(f.bytes(), deleted);
});

test('checkpoint transactions preserve actual retained source-resume history', t => {
  const f = fixture(t), before = f.ws.read(entity(1));
  const op = f.ws.propose({ id: before.id, baseVersion: before.version, beforeDigest: before.rawDigest,
    after: 'Synthetic historical working text before a source resume.', actor: 'synthetic-test', session: 'synthetic-session',
    requestRef: 'synthetic historical request', key: 'synthetic-history-proposal' });
  f.ws.decide({ operationId: op.id, reviewDigest: op.digest, approvalRef: 'synthetic historical private decision', status: 'applied-private' });
  f.mutate(s => { s.basis = `sha256:${'d'.repeat(64)}`; });
  const comparison = f.ws.inspect(entity(1));
  f.ws.resumeSource({ id: entity(1), reviewDigest: comparison.reviewDigest, decisionRef: 'synthetic explicit source resume', key: 'synthetic-resume-key' });
  const history = immutable(f.ws.state()); assert.equal(history.reconciliations.length, 1);
  const saved = save(f.ws, f.request()); discard(f.ws, { id: entity(1), expectedDigest: saved.digest });
  assert.deepEqual(immutable(f.reopen().state()), history);
});

test('fresh exact bindings and admitted source scope guard save and restore while retaining stale comparison', t => {
  const f = fixture(t), request = f.request(), saved = save(f.ws, request), bytes = f.bytes();
  const changes = [{ basis: `sha256:${'0'.repeat(64)}` }, { revision: '0'.repeat(40) }, { sourceVersion: version(entity(1), 'Another synthetic base.') },
    { baseVersion: version(entity(1), 'Another synthetic working result.') }, { beforeDigest: `sha256:${'0'.repeat(64)}` },
    { privateOperation: `op_${uid(9)}` }];
  for (let n = 0; n < changes.length; n++) {
    assert.throws(() => f.ws.saveDraft({ ...request, generation: f.ws.inspectDraft(entity(1)).generation,
      key: uid(n + 10), expectedDigest: saved.digest, ...changes[n] }));
    assert.deepEqual(f.bytes(), bytes);
  }
  f.mutate(s => { s.basis = `sha256:${'c'.repeat(64)}`; });
  assert.equal(f.ws.inspectDraft(entity(1)).compatibility.status, 'stale');
  const staleRetry = f.ws.saveDraft(request);
  assert.deepEqual(staleRetry.checkpoint, saved); assert.equal(staleRetry.compatibility.status, 'stale'); assert.equal(staleRetry.eligible, true);
  assert.deepEqual(f.bytes(), bytes);
  assert.throws(() => restore(f.ws, { id: entity(1), checkpointDigest: saved.digest })); assert.deepEqual(f.bytes(), bytes);
  f.mutate(s => { s.entries = []; });
  assert.equal(f.ws.inspectDraft(entity(1)).compatibility.status, 'unavailable');
  const unavailableRetry = f.ws.saveDraft(request);
  assert.deepEqual(unavailableRetry.checkpoint, saved); assert.equal(unavailableRetry.compatibility.status, 'unavailable'); assert.equal(unavailableRetry.eligible, false);
  assert.deepEqual(f.bytes(), bytes);
  assert.throws(() => restore(f.ws, { id: entity(1), checkpointDigest: saved.digest })); assert.deepEqual(f.bytes(), bytes);
  const unsupported = fixture(t);
  unsupported.mutate(s => { s.entries[0].slot = 'C01'; });
  assert.equal(unsupported.ws.inspectDraft(entity(1)).eligible, false);
  assert.throws(() => unsupported.ws.saveDraft(unsupported.request())); assert.equal(existsSync(unsupported.file), false);
  unsupported.mutate(s => { s.entries[0].slot = 'C08A'; s.entries[0].source.blob = 'd'.repeat(40); });
  assert.throws(() => unsupported.ws.saveDraft(unsupported.request())); assert.equal(existsSync(unsupported.file), false);
});

test('retained checkpoint inspection and discard survive unavailable source without granting restoration', t => {
  const f = fixture(t), request = f.request(), checkpoint = save(f.ws, request), bytes = f.bytes();
  const unavailable = new ChatWorkspace({ root: f.root, store: f.store,
    snapshot() { throw new Error('Synthetic source-plan unavailable'); } });
  const index = unavailable.draftIndex();
  assert.deepEqual(index, { generation: 1, checkpoints: [{ target: checkpoint.target, createdAt: checkpoint.createdAt }] });
  for (const secret of [checkpoint.before, checkpoint.draft, checkpoint.id, checkpoint.digest, checkpoint.beforeDigest,
    checkpoint.sourceVersion, checkpoint.baseVersion]) assert.equal(JSON.stringify(index).includes(secret), false);
  const inspection = unavailable.inspectDraft(entity(1));
  assert.deepEqual(inspection.checkpoint, checkpoint); assert.equal(inspection.compatibility.status, 'unavailable'); assert.equal(inspection.eligible, false);
  assert.throws(() => unavailable.saveDraft({ ...request, key: uid(2), generation: 1, expectedDigest: checkpoint.digest }));
  assert.throws(() => unavailable.restoreDraft({ id: entity(1), checkpointDigest: checkpoint.digest, generation: 1 }));
  assert.deepEqual(f.bytes(), bytes);
  assert.equal(unavailable.discardDraft({ id: entity(1), expectedDigest: checkpoint.digest, generation: 1 }).status, 'discarded');
  assert.deepEqual(unavailable.draftIndex(), { generation: 2, checkpoints: [] });
  assert.deepEqual(immutable(unavailable.state()), immutable(f.ws.state()));
});

test('count and exact serialized-byte overflow preserve previous checkpoint rows without eviction', t => {
  const f = fixture(t, 21);
  for (let n = 1; n <= 20; n++) f.ws.saveDraft(f.request(n, { draft: '' }));
  const full = f.bytes(); assert.throws(() => f.ws.saveDraft(f.request(21))); assert.deepEqual(f.bytes(), full);
  assert.equal(f.ws.state().draftCheckpoints.checkpoints.length, 20);
  const g = fixture(t, 4);
  for (let n = 1; n <= 3; n++) g.ws.saveDraft(g.request(n, { draft: '漢'.repeat(100000) }));
  const before = g.bytes();
  assert.throws(() => g.ws.saveDraft(g.request(4, { draft: '漢'.repeat(100000) }))); assert.deepEqual(g.bytes(), before);
  const saved = g.ws.inspectDraft(entity(1)).checkpoint;
  assert.throws(() => g.ws.saveDraft(g.request(1, { key: uid(10), expectedDigest: saved.digest, draft: '\u0000'.repeat(100000) })));
  assert.deepEqual(g.bytes(), before); assert.equal(g.ws.inspectDraft(entity(1)).checkpoint.digest, saved.digest);
});

test('unsafe files, store modes, unresolved shared lock and missing configuration fail closed', t => {
  const f = fixture(t), saved = save(f.ws, f.request()), bytes = f.bytes();
  const replacement = f.request(1, { key: uid(2), expectedDigest: saved.digest });
  chmodSync(f.store, 0o755); assert.throws(() => f.ws.saveDraft(replacement)); chmodSync(f.store, 0o700);
  chmodSync(f.file, 0o640); assert.throws(() => f.ws.inspectDraft(entity(1))); chmodSync(f.file, 0o600);
  chmodSync(f.file, 0o700); assert.throws(() => f.ws.inspectDraft(entity(1))); chmodSync(f.file, 0o600);
  const external = join(f.dir, 'synthetic-external.json'); writeFileSync(external, bytes, { mode: 0o600 });
  rmSync(f.file); symlinkSync(external, f.file); assert.throws(() => f.ws.inspectDraft(entity(1))); rmSync(f.file);
  linkSync(external, f.file); assert.throws(() => f.ws.inspectDraft(entity(1))); rmSync(f.file); writeFileSync(f.file, bytes, { mode: 0o600 });
  rmSync(f.file); execFileSync('mkfifo', ['-m', '600', f.file]);
  assert.throws(() => f.ws.inspectDraft(entity(1))); rmSync(f.file); writeFileSync(f.file, bytes, { mode: 0o600 });
  writeFileSync(join(f.store, 'workspace.lock'), '', { mode: 0o600 });
  assert.throws(() => f.ws.saveDraft(replacement));
  assert.deepEqual(f.bytes(), bytes); assert.equal(existsSync(join(f.store, 'workspace.lock')), true);
  assert.throws(() => new ChatWorkspace({ root: f.root }));
  const otherRoot = join(f.dir, 'other-repo'); mkdirSync(otherRoot); mkdirSync(join(otherRoot, '.git'));
  const other = new ChatWorkspace({ root: otherRoot, store: f.store, snapshot: f.snapshot }); assert.throws(() => other.inspectDraft(entity(1)));
});

const childSource = `
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
const [moduleURL, fixturePath, requestJSON, action, fault] = process.argv.slice(1);
const f = JSON.parse(fs.readFileSync(fixturePath, 'utf8')), req = JSON.parse(requestJSON);
if (fault === 'write') { const write = fs.writeFileSync; fs.writeFileSync = (p,...args) => { if (String(p).endsWith('.tmp')) throw new Error('Synthetic write failure'); return write(p,...args); }; }
if (fault === 'rename' || fault === 'kill') { const rename = fs.renameSync; fs.renameSync = (a,b) => { if (String(b).endsWith('/workspace.json')) { if(fault === 'kill') process.kill(process.pid,'SIGKILL'); throw new Error('Synthetic rename failure'); } return rename(a,b); }; }
syncBuiltinESMExports();
const {ChatWorkspace} = await import(moduleURL);
const ws = new ChatWorkspace({root:f.root,store:f.store,snapshot:()=>structuredClone(f.snapshot)});
try { const value = action === 'discard' ? ws.discardDraft(req) : ws.saveDraft(req); console.log(JSON.stringify({ok:true,id:value.checkpoint?.id??null,status:value.status??null})); }
catch(error) { console.log(JSON.stringify({ok:false,error:error.code??error.message})); }
`;
function childFixture(f) {
  const path = join(f.dir, 'synthetic-fixture.json');
  writeFileSync(path, JSON.stringify({ root: f.root, store: f.store, snapshot: f.snapshot() }), { mode: 0o600 }); return path;
}
function runChild(f, req, action = 'save', fault = '') {
  const args = ['--input-type=module', '-e', childSource, moduleURL, childFixture(f), JSON.stringify(req), action, fault];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
    child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; }); child.on('error', reject);
    child.on('close', (code, signal) => { if (signal) resolve({ signal }); else if (code) reject(new Error(`Synthetic child exited ${code}: ${err}`)); else resolve(JSON.parse(out)); });
  });
}

test('competing processes serialize replacement/discard and stale retries cannot remove the winning checkpoint', async t => {
  const f = fixture(t), first = save(f.ws, f.request());
  const requestA = f.request(1, { key: uid(2), expectedDigest: first.digest, draft: 'Synthetic replacement process A.' });
  const requestB = f.request(1, { key: uid(3), expectedDigest: first.digest, draft: 'Synthetic replacement process B.' });
  const outcomes = await Promise.all([runChild(f, requestA), runChild(f, requestB)]);
  assert.equal(outcomes.filter(x => x.ok).length, 1); assert.equal(outcomes.filter(x => !x.ok).length, 1);
  const winner = f.ws.inspectDraft(entity(1)).checkpoint;
  assert.ok([requestA.draft, requestB.draft].includes(winner.draft));
  assert.equal((await runChild(f, { id: entity(1), expectedDigest: first.digest, generation: f.ws.inspectDraft(entity(1)).generation }, 'discard')).ok, false);
  const bytes = f.bytes(); assert.throws(() => discard(f.ws, { id: entity(1), expectedDigest: first.digest })); assert.deepEqual(f.bytes(), bytes);
  const discarded = await runChild(f, { id: entity(1), expectedDigest: winner.digest, generation: f.ws.inspectDraft(entity(1)).generation }, 'discard'); assert.equal(discarded.status, 'discarded');
  assert.equal(f.reopen().inspectDraft(entity(1)).checkpoint, null);
});

test('actual write and rename failures leave exact prior bytes and clear only their own unfinished transaction', async t => {
  const f = fixture(t), first = save(f.ws, f.request()), bytes = f.bytes();
  for (const fault of ['write', 'rename']) {
    const req = f.request(1, { key: uid(2), expectedDigest: first.digest, draft: `Synthetic ${fault} failure replacement.` });
    const outcome = await runChild(f, req, 'save', fault); assert.equal(outcome.ok, false);
    assert.deepEqual(f.bytes(), bytes); assert.equal(f.reopen().inspectDraft(entity(1)).checkpoint.digest, first.digest);
    assert.equal(existsSync(join(f.store, 'workspace.lock')), false);
    assert.equal(readdirSync(f.store).some(name => name.endsWith('.tmp')), false);
  }
});

test('a killed writer leaves a visible unresolved lock and never auto-recovers by replacing saved work', async t => {
  const f = fixture(t), first = save(f.ws, f.request()), bytes = f.bytes();
  const outcome = await runChild(f, f.request(1, { key: uid(2), expectedDigest: first.digest, draft: 'Synthetic interrupted replacement.' }), 'save', 'kill');
  assert.equal(outcome.signal, 'SIGKILL'); assert.deepEqual(f.bytes(), bytes);
  assert.equal(existsSync(join(f.store, 'workspace.lock')), true); assert.equal(readdirSync(f.store).some(name => name.endsWith('.tmp')), true);
  const reopened = f.reopen(); assert.equal(reopened.inspectDraft(entity(1)).checkpoint.digest, first.digest);
  assert.throws(() => reopened.saveDraft(f.request(1, { key: uid(3), expectedDigest: first.digest })));
  assert.deepEqual(f.bytes(), bytes);
});
