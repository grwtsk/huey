/** Exact-source draft handoff; preparation only, never publication or acceptance. */
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ChatWorkspace, loadSnapshot } from './chat_workspace.mjs';
import { loadInventory, gitBlob } from './editorial_inventory.mjs';
import { parseEditorialMarkdown } from './editorial_markdown.mjs';
import { canonical } from './literary_model.mjs';
import { compileBook } from '../reader/scripts/content.mjs';

const check = (ok, message) => { if (!ok) throw new Error(`CHAT_HANDOFF: ${message}`); };
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const pin = source => ({ revision: source.revision, path: source.path, blob: source.blob });
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], env: { ...process.env, GIT_NO_LAZY_FETCH:'1', GIT_TERMINAL_PROMPT:'0' } }).trimEnd();

export const contractPins = Object.freeze({
  reconciliationCommit: 'fd12406b4876f2e7c853d34d8607f0ff551d7be2',
  reconciliationSha256: '495dad19f77b255fe795954892afacca3d25e4ff51e314a15c67e1551f7441fc',
  assemblyCommit: '0863ef3f54da4e85270d336344e9723a7a952488',
  assemblySha256: '0ffc5c630fb7cae84b2fe61b788d0920ab22a150b2253ae8ba30647bebdae9ed',
});

/** Consume the existing #377 contract and compatible #463 assembler, not a fork. */
export async function loadContracts(directory) {
  check(typeof directory === 'string' && directory.length > 0, 'explicit installed contract directory required');
  const root = realpathSync(directory);
  const expectedFiles = {
    'scripts/editorial_reconcile.mjs':contractPins.reconciliationSha256,
    'scripts/editorial_pages.mjs':contractPins.assemblySha256,
    'scripts/editorial_inventory.mjs':'40295acb73c46ded321243ba1284358fbd99bf31754b801898dd104ab54fcce2',
    'scripts/editorial_markdown.mjs':'e32c89029b92170cb2c58082756d217d92426d3897d09e85a44ae475fa7f00fa',
    'scripts/editorial_front_matter.mjs':'c22b83637f152ca380f7f6d6d91deb320f0ae7010890edf3bd8743983cd9562c',
    'scripts/literary_model.mjs':'465a99b3b4cf7fd8d3195076ee2b84e04d1a584842801216b54633703c3ca34b',
    'planning/literary-model/v1.json':'851543750628b6b1c54467c7beba0f1d69fc28966362f5cf0d1e46f91a2c7b9d',
  };
  for (const [name, expected] of Object.entries(expectedFiles)) {
    const path = resolve(root, name), info = lstatSync(path);
    check(info.isFile() && !info.isSymbolicLink() && realpathSync(path) === path, 'unsafe contract module');
    check(createHash('sha256').update(readFileSync(path)).digest('hex') === expected, 'contract version mismatch');
  }
  const reconcile = await import(pathToFileURL(resolve(root, 'scripts/editorial_reconcile.mjs')).href);
  const assembly = await import(pathToFileURL(resolve(root, 'scripts/editorial_pages.mjs')).href);
  return { reconcileSource: reconcile.reconcileSource, planDigest: reconcile.planDigest, buildAssembly: assembly.buildAssembly };
}

