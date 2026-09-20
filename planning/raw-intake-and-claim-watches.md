# Raw intake and claim-level evidence watches

Status: proposed design, not an enabled upload endpoint, source grant or monitor.
Work: [Huey #75](https://github.com/grwtsk/huey/issues/75).
Parents: [source custody #16](https://github.com/grwtsk/huey/issues/16) and [claim ledger #18](https://github.com/grwtsk/huey/issues/18).

## 1. Design objective and authority

The author's current conversation proposes adding upload functionality to the Railway-volume proxy, depositing raw evidence incrementally, and using monitored search links and grants to correct specifics during book work. The intake must not require the author to retell, sort, summarize or pre-classify the evidence before it is received. This document records the proposal under the standing issue-work delegation; it does not turn a feasibility question into a production operating grant.

The previously selected architecture remains: the kernel service wraps durable source storage and manages access filtering; grwtsk.com supplies the Reader interface; Huey carries book coverage references rather than a second evidence corpus. The selected architecture is recorded in [the author's comment](https://github.com/grwtsk/huey/issues/16#issuecomment-5746275749). Upload is sufficient as the intake layer, but receipt, extraction, search, claim assessment and publication must remain distinct.

## 2. Inspected state, not assumed implementation

Inspection used the connected GitHub and Railway tools. Huey's base was `c3fa73a717f2ad42678c795be5cfb3127adee2c4`. Its catalog remains link planning, not an operating evidence store. Neurology's inspected README blob `61b2511c3ac7e61916425756d71c1594fd0e97f0` describes Git-canonical publication data, Node-controlled Reader access, and security/log state on `/data`, not a persistent source catalog.

The accessible Railway project/service-name lists did not identify a service named exactly `railway-volume proxy`; repository searches did not establish that component's implementation either. This is a discovery limitation, not proof that it does not exist. Before editing or deploying the upload path, locate its actual source, service, environment, volume and authentication boundary. Do not invent a second proxy to resolve a naming ambiguity. No operational variables, file contents, volume state or backup configuration were verified by the service-name inspection.

Railway's current documentation describes persistent service volumes and direct CLI uploads. Those platform facilities do not themselves provide the proposed claim ledger or record-level authorization. Its volume reference also describes one volume per service and no replicas with volumes. Design a bounded single-writer storage host or a separately reviewed storage architecture; do not assume two services can mount one shared disk. References: [using volumes](https://docs.railway.com/volumes), [volume reference](https://docs.railway.com/volumes/reference), [CLI volume operations](https://docs.railway.com/cli/volume).

## 3. Deposit first; interpretation later

The default interaction is: choose files, select an already established private intake collection, upload, receive a quiet receipt, and leave. Support ordinary keyboard-operated file selection as well as optional drag/drop, supported folder/archive inputs, resumable batches and pause/cancel. No mandatory event date, subject label, claim assignment, synopsis or preview. Details and excerpts are opened only deliberately. Missing information creates a pending metadata field, not a demand to recount an experience.

Separate the following processing states:

`receiving -> received -> integrity_checked -> processing -> indexed -> assessment_pending -> assessed`

Also represent interrupted, quarantined, unsupported, encrypted, partially extracted, failed and access-blocked states. Receipt does not mean indexed; indexed does not mean reviewed; reviewed does not mean true. Storage acknowledgement must follow actual durable finalization, not the start of a browser transfer.

A covering collection-level policy can identify a depositor, purpose, allowed processors/actions/destinations, storage limits and retention. Future deliberate uploads to that collection can fall within this explicit selection rule. Per-file receipts record their exact bytes; the author should not have to preapprove a hash that does not yet exist, grant every parser step, or revisit every document. The intake label must explain the policy briefly. Without processing authority, storage-only intake must remain storage-only. Upload never implies agreement with the uploaded contents, permission to train, permission to publish, or permission for every Reader to inspect them.

## 4. Preserve the original; derive a searchable view

Store admitted original bytes without editorial replacement. Use a generated object identity; keep the supplied filename/folder relationship, source-origin assertions, uploader, batch, size and digest as restricted metadata. Record event time, document date, claimed prior receipt and service ingestion time separately. A digest identifies received bytes; it does not establish what happened before upload or make a document's assertions true.

Preserve native exports, headers, attachment relationships and original containers where admitted. Distinct deliveries and source lineages remain distinct even when bytes match. Deduplication may optimize storage without erasing provenance or treating copies as independent corroboration.

Extract searchable text, page/region/record/time locators and metadata separately, with extractor version and uncertainty. Use embedded text first. Scans and unsupported formats can remain received but unindexed; OCR/transcription requires a supported, permitted processor and fidelity review where consequential. Reprocessing can repair a derivative, never silently replace the original. Redaction creates another scoped view, not an erased source.

The original evidence lifecycle is separate from the website's mutable beta publication lifecycle. Do not reconstruct deleted beta pages or hide predecessor payloads in logs. The still-open [kernel #135](https://github.com/grwtsk/noeaaeue-kernel/issues/135) supplies the exact retention/lifecycle decision. Retaining the trail during analysis is not an undeclared forever-retention or deletion policy.

## 5. Upload and storage security

Require authenticated, authorized upload, streaming/chunk limits, finalization checks, atomic object/receipt handling, overwrite prevention, CSRF/origin checks and bounded retry. Recheck grants when resuming and finalizing. Apply path/symlink/archive containment, decompression quotas, isolated parsers and non-executable storage outside static/public roots. Unknown types may be retained in an approved quarantine without unsafe rendering. Do not send private files to public scanning or other external processing services by default. These controls follow the [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html); sanitization of a view cannot substitute for preserving the original.

Keep originals, indexes, claim text, grants and private receipts out of public Git, build images, generic fixtures, logs, previews and feeds. Preserve the existing Reader boundary; an upload role does not include arbitrary read, edit or delete privileges. All storage, query, download and derived-output paths use current kernel policy through the trusted host. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) supports default-deny and per-request checks, not client-side hiding as an access boundary.

Before the intake is treated as the only copy, test restoration and export of originals plus their manifest. Railway supports scheduled/manual volume backups, but [its backup documentation](https://docs.railway.com/volumes/backups) says wiping a volume also deletes its backups and restores stay within the same project/environment. A separately authorized recoverable copy outside that failure boundary is required by this design. Define encryption/key custody, access-state recovery, quotas and retention in the operational packet. Never restore revoked access from an old backup. No backup or data-processing compliance claim is made from platform selection alone.

## 6. Claim, discovery link, citation and grant

A claim ledger entry should bind a stable claim ID and revision to its precise proposition, attribution, institutional/event scope, dates, epistemic kind and affected manuscript/note locations. Keep supporting, contradicting, qualifying and inherited/duplicate source relationships separate. Every evidentiary edge identifies exact source/version and location, what it establishes, and what it cannot establish. Hypotheses, allegations and documented statements are not adjudicated facts.

Three references have different jobs:

| Reference | Meaning | May change with new uploads? |
|---|---|---|
| Discovery link | Rerun a saved, versioned query over currently permitted records | Results may change; record the query revision and coverage |
| Citation | The exact source version and location actually used in an assessment or edition | No silent replacement with a newer source |
| Grant | Authority for a principal, resource/selection rule, action, purpose, destination and time | Only through attributable authority changes |

Use an opaque link ID and resolve the private query on the server. Do not place source text, secret tokens, private filenames or content digests in public URLs. Source access and claim access must both be satisfied where applicable. A new record matching a claim is not automatically disclosed to every claim reader. An approved collection selection rule can include future records, but the matching algorithm cannot enlarge that rule.

Filters apply before visible result counts, facets, snippets, rankings, relation expansion and notifications. Derived claims themselves can disclose restricted source information and therefore need their own permitted view. Two readers may see different evidence without either view being described as the complete corpus.

## 7. Monitor changes, not conclusions

A proposed watch stores claim/query revisions, source-selection scope, executor, processing grant, recipient scope, authority epoch, index/extractor/profile versions, last successful event cursor, last attempt, backlog/coverage, resource budget and notification settings. The authoritative service owns this state. Huey's public projection contains only permitted opaque references and work status, not a live copy of the private ledger.

After a durable upload/index commit, enqueue affected watches. Also consider extractor repairs, source corrections and access changes. Use a transactional event/queue boundary, idempotent event identities, bounded retries, coalescing and reconciliation after missed events or restarts. A timer or event schedules already-authorized work; it cannot create a grant. Recheck permissions before source read, model disclosure, derived-result storage and notification delivery. Keep failure, stale, revoked and partial states explicit.

Search for contrary and qualifying material as well as support. A new match marks the assessment for review; it does not automatically verify, refute or rewrite it. A run records its actual scope and completion cursor. Not uploaded, not indexed, extraction failed, inaccessible and searched-with-no-match must not collapse into one absence assertion. The service cannot know the entire evidentiary universe merely because the current queue is empty.

Separate deterministic indexing/change detection from model-assisted assessment. No model is necessary for intake and saved-search change detection. Any external model/transcription call requires the actual allowed processor, data scope and budget. A deployed worker or configured scheduled task is required for unattended work; this chat and a saved link are not themselves a continuously running process. No monitor is activated by this design.

An authorized assistant also needs an actual authenticated read/search/change-list integration. A human Reader page or Railway administrative connection does not by itself establish that integration. Return bounded source ranges and exact references through it; do not give a model unrestricted filesystem access or put credentials in issue comments.

## 8. Corrections and author agency

A covering reversible-work policy can allow correction of derived extraction, duplicated metadata, computed dates/quantities where supported, broken locators and the assistant's own factual summaries. Record the reason and supporting source. Do not let clerical correction authorize a changed historical account.

Substantive reassessment produces an attributable claim revision and a proposed manuscript change under existing acceptance gates. Original documents, issued letters, other people's statements and clinical records are not edited by this pipeline. A document saying something is evidence that it says it, not automatic proof that its account is correct. Preserve counteraccounts and uncertainty instead of selecting whichever source arrived last.

Escalate only the smallest genuinely unresolved decision, after source search. The author can defer it without blocking unrelated work. Never require renewed autobiographical narration to make an upload count as received, infer assent from silence, or display sensitive excerpts to pressure an answer. Routine technical completion can follow the standing work delegation; new readers, wider disclosure, publication, material autobiographical changes and unresolved lifecycle choices remain human decisions.

## 9. Staged ownership and acceptance

| Stage | Owning work | Completion evidence |
|---|---|---|
| Intake UI and actual proxy discovery | [neurology #89](https://github.com/grwtsk/neurology/issues/89) | No-narration resumable synthetic upload through identified host |
| Durable receipt, original storage and recovery | [kernel #137](https://github.com/grwtsk/noeaaeue-kernel/issues/137), contract [#136](https://github.com/grwtsk/noeaaeue-kernel/issues/136) | Byte-identical restart/restore; tested scope and failure handling |
| Filtered catalog/search | [kernel #138](https://github.com/grwtsk/noeaaeue-kernel/issues/138), [neurology #87](https://github.com/grwtsk/neurology/issues/87) | Distinct readers receive only currently permitted views |
| Claim watches and executor bridge | [kernel #140](https://github.com/grwtsk/noeaaeue-kernel/issues/140), [Huey #18](https://github.com/grwtsk/huey/issues/18) | New evidence creates scoped review work with a fixed citation |
| Real activation and backup/processor packet | [neurology #88](https://github.com/grwtsk/neurology/issues/88), [Huey #2](https://github.com/grwtsk/huey/issues/2), kernel #135 | Actual authorization, exact service/source bindings and recovery evidence |

The upload-only milestone need not wait for every book claim, the complete mathematical research programme or model integration. It does require tested confidentiality, durable receipt, accepted retention/processing limits and an honest recovery boundary. Synthetic implementation and proposal drafting do not wait for permission to process real records. Dependencies are stage-specific body links, not claimed native GitHub dependency objects.

Required synthetic acceptance scenarios for the owning runtime tests:

1. Interrupted batch resumes; unfinished bytes never become a searchable admitted original.
2. Identical filename/different bytes cannot overwrite; identical bytes in distinct deliveries retain lineage.
3. Scanned, encrypted or failed extraction remains visible as incomplete coverage, not absence of evidence.
4. New conflicting evidence marks one affected claim for review without making an automatic factual judgment.
5. A copied assertion does not count as a new independent observation.
6. The same discovery link returns distinct permitted views for two readers; guessed links confer nothing.
7. Revocation between queueing and delivery blocks newly unauthorized source and derived-output disclosure.
8. A parser repair on unchanged original bytes rechecks affected watches with new extraction provenance.
9. Crash/retry/missed-event reconciliation does not lose uploads, duplicate logical updates or grow work without bound.
10. Restore preserves original bytes and exact citations without reviving revoked access or beta predecessors.
11. Quiet upload/receipt and deferred review work without required narration, preview, drag precision or rapid answers.
12. No-model/offline-assessment mode preserves deposited originals and reports unperformed review honestly.

These are specified scenarios, not tests executed by this documentation PR. Completing #75 does not close #16, #18, any runtime issue or any human gate. No raw source, grant, credentials, monitor, publication or deployment is created here.
