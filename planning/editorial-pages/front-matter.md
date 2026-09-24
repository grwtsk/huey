# Front-matter integration contract v1

[#349](https://github.com/grwtsk/huey/issues/349) integrates front matter into the
complete editorial sequence introduced by #370. `loadAssembly()` now includes
`frontMatter`, with schema `huey.editorial-front-matter.v1`. The read-only
`buildFrontMatter(assembly)` adapter consumes a checked assembly and emits only
structural references and inventory metadata. It opens no sources, copies no
inscription and assigns no identity. `pages:check` validates the contract;
`pages:emit` includes it in the existing derived assembly.

## Entry, ownership and order

| Field | Contract |
| --- | --- |
| `workId`, `frontMatterId`, `bodyId` | Existing literary entity IDs. FrontMatter and Body are parallel divisions owned by the Work. |
| `entryPageId` | The first existing ReadingPage in the complete editorial `readingOrder`, including when its matter is pending. #350 will bind `/huey` to this ID. No URL is assigned here. |
| `pages` | The complete contiguous front prefix, in persisted page order. Each descriptor contains `pageId`, its exact `pageVersion`, and ordered `matterUnitIds`. |
| `matterUnits` | Every expected front slot, in literary order, with its stable `entityId`, exact local `entityVersion`, label and independent inventory states. |
| `firstBodyPageId` | The immediately following ReadingPage in the complete sequence. It projects Body material, even if that material is a placeholder. |

Page members can reference MatterUnits or their owned descendants. The adapter
follows literary ownership to identify the projected MatterUnits; neither their
paths nor their labels determine identity. A page may project more than one unit,
and one unit may span successive pages. The adapter rejects missing, reordered or
noncontiguous front units, unknown/orphan members, mixed front/body pages and
workspace pages in canonical reading order. Pending front matter cannot be
skipped in favor of the first admitted chapter.

The current persisted plan deliberately retains its one-slot-per-page format.
Synthetic model-valid graphs exercise multi-unit pages at this consumer boundary;
general grouped-page authoring and reconciliation are not implemented here. No
plan, page ID, paragraph ID, source pin or page membership changes in this step.

## Presence is separate from materialization and publication

Each MatterUnit descriptor preserves these independent fields from the checked
inventory:

- `presence`: present, pending, omitted or absent;
- `editorialMaterialization`: the known full/partial/placeholder/unavailable state;
- `access`: available, restricted or unavailable-on-this-client;
- `publicationAnnotation`: non-authoritative working/staged/held metadata, always
  with `authoritative: false`;
- `observedReaderAdmission`: the independent observation from the current reader
  manifest; front units are currently `not-listed`.

`optional`, `omissionRef` and the existing work-issue references also carry through.
They do not authenticate a decision. The inventory remains responsible for its
schema, source scope and omission-reference checks; this adapter is not a second
inventory validator or a permission engine. Its input is a checked assembly,
including an explicitly partial assembly when source material cannot be loaded.

Omitted and absent slots retain their explicit editorial representation. This
does not require a blank page in a publication or typeset edition. Missing content
does not imply omission. Unavailable descendant IDs can still resolve through
known ownership without text access or invented Paragraph versions. Output contains
no source locators, source fingerprints or copied prose. The adapter cannot sanitize
an arbitrary untrusted graph; source access remains the upstream compiler's job.

## Current checkpoint and deferred content

All fifteen current front units are pending: half-title, frontispiece, title,
copyright/edition, dedication, epigraph, contents, figures list, tables list,
foreword, preface, acknowledgments, introduction, source note and advisory. They
occupy the first fifteen of the sixty canonical ReadingPages. The next page is
the C01 placeholder in Preamble, not the admitted C08A chapter. Fourteen unplaced
pages remain separate in the editorial workspace. These are existing editorial
boundaries, not final pagination or a claim of a complete manuscript.

There are no canonical front prose files at this checkpoint. #34/#36/#35 own
their content, #7 optional selections/omissions, and #13 acceptance; acknowledgments
placement remains provisional under #7/#59/#13. This work invents no title-page
facts, dedication, epigraph, foreword or other matter, and duplicates no movement
anchor. It changes no admission/evidence records and supplies no protected ending.

#370/#353 remain open for deferred ingestion and reconciliation, including adding
explicit canonical front/back source mapping when authorized files exist. Synthetic
present and partial MatterUnit graphs test this consumer interface; they do not
claim that the current source loader can already ingest future front Markdown.

The [#350 route contract](../routes/README.md) consumes entry, front-page and
body-transition IDs; #351/#352
consume the complete sequence and stable entities later. #366 can project contents
from these references without printed page numbers. #364 will connect the editor
while preserving the independent publication projection. The browser UI and its
current admitted-content compiler are unchanged in this increment.

A ReadingPage is an authored navigation unit, not a Chapter, Git file, viewport,
sheet or TypesetPage. Resizing and font metrics do not participate in this contract.
Later typesetting may derive fixed-layout pages without replacing literary or
ReadingPage identities. Markdown remains canonical prose; all emitted structures
are derived. Software checks establish structure, not literary truth, permissions,
human acceptance, evidence clearance, accessibility certification or kernel admission.
