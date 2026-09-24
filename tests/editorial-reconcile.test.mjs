import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInventory, gitBlob, loadInventory } from '../scripts/editorial_inventory.mjs';
import { buildAssembly, createPlan } from '../scripts/editorial_pages.mjs';
import { parseEditorialMarkdown } from '../scripts/editorial_markdown.mjs';
import { buildEditorialRouteProjection } from '../scripts/editorial_routes.mjs';
import { planDigest, reconcileSource } from '../scripts/editorial_reconcile.mjs';
import { attachEvidence, compileBook, sha256 } from '../reader/scripts/content.mjs';

const id = n => `he_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const revision = 'a'.repeat(40);
const chapter = '# Synthetic chapter\n\nThe same.\n\nThe same.\n\nLast paragraph.\n';
const unplaced = '## Synthetic unplaced\n\nAn unplaced paragraph.\n';
const sourceKey = 'canonical';
const slot = (key, group, n, changes = {}) => ({ key, entityId: id(n),
  kind: ['front', 'back'].includes(group) ? 'MatterUnit' : 'Chapter', group,
  label: group === 'book' ? null : `Synthetic ${key}`, optional: ['front', 'back'].includes(group) ? true : null,
  presence: 'present', publicationAnnotation: { label: 'working', authoritative: false },
  unmaterializedAccess: null, sources: [], issues: [353], omissionRef: null, ...changes });
const source = (key, path, text, role, targets) => ({ key, role, extent: 'full', revision, path,
  blob: gitBlob(text), scopeRefs: ['https://github.com/grwtsk/huey/issues/2#issuecomment-123'], targets });

function inputFor(text) {
  return {
    registry: { schema: 'huey.editorial-registry.v1', basisRevision: revision,
      containers: { work: id(1), front: id(2), body: id(3), back: id(4),
        movements: { preamble: id(5), interlude: id(6), excursion: id(7) } },
      slots: [slot('front-title', 'front', 8, { presence: 'pending' }),
        slot('C01', 'book', 9, { sources: ['canonical'] }),
        slot('C02', 'book', 10, { unmaterializedAccess: 'restricted' }),
        slot('back-note', 'back', 11, { presence: 'pending' }),
        slot('unplaced-one', 'unplaced', 12, { sources: ['unplaced'] })],
      sources: [source('canonical', 'manuscript/01.md', text, 'canonical', ['C01']),
        source('unplaced', 'manuscript/unplaced/one.md', unplaced, 'unplaced', ['unplaced-one']),
        source('support', 'sources/synthetic-reference.md', 'UNSELECTED_SYNTHETIC_REFERENCE', 'support', [])],
      supportPaths: [] },
    book: { schema: 'huey.book.v1', items: [
      { id: 'C01', movement: 'preamble', title: 'Synthetic chapter', path: 'manuscript/01.md', include: true },
      { id: 'C02', movement: 'interlude', title: 'Synthetic pending', path: 'manuscript/02.md', include: false }] },
    reader: { chapters: [{ id: 'C01', status: 'admitted' }, { id: 'C02', status: 'unavailable' }] },
    trackedPaths: ['manuscript/01.md', 'manuscript/02.md', 'manuscript/unplaced/one.md'],
    files: { 'manuscript/01.md': text, 'manuscript/02.md': '<!-- Pending. -->', 'manuscript/unplaced/one.md': unplaced },
    sourceAvailability: { canonical: true, unplaced: true, support: true },
  };
}
const sourcePlan = (plan, key = sourceKey) => plan.sources.find(row => row.sourceKey === key);
const selectedSource = (inventory, key = sourceKey) => inventory.sources.find(row => row.key === key);
const record = (assembly, entityId) => assembly.entityRecords.find(row => row.id === entityId);
const pin = row => ({ revision: row.revision, path: row.path, blob: row.blob });
const assemble = side => buildAssembly(side);

// Fixture IDs are explicitly supplied, not recovered by comparing text. Parsing
// supplies source locators only; each test controls which old occurrence persists.
function correspondenceFor(before, after, key = sourceKey) {
  const old = sourcePlan(before.plan, key), assembled = assemble(before);
  const next = parseEditorialMarkdown(after.sourceTexts[key]);
  return { schema: 'huey.source-correspondence.v1', sourceKey: key,
    basePlanSha256: planDigest(before.plan), before: pin(old), after: pin(selectedSource(after.inventory, key)),
    blocks: old.blocks.map((block, index) => ({ entityId: block.id, baseVersion: record(assembled, block.id).version,
      start: next[index]?.source.start ?? block.start, end: next[index]?.source.end ?? block.end })) };
}
function prepare(afterText = chapter, { beforeText = chapter, path = 'manuscript/01.md' } = {}) {
  const beforeInput = inputFor(beforeText), afterInput = inputFor(afterText);
  const before = { inventory: buildInventory(beforeInput), sourceTexts: { canonical: beforeText, unplaced } };
  let next = 100;
  before.plan = createPlan({ ...before, allocateId: () => id(next++), maxBlocks: 2 });
  const changed = afterInput.registry.sources.find(row => row.key === sourceKey);
  changed.revision = 'b'.repeat(40);
  afterInput.registry.basisRevision = 'b'.repeat(40);
  if (path !== changed.path) {
    const oldPath = changed.path;
    changed.path = path;
    afterInput.book.items[0].path = path;
    afterInput.trackedPaths[afterInput.trackedPaths.indexOf(oldPath)] = path;
    afterInput.files[path] = afterInput.files[oldPath];
    delete afterInput.files[oldPath];
  }
  const after = { inventory: buildInventory(afterInput), sourceTexts: { canonical: afterText, unplaced } };
  return { before, after, correspondence: correspondenceFor(before, after) };
}
const resultAssembly = (input, result) => assemble({ ...input.after, plan: result.plan });
function frozen(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function rejects(input) {
  assert.throws(() => reconcileSource(input), error => {
    assert.equal(error.message.includes('SYNTHETIC_PRIVATE_SENTINEL'), false);
    assert.equal(error.message.includes('UNSELECTED_SYNTHETIC_REFERENCE'), false);
    return error instanceof Error;
  });
}

test('plan digest is deterministic, key-order independent, and binds source/page sequences', () => {
  const { before } = prepare(), digest = planDigest(before.plan);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(planDigest(structuredClone(before.plan)), digest);
  assert.equal(planDigest(Object.fromEntries(Object.entries(before.plan).reverse())), digest);
  for (const change of [p => p.sources.reverse(), p => p.pages.reverse(), p => p.readingOrder.reverse(),
    p => sourcePlan(p).blocks[1].end++, p => p.initialPartition.maxBlocks++]) {
    const altered = structuredClone(before.plan); change(altered);
    assert.notEqual(planDigest(altered), digest);
  }
});

test('explicit variable-length revision retains IDs, ordering, pages and every other entity version', () => {
  const data = prepare(chapter.replace('Last paragraph.', 'A longer revised synthetic paragraph.'));
  const before = assemble(data.before), immutable = JSON.stringify(data);
  const result = reconcileSource(frozen(data)), after = resultAssembly(data, result);
  assert.equal(JSON.stringify(data), immutable);
  assert.equal(result.schema, 'huey.source-reconciliation.v1');
  assert.deepEqual(Object.keys(result).sort(), ['changes', 'plan', 'schema']);
  assert.notEqual(result.plan, data.before.plan);
  assert.equal(result.changes.length, sourcePlan(data.before.plan).blocks.length);
  const revised = before.entityRecords.find(row => row.kind === 'Paragraph' && row.state.text === 'Last paragraph.');
  assert.equal(record(after, revised.id).state.text, 'A longer revised synthetic paragraph.');
  assert.notEqual(record(after, revised.id).version, revised.version);
  for (const entity of before.entityRecords.filter(row => row.id !== revised.id)) assert.deepEqual(record(after, entity.id), entity);
  assert.deepEqual(result.changes.filter(row => row.state === 'revised'), [{ entityId: revised.id, kind: 'Paragraph',
    beforeVersion: revised.version, afterVersion: record(after, revised.id).version, state: 'revised' }]);
  assert.deepEqual(result.plan.pages, data.before.plan.pages);
  assert.deepEqual(result.plan.readingOrder, data.before.plan.readingOrder);
  assert.deepEqual(result.plan.unplacedOrder, data.before.plan.unplacedOrder);
  assert.deepEqual(sourcePlan(result.plan, 'unplaced'), sourcePlan(data.before.plan, 'unplaced'));
  assert.deepEqual(sourcePlan(result.plan).blocks.map(row => [row.id, row.kind]), sourcePlan(data.before.plan).blocks.map(row => [row.id, row.kind]));
  assert.deepEqual(reconcileSource(data), result);
});

test('leading blanks and an explicit path rename change provenance without changing inscription versions', () => {
  const data = prepare(`\n\n${chapter}`, { path: 'manuscript/renamed.md' });
  const before = assemble(data.before), result = reconcileSource(data), after = resultAssembly(data, result);
  assert.deepEqual(after.entityRecords, before.entityRecords);
  assert.ok(result.changes.every(row => row.state === 'unchanged' && row.beforeVersion === row.afterVersion));
  assert.equal(sourcePlan(result.plan).path, 'manuscript/renamed.md');
  assert.notEqual(sourcePlan(result.plan).blob, sourcePlan(data.before.plan).blob);
  for (const mapping of after.sourceMappings.filter(row => row.sourceKey === sourceKey)) {
    const previous = before.sourceMappings.find(row => row.entityId === mapping.entityId);
    assert.equal(mapping.path, 'manuscript/renamed.md');
    assert.equal(mapping.utf16.start, previous.utf16.start + 2);
    assert.equal(mapping.lines.start, previous.lines.start + 2);
  }
});

test('equal-valued occurrences stay distinct when only the explicitly identified second occurrence changes', () => {
  const data = prepare(chapter.replace('The same.\n\nLast', 'Second occurrence revised.\n\nLast'));
  const old = assemble(data.before).entityRecords.filter(row => row.kind === 'Paragraph' && row.state.text === 'The same.');
  const result = reconcileSource(data), after = resultAssembly(data, result);
  assert.equal(old.length, 2); assert.notEqual(old[0].id, old[1].id);
  assert.deepEqual(record(after, old[0].id), old[0]);
  assert.equal(record(after, old[1].id).state.text, 'Second occurrence revised.');
  assert.notEqual(record(after, old[1].id).version, old[1].version);
  assert.deepEqual(result.changes.filter(row => row.state === 'revised').map(row => row.entityId), [old[1].id]);
});

test('delimiter-only changes update source mappings and presentation without rewriting paragraph state', () => {
  const data = prepare(chapter.replace('Last paragraph.', 'Last **paragraph**.'));
  const before = assemble(data.before), result = reconcileSource(data), after = resultAssembly(data, result);
  assert.deepEqual(after.entityRecords, before.entityRecords);
  assert.ok(result.changes.every(row => row.state === 'unchanged'));
  const paragraph = before.entityRecords.find(row => row.state.text === 'Last paragraph.');
  const mapping = after.sourceMappings.find(row => row.entityId === paragraph.id);
  assert.deepEqual(mapping.presentation, [{ type: 'strong', start: 5, end: 14 }]);
  assert.notDeepEqual(mapping, before.sourceMappings.find(row => row.entityId === paragraph.id));
});

test('Unicode, internal CRLF and UTF-8 source ranges remain exact after reconciliation', () => {
  const beforeText = '# Unicode\r\n\r\ne\u0301 👩🏽‍💻.\r\nSecond line.\r\n\r\nTail.\r\n';
  const afterText = beforeText.replace('Second line.', 'Second longer line 🇺🇳.');
  const data = prepare(afterText, { beforeText }), result = reconcileSource(data), after = resultAssembly(data, result);
  const paragraph = after.entityRecords.find(row => row.kind === 'Paragraph' && row.state.text.startsWith('e\u0301'));
  assert.equal(paragraph.state.text, 'e\u0301 👩🏽‍💻.\r\nSecond longer line 🇺🇳.');
  assert.notEqual(paragraph.state.text, paragraph.state.text.normalize('NFC'));
  for (const mapping of after.sourceMappings.filter(row => row.sourceKey === sourceKey)) {
    const raw = afterText.slice(mapping.utf16.start, mapping.utf16.end);
    assert.equal(Buffer.from(afterText).subarray(mapping.utf8.start, mapping.utf8.end).toString('utf8'), raw);
    assert.equal(record(after, mapping.entityId).state.text, raw);
  }
});

test('result is metadata only and owns copies rather than caller arrays', () => {
  const data = prepare(), before = JSON.stringify(data), result = reconcileSource(data);
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!['text', 'sourceTexts', 'inventory', 'raw', 'inscription', 'presentation'].includes(key), key);
      inspect(child);
    }
  };
  inspect(result);
  assert.equal(JSON.stringify(result).includes('Last paragraph.'), false);
  result.plan.pages[0].members.push(id(999));
  result.plan.sources[0].blocks[0].start++;
  assert.equal(JSON.stringify(data), before);
});

for (const [name, mutate] of [
  ['stale plan digest', d => d.correspondence.basePlanSha256 = '0'.repeat(64)],
  ['plan changed after request', d => d.before.plan.initialPartition.maxBlocks++],
  ['stale before source revision', d => d.correspondence.before.revision = 'c'.repeat(40)],
  ['stale before source blob', d => d.correspondence.before.blob = 'c'.repeat(40)],
  ['stale after source revision', d => d.correspondence.after.revision = 'c'.repeat(40)],
  ['stale after source blob', d => d.correspondence.after.blob = 'c'.repeat(40)],
  ['before bytes drift', d => d.before.sourceTexts.canonical += '\nSYNTHETIC_PRIVATE_SENTINEL'],
  ['after bytes drift', d => d.after.sourceTexts.canonical += '\nSYNTHETIC_PRIVATE_SENTINEL'],
  ['stale exact paragraph version', d => d.correspondence.blocks[1].baseVersion = `hev1:${'0'.repeat(64)}`],
  ['unknown correspondence source', d => d.correspondence.sourceKey = 'unknown'],
  ['nonselected source intake', d => d.correspondence.sourceKey = 'support'],
  ['missing block', d => d.correspondence.blocks.pop()],
  ['duplicate block ID', d => d.correspondence.blocks[2].entityId = d.correspondence.blocks[1].entityId],
  ['new block identity', d => d.correspondence.blocks[1].entityId = id(9000)],
  ['changed identity order', d => [d.correspondence.blocks[1].entityId, d.correspondence.blocks[2].entityId] = [d.correspondence.blocks[2].entityId, d.correspondence.blocks[1].entityId]],
  ['changed range order', d => d.correspondence.blocks.reverse()],
  ['shifted block boundary', d => d.correspondence.blocks[1].start++],
  ['truncated block boundary', d => d.correspondence.blocks[1].end--],
  ['unknown request field', d => d.correspondence.approved = true],
  ['unknown block field', d => d.correspondence.blocks[0].kind = 'Block'],
  ['missing block version', d => delete d.correspondence.blocks[0].baseVersion],
  ['unknown pin field', d => d.correspondence.after.accepted = true],
  ['array version coercion', d => d.correspondence.blocks[0].baseVersion = [d.correspondence.blocks[0].baseVersion]],
  ['array ID coercion', d => d.correspondence.blocks[0].entityId = [d.correspondence.blocks[0].entityId]],
  ['string offset coercion', d => d.correspondence.blocks[0].start = String(d.correspondence.blocks[0].start)],
  ['fractional range', d => d.correspondence.blocks[0].end = 1.5],
  ['negative range', d => d.correspondence.blocks[0].start = -1],
  ['wrong correspondence schema', d => d.correspondence.schema = 'huey.source-correspondence.v2'],
]) test(`rejects ${name} without source text in diagnostics`, () => { const data = prepare(); mutate(data); rejects(data); });

for (const [name, text] of [
  ['split/addition changes block count', `${chapter}\nAnother paragraph.\n`],
  ['join/removal changes block count', chapter.replace('The same.\n\nThe same.', 'Joined paragraph.')],
  ['paragraph replaced by heading changes kind', chapter.replace('Last paragraph.', '## A new heading')],
  ['unsupported Markdown', chapter.replace('Last paragraph.', '> SYNTHETIC_PRIVATE_SENTINEL')],
]) test(`rejects ${name}`, () => {
  // The unsupported profile cannot supply parser-derived ranges. Keep the explicit
  // old request and correctly update its source pin to exercise parser rejection.
  const data = prepare();
  data.after.sourceTexts.canonical = text;
  selectedSource(data.after.inventory).blob = gitBlob(text);
  data.correspondence.after.blob = gitBlob(text);
  rejects(data);
});

for (const [name, mutate] of [
  ['selected source role', d => selectedSource(d.after.inventory).role = 'candidate'],
  ['selected source target', d => selectedSource(d.after.inventory).targets = ['C02']],
  ['selected source scope', d => selectedSource(d.after.inventory).scopeRefs.push('https://github.com/grwtsk/huey/issues/999')],
  ['selected source extent', d => selectedSource(d.after.inventory).extent = 'partial'],
  ['slot identity', d => d.after.inventory.slots.find(s => s.key === 'C01').entityId = id(999)],
  ['slot presence', d => d.after.inventory.slots.find(s => s.key === 'C01').presence = 'pending'],
  ['publication annotation', d => d.after.inventory.slots.find(s => s.key === 'C01').publicationAnnotation.label = 'held'],
  ['reader admission observation', d => d.after.inventory.slots.find(s => s.key === 'C01').observedReaderAdmission = 'unavailable'],
  ['literary ownership', d => d.after.inventory.ownership.find(s => s.kind === 'Movement' && s.children.length).children.reverse().push(id(10))],
  ['other source pins', d => selectedSource(d.after.inventory, 'unplaced').revision = 'c'.repeat(40)],
  ['source order', d => d.after.inventory.sources.reverse()],
  ['nonselected reference metadata', d => selectedSource(d.after.inventory, 'support').extent = 'partial'],
]) test(`rejects unrelated change to ${name}`, () => { const data = prepare(); mutate(data); rejects(data); });

for (const side of ['before', 'after']) for (const deniedBy of ['source', 'slot', 'canonicalState']) {
  test(`${side} unavailable ${deniedBy} rejects before reading any source text`, () => {
    const data = prepare();
    if (deniedBy === 'source') selectedSource(data[side].inventory).access = 'restricted';
    else {
      const selected = data[side].inventory.slots.find(row => row.key === 'C01');
      if (deniedBy === 'slot') selected.access = 'unavailable-on-this-client';
      else selected.canonicalState = 'missing';
    }
    let reads = 0;
    for (const which of ['before', 'after']) for (const key of ['canonical', 'unplaced', 'support']) {
      Object.defineProperty(data[which].sourceTexts, key, { enumerable: true, configurable: true,
        get() { reads++; throw new Error('SYNTHETIC_PRIVATE_SENTINEL'); } });
    }
    rejects(data);
    assert.equal(reads, 0, 'access and eligibility must be checked before reading either source map');
  });
}

test('unselected references are never read even during successful reconciliation', () => {
  const data = prepare();
  for (const side of ['before', 'after']) Object.defineProperty(data[side].sourceTexts, 'support', {
    enumerable: true, get() { throw new Error('UNSELECTED_SYNTHETIC_REFERENCE'); } });
  assert.equal(reconcileSource(data).changes.length, 4);
});

test('source-only delimiter edit cannot silently validate an old raw-paragraph evidence hash', () => {
  const data = prepare(chapter.replace('Last paragraph.', 'Last *paragraph*.'));
  const result = reconcileSource(data);
  assert.ok(result.changes.every(row => row.state === 'unchanged'));
  const paragraph = { id: 'C01-p0003', raw: 'Last *paragraph*.', text: 'Last paragraph.', sha256: sha256('Last *paragraph*.') };
  const annotations = { 'C01-p0003': { sha256: sha256('Last paragraph.'), coverage: 'pending', claims: [], referenceIds: [] } };
  assert.throws(() => attachEvidence([paragraph], annotations, new Map(), { mappingIssue: 'https://github.com/grwtsk/huey/issues/353' }), /Stale paragraph evidence/);
  assert.equal(Object.hasOwn(result, 'evidence'), false);
});

test('current selected public sources support explicit no-op reconciliation of all 481 blocks and 471 paragraphs', async () => {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const inventory = loadInventory(), plan = JSON.parse(read('planning/editorial-pages/plan.json'));
  const sourceTexts = Object.fromEntries(plan.sources.map(row => [row.sourceKey, read(row.path)]));
  const before = { inventory, plan, sourceTexts }, first = assemble(before);
  const bindings = JSON.parse(read('planning/routes/bindings.json'));
  const routes = buildEditorialRouteProjection({ assembly: first, bindings });
  const evidenceBefore = await compileBook();
  let checkedBlocks = 0, checkedParagraphs = 0;
  for (const selected of plan.sources) {
    const after = { inventory: structuredClone(inventory), sourceTexts: { ...sourceTexts } };
    const request = { before, after, correspondence: correspondenceFor(before, after, selected.sourceKey) };
    const result = reconcileSource(request), next = resultAssembly(request, result);
    assert.deepEqual(result.plan, plan);
    assert.deepEqual(next.entityRecords, first.entityRecords);
    assert.deepEqual(next.sourceMappings, first.sourceMappings);
    assert.deepEqual(buildEditorialRouteProjection({ assembly: next, bindings }), routes);
    assert.ok(result.changes.every(row => row.state === 'unchanged'));
    checkedBlocks += result.changes.length;
    checkedParagraphs += result.changes.filter(row => row.kind === 'Paragraph').length;
  }
  assert.equal(checkedBlocks, 481);
  assert.equal(checkedParagraphs, 471);
  assert.deepEqual(await compileBook(), evidenceBefore, 'reader admission and evidence remain independently compiled');
});
