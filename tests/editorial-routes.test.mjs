import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAssembly } from '../scripts/editorial_pages.mjs';
import { buildEditorialRouteProjection } from '../scripts/editorial_routes.mjs';
import { seal } from '../scripts/literary_model.mjs';
import { formatEntityRoute, parseRouteAddress, resolveRouteAddress } from '../reader/src/routes.mjs';

// The current authorized assembly is loaded once. Mutations below change only
// cloned metadata or synthetic inscription, never source files or admission.
const assembly = loadAssembly();
const bindings = JSON.parse(readFileSync(new URL('../planning/routes/bindings.json', import.meta.url), 'utf8'));
const catalog = buildEditorialRouteProjection({ assembly, bindings });
const entity = (graph, id) => graph.entityRecords.find(row => row.id === id);
const target = (projection, id) => projection.targets.find(row => row.id === id);
const route = row => formatEntityRoute({ id: row.id, kind: row.kind });
const paragraph = catalog.targets.find(row => row.kind === 'Paragraph' && row.access === 'available');
const paragraphPage = entity(assembly, paragraph.pageIds[0]);
const paragraphSlot = assembly.inventory.slots.find(row => row.entityId === paragraph.slotIds[0]);
const project = graph => buildEditorialRouteProjection({ assembly: graph, bindings });
const cloned = () => structuredClone(assembly);
const denyRead = (object, key) => Object.defineProperty(object, key, {
  configurable: true, enumerable: true, get() { throw new Error(`Forbidden read: ${key}`); },
});

test('all existing literary and page IDs remain addressable without allocation', () => {
  const expected = [...assembly.entityRecords, ...assembly.unmaterializedEntities].map(row => row.id).sort();
  assert.equal(expected.length, 607);
  assert.deepEqual(catalog.targets.map(row => row.id).sort(), expected);
  assert.equal(catalog.slots.length, 45);
  assert.equal(catalog.targets.filter(row => row.kind === 'ReadingPage').length, 74);
  assert.equal(catalog.targets.filter(row => row.kind === 'Paragraph').length, 471);
  assert.deepEqual(project(assembly), catalog, 'derivation is deterministic');
});

test('/huey selects the pending first page without skipping to admitted prose', () => {
  const result = resolveRouteAddress('/huey', catalog);
  assert.equal(result.entityId, assembly.frontMatter.entryPageId);
  assert.equal(result.entityId, assembly.readingOrder[0]);
  assert.equal(result.kind, 'ReadingPage');
  assert.equal(result.status, 'unavailable');
  assert.equal(result.canonicalPath, '/huey');
  assert.equal(result.redirectTo, null);
  assert.equal(result.entityVersion, null);
  assert.deepEqual(result.slots.map(row => row.presence), ['pending']);
  assert.ok(result.slots.every(row => row.observedReaderAdmission === 'not-listed'));
  assert.notEqual(result.entityId, paragraphPage.id);
});

test('all fifteen front-matter units and their page aliases survive pending access', () => {
  const slots = catalog.slots.filter(row => row.group === 'front');
  assert.equal(slots.length, 15);
  assert.deepEqual(slots.map(row => row.id), assembly.frontMatter.matterUnits.map(row => row.entityId));
  for (const slot of slots) {
    const item = target(catalog, slot.id);
    assert.equal(item.kind, 'MatterUnit');
    assert.equal(slot.presence, 'pending');
    assert.equal(item.pageIds.length, 1);
    assert.ok(assembly.readingOrder.slice(0, 15).includes(item.pageIds[0]));
    assert.equal(resolveRouteAddress(route(item), catalog).entityId, slot.id);
  }
});

test('fixed aliases bind known literary kinds and pages separately', () => {
  assert.equal(bindings.aliases.length, 90);
  assert.deepEqual(catalog.aliases, bindings.aliases);
  for (const alias of bindings.aliases) {
    const parsed = parseRouteAddress(alias.path);
    const item = target(catalog, alias.targetId);
    const result = resolveRouteAddress(alias.path, catalog);
    assert.equal(parsed.kind, 'alias');
    assert.equal(result.entityId, item.id);
    assert.equal(result.kind, item.kind);
    assert.equal(result.redirectTo, route(item));
    if (parsed.family === 'page') assert.equal(item.kind, 'ReadingPage');
    else if (['front', 'back'].includes(parsed.family)) assert.equal(item.kind, 'MatterUnit');
    else assert.equal(item.kind, 'Chapter');
  }
  const chapter = resolveRouteAddress('/huey/chapter/c08a', catalog);
  const page = resolveRouteAddress('/huey/page/c08a', catalog);
  assert.equal(chapter.kind, 'Chapter');
  assert.equal(page.kind, 'ReadingPage');
  assert.notEqual(chapter.entityId, page.entityId);
});

