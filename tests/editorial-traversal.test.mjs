import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAssembly } from '../scripts/editorial_pages.mjs';
import { buildTraversalPayload, loadTraversalPayload } from '../scripts/editorial_traversal.mjs';
import { seal } from '../scripts/literary_model.mjs';

// Only already authorized repository manuscript is loaded. Hostile mutations
// below are synthetic in-memory derivatives; they do not change source files.
const assembly = loadAssembly();
const bindings = JSON.parse(readFileSync(new URL('../planning/routes/bindings.json', import.meta.url), 'utf8'));
const payload = buildTraversalPayload({ assembly, bindings });
const project = graph => buildTraversalPayload({ assembly: graph, bindings });
const cloned = () => structuredClone(assembly);
const entity = (graph, id) => graph.entityRecords.find(row => row.id === id);
const target = (projection, id) => projection.routes.targets.find(row => row.id === id);
const blocks = projection => projection.pages.flatMap(page => page.blocks);
const paragraph = payload.routes.targets.find(row => row.kind === 'Paragraph' && row.access === 'available');
const paragraphPage = entity(assembly, paragraph.pageIds[0]);
const paragraphSlot = assembly.inventory.slots.find(row => row.entityId === paragraph.slotIds[0]);
const denyRead = (object, key) => Object.defineProperty(object, key, {
  configurable: true, enumerable: true, get() { throw new Error(`Forbidden read: ${key}`); },
});

test('all 165 persisted pages remain in their 151-page book and 14-page unplaced sequences', () => {
  assert.equal(payload.schema, 'huey.editorial-traversal.v1');
  assert.deepEqual(payload.readingOrder, assembly.readingOrder);
  assert.deepEqual(payload.unplacedOrder, assembly.workspace.unplacedPages);
  assert.equal(payload.readingOrder.length, 151);
  assert.equal(payload.unplacedOrder.length, 14);
  assert.equal(payload.pages.length, 165);
  assert.deepEqual(payload.pages.map(page => page.id), [...payload.readingOrder, ...payload.unplacedOrder]);
  assert.ok(payload.unplacedOrder.every(id => !payload.readingOrder.includes(id)));
  assert.deepEqual(project(assembly), payload, 'derivation has no clock, allocator, or layout dependency');
  assert.deepEqual(loadTraversalPayload(), payload, 'loader selects the same checked inputs');
});

test('every known literary slot is visible, including all pending front matter at the beginning', () => {
  const projectedSlots = new Set(payload.pages.flatMap(page => target(payload, page.id).slotIds));
  assert.equal(projectedSlots.size, 47);
  assert.deepEqual([...projectedSlots].sort(), assembly.inventory.slots.map(slot => slot.entityId).sort());
  assert.equal(payload.routes.entryPageId, payload.readingOrder[0]);
  assert.equal(payload.routes.entryPageId, assembly.frontMatter.entryPageId);
  const front = payload.pages.slice(0, 15);
  assert.deepEqual(front.map(page => page.label), assembly.frontMatter.matterUnits.map(unit => unit.label));
  assert.ok(front.every(page => page.blocks.length === 0));
  assert.ok(front.every(page => target(payload, page.id).unresolved));
  assert.equal(payload.pages.filter(page => page.blocks.length === 0).length, 43);
});

test('available inscription keeps exact stable IDs, text, and member order', () => {
  const materialized = blocks(payload);
  assert.equal(materialized.length, 1911);
  assert.equal(materialized.filter(block => block.kind === 'Paragraph').length, 1859);
  assert.equal(new Set(materialized.map(block => block.id)).size, materialized.length);
  for (const page of payload.pages) {
    if (target(payload, page.id).access !== 'available') continue;
    const sourcePage = entity(assembly, page.id);
    const expected = sourcePage.state.members.filter(id => ['Paragraph', 'Block'].includes(entity(assembly, id).kind));
    assert.deepEqual(page.blocks.map(block => block.id), expected);
    for (const block of page.blocks) {
      const record = entity(assembly, block.id);
      assert.equal(block.text, record.state.text);
      assert.equal(block.kind, record.kind);
      assert.equal(block.format, record.kind === 'Paragraph' ? null : record.state.format);
    }
  }
});

