import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UUID = new RegExp(JSON.parse(readFileSync(resolve(ROOT, 'planning/literary-model/v1.json'), 'utf8')).entityID);
const SHA = /^[0-9a-f]{40}$/;
const sha = value => typeof value === 'string' && SHA.test(value);
const MOVEMENTS = ['preamble', 'interlude', 'excursion'];
const PRESENCE = ['present', 'pending', 'omitted', 'absent'];
const PUBLICATION_LABELS = ['working', 'staged', 'held'];
const REGISTRY = 'huey.editorial-registry.v1';
const fail = message => { throw new Error(`EDITORIAL_INVENTORY: ${message}`); };
const requireThat = (condition, message) => { if (!condition) fail(message); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unique = values => new Set(values).size === values.length;
const list = (value, context) => { requireThat(Array.isArray(value), `${context} must be an array`); return value; };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const key = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);

function shape(value, fields, context) {
  requireThat(plain(value), `${context} must be an object`);
  requireThat(Object.keys(value).sort().join('|') === [...fields].sort().join('|'), `${context} has missing or unknown fields`);
}

function publicReference(value) {
  if (typeof value !== 'string') return false;
  return /^https:\/\/github\.com\/grwtsk\/huey\/(?:issues|pull)\/[1-9][0-9]*(?:#[A-Za-z0-9_-]+)?$/.test(value);
}

export function safePath(value) {
  return typeof value === 'string' && value.length > 0 && !isAbsolute(value)
    && !/[\\\x00-\x1f\x7f:]/.test(value)
    && value.split('/').every(part => part !== '' && part !== '.' && part !== '..')
    && !/^(?:sources\/(?:raw|restricted|private)(?:\/|$)|private(?:\/|$))/.test(value)
    && /^(?:manuscript|planning|sources)\//.test(value);
}

export function gitBlob(text) {
  const bytes = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

export function contentState(text) {
  if (text === null) return 'missing';
  requireThat(typeof text === 'string', 'source inspection must supply text or null');
  return text.replace(/<!--[\s\S]*?-->/g, '').trim() ? 'present-content' : 'comment-placeholder';
}

export function validateRegistry(registry) {
  shape(registry, ['schema', 'basisRevision', 'containers', 'slots', 'sources', 'supportPaths'], 'registry');
  requireThat(registry.schema === REGISTRY && sha(registry.basisRevision), 'unsupported registry or malformed basis revision');
  shape(registry.containers, ['work', 'front', 'body', 'back', 'movements'], 'containers');
  shape(registry.containers.movements, MOVEMENTS, 'movements');
  const ids = [...['work', 'front', 'body', 'back'].map(k => registry.containers[k]), ...MOVEMENTS.map(k => registry.containers.movements[k])];
  const slots = list(registry.slots, 'slots');
  const sources = list(registry.sources, 'sources');
  requireThat(unique(slots.map(s => s.key)), 'duplicate slot key');
  requireThat(unique(sources.map(s => s.key)), 'duplicate source key');
  for (const slot of slots) {
    shape(slot, ['key', 'entityId', 'kind', 'group', 'label', 'optional', 'presence', 'publicationAnnotation', 'unmaterializedAccess', 'sources', 'issues', 'omissionRef'], 'slot');
    ids.push(slot.entityId);
    requireThat(key(slot.key), 'malformed slot key');
    requireThat(['book', 'front', 'back', 'unplaced'].includes(slot.group), `invalid group for ${slot.key}`);
    const matter = slot.group === 'front' || slot.group === 'back';
    requireThat(matter ? slot.kind === 'MatterUnit' && typeof slot.optional === 'boolean' : slot.optional === null, `invalid matter optionality for ${slot.key}`);
    requireThat(slot.group !== 'book' || slot.kind === 'Chapter', `book slot is not a Chapter: ${slot.key}`);
    requireThat(['Chapter', 'ChapterPart', 'Section', 'Block', 'Paragraph', 'MatterUnit'].includes(slot.kind), `invalid slot kind for ${slot.key}`);
    requireThat(slot.group === 'book' ? slot.label === null : nonempty(slot.label), `invalid label for ${slot.key}`);
    requireThat(PRESENCE.includes(slot.presence), `invalid presence for ${slot.key}`);
    shape(slot.publicationAnnotation, ['label', 'authoritative'], 'publication annotation');
    requireThat(PUBLICATION_LABELS.includes(slot.publicationAnnotation.label) && slot.publicationAnnotation.authoritative === false, `invalid non-authoritative publication annotation for ${slot.key}`);
    requireThat([null, 'restricted', 'unavailable-on-this-client'].includes(slot.unmaterializedAccess), `invalid unmaterialized access for ${slot.key}`);
    requireThat(slot.presence === 'omitted' ? slot.optional === true && publicReference(slot.omissionRef) : slot.omissionRef === null, `omission needs optional matter and a scoped decision reference: ${slot.key}`);
    requireThat(unique(list(slot.sources, 'slot sources')) && slot.sources.every(key), `invalid source references for ${slot.key}`);
    requireThat(slot.presence !== 'omitted' || slot.sources.length === 0, `omitted slot has sources: ${slot.key}`);
    requireThat(!matter || slot.presence === 'present' || slot.sources.length === 0, `nonpresent matter has content sources: ${slot.key}`);
    requireThat(unique(list(slot.issues, 'slot issues')) && slot.issues.every(n => Number.isSafeInteger(n) && n > 0), `invalid issue references for ${slot.key}`);
  }
  requireThat(ids.every(id => typeof id === 'string' && UUID.test(id)) && unique(ids), 'malformed or duplicate EntityID');
  const slotByKey = new Map(slots.map(slot => [slot.key, slot]));
  const sourceByKey = new Map(sources.map(source => [source.key, source]));
  const pins = [];
  for (const source of sources) {
    shape(source, ['key', 'role', 'extent', 'revision', 'path', 'blob', 'scopeRefs', 'targets'], 'source');
    requireThat(key(source.key) && ['canonical', 'candidate', 'unplaced', 'support'].includes(source.role), 'invalid source key or role');
    requireThat(['full', 'partial'].includes(source.extent), `invalid extent for ${source.key}`);
    requireThat(sha(source.revision) && sha(source.blob) && safePath(source.path), `unsafe or unpinned source: ${source.key}`);
    // These are scope pointers, never authenticated Instruction/Grant capabilities.
    requireThat(list(source.scopeRefs, 'source scope references').length > 0 && source.scopeRefs.every(publicReference), `missing public scope reference for ${source.key}`);
    requireThat(unique(list(source.targets, 'source targets')), `duplicate source targets for ${source.key}`);
    requireThat(source.role === 'support' ? source.targets.length === 0 : source.targets.length > 0, `invalid targets for ${source.key}`);
    requireThat(!['canonical', 'unplaced'].includes(source.role) || source.targets.length === 1, `source has ambiguous canonical parentage: ${source.key}`);
    for (const target of source.targets) {
      const slot = slotByKey.get(target);
      requireThat(slot && slot.sources.includes(source.key), `source/slot references disagree: ${source.key}`);
      requireThat(source.role !== 'unplaced' || slot.group === 'unplaced', `unplaced source has canonical placement: ${source.key}`);
    }
    pins.push(`${source.revision}:${source.path}`);
  }
  requireThat(unique(pins), 'duplicate pinned artifact');
  for (const slot of slots) for (const sourceKey of slot.sources) {
    requireThat(sourceByKey.get(sourceKey)?.targets.includes(slot.key), `slot/source references disagree: ${slot.key}`);
  }
  requireThat(unique(list(registry.supportPaths, 'support paths')) && registry.supportPaths.every(path => safePath(path) && path.startsWith('manuscript/') && path.endsWith('/README.md')), 'invalid support paths');
  return registry;
}

function validateCoverage(registry, book, trackedPaths) {
  requireThat(book.schema === 'huey.book.v1' && Array.isArray(book.items), 'unsupported book manifest');
  const items = book.items;
  requireThat(unique(items.map(item => item.id)) && unique(items.map(item => item.path)), 'duplicate book ID or path');
  requireThat(items.every(item => key(item.id) && nonempty(item.title) && MOVEMENTS.includes(item.movement) && safePath(item.path) && item.path.startsWith('manuscript/')), 'invalid book item');
  requireThat(items.every((item, index) => index === 0 || MOVEMENTS.indexOf(items[index - 1].movement) <= MOVEMENTS.indexOf(item.movement)), 'book order crosses movement boundaries');
  const bookSlots = registry.slots.filter(slot => slot.group === 'book');
  requireThat(bookSlots.length === items.length && bookSlots.every(slot => items.some(item => item.id === slot.key)), 'book slots do not exactly cover book.yaml');
  const declared = [...items.map(item => item.path), ...registry.supportPaths];
  for (const source of registry.sources.filter(source => ['canonical', 'candidate'].includes(source.role) && !items.some(item => item.id === source.targets[0]))) {
    const slot = registry.slots.find(slot => slot.key === source.targets[0]);
    requireThat(slot && ['front', 'back'].includes(slot.group), `non-book manuscript source needs front/back matter slot: ${source.key}`);
    requireThat(source.path.startsWith(`manuscript/${slot.group}/`), `matter source path disagrees with slot group: ${source.key}`);
    declared.push(source.path);
  }
  for (const source of registry.sources.filter(source => source.role === 'support' && source.path.startsWith('manuscript/'))) {
    requireThat(source.path.startsWith('manuscript/flow/'), `manuscript support source must live under manuscript/flow/: ${source.key}`);
    declared.push(source.path);
  }
  for (const slot of registry.slots.filter(slot => slot.group === 'unplaced')) {
    const source = registry.sources.filter(source => source.role === 'unplaced' && source.targets.includes(slot.key));
    requireThat(source.length === 1 && source[0].path.startsWith('manuscript/unplaced/'), `unplaced slot needs one manuscript source: ${slot.key}`);
    declared.push(source[0].path);
  }
  requireThat(unique(declared), 'manuscript path has ambiguous classification');
  requireThat(list(trackedPaths, 'tracked paths').every(path => safePath(path) && path.startsWith('manuscript/') && path.endsWith('.md')), 'unsafe tracked manuscript path');
  requireThat(unique(trackedPaths), 'duplicate tracked manuscript path');
  for (const path of trackedPaths) requireThat(declared.includes(path), `unclassified tracked manuscript: ${path}`);
  for (const path of registry.supportPaths) requireThat(trackedPaths.includes(path), `untracked support path: ${path}`);
  for (const source of registry.sources.filter(source => source.role === 'canonical')) {
    const item = items.find(item => item.id === source.targets[0]);
    if (item) {
      requireThat(item.path === source.path, `canonical source differs from book path: ${source.key}`);
      continue;
    }
    const slot = registry.slots.find(slot => slot.key === source.targets[0]);
    requireThat(slot && ['front', 'back'].includes(slot.group), `canonical source has no book or matter slot: ${source.key}`);
    requireThat(source.path.startsWith(`manuscript/${slot.group}/`), `canonical matter source differs from slot group: ${source.key}`);
  }
  return items;
}

// A supplied snapshot makes coverage, access and state invariants testable without
// a network or a private store. files contains only inspected public working files.
export function buildInventory({ registry, book, reader, trackedPaths, files, sourceAvailability }) {
  validateRegistry(registry);
  const items = validateCoverage(registry, book, trackedPaths);
  requireThat(plain(files) && plain(sourceAvailability), 'missing inspection maps');
  requireThat(Array.isArray(reader?.chapters), 'invalid reader manifest');
  requireThat(reader.chapters.every(chapter => plain(chapter) && key(chapter.id) && ['admitted', 'unavailable'].includes(chapter.status)), 'invalid reader admission observation');
  requireThat(unique(reader.chapters.map(chapter => chapter.id)), 'ambiguous reader admission observation');
  const sources = registry.sources.map(source => {
    requireThat(typeof sourceAvailability[source.key] === 'boolean', `source availability missing: ${source.key}`);
    return { ...source, access: sourceAvailability[source.key] ? 'available' : 'unavailable-on-this-client' };
  });
  const sourceByKey = new Map(sources.map(source => [source.key, source]));
  const ordered = ['front', 'book', 'back', 'unplaced'].flatMap(group => group === 'book'
    ? items.map(item => registry.slots.find(slot => slot.group === 'book' && slot.key === item.id))
    : registry.slots.filter(slot => slot.group === group));
  const rows = ordered.map(slot => {
    const item = slot.group === 'book' ? items.find(item => item.id === slot.key) : null;
    const linked = slot.sources.map(key => sourceByKey.get(key));
    const canonical = linked.filter(source => source.role === 'canonical' || source.role === 'unplaced');
    requireThat(canonical.length <= 1, `multiple canonical sources for ${slot.key}`);
    const path = item?.path ?? canonical[0]?.path ?? null;
    if (path !== null) requireThat(Object.hasOwn(files, path), `working file not inspected: ${slot.key}`);
    const state = path === null ? 'not-assigned' : contentState(files[path]);
    if (path && files[path] !== null) requireThat(trackedPaths.includes(path), `working prose is untracked: ${slot.key}`);
    if (state === 'present-content') {
      requireThat(canonical.length === 1 && canonical[0].path === path, `working content needs a pinned canonical source: ${slot.key}`);
      requireThat(gitBlob(files[path]) === canonical[0].blob, `working content differs from pinned source: ${slot.key}`);
    }
    const available = linked.filter(source => source.access === 'available');
    const current = canonical[0];
    let editorialMaterialization = state === 'missing' ? 'unavailable' : 'placeholder';
    if (available.length) editorialMaterialization = 'partial';
    if (current && state === 'present-content') editorialMaterialization = current.extent;
    if (slot.group === 'unplaced') editorialMaterialization = 'unplaced';
    const access = state === 'present-content' || available.length ? 'available' : slot.unmaterializedAccess ?? 'unavailable-on-this-client';
    const observed = item ? reader.chapters.find(chapter => chapter.id === item.id) : null;
    return {
      key: slot.key, entityId: slot.entityId, entityVersion: null, kind: slot.kind,
      group: slot.group, label: item?.title ?? slot.label, presence: slot.presence,
      editorialMaterialization, access, unmaterializedAccess: slot.unmaterializedAccess,
      publicationAnnotation: { ...slot.publicationAnnotation }, observedReaderAdmission: observed?.status ?? 'not-listed',
      optional: slot.optional, omissionRef: slot.omissionRef,
      canonicalPath: path, canonicalState: state, sources: slot.sources, issues: slot.issues,
    };
  });
  const c = registry.containers;
  const byGroup = group => rows.filter(row => row.group === group).map(row => row.entityId);
  const ownership = [
    { entityId: c.work, kind: 'Work', children: [c.front, c.body, c.back] },
    { entityId: c.front, kind: 'FrontMatter', children: byGroup('front') },
    { entityId: c.body, kind: 'Body', children: MOVEMENTS.map(m => c.movements[m]) },
    ...MOVEMENTS.map(m => ({ entityId: c.movements[m], kind: 'Movement', key: m, children: items.filter(item => item.movement === m).map(item => rows.find(row => row.key === item.id).entityId) })),
    { entityId: c.back, kind: 'BackMatter', children: byGroup('back') },
  ];
  const result = {
    schema: 'huey.editorial-inventory.v1', basisRevision: registry.basisRevision,
    representation: 'derived-metadata-only; not a literary entity snapshot or a prose master',
    ownership, editorialWorkspace: { kind: 'EditorialWorkspace', unplaced: byGroup('unplaced'), resources: sources.filter(source => source.role === 'support').map(source => source.key) },
    slots: rows, sources,
    unmappedReaderAliases: reader.chapters.filter(chapter => !items.some(item => item.id === chapter.id)).map(chapter => chapter.id),
    coverage: { bookSlots: items.length, trackedManuscriptFiles: trackedPaths.length, supportPaths: registry.supportPaths },
  };
  return { ...result, inventoryDigest: `sha256:${createHash('sha256').update(JSON.stringify(result)).digest('hex')}` };
}

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
  });
}

