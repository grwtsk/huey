import { createTraversal, EdgeIntent } from './traversal.mjs';
import { formatEntityRoute } from './routes.mjs';
import { resolveParagraphLocation, paragraphLinks, validateParagraphBindings, lookupEvidenceBinding } from './paragraphs.mjs';
import { paragraphHashRoute } from './text.mjs';

const node = (tag, text, className = '') => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  element.className = className;
  return element;
};
const pathFor = id => formatEntityRoute({ id, kind: 'ReadingPage' });
const address = () => location.pathname + location.search + location.hash;
const main = node('main', undefined, 'book traversal-book');
main.id = 'book'; main.tabIndex = -1;
const live = node('p', '', 'sr-only'); live.setAttribute('role', 'status');
const skip = node('a', 'Skip to the page', 'skip-link'); skip.href = '#book';
// The admitted editable DOM and its runtime are never started on this surface.
// Traversal is read-only until the separate editor/draft migration preserves edits.
document.body.replaceChildren(skip, main, live);
let traversal, pages, current, projection, targets, bindings = null, paragraphLocation = null, composing = false, pointerDown = false, wheelArmed = false;
const edges = { previous: new EdgeIntent(), next: new EdgeIntent() };
const cancel = () => { wheelArmed = false; Object.values(edges).forEach(edge => edge.cancel()); };
const atEdge = direction => direction === 'previous' ? scrollY <= 2
  : scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
const interactive = element => element instanceof Element && Boolean(element.closest(
  'a,button,summary,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"],dialog,[role="dialog"]'));
const blocked = target => composing || pointerDown || document.hidden
  || getSelection()?.isCollapsed === false || interactive(target) || interactive(document.activeElement)
  || Boolean(document.querySelector('dialog[open],[role="dialog"]:not([hidden])'));

