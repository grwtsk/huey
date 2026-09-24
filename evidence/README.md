# Huey public evidence area

This directory contains **only evidence that has passed the evidence-intake classification policy for public Git**, plus public-safe certificates/derivatives for privately held evidence.

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
      ...                        # optional sanitized/redacted public derivative
```

No directory in this public repository is private.

Private raw evidence, full private transcripts, private descriptions, private repository names/paths, private raw SHA-256 values, salts, credentials, private identifiers and privileged descriptions do not belong here.

A certificate for private evidence normally contains a salted public commitment. It certifies integrity/lineage only; it does not establish truth, authenticity, receipt, review, legal sufficiency or claim correctness.

An empty public evidence directory or missing public raw object never means that no evidence exists. It may mean the raw item is private, quarantined, not admitted, not yet processed, or outside the public-disclosure scope.
