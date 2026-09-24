# Huey route grammar v1

[#350](https://github.com/grwtsk/huey/issues/350) freezes addresses and metadata
resolution over the complete editorial sequence. It consumes the #349 front-matter
contract. The default browser view retains its admitted-content/hash-route implementation.
The later [#351 traversal adapter](../editorial-pages/traversal.md) consumes this
grammar in an opt-in editorial build, without redirecting an origin or fetching
private sources.

## Addresses and canonicalization

`EntityID` is the exact lowercase `he_` UUID v4 from `huey-literary-model/1`.
`EntityVersion` is the exact lowercase `hev1:` plus 64 hex digits. A slug consists
of lowercase ASCII letters/digits separated by single hyphens, at most 64
characters. These are deliberately narrow address spellings, not restrictions on
literary titles or inscription.

| Address | Target |
| --- | --- |
| `/huey` | The selected projection's first ReadingPage; editorial entry is exactly `frontMatter.entryPageId`. |
| `/huey/entity/{EntityID}` | Any concrete literary entity's stable address. |
| `/huey/page/{EntityID}` | A ReadingPage; wrong-kind IDs do not resolve. |
| `/huey/paragraph/{EntityID}` | A Paragraph; independent of position, owning chapter and page membership. |
| `/huey/front/{slug}` or `/huey/back/{slug}` | Explicitly bound MatterUnit alias. |
| `/huey/chapter/{slug}` | Explicitly bound Chapter alias. |
| `/huey/unplaced/{slug}` | Alias initially assigned to workspace material, retained after later placement. |
| `/huey/page/{slug}` | Explicitly bound ReadingPage alias. |
| Any non-entry address plus `/v/{EntityVersion}` | The exact local state of that target. |

`/huey` is a real entry address and **does not redirect** to the stable page URL or
the first admitted chapter. A caller needing to pin its current first page uses
that page's stable ID address, optionally version-qualified. `/huey/v/...` is not
part of this grammar. Entry and permanent page addresses have different purposes;
neither creates another page identity.

Canonical entity addresses use `/page/` for ReadingPage, `/paragraph/` for
Paragraph, and `/entity/` for other kinds. Known readable aliases resolve to the
same target and return that canonical destination. A generic `/entity/` address
for a Page or Paragraph likewise canonicalizes to its typed form. Every version
qualifier survives canonicalization. One trailing slash is accepted and removed.
No case folding, Unicode normalization, percent decoding or speculative slug
matching occurs. Unknown aliases are unknown; a current title is not an alias.

The parser accepts a raw origin-relative address of at most 512 characters. It
rejects all absolute/protocol-relative URLs, backslashes, controls, non-ASCII,
percent encodings, repeated slashes, dot segments, queries and fragments. This
includes projection/redirect parameters. Validation happens before any URL-parser
normalization. A formatter or resolver only produces an origin-relative path from
validated IDs and versions; it cannot produce an external redirect destination.

`redirectTo` is a canonicalization instruction for a later adapter, not an executed
redirect. A future HTTP adapter may use a same-origin 308 for these durable aliases
and spelling corrections, except `/huey` itself. It must preserve the exact-version
suffix and retain the selected projection's independent access checks.

## Persisted readable bindings

[bindings.json](bindings.json), schema `huey.route-bindings.v1`, binds 90 explicit
paths directly to existing IDs: one literary-unit alias and one initially selected
page alias for each of 45 inventory slots. The other pages are already addressable
by stable ID. For example, `/huey/front/half-title` names the MatterUnit and
`/huey/page/front-half-title` its current initial page. They remain distinct targets.

These initial spellings were assigned using public inventory keys. They are now
persisted metadata, not an algorithm rerun on titles, ordinal positions, paths or
reflow. A page alias that was initially assigned to a slot's first page keeps that
page ID if order changes. `/huey` alone follows the explicitly selected entry-page
contract. Changing placement never regenerates paragraph or page identity.

A rename adds a new alias and retains old bindings to their original IDs. Removal,
retargeting and collisions fail `assertAliasContinuity(previousAliases, nextAliases)`.
Aliases point directly to entities, not other aliases, so chains/cycles are not
representable. Alias families constrain target kind, not its current owning
division. A retained `/unplaced/` alias still works when its Chapter moves into
Body; a retained `/front/` alias still names the same MatterUnit after a reviewed
move to BackMatter. Current placement comes from the selected projection, not an
old URL spelling. Retirement/redirect policy for a no-longer-selected entity remains
explicit later lineage work; dropping the target cannot silently reuse its route.
The checker accepts an exact baseline Git commit and compares its bindings. CI
supplies the PR base or previous staging head. Git is only the source of the prior
metadata here, not authenticated permission or literary revision lineage.

## Selected projection and outcomes

The resolver consumes `huey.route-projection.v1`, a strictly checked metadata table:
`projection`, `entryPageId`, `targets`, `slots` and `aliases`. No URL can select a
more privileged table. The editorial builder uses the checked complete assembly;
it does not filter on reader admission. A future publication adapter must supply
its own independently governed table. Merely setting `projection: publication`
does not authenticate a grant or decide admission.

Each target carries ID, kind, selected local version (or null), access observation,
an unresolved flag, all candidate page IDs and related slot IDs. Slot descriptors
retain independent presence, editorial materialization, access, non-authoritative
`publicationAnnotation` and `observedReaderAdmission`. The unresolved flag summarizes
missing/pending material for navigation; it does not replace those dimensions.
Validation rejects a target access observation weaker than a related slot's, or
an unresolved flag that conceals a pending/absent/placeholder slot. These are
internal metadata consistency checks, not authenticated source permissions. A
registered slot's target must reference its own slot metadata; detaching that
reference cannot evade the checks.
Container records with no slot context describe their known local structure, not a
claim that all descendant prose exists or is admitted.

Resolution never reads inscription, titles, source mappings, locators or source
fingerprints. Returned descriptors contain only these whitelisted fields. They
describe known access/materialization; neither the table nor a valid route is a
permission engine. The table's producer must already enforce its source boundary.

| Status | Meaning |
| --- | --- |
| `invalid-route` | Address outside the grammar; no input echo. |
| `unknown` | Target/alias absent from the selected projection, or typed ID has the wrong kind. This does not query a broader/private inventory. |
| `restricted` | Known target's access observation is restricted; no entity version is returned. |
| `unavailable` | Known target is unavailable on this client or lacks a selected exact state; no invented state is returned. |
| `version-unavailable` | An accessible target's requested exact version is absent; no fallback to its current version. |
| `unresolved` | Accessible known structure has unresolved material, or the selected projection has no entry page. |
| `resolved` | Selected accessible local entity state is available. This is not literary or publication acceptance. |

Restriction/unavailability is reported before version comparison; exact-version
comparison precedes an unresolved result. Denied and version-unavailable outcomes
return no selected version. Current pending front slots have unavailable-client
access as well as pending presence: `/huey` still identifies their first page and
reports both conditions instead of disappearing or jumping to C08A. Omission
remains an explicit presence value in slot metadata, never inferred from a route.

The resolver selects only the versions in its supplied table. It does not fetch
an archive. A historical reference needs a separately selected, permitted snapshot;
a hash alone supplies no content or authority. Chapter/ReadingPage EntityVersion
pins local ordered references, **not descendants' exact prose**. Historical whole
page rendering must select the corresponding descendant versions separately.

`pageIds` preserves all candidate pages in the selected canonical-then-workspace
order. A paragraph projected more than once has multiple candidates; the resolver
does not silently pick one. Workspace pages stay outside canonical reading order.
These candidates always describe the selected table, including on a version miss;
they do not reconstruct the requested historical placement.
No fourth movement, ownership change or page/Chapter equality is introduced.

## Browser history and compatibility

The parser/resolver is pure: no `window`, location/history mutation, fetch, storage,
scrolling or focus changes. #351/#364 must implement this history contract:

- A deliberate navigation adds at most one history entry after resolution.
- Canonicalization of an existing address replaces that entry rather than adding
  a second alias entry. An exact-version qualifier cannot be dropped.
- Back/Forward (`popstate`) reads and renders the browser's selected address;
  it never pushes an entry or substitutes an internally remembered page.
- Unknown, denied or unavailable destinations are explicit outcomes, not a reason
  to rewrite history to the first admitted chapter.

The #351 adapter implements page-level browser history in the opt-in editorial
view. Paragraph focus and legacy evidence reconciliation remain #352/#364. Pure
resolver tests establish only the absence of side effects; separate real HTTP
Chromium checks exercise the traversal adapter with their stated native limits.

Existing `#chapter/{legacy-id}`, `#read/{legacy-id}/{ordinal}/{Git-blob}` and
`#evidence/{legacy-id}/{ordinal}/{Git-blob}` routes and the `#book` anchor retain
their existing reader behavior. Their 40-hex Git blob is **not** EntityVersion;
their ordinal is **not** stable paragraph identity. #352/#364 must reconcile exact
legacy chapter/blob/ordinal/raw-paragraph-hash references explicitly. No hash route
is imported as an alias here, and `E01` is not silently equated with reader `EX`.

## Checks and next consumers

`npm test` includes grammar/resolver fixtures on the reader's supported Node range.
`npm run test:routes` checks real editorial metadata and integration using the same
Unicode-17 runtime required by assembly. `npm run routes:check -- <exact-base-sha>`
also checks alias continuity; without a baseline, it reports that limitation.
`npm run routes:emit` emits derived metadata only. No new prose master is created.

#351/#352 consume this grammar for traversal and permalink runtime; #366 consumes
links for contents; #367 retains origin/deployment work. #370/#353 remain open for
deferred ingestion and reconciliation. No UI migration, private service, kernel
runtime/authority integration, main promotion, deployment, edition release or
typesetting occurs. ReadingPage remains authored navigation, separate from later
TypesetPage. Software checks certify neither source authority nor literary truth.
