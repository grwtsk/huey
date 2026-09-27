import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFrontMatter } from '../scripts/editorial_front_matter.mjs';
import { profile, seal, validateBundle } from '../scripts/literary_model.mjs';

// Synthetic literary graphs exercise the projection consumer. They are not new
// manuscript intake, a replacement page plan, or front-matter content decisions.
const id = n => `he_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const record = (assembly, n) => assembly.entityRecords.find(row => row.id === id(n));
const slot = (assembly, n) => assembly.inventory.slots.find(row => row.entityId === id(n));
const make = (n, kind, state) => seal({ id: id(n), kind, state });
const structure = (n, kind, children) => make(n, kind, { children: children.map(id) });
const page = (n, members) => make(n, 'ReadingPage', { members: members.map(id) });

function fixture({ unavailable = true } = {}) {
  const frontStates = [
    [10, 'full', 'present', 'full', 'available', false, [30, 31]],
    [11, 'partial', 'present', 'partial', 'available', true, [32]],
    [12, 'pending', 'pending', 'placeholder', 'unavailable-on-this-client', true, []],
    [13, 'omitted', 'omitted', 'placeholder', 'unavailable-on-this-client', true, []],
    [14, 'absent', 'absent', 'unavailable', 'restricted', true, []],
    [15, 'unavailable', 'present', unavailable ? 'unavailable' : 'full', unavailable ? 'restricted' : 'available', true, [33]],
  ];
  const frontSlots = frontStates.map(([n, key, presence, materialization, access, optional]) => ({
    key: `front-${key}`, entityId: id(n), entityVersion: null,
    kind: 'MatterUnit', group: 'front', label: `Synthetic ${key}`, optional,
    presence, editorialMaterialization: materialization, access,
    unmaterializedAccess: access === 'available' ? null : access,
    publicationAnnotation: { label: 'working', authoritative: false },
    observedReaderAdmission: 'not-listed',
    omissionRef: presence === 'omitted' ? 'https://github.com/grwtsk/huey/issues/7#issuecomment-123' : null,
    canonicalPath: null, canonicalState: 'not-assigned', sources: [], issues: [349, 13],
  }));
  const remainingSlots = [
    [20, 'C01', 'Chapter', 'book'], [21, 'C02', 'Chapter', 'book'],
    [22, 'C03', 'Chapter', 'book'], [23, 'back-note', 'MatterUnit', 'back'],
    [24, 'unplaced-one', 'Chapter', 'unplaced'],
  ].map(([n, key, kind, group]) => ({
    key, entityId: id(n), entityVersion: null, kind, group, label: `Synthetic ${key}`,
    optional: kind === 'MatterUnit' ? true : null, presence: 'present',
    editorialMaterialization: 'placeholder', access: 'unavailable-on-this-client',
    unmaterializedAccess: 'unavailable-on-this-client',
    publicationAnnotation: { label: 'held', authoritative: false },
    observedReaderAdmission: key === 'C01' ? 'admitted' : 'not-listed',
    omissionRef: null, canonicalPath: null, canonicalState: 'not-assigned', sources: [], issues: [370],
  }));
  const containers = [
    structure(1, 'Work', [2, 3, 4]), structure(2, 'FrontMatter', [10, 11, 12, 13, 14, 15]),
    structure(3, 'Body', [5, 6, 7]), structure(4, 'BackMatter', [23]),
    structure(5, 'Movement', [20]), structure(6, 'Movement', [21]), structure(7, 'Movement', [22]),
  ];
  const entityRecords = [
    ...containers,
    ...frontStates.map(([n, , presence, , , optional, children]) => make(n, 'MatterUnit', { children: children.map(id), optional, presence })),
    ...[20, 21, 22, 24].map(n => structure(n, 'Chapter', [])),
    make(23, 'MatterUnit', { children: [], optional: true, presence: 'present' }),
    ...[30, 31, 32, ...(unavailable ? [] : [33])].map(n => make(n, 'Paragraph', { text: 'Synthetic inscription.', spans: [] })),
    page(100, [30]), page(101, [31, 32]), page(102, [12, 13]), page(103, [14, 33]),
    page(104, [20]), page(105, [21]), page(106, [22]), page(107, [23]), page(108, [24]),
  ];
  return {
    schema: 'huey.editorial-assembly.v1', model: profile.model, parser: 'huey.editorial-markdown/1',
    representation: 'synthetic derived assembly fixture',
    modelValidation: unavailable ? 'deferred-unavailable-source' : 'validated-snapshot',
    inventory: {
      schema: 'huey.editorial-inventory.v1',
      ownership: containers.map(row => ({ entityId: row.id, kind: row.kind, children: [...row.state.children] })),
      slots: [...frontSlots, ...remainingSlots], sources: [],
    },
    entityRecords,
    unmaterializedEntities: unavailable ? [{ id: id(33), kind: 'Paragraph', sourceKey: 'synthetic-restricted', access: 'restricted', entityVersion: null }] : [],
    sourceMappings: [], readingOrder: [100, 101, 102, 103, 104, 105, 106, 107].map(id),
    workspace: { unplacedPages: [id(108)], sourceRefs: [] },
  };
}

function replaceState(assembly, n, state) {
  const previous = record(assembly, n);
  assembly.entityRecords[assembly.entityRecords.indexOf(previous)] = make(n, previous.kind, state);
}

test('front contract is derived from a valid literary graph without replacing its identities', () => {
  const assembly = fixture({ unavailable: false });
  validateBundle({ model: profile.model, snapshots: [{ name: 'synthetic-front', entities: assembly.entityRecords, routes: [], annotations: [], lineage: [] }] });
  const out = buildFrontMatter(assembly);
  assert.equal(out.schema, 'huey.editorial-front-matter.v1');
  assert.equal(out.workId, id(1));
  assert.equal(out.frontMatterId, id(2));
  assert.equal(out.bodyId, id(3));
  assert.equal(out.entryPageId, id(100));
  assert.equal(out.firstBodyPageId, id(104));
  assert.deepEqual(out.pages, [
    { pageId: id(100), pageVersion: record(assembly, 100).version, matterUnitIds: [id(10)] },
    { pageId: id(101), pageVersion: record(assembly, 101).version, matterUnitIds: [id(10), id(11)] },
    { pageId: id(102), pageVersion: record(assembly, 102).version, matterUnitIds: [id(12), id(13)] },
    { pageId: id(103), pageVersion: record(assembly, 103).version, matterUnitIds: [id(14), id(15)] },
  ]);
  assert.deepEqual(out.matterUnits.map(row => row.entityId), [10, 11, 12, 13, 14, 15].map(id));
  assert.ok(out.pages.every(row => !row.matterUnitIds.includes(row.pageId)));
});

test('presence, materialization, access and publication remain independent metadata', () => {
  const assembly = fixture(), out = buildFrontMatter(assembly);
  for (const descriptor of out.matterUnits) {
    const source = assembly.inventory.slots.find(row => row.entityId === descriptor.entityId);
    const entity = assembly.entityRecords.find(row => row.id === descriptor.entityId);
    assert.equal(descriptor.entityVersion, entity.version);
    for (const key of ['key', 'label', 'optional', 'presence', 'editorialMaterialization', 'access', 'publicationAnnotation', 'observedReaderAdmission', 'omissionRef', 'issues']) {
      assert.deepEqual(descriptor[key], source[key], key);
    }
  }
  assert.deepEqual(out.matterUnits.map(row => row.presence), ['present', 'present', 'pending', 'omitted', 'absent', 'present']);
  assert.equal(out.matterUnits[1].editorialMaterialization, 'partial');
  assert.equal(out.matterUnits[2].omissionRef, null);
  assert.ok(out.matterUnits[3].omissionRef);
  assert.equal(out.matterUnits[5].access, 'restricted');
});

test('pending first unit remains the entry even when a later chapter is reader-admitted', () => {
  const assembly = fixture();
  Object.assign(slot(assembly, 10), { presence: 'pending', editorialMaterialization: 'placeholder', access: 'unavailable-on-this-client' });
  replaceState(assembly, 10, { children: [], optional: false, presence: 'pending' });
  replaceState(assembly, 100, { members: [id(10)] });
  replaceState(assembly, 101, { members: [id(32)] });
  assembly.entityRecords = assembly.entityRecords.filter(row => ![id(30), id(31)].includes(row.id));
  const out = buildFrontMatter(assembly);
  assert.equal(out.entryPageId, id(100));
  assert.equal(out.matterUnits[0].presence, 'pending');
  assert.equal(out.firstBodyPageId, id(104));
});

test('publication observation and annotations cannot remove or repartition front matter', () => {
  const assembly = fixture(), before = buildFrontMatter(assembly);
  for (const row of assembly.inventory.slots) {
    row.publicationAnnotation.label = 'held';
    row.observedReaderAdmission = 'unavailable';
  }
  const after = buildFrontMatter(assembly);
  assert.deepEqual(after.pages, before.pages);
  assert.equal(after.entryPageId, before.entryPageId);
  assert.equal(after.firstBodyPageId, before.firstBodyPageId);
  assert.deepEqual(after.matterUnits.map(row => row.entityId), before.matterUnits.map(row => row.entityId));
});

test('restricted descendants resolve through ownership without text reads or invented versions', () => {
  const assembly = fixture();
  for (const row of assembly.entityRecords.filter(row => row.kind === 'Paragraph')) {
    Object.defineProperty(row.state, 'text', { enumerable: true, get() { throw new Error('SYNTHETIC_RESTRICTED_TEXT'); } });
  }
  Object.defineProperty(assembly.unmaterializedEntities[0], 'text', { enumerable: true, get() { throw new Error('SYNTHETIC_RESTRICTED_TEXT'); } });
  const out = buildFrontMatter(assembly), encoded = JSON.stringify(out);
  assert.deepEqual(out.pages.at(-1).matterUnitIds, [id(14), id(15)]);
  assert.ok(!encoded.includes('SYNTHETIC_RESTRICTED_TEXT'));
  assert.ok(!encoded.includes('Synthetic inscription.'));
  assert.ok(!encoded.includes('synthetic-restricted'));
  assert.ok(!encoded.includes(id(33)), 'consumer metadata needs its owning unit, not private descendant materialization');
});

test('repeat projection is deterministic and does not mutate assembly or its page plan', () => {
  const assembly = fixture(), before = JSON.stringify(assembly);
  assert.deepEqual(buildFrontMatter(assembly), buildFrontMatter(assembly));
  assert.equal(JSON.stringify(assembly), before);
});

test('inscription revision and presentation metadata do not recalculate page membership', () => {
  const assembly = fixture(), before = buildFrontMatter(assembly);
  replaceState(assembly, 30, { text: 'An explicitly revised synthetic inscription.', spans: [] });
  assembly.presentation = { viewportHeight: 400, fontSize: 24 };
  assert.deepEqual(buildFrontMatter(assembly), before);
});

test('workspace pages stay outside the front prefix and canonical body entry', () => {
  const assembly = fixture(), out = buildFrontMatter(assembly);
  assert.ok(out.pages.every(row => !assembly.workspace.unplacedPages.includes(row.pageId)));
  assert.ok(out.matterUnits.every(row => row.entityId !== id(24)));
});

const hostile = [
  ['missing expected front unit page', a => replaceState(a, 102, { members: [id(12)] })],
  ['unknown page member', a => replaceState(a, 100, { members: [id(999)] })],
  ['known front paragraph without literary ownership', a => replaceState(a, 10, { children: [id(31)], optional: false, presence: 'present' })],
  ['unlisted unavailable descendant', a => { a.unmaterializedEntities = []; }],
  ['duplicate member within a page', a => replaceState(a, 100, { members: [id(30), id(30)] })],
  ['front paragraph repeated across pages', a => replaceState(a, 101, { members: [id(30), id(31), id(32)] })],
  ['front unit order reversed within a grouped page', a => replaceState(a, 101, { members: [id(32), id(31)] })],
  ['mixed front and body members', a => replaceState(a, 103, { members: [id(14), id(33), id(20)] })],
  ['body inserted before remaining front matter', a => { [a.readingOrder[2], a.readingOrder[4]] = [a.readingOrder[4], a.readingOrder[2]]; }],
  ['front matter moved to the end', a => a.readingOrder.push(a.readingOrder.shift())],
  ['back matter before first body page', a => { [a.readingOrder[4], a.readingOrder[7]] = [a.readingOrder[7], a.readingOrder[4]]; }],
  ['unplaced workspace page used as body entry', a => { a.readingOrder[4] = id(108); }],
  ['duplicate ReadingPage in order', a => a.readingOrder.splice(1, 0, a.readingOrder[0])],
  ['unknown ReadingPage in order', a => { a.readingOrder[0] = id(999); }],
  ['duplicate stable entity identity', a => a.entityRecords.push(record(a, 10))],
  ['duplicate unresolved stable identity', a => a.unmaterializedEntities.push({ ...a.unmaterializedEntities[0] })],
  ['known entity also listed as unresolved', a => a.unmaterializedEntities.push({ ...a.unmaterializedEntities[0], id: id(30) })],
  ['front matter absent from Work', a => replaceState(a, 1, { children: [id(3), id(4)] })],
  ['Body nested inside FrontMatter', a => { replaceState(a, 1, { children: [id(2), id(4)] }); replaceState(a, 2, { children: [10, 11, 12, 13, 14, 15, 3].map(id) }); }],
  ['ambiguous paragraph ownership', a => replaceState(a, 11, { children: [id(30), id(32)], optional: true, presence: 'present' })],
  ['front slot has no literary ownership', a => replaceState(a, 2, { children: [10, 11, 12, 13, 14].map(id) })],
  ['front ownership contains unknown unit', a => replaceState(a, 2, { children: [10, 11, 12, 13, 14, 15, 999].map(id) })],
  ['front ownership differs from inventory order', a => replaceState(a, 2, { children: [11, 10, 12, 13, 14, 15].map(id) })],
  ['front slot falsely claims Chapter kind', a => { slot(a, 10).kind = 'Chapter'; }],
  ['front literary presence differs from inventory', a => { slot(a, 12).presence = 'omitted'; }],
  ['empty page membership', a => replaceState(a, 100, { members: [] })],
];
for (const [name, mutate] of hostile) test(`rejects ${name}`, () => {
  const assembly = fixture(); mutate(assembly); assert.throws(() => buildFrontMatter(assembly));
});