test('unplaced working text is materialized without becoming a fourth Movement', () => {
  const workspace = payload.pages.filter(page => payload.unplacedOrder.includes(page.id));
  assert.ok(workspace.length > 0 && workspace.every(page => page.blocks.length > 0));
  for (const page of workspace) {
    assert.ok(target(payload, page.id).slotIds.every(id => payload.routes.slots.find(slot => slot.id === id).group === 'unplaced'));
  }
  assert.equal(payload.routes.targets.filter(row => row.kind === 'Movement').length, 3);
  assert.ok(workspace.some(page => page.blocks.some(block => block.kind === 'Paragraph')));
});

test('publication labels and admission observations cannot filter the working book', () => {
  const changed = cloned();
  for (const slot of changed.inventory.slots) {
    slot.publicationAnnotation = { label: 'held', authoritative: false };
    slot.observedReaderAdmission = 'unavailable';
  }
  const after = project(changed);
  assert.deepEqual(after.pages, payload.pages);
  assert.deepEqual(after.readingOrder, payload.readingOrder);
  assert.deepEqual(after.unplacedOrder, payload.unplacedOrder);
  assert.deepEqual(after.routes.targets, payload.routes.targets);
  assert.ok(after.routes.slots.every(slot => slot.publicationAnnotation.label === 'held'));
});

test('projection copies only public inventory labels, safe route metadata, and available inscription', () => {
  const changed = cloned();
  denyRead(changed, 'sourceMappings');
  denyRead(changed.inventory, 'sources');
  denyRead(changed.workspace, 'sourceRefs');
  for (const slot of changed.inventory.slots) {
    for (const key of ['canonicalPath', 'sources', 'issues', 'omissionRef']) denyRead(slot, key);
  }
  for (const row of changed.entityRecords) {
    denyRead(row, 'provenance');
    denyRead(row.state, 'presentation');
  }
  const after = project(changed);
  assert.deepEqual(after, payload);
  assert.deepEqual(Object.keys(after).sort(), ['pages', 'readingOrder', 'routes', 'schema', 'unplacedOrder']);
  for (const page of after.pages) {
    assert.deepEqual(Object.keys(page).sort(), ['blocks', 'id', 'label']);
    for (const block of page.blocks) assert.deepEqual(Object.keys(block).sort(), ['format', 'id', 'kind', 'text']);
  }
  const forbidden = new Set(['state', 'sourceMappings', 'sourceKey', 'sourceRefs', 'sources',
    'canonicalPath', 'blob', 'revision', 'scopeRefs', 'issues', 'omissionRef', 'presentation', 'provenance']);
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbidden.has(key), `excluded field ${key}`);
      inspect(child);
    }
  };
  inspect(after);
});

for (const access of ['restricted', 'unavailable-on-this-client']) {
  test(`denied slot inscription is not read or exposed: ${access}`, () => {
    const changed = cloned();
    changed.inventory.slots.find(slot => slot.entityId === paragraphSlot.entityId).access = access;
    const deniedIds = payload.routes.targets.filter(row => row.slotIds.includes(paragraphSlot.entityId)).map(row => row.id);
    for (const id of deniedIds) {
      const row = entity(changed, id);
      if (row && Object.hasOwn(row.state, 'text')) denyRead(row.state, 'text');
    }
    const after = project(changed);
    for (const page of after.pages.filter(page => deniedIds.includes(page.id))) {
      assert.deepEqual(page.blocks, []);
      assert.equal(target(after, page.id).access, access);
      assert.equal(target(after, page.id).version, null);
    }
    assert.equal(after.pages.length, payload.pages.length);
    assert.equal(after.routes.slots.length, payload.routes.slots.length);
    assert.ok(blocks(after).every(block => !deniedIds.includes(block.id)));
    assert.deepEqual(after.unplacedOrder, payload.unplacedOrder);
  });

  test(`one denied member suppresses the entire page before other inscriptions are read: ${access}`, () => {
    const changed = cloned();
    changed.entityRecords = changed.entityRecords.filter(row => row.id !== paragraph.id);
    changed.unmaterializedEntities.push({ id: paragraph.id, kind: 'Paragraph',
      sourceKey: 'synthetic-private-source-not-for-browser', access, entityVersion: null });
    for (const memberId of paragraphPage.state.members) {
      const row = entity(changed, memberId);
      if (row && Object.hasOwn(row.state, 'text')) denyRead(row.state, 'text');
    }
    const after = project(changed);
    const page = after.pages.find(row => row.id === paragraphPage.id);
    assert.deepEqual(page.blocks, []);
    assert.equal(target(after, page.id).access, access);
    assert.equal(target(after, paragraph.id).version, null);
    assert.equal(JSON.stringify(after).includes('synthetic-private-source-not-for-browser'), false);
  });
}

