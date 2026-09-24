# Complete working editorial inventory v1

Foundation for [#370](https://github.com/grwtsk/huey/issues/370) and the scoped
ingestion work in [#353](https://github.com/grwtsk/huey/issues/353), within #347.
Author direction recorded 2026-09-23: Huey is primarily a complete working book
editor that is also pleasant to read. **Complete editorial projection !=
public/admitted projection.** Incompleteness must remain visible to the editor.

The [registry](registry.json) and [checker](../../scripts/editorial_inventory.mjs)
account for the known book without copying its prose into JSON. This is an
inventory foundation, not the assembled editor, a complete manuscript, or a
`huey-literary-model/1` entity snapshot. Markdown remains canonical prose.
Generated inventory output is derived and has no editing authority.

## Use and identity

```sh
node scripts/editorial_inventory.mjs check
node scripts/editorial_inventory.mjs emit > /tmp/huey-editorial-inventory.json
node --test tests/editorial-inventory.test.mjs
```

The commands operate locally and never fetch source stores or mutate manuscript.
The registry allocates 52 opaque UUID v4 EntityIDs once: seven literary containers
and 45 known literary units. IDs follow #348; they are not regenerated from a
title, path, order, source hash or legacy chapter label. The registry is a small
identity/state sidecar, not a production allocator or a second prose master.
Retain IDs when metadata, paths, placement or inscription changes. A later
allocation, retirement or alias reconciliation must be explicit and reviewed.

`entityVersion: null` means inscription/structure has not yet been compiled into
the exact local state required by #348. Do not treat it as a valid `hev1` value.
The inventory's own digest identifies its metadata output only, not a manuscript
revision, acceptance, source truth or permission. #353 must supply real paragraph
identities and source mappings before paragraph editing can rely on this graph.

`book.yaml` remains authoritative for current body order, movement, legacy labels
and canonical Markdown paths. The checker requires exact coverage of its items,
including `include: false` items. It also requires classification of every tracked
manuscript Markdown file. Explicit support paths are the six existing structural
READMEs; any new manuscript file must be accounted for before the check passes.
Missing files remain known slots, with visible unavailable state. They never turn
into omission. Untracked files are outside this public-source inventory.

## Four independent dimensions

| Dimension | Values and meaning |
| --- | --- |
| Literary presence | `present`, `pending`, `omitted`, `absent`. A known body division is present even when its prose cannot materialize. Pending optional matter is not an omission decision. |
| Editorial materialization | `full`, `partial`, `placeholder`, `unplaced`, `unavailable`. Derived from the represented sources and their availability; full means a full selected working artifact, not finished/accepted prose. Candidate fragments do not complete the canonical chapter. |
| Access/materialization | `available`, `restricted`, `unavailable-on-this-client`. Available public fragments can coexist with restricted unmaterialized remainder; `unmaterializedAccess` preserves that second fact. These are descriptive observations, not a permission engine. |
| Publication annotation | `publicationAnnotation: {label, authoritative: false}`. The descriptive label is only `working`, `staged` or `held`; it grants nothing. Reader admission is observed separately, and human clearance is not represented by this inventory. |

`publicationAnnotation` is explicitly non-authoritative editorial metadata. Its
exact shape and boolean `false` marker are required; `admitted` and `cleared`
are rejected as labels. C08A is labeled `staged` here, while its separate
`observedReaderAdmission` remains `admitted` from `reader/content/book.json`.
Changing an annotation cannot change that observation or an entity's existence.
The observation reports only a manifest value (`admitted`, `unavailable`, or
`not-listed` when absent); it does not independently validate permission, source
bytes or evidence clearance. The existing publication compiler keeps those
checks. Actual human clearance requires the separately governed exact-version
review; this inventory cannot create or represent that decision.

Each public source's `scopeRefs` lists issue/PR pointers to the recorded scope.
A URL, agent transcription or matching digest is not an authenticated Instruction,
Grant or authority capability. The checker validates reference shape and local
artifact identity, not the authenticity or sufficiency of permission. Consumers
must not convert these references or publication annotations into authorization.
Source-aware review of the underlying instruction and revocation context remains
necessary; no permission engine or Construct authority bridge is implemented.

The unmerged v1 draft now rejects the earlier `source.authority` and bare
`publication` fields, including when supplied alongside their replacements. This
pre-merge correction changes no EntityID, source pin or literary EntityVersion.

All actual optional units remain pending. No omission is invented. The checker
requires an explicit omission reference for an optional unit recorded as omitted;
it cannot authenticate the human decision behind that reference. A missing source
does not supply one. Public source metadata is strict and allowlisted; restricted
remainder has no private locator, fingerprint, excerpt or payload field.

For example, C15 has a canonical comment-only file, available partial public
candidates, and a restricted unmaterialized remainder. C08A has one current
canonical source plus a separately identified alternate proposal. Neither the
alternate nor equal source text creates another C08A literary entity. C02, C03,
C07 and C12 have partial public proposals from an older copy; those proposals are
unapplied and cannot stand in for their complete current chapters.

## Structure and editorial workspace

The derived structure is Work -> FrontMatter, Body, BackMatter, with **Body ->
Movement -> Chapter** for every manifest slot. The movements remain Preamble,
Interlude and Excursion: Edna, in that order. There is no fourth movement.

Front matter has fifteen pending units in a provisional editorial order, starting
with half-title, then frontispiece if selected, title, copyright, dedication,
epigraph, contents, figure/table lists, foreword, preface, acknowledgments,
introduction, and the source-note/advisory slots. This is a preparation sequence,
not approved pagination or a new content decision. Acknowledgments is one optional
unit with provisional front placement; #7/#59/#13 can change its placement while
retaining its identity. Ten separately marked back-matter units cover the known
reference/packaging categories. Back matter is not an explanatory epilogue.

`EditorialWorkspace` and `Unplaced` are projection groupings outside literary
ownership. The workspace references the independent EntityID of **The Place
Beneath Pain** and the authorized supporting resources. Canonical placement is
still #344/#345; moving the chapter later preserves that ID. Source essays,
matrices, indices and unapplied proposals are resources, not extra chapters or
automatically adopted passages. The inventory does not destructively move files.

## ReadingPages come next; typesetting comes later

```text
authorized Markdown -> literary structure -> ReadingPage
                                         -> responsive rendering -> TypesetPage
```

A ReadingPage is an authored/editorial navigation unit. It is not a chapter,
file, viewport, sheet or result of font metrics. #370 will instantiate an ordered
sequence, with #349 integrating front matter at its beginning. Initial body
partitions should be deterministic at block/paragraph boundaries. Once created,
page IDs and boundaries persist; explicit editorial operations change them.
Browser resize or text reflow must not repeatedly repartition the work.

This PR creates no ReadingPage IDs, route grammar, partition algorithm or page
splitting UI. #350 follows the page contract; #351/#352 implement traversal and
paragraph links. Deeper #353 work refines Block -> Paragraph -> Sentence ->
LexicalOccurrence -> GraphemeOccurrence progressively. Whole-book rendering must
not wait for exhaustive linguistic analysis. Final page dimensions, fonts,
leading, measure, folios, running heads, widow/orphan rules, hyphenation and print
breaks remain later typesetting under #60/#61; they cannot redefine identity.

## Source audit and compatibility

The [source audit](source-audit.md) records the exact inspected staging and public
branch revisions. The registry pins 34 public source/candidate/resource artifacts
with their recorded `scopeRefs`. These links preserve provenance;
they do not authenticate authorship, accept a proposal or grant further access.
No source prose is embedded in generated output. Missing Git objects on another
client are explicitly unavailable there; the tool performs no network retrieval.

The current canonical tree has nineteen body slots: one full C08A file and
eighteen comment-only files. It also has one unplaced chapter. Public partial
candidates and authorized branch resources remain separately identified. The
inventory is complete for the declared manifest/tree boundary, not every possible
source, every private revision, or an already assembled complete book.

Current canonical-file checking covers manifest chapters and the unplaced
manuscript. Front/back units have no prose files at this checkpoint. #349 must
extend their explicit source mapping when such files are introduced; adding a
file without classifying it fails coverage rather than silently ingesting it.

The existing `reader/scripts/content.mjs`, `reader/content/book.json` and evidence
ledger are unchanged. C08A's pinned admission, 260 positional paragraph records
and raw paragraph digests retain their meanings. Legacy `E01` (book) and `EX`
(reader) are recorded as distinct namespace spellings; this inventory does not
install a route alias or rewrite evidence IDs. #352/#364 must review compatibility
when new paragraph identities replace version-bound ordinal locators.

#364 must consume the editorial inventory for authoring while keeping publication
selection separate. A staged/public working source need not be reader-admitted
to exist in the editor. This foundation deliberately leaves the current usable
reader UI unchanged; the UI still serves only its existing admitted chapter.

## Dependency and review boundary

Before implementation, #370 was created and #347/#349/#350/#351/#352/#353/#364/#366
were updated with the author's direction. The earlier issue bodies remain labeled
superseded history. These are textual dependency links, not native GitHub objects.
#348 is complete through PR #369. The immediate sequence is scoped #353 ingestion
-> #370 whole-book assembly -> #349 front matter -> #350 routes -> #351/#352.
Inventory-only work does not complete #370 or #353. Existing #34/#36/#7/#13 own
front-matter content and acceptance. No such decision is duplicated here.

Tests establish coverage, independent states, deterministic metadata and scoped
source handling. They do not establish literary correctness, factual truth,
evidence clearance, access grants, accessibility certification, kernel admission
or human acceptance. RF-01 and PR-01 remain controlling; no private prose,
protected ending, source disclosure, main promotion, deployment, release or
unattended continuation is part of this foundation.
