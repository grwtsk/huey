import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatWorkspace, captureSnapshot } from '../scripts/chat_workspace.mjs';
import { seal, canonical } from '../scripts/literary_model.mjs';
import { gitBlob } from '../scripts/editorial_inventory.mjs';
import { parseEditorialMarkdown } from '../scripts/editorial_markdown.mjs';

const id = 'he_00000000-0000-4000-8000-000000000001';
const id2 = 'he_00000000-0000-4000-8000-000000000002';
const raw = 'A synthetic sentence.';
const entity = text => seal({ id, kind: 'Paragraph', state: parseEditorialMarkdown(text)[0].state });
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'huey-chat-test-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'repo'); mkdirSync(root); mkdirSync(join(root, '.git'));
  let snap = { basis: 'synthetic-basis', revision: 'a'.repeat(40), slots: [{ key: 'synthetic', status: 'mapped', paragraphs: 1 }],
    entries: [{ id, version: entity(raw).version, raw, slot: 'synthetic', source: { path: 'manuscript/synthetic.md', blob: gitBlob(raw), lines: { start: 1, end: 1 } }, scopeRefs: [] }] };
  const store = join(dir, 'private');
  const ws = new ChatWorkspace({ root, store, snapshot: () => structuredClone(snap) });
  const propose = (overrides = {}) => { const p = ws.read(id); return ws.propose({ id, baseVersion: p.version, beforeDigest: p.rawDigest,
    after: 'A revised synthetic sentence.', actor: 'test-host', session: 'test-session', requestRef: 'synthetic-request', key: 'test-1', ...overrides }); };
  const decide = (op, overrides = {}) => ws.decide({ operationId: op.id, reviewDigest: op.digest, approvalRef: 'synthetic-user-approval', status: 'applied-private', ...overrides });
  return { dir, root, store, ws, propose, decide, mutate(fn) { fn(snap); } };
}

