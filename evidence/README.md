# Huey public evidence area

This directory is reserved for **evidence cleared under the evidence-intake
classification policy for public Git**, plus public-safe certificates/derivatives
for privately held evidence. The current index is empty; importing the protocol
does not admit an evidence item.

Protocol: [planning/evidence-intake/README.md](../planning/evidence-intake/README.md). Tracking: [#335](https://github.com/grwtsk/huey/issues/335).

## Layout

```text
evidence/
  README.md
  index.tsv
  certificates/
    HUEY-EV-....json
  public/
    HUEY-EV-.../
      original.ext
      transcript.verbatim.md
      transcript.normalized.md   # optional
      description.md
  derivatives/
    HUEY-EV-.../
      manifest.json              # exact paths, hashes and sizes of public derivatives
      ...                        # optional sanitized/redacted public derivative
```

No directory in this public repository is private.

Private raw evidence, full private transcripts, private descriptions, private repository names/paths, private raw SHA-256 values, salts, credentials, private identifiers and privileged descriptions do not belong here.

A certificate for private evidence normally contains a salted public commitment.
The public checker verifies its structure, not the withheld bytes or salt. A
certificate records lineage assertions; it does not independently establish
lineage, truth, authenticity, receipt, review, legal sufficiency, disclosure
permission or claim correctness. Reviewer names and review flags remain metadata.

Run `python3 planning/evidence-intake/verify_public_evidence.py` from the repository
root with `requirements-checks.txt` installed. The checker requires exact index and
certificate coverage, confined regular files, compatible custody modes and
matching declared public hashes. It rejects unreferenced files, traversal and
symlinks. See the protocol's executable boundary for description-hash limitations,
private commitments, corrections and semantic privacy review.

An empty public evidence directory or missing public raw object never means that no evidence exists. It may mean the raw item is private, quarantined, not admitted, not yet processed, or outside the public-disclosure scope.
