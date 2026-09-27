# Main contract for the synthetic evidence rehearsal

This is the source-neutral contract prerequisite for a guarded synthetic
certificate and private reverse-receipt rehearsal. It adopts the reviewed
contract on `grwtsk/huey` `refs/heads/main`; it does not execute intake, admit an
evidence object, promote staged evidence or enable real evidence admission.
Related work: [#335](https://github.com/grwtsk/huey/issues/335) and
[#307](https://github.com/grwtsk/huey/issues/307).

## Adopted artifacts and provenance

| Artifact | Requirement and origin |
| --- | --- |
| [certificate.schema.json](certificate.schema.json) | Exact public certificate schema from reviewed public draft commit `ff0499bd341de12a31b355b79867b547f19d9b16`. |
| [policy.json](policy.json) | Exact privacy policy from that same draft. Private repository configuration remains unspecified here. |
| [rehearsal-protocol.json](rehearsal-protocol.json) | Explicit synthetic-only requirements for private custody, one matching index row and a reverse receipt verified against the actual public commit. Reviewed and adopted with this change. |
| [../../evidence/index.tsv](../../evidence/index.tsv) | Exact reviewed UTF-8 TSV header from that draft, with no rows admitted by this change. Other branches retain their own history. |

The certificate schema and privacy policy retain their reviewed bytes. The
protocol supplements them for this rehearsal; it is not a replacement schema or
a grant to publish real evidence. A future change to the contract requires
coordinated review with the consuming worker's pinned expectations.

## Requirements at execution

The consuming worker must obtain a fresh successful preflight against the actual
Huey `main` commit with real admission disabled, verify its built-in synthetic
fixture, and obtain the applicable execution authority. Historical staging
receipts and isolated tests do not count as an actual main rehearsal.

The private admission commit comes first. A prepared public certificate is only
a proposal. The certificate and exactly one matching index row must be in the
same actual public commit. The worker then reads that commit's certificate,
index and any reviewed derivative bytes, verifies their bindings and privacy
constraints, and only afterward appends the private reverse receipt and custody
event. The receipt names the actual full public commit SHA. It cannot name an
uncommitted export or imply human review, authentication or substantive truth.

For the private-custody rehearsal, raw bytes, full transcripts and descriptions,
salts, private fingerprints, identifiers and custody locators remain private.
The public record uses the specified salted commitment with a null public raw
path and no raw hash. A failure never causes public fallback.

Two details of the older contracts require explicit handling:

- The schema alone does not enforce every private commitment field or the null
  public raw path. The protocol's mandatory integrity fields, privacy rules,
  index correspondence and committed-byte verification remain additional
  execution requirements.
- The privacy policy's general quarantine entry mentions deferred or minimal
  certification. This rehearsal allows **no quarantine certificate**; the
  protocol forbids it and the certificate schema excludes that classification.
  Unsafe acknowledgement of an object's existence is also prohibited.

## Scope and review

The author's current instruction is to resolve the missing Huey contracts. This
change is operational maintenance under [the pre-release policy's administrative
exception](../pre-release.md#administrative-changes-and-existing-approvals). Its
diff contains only these contracts, an empty index and this explanation. No
source claim, exhibit, clinical fact, testimony or manuscript passage is
introduced. There is no human editorial clearance to infer from this technical
review, and no narrative promotion decision is changed.

The local public checker on `pre-release` and broader staging work are not
imported by this change. Contract availability does not provide a deployed
service or an evidence transaction. Even after preflight succeeds, real
admission remains disabled and the actual synthetic rehearsal remains a
separate, guarded operation.

Disclaimer: Working draft; claim verification incomplete; not medical/legal
advice or adjudicated findings.
