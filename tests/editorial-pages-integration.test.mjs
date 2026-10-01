import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadAssembly, buildAssembly } from '../scripts/editorial_pages.mjs';
import { parseEditorialMarkdown } from '../scripts/editorial_markdown.mjs';
import { gitBlob } from '../scripts/editorial_inventory.mjs';
import { seal } from '../scripts/literary_model.mjs';
import { loadParagraphBindings } from '../scripts/paragraph_bindings.mjs';
import { buildEditorialRouteProjection } from '../scripts/editorial_routes.mjs';
import { formatEntityRoute, resolveRouteAddress } from '../reader/src/routes.mjs';

// This is an exact migration regression, not a regeneration algorithm. Its
// historical inputs are public Git objects already reachable from pre-release.
const root = new URL('../', import.meta.url);
const base = '664f9b62d70d7f24e2519918357ec262d86eb6c4';
const historical = path => execFileSync('git', ['show', `${base}:${path}`], { cwd: root, encoding: 'utf8' });
const read = path => readFileSync(new URL(path, root), 'utf8');
const before = JSON.parse(historical('planning/editorial-pages/plan.json'));
const plan = JSON.parse(read('planning/editorial-pages/plan.json'));
const assembly = loadAssembly();
const sources = new Map(assembly.inventory.sources.map(source => [source.key, source]));
const texts = Object.fromEntries(plan.sources.map(source => [source.sourceKey, read(source.path)]));
const additions = new Map([
  ['public-38', { slot: 'front-preface', blocks: 81, pages: 6, revision: 'b223607addfbc96d8e0250bbb65f0c2b9809c790', blob: '38cb27c6174e0931741d59de7b7db6251a17a285' }],
  ['sequential-fm01-title', { slot: 'front-title', blocks: 2, pages: 1, revision: 'b223607addfbc96d8e0250bbb65f0c2b9809c790', blob: 'cb56c8fdc69752cea1fff1381353038dfc626e3a' }],
  ['sequential-p01', { slot: 'C01', blocks: 65, pages: 5, revision: '382157ef57867adb9f601ed69bccb6dbc829700d', blob: 'a3524efe6a57739e324f8eecda7566b9378b08ed' }],
  ['sequential-p02', { slot: 'C03', blocks: 77, pages: 5, revision: '2cddcde90be5442a57abffd2c0e8191c49429c5e', blob: 'ce398b063a82358a9d21531dada4e85eed5f573b' }],
]);
const changedSlots = new Set([...additions.values()].map(row => row.slot));
const record = id => assembly.entityRecords.find(row => row.id === id);
const bindings = JSON.parse(read('planning/routes/bindings.json'));
const routes = buildEditorialRouteProjection({ assembly, bindings, previousBindings: JSON.parse(historical('planning/routes/bindings.json')) });

test('441 migration retains every prior source mapping, block version, page ID and unaffected page membership', () => {
  assert.equal(gitBlob(historical('planning/editorial-pages/plan.json')), 'b095207b23733f373b5127f3cf2d541f6a12248a');
  for (const source of before.sources) {
    assert.deepEqual(plan.sources.find(row => row.sourceKey === source.sourceKey), source);
    const parsed = parseEditorialMarkdown(texts[source.sourceKey]);
    source.blocks.forEach((block, index) => assert.deepEqual(record(block.id), seal({ id: block.id, kind: block.kind, state: parsed[index].state })));
  }
  for (const page of before.pages) {
    const next = plan.pages.find(row => row.id === page.id);
    assert.ok(next);
    assert.equal(next.slot, page.slot);
    if (!changedSlots.has(page.slot)) assert.deepEqual(next, page);
  }
  const oldIds = new Set(before.pages.map(page => page.id));
  assert.deepEqual(plan.readingOrder.filter(id => oldIds.has(id)), before.readingOrder);
  assert.deepEqual(plan.unplacedOrder, before.unplacedOrder);
  assert.equal(plan.pages.length - before.pages.length, 13);
});

