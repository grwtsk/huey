import { createTraversal } from './traversal.mjs';
import { formatEntityRoute } from './routes.mjs';

const fail = message => { throw new Error(`HUEY_BOOK_NAVIGATION: ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };
const pagePath = id => formatEntityRoute({ id, kind: 'ReadingPage' });
const GROUPS = [
  ['front', 'Front matter'], ['book', 'Book'], ['back', 'Back matter'],
  ['unplaced', 'Unplaced material'],
];

function checkedPages(payload, traversal) {
  check(payload?.schema === 'huey.editorial-traversal.v1' && Array.isArray(payload.pages),
    'expected editorial traversal payload');
  const order = [...traversal.readingOrder, ...traversal.unplacedOrder];
  const pages = new Map();
  for (const page of payload.pages) {
    check(page && typeof page === 'object' && order.includes(page.id) && !pages.has(page.id)
      && typeof page.label === 'string' && page.label.trim().length > 0,
    'invalid or repeated public page label');
    // Navigation uses only the already supplied public label. It never examines
    // page blocks, derives a synopsis, or seeks text for an unavailable slot.
    pages.set(page.id, { id: page.id, label: page.label });
  }
  check(pages.size === order.length, 'incomplete page labels');
  return pages;
}

/**
 * Contents of the selected editorial projection, not an admission or rights
 * decision. Every literary slot remains visible, including denied and empty
 * slots. Container aliases and the supplied payload are left untouched.
 */
export function buildBookContents(payload) {
  const traversal = createTraversal(payload);
  const pages = checkedPages(payload, traversal);
  const targets = new Map(payload.routes.targets.map(target => [target.id, target]));
  const pageTargets = payload.routes.targets.filter(target => target.kind === 'ReadingPage');
  const positions = new Map();
  for (const [sequence, order] of [['book', traversal.readingOrder], ['unplaced', traversal.unplacedOrder]]) {
    order.forEach((id, index) => positions.set(id, { sequence, index }));
  }
  const groups = GROUPS.map(([key, label]) => ({ key, label, entries: [] }));
  const byGroup = new Map(groups.map(group => [group.key, group]));
  const originalOrder = new Map();
  payload.routes.slots.forEach((slot, index) => {
    const target = targets.get(slot.id);
    const expectedSequence = slot.group === 'unplaced' ? 'unplaced' : 'book';
    check(target.pageIds.every(id => positions.get(id)?.sequence === expectedSequence
      && targets.get(id).slotIds.includes(slot.id)), 'slot page membership differs from its sequence');
    check(pageTargets.filter(page => page.slotIds.includes(slot.id))
      .every(page => target.pageIds.includes(page.id)), 'slot page membership is not reciprocal');
    const ids = [...target.pageIds].sort((a, b) => positions.get(a).index - positions.get(b).index);
    const first = ids[0] ?? null;
    const entry = {
      id: slot.id,
      // A slot without a page has no public title in this payload. Its stable
      // identifier is a locator, rather than an invented title or excerpt.
      label: first ? pages.get(first).label : slot.id,
      path: first ? pagePath(first) : formatEntityRoute({ id: target.id, kind: target.kind }),
      pageIds: ids,
      pages: ids.map(id => ({ id, path: pagePath(id), number: positions.get(id).index + 1 })),
      access: slot.access,
      presence: slot.presence,
      materialization: slot.editorialMaterialization,
    };
    originalOrder.set(slot.id, index);
    byGroup.get(slot.group).entries.push(entry);
  });
  for (const group of groups) group.entries.sort((a, b) => {
    const position = entry => entry.pageIds.length ? positions.get(entry.pageIds[0]).index : Infinity;
    return position(a) - position(b) || originalOrder.get(a.id) - originalOrder.get(b.id);
  });
  return groups;
}

/** Native ReadingPage neighbours; unavailable pages are never skipped. */
export function locateBookPage(payload, pageId) {
  const traversal = createTraversal(payload);
  for (const [sequence, order] of [['book', traversal.readingOrder], ['unplaced', traversal.unplacedOrder]]) {
    const index = order.indexOf(pageId);
    if (index !== -1) return {
      previous: order[index - 1] ?? null, next: order[index + 1] ?? null,
      index, total: order.length, sequence,
    };
  }
  return { previous: null, next: null, index: null, total: null, sequence: null };
}

/** Known admitted-reader chapter metadata, including unavailable entries. */
export function admittedBookContents(book) {
  check(book?.schemaVersion === 1 && Array.isArray(book.chapters), 'expected admitted reading-copy metadata');
  const seen = new Set();
  return book.chapters.map(chapter => {
    check(chapter && /^[A-Z][A-Z0-9]*$/.test(chapter.id) && !seen.has(chapter.id)
      && typeof chapter.label === 'string' && typeof chapter.title === 'string'
      && ['admitted', 'unavailable'].includes(chapter.status), 'invalid admitted chapter metadata');
    seen.add(chapter.id);
    return { id: chapter.id, label: `${chapter.label} · ${chapter.title}`,
      path: `#chapter/${chapter.id}`, status: chapter.status };
  });
}
