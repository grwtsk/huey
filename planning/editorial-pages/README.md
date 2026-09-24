# Editorial ReadingPage assembly v1

Bounded initial assembly for [#370](https://github.com/grwtsk/huey/issues/370),
with the first block ingestion increment of [#353](https://github.com/grwtsk/huey/issues/353).
The [editorial inventory](../editorial-inventory/README.md) remains the account of
known literary slots, source provenance and independent state dimensions. This
layer gives those slots persisted ReadingPage identities and ordered memberships.
**Complete editorial projection != public/admitted projection.** The result is a
derived working skeleton with some materialized text, not a complete manuscript.

## Commands and source of truth

```sh
node scripts/editorial_pages.mjs check
node scripts/editorial_pages.mjs emit > /tmp/huey-editorial-assembly.json
```

Both commands read the committed [plan](plan.json); neither allocates identities,
changes page boundaries, writes manuscript nor fetches external source stores.
The separate `init` command creates a plan only when none exists, using exclusive
file creation. It must not overwrite a plan or serve as routine regeneration.
Review a new plan before committing it. Generated output can contain already
authorized public manuscript text; it is not another editable prose source.

Markdown remains canonical prose. The plan is a human-reviewable metadata sidecar
with schema `huey.editorial-pages.v1` and parser profile
`huey.editorial-markdown/1`. It stores source references, assigned IDs, source
ranges, page memberships and order, never a second copy of the manuscript.
The derived assembly uses `huey.editorial-assembly.v1` and the existing
[`huey-literary-model/1`](../literary-entity-model.md) identity/version contract.
Its additive `frontMatter` field supplies the
[#349 front-matter contract](front-matter.md): first-page identity, the complete
front prefix, projected MatterUnits and the transition to Body. It preserves
pending slots independently of publication admission.

## Persisted identity, mapping and boundaries

Each plan source pins its inventory `sourceKey`, Git revision, path and blob.
Its ordered block records store `{id, kind, start, end}`. Each ReadingPage stores
`{id, slot, members}`; `readingOrder` and `unplacedOrder` store page IDs explicitly.
Every new entity ID is an opaque UUID v4 allocated once. Source coordinates,
paths, ordinal positions, equal text and route names cannot determine identity.
Two equal-valued paragraphs keep separate occurrence IDs.

Plan ranges are zero-based half-open **UTF-16** offsets into the exact Markdown;
they exclude each block's final line delimiter. Derived mappings additionally
report half-open UTF-8 byte ranges and one-based inclusive line ranges. Paragraph
inscription segments map exact copied source slices to text offsets; inline
syntax gaps and presentation annotations are explicit, not normalized prose.

The compiler reparses the pinned source and verifies its agreement with the plan.
Missing, overlapping, duplicated, misclassified or changed ranges are errors.
A changed source requires explicit reconciliation of its pin and mappings;
normal compilation does not infer a move, allocate replacements or silently
repartition. A reviewed reconciliation retains IDs of continuing occurrences.
Splits, joins and replacements need their own lineage treatment under #368.

Materialized Block and Paragraph states receive real `EntityVersion` values from
the existing model. Source mappings remain version-bound provenance. A path or
source-offset change alone does not redefine inscription. An ordinary text
revision retains the EntityID while changing its EntityVersion. Moving a retained
paragraph changes its owning sequence, not its unchanged local text version.
Git provenance does not become literary revision lineage or acceptance.

Initial partitioning groups at most sixteen source blocks per ReadingPage, in
source order. This deterministic initialization rule gives a reviewable starting
point; it is not a physical page size or a universal literary boundary. Stored
memberships govern later compilation. Changes to those memberships are explicit
editorial changes and alter the affected page versions without redefining their
member paragraphs. This increment provides no operation queue or boundary UI.

## Whole-work sequence and unplaced workspace

Every one of the inventory's 47 slots has a page representation. The canonical
sequence begins with fifteen pending front-matter units, continues through the
twenty-one body slots in `book.yaml` order, and ends with ten separate back-matter
units. The unplaced chapter has its own page sequence outside that reading order.
Pending matter is visible without inventing its prose or deciding its omission.

Literary ownership remains Work -> FrontMatter, Body, BackMatter, with Body ->
Movement -> Chapter. Preamble, Interlude and Excursion: Edna remain the three
movements. ReadingPages reference literary entities; they do not own them or
replace Chapter/MatterUnit identities. Materialized pages project their slot's
blocks. An unmaterialized slot is represented by reference to its existing
Chapter or MatterUnit, with its unresolved state visible through the inventory.

EditorialWorkspace/Unplaced remains a separate projection. It is not another
Movement, and assigning canonical placement later must preserve the unplaced
entity's identity. Assembly neither moves nor deletes any manuscript source.
The page sequence does not choose front-matter content: #34/#36/#7/#13 retain
those decisions and acceptance gates.

## Materialized and referenced sources

This increment materializes the inventory's four current canonical/unplaced public
sources: C08A, C14A, C14B, and The Place Beneath Pain. They yield 269, 827, 603,
and 212 source blocks, respectively. The remaining thirty-two candidate/support
artifacts stay explicitly referenced from the workspace and inventory with their
existing roles, exact pins and scope references. They are not silently adopted as canonical prose or used to
fill the other chapters. A candidate's availability can coexist with a canonical
placeholder and a restricted unmaterialized remainder.

The committed plan contains 151 ordered ReadingPages and 14 unplaced pages,
1,911 source blocks (1,859 Paragraphs and 52 generic Blocks), and 2,130 entity
records including the existing 54 inventory entities. These counts
describe the present source checkpoint, not final pagination or completeness.

Source selection follows the inventory's explicit canonical/unplaced roles and
availability. The compiler opens only selected authorized public sources. It
does not scan private stores, recover unavailable chapters, invent missing text
or emit restricted remainder bytes, locators or fingerprints. Missing permitted
source material must be visible as unavailable, never interpreted as omission.
Scope references record permission context; they are not authenticated grants.

When a selected source or its slot is unavailable, assembly skips its text access,
retains page memberships and IDs, and records unresolved blocks in
`unmaterializedEntities`. It never substitutes empty Paragraph states or invented
versions. `entityRecords` contains only known exact states. `modelValidation` is
`validated-snapshot` only when all selected sources materialize and the literary
model validates; otherwise it is `deferred-unavailable-source`. That partial
result preserves navigation metadata but is not a complete valid model snapshot.
Ownership validation still runs in this case; unavailable bytes cannot bypass
the strict Body -> Movement relation. The exported `buildAssembly` function
expects the inventory checker’s output; `loadAssembly` obtains it through
`loadInventory`. This layer does not implement a second inventory schema or a
permission engine.

Literary presence, editorial materialization, access and publication observation
remain separate. Changing the non-authoritative `publicationAnnotation` cannot
remove a slot, change page membership or confer admission/clearance. Existing
reader admission and evidence checks continue to govern publication separately.

## Parsing and compatibility boundary

Parsing is progressive: the initial profile identifies supported blocks and
paragraphs before sentence, lexical or grapheme decomposition. Exact source
mappings distinguish source Markdown from inscription. Unsupported structure
fails explicitly rather than being silently flattened or repaired. Generic
Markdown Blocks remain explicitly formatted Blocks; they are not falsely typed
as plain Paragraph inscription. A later refinement cannot silently change an
existing Block's kind to Paragraph under the same ID.

The bounded parser supports blank-separated paragraphs, ATX headings, thematic
breaks, standalone comment blocks, simple emphasis/strong/code spans and HTTPS
links. LF and internal CRLF are preserved without Unicode normalization. Lists,
tables, blockquotes, fences, embedded HTML, nested/unsupported inline markup and
hard-break syntax fail explicitly. Heading and separator Blocks retain raw
Markdown; Paragraph states contain inscription with supported delimiters removed.
Inline presentation stays in version-bound mapping metadata. Those source
coordinates are locators, not a new editable-grapheme boundary contract.

The existing reader compiler, admitted C08A source and evidence paragraph IDs are
unchanged. Those positional evidence IDs remain coordinates in their admitted
version; this assembly does not reassign them or transfer their evidence onto
new entity IDs. #352/#364 must review that compatibility mapping explicitly.
Current rendering is unchanged; no editorial UI, final routes or page traversal
is introduced by this command-line assembly.

ReadingPage means an authored editorial navigation unit. It is not a chapter,
file, viewport, sheet or TypesetPage. Responsive rendering consumes the persisted
sequence; fonts, wrapping and viewport height cannot regenerate identities or
memberships. A later typesetting projection may derive fixed-layout pages while
preserving literary and ReadingPage identities. Print dimensions, folios,
hyphenation and final physical pagination remain later work.

## Remaining work and limits of checks

#370 remains open for remaining whole-book source assembly; #353 remains open
for deeper ingestion and exact mapping/reconciliation work. The #349 front-matter
integration exposes the front-first entry contract without making pending content
decisions. #350 can bind routes, and #364 can integrate the editor while preserving
its independent publication projection. These are dependency interfaces, not
claims that their implementations or acceptance criteria are complete.

Tests check deterministic assembly, coverage, persisted identity, source bounds
and projection separation. Structural checks do not establish literary truth,
factual accuracy, source permission, evidence clearance, accessibility certification,
kernel admission or human acceptance. This engineering increment accepts no
manuscript, discloses no new source, promotes nothing to main, deploys nothing and
releases no edition. RF-01 and PR-01 remain controlling.
