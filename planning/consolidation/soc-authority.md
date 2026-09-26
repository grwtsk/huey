# SOC-Q03 authority source/review consolidation

Work: [#423](https://github.com/grwtsk/huey/issues/423), following #421/#422.
Inspected staging base: `628f7d30fcbaff625a07cb7f46d937a5c670668a`.
Selected public source: draft PR #122 at
`ff0499bd341de12a31b355b79867b547f19d9b16`.

## Selection and source scope

[soc-authority.json](soc-authority.json), model `huey.soc-authority.v1`, pins
**nine unchanged files**: the complete `authority-quotes.json`, its original
`transfer-q03.json`, and all seven files in
`planning/standard-of-care/authority-q03/` (README, argument draft, claims and
fields tables, review JSON, verifier and tests). The authority register retains
12 entries and 15,994 bytes, with blob `69f35715a28dc800250959ee2a19cf67bfa91e90`.
The comparison is against public Huey objects on #122. No original Neurology
checkout, private source store or external cited page is inspected in this pass.

SOC-PUBLIC-01 already covers this source copy and apparatus. Read
[AUTHORIZATION.md](../standard-of-care/AUTHORIZATION.md),
[#2's original instruction receipt](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544)
and [#192's prior delivery](https://github.com/grwtsk/huey/issues/192#issuecomment-5772579246).
These references locate the supplied scope; account identity, a URL, `approval`
or `verified_at` field cannot authenticate an Instruction/Grant or establish
truth. No new permission is inferred from public branch visibility.

The two current navigation READMEs change separately from the nine copied files.
The prior [ancillary manifest](soc-ancillary.json) remains byte-identical, and the
new manifest records its exact blob and the two transitions from its completed
navigation state to the current one. The core manifest retains original source
pins while recording the new navigation endpoints. This is explicit navigation
history, not literary revision or retroactive alteration of a source receipt.

## What the apparatus records

The imported review distinguishes **271 scalar JSON fields**, **89 field-level
substantial-support targets**, **68 conceptual relationship references** and
**14 separately stated propositions** attached to a twelve-unit argument
candidate. These are different denominators, not unique incident totals,
independent witnesses or established breaches. `Q03-R00` covers two document
metadata fields, not a thirteenth source inspection. Source-local IDs and JSON
pointers remain provenance coordinates, not new literary EntityIDs.

The historical review records nine wording matches in retrieved primary text,
two official indexed excerpts and one specified edition left unverified. It also
retains full-text access failures, an unexposed translator credit, the distinction
between the supplied proposed Geneva revision and a separately inspected adopted
text, and reuse/rights questions. **These are prior reported research results;
this consolidation does not repeat them.** Source `verified_at: 2026-09-18`,
review timestamp `2026-09-22T06:52:46+00:00` and the claims table's
`supported-in-current-source` labels retain that historical scope. The source
register's dates and words are unchanged. The source's claims and the review's
qualifications remain separate.

All 68 conceptual links remain unreviewed correspondences under #144. A quoted
standard does not establish case applicability, provider conduct, causation,
legal liability, doctrinal equivalence or an individual service guarantee.
Unavailable text is not treated as false. Original testimony is neither erased
nor independently corroborated by copying a normative source.

*The standards are not silent* remains a proposed argument under its existing
owners #160/#161/#169/#175. It is not inserted into the manuscript, reader,
editorial page sequence or evidence map. Its historical placement suggestion is
provisional under #404's world → flow → argument cuts → partition → reading order
direction. Current RF-01 and PR-01 govern later adaptation; no movement, chapter
cut, protected closing or source prose is changed here.

## Read-only checks

Run with the repository's supported Python environment:

```sh
python3 scripts/soc_consolidation.py
python3 scripts/soc_consolidation.py --source-objects
python3 scripts/soc_authority.py
python3 scripts/soc_authority.py --source-objects
python3 planning/standard-of-care/authority-q03/verify.py
python3 -m unittest discover -s planning/standard-of-care/authority-q03 -p 'test_verify.py' -v
python3 -m unittest discover -s tests -v
```

The cumulative checker requires the fixed **60-file selection** (core 36,
ancillary 15, Q03 nine), including 58 exact copies and two adapted navigation
pages. It does not exempt entire directories. The Q03 wrapper checks selected
bytes, receipt/reference consistency and navigation lineage before running the
inherited offline verifier without export arguments. The separate ancillary
checker now checks its historical navigation receipt; the Q03 and cumulative
checks bind today's endpoints. `--source-objects` compares the pinned public
Huey objects already available locally and fails if they are missing; it never
fetches a private or remote object.

The wrappers are local consistency checks, not an atomic custody transaction
against concurrent filesystem replacement. The ancillary optional exporter is
not used or represented as a hardened source service. Q03's original 22-test and
partial-checkout statements remain historical; current commands, candidate,
results and unavailable checks belong in this PR's receipt. Hosted checks now
discover the inherited Q03 tests explicitly. No software result supplies
substantive verification, human acceptance or evidence clearance.

## Remaining work and evidence capture

#192 stays open for the edition, translator, full-text, service, compound-context,
rights and applicability work; #144/#145/#176 retain correspondence, atomic
coverage and substantial-support review. #126 retains the ethics architecture,
painting image, twelve full prose presentation records, whole-text comparison
and complete conversation capture. Only #423's bounded staging task can close.
#122 remains draft; the next separate consolidation is its incident/departure
source-review layer, followed by separately scoped care-law work.

New evidence continues through the existing [vault handoff](vault-handoff.md).
Record exact permitted locators and supporting, contrary, limiting, contextual
and source-family relationships as described in [evidence references](evidence-references.md).
A new deposit reopens affected review; it does not automatically change a claim's
status. Restricted raw custody remains in the vault, with separately reviewed
public certificates/derivatives only. This pass receives no new evidence,
creates no certificate or reader binding, and starts no capture service or watch.

Promotion to `main` remains held for exact-version journalistic-integrity review
and an actual human editorial decision. No source disclosure beyond the recorded
copy scope, manuscript acceptance, evidence clearance, outside contact, main
promotion, deployment or edition release occurs here.

Disclaimer: Working draft; claim verification incomplete; not medical/legal
advice or adjudicated findings.