test('private proposal, exact review, applied overlay and restart leave canonical source untouched', t => {
  const f = fixture(t); writeFileSync(join(f.root, 'source.md'), raw);
  const op = f.propose(); assert.equal(f.ws.read(id).raw, raw);
  const review = f.ws.review(op.id); assert.equal(review.conflict, null); assert.deepEqual(review.diff, { before: raw, after: op.after });
  const receipt = f.decide(op); assert.equal(receipt.effect, 'local private overlay only');
  assert.equal(f.ws.read(id).raw, op.after); assert.equal(f.ws.read(id).privateOperation, op.id); assert.equal(f.ws.read(id).sourceVersion, entity(raw).version);
  assert.equal(readFileSync(join(f.root, 'source.md'), 'utf8'), raw);
  const reopened = new ChatWorkspace({ root: f.root, store: f.store, snapshot: f.ws.snapshot });
  assert.equal(reopened.read(id).raw, op.after);
  assert.equal(f.ws.state().proposals[0].before, raw);
});
test('idempotent proposal and decision retry; key collision rejected', t => {
  const f = fixture(t), op = f.propose(); assert.equal(f.propose().id, op.id);
  assert.throws(() => f.propose({ after: 'Another candidate.' }), /idempotency/);
  const receipt = f.decide(op); assert.deepEqual(f.decide(op), receipt);
  assert.throws(() => f.decide(op, { status: 'rejected' }), /different decision/);
});
test('changed source basis cannot apply; review reports conflict', t => {
  const f = fixture(t), op = f.propose(); f.mutate(s => { s.basis = 'new-basis'; });
  assert.match(f.ws.review(op.id).conflict, /stale/); assert.throws(() => f.decide(op), /stale/);
  assert.equal(f.ws.state().decisions.length, 0);
});
test('changed exact wording with same inscription version is rejected', t => {
  const f = fixture(t), op = f.propose(); f.mutate(s => { s.entries[0].raw = `*${raw}*`; });
  assert.throws(() => f.decide(op), /stale/);
});
test('competing proposals cannot overwrite an applied private candidate', t => {
  const f = fixture(t), a = f.propose(), b = f.propose({ key: 'test-2', after: 'Competing synthetic revision.' });
  f.decide(a); assert.throws(() => f.decide(b), /stale/);
  assert.match(f.ws.review(b.id).conflict, /stale/);
});
test('second edit preserves lineage; source drift makes overlay unavailable', t => {
  const f = fixture(t), a = f.propose(); f.decide(a);
  const b = f.propose({ key: 'test-2', after: 'Another private revision.' }); f.decide(b);
  assert.equal(f.ws.read(id).raw, b.after); assert.equal(b.before, a.after);
  f.mutate(s => { s.basis = 'moved-source'; }); assert.throws(() => f.ws.read(id), /overlay is stale/);
});
test('rejection and cancellation persist without changing text', t => {
  const f = fixture(t), a = f.propose(); f.decide(a, { status: 'rejected' });
  const b = f.propose({ key: 'test-2' }); f.decide(b, { status: 'cancelled' });
  assert.equal(f.ws.read(id).raw, raw); assert.equal(f.ws.state().decisions.length, 2);
});
test('review payload and decision reference required', t => {
  const f = fixture(t), op = f.propose();
  assert.throws(() => f.decide(op, { reviewDigest: 'wrong' }), /changed review/);
  assert.throws(() => f.decide(op, { approvalRef: '' }), /decision reference/);
});
test('proposals require fresh version, exact digest and provenance', t => {
  const f = fixture(t);
  for (const change of [{ baseVersion: 'wrong' }, { beforeDigest: 'wrong' }, { actor: '' }, { session: '' }, { key: '' }, { requestRef: '' }]) assert.throws(() => f.propose(change));
  assert.throws(() => f.propose({ after: raw }), /empty change/);
  assert.throws(() => f.propose({ id: id2 }), /unavailable/);
});
test('rejects multi-paragraph, headings, newline, invalid unicode and unsafe markup', t => {
  const f = fixture(t);
  for (const after of ['', 'One.\n\nTwo.', '# Heading', 'Text.\n', '\ud800', '<script>bad</script>', '[bad](javascript:evil)']) assert.throws(() => f.propose({ after }));
});
test('formatted single paragraph preserves identity and exact raw review', t => {
  const f = fixture(t), op = f.propose({ after: '*A revised synthetic sentence.*' });
  f.decide(op); assert.equal(f.ws.read(id).id, id); assert.equal(f.ws.read(id).raw, op.after);
});
test('local GitHub links validate destination and handoff reveals no prose, source locators or hashes', t => {
  const f = fixture(t), op = f.propose();
  f.ws.link(op.id, 'https://github.com/grwtsk/huey/issues/358'); f.ws.link(op.id, 'https://github.com/grwtsk/huey/issues/358');
  assert.equal(f.ws.state().links.length, 1);
  for (const url of ['https://github.com/other/repo/issues/1', 'https://evil.test/grwtsk/huey/issues/1', 'https://github.com/grwtsk/huey/issues/0', 'https://github.com/grwtsk/huey/pull/1?private=text']) assert.throws(() => f.ws.link(op.id, url));
  const packet = JSON.stringify(f.ws.handoff(op.id));
  for (const secret of [raw, op.after, op.source.path, op.beforeDigest, op.digest]) assert.equal(packet.includes(secret), false);
});
test('store inside repository or another Git checkout rejected', t => {
  const f = fixture(t); assert.throws(() => new ChatWorkspace({ root: f.root, store: join(f.root, 'private') }), /outside/);
  const other = join(f.dir, 'other'); mkdirSync(other); mkdirSync(join(other, '.git')); writeFileSync(join(other, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  assert.throws(() => new ChatWorkspace({ root: f.root, store: join(other, 'private') }), /outside every/);
});
test('symlinked and permissive store entries rejected', t => {
  const f = fixture(t); chmodSync(f.store, 0o755); assert.throws(() => f.propose(), /permissions/); chmodSync(f.store, 0o700);
  const link = join(f.dir, 'linked'); symlinkSync(f.store, link); assert.throws(() => new ChatWorkspace({ root: f.root, store: link }), /unsafe/);
  symlinkSync(join(f.root, 'source.md'), join(f.store, 'workspace.json')); writeFileSync(join(f.root, 'source.md'), '{}');
  assert.throws(() => f.ws.state(), /unsafe/);
});
test('interrupted writer lock fails closed', t => {
  const f = fixture(t); writeFileSync(join(f.store, 'workspace.lock'), '', { mode: 0o600 }); assert.throws(() => f.propose(), /locked/);
  assert.equal(existsSync(join(f.store, 'workspace.json')), false);
});
test('tampered proposal fails integrity check', t => {
  const f = fixture(t); f.propose(); const file = join(f.store, 'workspace.json'), state = JSON.parse(readFileSync(file, 'utf8'));
  state.proposals[0].after = 'Tampered synthetic payload.'; writeFileSync(file, JSON.stringify(state));
  assert.throws(() => f.ws.state(), /integrity/);
});

function sourceFixture() {
  const text = `${raw}\n\n${raw}`, blocks = parseEditorialMarkdown(text);
  const source = { key: 'synthetic-source', access: 'available', role: 'canonical', targets: ['synthetic'], path: 'manuscript/synthetic.md', blob: gitBlob(text), revision: 'a'.repeat(40), scopeRefs: [] };
  const inventory = { schema: 'huey.editorial-inventory.v1', sources: [source], slots: [{ key: 'synthetic', group: 'book', label: 'Synthetic', access: 'available', canonicalState: 'present-content', canonicalPath: source.path, sources: [source.key] }] };
  const plan = { schema: 'huey.editorial-pages.v1', parser: 'huey.editorial-markdown/1', sources: [{ sourceKey: source.key, revision: source.revision, path: source.path, blob: source.blob, blocks: blocks.map((b, i) => ({ id: i ? id2 : id, kind: b.kind, start: b.source.start, end: b.source.end })) }] };
  return { inventory, plan, revision: 'b'.repeat(40), readSource: () => text };
}
test('duplicate text retains two source occurrence identities', () => {
  const snap = captureSnapshot(sourceFixture()); assert.equal(snap.entries.length, 2);
  assert.equal(snap.entries[0].raw, snap.entries[1].raw); assert.notEqual(snap.entries[0].id, snap.entries[1].id);
});
test('unavailable sources rejected before text getter', () => {
  const f = sourceFixture(); f.inventory.sources[0].access = 'denied'; f.readSource = () => { throw new Error('must not read'); };
  const snap = captureSnapshot(f); assert.equal(snap.entries.length, 0); assert.equal(snap.slots[0].status, 'unavailable');
});
test('unmapped and stale sources remain explicit without allocating IDs or reading text', () => {
  for (const status of ['unmapped', 'stale-plan']) {
    const f = sourceFixture(); if (status === 'unmapped') f.plan.sources = []; else f.plan.sources[0].blob = 'wrong';
    f.readSource = () => { throw new Error('must not read'); };
    const snap = captureSnapshot(f); assert.equal(snap.entries.length, 0); assert.equal(snap.slots[0].status, status);
  }
});
test('range drift, raw drift and duplicate identity fail closed', () => {
  for (const mutate of [f => { f.plan.sources[0].blocks[0].end--; }, f => { f.readSource = () => 'Changed.'; }, f => { f.plan.sources[0].blocks[1].id = id; }]) {
    const f = sourceFixture(); mutate(f); assert.throws(() => captureSnapshot(f));
  }
});
test('mapped front matter is supported without changing existing IDs', () => {
  const f = sourceFixture(); f.inventory.slots[0].group = 'front'; const snap = captureSnapshot(f);
  assert.equal(snap.entries[0].id, id);
});

test('literal search requires explicit slot and includes approved overlay', t => {
  const f = fixture(t); assert.equal(f.ws.search({ slot: 'synthetic', query: 'synthetic' }).total, 1);
  assert.throws(() => f.ws.search({ query: 'synthetic' }), /specific slot/);
  assert.throws(() => f.ws.search({ slot: 'missing', query: 'synthetic' }), /unavailable/);
  const op = f.propose(); f.decide(op);
  assert.equal(f.ws.search({ slot: 'synthetic', query: 'revised' }).matches[0].raw, op.after);
});

test('applied review is not falsely conflicted; later source drift remains visible', t => {
  const f = fixture(t), op = f.propose(); f.decide(op);
  assert.equal(f.ws.review(op.id).conflict, null); assert.equal(f.ws.handoff(op.id).conflict, null);
  const second = f.propose({ key: 'second', after: 'A later private revision.' }); f.decide(second);
  assert.equal(f.ws.review(op.id).conflict, null);
  f.mutate(s => { s.basis = 'new-source'; }); assert.match(f.ws.review(op.id).conflict, /stale/);
});
test('corrupted receipt, duplicate identity and injected handoff link fail closed', t => {
  const f = fixture(t), op = f.propose(); f.decide(op); const file = join(f.store, 'workspace.json');
  const original = JSON.parse(readFileSync(file, 'utf8'));
  for (const mutate of [s => { s.decisions[0].reviewDigest = 'wrong'; }, s => { s.decisions[0].approvalRef = ''; },
    s => { s.decisions.push(s.decisions[0]); }, s => { s.proposals.push(s.proposals[0]); },
    s => { s.links.push({ operationId: op.id, url: 'https://evil.test/?private=payload' }); },
    s => { s.links.push({ operationId: op.id, url: 'https://github.com/grwtsk/huey/issues/358', privateText: 'secret' }); }]) {
    const data = structuredClone(original); mutate(data); writeFileSync(file, JSON.stringify(data)); assert.throws(() => f.ws.handoff(op.id));
  }
  writeFileSync(file, JSON.stringify(original)); chmodSync(f.store, 0o755); assert.throws(() => f.ws.read(id), /permissions/);
});

test('private source preview batches applied overlays without changing canonical source', t => {
  const f = fixture(t), source = sourceFixture();
  const snap = captureSnapshot(source); f.ws.snapshot = () => structuredClone(snap);
  const op = f.propose(); assert.throws(() => f.ws.sourcePreview(op.id), /requires an applied/);
  f.decide(op); const preview = f.ws.sourcePreview(op.id);
  assert.equal(preview.before, `${raw}\n\n${raw}`);
  assert.equal(preview.after, `${op.after}\n\n${raw}`);
  assert.equal(preview.afterBlob, gitBlob(preview.after));
  mkdirSync(join(f.root, 'manuscript')); writeFileSync(join(f.root, 'manuscript/synthetic.md'), preview.before);
  execFileSync('git', ['apply', '--check', '-'], { cwd: f.root, input: preview.patch, stdio: ['pipe', 'pipe', 'pipe'] });
  assert.equal(readFileSync(join(f.root, 'manuscript/synthetic.md'), 'utf8'), preview.before);
  const second = f.propose({ key: 'second', after: 'Cumulative synthetic edit.' }); f.decide(second);
  const next = f.ws.sourcePreview(op.id); assert.equal(next.after, `${second.after}\n\n${raw}`);
  assert.deepEqual(next.operationIds, [op.id, second.id]); assert.equal(source.readSource(), next.before);
  snap.basis = 'changed'; assert.throws(() => f.ws.sourcePreview(op.id), /stale/);
});

const resume = (f, changes = {}) => f.ws.resumeSource({ id, reviewDigest: f.ws.inspect(id).reviewDigest,
  decisionRef: 'Synthetic local resume click; no literary acceptance', key: 'resume-1', ...changes });
const immutableHistory = state => ({ proposals: state.proposals, decisions: state.decisions, links: state.links });
const stateHash = value => `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`;
const rehashReceipt = receipt => { receipt.digest = stateHash(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'digest'))); };

