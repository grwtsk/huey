import test from 'node:test';
import assert from 'node:assert/strict';
import { Narrator, voiceKey } from '../src/speech.mjs';
const local={name:'Test local',voiceURI:'local',lang:'en-US',localService:true,default:true};
const remote={name:'Test remote',voiceURI:'remote',lang:'en-US',localService:false,default:false};
function harness(voices=[local,remote]) {
  const pending=new Map();let count=0;
  const timers={setTimeout(fn){pending.set(++count,fn);return count;},clearTimeout(id){pending.delete(id);}};
  const synth={spoken:[],cancelCount:0,getVoices:()=>voices,cancel(){this.cancelCount++;},speak(u){this.spoken.push(u);u.onstart?.();}};
  const states=[],paragraphs=[];
  const n=new Narrator({synth,Utterance:class{constructor(text){this.text=text;}},timers,onState:s=>states.push(s),onParagraph:p=>paragraphs.push(p.id)});
  n.setItems([{id:'p1',text:'First paragraph with words.'},{id:'p2',text:'Second paragraph.'}]);
  return {n,synth,states,paragraphs,pending};
}
test('initialization never autoplays',()=>{const {synth}=harness();assert.equal(synth.spoken.length,0);});
test('only explicitly allowed voices are eligible',()=>{
  const {n}=harness();assert.deepEqual(n.voices,[local]);
  n.configure({allowRemote:true,voice:voiceKey(remote)});assert.equal(n.voice,remote);
  n.configure({allowRemote:false});assert.equal(n.voice,local);n.dispose();
});
test('no local voice does not silently send text to a remote service',()=>{
  const {n,synth}=harness([remote]);n.play(0);assert.equal(n.state,'error');assert.equal(synth.spoken.length,0);n.dispose();
});
test('sequential paragraphs advance and terminate',()=>{
  const {n,synth,paragraphs}=harness();n.play(0);synth.spoken[0].onend();synth.spoken[1].onend();
  assert.deepEqual(paragraphs,['p1','p2']);assert.equal(n.state,'ended');n.dispose();
});
test('pause/resume uses last observed word boundary',()=>{
  const {n,synth}=harness();n.play(0);synth.spoken[0].onboundary({charIndex:6});n.pause();
  assert.equal(n.state,'paused');n.play();assert.equal(synth.spoken.at(-1).text,'paragraph with words.');n.dispose();
});
test('pause without boundaries repeats only current bounded phrase',()=>{
  const {n,synth}=harness();n.setItems([{id:'p',text:'long words '.repeat(80)}]);n.play(0);
  const previous=synth.spoken[0].text;n.pause();n.play();assert.equal(synth.spoken.at(-1).text,previous);assert.ok(previous.length<=220);n.dispose();
});
test('stale callbacks after stop cannot restart playback',()=>{
  const {n,synth}=harness();n.play(0);const stale=synth.spoken[0];n.stop();stale.onend();stale.onerror({error:'canceled'});
  assert.equal(synth.spoken.length,1);assert.equal(n.state,'idle');n.dispose();
});
test('seek cancels old paragraph and ignores its callbacks',()=>{
  const {n,synth}=harness();n.play(0);const stale=synth.spoken[0];n.play(1);stale.onend();
  assert.equal(synth.spoken.length,2);assert.equal(synth.spoken[1].text,'Second paragraph.');n.dispose();
});
test('changing rate or voice pauses, never silently restarts',()=>{
  const {n,synth}=harness();n.play(0);n.configure({rate:1.4});assert.equal(n.state,'paused');assert.equal(synth.spoken.length,1);
  n.play();assert.equal(synth.spoken.at(-1).rate,1.4);assert.throws(()=>n.configure({rate:99}));n.dispose();
});
test('unavailable chapter gap stops the queue',()=>{
  const {n,synth}=harness();n.items[0].breakAfter=true;n.play(0);synth.spoken[0].onend();
  assert.equal(n.state,'ended');assert.equal(synth.spoken.length,1);n.dispose();
});
test('speech errors and watchdogs release the queue',()=>{
  const {n,synth,pending}=harness();n.play(0);synth.spoken[0].onerror({error:'not-allowed'});assert.equal(n.state,'error');assert.equal(pending.size,0);
  n.play(0);[...pending.values()][0]();assert.equal(n.state,'error');assert.equal(pending.size,0);n.dispose();
});
test('long paragraph narration preserves the entire text',()=>{
  const {n,synth}=harness();const text='Many words in a sentence. '.repeat(100);n.setItems([{id:'p',text}]);n.play(0);
  let i=0;while(n.state==='playing'&&i<1000){synth.spoken[i++].onend();}
  assert.equal(n.state,'ended');assert.equal(synth.spoken.map(u=>u.text).join(''),text);n.dispose();
});
test('unsupported browsers retain an explicit error rather than throw',()=>{
  const n=new Narrator({});n.setItems([{id:'p',text:'Sample.'}]);n.play(0);assert.equal(n.state,'error');n.dispose();
});
