/** Local assistant adapter. No network, canonical writes, evidence grants or AI provider. */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, realpathSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isProxy } from 'node:util/types';
import { loadInventory, gitBlob, safePath } from './editorial_inventory.mjs';
import { parseEditorialMarkdown } from './editorial_markdown.mjs';
import { canonical, seal, profile } from './literary_model.mjs';
import { validateDraftCheckpointCollection, assessDraftCheckpointCompatibility } from './draft_checkpoint.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = (ok, message) => { if (!ok) throw new Error(`CHAT_WORKSPACE: ${message}`); };
const validLink = url => typeof url === 'string' && /^https:\/\/github\.com\/grwtsk\/huey\/(issues|pull)\/[1-9]\d*$/.test(url);
const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1000;
const hash = value => `sha256:${createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex')}`;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const draftPolicy = JSON.parse(readFileSync(new URL('../planning/grwtsk-draft-retention.json', import.meta.url), 'utf8'));
const DRAFT_SCOPE = { slot: 'C08A', path: 'manuscript/02-interlude/baptism-in-the-color-of-rain.md',
  blob: 'e28d4b10c74f8ed6ec6e66b5131e0b25ab5479e1', grantRef: 'https://github.com/grwtsk/huey/issues/2#issuecomment-5782472575' };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const OP_ID = /^op_[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const draftCheck = (condition, code, status = 400) => {
  if (!condition) { const error = new Error(`CHAT_WORKSPACE: ${code}`); error.code = code; error.status = status; throw error; }
};
function draftFields(value, required) {
  draftCheck(value !== null && typeof value === 'object' && !isProxy(value)
    && Object.getPrototypeOf(value) === Object.prototype, 'DRAFT_REQUEST_INVALID');
  const keys = Reflect.ownKeys(value);
  draftCheck(keys.length === required.length && required.every(key => keys.includes(key))
    && keys.every(key => { const d = Object.getOwnPropertyDescriptor(value, key); return d.enumerable && Object.hasOwn(d, 'value'); }),
  'DRAFT_REQUEST_INVALID');
}
const draftPattern = (value, pattern) => typeof value === 'string' && pattern.test(value);
const validGeneration = value => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
const draftGeneration = data => data.draftCheckpointGeneration ?? 0;
const draftCollection = data => data.draftCheckpoints ?? { schema: draftPolicy.collectionSchema, checkpoints: [] };
function draftEnabled() {
  // Runtime revocation is observed even by an already-running local server.
  // This fixed public configuration path cannot be selected by an HTTP client.
  let live;
  try { live = JSON.parse(readFileSync(new URL('../planning/grwtsk-draft-retention.json', import.meta.url), 'utf8')); }
  catch { return false; }
  return live.status === 'local-explicit' && live.runtimePersistenceEnabled === true
    && live.schema === draftPolicy.schema && live.checkpointSchema === draftPolicy.checkpointSchema
    && live.collectionSchema === draftPolicy.collectionSchema
    && JSON.stringify(live.checkpointFields) === JSON.stringify(draftPolicy.checkpointFields)
    && JSON.stringify(live.collectionFields) === JSON.stringify(draftPolicy.collectionFields)
    && Object.entries(draftPolicy.limits).every(([key, value]) => live.limits?.[key] === value)
    && Object.entries(DRAFT_SCOPE).every(([key, value]) => live.runtimeSourceScope?.[key] === value);
}
const draftEligible = current => Boolean(draftEnabled() && current?.slot === DRAFT_SCOPE.slot
  && current.source?.path === DRAFT_SCOPE.path && current.source?.blob === DRAFT_SCOPE.blob);
const nextDraftGeneration = data => {
  const generation = draftGeneration(data);
  draftCheck(generation < Number.MAX_SAFE_INTEGER, 'DRAFT_GENERATION_EXHAUSTED', 409); return generation + 1;
};
const RESUME_EFFECT = 'local source baseline resumed; prior private work retained unchanged';
const RESUME_AUTHORITY = 'local working-copy decision; no source write or literary acceptance';
const within = (parent, child) => { const p = relative(parent, child); return p === '' || (!isAbsolute(p) && p !== '..' && !p.startsWith(`..${sep}`)); };
const paragraph = raw => {
  check(typeof raw === 'string' && raw.isWellFormed() && raw.length <= 100000, 'invalid replacement text');
  const blocks = parseEditorialMarkdown(raw);
  check(blocks.length === 1 && blocks[0].kind === 'Paragraph' && blocks[0].source.start === 0 && blocks[0].source.end === raw.length,
    'replacement must be exactly one supported Markdown paragraph, without a terminal newline');
  return blocks[0];
};

const appliedHistory = (data, id) => data.decisions.filter(decision => decision.status === 'applied-private')
  .map(decision => ({ operation: data.proposals.find(op => op.id === decision.operationId), decision }))
  .filter(item => item.operation?.target === id);
const latestReconciliation = (data, id) => (data.reconciliations ?? []).filter(receipt => receipt.target === id).at(-1) ?? null;
const sourceReviewDigest = ({ target, basis, revision, sourceVersion, sourceDigest, source, historyDigest, previousReconciliationDigest }) =>
  hash({ schema: 'huey.private-source-inspection-review.v1', target, basis, revision,
    sourceVersion, sourceDigest, source, historyDigest, previousReconciliationDigest });

function validateReconciliations(data) {
  check(Array.isArray(data.reconciliations), 'invalid reconciliation collection');
  const fields = ['schema', 'id', 'target', 'basis', 'revision', 'sourceVersion', 'sourceDigest', 'sourceRaw', 'source',
    'retiredOperationIds', 'previousReconciliationId', 'historyDigest', 'reviewDigest', 'decisionRef', 'key',
    'requestDigest', 'createdAt', 'effect', 'authority', 'digest'];
  const ids = new Set(), keys = new Set(), previous = new Map();
  for (const receipt of data.reconciliations) {
    check(receipt && typeof receipt === 'object' && !Array.isArray(receipt)
      && Object.keys(receipt).length === fields.length && fields.every(field => Object.hasOwn(receipt, field)), 'invalid reconciliation receipt shape');
    check(receipt.schema === 'huey.private-source-resume.v1' && /^resume_[0-9a-f-]{36}$/.test(receipt.id)
      && !ids.has(receipt.id) && !keys.has(receipt.key) && new RegExp(profile.entityID).test(receipt.target), 'invalid or duplicate reconciliation identity');
    check([receipt.basis, receipt.decisionRef, receipt.key].every(nonempty) && /^[a-f0-9]{40}$/.test(receipt.revision)
      && typeof receipt.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(receipt.createdAt) && Number.isFinite(Date.parse(receipt.createdAt)), 'invalid reconciliation provenance');
    check(receipt.effect === RESUME_EFFECT && receipt.authority === RESUME_AUTHORITY, 'invalid reconciliation effect');
    check(DIGEST.test(receipt.digest) && receipt.digest === hash(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'digest'))), 'reconciliation integrity mismatch');
    check(DIGEST.test(receipt.sourceDigest) && hash(receipt.sourceRaw) === receipt.sourceDigest
      && seal({ id: receipt.target, kind: 'Paragraph', state: paragraph(receipt.sourceRaw).state }).version === receipt.sourceVersion,
    'invalid reconciled source wording or version');
    check(receipt.source && typeof receipt.source === 'object' && !Array.isArray(receipt.source)
      && safePath(receipt.source.path) && receipt.source.path.startsWith('manuscript/') && /^[a-f0-9]{40}$/.test(receipt.source.blob), 'invalid reconciliation source reference');
    const history = appliedHistory(data, receipt.target), prior = previous.get(receipt.target) ?? null;
    const retired = receipt.retiredOperationIds;
    check(Array.isArray(retired) && retired.length > (prior?.retiredOperationIds.length ?? 0)
      && retired.length <= history.length && retired.every((id, index) => id === history[index].operation.id), 'reconciliation cutoff is not an exact applied prefix');
    check(receipt.previousReconciliationId === (prior?.id ?? null), 'reconciliation lineage mismatch');
    check(receipt.historyDigest === hash(history.slice(0, retired.length)), 'reconciliation applied history changed');
    check(receipt.reviewDigest === sourceReviewDigest({ ...receipt, previousReconciliationDigest: prior?.digest ?? null }), 'reconciliation review binding mismatch');
    check(receipt.requestDigest === hash({ id: receipt.target, reviewDigest: receipt.reviewDigest, decisionRef: receipt.decisionRef, key: receipt.key }), 'reconciliation request binding mismatch');
    ids.add(receipt.id); keys.add(receipt.key); previous.set(receipt.target, receipt);
  }
}

