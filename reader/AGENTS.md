# Reader implementation scope

Follow root `AGENTS.md` and `planning/pre-release.md`. Target `pre-release`; do
not promote the reader or manuscript to `main` as a side effect of UI work.

## Current author correction — minimal full-text editor

The active author instruction supersedes the earlier reader requirement for a
persistent gray-dot chapter rail and fixed current-chapter title. The reader now
uses the manuscript itself for orientation and the browser selection/caret as the
local editing instrument.

Keep:

- admitted prose in a centered serif reading column;
- opposite-margin paragraph/evidence references;
- a passive three-pixel reading-progress edge;
- one thin bottom toolbar with exactly the primary editing controls `Aa`, bold,
  italic, underline, color, link, and light/dark;
- typography and color details in compact popovers rather than duplicated global
  and local controls;
- local type/color as relations to the document basis so global changes preserve
  local hierarchy;
- the document foreground/background as one related palette whose roles exchange
  across light/dark presentation.

Do not restore a persistent chapter rail, top chapter-title bar/chip, sphere,
reader transport, location readout, or permanently expanded global-scope controls
without a later author instruction. The dormant speech implementation can remain
source-tested, but narration UI/runtime integration is deferred from this layout
pass rather than presented as working chrome.

## Access philosophy — Hs import

Read [the Huey access contract](../planning/access-philosophy.md) before changing
reader/editor interaction or presentation. It carries the Hs principle that the
interface belongs to the person using it: presence is not permission,
accessibility is a property of the reachable material rather than a warning after
failure, equivalent input must carry equivalent agency, density is the combined
burden of content and design, and advisory resistance must have a concrete reason
and yield when a permitted human choice remains.

Do not copy Hs's literal sphere, resting mark, WebGL interaction, `/apple`
routing example, or superseded separate intensity control into Huey. Huey's
current minimal reader remains the presentation surface. Apply the imported
principles to that surface: no dexterity tests, no hidden second effects, no
permission inferred from hover/dwell/cache/silence, no color-only meaning, no
density reduction that deletes qualifications, no fallback that loses state or
agency, and no conflation of local edit, navigation, evidence, source amendment
or publication. #357's Edna palette is one material instance of this contract.

## Source and access boundary

The later complete-working-editor direction (#347/#370) separates editorial
existence from publication admission. The [editorial inventory](../planning/editorial-inventory/README.md)
may account for all authorized public working material, partial/unplaced content
and explicit unavailable slots. The admission-only rules below govern the current
publication compiler and served projection; they must not make non-admitted
literary units disappear from the future editor. This inventory foundation does
not yet change served content or implement the editor migration (#364).

Preserve canonical manuscript bytes. Text served by the existing publication
projection must pass its explicit content allowlist and digest checks. Missing
chapters/claims remain missing in that projection; no
private-source discovery, upload, invented narration or evidence certification.
No raw medical files, secrets, protected ending previews, analytics, external
fonts, deployment configuration or replication activation belong in this app.

Local browser edits are a presentation/drafting layer only. They must not mutate
canonical manuscript bytes, evidence mappings, admission records, permissions or
publication state. Paragraph evidence collections continue to show the pinned
admitted wording and must make the local/source distinction explicit.

Use semantic controls, native selection and keyboard/touch access. Do not add a
brand or a how-to panel merely to explain the controls. Native forced colors and
reduced-motion preferences remain user-agent authority boundaries.

Run Node tests, content generation, actual Vite build when dependencies are
available, and browser checks. Distinguish in-memory/mocked tests from HTTP,
real OS voices and native screen-reader testing. Record actual limitations.
#314 owns substantive claim mapping; #315 owns outstanding dependency/runtime
and native narration checks. Neither is resolved by a successful editor/layout
test.
