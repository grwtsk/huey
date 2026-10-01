import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateDraftCheckpoint, validateDraftCheckpointCollection, assessDraftCheckpointCompatibility,
  DraftCheckpointError } from '../scripts/draft_checkpoint.mjs';
import { canonical, seal } from '../scripts/literary_model.mjs';
import { parseEditorialMarkdown } from '../scripts/editorial_markdown.mjs';

const policy = JSON.parse(readFileSync(new URL('../planning/grwtsk-draft-retention.json', import.meta.url), 'utf8'));
const uuid = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const raw = 'Before synthetic draft source.';
const hash = value => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
const version = (id, text) => seal({ id, kind: 'Paragraph', state: parseEditorialMarkdown(text)[0].state }).version;
function rehash(checkpoint) {
  checkpoint.digest = hash(canonical(Object.fromEntries(Object.entries(checkpoint).filter(([key]) => key !== 'digest'))));
  return checkpoint;
}
function checkpoint(n = 1, overrides = {}) {
  const target = overrides.target ?? `he_${uuid(n)}`, before = overrides.before ?? raw;
  return rehash({ schema: policy.checkpointSchema, id: `draft_${uuid(n)}`, key: uuid(n), target,
    requestDigest: 'sha256:' + 'c'.repeat(64),
    basis: 'sha256:' + 'a'.repeat(64), revision: 'b'.repeat(40), baseVersion: version(target, before),
    sourceVersion: version(target, raw), beforeDigest: hash(before), before, draft: 'An unfinished synthetic draft *',
    privateOperation: null, createdAt: '2026-10-01T10:02:00.000Z', ...overrides });
}
const collection = checkpoints => ({ schema: policy.collectionSchema, checkpoints });
const current = saved => ({ id: saved.target, basis: saved.basis, revision: saved.revision, sourceVersion: saved.sourceVersion,
  version: saved.baseVersion, raw: saved.before, rawDigest: saved.beforeDigest, privateOperation: saved.privateOperation });
const errorCode = (fn, expected) => assert.throws(fn, error => {
  assert.equal(error instanceof DraftCheckpointError, true);
  assert.equal(error.message, error.code); assert.equal(error.code, expected);
  return true;
});
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('public policy explicitly scopes local storage while pure validation results remain payload-free', () => {
  assert.equal(policy.status, 'local-explicit'); assert.equal(policy.runtimePersistenceEnabled, true);
  assert.equal(policy.runtimeSourceScope.slot, 'C08A');
  assert.equal(policy.authority.humanAcceptance, false); assert.equal(policy.authority.canonicalWrite, false);
  const saved = freeze(checkpoint()), envelope = freeze(collection([saved])), context = freeze(current(saved));
  const before = JSON.stringify({ saved, envelope, context });
  assert.equal(validateDraftCheckpoint(saved), true); assert.equal(validateDraftCheckpoint(saved), true);
  const result = validateDraftCheckpointCollection(envelope);
  assert.deepEqual(result, { count: 1, bytes: Buffer.byteLength(JSON.stringify(envelope) + '\n', 'utf8') });
  assert.deepEqual(validateDraftCheckpointCollection(envelope), result);
  assert.deepEqual(assessDraftCheckpointCompatibility(saved, context), { status: 'current', reasons: [] });
  assert.equal(JSON.stringify({ saved, envelope, context }), before);
  const output = JSON.stringify({ result, assessment: assessDraftCheckpointCompatibility(saved, context) });
  for (const secret of [saved.before, saved.draft, saved.target, saved.beforeDigest, saved.digest, saved.baseVersion])
    assert.equal(output.includes(secret), false);
});

test('drafts preserve empty, unfinished, multi-block and exact Unicode input without becoming proposals', () => {
  const drafts = ['', '*Unfinished', '# Heading\n\nTwo unfinished paragraphs.\n', '<script>Synthetic unfinished input</script>',
    '[Incomplete](javascript:', 'e\u0301\r\n\t', 'é', '😀'.repeat(50000)];
  for (const draft of drafts) {
    const saved = checkpoint(1, { draft }), before = JSON.stringify(saved);
    assert.equal(validateDraftCheckpoint(saved), true);
    assert.equal(saved.draft, draft); assert.equal(JSON.stringify(saved), before);
  }
  assert.notEqual(checkpoint(1, { draft: 'é' }).digest, checkpoint(1, { draft: 'e\u0301' }).digest);
});

