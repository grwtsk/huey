import { Narrator, voiceKey, ChapterTimeline, formatTime } from './speech.mjs';
import { paragraphHashRoute, paragraphId, parseRoute, safeUrl } from './text.mjs';

const $ = id => document.getElementById(id);
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function link(text, url) {
  const a = el('a', '', text);
  if (safeUrl(url)) { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  return a;
}
function appendInline(node, tokens) {
  for (const token of tokens) {
    if (token.type === 'text') node.append(document.createTextNode(token.text));
    else if (token.type === 'link') node.append(link(token.text, token.url));
    else if (['em', 'strong', 'code'].includes(token.type)) node.append(el(token.type, '', token.text));
    else throw new Error('Unsupported inline content');
  }
}

let book, chapters, sourceMap;
let activeIndex = 0, paragraphNodes = [], positions = [], items = [];
let lastSpeaking = null, raf = 0;
let returnFocus = null;
let timeline = null, scrub = null;
const dialog = $('evidence-dialog');
const narrator = new Narrator({
  synth: window.speechSynthesis,
  Utterance: window.SpeechSynthesisUtterance,
  onState({ state, message }) {
    $('play-label').textContent = state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Play';
    $('play-symbol').textContent = state === 'playing' ? 'Ⅱ' : '▶';
    $('stop').disabled = !['playing', 'paused'].includes(state);
    $('status').textContent = message;
    if (state !== 'playing' && lastSpeaking) lastSpeaking.removeAttribute('data-speaking');
    showPosition();
    requestAnimationFrame(measure);
  },
  onParagraph(item) {
    if (lastSpeaking) lastSpeaking.removeAttribute('data-speaking');
    lastSpeaking = document.getElementById(item.id);
    lastSpeaking?.setAttribute('data-speaking', 'true');
    if ($('follow').checked) lastSpeaking?.scrollIntoView({ block: 'center', behavior: 'auto' });
    showPosition();
  },
  onPosition() { showPosition(); }
});

function playbackCursor() {
  return ['playing', 'paused', 'ended'].includes(narrator.state)
    ? { index: narrator.index, offset: narrator.boundary }
    : { index: activeIndex, offset: 0 };
}
function paintPosition(position) {
  if (!position) return;
  const item = items[position.index];
  $('current-location').textContent = item.label;
  $('chapter-timer').textContent = `≈ ${formatTime(position.elapsed)} / ${formatTime(position.duration)}`;
  $('chapter-timer').title = 'Estimated position / chapter duration at 180 words per minute, adjusted for reading speed. Not measured audio time.';
  const slider = $('chapter-progress');
  slider.disabled = false;
  slider.value = String(Math.round(position.ratio * 1000));
  slider.setAttribute('aria-valuetext', `Chapter ${chapters.get(position.chapterId).label}, ${Math.round(position.ratio * 100)} percent; estimated ${formatTime(position.elapsed)} of ${formatTime(position.duration)}`);
  document.documentElement.style.setProperty('--progress', String(position.ratio));
  $('current-title').textContent = chapters.get(position.chapterId).title;
  for (const a of document.querySelectorAll('.chapter-link')) {
    if (a.dataset.chapter === position.chapterId) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  }
}
function showPosition() {
  if (!timeline || scrub) return;
  const cursor = playbackCursor();
  paintPosition(timeline.position(cursor.index, cursor.offset, narrator.rate));
}
function beginScrub() {
  if (scrub || !timeline || !items.length) return;
  const origin = playbackCursor();
  scrub = { chapterId: items[origin.index].chapterId, origin, resume: narrator.state === 'playing', ratio: Number($('chapter-progress').value) / 1000 };
  if (scrub.resume) narrator.pause();
}
function previewScrub() {
  // Save the new native range value before beginScrub pauses the speech engine.
  const ratio = Number($('chapter-progress').value) / 1000;
  beginScrub();
  if (!scrub) return;
  scrub.ratio = ratio;
  const target = timeline.seek(scrub.chapterId, ratio);
  const position = timeline.position(target.index, target.offset, narrator.rate);
  // The pointer follows the requested fraction; release snaps to a whole word.
  paintPosition({ ...position, ratio, elapsed: position.duration * ratio });
}
function commitScrub() {
  if (!scrub) return;
  const pending = scrub;
  const target = timeline.seek(pending.chapterId, pending.ratio);
  scrub = null;
  activeIndex = target.index;
  narrator.seek(target.index, target.offset, { resume: pending.resume, end: target.end });
  document.getElementById(items[target.index].id)?.scrollIntoView({ block: 'start', behavior: 'auto' });
  showPosition();
}
function cancelScrub() {
  if (!scrub) return;
  const { origin } = scrub;
  scrub = null;
  narrator.seek(origin.index, origin.offset); // Cancellation leaves playback paused.
  showPosition();
}
const chapterProgress = $('chapter-progress');
chapterProgress.addEventListener('pointerdown', event => {
  beginScrub();
  chapterProgress.setPointerCapture(event.pointerId);
});
chapterProgress.addEventListener('input', previewScrub);
chapterProgress.addEventListener('change', commitScrub);
chapterProgress.addEventListener('pointerup', commitScrub);
chapterProgress.addEventListener('pointercancel', cancelScrub);
chapterProgress.addEventListener('lostpointercapture', commitScrub);
chapterProgress.addEventListener('blur', commitScrub);
chapterProgress.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); cancelScrub(); }
});
function refreshVoices() {
  const voices = narrator.voices;
  const selected = narrator.voice;
  const select = $('voice');
  select.replaceChildren();
  for (const voice of voices) {
    const option = el('option', '', `${voice.name} · ${voice.lang}${voice.localService ? '' : ' · online'}`);
    option.value = voiceKey(voice);
    option.selected = selected && option.value === voiceKey(selected);
    select.append(option);
  }
  if (!voices.length) select.append(el('option', '', narrator.supported ? 'No on-device voices available' : 'Speech synthesis not supported'));
  select.disabled = !voices.length;
  $('play').disabled = !narrator.supported || !voices.length || !items.length;
  $('voice-status').textContent = !narrator.supported ? 'This browser does not provide speech synthesis.' :
    !voices.length ? 'Open this menu again after installing a system voice, or allow online voices explicitly. Screen-reader reading remains available.' :
      `${voices.length} voice${voices.length === 1 ? '' : 's'} available. No microphone access is requested.`;
}
function configureSpeech() {
  const rate = Number($('rate').value);
  narrator.configure({ rate, voice: $('voice').value, allowRemote: $('remote-voices').checked });
  $('rate-value').textContent = `${rate.toFixed(1)}×`;
  refreshVoices();
  showPosition();
}
$('play').addEventListener('click', () => {
  if (narrator.state === 'playing') narrator.pause();
  else if (narrator.state === 'paused') narrator.play();
  else if (narrator.state === 'ended') narrator.play(timeline.chapters.get(items[narrator.index].chapterId).entries[0].index);
  else narrator.play(activeIndex);
});
$('stop').addEventListener('click', () => narrator.stop());
$('voice').addEventListener('change', configureSpeech);
$('rate').addEventListener('input', configureSpeech);
$('remote-voices').addEventListener('change', configureSpeech);
$('options').addEventListener('toggle', refreshVoices);
window.speechSynthesis?.addEventListener('voiceschanged', refreshVoices);
window.addEventListener('focus', refreshVoices);
window.addEventListener('pagehide', () => narrator.stop());
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') $('options').open = false;
  if (event.target !== chapterProgress && ['PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) $('follow').checked = false;
});
for (const name of ['wheel', 'touchmove']) window.addEventListener(name, () => { $('follow').checked = false; }, { passive: true });
document.addEventListener('click', event => { if (!$('options').contains(event.target)) $('options').open = false; });

