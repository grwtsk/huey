import { createHash } from 'node:crypto';
import { buildAssembly } from './editorial_pages.mjs';
import { safePath } from './editorial_inventory.mjs';
import { canonical, profile } from './literary_model.mjs';

const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const ID = new RegExp(profile.entityID);
const VERSION = new RegExp(profile.entityVersion);
const plain = value => value !== null && typeof value === 'object'
  && Object.getPrototypeOf(value) === Object.prototype;

class SourceReconciliationError extends Error {
  constructor(code) {
    super(`RECONCILIATION_${code}`);
    this.name = 'SourceReconciliationError';
    this.code = `RECONCILIATION_${code}`;
  }
}
const fail = code => { throw new SourceReconciliationError(code); };
const check = (condition, code) => { if (!condition) fail(code); };

function shape(value, fields, code) {
  check(plain(value), code);
  const keys = Reflect.ownKeys(value);
  check(keys.length === fields.length && keys.every(key => fields.includes(key)), code);
  check(keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Object.hasOwn(descriptor, 'value') && descriptor.enumerable;
  }), code);
}

// Metadata must be literal JSON data. Do not invoke accessors while computing a
// concurrency digest or copying a proposed plan; source text stays outside it.
function data(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return;
  check(!seen.has(value), 'METADATA'); seen.add(value);
  check(Array.isArray(value) || plain(value), 'METADATA');
  const keys = Reflect.ownKeys(value);
  if (Array.isArray(value)) check(keys.length === value.length + 1
    && keys.every(key => key === 'length' || /^(0|[1-9]\d*)$/.test(key)
      && Number(key) < value.length), 'METADATA');
  for (const key of keys) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    check(typeof key === 'string' && Object.hasOwn(descriptor, 'value') && descriptor.enumerable, 'METADATA');
    data(descriptor.value, seen);
  }
  seen.delete(value);
}

function encoded(value) {
  data(value);
  return canonical(value);
}

/** SHA-256 of canonical plan metadata; not an EntityVersion or an approval. */
export function planDigest(plan) {
  try { return createHash('sha256').update(encoded(plan), 'utf8').digest('hex'); }
  catch { fail('PLAN_DATA'); }
}

function sourceContext(inventory, sourceKey) {
  check(inventory?.schema === 'huey.editorial-inventory.v1'
    && Array.isArray(inventory.sources) && Array.isArray(inventory.slots), 'INVENTORY');
  const sources = inventory.sources.filter(source => source.key === sourceKey);
  check(sources.length === 1, 'SOURCE_SELECTION');
  const source = sources[0];
  // Check denial before path, pin, supplied text, parser, hash or plan copying.
  check(source.access === 'available', 'SOURCE_DENIED');
  check(['canonical', 'unplaced'].includes(source.role)
    && Array.isArray(source.targets) && source.targets.length === 1, 'SOURCE_SELECTION');
  const slots = inventory.slots.filter(slot => slot.key === source.targets[0]);
  check(slots.length === 1, 'SOURCE_SELECTION');
  const slot = slots[0];
  check(slot.access === 'available' && slot.canonicalState === 'present-content', 'SOURCE_DENIED');
  check(Array.isArray(slot.sources) && slot.sources.includes(sourceKey)
    && slot.canonicalPath === source.path, 'SOURCE_SELECTION');
  return { source, slot };
}

function pin(value) {
  shape(value, ['revision', 'path', 'blob'], 'PIN');
  check(typeof value.revision === 'string' && SHA.test(value.revision)
    && typeof value.blob === 'string' && SHA.test(value.blob)
    && safePath(value.path) && value.path.startsWith('manuscript/'), 'PIN');
}
const samePin = (left, right) => ['revision', 'path', 'blob'].every(key => left[key] === right[key]);

function fixedInventory(inventory, sourceKey, slotKey) {
  const copy = JSON.parse(encoded(inventory));
  // These fields describe the metadata checkpoint. They grant nothing and do
  // not define literary state; all structural and scope metadata stays fixed.
  delete copy.inventoryDigest;
  delete copy.basisRevision;
  for (const source of copy.sources) if (source.key === sourceKey) {
    delete source.revision; delete source.path; delete source.blob;
  }
  for (const slot of copy.slots) if (slot.key === slotKey) delete slot.canonicalPath;
  return canonical(copy);
}

function assembly(input, code) {
  try { return buildAssembly(input); }
  catch { fail(code); }
}

