/** Prose-only Markdown tokenizer. Content becomes DOM text, never executable HTML. */
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function inlineTokens(raw) {
  const out = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)/g;
  let from = 0;
  for (const match of raw.matchAll(pattern)) {
    if (match.index > from) out.push({ type: 'text', text: raw.slice(from, match.index) });
    if (match[1]) out.push({ type: 'strong', text: match[1] });
    else if (match[2]) out.push({ type: 'em', text: match[2] });
    else if (match[3]) out.push({ type: 'code', text: match[3] });
    else {
      const url = safeUrl(match[5]);
      if (!url) throw new Error('Unsafe or unsupported manuscript link');
      out.push({ type: 'link', text: match[4], url });
    }
    from = match.index + match[0].length;
  }
  if (from < raw.length) out.push({ type: 'text', text: raw.slice(from) });
  return out;
}

export function parseMarkdown(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) throw new Error('Empty manuscript');
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  if (!/^# [^#]/.test(lines[0])) throw new Error('A chapter must start with one title');
  const title = lines[0].slice(2);
  const blocks = [];
  let paragraph = 0;
  for (let i = 1; i < lines.length;) {
    if (!lines[i].trim()) { i++; continue; }
    const startLine = i + 1;
    if (/^(---|\*\*\*)$/.test(lines[i])) {
      blocks.push({ type: 'break', startLine, endLine: startLine }); i++; continue;
    }
    const heading = /^(#{2,4}) (.+)$/.exec(lines[i]);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length + 1,
        tokens: inlineTokens(heading[2]), startLine, endLine: startLine }); i++; continue;
    }
    if (/^(# |```|~~~|>|[-+] |\d+\. |\|)/.test(lines[i])) {
      throw new Error(`Unsupported structural Markdown at line ${startLine}; extend the parser explicitly`);
    }
    const collected = [];
    while (i < lines.length && lines[i].trim()) {
      if (/^(#{1,4} |---$|\*\*\*$|```|~~~|>|[-+] |\d+\. |\|)/.test(lines[i])) {
        throw new Error(`Structural Markdown needs a blank-line boundary at line ${i + 1}`);
      }
      collected.push(lines[i++]);
    }
    const raw = collected.join('\n');
    const tokens = inlineTokens(raw);
    blocks.push({ type: 'paragraph', number: ++paragraph, raw, tokens,
      text: tokens.map(t => t.text).join('').replace(/\n/g, ' '),
      startLine, endLine: i });
  }
  if (!paragraph) throw new Error('An admitted chapter needs actual paragraphs');
  return { title, blocks, paragraphCount: paragraph };
}

/** Exact, whitespace-preserving chunks. Keep utterances small without losing words. */
export function speechChunks(text, maxLength = 220) {
  if (!Number.isInteger(maxLength) || maxLength < 20) throw new Error('Invalid chunk size');
  const out = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(text.length, offset + maxLength);
    if (end < text.length) {
      const candidate = text.slice(offset, end);
      const sentence = [...candidate.matchAll(/[.!?][”’"']?\s+/g)].at(-1);
      const space = candidate.lastIndexOf(' ');
      if (sentence && sentence.index > maxLength / 3) end = offset + sentence.index + sentence[0].length;
      else if (space > 0) end = offset + space + 1;
      // Never split a UTF-16 surrogate pair.
      if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    }
    out.push({ text: text.slice(offset, end), offset });
    offset = end;
  }
  return out;
}

export function paragraphId(chapter, number) {
  return `${chapter}-p${String(number).padStart(4, '0')}`;
}
export function paragraphHashRoute(kind, chapter, paragraph, version) {
  if (!['read', 'evidence'].includes(kind) || !/^[A-Z][A-Z0-9]*$/.test(chapter) ||
      !Number.isSafeInteger(paragraph) || paragraph < 1 || !/^[a-f0-9]{40}$/.test(version)) {
    throw new Error('Invalid paragraph route');
  }
  return `#${kind}/${chapter}/${paragraph}/${version}`;
}
export function parseRoute(hash) {
  if (!hash || hash === '#') return { kind: 'home' };
  const chapter = /^#chapter\/([A-Z][A-Z0-9]*)$/.exec(hash);
  if (chapter) return { kind: 'chapter', chapter: chapter[1] };
  const p = /^#(read|evidence)\/([A-Z][A-Z0-9]*)\/([1-9]\d*)\/([a-f0-9]{40})$/.exec(hash);
  if (!p || !Number.isSafeInteger(Number(p[3]))) return { kind: 'invalid' };
  return { kind: p[1], chapter: p[2], paragraph: Number(p[3]), version: p[4] };
}