test('base is an exact supported paragraph with both inscription and raw Markdown bindings', () => {
  const plain = checkpoint(), formatted = checkpoint(1, { before: `*${raw}*` });
  assert.equal(plain.baseVersion, formatted.baseVersion);
  assert.notEqual(plain.beforeDigest, formatted.beforeDigest); assert.notEqual(plain.digest, formatted.digest);
  assert.equal(validateDraftCheckpoint(formatted), true);
  for (const before of ['', '# Heading', 'One.\n\nTwo.', raw + '\n', '<script>Synthetic unsafe base</script>', '*Unfinished']) {
    const saved = rehash({ ...plain, before, beforeDigest: hash(before) });
    errorCode(() => validateDraftCheckpoint(saved), 'INVALID_BASE_PARAGRAPH');
  }
  errorCode(() => validateDraftCheckpoint(rehash({ ...plain, beforeDigest: 'sha256:' + '0'.repeat(64) })), 'BASE_DIGEST_MISMATCH');
  errorCode(() => validateDraftCheckpoint(rehash({ ...plain, baseVersion: version(plain.target, 'Another synthetic base.') })), 'BASE_VERSION_MISMATCH');
});

test('strict shape forbids locators, issue copies, approval fields and hidden accessor payloads', () => {
  const saved = checkpoint();
  for (const [key, value] of [['source', { path: 'private/synthetic' }], ['issueBody', 'Synthetic private issue copy'],
    ['approvalRef', 'Spoofed approval'], ['accepted', true], ['provider', 'outside-service'], ['password', 'synthetic-secret']]) {
    const modified = rehash({ ...saved, [key]: value });
    errorCode(() => validateDraftCheckpoint(modified), 'INVALID_CHECKPOINT_SHAPE');
  }
  const missing = { ...saved }; delete missing.draft;
  errorCode(() => validateDraftCheckpoint(missing), 'INVALID_CHECKPOINT_SHAPE');
  const symbol = { ...saved }; symbol[Symbol('private metadata')] = 'secret';
  errorCode(() => validateDraftCheckpoint(symbol), 'INVALID_CHECKPOINT_SHAPE');
  const hidden = { ...saved }; Object.defineProperty(hidden, 'secret', { value: 'private metadata' });
  errorCode(() => validateDraftCheckpoint(hidden), 'INVALID_CHECKPOINT_SHAPE');
  const accessor = { ...saved }; Object.defineProperty(accessor, 'draft', { enumerable: true,
    get() { throw new Error('Private getter must not execute'); } });
  errorCode(() => validateDraftCheckpoint(accessor), 'INVALID_CHECKPOINT_SHAPE');
  const serializer = { ...saved, toJSON() { throw new Error('Private serializer must not execute'); } };
  errorCode(() => validateDraftCheckpoint(serializer), 'INVALID_CHECKPOINT_SHAPE');
  const nonEnumerable = { ...saved }; Object.defineProperty(nonEnumerable, 'draft', { value: saved.draft, enumerable: false });
  errorCode(() => validateDraftCheckpoint(nonEnumerable), 'INVALID_CHECKPOINT_SHAPE');
  errorCode(() => validateDraftCheckpoint(Object.assign(Object.create(null), saved)), 'INVALID_CHECKPOINT_SHAPE');
});