/** Full source+metadata public-payload template. Checkpoint SHA is unresolved. */
export function prepareDraft({ baseHead, targetBaseHead = baseHead, before, registry, manifest, evidence, existingBlobs, preview, contracts }) {
  check(sha(baseHead) && sha(targetBaseHead) && preview.basis && preview.schema === 'huey.private-source-preview.v1', 'invalid source preview/base');
  check(existingBlobs && typeof existingBlobs === 'object', 'exact base tree blobs required');
  const assembled = contracts.buildAssembly(before); // Whole-assembly guard; no mapped-only shortcut here.
  const source = before.inventory.sources.find(s => s.key === preview.source.key);
  const registered = registry.sources.filter(s => s.key === source?.key);
  check(source && registered.length === 1 && canonical(pin(source)) === canonical(pin(preview.source)) && canonical(pin(registered[0])) === canonical(pin(source)), 'source pins differ');
  check(before.sourceTexts[source.key] === preview.before && gitBlob(preview.before) === source.blob && gitBlob(preview.after) === preview.afterBlob, 'source preview bytes drifted');
  check(preview.before !== preview.after, 'empty source change');
  const sourcePlan = before.plan.sources.find(s => s.sourceKey === source.key);
  const oldBlocks = parseEditorialMarkdown(preview.before), blocks = parseEditorialMarkdown(preview.after);
  check(sourcePlan && blocks.length === oldBlocks.length && sourcePlan.blocks.length === blocks.length, 'split/join requires a separate operation');
  const entities = new Map(assembled.entityRecords.map(e => [e.id,e]));
  const expected = new Set(preview.affectedEntities);
  check(expected.size === preview.affectedEntities.length && expected.size > 0, 'invalid affected identity set');
  const changed = [];
  const correspondenceBlocks = blocks.map((block,index) => {
    const old = oldBlocks[index], mapped = sourcePlan.blocks[index];
    check(block.kind === old.kind && mapped.kind === old.kind && mapped.start === old.source.start && mapped.end === old.source.end, 'source structure drift');
    const oldRaw = preview.before.slice(old.source.start,old.source.end), nextRaw = preview.after.slice(block.source.start,block.source.end);
    if (oldRaw !== nextRaw) { check(old.kind === 'Paragraph' && expected.has(mapped.id), 'unapproved block change'); changed.push(mapped.id); }
    return { entityId:mapped.id, baseVersion:entities.get(mapped.id).version, start:block.source.start, end:block.source.end };
  });
  check(changed.length === expected.size && changed.every(id=>expected.has(id)), 'affected identities differ from actual changes');
  const nextManifest = structuredClone(manifest), extraFiles = [];
  const admitted = nextManifest.chapters.filter(c => c.status === 'admitted' && c.path === source.path);
  check(admitted.length <= 1, 'ambiguous admission');
  let admission = { workingEvidence:'unreviewed; no inherited admission/evidence', previousProjection:'not-admitted' };
  if (admitted.length) {
    const c = admitted[0];
    if (c.snapshotPath) check(existingBlobs[c.snapshotPath] === c.blob, 'configured snapshot must exist exactly in the captured base tree');
    if (!c.snapshotPath) {
      check(c.blob === source.blob, 'admitted historical bytes must already be pinned or snapshotted');
      c.snapshotPath = `reader/content/admitted/${c.blob}.md`;
      check(!existingBlobs[c.snapshotPath] || existingBlobs[c.snapshotPath] === c.blob, 'snapshot collision');
      extraFiles.push({ path:c.snapshotPath, content:preview.before, expectedBaseBlob:existingBlobs[c.snapshotPath] ?? null });
    }
    check(c.snapshotPath === `reader/content/admitted/${c.blob}.md`, 'invalid admitted snapshot');
    admission = { ...admission, previousProjection:'retained exact historical snapshot', chapter:c.id,
      admittedPin:{ revision:c.revision,path:c.path,blob:c.blob }, admissionRef:c.admission,
      evidenceLedgerDigest:digest(evidence), newWorkingEvidenceBindings:0 };
  }
  const template = { schema:'huey.private-source-handoff.v1', baseHead, targetBaseHead, basis:preview.basis, sourceKey:source.key,
    beforePin:pin(source), afterBlob:preview.afterBlob, afterText:preview.after, patch:preview.patch,
    operationIds:preview.operationIds, affectedEntities:preview.affectedEntities, correspondenceBlocks,
    basePlanDigest:contracts.planDigest(before.plan), baseRegistryDigest:digest(registry), baseManifestDigest:digest(manifest),
    baseEvidenceDigest:digest(evidence), existingBlobs, extraFiles, nextManifest, admission, contracts:contractPins,
    publication:'unapproved; host must obtain exact payload disclosure approval before uploading checkpoint bytes',
    checkpointRule:'source-only commit; one parent equal to baseHead; final registry/plan substitute only its verified SHA',
    finalBranchRule:'create new draft branch only at final checked commit; never expose intermediate checkpoint as a branch tip' };
  return { ...template, reviewDigest:digest(template) };
}