function setActive(index) {
  if (!items[index]) return;
  activeIndex = index;
  showPosition();
}
function measure() {
  document.documentElement.style.setProperty('--header-height', `${document.querySelector('.reader-title').offsetHeight}px`);
  document.documentElement.style.setProperty('--footer-height', `${document.querySelector('.reader-controls').offsetHeight}px`);
  positions = paragraphNodes.map(p => p.getBoundingClientRect().top + window.scrollY);
  trackScroll();
}
function trackScroll() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (!positions.length || dialog.open) return;
    const point = window.scrollY + document.querySelector('.reader-title').offsetHeight + 45;
    let lo = 0, hi = positions.length - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (positions[mid] <= point) lo = mid; else hi = mid - 1; }
    setActive(lo);
  });
}
window.addEventListener('scroll', trackScroll, { passive: true });
window.addEventListener('resize', measure);
if (window.ResizeObserver) {
  const observer = new ResizeObserver(measure);
  observer.observe(document.querySelector('.reader-title'));
  observer.observe(document.querySelector('.reader-controls'));
}

function render() {
  const admitted = book.chapters.filter(c => c.status === 'admitted');
  $('author').textContent = book.author;
  $('notice').textContent = book.notice;
  $('availability').textContent = `${admitted.length} of ${book.chapters.length} chapter entries available · paragraph references use stable chapter labels, including 8A.`;
  const list = $('chapter-list');
  for (const chapter of book.chapters) {
    const li = el('li');
    const a = el('a', 'chapter-link');
    a.href = `#chapter/${chapter.id}`;
    a.dataset.chapter = chapter.id;
    a.dataset.available = String(chapter.status === 'admitted');
    a.setAttribute('aria-label', `${chapter.label}. ${chapter.title}${chapter.status === 'unavailable' ? '. Not in this reading copy.' : ''}`);
    const label = el('span', 'chapter-label', `${chapter.label} · ${chapter.title}`);
    if (chapter.status === 'unavailable') label.append(el('small', '', 'Not in this copy'));
    label.setAttribute('aria-hidden', 'true');
    const dot = el('span', 'chapter-dot'); dot.setAttribute('aria-hidden', 'true');
    a.append(label, dot); li.append(a); list.append(li);
  }
  let visibleMovement = null;
  for (const [chapterIndex, chapter] of book.chapters.entries()) {
    if (chapter.status !== 'admitted') continue;
    const section = el('section', 'chapter');
    section.id = `chapter-${chapter.id}`;
    section.dataset.chapter = chapter.id;
    section.setAttribute('aria-labelledby', `title-${chapter.id}`);
    if (chapter.movement !== visibleMovement) section.append(el('p', 'movement', chapter.movement));
    visibleMovement = chapter.movement;
    const header = el('header', 'chapter-header');
    const title = el('h2', 'chapter-title', `${chapter.label}. ${chapter.title}`); title.id = `title-${chapter.id}`;
    header.append(title); section.append(header);
    const paragraphBlocks = chapter.blocks.filter(b => b.type === 'paragraph');
    for (const block of chapter.blocks) {
      if (block.type === 'break') { section.append(el('hr')); continue; }
      if (block.type === 'heading') { const h = el(`h${block.level}`); appendInline(h, block.tokens); section.append(h); continue; }
      const row = el('div', 'paragraph reader-paragraph'); row.id = block.id;
      const number = el('a', 'paragraph-number', block.label);
      number.contentEditable = 'false';
      number.href = paragraphHashRoute('evidence', chapter.id, block.number, chapter.blob);
      number.setAttribute('aria-label', `Evidence and references for chapter ${chapter.label}, paragraph ${block.number}`);
      number.setAttribute('aria-haspopup', 'dialog');
      const p = el('p', 'prose'); appendInline(p, block.tokens);
      row.append(number, p); section.append(row);
      items.push({ ...block, breakAfter: block.number === paragraphBlocks.length &&
        book.chapters[chapterIndex + 1]?.status === 'unavailable' });
      paragraphNodes.push(row);
    }
    $('chapters').append(section);
  }
  timeline = new ChapterTimeline(items);
  narrator.setItems(items);
  setActive(0);
  $('book').setAttribute('aria-busy', 'false');
  refreshVoices();
  measure();
  document.fonts?.ready.then(measure);
}

