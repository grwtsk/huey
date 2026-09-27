import { readFile, writeFile, mkdir, realpath, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarkdown, paragraphId, safeUrl } from '../src/text.mjs';

const readerRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = resolve(readerRoot, '..');
export const sha256 = text => createHash('sha256').update(text).digest('hex');
export const gitBlob = bytes => createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex');
function assert(condition, message) { if (!condition) throw new Error(message); }
function keys(value, allowed, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `Invalid ${label}`);
  assert(Object.keys(value).every(k => allowed.includes(k)), `Unexpected fields in ${label}`);
}
function text(value, label) { assert(typeof value === 'string' && value.trim().length > 0, `Missing ${label}`); }
function https(value, label) { assert(safeUrl(value), `Invalid HTTPS ${label}`); }

export function attachEvidence(paragraphs, annotations, sources, chapter) {
  const known = new Map(paragraphs.map(p => [p.id, p]));
  keys(annotations, Object.keys(annotations), 'paragraph ledger');
  for (const [id, annotation] of Object.entries(annotations)) {
    const p = known.get(id);
    assert(p, `Orphan paragraph annotation ${id}`);
    keys(annotation, ['sha256', 'coverage', 'claims', 'referenceIds', 'reviewNote', 'reviewRef'], id);
    assert(annotation.sha256 === p.sha256, `Stale paragraph evidence ${id}`);
    assert(['pending', 'partial', 'complete'].includes(annotation.coverage), `Unknown coverage ${id}`);
    assert(Array.isArray(annotation.claims) && Array.isArray(annotation.referenceIds), `Invalid ledger ${id}`);
    if (annotation.coverage === 'complete') {
      text(annotation.reviewNote, 'coverage review note'); https(annotation.reviewRef, 'coverage review reference');
    }
    const claimIds = new Set();
    for (const claim of annotation.claims) {
      keys(claim, ['id', 'wording', 'kind', 'disposition', 'issue', 'links', 'limits'], 'claim');
      text(claim.id, 'claim ID'); assert(!claimIds.has(claim.id), 'Duplicate claim ID'); claimIds.add(claim.id);
      text(claim.wording, 'claim wording');
      assert(p.text.includes(claim.wording), `Claim must anchor exact paragraph wording: ${claim.id}`);
      assert(['testimony', 'received-record', 'fact', 'analysis', 'metaphor', 'reflection', 'unknown'].includes(claim.kind), 'Invalid claim kind');
      assert(['unreviewed', 'supported-fact', 'attributed-account', 'analysis', 'hold'].includes(claim.disposition), 'Invalid disposition');
      https(claim.issue, 'verification issue'); text(claim.limits, 'claim limits');
      assert(Array.isArray(claim.links), 'Invalid claim links');
      for (const link of claim.links) {
        keys(link, ['sourceId', 'relation', 'locator', 'note'], 'claim link');
        assert(sources.has(link.sourceId), `Unknown source ${link.sourceId}`);
        assert(['supports', 'contradicts', 'context'].includes(link.relation), 'Invalid evidence relation');
        text(link.locator, 'source locator'); text(link.note, 'source relationship note');
      }
      if (claim.disposition === 'supported-fact') assert(claim.links.some(l => l.relation === 'supports'), 'Supported fact without support');
    }
    for (const id of annotation.referenceIds) assert(sources.has(id), `Unknown reference ${id}`);
    p.evidence = { ...annotation, mappingIssue: chapter.mappingIssue };
  }
  for (const p of paragraphs) {
    if (!p.evidence) p.evidence = { coverage: 'pending', claims: [], referenceIds: [],
      reviewNote: '', mappingIssue: chapter.mappingIssue };
  }
}

