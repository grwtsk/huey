import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRouteAddress, formatEntityRoute, validateRouteProjection,
  resolveRouteAddress, assertAliasContinuity } from '../src/routes.mjs';

const id = n => `he_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const version = `hev1:${'a'.repeat(64)}`, older = `hev1:${'b'.repeat(64)}`;
const front = id(1), firstPage = id(2), chapter = id(3), secondPage = id(4), paragraph = id(5);
const unplaced = id(6), unplacedPage = id(7), unplacedParagraph = id(8), restricted = id(9), unavailable = id(10);
const target = (entity, kind, slotIds, pageIds, extra = {}) => ({
  id: entity, kind, version, access: 'available', unresolved: false, slotIds, pageIds, ...extra,
});
const slot = (entity, group, extra = {}) => ({
  id: entity, group, presence: 'present', editorialMaterialization: 'full', access: 'available',
  publicationAnnotation: { label: 'working', authoritative: false }, observedReaderAdmission: 'not-listed', ...extra,
});
function fixture() {
  return {
    schema: 'huey.route-projection.v1', projection: 'editorial', entryPageId: firstPage,
    targets: [
      target(front, 'MatterUnit', [front], [firstPage], { unresolved: true }),
      target(firstPage, 'ReadingPage', [front], [firstPage], { unresolved: true }),
      target(chapter, 'Chapter', [chapter], [secondPage]),
      target(secondPage, 'ReadingPage', [chapter], [secondPage]),
      target(paragraph, 'Paragraph', [chapter], [secondPage]),
      target(unplaced, 'Chapter', [unplaced], [unplacedPage]),
      target(unplacedPage, 'ReadingPage', [unplaced], [unplacedPage]),
      target(unplacedParagraph, 'Paragraph', [unplaced], [unplacedPage]),
      target(restricted, 'Chapter', [restricted], [], { access: 'restricted', version: null }),
      target(unavailable, 'Chapter', [unavailable], [], { access: 'unavailable-on-this-client', version: null }),
    ],
    slots: [
      slot(front, 'front', { presence: 'pending', editorialMaterialization: 'placeholder' }),
      slot(chapter, 'book', { observedReaderAdmission: 'admitted' }),
      slot(unplaced, 'unplaced', { editorialMaterialization: 'unplaced' }),
      slot(restricted, 'book', { access: 'restricted', editorialMaterialization: 'unavailable' }),
      slot(unavailable, 'book', { access: 'unavailable-on-this-client', editorialMaterialization: 'unavailable' }),
    ],
    aliases: [
      { path: '/huey/front/half-title', targetId: front },
      { path: '/huey/chapter/example', targetId: chapter },
      { path: '/huey/page/opening', targetId: firstPage },
      { path: '/huey/unplaced/example', targetId: unplaced },
    ],
  };
}

test('route syntax agrees with every concrete v1 model kind without Unicode segmentation', () => {
  const model = JSON.parse(readFileSync(new URL('../../planning/literary-model/v1.json', import.meta.url), 'utf8'));
  assert.ok(new RegExp(model.entityID).test(paragraph));
  assert.ok(new RegExp(model.entityVersion).test(version));
  for (const [kind, details] of Object.entries(model.entityKinds)) {
    if (details.form === 'abstract') {
      assert.throws(() => formatEntityRoute({ id: paragraph, kind }));
      continue;
    }
    const address = formatEntityRoute({ id: paragraph, kind, version });
    const route = parseRouteAddress(address);
    assert.equal(route.id, paragraph); assert.equal(route.version, version);
    assert.equal(route.kind, kind === 'ReadingPage' ? 'page' : kind === 'Paragraph' ? 'paragraph' : 'entity');
  }
});

test('origin-relative grammar round trips typed and generic routes with exact versions', () => {
  for (const family of ['entity', 'page', 'paragraph']) {
    const path = `/huey/${family}/${paragraph}`;
    assert.deepEqual(parseRouteAddress(path), { kind: family, id: paragraph, path, version: null });
    assert.deepEqual(parseRouteAddress(`${path}/v/${version}/`), { kind: family, id: paragraph, path, version });
  }
  for (const family of ['front', 'back', 'chapter', 'unplaced', 'page']) {
    const path = `/huey/${family}/a-readable-name`;
    assert.deepEqual(parseRouteAddress(`${path}/v/${version}/`),
      { kind: 'alias', family, slug: 'a-readable-name', path, version });
  }
  assert.deepEqual(parseRouteAddress('/huey/'), { kind: 'entry', path: '/huey', version: null });
});

for (const address of [
  '', '/', 'huey', '//example.com/huey', 'https://example.com/huey', 'javascript:alert(1)',
  '/huey//', '/huey//chapter/example', '/huey/../chapter/example', '/huey/chapter/..',
  '/huey/chapter/.', '/huey/chapter/a//', '/huey/chapter/A', '/huey/chapter/a--b',
  '/huey/chapter/-a', '/huey/chapter/a-', '/huey/chapter/a_b', '/huey/chapter/é',
  '/huey/chapter/a b', '/huey/chapter/a\nb', '/huey/chapter/a\u0000b', '/huey/chapter/a\u007fb',
  '/huey\\chapter\\example', '/huey/chapter/%2e%2e', '/huey/chapter/a%2fb', '/huey/chapter/a%5cb',
  '/huey/chapter/%252f', '/huey/chapter/%', '/huey/chapter/a?next=https://example.com',
  '/huey?projection=editorial', '/huey?x=1&x=2', '/huey#book', '/huey#read/C01/1/x',
  '/huey2/chapter/a', '/huey/entity/example', '/huey/paragraph/1', '/huey/paragraph/C01-p0001',
  `/huey/paragraph/${paragraph.toUpperCase()}`, `/huey/paragraph/${paragraph.replace('-4000-', '-1000-')}`,
  `/huey/paragraph/${paragraph.replace('-8000-', '-7000-')}`, '/huey/chapter/' + 'a'.repeat(65),
  `/huey/v/${version}`, `/huey/entity/${paragraph}/version/${version}`,
  `/huey/entity/${paragraph}/v/${'a'.repeat(64)}`, `/huey/entity/${paragraph}/v/hev1:${'A'.repeat(64)}`,
  `/huey/entity/${paragraph}/v/hev1:${'a'.repeat(63)}`, `/huey/entity/${paragraph}/v/${version}/extra`,
  '/huey/chapter/' + 'a'.repeat(512), null, {}, 12,
]) test(`hostile route rejected: ${JSON.stringify(address)}`, () => {
  assert.deepEqual(parseRouteAddress(address), { kind: 'invalid' });
});

test('first pending front page remains the entry rather than jumping to admitted text', () => {
  const catalog = fixture(), result = resolveRouteAddress('/huey', catalog);
  assert.equal(result.status, 'unresolved'); assert.equal(result.entityId, firstPage);
  assert.equal(result.canonicalPath, '/huey'); assert.equal(result.redirectTo, null);
  assert.equal(result.slots[0].presence, 'pending'); assert.equal(result.slots[0].observedReaderAdmission, 'not-listed');
  assert.equal(resolveRouteAddress('/huey/', catalog).redirectTo, '/huey');
  catalog.entryPageId = null;
  assert.deepEqual(resolveRouteAddress('/huey', catalog), { status: 'unresolved', projection: 'editorial', entryPageId: null });
});

test('aliases and generic routes canonicalize to kind-specific stable routes', () => {
  const catalog = fixture();
  for (const address of [`/huey/entity/${paragraph}`, `/huey/paragraph/${paragraph}/`]) {
    const result = resolveRouteAddress(address, catalog);
    assert.equal(result.entityId, paragraph); assert.equal(result.redirectTo, `/huey/paragraph/${paragraph}`);
  }
  const result = resolveRouteAddress(`/huey/page/opening/v/${version}/`, catalog);
  assert.equal(result.entityId, firstPage); assert.equal(result.requestedVersion, version);
  assert.equal(result.redirectTo, `/huey/page/${firstPage}/v/${version}`);
  assert.equal(resolveRouteAddress(`/huey/paragraph/${paragraph}`, catalog).redirectTo, null);
});

test('exact local versions match or stay unavailable without current-version fallback', () => {
  const catalog = fixture(), current = `/huey/paragraph/${paragraph}`;
  assert.equal(resolveRouteAddress(`${current}/v/${version}`, catalog).status, 'resolved');
  const mismatch = resolveRouteAddress(`${current}/v/${older}`, catalog);
  assert.equal(mismatch.status, 'version-unavailable'); assert.equal(mismatch.entityVersion, null);
  assert.equal(mismatch.requestedVersion, older); assert.equal(mismatch.canonicalPath, `${current}/v/${older}`);
  const alias = resolveRouteAddress(`/huey/chapter/example/v/${older}`, catalog);
  assert.equal(alias.status, 'version-unavailable');
  assert.equal(alias.redirectTo, `/huey/entity/${chapter}/v/${older}`);
  catalog.targets.find(t => t.id === paragraph).version = null;
  assert.equal(resolveRouteAddress(current, catalog).status, 'unavailable');
  assert.equal(resolveRouteAddress(`${current}/v/${version}`, catalog).status, 'version-unavailable');
});

test('restricted and client-unavailable outcomes withhold selected versions', () => {
  const catalog = fixture();
  for (const [entity, status] of [[restricted, 'restricted'], [unavailable, 'unavailable']]) {
    for (const suffix of ['', `/v/${version}`]) {
      const result = resolveRouteAddress(`/huey/entity/${entity}${suffix}`, catalog);
      assert.equal(result.status, status); assert.equal(result.entityVersion, null);
      assert.equal(result.entityId, entity);
    }
  }
});

test('unknown references and mistyped stable routes reveal no catalog detail', () => {
  const catalog = fixture();
  for (const address of [`/huey/entity/${id(99)}`, '/huey/chapter/unknown', `/huey/page/${paragraph}`, `/huey/paragraph/${chapter}`]) {
    assert.deepEqual(resolveRouteAddress(address, catalog), { status: 'unknown' });
  }
  assert.deepEqual(resolveRouteAddress('/huey?access=available', catalog), { status: 'invalid-route' });
});

test('projection selection is external to addresses and publication exclusion does not erase editorial existence', () => {
  const editorial = fixture(), publication = fixture();
  publication.projection = 'publication'; publication.entryPageId = null;
  publication.targets = publication.targets.filter(t => t.slotIds.includes(chapter));
  publication.slots = publication.slots.filter(s => s.id === chapter);
  publication.aliases = publication.aliases.filter(a => a.targetId === chapter);
  const address = `/huey/paragraph/${unplacedParagraph}`;
  assert.equal(resolveRouteAddress(address, editorial).status, 'resolved');
  assert.deepEqual(resolveRouteAddress(address, publication), { status: 'unknown' });
  editorial.slots.find(s => s.id === unplaced).publicationAnnotation.label = 'held';
  assert.equal(resolveRouteAddress(address, editorial).status, 'resolved');
  assert.equal(resolveRouteAddress(`/huey/paragraph/${paragraph}`, publication).projection, 'publication');
});

test('paragraph routes survive moves and page changes; page candidates are explicit', () => {
  const before = fixture(), after = fixture();
  const row = after.targets.find(t => t.id === paragraph);
  row.slotIds = [unplaced]; row.pageIds = [unplacedPage];
  const address = `/huey/paragraph/${paragraph}`;
  const a = resolveRouteAddress(address, before), b = resolveRouteAddress(address, after);
  assert.equal(a.entityId, b.entityId); assert.equal(a.entityVersion, b.entityVersion);
  assert.equal(a.canonicalPath, b.canonicalPath); assert.notDeepEqual(a.pageIds, b.pageIds);
  row.pageIds = [secondPage, unplacedPage];
  assert.deepEqual(resolveRouteAddress(address, after).pageIds, [secondPage, unplacedPage]);
});

test('route rename adds an alias without replacing old address or stable identity', () => {
  const before = fixture(), after = fixture();
  after.aliases.push({ path: '/huey/chapter/new-name', targetId: chapter });
  assertAliasContinuity(before.aliases, after.aliases);
  assert.equal(resolveRouteAddress('/huey/chapter/example', after).entityId,
    resolveRouteAddress('/huey/chapter/new-name', after).entityId);
  assert.throws(() => assertAliasContinuity(before.aliases, after.aliases.slice(1)), /removed or retargeted/);
  after.aliases[1].targetId = unplaced;
  assert.throws(() => assertAliasContinuity(before.aliases, after.aliases), /removed or retargeted/);
  assert.throws(() => assertAliasContinuity([], [...before.aliases, before.aliases[0]]), /duplicate alias/);
});

test('moving an unplaced Chapter into Body preserves its old alias and stable identity', () => {
  const before = fixture(), after = fixture();
  const moved = after.slots.find(s => s.id === unplaced);
  moved.group = 'book'; moved.editorialMaterialization = 'full';
  after.aliases.push({ path: '/huey/chapter/placed-example', targetId: unplaced });
  assertAliasContinuity(before.aliases, after.aliases);
  const oldRoute = resolveRouteAddress('/huey/unplaced/example', after);
  const newRoute = resolveRouteAddress('/huey/chapter/placed-example', after);
  assert.equal(oldRoute.status, 'resolved'); assert.equal(oldRoute.entityId, unplaced);
  assert.equal(oldRoute.entityId, newRoute.entityId); assert.equal(oldRoute.canonicalPath, newRoute.canonicalPath);
  assert.equal(oldRoute.slots[0].group, 'book');
});

test('moving a MatterUnit to back matter preserves its historical front alias', () => {
  const before = fixture(), after = fixture();
  after.slots.find(s => s.id === front).group = 'back';
  after.aliases.push({ path: '/huey/back/relocated-matter', targetId: front });
  assertAliasContinuity(before.aliases, after.aliases);
  const oldRoute = resolveRouteAddress('/huey/front/half-title', after);
  const newRoute = resolveRouteAddress('/huey/back/relocated-matter', after);
  assert.equal(oldRoute.entityId, front); assert.equal(oldRoute.entityId, newRoute.entityId);
  assert.equal(oldRoute.canonicalPath, newRoute.canonicalPath); assert.equal(oldRoute.slots[0].group, 'back');
});

const mutations = [
  ['extra catalog payload', c => c.text = 'Never emit'],
  ['missing catalog field', c => delete c.aliases],
  ['unknown schema', c => c.schema = 'other'],
  ['unknown projection', c => c.projection = 'privileged'],
  ['duplicate target', c => c.targets.push(c.targets[0])],
  ['malformed target ID', c => c.targets[0].id = 'front-1'],
  ['abstract target kind', c => c.targets[0].kind = 'Matter'],
  ['unknown target kind', c => c.targets[0].kind = 'TypesetPage'],
  ['target text payload', c => c.targets[0].text = 'Never emit'],
  ['bad exact version', c => c.targets[0].version = 'a'.repeat(40)],
  ['bad target access', c => c.targets[0].access = 'public'],
  ['nonboolean unresolved', c => c.targets[0].unresolved = 'yes'],
  ['restricted fingerprint', c => c.targets.find(t => t.id === restricted).version = version],
  ['unavailable fingerprint', c => c.targets.find(t => t.id === unavailable).version = version],
  ['repeated page reference', c => c.targets[0].pageIds.push(firstPage)],
  ['sparse page reference', c => c.targets[0].pageIds = new Array(1)],
  ['nonarray page reference', c => c.targets[0].pageIds = firstPage],
  ['unknown page reference', c => c.targets[0].pageIds = [id(99)]],
  ['mistyped page reference', c => c.targets[0].pageIds = [paragraph]],
  ['unknown slot reference', c => c.targets[0].slotIds = [id(99)]],
  ['repeated slot reference', c => c.targets[0].slotIds.push(front)],
  ['sparse slot reference', c => c.targets[0].slotIds = new Array(1)],
  ['duplicate slot', c => c.slots.push(c.slots[0])],
  ['slot without target', c => c.slots[0].id = id(99)],
  ['slot target omits self metadata', c => c.targets[0].slotIds = []],
  ['slot target borrows another slot', c => c.targets[0].slotIds = [chapter]],
  ['slot target combines self and another slot', c => c.targets[0].slotIds.push(chapter)],
  ['front slot wrong target kind', c => c.targets[0].kind = 'Chapter'],
  ['back slot wrong target kind', c => { c.slots[0].group = 'back'; c.targets[0].kind = 'Paragraph'; }],
  ['book slot wrong target kind', c => c.targets.find(t => t.id === chapter).kind = 'MatterUnit'],
  ['unplaced slot wrong target kind', c => c.targets.find(t => t.id === unplaced).kind = 'Movement'],
  ['slot source locator', c => c.slots[0].source = 'restricted-locator'],
  ['unknown group', c => c.slots[0].group = 'movement4'],
  ['unknown presence', c => c.slots[0].presence = 'missing'],
  ['unknown materialization', c => c.slots[0].editorialMaterialization = 'ready'],
  ['unknown slot access', c => c.slots[0].access = 'public'],
  ['available target over restricted slot', c => c.slots[0].access = 'restricted'],
  ['available target over unavailable slot', c => c.slots[0].access = 'unavailable-on-this-client'],
  ['unavailable target over restricted slot', c => c.targets.find(t => t.id === restricted).access = 'unavailable-on-this-client'],
  ['resolved target over pending slot', c => c.targets[0].unresolved = false],
  ['resolved target over absent slot', c => c.slots.find(s => s.id === chapter).presence = 'absent'],
  ['resolved target over placeholder slot', c => c.slots.find(s => s.id === chapter).editorialMaterialization = 'placeholder'],
  ['unknown admission', c => c.slots[0].observedReaderAdmission = 'cleared'],
  ['authoritative annotation', c => c.slots[0].publicationAnnotation.authoritative = true],
  ['admitted annotation', c => c.slots[0].publicationAnnotation.label = 'admitted'],
  ['annotation receipt injection', c => c.slots[0].publicationAnnotation.permission = true],
  ['unknown entry', c => c.entryPageId = id(99)],
  ['nonpage entry', c => c.entryPageId = paragraph],
  ['duplicate alias', c => c.aliases.push(c.aliases[0])],
  ['unknown alias target', c => c.aliases[0].targetId = id(99)],
  ['alias chain', c => c.aliases[0].targetId = '/huey/chapter/example'],
  ['alias extra payload', c => c.aliases[0].redirect = 'https://example.com'],
  ['absolute alias', c => c.aliases[0].path = 'https://example.com/huey/front/half-title'],
  ['entry alias collision', c => c.aliases[0].path = '/huey'],
  ['stable route alias collision', c => c.aliases[0].path = `/huey/entity/${front}`],
  ['versioned alias binding', c => c.aliases[0].path += `/v/${version}`],
  ['trailing alias slash', c => c.aliases[0].path += '/'],
  ['front alias wrong kind', c => c.aliases[0].targetId = firstPage],
  ['back alias wrong kind', c => { c.aliases[0].path = '/huey/back/example'; c.aliases[0].targetId = chapter; }],
  ['chapter alias wrong kind', c => c.aliases[1].targetId = paragraph],
  ['page alias wrong kind', c => c.aliases[2].targetId = paragraph],
  ['unplaced alias wrong kind', c => c.aliases[3].targetId = firstPage],
];
for (const [name, mutate] of mutations) test(`closed route catalog rejects ${name}`, () => {
  const catalog = fixture(); mutate(catalog);
  assert.throws(() => validateRouteProjection(catalog), /HUEY_ROUTES/);
});

test('unknown payload getters are rejected without reading their values', () => {
  const catalog = fixture();
  Object.defineProperty(catalog.targets[0], 'text', { enumerable: true, get() { throw new Error('Text accessed'); } });
  assert.throws(() => resolveRouteAddress('/huey', catalog), /invalid target fields/);
});

test('target metadata may be more conservative than its slots without conferring authority', () => {
  const catalog = fixture(), row = catalog.targets.find(t => t.id === paragraph);
  row.access = 'restricted'; row.version = null; row.unresolved = true;
  assert.equal(resolveRouteAddress(`/huey/paragraph/${paragraph}`, catalog).status, 'restricted');
  row.access = 'unavailable-on-this-client';
  assert.equal(resolveRouteAddress(`/huey/paragraph/${paragraph}`, catalog).status, 'unavailable');
});

test('registered restricted slot cannot escape its access metadata by disconnecting itself', () => {
  const catalog = fixture(), row = catalog.targets.find(t => t.id === restricted);
  row.slotIds = []; row.access = 'available'; row.version = version;
  assert.throws(() => resolveRouteAddress(`/huey/entity/${restricted}`, catalog), /exactly its own slot metadata/);
  row.slotIds = [chapter];
  assert.throws(() => resolveRouteAddress(`/huey/entity/${restricted}`, catalog), /exactly its own slot metadata/);
});

test('unplaced inventory units retain the supported literary kinds', () => {
  for (const kind of ['Chapter', 'ChapterPart', 'Section', 'Block', 'Paragraph', 'MatterUnit']) {
    const catalog = fixture(); catalog.targets.find(t => t.id === unplaced).kind = kind;
    assert.equal(resolveRouteAddress('/huey/unplaced/example', catalog).kind, kind);
  }
});

test('resolver output is closed metadata and does not mutate catalog, history or network globals', () => {
  const catalog = fixture(), before = structuredClone(catalog);
  const restore = ['history', 'window', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  try {
    for (const [key] of restore) Object.defineProperty(globalThis, key, {
      configurable: true, get() { throw new Error(`${key} accessed`); },
    });
    const result = resolveRouteAddress(`/huey/paragraph/${paragraph}`, catalog);
    assert.deepEqual(Object.keys(result).sort(), ['status', 'projection', 'entityId', 'kind',
      'requestedVersion', 'entityVersion', 'canonicalPath', 'redirectTo', 'pageIds', 'slots'].sort());
    assert.equal(result.status, 'resolved');
    result.pageIds.push(id(99)); result.slots[0].publicationAnnotation.label = 'held';
    assert.deepEqual(catalog, before);
  } finally {
    for (const [key, descriptor] of restore) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('format rejects malformed identities and non-model versions', () => {
  for (const value of [
    { id: 'chapter-1', kind: 'Chapter' }, { id: chapter, kind: 'Chapter', version: '1'.repeat(40) },
    { id: chapter, kind: 'Chapter', version: false }, { id: chapter, kind: 'Unknown' },
  ]) assert.throws(() => formatEntityRoute(value), /HUEY_ROUTES/);
});
