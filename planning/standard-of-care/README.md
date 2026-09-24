# Standards, care burden and trust

> [!WARNING]
> **WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE.** This material includes attributed testimony, allegations, hypotheses, normative arguments and AI-assisted drafts. A citation, commit, issue closure or passing software test is not independent verification. Received medical assertions and subsequent assistant corrections may contain errors. This is not a clinical guideline, medical or legal advice, or an adjudicated finding. Read the evidence and dispositions in the linked issues. Permission to publish working sources is not factual endorsement or acceptance of a finished edition.

## Approval is resolved

The author expressly approved public copies of this discussion, the Atlas and the specified essay collection. [SOC-PUBLIC-01](approval.json), [authorization scope](AUTHORIZATION.md) and [issue #2's receipt](https://github.com/grwtsk/huey/issues/2#issuecomment-5771600544) preserve the instruction. Do not ask again or make evidence-review completion a new publication-permission gate. Raw clinical records/PDFs and unrelated private material remain excluded; site access, the protected book ending, edition acceptance and outside actions are unchanged.

## Source copies and claims

Browse the [working corpus](../../sources/standard-of-care/README.md): complete structured Atlas, twelve authored prose exports, the Standard and Trust conversation drafts, and the earlier context dossier. A prose export is not a whole presentation-JSON copy. The Atlas preserves all parsed values with compact formatting. Original source files are unchanged. Pending ancillary material and representation limits are explicit in the transfer and context manifests.

[Master #125](https://github.com/grwtsk/huey/issues/125) links **30 argument issues (#146–#175)** and **19 initial verification issues (#127–#145)**. [registry.json](registry.json) preserves their stable connections. [claims.tsv](claims.tsv) names **188 initial evidence targets**, each with its verification issue and support level. **111 need substantial support**, coordinated through [#176](https://github.com/grwtsk/huey/issues/176). [support-policy.json](support-policy.json) defines the levels.

Substantial support identifies work needed for complex causal, clinical, legal, historical institutional or quantitative claims, not a conclusion that a claim is false. Unflagged claims are not automatically true. First-person experience remains attributed testimony. Normative arguments and metaphors need reasoning/provenance review rather than fabricated empirical proof.

Every further atomic proposition discovered must get a stable child ID and covering verification issue. Preserve exact words, speaker, source/version/locator, evidence, counterevidence, applicable date/population/jurisdiction and limits. Split compound targets before factual clearance. [#145](https://github.com/grwtsk/huey/issues/145) remains open for this work; the initial index is not a finished sentence audit.

The registry's `source_permission_issue: 2` points to the recorded authority, not a current blocker for SOC-PUBLIC-01. C180's historical reference to a restricted manifest concerns source-version identity; the new grant permits the specified public manifest. Private clinical-record locators remain excluded.

## Notices and local checks

Every new relevant commit must include:

    Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.

Use [the commit template](../../.gitmessage), [claim issue template](../../.github/ISSUE_TEMPLATE/claim-verification.md), and [notice policy](DISCLAIMER.md). No installed hook or hosted enforcement is claimed. Older history is not rewritten.

```sh
python3 planning/standard-of-care/check_registry.py
python3 planning/standard-of-care/check_support.py --message-file .gitmessage
python3 -m unittest discover -s planning/standard-of-care -p 'test_*.py' -v
```

The actual local stage passed **24 tests**, including coverage/routing, duplicate or missing claims, false verification promotion, reopened approval, removed exclusions and missing commit notices. The tested claim data, support checker/tests, approval and policy blobs matched the GitHub tree. This was not a full checkout, full repository suite, hosted CI, clinical/legal verification, or exhaustive semantic review. The concurrent `care-law/` work was preserved unchanged, not represented as newly tested by this pass.

The reconstructed Atlas matched its original source Git hash before normalization; the remote compact blob matched the local compact JSON. That establishes integrity of the representation, not support for every linked proposition. The manual prose exports have not all received an automated byte comparison.

Continue through existing draft [PR #122](https://github.com/grwtsk/huey/pull/122), #124's editorial passes and #145/#176's evidence review. Preserve RF-01, original source status, competing evidence and the author's agency. No repeated approval or retelling obligation is imposed.
