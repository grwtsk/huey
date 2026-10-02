/** Pure draft contract validation. No store, writer, restoration or operation adapter. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isProxy } from 'node:util/types';
import { canonical, profile, seal } from './literary_model.mjs';
import { parseEditorialMarkdown } from './editorial_markdown.mjs';

export class DraftCheckpointError extends Error {
  constructor(code) { super(code); this.name = 'DraftCheckpointError'; this.code = code; }
}
const fail = code => { throw new DraftCheckpointError(code); };
const check = (condition, code) => { if (!condition) fail(code); };
const plain = value => value !== null && typeof value === 'object' && !isProxy(value)
  && Object.getPrototypeOf(value) === Object.prototype;
const hash = value => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{40}$/;
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const checkpointID = new RegExp(`^draft_${uuid}$`), keyPattern = new RegExp(`^${uuid}$`), operationID = new RegExp(`^op_${uuid}$`);
const entityID = new RegExp(profile.entityID), entityVersion = new RegExp(profile.entityVersion);
const expectedCheckpointFields = ['schema', 'id', 'key', 'requestDigest', 'target', 'basis', 'revision', 'baseVersion', 'sourceVersion',
  'beforeDigest', 'before', 'draft', 'privateOperation', 'createdAt', 'digest'];
const expectedCollectionFields = ['schema', 'checkpoints'];

function loadPolicy() {
  let value;
  try { value = JSON.parse(readFileSync(new URL('../planning/grwtsk-draft-retention.json', import.meta.url), 'utf8')); }
  catch { fail('INVALID_DRAFT_POLICY'); }
  check(value?.schema === 'huey.private-draft-retention-policy.v2' && (value.status === 'preparation-only'
    && value.runtimePersistenceEnabled === false || value.status === 'local-explicit' && typeof value.runtimePersistenceEnabled === 'boolean'),
  'INVALID_DRAFT_POLICY');
  check(value.checkpointSchema === 'huey.private-draft-checkpoint.v2'
    && value.collectionSchema === 'huey.private-draft-checkpoint-collection.v2'
    && JSON.stringify(value.checkpointFields) === JSON.stringify(expectedCheckpointFields)
    && JSON.stringify(value.collectionFields) === JSON.stringify(expectedCollectionFields), 'INVALID_DRAFT_POLICY');
  const limits = value.limits;
  check(plain(limits) && ['maxCheckpoints', 'maxCollectionBytes', 'maxBaseCodeUnits', 'maxDraftCodeUnits']
    .every(key => Number.isSafeInteger(limits[key]) && limits[key] > 0) && limits.maxCheckpointsPerTarget === 1,
  'INVALID_DRAFT_POLICY');
  check(value.encoding === 'compact JSON.stringify(collection) followed by one LF; UTF-8 bytes', 'INVALID_DRAFT_POLICY');
  return value;
}
const policy = loadPolicy();

function fields(value, required, code) {
  check(plain(value), code);
  const own = Reflect.ownKeys(value);
  check(own.length === required.length && required.every(key => own.includes(key)), code);
  check(own.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor.enumerable && Object.hasOwn(descriptor, 'value');
  }), code);
}
function scalar(value, maximum, code) {
  check(typeof value === 'string' && value.isWellFormed() && value.length <= maximum, code);
}
function pattern(value, expression, code) { check(typeof value === 'string' && expression.test(value), code); }
function baseVersion(target, before) {
  let blocks;
  try { blocks = parseEditorialMarkdown(before); } catch { fail('INVALID_BASE_PARAGRAPH'); }
  check(blocks.length === 1 && blocks[0].kind === 'Paragraph' && blocks[0].source.start === 0
    && blocks[0].source.end === before.length, 'INVALID_BASE_PARAGRAPH');
  try { return seal({ id: target, kind: 'Paragraph', state: blocks[0].state }).version; }
  catch { fail('INVALID_BASE_PARAGRAPH'); }
}
const digestFields = checkpoint => Object.fromEntries(expectedCheckpointFields.filter(key => key !== 'digest')
  .map(key => [key, checkpoint[key]]));

/** Validate exact private data without copying it into a return value or changing it. */
export function validateDraftCheckpoint(checkpoint) {
  fields(checkpoint, policy.checkpointFields, 'INVALID_CHECKPOINT_SHAPE');
  check(checkpoint.schema === policy.checkpointSchema, 'INVALID_CHECKPOINT_SCHEMA');
  pattern(checkpoint.id, checkpointID, 'INVALID_CHECKPOINT_ID');
  pattern(checkpoint.key, keyPattern, 'INVALID_CHECKPOINT_KEY');
  pattern(checkpoint.requestDigest, digestPattern, 'INVALID_REQUEST_DIGEST');
  pattern(checkpoint.target, entityID, 'INVALID_CHECKPOINT_TARGET');
  pattern(checkpoint.basis, digestPattern, 'INVALID_CHECKPOINT_BASIS');
  pattern(checkpoint.revision, revisionPattern, 'INVALID_CHECKPOINT_REVISION');
  pattern(checkpoint.baseVersion, entityVersion, 'INVALID_BASE_VERSION');
  pattern(checkpoint.sourceVersion, entityVersion, 'INVALID_SOURCE_VERSION');
  pattern(checkpoint.beforeDigest, digestPattern, 'INVALID_BASE_DIGEST');
  pattern(checkpoint.digest, digestPattern, 'INVALID_CHECKPOINT_DIGEST');
  check(checkpoint.privateOperation === null || typeof checkpoint.privateOperation === 'string'
    && operationID.test(checkpoint.privateOperation), 'INVALID_PRIVATE_OPERATION');
  check(typeof checkpoint.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(checkpoint.createdAt), 'INVALID_CHECKPOINT_DATE');
  let time;
  try { time = new Date(checkpoint.createdAt).toISOString(); } catch { fail('INVALID_CHECKPOINT_DATE'); }
  check(time === checkpoint.createdAt, 'INVALID_CHECKPOINT_DATE');
  scalar(checkpoint.before, policy.limits.maxBaseCodeUnits, 'INVALID_BASE_TEXT');
  scalar(checkpoint.draft, policy.limits.maxDraftCodeUnits, 'INVALID_DRAFT_TEXT');
  check(hash(checkpoint.before) === checkpoint.beforeDigest, 'BASE_DIGEST_MISMATCH');
  check(baseVersion(checkpoint.target, checkpoint.before) === checkpoint.baseVersion, 'BASE_VERSION_MISMATCH');
  check(hash(canonical(digestFields(checkpoint))) === checkpoint.digest, 'CHECKPOINT_DIGEST_MISMATCH');
  return true;
}