test('page and paragraph canonical addresses retain their distinct kinds', () => {
  const page = target(catalog, paragraphPage.id);
  for (const item of [page, paragraph]) {
    const address = route(item);
    const result = resolveRouteAddress(address, catalog);
    assert.equal(result.status, 'resolved');
    assert.equal(result.entityId, item.id);
    assert.equal(result.kind, item.kind);
    assert.equal(result.entityVersion, item.version);
    assert.equal(result.redirectTo, null);
  }
  assert.equal(resolveRouteAddress(`/huey/page/${paragraph.id}`, catalog).status, 'unknown');
  assert.equal(resolveRouteAddress(`/huey/paragraph/${page.id}`, catalog).status, 'unknown');
});

test('unplaced entities and paragraphs remain addressable outside canonical order', () => {
  const slot = catalog.slots.find(row => row.group === 'unplaced');
  const item = target(catalog, slot.id);
  assert.ok(item.pageIds.length > 0);
  assert.deepEqual(item.pageIds, assembly.workspace.unplacedPages);
  assert.ok(item.pageIds.every(id => !assembly.readingOrder.includes(id)));
  const result = resolveRouteAddress('/huey/unplaced/place-beneath-pain', catalog);
  assert.equal(result.entityId, slot.id);
  assert.equal(result.status, 'resolved');
  const child = catalog.targets.find(row => row.kind === 'Paragraph' && row.slotIds.includes(slot.id));
  assert.equal(resolveRouteAddress(route(child), catalog).entityId, child.id);
  assert.ok(child.pageIds.every(id => assembly.workspace.unplacedPages.includes(id)));
});

test('labels, paths, and explicit reading order changes cannot regenerate aliases or IDs', () => {
  const changed = cloned();
  for (const slot of changed.inventory.slots) {
    slot.label = 'Synthetic renamed title';
    slot.canonicalPath = 'manuscript/synthetic-renamed.md';
  }
  // Keep the entry fixed while swapping two pages already in the Body segment.
  [changed.readingOrder[15], changed.readingOrder[16]] = [changed.readingOrder[16], changed.readingOrder[15]];
  const after = project(changed);
  assert.deepEqual(after.aliases, catalog.aliases);
  assert.deepEqual(after.targets.map(row => row.id), catalog.targets.map(row => row.id));
  for (const alias of bindings.aliases) {
    assert.equal(resolveRouteAddress(alias.path, after).entityId, alias.targetId);
    assert.equal(resolveRouteAddress(alias.path, after).canonicalPath,
      resolveRouteAddress(alias.path, catalog).canonicalPath);
  }
  assert.equal(resolveRouteAddress('/huey/chapter/synthetic-renamed-title', after).status, 'unknown');
});

test('adding a new alias preserves every old binding; removing or retargeting one fails', () => {
  const next = structuredClone(bindings);
  next.aliases.push({ path: '/huey/chapter/synthetic-new-label', targetId: paragraphSlot.entityId });
  const after = buildEditorialRouteProjection({ assembly, bindings: next, previousBindings: bindings });
  assert.equal(resolveRouteAddress('/huey/chapter/synthetic-new-label', after).entityId, paragraphSlot.entityId);
  const removed = structuredClone(bindings);
  removed.aliases.shift();
  assert.throws(() => buildEditorialRouteProjection({ assembly, bindings: removed, previousBindings: bindings }), /alias removed or retargeted/);
  const retargeted = structuredClone(bindings);
  retargeted.aliases[0].targetId = retargeted.aliases[2].targetId;
  assert.throws(() => buildEditorialRouteProjection({ assembly, bindings: retargeted, previousBindings: bindings }), /alias removed or retargeted/);
});

test('editorial existence is independent of publication labels and reader admission', () => {
  const changed = cloned();
  for (const slot of changed.inventory.slots) {
    slot.publicationAnnotation = { label: 'held', authoritative: false };
    slot.observedReaderAdmission = 'unavailable';
  }
  const after = project(changed);
  assert.deepEqual(after.targets, catalog.targets);
  assert.deepEqual(after.aliases, catalog.aliases);
  assert.equal(resolveRouteAddress(route(paragraph), after).status, 'resolved');
  assert.equal(resolveRouteAddress('/huey', after).entityId, catalog.entryPageId);
  assert.ok(after.slots.every(row => row.publicationAnnotation.label === 'held' && row.observedReaderAdmission === 'unavailable'));
});

test('projection does not read or emit inscriptions, source maps, provenance, or locators', () => {
  const changed = cloned();
  denyRead(changed, 'sourceMappings');
  denyRead(changed.inventory, 'sources');
  denyRead(changed.workspace, 'sourceRefs');
  for (const row of changed.entityRecords) {
    if (Object.hasOwn(row.state, 'text')) denyRead(row.state, 'text');
  }
  for (const slot of changed.inventory.slots) {
    for (const key of ['label', 'canonicalPath', 'sources', 'issues', 'omissionRef']) denyRead(slot, key);
  }
  const after = project(changed);
  assert.deepEqual(after, catalog);
  const forbidden = new Set(['text', 'state', 'sourceMappings', 'sourceKey', 'sourceRefs', 'sources',
    'canonicalPath', 'path', 'blob', 'revision', 'scopeRefs', 'issues', 'omissionRef', 'label']);
  const inspect = (value, parent = '') => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      // Alias paths are public addresses, and annotation labels are expressly
      // non-authoritative metadata. Neither is a source path or title.
      if (!(key === 'path' && parent === 'aliases') && !(key === 'label' && parent === 'publicationAnnotation')) {
        assert.ok(!forbidden.has(key), `excluded field ${key}`);
      }
      inspect(child, Array.isArray(value) ? parent : key);
    }
  };
  inspect(after);
});

