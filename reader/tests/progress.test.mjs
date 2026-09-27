import test from 'node:test';
import assert from 'node:assert/strict';
import { ChapterTimeline, formatTime, Narrator } from '../src/speech.mjs';

const items = [
  { id: 'a1', chapterId: 'C01', text: 'Alpha beta gamma.' },
  { id: 'a2', chapterId: 'C01', text: 'Delta echo.' },
  { id: 'b1', chapterId: 'C02', text: 'A second chapter with 🕊 and words.' }
];
function harness() {
  const positions = [], pending = new Map(); let timer = 0;
  const synth = { spoken: [], canceled: 0,
    getVoices: () => [{ name: 'Test', voiceURI: 'test', lang: 'en-US', localService: true }],
    cancel() { this.canceled++; }, speak(u) { this.spoken.push(u); u.onstart?.(); } };
  const narrator = new Narrator({ synth, Utterance: class { constructor(text) { this.text = text; } },
    onPosition: p => positions.push(p), timers: {
      setTimeout(fn) { pending.set(++timer, fn); return timer; }, clearTimeout(id) { pending.delete(id); }
    } });
  narrator.setItems(items.map(i => ({ ...i })));
  return { narrator, synth, positions, pending };
}

test('chapter-local positions reset and finish independently', () => {
  const t = new ChapterTimeline(items);
  assert.equal(t.position(0).ratio, 0);
  assert.equal(t.position(1, items[1].text.length).ratio, 1);
  assert.equal(t.position(2).ratio, 0);
  assert.equal(t.position(2, items[2].text.length).ratio, 1);
});
test('seek maps into this chapter, snaps to whole words and clamps endpoints', () => {
  const t = new ChapterTimeline(items);
  assert.deepEqual(t.seek('C01', -1), { index: 0, offset: 0, end: false });
  assert.deepEqual(t.seek('C01', 2), { index: 1, offset: items[1].text.length, end: true });
  for (let x = 0; x < 1; x += .01) {
    const p = t.seek('C01', x);
    assert.ok([0, 1].includes(p.index));
    assert.ok(p.offset === 0 || /\s/.test(items[p.index].text[p.offset - 1]));
  }
});
test('word-aware seeks do not start at an astral-character continuation', () => {
  const t = new ChapterTimeline(items);
  for (let x = 0; x < 1; x += .01) {
    const p = t.seek('C02', x);
    assert.ok(!/[\uDC00-\uDFFF]/.test(items[p.index].text[p.offset]));
  }
});
test('time model is explicitly rate-adjusted and finite', () => {
  const t = new ChapterTimeline(items);
  assert.equal(t.position(0, 0, 1).duration, 5 / 180 * 60);
  assert.ok(Math.abs(t.position(0, 0, 1.5).duration - t.position(0).duration / 1.5) < 1e-12);
  assert.equal(formatTime(75), '1:15');
  assert.equal(formatTime(NaN), '0:00');
  assert.equal(t.position(99), null);
  assert.throws(() => t.seek('MISSING', .5));
  assert.throws(() => t.seek('C01', NaN));
});
test('seeking while stopped or paused makes no speech request', () => {
  const { narrator: n, synth } = harness();
  n.seek(0, 6); assert.equal(n.state, 'paused'); assert.equal(synth.spoken.length, 0);
  n.play(); assert.equal(synth.spoken.at(-1).text, 'beta gamma.');
  n.pause(); n.seek(1, 0); assert.equal(n.state, 'paused'); assert.equal(synth.spoken.length, 1);
  n.dispose();
});
test('seeking during playback cancels old speech and resumes at selected word', () => {
  const { narrator: n, synth, positions } = harness();
  n.play(0); const stale = synth.spoken[0];
  n.seek(1, 6, { resume: true });
  assert.equal(synth.spoken.at(-1).text, 'echo.');
  const count = positions.length;
  stale.onboundary({ charIndex: 3 }); stale.onend(); stale.onerror({ error: 'interrupted' });
  assert.equal(positions.length, count); assert.equal(synth.spoken.length, 2);
  assert.equal(n.index, 1); n.dispose();
});
test('speech boundary callbacks drive position and freeze on pause', () => {
  const { narrator: n, synth, positions } = harness();
  n.play(0); synth.spoken[0].onboundary({ charIndex: 6 });
  assert.equal(positions.at(-1).offset, 6);
  n.pause(); const count = positions.length;
  synth.spoken[0].onboundary({ charIndex: 11 });
  assert.equal(positions.length, count); assert.equal(n.boundary, 6); n.dispose();
});
test('100 percent seeking does not speak or spill into another chapter', () => {
  const { narrator: n, synth, positions } = harness();
  n.play(0); n.seek(1, items[1].text.length, { resume: true, end: true });
  assert.equal(n.state, 'ended'); assert.equal(n.index, 1);
  assert.equal(positions.at(-1).offset, items[1].text.length);
  assert.equal(synth.spoken.length, 1); n.dispose();
});
test('invalid seek is rejected before canceling current playback', () => {
  const { narrator: n, synth } = harness(); n.play(0); const count = synth.canceled;
  for (const call of [() => n.seek(-1), () => n.seek(0, -1), () => n.seek(0, 99),
    () => n.seek(0, items[0].text.length, { end: true }),
    () => n.seek(2, items[2].text.indexOf('🕊') + 1)]) assert.throws(call);
  assert.equal(synth.canceled, count); assert.equal(n.state, 'playing'); n.dispose();
});
test('completion without word boundaries still reaches final chapter endpoint', () => {
  const { narrator: n, synth, positions } = harness();
  n.setItems([{ id: 'x', chapterId: 'C03', text: 'Word '.repeat(150) }]);
  n.play(0); let i = 0;
  while (n.state === 'playing' && i < 100) synth.spoken[i++].onend();
  assert.equal(n.state, 'ended'); assert.equal(positions.at(-1).offset, 750);
  assert.equal(synth.spoken.map(u => u.text).join(''), 'Word '.repeat(150)); n.dispose();
});