/**
 * Capacity is the exact UTF-8 length of compact JSON.stringify(collection) plus
 * one trailing LF. This validates a future writer's envelope; it writes nothing,
 * expires/evicts nothing, and returns only count/size. Array order is preserved.
 */
export function validateDraftCheckpointCollection(collection) {
  fields(collection, policy.collectionFields, 'INVALID_COLLECTION_SHAPE');
  check(collection.schema === policy.collectionSchema, 'INVALID_COLLECTION_SCHEMA');
  const checkpoints = collection.checkpoints;
  check(!isProxy(checkpoints) && Array.isArray(checkpoints) && Object.getPrototypeOf(checkpoints) === Array.prototype,
    'INVALID_CHECKPOINT_ARRAY');
  check(checkpoints.length <= policy.limits.maxCheckpoints, 'CHECKPOINT_COUNT_EXCEEDED');
  const keys = Reflect.ownKeys(checkpoints);
  check(keys.length === checkpoints.length + 1 && keys.includes('length')
    && Array.from({ length: checkpoints.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(checkpoints, String(index));
      return descriptor?.enumerable && Object.hasOwn(descriptor, 'value');
    }).every(Boolean), 'INVALID_CHECKPOINT_ARRAY');
  const ids = new Set(), targets = new Set(), requestKeys = new Set();
  for (const checkpoint of checkpoints) {
    validateDraftCheckpoint(checkpoint);
    check(!ids.has(checkpoint.id), 'DUPLICATE_CHECKPOINT_ID');
    check(!targets.has(checkpoint.target), 'DUPLICATE_CHECKPOINT_TARGET');
    check(!requestKeys.has(checkpoint.key), 'DUPLICATE_CHECKPOINT_KEY');
    ids.add(checkpoint.id); targets.add(checkpoint.target); requestKeys.add(checkpoint.key);
  }
  const bytes = Buffer.byteLength(`${JSON.stringify(collection)}\n`, 'utf8');
  check(bytes <= policy.limits.maxCollectionBytes, 'COLLECTION_BYTES_EXCEEDED');
  return { count: checkpoints.length, bytes };
}

