# Reading and listening interface

> **WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.** The interface exposes the
> verification status of the admitted text; it does not certify its claims.
> Not medical/legal advice or adjudicated findings.

Author: R.A. Jacob Martone. Implementation: #313. Branch: `pre-release` only.

## Run locally

From the repository root, with Node 22.12 or newer in the 22.x line, or Node 24+:

```sh
git switch pre-release
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. `npm run build` prepares a static Vite bundle in
`reader/dist`; `npm run preview` serves that bundle at `http://127.0.0.1:4173`.
These commands do not deploy a site. The development server is bound to loopback;
its root is `reader`, not the whole repository. No credentials or API keys are used.

Vite is pinned to 8.1.0. **A resolved lockfile is not yet available:** this
implementation environment could not reach the npm registry. The first successful
installation must produce a lockfile for inspection and a separate staging commit
under #315. Do not claim reproducible transitive dependencies or use `npm ci` until
that lockfile exists. No dependency audit or completed Vite build is claimed here.

## Reading layout

Admitted chapters render consecutively in one centered, serif column. Paragraph
numbers in the opposite margin use the established chapter labels, such as `8A:1`.
Headings and scene separators do not consume paragraph numbers. The manuscript
itself is not modified, and paragraph IDs are version-bound rather than presented
as final print numbering.

The chapter index stays at the right edge beside the scrollbar. Inactive entries
are gray dots; hover or keyboard focus reveals their chapter titles. The current
chapter title stays expanded as the reading position changes. On narrow screens,
its expanded title moves to a bottom-right chip so the prose keeps usable width.
The dots remain available for touch and keyboard navigation. Missing chapters have
hollow dots and open an availability notice, not fabricated narrative.

The included copy contains the complete, unchanged **Baptism in the Color of Rain**
(C08A): **260 paragraphs and eight scene breaks**. Its first `netch asheba` and later
`netch` are preserved. Other chapters are listed from the working order but have no
public manuscript payload here. See #308/#309 and `manuscript/README.md`. Adding
other private chapters is not authorized merely by installing this reader.

## Browser narration and VoiceOver

Play starts at the visible paragraph. Pause, Resume and Stop operate on a bounded
utterance queue; speech advances through the actual prose, not paragraph numbers,
UI notices, evidence panels or index labels. Long paragraphs are split without
losing text. Cancelled/stale events cannot restart a stopped queue. Narration stops
at an unavailable chapter instead of silently jumping across a gap.

Listening options select the voice and speed (0.6–1.8×). Only voices the browser
reports as on-device are eligible by default. Online voices require an explicit,
non-persisted opt-in and may send text to the browser's speech provider. There is
no application-operated speech service, microphone request, voice cloning,
analytics, external font request or autoplay. Browser voice classification is not
an independent audit of an operating system or vendor.

Pause cancels the current utterance, keeping the last reported word boundary.
Resume can repeat the last word, or the current short phrase when the engine does
not report boundaries. Voice or speed changes pause playback. Optional following
scrolls to the spoken paragraph; manual scrolling turns following off. Opening an
evidence collection pauses playback and does not automatically resume it.

Apple **VoiceOver is a separate screen reader**, not an API this page switches on.
The interface uses semantic headings, navigation, links, labeled controls and a
keyboard-operable dialog for VoiceOver and other assistive technology. Leave the
browser player stopped when using the screen reader's own continuous reading to
avoid competing speech. Actual native VoiceOver and audible speech verification
remain #315; headless mock events are not an audio test.

## Paragraph evidence collections

A margin number opens a collection, not merely a scroll anchor. Its address has
the form `#evidence/C08A/1/<chapter-git-blob>`. The collection contains the exact
paragraph, claim-level records, supporting/contrary/context relationships, source
locators, additional references, review limits and a separate source-of-wording
link pinned to a Git commit and line range. It includes a paragraph permalink,
copyable evidence link and Read from here. Escape/Close returns focus to the
originating link. Reloading an evidence link reopens its collection.

**All current C08A claim mappings are pending.** The reader displays that fact for
every paragraph. It does not manufacture sources, call the manuscript independent
corroboration, or interpret an empty claim array as evidence that no claims exist.
#314 tracks the complete claim-to-evidence mapping. The data model and renderer
already support populated collections; missing research is not hidden by the UI.

`content/book.json` is the explicit admission/version allowlist.
`content/evidence.json` is the public claim/source ledger. See
[the data contract](content/README.md). `npm run content` validates them and creates
`reader/generated-public/data/book.json`. A changed chapter hash, stale annotation,
unknown source, unsafe link or unexpected field fails the build. A failed refresh
removes the old generated JSON so it cannot masquerade as the new copy.

Both Git branches are public. Restricted sources remain outside client bundles,
source maps, public folders and screenshots. Restricted metadata may use approved
opaque IDs, but this implementation does not activate an authenticated evidence
service or invent access links. A source link is only an outbound reference; the
reader does not fetch external evidence automatically.

## Checks and known limits

```sh
npm test
npm run content
python reader/tests/browser_test.py
```

The Python browser tests require Playwright and Chromium. Set
`HUEY_READER_BROWSER` to a Chromium executable when needed. In an environment that
cannot navigate to localhost, `HUEY_READER_MEMORY=1 python
reader/tests/browser_test.py` tests the DOM with an in-memory loader. That mode
inlines the same client modules, mocks content transport and speech, and performs
no HTTP/Vite or audible-output verification. Synthetic multi-chapter fixtures are
test-only and do not become book content.

The initial pass ran 29 Node tests and ten in-memory Chromium tests. They cover
source fidelity, numbering, stale references, unsafe links, evidence-schema
failures, speech cancellation/queueing, focus handling, chapter navigation, actual
single-chapter and synthetic multi-chapter rendering, and widths of 320–1440 px.
Screenshots were inspected separately. Some navigation timing and focus issues
were corrected before the successful rerun. This is not a WCAG certification.

Actual `npm install` failed with registry DNS `EAI_AGAIN`; `npm run build` reached
the content prebuild but could not launch the absent Vite executable. Chromium
localhost navigation was blocked by this environment's administrator policy.
The repository-wide Python suite was not run: this was a partial, blob-verified
source workspace, not a complete checkout. Remaining runtime/native checks are
#315. No hosted Actions, public deployment, main promotion or release occurred.

## Technical references

- [Vite installation and Node requirements](https://vite.dev/guide/)
- [Vite 8.1 announcement](https://vite.dev/blog/announcing-vite8-1)
- [Browser speech synthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)
- [Available voices and delayed voice loading](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices)
- [Local versus remote voices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService)
- [VoiceOver web commands](https://support.apple.com/en-lb/guide/voiceover/vo27972/mac)

These implementation references are distinct from evidence for the book. The
journalistic promotion policy in `planning/pre-release.md` remains unchanged.
