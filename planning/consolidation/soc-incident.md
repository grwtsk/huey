# SOC-I01 incident/departure consolidation

Work: [#425](https://github.com/grwtsk/huey/issues/425), following #423/#424.
Inspected staging base: `4156b4fba4a57394b9aae54e5104694d622861b5`.
Selected public source: draft PR #122 at
`ff0499bd341de12a31b355b79867b547f19d9b16`.

## Exact selection and scope

[soc-incident.json](soc-incident.json), model `huey.soc-incident.v1`, pins all
**nine unchanged files** under `planning/standard-of-care/incident-register/`:
README, historical checks, coverage and intake notes, rendered index, register
and source JSON, verifier and tests. Their combined size is 68,011 bytes.
No care-law payload or additional source import is required for this slice.

SOC-PUBLIC-01 covers this already-authorized derived apparatus. Read
[AUTHORIZATION.md](../standard-of-care/AUTHORIZATION.md),
[#2's instruction receipt](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544)
and [#193's original registration receipt](https://github.com/grwtsk/huey/issues/193#issuecomment-5780204832).
The source is the existing public Huey branch; no private vault, original PDF,
private conversation, clinical record or external cited page is accessed here.
Public visibility alone is not permission. References and recorded approval
fields cannot authenticate runtime authority or supply an evidentiary finding.

The two navigation READMEs change separately. The ancillary and Q03 manifests
remain byte-identical historical receipts. The new manifest binds the Q03
manifest's exact blob and records its two navigation endpoints as the new
transition's predecessors. Original core source pins survive; only its current
navigation hashes advance. This does not rewrite source or literary history.

## Entries, source aliases and evidence limits

The initial SOC-I001–112 snapshot retains these distinct classes:

| Kind | Entries |
| --- | ---: |
| Reported departure | 43 |
| Unresolved safeguard | 40 |
| Investigative question | 14 |
| Clinical review question | 10 |
| Context/consequence | 5 |

The corresponding #194–305 issues hold the detailed reports, dates, actor limits,
invoked standards, evidence needs and contrary material. This repository index
does not duplicate or supersede those bodies. The 112 entries are not a count of
independent physical events, proved breaches or charges. Some entries concern
different acts in one encounter; some preserve undated continuing patterns.
Neither extra legal theories nor days elapsed manufacture additional events.
The SOC, ANC, Q03 and care-law denominators remain separate.

The source catalog has **21 aliases**, 11 used directly by index rows. Six are
historical descriptions of supplied documents; their raw bytes remain outside
this copy. Fifteen link to the already-staged three context files and twelve
authored-text exports. A locator does not mean an original was accessed or its
contents independently established. Source-local aliases and SOC-I identifiers
remain provenance/issue coordinates, not new literary EntityIDs or evidence IDs.

The `2026-09-22` receipt, source-reading claims and original 16-test statement
remain historical. In particular, this pass does not repeat the reported page
inspection or compare original recipient versions. Seventeen addressed copies
remain one source family without presumed dispatch, receipt, authorship or
notice. The July 7 delivered-object versus July 26 document identity remains
unresolved. Received AI medical assertions remain review questions, not proved
physician omissions. Helpful actions, institutional offers, crisis support and
Board interviews remain context rather than being converted into findings.

Registration preserves testimony before additional corroboration. No source is
rewritten into a hypothetical solely because its evidence review is incomplete.
Original wording, correction, contrary material and unresolved applicability stay
separate under RF-01. Current #404 chapter projections and PR-01 remain operative;
no prose, chapter assignment, ReadingPage or protected closing is changed.

## Current intake boundary

The imported [intake note](../standard-of-care/incident-register/evidence-intake.md)
predates #335 and stays unchanged as part of the registration record. The current
[evidence-intake protocol](../evidence-intake/README.md), its policy/worker
instructions and [vault handoff](vault-handoff.md) govern actual new intake.
Their compatible public certificate schema is unchanged by this consolidation.

Restricted raw custody remains in the existing vault. For those restricted
objects, only separately reviewed public certificates and permitted derivatives
may enter Huey. Missing private
configuration never causes public fallback. For each authorized relationship,
retain the permitted exact locator, contribution, limits, source family and
supporting, contrary, limiting or contextual role. Use the protocol's complete
relationship vocabulary, including `duplicate`, `same_source_family`,
`supersedes`, `provenance_only` and `unresolved`, without counting copies as independent
corroboration. A new deposit reopens affected review rather than rewriting prior
testimony or automatically promoting a finding.

This slice receives no evidence, creates no certificate, changes no evidence
index/reader binding and starts no collection, account query, contact or watch.
Requested, received, read, assessed and resolved remain separate states.

## Read-only checks and limits

```sh
python3 scripts/soc_consolidation.py
python3 scripts/soc_consolidation.py --source-objects
python3 scripts/soc_incident.py
python3 scripts/soc_incident.py --source-objects
python3 planning/standard-of-care/incident-register/verify.py
python3 -m unittest discover -s planning/standard-of-care/incident-register -p 'test_verify.py' -v
python3 -m unittest discover -s tests -v
```

The cumulative gate requires the fixed **69-file selection**: core 36, ancillary
15, Q03 nine and incident nine (67 exact copies, two adapted navigation pages).
No directory exemption admits unrelated material. The wrapper checks fixed bytes,
declared source/index membership, historical/incomplete states and navigation
lineage before running the pinned inherited verifier. Source-location strings
are not dereferenced. The authority checker now preserves its historical
navigation transition; the incident and cumulative checks bind current endpoints.
`--source-objects` compares already-available public Huey Git objects and fails
when missing; it does not fetch remote or private objects.

The inherited verifier does not inspect live issue bodies or underlying evidence.
Its original incomplete-coverage and collection-not-started states are preserved.
Hosted checks explicitly run its 16 tests. These are local consistency checks,
not atomic custody against concurrent filesystem replacement, source
authentication, permission, clinical/legal findings, substantive clearance or
human acceptance. Current execution results belong to the exact PR receipt;
the imported `checks.json` is not updated with new test results.

## Remaining work

Only #425's bounded staging task can close here. #193 and individual entry issues
remain open; #306/#145 retain all-source-unit and occurrence reconciliation,
#307/#176 retain actual evidence intake and support assessment, and #126/#127
retain representation/comparison/conversation gaps. #144/#192 retain standards
and relationship review. #122 stays draft. The next separate consolidation is
a bounded care-law source/review slice, selected after its dependencies are read.

Main promotion remains held for an exact-version journalistic-integrity review
and an actual human editorial decision. No new source disclosure beyond the
recorded scope, manuscript acceptance, evidence clearance, main promotion,
deployment or edition release occurs here. No continuation is scheduled.

Disclaimer: Working draft; claim verification incomplete; not medical/legal
advice or adjudicated findings.
