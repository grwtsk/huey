import { speechChunks } from './text.mjs';

export const voiceKey = voice => `${voice.voiceURI}|${voice.lang}|${voice.name}`;

/** One bounded utterance at a time. No microphone, server TTS, autoplay or voice cloning. */
export class Narrator {
  constructor({ synth, Utterance, onState = () => {}, onParagraph = () => {}, onPosition = () => {},
    timers = globalThis }) {
    this.synth = synth;
    this.Utterance = Utterance;
    this.onState = onState;
    this.onParagraph = onParagraph;
    this.onPosition = onPosition;
    this.timers = timers;
    this.items = [];
    this.index = 0;
    this.offset = 0;
    this.boundary = 0;
    this.rate = 1;
    this.allowRemote = false;
    this.selectedVoice = '';
    this.generation = 0;
    this.state = 'idle';
    this.timer = null;
    this.utterance = null;
  }
  get supported() { return !!(this.synth && this.Utterance); }
  get voices() {
    if (!this.supported) return [];
    try { return this.synth.getVoices().filter(v => this.allowRemote || v.localService === true); }
    catch { return []; }
  }
  get voice() {
    const voices = this.voices;
    return voices.find(v => voiceKey(v) === this.selectedVoice) ||
      voices.find(v => /^en\b/i.test(v.lang) && v.default) ||
      voices.find(v => /^en\b/i.test(v.lang)) || voices[0];
  }
  setItems(items) { this.stop(); this.items = items; this.index = 0; }
  notify(state, message = '') {
    this.state = state;
    this.onState({ state, message, index: this.index });
    this.reportPosition();
  }
  reportPosition() {
    this.onPosition({ index: this.index, offset: this.boundary, state: this.state });
  }
  /** Seek without queuing audio during a drag. The caller explicitly chooses resume. */
  seek(index, offset = 0, { resume = false, end = false } = {}) {
    const item = this.items[index];
    if (!Number.isInteger(index) || !item || !Number.isInteger(offset) ||
        offset < 0 || offset > item.text.length ||
        (offset > 0 && offset < item.text.length && /[\uDC00-\uDFFF]/.test(item.text[offset]))) {
      throw new Error('Invalid narration position');
    }
    if (end && (offset !== item.text.length ||
        this.items[index + 1]?.chapterId === item.chapterId)) throw new Error('Not a chapter endpoint');
    this.clear();
    this.index = index;
    this.offset = this.boundary = offset;
    if (end) this.notify('ended', 'End of this chapter.');
    else if (resume) this.play();
    else this.notify('paused');
  }
  clear() {
    ++this.generation; // Invalidate callbacks BEFORE cancel, including synchronous error callbacks.
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
    if (this.supported) this.synth.cancel();
    this.utterance = null;
  }
  stop() { this.clear(); this.offset = 0; this.boundary = 0; this.notify('idle'); }
  pause() {
    if (this.state !== 'playing') return;
    const restart = this.boundary;
    this.clear();
    this.offset = restart;
    this.notify('paused', 'Paused. Resume may repeat the last word, or the current short phrase.');
  }
  configure({ rate = this.rate, voice = this.selectedVoice, allowRemote = this.allowRemote }) {
    if (!Number.isFinite(rate) || rate < 0.6 || rate > 1.8) throw new Error('Invalid reading speed');
    if (this.state === 'playing') this.pause();
    this.rate = rate;
    this.selectedVoice = voice;
    this.allowRemote = allowRemote === true;
  }
  play(index) {
    if (!this.supported) { this.notify('error', 'Browser narration is unavailable. The text remains accessible to your screen reader.'); return; }
    if (!this.voice) { this.notify('error', 'No on-device voice is available yet. Check Listening options or use your screen reader.'); return; }
    if (index !== undefined) {
      if (!Number.isInteger(index) || index < 0 || index >= this.items.length) throw new Error('Invalid paragraph');
      this.clear(); this.index = index; this.offset = 0; this.boundary = 0;
    }
    if (!this.items[this.index]) { this.notify('idle'); return; }
    this.notify('playing');
    this.onParagraph(this.items[this.index]);
    this.speakNext();
  }
  fail(message) { this.clear(); this.notify('error', message); }
  speakNext() {
    if (this.state !== 'playing') return;
    const item = this.items[this.index];
    if (!item) { this.notify('ended', 'End of the available reading copy.'); return; }
    if (this.offset >= item.text.length) {
      this.boundary = this.offset = item.text.length;
      if (item.breakAfter) { this.clear(); this.notify('ended', 'The next chapter is not in this reading copy.'); return; }
      if (this.index + 1 >= this.items.length) { this.clear(); this.notify('ended', 'End of the available reading copy.'); return; }
      this.index++;
      this.offset = this.boundary = 0;
      this.onParagraph(this.items[this.index]);
      return this.speakNext();
    }
    const chunk = speechChunks(item.text.slice(this.offset))[0];
    const start = this.offset;
    this.boundary = start;
    this.reportPosition();
    const ticket = ++this.generation;
    const utterance = new this.Utterance(chunk.text);
    this.utterance = utterance; // Retain until completion; do not hand the entire book to the OS queue.
    utterance.voice = this.voice;
    if (!utterance.voice) { this.fail('The selected voice is no longer available.'); return; }
    utterance.lang = utterance.voice.lang || 'en-US';
    utterance.rate = this.rate;
    const current = () => ticket === this.generation && this.state === 'playing';
    const armTimeout = ms => {
      if (this.timer !== null) this.timers.clearTimeout(this.timer);
      this.timer = this.timers.setTimeout(() => {
        if (current()) this.fail('The speech engine stopped responding. Press Play to try again.');
      }, ms);
    };
    utterance.onstart = () => { if (current()) armTimeout(90000 / this.rate); };
    utterance.onboundary = event => {
      if (current() && Number.isInteger(event.charIndex) && event.charIndex >= 0 && event.charIndex < chunk.text.length) {
        this.boundary = start + event.charIndex;
        this.reportPosition();
      }
    };
    utterance.onend = () => {
      if (!current()) return;
      this.timers.clearTimeout(this.timer); this.timer = null;
      this.offset = this.boundary = start + chunk.text.length;
      this.reportPosition();
      this.utterance = null;
      this.speakNext();
    };
    utterance.onerror = event => {
      if (current()) this.fail(`Narration stopped (${event.error || 'speech error'}). The text is still available.`);
    };
    armTimeout(12000);
    try { this.synth.speak(utterance); }
    catch { this.fail('The browser could not start narration. Try another voice.'); }
  }
  dispose() { this.clear(); this.items = []; this.state = 'idle'; }
}

