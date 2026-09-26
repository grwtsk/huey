# Ancillary source/review consolidation into staging

Work: [#421](https://github.com/grwtsk/huey/issues/421), following #406/#407.
Inspected staging base: `fe1b8a55df7f687b7ef652e5e9bbfc5e5b6cc594`.
Selected public source: PR #122 at
`ff0499bd341de12a31b355b79867b547f19d9b16`.

## Exact selection and authority context

[soc-ancillary.json](soc-ancillary.json) pins **15 unchanged files**:

- Five full source JSON records: the composition record, two quotation-bearing
  records, painting metadata and source-site metadata (24,200 bytes total).
- The original `sources/standard-of-care/transfer-r02.json` receipt.
- All nine files in `planning/standard-of-care/ancillary-r02/`, including the
  source-based argument candidate, claim/node/leaf tables, manifest, historical
  `checks.json`, README, verifier and tests.

The original source/review bytes and source-local IDs remain intact. The current
source and planning navigation pages are updated separately; the new manifest
records their previous and current staged blobs, and the core manifest binds the
current navigation bytes without changing its original source pins. This is
navigation lineage, not a revision of testimony or a new prose master.

SOC-PUBLIC-01 covers the selected copy. Read [AUTHORIZATION.md](../standard-of-care/AUTHORIZATION.md),
[#2's original instruction receipt](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544)
and [#188's bounded delivery](https://github.com/grwtsk/huey/issues/188).
That scope is already supplied; no renewed permission is requested. References
and the historical `approval` fields locate context, not authenticated runtime
grants. This pass uses already-public Huey Git objects only, not private stores.
No private raw record, new source disclosure or image/audio bytes enter Git.

## Claim and representation boundaries

The imported review retains **70 `ANC-C001`–`ANC-C070` checks**, **16 substantial
support requirements**, **59 ID-bearing source nodes**, and **24 leaf dispositions**.
The original verifier enumerates **358 scalar JSON occurrences** and **14 source
references**. These are different counts with different meanings; do not sum them
as unique factual claims, independent witnesses or corroborating sources. The
core 188 `SOC-C` targets and their 111 support flags remain unchanged.

Exact JSON pointers bind quoted values to the selected records. They do not prove
external events, authenticity, clinical causation, legal responsibility or a
source's claim that something is verified. Source-local IDs and scalar positions
are provenance coordinates, not new Huey EntityIDs or lexical occurrences.

The composition's event date is not its unknown composition date or duration.
Painting metadata is not visual inspection. Preview/null-date and restricted/
published source fields remain separately attributable documentary metadata.
The historical source site's branding, routes, beta state and access settings are
inert content; they neither configure Huey nor establish present availability.
The generated dignity anchor remains unresolved pending its renderer review.
No referenced media or external website is fetched, played or inspected here.

The argument draft remains a proposed passage under #191, not an accepted
manuscript insertion. Its old instruments-chapter placement is provisional under
#404's world → flow → argument cuts → partition → reading order direction. Current
RF-01, Human–System direction and PR-01 govern later adaptation; historical source
words remain unchanged. No chapter cut, ReadingPage or protected close is edited.

## Historical receipts and current checks

SOC-T02's README, `checks.json`, manifest and transfer receipt describe the earlier
copy and source-reading pass. Their original `c920…` comparison, 18-test result,
local output path and three-file remainder are preserved as historical statements,
not fresh execution or a claim that those original source objects were accessed.
Authority/Q03 was subsequently transferred on #122 but remains outside this staging
increment. Two items remain outside that later branch transfer: the ethics
architecture and image; twelve full prose presentation records, whole-export
comparisons and complete conversation capture also remain unresolved.

Run with the repository's supported Python check environment:

```sh
python3 scripts/soc_consolidation.py
python3 scripts/soc_consolidation.py --source-objects
python3 scripts/soc_ancillary.py
python3 scripts/soc_ancillary.py --source-objects
python3 planning/standard-of-care/ancillary-r02/verify.py
python3 -m unittest discover -s tests -v
python3 -m unittest discover -s planning/standard-of-care -p 'test_*.py' -v
python3 -m unittest discover -s planning/standard-of-care/ancillary-r02 -p 'test_*.py' -v
```

The combined checker requires the exact core-plus-ancillary selection, with no
wildcard directory exemption. The ancillary wrapper preflights fixed paths and
bytes before invoking the inherited verifier without export arguments. It does
not fetch missing Git objects; `--source-objects` fails if the selected public
Huey objects are unavailable. No original private-source comparison is implied.
The historical optional exporter is not a hardened custody service and is not
used by this pass. Generated occurrence dumps are not a second manuscript source.
Hosted checks explicitly discover the inherited ancillary tests in their separate
directory. Current execution results belong to the exact PR candidate receipt.

## Existing flow inventory repair

The unmodified starting head fails inventory coverage on
`manuscript/flow/the-brightness.md`; it also leaves
`manuscript/flow/the-words-i-was-asked-to-remember.md` unclassified. Both files
already exist on public staging. Their exact addition commits/blobs are now
registered as partial `support` resources with empty targets, using the existing
workspace mechanism. The commit and #398/#404 references record provenance and
flow policy; they do not supply independent disclosure authority or acceptance.
No prose is read into the projection, no literary entity is minted, and no
chapter or page ownership is assigned. Removing either explicit registration
continues to fail coverage. The compiler and source files remain unchanged.

## Remaining evidence work and next increment

#189/#190 retain media, attribution, operational-status and citation-target review;
#191 retains actual manuscript integration. #126/#127/#145/#176 retain broader
representation, conversation, atomic-claim and support review. #188's earlier
closure is not reopened or converted into factual clearance. #122 stays draft;
only #421's bounded staging acceptance can close here.

The next coherent consolidation is the authority source/review pair (SOC-Q03)
already on #122. Incident and care-law work remain separate. New evidence still
uses the existing [vault handoff](vault-handoff.md), with supporting, contrary,
limiting and contextual relationships recorded separately. This copy receives
no new evidence, creates no certificate or reader evidence binding, and starts
no capture service or watch.

Promotion to `main` remains held for the exact-version journalistic review and
actual human editorial decision. No manuscript acceptance, evidence clearance,
main promotion, deployment, outside contact or edition release occurs here.

Disclaimer: Working draft; claim verification incomplete; not medical/legal
advice or adjudicated findings.