test('441 adds only the four exact selected sources and gives each new occurrence one mapping', () => {
  assert.deepEqual(plan.sources.filter(row => !before.sources.some(old => old.sourceKey === row.sourceKey)).map(row => row.sourceKey), [...additions.keys()]);
  for (const [key, expected] of additions) {
    const source = sources.get(key), mapping = plan.sources.find(row => row.sourceKey === key);
    assert.equal(source.revision, expected.revision);
    assert.equal(source.blob, expected.blob);
    assert.equal(gitBlob(texts[key]), expected.blob);
    assert.equal(mapping.blocks.length, expected.blocks);
    assert.deepEqual(source.targets, [expected.slot]);
    for (const field of ['revision', 'path', 'blob']) assert.equal(mapping[field], source[field]);
    assert.equal(execFileSync('git', ['rev-parse', `${source.revision}:${source.path}`], { cwd: root, encoding: 'utf8' }).trim(), source.blob);
    const pages = plan.pages.filter(page => page.slot === expected.slot);
    assert.equal(pages.length, expected.pages);
    assert.equal(pages[0].id, before.pages.find(page => page.slot === expected.slot).id);
    assert.deepEqual(pages.flatMap(page => page.members), mapping.blocks.map(block => block.id));
    for (const block of mapping.blocks) {
      const actual = assembly.sourceMappings.find(row => row.entityId === block.id);
      assert.deepEqual(actual.utf16, { start: block.start, end: block.end });
      assert.equal(actual.entityVersion, record(block.id).version);
    }
  }
  assert.equal(assembly.modelValidation, 'validated-snapshot');
  assert.equal(assembly.unmaterializedEntities.length, 0);
  assert.equal(assembly.entityRecords.filter(row => row.kind === 'Movement').length, 3);
});

test('all old aliases retain targets; old placeholder page versions never return new prose', () => {
  assert.deepEqual(bindings, JSON.parse(historical('planning/routes/bindings.json')));
  assert.equal(bindings.aliases.length, 90);
  for (const alias of bindings.aliases) assert.equal(resolveRouteAddress(alias.path, routes).entityId, alias.targetId);
  for (const slot of changedSlots) {
    const previous = before.pages.find(page => page.slot === slot);
    const old = seal({ id: previous.id, kind: 'ReadingPage', state: { members: previous.members } });
    assert.notEqual(record(old.id).version, old.version);
    const current = resolveRouteAddress(formatEntityRoute({ id: old.id, kind: old.kind }), routes);
    assert.equal(current.entityId, old.id);
    assert.equal(current.status, 'resolved');
    assert.equal(resolveRouteAddress(formatEntityRoute({ ...old, version: old.version }), routes).status, 'version-unavailable');
  }
});

test('superseded preface stays historically pinned without invented old paragraph correspondence', () => {
  const registry = JSON.parse(read('planning/sequential-review/P01.r1/editorial-registry-before.json'));
  const previous = registry.sources.find(source => source.key === 'public-38');
  assert.equal(previous.revision, '26447f857fbf85e5a28b0b3367a414533262d89f');
  assert.equal(previous.blob, '7c5b87446e97c2666054d915f52252d989201aa8');
  assert.equal(execFileSync('git', ['rev-parse', `${previous.revision}:${previous.path}`], { cwd: root, encoding: 'utf8' }).trim(), previous.blob);
  assert.ok(!before.sources.some(source => source.sourceKey === previous.key));
  assert.notEqual(sources.get(previous.key).blob, previous.blob);
});

test('shared note/advisory stays candidate-only; new source blocks acquire no old evidence bindings', async () => {
  const candidate = sources.get('sequential-fm01-note-advisory');
  assert.equal(candidate.role, 'candidate');
  assert.deepEqual(candidate.targets, ['front-author-source-note', 'front-content-advisory']);
  assert.ok(!plan.sources.some(source => source.sourceKey === candidate.key));
  for (const key of candidate.targets) {
    const slot = assembly.inventory.slots.find(row => row.key === key);
    assert.deepEqual(record(slot.entityId).state.children, []);
    assert.equal(resolveRouteAddress(formatEntityRoute(record(slot.entityId)), routes).status, 'unresolved');
  }
  const result = await loadParagraphBindings();
  assert.equal(result.bindings.length, 260);
  const oldParagraphs = new Set(before.sources.find(source => source.sourceKey === 'public-01').blocks.filter(block => block.kind === 'Paragraph').map(block => block.id));
  assert.deepEqual(new Set(result.bindings.map(row => row.entityId)), oldParagraphs);
  assert.ok(result.bindings.every(row => row.chapterId === 'C08A' && row.entityVersion === record(row.entityId).version));
});

test('selected-source coverage and exact ranges remain mandatory after the migration', () => {
  for (const mutate of [
    p => p.sources.pop(),
    p => p.sources.at(-1).revision = 'a'.repeat(40),
    p => p.sources.at(-1).blob = 'b'.repeat(40),
    p => p.sources.at(-1).blocks[1].start++,
  ]) {
    const changed = structuredClone(plan); mutate(changed);
    assert.throws(() => buildAssembly({ inventory: assembly.inventory, plan: changed, sourceTexts: texts }));
  }
});