/** Text-position timeline. Seconds are estimates, not prerecorded audio timestamps. */
export class ChapterTimeline {
  constructor(items) {
    this.items = items;
    this.chapters = new Map();
    this.entries = [];
    for (const [index, item] of items.entries()) {
      let chapter = this.chapters.get(item.chapterId);
      if (!chapter) {
        chapter = { id: item.chapterId, entries: [], length: 0, words: 0 };
        this.chapters.set(item.chapterId, chapter);
      }
      const entry = { index, start: chapter.length, length: item.text.length, chapter };
      chapter.entries.push(entry);
      this.entries[index] = entry;
      chapter.length += item.text.length;
      chapter.words += (item.text.match(/\S+/gu) || []).length;
    }
  }
  position(index, offset = 0, rate = 1) {
    const entry = this.entries[index];
    if (!entry || !Number.isFinite(offset) || !Number.isFinite(rate) || rate <= 0) return null;
    const chapter = entry.chapter;
    const ratio = chapter.length ? (entry.start + Math.max(0, Math.min(entry.length, offset))) / chapter.length : 0;
    // A stated UI model, not a claim about a particular installed voice's speed.
    const duration = chapter.words / (180 * rate) * 60;
    return { chapterId: chapter.id, index, offset, ratio, duration, elapsed: duration * ratio };
  }
  seek(chapterId, ratio) {
    const chapter = this.chapters.get(chapterId);
    if (!chapter || !Number.isFinite(ratio)) throw new Error('Invalid chapter seek');
    const fraction = Math.max(0, Math.min(1, ratio));
    const last = chapter.entries.at(-1);
    if (fraction === 1) return { index: last.index, offset: last.length, end: true };
    const target = fraction * chapter.length;
    const entry = chapter.entries.find(e => e.start + e.length > target) || last;
    const rawOffset = Math.max(0, Math.floor(target - entry.start));
    const text = this.items[entry.index].text;
    // Start at a whole word; never split a UTF-16 surrogate or drop its prefix.
    let offset = 0;
    for (const word of text.matchAll(/\S+/gu)) {
      if (word.index > rawOffset) break;
      offset = word.index;
    }
    return { index: entry.index, offset, end: false };
  }
}

export function formatTime(seconds) {
  const value = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(value / 60);
  return `${minutes}:${String(value % 60).padStart(2, '0')}`;
}
