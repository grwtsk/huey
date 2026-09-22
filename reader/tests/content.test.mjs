import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileBook, attachEvidence, sha256, gitBlob } from '../scripts/content.mjs';
import { parseMarkdown, inlineTokens, safeUrl, speechChunks, parseRoute, paragraphHashRoute } from '../src/text.mjs';

const book = await compileBook();
const chapter = book.chapters.find(c => c.id === 'C08A');
test('admitted bytes: one unchanged chapter, complete 260 paragraph surface', () => {
  assert.equal(book.chapters.length, 17);
  assert.equal(book.chapters.filter(c => c.status === 'admitted').length, 1);
  assert.equal(chapter.paragraphCount, 260);
  assert.equal(chapter.blocks.filter(b => b.type === 'break').length, 8);
  assert.equal(chapter.blob, 'e28d4b10c74f8ed6ec6e66b5131e0b25ab5479e1');
  const p = chapter.blocks.filter(b => b.type === 'paragraph');
  assert.equal(p[0].label, '8A:1'); assert.equal(p.at(-1).label, '8A:260');
  assert.match(p[3].text, /netch asheba/);
  assert.match(p[13].text, /the netch\./);
  assert.ok(p.every(b => b.evidence.coverage === 'pending'));
  assert.ok(p.every(b => b.evidence.claims.length === 0));
  assert.equal(p[0].startLine, 3); assert.match(p[0].sourceUrl, /#L3-L3$/);
});
test('deterministic content and unique paragraph IDs', async () => {
  assert.deepEqual(await compileBook(), book);
  const ids = chapter.blocks.filter(b => b.type === 'paragraph').map(b => b.id);
  assert.equal(new Set(ids).size, 260);
});
test('headings and separators do not steal paragraph numbers', () => {
  const c = parseMarkdown('# Example\n\nOne *word*.\n\n---\n\n## Section\n\nTwo\nlines.\n');
  assert.equal(c.paragraphCount, 2);
  assert.equal(c.blocks.at(-1).number, 2);
  assert.equal(c.blocks.at(-1).text, 'Two lines.');
});
test('unsupported structure fails instead of silently corrupting prose', () => {
  for (const raw of ['', 'No title', '# Title\n\n- List', '# Title\n\n```js\nx\n```']) assert.throws(() => parseMarkdown(raw));
});
test('inline text does not treat HTML as executable and links reject unsafe protocols', () => {
  assert.deepEqual(inlineTokens('<img src=x onerror=alert(1)>'), [{type:'text',text:'<img src=x onerror=alert(1)>'}]);
  assert.throws(() => inlineTokens('[x](javascript:alert)'));
  assert.equal(safeUrl('https://user:pass@example.com/x'), null);
  assert.equal(safeUrl('file:///private'), null);
  assert.ok(safeUrl('https://example.com/a#b'));
});
test('version-bound routes reject drift-prone and malformed URLs', () => {
  const hash = paragraphHashRoute('evidence', 'C08A', 260, chapter.blob);
  assert.deepEqual(parseRoute(hash), {kind:'evidence',chapter:'C08A',paragraph:260,version:chapter.blob});
  for (const h of ['#evidence/C08A/1', '#evidence/C08A/0/'+chapter.blob, '#evidence/C08A/1/abc', '#evidence/../1/'+chapter.blob]) assert.equal(parseRoute(h).kind, 'invalid');
});
test('speech chunks preserve every code unit and bounded sizes', () => {
  for (const raw of ['Short.', 'A long sentence. '.repeat(200), 'word '.repeat(1000), '🕊'.repeat(500), 'x'.repeat(900)]) {
    const chunks = speechChunks(raw);
    assert.equal(chunks.map(c => c.text).join(''), raw);
    assert.ok(chunks.every(c => c.text.length <= 220));
    assert.ok(chunks.every(c => !/[\uD800-\uDBFF]$/.test(c.text)));
  }
});
const makeP = () => ({ id: 'C01-p0001', text: 'A reported event.', raw: 'A reported event.', sha256: sha256('A reported event.') });
const mappingChapter = {mappingIssue:'https://example.com/mapping'};
const annotation = () => ({sha256:makeP().sha256,coverage:'partial',referenceIds:[],claims:[{id:'Q1',wording:'A reported event.',kind:'testimony',disposition:'unreviewed',issue:'https://example.com/q1',links:[],limits:'Source review pending.'}]});
test('claim/source model keeps support, counterevidence and context distinct', () => {
  const p=makeP(), a=annotation();
  a.claims[0].links=['supports','contradicts','context'].map((relation,i)=>({sourceId:`S${i}`,relation,locator:'p. 1',note:'Scope recorded.'}));
  const sources=new Map([0,1,2].map(i=>[`S${i}`,{id:`S${i}`}]))
  attachEvidence([p],{[p.id]:a},sources,mappingChapter);
  assert.deepEqual(p.evidence.claims[0].links.map(l=>l.relation),['supports','contradicts','context']);
});
for (const [name, change] of [
  ['stale paragraph hash', a=>a.sha256='0'.repeat(64)],
  ['unknown source', a=>a.referenceIds=['absent']],
  ['claim not in paragraph', a=>a.claims[0].wording='Invented text'],
  ['false complete coverage without review', a=>a.coverage='complete'],
  ['supported fact without evidence', a=>a.claims[0].disposition='supported-fact'],
  ['hidden extra fields', a=>a.privateOriginal='secret']
]) test(`fails closed: ${name}`,()=>{ const p=makeP(), a=annotation(); change(a); assert.throws(()=>attachEvidence([p],{[p.id]:a},new Map(),mappingChapter)); });
test('orphan paragraph annotations are rejected', () => assert.throws(()=>attachEvidence([makeP()],{'C01-p0002':annotation()},new Map(),mappingChapter)));
test('content compiler rejects changed chapter bytes and restricted locators', async () => {
  const root=await mkdtemp(join(tmpdir(),'huey-content-'));
  try {
    const config=join(root,'content'); await mkdir(config); await mkdir(join(root,'manuscript/01-preamble'),{recursive:true});
    const raw='# Example\n\nSample text.\n';
    const c={id:'C01',label:'1',title:'Example',movement:'Preamble',status:'admitted',workIssue:'https://example.com/1',mappingIssue:'https://example.com/2',path:'manuscript/01-preamble/example.md',blob:gitBlob(raw),revision:'1'.repeat(40),admission:'https://example.com/3'};
    await writeFile(join(root,c.path),raw);
    await writeFile(join(config,'book.json'),JSON.stringify({schemaVersion:1,title:'Example',author:'Test',notice:'Synthetic fixture.',chapters:[c]}));
    await writeFile(join(config,'evidence.json'),JSON.stringify({schemaVersion:1,sources:[],paragraphs:{}}));
    assert.equal((await compileBook(root,config)).chapters[0].paragraphCount,1);
    await writeFile(join(root,c.path),raw+'Changed.');
    await assert.rejects(compileBook(root,config),/changed/);
    await writeFile(join(root,c.path),raw);
    await writeFile(join(config,'evidence.json'),JSON.stringify({schemaVersion:1,sources:[{id:'S',title:'Restricted',kind:'record',access:'restricted',url:'https://example.com/private',description:'Not public.'}],paragraphs:{}}));
    await assert.rejects(compileBook(root,config),/Restricted source locator/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
