import { buildBookContents, admittedBookContents } from './book-navigation.mjs';
import { findLegacyBinding, paragraphLinks } from './paragraphs.mjs';
import { paragraphHashRoute, parseRoute } from './text.mjs';

const node = (tag, text, className = '') => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  element.className = className;
  return element;
};
const pagePath = id => `/huey/page/${id}`;

/** A small, shared navigation surface; source text never enters its contents. */
export function mountBookNavigation({ groups, orders = null, navigate, pathForPage = pagePath, notice }) {
  const bar = node('nav', undefined, 'book-navigation'); bar.id = 'book-navigation';
  bar.setAttribute('aria-label', 'Book navigation');
  const previous = node('button', '←'); previous.type = 'button';
  const contents = node('button', 'Contents'); contents.type = 'button';
  contents.setAttribute('aria-haspopup', 'dialog'); contents.setAttribute('aria-expanded', 'false');
  const position = node('span', '', 'book-position'); position.id = 'book-position';
  const next = node('button', '→'); next.type = 'button';
  const center = node('div', undefined, 'book-navigation-center'); center.append(contents, position);
  bar.append(previous, center, next);
  const dialog = node('dialog', undefined, 'book-contents'); dialog.id = 'book-contents-dialog';
  let returnFocusOnClose = true;
  function closeForNavigation(path) {
    returnFocusOnClose = false; dialog.close(); navigate(path);
  }
  dialog.setAttribute('aria-labelledby', 'book-contents-title');
  const top = node('div', undefined, 'contents-top');
  const title = node('h2', 'Contents'); title.id = 'book-contents-title';
  const close = node('button', 'Close'); close.type = 'button'; top.append(title, close);
  const description = node('p', notice, 'contents-notice');
  const context = node('div', undefined, 'contents-context');
  const label = node('label', 'Find a chapter or section'); label.htmlFor = 'contents-search';
  const search = node('input'); search.type = 'search'; search.id = 'contents-search';
  search.placeholder = 'Chapter, section, or title';
  const empty = node('p', 'No matching sections.', 'contents-notice'); empty.hidden = true;
  const list = node('div', undefined, 'contents-groups');
  const entries = [];
  for (const group of groups) {
    if (!group.entries.length) continue;
    const section = node('section'); section.dataset.contentsGroup = group.key;
    section.append(node('h3', group.label));
    const ul = node('ul');
    for (const entry of group.entries) {
      const li = node('li');
      const a = node('a'); a.href = entry.path; a.dataset.slotId = entry.id;
      a.dataset.navigationPath = entry.path;
      a.append(node('span', entry.label, 'contents-label'));
      const status = entry.status ? entry.status === 'admitted' ? 'In this copy' : 'Not in admitted copy'
        : entry.access === 'restricted' ? 'Restricted text'
          : entry.access === 'unavailable-on-this-client' ? 'Text unavailable'
            : ({ full: 'Available text', partial: 'Partial', unplaced: 'Unplaced', placeholder: 'Text unavailable' }[entry.materialization] ?? entry.materialization);
      a.append(node('small', status, 'contents-state'));
      li.append(a); ul.append(li);
      entries.push({ entry, li, a, section, search: `${entry.id} ${entry.label} ${entry.locators ?? ''}`.toLocaleLowerCase() });
    }
    section.append(ul); list.append(section);
  }
  dialog.append(top, description, context, label, search);
  let jump = null, sequence = null, number = null;
  if (orders) {
    jump = node('form', undefined, 'contents-jump');
    const sequenceLabel = node('label', 'Page sequence'); sequenceLabel.htmlFor = 'contents-sequence';
    sequence = node('select'); sequence.id = 'contents-sequence';
    for (const [key, text] of [['book', 'Book'], ['unplaced', 'Unplaced']]) {
      if (!orders[key]?.length) continue;
      const option = node('option', text); option.value = key; sequence.append(option);
    }
    const numberLabel = node('label', 'Page number'); numberLabel.htmlFor = 'contents-page';
    number = node('input'); number.type = 'number'; number.id = 'contents-page';
    number.min = '1'; number.step = '1'; number.required = true;
    const go = node('button', 'Go to page'); go.type = 'submit';
    const bounds = () => { number.max = String(orders[sequence.value].length); };
    sequence.addEventListener('change', () => { bounds(); number.value = '1'; }); bounds();
    jump.append(sequenceLabel, sequence, numberLabel, number, go); dialog.append(jump);
    jump.addEventListener('submit', event => {
      event.preventDefault();
      if (!jump.reportValidity()) return;
      const id = orders[sequence.value][Number(number.value) - 1];
      if (id) closeForNavigation(pathForPage(id));
    });
  }
  dialog.append(empty, list);
  const skip = document.querySelector('.skip-link');
  if (skip) skip.after(bar); else document.body.prepend(bar);
  document.body.append(dialog);
  document.documentElement.classList.add('has-book-navigation');
  let state = {};
  function update(value) {
    state = value;
    const unit = orders ? 'page' : 'chapter';
    for (const [button, direction, text] of [[previous, 'previous', 'Previous'], [next, 'next', 'Next']]) {
      button.disabled = !state[direction]; button.setAttribute('aria-label', `${text} ${unit}`);
      button.title = `${text} ${unit}`;
    }
    position.textContent = Number.isInteger(state.index) ? `${orders ? 'Page' : 'Chapter'} ${state.index + 1} of ${state.total}` : '';
    position.title = state.sequence === 'unplaced' ? 'Unplaced material, outside the book sequence' : 'Selected reading order';
    for (const { entry, a } of entries) {
      if (entry.pageIds?.includes(state.pageId) || entry.id === state.slotId) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
  }
  function refreshFilter() {
    const query = search.value.trim().toLocaleLowerCase();
    for (const entry of entries) entry.li.hidden = !entry.search.includes(query);
    for (const section of list.children) section.hidden = !entries.some(entry => entry.section === section && !entry.li.hidden);
    empty.hidden = entries.some(entry => !entry.li.hidden);
  }
  search.addEventListener('input', refreshFilter);
  contents.addEventListener('click', () => {
    search.value = ''; refreshFilter();
    if (orders) {
      sequence.value = state.sequence ?? 'book'; number.max = String(orders[sequence.value].length);
      number.value = String(Number.isInteger(state.index) ? state.index + 1 : 1);
    }
    returnFocusOnClose = true;
    dialog.showModal(); contents.setAttribute('aria-expanded', 'true'); search.focus();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    contents.setAttribute('aria-expanded', 'false');
    if (returnFocusOnClose) contents.focus({ preventScroll: true });
  });
  for (const [button, direction] of [[previous, 'previous'], [next, 'next']]) {
    button.addEventListener('click', () => { if (state[direction]) navigate(state[direction]); });
  }
  dialog.addEventListener('click', event => {
    const a = event.target.closest('a[data-navigation-path]');
    if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); closeForNavigation(a.dataset.navigationPath);
  });
  return { update, context, destroy() { bar.remove(); dialog.remove(); } };
}

