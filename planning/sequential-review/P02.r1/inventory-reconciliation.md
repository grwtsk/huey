# P02.r1 inventory reconciliation

This bounded update adds the exact reviewed P02.r1 source to historical C03 without changing another literary identity, previous source pin, page plan or route. The inspected baseline is preserved byte-for-byte in `editorial-registry-before.json`, blob `4afc7646d39045fa8fb79e7b56044c80d3be2068`.

The sole new source is `sequential-p02`: commit `2cddcde90be5442a57abffd2c0e8191c49429c5e`, `manuscript/01-preamble/03-the-room.md`, blob `ce398b063a82358a9d21531dada4e85eed5f573b`. C03 retains entity ID `he_e7053ccc-323d-40b2-9b80-b4b7497d8e4a` and both prior proposal links. Its availability and nonauthoritative staging annotation now describe the materialized file. #442 is added as the open AVS-date rewrite; it is not a completed source verification.

Local comparison: all 47 slots retained; only C03's staging/access/source/issue fields change. All 44 prior source records, containers and support paths remain unchanged. A 45th source is added. Baseline and updated registry Git blobs were computed locally and matched the GitHub object identities; JSON and reciprocal C03/source references were checked.

The existing complete editorial page-assembly failure remains #441. This update repairs no page-assembly code and creates no new paragraph or route identities. #441 must cover P02 as well as the already staged P01 and front matter. Do not attach evidence links from earlier wording to new paragraphs by filename alone.

Working manuscript; claim verification incomplete. No source authentication, AVS date determination, main promotion or edition release.
