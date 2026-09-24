import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAssembly } from './editorial_pages.mjs';
import { buildEditorialRouteProjection } from './editorial_routes.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BINDINGS = 'planning/routes/bindings.json';
const OUTPUT = 'reader/generated-editorial/data/traversal.json';
const STRUCTURE = new Set(['Work', 'FrontMatter', 'Body', 'BackMatter', 'MatterUnit',
  'Movement', 'Chapter', 'ChapterPart', 'Section']);
const FORMATS = new Set(['markdown-heading', 'markdown-thematic-break', 'markdown-comment']);
const requireThat = (condition, message) => { if (!condition) throw new Error(`EDITORIAL_TRAVERSAL: ${message}`); };

/**
 * Browser-facing derivative of the checked authorized working assembly. Reading
 * order and EntityIDs are copied, never allocated or calculated from layout.
 * Route metadata decides whether text may materialize; publication annotations
 * are carried separately and never filter literary existence. This is not an
 * authority engine or a second prose master.
 */
export function buildTraversalPayload({ assembly, bindings }) {
  const routes = buildEditorialRouteProjection({ assembly, bindings });
  const targets = new Map(routes.targets.map(target => [target.id, target]));
  const records = new Map(assembly.entityRecords.map(entity => [entity.id, entity]));
  const slots = new Map(assembly.inventory.slots.map(slot => [slot.entityId, slot]));
  const readingOrder = [...assembly.readingOrder];
  const unplacedOrder = [...assembly.workspace.unplacedPages];
  const pages = [...readingOrder, ...unplacedOrder].map(id => {
    const target = targets.get(id);
    const labels = target.slotIds.map(slotId => {
      const label = slots.get(slotId).label;
      requireThat(typeof label === 'string' && label.trim().length > 0, 'missing public inventory label');
      return label;
    });
    requireThat(labels.length > 0, 'page has no literary slot');
    const page = { id, label: labels.join(' / '), blocks: [] };
    // A page carrying any denied member materializes no text. In particular,
    // neither denied inscriptions nor their source mappings are even inspected.
    if (target.access !== 'available') return page;
    const visited = new Set();
    const visit = memberId => {
      requireThat(!visited.has(memberId), 'repeated or cyclic page member');
      visited.add(memberId);
      const memberTarget = targets.get(memberId);
      requireThat(memberTarget?.access === 'available', 'available page has unavailable member');
      const entity = records.get(memberId);
      requireThat(entity !== undefined, 'available page member has no materialized record');
      if (entity.kind === 'Paragraph' || entity.kind === 'Block') {
        const format = entity.kind === 'Paragraph' ? null : entity.state.format;
        requireThat(entity.kind === 'Paragraph' || FORMATS.has(format), 'unsupported block format');
        const text = entity.state.text;
        requireThat(typeof text === 'string' && text.isWellFormed(), 'invalid inscription');
        // Explicit fields only: text is inert inscription, never HTML. Source
        // coordinates, inline link destinations, and provenance stay upstream.
        page.blocks.push({ id: entity.id, kind: entity.kind, text, format });
      } else {
        requireThat(STRUCTURE.has(entity.kind), 'unsupported page member kind');
        requireThat(Array.isArray(entity.state.children), 'missing structural children');
        entity.state.children.forEach(visit);
      }
    };
    records.get(id).state.members.forEach(visit);
    return page;
  });
  return { schema: 'huey.editorial-traversal.v1', routes, readingOrder, unplacedOrder, pages };
}

export function loadTraversalPayload(root = ROOT) {
  return buildTraversalPayload({ assembly: loadAssembly(root),
    bindings: JSON.parse(readFileSync(resolve(root, BINDINGS), 'utf8')) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2] ?? 'check';
    requireThat(['check', 'emit', 'generate'].includes(command) && process.argv.length <= 3,
      'usage: node scripts/editorial_traversal.mjs [check|emit|generate]');
    const payload = loadTraversalPayload();
    if (command === 'emit') process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    else if (command === 'generate') {
      const path = resolve(ROOT, OUTPUT);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(payload)}\n`);
      console.log(`Generated derived editorial traversal payload at ${OUTPUT}; no publication admission or manuscript change.`);
    } else {
      const blocks = payload.pages.reduce((count, page) => count + page.blocks.length, 0);
      console.log(`Editorial traversal checked: ${payload.readingOrder.length} ordered pages; ${payload.unplacedOrder.length} unplaced pages; ${blocks} materialized blocks. No publication admission or manuscript change.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
