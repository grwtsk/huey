import { readFile, realpath, lstat, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAssembly } from './editorial_pages.mjs';
import { parseEditorialMarkdown } from './editorial_markdown.mjs';
import { safePath } from './editorial_inventory.mjs';
import { canonical, profile, seal } from './literary_model.mjs';
import { compileBook, gitBlob, sha256 } from '../reader/scripts/content.mjs';
import { parseMarkdown } from '../reader/src/text.mjs';
import { validateParagraphBindings } from '../reader/src/paragraphs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = 'reader/generated-editorial/data/paragraphs.json';
const ID = new RegExp(profile.entityID);
const check = (condition, message) => { if (!condition) throw new Error(`PARAGRAPH_BINDINGS: ${message}`); };

// Selection uses the existing explicit inventory relation. Denied source and
// slot metadata must be rejected before their paths, bytes or mappings are read.
function selectedSources(assembly) {
  check(assembly?.schema === 'huey.editorial-assembly.v1', 'expected checked assembly');
  const slots = new Map(assembly.inventory.slots.map(slot => [slot.key, slot]));
  return assembly.inventory.sources.filter(source => {
    if (source.role !== 'canonical' || source.access !== 'available') return false;
    check(Array.isArray(source.targets) && source.targets.length === 1, 'ambiguous canonical source target');
    const slot = slots.get(source.targets[0]);
    check(slot !== undefined, 'unknown canonical source target');
    if (slot.access !== 'available' || slot.canonicalState !== 'present-content') return false;
    check(slot.sources.includes(source.key) && slot.canonicalPath === source.path, 'source differs from selected slot');
    return true;
  });
}

/**
 * Reconcile two checked representations of one exact public source occurrence.
 * sourceTexts is keyed by inventory sourceKey. Existing plan IDs supply identity;
 * the source range chooses the occurrence, and raw hashes only check fidelity.
 * Git revisions may differ when both paths identify the same pinned blob.
 */
export function buildParagraphBindings({ assembly, book, sourceTexts }) {
  const sources = selectedSources(assembly);
  check(Array.isArray(book?.chapters), 'missing admitted chapter catalog');
  const bindings = [], identities = new Set(), legacyKeys = new Set();
  for (const chapter of book.chapters) {
    if (chapter.status !== 'admitted') continue;
    const candidates = sources.filter(source => source.path === chapter.path && source.blob === chapter.blob);
    check(candidates.length <= 1, 'ambiguous selected source for admitted chapter');
    // A different selected working source does not inherit the old admission or
    // evidence. Reconciliation of that revision belongs to a later explicit act.
    if (!candidates.length) continue;
    const source = candidates[0];
    check(Object.hasOwn(sourceTexts, source.key), 'selected source text missing');
    const text = sourceTexts[source.key];
    check(typeof text === 'string' && text.isWellFormed() && gitBlob(text) === source.blob, 'selected source bytes drifted');
    const legacy = parseMarkdown(text).blocks.filter(block => block.type === 'paragraph');
    const paragraphs = chapter.blocks.filter(block => block.type === 'paragraph');
    check(paragraphs.length === legacy.length && chapter.paragraphCount === legacy.length, 'legacy paragraph coverage drifted');
    const parsed = parseEditorialMarkdown(text).filter(block => block.kind === 'Paragraph');
    const mappings = assembly.sourceMappings.filter(mapping => mapping.sourceKey === source.key);
    const records = new Map();
    for (const record of assembly.entityRecords) {
      check(!records.has(record.id), 'duplicate entity record');
      records.set(record.id, record);
    }
    for (let index = 0; index < legacy.length; index++) {
      const actual = legacy[index], paragraph = paragraphs[index];
      check(['number', 'startLine', 'endLine', 'raw', 'text'].every(field => paragraph[field] === actual[field])
        && paragraph.sha256 === sha256(actual.raw), 'legacy paragraph coordinate or wording drifted');
      const matches = mappings.filter(mapping => mapping.lines.start === actual.startLine && mapping.lines.end === actual.endLine);
      check(matches.length === 1, 'missing or ambiguous exact source occurrence');
      const mapping = matches[0];
      check(mapping.path === source.path && mapping.blob === source.blob && mapping.revision === source.revision,
        'source mapping pin drifted');
      const blocks = parsed.filter(block => block.source.startLine === actual.startLine && block.source.endLine === actual.endLine);
      check(blocks.length === 1, 'legacy paragraph has no unique structural occurrence');
      const block = blocks[0];
      check(mapping.utf16.start === block.source.start && mapping.utf16.end === block.source.end,
        'source mapping range drifted');
      const raw = text.slice(mapping.utf16.start, mapping.utf16.end).replace(/\r\n/g, '\n');
      check(raw === actual.raw && sha256(raw) === paragraph.sha256, 'source occurrence raw binding drifted');
      const entity = records.get(mapping.entityId);
      check(entity?.kind === 'Paragraph' && ID.test(entity.id), 'source occurrence is not an existing Paragraph');
      const expected = seal({ id: entity.id, kind: 'Paragraph', state: block.state });
      check(canonical(entity.state) === canonical(expected.state) && entity.version === expected.version && mapping.entityVersion === expected.version,
        'source occurrence entity state or version drifted');
      const key = `${chapter.id}/${chapter.blob}/${paragraph.number}`;
      check(!legacyKeys.has(key) && !identities.has(entity.id), 'duplicate or collapsed paragraph binding');
      legacyKeys.add(key); identities.add(entity.id);
      bindings.push({ chapterId: chapter.id, chapterBlob: chapter.blob, ordinal: paragraph.number,
        rawSha256: paragraph.sha256, entityId: entity.id, entityVersion: entity.version });
    }
  }
  return validateParagraphBindings({ schema: 'huey.legacy-paragraph-bindings.v1', bindings });
}

/** Read only the already selected, admitted, available manuscript paths. */
export async function loadParagraphBindings(root = ROOT) {
  const assembly = loadAssembly(root);
  const book = await compileBook(root, resolve(root, 'reader/content'));
  const sources = selectedSources(assembly), sourceTexts = {};
  for (const source of sources) {
    if (!book.chapters.some(chapter => chapter.status === 'admitted' && chapter.path === source.path && chapter.blob === source.blob)) continue;
    check(safePath(source.path) && source.path.startsWith('manuscript/'), 'selected source outside manuscript');
    const path = resolve(root, source.path), info = await lstat(path);
    check(info.isFile() && !info.isSymbolicLink(), 'selected source is not a regular file');
    const rel = relative(await realpath(root), await realpath(path));
    check(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'selected source escapes checkout');
    sourceTexts[source.key] = await readFile(path, 'utf8');
  }
  return buildParagraphBindings({ assembly, book, sourceTexts });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] ?? 'check';
  try {
    check(['check', 'emit', 'generate'].includes(command) && process.argv.length <= 3,
      'usage: node scripts/paragraph_bindings.mjs [check|emit|generate]');
    const payload = await loadParagraphBindings();
    if (command === 'emit') process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    else if (command === 'generate') {
      const path = resolve(ROOT, OUTPUT);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${JSON.stringify(payload)}\n`);
      console.log(`Generated ${payload.bindings.length} exact legacy paragraph bindings at ${OUTPUT}; no evidence or admission changed.`);
    } else console.log(`Paragraph bindings checked: ${payload.bindings.length} exact admitted-source occurrences. No evidence or admission changed.`);
  } catch (error) {
    if (command === 'generate') await rm(resolve(ROOT, OUTPUT), { force: true });
    console.error(error.message);
    process.exitCode = 1;
  }
}
