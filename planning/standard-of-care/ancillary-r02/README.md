# Ancillary source review — SOC-T02

> [!WARNING]
> **WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.** This pass verifies selected source bytes and records what the source says. It does not independently establish clinical causation, legal responsibility, visual contents, service availability, or the truth of a copied verification label. The original words remain separate from these editorial findings.

Author: R.A. Jacob Martone. Work: [#188](https://github.com/grwtsk/huey/issues/188). Parent transfer: [#126](https://github.com/grwtsk/huey/issues/126). Existing approval: SOC-PUBLIC-01. This is work in Huey, not a change to the Neurology website.

## Source-derived findings

Five **complete JSON files** are copied from `grwtsk/neurology@c920e426b8b6753b9f4bacf019e48010e57918c2`. Their 24,200 combined bytes reproduce their five original Git blob identities. Unlike the twelve earlier authored-text exports, these copies retain all presentation units and metadata in the selected files.

- **Discipline And Punish** is an audio/composition record, not the quotation described by the earlier title-only inventory. It attributes the composition and album *Violence* to the author, links to SoundCloud, and explicitly distinguishes the event date from a composition date. Duration remains null. The audio itself is not copied or listened to by this pass.
- **Neurology Cannot Undo the Harm** retains `type: article`, `visibility: restricted`, and `status: published`, while its source identifies an author-authored quotation. These are different source fields, not an inconsistency to repair by changing the original. SOC-PUBLIC-01 authorizes this public copy without rewriting the historical visibility field.
- **On Dignity** remains `templateOnly: true`, `status: preview`, with null publication/update dates. Its Atlas target is preserved exactly, including `atlas-heading-dignity`. The renderer mapping is not yet inspected; a semantic principle named dignity is not sufficient proof that a generated anchor resolves.
- **I BLED SO** retains the painting's metadata, figure, caption, credit, and image reference. No creation date is invented from upload dates. The eight visual assertions in its alternative text remain unverified until the actual image is inspected. Its caption is not a substitute for the image.
- **site.json** preserves the source site's collection ordering and descriptions. It is inert documentary content: its name, Reader settings, beta status, routes, and claims about verified quotations are not new Huey branding, implemented access controls, publication events, or completed evidence review.

These are source comparisons, not outside medical/legal research. No source statement was silently corrected. In particular, the word *published* inside a source model does not establish an independently checked publication event.

## Claims, occurrences, and what remains

[claims.tsv](claims.tsv) contains **70 specifically scoped checks**, each with an exact source value or span, JSON pointer, proposition type, verification issue, support level, and disposition. **16 require substantial support.** These identifiers are `ANC-C001`–`ANC-C070`; they do not renumber or replace the 188 initial `SOC-C` targets.

[#189](https://github.com/grwtsk/huey/issues/189) addresses media, visual description, authorship attribution and the limits of aphorisms. [#190](https://github.com/grwtsk/huey/issues/190) addresses source status and citation targets. Existing #144/#175 remain responsible for external authority and normative interpretation. [#191](https://github.com/grwtsk/huey/issues/191) tracks the newly identified argument about making as communication.

The verifier enumerates all **59 ID-bearing nodes**, every scalar occurrence, and source references in this five-file selection. It preserves duplicate occurrences without treating them as independent corroboration. Twenty-four remaining display/attribution/description occurrences have exact, separately reviewed dispositions in [leaf-dispositions.tsv](leaf-dispositions.tsv). Any newly added unmatched prose is marked `additional-atomic-review-pending` under #145. These dispositions identify source labels as labels, not independently tested services or results. This is **not an assertion that every sentence in the whole collection has been atomically audited**. The generated occurrences expose the remaining work instead of concealing it behind a coverage percentage.

Three ancillary files remain: the ethics architecture, the image, and the shared authority-quotation metadata. Full presentation JSON for the twelve earlier prose exports, their automated text comparisons, and full conversation capture also remain under #126/#127/#145. No approval question is reopened.

## Local checks

```sh
python3 planning/standard-of-care/ancillary-r02/verify.py --output-dir /tmp/huey-ancillary-r02
python3 -m unittest discover -s planning/standard-of-care/ancillary-r02 -p 'test_*.py' -v
```

The exporter is read-only toward the repository, uses the standard library, makes no network request, and requires generated outputs outside the repository. A modified source and a recomputed manifest still fail against the separately pinned source identities. Tests establish representation integrity and routing, not substantive truth.

[The source-based argument draft](argument-draft.md) is a proposed join for the instruments chapter, not an applied manuscript edit or an addition to the book's protected closing.
