import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookContents, locateBookPage, admittedBookContents } from '../src/book-navigation.mjs';
import { formatEntityRoute } from '../src/routes.mjs';

const id = n => `he_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const version = `hev1:${'a'.repeat(64)}`;
const path = n => formatEntityRoute({ id: id(n), kind: 'ReadingPage' });

function fixture() {
  const routes = { schema: 'huey.route-projection.v1', projection: 'editorial', entryPageId: id(1),
    targets: [], slots: [], aliases: [] };
  const slots = [
    { n: 11, group: 'front', pages: [1], label: 'Opening', access: 'unavailable-on-this-client', presence: 'pending', materialization: 'placeholder' },
    { n: 12, group: 'book', pages: [3, 2], label: 'First working chapter', access: 'available', presence: 'present', materialization: 'partial' },
    { n: 13, group: 'book', pages: [4], label: 'Second working chapter', access: 'restricted', presence: 'present', materialization: 'full' },
    { n: 14, group: 'back', pages: [5], label: 'References', access: 'available', presence: 'present', materialization: 'full' },
    { n: 15, group: 'unplaced', pages: [6, 7], label: 'Unplaced unit', access: 'available', presence: 'present', materialization: 'unplaced' },
  ];
  for (const slot of slots) {
    routes.slots.push({ id: id(slot.n), group: slot.group, presence: slot.presence,
      editorialMaterialization: slot.materialization, access: slot.access,
      publicationAnnotation: { label: 'held', authoritative: false }, observedReaderAdmission: 'not-listed' });
    const kind = ['front', 'back'].includes(slot.group) ? 'MatterUnit' : 'Chapter';
    routes.targets.push({ id: id(slot.n), kind, version: slot.access === 'available' ? version : null,
      access: slot.access, unresolved: slot.presence === 'pending', pageIds: slot.pages.map(id), slotIds: [id(slot.n)] });
    const family = slot.group === 'book' ? 'chapter' : slot.group;
    routes.aliases.push({ path: `/huey/${family}/unit-${slot.n}`, targetId: id(slot.n) });
  }
  const pages = [];
  for (let n = 1; n <= 7; n += 1) {
    const slot = slots.find(slot => slot.pages.includes(n));
    routes.targets.push({ id: id(n), kind: 'ReadingPage', version: slot.access === 'available' ? version : null,
      access: slot.access, unresolved: slot.presence === 'pending', pageIds: [id(n)], slotIds: [id(slot.n)] });
    pages.push({ id: id(n), label: slot.label, blocks: [] });
  }
  return { schema: 'huey.editorial-traversal.v1', routes, pages,
    readingOrder: [1, 2, 3, 4, 5].map(id), unplacedOrder: [6, 7].map(id) };
}

test('contents preserve all groups and denied slots without deriving text or admission', () => {
  const data = fixture(), before = structuredClone(data);
  for (const page of data.pages) Object.defineProperty(page, 'blocks', { get() { throw new Error('Do not read inscriptions'); } });
  const groups = buildBookContents(data);
  assert.deepEqual(groups.map(group => group.key), ['front', 'book', 'back', 'unplaced']);
  assert.equal(groups[0].entries[0].path, path(1));
  assert.deepEqual(groups[0].entries[0], { id: id(11), label: 'Opening', path: path(1), pageIds: [id(1)],
    pages: [{ id: id(1), path: path(1), number: 1 }], access: 'unavailable-on-this-client', presence: 'pending', materialization: 'placeholder' });
  assert.equal(groups[1].entries[1].access, 'restricted');
  assert.equal(groups[1].entries[1].path, path(4));
  assert.equal('publicationAnnotation' in groups[1].entries[0], false);
  assert.equal('observedReaderAdmission' in groups[1].entries[0], false);
  assert.deepEqual(data.routes, before.routes);
  assert.deepEqual(data.readingOrder, before.readingOrder);
});

test('chapter pages follow native sequence, not target reference order or layout', () => {
  const data = fixture(), entry = buildBookContents(data)[1].entries[0];
  assert.deepEqual(entry.pageIds, [id(2), id(3)]);
  assert.equal(entry.path, path(2));
  assert.deepEqual(entry.pages, [{ id: id(2), path: path(2), number: 2 }, { id: id(3), path: path(3), number: 3 }]);
  data.readingOrder = [1, 4, 3, 2, 5].map(id);
  const changed = buildBookContents(data)[1].entries;
  assert.deepEqual(changed.map(entry => entry.id), [id(13), id(12)]);
  assert.equal(changed[1].path, path(3));
});

test('a shared page retains one entry per slot and the existing composite label', () => {
  const data = fixture(), copy = structuredClone(data.routes.slots[1]);
  copy.id = id(16); data.routes.slots.splice(2, 0, copy);
  data.routes.targets.push({ ...structuredClone(data.routes.targets.find(target => target.id === id(12))),
    id: id(16), pageIds: [id(3)], slotIds: [id(16)] });
  data.routes.targets.find(target => target.id === id(3)).slotIds.push(id(16));
  data.pages.find(page => page.id === id(3)).label = 'First working chapter / Shared unit';
  const entries = buildBookContents(data)[1].entries;
  assert.equal(entries.length, 3);
  assert.equal(entries[1].id, id(16));
  assert.equal(entries[1].label, 'First working chapter / Shared unit');
  assert.equal(entries[1].path, path(3));
  assert.deepEqual(entries[1].pageIds, [id(3)]);
});

test('a slot without a page remains addressable by its actual stable container kind', () => {
  const data = fixture(), slot = { ...structuredClone(data.routes.slots[2]), id: id(17), presence: 'absent', editorialMaterialization: 'unavailable' };
  data.routes.slots.unshift(slot);
  data.routes.targets.push({ id: id(17), kind: 'Chapter', version: null, access: 'restricted', unresolved: true, pageIds: [], slotIds: [id(17)] });
  const entry = buildBookContents(data)[1].entries.at(-1);
  assert.deepEqual(entry, { id: id(17), label: id(17), path: formatEntityRoute({ id: id(17), kind: 'Chapter' }),
    pageIds: [], pages: [], access: 'restricted', presence: 'absent', materialization: 'unavailable' });
});

test('native page neighbours include denied pages and hard sequence boundaries', () => {
  const data = fixture();
  assert.deepEqual(locateBookPage(data, id(1)), { previous: null, next: id(2), index: 0, total: 5, sequence: 'book' });
  assert.deepEqual(locateBookPage(data, id(3)), { previous: id(2), next: id(4), index: 2, total: 5, sequence: 'book' });
  assert.deepEqual(locateBookPage(data, id(5)), { previous: id(4), next: null, index: 4, total: 5, sequence: 'book' });
  assert.deepEqual(locateBookPage(data, id(6)), { previous: null, next: id(7), index: 0, total: 2, sequence: 'unplaced' });
  assert.deepEqual(locateBookPage(data, id(7)), { previous: id(6), next: null, index: 1, total: 2, sequence: 'unplaced' });
  assert.deepEqual(locateBookPage(data, id(12)), { previous: null, next: null, index: null, total: null, sequence: null });
  const unplaced = buildBookContents(data)[3].entries[0];
  assert.deepEqual(unplaced.pages.map(page => page.number), [1, 2]);
});

test('bad sequence, missing labels, duplicate pages and contradictory membership fail closed', () => {
  for (const mutate of [
    data => { data.readingOrder.pop(); },
    data => { data.pages.pop(); },
    data => { data.pages.push(data.pages[0]); },
    data => { data.pages[0].label = ''; },
    data => { data.routes.targets.find(target => target.id === id(12)).pageIds.push(id(6)); },
    data => { data.routes.targets.find(target => target.id === id(12)).pageIds = [id(2)]; },
    data => { data.routes.targets.find(target => target.id === id(3)).slotIds = []; },
  ]) {
    const data = fixture(); mutate(data);
    assert.throws(() => buildBookContents(data), /HUEY_(TRAVERSAL|BOOK_NAVIGATION)/);
  }
});

test('admitted chapter metadata keeps unavailable entries and has no prose dependency', () => {
  const book = { schemaVersion: 1, chapters: [
    { id: 'C01', label: '1', title: 'First projection', status: 'unavailable' },
    { id: 'C08A', label: '8A', title: 'Working chapter', status: 'admitted' },
  ] };
  assert.deepEqual(admittedBookContents(book), [
    { id: 'C01', label: '1 · First projection', path: '#chapter/C01', status: 'unavailable' },
    { id: 'C08A', label: '8A · Working chapter', path: '#chapter/C08A', status: 'admitted' },
  ]);
  assert.throws(() => admittedBookContents({ ...book, chapters: [...book.chapters, book.chapters[0]] }), /HUEY_BOOK_NAVIGATION/);
});