test('identities, date, scope fields and whole-checkpoint digest are validated without echoing input', () => {
  const saved = checkpoint();
  for (const [field, value, code] of [
    ['schema', 'other', 'INVALID_CHECKPOINT_SCHEMA'], ['id', 'draft_' + uuid(10).toUpperCase(), 'INVALID_CHECKPOINT_ID'],
    ['key', 'synthetic-secret-key', 'INVALID_CHECKPOINT_KEY'], ['target', 'he_' + uuid(1).replace('-4000-', '-5000-'), 'INVALID_CHECKPOINT_TARGET'],
    ['requestDigest', 'synthetic-private-request', 'INVALID_REQUEST_DIGEST'],
    ['basis', 'synthetic-private-basis', 'INVALID_CHECKPOINT_BASIS'], ['revision', 'z'.repeat(40), 'INVALID_CHECKPOINT_REVISION'],
    ['sourceVersion', 'wrong-version', 'INVALID_SOURCE_VERSION'], ['privateOperation', 'op_arbitrary', 'INVALID_PRIVATE_OPERATION'],
    ['createdAt', '2026-10-01T10:02:00Z', 'INVALID_CHECKPOINT_DATE'], ['createdAt', '2026-02-30T10:02:00.000Z', 'INVALID_CHECKPOINT_DATE'],
    ['createdAt', 0, 'INVALID_CHECKPOINT_DATE'],
  ]) {
    const modified = rehash({ ...saved, [field]: value });
    errorCode(() => validateDraftCheckpoint(modified), code);
  }
  const changedDraft = { ...saved, draft: 'Synthetic altered draft without updated integrity' };
  errorCode(() => validateDraftCheckpoint(changedDraft), 'CHECKPOINT_DIGEST_MISMATCH');
  errorCode(() => validateDraftCheckpoint({ ...saved, digest: 'sha256:' + '0'.repeat(64) }), 'CHECKPOINT_DIGEST_MISMATCH');
  let coerced = false;
  const coercion = { valueOf() { coerced = true; throw new Error('Private date coercion must not execute'); },
    toString() { coerced = true; throw new Error('Private date coercion must not execute'); } };
  errorCode(() => validateDraftCheckpoint({ ...saved, createdAt: coercion }), 'INVALID_CHECKPOINT_DATE');
  assert.equal(coerced, false);
});

test('ill-formed Unicode and exact UTF-16 limits fail before normalization or mutation', () => {
  const saved = checkpoint();
  for (const before of ['\ud800', '\udc00']) errorCode(() => validateDraftCheckpoint({ ...saved, before }), 'INVALID_BASE_TEXT');
  for (const draft of ['\ud800', '\udc00']) errorCode(() => validateDraftCheckpoint({ ...saved, draft }), 'INVALID_DRAFT_TEXT');
  assert.equal(validateDraftCheckpoint(checkpoint(1, { before: 'a'.repeat(100000), draft: '😀'.repeat(50000) })), true);
  errorCode(() => validateDraftCheckpoint(checkpoint(1, { before: 'a'.repeat(100001) })), 'INVALID_BASE_TEXT');
  errorCode(() => validateDraftCheckpoint(checkpoint(1, { draft: '😀'.repeat(50000) + 'a' })), 'INVALID_DRAFT_TEXT');
});

test('collection count, unique target, identity and key limits reject overflow without eviction', () => {
  const twenty = collection(Array.from({ length: 20 }, (_, index) => checkpoint(index + 1, { draft: '' })));
  const original = JSON.stringify(twenty);
  assert.equal(validateDraftCheckpointCollection(twenty).count, 20);
  const overflow = collection([...twenty.checkpoints, checkpoint(21)]), before = JSON.stringify(overflow);
  errorCode(() => validateDraftCheckpointCollection(overflow), 'CHECKPOINT_COUNT_EXCEEDED');
  assert.equal(JSON.stringify(overflow), before); assert.equal(JSON.stringify(twenty), original);
  for (const [field, code] of [['id', 'DUPLICATE_CHECKPOINT_ID'], ['target', 'DUPLICATE_CHECKPOINT_TARGET'], ['key', 'DUPLICATE_CHECKPOINT_KEY']]) {
    const a = checkpoint(1), b = checkpoint(2, { [field]: a[field] });
    errorCode(() => validateDraftCheckpointCollection(collection([a, b])), code);
  }
  errorCode(() => validateDraftCheckpointCollection({ ...twenty, remoteAcceptance: true }), 'INVALID_COLLECTION_SHAPE');
  errorCode(() => validateDraftCheckpointCollection(collection(Array(1))), 'INVALID_CHECKPOINT_ARRAY');
  const extended = [checkpoint()]; extended.privateMetadata = 'Synthetic hidden sidecar';
  errorCode(() => validateDraftCheckpointCollection(collection(extended)), 'INVALID_CHECKPOINT_ARRAY');
  const getter = [checkpoint()]; Object.defineProperty(getter, '0', { enumerable: true,
    get() { throw new Error('Array getter must not execute'); } });
  errorCode(() => validateDraftCheckpointCollection(collection(getter)), 'INVALID_CHECKPOINT_ARRAY');
  const symbol = [checkpoint()]; symbol[Symbol('sidecar')] = 'Synthetic private metadata';
  errorCode(() => validateDraftCheckpointCollection(collection(symbol)), 'INVALID_CHECKPOINT_ARRAY');
  const serializer = { ...twenty, toJSON() { throw new Error('Collection serializer must not execute'); } };
  errorCode(() => validateDraftCheckpointCollection(serializer), 'INVALID_COLLECTION_SHAPE');
});