test('source inspection is read-only and does not invent a private overlay or persisted receipt', t => {
  const f = fixture(t), inspection = f.ws.inspect(id);
  assert.equal(inspection.status, 'current'); assert.deepEqual(inspection.current, f.ws.read(id));
  assert.deepEqual(inspection.source, f.ws.read(id)); assert.equal(inspection.previous, null);
  assert.deepEqual(inspection.history, []); assert.deepEqual(inspection.retiredOperationIds, []);
  assert.equal(inspection.current.revision, 'a'.repeat(40));
  assert.equal(existsSync(join(f.store, 'workspace.json')), false);
  assert.throws(() => resume(f), /requires a stale private overlay/);
  assert.equal(existsSync(join(f.store, 'workspace.json')), false);
});

test('repository basis drift with unchanged source needs explicit resume and retains every old contribution', t => {
  const f = fixture(t); writeFileSync(join(f.root, 'source.md'), raw);
  const old = f.propose(), pending = f.propose({ key: 'pending', after: 'Another saved candidate.' }); f.decide(old);
  f.ws.link(old.id, 'https://github.com/grwtsk/huey/issues/360');
  const before = structuredClone(immutableHistory(f.ws.state()));
  f.mutate(s => { s.basis = 'repository-changed'; s.revision = 'b'.repeat(40); });
  const inspection = f.ws.inspect(id);
  assert.equal(inspection.status, 'stale-overlay'); assert.equal(inspection.current, null);
  assert.equal(inspection.source.raw, raw); assert.equal(inspection.source.revision, 'b'.repeat(40));
  assert.equal(inspection.previous.before, raw); assert.equal(inspection.previous.after, old.after);
  assert.deepEqual(inspection.history.map(entry => [entry.operationId, entry.retired]), [[old.id, false]]);
  assert.throws(() => f.ws.read(id), /overlay is stale/);
  assert.throws(() => f.propose({ key: 'blocked' }), /overlay is stale/);
  assert.throws(() => f.decide(pending), /overlay is stale/);
  const receipt = resume(f);
  assert.deepEqual(receipt.retiredOperationIds, [old.id]); assert.equal(receipt.sourceRaw, raw);
  assert.match(receipt.authority, /no source write or literary acceptance/);
  assert.deepEqual(immutableHistory(f.ws.state()), before);
  assert.equal(f.ws.read(id).raw, raw); assert.equal(f.ws.read(id).privateOperation, null);
  assert.throws(() => f.decide(pending), /stale proposal/);
  assert.throws(() => f.decide(old, { status: 'cancelled' }), /different decision/);
  const fresh = f.propose({ key: 'fresh', after: 'Fresh private candidate after explicit resume.' }); f.decide(fresh);
  assert.equal(fresh.before, raw); assert.equal(f.ws.read(id).raw, fresh.after);
  const history = f.ws.inspect(id).history;
  assert.deepEqual(history.map(entry => [entry.operationId, entry.retired]), [[old.id, true], [fresh.id, false]]);
  assert.equal(history[0].after, old.after); assert.equal(history[1].before, raw);
  assert.deepEqual(immutableHistory(f.ws.state()).proposals.slice(0, before.proposals.length), before.proposals);
  const reopened = new ChatWorkspace({ root: f.root, store: f.store, snapshot: f.ws.snapshot });
  assert.equal(reopened.read(id).raw, fresh.after); assert.deepEqual(reopened.inspect(id).history, history);
  assert.equal(readFileSync(join(f.root, 'source.md'), 'utf8'), raw);
});

