#!/usr/bin/env node
// Read-only validation of the #348 synthetic model profile. No content inference.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const profile = JSON.parse(readFileSync(new URL('../planning/literary-model/v1.json', import.meta.url), 'utf8'));
const idPattern = new RegExp(profile.entityID);
const versionPattern = new RegExp(profile.entityVersion);
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
const fail = (code, message) => { throw Object.assign(new Error(`${code}: ${message}`), { code }); };
const check = (condition, code, message) => { if (!condition) fail(code, message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function shape(value, fields, label) {
  check(object(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)), 'SHAPE', label);
}
function list(value, label) { check(Array.isArray(value), 'SHAPE', label); return value; }

// Restricted canonical JSON: key sorting is byte-compatible because keys are ASCII.
export function canonical(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    check(value.isWellFormed(), 'UNICODE_SCALAR', 'unpaired surrogate');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    check(Number.isSafeInteger(value) && !Object.is(value, -0), 'CANONICAL_NUMBER', 'only safe integers other than negative zero');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    check(Object.keys(value).length === value.length && Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index)).every(Boolean), 'CANONICAL_VALUE', 'sparse or extended array');
    return `[${value.map(canonical).join(',')}]`;
  }
  check(object(value) && Object.getPrototypeOf(value) === Object.prototype, 'CANONICAL_VALUE', 'plain JSON object required');
  const keys = Object.keys(value).sort();
  check(keys.every(key => /^[\x20-\x7e]+$/.test(key)), 'CANONICAL_KEY', 'nonempty printable ASCII keys required');
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

export function entityVersion(entity) {
  const value = { model: profile.model, id: entity.id, kind: entity.kind, state: entity.state };
  return `hev1:${createHash('sha256').update(profile.versionDomain + canonical(value), 'utf8').digest('hex')}`;
}
export function seal(entity) { return { ...entity, version: entityVersion(entity) }; }
export function graphemeBoundaries(text) {
  check(typeof text === 'string' && text.isWellFormed(), 'UNICODE_SCALAR', 'text must contain Unicode scalars');
  return new Set([0, ...[...segmenter.segment(text)].map(item => item.index + item.segment.length)]);
}
const endpointKey = point => `${point.id}@${point.version}`;
function ownershipSlot(snapshot, id) {
  for (const entity of snapshot.entities) {
    const childIndex = entity.state.children?.indexOf(id) ?? -1;
    if (childIndex >= 0) return { parent: entity.id, type: 'children', index: childIndex };
    const spanIndex = entity.state.spans?.findIndex(span => span.id === id) ?? -1;
    if (spanIndex >= 0) {
      const span = entity.state.spans[spanIndex];
      return { parent: entity.id, type: 'spans', index: spanIndex, start: span.start, end: span.end };
    }
  }
  return null;
}
function endpoint(point) {
  shape(point, ['id', 'version'], 'exact-version reference');
  check(typeof point.id === 'string' && typeof point.version === 'string' && idPattern.test(point.id) && versionPattern.test(point.version), 'ENDPOINT', 'malformed exact-version reference');
  return endpointKey(point);
}