test('capacity counts exact JSON UTF-8 bytes and its trailing LF at the one-MiB boundary', () => {
  const envelope = collection(Array.from({ length: 11 }, (_, index) => checkpoint(index + 1, { draft: '' })));
  const overhead = Buffer.byteLength(JSON.stringify(envelope) + '\n', 'utf8');
  let remaining = 1048576 - overhead;
  for (const saved of envelope.checkpoints) {
    const length = Math.min(100000, remaining); saved.draft = 'a'.repeat(length); rehash(saved); remaining -= length;
  }
  assert.equal(remaining, 0);
  assert.deepEqual(validateDraftCheckpointCollection(envelope), { count: 11, bytes: 1048576 });
  const overflow = structuredClone(envelope); overflow.checkpoints.at(-1).draft += 'a'; rehash(overflow.checkpoints.at(-1));
  assert.equal(Buffer.byteLength(JSON.stringify(overflow), 'utf8'), 1048576);
  const before = JSON.stringify(overflow);
  errorCode(() => validateDraftCheckpointCollection(overflow), 'COLLECTION_BYTES_EXCEEDED');
  assert.equal(JSON.stringify(overflow), before);
  const multibyte = collection(Array.from({ length: 4 }, (_, index) => checkpoint(index + 1, { draft: '漢'.repeat(100000) })));
  assert.ok(JSON.stringify(multibyte).length < 1048576);
  errorCode(() => validateDraftCheckpointCollection(multibyte), 'COLLECTION_BYTES_EXCEEDED');
  const escaped = collection([checkpoint(1, { draft: '\u0000'.repeat(100000) }), checkpoint(2, { draft: '\u0000'.repeat(100000) })]);
  assert.ok(escaped.checkpoints.reduce((n, saved) => n + saved.draft.length, 0) < 1048576);
  errorCode(() => validateDraftCheckpointCollection(escaped), 'COLLECTION_BYTES_EXCEEDED');
});

test('compatibility distinguishes raw-only drift, source version and private working version', () => {
  const saved = checkpoint(), context = current(saved);
  assert.equal(version(saved.target, `*${raw}*`), saved.baseVersion);
  assert.deepEqual(assessDraftCheckpointCompatibility(saved, { ...context, raw: `*${raw}*`, rawDigest: hash(`*${raw}*`) }),
    { status: 'stale', reasons: ['EXACT_WORDING_CHANGED'] });
  const privateEdit = checkpoint(1, { before: 'Synthetic applied private working result.', privateOperation: `op_${uuid(9)}` });
  assert.notEqual(privateEdit.sourceVersion, privateEdit.baseVersion);
  assert.deepEqual(assessDraftCheckpointCompatibility(privateEdit, current(privateEdit)), { status: 'current', reasons: [] });
  assert.deepEqual(assessDraftCheckpointCompatibility(privateEdit, { ...current(privateEdit), sourceVersion: privateEdit.baseVersion }),
    { status: 'stale', reasons: ['SOURCE_VERSION_CHANGED'] });
  assert.deepEqual(assessDraftCheckpointCompatibility(privateEdit, { ...current(privateEdit), version: privateEdit.sourceVersion }),
    { status: 'stale', reasons: ['WORKING_VERSION_CHANGED'] });
});

test('every exact context binding is checked with neutral deterministic stale reasons', () => {
  const saved = checkpoint(), context = current(saved), otherVersion = version(saved.target, 'Another synthetic paragraph.');
  for (const [field, value, code] of [['id', `he_${uuid(2)}`, 'TARGET_CHANGED'], ['basis', 'sha256:' + '0'.repeat(64), 'BASIS_CHANGED'],
    ['revision', '0'.repeat(40), 'REVISION_CHANGED'], ['sourceVersion', otherVersion, 'SOURCE_VERSION_CHANGED'],
    ['version', otherVersion, 'WORKING_VERSION_CHANGED'], ['privateOperation', `op_${uuid(3)}`, 'PRIVATE_OPERATION_CHANGED']]) {
    assert.deepEqual(assessDraftCheckpointCompatibility(saved, { ...context, [field]: value }), { status: 'stale', reasons: [code] });
  }
  assert.deepEqual(assessDraftCheckpointCompatibility(saved, { ...context, rawDigest: 'sha256:' + '0'.repeat(64) }),
    { status: 'stale', reasons: ['EXACT_WORDING_CHANGED', 'CURRENT_WORDING_BINDING_INVALID'] });
  const changed = { ...context, basis: 'sha256:' + '0'.repeat(64), revision: '0'.repeat(40), privateOperation: `op_${uuid(3)}` };
  assert.deepEqual(assessDraftCheckpointCompatibility(saved, changed), assessDraftCheckpointCompatibility(saved, changed));
  const output = JSON.stringify(assessDraftCheckpointCompatibility(saved, changed));
  for (const secret of [saved.before, saved.draft, saved.target, saved.digest, saved.basis, changed.basis]) assert.equal(output.includes(secret), false);
});

