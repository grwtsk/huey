# Bottom playback controls and chapter seeking

Implements the author's layout correction in #317 on `pre-release` only. This
supersedes the earlier top-toolbar layout description, not the manuscript,
evidence ledger, source-admission rules or journalistic promotion gate.

The top bar contains only the centered current chapter title. Book attribution,
copy availability and the draft notice remain available inside the bottom
Listening options panel. Semantic book/chapter headings remain available to
screen readers; chapter headings are also retained when printing.

Playback controls are fixed to the bottom. Listening options open upward. The
chapter index and the end of the prose have clearance above the dock, including
when status messages or mobile wrapping increase its height.

The visible progress track occupies the bottom **3 CSS pixels**, across the page.
A transparent native range input gives it a **24-pixel interaction area** without
making the visible line thicker. It supports pointer dragging, touch, arrow keys,
Home and End, with a visible keyboard-focus indicator and an accessible label.

The range is chapter-local, not whole-book scroll progress. While idle it follows
the reading position. During playback or pause it follows the narration cursor;
manual scrolling does not silently seek audio or change the selected audio
chapter. Choosing a chapter in the index stops narration and resets the range to
that chapter. Stop returns the controls to the visible reading position.

Dragging pauses active narration once, previews the position, and resumes at the
selected whole word only on release. Seeking while stopped or paused does not
start audio. Canceled gestures leave playback paused. Stale speech callbacks
cannot resume an old queue. Seeking to 100% ends at this chapter's boundary,
without spilling into the next chapter; Play then restarts that chapter.

The timer is explicitly approximate (`≈ position / duration`). Its model is
chapter whitespace-delimited word count at 180 words per minute, adjusted by the
selected speech rate. Progress within that estimate uses the chapter's cumulative
text offsets. These are **not measured audio timestamps** or a claim about any
installed voice's exact speed. Progress updates on speech boundary and completion
events; engines without boundary events update at bounded-utterance completions.
No speculative wall clock is allowed to run ahead of the actual speech events.

## Verification

```sh
node --test reader/tests/speech.test.mjs reader/tests/progress.test.mjs
python reader/tests/playback_browser_test.py
```

The browser test requires Playwright and Chromium; `HUEY_READER_BROWSER` can name
a Chromium executable. It uses the actual client modules and CSS with in-memory
synthetic chapters and a mocked synthesis engine. It does not test network/Vite
transport, actual audible output, native VoiceOver or native browser zoom.

For this change, 23 Node tests and 10 Chromium tests passed. Checks include
chapter-local offsets, whole-word seeking, stale callbacks, paused/playing states,
chapter endpoints, title-only top geometry, the three-pixel bottom track,
320–1440-pixel viewport widths, pointer/keyboard/touch input, upward options,
scrollable long chapter indexes and evidence-dialog focus return. Initial tests
identified floating-point comparison tolerance, reserved-scrollbar-gutter hit
geometry and duplicate scroll offsets; those were corrected before the final run.

This is a partial, baseline-blob-checked workspace. A fresh repository clone failed
on GitHub DNS. The complete repository/content test suite, Vite install/build and
native audible speech were not run for this layout patch. Existing runtime and
native checks remain #315; paragraph evidence mapping remains #314. No manuscript,
source manifest or evidence data changed. No main promotion or deployment occurred.

## API references

- [Speech request properties and events](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance)
- [Speech character offsets](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisEvent/charIndex)
- [Slider keyboard interaction](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)

These are implementation references, not evidence for the book's claims.

Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.