/**
 * Compare only an explicitly supplied trusted current read-shaped context:
 * {id,basis,revision,sourceVersion,version,raw,rawDigest,privateOperation?}, or null
 * for unavailable source. Other read metadata is neither examined nor copied.
 * A current result authorizes no restoration, source write, application or assent.
 */
export function assessDraftCheckpointCompatibility(checkpoint, current) {
  validateDraftCheckpoint(checkpoint);
  if (current === null || current === undefined) return { status: 'unavailable', reasons: ['SOURCE_UNAVAILABLE'] };
  check(plain(current), 'INVALID_CURRENT_CONTEXT');
  const required = ['id', 'basis', 'revision', 'sourceVersion', 'version', 'raw', 'rawDigest'];
  check(required.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    return descriptor?.enumerable && Object.hasOwn(descriptor, 'value');
  }), 'INVALID_CURRENT_CONTEXT');
  pattern(current.id, entityID, 'INVALID_CURRENT_CONTEXT');
  pattern(current.basis, digestPattern, 'INVALID_CURRENT_CONTEXT');
  pattern(current.revision, revisionPattern, 'INVALID_CURRENT_CONTEXT');
  pattern(current.sourceVersion, entityVersion, 'INVALID_CURRENT_CONTEXT');
  pattern(current.version, entityVersion, 'INVALID_CURRENT_CONTEXT');
  pattern(current.rawDigest, digestPattern, 'INVALID_CURRENT_CONTEXT');
  const operationDescriptor = Object.getOwnPropertyDescriptor(current, 'privateOperation');
  check(!operationDescriptor || operationDescriptor.enumerable && Object.hasOwn(operationDescriptor, 'value'), 'INVALID_CURRENT_CONTEXT');
  const privateOperation = operationDescriptor?.value ?? null;
  check(typeof current.raw === 'string' && current.raw.isWellFormed() && (privateOperation === null
    || typeof privateOperation === 'string' && operationID.test(privateOperation)), 'INVALID_CURRENT_CONTEXT');
  const reasons = [];
  for (const [savedKey, currentKey, code] of [
    ['target', 'id', 'TARGET_CHANGED'], ['basis', 'basis', 'BASIS_CHANGED'], ['revision', 'revision', 'REVISION_CHANGED'],
    ['sourceVersion', 'sourceVersion', 'SOURCE_VERSION_CHANGED'], ['baseVersion', 'version', 'WORKING_VERSION_CHANGED'],
  ]) if (checkpoint[savedKey] !== current[currentKey]) reasons.push(code);
  if (checkpoint.privateOperation !== privateOperation) reasons.push('PRIVATE_OPERATION_CHANGED');
  if (current.raw !== checkpoint.before || current.rawDigest !== checkpoint.beforeDigest) reasons.push('EXACT_WORDING_CHANGED');
  if (hash(current.raw) !== current.rawDigest) reasons.push('CURRENT_WORDING_BINDING_INVALID');
  return { status: reasons.length ? 'stale' : 'current', reasons };
}