for (const [access, status] of [['restricted', 'restricted'], ['unavailable-on-this-client', 'unavailable']]) {
  test(`an unavailable paragraph retains identity without inscription or invented version: ${access}`, () => {
    const changed = cloned();
    changed.entityRecords = changed.entityRecords.filter(row => row.id !== paragraph.id);
    changed.unmaterializedEntities.push({ id: paragraph.id, kind: 'Paragraph',
      sourceKey: 'synthetic-unavailable-source', access, entityVersion: null });
    const after = project(changed);
    const item = target(after, paragraph.id);
    assert.equal(item.version, null);
    assert.equal(item.access, access);
    assert.deepEqual(item.pageIds, paragraph.pageIds);
    const result = resolveRouteAddress(route(paragraph), after);
    assert.equal(result.status, status);
    assert.equal(result.entityId, paragraph.id);
    assert.equal(result.entityVersion, null);
    assert.equal(resolveRouteAddress(formatEntityRoute({ ...paragraph, version: paragraph.version }), after).status, status);
    assert.equal(target(after, paragraphPage.id).version, null, 'page carrying inaccessible text exposes no exact version');
    assert.equal(after.targets.length, catalog.targets.length);
  });
}

test('a paragraph projected on two pages returns both candidates without choosing one', () => {
  const changed = cloned();
  const secondPage = changed.entityRecords.find(row => row.kind === 'ReadingPage'
    && row.id !== paragraphPage.id && target(catalog, row.id).slotIds.includes(paragraphSlot.entityId));
  const replacement = seal({ id: secondPage.id, kind: 'ReadingPage',
    state: { members: [...secondPage.state.members, paragraph.id] } });
  changed.entityRecords[changed.entityRecords.indexOf(secondPage)] = replacement;
  const after = project(changed);
  const result = resolveRouteAddress(route(paragraph), after);
  assert.equal(result.status, 'resolved');
  assert.deepEqual(result.pageIds, [paragraphPage.id, secondPage.id]);
  assert.equal(result.canonicalPath, route(paragraph));
  assert.equal(result.redirectTo, null);
  assert.equal(Object.hasOwn(result, 'pageId'), false);
  assert.equal(result.entityVersion, paragraph.version);
});

test('exact version addresses resolve only the selected state and never fall back', () => {
  const exact = formatEntityRoute({ ...paragraph, version: paragraph.version });
  assert.equal(resolveRouteAddress(exact, catalog).status, 'resolved');
  const changed = cloned();
  const current = entity(changed, paragraph.id);
  const revised = seal({ id: current.id, kind: 'Paragraph', state: { text: 'Synthetic revised inscription.', spans: [] } });
  changed.entityRecords[changed.entityRecords.indexOf(current)] = revised;
  const after = project(changed);
  const old = resolveRouteAddress(exact, after);
  assert.equal(old.status, 'version-unavailable');
  assert.equal(old.requestedVersion, paragraph.version);
  assert.equal(old.entityVersion, null);
  assert.equal(old.redirectTo, null);
  assert.equal(old.canonicalPath, exact);
  assert.equal(resolveRouteAddress(route(paragraph), after).entityVersion, revised.version);
  assert.equal(resolveRouteAddress(formatEntityRoute(revised), after).entityVersion, revised.version);
});

test('adapter rejects an entry that bypasses the front-first contract', () => {
  const changed = cloned();
  changed.frontMatter.entryPageId = paragraphPage.id;
  assert.throws(() => project(changed), /expected checked front-first assembly/);
});

test('adapter rejects repeated stable IDs rather than collapsing records', () => {
  const changed = cloned();
  changed.entityRecords.push(structuredClone(changed.entityRecords[0]));
  assert.throws(() => project(changed), /duplicate entity identities/);
});

test('adapter rejects ambiguous literary ownership independently of page projection', () => {
  const changed = cloned();
  const other = changed.entityRecords.find(row => row.kind === 'Chapter' && row.id !== paragraphSlot.entityId);
  other.state.children.push(paragraph.id);
  assert.throws(() => project(changed), /ambiguous or unknown ownership/);
});

test('adapter rejects unknown page members and duplicate page sequences', () => {
  const unknown = cloned();
  entity(unknown, paragraphPage.id).state.members.push('he_00000000-0000-4000-8000-999999999999');
  assert.throws(() => project(unknown), /unknown page member/);
  const repeated = cloned();
  repeated.workspace.unplacedPages.push(repeated.readingOrder[0]);
  assert.throws(() => project(repeated), /duplicate page sequence/);
});
