// Routes select metadata from an already selected projection. They neither read
// sources nor authenticate that projection, grant access, or mutate history.
const ID = /^he_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VERSION = /^hev1:[0-9a-f]{64}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Kept in agreement with huey-literary-model/1 by the route tests. Importing its
// Node validator here would impose a Unicode runtime gate on a syntax contract.
const KINDS = new Set(['Work', 'FrontMatter', 'Body', 'BackMatter', 'MatterUnit',
  'Movement', 'Chapter', 'ChapterPart', 'Section', 'ReadingPage', 'Block',
  'Paragraph', 'Sentence', 'LexicalOccurrence', 'GraphemeOccurrence',
  'PresentationBasis', 'PresentationRelation']);
const FAMILIES = new Set(['front', 'back', 'chapter', 'unplaced', 'page']);
const UNIT_KINDS = new Set(['Chapter', 'ChapterPart', 'Section', 'Block', 'Paragraph', 'MatterUnit']);
const ACCESS = new Set(['available', 'restricted', 'unavailable-on-this-client']);
const ACCESS_RANK = { available: 0, 'unavailable-on-this-client': 1, restricted: 2 };
const fail = message => { throw new Error(`HUEY_ROUTES: ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };
const validId = value => typeof value === 'string' && ID.test(value);
const validVersion = value => typeof value === 'string' && VERSION.test(value);
const unique = values => new Set(values).size === values.length;
function shape(value, fields, label) {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)), `invalid ${label}`);
  const keys = Reflect.ownKeys(value);
  check(keys.length === fields.length && keys.every(key => fields.includes(key)), `invalid ${label} fields`);
}
function ids(value, label) {
  check(Array.isArray(value) && Array.from(value).every(validId) && unique(value), `invalid ${label}`);
}

/** Strict origin-relative syntax; no URL normalization or decoding precedes it. */
export function parseRouteAddress(input) {
  const invalid = { kind: 'invalid' };
  if (typeof input !== 'string' || input.length > 512 || !input.startsWith('/huey')
    || /[^\x21-\x7e]|[?#%\\]/.test(input) || input.includes('//')) return invalid;
  const normalized = input.endsWith('/') ? input.slice(0, -1) : input;
  if (normalized === '/huey') return { kind: 'entry', path: '/huey', version: null };
  const parts = normalized.split('/');
  if (parts[0] !== '' || parts[1] !== 'huey' || ![4, 6].includes(parts.length)) return invalid;
  const version = parts.length === 6 ? parts[5] : null;
  if (parts.length === 6 && (parts[4] !== 'v' || !validVersion(version))) return invalid;
  const family = parts[2], value = parts[3], path = parts.slice(0, 4).join('/');
  if (['entity', 'page', 'paragraph'].includes(family) && validId(value)) {
    return { kind: family, id: value, path, version };
  }
  if (FAMILIES.has(family) && value.length <= 64 && SLUG.test(value)) {
    return { kind: 'alias', family, slug: value, path, version };
  }
  return invalid;
}

export function formatEntityRoute({ id, kind, version = null }) {
  check(validId(id) && KINDS.has(kind) && (version === null || validVersion(version)), 'invalid entity route');
  const family = kind === 'ReadingPage' ? 'page' : kind === 'Paragraph' ? 'paragraph' : 'entity';
  return `/huey/${family}/${id}${version === null ? '' : `/v/${version}`}`;
}

function aliasMap(aliases) {
  check(Array.isArray(aliases), 'invalid aliases');
  const result = new Map();
  for (const alias of aliases) {
    shape(alias, ['path', 'targetId'], 'alias');
    const route = parseRouteAddress(alias.path);
    check(route.kind === 'alias' && route.version === null && route.path === alias.path
      && validId(alias.targetId) && !result.has(alias.path), 'unsafe or duplicate alias');
    result.set(alias.path, alias.targetId);
  }
  return result;
}

/** A rename adds a binding; old addresses cannot be deleted or reassigned. */
export function assertAliasContinuity(previousAliases, nextAliases) {
  const previous = aliasMap(previousAliases), next = aliasMap(nextAliases);
  for (const [path, targetId] of previous) {
    check(next.get(path) === targetId, 'alias removed or retargeted');
  }
}

/** Validates a closed metadata shape, not source rights or manuscript truth. */
export function validateRouteProjection(catalog) {
  shape(catalog, ['schema', 'projection', 'entryPageId', 'targets', 'slots', 'aliases'], 'projection');
  check(catalog.schema === 'huey.route-projection.v1'
    && ['editorial', 'publication'].includes(catalog.projection), 'unsupported projection');
  check(Array.isArray(catalog.targets) && Array.isArray(catalog.slots), 'invalid projection arrays');
  const targets = new Map(), slots = new Map();
  for (const target of catalog.targets) {
    shape(target, ['id', 'kind', 'version', 'access', 'unresolved', 'pageIds', 'slotIds'], 'target');
    check(validId(target.id) && !targets.has(target.id) && KINDS.has(target.kind), 'invalid or repeated target');
    check((target.version === null || validVersion(target.version)) && ACCESS.has(target.access)
      && typeof target.unresolved === 'boolean', 'invalid target state');
    check(target.access === 'available' || target.version === null, 'denied target must not carry an exact version');
    ids(target.pageIds, 'page references'); ids(target.slotIds, 'slot references');
    targets.set(target.id, target);
  }
  for (const slot of catalog.slots) {
    shape(slot, ['id', 'group', 'presence', 'editorialMaterialization', 'access',
      'publicationAnnotation', 'observedReaderAdmission'], 'slot');
    check(validId(slot.id) && !slots.has(slot.id) && targets.has(slot.id)
      && ['front', 'book', 'back', 'unplaced'].includes(slot.group), 'invalid or repeated slot');
    const target = targets.get(slot.id);
    check(target.slotIds.length === 1 && target.slotIds[0] === slot.id,
      'slot target must reference exactly its own slot metadata');
    check(slot.group === 'front' || slot.group === 'back' ? target.kind === 'MatterUnit'
      : slot.group === 'book' ? target.kind === 'Chapter' : UNIT_KINDS.has(target.kind),
    'slot group differs from literary target kind');
    check(['present', 'pending', 'omitted', 'absent'].includes(slot.presence)
      && ['full', 'partial', 'placeholder', 'unplaced', 'unavailable'].includes(slot.editorialMaterialization)
      && ACCESS.has(slot.access)
      && ['admitted', 'unavailable', 'not-listed'].includes(slot.observedReaderAdmission), 'invalid slot state');
    shape(slot.publicationAnnotation, ['label', 'authoritative'], 'publication annotation');
    check(['working', 'staged', 'held'].includes(slot.publicationAnnotation.label)
      && slot.publicationAnnotation.authoritative === false, 'publication annotation cannot authorize');
    slots.set(slot.id, slot);
  }
  for (const target of targets.values()) {
    check(target.pageIds.every(id => targets.get(id)?.kind === 'ReadingPage'), 'unknown or mistyped page reference');
    check(target.slotIds.every(id => slots.has(id) && targets.has(id)), 'unknown slot reference');
    const referenced = target.slotIds.map(id => slots.get(id));
    check(referenced.every(slot => ACCESS_RANK[target.access] >= ACCESS_RANK[slot.access]),
      'target access contradicts its slot metadata');
    check(target.unresolved || referenced.every(slot => !['pending', 'absent'].includes(slot.presence)
      && slot.editorialMaterialization !== 'placeholder'), 'target resolution contradicts its slot metadata');
  }
  check(catalog.entryPageId === null || (validId(catalog.entryPageId)
    && targets.get(catalog.entryPageId)?.kind === 'ReadingPage'), 'invalid entry page');
  for (const [path, targetId] of aliasMap(catalog.aliases)) {
    const target = targets.get(targetId), family = parseRouteAddress(path).family;
    check(target !== undefined, 'alias names unknown entity');
    // An alias records a readable binding, including its historical placement.
    // Moving a retained entity cannot revoke its old address. Current placement
    // comes from slot metadata; only the entity's permanent kind constrains it.
    check(family === 'page' ? target.kind === 'ReadingPage'
      : family === 'front' || family === 'back' ? target.kind === 'MatterUnit'
      : family === 'chapter' ? target.kind === 'Chapter'
      : UNIT_KINDS.has(target.kind),
    'alias family differs from literary target kind');
  }
  return catalog;
}

function copySlot(slot) {
  return { id: slot.id, group: slot.group, presence: slot.presence,
    editorialMaterialization: slot.editorialMaterialization, access: slot.access,
    publicationAnnotation: { ...slot.publicationAnnotation }, observedReaderAdmission: slot.observedReaderAdmission };
}

/** No text loading, permission inference, current-version fallback, or history. */
export function resolveRouteAddress(input, catalog) {
  validateRouteProjection(catalog);
  const route = parseRouteAddress(input);
  if (route.kind === 'invalid') return { status: 'invalid-route' };
  if (route.kind === 'entry' && catalog.entryPageId === null) {
    return { status: 'unresolved', projection: catalog.projection, entryPageId: null };
  }
  const id = route.kind === 'entry' ? catalog.entryPageId : route.kind === 'alias'
    ? catalog.aliases.find(alias => alias.path === route.path)?.targetId : route.id;
  const target = catalog.targets.find(entity => entity.id === id);
  if (!target || (route.kind === 'page' && target.kind !== 'ReadingPage')
    || (route.kind === 'paragraph' && target.kind !== 'Paragraph')) return { status: 'unknown' };
  const canonicalPath = route.kind === 'entry' ? '/huey'
    : formatEntityRoute({ id: target.id, kind: target.kind, version: route.version });
  const status = target.access === 'restricted' ? 'restricted'
    : target.access === 'unavailable-on-this-client' ? 'unavailable'
    : route.version !== null && route.version !== target.version ? 'version-unavailable'
    : target.unresolved ? 'unresolved' : target.version === null ? 'unavailable' : 'resolved';
  const denied = ['restricted', 'unavailable', 'version-unavailable'].includes(status);
  return { status, projection: catalog.projection, entityId: target.id, kind: target.kind,
    requestedVersion: route.version, entityVersion: denied ? null : target.version,
    canonicalPath, redirectTo: input === canonicalPath ? null : canonicalPath,
    pageIds: [...target.pageIds],
    slots: target.slotIds.map(id => copySlot(catalog.slots.find(slot => slot.id === id))) };
}
