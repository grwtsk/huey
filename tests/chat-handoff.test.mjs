import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonical } from '../scripts/literary_model.mjs';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatWorkspace } from '../scripts/chat_workspace.mjs';
import { tmpdir } from 'node:os';
import { loadContracts, prepareDraft, finalizeDraft } from '../scripts/chat_handoff.mjs';
import { createPlan } from '../scripts/editorial_pages.mjs';
import { buildInventory, gitBlob, loadInventory } from '../scripts/editorial_inventory.mjs';
import { parseEditorialMarkdown } from '../scripts/editorial_markdown.mjs';
import { compileBook, sha256 } from '../reader/scripts/content.mjs';
import { buildParagraphBindings } from '../scripts/paragraph_bindings.mjs';

assert.ok(process.env.HUEY_CONTRACT_ROOT, 'HUEY_CONTRACT_ROOT must point to the installed exact #377/#463 contracts; this integration suite never substitutes mocks');
const contracts = await loadContracts(process.env.HUEY_CONTRACT_ROOT);
const id = n => `he_00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const text = '# Example\n\nOriginal synthetic wording.\n\nUnchanged synthetic ending.\n';
const json = x => `${JSON.stringify(x,null,2)}\n`;
const git = (root,args,input,extraEnv={}) => execFileSync('git',args,{cwd:root,encoding:'utf8',input,stdio:['pipe','pipe','pipe'],env:{...process.env,GIT_AUTHOR_NAME:'Synthetic test',GIT_AUTHOR_EMAIL:'synthetic@example.invalid',GIT_COMMITTER_NAME:'Synthetic test',GIT_COMMITTER_EMAIL:'synthetic@example.invalid',...extraEnv}}).trim();

function fixture() {
  const revision='a'.repeat(40), path='manuscript/01-preamble/example.md';
  const registry={schema:'huey.editorial-registry.v1',basisRevision:revision,
    containers:{work:id(1),front:id(2),body:id(3),back:id(4),movements:{preamble:id(5),interlude:id(6),excursion:id(7)}},
    slots:[{key:'front-title',entityId:id(8),kind:'MatterUnit',group:'front',label:'Synthetic title',optional:false,presence:'pending',publicationAnnotation:{label:'working',authoritative:false},unmaterializedAccess:null,sources:[],issues:[353],omissionRef:null},{key:'C01',entityId:id(9),kind:'Chapter',group:'book',label:null,optional:null,presence:'present',publicationAnnotation:{label:'working',authoritative:false},unmaterializedAccess:null,sources:['canonical'],issues:[353],omissionRef:null}],
    sources:[{key:'canonical',role:'canonical',extent:'full',revision,path,blob:gitBlob(text),scopeRefs:['https://github.com/grwtsk/huey/issues/2#issuecomment-123'],targets:['C01']}],supportPaths:[]};
  const book={schema:'huey.book.v1',items:[{id:'C01',movement:'preamble',title:'Example',path,include:true}]};
  const manifest={schemaVersion:1,title:'Synthetic',author:'Synthetic',notice:'Synthetic only.',chapters:[{id:'C01',label:'1',title:'Example',movement:'Preamble',status:'admitted',workIssue:'https://example.com/1',mappingIssue:'https://example.com/2',path,blob:gitBlob(text),revision,admission:'https://example.com/old-admission'}]};
  const evidence={schemaVersion:1,sources:[],paragraphs:{'C01-p0001':{sha256:sha256('Original synthetic wording.'),coverage:'partial',referenceIds:[],claims:[{id:'Q1',wording:'Original synthetic wording.',kind:'testimony',disposition:'unreviewed',issue:'https://example.com/q1',links:[],limits:'Synthetic old account only.'}]}}};
  const inventory=buildInventory({registry,book,reader:manifest,trackedPaths:[path],files:{[path]:text},sourceAvailability:{canonical:true}});
  let next=100; const plan=createPlan({inventory,sourceTexts:{canonical:text},allocateId:()=>id(next++)});
  const before={inventory,plan,sourceTexts:{canonical:text}};
  const after=text.replace('Original synthetic wording.','Revised synthetic wording, kept private until approval.');
  const entity=plan.sources[0].blocks.find(b=>b.kind==='Paragraph').id;
  const preview={schema:'huey.private-source-preview.v1',basis:'synthetic-basis',source:{key:'canonical',revision,path,blob:gitBlob(text)},before:text,after,afterBlob:gitBlob(after),affectedEntities:[entity],operationIds:['op_00000000-0000-4000-8000-000000000001'],patch:'synthetic preview'};
  const files={[path]:text,'book.yaml':json(book),'reader/content/book.json':json(manifest),'reader/content/evidence.json':json(evidence),'planning/editorial-inventory/registry.json':json(registry),'planning/editorial-pages/plan.json':json(plan)};
  const existingBlobs=Object.fromEntries(Object.entries(files).map(([p,c])=>[p,gitBlob(c)]));
  const ctx={baseHead:'b'.repeat(40),before,registry,manifest,evidence,existingBlobs,preview,contracts};
  const prepared=()=>prepareDraft(ctx);
  const checkpoint=p=>({sha:'c'.repeat(40),parents:[ctx.baseHead],files:[{path,content:p.afterText,mode:'100644'}]});
  const finish=(p,changes={})=>finalizeDraft({...ctx,prepared:p,expectedReviewDigest:p.reviewDigest,currentHead:ctx.baseHead,checkpoint:checkpoint(p),...changes});
  return {ctx,files,prepared,checkpoint,finish,path};
}

test('real upstream reconciler preserves identities/pages and separates historical admission',()=>{
  const f=fixture(), original=JSON.stringify(f.ctx), p=f.prepared(), result=f.finish(p);
  assert.equal(JSON.stringify(f.ctx),original);
  const byPath=new Map(result.files.map(x=>[x.path,x.content]));
  const plan=JSON.parse(byPath.get('planning/editorial-pages/plan.json'));
  assert.deepEqual(plan.pages,f.ctx.before.plan.pages);
  assert.deepEqual(plan.sources[0].blocks.map(b=>b.id),f.ctx.before.plan.sources[0].blocks.map(b=>b.id));
  assert.equal(result.changes.filter(c=>c.state==='revised').length,1);
  const manifest=JSON.parse(byPath.get('reader/content/book.json')), c=manifest.chapters[0];
  assert.equal(c.blob,f.ctx.manifest.chapters[0].blob);assert.equal(c.admission,f.ctx.manifest.chapters[0].admission);
  assert.equal(byPath.get(c.snapshotPath),text);assert.equal(result.receipt.admission.newWorkingEvidenceBindings,0);
  assert.equal(byPath.has('reader/content/evidence.json'),false);
});

test('stale head, metadata, altered reviewed bytes and wrong checkpoint reject without partial output',()=>{
  const f=fixture(),p=f.prepared(),baseline=JSON.stringify(f.ctx);
  for(const change of [{currentHead:'d'.repeat(40)},{targetBaseHead:'d'.repeat(40)},{registry:{...f.ctx.registry,basisRevision:'d'.repeat(40)}},
    {prepared:{...p,afterText:'tampered'}},{checkpoint:{...f.checkpoint(p),parents:['d'.repeat(40)]}},
    {checkpoint:{...f.checkpoint(p),files:[{path:f.path,content:'wrong'}]}},
    {checkpoint:{...f.checkpoint(p),files:[...f.checkpoint(p).files,{path:'unrequested',content:'x'}]}}]) assert.throws(()=>f.finish(p,change));
  assert.equal(JSON.stringify(f.ctx),baseline);
});

test('unsupported structural edits and unapproved neighboring changes fail preparation',()=>{
  for(const change of [p=>{p.after+='\nNew paragraph.\n';},p=>{p.after=p.after.replace('Unchanged','Unapproved');},p=>{p.affectedEntities=[];}]) {
    const f=fixture();change(f.ctx.preview);f.ctx.preview.afterBlob=gitBlob(f.ctx.preview.after);assert.throws(()=>f.prepared());
  }
});

test('existing admitted snapshot is preserved rather than overwritten by newer working text',()=>{
  const f=fixture();const c=f.ctx.manifest.chapters[0];c.snapshotPath=`reader/content/admitted/${c.blob}.md`;f.ctx.existingBlobs[c.snapshotPath]=c.blob;
  const p=f.prepared();assert.equal(p.extraFiles.length,0);assert.equal(p.nextManifest.chapters[0].snapshotPath,c.snapshotPath);
});

test('snapshot collision rejects; non-admitted source requires no admission or evidence change',()=>{
  const f=fixture();f.ctx.existingBlobs[`reader/content/admitted/${gitBlob(text)}.md`]='0'.repeat(40);assert.throws(()=>f.prepared(),/collision/);
  const g=fixture();g.ctx.manifest.chapters[0]={id:'C01',label:'1',title:'Example',movement:'Preamble',status:'unavailable',workIssue:'https://example.com/1'};
  const p=g.prepared(),result=g.finish(p);assert.equal(p.extraFiles.length,0);assert.equal(result.files.some(x=>x.path==='reader/content/book.json'),false);
});

test('real two-commit synthetic candidate validates inventory/assembly, preserves old reader and has no new evidence bridge',async t=>{
  const f=fixture(),root=mkdtempSync(join(tmpdir(),'huey-handoff-git-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const write=(path,content)=>{mkdirSync(join(root,path,'..'),{recursive:true});writeFileSync(join(root,path),content);};
  git(root,['init','-q']);write(f.path,text);git(root,['add',f.path]);git(root,['commit','-qm','Synthetic source']);
  const sourceRevision=git(root,['rev-parse','HEAD']);
  f.ctx.registry.sources[0].revision=sourceRevision;f.ctx.registry.basisRevision=sourceRevision;f.ctx.manifest.chapters[0].revision=sourceRevision;
  f.ctx.before.inventory.sources[0].revision=sourceRevision;f.ctx.before.inventory.basisRevision=sourceRevision;f.ctx.before.plan.sources[0].revision=sourceRevision;f.ctx.preview.source.revision=sourceRevision;
  f.files['planning/editorial-inventory/registry.json']=json(f.ctx.registry);f.files['planning/editorial-pages/plan.json']=json(f.ctx.before.plan);f.files['reader/content/book.json']=json(f.ctx.manifest);
  for(const [path,content] of Object.entries(f.files))write(path,content);
  git(root,['add','.']);git(root,['commit','-qm','Synthetic metadata']);f.ctx.baseHead=git(root,['rev-parse','HEAD']);git(root,['update-ref','refs/remotes/origin/pre-release',f.ctx.baseHead]);
  f.ctx.existingBlobs=Object.fromEntries(Object.entries(f.files).map(([p,c])=>[p,gitBlob(c)]));
  const beforeLoaded=loadInventory(root);assert.equal(beforeLoaded.sources[0].access,'available');
  const store=`${root}-private`;t.after(()=>rmSync(store,{recursive:true,force:true}));
  const ws=new ChatWorkspace({root,store}),target=f.ctx.preview.affectedEntities[0],current=ws.read(target);
  const op=ws.propose({id:target,baseVersion:current.version,beforeDigest:current.rawDigest,after:'Revised synthetic wording, kept private until approval.',actor:'synthetic-host',session:'synthetic-session',requestRef:'synthetic-request',key:'synthetic-key'});
  ws.decide({operationId:op.id,reviewDigest:op.digest,approvalRef:'synthetic-approval-only',status:'applied-private'});
  const cli=fileURLToPath(new URL('../scripts/chat_handoff.mjs',import.meta.url));
  const call=(args,input)=>JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8',input}));
  const p=call(['prepare',root,store,process.env.HUEY_CONTRACT_ROOT,op.id]);
  const indexEnv={GIT_INDEX_FILE:join(store,'candidate.index')};git(root,['read-tree',f.ctx.baseHead],undefined,indexEnv);
  // Local synthetic Git objects only. No ref moves until both commits exist.
  const blob=git(root,['hash-object','-w','--stdin'],p.afterText);
  git(root,['update-index','--cacheinfo','100644',blob,f.path],undefined,indexEnv);const sourceTree=git(root,['write-tree'],undefined,indexEnv);
  const checkpoint=git(root,['commit-tree',sourceTree,'-p',f.ctx.baseHead,'-m','Synthetic source checkpoint']);
  assert.equal(git(root,['rev-parse','HEAD']),f.ctx.baseHead);assert.equal(readFileSync(join(root,f.path),'utf8'),text);
  const result=call(['finalize',root,store,process.env.HUEY_CONTRACT_ROOT,checkpoint,p.reviewDigest],JSON.stringify(p));
  for(const file of result.files){
    const row=git(root,['ls-tree',result.preconditionRef,'--',file.path]);
    assert.equal(row ? row.split(' ')[2].split('\t')[0] : null,file.expectedBaseBlob);
    const sha=git(root,['hash-object','-w','--stdin'],file.content);git(root,['update-index','--add','--cacheinfo','100644',sha,file.path],undefined,indexEnv);}
  const finalTree=git(root,['write-tree'],undefined,indexEnv),candidate=git(root,['commit-tree',finalTree,'-p',checkpoint,'-m','Synthetic final metadata']);
  assert.equal(git(root,['rev-parse','HEAD']),f.ctx.baseHead);git(root,['update-ref','refs/heads/synthetic-draft',candidate,'0'.repeat(40)]);
  git(root,['reset','--hard','-q',candidate]);
  const inventory=loadInventory(root),plan=JSON.parse(readFileSync(join(root,'planning/editorial-pages/plan.json'),'utf8'));
  const assembly=contracts.buildAssembly({inventory,plan,sourceTexts:{canonical:p.afterText}});assert.equal(assembly.modelValidation,'validated-snapshot');
  const book=await compileBook(root,join(root,'reader/content'));assert.equal(book.chapters[0].blocks.find(b=>b.type==='paragraph').text,'Original synthetic wording.');
  assert.equal(readFileSync(join(root,f.path),'utf8'),p.afterText);
  const bindings=buildParagraphBindings({assembly,book,sourceTexts:{canonical:p.afterText}});assert.equal(bindings.bindings.length,0);
  assert.equal(book.chapters[0].blocks.find(b=>b.type==='paragraph').evidence.claims[0].wording,'Original synthetic wording.');
  assert.equal(Object.hasOwn(book.chapters[0],'snapshotPath'),false);
});

test('independent review digest and fresh template prevent rehashed file injection',()=>{
  const f=fixture(),p=f.prepared();
  assert.throws(()=>f.finish(p,{expectedReviewDigest:'wrong'}),/review payload/);
  const changed=structuredClone(p);changed.extraFiles.push({path:'unrequested.txt',content:'injected',expectedBefore:null});
  assert.throws(()=>f.finish(changed),/review payload/);
  const withBadManifest=structuredClone(p);withBadManifest.nextManifest.chapters[0].admission='https://example.com/forged';
  assert.throws(()=>f.finish(withBadManifest));
  for(const candidate of [changed,withBadManifest]) {
    const {reviewDigest,...template}=candidate;
    candidate.reviewDigest=createHash('sha256').update(canonical(template)).digest('hex');
    assert.throws(()=>f.finish(candidate,{expectedReviewDigest:candidate.reviewDigest}),/fresh|current validated inputs/);
  }
});

test('preconfigured snapshots must exist with exact bytes in captured Git tree',()=>{
  const f=fixture(),c=f.ctx.manifest.chapters[0];c.snapshotPath=`reader/content/admitted/${c.blob}.md`;
  assert.throws(()=>f.prepared(),/captured base tree/);
  f.ctx.existingBlobs[c.snapshotPath]='0'.repeat(40);assert.throws(()=>f.prepared(),/captured base tree/);
});
