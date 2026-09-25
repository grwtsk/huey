import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildInventory, contentState, gitBlob, loadInventory, serializeInventory } from '../scripts/editorial_inventory.mjs';

const id = n => `he_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const revision = 'a'.repeat(40);
const scopeRefs = ['https://github.com/grwtsk/huey/issues/2#issuecomment-123'];
const chapter = '# Synthetic chapter\n\nEqual words: the the.\n';
const unplaced = '# Synthetic unplaced\n\nA working fragment.\n';
const makeSlot = (key, group, n, changes = {}) => ({
  key, entityId: id(n), kind: ['front', 'back'].includes(group) ? 'MatterUnit' : 'Chapter',
  group, label: group === 'book' ? null : `Synthetic ${key}`,
  optional: ['front', 'back'].includes(group) ? true : null,
  presence: 'present', publicationAnnotation: { label: 'working', authoritative: false }, unmaterializedAccess: null,
  sources: [], issues: [347], omissionRef: null, ...changes,
});
const makeSource = (key, path, text, role, targets, extent = 'full') => ({
  key, role, extent, revision, path, blob: gitBlob(text), scopeRefs, targets,
});

function fixture() {
  return {
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
        makeSource('canonical', 'manuscript/01.md', chapter, 'canonical', ['C01']),
        makeSource('candidate', 'planning/writing/proposal.md', 'Synthetic partial', 'candidate', ['C02'], 'partial'),
        makeSource('unplaced', 'manuscript/unplaced/one.md', unplaced, 'unplaced', ['unplaced-one']),
      ],
      supportPaths: ['manuscript/README.md'],
    },
    book: { schema: 'huey.book.v1', items: [
      { id: 'C01', movement: 'preamble', title: 'Synthetic first', path: 'manuscript/01.md', include: true },
      { id: 'C02', movement: 'interlude', title: 'Synthetic second', path: 'manuscript/02.md', include: false },
      { id: 'C03', movement: 'excursion', title: 'Synthetic third', path: 'manuscript/03.md', include: false },
    ] },
    reader: { chapters: [{ id: 'C01', status: 'admitted' }, { id: 'C02', status: 'unavailable' }] },
    trackedPaths: ['manuscript/01.md', 'manuscript/02.md', 'manuscript/03.md', 'manuscript/unplaced/one.md', 'manuscript/README.md'],
    files: { 'manuscript/01.md': chapter, 'manuscript/02.md': '<!-- Pending manuscript. -->\n', 'manuscript/03.md': '<!-- Restricted. -->', 'manuscript/unplaced/one.md': unplaced },
    sourceAvailability: { canonical: true, candidate: true, unplaced: true },
  };
}
const slot = (inventory, key) => inventory.slots.find(row => row.key === key);

test('complete metadata projection includes front, all book slots, back and unplaced', () => {
  const output = buildInventory(fixture());
  assert.deepEqual(output.slots.map(row => row.key), ['front-title', 'C01', 'C02', 'C03', 'back-note', 'unplaced-one']);
  assert.equal(output.coverage.bookSlots, 3);
  assert.ok(output.slots.every(row => row.entityVersion === null));
  assert.equal(slot(output, 'C01').editorialMaterialization, 'full');
  assert.equal(slot(output, 'C02').editorialMaterialization, 'partial');
  assert.equal(slot(output, 'C03').editorialMaterialization, 'placeholder');
  assert.equal(slot(output, 'unplaced-one').editorialMaterialization, 'unplaced');
  assert.equal(slot(output, 'front-title').presence, 'pending');
});

test('publication admission does not determine existence, IDs, ownership or order', () => {
  const input = fixture(), before = buildInventory(input);
  input.book.items.forEach(item => item.include = !item.include);
  input.reader.chapters = [];
  input.registry.slots.forEach(row => row.publicationAnnotation.label = 'held');
  const after = buildInventory(input);
  assert.deepEqual(after.slots.map(row => row.entityId), before.slots.map(row => row.entityId));
  assert.deepEqual(after.ownership, before.ownership);
  assert.equal(slot(after, 'C02').editorialMaterialization, 'partial');
  assert.equal(slot(after, 'C02').access, 'available');
  assert.equal(slot(after, 'C02').unmaterializedAccess, 'restricted');
});

test('publication annotations cannot supply or overwrite reader admission', () => {
  const input = fixture(), before = buildInventory(input);
  input.registry.slots.find(row => row.key === 'C01').publicationAnnotation.label = 'held';
  const held = buildInventory(input);
  assert.deepEqual(slot(held, 'C01').publicationAnnotation, { label: 'held', authoritative: false });
  assert.equal(slot(held, 'C01').observedReaderAdmission, 'admitted');
  input.reader.chapters[0].status = 'unavailable';
  const after = buildInventory(input);
  assert.equal(slot(after, 'C01').observedReaderAdmission, 'unavailable');
  assert.deepEqual(slot(after, 'C01').publicationAnnotation, slot(held, 'C01').publicationAnnotation);
  assert.deepEqual(after.ownership, before.ownership);
  assert.deepEqual(after.slots.map(row => [row.entityId, row.presence, row.editorialMaterialization, row.access]),
    before.slots.map(row => [row.entityId, row.presence, row.editorialMaterialization, row.access]));
});

test('scope links remain references and output carries no authority or bare publication fields', () => {
  const input = fixture(), before = buildInventory(input);
  input.registry.sources[0].scopeRefs = ['https://github.com/grwtsk/huey/pull/123'];
  const after = buildInventory(input);
  assert.deepEqual(after.sources[0].scopeRefs, input.registry.sources[0].scopeRefs);
  assert.equal(after.sources[0].access, before.sources[0].access);
  assert.deepEqual(after.slots, before.slots);
  assert.ok(after.sources.every(source => !Object.hasOwn(source, 'authority')));
  assert.ok(after.slots.every(row => !Object.hasOwn(row, 'publication') && row.publicationAnnotation.authoritative === false));
});

test('a missing file retains its stable identity and is never inferred omitted', () => {
  const input = fixture(), before = buildInventory(input);
  input.files['manuscript/03.md'] = null;
  input.trackedPaths = input.trackedPaths.filter(path => path !== 'manuscript/03.md');
  const after = buildInventory(input);
  assert.equal(slot(after, 'C03').entityId, slot(before, 'C03').entityId);
  assert.equal(slot(after, 'C03').presence, 'present');
  assert.equal(slot(after, 'C03').canonicalState, 'missing');
  assert.equal(slot(after, 'C03').editorialMaterialization, 'unavailable');
});

test('pending, absent and explicitly omitted optional matter remain distinct', () => {
  const input = fixture();
  input.registry.slots[0].presence = 'omitted';
  input.registry.slots[0].omissionRef = scopeRefs[0];
  input.registry.slots[4].presence = 'absent';
  const output = buildInventory(input);
  assert.equal(slot(output, 'front-title').presence, 'omitted');
  assert.equal(slot(output, 'back-note').presence, 'absent');
  assert.equal(slot(buildInventory(fixture()), 'front-title').presence, 'pending');
});

test('three movements own book slots while unplaced workspace is not a fourth movement', () => {
  const output = buildInventory(fixture());
  const movements = output.ownership.filter(row => row.kind === 'Movement');
  assert.equal(movements.length, 3);
  assert.deepEqual(output.ownership.find(row => row.kind === 'Body').children, movements.map(row => row.entityId));
  assert.deepEqual(output.editorialWorkspace.unplaced, [id(13)]);
  assert.ok(output.ownership.every(row => !row.children.includes(id(13))));
});

test('subsequent placement can retain the unplaced literary identity', () => {
  const input = fixture(), before = buildInventory(input);
  const row = input.registry.slots.find(row => row.group === 'unplaced');
  row.group = 'book'; row.label = null;
  input.registry.sources.find(source => source.key === 'unplaced').role = 'canonical';
  input.book.items.splice(1, 0, { id: row.key, movement: 'preamble', title: 'Synthetic placed', path: 'manuscript/unplaced/one.md', include: false });
  const after = buildInventory(input);
  assert.equal(slot(before, row.key).entityId, slot(after, row.key).entityId);
  assert.ok(after.ownership.find(row => row.key === 'preamble').children.includes(row.entityId));
  assert.deepEqual(after.editorialWorkspace.unplaced, []);
});

test('an alternate chapter proposal remains a source of one chapter, not a duplicate chapter', () => {
  const input = fixture();
  input.registry.sources.push(makeSource('alternate', 'planning/writing/alternate.md', 'Other synthetic chapter', 'candidate', ['C01']));
  input.registry.slots.find(row => row.key === 'C01').sources.push('alternate');
  input.sourceAvailability.alternate = true;
  const output = buildInventory(input);
  assert.equal(output.slots.filter(row => row.key === 'C01').length, 1);
  assert.equal(slot(output, 'C01').editorialMaterialization, 'full');
  assert.deepEqual(slot(output, 'C01').sources, ['canonical', 'alternate']);
});

test('unapplied public supporting corpus is visible as workspace resources', () => {
  const input = fixture();
  input.registry.sources.push(makeSource('resource', 'sources/public-working/example.md', 'Synthetic support', 'support', []));
  input.sourceAvailability.resource = true;
  const output = buildInventory(input);
  assert.deepEqual(output.editorialWorkspace.resources, ['resource']);
  assert.equal(output.slots.length, 6);
});

test('pre-partition manuscript flow is classified as a support resource rather than a chapter', () => {
  const input = fixture();
  input.registry.sources.push(makeSource('flow-resource', 'manuscript/flow/example.md', 'Synthetic flow', 'support', []));
  input.sourceAvailability['flow-resource'] = true;
  input.trackedPaths.push('manuscript/flow/example.md');
  const output = buildInventory(input);
  assert.deepEqual(output.editorialWorkspace.resources, ['flow-resource']);
  assert.equal(output.slots.length, 6);
  assert.ok(!output.slots.some(row => row.key === 'flow-resource'));
});

test('manuscript support resources cannot escape the flow namespace', () => {
  const input = fixture();
  input.registry.sources.push(makeSource('bad-flow-resource', 'manuscript/elsewhere.md', 'Synthetic flow', 'support', []));
  input.sourceAvailability['bad-flow-resource'] = true;
  input.trackedPaths.push('manuscript/elsewhere.md');
  assert.throws(() => buildInventory(input), /manuscript support source must live under manuscript\/flow/);
});

test('unavailable public Git artifacts stay inventoried without fake availability', () => {
  const input = fixture(); input.sourceAvailability.candidate = false;
  const output = buildInventory(input);
  assert.equal(slot(output, 'C02').editorialMaterialization, 'placeholder');
  assert.equal(slot(output, 'C02').access, 'restricted');
  assert.equal(output.sources.find(source => source.key === 'candidate').access, 'unavailable-on-this-client');
});

test('metadata output does not carry prose or inaccessible extra bytes', () => {
  const input = fixture(); input.files['private-unused'] = 'SYNTHETIC_RESTRICTED_SENTINEL';
  const output = serializeInventory(buildInventory(input));
  assert.ok(!output.includes('SYNTHETIC_RESTRICTED_SENTINEL'));
  assert.ok(!output.includes('Equal words: the the.'));
  assert.ok(!output.includes('A working fragment.'));
  assert.ok(!output.includes('hev1:'));
});

test('deterministic output and a separate metadata digest', () => {
  const input = fixture();
  assert.equal(serializeInventory(buildInventory(input)), serializeInventory(buildInventory(structuredClone(input))));
  assert.match(buildInventory(input).inventoryDigest, /^sha256:[0-9a-f]{64}$/);
  const before = buildInventory(input); input.registry.slots[0].publicationAnnotation.label = 'held';
  assert.notEqual(buildInventory(input).inventoryDigest, before.inventoryDigest);
  assert.equal(buildInventory(input).slots[0].entityId, before.slots[0].entityId);
});

test('legacy reader aliases are observed without guessing equivalence', () => {
  const input = fixture(); input.reader.chapters.push({ id: 'EX', status: 'unavailable' });
  const output = buildInventory(input);
  assert.deepEqual(output.unmappedReaderAliases, ['EX']);
  assert.equal(slot(output, 'C03').observedReaderAdmission, 'not-listed');
});

const hostile = [
  ['dropped book slot', x => x.registry.slots.splice(3, 1), /exactly cover/],
  ['new book slot unaccounted', x => x.book.items.push({ ...x.book.items[2], id: 'C04', path: 'manuscript/04.md' }), /exactly cover/],
  ['duplicate stable ID', x => x.registry.slots[1].entityId = x.registry.slots[0].entityId, /duplicate EntityID/],
  ['ordinal identity', x => x.registry.slots[1].entityId = 'paragraph-1', /EntityID/],
  ['route identity', x => x.registry.slots[1].entityId = '/huey/1', /EntityID/],
  ['path identity', x => x.registry.slots[1].entityId = 'manuscript/01.md', /EntityID/],
  ['missing presence', x => delete x.registry.slots[1].presence, /missing or unknown/],
  ['collapsed state enum', x => x.registry.slots[1].publicationAnnotation.label = 'restricted', /publication/],
  ['legacy publication replaces annotation', x => { x.registry.slots[1].publication = 'cleared'; delete x.registry.slots[1].publicationAnnotation; }, /missing or unknown/],
  ['legacy publication alongside annotation', x => x.registry.slots[1].publication = 'admitted', /missing or unknown/],
  ['bare publication annotation', x => x.registry.slots[1].publicationAnnotation = 'working', /must be an object/],
  ['missing non-authoritative marker', x => delete x.registry.slots[1].publicationAnnotation.authoritative, /missing or unknown/],
  ['asserted publication authority', x => x.registry.slots[1].publicationAnnotation.authoritative = true, /non-authoritative publication/],
  ['string false publication authority', x => x.registry.slots[1].publicationAnnotation.authoritative = 'false', /non-authoritative publication/],
  ['admission as editorial annotation', x => x.registry.slots[1].publicationAnnotation.label = 'admitted', /non-authoritative publication/],
  ['clearance as editorial annotation', x => x.registry.slots[1].publicationAnnotation.label = 'cleared', /non-authoritative publication/],
  ['fabricated annotation decision binding', x => x.registry.slots[1].publicationAnnotation.decision = scopeRefs[0], /missing or unknown/],
  ['clearance disguised as reader admission', x => x.reader.chapters[0].status = 'cleared', /invalid reader admission observation/],
  ['ambiguous reader admission', x => x.reader.chapters.push({ id: 'C01', status: 'unavailable' }), /ambiguous reader admission observation/],
  ['omission without decision', x => x.registry.slots[0].presence = 'omitted', /omission/],
  ['required matter omitted', x => { x.registry.slots[0].optional = false; x.registry.slots[0].presence = 'omitted'; x.registry.slots[0].omissionRef = scopeRefs[0]; }, /omission/],
  ['unknown tracked manuscript', x => x.trackedPaths.push('manuscript/unknown.md'), /unclassified/],
  ['duplicate manuscript ownership', x => x.book.items[1].path = x.book.items[0].path, /duplicate book/],
  ['fourth movement', x => x.registry.containers.movements.unplaced = id(19), /missing or unknown/],
  ['interleaved movement order', x => x.book.items.reverse(), /movement boundaries/],
  ['book slot is a ReadingPage', x => x.registry.slots[1].kind = 'ReadingPage', /Chapter/],
  ['unapplied prose in a placeholder', x => x.files['manuscript/03.md'] = 'Unregistered synthetic prose', /pinned canonical/],
  ['changed canonical bytes', x => x.files['manuscript/01.md'] += 'Changed', /differs from pinned/],
  ['hidden restricted locator', x => x.registry.slots[3].privatePath = '/private/secret', /missing or unknown/],
  ['hidden restricted fingerprint', x => x.registry.slots[3].fingerprint = 'b'.repeat(64), /missing or unknown/],
  ['hidden source excerpt', x => x.registry.sources[0].excerpt = 'Synthetic excerpt', /missing or unknown/],
  ['source parent traversal', x => x.registry.sources[0].path = 'manuscript/../private.md', /unsafe/],
  ['source absolute path', x => x.registry.sources[0].path = '/private/private.md', /unsafe/],
  ['known restricted source prefix', x => x.registry.sources[0].path = 'sources/restricted/secret.md', /unsafe/],
  ['raw source prefix', x => x.registry.sources[0].path = 'sources/raw/secret.md', /unsafe/],
  ['pending matter linked to content', x => { x.registry.slots[0].sources = ['candidate']; x.registry.sources[1].targets.push('front-title'); }, /nonpresent matter/],
  ['missing scope references', x => x.registry.sources[0].scopeRefs = [], /scope reference/],
  ['legacy authority replaces scope references', x => { x.registry.sources[0].authority = scopeRefs; delete x.registry.sources[0].scopeRefs; }, /missing or unknown/],
  ['legacy authority alongside scope references', x => x.registry.sources[0].authority = scopeRefs, /missing or unknown/],
  ['scalar scope reference', x => x.registry.sources[0].scopeRefs = scopeRefs[0], /must be an array/],
  ['capability-shaped scope reference', x => x.registry.sources[0].scopeRefs = [{ kind: 'Grant', url: scopeRefs[0] }], /scope reference/],
  ['unpinned revision', x => x.registry.sources[0].revision = 'main', /unpinned/],
  ['array-valued basis revision', x => x.registry.basisRevision = [revision], /malformed basis/],
  ['array-valued source revision', x => x.registry.sources[0].revision = [revision], /unpinned/],
  ['array-valued source blob', x => x.registry.sources[0].blob = [x.registry.sources[0].blob], /unpinned/],
  ['malformed blob', x => x.registry.sources[0].blob = '123', /unpinned/],
  ['broken source reference', x => x.registry.slots[1].sources = [], /references disagree/],
  ['invented canonical parent', x => x.registry.sources[0].targets.push('C02'), /ambiguous canonical/],
  ['untracked canonical prose', x => x.trackedPaths = x.trackedPaths.filter(path => path !== 'manuscript/01.md'), /untracked/],
];
for (const [name, mutate, expected] of hostile) test(`rejects ${name}`, () => {
  const input = fixture(); mutate(input); assert.throws(() => buildInventory(input), expected);
});

test('placeholder detection does not call comments or empty files completed prose', () => {
  for (const text of ['', ' \n', '<!-- Pending -->', '<!-- one -->\n<!-- two -->']) assert.equal(contentState(text), 'comment-placeholder');
  assert.equal(contentState(null), 'missing');
  assert.equal(contentState('<!-- status -->\n# Synthetic text'), 'present-content');
});

test('Git loader inspects pinned metadata, rejects drift and never follows a symlink', () => {
  const root = mkdtempSync(join(tmpdir(), 'huey-editorial-inventory-'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const write = (path, text) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); };
  try {
    const input = fixture();
    for (const [path, text] of Object.entries(input.files)) write(path, text);
    write('manuscript/README.md', '# Synthetic support');
    write('planning/writing/proposal.md', 'Synthetic partial');
    git(['init', '-q']); git(['add', '.']);
    git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Synthetic inventory fixture']);
    const head = git(['rev-parse', 'HEAD']).trim();
    input.registry.basisRevision = head; input.registry.sources.forEach(source => source.revision = head);
    write('planning/editorial-inventory/registry.json', JSON.stringify(input.registry));
    write('book.yaml', JSON.stringify(input.book));
    write('reader/content/book.json', JSON.stringify(input.reader));
    const output = loadInventory(root);
    assert.equal(output.sources.filter(source => source.access === 'available').length, 3);
    input.registry.sources[1].blob = 'b'.repeat(40);
    write('planning/editorial-inventory/registry.json', JSON.stringify(input.registry));
    assert.throws(() => loadInventory(root), /pinned public artifact mismatch/);
    input.registry.sources[1].revision = 'c'.repeat(40);
    write('planning/editorial-inventory/registry.json', JSON.stringify(input.registry));
    assert.equal(loadInventory(root).sources[1].access, 'unavailable-on-this-client');
    rmSync(join(root, 'manuscript/01.md'));
    symlinkSync(join(root, 'planning/writing/proposal.md'), join(root, 'manuscript/01.md'));
    assert.throws(() => loadInventory(root), /nonregular working source/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