export async function mountAdmittedNavigation(reader, { editorial = false } = {}) {
  let payload = null;
  if (editorial) {
    try {
      const response = await fetch('/data/traversal.json', { cache: 'no-store', credentials: 'omit' });
      if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
        const value = await response.json(); buildBookContents(value); payload = value;
      }
    } catch { /* Keep admitted chapter navigation usable if the editorial copy fails. */ }
  }
  let navigation, sourceBook = null, pageRoutes = new Map(), entityRoutes = new Map(), entityPages = new Map();
  const pages = new Map(payload?.pages.map(page => [page.id, page]) ?? []);
  const targets = new Map(payload?.routes.targets.map(target => [target.id, target]) ?? []);
  const orders = payload ? { book: payload.readingOrder, unplaced: payload.unplacedOrder } : null;
  const positions = new Map();
  if (orders) for (const [sequence, order] of Object.entries(orders)) order.forEach((id, index) => positions.set(id,
    { pageId: id, sequence, index, total: order.length, previous: order[index - 1], next: order[index + 1] }));
  function go(path) {
    if (path.startsWith('#')) {
      if (location.hash === path) window.dispatchEvent(new HashChangeEvent('hashchange'));
      else location.hash = path;
    } else if (window.HueyEditor?.hasLocalDraft()) {
      // Preserve the entire editable DOM in its original tab, including formatting.
      // Browser-local prose is never copied into public projections or storage.
      window.open(path, '_blank', 'noopener');
    } else location.assign(path);
  }
  const routeForPage = id => pageRoutes.get(id) ?? pagePath(id);
  function refresh() {
    const { book, item, bindings } = reader.readingState();
    if (!book) return;
    if (!navigation || sourceBook !== book) {
      sourceBook = book;
      const groups = payload ? contentsWithLocators(payload) : [{ key: 'book', label: 'Admitted reading copy', entries: admittedBookContents(book) }];
      navigation = mountBookNavigation({ groups, orders, navigate: go, pathForPage: routeForPage,
        notice: payload ? 'Working book · available, partial, restricted and unresolved sections remain visible. This tab shows the admitted reading copy.'
          : 'Admitted reading copy · sections without admitted text remain listed.' });
      if (payload) {
        const working = node('a', 'Open working book here'); working.dataset.navigationPath = '/huey';
        working.href = '/huey'; working.id = 'open-working-book'; navigation.context.append(working);
        navigation.context.append(node('small', 'Local edits stay in this tab; working-book links open separately when edits are present.'));
      }
    }
    if (payload && bindings && !entityRoutes.size) {
      for (const chapter of book.chapters.filter(chapter => chapter.status === 'admitted')) {
        for (const block of chapter.blocks.filter(block => block.type === 'paragraph')) {
          const binding = findLegacyBinding(bindings, { chapterId: chapter.id, chapterBlob: chapter.blob,
            ordinal: block.number, rawSha256: block.sha256 });
          if (binding) entityRoutes.set(binding.entityId, { binding, path: paragraphHashRoute('read', chapter.id, block.number, chapter.blob) });
        }
      }
      for (const page of pages.values()) {
        for (const block of page.blocks) if (entityRoutes.has(block.id)) {
          const target = targets.get(block.id), pageTarget = targets.get(page.id);
          // No ambiguous page or changed entity-version bridge is inferred.
          const source = entityRoutes.get(block.id);
          if (block.kind === 'Paragraph' && target?.kind === 'Paragraph'
            && target.pageIds.length === 1 && target.pageIds[0] === page.id
            && target.version === source.binding.entityVersion
            && target.access === 'available' && !target.unresolved
            && pageTarget?.access === 'available' && !pageTarget.unresolved
            && page.blocks.filter(member => member.id === block.id && member.kind === 'Paragraph').length === 1) entityPages.set(block.id, page.id);
        }
        const first = page.blocks.find(block => block.kind === 'Paragraph');
        if (entityPages.get(first?.id) === page.id) pageRoutes.set(page.id, entityRoutes.get(first.id).path);
      }
      const entries = buildBookContents(payload).flatMap(group => group.entries);
      for (const a of document.querySelectorAll('#book-contents-dialog a[data-slot-id]')) {
        const firstPage = entries.find(entry => entry.id === a.dataset.slotId)?.pageIds[0];
        if (firstPage) a.href = a.dataset.navigationPath = routeForPage(firstPage);
      }
    }
    if (payload) {
      const binding = item && bindings && findLegacyBinding(bindings, { chapterId: item.chapterId,
        chapterBlob: book.chapters.find(chapter => chapter.id === item.chapterId).blob,
        ordinal: item.number, rawSha256: item.sha256 });
      const route = parseRoute(location.hash);
      const requestedChapter = book.chapters.find(chapter => chapter.id === route.chapter);
      const exactRouteValid = route.kind === 'home' || location.hash === '#book'
        || (route.kind === 'chapter' && requestedChapter?.status === 'admitted')
        || (['read', 'evidence'].includes(route.kind) && requestedChapter?.status === 'admitted'
          && route.version === requestedChapter.blob
          && requestedChapter.blocks.some(block => block.type === 'paragraph' && block.number === route.paragraph));
      const pageId = exactRouteValid && binding ? entityPages.get(binding.entityId) : null;
      const state = positions.get(pageId) ?? {};
      navigation.update({ ...state, previous: state.previous && routeForPage(state.previous), next: state.next && routeForPage(state.next) });
      const working = document.getElementById('open-working-book');
      working.href = working.dataset.navigationPath = pageId ? paragraphLinks({ id: binding.entityId, version: binding.entityVersion }).exact : '/huey';
      working.textContent = pageId ? 'Open working book here' : 'Open working book';
    } else {
      const index = book.chapters.findIndex(chapter => chapter.id === item?.chapterId);
      navigation.update({ slotId: item?.chapterId, index, total: book.chapters.length,
        previous: index > 0 ? `#chapter/${book.chapters[index - 1].id}` : null,
        next: index + 1 < book.chapters.length ? `#chapter/${book.chapters[index + 1].id}` : null });
    }
  }
  window.addEventListener('huey-reading-position', refresh);
  window.addEventListener('hashchange', refresh);
  refresh();
}

// Existing readable aliases are working locators, not final chapter identities.
export function contentsWithLocators(payload) {
  return buildBookContents(payload).map(group => ({ ...group, entries: group.entries.map(entry => ({ ...entry,
    locators: payload.routes.aliases.filter(alias => alias.targetId === entry.id).map(alias => alias.path).join(' '),
  })) }));
}
