# Huey: how to make skin color.

> [!WARNING]
> **WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.** This repository includes attributed testimony, allegations, hypotheses, normative arguments and AI-assisted drafts. Inclusion, a citation, a commit, an issue closure or a passing software test does not independently verify a claim. Some received medical assertions are unsupported or superseded. This is not a clinical guideline, medical or legal advice, or an adjudicated finding. Read the linked verification issues for evidence, limitations, counterevidence and corrections. Public-copy approval is not factual endorsement or acceptance of a finished edition.

R.A. Jacob Martone

**Public-copy approval is recorded; do not ask again.** The author expressly approved the specified standard-of-care discussion, atlas and essay collection in [issue #2's decision receipt](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544). [Program #125](https://github.com/grwtsk/huey/issues/125), [transfer #126](https://github.com/grwtsk/huey/issues/126), [corpus audit #145](https://github.com/grwtsk/huey/issues/145), and [substantial-support queue #176](https://github.com/grwtsk/huey/issues/176) distinguish source copying from factual review. Browse the [approved working corpus on the existing development branch](https://github.com/grwtsk/huey/tree/writing/55-development-r01/sources/standard-of-care) and [PR #122](https://github.com/grwtsk/huey/pull/122). Raw clinical PDFs/records and unrelated private material remain excluded. The live Reader gate and the book's protected ending are unchanged.

Every new relevant commit must include: **Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.** Do not rewrite old commit history to backdate this requirement. Earlier infrastructure descriptions below apply outside the explicitly approved corpus; they do not reopen this permission decision.

Production work is tracked in [the master issue](https://github.com/grwtsk/huey/issues/1). Read [AGENTS.md](AGENTS.md) before issue-driven work. One response opens one bounded pull request; completed, checked work may merge under the author's recorded instruction. Manuscript acceptance and release remain separate.

## Pre-release and evidence review

Work branches → [`pre-release`](https://github.com/grwtsk/huey/tree/pre-release) → journalistic-integrity review → promotion pull request → `main`.

The [promotion policy](planning/pre-release.md) and [review-record template](planning/pre-release-review.template.md) require claim-to-source tracking, a recorded disposition for contrary evidence and material uncertainty, appropriate response opportunities, disclosure checks and actual human editorial clearance of the exact proposed content. Uncleared material stays staged; a passing software check is not an evidence verdict.

**Both branches are public.** Existing source-disclosure restrictions still apply. Content already on `main`, including the previously checked-in chapter, retains its existing status and is not retrospectively certified. This setup adds a manual editorial gate; server-side required-review enforcement remains [administration task #311](https://github.com/grwtsk/huey/issues/311). No automatic merge, replication or publication workflow is enabled. Setup is tracked in [#310](https://github.com/grwtsk/huey/issues/310).

## Literary entity model

The [v1 literary entity contract](planning/literary-entity-model.md) defines stable
identity, exact entity versions, occurrences and reading projections for
[#348](https://github.com/grwtsk/huey/issues/348). Its synthetic fixtures and
read-only checks are the foundation for #347's later implementation. Markdown,
the current reader and source admission remain unchanged; this model does not
establish manuscript acceptance, factual truth or kernel authority.

## Middle-book chapter

[Baptism in the Color of Rain](manuscript/02-interlude/baptism-in-the-color-of-rain.md) is checked in at the author's explicit direction, with only the first `netch` changed to `netch asheba`. The [working contents](manuscript/README.md) place this added chapter in the Interlude, between *The Ring of Umber* and *The Possibility of a Feather*. [Check-in #308](https://github.com/grwtsk/huey/issues/308) and the [placement record](planning/writing/baptism-in-the-color-of-rain.json) record this chapter-specific public-copy scope. Other private manuscript and raw clinical records remain outside this grant; the broader development and release work remain separate.

## Source catalog and coverage

The author selected a kernel-managed durable source volume with a Reader-gated catalog/search on grwtsk.com. For sources outside the scoped public-copy approval above, this repository carries the [link-planning contract](planning/source-catalog-contract.md), [metadata aliases](sources/catalog.yaml), [service handoff](planning/source-service.json), and [source-to-book coverage ledger](planning/source-coverage.md). These infrastructure files do not duplicate the original corpus or implement reader permissions.

The service endpoint and its source bindings are currently pending. No working gated search route, ingested clinical record, actual reader grant or deployment is claimed. Follow [issue #16](https://github.com/grwtsk/huey/issues/16) and its cross-repository blockers. [Issue #2](https://github.com/grwtsk/huey/issues/2) retains remaining source-admission and disclosure boundaries outside SOC-PUBLIC-01; the custody architecture itself is no longer unselected.

```sh
python3 -m pip install -r requirements-checks.txt
python3 -m unittest discover -s tests -v
python3 scripts/catalog.py validate
python3 scripts/catalog.py check
```

`python3 scripts/catalog.py render` prints the deterministic ledger. `python3 scripts/catalog.py link A01` returns a pending result until inspected service/alias bindings exist. These commands do not query a service, grant access or publish content.

No manuscript passages, literary anchors or private records were stored by those earlier infrastructure changes. The later approved SOC source copies are separately identified above.

## Current framing correction

Read [RF-01](planning/relational-framing.md) and the [resume instruction](planning/framing-resume.md) before drafting from earlier packets. The author describes the geometry of people, identity, evidence and decisions, not a claim of racism or a defense against that label. Original sources retain their words; current derivatives preserve the later clarification. [Issue #98](https://github.com/grwtsk/huey/issues/98) governs the correction, [#99](https://github.com/grwtsk/huey/issues/99) its workflow checks, and [#100](https://github.com/grwtsk/huey/issues/100) its manuscript repairs.

Local checks for the bounded declaration/scanner tool are documented in RF-01. They do not guarantee semantic fidelity. The [coverage register](planning/framing-coverage.json) records actual issue/PR correction references, not a live completion service. No public manuscript permission beyond the actual scoped grant is implied.

## Lexical and conceptual research

[LG-01](research/lexical-geometry/README.md) maps race, is, -ism, -ist, racism and racist across lexical history, grammar, philosophy, social theory, identity and normative frameworks. Its [source register](research/lexical-geometry/sources.md), [structured atlas](research/lexical-geometry/atlas.json) and [continuing coverage](research/lexical-geometry/coverage.md) preserve actual access, attributed disagreements and unresolved work. The atlas is public-source research, not a classification of the book's participants. See [#102](https://github.com/grwtsk/huey/issues/102) and [#103](https://github.com/grwtsk/huey/issues/103).

```sh
python3 scripts/lexical_geometry.py validate
python3 scripts/lexical_geometry.py check
python3 -m unittest discover -s tests -p 'test_lexical_geometry.py' -v
```

These are local integrity checks, not a substitute for reading or a claim that all pertinent authorities have been exhausted. No source service or hosted workflow is activated.

## Author-supplied capstone

The [placement contract](planning/capstone-placement.md) records the author's concluding self-examination and open reader address at the end of Chapter 15, immediately before the existing excursion. The [Smith/antiracist comparison](research/lexical-geometry/confession-reader-dialogue.md) cites the distinct public sources. RF-01 protects actual self-attribution as well as protection from imposed labels; it is not a prohibition on the author's supplied words. The private capstone source and proposed prose are not part of the SOC public-copy scope. Full-chapter integration remains #51.