test('unavailable and malformed current context cannot substitute historical draft text or expose metadata', () => {
  const saved = checkpoint();
  assert.deepEqual(assessDraftCheckpointCompatibility(saved, null), { status: 'unavailable', reasons: ['SOURCE_UNAVAILABLE'] });
  assert.deepEqual(assessDraftCheckpointCompatibility(saved, undefined), { status: 'unavailable', reasons: ['SOURCE_UNAVAILABLE'] });
  errorCode(() => assessDraftCheckpointCompatibility(saved, {}), 'INVALID_CURRENT_CONTEXT');
  const descriptor = current(saved); Object.defineProperty(descriptor, 'raw', { enumerable: true,
    get() { throw new Error('Private current getter must not execute'); } });
  errorCode(() => assessDraftCheckpointCompatibility(saved, descriptor), 'INVALID_CURRENT_CONTEXT');
  const extra = current(saved); Object.defineProperty(extra, 'sourceLocator', {
    get() { throw new Error('Unselected metadata must not be inspected'); } });
  assert.deepEqual(assessDraftCheckpointCompatibility(saved, extra), { status: 'current', reasons: [] });
  const absentOperation = current(saved); delete absentOperation.privateOperation;
  assert.deepEqual(assessDraftCheckpointCompatibility(saved, absentOperation), { status: 'current', reasons: [] });
  assert.deepEqual(assessDraftCheckpointCompatibility(saved, { ...current(saved), privateOperation: undefined }), { status: 'current', reasons: [] });
  const operationGetter = current(saved); Object.defineProperty(operationGetter, 'privateOperation', {
    enumerable: true, get() { throw new Error('Private operation getter must not execute'); } });
  errorCode(() => assessDraftCheckpointCompatibility(saved, operationGetter), 'INVALID_CURRENT_CONTEXT');
  const privateSaved = checkpoint(1, { privateOperation: `op_${uuid(3)}` });
  const privateContext = current(privateSaved); delete privateContext.privateOperation;
  assert.deepEqual(assessDraftCheckpointCompatibility(privateSaved, privateContext), { status: 'stale', reasons: ['PRIVATE_OPERATION_CHANGED'] });
  const corrupted = { ...saved, draft: 'Synthetic unreconciled draft mutation' };
  errorCode(() => assessDraftCheckpointCompatibility(corrupted, null), 'CHECKPOINT_DIGEST_MISMATCH');
});

test('live and revoked proxies fail with fixed codes before any object, current or array trap executes', () => {
  const saved = checkpoint();
  let traps = 0;
  const trap = () => { traps++; throw new Error('Synthetic private proxy text must never escape'); };
  const handler = { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap };
  const cases = [
    [saved, value => validateDraftCheckpoint(value), 'INVALID_CHECKPOINT_SHAPE'],
    [collection([saved]), value => validateDraftCheckpointCollection(value), 'INVALID_COLLECTION_SHAPE'],
    [[saved], value => validateDraftCheckpointCollection(collection(value)), 'INVALID_CHECKPOINT_ARRAY'],
    [current(saved), value => assessDraftCheckpointCompatibility(saved, value), 'INVALID_CURRENT_CONTEXT'],
  ];
  for (const [target, validate, code] of cases) {
    errorCode(() => validate(new Proxy(target, handler)), code);
    const revoked = Proxy.revocable(target, handler); revoked.revoke();
    errorCode(() => validate(revoked.proxy), code);
  }
  assert.equal(traps, 0);
  // A selected element proxy must also fail before descriptor or value access;
  // a normal JSON array does not make its elements trustworthy objects.
  errorCode(() => validateDraftCheckpointCollection(collection([new Proxy(saved, handler)])), 'INVALID_CHECKPOINT_SHAPE');
  assert.equal(traps, 0);
});