function inspectPublicFile(root, path) {
  const full = resolve(root, path);
  try {
    requireThat(lstatSync(full).isFile() && !lstatSync(full).isSymbolicLink(), `nonregular working source: ${path}`);
    const rel = relative(realpathSync(root), realpathSync(full));
    requireThat(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `source escapes checkout: ${path}`);
    return readFileSync(full, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function loadInventory(root = ROOT) {
  const registry = JSON.parse(readFileSync(resolve(root, 'planning/editorial-inventory/registry.json'), 'utf8'));
  validateRegistry(registry); // Reject hidden locators/extra fields before any source lookup.
  const book = JSON.parse(readFileSync(resolve(root, 'book.yaml'), 'utf8'));
  const reader = JSON.parse(readFileSync(resolve(root, 'reader/content/book.json'), 'utf8'));
  const trackedPaths = git(root, ['ls-files', '-z', '--', 'manuscript']).split('\0').filter(path => path.endsWith('.md'));
  validateCoverage(registry, book, trackedPaths); // Unknown files are never opened.
  const files = {};
  const paths = [...new Set([
    ...book.items.map(item => item.path),
    ...registry.sources.filter(source => ['canonical', 'unplaced'].includes(source.role)).map(source => source.path),
  ])];
  for (const path of paths) files[path] = trackedPaths.includes(path) ? inspectPublicFile(root, path) : null;
  const sourceAvailability = {};
  for (const source of registry.sources) {
    let available = true;
    try { git(root, ['cat-file', '-e', `${source.revision}^{commit}`]); } catch { available = false; }
    if (available) {
      const entry = git(root, ['ls-tree', '-z', source.revision, '--', source.path]);
      const match = /^(100644|100755) blob ([0-9a-f]{40})\t([^\0]+)\0$/.exec(entry);
      requireThat(match && match[2] === source.blob && match[3] === source.path, `pinned public artifact mismatch: ${source.key}`);
      try { git(root, ['cat-file', '-e', source.blob]); } catch { available = false; }
    }
    sourceAvailability[source.key] = available;
  }
  return buildInventory({ registry, book, reader, trackedPaths, files, sourceAvailability });
}

export const serializeInventory = inventory => `${JSON.stringify(inventory, null, 2)}\n`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2] ?? 'check';
    requireThat(['check', 'emit'].includes(command) && process.argv.length <= 3, 'usage: node scripts/editorial_inventory.mjs [check|emit]');
    const inventory = loadInventory();
    if (command === 'emit') process.stdout.write(serializeInventory(inventory));
    else console.log(`Editorial inventory checked: ${inventory.slots.length} slots; ${inventory.coverage.bookSlots} book.yaml slots; ${inventory.sources.length} public source references. Metadata only; incomplete material remains explicit.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