function openDialog(title) {
  if (narrator.state === 'playing') narrator.pause();
  $('options').open = false;
  $('dialog-title').textContent = title;
  $('dialog-body').replaceChildren();
  if (!dialog.open) dialog.showModal();
  $('close-dialog').focus({ preventScroll: true });
}
function closeDialog() {
  if (!dialog.open) return;
  dialog.close();
  const focus = returnFocus;
  const item = items[activeIndex];
  const c = chapters.get(item.chapterId);
  // Replace the open panel route rather than race an asynchronous history.back().
  history.replaceState(null, '', paragraphHashRoute('read', c.id, item.number, c.blob));
  if (!focus?.isConnected) document.getElementById(item.id)?.scrollIntoView({ block: 'start' });
  if (focus?.isConnected) focus.focus({ preventScroll: true });
  else $('play').focus({ preventScroll: true });
}
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
    .filter(node => node.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (!first) return;
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
});
$('close-dialog').addEventListener('click', closeDialog);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
dialog.addEventListener('click', event => { if (event.target === dialog) {
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog();
} });

function renderSource(source, locator, note) {
  const li = el('li');
  li.append(source.access === 'public' ? link(source.title, source.url) : el('span', '', `${source.title} · restricted, not available here`));
  li.append(el('p', 'help', `${source.kind}. ${locator || ''} ${note || source.description}`));
  return li;
}
function showEvidence(chapter, p) {
  openDialog(`Evidence · ${p.label}`);
  const body = $('dialog-body');
  body.append(el('p', 'help', chapter.title), el('blockquote', '', p.text));
  body.append(el('p', 'help', 'Local edits on this page do not alter the admitted source wording, evidence mapping, or source rights.'));
  const state = p.evidence.coverage;
  body.append(el('p', 'collection-state', state === 'complete'
    ? 'Claim mapping recorded as complete. Mapping coverage is not a finding that every claim is verified.'
    : `${state === 'partial' ? 'Partial claim mapping' : 'Claim mapping pending'}. Missing entries do not mean the paragraph has no claims or that no evidence exists.`));
  body.append(el('h3', '', 'Claims in this paragraph'));
  if (!p.evidence.claims.length) body.append(el('p', '', 'No claim-level ledger has been attached yet. The source of the wording is available below; independent support and contrary material have not been mapped here.'));
  for (const claim of p.evidence.claims) {
    const article = el('article', 'claim');
    article.append(el('h4', '', claim.wording));
    article.append(el('p', 'help', `${claim.id} · ${claim.kind} · recorded disposition: ${claim.disposition}`));
    article.append(el('p', '', claim.limits), link('Verification issue', claim.issue));
    for (const [relation, heading] of [['supports', 'Supporting material'], ['contradicts', 'Contrary material'], ['context', 'Contextual references']]) {
      const entries = claim.links.filter(l => l.relation === relation);
      if (!entries.length) continue;
      article.append(el('h3', '', heading));
      const ul = el('ul', 'source-list');
      entries.forEach(e => ul.append(renderSource(sourceMap.get(e.sourceId), e.locator, e.note)));
      article.append(ul);
    }
    body.append(article);
  }
  body.append(el('h3', '', 'Evidence and references'));
  if (p.evidence.referenceIds.length) {
    const ul = el('ul', 'source-list');
    p.evidence.referenceIds.forEach(id => ul.append(renderSource(sourceMap.get(id)))); body.append(ul);
  } else body.append(el('p', '', 'No additional paragraph-level references are attached in this version.'));
  body.append(link('Review the evidence-mapping work', p.evidence.mappingIssue));
  body.append(el('h3', '', 'Source of this text'));
  body.append(link(`Pinned manuscript · lines ${p.startLine}–${p.endLine}`, p.sourceUrl));
  body.append(el('p', 'help', 'This identifies the admitted wording, not independent corroboration of the events described.'));
  body.append(link('Chapter admission and attribution', chapter.admission));
  if (p.evidence.reviewNote) body.append(el('p', '', p.evidence.reviewNote));
  if (p.evidence.reviewRef) body.append(link('Recorded mapping review', p.evidence.reviewRef));
  const actions = el('div', 'dialog-actions');
  const read = el('button', '', 'Read from here'); read.type = 'button';
  read.disabled = !narrator.supported || !narrator.voices.length;
  read.addEventListener('click', () => {
    dialog.close();
    history.replaceState(null, '', paragraphHashRoute('read', chapter.id, p.number, chapter.blob));
    const index = items.findIndex(i => i.id === p.id);
    setActive(index); document.getElementById(p.id).scrollIntoView({ block: 'start' });
    $('play').focus({ preventScroll: true }); narrator.play(index);
  });
  const copy = el('button', '', 'Copy evidence link'); copy.type = 'button';
  copy.addEventListener('click', async () => {
    const url = new URL(paragraphHashRoute('evidence', chapter.id, p.number, chapter.blob), location.href).href;
    try { await navigator.clipboard.writeText(url); copy.textContent = 'Link copied'; }
    catch {
      if (!body.querySelector('.link-copy')) {
        const input = el('input', 'link-copy'); input.readOnly = true; input.value = url;
        input.setAttribute('aria-label', 'Evidence permalink to copy'); body.append(input); input.focus(); input.select();
      }
    }
  });
  const anchor = el('a', '', 'Paragraph permalink');
  anchor.href = paragraphHashRoute('read', chapter.id, p.number, chapter.blob);
  actions.append(read, copy, anchor); body.append(actions);
}
function applyRoute() {
  if (!book || location.hash === '#book') return;
  const route = parseRoute(location.hash);
  if (route.kind === 'home') { if (dialog.open) dialog.close(); return; }
  const c = chapters.get(route.chapter);
  if (route.kind === 'invalid' || !c) {
    openDialog('Reference not found'); $('dialog-body').append(el('p', '', 'This address does not identify a chapter or paragraph in the current reading copy.')); return;
  }
  if (c.status !== 'admitted') {
    openDialog(`${c.label} · ${c.title}`);
    $('dialog-body').append(el('p', '', 'This chapter is not included in the admitted public reading copy. Its text has not been substituted, reconstructed or silently skipped in narration.'), link('Chapter work and availability', c.workIssue)); return;
  }
  if (route.kind === 'chapter') {
    if (dialog.open) dialog.close();
    document.getElementById(`chapter-${c.id}`).scrollIntoView({ block: 'start' });
    narrator.stop(); setActive(items.findIndex(p => p.chapterId === c.id)); return;
  }
  const p = items.find(p => p.id === paragraphId(c.id, route.paragraph));
  if (c.blob !== route.version || !p) {
    openDialog('Different manuscript version');
    $('dialog-body').append(el('p', '', 'This reference is for another chapter version or a paragraph not present here. It has not been redirected to a different claim collection. Return to the current text and create a new reference.')); return;
  }
  if (route.kind === 'evidence') {
    setActive(items.findIndex(item => item.id === p.id));
    showEvidence(c, p);
  }
  else {
    if (dialog.open) dialog.close();
    document.getElementById(p.id).scrollIntoView({ block: 'start' });
    narrator.stop(); setActive(items.findIndex(item => item.id === p.id));
  }
}
document.addEventListener('click', event => {
  const a = event.target.closest?.('a[href^="#"]');
  if (!a || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  if (a.hash === '#book') return;
  const route = parseRoute(a.hash);
  if (route.kind === 'evidence' || (route.kind === 'chapter' && chapters?.get(route.chapter)?.status !== 'admitted')) {
    returnFocus = a;
  }
  if (location.hash === a.hash) { event.preventDefault(); applyRoute(); }
});
window.addEventListener('hashchange', applyRoute);

async function start() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(new URL('./data/book.json', document.baseURI), { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('The generated manuscript could not be loaded.');
    book = await response.json();
    if (book.schemaVersion !== 1 || !Array.isArray(book.chapters) || !Array.isArray(book.sources)) throw new Error('Unsupported reading-copy format.');
    chapters = new Map(book.chapters.map(c => [c.id, c]));
    sourceMap = new Map(book.sources.map(s => [s.id, s]));
    render(); applyRoute();
  } catch (error) {
    $('availability').textContent = 'The reading copy is unavailable.';
    $('status').textContent = `${error.name === 'AbortError' ? 'Loading timed out.' : error.message} Run npm run content and inspect its validation result; no substitute text has been generated.`;
    $('book').setAttribute('aria-busy', 'false');
  } finally { clearTimeout(timeout); }
}
start();
