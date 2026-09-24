import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadInventory, gitBlob, safePath } from './editorial_inventory.mjs';
import { parseEditorialMarkdown } from './editorial_markdown.mjs';
import { buildFrontMatter } from './editorial_front_matter.mjs';
import { profile, seal, validateBundle } from './literary_model.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_PATH = 'planning/editorial-pages/plan.json';
const SCHEMA = 'huey.editorial-pages.v1';
const PARSER = 'huey.editorial-markdown/1';
const ID = new RegExp(profile.entityID);
const fail = message => { throw new Error(`EDITORIAL_PAGES: ${message}`); };
const requireThat = (condition, message) => { if (!condition) fail(message); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unique = items => new Set(items).size === items.length;
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function shape(value, fields, label) {
  requireThat(plain(value) && equal(Object.keys(value).sort(), [...fields].sort()), `invalid ${label} fields`);
}

function context(inventory) {
  requireThat(inventory?.schema === 'huey.editorial-inventory.v1', 'expected checked editorial inventory');
  requireThat(Array.isArray(inventory.slots) && Array.isArray(inventory.sources) && Array.isArray(inventory.ownership), 'missing inventory structure');
  const slots = new Map(inventory.slots.map(slot => [slot.key, slot]));
  const sources = new Map(inventory.sources.map(source => [source.key, source]));
  requireThat(slots.size === inventory.slots.length && sources.size === inventory.sources.length, 'duplicate inventory keys');
  const ids = [...inventory.ownership.map(entity => entity.entityId), ...inventory.slots.map(slot => slot.entityId)];
  requireThat(ids.every(id => typeof id === 'string' && ID.test(id)) && unique(ids), 'invalid inventory identities');
  requireThat(inventory.slots.every(slot => ['structure', 'matter-unit'].includes(profile.entityKinds[slot.kind]?.form)), 'inventory slot must be a literary container');
  // Check ownership even when selected source text cannot materialize. This
  // inventory-only skeleton is a validation input, never a substitute text state.
  validateBundle({ model: profile.model, snapshots: [{ name: 'inventory-ownership', routes: [], annotations: [], lineage: [], entities: [
    ...inventory.ownership.map(entity => seal({ id: entity.entityId, kind: entity.kind, state: { children: entity.children } })),
    ...inventory.slots.map(slot => seal({ id: slot.entityId, kind: slot.kind, state: slot.kind === 'MatterUnit'
      ? { children: [], optional: slot.optional, presence: slot.presence } : { children: [] } })),
  ] }] });
  const selected = inventory.sources.filter(source => ['canonical', 'unplaced'].includes(source.role));
  const bySlot = new Map();
  for (const source of selected) {
    requireThat(source.targets.length === 1 && slots.has(source.targets[0]), 'source must select one known slot');
    const slot = slots.get(source.targets[0]);
    requireThat(!bySlot.has(slot.key) && slot.sources.includes(source.key), 'ambiguous selected source');
    requireThat(slot.canonicalPath === source.path && slot.presence === 'present', 'selected source is not present working manuscript');
    requireThat(source.role === 'unplaced' ? slot.group === 'unplaced' : slot.group === 'book', 'source role differs from placement');
    bySlot.set(slot.key, source);
  }
  return { slots, sources, ids, selected, bySlot };
}

function available(source, slot) {
  return source.access === 'available' && slot.access === 'available' && slot.canonicalState === 'present-content';
}

function parseSource(source, sourceTexts) {
  requireThat(Object.hasOwn(sourceTexts, source.key), `selected source text missing: ${source.key}`);
  const text = sourceTexts[source.key];
  requireThat(typeof text === 'string' && text.isWellFormed() && gitBlob(text) === source.blob, `source bytes changed; reconcile explicitly: ${source.key}`);
  const blocks = parseEditorialMarkdown(text);
  requireThat(blocks.some(block => block.kind === 'Paragraph'), `selected manuscript has no supported paragraphs: ${source.key}`);
  return { text, blocks };
}

/** Initial allocation only. Normal builds never invoke this function. */
export function createPlan({ inventory, sourceTexts, allocateId = () => `he_${randomUUID()}`, maxBlocks = 16 }) {
  const c = context(inventory);
  requireThat(Number.isSafeInteger(maxBlocks) && maxBlocks > 0 && maxBlocks <= 64, 'invalid initial block limit');
  const used = new Set(c.ids);
  const allocate = () => {
    const id = allocateId();
    requireThat(typeof id === 'string' && ID.test(id) && !used.has(id), 'allocator returned invalid or duplicate identity');
    used.add(id);
    return id;
  };
  const sources = c.selected.map(source => {
    requireThat(available(source, c.slots.get(source.targets[0])), `cannot initially partition unavailable source: ${source.key}`);
    const { blocks } = parseSource(source, sourceTexts);
    return { sourceKey: source.key, revision: source.revision, path: source.path, blob: source.blob,
      blocks: blocks.map(block => ({ id: allocate(), kind: block.kind, start: block.source.start, end: block.source.end })) };
  });
  const pages = [], readingOrder = [], unplacedOrder = [];
  for (const slot of inventory.slots) {
    const selected = c.bySlot.get(slot.key);
    const members = selected ? sources.find(source => source.sourceKey === selected.key).blocks.map(block => block.id) : [slot.entityId];
    for (let offset = 0; offset < members.length; offset += maxBlocks) {
      const page = { id: allocate(), slot: slot.key, members: members.slice(offset, offset + maxBlocks) };
      pages.push(page);
      (slot.group === 'unplaced' ? unplacedOrder : readingOrder).push(page.id);
    }
  }
  const plan = { schema: SCHEMA, parser: PARSER, initialPartition: { maxBlocks }, sources, pages, readingOrder, unplacedOrder };
  buildAssembly({ inventory, plan, sourceTexts });
  return plan;
}

function checkPlan(plan, inventory, c) {
  shape(plan, ['schema', 'parser', 'initialPartition', 'sources', 'pages', 'readingOrder', 'unplacedOrder'], 'plan');
  requireThat(plan.schema === SCHEMA && plan.parser === PARSER, 'unsupported plan or parser');
  shape(plan.initialPartition, ['maxBlocks'], 'initial partition');
  requireThat(Number.isSafeInteger(plan.initialPartition.maxBlocks) && plan.initialPartition.maxBlocks > 0 && plan.initialPartition.maxBlocks <= 64, 'invalid initial partition');
  for (const field of ['sources', 'pages', 'readingOrder', 'unplacedOrder']) requireThat(Array.isArray(plan[field]), `invalid ${field}`);
  requireThat(unique(plan.sources.map(source => source.sourceKey)) && equal(plan.sources.map(source => source.sourceKey).sort(), c.selected.map(source => source.key).sort()), 'plan must account for every selected working source');
  const used = new Set(c.ids), blockBySlot = new Map();
  const register = id => {
    requireThat(typeof id === 'string' && ID.test(id) && !used.has(id), 'duplicate or malformed stable identity');
    used.add(id);
  };
  for (const sourcePlan of plan.sources) {
    shape(sourcePlan, ['sourceKey', 'revision', 'path', 'blob', 'blocks'], 'source plan');
    const source = c.sources.get(sourcePlan.sourceKey);
    requireThat(['revision', 'path', 'blob'].every(field => sourcePlan[field] === source[field]), `source pin drift: ${source.key}`);
    requireThat(Array.isArray(sourcePlan.blocks) && sourcePlan.blocks.length > 0, 'empty source block plan');
    let previousEnd = 0;
    for (const block of sourcePlan.blocks) {
      shape(block, ['id', 'kind', 'start', 'end'], 'block mapping');
      register(block.id);
      requireThat(['Block', 'Paragraph'].includes(block.kind), 'unsupported block kind');
      requireThat(Number.isSafeInteger(block.start) && Number.isSafeInteger(block.end) && block.start >= previousEnd && block.end > block.start, 'overlapping or malformed source range');
      previousEnd = block.end;
    }
    blockBySlot.set(source.targets[0], sourcePlan.blocks.map(block => block.id));
  }
  const pages = new Map();
  for (const page of plan.pages) {
    shape(page, ['id', 'slot', 'members'], 'page');
    register(page.id);
    requireThat(c.slots.has(page.slot), 'page names unknown slot');
    requireThat(Array.isArray(page.members) && page.members.length > 0 && unique(page.members), 'empty or repeated page membership');
    pages.set(page.id, page);
  }
  const ordered = [...plan.readingOrder, ...plan.unplacedOrder];
  requireThat(ordered.length === pages.size && unique(ordered) && ordered.every(id => pages.has(id)), 'page sequence omits or duplicates pages');
  const expected = inventory.slots.map(slot => slot.key);
  const actual = [];
  for (const [order, unplaced] of [[plan.readingOrder, false], [plan.unplacedOrder, true]]) {
    for (const id of order) {
      const page = pages.get(id);
      requireThat((c.slots.get(page.slot).group === 'unplaced') === unplaced, 'unplaced page crosses literary reading order');
      if (actual.at(-1) !== page.slot) actual.push(page.slot);
    }
  }
  requireThat(equal(actual, expected), 'page sequence must retain complete inventory slot order');
  for (const slot of inventory.slots) {
    const members = ordered.flatMap(id => pages.get(id).slot === slot.key ? pages.get(id).members : []);
    requireThat(equal(members, blockBySlot.get(slot.key) ?? [slot.entityId]), `page coverage differs from literary source order: ${slot.key}`);
  }
  return blockBySlot;
}

/** Read-only derived materialization. Page boundaries and identities come from plan. */
export function buildAssembly({ inventory, plan, sourceTexts }) {
  const c = context(inventory);
  requireThat(plain(sourceTexts), 'missing source text map');
  const blockBySlot = checkPlan(plan, inventory, c);
  const entityRecords = inventory.ownership.map(entity => seal({ id: entity.entityId, kind: entity.kind, state: { children: [...entity.children] } }));
  for (const slot of inventory.slots) {
    const state = { children: blockBySlot.get(slot.key) ?? [] };
    if (slot.kind === 'MatterUnit') Object.assign(state, { optional: slot.optional, presence: slot.presence });
    entityRecords.push(seal({ id: slot.entityId, kind: slot.kind, state }));
  }
  const sourceMappings = [], unmaterializedEntities = [];
  for (const sourcePlan of plan.sources) {
    const source = c.sources.get(sourcePlan.sourceKey), slot = c.slots.get(source.targets[0]);
    if (!available(source, slot)) {
      // Do not even inspect the supplied text value on denied/unavailable paths.
      for (const block of sourcePlan.blocks) unmaterializedEntities.push({ id: block.id, kind: block.kind, sourceKey: source.key,
        access: source.access !== 'available' ? source.access : slot.access !== 'available' ? slot.access : 'unavailable-on-this-client', entityVersion: null });
      continue;
    }
    const { text, blocks } = parseSource(source, sourceTexts);
    requireThat(blocks.length === sourcePlan.blocks.length, `block count changed; reconcile explicitly: ${source.key}`);
    blocks.forEach((block, index) => {
      const mapping = sourcePlan.blocks[index];
      requireThat(mapping.kind === block.kind && mapping.start === block.source.start && mapping.end === block.source.end, `source mapping drift; reconcile explicitly: ${source.key}`);
      const entity = seal({ id: mapping.id, kind: block.kind, state: block.state });
      entityRecords.push(entity);
      const { start, end, startLine, endLine } = block.source;
      sourceMappings.push({ entityId: entity.id, entityVersion: entity.version, sourceKey: source.key,
        revision: source.revision, path: source.path, blob: source.blob,
        utf16: { start, end }, utf8: { start: Buffer.byteLength(text.slice(0, start)), end: Buffer.byteLength(text.slice(0, end)) },
        lines: { start: startLine, end: endLine }, fidelity: 'exact-supported-profile',
        inscriptionSegments: block.mapping ?? [], presentation: block.presentation ?? [] });
    });
  }
  for (const page of plan.pages) entityRecords.push(seal({ id: page.id, kind: 'ReadingPage', state: { members: [...page.members] } }));
  const modelValidation = unmaterializedEntities.length ? 'deferred-unavailable-source' : 'validated-snapshot';
  if (!unmaterializedEntities.length) validateBundle({ model: profile.model, snapshots: [
    { name: 'editorial-assembly', entities: entityRecords, routes: [], annotations: [], lineage: [] },
  ] });
  const assembly = {
    schema: 'huey.editorial-assembly.v1', model: profile.model, parser: PARSER,
    representation: 'derived-from-authorized-markdown; not a prose master or publication decision',
    modelValidation, inventory, entityRecords, unmaterializedEntities, sourceMappings,
    readingOrder: [...plan.readingOrder],
    workspace: { unplacedPages: [...plan.unplacedOrder], sourceRefs: inventory.sources.filter(source => !c.selected.includes(source))
      .map(source => ({ sourceKey: source.key, role: source.role, targets: source.targets, access: source.access, materialization: 'reference-only; ingestion-deferred' })) },
  };
  return { ...assembly, frontMatter: buildFrontMatter(assembly) };
}

function workingTexts(root, inventory) {
  const c = context(inventory), texts = {};
  for (const source of c.selected) {
    if (!available(source, c.slots.get(source.targets[0]))) continue;
    requireThat(safePath(source.path) && source.path.startsWith('manuscript/'), 'selected source outside manuscript');
    const path = resolve(root, source.path);
    requireThat(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink(), 'selected source is not regular file');
    const rel = relative(realpathSync(root), realpathSync(path));
    requireThat(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'selected source escapes checkout');
    texts[source.key] = readFileSync(path, 'utf8');
  }
  return texts;
}

export function loadAssembly(root = ROOT) {
  const inventory = loadInventory(root);
  const plan = JSON.parse(readFileSync(resolve(root, PLAN_PATH), 'utf8'));
  return buildAssembly({ inventory, plan, sourceTexts: workingTexts(root, inventory) });
}

export function serializePlan(plan) {
  // One identity/range or page membership per line keeps the prose-free sidecar reviewable.
  const sources = plan.sources.map(source => `    {"sourceKey":${JSON.stringify(source.sourceKey)},"revision":${JSON.stringify(source.revision)},"path":${JSON.stringify(source.path)},"blob":${JSON.stringify(source.blob)},"blocks":[\n${source.blocks.map(block => `      ${JSON.stringify(block)}`).join(',\n')}\n    ]}`).join(',\n');
  return `{\n  "schema":${JSON.stringify(plan.schema)},\n  "parser":${JSON.stringify(plan.parser)},\n  "initialPartition":${JSON.stringify(plan.initialPartition)},\n  "sources":[\n${sources}\n  ],\n  "pages":[\n${plan.pages.map(page => `    ${JSON.stringify(page)}`).join(',\n')}\n  ],\n  "readingOrder":${JSON.stringify(plan.readingOrder)},\n  "unplacedOrder":${JSON.stringify(plan.unplacedOrder)}\n}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2] ?? 'check';
    requireThat(['check', 'emit', 'init'].includes(command) && process.argv.length <= 3, 'usage: node scripts/editorial_pages.mjs [check|emit|init]');
    if (command === 'init') {
      const inventory = loadInventory();
      const plan = createPlan({ inventory, sourceTexts: workingTexts(ROOT, inventory) });
      writeFileSync(resolve(ROOT, PLAN_PATH), serializePlan(plan), { flag: 'wx' });
      console.log('Initial page identity plan created; review it before committing. No manuscript changed.');
    } else {
      const assembly = loadAssembly();
      if (command === 'emit') process.stdout.write(`${JSON.stringify(assembly, null, 2)}\n`);
      else console.log(`Editorial pages checked: ${assembly.readingOrder.length} ordered pages (${assembly.frontMatter.pages.length} front pages); ${assembly.workspace.unplacedPages.length} unplaced pages; ${assembly.sourceMappings.length} materialized blocks; ${assembly.unmaterializedEntities.length} unavailable blocks; ${assembly.modelValidation}. Not complete manuscript or acceptance.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
