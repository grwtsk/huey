import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEditorialMarkdown, EditorialMarkdownError } from '../scripts/editorial_markdown.mjs';

test('blank-separated paragraphs retain source order and exact ranges', () => {
  const source = '\nFirst line.\nSecond line.\n\n \t\nLast line.\n';
  const blocks = parseEditorialMarkdown(source);
  assert.deepEqual(blocks.map(block => block.kind), ['Paragraph', 'Paragraph']);
  assert.deepEqual(blocks[0].state, { text: 'First line.\nSecond line.', spans: [] });
  assert.deepEqual(blocks[0].source, { start: 1, end: 25, startLine: 2, endLine: 3 });
  assert.deepEqual(blocks[1].source, { start: 30, end: 40, startLine: 6, endLine: 6 });
  for (const block of blocks) assert.equal(source.slice(block.source.start, block.source.end), block.state.text);
});

test('CRLF, combining characters, emoji and exact whitespace are not normalized', () => {
  const source = '  Cafe\u0301 👩🏽‍💻.\r\nNext.\r\n\r\nTail.\r\n';
  const blocks = parseEditorialMarkdown(source);
  assert.equal(blocks[0].state.text, '  Cafe\u0301 👩🏽‍💻.\r\nNext.');
  assert.equal(blocks[0].source.end, source.indexOf('\r\n\r\n'));
  assert.equal(blocks[1].source.startLine, 4);
  assert.equal(blocks[1].source.endLine, 4);
  assert.notEqual(blocks[0].state.text, blocks[0].state.text.normalize('NFC'));
});

test('equal inscriptions stay separate candidates with separate source locations', () => {
  const blocks = parseEditorialMarkdown('the\n\nthe\n');
  assert.equal(blocks.length, 2);
  assert.notEqual(blocks[0], blocks[1]);
  assert.deepEqual(blocks[0].state, blocks[1].state);
  assert.notDeepEqual(blocks[0].source, blocks[1].source);
  assert.ok(blocks.every(block => !Object.hasOwn(block, 'id')));
});

test('headings, thematic breaks and standalone comments remain raw Blocks', () => {
  const text = '# Synthetic title\n\n---\n\n<!-- pending content\nremains unavailable -->\n\nWords.\n';
  const blocks = parseEditorialMarkdown(text);
  assert.deepEqual(blocks.map(block => block.kind), ['Block', 'Block', 'Block', 'Paragraph']);
  assert.deepEqual(blocks.slice(0, 3).map(block => block.state.format),
    ['markdown-heading', 'markdown-thematic-break', 'markdown-comment']);
  for (const block of blocks) assert.equal(text.slice(block.source.start, block.source.end), block.state.text);
  assert.equal(blocks[2].source.startLine, 5);
  assert.equal(blocks[2].source.endLine, 6);
});

test('simple formatting produces exact inscription and separately mapped presentation', () => {
  const source = '# Heading\n\nA *soft* **firm** `x_*` [link](https://example.org/a?q=1&x=2).';
  const paragraph = parseEditorialMarkdown(source)[1];
  assert.deepEqual(paragraph.state, { text: 'A soft firm x_* link.', spans: [] });
  assert.deepEqual(paragraph.presentation, [
    { type: 'em', start: 2, end: 6 },
    { type: 'strong', start: 7, end: 11 },
    { type: 'code', start: 12, end: 15 },
    { type: 'link', start: 16, end: 20, url: 'https://example.org/a?q=1&x=2' },
  ]);
  assert.equal(paragraph.mapping[0].sourceStart, source.indexOf('A *'));
  let mapped = '';
  let next = 0;
  for (const segment of paragraph.mapping) {
    assert.equal(segment.textStart, next);
    const copied = source.slice(segment.sourceStart, segment.sourceEnd);
    assert.equal(copied, paragraph.state.text.slice(segment.textStart, segment.textEnd));
    mapped += copied;
    next = segment.textEnd;
  }
  assert.equal(mapped, paragraph.state.text);
});

test('a presentation-only markup edit does not change paragraph inscription state', () => {
  const plain = parseEditorialMarkdown('A word.')[0];
  const emphasized = parseEditorialMarkdown('A *word*.')[0];
  const strong = parseEditorialMarkdown('A **word**.')[0];
  assert.deepEqual(plain.state, emphasized.state);
  assert.deepEqual(plain.state, strong.state);
  assert.notDeepEqual(plain.presentation, emphasized.presentation);
  assert.notDeepEqual(emphasized.presentation, strong.presentation);
});