export function validateBundle(bundle) {
  shape(bundle, ['model', 'snapshots'], 'bundle');
  check(bundle.model === profile.model, 'MODEL', 'unknown model');
  // The runtime must disclose a segmentation mismatch instead of silently changing boundaries.
  check(process.versions.unicode === profile.segmentation.unicode, 'SEGMENTATION_RUNTIME', `expected Unicode ${profile.segmentation.unicode}; runtime has ${process.versions.unicode}`);
  const kinds = new Map(), records = new Map(), names = new Set();
  list(bundle.snapshots, 'snapshots');
  check(bundle.snapshots.length > 0, 'SHAPE', 'at least one snapshot');
  for (const snapshot of bundle.snapshots) {
    shape(snapshot, ['name', 'entities', 'routes', 'annotations', 'lineage'], 'snapshot');
    check(typeof snapshot.name === 'string' && snapshot.name.length > 0 && !names.has(snapshot.name), 'SNAPSHOT_NAME', 'duplicate or invalid snapshot name');
    names.add(snapshot.name);
    const entities = new Map(), owners = new Map(), edges = new Map();
    for (const entity of list(snapshot.entities, 'entities')) {
      shape(entity, ['id', 'kind', 'state', 'version'], 'entity');
      check(object(entity.state), 'SHAPE', 'entity state object required');
      check(typeof entity.id === 'string' && idPattern.test(entity.id), 'ENTITY_ID', 'opaque UUID v4 identity required');
      check(!entities.has(entity.id), 'DUPLICATE_ID', entity.id);
      check(typeof entity.kind === 'string' && Object.hasOwn(profile.entityKinds, entity.kind), 'ENTITY_KIND', 'known string kind required');
      const definition = profile.entityKinds[entity.kind];
      check(definition && definition.form !== 'abstract', 'ENTITY_KIND', String(entity.kind));
      check(!kinds.has(entity.id) || kinds.get(entity.id) === entity.kind, 'KIND_CHANGED', entity.id);
      kinds.set(entity.id, entity.kind);
      check(typeof entity.version === 'string' && versionPattern.test(entity.version), 'VERSION_FORMAT', entity.id);
      check(entityVersion(entity) === entity.version, 'VERSION_MISMATCH', entity.id);
      const key = endpointKey(entity), state = canonical(entity);
      check(!records.has(key) || records.get(key) === state, 'VERSION_REDEFINED', key);
      records.set(key, state);
      entities.set(entity.id, entity);
    }
    const resolve = id => {
      check(typeof id === 'string' && entities.has(id), 'DANGLING_REFERENCE', String(id));
      return entities.get(id);
    };
    const own = (parent, id, permitted) => {
      const child = resolve(id);
      check(permitted.includes(child.kind), 'CONTAINMENT_KIND', `${parent.kind} cannot own ${child.kind}`);
      check(!owners.has(id), 'OWNERSHIP', `${id} occurs in more than one ownership slot`);
      owners.set(id, parent.id);
      edges.set(parent.id, [...(edges.get(parent.id) ?? []), id]);
      return child;
    };
    for (const entity of entities.values()) {
      const { state, kind } = entity, definition = profile.entityKinds[kind];
      switch (definition.form) {
        case 'structure':
        case 'matter-unit': {
          shape(state, definition.form === 'structure' ? ['children'] : ['children', 'optional', 'presence'], `${kind} state`);
          list(state.children, 'children');
          if (definition.form === 'matter-unit') {
            check(typeof state.optional === 'boolean' && profile.presenceStates.includes(state.presence), 'PRESENCE', 'explicit optional and presence required');
            check(state.presence !== 'omitted' || state.optional, 'PRESENCE', 'required matter cannot be omitted');
            check(state.presence === 'present' || state.children.length === 0, 'PRESENCE_CONTENT', 'nonpresent matter has represented content');
          }
          state.children.forEach(id => own(entity, id, definition.children));
          break;
        }
        case 'text': {
          shape(state, ['text', 'spans'], `${kind} state`);
          const boundaries = graphemeBoundaries(state.text);
          let previousEnd = 0;
          for (const span of list(state.spans, 'spans')) {
            shape(span, ['id', 'start', 'end'], 'span');
            check(Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) && span.start >= previousEnd && span.end > span.start && span.end <= state.text.length, 'SPAN_RANGE', entity.id);
            check(boundaries.has(span.start) && boundaries.has(span.end), 'GRAPHEME_BOUNDARY', entity.id);
            const child = own(entity, span.id, definition.children);
            check(child.state.text === state.text.slice(span.start, span.end), 'SPAN_TEXT', span.id);
            previousEnd = span.end;
          }
          break;
        }
        case 'grapheme':
          shape(state, ['text'], 'grapheme state');
          check(graphemeBoundaries(state.text).size === 2, 'GRAPHEME_COUNT', 'exactly one grapheme cluster required');
          break;
        case 'block':
          shape(state, ['format', 'text'], 'generic block state');
          check(typeof state.format === 'string' && state.format.length > 0 && typeof state.text === 'string', 'BLOCK', 'explicit format and inscription required');
          break;
        case 'projection': {
          shape(state, ['members'], 'ReadingPage state');
          const seen = new Set();
          for (const id of list(state.members, 'members')) {
            check(!seen.has(id), 'PROJECTION_DUPLICATE', id);
            seen.add(id);
            check(!['projection', 'basis', 'relation'].includes(profile.entityKinds[resolve(id).kind].form), 'PROJECTION_KIND', id);
          }
          break;
        }
        case 'basis':
          shape(state, ['anchor', 'description'], 'PresentationBasis state');
          resolve(state.anchor);
          check(typeof state.description === 'string', 'PRESENTATION', 'description required');
          break;
        case 'relation':
          shape(state, ['basis', 'target', 'description'], 'PresentationRelation state');
          check(resolve(state.basis).kind === 'PresentationBasis', 'PRESENTATION', 'basis kind');
          resolve(state.target);
          check(typeof state.description === 'string', 'PRESENTATION', 'description required');
          break;
        default: fail('ENTITY_KIND', kind);
      }
    }
    const active = new Set(), complete = new Set();
    function visit(id) {
      check(!active.has(id), 'CONTAINMENT_CYCLE', id);
      if (complete.has(id)) return;
      active.add(id);
      (edges.get(id) ?? []).forEach(visit);
      active.delete(id); complete.add(id);
    }
    entities.forEach((_entity, id) => visit(id));
    const routes = new Set();
    for (const route of list(snapshot.routes, 'routes')) {
      shape(route, ['path', 'target'], 'route');
      check(typeof route.path === 'string' && route.path.startsWith('/') && !routes.has(route.path), 'ROUTE', 'unique route path required');
      routes.add(route.path); resolve(route.target);
    }
    for (const annotation of list(snapshot.annotations, 'annotations')) {
      shape(annotation, ['kind', 'target', 'value'], 'annotation');
      check(profile.annotationKinds.includes(annotation.kind), 'ANNOTATION', 'unknown annotation kind');
      endpoint(annotation.target);
      check(resolve(annotation.target.id).version === annotation.target.version, 'ANNOTATION_VERSION', 'annotation must target represented exact state');
      canonical(annotation.value);
    }
    list(snapshot.lineage, 'lineage');
  }
  for (const snapshot of bundle.snapshots) for (const relation of snapshot.lineage) {
    shape(relation, ['kind', 'beforeSnapshot', 'afterSnapshot', 'from', 'to'], 'lineage descriptor');
    check(profile.lineageKinds.includes(relation.kind), 'LINEAGE', 'unknown lineage kind');
    check(['revise', 'move'].includes(relation.kind), 'LINEAGE_UNIMPLEMENTED', 'split/join/replace/retire semantics reserved for #368');
    const from = list(relation.from, 'lineage from'), to = list(relation.to, 'lineage to');
    for (const point of [...from, ...to]) check(records.has(endpoint(point)), 'LINEAGE_ENDPOINT', 'unknown exact state');
    const beforeIndex = bundle.snapshots.findIndex(item => item.name === relation.beforeSnapshot);
    const afterIndex = bundle.snapshots.findIndex(item => item.name === relation.afterSnapshot);
    check(beforeIndex >= 0 && beforeIndex < afterIndex && relation.afterSnapshot === snapshot.name, 'LINEAGE_CONTEXT', 'descriptor must cite earlier and current snapshots');
    for (const [points, index] of [[from, beforeIndex], [to, afterIndex]]) {
      const represented = new Set(bundle.snapshots[index].entities.map(endpointKey));
      check(points.every(point => represented.has(endpointKey(point))), 'LINEAGE_CONTEXT', 'endpoint missing from cited snapshot');
    }
    check(new Set(from.map(endpointKey)).size === from.length && new Set(to.map(endpointKey)).size === to.length, 'LINEAGE', 'duplicate endpoint');
    check(from.length === 1 && to.length === 1, 'LINEAGE', 'invalid endpoint arity');
    check(from[0].id === to[0].id, 'LINEAGE', 'ordinary revision/move preserves identity');
    check(relation.kind !== 'revise' || from[0].version !== to[0].version, 'LINEAGE', 'revision changes exact state');
    if (relation.kind === 'move') {
      check(from[0].version === to[0].version, 'LINEAGE', 'fixture move preserves exact local state; record revision separately');
      const before = ownershipSlot(bundle.snapshots[beforeIndex], from[0].id);
      const after = ownershipSlot(bundle.snapshots[afterIndex], to[0].id);
      check(canonical(before) !== canonical(after), 'LINEAGE_MOVE', 'owning parent or sequence slot must change');
    }
  }
  return { snapshots: bundle.snapshots.length, exactStates: records.size, unicode: process.versions.unicode, node: process.versions.node, icu: process.versions.icu };
}

