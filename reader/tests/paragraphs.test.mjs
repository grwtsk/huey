import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEntityRoute } from '../src/routes.mjs';
import { paragraphHashRoute } from '../src/text.mjs';
import { validateParagraphBindings, findLegacyBinding, lookupEvidenceBinding,
  paragraphLinks, resolveParagraphLocation } from '../src/paragraphs.mjs';

const id = n => `he_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const version = `hev1:${'a'.repeat(64)}`, revised = `hev1:${'b'.repeat(64)}`;
const address = (n, exact = null) => formatEntityRoute({ id: id(n), kind: 'Paragraph', version: exact });
const pageAddress = n => formatEntityRoute({ id: id(n), kind: 'ReadingPage' });
const target = (n, kind, pageIds, slot = 50) => ({ id: id(n), kind, version,
  access: 'available', unresolved: false, pageIds: pageIds.map(id), slotIds: [id(slot)] });

function fixture() {
  const slot = (n, group) => ({ id: id(n), group, presence: 'present',
    editorialMaterialization: group === 'unplaced' ? 'unplaced' : 'full', access: 'available',
    publicationAnnotation: { label: 'working', authoritative: false }, observedReaderAdmission: 'not-listed' });
  return {
    readingOrder: [id(1), id(2)], unplacedOrder: [id(3)],
    routes: { schema: 'huey.route-projection.v1', projection: 'editorial', entryPageId: id(1),
      slots: [slot(50, 'book'), slot(51, 'unplaced')],
      targets: [target(50, 'Chapter', [1, 2]), target(51, 'Chapter', [3], 51),
        target(1, 'ReadingPage', [1]), target(2, 'ReadingPage', [2]), target(3, 'ReadingPage', [3], 51),
        target(10, 'Paragraph', [1]), target(11, 'Paragraph', [1]), target(12, 'Paragraph', [3], 51)],
      aliases: [{ path: '/huey/unplaced/retained-paragraph', targetId: id(12) }],
    },
  };
}
const entity = (data, n) => data.routes.targets.find(item => item.id === id(n));
const binding = (overrides = {}) => ({ chapterId: 'C08A', chapterBlob: '1'.repeat(40), ordinal: 1,
  rawSha256: '2'.repeat(64), entityId: id(10), entityVersion: version, ...overrides });
const registry = (...rows) => ({ schema: 'huey.legacy-paragraph-bindings.v1', bindings: rows });
const legacy = row => Object.fromEntries(['chapterId', 'chapterBlob', 'ordinal', 'rawSha256'].map(key => [key, row[key]]));
const exactEntity = row => ({ entityId: row.entityId, entityVersion: row.entityVersion });

test('paragraph links distinguish current identity and one exact local state', () => {
  const links = paragraphLinks({ id: id(10), version });
  assert.deepEqual(links, { current: address(10), exact: address(10, version) });
  assert.equal(paragraphLinks({ id: id(10), version: revised }).current, links.current);
  assert.notEqual(paragraphLinks({ id: id(10), version: revised }).exact, links.exact);
  assert.throws(() => paragraphLinks({ id: id(10), version: null }), /exact entity version/);
});

test('the current page supplies focus context and authored adjacency', () => {
  const result = resolveParagraphLocation(address(10), fixture());
  assert.equal(result.status, 'located'); assert.equal(result.paragraphId, id(10));
  assert.equal(result.selectedPageId, id(1)); assert.deepEqual(result.candidates, [id(1)]);
  assert.equal(result.sequence, 'book'); assert.equal(result.index, 0);
  assert.equal(result.previous, null); assert.equal(result.next, id(2));
  assert.equal(result.resolution.canonicalPath, address(10));
});

test('moving and repartitioning a paragraph changes context without changing its links', () => {
  const data = fixture(), before = resolveParagraphLocation(address(10), data);
  const links = paragraphLinks({ id: id(10), version });
  entity(data, 10).pageIds = [id(2)];
  const after = resolveParagraphLocation(links.exact, data);
  assert.equal(after.selectedPageId, id(2)); assert.equal(after.previous, id(1));
  assert.equal(after.paragraphId, before.paragraphId); assert.equal(after.resolution.entityVersion, version);
  assert.deepEqual(paragraphLinks({ id: id(10), version }), links);
});

test('an unplaced paragraph keeps its old alias when placed in the book', () => {
  const data = fixture(), alias = '/huey/unplaced/retained-paragraph';
  assert.equal(resolveParagraphLocation(alias, data).sequence, 'unplaced');
  entity(data, 12).pageIds = [id(2)]; entity(data, 12).slotIds = [id(50)];
  const result = resolveParagraphLocation(alias, data);
  assert.equal(result.status, 'located'); assert.equal(result.paragraphId, id(12));
  assert.equal(result.selectedPageId, id(2)); assert.equal(result.sequence, 'book');
  assert.equal(result.resolution.redirectTo, address(12));
});

test('equal-valued paragraph occurrences remain independently addressable', () => {
  const prose = [{ id: id(10), text: 'The same words.' }, { id: id(11), text: 'The same words.' }];
  const data = fixture(); entity(data, 11).pageIds = [id(2)];
  assert.equal(prose[0].text, prose[1].text);
  const results = prose.map(row => resolveParagraphLocation(paragraphLinks({ id: row.id, version }).current, data));
  assert.notEqual(results[0].paragraphId, results[1].paragraphId);
  assert.notEqual(results[0].selectedPageId, results[1].selectedPageId);
});

test('an unavailable exact revision does not select current text or a page', () => {
  const data = fixture(); entity(data, 10).version = revised;
  const result = resolveParagraphLocation(address(10, version), data);
  assert.equal(result.status, 'unavailable'); assert.equal(result.resolution.status, 'version-unavailable');
  assert.equal(result.selectedPageId, null); assert.equal(result.resolution.entityVersion, null);
  assert.deepEqual(result.candidates, []);
  assert.equal(resolveParagraphLocation(address(10), data).resolution.entityVersion, revised);
});

for (const access of ['restricted', 'unavailable-on-this-client']) {
  test(`${access} paragraph metadata cannot select text or a page`, () => {
    const data = fixture(); Object.assign(entity(data, 10), { access, version: null });
    const result = resolveParagraphLocation(address(10, version), data);
    assert.equal(result.status, 'unavailable'); assert.equal(result.selectedPageId, null);
    assert.equal(result.resolution.entityVersion, null); assert.deepEqual(result.candidates, []);
    assert.equal(result.resolution.status, access === 'restricted' ? 'restricted' : 'unavailable');
  });
  test(`${access} page cannot provide context even for an available paragraph`, () => {
    const data = fixture(); Object.assign(entity(data, 1), { access, version: null });
    const result = resolveParagraphLocation(address(10), data);
    assert.equal(result.resolution.status, 'resolved'); assert.equal(result.status, 'unavailable');
    assert.equal(result.selectedPageId, null); assert.deepEqual(result.candidates, []);
  });
}

test('unresolved paragraphs and pages do not become focusable content', () => {
  const data = fixture(); entity(data, 10).unresolved = true;
  assert.equal(resolveParagraphLocation(address(10), data).status, 'unavailable');
  entity(data, 10).unresolved = false; entity(data, 1).unresolved = true;
  assert.equal(resolveParagraphLocation(address(10), data).status, 'unavailable');
});

test('a held, non-admitted paragraph remains addressable in the editorial projection', () => {
  const data = fixture(); data.routes.slots[0].publicationAnnotation.label = 'held';
  const result = resolveParagraphLocation(address(10), data);
  assert.equal(result.status, 'located'); assert.equal(result.resolution.slots[0].observedReaderAdmission, 'not-listed');
});

test('multiple current pages require an explicit accessible choice in authored order', () => {
  const data = fixture(); entity(data, 10).pageIds = [id(3), id(2), id(1)];
  const result = resolveParagraphLocation(address(10), data);
  assert.equal(result.status, 'ambiguous'); assert.equal(result.selectedPageId, null);
  assert.deepEqual(result.candidates, [id(1), id(2), id(3)]);
  const selected = resolveParagraphLocation(address(10), data, id(3));
  assert.equal(selected.status, 'located'); assert.equal(selected.sequence, 'unplaced');
  assert.equal(selected.selectedPageId, id(3)); assert.equal(selected.previous, null); assert.equal(selected.next, null);
  Object.assign(entity(data, 3), { access: 'restricted', version: null });
  const deniedPreference = resolveParagraphLocation(address(10), data, id(3));
  assert.equal(deniedPreference.status, 'ambiguous'); assert.equal(deniedPreference.selectedPageId, null);
  assert.deepEqual(deniedPreference.candidates, [id(1), id(2)]);
});

test('stale or malformed explicit page choices never silently select another page', () => {
  for (const preference of [id(99), pageAddress(1), '', {}, undefined]) {
    // Omitted/undefined is the documented default, not an explicit stale choice.
    const result = resolveParagraphLocation(address(10), fixture(), preference);
    assert.equal(result.status, preference === undefined ? 'located' : 'ambiguous');
    if (preference !== undefined) assert.equal(result.selectedPageId, null);
  }
});

test('unprojected retained identity is not inferred to be retired or replaced', () => {
  const data = fixture(); entity(data, 10).pageIds = [];
  const result = resolveParagraphLocation(address(10), data);
  assert.equal(result.status, 'unprojected'); assert.equal(result.paragraphId, id(10));
  assert.equal(result.resolution.status, 'resolved'); assert.equal(result.selectedPageId, null);
});

test('synthetic split and join keep old identities without guessing a successor', () => {
  const data = fixture();
  // A later editor may split 10 into 20/21 and join 11/12 into 22. This consumer
  // receives only current membership, not an invented split/join lineage record.
  for (const n of [10, 11, 12]) entity(data, n).pageIds = [];
  data.routes.targets.push(target(20, 'Paragraph', [1]), target(21, 'Paragraph', [2]), target(22, 'Paragraph', [2]));
  for (const n of [10, 11, 12]) {
    const result = resolveParagraphLocation(address(n), data);
    assert.equal(result.status, 'unprojected'); assert.equal(result.paragraphId, id(n));
    assert.equal(result.selectedPageId, null);
  }
  for (const n of [20, 21, 22]) assert.equal(resolveParagraphLocation(address(n), data).status, 'located');
});

test('unknown, invalid and other-kind routes are not guessed into paragraphs', () => {
  for (const route of [address(99), '/huey/paragraph/the-same-words', pageAddress(1), '/huey']) {
    const result = resolveParagraphLocation(route, fixture());
    assert.equal(result.status, 'not-paragraph'); assert.equal(result.paragraphId, null);
    assert.equal(result.selectedPageId, null);
  }
});

test('malformed projection membership fails before selection', () => {
  const data = fixture(); entity(data, 10).pageIds = [id(11)];
  assert.throws(() => resolveParagraphLocation(address(10), data), /mistyped page reference/);
  entity(data, 10).pageIds = [id(1)]; data.readingOrder.pop();
  assert.throws(() => resolveParagraphLocation(address(10), data), /every ReadingPage/);
});

test('returned candidates and slots cannot mutate the caller projection', () => {
  const data = fixture(), baseline = structuredClone(data), result = resolveParagraphLocation(address(10), data);
  result.candidates.push(id(99)); result.resolution.slots[0].publicationAnnotation.label = 'held';
  assert.deepEqual(data, baseline);
});

test('exact legacy and evidence lookups share one checked compatibility row', () => {
  const row = binding(), value = registry(row);
  assert.equal(validateParagraphBindings(value), value);
  assert.deepEqual(findLegacyBinding(value, legacy(row)), row);
  assert.deepEqual(lookupEvidenceBinding(value, exactEntity(row)), row);
  assert.equal(paragraphHashRoute('evidence', row.chapterId, row.ordinal, row.chapterBlob),
    `#evidence/C08A/1/${'1'.repeat(40)}`);
  const copy = findLegacyBinding(value, legacy(row)); copy.ordinal = 99;
  assert.equal(row.ordinal, 1);
});