function pageLink(label, id) {
  const a = node('a', label); a.href = pathFor(id); a.dataset.pageAddress = a.getAttribute('href');
  return a;
}
function edgeLink(direction, id) {
  const nav = node('nav', undefined, 'page-edge');
  nav.setAttribute('aria-label', direction === 'previous' ? 'Previous page' : 'Next page');
  if (id) {
    const a = pageLink(direction === 'previous' ? '← Previous page' : 'Next page →', id);
    a.rel = direction === 'previous' ? 'prev' : 'next';
    a.title = `Also Alt+${direction === 'previous' ? 'PageUp' : 'PageDown'}, or press Alt at this edge and continue scrolling`;
    nav.append(a);
  } else nav.append(node('span', direction === 'previous' ? 'Beginning of this sequence' : 'End of this sequence'));
  return nav;
}
function states(slots) {
  const details = node('details', undefined, 'traversal-states'); details.append(node('summary', 'Editorial state'));
  for (const slot of slots) {
    const dl = node('dl');
    for (const [term, value] of [
      ['Literary presence', slot.presence], ['Materialization', slot.editorialMaterialization],
      ['Access in this copy', slot.access], ['Publication annotation (not authority)', slot.publicationAnnotation.label],
      ['Reader admission observation', slot.observedReaderAdmission]
    ]) dl.append(node('dt', term), node('dd', value));
    details.append(dl);
  }
  return details;
}
const outcome = {
  'invalid-route': 'This address is outside the Huey route grammar.',
  unknown: 'This entity is not known in this projection.',
  restricted: 'The text for this page is restricted. Its place in the work remains visible.',
  unavailable: 'Text is not available in this copy. Missing text does not mean omission.',
  'version-unavailable': 'The requested exact state is unavailable. Current text has not been substituted.',
  unresolved: 'This part of the work remains unresolved.'
};
function render({ focus = false, resetScroll = false, fromHistory = false } = {}) {
  cancel();
  current = traversal.locate(address());
  paragraphLocation = resolveParagraphLocation(address(), projection, history.state?.hueyParagraphPage ?? null);
  if (paragraphLocation.status === 'located') {
    const matches = pages.get(paragraphLocation.selectedPageId)?.blocks
      .filter(block => block.id === paragraphLocation.paragraphId) ?? [];
    if (matches.length !== 1 || matches[0].kind !== 'Paragraph') {
      // Metadata alone cannot stand in for the requested materialized occurrence.
      paragraphLocation = { ...paragraphLocation, status: 'unavailable', selectedPageId: null,
        sequence: null, index: null, previous: null, next: null };
    }
  }
  if (paragraphLocation.status !== 'not-paragraph') {
    current = { ...current, pageId: paragraphLocation.selectedPageId,
      sequence: paragraphLocation.sequence, index: paragraphLocation.index,
      previous: paragraphLocation.previous, next: paragraphLocation.next };
  }
  const r = current.resolution;
  if (r.redirectTo) history.replaceState(history.state, '', r.redirectTo);
  const page = current.pageId ? pages.get(current.pageId) : null;
  main.replaceChildren();
  main.dataset.pageId = current.pageId ?? '';
  main.dataset.outcome = r.status;
  main.dataset.paragraphId = paragraphLocation.paragraphId ?? '';
  main.dataset.paragraphLocation = paragraphLocation.status;
  main.append(node('p', 'Editorial traversal · read-only working copy', 'traversal-notice'));
  main.append(node('p', 'Working draft — claim verification incomplete.', 'traversal-notice'));
  if (page) main.append(edgeLink('previous', current.previous));
  const heading = node('h1', page?.label ?? 'Huey', 'chapter-title'); heading.tabIndex = -1;
  main.append(heading);
  if (current.sequence === 'unplaced') main.append(node('p', 'Unplaced material · outside the book sequence', 'movement'));
  if (outcome[r.status]) main.append(node('p', outcome[r.status], 'page-outcome'));
  if (paragraphLocation.status === 'ambiguous') {
    main.append(node('p', 'This paragraph appears on more than one page, or its previous page choice is no longer available. Choose its reading context.'));
    const choices = node('div', undefined, 'paragraph-page-choices');
    for (const id of paragraphLocation.candidates) {
      const position = traversal.locate(pathFor(id));
      const choice = node('button', `Show in ${position.sequence === 'book' ? 'book' : 'unplaced'} page ${position.index + 1}`);
      choice.type = 'button'; choice.dataset.pageChoice = id; choices.append(choice);
    }
    main.append(choices);
  } else if (paragraphLocation.status === 'unprojected') {
    main.append(node('p', 'This paragraph is known but is not in the current page projection. No replacement or successor is inferred.'));
  } else if (paragraphLocation.status === 'unavailable' && !outcome[r.status]) {
    main.append(node('p', 'No current reading page for this paragraph can materialize here.'));
  } else if (!page && r.entityId && r.kind !== 'Paragraph') {
    main.append(node('p', 'This entity is known. Select a ReadingPage or Paragraph to read it.'));
  }
  if (page && r.status === 'resolved') {
    if (!page.blocks.length) main.append(node('p', 'No selected prose is materialized on this page.', 'page-outcome'));
    // Exact page versions pin local membership only, not historical descendant text.
    if (r.requestedVersion) main.append(node('p', r.kind === 'Paragraph'
      ? 'Exact paragraph wording; surrounding text is from the selected current page.'
      : 'Exact page membership; text below is the selected current descendant state.', 'traversal-notice'));
    let paragraphNumber = 0;
    for (const block of page.blocks) {
      let element;
      if (block.kind === 'Paragraph') element = node('p', block.text, 'prose traversal-paragraph');
      else if (block.format === 'markdown-thematic-break') element = node('hr');
      else if (block.format === 'markdown-heading') element = node('h2', block.text.replace(/^ {0,3}#{1,6}[ \t]+/, ''));
      else element = node('pre', block.text, 'traversal-source-note');
      element.dataset.entityId = block.id;
      if (block.kind === 'Paragraph') {
        paragraphNumber += 1;
        element.id = block.id; element.tabIndex = -1;
        const row = node('div', undefined, 'traversal-paragraph-row');
        const links = node('nav', undefined, 'paragraph-links');
        links.setAttribute('aria-label', `Links for paragraph ${paragraphNumber}`);
        const version = targets.get(block.id)?.version;
        if (version) {
          const paths = paragraphLinks({ id: block.id, version });
          for (const [label, path] of [['Current link', paths.current], ['Exact wording', paths.exact]]) {
            const a = node('a', label); a.href = path; a.dataset.pageAddress = path; links.append(a);
          }
          const binding = bindings && lookupEvidenceBinding(bindings, { entityId: block.id, entityVersion: version });
          if (binding) {
            const evidence = node('a', 'Evidence');
            evidence.href = '/' + paragraphHashRoute('evidence', binding.chapterId, binding.ordinal, binding.chapterBlob);
            evidence.setAttribute('aria-label', `Evidence for paragraph ${paragraphNumber}, pinned admitted wording`);
            links.append(evidence);
          } else if (block.id === paragraphLocation.paragraphId) {
            links.append(node('span', bindings ? 'No exact admitted evidence collection is mapped.' : 'Evidence-link reconciliation is unavailable.'));
          }
        }
        row.append(element, links); main.append(row);
      } else main.append(element);
    }
  }
  if (r.slots?.length) main.append(states(r.slots));
  if (page) main.append(edgeLink('next', current.next));
  const links = node('nav', undefined, 'traversal-context'); links.setAttribute('aria-label', 'Reading context');
  const start = node('a', 'Book beginning'); start.href = '/huey'; start.dataset.pageAddress = '/huey'; links.append(start);
  if (traversal.unplacedOrder.length && current.sequence !== 'unplaced') links.append(pageLink('Unplaced material', traversal.unplacedOrder[0]));
  const admitted = node('a', 'Admitted reading copy'); admitted.href = '/'; links.append(admitted);
  main.append(links);
  document.title = `${page?.label ?? 'Route outcome'} · Huey`;
  const paragraphStatus = {
    ambiguous: 'Choose a reading page for this paragraph.',
    unprojected: 'Paragraph known, with no current reading page.',
    unavailable: 'Paragraph or its reading context is unavailable.',
    located: 'Paragraph focused on its selected reading page.'
  }[paragraphLocation.status];
  live.textContent = `${page?.label ?? 'Route outcome'}. ${outcome[r.status] ?? paragraphStatus ?? (page ? 'Page available.' : 'Entity available.')}`;
  const subject = paragraphLocation.status === 'located' ? document.getElementById(paragraphLocation.paragraphId) : null;
  if (subject) {
    subject.classList.add('permalink-target');
    // Deep links focus the exact occurrence; history retains its native scroll restoration.
    subject.focus({ preventScroll: true });
    if (!fromHistory) subject.scrollIntoView({ block: 'center', behavior: 'instant' });
  } else {
    if (focus) heading.focus({ preventScroll: true });
    if (resetScroll) window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
function navigate(path) {
  if (traversal.locate(path).resolution.status === 'invalid-route') return;
  if (path === address()) return;
  history.pushState(null, '', path);
  render({ focus: true, resetScroll: true });
}
main.addEventListener('click', event => {
  const choice = event.target.closest('button[data-page-choice]');
  if (choice && paragraphLocation?.candidates.includes(choice.dataset.pageChoice)) {
    history.replaceState({ ...history.state, hueyParagraphPage: choice.dataset.pageChoice }, '', address());
    render({ focus: true }); return;
  }
  const a = event.target.closest('a[data-page-address]');
  if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); navigate(a.dataset.pageAddress);
});
skip.addEventListener('click', event => { event.preventDefault(); main.focus(); });
window.addEventListener('popstate', () => traversal && render({ focus: true, fromHistory: true }));
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') cancel();
  if (event.key === 'Alt' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.shiftKey && current && !blocked(event.target)) {
    wheelArmed = false;
    for (const direction of ['previous', 'next']) {
      const armed = edges[direction].arm({ direction, now: performance.now(), blocked: false, atEdge: Boolean(current[direction]) && atEdge(direction) });
      wheelArmed = armed || wheelArmed;
    }
  } else if (['PageUp', 'PageDown'].includes(event.key) && event.altKey && !event.repeat && !event.ctrlKey && !event.metaKey && !event.shiftKey && current && !blocked(event.target)) {
    const id = current[event.key === 'PageUp' ? 'previous' : 'next'];
    cancel();
    if (id) { event.preventDefault(); navigate(pathFor(id)); }
  } else if (event.key !== 'Alt') cancel();
});
window.addEventListener('keyup', event => { if (event.key === 'Alt') cancel(); });
window.addEventListener('wheel', event => {
  const direction = event.deltaY < 0 ? 'previous' : 'next';
  if (!wheelArmed || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
    || blocked(event.target) || !atEdge(direction)) { cancel(); return; }
  edges[direction === 'next' ? 'previous' : 'next'].cancel();
  // Native scrolling is untouched unless explicitly armed at the page boundary.
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  const turn = edges[direction].wheel({ direction, delta: Math.abs(event.deltaY) * unit,
    now: performance.now(), blocked: false, atEdge: true, altKey: true });
  if (turn && current[turn]) { const id = current[turn]; cancel(); navigate(pathFor(id)); }
}, { passive: false });
for (const name of ['blur', 'resize', 'pagehide']) window.addEventListener(name, cancel);
for (const name of ['selectionchange', 'focusin', 'visibilitychange', 'beforeinput', 'input']) document.addEventListener(name, cancel);
document.addEventListener('compositionstart', () => { composing = true; cancel(); });
document.addEventListener('compositionend', () => { composing = false; cancel(); });
document.addEventListener('pointerdown', () => { pointerDown = true; cancel(); });
for (const name of ['pointerup', 'pointercancel']) document.addEventListener(name, () => { pointerDown = false; cancel(); });

try {
  const response = await fetch('/data/traversal.json', { cache: 'no-store', credentials: 'omit' });
  if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) throw new Error('Unavailable');
  const payload = await response.json();
  if (payload.schema !== 'huey.editorial-traversal.v1') throw new Error('Unsupported');
  projection = payload;
  traversal = createTraversal(payload);
  targets = new Map(payload.routes.targets.map(target => [target.id, target]));
  try {
    const response = await fetch('/data/paragraphs.json', { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('Unavailable');
    bindings = validateParagraphBindings(await response.json());
  } catch { bindings = null; }
  pages = new Map(payload.pages.map(page => [page.id, page]));
  const ids = [...traversal.readingOrder, ...traversal.unplacedOrder];
  if (pages.size !== ids.length || !ids.every(id => pages.has(id))) throw new Error('Incomplete');
  render();
} catch {
  main.replaceChildren(node('h1', 'Editorial traversal unavailable'), node('p', 'This build does not contain a usable editorial projection. The admitted reading copy remains separate.'));
  const a = node('a', 'Open admitted reading copy'); a.href = '/'; main.append(a);
}
