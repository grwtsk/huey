# Huey: how to make skin color.

> [!WARNING]
> **WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.** This repository contains attributed testimony, allegations, hypotheses, normative arguments and AI-assisted drafts. Inclusion, a citation, a commit, an issue closure or a passing software test does not independently verify a claim. Some received medical assertions are unsupported or superseded. This is not a clinical guideline, medical or legal advice, or an adjudicated finding. Consult the linked verification issues for evidence, limitations, counterevidence and corrections. Publication approval is not factual endorsement or acceptance of a finished edition.

R.A. Jacob Martone

## Approved standard-of-care discussion, atlas and essays

The author has **expressly approved public copies of the specified discussion, atlas and essay collection** in this repository. [The approval is recorded in issue #2](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544). Do not ask for this permission again. Raw clinical PDFs/records and unrelated private material remain excluded; the live website's Reader gate and the broader source-custody architecture are unchanged.

[Program and argument index #125](https://github.com/grwtsk/huey/issues/125) links the 30 initial argument issues and 19 verification issues covering 188 initial evidence targets. [Substantial-support queue #176](https://github.com/grwtsk/huey/issues/176) tracks causal, clinical, legal, historical, quantitative and cross-authority claims needing deeper support. [Transfer #126](https://github.com/grwtsk/huey/issues/126) and [full-corpus audit #145](https://github.com/grwtsk/huey/issues/145) distinguish copies actually made from remaining extraction, citation and semantic review. An initial target index is not an exhaustive sentence audit.

Approved material is placed under [`sources/standard-of-care/`](sources/standard-of-care/); tracking is under [`planning/standard-of-care/`](planning/standard-of-care/). Original prose, source-text exports, summaries, hypotheses and corrections must remain separately identified. An exported essay is not a byte-for-byte copy of its containing presentation JSON. First-person experience is preserved as attributed testimony rather than made contingent on proof of a broader causal inference.

Every new commit affecting this research must include:

> Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.

Commit messages must also identify affected issues and actual checks. This prospective requirement does not authorize rewriting older history.

Production work is tracked in [the master issue](https://github.com/grwtsk/huey/issues/1). Read [AGENTS.md](AGENTS.md) before issue-driven work. One response opens one bounded pull request; completed, checked work may merge under the author's recorded instruction. Manuscript acceptance and release remain separate.

## Source catalog and coverage

For sources outside the specific approval above, the author selected a kernel-managed durable source volume with a Reader-gated catalog/search on grwtsk.com. The [link-planning contract](planning/source-catalog-contract.md), [metadata aliases](sources/catalog.yaml), [service handoff](planning/source-service.json), and [source-to-book coverage ledger](planning/source-coverage.md) do not implement reader permissions.

The service endpoint and its source bindings are currently pending. No working gated search route, ingested clinical record, actual reader grant or deployment is claimed. Follow [issue #16](https://github.com/grwtsk/huey/issues/16) and its cross-repository blockers. [Issue #2](https://github.com/grwtsk/huey/issues/2) retains source-admission boundaries outside the explicitly approved SOC corpus; it no longer blocks this specified public-copy operation.

```sh
python3 -m pip install -r requirements-checks.txt
python3 -m unittest discover -s tests -v
python3 scripts/catalog.py validate
python3 scripts/catalog.py check
```

`python3 scripts/catalog.py render` prints the deterministic ledger. `python3 scripts/catalog.py link A01` returns a pending result until inspected service/alias bindings exist. These commands do not query a service, grant access or publish content.

The earlier infrastructure changes did not store manuscript passages, literary anchors or private records. The later SOC source-copy approval is a distinct, scoped change, not a claim that every source has been admitted.

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

The [placement contract](planning/capstone-placement.md) records the author's concluding self-examination and open reader address at the end of Chapter 15, immediately before the existing excursion. The [Smith/antiracist comparison](research/lexical-geometry/confession-reader-dialogue.md) cites the distinct public sources. RF-01 protects actual self-attribution as well as protection from imposed labels; it is not a prohibition on the author's supplied words. The private capstone source and proposed prose are not within the SOC transfer grant. Full-chapter integration remains #51.