test('bounded LaTeX display and inline math preserve exact source mapping', () => {
  const source = '# Math\n\nA value \\(w_n\\) remains.\n\n\\[\nY=F(B,S,U,R)\n\\]\n';
  const blocks = parseEditorialMarkdown(source);
  assert.deepEqual(blocks.map(block => block.kind), ['Block', 'Paragraph', 'Block']);
  assert.equal(blocks[1].state.text, 'A value w_n remains.');
  assert.deepEqual(blocks[1].presentation, [{ type: 'latex-inline', start: 8, end: 11 }]);
  assert.equal(blocks[2].state.format, 'latex-display');
  assert.equal(source.slice(blocks[2].source.start, blocks[2].source.end), blocks[2].state.text);
});

test('empty and comment-only files do not manufacture prose', () => {
  assert.deepEqual(parseEditorialMarkdown(' \n\t\r\n'), []);
  const blocks = parseEditorialMarkdown('<!-- unresolved -->\n');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'Block');
  assert.equal(blocks.filter(block => block.kind === 'Paragraph').length, 0);
});

for (const [name, source] of [
  ['unordered list', '- One\n- Two'], ['star list', '* One'], ['ordered list', '1. One'],
  ['parenthesized list', '1) One'], ['quotation', '> Words'], ['fenced code', '```js\ntext\n```'],
  ['tilde fence', '~~~\ntext\n~~~'], ['indented code', '    text'], ['tab code', '\ttext'],
  ['table', '| left | right |\n| --- | --- |'], ['table separator', 'left | right\n--- | ---'],
  ['setext heading', 'Title\n====='], ['HTML', '<div>text</div>'],
  ['mixed heading', '# Heading\nParagraph'], ['mixed separator', 'Paragraph\n---'],
  ['inline comment', 'Words <!-- unavailable -->'], ['unterminated comment', '<!-- pending'],
  ['reference link', '[label][ref]'], ['footnote', 'text[^note]'], ['image', '![alt](https://example.org/x)'],
  ['underscore emphasis', '_word_'], ['strike', '~~word~~'], ['escape', 'a\\*b'],
  ['HTML entity', 'one &amp; two'], ['numeric entity', '&#x41;'], ['autolink', '<https://example.org>'],
  ['unclosed emphasis', 'one *word'], ['nested emphasis', '**one *word* two**'],
  ['triple emphasis', '***word***'], ['whitespace emphasis', '* word*'],
  ['multiline emphasis', '*one\ntwo*'], ['code normalization', '` word `'],
  ['double backticks', '``word``'], ['unclosed code', '`word'],
  ['formatted link label', '[*word*](https://example.org)'], ['link title', '[word](https://example.org "title")'],
  ['hard break', 'line  \nnext'], ['HTTP link', '[word](http://example.org)'],
  ['script link', '[word](javascript:alert(1))'], ['credential link', '[word](https://user:pass@example.org)'],
  ['backslash link', '[word](https://example.org\\x)'], ['relative link', '[word](/relative)'],
]) test(`rejects unsupported ${name} explicitly`, () => {
  assert.throws(() => parseEditorialMarkdown(source), error =>
    error instanceof EditorialMarkdownError && /^UNSUPPORTED_/.test(error.code));
});

test('invalid text and bare CR fail without including manuscript bytes in diagnostics', () => {
  for (const input of [null, 42, '\ud800']) assert.throws(() => parseEditorialMarkdown(input), { code: 'INVALID_TEXT' });
  assert.throws(() => parseEditorialMarkdown('secret\rtext'), { code: 'UNSUPPORTED_LINE_ENDING' });
  assert.throws(() => parseEditorialMarkdown('secret\u0000text'), { code: 'UNSUPPORTED_CONTROL' });
  try { parseEditorialMarkdown('safe\n\n> source-only words'); } catch (error) {
    assert.equal(error.line, 3);
    assert.equal(error.message.includes('source-only'), false);
  }
});

test('current selected public manuscripts parse without copying their prose into fixtures', () => {
  const selected = [
    ['manuscript/02-interlude/baptism-in-the-color-of-rain.md', 260, 9],
    ['manuscript/02-interlude/14a-on-the-eve-of-the-last-super.md', 786, 41],
    ['manuscript/02-interlude/14b-orange-after-the-end.md', 602, 1],
    ['manuscript/unplaced/the-place-beneath-pain.md', 211, 1],
  ];
  for (const [path, paragraphs, other] of selected) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const blocks = parseEditorialMarkdown(source);
    assert.equal(blocks.filter(block => block.kind === 'Paragraph').length, paragraphs);
    assert.equal(blocks.filter(block => block.kind === 'Block').length, other);
    for (const block of blocks) {
      assert.ok(block.source.end <= source.length);
      if (block.kind === 'Paragraph') for (const segment of block.mapping) {
        assert.ok(source.slice(segment.sourceStart, segment.sourceEnd) === block.state.text.slice(segment.textStart, segment.textEnd));
      }
    }
  }
});
