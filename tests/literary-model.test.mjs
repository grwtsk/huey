import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonical, entityVersion, graphemeBoundaries, hostileBundle, profile, seal, validateBundle, validateHostile } from '../scripts/literary_model.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../planning/literary-model/${name}.json`, import.meta.url), 'utf8'));
const examples = read('examples'), hostile = read('hostile');
const snapshot = name => examples.snapshots.find(item => item.name === name);
const baseline = snapshot('baseline');
const paragraph = baseline.entities.find(item => item.kind === 'Paragraph' && item.state.text === 'the the');
const entity = (name, id = paragraph.id) => snapshot(name).entities.find(item => item.id === id);
const parent = (name, id = paragraph.id) => snapshot(name).entities.find(item => item.state.children?.includes(id));

test('profile includes required literary kinds, annotations and reserved interfaces', () => {
  for (const kind of ['Work', 'Matter', 'FrontMatter', 'Body', 'BackMatter', 'MatterUnit', 'Movement', 'Chapter', 'ChapterPart', 'Section', 'ReadingPage', 'Block', 'Paragraph', 'Sentence', 'LexicalOccurrence', 'GraphemeOccurrence', 'PresentationBasis', 'PresentationRelation']) assert.ok(profile.entityKinds[kind], kind);
  assert.equal(profile.entityKinds.Matter.form, 'abstract');
  for (const role of ['Scene', 'Reflection', 'Argument', 'Transition']) assert.ok(profile.annotationKinds.includes(role));
  assert.equal(profile.storageRule, 'shard identity more finely than storage');
});

test('committed synthetic examples and hostile recipes validate deterministically', () => {
  const result = validateBundle(examples);
  assert.equal(result.snapshots, 6);
  assert.equal(result.exactStates, 27);
  assert.equal(validateHostile(examples, hostile), hostile.cases.length);
  assert.deepEqual(validateBundle(examples), result);
});

for (const recipe of hostile.cases) test(`rejects hostile case: ${recipe.name}`, () => {
  assert.throws(() => validateBundle(hostileBundle(examples, recipe)), { code: recipe.error });
});

test('represented Body ownership goes through a Movement without redefining paragraphs', () => {
  assert.deepEqual(profile.entityKinds.Body.children, ['Movement']);
  const body = baseline.entities.find(item => item.kind === 'Body');
  assert.equal(body.state.children.length, 1, 'the fixture is a partial synthetic work');
  const movement = baseline.entities.find(item => item.id === body.state.children[0]);
  assert.equal(movement.kind, 'Movement');
  assert.ok(movement.state.children.includes(parent('baseline').id));
  for (const name of ['reordered', 'moved', 'revised', 'route-changed', 'page-changed']) {
    assert.deepEqual(entity(name, movement.id), movement);
  }
});