test('changed source inspection preserves old base and private result, then resumes only exact current source', t => {
  const f = fixture(t), old = f.propose(); f.decide(old);
  const replacement = 'A new synthetic source with its qualifier retained.';
  f.mutate(s => { s.basis = 'source-changed'; s.revision = 'c'.repeat(40); s.entries[0].raw = replacement;
    s.entries[0].version = entity(replacement).version; s.entries[0].source.blob = gitBlob(replacement); });
  const inspection = f.ws.inspect(id);
  assert.equal(inspection.source.raw, replacement); assert.equal(inspection.previous.before, raw);
  assert.equal(inspection.previous.after, old.after); assert.equal(inspection.previous.baseVersion, entity(raw).version);
  const receipt = resume(f); assert.equal(receipt.sourceVersion, entity(replacement).version);
  assert.equal(f.ws.read(id).raw, replacement); assert.equal(f.ws.inspect(id).history[0].after, old.after);
  assert.throws(() => f.propose({ key: 'wrong-base', baseVersion: old.baseVersion, beforeDigest: old.beforeDigest }), /stale paragraph/);
  const fresh = f.propose({ key: 'new-source', after: 'A separately reviewed new-source private result.' }); f.decide(fresh);
  assert.equal(fresh.before, replacement); assert.equal(f.ws.read(id).raw, fresh.after);
});