function sourcePatch(path, before, after) {
  check(safePath(path) && path.startsWith('manuscript/'), 'unsafe source patch path');
  const lines = text => { const parts = text.split('\n'); if (text.endsWith('\n')) parts.pop(); return parts; };
  const old = lines(before), next = lines(after);
  const body = (text, parts, prefix) => parts.map((line, index) => `${prefix}${line}\n${index === parts.length - 1 && !text.endsWith('\n') ? '\\ No newline at end of file\n' : ''}`).join('');
  return `--- ${JSON.stringify(`a/${path}`)}\n+++ ${JSON.stringify(`b/${path}`)}\n@@ -1,${old.length} +1,${next.length} @@\n${body(before, old, '-')}${body(after, next, '+')}`;
}

/** Validate only already-allocated source occurrences; never initialize/reconcile a plan. */
export function captureSnapshot({ inventory, plan, revision, readSource }) {
  check(plan.schema === 'huey.editorial-pages.v1' && plan.parser === 'huey.editorial-markdown/1', 'unsupported source plan');
  check(inventory.schema === 'huey.editorial-inventory.v1', 'expected checked inventory');
  const ids = plan.sources.flatMap(s => s.blocks.map(b => b.id));
  check(new Set(ids).size === ids.length && ids.every(id => new RegExp(profile.entityID).test(id)), 'invalid or duplicate occurrence identity');
  const entries = [], slots = [], sourceTexts = {};
  for (const slot of inventory.slots) {
    const selected = inventory.sources.filter(s => ['canonical', 'unplaced'].includes(s.role) && s.targets.includes(slot.key));
    const source = selected[0];
    let status = 'unavailable';
    if (source && selected.length === 1 && source.access === 'available' && slot.access === 'available' && slot.canonicalState === 'present-content') {
      check(source.targets.length === 1 && source.path === slot.canonicalPath && slot.sources.includes(source.key), 'ambiguous source selection');
      check(source.role === 'unplaced' ? slot.group === 'unplaced' : ['book', 'front', 'back'].includes(slot.group), 'source placement mismatch');
      const mappings = plan.sources.filter(p => p.sourceKey === source.key);
      check(mappings.length <= 1, 'duplicate source plan');
      const mapping = mappings[0];
      status = !mapping ? 'unmapped' : ['revision', 'path', 'blob'].some(k => mapping[k] !== source[k]) ? 'stale-plan' : 'mapped';
      if (status === 'mapped') {
        const raw = readSource(source);
        check(typeof raw === 'string' && raw.isWellFormed() && gitBlob(raw) === source.blob, 'source bytes drifted');
        sourceTexts[source.key] = raw;
        const blocks = parseEditorialMarkdown(raw);
        check(blocks.length === mapping.blocks.length, 'source block coverage drifted');
        blocks.forEach((block, index) => {
          const mapped = mapping.blocks[index];
          check(mapped.kind === block.kind && mapped.start === block.source.start && mapped.end === block.source.end, 'source occurrence drifted');
          if (block.kind !== 'Paragraph') return;
          const entity = seal({ id: mapped.id, kind: 'Paragraph', state: block.state });
          entries.push({ id: entity.id, version: entity.version, slot: slot.key, raw: raw.slice(mapped.start, mapped.end),
            source: { key: source.key, revision: source.revision, path: source.path, blob: source.blob,
              utf16: { start: mapped.start, end: mapped.end }, lines: { start: block.source.startLine, end: block.source.endLine } },
            scopeRefs: source.scopeRefs });
        });
      }
    }
    slots.push({ key: slot.key, label: slot.label, status, paragraphs: entries.filter(e => e.slot === slot.key).length });
  }
  return { revision, basis: hash({ revision, inventory, plan }), entries, slots, sourceTexts };
}

