# Huey: how to make skin color.

R.A. Jacob Martone

Production work is tracked in [the master issue](https://github.com/grwtsk/huey/issues/1). Read [AGENTS.md](AGENTS.md) before issue-driven work. One response opens one bounded pull request; completed, checked work may merge under the author's recorded instruction. Manuscript acceptance and release remain separate.

## Source catalog and coverage

The author selected a kernel-managed durable source volume with a Reader-gated catalog/search on grwtsk.com. This repository carries only the [link-planning contract](planning/source-catalog-contract.md), [metadata aliases](sources/catalog.yaml), [service handoff](planning/source-service.json), and [source-to-book coverage ledger](planning/source-coverage.md). It does not duplicate the original corpus or implement reader permissions.

The service endpoint and all source bindings are currently pending. No working search route, ingested record, actual reader grant or deployment is claimed. Follow [issue #16](https://github.com/grwtsk/huey/issues/16) and its cross-repository blockers. [Issue #2](https://github.com/grwtsk/huey/issues/2) retains the remaining source-admission and disclosure boundaries; the custody architecture itself is no longer unselected.

```sh
python3 -m pip install -r requirements-checks.txt
python3 -m unittest discover -s tests -v
python3 scripts/catalog.py validate
python3 scripts/catalog.py check
```

`python3 scripts/catalog.py render` prints the deterministic ledger. `python3 scripts/catalog.py link A01` returns a pending result until inspected service/alias bindings exist. These commands do not query a service, grant access or publish content.

No manuscript passages, literary anchors or private records are stored here by these infrastructure changes.

## Current framing correction

Read [RF-01](planning/relational-framing.md) and the [resume instruction](planning/framing-resume.md) before drafting from earlier packets. The author describes the geometry of people, identity, evidence and decisions, not a claim of racism or a defense against that label. Original sources retain their words; current derivatives preserve the later clarification. [Issue #98](https://github.com/grwtsk/huey/issues/98) governs the correction, [#99](https://github.com/grwtsk/huey/issues/99) its workflow checks, and [#100](https://github.com/grwtsk/huey/issues/100) its manuscript repairs.

Local checks for the bounded declaration/scanner tool are documented in RF-01. They do not guarantee semantic fidelity. The [coverage register](planning/framing-coverage.json) records actual issue/PR correction references, not a live completion service. No new public manuscript permission is implied.

## Lexical and conceptual research

[LG-01](research/lexical-geometry/README.md) maps race, is, -ism, -ist, racism and racist across lexical history, grammar, philosophy, social theory, identity and normative frameworks. Its [source register](research/lexical-geometry/sources.md), [structured atlas](research/lexical-geometry/atlas.json) and [continuing coverage](research/lexical-geometry/coverage.md) preserve actual access, attributed disagreements and unresolved work. The atlas is public-source research, not a classification of the book's participants. See [#102](https://github.com/grwtsk/huey/issues/102) and [#103](https://github.com/grwtsk/huey/issues/103).

```sh
python3 scripts/lexical_geometry.py validate
python3 scripts/lexical_geometry.py check
python3 -m unittest discover -s tests -p 'test_lexical_geometry.py' -v
```

These are local integrity checks, not a substitute for reading or a claim that all pertinent authorities have been exhausted. No source service, private corpus or hosted workflow is activated.