test('structural page members are traversed in canonical child order without new IDs', () => {
  const changed = cloned();
  const page = entity(changed, paragraphPage.id);
  page.state.members = [paragraphSlot.entityId];
  const after = project(changed);
  const projected = after.pages.find(row => row.id === page.id);
  assert.deepEqual(projected.blocks.map(block => block.id), entity(changed, paragraphSlot.entityId).state.children);
  assert.deepEqual(after.routes.targets.map(row => row.id), payload.routes.targets.map(row => row.id));
});

test('available unresolved structural placeholders stay empty without invented prose', () => {
  const changed = cloned();
  const slot = changed.inventory.slots.find(row => row.group === 'front');
  slot.access = 'available';
  const after = project(changed);
  const first = after.pages[0];
  assert.deepEqual(first.blocks, []);
  assert.equal(target(after, first.id).access, 'available');
  assert.equal(target(after, first.id).unresolved, true);
});

test('HTML-looking synthetic inscription remains inert text in the payload', () => {
  const changed = cloned();
  const source = entity(changed, paragraph.id);
  const text = '<img src=x onerror="alert(1)"><script>synthetic()</script>';
  changed.entityRecords[changed.entityRecords.indexOf(source)] = seal({ id: source.id, kind: 'Paragraph', state: { text, spans: [] } });
  const after = project(changed);
  assert.deepEqual(blocks(after).find(block => block.id === source.id), { id: source.id, kind: 'Paragraph', text, format: null });
  assert.equal(Object.hasOwn(after.pages[0], 'html'), false);
});

for (const format of ['markdown-heading', 'markdown-thematic-break', 'markdown-comment']) {
  test(`supported Block format is copied as raw inert inscription: ${format}`, () => {
    const changed = cloned();
    const source = changed.entityRecords.find(row => row.kind === 'Block');
    const text = format === 'markdown-heading' ? '# Synthetic heading' : format === 'markdown-comment' ? '<!-- Synthetic public working note. -->' : '---';
    changed.entityRecords[changed.entityRecords.indexOf(source)] = seal({ id: source.id, kind: 'Block', state: { text, format } });
    assert.deepEqual(blocks(project(changed)).find(block => block.id === source.id), { id: source.id, kind: 'Block', text, format });
  });
}

test('unsupported block formats and direct fine-grained page members fail rather than disappear', () => {
  const unknownFormat = cloned();
  unknownFormat.entityRecords.find(row => row.kind === 'Block').state.format = 'synthetic-unknown-format';
  assert.throws(() => project(unknownFormat), /unsupported block format/);
  const unknownKind = cloned();
  entity(unknownKind, paragraph.id).kind = 'Sentence';
  assert.throws(() => project(unknownKind), /unsupported page member kind/);
});

test('overlapping structural and direct membership fails rather than duplicating text', () => {
  const changed = cloned();
  entity(changed, paragraphPage.id).state.members = [paragraphSlot.entityId, paragraph.id];
  assert.throws(() => project(changed), /repeated or cyclic page member/);
});

test('duplicate identities, missing page members, and missing labels fail closed', () => {
  const duplicate = cloned();
  duplicate.entityRecords.push(structuredClone(duplicate.entityRecords[0]));
  assert.throws(() => project(duplicate), /duplicate entity identities/);
  const missing = cloned();
  entity(missing, paragraphPage.id).state.members.push('he_00000000-0000-4000-8000-999999999999');
  assert.throws(() => project(missing), /unknown page member/);
  const label = cloned();
  label.inventory.slots[0].label = null;
  assert.throws(() => project(label), /missing public inventory label/);
});
