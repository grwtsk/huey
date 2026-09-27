import { formatEntityRoute } from './routes.mjs';
import { createTraversal } from './traversal.mjs';

const fail = message => { throw new Error(`HUEY_PARAGRAPHS: ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };
const CHAPTER = /^[A-Z][A-Z0-9]*$/;
const BLOB = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const LEGACY_FIELDS = ['chapterId', 'chapterBlob', 'ordinal', 'rawSha256'];

function shape(value, fields, label) {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)), `invalid ${label}`);
  const keys = Reflect.ownKeys(value);
  check(keys.length === fields.length && keys.every(key => fields.includes(key)), `invalid ${label} fields`);
}

function legacyTuple(value) {
  check(typeof value.chapterId === 'string' && CHAPTER.test(value.chapterId)
    && typeof value.chapterBlob === 'string' && BLOB.test(value.chapterBlob)
    && Number.isSafeInteger(value.ordinal) && value.ordinal > 0
    && typeof value.rawSha256 === 'string' && SHA256.test(value.rawSha256), 'invalid exact legacy tuple');
}

function entityTuple({ entityId, entityVersion }) {
  check(typeof entityVersion === 'string', 'an exact entity version is required');
  formatEntityRoute({ id: entityId, kind: 'Paragraph', version: entityVersion });
}

/**
 * A current, exact compatibility receipt. These links neither authenticate a
 * source nor transfer evidence to another literary revision. The producer must
 * reconcile the admitted source and the stable registry before emitting rows.
 */
export function validateParagraphBindings(value) {
  shape(value, ['schema', 'bindings'], 'bindings document');
  check(value.schema === 'huey.legacy-paragraph-bindings.v1' && Array.isArray(value.bindings),
    'unsupported bindings document');
  const legacy = new Set(), entities = new Set();
  for (const row of value.bindings) {
    shape(row, [...LEGACY_FIELDS, 'entityId', 'entityVersion'], 'binding');
    legacyTuple(row); entityTuple(row);
    const sourceKey = `${row.chapterId}/${row.chapterBlob}/${row.ordinal}`;
    const entityKey = `${row.entityId}/${row.entityVersion}`;
    check(!legacy.has(sourceKey) && !entities.has(entityKey), 'duplicate or ambiguous binding');
    legacy.add(sourceKey); entities.add(entityKey);
  }
  return value;
}

/** No ordinal-only, text-equality, or current-source fallback. */
export function findLegacyBinding(value, tuple) {
  validateParagraphBindings(value);
  shape(tuple, LEGACY_FIELDS, 'legacy lookup'); legacyTuple(tuple);
  const row = value.bindings.find(binding => LEGACY_FIELDS.every(key => binding[key] === tuple[key]));
  return row ? { ...row } : null;
}

/** A changed EntityVersion has no inherited evidence binding. */
export function lookupEvidenceBinding(value, tuple) {
  validateParagraphBindings(value);
  shape(tuple, ['entityId', 'entityVersion'], 'entity lookup'); entityTuple(tuple);
  const row = value.bindings.find(binding => binding.entityId === tuple.entityId
    && binding.entityVersion === tuple.entityVersion);
  return row ? { ...row } : null;
}

export function paragraphLinks({ id, version }) {
  entityTuple({ entityId: id, entityVersion: version });
  return {
    current: formatEntityRoute({ id, kind: 'Paragraph' }),
    exact: formatEntityRoute({ id, kind: 'Paragraph', version }),
  };
}

/**
 * Locate an available exact/current paragraph within the selected projection.
 * Membership is navigation context, never paragraph identity or revision lineage.
 * A missing membership is unprojected, not an inferred retirement; missing old
 * versions never silently select the current wording. No text or history is read.
 */
export function resolveParagraphLocation(address, projection, preferredPageId = null) {
  const traversal = createTraversal(projection);
  const { resolution } = traversal.locate(address);
  const result = {
    resolution, paragraphId: resolution.kind === 'Paragraph' ? resolution.entityId : null,
    selectedPageId: null, candidates: [], status: 'not-paragraph',
    sequence: null, index: null, previous: null, next: null,
  };
  if (resolution.kind !== 'Paragraph') return result;
  if (resolution.status !== 'resolved') return { ...result, status: 'unavailable' };
  if (resolution.pageIds.length === 0) return { ...result, status: 'unprojected' };

  const membership = new Set(resolution.pageIds);
  const positions = [...traversal.readingOrder, ...traversal.unplacedOrder]
    .filter(id => membership.has(id))
    .map(id => traversal.locate(formatEntityRoute({ id, kind: 'ReadingPage' })))
    .filter(position => position.resolution.status === 'resolved');
  result.candidates = positions.map(position => position.pageId);
  if (positions.length === 0) return { ...result, status: 'unavailable' };
  const selected = preferredPageId === null ? positions.length === 1 ? positions[0] : null
    : positions.find(position => position.pageId === preferredPageId);
  if (!selected) return { ...result, status: 'ambiguous' };
  return { ...result, status: 'located', selectedPageId: selected.pageId,
    sequence: selected.sequence, index: selected.index, previous: selected.previous, next: selected.next };
}