/** Atomic preparation: returns the entire valid file batch or throws; never writes. */
export function finalizeDraft({ prepared, expectedReviewDigest, currentHead, targetBaseHead = currentHead, before, registry, manifest, evidence, existingBlobs, preview, checkpoint, contracts }) {
  const { reviewDigest, ...template } = prepared;
  check(expectedReviewDigest === reviewDigest && reviewDigest === digest(template), 'review payload changed');
  const fresh = prepareDraft({baseHead:currentHead,targetBaseHead,before,registry,manifest,evidence,existingBlobs,preview,contracts});
  check(canonical(fresh) === canonical(prepared), 'review template differs from current validated inputs');
  check(currentHead === prepared.baseHead, 'stale base HEAD');
  check(digest(registry) === prepared.baseRegistryDigest && digest(manifest) === prepared.baseManifestDigest && digest(evidence) === prepared.baseEvidenceDigest
    && contracts.planDigest(before.plan) === prepared.basePlanDigest, 'stale metadata');
  check(sha(checkpoint.sha) && canonical(checkpoint.parents) === canonical([currentHead]), 'checkpoint parent mismatch');
  check(checkpoint.files.length === 1 && checkpoint.files[0].mode === '100644' && checkpoint.files[0].path === prepared.beforePin.path && checkpoint.files[0].content === prepared.afterText
    && gitBlob(checkpoint.files[0].content) === prepared.afterBlob, 'checkpoint contains unexpected changes');
  const afterInventory = structuredClone(before.inventory), source = afterInventory.sources.find(s=>s.key===prepared.sourceKey);
  check(source && canonical(pin(source)) === canonical(prepared.beforePin), 'source pin changed');
  source.revision = checkpoint.sha; source.blob = prepared.afterBlob;
  const afterTexts = { ...before.sourceTexts, [source.key]:prepared.afterText };
  const result = contracts.reconcileSource({ before, after:{inventory:afterInventory,sourceTexts:afterTexts}, correspondence:{
    schema:'huey.source-correspondence.v1', sourceKey:source.key, basePlanSha256:prepared.basePlanDigest,
    before:prepared.beforePin, after:pin(source), blocks:prepared.correspondenceBlocks } });
  const nextRegistry = structuredClone(registry), registered = nextRegistry.sources.find(s=>s.key===source.key);
  check(registered && canonical(pin(registered)) === canonical(prepared.beforePin), 'registry pin changed');
  registered.revision = checkpoint.sha; registered.blob = prepared.afterBlob;
  const files = [
    {path:source.path,content:prepared.afterText,expectedBaseBlob:prepared.beforePin.blob},
    {path:'planning/editorial-inventory/registry.json',content:json(nextRegistry),expectedBaseBlob:prepared.existingBlobs['planning/editorial-inventory/registry.json']},
    {path:'planning/editorial-pages/plan.json',content:json(result.plan),expectedBaseBlob:prepared.existingBlobs['planning/editorial-pages/plan.json']},
    ...prepared.extraFiles,
  ];
  if (canonical(manifest) !== canonical(prepared.nextManifest)) files.push({path:'reader/content/book.json',content:json(prepared.nextManifest),expectedBaseBlob:prepared.existingBlobs['reader/content/book.json']});
  const receipt = { schema:'huey.source-handoff-receipt.v1', status:'draft-candidate; not accepted or released', sourceKey:source.key,
    baseHead:currentHead, checkpoint:checkpoint.sha, operations:prepared.operationIds, changes:result.changes,
    sourceBefore:prepared.beforePin, sourceAfter:pin(source), admission:prepared.admission,
    authority:'host must verify actual scoped approval; this receipt grants none' };
  const reportPath = `planning/editorial-handoffs/${prepared.operationIds[0]}.json`;
  check(/^planning\/editorial-handoffs\/op_[a-f0-9-]{36}\.json$/.test(reportPath), 'invalid handoff identity');
  check(!prepared.existingBlobs[reportPath], 'handoff receipt already exists');
  files.push({path:reportPath,content:json(receipt),expectedBaseBlob:null});
  check(new Set(files.map(f=>f.path)).size===files.length, 'duplicate output path');
  const payload = { schema:'huey.checked-source-batch.v1', baseHead:currentHead, expectedTargetHead:prepared.targetBaseHead, preconditionRef:currentHead, parent:checkpoint.sha, reviewDigest,
    files, receipt, changes:result.changes, publication:'still requires host approval and remote-base check',
    expectedNewBranch:true, draft:true, baseBranch:'pre-release', effect:'no writes performed' };
  return { ...payload, payloadDigest:digest(payload) };
}

