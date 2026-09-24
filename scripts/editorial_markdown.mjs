/**
 * Bounded structural ingestion for explicitly selected editorial Markdown.
 * This is not a Markdown renderer, source selector, or identity allocator.
 */
export class EditorialMarkdownError extends Error {
  constructor(code, line) {
    super(`${code}${line === undefined ? '' : ` at line ${line}`}`);
    this.name = 'EditorialMarkdownError';
    this.code = code;
    if (line !== undefined) this.line = line;
  }
}

const fail = (code, line) => { throw new EditorialMarkdownError(code, line); };
const blank = value => /^[ \t]*$/.test(value);
const heading = value => /^ {0,3}#{1,6}[ \t]+\S/.test(value);
const thematic = value => /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(value);

function linesOf(text) {
  const lines = [];
  const pattern = /([^\r\n]*)(\r\n|\n|$)/gy;
  let offset = 0;
  while (offset < text.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(text);
    if (!match || match[0].length === 0) fail('UNSUPPORTED_LINE_ENDING', lines.length + 1);
    lines.push({ text: match[1], start: offset, end: offset + match[1].length, number: lines.length + 1 });
    offset += match[0].length;
  }
  return lines;
}

function safeLink(value, line) {
  if (!/^https:\/\/[^\s<>()\\]+$/.test(value)) fail('UNSUPPORTED_LINK', line);
  let url;
  try { url = new URL(value); } catch { fail('UNSUPPORTED_LINK', line); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) fail('UNSUPPORTED_LINK', line);
  return value;
}

function inline(raw, source) {
  let text = '';
  const mapping = [];
  const presentation = [];
  const copy = (start, end) => {
    const textStart = text.length;
    text += raw.slice(start, end);
    const segment = { sourceStart: source.start + start, sourceEnd: source.start + end, textStart, textEnd: text.length };
    const previous = mapping.at(-1);
    if (previous?.sourceEnd === segment.sourceStart && previous.textEnd === segment.textStart) {
      previous.sourceEnd = segment.sourceEnd;
      previous.textEnd = segment.textEnd;
    } else if (start !== end) mapping.push(segment);
    return { start: textStart, end: text.length };
  };
  const atLine = offset => source.startLine + (raw.slice(0, offset).match(/\n/g) ?? []).length;
  const plain = value => !/[*`\[\]_\\<>]|~~|&(?:#[xX]?[\da-fA-F]+|[A-Za-z][A-Za-z\d]+);/.test(value);
  let cursor = 0;
  let run = 0;
  while (cursor < raw.length) {
    const char = raw[cursor];
    const line = atLine(cursor);
    let end;
    let innerStart;
    let innerEnd;
    let type;
    let url;
    if (char === '*' || char === '`') {
      const delimiter = char === '*' && raw[cursor + 1] === '*' ? '**' : char;
      if (raw[cursor + delimiter.length] === char) fail('UNSUPPORTED_INLINE', line);
      innerStart = cursor + delimiter.length;
      innerEnd = raw.indexOf(delimiter, innerStart);
      if (innerEnd < 0) fail('UNSUPPORTED_INLINE', line);
      const content = raw.slice(innerStart, innerEnd);
      if (!content || /^\s|\s$/.test(content) || /[\r\n]/.test(content)) fail('UNSUPPORTED_INLINE', line);
      if (char === '*' && !plain(content)) fail('UNSUPPORTED_INLINE', line);
      type = char === '`' ? 'code' : delimiter.length === 2 ? 'strong' : 'em';
      end = innerEnd + delimiter.length;
      if (raw[end] === char) fail('UNSUPPORTED_INLINE', line);
    } else if (char === '[') {
      const match = /^\[([^\]\r\n]+)\]\(([^\s)]+)\)/.exec(raw.slice(cursor));
      if (!match || !plain(match[1]) || /^\s|\s$/.test(match[1])) fail('UNSUPPORTED_INLINE', line);
      type = 'link';
      innerStart = cursor + 1;
      innerEnd = innerStart + match[1].length;
      end = cursor + match[0].length;
      url = safeLink(match[2], line);
    } else if (/[\]_\\<>]/.test(char) || raw.startsWith('~~', cursor) ||
        raw.startsWith('![', cursor) || /^&(?:#[xX]?[\da-fA-F]+|[A-Za-z][A-Za-z\d]+);/.test(raw.slice(cursor))) {
      fail('UNSUPPORTED_INLINE', line);
    }
    if (end !== undefined) {
      copy(run, cursor);
      const span = copy(innerStart, innerEnd);
      presentation.push({ type, ...span, ...(url === undefined ? {} : { url }) });
      cursor = end;
      run = cursor;
    } else cursor++;
  }
  copy(run, raw.length);
  return { state: { text, spans: [] }, mapping, presentation };
}

/**
 * Return ordered Block/Paragraph candidates, without allocating EntityIDs.
 * Offsets are half-open UTF-16 positions in the exact input and inscription.
 * Source ranges exclude the final line delimiter; internal LF/CRLF is preserved.
 * Mapping segments copy exact slices; they are locators, not editable boundaries.
 * Presentation annotations deliberately remain outside Paragraph inscription state.
 */
export function parseEditorialMarkdown(text) {
  if (typeof text !== 'string' || !text.isWellFormed()) fail('INVALID_TEXT');
  if (/\r(?!\n)/.test(text)) fail('UNSUPPORTED_LINE_ENDING');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) fail('UNSUPPORTED_CONTROL');
  const lines = linesOf(text);
  const blocks = [];
  for (let index = 0; index < lines.length;) {
    if (blank(lines[index].text)) { index++; continue; }
    const first = index;
    while (index < lines.length && !blank(lines[index].text)) index++;
    const chunk = lines.slice(first, index);
    const source = { start: chunk[0].start, end: chunk.at(-1).end,
      startLine: chunk[0].number, endLine: chunk.at(-1).number };
    const raw = text.slice(source.start, source.end);
    let format;
    if (chunk.length === 1 && heading(raw)) format = 'markdown-heading';
    else if (chunk.length === 1 && thematic(raw)) format = 'markdown-thematic-break';
    else if (/^ {0,3}<!--(?:[^-]|-(?!->))*-->[ \t]*$/.test(raw)) format = 'markdown-comment';
    if (format) {
      blocks.push({ kind: 'Block', state: { format, text: raw }, source });
      continue;
    }
    for (const line of chunk) {
      if (/^(?: {4}|\t)|^ {0,3}(?:#|>|[-+*][ \t]|\d+[.)][ \t]|`{3}|~{3}|<|\||={2,}[ \t]*$)/.test(line.text) ||
          thematic(line.text) || /^ {0,3}[-:| ]*\|[-:| ]*$/.test(line.text)) {
        fail('UNSUPPORTED_STRUCTURE', line.number);
      }
      if (/[ \t]{2,}$/.test(line.text)) fail('UNSUPPORTED_HARD_BREAK', line.number);
    }
    blocks.push({ kind: 'Paragraph', ...inline(raw, source), source });
  }
  return blocks;
}