test('repeated recoveries retire strictly growing prefixes without affecting another target', t => {
  const f = fixture(t);
  f.mutate(s => { s.entries.push({ ...structuredClone(s.entries[0]), id: id2 }); });
  const old = f.propose(); f.decide(old);
  const otherBase = f.ws.read(id2);
  const other = f.propose({ id: id2, baseVersion: otherBase.version, beforeDigest: otherBase.rawDigest,
    key: 'other', after: 'Another target private candidate.' }); f.decide(other);
  f.mutate(s => { s.basis = 'first-drift'; });
  const first = resume(f);
  assert.throws(() => f.ws.read(id2), /overlay is stale/);
  const middle = f.propose({ key: 'middle', after: 'Middle private revision.' }); f.decide(middle);
  f.mutate(s => { s.basis = 'second-drift'; });
  const second = resume(f, { key: 'resume-2' });
  assert.equal(second.previousReconciliationId, first.id); assert.deepEqual(second.retiredOperationIds, [old.id, middle.id]);
  assert.deepEqual(f.ws.state().reconciliations.map(receipt => receipt.retiredOperationIds), [[old.id], [old.id, middle.id]]);
  assert.equal(f.ws.read(id).raw, raw); assert.throws(() => f.ws.read(id2), /overlay is stale/);
  const last = f.propose({ key: 'last', after: 'Final separately reviewed private revision.' }); f.decide(last);
  assert.equal(f.ws.read(id).raw, last.after);
  assert.deepEqual(f.ws.inspect(id).history.map(entry => [entry.operationId, entry.retired]), [[old.id, true], [middle.id, true], [last.id, false]]);
  assert.equal(f.ws.state().decisions.every(decision => decision.status === 'applied-private'), true);
});

test('resume rejects changed source review, concurrent applied history and changed receipt replay', t => {
  const f = fixture(t), old = f.propose(); f.decide(old);
  const competing = f.propose({ key: 'competing', after: 'Concurrent saved private contribution.' });
  f.mutate(s => { s.basis = 'drift'; });
  const inspection = f.ws.inspect(id);
  f.mutate(s => { s.basis = 'synthetic-basis'; }); f.decide(competing);
  f.mutate(s => { s.basis = 'drift'; });
  assert.throws(() => resume(f, { reviewDigest: inspection.reviewDigest }), /stale reconciliation review/);
  assert.equal(f.ws.state().reconciliations.length, 0);
  const current = f.ws.inspect(id), receipt = resume(f, { reviewDigest: current.reviewDigest });
  assert.deepEqual(resume(f, { reviewDigest: current.reviewDigest }), receipt);
  assert.throws(() => resume(f, { reviewDigest: current.reviewDigest, decisionRef: 'Changed local reference' }), /idempotency/);
  assert.throws(() => resume(f, { reviewDigest: current.reviewDigest, key: 'different-key' }), /stale reconciliation review/);
  const after = f.propose({ key: 'after', after: 'Private edit made after the recorded resume.' }); f.decide(after);
  assert.deepEqual(resume(f, { reviewDigest: current.reviewDigest }), receipt);
  assert.equal(f.ws.read(id).raw, after.after); assert.equal(f.ws.state().reconciliations.length, 1);
});

test('exact wording drift after inspection invalidates resume even when repository basis is unchanged', t => {
  const f = fixture(t), old = f.propose(); f.decide(old); f.mutate(s => { s.basis = 'drift'; });
  const inspection = f.ws.inspect(id), before = readFileSync(join(f.store, 'workspace.json'), 'utf8');
  f.mutate(s => { s.entries[0].raw = 'Current source changed after inspection.';
    s.entries[0].version = entity(s.entries[0].raw).version; s.entries[0].source.blob = gitBlob(s.entries[0].raw); });
  assert.throws(() => resume(f, { reviewDigest: inspection.reviewDigest }), /stale reconciliation review/);
  assert.equal(readFileSync(join(f.store, 'workspace.json'), 'utf8'), before);
});

