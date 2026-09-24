# Reading and editing interface

> **WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.** The interface exposes only
> authorized material in the selected projection and its recorded status. It does
> not certify the book's claims. Local edits do not alter the admitted source.

Author: R.A. Jacob Martone. Staging branch: `pre-release` only.

The current architecture direction is a complete working book editor with an
independently governed publication projection. The [editorial inventory](../planning/editorial-inventory/README.md)
now records the whole known skeleton and authorized partial/unplaced material,
including content that is not reader-admitted. An opt-in [editorial traversal](../planning/editorial-pages/traversal.md) now renders
the persisted complete page sequence at `/huey`, including explicit placeholders
and a separate Unplaced sequence. This view is read-only while #364 retains the
editable migration. The default `/` experience below remains the independently
admitted editable copy. #370/#353 ingestion/reconciliation remain open. Source
authorization still applies to every projection.

## Current experience

The current author-directed pass is a minimal full-text editor built on the reader's
source-bound content pipeline. The manuscript itself provides orientation: there is
no persistent chapter rail, no fixed current-chapter title or mobile title chip,
and no sphere. The page retains a centered serif reading column, opposite-margin
paragraph/evidence references and a passive three-pixel reading-progress edge.

The fixed bottom toolbar intentionally contains only seven primary controls:

`Aa · B · I · U · color · link · light/dark`

`Aa` opens compact Selection and Document typography controls. Color opens compact
Text and Document color controls. Selection-level size is stored as a relative
`em` relation and selection color as an OKLab displacement from the document
foreground, so later document changes preserve local hierarchy rather than freezing
local pixels/RGB values. Document foreground and background remain a related pair;
light/dark exchanges their roles. Global palette changes use a gradual OKLab
transition and preserve readable rendered contrast.

The browser's native selection and caret are the editing geometry. The admitted
book DOM is locally `contenteditable`; formatting and prose edits are in-memory
presentation changes. Reloading restores the admitted source. No local edit updates
Markdown, evidence, source rights, claim dispositions, publication state or Git.
Paragraph evidence links always open the pinned admitted wording and state this
boundary explicitly.

The current pre-release allowlist still admits only **C08A, Baptism in the Color of
Rain**. Other chapter prose is not reconstructed or imported from private writing
packets merely to fill the interface. The layout automatically renders additional
chapters if they are later admitted by the existing content contract.

## Run locally

From the repository root, with Node 22.12 or newer in the 22.x line, or Node 24+:

```sh
git switch pre-release
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. `npm run build` prepares a static Vite bundle in
`reader/dist`; `npm run preview` serves that bundle at `http://127.0.0.1:4173`.
These commands do not deploy a site. The development server is loopback-only and
its root is `reader`, not the whole repository. No credentials or API keys are used.

Vite remains pinned to 8.1.0. A resolved lockfile is not yet established in the
recorded environment; #315 retains dependency/runtime verification. Do not claim
reproducible transitive dependencies or use `npm ci` until the lockfile has been
created and reviewed.

## Paragraph evidence collections

An opposite-margin paragraph reference opens the source/evidence collection for the
admitted source paragraph. Its address remains version-bound. The collection uses
the exact admitted paragraph, claim-level records, supporting/contrary/context
relationships, source locators and source-of-wording link. A local edit visible in
the editor does not rewrite that collection.

All current C08A claim mappings remain pending unless the evidence ledger says
otherwise. An empty claim array is not represented as evidence that no claims or
sources exist. #314 owns substantive mapping work.

`content/book.json` remains the explicit admission/version allowlist and
`content/evidence.json` the public claim/source ledger. `npm run content` validates
them and creates `reader/generated-public/data/book.json`. Changed chapter bytes,
stale annotations, unknown sources, unsafe links or unexpected fields fail the
build rather than silently substituting content.

Both Git branches are public. Restricted sources remain outside client bundles,
source maps, public folders and screenshots. Restricted metadata may use approved
opaque IDs, but this implementation does not activate an authenticated evidence
service or fetch external evidence automatically.

## Narration status

The browser SpeechSynthesis module and its unit tests remain in the repository, but
the author-directed minimal editor pass deliberately removes Play/Stop, voice,
rate, chapter-location and seek controls from the persistent interface. Narration
UI/runtime integration can be reconsidered after the editor/reading layout is
settled. #315 continues to track real Vite/Safari/macOS VoiceOver/system-voice
verification; a source module or mocked event is not audible output.

## Checks and known limits

```sh
npm test
npm run content
HUEY_READER_MEMORY=1 python reader/tests/browser_test.py
```

The browser test can run in memory when localhost navigation is unavailable. That
mode tests the exact HTML/CSS/client modules against the generated content but does
not establish Vite HTTP serving, native speech, VoiceOver, physical touch or other
browser engines. Run the real Vite build/server and native assistive checks when
the environment permits them.

Software checks establish source fidelity and implemented interaction properties;
they do not establish literary quality, factual truth, rights, accessibility
certification or finished-edition acceptance. No deployment, main promotion,
external contact, source replication or release follows from staging this reader.

## Editorial traversal

Use `npm run dev:editorial` on the assembly runtime (Unicode 17; tested Node
22.23.2), then open `/huey`. `npm run build:editorial` builds that explicit
projection locally; ordinary `npm run build` excludes its text payload. Previous/Next
links are native keyboard/touch controls; Alt+PageUp/PageDown also navigate.
At an edge, a fresh Alt press followed by continued outward scrolling may turn
one page. Ordinary scrolling never turns pages. Read the [traversal contract](../planning/editorial-pages/traversal.md)
for thresholds, source boundaries, exact-version limits and browser checks.

Each materialized editorial paragraph also has a stable **Current link** and an
**Exact wording** link. These retain paragraph identity when page membership
changes; a paragraph projected on multiple pages asks for a reading context.
Exact links never substitute a different current version. Where exact source
reconciliation exists, an Evidence link opens the existing pinned admitted
collection, which provides stable editorial links back in this explicit mode.
Unplaced material stays addressable without invented evidence mappings.

Read the [paragraph contract](../planning/routes/paragraphs.md) for current/exact
semantics, move/split/retirement behavior and evidence boundaries. Run
`npm run test:paragraphs` for the source bridge and
`HUEY_TRAVERSAL_URL=http://127.0.0.1:4173 python3 reader/tests/paragraph_browser_test.py`
against the built preview with Playwright installed. Ordinary publication builds
exclude both editorial traversal and paragraph-binding data.