async function context(root, ws, contracts) {
  const initialHead = git(root,['rev-parse','HEAD']);
  const targetBaseHead = git(root,['rev-parse','refs/remotes/origin/pre-release']);
  git(root,['merge-base','--is-ancestor',targetBaseHead,initialHead]);
  check(git(root,['status','--porcelain','--untracked-files=no']) === '', 'source checkout must be clean');
  const snap = loadSnapshot(root), inventory = loadInventory(root);
  const read = path => JSON.parse(readFileSync(resolve(root,path),'utf8'));
  await compileBook(root,resolve(root,'reader/content')); // Verify old admission/evidence before retaining it.
  const existingBlobs = Object.fromEntries(git(root,['ls-tree','-r','--full-tree','HEAD']).split('\n').filter(Boolean).map(line => { const m = /^100(?:644|755) blob ([a-f0-9]{40})\t(.+)$/.exec(line); check(m,'unsupported base tree entry'); return [m[2],m[1]]; }));
  const result = { existingBlobs, targetBaseHead, head:initialHead, snap, before:{inventory,plan:read('planning/editorial-pages/plan.json'),sourceTexts:snap.sourceTexts},
    registry:read('planning/editorial-inventory/registry.json'),manifest:read('reader/content/book.json'),evidence:read('reader/content/evidence.json'),contracts };
  check(git(root,['rev-parse','HEAD']) === initialHead && git(root,['rev-parse','refs/remotes/origin/pre-release']) === targetBaseHead && git(root,['status','--porcelain','--untracked-files=no']) === '', 'source checkout changed during read');
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command,root,store,contractRoot,target,expectedReviewDigest] = process.argv.slice(2);
    check(['prepare','finalize'].includes(command) && root && store && contractRoot, 'usage: chat_handoff.mjs prepare ROOT STORE CONTRACTS OP | finalize ROOT STORE CONTRACTS CHECKPOINT REVIEW_DIGEST < reviewed-template.json');
    const contracts = await loadContracts(contractRoot), ws = new ChatWorkspace({root,store});
    const ctx = await context(root,ws,contracts);
    let output;
    if (command === 'prepare') output = prepareDraft({...ctx,baseHead:ctx.head,preview:ws.sourcePreview(target)});
    else {
      check(sha(target), 'checkpoint SHA required');
      const prepared = JSON.parse(readFileSync(0,'utf8'));
      const latest = ws.sourcePreview(prepared.operationIds[0]);
      check(latest.after === prepared.afterText && latest.basis === prepared.basis && canonical(latest.operationIds) === canonical(prepared.operationIds), 'private working result changed');
      const parents = git(root,['rev-list','--parents','-n','1',target]).split(' ').slice(1);
      const paths = git(root,['diff-tree','--no-commit-id','--name-only','-r',ctx.head,target]).split('\n').filter(Boolean);
      check(paths.length===1 && paths[0]===prepared.beforePin.path, 'checkpoint file set differs');
      // Preserve exact trailing newlines, unlike metadata-only git helper output.
      check(/^100644 blob [a-f0-9]{40}\t/.test(git(root,['ls-tree',target,'--',paths[0]])), 'checkpoint source is not a regular nonexecutable file');
      const content = execFileSync('git',['show',`${target}:${paths[0]}`],{cwd:root,encoding:'utf8'});
      output = finalizeDraft({...ctx,prepared,expectedReviewDigest,preview:latest,currentHead:ctx.head,checkpoint:{sha:target,parents,files:[{path:paths[0],content,mode:'100644'}]}});
    }
    process.stdout.write(json(output));
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
