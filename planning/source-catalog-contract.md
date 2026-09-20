# Link-only source catalog contract

Status: local planning/formatting implementation, not a running source service.
Parent: [#16](https://github.com/grwtsk/huey/issues/16). Local slice: [#73](https://github.com/grwtsk/huey/issues/73).

## Author-selected custody route

The author [specified the route](https://github.com/grwtsk/huey/issues/16#issuecomment-5746275749) in a GitHub comment created at `2026-09-20T00:03:11Z` and directed this work session to that comment. The durable sources belong in a volume wrapped by the kernel service. The source catalog is presented on grwtsk.com behind Reader access. The kernel manages the access filter; a reader searches records they have actually been granted access to. The source-to-book coverage ledger supplies search links.

This resolves the destination/ownership part of the earlier custody question. Do not ask the author to select that architecture again. It does not select actual reader grants, record admissions, retention periods, credentials, an operating budget or a deployment candidate. Those remain distinct operations. The new [lifecycle question](https://github.com/grwtsk/noeaaeue-kernel/issues/135) separates retained evidence versions from beta publication history; it does not reopen the selected destination.

## Three owners, no duplicate authority

| Repository | Responsibility |
|---|---|
| `grwtsk/noeaaeue-kernel` | Durable source envelopes/versions, service-owned source volume, generic operational policy and permission-filtered search. I/O belongs to the service host, not ambient imports into the pure proof kernel. |
| `grwtsk/neurology` | Reader authentication/front controller and catalog/search presentation on grwtsk.com; consume the shared filter, do not duplicate its policy in browser code. Git-canonical publication records stay distinct from the source volume. |
| `grwtsk/huey` | Non-sensitive planning aliases, source-to-book coverage and query-link formatting. No private original corpus, source index, reader database or grant engine. |

The existing Construct contracts, Node gateway, typed content bridge and native interfaces are reused through kernel #123–#128 and neurology #77/#78/#83. The new work adds a specific source-storage/search service; it is not evidence that the existing runtime already implements it. Source history and current-only beta publication history must not be conflated.

## Local data, not an ingested-source inventory

`sources/catalog.yaml` deliberately uses the JSON-compatible subset of YAML, parsed as strict JSON with duplicate-key, size and nonfinite-value rejection. Version 1 contains 26 planning aliases, not 26 claims of admitted or inspected records. The A/E identifiers follow the inventory in #16. The D-series groups its remaining input families:

| Alias | Planning family |
|---|---|
| D01 | Earlier context-consolidation dossier |
| D02 | Original institutional notice |
| D03 | First patient-authored submission |
| D04 | Follow-up submission |
| D05 | Third submission |
| D06 | Addressee-specific response variants, treated as one source family |

These labels identify work to bind, not attest to document content, chronology, receipt or factual correctness. Chapter assignments are proposed editorial mappings derived from the accepted work plan, not silent revisions to the sources. Actual filenames, titles, source/version IDs, checksums, private locators, quoted text and permissions belong in the restricted service. A family may resolve to several separately attributable versions; multiple copies must not become independent corroboration.

Every current `binding` is null. This is an explicit unimplemented/unbound state, not an empty evidence set. No original has been imported by this change. A01–A03 remain the supplied literary anchors; do not reconstruct them from summaries. PR-01 and the narrative ending remain governed by #1/#20.

## Proposed link handoff

The local candidate aliases have the form `huey.a01`. They contain no private source title, content digest, bearer token or query text. The upstream contract must confirm this alias grammar and choose the actual path/query parameter before activation. Huey does not impose a guessed `/search` endpoint.

`planning/source-service.json` records the selected origin and owners, actual dependency issue links, and a null service binding. A future compatible binding must name the path, query parameter, interface version, exact kernel/host commits and an inspected integration receipt. Each admitted alias needs a matching interface-version/binding receipt. Keep exact source-version resolution inside the service; do not silently rebind an accepted citation to a different original.

The renderer emits a search URL only when both configuration records are complete and compatible. Until then it emits **Pending service / binding**. A configured URL merely populates a query after Reader authentication; current kernel grants still filter results and downloads. It must not carry a token or cause an anonymous client to learn whether hidden records exist.

A complete JSON configuration does not prove a live service or human permission. Receipt URLs/commit-shaped strings are structural evidence references, not self-authenticating facts. Before committing real bindings, inspect those actual records and the current service via neurology #88. The formatter performs no network query, permission evaluation, source retrieval or deployment. It cannot authenticate fabricated evidence; the server remains decisive on every request.

## Progressive blockers

| Stage | Work / decision |
|---|---|
| Real-source lifecycle | [kernel #135](https://github.com/grwtsk/noeaaeue-kernel/issues/135), assigned to the author |
| Contract and identity | [kernel #136](https://github.com/grwtsk/noeaaeue-kernel/issues/136), extends #123–#125 |
| Durable storage/recovery | [kernel #137](https://github.com/grwtsk/noeaaeue-kernel/issues/137) |
| Kernel-filtered search | [kernel #138](https://github.com/grwtsk/noeaaeue-kernel/issues/138) |
| Reader catalog / query links | [neurology #87](https://github.com/grwtsk/neurology/issues/87) |
| Integration and guarded activation | [neurology #88](https://github.com/grwtsk/neurology/issues/88) |

#73 may close when this local slice passes its checks. #16 remains open until durable, actually authorized source versions and usable gated links fulfill its coverage requirements. #2 records the selected route and keeps remaining per-source/read/retention/activation decisions explicit. Draft contract and synthetic tests need not wait for a real patient's admission or production credentials. These are stage-specific issue-body links, not native dependency objects or implemented service claims.

## Local commands

```sh
python3 -m unittest discover -s tests -v
python3 scripts/catalog.py validate
python3 scripts/catalog.py render > planning/source-coverage.md
python3 scripts/catalog.py check
python3 scripts/catalog.py link A01
```

The script itself only reads and prints. The shell redirection explicitly regenerates the checked-in ledger. `validate` success means metadata structure is valid. `check` success means the ledger is current. `link` exits 3 while service or alias binding is pending. It never fabricates a working URL to make the build green. Synthetic tests format links without contacting any server.

The original authority tests remain separate from this link planner. Neither suite is security certification, a fact check of the manuscript, or permission to publish sources. No scheduled work, new source persistence, CI upload or deployment is enabled here.