test('unavailable entity retains saved private wording without substituting or resuming a source', t => {
  const f = fixture(t), old = f.propose(); f.decide(old);
  const before = readFileSync(join(f.store, 'workspace.json'), 'utf8');
  f.mutate(s => { s.basis = 'unavailable-source'; s.entries = []; });
  const inspection = f.ws.inspect(id);
  assert.equal(inspection.status, 'unavailable'); assert.equal(inspection.current, null); assert.equal(inspection.source, null);
  assert.equal(inspection.previous.before, raw); assert.equal(inspection.previous.after, old.after);
  assert.equal(inspection.history[0].after, old.after);
  assert.throws(() => resume(f), /source unavailable/); assert.throws(() => f.ws.read(id), /unavailable/);
  assert.throws(() => f.ws.inspect(id2), /no saved private work/);
  assert.equal(readFileSync(join(f.store, 'workspace.json'), 'utf8'), before);
});

test('legacy private stores remain unchanged on inspection and gain receipts only on explicit resume', t => {
  const f = fixture(t), old = f.propose(); f.decide(old);
  const file = join(f.store, 'workspace.json'), legacy = f.ws.state(); delete legacy.reconciliations;
  writeFileSync(file, JSON.stringify(legacy)); const before = readFileSync(file, 'utf8');
  assert.equal(f.ws.inspect(id).status, 'current'); assert.equal(readFileSync(file, 'utf8'), before);
  f.mutate(s => { s.basis = 'legacy-drift'; }); resume(f);
  const persisted = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(persisted.reconciliations.length, 1); assert.deepEqual(immutableHistory(persisted), immutableHistory(legacy));
});

test('persisted resume receipts reject tampering, forged prefixes, changed history and malformed lineage', t => {
  const f = fixture(t), old = f.propose(); f.decide(old); f.mutate(s => { s.basis = 'drift'; }); resume(f);
  const file = join(f.store, 'workspace.json'), original = f.ws.state();
  const mutations = [
    state => { state.reconciliations[0].sourceRaw = 'Unreviewed source wording.'; },
    state => { state.reconciliations[0].extra = 'unexpected'; },
    state => { state.reconciliations[0].retiredOperationIds = []; rehashReceipt(state.reconciliations[0]); },
    state => { state.reconciliations[0].retiredOperationIds = ['op_' + '0'.repeat(36)]; rehashReceipt(state.reconciliations[0]); },
    state => { state.reconciliations[0].historyDigest = 'sha256:' + '0'.repeat(64); rehashReceipt(state.reconciliations[0]); },
    state => { state.reconciliations[0].reviewDigest = 'sha256:' + '0'.repeat(64); rehashReceipt(state.reconciliations[0]); },
    state => { state.reconciliations[0].previousReconciliationId = state.reconciliations[0].id; rehashReceipt(state.reconciliations[0]); },
    state => { state.reconciliations[0].sourceVersion = entity('An unrelated inscription.').version; rehashReceipt(state.reconciliations[0]); },
    state => { state.decisions[0].approvalRef = 'Changed historical decision'; },
    state => { state.reconciliations.push(structuredClone(state.reconciliations[0])); },
    state => { state.reconciliations = null; },
  ];
  for (const mutate of mutations) {
    const corrupted = structuredClone(original); mutate(corrupted); writeFileSync(file, JSON.stringify(corrupted));
    assert.throws(() => f.ws.read(id), /reconcil|source wording/);
    assert.throws(() => f.ws.inspect(id));
  }
  writeFileSync(file, JSON.stringify(original)); assert.equal(f.ws.read(id).raw, raw);
});

test('source preview after recovery includes only active applied edits and preserves retired history', t => {
  const f = fixture(t), source = sourceFixture(), snap = captureSnapshot(source); f.ws.snapshot = () => structuredClone(snap);
  const old = f.propose(); f.decide(old); snap.basis = 'new-repository-basis'; resume(f);
  const fresh = f.propose({ key: 'active', after: 'Only this fresh private revision enters the preview.' }); f.decide(fresh);
  const preview = f.ws.sourcePreview(fresh.id);
  assert.equal(preview.before, `${raw}\n\n${raw}`); assert.equal(preview.after, `${fresh.after}\n\n${raw}`);
  assert.deepEqual(preview.operationIds, [fresh.id]); assert.equal(f.ws.inspect(id).history[0].after, old.after);
  assert.throws(() => f.ws.sourcePreview(old.id), /stale source basis/);
  assert.equal(source.readSource(), preview.before);
  snap.basis = old.basis;
  assert.throws(() => f.ws.sourcePreview(old.id), /retired private operation/);
});

