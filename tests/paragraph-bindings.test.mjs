import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { mkdtemp, mkdir, copyFile, symlink, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildParagraphBindings, loadParagraphBindings } from '../scripts/paragraph_bindings.mjs';
import { loadAssembly } from '../scripts/editorial_pages.mjs';
import { parseEditorialMarkdown } from '../scripts/editorial_markdown.mjs';
import { seal } from '../scripts/literary_model.mjs';
import { compileBook, gitBlob, sha256 } from '../reader/scripts/content.mjs';
import { parseMarkdown } from '../reader/src/text.mjs';

const id = n => `he_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const pin = 'a'.repeat(40), admittedPin = 'b'.repeat(40);
const path = 'manuscript/01-preamble/synthetic.md';
const denyRead = (object, key) => Object.defineProperty(object, key, {
  configurable: true, enumerable: true, get() { throw new Error(`Forbidden read: ${key}`); },
});

function fixture(text = '# Synthetic\n\nThe same.\n\nThe same.\n\nTwo *different*\nlines.\n') {
  const source = { key: 'selected', role: 'canonical', access: 'available', targets: ['synthetic-slot'], path,
    blob: gitBlob(text), revision: pin };
  const blocks = parseEditorialMarkdown(text);
  const records = blocks.map((block, n) => seal({ id: id(n + 1), kind: block.kind, state: block.state }));
  const parsed = parseMarkdown(text);
  for (const paragraph of parsed.blocks.filter(block => block.type === 'paragraph')) paragraph.sha256 = sha256(paragraph.raw);
  return {
    assembly: {
      schema: 'huey.editorial-assembly.v1',
      inventory: { sources: [source], slots: [{ key: 'synthetic-slot', entityId: id(100), sources: ['selected'],
        access: 'available', canonicalState: 'present-content', canonicalPath: path }] },
      entityRecords: records,
      sourceMappings: blocks.map((block, n) => ({ entityId: records[n].id, entityVersion: records[n].version,
        sourceKey: source.key, path, blob: source.blob, revision: pin,
        utf16: { start: block.source.start, end: block.source.end },
        lines: { start: block.source.startLine, end: block.source.endLine } })),
    },
    book: { chapters: [{ id: 'C01', status: 'admitted', path, blob: source.blob, revision: admittedPin, ...parsed }] },
    sourceTexts: { selected: text },
  };
}
const bind = data => buildParagraphBindings(data);
const paragraphs = data => data.book.chapters[0].blocks.filter(block => block.type === 'paragraph');
const mappings = data => data.assembly.sourceMappings.filter(row => data.assembly.entityRecords.find(entity => entity.id === row.entityId)?.kind === 'Paragraph');

test('equal-valued source occurrences select separate pre-existing identities by range', () => {
  const data = fixture(), out = bind(data);
  assert.equal(out.schema, 'huey.legacy-paragraph-bindings.v1');
  assert.equal(out.bindings.length, 3);
  const [first, second] = out.bindings;
  assert.equal(first.rawSha256, second.rawSha256);
  assert.notEqual(first.entityId, second.entityId);
  assert.notEqual(first.entityVersion, second.entityVersion);
  assert.deepEqual(out.bindings.map(row => row.entityId), mappings(data).map(row => row.entityId));
  assert.deepEqual(bind(data), out, 'no random allocation, layout, title, or clock input');
});

test('output carries only explicit legacy coordinates and selected literary ID/version', () => {
  const data = fixture(), out = bind(data);
  assert.deepEqual(Object.keys(out).sort(), ['bindings', 'schema']);
  for (const row of out.bindings) assert.deepEqual(Object.keys(row).sort(),
    ['chapterBlob', 'chapterId', 'entityId', 'entityVersion', 'ordinal', 'rawSha256']);
  assert.equal(JSON.stringify(out).includes(data.sourceTexts.selected), false);
  for (const field of ['path', 'sourceKey', 'revision', 'evidence', 'scopeRefs', 'text', 'sourceUrl']) {
    assert.equal(JSON.stringify(out).includes(`"${field}"`), false);
  }
});

test('distinct Git provenance revisions with the same exact source blob reconcile', () => {
  const data = fixture();
  assert.notEqual(data.book.chapters[0].revision, data.assembly.inventory.sources[0].revision);
  assert.equal(bind(data).bindings.length, 3);
});

test('CRLF is normalized only for legacy raw hashes; inscription retains exact source state', () => {
  const data = fixture('# Synthetic\r\n\r\nA *formatted*\r\nparagraph.\r\n');
  const [row] = bind(data).bindings;
  const entity = data.assembly.entityRecords.find(entity => entity.id === row.entityId);
  assert.equal(row.rawSha256, sha256('A *formatted*\nparagraph.'));
  assert.equal(entity.state.text, 'A formatted\r\nparagraph.');
  assert.equal(row.entityVersion, seal(entity).version);
  assert.equal(row.entityVersion === `hev1:${row.rawSha256}`, false);
});

test('canonical object-key order does not change the bound exact state', () => {
  const data = fixture(), before = bind(data);
  for (const entity of data.assembly.entityRecords.filter(entity => entity.kind === 'Paragraph')) {
    entity.state = { spans: entity.state.spans, text: entity.state.text };
  }
  assert.deepEqual(bind(data), before);
});

test('ReadingPage membership, chapter display names, and publication annotations do not choose identity', () => {
  const data = fixture(), before = bind(data);
  data.assembly.readingOrder = [id(200), id(201)];
  data.assembly.entityRecords.push(seal({ id: id(200), kind: 'ReadingPage', state: { members: [id(2)] } }));
  data.book.chapters[0].title = 'Different display label';
  data.assembly.inventory.slots[0].publicationAnnotation = { label: 'held', authoritative: false };
  assert.deepEqual(bind(data), before);
  data.assembly.entityRecords.at(-1).state.members = [id(4), id(3), id(2)];
  assert.deepEqual(bind(data), before);
});

for (const access of ['restricted', 'unavailable-on-this-client']) {
  for (const deny of ['source', 'slot']) test(`${deny} ${access} is skipped before bytes, mappings, or paths are read`, () => {
    const data = fixture();
    const source = data.assembly.inventory.sources[0], slot = data.assembly.inventory.slots[0];
    (deny === 'source' ? source : slot).access = access;
    for (const key of ['path', 'blob', 'revision']) denyRead(source, key);
    denyRead(slot, 'canonicalPath');
    denyRead(data.sourceTexts, 'selected');
    denyRead(data.assembly, 'sourceMappings');
    denyRead(data.assembly, 'entityRecords');
    denyRead(data.book.chapters[0], 'blocks');
    assert.deepEqual(bind(data).bindings, []);
  });
}

test('unavailable reader chapter does not read source or paragraph payloads', () => {
  const data = fixture();
  data.book.chapters[0].status = 'unavailable';
  denyRead(data.book.chapters[0], 'path'); denyRead(data.book.chapters[0], 'blocks');
  denyRead(data.sourceTexts, 'selected'); denyRead(data.assembly, 'sourceMappings');
  assert.deepEqual(bind(data).bindings, []);
});

for (const field of ['path', 'blob']) test(`a nonselected admitted ${field} has no inferred binding`, () => {
  const data = fixture();
  data.book.chapters[0][field] = field === 'path' ? 'manuscript/01-preamble/other.md' : 'c'.repeat(40);
  denyRead(data.sourceTexts, 'selected'); denyRead(data.assembly, 'sourceMappings');
  assert.deepEqual(bind(data).bindings, []);
});

for (const role of ['unplaced', 'candidate', 'support']) test(`${role} source cannot supply admitted bindings`, () => {
  const data = fixture();
  data.assembly.inventory.sources[0].role = role;
  denyRead(data.sourceTexts, 'selected'); denyRead(data.assembly, 'sourceMappings');
  assert.deepEqual(bind(data).bindings, []);
});

const hostile = [
  ['changed source bytes', data => { data.sourceTexts.selected += 'Extra paragraph.\n'; }],
  ['missing source text', data => { delete data.sourceTexts.selected; }],
  ['missing paragraph mapping', data => { data.assembly.sourceMappings.splice(1, 1); }],
  ['duplicate matching range', data => { data.assembly.sourceMappings.push({ ...data.assembly.sourceMappings[1] }); }],
  ['wrong UTF-16 range', data => { data.assembly.sourceMappings[1].utf16.start++; }],
  ['wrong line range', data => { data.assembly.sourceMappings[1].lines.start++; }],
  ['wrong source path', data => { data.assembly.sourceMappings[1].path = 'manuscript/other.md'; }],
  ['wrong source blob', data => { data.assembly.sourceMappings[1].blob = 'c'.repeat(40); }],
  ['wrong source key', data => { data.assembly.sourceMappings[1].sourceKey = 'another-source'; }],
  ['wrong mapping revision', data => { data.assembly.sourceMappings[1].revision = 'c'.repeat(40); }],
  ['stale mapping version', data => { data.assembly.sourceMappings[1].entityVersion = `hev1:${'0'.repeat(64)}`; }],
  ['stale entity version', data => { data.assembly.entityRecords[1].version = `hev1:${'0'.repeat(64)}`; }],
  ['changed inscription', data => { data.assembly.entityRecords[1] = seal({ ...data.assembly.entityRecords[1], state: { text: 'Other wording.', spans: [] } }); }],
  ['wrong entity kind', data => { data.assembly.entityRecords[1].kind = 'Block'; }],
  ['missing entity', data => { data.assembly.entityRecords.splice(1, 1); }],
  ['duplicate entity', data => { data.assembly.entityRecords.push({ ...data.assembly.entityRecords[1] }); }],
  ['collapsed equal-valued occurrence', data => {
    data.assembly.sourceMappings[2].entityId = data.assembly.sourceMappings[1].entityId;
    data.assembly.sourceMappings[2].entityVersion = data.assembly.sourceMappings[1].entityVersion;
  }],
  ['changed legacy ordinal', data => { paragraphs(data)[0].number = 9; }],
  ['changed legacy raw hash', data => { paragraphs(data)[0].sha256 = '0'.repeat(64); }],
  ['changed legacy raw wording', data => { paragraphs(data)[0].raw = 'Other wording.'; }],
  ['changed legacy normalized text', data => { paragraphs(data)[0].text = 'Other wording.'; }],
  ['changed legacy paragraph count', data => { data.book.chapters[0].paragraphCount--; }],
  ['missing legacy paragraph', data => { data.book.chapters[0].blocks.splice(0, 1); }],
  ['ambiguous canonical source', data => { data.assembly.inventory.sources.push({ ...data.assembly.inventory.sources[0] }); }],
  ['source detached from selected slot', data => { data.assembly.inventory.slots[0].sources = []; }],
];
for (const [name, mutate] of hostile) test(`fails closed: ${name}`, () => {
  const data = fixture(); mutate(data);
  assert.throws(() => bind(data), /PARAGRAPH_BINDINGS:/);
});

test('current public C08A binds all 260 exact occurrences; staged and unplaced paragraphs stay separate', async () => {
  const assembly = loadAssembly(), book = await compileBook(), sourceTexts = {};
  for (const source of assembly.inventory.sources) {
    if (source.role === 'canonical' && source.access === 'available') sourceTexts[source.key] = readFileSync(new URL(`../${source.path}`, import.meta.url), 'utf8');
  }
  const out = buildParagraphBindings({ assembly, book, sourceTexts });
  assert.equal(out.bindings.length, 260);
  assert.ok(out.bindings.every(row => row.chapterId === 'C08A' && row.chapterBlob === 'e28d4b10c74f8ed6ec6e66b5131e0b25ab5479e1'));
  assert.equal(new Set(out.bindings.map(row => row.entityId)).size, 260);
  const unbound = assembly.entityRecords.filter(entity => entity.kind === 'Paragraph' && !out.bindings.some(row => row.entityId === entity.id));
  assert.equal(unbound.length, 1599);
  const separateKeys = assembly.inventory.sources
    .filter(source => source.role === 'unplaced' || ['C14A', 'C14B'].includes(source.targets[0]))
    .map(source => source.key);
  assert.ok(unbound.every(entity => assembly.sourceMappings.some(mapping => mapping.entityId === entity.id && separateKeys.includes(mapping.sourceKey))));
  assert.deepEqual(await loadParagraphBindings(), out);
  assert.ok(book.chapters.find(chapter => chapter.id === 'C08A').blocks.filter(block => block.type === 'paragraph')
    .every(paragraph => paragraph.evidence.coverage === 'pending' && paragraph.evidence.claims.length === 0));
});

test('failed generation removes a stale binding payload instead of leaving a false receipt', async () => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'huey-paragraph-bindings-')));
  try {
    const script = join(temporary, 'scripts/paragraph_bindings.mjs');
    await mkdir(dirname(script), { recursive: true });
    await copyFile(new URL('../scripts/paragraph_bindings.mjs', import.meta.url), script);
    // Imported dependencies use the actual checkout; the executable's ROOT and
    // generated payload are confined to this empty, source-free temporary copy.
    for (const file of ['scripts/editorial_pages.mjs', 'scripts/editorial_markdown.mjs',
      'scripts/editorial_inventory.mjs', 'scripts/literary_model.mjs',
      'reader/scripts/content.mjs', 'reader/src/text.mjs', 'reader/src/paragraphs.mjs']) {
      const destination = join(temporary, file);
      await mkdir(dirname(destination), { recursive: true });
      await symlink(fileURLToPath(new URL(`../${file}`, import.meta.url)), destination);
    }
    const output = join(temporary, 'reader/generated-editorial/data/paragraphs.json');
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, '{"stale":true}\n');
    const result = spawnSync(process.execPath, [script, 'generate'], { cwd: temporary, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ENOENT/);
    assert.equal(existsSync(output), false);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
