# Reader content contract

This directory contains public-authorized metadata and, only when explicitly
configured, immutable snapshots of already admitted public bytes under `admitted/`. A schema check proves
consistency, not permission, historical truth or editorial clearance. Reuse claim
and source IDs from existing research ledgers; do not create independent-looking
copies of the same source to inflate corroboration.

## Chapter admission

`book.json` lists chapters in reading order. Each has `id`, `label`, `title`,
`movement`, `status` and `workIssue`. An unavailable entry has no prose path.
An admitted chapter additionally requires:

- `path`: a named Markdown file under one of the three manuscript movement folders;
- `blob`: its exact Git blob SHA; `revision`: the commit containing those bytes;
- `admission`: the original scoped public-copy receipt; `mappingIssue`: evidence work.

Read the actual author instruction, not merely an agent-transcribed receipt.
Change the status and version only when the corresponding source is admitted.
Do not bulk-import a private manuscript, attached clinical PDFs or a research
branch. The compiler does not search for files or infer approval from their names.

The supported prose syntax is one title, paragraphs, emphasis/strong, inline code,
HTTPS links, level-two through level-four headings and scene separators. Unsupported
structural Markdown fails rather than silently dropping a table, list or quotation.
Plain HTML-like text is rendered as text, never executed. More complex material
requires an explicit parser extension and source-fidelity tests.

## Paragraph identities

Only prose paragraphs receive ordinals, reset within each chapter. The stable
chapter label `8A` produces display labels `8A:1` through `8A:260` in the present
copy. Data IDs such as `C08A-p0001` identify positions **within a pinned chapter
version**. They are not immutable IDs across arbitrary text edits.

Generated blocks expose `raw`, `text`, `tokens`, `startLine`, `endLine`, `sha256`,
`sourceUrl` and their identities. The paragraph SHA-256 covers the raw Markdown
paragraph; the chapter Git blob covers the complete canonical file bytes.
URL references include the complete chapter blob, and an incompatible version is
reported instead of redirected to another paragraph. Before changing paragraph
order or wording, rebind/review the affected ledger; do not silently reuse hashes.

## Source and claim records

`evidence.json` has `schemaVersion: 1`, `sources: []` and `paragraphs: {}`.
Each source needs `id`, `title`, `kind`, `access`, `url` and `description`.
`access` is `public` with an HTTPS URL, or `restricted` with a null URL. Only
already authorized public-safe restricted metadata may be included. There is no
backend credential or secret-locator field and no private PDF-serving endpoint.

Each paragraph annotation is keyed by its generated ID and contains:

| Field | Meaning |
|---|---|
| `sha256` | Exact raw paragraph digest from the generated block. Stale hashes fail. |
| `coverage` | `pending`, `partial`, or `complete`; this describes mapping coverage, not truth. |
| `claims` | Every mapped material assertion, independently of whether it is supported. |
| `referenceIds` | Other source IDs relevant to the paragraph; not automatically supporting evidence. |
| `reviewNote` / `reviewRef` | Required for a complete mapping; actual rationale and review reference. |

A claim record requires `id`, `wording`, `kind`, `disposition`, `issue`, `links`
and `limits`. `wording` must be an exact substring of the paragraph's plain text.
One sentence can require several claim records. Metaphor and personal reflection
must not be converted into invented assertions merely to fill a checklist.

Allowed kinds: `testimony`, `received-record`, `fact`, `analysis`, `metaphor`,
`reflection`, `unknown`. Allowed recorded dispositions: `unreviewed`,
`supported-fact`, `attributed-account`, `analysis`, `hold`. These are declared
review states, not automated findings; the pre-release human decision remains
separate. `supported-fact` requires at least a supporting link, but that structural
requirement does not independently assess the source or reviewer.

Each claim link contains `sourceId`, `relation`, `locator` and `note`. The relation
is `supports`, `contradicts` or `context`. Keep precise source page/section/line
locators and explain the relationship and limits. The UI groups these relations
separately rather than counting citations as votes. A source-of-manuscript link
is generated separately; it cannot stand in for corroboration of narrated events.

Absent annotations generate explicit pending collections. Unknown source IDs,
orphan paragraph IDs, unexpected fields, unsafe URLs and stale digests fail
compilation. The current ledger intentionally has no invented evidence entries;
complete coverage is tracked in #314. The source and its current presentation
remain distinct throughout the journalistic review process.

## Historical admitted snapshots during working edits

A working-source edit does not renew admission or inherit evidence. An admitted
manifest entry may add `snapshotPath`, exactly
`reader/content/admitted/<its-existing-blob>.md`, to retain its original admitted
bytes. This file is a content-addressed, noncanonical publication input, never a
second editable prose master or an independent evidence source. Keep the original
`path`, `revision`, `blob`, `admission`, `mappingIssue` and exact evidence ledger.

The compiler requires an exact regular, non-symlink path, exact blob and valid UTF-8.
A missing or mismatching configured snapshot fails closed, with no working-file
fallback. Without `snapshotPath`, the original working-file digest guard is
unchanged. Repeated edits preserve the existing historical snapshot. The compiler
still emits only the same admitted content; `snapshotPath` is not added to the
release payload or used as the historical source URL.

The working-source path/blob no longer matches the admitted pin after an edit, so
paragraph bindings must remain absent for the new working source until separately
reviewed. Old evidence stays attached to old admitted bytes only. Chapter-level
`observedReaderAdmission` is a manifest observation, not acceptance of the new
working blob. Preparing a snapshot does not grant disclosure, editorial acceptance,
main promotion or release. Any new public source batch must pass its actual
exact-payload authorization before the first Git object upload.