test('proposal queue is a bounded read-only view without wording or proposal fingerprints', t => {
  const f = fixture(t), file = join(f.store, 'workspace.json');
  assert.deepEqual(f.ws.proposalQueue({ id }), { target: id, basis: 'synthetic-basis', revision: 'a'.repeat(40),
    operations: [], nextBeforeSequence: null, authority: 'local private queue; no remote/literary acceptance' });
  assert.equal(existsSync(file), false);
  const op = f.propose(), before = readFileSync(file, 'utf8'), snapshot = f.ws.snapshot;
  let calls = 0;
  f.ws.snapshot = () => {
    calls++; const snap = snapshot();
    snap.entries.push({ id: id2, get raw() { throw new Error('Unselected paragraph must not be read'); } });
    return snap;
  };
  const queue = f.ws.proposalQueue({ id });
  assert.equal(calls, 1);
  assert.deepEqual(queue.operations, [{ id: op.id, target: id, clientSequence: 1, createdAt: op.createdAt,
    status: 'proposed-private', retired: false, conflict: null }]);
  const listing = JSON.stringify(queue);
  for (const privateValue of [op.before, op.after, op.baseVersion, op.afterVersion, op.beforeDigest, op.digest, op.source.path, op.source.blob])
    assert.equal(listing.includes(privateValue), false);
  assert.equal(readFileSync(file, 'utf8'), before);
  for (const limit of [0, 21, 1.5, '2', null, Infinity]) assert.throws(() => f.ws.proposalQueue({ id, limit }), /limit/);
  for (const beforeSequence of [0, -1, 1.5, '2', null, Infinity]) assert.throws(() => f.ws.proposalQueue({ id, beforeSequence }), /cursor/);
  assert.throws(() => f.ws.proposalQueue({ id: 'not-an-entity' }), /identity/);
  assert.throws(() => f.ws.proposalQueue({ id: 'he_00000000-0000-4000-8000-000000000003' }), /no saved private work/);
});

test('newest-first exclusive pagination follows global sequence and isolates the requested target', t => {
  const f = fixture(t);
  f.mutate(s => { s.entries.push({ ...s.entries[0], id: id2,
    version: seal({ id: id2, kind: 'Paragraph', state: parseEditorialMarkdown(raw)[0].state }).version }); });
  const own = [], foreign = [];
  for (let i = 0; i < 25; i++) {
    own.push(f.propose({ key: `own-${i}`, after: `Synthetic private revision ${i}.` }));
    if (i % 3 === 0) {
      const other = f.ws.read(id2);
      foreign.push(f.propose({ id: id2, baseVersion: other.version, beforeDigest: other.rawDigest,
        key: `foreign-${i}`, after: `Another synthetic private revision ${i}.` }));
    }
  }
  const file = join(f.store, 'workspace.json'), before = readFileSync(file, 'utf8');
  assert.equal(f.ws.proposalQueue({ id }).operations.length, 20);
  let beforeSequence, pages = 0; const gathered = [];
  do {
    const queue = f.ws.proposalQueue({ id, limit: 7, ...(beforeSequence === undefined ? {} : { beforeSequence }) });
    assert.equal(queue.operations.every(op => op.target === id), true);
    gathered.push(...queue.operations); pages++;
    if (queue.nextBeforeSequence !== null) assert.equal(queue.nextBeforeSequence, queue.operations.at(-1).clientSequence);
    beforeSequence = queue.nextBeforeSequence;
  } while (beforeSequence !== null);
  assert.equal(pages, 4);
  assert.deepEqual(gathered.map(op => op.id), [...own].reverse().map(op => op.id));
  assert.equal(new Set(gathered.map(op => op.id)).size, own.length);
  assert.equal(gathered.every((op, i) => !i || op.clientSequence < gathered[i - 1].clientSequence), true);
  assert.deepEqual(f.ws.proposalQueue({ id: id2 }).operations.map(op => op.id), [...foreign].reverse().map(op => op.id));
  assert.deepEqual(f.ws.proposalQueue({ id, beforeSequence: 1 }).operations, []);
  assert.equal(readFileSync(file, 'utf8'), before);
});

test('a persisted proposal surviving a lost response and reload can be reviewed and cancelled exactly once', t => {
  const f = fixture(t); writeFileSync(join(f.root, 'source.md'), raw);
  const op = f.propose(), proposals = structuredClone(f.ws.state().proposals);
  const reopened = new ChatWorkspace({ root: f.root, store: f.store, snapshot: f.ws.snapshot });
  const row = reopened.proposalQueue({ id }).operations[0], review = reopened.review(row.id);
  assert.deepEqual(review.diff, { before: raw, after: op.after });
  const decision = { operationId: row.id, reviewDigest: review.reviewDigest,
    approvalRef: 'Synthetic explicit local Cancel click', status: 'cancelled' };
  const receipt = reopened.decide(decision);
  const again = new ChatWorkspace({ root: f.root, store: f.store, snapshot: f.ws.snapshot });
  assert.deepEqual(again.decide(decision), receipt);
  assert.equal(again.proposalQueue({ id }).operations[0].status, 'cancelled');
  assert.equal(again.state().decisions.length, 1); assert.deepEqual(again.state().proposals, proposals);
  assert.equal(again.read(id).raw, raw); assert.equal(readFileSync(join(f.root, 'source.md'), 'utf8'), raw);
  assert.throws(() => again.decide({ ...decision, approvalRef: 'A different cancel reference' }), /different decision/);
});

