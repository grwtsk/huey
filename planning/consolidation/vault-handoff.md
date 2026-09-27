# Existing vault capture → reviewed Huey certificate

This is a source-neutral implementation handoff for #384/#307/#335. The private
vault retains raw evidence and private provenance. Huey holds only allowed public
certificates, derivatives and claim references. It is not a second vault, a
permission engine, or an automatic publication destination.

## Capability actually inspected

The existing local vault code implements a deliberate command-line path:

1. Quarantine/preserve an original under an opaque evidence ID.
2. Complete the private classification, transcript/description and source-family
   relationship record, retaining uncertainties and the exact original.
3. Admit the reviewed private package with immutable raw-byte checks and custody
   events; partial failure is not a completed receipt.
4. Export a separately prepared public release record into a Huey checkout. The
   exporter creates a certificate/index proposal and optional explicitly allowed
   derivatives; it does not commit them or make a disclosure decision.
5. Review that exact public diff, run Huey's verifier and commit through the
   staging workflow. A commit does not establish substantive support.
6. Return the exact public commit to the vault's reverse-receipt command. It
   checks the committed certificate/schema/index/derivatives and appends private
   custody events. `INDEXED` denotes that certificate/index binding, not completed
   semantic search, claim review or manuscript acceptance.

The local vault implementation and the remote repository's default application
branch differ. This inspection did not push, reconcile or deploy either tree.
The local configuration remains disabled for real admission. A working synthetic
flow does not prove that real custody is enabled, that existing sources have been
admitted, or that hosted upload/search is operational. Inspect the actual private
checkout and applicable scoped instructions before any real intake; missing
configuration never causes public fallback.

The inspected tools provide no automatic change feed, ongoing claim watch or
HTTP intake facility. New deposits require the deliberate capture/export/receipt
flow above. No recurring worker is started. The older [web intake plan](../intake-facility.md)
and [claim-watch design](../raw-intake-and-claim-watches.md) remain separate
unimplemented service work; they are not evidence that this CLI is deployed or
prerequisites to acknowledging a local synthetic receipt.

## Operator handoff

Read the vault's own current AGENTS/instructions and use its tools in that
checkout. Private package paths, release records, credentials, object hashes,
salts and exclusion lists stay there. The generic existing commands are:

```sh
python3 tools/export-huey-certificate.py --package <reviewed-private-package> --huey <huey-checkout> --release <private-release-record>
```

Then review the public candidate **before staging it** and run in Huey:

```sh
python3 planning/evidence-intake/verify_public_evidence.py
python3 -m unittest discover -s tests -p test_evidence_intake.py -v
```

After the public commit exists, use the vault's reverse receipt:

```sh
python3 tools/intake.py receipt --package <reviewed-private-package> --vault <vault-checkout> --huey <huey-checkout> --huey-commit <exact-public-commit> --private-terms-json <private-exclusion-list>
```

These placeholders are documentation, not shell-ready private configuration or
permission to execute an intake. Apply the existing scoped instruction rather
than asking the author to retell or manually preclassify every source. A new
ungranted disclosure or unresolved existence-sensitive item stays private.

## Compatible public boundary

`planning/evidence-intake/certificate.schema.json` retains the exact #335 bytes
from public PR #122. The local exporter pins that schema; changing it independently
would break the bridge. Certificates use `HUEY-EV-<UUIDv4>` and
`evidence/certificates/<ID>.json`. Private raw uses a salted commitment, with raw
SHA-256 and custody locators retained privately. The index contains no raw source
bytes. Certificate-only exports are supported; a public derivative is optional.

Derivative exports may include `evidence/derivatives/<ID>/manifest.json` with
exact public derivative paths, byte counts and hashes. Those public derivatives
remain transformations, not replacements for the original. No value called
`review`, `public_disclosure_reviewed`, `source_authenticated` or `human` can
supply authenticated authority by itself. They are assertions/receipts requiring
external review; the checker cannot authenticate their authorship or truth.

The current exporter rejects an existing ID rather than overwriting it. Later
correction/supersession needs explicit versioned coordination in the vault and
Huey; do not mint a fresh ID to hide a correction or count duplicate bytes as
independent corroboration. Claim linkage still requires the contribution/limits
record described in [evidence references](evidence-references.md).

## Executed scope and limits

The vault's existing 57-test suite ran on synthetic temporary packages/repositories.
It covered private capture, export, separate public commit, reverse receipt and
hostile disclosure/tamper cases. No actual evidence/index was inspected. The
additional interoperability check exercised certificate-only and sanitized
synthetic derivative exports against this imported Huey schema and validator,
then verified each reverse receipt. Exact commands and outcomes belong in this
PR's execution receipt, including any failure and subsequent rerun.

Public schema/byte/path checks do not detect every sensitive sentence inside an
allowed text field or derivative. Human/source-aware disclosure review remains
necessary; the exporter is not a sanitization oracle. No source service, actual
passkey, live deployment, private-record acceptance or main promotion is claimed.