test('source blob, raw paragraph bytes and ordinal must all agree', () => {
  const row = binding(), value = registry(row);
  for (const patch of [{ chapterId: 'C09' }, { chapterBlob: '3'.repeat(40) },
    { ordinal: 2 }, { rawSha256: '4'.repeat(64) }]) {
    assert.equal(findLegacyBinding(value, { ...legacy(row), ...patch }), null);
  }
});

test('evidence does not transfer to an equal-valued occurrence or later revision', () => {
  const row = binding(), value = registry(row);
  assert.equal(lookupEvidenceBinding(value, { entityId: id(11), entityVersion: version }), null);
  assert.equal(lookupEvidenceBinding(value, { entityId: id(10), entityVersion: revised }), null);
  assert.equal(findLegacyBinding(registry(), legacy(row)), null);
  assert.equal(lookupEvidenceBinding(registry(), exactEntity(row)), null);
});

test('equal raw hashes at different source positions retain separate entity bindings', () => {
  const first = binding(), second = binding({ ordinal: 2, entityId: id(11) });
  const value = registry(first, second);
  assert.equal(findLegacyBinding(value, legacy(first)).entityId, id(10));
  assert.equal(findLegacyBinding(value, legacy(second)).entityId, id(11));
});

for (const [label, mutate] of [
  ['unknown document field', value => { value.permission = true; }],
  ['unknown row field', value => { value.bindings[0].sourceUrl = 'https://example.invalid'; }],
  ['symbol field', value => { value[Symbol('hidden')] = true; }],
  ['wrong schema', value => { value.schema = 'huey.legacy-paragraph-bindings.v2'; }],
  ['missing fields', value => { delete value.bindings[0].rawSha256; }],
  ['sparse rows', value => { value.bindings = new Array(1); }],
  ['non-array rows', value => { value.bindings = {}; }],
  ['class instance', value => { Object.setPrototypeOf(value.bindings[0], Date.prototype); }],
  ['lowercase chapter', value => { value.bindings[0].chapterId = 'c08a'; }],
  ['URL chapter', value => { value.bindings[0].chapterId = 'https://example.invalid'; }],
  ['malformed source version', value => { value.bindings[0].chapterBlob = 'a'.repeat(39); }],
  ['uppercase source version', value => { value.bindings[0].chapterBlob = 'A'.repeat(40); }],
  ['malformed raw digest', value => { value.bindings[0].rawSha256 = '2'.repeat(63); }],
  ['zero ordinal', value => { value.bindings[0].ordinal = 0; }],
  ['fractional ordinal', value => { value.bindings[0].ordinal = 1.5; }],
  ['string ordinal', value => { value.bindings[0].ordinal = '1'; }],
  ['unsafe ordinal', value => { value.bindings[0].ordinal = Number.MAX_SAFE_INTEGER + 1; }],
  ['derived identity', value => { value.bindings[0].entityId = 'C08A-p0001'; }],
  ['malformed entity version', value => { value.bindings[0].entityVersion = 'hev1:abc'; }],
  ['missing exact entity version', value => { value.bindings[0].entityVersion = null; }],
  ['duplicate source address', value => { value.bindings.push(binding({ entityId: id(11), rawSha256: '3'.repeat(64) })); }],
  ['ambiguous entity version', value => { value.bindings.push(binding({ ordinal: 2, chapterBlob: '3'.repeat(40) })); }],
]) {
  test(`bindings reject ${label}`, () => {
    const value = registry(binding()); mutate(value);
    assert.throws(() => validateParagraphBindings(value), /HUEY_/);
  });
}

test('lookups reject partial or extensible keys rather than broaden their match', () => {
  const row = binding(), value = registry(row);
  assert.throws(() => findLegacyBinding(value, { chapterId: row.chapterId, ordinal: row.ordinal }), /fields/);
  assert.throws(() => findLegacyBinding(value, { ...legacy(row), url: 'https://example.invalid' }), /fields/);
  assert.throws(() => lookupEvidenceBinding(value, { entityId: id(10) }), /fields/);
  assert.throws(() => lookupEvidenceBinding(value, { ...exactEntity(row), approved: true }), /fields/);
});