test('stale and unavailable pending work stays recoverable without substituting source text', t => {
  const f = fixture(t), op = f.propose(), proposals = structuredClone(f.ws.state().proposals);
  f.mutate(s => { s.basis = 'changed-repository'; });
  assert.match(f.ws.proposalQueue({ id }).operations[0].conflict, /stale/);
  assert.throws(() => f.decide(op), /stale/);
  f.mutate(s => { s.entries = []; });
  const queue = f.ws.proposalQueue({ id });
  assert.equal(queue.operations[0].status, 'proposed-private'); assert.equal(queue.operations[0].retired, false);
  assert.match(queue.operations[0].conflict, /unavailable/);
  assert.match(f.ws.review(op.id).conflict, /unavailable/);
  const receipt = f.decide(op, { status: 'cancelled', approvalRef: 'Synthetic cancel of unavailable saved work' });
  assert.equal(receipt.effect, 'no text effect');
  assert.equal(f.ws.proposalQueue({ id }).operations[0].status, 'cancelled');
  assert.equal(f.ws.proposalQueue({ id }).operations[0].conflict, null);
  assert.deepEqual(f.ws.state().proposals, proposals); assert.throws(() => f.ws.read(id), /unavailable/);
});

test('pending conflicts bind exact wording and competing private effects while terminal status remains immutable', t => {
  const f = fixture(t), applied = f.propose(), competing = f.propose({ key: 'competing', after: 'Competing synthetic proposal.' });
  f.decide(applied);
  let queue = f.ws.proposalQueue({ id });
  assert.equal(queue.operations[0].id, competing.id); assert.match(queue.operations[0].conflict, /stale/);
  assert.equal(queue.operations[1].status, 'applied-private'); assert.equal(queue.operations[1].conflict, null);
  const fresh = f.propose({ key: 'fresh', after: 'Fresh synthetic proposal based on the private result.' });
  queue = f.ws.proposalQueue({ id }); assert.equal(queue.operations[0].id, fresh.id); assert.equal(queue.operations[0].conflict, null);
  f.mutate(s => { s.entries[0].raw = `*${raw}*`; });
  queue = f.ws.proposalQueue({ id }); assert.match(queue.operations[0].conflict, /overlay is stale/);
  assert.equal(queue.operations[2].status, 'applied-private'); assert.equal(queue.operations[2].conflict, null);
});

test('apply-versus-cancel races preserve the first terminal result and exact retries', t => {
  for (const firstStatus of ['applied-private', 'cancelled']) {
    const f = fixture(t), op = f.propose();
    const receipt = f.decide(op, { status: firstStatus });
    assert.throws(() => f.decide(op, { status: firstStatus === 'applied-private' ? 'cancelled' : 'applied-private' }), /different decision/);
    assert.deepEqual(f.decide(op, { status: firstStatus }), receipt);
    assert.equal(f.ws.proposalQueue({ id }).operations[0].status, firstStatus);
    assert.equal(f.ws.state().decisions.length, 1);
    assert.equal(f.ws.read(id).raw, firstStatus === 'applied-private' ? op.after : raw);
  }
});

test('queue retirement remains separate from immutable application and fresh pending work', t => {
  const f = fixture(t), old = f.propose(); f.decide(old);
  f.mutate(s => { s.basis = 'new-repository-basis'; }); resume(f);
  const fresh = f.propose({ key: 'fresh', after: 'A fresh candidate after the source resume.' });
  assert.deepEqual(f.ws.proposalQueue({ id }).operations.map(op => [op.id, op.status, op.retired, op.conflict]),
    [[fresh.id, 'proposed-private', false, null], [old.id, 'applied-private', true, null]]);
  assert.equal(f.ws.state().decisions[0].status, 'applied-private'); assert.equal(f.ws.state().reconciliations.length, 1);
  assert.equal(f.ws.inspect(id).history[0].after, old.after);
});

test('persisted global sequencing and creation dates cannot be rewritten into queue metadata', t => {
  const f = fixture(t); f.propose(); f.propose({ key: 'second', after: 'Another synthetic saved proposal.' });
  const file = join(f.store, 'workspace.json'), original = f.ws.state();
  for (const mutate of [op => { op.clientSequence = 2; }, op => { op.clientSequence = 0; },
    op => { op.clientSequence = '1'; }, op => { op.createdAt = 'Untrusted text is not a queue timestamp'; }]) {
    const corrupted = structuredClone(original); mutate(corrupted.proposals[0]);
    rehashReceipt(corrupted.proposals[0]); writeFileSync(file, JSON.stringify(corrupted));
    assert.throws(() => f.ws.proposalQueue({ id }), /sequence or creation time/);
  }
  const reversed = structuredClone(original); reversed.proposals.reverse(); writeFileSync(file, JSON.stringify(reversed));
  assert.throws(() => f.ws.proposalQueue({ id }), /sequence or creation time/);
  writeFileSync(file, JSON.stringify(original));
  assert.deepEqual(f.ws.proposalQueue({ id }).operations.map(op => op.clientSequence), [2, 1]);
});