/**
 * Check a supplied one-to-one correspondence for one existing public source.
 * Inputs are checked inventory snapshots and explicit sourceTexts maps. No IDs
 * are inferred from text/ranges, allocated, fetched or written. Page boundaries,
 * ownership, source selection and all unrelated source plans remain fixed.
 * This is a proposed metadata reconciliation, not an EditorialOperation,
 * authenticated authorization, evidence transfer, or completed literary lineage.
 */
export function reconcileSource(input) {
  try {
    shape(input, ['before', 'after', 'correspondence'], 'INPUT');
    const { before, after, correspondence: request } = input;
    shape(before, ['inventory', 'plan', 'sourceTexts'], 'INPUT');
    shape(after, ['inventory', 'sourceTexts'], 'INPUT');
    shape(request, ['schema', 'sourceKey', 'basePlanSha256', 'before', 'after', 'blocks'], 'REQUEST');
    check(request.schema === 'huey.source-correspondence.v1'
      && typeof request.sourceKey === 'string' && request.sourceKey.length > 0
      && typeof request.basePlanSha256 === 'string' && SHA256.test(request.basePlanSha256), 'REQUEST');
    const previous = sourceContext(before.inventory, request.sourceKey);
    const next = sourceContext(after.inventory, request.sourceKey);
    data(request);
    pin(request.before); pin(request.after);
    check(samePin(request.before, previous.source) && samePin(request.after, next.source), 'PIN_MISMATCH');
    check(previous.source.role === next.source.role && previous.slot.key === next.slot.key
      && previous.slot.entityId === next.slot.entityId, 'INVENTORY_DRIFT');
    check(fixedInventory(before.inventory, request.sourceKey, previous.slot.key)
      === fixedInventory(after.inventory, request.sourceKey, next.slot.key), 'INVENTORY_DRIFT');
    check(planDigest(before.plan) === request.basePlanSha256, 'STALE_PLAN');
    check(Array.isArray(before.plan.sources), 'BEFORE_ASSEMBLY');
    const selected = before.plan.sources.filter(source => source.sourceKey === request.sourceKey);
    check(selected.length === 1 && Array.isArray(selected[0].blocks), 'SOURCE_SELECTION');
    const oldSource = selected[0];
    check(Array.isArray(request.blocks) && request.blocks.length === oldSource.blocks.length, 'BLOCK_COUNT');
    for (let index = 0; index < request.blocks.length; index++) {
      const block = request.blocks[index];
      shape(block, ['entityId', 'baseVersion', 'start', 'end'], 'BLOCK');
      check(typeof block.entityId === 'string' && ID.test(block.entityId)
        && block.entityId === oldSource.blocks[index].id, 'IDENTITY_ORDER');
      check(typeof block.baseVersion === 'string' && VERSION.test(block.baseVersion), 'BASE_VERSION');
      check(Number.isSafeInteger(block.start) && Number.isSafeInteger(block.end)
        && block.start >= 0 && block.end > block.start, 'RANGE');
    }
    const oldAssembly = assembly(before, 'BEFORE_ASSEMBLY');
    const oldEntities = new Map(oldAssembly.entityRecords.map(entity => [entity.id, entity]));
    for (const block of request.blocks) check(oldEntities.get(block.entityId)?.version === block.baseVersion, 'STALE_VERSION');
    const plan = JSON.parse(encoded(before.plan));
    const sourcePlan = plan.sources.find(source => source.sourceKey === request.sourceKey);
    Object.assign(sourcePlan, request.after);
    sourcePlan.blocks = oldSource.blocks.map((block, index) => ({ ...block,
      start: request.blocks[index].start, end: request.blocks[index].end }));
    const newAssembly = assembly({ inventory: after.inventory, plan, sourceTexts: after.sourceTexts }, 'AFTER_ASSEMBLY');
    const newEntities = new Map(newAssembly.entityRecords.map(entity => [entity.id, entity]));
    const changes = request.blocks.map(block => {
      const oldEntity = oldEntities.get(block.entityId), newEntity = newEntities.get(block.entityId);
      check(newEntity?.kind === oldEntity.kind, 'KIND_CHANGE');
      return { entityId: block.entityId, kind: oldEntity.kind,
        beforeVersion: oldEntity.version, afterVersion: newEntity.version,
        state: oldEntity.version === newEntity.version ? 'unchanged' : 'revised' };
    });
    return { schema: 'huey.source-reconciliation.v1', plan, changes };
  } catch (error) {
    if (error instanceof SourceReconciliationError) throw error;
    // Do not echo source bytes, locators, parser excerpts or accessor messages.
    fail('INVALID_INPUT');
  }
}