/** Compile only explicitly admitted chapter bytes; never scan the repository for prose. */
export async function compileBook(root = repoRoot, configDir = resolve(readerRoot, 'content')) {
  const manifest = JSON.parse(await readFile(resolve(configDir, 'book.json'), 'utf8'));
  const ledger = JSON.parse(await readFile(resolve(configDir, 'evidence.json'), 'utf8'));
  keys(manifest, ['schemaVersion', 'title', 'author', 'notice', 'chapters'], 'manifest');
  keys(ledger, ['schemaVersion', 'sources', 'paragraphs'], 'evidence');
  assert(manifest.schemaVersion === 1 && ledger.schemaVersion === 1, 'Unknown schema version');
  text(manifest.title, 'book title'); text(manifest.author, 'author'); text(manifest.notice, 'notice');
  assert(Array.isArray(manifest.chapters) && manifest.chapters.length > 0, 'No chapter catalog');
  assert(Array.isArray(ledger.sources), 'Invalid sources');
  const sources = new Map();
  for (const source of ledger.sources) {
    keys(source, ['id', 'title', 'url', 'kind', 'access', 'description'], 'source');
    text(source.id, 'source ID'); text(source.title, 'source title'); text(source.kind, 'source kind');
    text(source.description, 'source limits'); assert(!sources.has(source.id), 'Duplicate source ID');
    assert(['public', 'restricted'].includes(source.access), 'Unknown access');
    if (source.access === 'public') https(source.url, 'source URL');
    else assert(source.url === null, 'Restricted source locator cannot enter a public build');
    sources.set(source.id, source);
  }
  const ids = new Set(), labels = new Set(), usedAnnotations = new Set();
  const chapters = [];
  for (const c of manifest.chapters) {
    keys(c, ['id', 'label', 'title', 'movement', 'status', 'workIssue', 'path', 'blob', 'revision', 'admission', 'mappingIssue'], 'chapter');
    assert(/^[A-Z][A-Z0-9]*$/.test(c.id) && !ids.has(c.id), 'Duplicate or invalid chapter ID'); ids.add(c.id);
    assert(/^[0-9]+[A-Z]?$|^E$/.test(c.label) && !labels.has(c.label), 'Duplicate or invalid chapter label'); labels.add(c.label);
    text(c.title, 'chapter title');
    assert(['Preamble', 'Interlude', 'Excursion: Edna'].includes(c.movement), 'Unknown movement');
    https(c.workIssue, 'chapter issue');
    assert(['admitted', 'unavailable'].includes(c.status), 'Unknown admission status');
    if (c.status === 'unavailable') {
      assert(!c.path && !c.blob && !c.revision, 'Unavailable content must not contain payload locators');
      chapters.push({ id: c.id, label: c.label, title: c.title, movement: c.movement,
        status: 'unavailable', workIssue: c.workIssue, blocks: [], paragraphCount: 0 });
      continue;
    }
    assert(/^manuscript\/(01-preamble|02-interlude|03-excursion)\/[a-z0-9-]+\.md$/.test(c.path), 'Path outside allowed manuscript directories');
    assert(/^[a-f0-9]{40}$/.test(c.blob) && /^[a-f0-9]{40}$/.test(c.revision), 'Chapter version must be pinned');
    https(c.admission, 'admission receipt'); https(c.mappingIssue, 'mapping issue');
    const actual = await realpath(resolve(root, c.path));
    const rel = relative(await realpath(resolve(root, 'manuscript')), actual);
    assert(rel && !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep), 'Manuscript symlink escaped allowlist');
    const bytes = await readFile(actual);
    assert(gitBlob(bytes) === c.blob, `Chapter ${c.id} changed: update admission/version and paragraph mappings before serving`);
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed = parseMarkdown(source);
    assert(parsed.title === c.title, 'Manifest title differs from manuscript');
    const sourceUrl = `https://github.com/grwtsk/huey/blob/${c.revision}/${c.path}`;
    const paragraphs = parsed.blocks.filter(b => b.type === 'paragraph');
    for (const p of paragraphs) {
      p.id = paragraphId(c.id, p.number);
      p.chapterId = c.id;
      p.label = `${c.label}:${p.number}`;
      p.sha256 = sha256(p.raw);
      p.sourceUrl = `${sourceUrl}#L${p.startLine}-L${p.endLine}`;
    }
    const annotations = Object.fromEntries(Object.entries(ledger.paragraphs).filter(([id]) => id.startsWith(`${c.id}-p`)));
    Object.keys(annotations).forEach(id => usedAnnotations.add(id));
    attachEvidence(paragraphs, annotations, sources, c);
    chapters.push({ ...c, ...parsed, sourceUrl });
  }
  assert(Object.keys(ledger.paragraphs).every(id => usedAnnotations.has(id)), 'Annotations refer to an unavailable chapter');
  assert(chapters.some(c => c.status === 'admitted'), 'No admitted text to read');
  const data = { schemaVersion: 1, title: manifest.title, author: manifest.author, notice: manifest.notice,
    chapters, sources: [...sources.values()] };
  return { ...data, version: sha256(JSON.stringify(data)) };
}

export async function writeBook() {
  const output = resolve(readerRoot, 'generated-public/data/book.json');
  try {
    const book = await compileBook();
    await mkdir(resolve(readerRoot, 'generated-public/data'), { recursive: true });
    await writeFile(output, `${JSON.stringify(book)}\n`, 'utf8');
    console.log(`Reader content: ${book.chapters.filter(c => c.status === 'admitted').length} admitted chapter(s), ${book.chapters.reduce((n,c) => n+c.paragraphCount,0)} paragraphs. Evidence coverage is explicit, not inferred.`);
    return book;
  } catch (error) {
    // Never leave stale apparently-valid material behind after a failed refresh.
    await rm(output, { force: true });
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeBook().catch(error => { console.error(error.message); process.exitCode = 1; });
}
