# Initial care-law source/review consolidation

Work: [#427](https://github.com/grwtsk/huey/issues/427), following #425/#426.
Inspected staging base: `b71676df74adefd5b0811ae9671b9382075a022f`.
Selected public source: draft PR #122 at
`ff0499bd341de12a31b355b79867b547f19d9b16`.

## Exact selection and permission

[soc-care-law.json](soc-care-law.json), model `huey.soc-care-law.v1`, selects
exactly the original **eight unchanged files**, 149,919 bytes, under
`planning/standard-of-care/care-law/`: AGENTS, README, cumulative revision,
sources, reviews, lineage, candidate book joins and verifier. The verifier's
inputs are entirely within this selection. Later R03–R13 files are not imported.

The recorded SOC-PUBLIC-01 instruction in
[#2](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544) and the
author's explicit recovery direction in [#177](https://github.com/grwtsk/huey/issues/177)
cover this existing derived work. Read [AUTHORIZATION.md](../standard-of-care/AUTHORIZATION.md)
for the exact public-copy boundary. Public branch visibility alone supplies no
permission. The instruction is distinct from its agent-transcribed references;
URLs, approval fields, source hashes and checks cannot authenticate authority.

No original clinical PDF, private witness record, restricted manuscript packet,
credential or external source is retrieved. Five existing source entries describe
original documents (S02 and S24–S27); those descriptions remain references, not new
raw-source materializations. S00 separately describes authorial conversation
context. Existing source-origin URLs remain provenance and are not followed to
read or write another repository. Neurology originals stay untouched.

## Preserved records and meaning

The namespace remains `HUEY-CARELAW-01:C001–C256`, separate from `SOC-C`, `ANC-C`,
Q03 and incident identifiers. The collection retains 151 first-pass IDs, 105
second-pass additions and ten before/after changes. Its **256 prose units** are
130 proposals, 28 questions, 26 documentary descriptions, 26 law units,
23 inferences, eight testimony units, six policy units, five ethics units,
three metaphors and one framework unit. These are the packet's classifications,
not 256 verified facts, legal findings, independent events or atomic clauses.
Proposal imperatives are literary/editorial content, not instructions to execute
clinical, institutional or legal actions.

The **41 source records**, **34 review schedules** and **17 candidate section
joins** have different denominators. Thirty-nine sources are directly cited by
prose; S38 is retained in the catalogue, and S40 is referenced by review R30.
All 115 added/edited units have detailed review links. Deeper review of the other
141 first-pass units remains open. Each schedule retains source locators,
observations, questions, needed evidence, competing explanations, competent
review functions, proposed lower-burden steps and closure tests. Existing issue
owners are preserved, without renumbering or declaring their investigations done.

The original September 21 inspection states remain historical: 37 `read-this-pass`,
one `source-text-retrieved-this-pass`, one `carried-forward-from-pass-1`,
S13 `recheck-failed` and S39 `access-result-only`. They describe earlier work,
not source retrieval in this consolidation. Later source checks recorded in #186
do not silently rewrite those receipts. `lineage.origin_integrity` identifies
earlier origin bytes, not a claim that those hashes identify the recovered files.

RF-01 preserves source testimony, separately attributed institutional accounts,
offered accommodations, contrary material, chronology conflicts and uncertain
responsibility. Unknown motive or source classification does not erase a reported
relationship; preserving the report does not supply independent corroboration.
No private source, protected closing content or new narrative is introduced.

## Historical instructions and current integration

The imported AGENTS and README are part of the exact recovery record. Their
directions to resume #122 and their old merge/test statements describe that pass.
For this consolidation, the current author instruction, root AGENTS and
[pre-release policy](../pre-release.md) govern the one bounded staging PR. This
does not accept the broader draft #122 or the recovered prose.

The initial `candidate-joins-not-applied` map remains unchanged. It describes the
initial recovery packet, not an assertion that later work never happened: #186
records subsequent CL03–CL08 adaptations and allocations in restricted candidates.
Their public receipts and private manuscript reconciliation remain separate.
Under [#404](https://github.com/grwtsk/huey/issues/404), the old chapter numbers and
titles are working projections, not permanent identity or current assignments.
This copy changes no manuscript, ReadingPage, route, admission or evidence binding.

## Evidence intake and remaining dependencies

Use the current [intake protocol](../evidence-intake/README.md), policy and worker
instructions, plus the [vault capture/export/reverse-receipt handoff](vault-handoff.md),
for actual new evidence. Restricted raw stays in the configured private vault;
only separately reviewed certificates and permitted derivatives for those objects
may enter public Huey. Other public objects follow their own whole-object policy
classification. Missing private configuration never triggers public fallback.
The compatible certificate schema and public evidence index remain unchanged.

Retain exact permitted locators, source families, contributions and limits for
`supports`, `contradicts`, `limits`, `context`, `duplicate`, `same_source_family`,
`supersedes`, `provenance_only` and `unresolved` relationships. New counterevidence
reopens the affected review rather than rewriting testimony. Source-local IDs and
hashes are not new evidence IDs or literary EntityIDs. No certificate, actual
intake, source service, account query, contact or ongoing watch is created here.

Dependency review found #177 closed only for its repository correction, while
#178–#187 and #125/#126/#144/#145 remain open. #178–#181 retain source, encounter,
clinical/communication, record-version and actual transmission questions;
#182/#184 retain exact authority, event-date applicability and source discrepancies;
#183/#185 retain institutional action, consequence and burden questions; #187
retains exact object/notice identity. #186 owns current manuscript application;
#145/#176 retain full clause/apparatus coverage and substantial-support work.
These reviews do not block preservation of the already-authorized packet. They
do block claims that their unanswered questions have been resolved.

## Checks and limits

```sh
python3 scripts/soc_care_law.py
python3 scripts/soc_care_law.py --source-objects
python3 scripts/soc_consolidation.py
python3 scripts/soc_consolidation.py --source-objects
python3 planning/standard-of-care/care-law/verify.py --output-dir /tmp/huey-care-law-check
python3 -m unittest discover -s tests -v
```

The cumulative gate requires **77 files**: core 36, ancillary 15, Q03 nine,
incident nine and care-law eight (75 exact copies, two adapted navigation pages).
All three predecessor slice manifests stay unchanged. The care-law receipt extends
the incident navigation transition; current endpoints are checked by the new
wrapper and cumulative gate. No directory exemption admits later work.

The wrapper checks fixed byte pins, incomplete/historical states and lineage,
then runs the pinned inherited `inspect()` and all **21 invalid mutations**
in memory without exporting prose. Source-location strings are not opened.
`--source-objects` compares already-available public Huey Git objects; it never
fetches remote or private material. These checks are not an atomic custody system,
source authentication, permission, factual review or manuscript acceptance.

The inherited CLI separately produces `claims.json` and `verification.json` in
an external temporary directory. These are disposable derived checks, not another
canonical prose master and not committed artifacts. Its fixed statement that
full-checkout/hosted tests were not run belongs to the original partial-checkout
packet. Current commands, environment and actual local/hosted results are recorded
in this consolidation PR; do not relabel the old statement as today's execution.
No inaccessible private packet, original record, external legal authority or
historical legal applicability is tested by this copy.

Only #427's bounded consolidation can close. #122 remains draft and the source,
integration and human review issues remain open. The next separate slice is
CL03's three public integration receipt/index/checker files after dependency
review; running its full verifier requires the separately authorized private
packet. Later R04–R13 work is also deferred. No continuation is scheduled.

Main remains held for exact-version journalistic review and an actual human
editorial decision. No new source disclosure outside the recorded scope,
evidence clearance, manuscript acceptance, main promotion, deployment or release
occurs through this staging copy.

Disclaimer: Working draft; claim verification incomplete; not medical/legal
advice or adjudicated findings.
