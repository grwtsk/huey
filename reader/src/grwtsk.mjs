// Opt-in local editing surface. Model replies come from the existing Codex host;
// browser text and application clicks never confer literary acceptance.
import './grwtsk.css';
import { parseRouteAddress } from './routes.mjs';
const CLIENT = 'huey-grwtsk-editor/1';
const make = (tag, text, className = '') => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = text => { const node = make('button', text); node.type = 'button'; return node; };
const field = (text, input) => { const label = make('label', text); label.append(input); return label; };

export async function mountGrwtsk({ main, projection }) {
  let session;
  try {
    const response = await fetch('/__grwtsk/session', { headers: { 'X-Huey-Client': CLIENT }, credentials: 'omit', cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return false;
    session = await response.json();
  } catch { return false; }
  if (!session.token) return false;
  const request = async (path, data) => {
    const response = await fetch(`/__grwtsk/${path}`, {
      method: data === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'X-Huey-Client': CLIENT, 'X-Huey-Session': session.token,
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? 'Private workspace request failed.');
    return value;
  };
  let catalog = await request('catalog');
  const toggle = button('Grwtsk'); toggle.id = 'grwtsk-toggle';
  toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'grwtsk-panel');
  const panel = make('aside', undefined, 'grwtsk-panel'); panel.id = 'grwtsk-panel'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Private Grwtsk editor');
  const header = make('header'), close = button('Close'); header.append(make('h2', 'Grwtsk'), close);
  const scope = make('p', 'Private working copy · literary acceptance remains separate.', 'grwtsk-note');
  const status = make('p', '', 'grwtsk-status'); status.setAttribute('role', 'status');
  const context = make('p', 'Select a paragraph in the reading copy.', 'grwtsk-context');
  const provenance = make('details'), provenanceBody = make('div');
  provenance.append(make('summary', 'Source and working state'), provenanceBody);
  const editor = make('textarea'); editor.id = 'grwtsk-working-text'; editor.rows = 8; editor.disabled = true;
  const editLabel = field('Working paragraph (Markdown)', editor);
  const reviewButton = button('Review change'); reviewButton.disabled = true;
  const reviewSection = make('section', undefined, 'grwtsk-review'); reviewSection.hidden = true;
  const before = make('pre'), after = make('pre'), disposition = make('p');
  const apply = button('Apply to private copy'), reject = button('Reject'), cancel = button('Cancel proposal');
  reviewSection.append(make('h3', 'Exact change'), make('h4', 'Before'), before,
    make('h4', 'After'), after, disposition, apply, reject, cancel);
  const issueInput = make('input'); issueInput.type = 'text'; issueInput.placeholder = '358, 360';
  const issuesButton = button('Load issue context'), issueBody = make('div');
  const issueSection = make('details'); issueSection.append(make('summary', 'Issues and blockers'),
    field('Huey issue numbers', issueInput), issuesButton, issueBody);
  const issueLink = make('input'); issueLink.type = 'url'; issueLink.placeholder = 'https://github.com/grwtsk/huey/issues/358';
  const handoffButton = button('Prepare issue handoff'), handoffBody = make('pre');
  const handoffSection = make('details'); handoffSection.append(make('summary', 'Issue handoff'),
    field('Existing issue or PR', issueLink), handoffButton, handoffBody);
  const messages = make('div', undefined, 'grwtsk-messages'); messages.setAttribute('aria-live', 'polite');
  const message = make('textarea'); message.rows = 3;
  const send = button('Ask Grwtsk'), refresh = button('Check reply');
  const chatSection = make('section'); chatSection.append(make('h3', 'Private chat'), messages,
    field('Message for the existing Codex assistant', message), send, refresh);
  panel.append(header, scope, status, context, provenance, editLabel, reviewButton,
    reviewSection, issueSection, handoffSection, chatSection);
  document.body.append(toggle, panel);
  let selected = null, current = null, operation = null, review = null, dirty = false, loading = false, selectionTicket = 0, inputGeneration = 0, restorePending = false, selectionPending = null;
  const records = new Map(catalog.paragraphs.map(item => [item.id, item]));
  const note = text => { status.textContent = text; };
  const visibleSelection = () => Boolean(current && main.querySelector(`.traversal-paragraph[data-entity-id="${current.id}"]`));
  const pinnedParagraph = () => {
    const route = parseRouteAddress(location.pathname);
    return Boolean(route.version && records.has(route.id));
  };
  function availability() {
    const visible = visibleSelection();
    editor.disabled = loading || !visible;
    reviewButton.disabled = loading || !visible || !dirty;
    send.disabled = loading || !visible || dirty;
    apply.disabled = loading || !visible || !review || Boolean(review.conflict || review.decision);
    reject.disabled = cancel.disabled = loading || !review || Boolean(review.decision);
    issuesButton.disabled = refresh.disabled = loading;
    handoffButton.disabled = loading || !operation;
    discard.disabled = loading || !current;
    if (current && !visible) {
      note('Previous paragraph is outside this view. Return to it or discard its unreviewed text before selecting an available paragraph.');
    } else if (visible && status.textContent.startsWith('Previous paragraph is outside this view.')) {
      note(current.privateOperation ? 'Private working overlay loaded.' : 'Exact source paragraph loaded.');
    }
  }
  const guarded = fn => async () => {
    if (loading) return;
    loading = true; panel.setAttribute('aria-busy', 'true'); availability();
    try { await fn(); } catch (error) { note(error.message); }
    finally {
      loading = false; panel.removeAttribute('aria-busy'); discard.disabled = false; availability();
      if (restorePending) scheduleRestore();
      else if (selectionPending) { const id = selectionPending; selectionPending = null; if (!panel.hidden) choose(id); }
    }
  };
  function showState() {
    provenanceBody.replaceChildren();
    const slot = catalog.slots.find(item => item.key === current.slot);
    const values = [ ['Entity', current.id], ['Working version', current.version],
      ['Source version', current.sourceVersion], ['Source', current.source.key],
      ['Source revision', current.source.revision], ['Repository revision', catalog.revision],
      ['Working effect', current.privateOperation ? 'Applied private overlay; not integrated into pre-release' : 'Selected source; no private overlay'],
      ['Evidence', current.evidence], ['Source permissions', (current.scopeRefs ?? []).join(', ') || 'No additional grant inferred'] ];
    for (const key of ['presence', 'editorialMaterialization', 'access', 'observedReaderAdmission']) {
      if (slot?.[key] !== undefined) values.push([key, String(slot[key])]);
    }
    if (slot?.publicationAnnotation) values.push(['Publication annotation', slot.publicationAnnotation.label]);
    const dl = make('dl');
    for (const [term, value] of values) dl.append(make('dt', term), make('dd', value));
    provenanceBody.append(dl);
    if (slot?.issues?.length) issueInput.value = slot.issues.map(value => String(value).match(/\d+$/)?.[0]).filter(Boolean).join(', ');
  }
  async function select(id) {
    if (!records.has(id) || !main.querySelector(`.traversal-paragraph[data-entity-id="${id}"]`) || id === selected && current) return;
    if (dirty) { note('Review or discard the current paragraph change before selecting another paragraph.'); return; }
    const ticket = ++selectionTicket;
    const value = await request(`read?id=${encodeURIComponent(id)}`);
    if (ticket !== selectionTicket || !main.querySelector(`.traversal-paragraph[data-entity-id="${id}"]`)) return;
    selected = id; current = value; operation = null; review = null;
    editor.value = current.raw; editor.disabled = false; reviewButton.disabled = true; reviewSection.hidden = true;
    const row = records.get(id), slot = catalog.slots.find(item => item.key === row.slot);
    context.textContent = `${slot?.label ?? row.slot} · paragraph ${catalog.paragraphs.filter(p => p.slot === row.slot).findIndex(p => p.id === id) + 1}`;
    showState(); note(current.privateOperation ? 'Private working overlay loaded.' : 'Exact source paragraph loaded.');
  }
  function choose(id) {
    if (loading) { selectionPending = id; return; }
    guarded(() => select(id))();
  }
  function setOpen(open) {
    panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('grwtsk-open', open);
    if (open) {
      // A known ID on an unavailable/exact-version route must not substitute
      // current source text for the requested missing presentation.
      const visible = [...main.querySelectorAll('.traversal-paragraph[data-entity-id]')];
      const id = (visible.find(node => node.dataset.entityId === main.dataset.paragraphId) ?? visible[0])?.dataset.entityId;
      if (id) choose(id);
      else availability();
      close.focus();
    } else toggle.focus();
  }
  toggle.onclick = () => setOpen(panel.hidden); close.onclick = () => setOpen(false);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } });
  main.addEventListener('click', event => {
    const paragraph = event.target.closest('.traversal-paragraph[data-entity-id]');
    if (paragraph && !panel.hidden) choose(paragraph.dataset.entityId);
  });
  document.addEventListener('selectionchange', () => {
    if (panel.hidden || dirty || loading) return;
    const anchor = getSelection()?.anchorNode;
    const paragraph = (anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement)?.closest('.traversal-paragraph[data-entity-id]');
    if (paragraph && main.contains(paragraph)) choose(paragraph.dataset.entityId);
  });
  editor.oninput = () => {
    inputGeneration += 1;
    dirty = Boolean(current && editor.value !== current.raw); reviewButton.disabled = !dirty;
    // Changed input must be reviewed afresh; never apply a previously shown diff.
    reviewSection.hidden = true; operation = null; review = null;
    availability();
  };
  const discard = button('Discard unreviewed text'); editLabel.after(discard);
  discard.onclick = () => { if (current && !loading) { inputGeneration += 1; editor.value = current.raw; dirty = false; reviewButton.disabled = true; reviewSection.hidden = true; operation = null; review = null; note('Unreviewed text discarded; existing history retained.'); availability(); } };
  reviewButton.onclick = guarded(async () => {
    if (!current || !dirty || !visibleSelection()) return;
    const generation = inputGeneration, id = current.id, wording = editor.value;
    const proposed = await request('propose', { id, baseVersion: current.version, beforeDigest: current.rawDigest,
      after: wording, key: crypto.randomUUID(), requestRef: 'local editor review request' });
    const reviewed = await request(`review?id=${encodeURIComponent(proposed.id)}`);
    if (generation !== inputGeneration || selected !== id || editor.value !== wording) throw new Error('Working text changed while reviewing. Review the current text again.');
    operation = proposed; review = reviewed;
    before.textContent = review.diff.before; after.textContent = review.diff.after;
    disposition.textContent = review.conflict ?? 'Proposed private change. Source, evidence and acceptance are unchanged.';
    apply.disabled = Boolean(review.conflict || review.decision); reject.disabled = Boolean(review.decision); cancel.disabled = Boolean(review.decision);
    reviewSection.hidden = false;
  });
  const decide = status => guarded(async () => {
    if (!operation || !review || status === 'applied-private' && !visibleSelection()) return;
    const receipt = await request('decide', { operationId: operation.id, reviewDigest: review.reviewDigest,
      status, approvalRef: `Local editor ${status} click at ${new Date().toISOString()}; working-copy effect only` });
    disposition.textContent = `${receipt.status} · ${receipt.effect}`;
    review = { ...review, decision: receipt }; apply.disabled = reject.disabled = cancel.disabled = true;
    current = await request(`read?id=${encodeURIComponent(selected)}`);
    editor.value = current.raw; dirty = false; reviewButton.disabled = true; showState();
    if (receipt.status === 'applied-private' && !pinnedParagraph()) {
      const visible = main.querySelector(`[data-entity-id="${selected}"]`);
      if (visible) { visible.textContent = current.raw; visible.dataset.privateOverlay = 'true'; }
    }
    note(receipt.status === 'applied-private' ? 'Applied to the private working copy. Literary acceptance and source handoff remain separate.' : 'Decision retained; working text unchanged.');
  });
  apply.onclick = decide('applied-private'); reject.onclick = decide('rejected'); cancel.onclick = decide('cancelled');
  issuesButton.onclick = guarded(async () => {
    const numbers = issueInput.value.split(',').map(value => value.trim()).join(',');
    const result = await request(`issues?numbers=${encodeURIComponent(numbers)}`); issueBody.replaceChildren();
    for (const issue of result.issues) {
      const details = make('details'); details.append(make('summary', `#${issue.number} · ${issue.title} · ${issue.state}`));
      details.append(make('pre', issue.body));
      for (const comment of issue.comments ?? []) details.append(make('pre', comment.body));
      issueBody.append(details);
    }
    for (const error of result.errors ?? []) issueBody.append(make('p', `#${error.number}: ${error.message}`));
    issueBody.prepend(make('p', 'Public issue context. Source grants and human decisions require their original scoped record.', 'grwtsk-note'));
  });
  handoffButton.onclick = guarded(async () => {
    if (!operation) throw new Error('Review a change before preparing its issue handoff.');
    if (issueLink.value.trim()) await request('link', { operationId: operation.id, url: issueLink.value.trim() });
    const packet = await request(`handoff?id=${encodeURIComponent(operation.id)}`);
    handoffBody.textContent = `${packet.publicText}\n\n${packet.gates.join('\n')}\n\n${packet.effect}`;
  });
  function showChat(state) {
    messages.replaceChildren();
    for (const entry of state.messages) {
      const item = make('div', undefined, 'grwtsk-message');
      item.append(make('strong', entry.role === 'assistant' ? 'Grwtsk · existing Codex host' : 'You'), make('p', entry.text));
      messages.append(item);
    }
    const pending = state.requests.filter(item => item.status === 'pending-host').length;
    if (pending) messages.append(make('p', `${pending} request${pending === 1 ? '' : 's'} awaiting the existing Codex host. No generated reply is substituted.`, 'grwtsk-note'));
  }
  send.onclick = guarded(async () => {
    if (!selected || !current || !visibleSelection()) throw new Error('Select an available mapped paragraph first.');
    if (dirty) throw new Error('Review or discard unreviewed paragraph text before asking about the working copy.');
    if (!message.value.trim()) return;
    const submitted = message.value;
    const state = await request('chat', { id: selected, message: submitted, requestRef: 'local editor chat request',
      basis: current.basis, baseVersion: current.version, beforeDigest: current.rawDigest });
    if (message.value === submitted) message.value = '';
    showChat(state); note('Private request queued for the existing Codex host.');
  });
  refresh.onclick = guarded(async () => showChat(await request('chat')));
  await guarded(async () => showChat(await request('chat')))();
  // A navigation can replace the DOM without losing private overlays. Read only
  // visible mapped occurrences; never search or preload the protected remainder.
  let restoreTicket = 0;
  async function restorePage() {
    const ticket = ++restoreTicket;
    const notice = main.querySelector('.traversal-notice');
    if (notice) notice.textContent = 'Private working editor · source and literary acceptance remain separate';
    for (const paragraph of main.querySelectorAll('.traversal-paragraph[data-entity-id]')) {
      if (!records.has(paragraph.dataset.entityId)) continue;
      const value = await request(`read?id=${encodeURIComponent(paragraph.dataset.entityId)}`);
      if (ticket !== restoreTicket || !paragraph.isConnected) return;
      if (value.privateOperation && !pinnedParagraph()) { paragraph.textContent = value.raw; paragraph.dataset.privateOverlay = 'true'; }
    }
  }
  function scheduleRestore() {
    if (!visibleSelection()) { selectionTicket += 1; inputGeneration += 1; }
    availability();
    restorePending = true;
    if (!loading) guarded(async () => {
      while (restorePending) { restorePending = false; await restorePage(); }
    })();
  }
  new MutationObserver(scheduleRestore).observe(main, { childList: true });
  await guarded(restorePage)();
  return true;
}
