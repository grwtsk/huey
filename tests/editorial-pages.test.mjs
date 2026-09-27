import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInventory, gitBlob } from '../scripts/editorial_inventory.mjs';
import { createPlan, buildAssembly } from '../scripts/editorial_pages.mjs';

const id = n => `he_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const revision = 'a'.repeat(40);
const scopeRefs = ['https://github.com/grwtsk/huey/issues/2#issuecomment-123'];
const chapter = '# Synthetic chapter\n\nThe same.\n\nThe same.\n\nLast paragraph.\n';
const unplaced = '## Synthetic unplaced\n\nAn unplaced paragraph.\n';
const makeSlot = (key, group, n, changes = {}) => ({
  key, entityId: id(n), kind: ['front', 'back'].includes(group) ? 'MatterUnit' : 'Chapter',
  group, label: group === 'book' ? null : `Synthetic ${key}`,
  optional: ['front', 'back'].includes(group) ? true : null,
  presence: 'present', publicationAnnotation: { label: 'working', authoritative: false },
  unmaterializedAccess: null, sources: [], issues: [347], omissionRef: null, ...changes,
});
const makeSource = (key, path, text, role, targets, extent = 'full') => ({
  key, role, extent, revision, path, blob: gitBlob(text), scopeRefs, targets,
});

function fixture(text = chapter) {
  const input = {
    registry: {
      schema: 'huey.editorial-registry.v1', basisRevision: revision,
      containers: { work: id(1), front: id(2), body: id(3), back: id(4), movements: { preamble: id(5), interlude: id(6), excursion: id(7) } },
      slots: [
        makeSlot('front-title', 'front', 8, { presence: 'pending', unmaterializedAccess: 'unavailable-on-this-client' }),
        makeSlot('C01', 'book', 9, { sources: ['canonical'], publicationAnnotation: { label: 'staged', authoritative: false } }),
        makeSlot('C02', 'book', 10, { sources: ['candidate'], unmaterializedAccess: 'restricted' }),
        makeSlot('C03', 'book', 11, { unmaterializedAccess: 'restricted' }),
        makeSlot('back-note', 'back', 12, { presence: 'pending' }),
        makeSlot('unplaced-one', 'unplaced', 13, { sources: ['unplaced'] }),
      ],
      sources: [
        makeSource('canonical', 'manuscript/01.md', text, 'canonical', ['C01']),
        makeSource('candidate', 'planning/writing/proposal.md', 'SYNTHETIC_CANDIDATE_NOT_ADOPTED', 'candidate', ['C02'], 'partial'),
        makeSource('unplaced', 'manuscript/unplaced/one.md', unplaced, 'unplaced', ['unplaced-one']),
        makeSource('support', 'sources/working.md', 'SYNTHETIC_SUPPORT_NOT_ADOPTED', 'support', []),
      ],
      supportPaths: ['manuscript/README.md'],
    },
    book: { schema: 'huey.book.v1', items: [
      { id: 'C01', movement: 'preamble', title: 'Synthetic chapter', path: 'manuscript/01.md', include: true },
      { id: 'C02', movement: 'interlude', title: 'Synthetic second', path: 'manuscript/02.md', include: false },
      { id: 'C03', movement: 'excursion', title: 'Synthetic third', path: 'manuscript/03.md', include: false },
    ] },
    reader: { chapters: [{ id: 'C01', status: 'admitted' }, { id: 'C02', status: 'unavailable' }] },
    trackedPaths: ['manuscript/01.md', 'manuscript/02.md', 'manuscript/03.md', 'manuscript/unplaced/one.md', 'manuscript/README.md'],
    files: { 'manuscript/01.md': text, 'manuscript/02.md': '<!-- Pending. -->\n', 'manuscript/03.md': '<!-- Restricted. -->', 'manuscript/unplaced/one.md': unplaced },
    sourceAvailability: { canonical: true, candidate: true, unplaced: true, support: true },
  };
  return { input, inventory: buildInventory(input), sourceTexts: { canonical: text, unplaced } };
}
function allocator() { let n = 100; return () => id(n++); }
function prepare({ text = chapter, maxBlocks = 2 } = {}) {
  const data = fixture(text);
  const plan = createPlan({ ...data, allocateId: allocator(), maxBlocks });
  return { ...data, plan };
}
const assemble = data => buildAssembly({ inventory: data.inventory, plan: data.plan, sourceTexts: data.sourceTexts });
const record = (assembly, entityId) => assembly.entityRecords.find(row => row.id === entityId);
const paragraphRecords = assembly => assembly.entityRecords.filter(row => row.kind === 'Paragraph');
const selected = plan => plan.sources.find(row => row.sourceKey === 'canonical');
const pageRecords = assembly => assembly.entityRecords.filter(row => row.kind === 'ReadingPage');
const sourceText = (data, block) => data.sourceTexts.canonical.slice(block.start, block.end);

// Revision fixtures update exact source pins and ranges explicitly. No production
// allocator or fuzzy text-equality reconciliation is exercised by these helpers.
function revise(data, text, oldIndexes) {
  const revised = fixture(text);
  revised.input.registry.sources.find(row => row.key === 'canonical').revision = 'b'.repeat(40);
  revised.inventory = buildInventory(revised.input);
  const parsed = createPlan({ ...revised, allocateId: allocator(), maxBlocks: data.plan.initialPartition.maxBlocks });
  const plan = structuredClone(data.plan);
  const old = selected(plan), next = selected(parsed);
  next.blocks.forEach((block, index) => block.id = old.blocks[oldIndexes[index]].id);
  plan.sources[plan.sources.findIndex(row => row.sourceKey === 'canonical')] = next;
  const chapterPages = plan.pages.filter(row => row.slot === 'C01');
  const ids = next.blocks.map(row => row.id);
  let at = 0;
  for (const page of chapterPages) {
    page.members = ids.slice(at, at + page.members.length);
    at += page.members.length;
  }
  return { ...revised, plan };
}

test('assembly is an exact validated model snapshot with front/body/back order', () => {
  const data = prepare(), out = assemble(data);
  assert.equal(out.schema, 'huey.editorial-assembly.v1');
  assert.equal(out.modelValidation, 'validated-snapshot');
  assert.deepEqual(out.readingOrder, data.plan.readingOrder);
  assert.equal(out.frontMatter.entryPageId, out.readingOrder[0]);
  assert.equal(out.frontMatter.firstBodyPageId, out.readingOrder[1]);
  assert.deepEqual(out.frontMatter.pages, [{ pageId: out.readingOrder[0],
    pageVersion: record(out, out.readingOrder[0]).version, matterUnitIds: [id(8)] }]);
  assert.equal(out.frontMatter.matterUnits[0].presence, 'pending');
  const order = out.readingOrder.map(pageId => data.plan.pages.find(page => page.id === pageId).slot);
  assert.deepEqual([...new Set(order)], ['front-title', 'C01', 'C02', 'C03', 'back-note']);
  assert.deepEqual(record(out, id(3)).state.children, [id(5), id(6), id(7)]);
  assert.deepEqual(record(out, id(5)).state.children, [id(9)]);
  assert.equal(out.entityRecords.filter(row => row.kind === 'Movement').length, 3);
  assert.ok(out.entityRecords.every(row => /^hev1:[a-f0-9]{64}$/.test(row.version)));
});

test('equal-valued paragraph occurrences retain distinct opaque stable identities', () => {
  const out = assemble(prepare());
  const equal = paragraphRecords(out).filter(row => row.state.text === 'The same.');
  assert.equal(equal.length, 2);
  assert.notEqual(equal[0].id, equal[1].id);
  assert.notEqual(equal[0].version, equal[1].version);
  assert.ok(equal.every(row => /^he_[a-f0-9-]+$/.test(row.id)));
});

test('explicit paragraph movement preserves identity and exact local entity version', () => {
  const data = prepare(), before = assemble(data);
  const moved = revise(data, '# Synthetic chapter\n\nLast paragraph.\n\nThe same.\n\nThe same.\n', [0, 3, 1, 2]);
  const after = assemble(moved);
  for (const paragraph of paragraphRecords(before)) {
    assert.deepEqual(record(after, paragraph.id), paragraph);
  }
  assert.notDeepEqual(record(after, id(9)).state.children, record(before, id(9)).state.children);
  assert.notEqual(record(after, id(9)).version, record(before, id(9)).version);
});

test('ordinary paragraph revision preserves ID and changes only its exact local state version', () => {
  const data = prepare(), before = assemble(data);
  const revised = revise(data, chapter.replace('Last paragraph.', 'A revised paragraph.'), [0, 1, 2, 3]);
  const after = assemble(revised), old = paragraphRecords(before).find(row => row.state.text === 'Last paragraph.');
  assert.equal(record(after, old.id).state.text, 'A revised paragraph.');
  assert.notEqual(record(after, old.id).version, old.version);
  for (const paragraph of paragraphRecords(before).filter(row => row.id !== old.id)) assert.deepEqual(record(after, paragraph.id), paragraph);
  assert.deepEqual(record(after, id(9)), record(before, id(9)), 'ancestor versions identify their local ordered IDs, not descendant text');
});

test('explicit page boundary change preserves paragraph IDs and versions', () => {
  const data = prepare(), before = assemble(data);
  const pages = data.plan.pages.filter(row => row.slot === 'C01');
  assert.equal(pages.length, 2);
  pages[1].members.unshift(pages[0].members.pop());
  const after = assemble(data);
  assert.deepEqual(paragraphRecords(after), paragraphRecords(before));
  assert.deepEqual(record(after, id(9)), record(before, id(9)));
  assert.notEqual(record(after, pages[0].id).version, record(before, pages[0].id).version);
  assert.notEqual(record(after, pages[1].id).version, record(before, pages[1].id).version);
  assert.deepEqual(after.readingOrder, before.readingOrder);
});

test('splitting a ReadingPage assigns only the new page identity', () => {
  const data = prepare(), before = assemble(data);
  const page = data.plan.pages.find(row => row.slot === 'C01');
  const added = { id: id(9999), slot: page.slot, members: page.members.splice(1) };
  data.plan.pages.splice(data.plan.pages.indexOf(page) + 1, 0, added);
  data.plan.readingOrder.splice(data.plan.readingOrder.indexOf(page.id) + 1, 0, added.id);
  const after = assemble(data);
  assert.deepEqual(paragraphRecords(after), paragraphRecords(before));
  assert.deepEqual(record(after, id(9)), record(before, id(9)));
  assert.equal(record(after, added.id).kind, 'ReadingPage');
  assert.notEqual(record(after, page.id).version, record(before, page.id).version);
  assert.ok(before.readingOrder.every(pageId => after.readingOrder.includes(pageId)));
});

test('changing inline presentation leaves Paragraph inscription identity and version unchanged', () => {
  const data = prepare(), before = assemble(data);
  const revised = revise(data, chapter.replace('Last paragraph.', 'Last *paragraph*.'), [0, 1, 2, 3]);
  const after = assemble(revised);
  assert.deepEqual(paragraphRecords(after), paragraphRecords(before));
  const paragraph = paragraphRecords(after).find(row => row.state.text === 'Last paragraph.');
  const mapping = after.sourceMappings.find(row => row.entityId === paragraph.id);
  assert.deepEqual(mapping.presentation, [{ type: 'em', start: 5, end: 14 }]);
  assert.notDeepEqual(after.sourceMappings, before.sourceMappings);
});

test('persisted pages are independent of the original initial-partition setting', () => {
  const data = prepare(), before = assemble(data);
  data.plan.initialPartition.maxBlocks = 1;
  const after = assemble(data);
  assert.deepEqual(pageRecords(after), pageRecords(before));
  assert.deepEqual(after.readingOrder, before.readingOrder);
});

test('unplaced content is materialized in workspace pages outside all three movements', () => {
  const data = prepare(), out = assemble(data);
  assert.deepEqual(out.workspace.unplacedPages, data.plan.unplacedOrder);
  assert.ok(out.workspace.unplacedPages.length > 0);
  assert.ok(out.workspace.unplacedPages.every(pageId => !out.readingOrder.includes(pageId)));
  const owners = out.entityRecords.filter(row => row.kind === 'Movement');
  assert.ok(owners.every(row => !row.state.children.includes(id(13))));
  assert.equal(record(out, id(13)).kind, 'Chapter');
  assert.ok(paragraphRecords(out).some(row => row.state.text === 'An unplaced paragraph.'));
});

test('non-admitted candidates and support remain addressable without adoption', () => {
  const data = prepare();
  Object.defineProperty(data.sourceTexts, 'candidate', { get() { throw new Error('Candidate bytes must not be loaded'); } });
  Object.defineProperty(data.sourceTexts, 'support', { get() { throw new Error('Support bytes must not be loaded'); } });
  const out = assemble(data), serialized = JSON.stringify(out);
  assert.ok(serialized.includes('candidate'));
  assert.ok(serialized.includes('support'));
  assert.ok(!serialized.includes('SYNTHETIC_CANDIDATE_NOT_ADOPTED'));
  assert.ok(!serialized.includes('SYNTHETIC_SUPPORT_NOT_ADOPTED'));
  assert.deepEqual(record(out, id(10)).state.children, []);
});

test('publication labels and admission observations cannot remove editorial content', () => {
  const data = prepare(), before = assemble(data);
  data.input.book.items.forEach(row => row.include = false);
  data.input.reader.chapters.forEach(row => row.status = 'unavailable');
  data.input.registry.slots.forEach(row => row.publicationAnnotation.label = 'held');
  data.inventory = buildInventory(data.input);
  const after = assemble(data);
  assert.deepEqual(after.entityRecords, before.entityRecords);
  assert.deepEqual(after.readingOrder, before.readingOrder);
  assert.deepEqual(after.workspace.unplacedPages, before.workspace.unplacedPages);
});

test('pending and restricted slots stay in the page sequence without invented prose', () => {
  const data = prepare(), out = assemble(data);
  for (const key of ['front-title', 'C02', 'C03', 'back-note']) {
    const page = data.plan.pages.find(row => row.slot === key);
    assert.ok(out.readingOrder.includes(page.id));
    const slot = data.inventory.slots.find(row => row.key === key);
    assert.deepEqual(record(out, slot.entityId).state.children, []);
  }
  assert.equal(record(out, id(8)).state.presence, 'pending');
});

for (const deniedBy of ['source', 'slot']) {
  for (const access of ['restricted', 'unavailable-on-this-client']) {
    test(`${deniedBy} access ${access} prevents even reading supplied source bytes`, () => {
      const data = prepare(), before = assemble(data);
      const target = deniedBy === 'source' ? data.inventory.sources.find(row => row.key === 'canonical') : data.inventory.slots.find(row => row.key === 'C01');
      target.access = access;
      Object.defineProperty(data.sourceTexts, 'canonical', { get() { throw new Error('SYNTHETIC_RESTRICTED_SENTINEL'); } });
      const out = assemble(data);
      assert.equal(out.modelValidation, 'deferred-unavailable-source');
      assert.deepEqual(out.readingOrder, before.readingOrder);
      assert.deepEqual(pageRecords(out), pageRecords(before));
      assert.ok(!JSON.stringify(out).includes('SYNTHETIC_RESTRICTED_SENTINEL'));
      assert.ok(!paragraphRecords(out).some(row => row.state.text === 'The same.'));
      assert.ok(out.sourceMappings.every(row => row.sourceKey !== 'canonical'));
      assert.ok(selected(data.plan).blocks.every(block => !record(out, block.id)));
      assert.ok(paragraphRecords(out).some(row => row.state.text === 'An unplaced paragraph.'), 'independently available material remains materialized');
      const unresolved = JSON.stringify(out.unmaterializedEntities);
      assert.ok(selected(data.plan).blocks.every(block => unresolved.includes(block.id)));
    });
  }
}

test('all denied selected sources emit no text records, mappings or invented empty text states', () => {
  const data = prepare(), before = assemble(data);
  for (const key of ['canonical', 'unplaced']) {
    data.inventory.sources.find(row => row.key === key).access = 'restricted';
    Object.defineProperty(data.sourceTexts, key, { get() { throw new Error('SYNTHETIC_RESTRICTED_SENTINEL'); } });
  }
  const out = assemble(data);
  assert.equal(out.modelValidation, 'deferred-unavailable-source');
  assert.deepEqual(out.sourceMappings, []);
  assert.ok(out.entityRecords.every(row => !['Block', 'Paragraph'].includes(row.kind)));
  assert.deepEqual(pageRecords(out), pageRecords(before));
  assert.deepEqual(out.unmaterializedEntities.map(row => row.id), data.plan.sources.flatMap(source => source.blocks.map(block => block.id)));
  assert.ok(out.unmaterializedEntities.every(row => row.entityVersion === null && row.access === 'restricted'));
  assert.ok(!JSON.stringify(out).includes('SYNTHETIC_RESTRICTED_SENTINEL'));
});

for (const [name, mutate, code] of [
  ['Body directly owns Chapter', inventory => inventory.ownership.find(row => row.kind === 'Body').children = [id(9)], 'CONTAINMENT_KIND'],
  ['two movements own the same Chapter', inventory => inventory.ownership.find(row => row.key === 'interlude').children.push(id(9)), 'OWNERSHIP'],
]) test(`unavailable text cannot bypass structural validation: ${name}`, () => {
  const data = prepare();
  data.inventory.sources.find(row => row.key === 'canonical').access = 'unavailable-on-this-client';
  Object.defineProperty(data.sourceTexts, 'canonical', { get() { throw new Error('Denied text must not be read'); } });
  mutate(data.inventory);
  assert.throws(() => assemble(data), error => error.code === code);
});

test('an unavailable source retains persisted page membership and unresolved block identities', () => {
  const data = prepare(), before = assemble(data);
  data.inventory.sources.find(row => row.key === 'canonical').access = 'unavailable-on-this-client';
  delete data.sourceTexts.canonical;
  const out = assemble(data);
  assert.deepEqual(out.readingOrder, before.readingOrder);
  assert.deepEqual(pageRecords(out), pageRecords(before));
  assert.equal(out.modelValidation, 'deferred-unavailable-source');
  assert.ok(selected(data.plan).blocks.every(block => JSON.stringify(out.unmaterializedEntities).includes(block.id)));
});

test('a missing working file never falls back to available historical source bytes', () => {
  const data = prepare(), before = assemble(data);
  data.inventory.slots.find(row => row.key === 'C01').canonicalState = 'missing';
  Object.defineProperty(data.sourceTexts, 'canonical', { get() { throw new Error('Historical bytes must not be read'); } });
  const out = assemble(data);
  assert.equal(out.modelValidation, 'deferred-unavailable-source');
  assert.deepEqual(pageRecords(out), pageRecords(before));
  const missing = out.unmaterializedEntities.filter(row => row.sourceKey === 'canonical');
  assert.deepEqual(missing.map(row => row.id), selected(data.plan).blocks.map(row => row.id));
  assert.ok(missing.every(row => row.access === 'unavailable-on-this-client'));
});

test('source mappings preserve exact UTF-8 ranges without normalization', () => {
  const text = '# Unicode\n\ne\u0301 and 👩🏽‍💻.\n\nSecond paragraph.\n';
  const data = prepare({ text }), out = assemble(data);
  for (const block of selected(data.plan).blocks) {
    assert.equal(record(out, block.id).state.text, sourceText(data, block));
    const mapping = out.sourceMappings.find(row => row.entityId === block.id);
    assert.deepEqual(mapping.utf16, { start: block.start, end: block.end });
    assert.equal(Buffer.from(text).subarray(mapping.utf8.start, mapping.utf8.end).toString('utf8'), sourceText(data, block));
  }
  assert.ok(paragraphRecords(out).some(row => row.state.text === 'e\u0301 and 👩🏽‍💻.'));
  assert.equal(out.sourceMappings.length, data.plan.sources.reduce((sum, source) => sum + source.blocks.length, 0));
});

test('repeat compilation is deterministic, immutable and allocates no new identities', () => {
  const data = prepare(), serializedPlan = JSON.stringify(data.plan), first = assemble(data);
  assert.deepEqual(assemble(data), first);
  assert.equal(JSON.stringify(data.plan), serializedPlan);
  assert.deepEqual(createPlan({ ...fixture(), allocateId: allocator(), maxBlocks: 2 }), data.plan);
});

test('opaque IDs are assigned once rather than derived from identical bytes or paths', () => {
  const data = fixture();
  const first = createPlan({ ...data, allocateId: allocator(), maxBlocks: 2 });
  let n = 1000;
  const second = createPlan({ ...data, allocateId: () => id(n++), maxBlocks: 2 });
  assert.notEqual(first.sources[0].blocks[0].id, second.sources[0].blocks[0].id);
  assert.notEqual(first.pages[0].id, second.pages[0].id);
});

test('renaming a source path with explicit pin update preserves literary identities', () => {
  const data = prepare(), before = assemble(data);
  const newPath = 'manuscript/renamed.md';
  data.inventory.sources.find(row => row.key === 'canonical').path = newPath;
  data.inventory.slots.find(row => row.key === 'C01').canonicalPath = newPath;
  selected(data.plan).path = newPath;
  const after = assemble(data);
  assert.deepEqual(after.entityRecords, before.entityRecords);
  assert.deepEqual(after.readingOrder, before.readingOrder);
});

const hostile = [
  ['duplicate paragraph ID', d => { const b = selected(d.plan).blocks; b[2].id = b[1].id; }],
  ['page ID collides with existing literary identity', d => d.plan.pages[0].id = id(9)],
  ['duplicate page ID', d => d.plan.pages[1].id = d.plan.pages[0].id],
  ['route-derived identity', d => selected(d.plan).blocks[0].id = '/huey/1'],
  ['path-derived identity', d => selected(d.plan).blocks[0].id = 'manuscript/01.md'],
  ['missing block range', d => delete selected(d.plan).blocks[1].start],
  ['shifted paragraph boundary', d => selected(d.plan).blocks[1].start++],
  ['truncated paragraph boundary', d => selected(d.plan).blocks[1].end--],
  ['overlapping source blocks', d => selected(d.plan).blocks[2].start = selected(d.plan).blocks[1].start],
  ['untracked source revision change', d => selected(d.plan).revision = 'b'.repeat(40)],
  ['source blob mismatch', d => selected(d.plan).blob = 'c'.repeat(40)],
  ['source text changed without pin update', d => d.sourceTexts.canonical += '\nChanged prose.\n'],
  ['unknown selected source', d => selected(d.plan).sourceKey = 'not-in-inventory'],
  ['paragraph missing from all page memberships', d => d.plan.pages.find(row => row.slot === 'C01').members.pop()],
  ['paragraph repeated across pages', d => { const p = d.plan.pages.filter(row => row.slot === 'C01'); p[1].members[0] = p[0].members[0]; }],
  ['foreign unplaced block in canonical page', d => d.plan.pages.find(row => row.slot === 'C01').members.push(d.plan.sources.find(row => row.sourceKey === 'unplaced').blocks[1].id)],
  ['unknown page member', d => d.plan.pages.find(row => row.slot === 'C01').members.push(id(9999))],
  ['missing known literary slot page', d => { const p = d.plan.pages.find(row => row.slot === 'C03'); d.plan.pages = d.plan.pages.filter(row => row !== p); d.plan.readingOrder = d.plan.readingOrder.filter(value => value !== p.id); }],
  ['dropped reading page', d => d.plan.readingOrder.pop()],
  ['duplicated reading page', d => d.plan.readingOrder.push(d.plan.readingOrder[0])],
  ['front matter moved after body', d => d.plan.readingOrder.push(d.plan.readingOrder.shift())],
  ['unplaced page inserted into canonical sequence', d => d.plan.readingOrder.push(d.plan.unplacedOrder[0])],
  ['unknown plan field', d => d.plan.grant = 'invented'],
  ['unknown block field', d => selected(d.plan).blocks[1].accepted = true],
  ['unknown page field', d => d.plan.pages[0].viewportHeight = 800],
];
for (const [name, mutate] of hostile) test(`rejects ${name}`, () => {
  const data = prepare(); mutate(data); assert.throws(() => assemble(data));
});

for (const maxBlocks of [0, -1, 1.5, '2']) test(`rejects invalid initial partition ${JSON.stringify(maxBlocks)}`, () => {
  const data = fixture(); assert.throws(() => createPlan({ ...data, allocateId: allocator(), maxBlocks }));
});

test('initial ID allocation rejects collisions instead of collapsing occurrences', () => {
  const data = fixture(); assert.throws(() => createPlan({ ...data, allocateId: () => id(100), maxBlocks: 2 }));
});

for (const text of [
  '# Chapter\n\n> A quoted block.\n',
  '# Chapter\n\n- A list item.\n',
  '# Chapter\n\n| A | B |\n| - | - |\n',
  '# Chapter\n\n```\nA fenced block.\n```\n',
  '# Chapter\n\n<div>HTML</div>\n',
]) test(`unsupported block syntax fails explicitly (${text.split('\n')[2]})`, () => {
  const data = fixture(text); assert.throws(() => createPlan({ ...data, allocateId: allocator(), maxBlocks: 2 }));
});