export function loadSnapshot(root = ROOT) {
  root = realpathSync(root);
  const inventory = loadInventory(root);
  const plan = JSON.parse(readFileSync(resolve(root, 'planning/editorial-pages/plan.json'), 'utf8'));
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return captureSnapshot({ inventory, plan, revision, readSource(source) {
    check(safePath(source.path) && source.path.startsWith('manuscript/'), 'source outside manuscript');
    const path = resolve(root, source.path), info = lstatSync(path);
    check(info.isFile() && !info.isSymbolicLink() && within(root, realpathSync(path)), 'unsafe source path');
    return readFileSync(path, 'utf8');
  } });
}

function inspectPrivate(path, directory = false) {
  const stat = lstatSync(path);
  check(!stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1), 'unsafe private store entry');
  check(stat.uid === process.getuid() && (stat.mode & 0o7777) === (directory ? 0o700 : 0o600),
    'private store permissions must be exactly owner-only 0700 directories and 0600 files');
}

export class ChatWorkspace {
  constructor({ root = ROOT, store, snapshot = () => loadSnapshot(root) }) {
    check(typeof store === 'string' && store.length > 0, '--store is required; choose a restricted directory outside every Git checkout');
    this.root = realpathSync(root);
    const requested = resolve(store);
    // Resolve parents before mkdir; no recursive creation through unknown paths.
    const parent = realpathSync(dirname(requested));
    this.store = resolve(parent, requested.split(sep).at(-1));
    check(!within(this.root, this.store), 'private store must be outside the repository');
    for (let p = this.store; ; p = dirname(p)) {
      const marker = resolve(p, '.git');
      // Sandboxes can expose an empty, read-only .git placeholder. Only a real
      // worktree marker or Git directory with HEAD denotes a checkout.
      const gitMarker = existsSync(marker) && (lstatSync(marker).isFile() || existsSync(resolve(marker, 'HEAD')));
      check(!gitMarker, 'private store must be outside every Git checkout');
      if (p === dirname(p)) break;
    }
    if (!existsSync(this.store)) mkdirSync(this.store, { mode: 0o700 });
    inspectPrivate(this.store, true);
    this.snapshot = snapshot;
    this.file = resolve(this.store, 'workspace.json');
  }
  state() {
    inspectPrivate(this.store, true);
    if (!existsSync(this.file)) return { schema: 'huey.private-chat-workspace.v1', repository: this.root, proposals: [], decisions: [], links: [], reconciliations: [] };
    inspectPrivate(this.file);
    const bytes = readFileSync(this.file, 'utf8');
    let data;
    try { data = JSON.parse(bytes); } catch { throw new Error('CHAT_WORKSPACE: invalid private state JSON'); }
    check(data !== null && typeof data === 'object' && !Array.isArray(data), 'invalid private state');
    check(data.schema === 'huey.private-chat-workspace.v1' && data.repository === this.root, 'store belongs to another repository or schema');
    check(['proposals', 'decisions', 'links'].every(k => Array.isArray(data[k])), 'invalid private state');
    for (const op of data.proposals) check(op.digest === hash(Object.fromEntries(Object.entries(op).filter(([k]) => k !== 'digest'))), 'proposal integrity mismatch');
    check(new Set(data.proposals.map(p => p.id)).size === data.proposals.length && new Set(data.proposals.map(p => p.key)).size === data.proposals.length, 'duplicate proposal identity or key');
    for (const [index, op] of data.proposals.entries()) {
      check(/^op_[0-9a-f-]{36}$/.test(op.id) && new RegExp(profile.entityID).test(op.target) && nonempty(op.key), 'invalid proposal identity');
      check(op.kind === 'ReplaceInscription' && op.schema === 'huey.private-chat-proposal.v1' && [op.actor, op.session, op.requestRef].every(nonempty), 'invalid proposal provenance');
      check(op.clientSequence === index + 1 && Number.isSafeInteger(op.clientSequence)
        && typeof op.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(op.createdAt) && Number.isFinite(Date.parse(op.createdAt)),
      'invalid persisted proposal sequence or creation time');
      check(hash(op.before) === op.beforeDigest && seal({ id: op.target, kind: 'Paragraph', state: paragraph(op.after).state }).version === op.afterVersion, 'invalid proposal wording or version');
    }
    check(new Set(data.decisions.map(d => d.operationId)).size === data.decisions.length, 'duplicate decision');
    for (const d of data.decisions) {
      const op = data.proposals.find(p => p.id === d.operationId);
      check(op && d.reviewDigest === op.digest && nonempty(d.approvalRef) && ['applied-private', 'rejected', 'cancelled'].includes(d.status), 'invalid decision receipt');
    }
    for (const link of data.links) check(Object.keys(link).sort().join(',') === 'operationId,url' && data.proposals.some(p => p.id === link.operationId) && validLink(link.url), 'invalid local GitHub link');
    // Older stores remain readable. Only a subsequent explicit transaction
    // persists the new collection; existing histories are never relabelled.
    if (!Object.hasOwn(data, 'reconciliations')) data.reconciliations = [];
    validateReconciliations(data);
    const hasDrafts = Object.hasOwn(data, 'draftCheckpoints'), hasGeneration = Object.hasOwn(data, 'draftCheckpointGeneration');
    draftCheck(hasDrafts === hasGeneration, 'DRAFT_STATE_INVALID');
    if (hasDrafts) {
      draftCheck(validGeneration(data.draftCheckpointGeneration), 'DRAFT_STATE_INVALID');
      validateDraftCheckpointCollection(data.draftCheckpoints);
      draftCheck(data.draftCheckpointGeneration > 0 || data.draftCheckpoints.checkpoints.length === 0, 'DRAFT_STATE_INVALID');
    }
    return data;
  }
  transaction(fn, { skipUnchanged = false, readSnapshot = true } = {}) {
    inspectPrivate(this.store, true);
    const lock = resolve(this.store, 'workspace.lock');
    let fd;
    try { fd = openSync(lock, 'wx', 0o600); } catch { throw new Error('CHAT_WORKSPACE: store locked; another writer or interrupted operation needs inspection'); }
    const tmp = resolve(this.store, `${randomUUID()}.tmp`);
    try {
      const data = this.state();
      const previous = skipUnchanged ? JSON.stringify(data) : null;
      // Only explicit checkpoint discard uses a state-only transaction. Source
      // failure never supplies a substitute basis to proposal/save/restore work.
      const result = fn(data, readSnapshot ? this.snapshot() : null);
      if (skipUnchanged && JSON.stringify(data) === previous) return result;
      writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      renameSync(tmp, this.file);
      return result;
    } finally {
      if (existsSync(tmp)) unlinkSync(tmp);
      closeSync(fd); unlinkSync(lock);
    }
  }
  current(id, data, snap) {
    const original = snap.entries.find(e => e.id === id);
    check(original, 'paragraph unavailable or unmapped');
    const retired = latestReconciliation(data, id)?.retiredOperationIds ?? [];
    const applied = appliedHistory(data, id).slice(retired.length);
    let current = { ...original, sourceVersion: original.version, rawDigest: hash(original.raw), privateOperation: null };
    for (const { operation: op } of applied) {
      check(op.basis === snap.basis && op.baseVersion === current.version && op.beforeDigest === current.rawDigest, 'private overlay is stale; reconcile explicitly');
      current = { ...original, sourceVersion: original.version, version: op.afterVersion, raw: op.after, rawDigest: hash(op.after), privateOperation: op.id };
    }
    return current;
  }
  list(slot) {
    const snap = this.snapshot();
    return { revision: snap.revision, basis: snap.basis, scope: 'mapped working paragraphs; not a complete manuscript', slots: snap.slots,
      paragraphs: snap.entries.filter(e => !slot || e.slot === slot).map(({ id, version, slot, source }) => ({ id, sourceVersion: version, slot, lines: source.lines })) };
  }
  read(id) {
    const snap = this.snapshot(), data = this.state();
    return { basis: snap.basis, revision: snap.revision, ...this.current(id, data, snap), evidence: 'source references only; private changes inherit no evidence or admission' };
  }
  draftView(id, data, snap, checkpoint) {
    const available = snap.entries.some(entry => entry.id === id);
    let current = null;
    try { current = { basis: snap.basis, revision: snap.revision, ...this.current(id, data, snap) }; } catch { /* Retain checkpoint only. */ }
    const compatibility = checkpoint ? current ? assessDraftCheckpointCompatibility(checkpoint, current)
      : { status: available ? 'stale' : 'unavailable', reasons: [available ? 'WORKING_CONTEXT_STALE' : 'SOURCE_UNAVAILABLE'] }
      : { status: 'unavailable', reasons: ['NO_CHECKPOINT'] };
    return { checkpoint, compatibility, eligible: draftEligible(current), generation: draftGeneration(data) };
  }
  inspectDraft(id) {
    draftCheck(draftPattern(id, new RegExp(profile.entityID)), 'DRAFT_TARGET_INVALID');
    const data = this.state(), collection = draftCollection(data);
    const checkpoint = collection.checkpoints.find(item => item.target === id) ?? null;
    let snap;
    try { snap = this.snapshot(); }
    catch {
      draftCheck(checkpoint, 'DRAFT_CURRENT_UNAVAILABLE', 409);
      return { checkpoint, compatibility: { status: 'unavailable', reasons: ['SOURCE_UNAVAILABLE'] },
        eligible: false, generation: draftGeneration(data) };
    }
    draftCheck(checkpoint || snap.entries.some(entry => entry.id === id), 'DRAFT_TARGET_UNAVAILABLE');
    return this.draftView(id, data, snap, checkpoint);
  }
  draftIndex() {
    const data = this.state();
    return { generation: draftGeneration(data), checkpoints: draftCollection(data).checkpoints
      .map(({ target, createdAt }) => ({ target, createdAt })) };
  }
  saveDraft(request) {
    const required = ['id', 'basis', 'revision', 'sourceVersion', 'baseVersion', 'beforeDigest', 'privateOperation',
      'draft', 'key', 'expectedDigest', 'generation'];
    draftFields(request, required);
    draftCheck(draftPattern(request.id, new RegExp(profile.entityID)) && draftPattern(request.key, UUID)
      && draftPattern(request.basis, DIGEST) && draftPattern(request.revision, /^[a-f0-9]{40}$/)
      && draftPattern(request.sourceVersion, new RegExp(profile.entityVersion))
      && draftPattern(request.baseVersion, new RegExp(profile.entityVersion)) && draftPattern(request.beforeDigest, DIGEST)
      && (request.privateOperation === null || draftPattern(request.privateOperation, OP_ID))
      && (request.expectedDigest === null || draftPattern(request.expectedDigest, DIGEST)) && validGeneration(request.generation)
      && typeof request.draft === 'string' && request.draft.isWellFormed()
      && request.draft.length <= draftPolicy.limits.maxDraftCodeUnits, 'DRAFT_REQUEST_INVALID');
    draftCheck(draftEnabled(), 'DRAFT_STORAGE_DISABLED', 403);
    return this.transaction((data, snap) => {
      const collection = draftCollection(data), requestDigest = hash(request);
      const retry = collection.checkpoints.find(item => item.key === request.key);
      if (retry) {
        draftCheck(retry.requestDigest === requestDigest, 'DRAFT_IDEMPOTENCY_CONFLICT', 409);
        return { ...this.draftView(retry.target, data, snap, retry), effect: 'saved local checkpoint only; no application or acceptance' };
      }
      draftCheck(request.generation === draftGeneration(data), 'DRAFT_GENERATION_CHANGED', 409);
      const previous = collection.checkpoints.find(item => item.target === request.id) ?? null;
      draftCheck(previous ? request.expectedDigest === previous.digest : request.expectedDigest === null, 'DRAFT_CHECKPOINT_CHANGED', 409);
      let current;
      try { current = { basis: snap.basis, revision: snap.revision, ...this.current(request.id, data, snap) }; }
      catch { draftCheck(false, 'DRAFT_CURRENT_UNAVAILABLE', 409); }
      draftCheck(draftEligible(current), 'DRAFT_SOURCE_INELIGIBLE', 403);
      draftCheck(request.basis === current.basis && request.revision === current.revision
        && request.sourceVersion === current.sourceVersion && request.baseVersion === current.version
        && request.beforeDigest === current.rawDigest && request.privateOperation === (current.privateOperation ?? null),
      'DRAFT_CURRENT_CHANGED', 409);
      const checkpoint = { schema: draftPolicy.checkpointSchema, id: `draft_${randomUUID()}`, key: request.key, requestDigest,
        target: request.id, basis: current.basis, revision: current.revision, baseVersion: current.version,
        sourceVersion: current.sourceVersion, beforeDigest: current.rawDigest, before: current.raw, draft: request.draft,
        privateOperation: current.privateOperation ?? null, createdAt: new Date().toISOString() };
      checkpoint.digest = hash(checkpoint);
      const next = { schema: collection.schema, checkpoints: previous ? collection.checkpoints.map(item => item.target === request.id ? checkpoint : item)
        : [...collection.checkpoints, checkpoint] };
      validateDraftCheckpointCollection(next);
      draftCheck(draftEnabled(), 'DRAFT_STORAGE_DISABLED', 403);
      const generation = nextDraftGeneration(data); data.draftCheckpoints = next; data.draftCheckpointGeneration = generation;
      return { ...this.draftView(checkpoint.target, data, snap, checkpoint), effect: 'saved local checkpoint only; no application or acceptance' };
    }, { skipUnchanged: true });
  }
  discardDraft(request) {
    draftFields(request, ['id', 'expectedDigest', 'generation']);
    draftCheck(draftPattern(request.id, new RegExp(profile.entityID)) && draftPattern(request.expectedDigest, DIGEST)
      && validGeneration(request.generation), 'DRAFT_REQUEST_INVALID');
    draftCheck(draftEnabled(), 'DRAFT_STORAGE_DISABLED', 403);
    return this.transaction(data => {
      const collection = draftCollection(data), checkpoint = collection.checkpoints.find(item => item.target === request.id);
      if (!checkpoint) return { status: 'absent', generation: draftGeneration(data), effect: 'observed local absence only; no previous discard receipt inferred' };
      draftCheck(request.generation === draftGeneration(data) && request.expectedDigest === checkpoint.digest, 'DRAFT_CHECKPOINT_CHANGED', 409);
      const next = { schema: collection.schema, checkpoints: collection.checkpoints.filter(item => item.target !== request.id) };
      validateDraftCheckpointCollection(next);
      draftCheck(draftEnabled(), 'DRAFT_STORAGE_DISABLED', 403);
      const generation = nextDraftGeneration(data); data.draftCheckpoints = next; data.draftCheckpointGeneration = generation;
      return { status: 'discarded', generation, effect: 'local checkpoint removed only; working text and immutable history unchanged' };
    }, { skipUnchanged: true, readSnapshot: false });
  }
  restoreDraft(request) {
    draftFields(request, ['id', 'checkpointDigest', 'generation']);
    draftCheck(draftPattern(request.id, new RegExp(profile.entityID)) && draftPattern(request.checkpointDigest, DIGEST)
      && validGeneration(request.generation), 'DRAFT_REQUEST_INVALID');
    const data = this.state(), snap = this.snapshot(), checkpoint = draftCollection(data).checkpoints.find(item => item.target === request.id);
    draftCheck(checkpoint && request.generation === draftGeneration(data) && request.checkpointDigest === checkpoint.digest, 'DRAFT_CHECKPOINT_CHANGED', 409);
    let current;
    try { current = { basis: snap.basis, revision: snap.revision, ...this.current(request.id, data, snap) }; }
    catch { draftCheck(false, 'DRAFT_CURRENT_UNAVAILABLE', 409); }
    draftCheck(draftEligible(current), 'DRAFT_SOURCE_INELIGIBLE', 403);
    draftCheck(assessDraftCheckpointCompatibility(checkpoint, current).status === 'current', 'DRAFT_CURRENT_CHANGED', 409);
    return { checkpointDigest: checkpoint.digest, draft: checkpoint.draft };
  }
  proposalQueue({ id, beforeSequence, limit = 20 } = {}) {
    check(typeof id === 'string' && new RegExp(profile.entityID).test(id), 'valid requested paragraph identity required');
    check(Number.isSafeInteger(limit) && limit >= 1 && limit <= 20, 'queue limit must be 1–20');
    check(beforeSequence === undefined || Number.isSafeInteger(beforeSequence) && beforeSequence > 0,
      'queue cursor must be a positive exclusive sequence');
    const data = this.state(), snap = this.snapshot();
    const saved = data.proposals.filter(op => op.target === id);
    check(saved.length || snap.entries.some(entry => entry.id === id), 'paragraph unavailable or unmapped with no saved private work');
    let current = null, currentConflict = null;
    try { current = this.current(id, data, snap); } catch (error) { currentConflict = error.message; }
    const retired = new Set(latestReconciliation(data, id)?.retiredOperationIds ?? []);
    const eligible = saved.filter(op => beforeSequence === undefined || op.clientSequence < beforeSequence)
      .sort((a, b) => b.clientSequence - a.clientSequence);
    const operations = eligible.slice(0, limit).map(op => {
      const decision = data.decisions.find(item => item.operationId === op.id);
      const conflict = decision ? null : currentConflict ?? (op.basis !== snap.basis
        || op.baseVersion !== current.version || op.beforeDigest !== current.rawDigest ? 'CHAT_WORKSPACE: stale proposal; source/overlay changed' : null);
      return { id: op.id, target: op.target, clientSequence: op.clientSequence, createdAt: op.createdAt,
        status: decision?.status ?? 'proposed-private', retired: retired.has(op.id), conflict };
    });
    return { target: id, basis: snap.basis, revision: snap.revision, operations,
      nextBeforeSequence: eligible.length > operations.length ? operations.at(-1).clientSequence : null,
      authority: 'local private queue; no remote/literary acceptance' };
  }
  inspect(id) { return this.inspection(id, this.state(), this.snapshot()); }
  inspection(id, data, snap) {
    check(typeof id === 'string' && new RegExp(profile.entityID).test(id), 'invalid paragraph identity');
    const original = snap.entries.find(entry => entry.id === id), history = appliedHistory(data, id);
    const prior = latestReconciliation(data, id), retiredOperationIds = prior?.retiredOperationIds ?? [];
    check(original || history.length, 'paragraph unavailable or unmapped with no saved private work');
    const evidence = 'source references only; private changes inherit no evidence or admission';
    let source = null, current = null, conflict = null;
    if (original) {
      check(seal({ id, kind: 'Paragraph', state: paragraph(original.raw).state }).version === original.version,
        'current source version does not match exact wording');
      source = { basis: snap.basis, revision: snap.revision, ...original, sourceVersion: original.version,
        rawDigest: hash(original.raw), privateOperation: null, evidence };
      try { current = { basis: snap.basis, revision: snap.revision, ...this.current(id, data, snap), evidence }; }
      catch (error) { conflict = error.message; }
    } else conflict = 'CHAT_WORKSPACE: paragraph unavailable or unmapped; saved private history is retained';
    const active = history.slice(retiredOperationIds.length), first = active[0]?.operation ?? history[0]?.operation;
    const last = history.at(-1)?.operation;
    const previous = last ? { before: first.before, after: last.after, baseVersion: first.baseVersion,
      version: last.afterVersion, basis: first.basis, revision: first.revision, operationId: last.id } : null;
    const historyDigest = hash(history);
    const reviewDigest = sourceReviewDigest({ target: id, basis: snap.basis, revision: snap.revision,
      sourceVersion: source?.version ?? null, sourceDigest: source?.rawDigest ?? null, source: source?.source ?? null,
      historyDigest, previousReconciliationDigest: prior?.digest ?? null });
    return { status: source ? conflict ? 'stale-overlay' : 'current' : 'unavailable', current, source, previous,
      reviewDigest, conflict, appliedOperationIds: history.map(item => item.operation.id),
      retiredOperationIds: [...retiredOperationIds], latestReconciliationId: prior?.id ?? null,
      history: history.map(({ operation: op }, index) => ({ operationId: op.id, before: op.before, after: op.after,
        baseVersion: op.baseVersion, version: op.afterVersion, basis: op.basis, revision: op.revision,
        retired: index < retiredOperationIds.length })) };
  }
  resumeSource({ id, reviewDigest, decisionRef, key }) {
    check([decisionRef, key].every(nonempty) && typeof reviewDigest === 'string' && DIGEST.test(reviewDigest), 'exact source review, decision reference and idempotency key required');
    return this.transaction((data, snap) => {
      const request = { id, reviewDigest, decisionRef, key }, existing = data.reconciliations.find(receipt => receipt.key === key);
      if (existing) { check(existing.requestDigest === hash(request), 'reconciliation idempotency key reused for another request'); return existing; }
      const inspection = this.inspection(id, data, snap);
      check(inspection.reviewDigest === reviewDigest, 'stale reconciliation review; source or applied history changed');
      check(inspection.source, 'current source unavailable; private history retained without reconciliation');
      check(inspection.status === 'stale-overlay', 'source resume requires a stale private overlay');
      const source = inspection.source, prior = latestReconciliation(data, id), history = appliedHistory(data, id);
      const receipt = { schema: 'huey.private-source-resume.v1', id: `resume_${randomUUID()}`, target: id,
        basis: snap.basis, revision: snap.revision, sourceVersion: source.version, sourceDigest: source.rawDigest,
        sourceRaw: source.raw, source: source.source, retiredOperationIds: history.map(item => item.operation.id),
        previousReconciliationId: prior?.id ?? null, historyDigest: hash(history), reviewDigest, decisionRef, key,
        requestDigest: hash(request), createdAt: new Date().toISOString(), effect: RESUME_EFFECT, authority: RESUME_AUTHORITY };
      receipt.digest = hash(receipt); data.reconciliations.push(receipt);
      return receipt;
    });
  }
  search({ slot, query, limit = 20 }) {
    check(typeof slot === 'string' && slot.length > 0, 'choose a specific slot before searching');
    check(typeof query === 'string' && query.length > 0 && query.length <= 1000, 'nonempty literal query required');
    check(Number.isInteger(limit) && limit > 0 && limit <= 20, 'search limit must be 1–20');
    const snap = this.snapshot(), data = this.state();
    check(snap.slots.some(s => s.key === slot && s.status === 'mapped'), 'slot unavailable or unmapped');
    const matches = snap.entries.filter(e => e.slot === slot).map(e => this.current(e.id, data, snap)).filter(e => e.raw.includes(query));
    return { slot, basis: snap.basis, total: matches.length, matches: matches.slice(0, limit),
      scope: 'literal, case-sensitive search of this slot, including applied private overlays' };
  }
  propose({ id, baseVersion, beforeDigest, after, actor, session, requestRef, key }) {
    check([actor, session, requestRef, key].every(v => typeof v === 'string' && v.trim() && v.length <= 1000), 'actor, session, requestRef and idempotency key required (host-supplied, not authentication)');
    const block = paragraph(after);
    return this.transaction((data, snap) => {
      const request = { target: id, baseVersion, beforeDigest, after, actor, session, requestRef, key };
      const existing = data.proposals.find(p => p.key === key);
      if (existing) { check(existing.requestDigest === hash(request), 'idempotency key reused for another request'); return existing; }
      const current = this.current(id, data, snap);
      check(current.version === baseVersion && current.rawDigest === beforeDigest, 'stale paragraph version or exact wording');
      check(current.raw !== after, 'empty change');
      const siblings = snap.entries.filter(e => e.slot === current.slot), index = siblings.findIndex(e => e.id === id);
      const op = { schema: 'huey.private-chat-proposal.v1', id: `op_${randomUUID()}`, kind: 'ReplaceInscription', target: id,
        basis: snap.basis, revision: snap.revision, baseVersion, beforeDigest, before: current.raw, after,
        afterVersion: seal({ id, kind: 'Paragraph', state: block.state }).version, source: current.source,
        neighbors: { before: siblings[index - 1]?.id ?? null, after: siblings[index + 1]?.id ?? null },
        actor, session, requestRef, key, requestDigest: hash(request), clientSequence: data.proposals.length + 1,
        createdAt: new Date().toISOString(), disposition: 'proposed-private; no source write or permission grant' };
      op.digest = hash(op); data.proposals.push(op); return op;
    });
  }
  review(operationId) {
    const data = this.state(), op = data.proposals.find(p => p.id === operationId);
    check(op, 'unknown operation');
    const snap = this.snapshot();
    let conflict = null;
    const decision = data.decisions.find(d => d.operationId === operationId) ?? null;
    try {
      const current = this.current(op.target, data, snap);
      // Applied history can have later valid edits; the complete overlay chain
      // has just been checked. Compare base wording only for unapplied proposals.
      check(op.basis === snap.basis && (decision?.status === 'applied-private' ||
        current.version === op.baseVersion && current.rawDigest === op.beforeDigest), 'stale proposal');
    } catch (error) { conflict = error.message; }
    return { operation: op, decision, conflict,
      diff: { before: op.before, after: op.after }, reviewDigest: op.digest, links: data.links.filter(l => l.operationId === operationId),
      warning: 'Private review only. Approval reference is a host assertion, not authenticated human assent. Evidence and public disclosure require separate review.' };
  }
  decide({ operationId, reviewDigest, approvalRef, status }) {
    check(['applied-private', 'rejected', 'cancelled'].includes(status), 'invalid disposition');
    check(typeof approvalRef === 'string' && approvalRef.trim() && approvalRef.length <= 1000, 'exact user decision reference required');
    return this.transaction((data, snap) => {
      const op = data.proposals.find(p => p.id === operationId);
      check(op && op.digest === reviewDigest, 'unknown operation or changed review payload');
      const prior = data.decisions.find(d => d.operationId === operationId);
      if (prior) { check(prior.status === status && prior.approvalRef === approvalRef, 'operation already has a different decision'); return prior; }
      if (status === 'applied-private') {
        const current = this.current(op.target, data, snap);
        check(snap.basis === op.basis && current.version === op.baseVersion && current.rawDigest === op.beforeDigest, 'stale proposal; source/overlay changed');
      }
      const receipt = { operationId, reviewDigest, approvalRef, status, recordedAt: new Date().toISOString(),
        effect: status === 'applied-private' ? 'local private overlay only' : 'no text effect',
        authority: 'host-supplied decision reference; not independently authenticated' };
      data.decisions.push(receipt); return receipt;
    });
  }
  link(operationId, url) {
    check(validLink(url), 'expected exact Huey issue or PR URL');
    return this.transaction(data => {
      check(data.proposals.some(p => p.id === operationId), 'unknown operation');
      const entry = { operationId, url };
      if (!data.links.some(l => l.operationId === operationId && l.url === url)) data.links.push(entry);
      return { ...entry, effect: 'local reference only; no GitHub write or verified external disposition' };
    });
  }
  sourcePreview(operationId) {
    const data = this.state(), op = data.proposals.find(p => p.id === operationId);
    check(op && data.decisions.some(d => d.operationId === operationId && d.status === 'applied-private'), 'source preview requires an applied private operation');
    const snap = this.snapshot();
    check(op.basis === snap.basis, 'stale source basis');
    check(!(latestReconciliation(data, op.target)?.retiredOperationIds ?? []).includes(op.id), 'retired private operation; review the active working copy');
    const before = snap.sourceTexts?.[op.source.key];
    check(typeof before === 'string' && gitBlob(before) === op.source.blob, 'exact source unavailable');
    const edits = snap.entries.filter(e => e.source.key === op.source.key).map(original => ({ original, current: this.current(original.id, data, snap) }))
      .filter(({ original, current }) => original.raw !== current.raw).sort((a, b) => b.original.source.utf16.start - a.original.source.utf16.start);
    let after = before, previousStart = before.length;
    for (const { original, current } of edits) {
      const { start, end } = original.source.utf16;
      check(start >= 0 && end <= previousStart && before.slice(start, end) === original.raw, 'source preview range mismatch');
      after = after.slice(0, start) + current.raw + after.slice(end); previousStart = start;
    }
    check(parseEditorialMarkdown(before).length === parseEditorialMarkdown(after).length, 'source preview changed structural block count');
    return { schema: 'huey.private-source-preview.v1', source: op.source, basis: snap.basis, before, after,
      afterBlob: gitBlob(after), patch: sourcePatch(op.source.path, before, after), affectedEntities: edits.map(e => e.original.id),
      operationIds: data.decisions.filter(d => d.status === 'applied-private' && data.proposals.some(p => p.id === d.operationId && p.source.key === op.source.key
        && !(latestReconciliation(data, p.target)?.retiredOperationIds ?? []).includes(p.id))).map(d => d.operationId),
      effect: 'private cumulative source candidate only; canonical source and identity/pin metadata unchanged',
      blockers: ['explicit source correspondence and pin reconciliation (#353/#360)', 'review exact public payload before Git materialization (#355/#361)'] };
  }
  handoff(operationId) {
    const review = this.review(operationId);
    return { destination: 'grwtsk/huey', base: 'pre-release', draft: true, links: review.links,
      operationId, localDisposition: review.decision?.status ?? 'proposed', conflict: review.conflict,
      publicText: 'Private editorial candidate prepared in an authorized local workspace. No manuscript wording, source locator or private fingerprint is included. Separate exact-payload disclosure review is required before any source patch can be shared.',
      gates: ['payload disclosure review', 'source reconciliation (#353/#360)', 'reverse materialization (#355)', 'Git adapter (#361)', 'human editorial acceptance is separate'],
      effect: 'preview only; no network, commit, push or PR creation' };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (const name of ['store', 'root']) {
      const index = args.indexOf(`--${name}`);
      if (index >= 0) { check(args[index + 1] && !args[index + 1].startsWith('--'), `missing --${name} value`); options[name] = args[index + 1]; args.splice(index, 2); }
    }
    const [command, target, extra] = args;
    const ws = new ChatWorkspace(options);
    const input = () => JSON.parse(readFileSync(0, 'utf8'));
    let result;
    if (command === 'list' && args.length <= 2) result = ws.list(target);
    else if (command === 'read' && args.length === 2) result = ws.read(target);
    else if (command === 'inspect' && args.length === 2) result = ws.inspect(target);
    else if (command === 'proposal-queue' && args.length === 1) result = ws.proposalQueue(input());
    else if (command === 'resume-source' && args.length === 1) result = ws.resumeSource(input());
    else if (command === 'search' && args.length === 1) result = ws.search(input());
    else if (command === 'propose' && args.length === 1) result = ws.propose(input());
    else if (command === 'review' && args.length === 2) result = ws.review(target);
    else if (command === 'decide' && args.length === 1) result = ws.decide(input());
    else if (command === 'link' && args.length === 3) result = ws.link(target, extra);
    else if (command === 'source-preview' && args.length === 2) result = ws.sourcePreview(target);
    else if (command === 'handoff' && args.length === 2) result = ws.handoff(target);
    else throw new Error('usage: chat_workspace.mjs --store /restricted/outside/git [list [slot]|read ID|inspect ID|proposal-queue < JSON|resume-source < JSON|search < JSON|propose < JSON|review OP|decide < JSON|link OP URL|source-preview OP|handoff OP]');
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
