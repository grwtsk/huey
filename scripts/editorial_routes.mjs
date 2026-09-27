import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAssembly } from './editorial_pages.mjs';
import { validateRouteProjection, assertAliasContinuity } from '../reader/src/routes.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BINDINGS = 'planning/routes/bindings.json';
const requireThat = (condition, message) => { if (!condition) throw new Error(`EDITORIAL_ROUTES: ${message}`); };
function bindingAliases(bindings) {
  requireThat(bindings?.schema === 'huey.route-bindings.v1' && Array.isArray(bindings.aliases)
    && Object.keys(bindings).sort().join(',') === 'aliases,schema', 'invalid binding manifest');
  return bindings.aliases;
}

/** Derive navigation metadata from a checked assembly, not manuscript admission. */
export function buildEditorialRouteProjection({ assembly, bindings, previousBindings = null }) {
  requireThat(assembly?.schema === 'huey.editorial-assembly.v1'
    && assembly.frontMatter?.entryPageId === assembly.readingOrder[0], 'expected checked front-first assembly');
  const aliases = bindingAliases(bindings);
  if (previousBindings) assertAliasContinuity(bindingAliases(previousBindings), aliases);
  const records = new Map(assembly.entityRecords.map(entity => [entity.id, entity]));
  const unavailable = new Map(assembly.unmaterializedEntities.map(entity => [entity.id, entity]));
  requireThat(records.size === assembly.entityRecords.length && unavailable.size === assembly.unmaterializedEntities.length
    && [...unavailable.keys()].every(id => !records.has(id)), 'duplicate entity identities');
  const slotById = new Map(assembly.inventory.slots.map(slot => [slot.entityId, slot]));
  const parent = new Map(), children = new Map();
  for (const entity of records.values()) {
    // Never inspect inscription, mappings, title text or source provenance.
    const owned = entity.state.children ?? entity.state.spans?.map(span => span.id) ?? [];
    children.set(entity.id, owned);
    for (const child of owned) {
      requireThat(!parent.has(child) && (records.has(child) || unavailable.has(child)), 'ambiguous or unknown ownership');
      parent.set(child, entity.id);
    }
  }
  const ancestors = id => {
    const result = [], seen = new Set();
    while (id !== undefined) {
      requireThat(!seen.has(id), 'cyclic ownership');
      seen.add(id); result.push(id); id = parent.get(id);
    }
    return result;
  };
  const slotFor = id => ancestors(id).find(candidate => slotById.has(candidate));
  const pageIds = new Map([...records.keys(), ...unavailable.keys()].map(id => [id, new Set()]));
  const pageSlots = new Map(), pageMembers = new Map();
  const order = [...assembly.readingOrder, ...assembly.workspace.unplacedPages];
  requireThat(new Set(order).size === order.length, 'duplicate page sequence');
  for (const id of order) {
    const page = records.get(id);
    requireThat(page?.kind === 'ReadingPage', 'unknown page');
    const memberIds = new Set(), projectedSlots = new Set();
    const visit = member => {
      requireThat(pageIds.has(member), 'unknown page member');
      if (memberIds.has(member)) return;
      memberIds.add(member);
      for (const ancestor of ancestors(member)) pageIds.get(ancestor).add(id);
      const slot = slotFor(member);
      if (slot) projectedSlots.add(slot);
      for (const child of children.get(member) ?? []) visit(child);
    };
    page.state.members.forEach(visit);
    pageIds.get(id).add(id);
    pageSlots.set(id, [...projectedSlots]);
    pageMembers.set(id, [...memberIds]);
  }
  const accessFor = (ids, slots) => {
    const states = [...ids.map(id => unavailable.get(id)?.access), ...slots.map(id => slotById.get(id).access)];
    return states.includes('restricted') ? 'restricted'
      : states.includes('unavailable-on-this-client') ? 'unavailable-on-this-client' : 'available';
  };
  const targets = [...records.values(), ...unavailable.values()].map(entity => {
    const owner = slotFor(entity.id);
    const slots = entity.kind === 'ReadingPage' ? pageSlots.get(entity.id) : owner ? [owner] : [];
    requireThat(slots !== undefined, 'ReadingPage is outside the selected sequences');
    const access = accessFor(pageMembers.get(entity.id) ?? [entity.id], slots);
    return {
      id: entity.id, kind: entity.kind, version: access === 'available' ? entity.version ?? null : null,
      access, unresolved: slots.some(id => {
        const slot = slotById.get(id);
        return ['pending', 'absent'].includes(slot.presence) || slot.editorialMaterialization === 'placeholder';
      }),
      pageIds: [...pageIds.get(entity.id)], slotIds: slots,
    };
  });
  const slots = assembly.inventory.slots.map(slot => ({
    id: slot.entityId, group: slot.group, presence: slot.presence,
    editorialMaterialization: slot.editorialMaterialization, access: slot.access,
    publicationAnnotation: { ...slot.publicationAnnotation }, observedReaderAdmission: slot.observedReaderAdmission,
  }));
  return validateRouteProjection({ schema: 'huey.route-projection.v1', projection: 'editorial',
    entryPageId: assembly.frontMatter.entryPageId, targets, slots, aliases: aliases.map(alias => ({ ...alias })) });
}

function previousBindings(root, revision) {
  requireThat(/^[a-f0-9]{40}$/.test(revision), 'baseline must be an exact Git commit SHA');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' } });
  git(['cat-file', '-e', `${revision}^{commit}`]);
  if (!git(['ls-tree', revision, '--', BINDINGS]).trim()) return { schema: 'huey.route-bindings.v1', aliases: [] };
  return JSON.parse(git(['show', `${revision}:${BINDINGS}`]));
}

export function loadRouteProjection(root = ROOT, baselineRevision = null) {
  return buildEditorialRouteProjection({ assembly: loadAssembly(root),
    bindings: JSON.parse(readFileSync(resolve(root, BINDINGS), 'utf8')),
    previousBindings: baselineRevision ? previousBindings(root, baselineRevision) : null });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command = 'check', baseline] = process.argv.slice(2);
    requireThat(['check', 'emit'].includes(command) && process.argv.length <= 4
      && (command !== 'emit' || baseline === undefined), 'usage: node scripts/editorial_routes.mjs [check [base-sha]|emit]');
    const projection = loadRouteProjection(ROOT, baseline);
    if (command === 'emit') process.stdout.write(`${JSON.stringify(projection, null, 2)}\n`);
    else console.log(`Editorial route contract checked: ${projection.targets.length} targets; ${projection.aliases.length} fixed aliases. Alias baseline ${baseline ?? 'not supplied'}. No routing UI, publication admission or permission decision.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