test('partial snapshots allow unplaced roots and a single detached matter container of each kind', () => {
  const kinds = ['Work', 'FrontMatter', 'Body', 'BackMatter', 'Movement', 'Chapter', 'Section', 'Block', 'Paragraph'];
  const ids = [
    'he_fd36cdf1-2363-49c6-8866-39e36fcc2302',
    'he_45535453-c913-49d5-97f9-878b0bf25d5d',
    'he_eb93e3be-4a5d-4267-a22f-a343a40158a8',
    'he_31a67972-2db6-439d-8f47-31680fc65c50',
    'he_c7f71cf4-1772-4401-a46e-0e8a6f793853',
    'he_b26625be-6d8d-4d7e-9a1e-267d9e3d42b4',
    'he_6542ae90-0719-407b-a2c4-10d2ba64fd59',
    'he_6d934764-2624-40e7-9546-c8b4c42cbc88',
    'he_0e983c95-116a-401c-b3c7-4142471a13e2',
  ];
  const entities = kinds.map((kind, index) => seal({
    id: ids[index],
    kind,
    state: kind === 'Paragraph' ? { text: 'Synthetic unplaced paragraph', spans: [] }
      : kind === 'Block' ? { format: 'plain', text: 'Synthetic unplaced block' } : { children: [] },
  }));
  const partial = { model: profile.model, snapshots: [{ name: 'partial', entities, routes: [], annotations: [], lineage: [] }] };
  assert.equal(validateBundle(partial).exactStates, kinds.length);
  for (const kind of ['Work', 'FrontMatter', 'Body', 'BackMatter']) assert.equal(profile.entityKinds[kind].maxPerSnapshot, 1);
  assert.equal(profile.entityKinds.Movement.maxPerSnapshot, 3);
  partial.snapshots[0].entities = entities.filter(item => !['Work', 'FrontMatter', 'Body', 'BackMatter'].includes(item.kind));
  assert.equal(validateBundle(partial).exactStates, 5, 'missing containers are not invented or treated as omitted');
  const movementIds = [
    'he_b8f6f0d5-239a-4729-9ab0-7648db8b3598',
    'he_4cba1297-eefd-4b88-a508-49a123f72779',
    'he_63dd94ac-dc0d-488f-90c9-fb86b6c9c40c',
  ];
  for (let count = 0; count <= 3; count++) {
    const movements = Array.from({ length: count }, (_, index) => seal({
      id: movementIds[index], kind: 'Movement', state: { children: [] },
    }));
    const body = seal({ ...entities.find(item => item.kind === 'Body'), state: { children: movements.map(item => item.id) } });
    partial.snapshots[0].entities = [body, ...movements];
    assert.equal(validateBundle(partial).exactStates, count + 1, `${count} represented movements is a valid partial structure`);
  }
});

test('equal lexical and grapheme values retain separate occurrence identities', () => {
  for (const [kind, text] of [['LexicalOccurrence', 'the'], ['GraphemeOccurrence', 't']]) {
    const occurrences = baseline.entities.filter(item => item.kind === kind && item.state.text === text);
    assert.equal(occurrences.length, 2);
    assert.notEqual(occurrences[0].id, occurrences[1].id);
    assert.notEqual(occurrences[0].version, occurrences[1].version);
  }
});

test('reordering and moving preserve the complete paragraph record', () => {
  assert.deepEqual(entity('reordered'), paragraph);
  assert.deepEqual(entity('moved'), paragraph);
  assert.equal(parent('baseline').id, parent('reordered').id);
  assert.notDeepEqual(parent('baseline').state.children, parent('reordered').state.children);
  assert.notEqual(parent('baseline').id, parent('moved').id);
  assert.notEqual(parent('baseline').version, parent('reordered').version);
  const move = snapshot('moved').lineage[0];
  assert.equal(move.beforeSnapshot, 'reordered');
  assert.equal(move.afterSnapshot, 'moved');
  assert.deepEqual(move.from, move.to);
});

test('ordinary revision changes the paragraph version while retaining its ID and history', () => {
  const revised = entity('revised');
  assert.equal(revised.id, paragraph.id);
  assert.notEqual(revised.version, paragraph.version);
  assert.equal(paragraph.state.text, 'the the');
  assert.equal(revised.state.text, 'the the.');
  assert.equal(parent('moved').version, parent('revised').version, 'container digest is not a recursive subtree digest');
  assert.equal(snapshot('revised').lineage[0].from[0].version, paragraph.version);
  assert.equal(snapshot('revised').lineage[0].to[0].version, revised.version);
});

test('route change changes no entity and page membership change changes only page state', () => {
  assert.notDeepEqual(snapshot('revised').routes, snapshot('route-changed').routes);
  assert.deepEqual(snapshot('revised').entities, snapshot('route-changed').entities);
  const page = baseline.entities.find(item => item.kind === 'ReadingPage');
  assert.notEqual(entity('route-changed', page.id).version, entity('page-changed', page.id).version);
  for (const item of snapshot('route-changed').entities.filter(item => item.kind !== 'ReadingPage')) assert.deepEqual(entity('page-changed', item.id), item);
  assert.equal(entity('page-changed', page.id).kind, 'ReadingPage');
});

