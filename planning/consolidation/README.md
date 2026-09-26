# Staging consolidation — working records, not acceptance

[SOC core consolidation](soc-core.md), #406/#407, and the
[ancillary pair](soc-ancillary.md), #421/#422, are staged. The current scoped
addition is the [SOC-Q03 authority source/review pair](soc-authority.md), #423:
nine unchanged files from PR #122, preserving unresolved review and historical
receipts. The register below remains the dated #384 audit; these later increments
do not claim that the entire development branch has merged or its claims are verified.

Work: [#384](https://github.com/grwtsk/huey/issues/384). Inspected staging base:
`ab501a00c167f6d85de59e4e22920dd3e2c5b546`, 2026-09-24. The author directed
branch consolidation into `pre-release`, noting evidence references and preserving
the integrity gate before `main`. This increment consolidates public historical
progress records and the evidence-intake foundation. It changes no manuscript,
ReadingPage identity, admission, evidence binding or source-service endpoint.

## Historical records and explicit supersession

[legacy-receipts.json](legacy-receipts.json) pins the 20 files from 18 chapter and
movement PRs, their exact public heads and original blob identities. Their bytes
remain unchanged. They record earlier work and claimed checks, not new execution
receipts. None contains the full private chapter it describes. Missing prose is
not an omission or permission to reconstruct it.

**Current instructions supersede incompatible statements in these records.**
Use the live master, root AGENTS, RF-01, #380's title/reveal correction, and the
current pre-release policy. Historical next-task directions, no-hosted-check
statements, counts, title instructions and draft/merge prohibitions are dated
context. In particular, IDENTITY-R01 is not the current framing contract. Preserve
its original claims and the later correction as separate events.

`python3 scripts/consolidation.py` checks this import's exact metadata and bytes;
`python3 -m unittest discover -s tests -p test_consolidation.py -v` exercises its
failure boundaries. This does not establish the truth of a historical work report
or acceptance of its manuscript. Original branches and discussions remain intact.

## Branch dispositions at this audit

| Branch work | Staging action / remaining boundary |
| --- | --- |
| #83–#95, #97, #117, #118, #120, #121 | Retargeted from `main` to `pre-release`, preserving each head; exact public progress files selectively consolidated here. Original draft PRs remain historical discussion, not proof of accepted prose. |
| #122, `ff0499bd341de12a31b355b79867b547f19d9b16` | Retargeted to `pre-release`. Only the eight `planning/evidence-intake/` and `evidence/` foundation files are taken in this increment, with validator/docs changes described below. The larger authorized SOC corpus, candidates and calculations remain pinned on this draft branch for a separate review. Its root policy/README changes are not blindly overlaid on newer instructions. |
| #319, `5e936adb132d22d8f0d5c41799591896535abd21` | Already targets `pre-release`. Its public companion material and proposed C08A replacement remain separate candidates. The replacement changes paragraph membership and needs explicit reconciliation; public-copy permission is not canonical adoption or inherited evidence. |
| #377, `fd12406b4876f2e7c853d34d8607f0ff551d7be2` | Already targets `pre-release`; engineering reconciliation work remains open. Its earlier hosted receipt does not test the subsequently changed staging base. |
| #383, `3960cbcd78471e2f1d21bd28d7f942a63a6f1fc4` | Already targets `pre-release`; access-contract documentation remains separate. Its inspected hosted run had a failing repository/whitespace job, so no passed full gate or merge is asserted. |

The 19 retarget operations changed no head commits. They redirect review rather
than accept every branch's contents. This is a point-in-time register, not a live
completion service. Check current heads and discussions before further work.

## Evidence-intake provenance

The original eight files come from PR #122 at the exact revision above, under
[#335](https://github.com/grwtsk/huey/issues/335) and the later delegated-classification
instruction in [#2](https://github.com/grwtsk/huey/issues/2#issuecomment-5791575726):

- `planning/evidence-intake/README.md`
- `planning/evidence-intake/CODEX-WORKER.md`
- `planning/evidence-intake/policy.json`
- `planning/evidence-intake/certificate.schema.json`
- `planning/evidence-intake/private-manifest.schema.json`
- `planning/evidence-intake/verify_public_evidence.py`
- `evidence/README.md`
- `evidence/index.tsv`

The public certificate schema is preserved byte-for-byte because the existing
vault exporter pins it. Schema edits require a coordinated versioned bridge
change. The verifier is strengthened here and documented limitations are made
explicit; this is a selective consolidation, not a claim that every imported file
is unchanged. The public index remains empty. No source/evidence item is admitted.

See [evidence references](evidence-references.md) for existing claim/source
apparatus, and [vault handoff](vault-handoff.md) for actual capture capabilities.
Those references are navigation and provenance metadata, not authenticated
Instruction/Grant objects. The private vault remains the raw-custody system;
there is no second evidence database in Huey.

## Promotion remains held

No human journalistic-integrity decision is supplied by this consolidation.
Use [the promotion review record](../pre-release-review.template.md) for each
actual candidate: exact claim/exhibit, source/version/location, inspected access,
attribution, independence, contrary evidence, uncertainties, response opportunity,
rights/privacy and responsible human disposition. A source reference alone leaves
support unresolved. New contrary material reopens the affected review under #71.

The existing main history protections were read back; server-enforced promotion
review remains #311. This PR does not install or imply that enforcement. No
main promotion, deployment, edition release, outside contact or automatic monitor
occurs. #307/#314/#326/#353/#370 and manuscript acceptance gates remain open.

Disclaimer: Working draft; claim verification incomplete; not medical/legal
advice or adjudicated findings.
