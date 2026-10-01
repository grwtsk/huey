import test from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatWorkspace, captureSnapshot } from '../scripts/chat_workspace.mjs';
import { seal } from '../scripts/literary_model.mjs';
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
