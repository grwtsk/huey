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
    let response;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
    try {
      try {
        response = await fetch(`/__grwtsk/${path}`, {
          method: data === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
          headers: { 'X-Huey-Client': CLIENT, 'X-Huey-Session': session.token,
            ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
          ...(data === undefined ? {} : { body: JSON.stringify(data) })
        });
      } catch {
        throw new Error('Private request unavailable; no new receipt was confirmed. Draft text remains in this tab. Check saved changes when the connection returns; no background retry runs.');
      }
      let value;
      try { value = await response.json(); }
      catch { throw new Error('Private response unavailable; no new receipt was confirmed. Keep your draft and inspect saved changes manually.'); }
      if (!response.ok) throw new Error(value.error ?? 'Private workspace request failed.');
      return value;
    } finally { clearTimeout(timeout); }
  };
  let catalog, catalogUnavailable = false;
  try { catalog = await request('catalog'); }
  catch { catalogUnavailable = true; catalog = { paragraphs: [], slots: [], revision: null }; }
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
  const refreshSelection = button('Refresh selection'); refreshSelection.disabled = true;
  const reviewSection = make('section', undefined, 'grwtsk-review'); reviewSection.hidden = true;
  const before = make('pre'), after = make('pre'), disposition = make('p');
  const apply = button('Apply to private copy'), reject = button('Reject'), cancel = button('Cancel proposal');
  reviewSection.append(make('h3', 'Exact change'), make('h4', 'Before'), before,
    make('h4', 'After'), after, disposition, apply, reject, cancel);
  const recoverySection = make('section', undefined, 'grwtsk-recovery'); recoverySection.hidden = true;
  recoverySection.setAttribute('aria-label', 'Stale private edit comparison');
  const previousBase = make('pre'), previousEdit = make('pre'), currentSource = make('pre');
  const recoveryVersions = make('p', '', 'grwtsk-note');
  const resume = button('Resume from current source'), refreshComparison = button('Refresh comparison');
  recoverySection.append(make('h3', 'Stale private edit'),
    make('p', 'Compare all three versions. Resuming starts from the current source and retains the previous private edit and its history; it does not reapply that edit.'),
    recoveryVersions, make('h4', 'Previous source or working base'), previousBase,
    make('h4', 'Previous private edit'), previousEdit, make('h4', 'Current source'), currentSource,
    resume, refreshComparison);
  const historySection = make('details'), historyBody = make('div');
  historySection.hidden = true;
  historySection.append(make('summary', 'Retained private history'), historyBody);
  const queueSection = make('details'), queueBody = make('div'), queueStatus = make('p', 'Choose a paragraph to inspect its saved changes.', 'grwtsk-note');
  queueSection.id = 'grwtsk-queue'; queueStatus.setAttribute('role', 'status');
  const loadQueue = button('Load saved changes'), olderQueue = button('Show older changes'); olderQueue.hidden = true;
  queueSection.append(make('summary', 'Saved paragraph changes'),
    make('p', 'Private proposals and decisions only. Unsaved typing remains in this tab; saved changes confer no remote or literary acceptance.', 'grwtsk-note'),
    loadQueue, queueStatus, queueBody, olderQueue);
  const draftSection = make('section'); draftSection.id = 'grwtsk-drafts';
  draftSection.setAttribute('aria-label', 'Saved unreviewed draft');
  const saveDraft = button('Save draft'), replaceDraft = button('Replace saved draft'); replaceDraft.hidden = true;
  const loadDraft = button('Load saved draft'), restoreDraft = button('Restore saved draft'), discardDraft = button('Discard saved draft');
  const findDrafts = button('Find saved drafts'), draftIndex = make('div');
  const draftStatus = make('p', 'Explicit local recovery for C08A. Nothing is saved or restored automatically.', 'grwtsk-note');
  draftStatus.setAttribute('role', 'status');
  const draftComparison = make('details'); draftComparison.hidden = true;
  const draftBefore = make('pre'), draftText = make('pre'), draftBindings = make('dl');
  draftBefore.id = 'grwtsk-draft-before'; draftText.id = 'grwtsk-draft-text';
  draftComparison.append(make('summary', 'Exact saved draft'), draftBindings, make('h4', 'Saved base'), draftBefore,
    make('h4', 'Saved unfinished text'), draftText);
  draftSection.append(make('h3', 'Saved unreviewed draft'), draftStatus, saveDraft, replaceDraft, loadDraft,
    findDrafts, draftIndex, draftComparison, restoreDraft, discardDraft);
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
  panel.append(header, scope, status, context, provenance, editLabel, draftSection, reviewButton, refreshSelection,
    reviewSection, recoverySection, historySection, queueSection, issueSection, handoffSection, chatSection);
  document.body.append(toggle, panel);
  let selected = null, current = null, operation = null, review = null, recovery = null, dirty = false, loading = false, selectionTicket = 0, inputGeneration = 0, restorePending = false, selectionPending = null;
  const records = new Map(catalog.paragraphs.map(item => [item.id, item]));
  let queueCursor = null, queueTarget = null;
  let checkpoint = null, checkpointCompatibility = null, checkpointTarget = null, checkpointGeneration = null, checkpointEligible = false, checkpointConfirmed = false;
  let retainedDraftTarget = null;
  const note = text => { status.textContent = text; };
  const visibleSelection = () => Boolean(current && main.querySelector(`.traversal-paragraph[data-entity-id="${current.id}"]`));
  const selectedVisible = () => Boolean(selected && main.querySelector(`.traversal-paragraph[data-entity-id="${selected}"]`));
  const checkpointContextMatches = () => Boolean(checkpoint && current && checkpoint.target === current.id
    && checkpoint.basis === current.basis && checkpoint.revision === current.revision
    && checkpoint.baseVersion === current.version && checkpoint.sourceVersion === current.sourceVersion
    && checkpoint.beforeDigest === current.rawDigest && checkpoint.privateOperation === (current.privateOperation ?? null));
  const checkpointMatches = () => checkpointConfirmed && checkpointContextMatches() && checkpoint.draft === editor.value;
  const unstoredDraft = () => dirty && (!operation || operation.after !== editor.value) && !checkpointMatches();
  window.addEventListener('beforeunload', event => {
    if (!unstoredDraft()) return;
    event.preventDefault(); event.returnValue = '';
  });
  const pinnedParagraph = () => {
    const route = parseRouteAddress(location.pathname);
    return Boolean(route.version && records.has(route.id));
  };
  function availability() {
    const visible = visibleSelection();
    editor.disabled = !visible || Boolean(recovery);
    reviewButton.disabled = loading || !visible || !dirty || Boolean(recovery);
    send.disabled = loading || !visible || dirty || Boolean(recovery);
    apply.disabled = loading || !visible || !review || Boolean(review.conflict || review.decision || recovery) || dirty && editor.value !== review.diff.after;
    reject.disabled = cancel.disabled = loading || !review || Boolean(review.decision);
    issuesButton.disabled = refresh.disabled = loading;
    handoffButton.disabled = loading || !operation;
    discard.disabled = loading || !current;
    resume.disabled = loading || !visible || !recovery || dirty;
    refreshComparison.disabled = loading || !visible || !recovery || dirty;
    refreshSelection.disabled = loading || dirty || !selected || !main.querySelector(`.traversal-paragraph[data-entity-id="${selected}"]`);
    loadQueue.disabled = loading || !selectedVisible();
    olderQueue.disabled = loading || !selectedVisible() || queueTarget !== selected || !queueCursor;
    for (const control of queueBody.querySelectorAll('button')) control.disabled = loading || !selectedVisible() || queueTarget !== selected;
    const shownDraft = checkpointTarget === selected && Boolean(checkpoint);
    if (shownDraft && current && checkpointCompatibility?.status === 'current' && !checkpointContextMatches()) {
      checkpointCompatibility = { status: current ? 'stale' : 'unavailable', reasons: ['DISPLAYED_CONTEXT_CHANGED'] };
      draftStatus.textContent = `Saved draft retained · ${current ? 'stale context' : 'source unavailable'}. Load the exact comparison again before recovery.`;
    }
    saveDraft.hidden = shownDraft; replaceDraft.hidden = !shownDraft;
    const draftSource = visible && current.slot === 'C08A' && !recovery
      && (checkpointTarget !== selected || checkpointGeneration === null || checkpointEligible);
    saveDraft.disabled = replaceDraft.disabled = loading || !draftSource || !dirty;
    loadDraft.disabled = loading || !selectedVisible() && retainedDraftTarget !== selected;
    findDrafts.disabled = loading;
    for (const control of draftIndex.querySelectorAll('button')) control.disabled = loading || dirty;
    restoreDraft.disabled = loading || !visible || recovery || !shownDraft || !checkpointConfirmed || !checkpointEligible
      || checkpointCompatibility?.status !== 'current' || dirty;
    discardDraft.disabled = loading || !shownDraft;
    if (current && !visible) {
      note('Previous paragraph is outside this view. Return to it or discard its unreviewed text before selecting an available paragraph.');
    } else if (visible && status.textContent.startsWith('Previous paragraph is outside this view.')) {
      note(recovery ? 'Private edit is stale. Compare the retained versions before resuming from current source.' : current.privateOperation ? 'Private working overlay loaded.' : 'Exact source paragraph loaded.');
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
      ['Source revision', current.source.revision], ['Repository revision', current.revision ?? catalog.revision],
      ['Working effect', recovery ? 'Stale private overlay retained; editing paused for explicit recovery' : current.privateOperation ? 'Applied private overlay; not integrated into pre-release' : 'Selected source; no private overlay'],
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
  function showHistory(value) {
    historyBody.replaceChildren(); historySection.hidden = !value.history?.length;
    for (const entry of value.history ?? []) {
      const details = make('details');
      details.append(make('summary', entry.retired ? 'Earlier private edit · retained after source resume' : 'Applied private edit'),
        make('p', `Base ${entry.baseVersion} · result ${entry.version} · repository ${entry.revision}`, 'grwtsk-note'),
        make('h4', 'Before'), make('pre', entry.before), make('h4', 'After'), make('pre', entry.after));
      historyBody.append(details);
    }
  }
  function showInspection(id, value) {
    retainedDraftTarget = null;
    if (checkpointTarget !== id) {
      checkpoint = null; checkpointCompatibility = null; checkpointGeneration = null; checkpointTarget = null;
      checkpointEligible = checkpointConfirmed = false; draftComparison.hidden = true; draftBefore.textContent = draftText.textContent = '';
      draftStatus.textContent = 'Load this paragraph’s saved draft explicitly. Nothing is restored automatically.';
    }
    if (queueTarget !== id) {
      queueBody.replaceChildren(); queueCursor = null; queueTarget = null; olderQueue.hidden = true;
      queueStatus.textContent = 'Load this paragraph’s saved changes. Nothing is restored or applied automatically.';
    }
    showHistory(value);
    if (value.status === 'unavailable') {
      selected = id; current = null; recovery = null; operation = null; review = null;
      editor.value = ''; reviewSection.hidden = recoverySection.hidden = true;
      context.textContent = 'Selected paragraph is no longer available or mapped.';
      provenanceBody.replaceChildren();
      note('Current source is unavailable. Previous private history remains retained; editing and source recovery are blocked.');
      return;
    }
    selected = id; recovery = value.status === 'stale-overlay' ? value : null;
    current = value.current ?? value.source; operation = null; review = null;
    editor.value = current.raw; editor.disabled = Boolean(recovery); reviewButton.disabled = true; reviewSection.hidden = true;
    recoverySection.hidden = !recovery;
    if (recovery) {
      previousBase.textContent = recovery.previous.before;
      previousEdit.textContent = recovery.previous.after;
      currentSource.textContent = recovery.source.raw;
      recoveryVersions.textContent = `Previous base ${recovery.previous.baseVersion} · private result ${recovery.previous.version} · current source ${recovery.source.sourceVersion}`;
    }
    const row = records.get(id), slot = catalog.slots.find(item => item.key === row.slot);
    context.textContent = `${slot?.label ?? row.slot} · paragraph ${catalog.paragraphs.filter(p => p.slot === row.slot).findIndex(p => p.id === id) + 1}`;
    showState(); note(recovery ? 'Private edit is stale. Compare the retained versions before resuming from current source.' : current.privateOperation ? 'Private working overlay loaded.' : 'Exact source paragraph loaded.');
  }
  async function select(id, force = false) {
    if (!records.has(id) || !main.querySelector(`.traversal-paragraph[data-entity-id="${id}"]`) || !force && id === selected && current) return;
    if (dirty) { note('Review or discard the current paragraph change before selecting another paragraph.'); return; }
    const ticket = ++selectionTicket, generation = inputGeneration;
    const value = await request(`inspect?id=${encodeURIComponent(id)}`);
    if (ticket !== selectionTicket || !main.querySelector(`.traversal-paragraph[data-entity-id="${id}"]`)) return;
    if (generation !== inputGeneration && dirty) { note('New draft text retained. Finish its review or discard it before changing selection.'); return; }
    showInspection(id, value);
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
  function showDraft(id, value) {
    checkpointTarget = id; checkpoint = value.checkpoint; checkpointCompatibility = value.compatibility;
    checkpointConfirmed = Boolean(checkpoint);
    checkpointGeneration = value.generation; checkpointEligible = value.eligible;
    draftComparison.hidden = !checkpoint;
    draftBefore.textContent = checkpoint?.before ?? ''; draftText.textContent = checkpoint?.draft ?? '';
    draftBindings.replaceChildren();
    if (checkpoint) for (const [label, saved] of [ ['Saved entity', checkpoint.target],
      ['Saved source version', checkpoint.sourceVersion], ['Saved private working version', checkpoint.baseVersion],
      ['Saved repository revision', checkpoint.revision], ['Saved repository basis', checkpoint.basis],
      ['Saved private operation', checkpoint.privateOperation ?? 'No applied private operation'] ]) {
      draftBindings.append(make('dt', label), make('dd', saved));
    }
    if (!checkpoint) draftStatus.textContent = value.eligible
      ? 'No saved unreviewed draft for this paragraph. Save is explicit.'
      : 'Draft recovery is unavailable for this source/version. Existing editing and source permissions remain separate.';
    else draftStatus.textContent = `Saved privately at ${checkpoint.createdAt} · ${value.compatibility.status}. ${value.compatibility.status === 'current'
      ? 'Inspect the exact text; restore only when the textarea has no unreviewed changes.'
      : 'Retained for comparison only. Restore is blocked; no automatic rebase runs.'}`;
    availability();
  }
  async function inspectDraft(id) {
    const value = await request(`draft?id=${encodeURIComponent(id)}`);
    if (selected !== id || !selectedVisible() && retainedDraftTarget !== id) return null;
    showDraft(id, value); return value;
  }
  loadDraft.onclick = guarded(async () => { if (selected && (selectedVisible() || retainedDraftTarget === selected)) await inspectDraft(selected); });
  findDrafts.onclick = guarded(async () => {
    const index = await request('draft-index'); draftIndex.replaceChildren();
    if (!index.checkpoints.length) draftIndex.append(make('p', 'No saved unreviewed drafts.', 'grwtsk-note'));
    for (const entry of index.checkpoints) {
      const row = make('div'); row.append(make('p', `${entry.target} · saved ${entry.createdAt}`, 'grwtsk-note'));
      const inspect = button('Inspect saved draft');
      inspect.onclick = guarded(async () => {
        if (dirty) return;
        const ticket = ++selectionTicket, generation = inputGeneration;
        const value = await request(`draft?id=${encodeURIComponent(entry.target)}`);
        if (ticket !== selectionTicket || generation !== inputGeneration || dirty) {
          note('New textarea input retained. No saved draft selection replaced it.'); return;
        }
        selected = entry.target; current = null; recovery = null; operation = null; review = null;
        retainedDraftTarget = selected; editor.value = ''; editor.disabled = true;
        reviewSection.hidden = recoverySection.hidden = historySection.hidden = true;
        provenanceBody.replaceChildren(make('p', 'Retained private checkpoint only. Select its current reading paragraph before restoring or editing.'));
        context.textContent = `Retained private paragraph ${selected} · current reading selection is paused`;
        showDraft(selected, value);
        note('Saved draft inspected privately. No source text was substituted into the book or textarea; restoration requires the current visible reading selection.');
      });
      row.append(inspect); draftIndex.append(row);
    }
  });
  const persistDraft = replace => guarded(async () => {
    if (!current || !visibleSelection() || recovery || !dirty) return;
    const id = selected, generation = inputGeneration, wording = editor.value, basis = { ...current };
    if (checkpointTarget !== id || checkpointGeneration === null) {
      const inspected = await inspectDraft(id);
      if (!inspected) return;
      if (inspected.checkpoint) {
        note('A saved draft already exists. Its exact text is shown; replacement requires a separate Replace saved draft action.'); return;
      }
    }
    if (selected !== id || !visibleSelection() || !checkpointEligible) return;
    if (replace !== Boolean(checkpoint)) return;
    checkpointConfirmed = false;
    draftStatus.textContent = 'Saving the selected draft. No new receipt is confirmed; keep textarea text until the result is known.';
    let result;
    try {
      result = await request('draft-save', { id, basis: basis.basis, revision: basis.revision,
        sourceVersion: basis.sourceVersion, baseVersion: basis.version, beforeDigest: basis.rawDigest,
        privateOperation: basis.privateOperation ?? null, draft: wording, key: crypto.randomUUID(),
        expectedDigest: replace ? checkpoint.digest : null, generation: checkpointGeneration });
    } catch (error) {
      draftStatus.textContent = 'Save outcome unavailable. Displayed checkpoint data may be older; inspect manually before relying on it. Textarea text is retained.';
      throw error;
    }
    if (selected !== id) return;
    showDraft(id, { checkpoint: result.checkpoint, generation: result.generation, eligible: result.eligible ?? false,
      compatibility: result.compatibility ?? { status: 'unknown', reasons: [] } });
    note(generation !== inputGeneration || editor.value !== wording
      ? 'Earlier draft saved privately; newer typing remains in this tab and has not been saved.'
      : 'Draft saved privately for explicit recovery. It is unreviewed; source, evidence and literary acceptance are unchanged.');
  });
  saveDraft.onclick = persistDraft(false); replaceDraft.onclick = persistDraft(true);
  restoreDraft.onclick = guarded(async () => {
    if (!checkpoint || !current || dirty || recovery || !visibleSelection() || checkpointTarget !== selected) return;
    const id = selected, generation = inputGeneration, wording = editor.value, ticket = selectionTicket;
    const result = await request('draft-restore', { id, checkpointDigest: checkpoint.digest, generation: checkpointGeneration });
    if (selected !== id || ticket !== selectionTicket || generation !== inputGeneration || editor.value !== wording || !visibleSelection()) {
      note('Saved draft was checked, but newer typing or navigation was retained. Nothing was restored; load and review it again manually.'); return;
    }
    inputGeneration += 1; editor.value = result.draft; dirty = editor.value !== current.raw;
    operation = null; review = null; reviewSection.hidden = true;
    note('Saved unreviewed text restored to the textarea only. Review a fresh exact change before applying it to the private copy.');
  });
  discardDraft.onclick = guarded(async () => {
    if (!checkpoint || checkpointTarget !== selected) return;
    const id = selected;
    checkpointConfirmed = false;
    draftStatus.textContent = 'Discard request pending. Textarea text is retained; saved checkpoint state is unconfirmed.';
    let result;
    try { result = await request('draft-discard', { id, expectedDigest: checkpoint.digest, generation: checkpointGeneration }); }
    catch (error) {
      draftStatus.textContent = 'Discard outcome unavailable. Do not rely on the older displayed checkpoint; load its current state manually. Textarea text is retained.';
      throw error;
    }
    if (selected !== id) return;
    showDraft(id, { checkpoint: null, generation: result.generation, eligible: checkpointEligible,
      compatibility: { status: 'unavailable', reasons: [] } });
    note(result.status === 'discarded' ? 'Saved draft discarded. Current textarea text and immutable private history remain unchanged.'
      : 'No saved draft is present. No earlier discard receipt is inferred; textarea text and history remain unchanged.');
  });
  refreshComparison.onclick = guarded(async () => { if (selected && !dirty) await select(selected, true); });
  refreshSelection.onclick = guarded(async () => { if (selected && !dirty) await select(selected, true); });
  resume.onclick = guarded(async () => {
    if (!selected || !recovery || dirty || !visibleSelection()) return;
    const id = selected;
    await request('resume-source', { id, reviewDigest: recovery.reviewDigest, key: crypto.randomUUID(),
      decisionRef: `Local editor Resume from current source click at ${new Date().toISOString()}; private view only` });
    try { await select(id, true); }
    catch {
      note('Private source-resume receipt is confirmed; current source refresh is unavailable. Previous edits and draft text are retained. Refresh the comparison or selection manually before continuing.');
      return;
    }
    if (selected !== id || !current || recovery || !visibleSelection()) {
      note('Private source-resume receipt retained. The selection changed again; inspect the current source or comparison before continuing.');
      return;
    }
    const paragraph = main.querySelector(`.traversal-paragraph[data-entity-id="${id}"]`);
    if (!pinnedParagraph()) {
      if (paragraph) {
        paragraph.textContent = current.raw;
        if (current.privateOperation) paragraph.dataset.privateOverlay = 'true';
        else delete paragraph.dataset.privateOverlay;
      }
    }
    if (paragraph) delete paragraph.dataset.privateOverlayStale;
    if (!main.querySelector('[data-private-overlay-stale="true"]')) {
      const notice = main.querySelector('.traversal-notice');
      if (notice) notice.textContent = 'Private working editor · source and literary acceptance remain separate';
    }
    note(current.privateOperation ? 'Source-resume receipt retained. A newer private edit is current; its source and exact history remain separate.' : 'Resumed from current source. Previous private edits and exact history remain retained; nothing was integrated or accepted.');
  });
  reviewButton.onclick = guarded(async () => {
    if (!current || !dirty || recovery || !visibleSelection()) return;
    const generation = inputGeneration, id = current.id, wording = editor.value;
    const proposed = await request('propose', { id, baseVersion: current.version, beforeDigest: current.rawDigest,
      after: wording, key: crypto.randomUUID(), requestRef: 'local editor review request' });
    let reviewed;
    try { reviewed = await request(`review?id=${encodeURIComponent(proposed.id)}`); }
    catch {
      note('Proposal saved privately; exact review is unavailable. Draft text is retained. Load saved changes manually to review the known proposal before applying it.');
      return;
    }
    if (generation !== inputGeneration || selected !== id || editor.value !== wording) throw new Error('Working text changed while reviewing. Review the current text again.');
    operation = proposed; review = reviewed;
    before.textContent = review.diff.before; after.textContent = review.diff.after;
    disposition.textContent = review.conflict ?? 'Proposed private change. Source, evidence and acceptance are unchanged.';
    apply.disabled = Boolean(review.conflict || review.decision); reject.disabled = Boolean(review.decision); cancel.disabled = Boolean(review.decision);
    reviewSection.hidden = false;
    queueBody.replaceChildren(); queueCursor = null; olderQueue.hidden = true;
    queueStatus.textContent = 'Proposal saved privately. Load saved changes to refresh the queue.';
  });
  const openSavedReview = (id, operationId) => guarded(async () => {
    if (selected !== id || !selectedVisible()) return;
    const reviewed = await request(`review?id=${encodeURIComponent(operationId)}`);
    if (selected !== id || !selectedVisible() || reviewed.operation.target !== id) return;
    // Showing a persisted diff must never overwrite a newer textarea draft.
    operation = reviewed.operation; review = reviewed;
    before.textContent = reviewed.diff.before; after.textContent = reviewed.diff.after;
    disposition.textContent = reviewed.conflict ?? (reviewed.decision ? `${reviewed.decision.status} · ${reviewed.decision.effect}` : 'Saved private proposal. Review this exact diff before applying or cancelling.');
    reviewSection.hidden = false;
    note(dirty && editor.value !== operation.after ? 'Saved diff shown; your current draft is retained. Application is blocked while that draft differs.' : 'Saved change loaded for exact review. No text was restored or applied automatically.');
  });
  async function readQueue(append = false) {
    if (!selectedVisible()) return;
    const id = selected, cursor = append ? queueCursor : null;
    queueStatus.textContent = 'Reading the private queue; no new acknowledgment or acceptance is inferred.';
    let saved;
    try {
      saved = await request(`queue?id=${encodeURIComponent(id)}&limit=20${cursor ? `&beforeSequence=${cursor}` : ''}`);
    } catch (error) {
      queueStatus.textContent = 'Private queue unavailable. Existing displayed rows may be older; draft text is retained. Retry manually when connected.';
      throw error;
    }
    if (selected !== id || !selectedVisible()) return;
    if (!append || queueTarget !== id) queueBody.replaceChildren();
    queueTarget = id; queueCursor = saved.nextBeforeSequence;
    for (const entry of saved.operations) {
      const row = make('div', undefined, 'grwtsk-queue-entry'); row.dataset.operationId = entry.id;
      row.append(make('p', `Change ${entry.clientSequence} · ${entry.status}${entry.retired ? ' · retired from active view' : ''}`),
        make('p', entry.createdAt, 'grwtsk-note'));
      if (entry.conflict) row.append(make('p', entry.conflict, 'grwtsk-note'));
      const inspect = button('Review saved change'); inspect.onclick = openSavedReview(id, entry.id);
      row.append(inspect); queueBody.append(row);
    }
    olderQueue.hidden = !queueCursor;
    queueStatus.textContent = `${queueBody.children.length} saved change${queueBody.children.length === 1 ? '' : 's'} shown for this paragraph · local private state at ${saved.revision}. Exact review rechecks current compatibility.`;
  }
  loadQueue.onclick = guarded(() => readQueue());
  olderQueue.onclick = guarded(() => readQueue(true));
  const decide = status => guarded(async () => {
    if (!operation || !review || status === 'applied-private' && !visibleSelection()) return;
    if (status === 'applied-private' && dirty && editor.value !== review.diff.after) return;
    const id = selected, generation = inputGeneration, priorReview = review;
    const preserveDraft = dirty;
    const receipt = await request('decide', { operationId: operation.id, reviewDigest: priorReview.reviewDigest,
      status, approvalRef: `Local editor ${status} click at ${new Date().toISOString()}; working-copy effect only` });
    disposition.textContent = `${receipt.status} · ${receipt.effect}`;
    if (generation === inputGeneration) review = { ...priorReview, decision: receipt };
    queueBody.replaceChildren(); queueCursor = null; olderQueue.hidden = true;
    queueStatus.textContent = 'Private decision saved. Load saved changes to refresh the queue.';
    let inspection;
    try { inspection = await request(`inspect?id=${encodeURIComponent(id)}`); }
    catch {
      note(`Private decision ${receipt.status} is confirmed; current source refresh is unavailable. Draft text and the saved decision are retained. Inspect saved changes manually, then preserve or discard the draft before refreshing selection.`);
      return;
    }
    if (inspection.status !== 'current') {
      if (dirty || generation !== inputGeneration) {
        operation = null; review = null; reviewSection.hidden = true;
        note('Private decision retained. Source changed while draft text remains in this tab; refresh only after preserving or discarding that draft.');
        return;
      }
      dirty = false;
      showInspection(id, inspection);
      note('Private decision retained. Current source changed; compare retained history before continuing.');
      return;
    }
    current = inspection.current; showHistory(inspection);
    if (!preserveDraft && generation === inputGeneration) editor.value = current.raw;
    dirty = editor.value !== current.raw;
    if (generation !== inputGeneration) { operation = null; review = null; reviewSection.hidden = true; }
    showState();
    if (receipt.status === 'applied-private' && !pinnedParagraph()) {
      const visible = main.querySelector(`[data-entity-id="${selected}"]`);
      if (visible) { visible.textContent = current.raw; visible.dataset.privateOverlay = 'true'; }
    }
    note(dirty ? 'Private decision retained; newer or unapplied draft text remains in this tab and requires its own review.' : receipt.status === 'applied-private' ? 'Applied to the private working copy. Literary acceptance and source handoff remain separate.' : 'Decision retained; working text unchanged.');
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
    if (recovery) throw new Error('Private edit is stale. Compare versions and explicitly resume before asking about a current working copy.');
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
    if (notice) notice.textContent = catalogUnavailable
      ? 'Current editing source unavailable · retained private drafts can be inspected separately'
      : 'Private working editor · source and literary acceptance remain separate';
    for (const paragraph of main.querySelectorAll('.traversal-paragraph[data-entity-id]')) {
      if (!records.has(paragraph.dataset.entityId)) continue;
      const inspected = await request(`inspect?id=${encodeURIComponent(paragraph.dataset.entityId)}`);
      if (ticket !== restoreTicket || !paragraph.isConnected) return;
      if (inspected.status === 'unavailable') {
        if (selected === paragraph.dataset.entityId && !dirty) showInspection(selected, inspected);
        if (notice) notice.textContent = 'Current private editing source unavailable · retained history is not a substitute';
        continue;
      }
      if (inspected.status === 'stale-overlay') {
        paragraph.dataset.privateOverlayStale = 'true';
        if (notice) notice.textContent = 'Stale private edit retained · compare in Grwtsk before resuming';
        if (selected === paragraph.dataset.entityId && !dirty) showInspection(selected, inspected);
        continue;
      }
      const value = inspected.current;
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
  if (catalogUnavailable) note('Current source catalog is unavailable. Find saved drafts for private inspection; editing and restoration stay blocked without a current reading selection.');
  return true;
}