// Fixture-only mutation recipes, never manuscript/editor operations.
export function hostileBundle(examples, recipe) {
  const bundle = structuredClone(examples);
  for (const edit of recipe.edits) {
    let target = bundle;
    for (const key of edit.path.slice(0, -1)) target = target[key];
    target[edit.path.at(-1)] = structuredClone(edit.value);
  }
  if (recipe.reseal) for (const snapshot of bundle.snapshots) snapshot.entities = snapshot.entities.map(seal);
  return bundle;
}
export function validateHostile(examples, hostile) {
  shape(hostile, ['model', 'cases'], 'hostile fixture');
  check(hostile.model === profile.model, 'MODEL', 'unknown hostile model');
  for (const recipe of hostile.cases) {
    let caught;
    try { validateBundle(hostileBundle(examples, recipe)); } catch (error) { caught = error; }
    check(caught?.code === recipe.error, 'HOSTILE_EXPECTATION', `${recipe.name}: expected ${recipe.error}, got ${caught?.code ?? 'success'}`);
  }
  return hostile.cases.length;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    check(process.argv.length === 2, 'USAGE', 'run node scripts/literary_model.mjs (read-only committed fixtures)');
    const read = name => JSON.parse(readFileSync(fileURLToPath(new URL(`../planning/literary-model/${name}.json`, import.meta.url)), 'utf8'));
    const examples = read('examples');
    const result = validateBundle(examples);
    const hostile = validateHostile(examples, read('hostile'));
    process.stdout.write(`Literary model ${profile.model}: ${result.snapshots} snapshots, ${result.exactStates} exact states, ${hostile} hostile fixtures rejected; Node ${result.node}, ICU ${result.icu}, Unicode ${result.unicode}.\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