test('present, pending, omitted and absent are four explicit states', () => {
  const units = baseline.entities.filter(item => item.kind === 'MatterUnit');
  assert.deepEqual(units.map(item => item.state.presence).sort(), ['absent', 'omitted', 'pending', 'present']);
  const pending = units.find(item => item.state.presence === 'pending');
  const omitted = seal({ ...pending, state: { ...pending.state, presence: 'omitted' } });
  assert.notEqual(pending.version, omitted.version);
});

test('multiple projections and revised annotations do not acquire ownership or change inscription', () => {
  const copy = structuredClone(examples);
  const first = copy.snapshots[0], page = first.entities.find(item => item.kind === 'ReadingPage');
  first.entities.push(seal({ ...page, id: 'he_ccc1b1ce-0674-45ac-a376-551a5c1e1101' }));
  first.annotations[1].value = { analysis: 'another synthetic interpretation', lexeme: 'different assignment' };
  first.annotations.push({ ...first.annotations[0], kind: 'Scene' });
  validateBundle(copy);
  assert.deepEqual(first.entities.find(item => item.id === paragraph.id), paragraph);
});

test('presentation is descriptive and cannot rewrite its target inscription', () => {
  const copy = structuredClone(examples), first = copy.snapshots[0];
  const relation = first.entities.find(item => item.kind === 'PresentationRelation');
  const target = first.entities.find(item => item.id === relation.state.target);
  const original = structuredClone(target), oldVersion = relation.version;
  relation.state.description = 'Another synthetic presentation description';
  Object.assign(relation, seal(relation));
  validateBundle(copy);
  assert.notEqual(relation.version, oldVersion);
  assert.deepEqual(target, original);
});

test('canonical JSON has fixed field sorting and does not normalize inscription', () => {
  assert.equal(canonical({ z: [2, 1], a: { y: true, b: null }, text: 'e\u0301' }), '{"a":{"b":null,"y":true},"text":"é","z":[2,1]}');
  const vector = { id: 'he_c944a9a1-296e-480d-bcfb-eb19aef70e98', kind: 'Paragraph', state: { text: 'e\u0301', spans: [] } };
  assert.equal(entityVersion(vector), 'hev1:cf8043ae6ccc259c8307fb4ad737b153705ff52606a1d94cbe784e098b27aa87');
  assert.equal(entityVersion({ state: vector.state, kind: vector.kind, id: vector.id }), entityVersion(vector));
  assert.notEqual(entityVersion({ ...vector, state: { ...vector.state, text: 'é' } }), entityVersion(vector));
  assert.notEqual(canonical([1, 2]), canonical([2, 1]));
});

test('canonical JSON rejects values that cannot identify exact portable state', () => {
  for (const value of [1.5, -0, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => canonical(value), { code: 'CANONICAL_NUMBER' });
  assert.throws(() => canonical('\ud800'), { code: 'UNICODE_SCALAR' });
  assert.throws(() => canonical({ é: 1 }), { code: 'CANONICAL_KEY' });
  for (const value of [undefined, new Date(0), [undefined], Array(1)]) assert.throws(() => canonical(value), { code: 'CANONICAL_VALUE' });
});

test('grapheme boundaries preserve combining sequences and family emoji', () => {
  assert.deepEqual([...graphemeBoundaries('e\u0301 👩‍👩‍👧‍👦')], [0, 2, 3, 14]);
  assert.deepEqual([...graphemeBoundaries('🇺🇳')], [0, 4]);
  assert.deepEqual([...graphemeBoundaries('')], [0]);
});

test('reserved split/join/replacement/retirement vocabulary is not an operation implementation', () => {
  for (const kind of ['split', 'join', 'replace', 'retire']) {
    const copy = structuredClone(examples);
    copy.snapshots[2].lineage[0].kind = kind;
    assert.throws(() => validateBundle(copy), { code: 'LINEAGE_UNIMPLEMENTED' });
  }
});
