# BYOC backup and distributed evidence privacy

Status: implementation handoff, not an operating backup, grant, compliance certification or legal engagement.
Master: [neurology #101](https://github.com/grwtsk/neurology/issues/101).
Bounded handoff: [Huey #79](https://github.com/grwtsk/huey/issues/79).
Requirement/stage map: [distributed-evidence-privacy.json](distributed-evidence-privacy.json).

## Selected direction and source boundary

The author selects Google Drive as the first backup integration, secondary iCloud integration, bring-your-own-cloud choice, private client-held shards, browser idle synchronization, distributed Construct execution, specific grants before private tensor population, conditional review and appropriately governed attention routing. This extends the receipt-only facility, not the book's content or the public collection. There is no need to ask the author to choose these goals again.

The blank deposit interface remains receipt-only. It must not become an interviewer, evidence adjudicator or automated crisis counselor. The new private storage, review and governance interfaces are separate capabilities. No private source text, live cloud account binding, credential, source key, legal matter or recipient detail is included in this public handoff. Source read access is not redistribution authority.

The plan distinguishes the privacy and preservation targets from guarantees the current implementation has not established. Terms and authorities below were inspected for this work and must be rechecked for the actual account, jurisdiction and release. The earlier source-custody/retention decisions remain separate from mutable beta publication history.

## Provider eligibility before real data

Google Drive remains the first adapter. Google's [Included Functionality](https://workspace.google.com/terms/2015/1/hipaa_functionality/) lists Drive under an applicable HIPAA Business Associate Addendum; that does not establish the status of this user's account. The first real binding must identify the product/account, contracting entity, applicable agreement, exact source collection and recovery arrangement. No existing account or agreement was verified in this handoff.

Apple's [iCloud terms, I.C](https://www.apple.com/legal/internet-services/icloud/) prohibit covered entities, business associates and their representatives from using iCloud to create, receive, maintain or transmit PHI or make Apple their business associate. The secondary adapter remains a synthetic/non-PHI development target. Regulated PHI routing is denied under the current terms, not silently downgraded to personal mode. Encryption is not a contractual workaround.

[HHS cloud guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html) expressly includes no-view encrypted ePHI services in the applicable business-associate requirements. Assess every provider, operator, relay, peer custodian and processor according to its actual role. Do not assume no-key possession is an exemption, or that a patient's own archive and a service operated for a healthcare entity have identical legal status. Preserve the privacy target in either case. A configurable provider interface must reject incompatible destinations rather than make every chosen cloud eligible.

The [Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html) requires administrative, physical and technical safeguards. Compliance therefore needs an actual risk assessment, access and incident procedures, appropriate agreements, operational responsibility, tested recovery and maintained controls. No code test, provider logo, encryption setting or author approval establishes the whole result. Hosting and backup contracts are separate; a Google agreement cannot cover an unrelated service by implication.

## Encrypt before placement; materialize only within scope

Use reviewed authenticated encryption and versioned envelopes before originals or identifying manifests leave their approved plaintext context. Keep source identity, delivery provenance, ciphertext generation, chunk/shard coordinates and coding profile distinct. Opaque storage identifiers must not reveal filenames, diagnoses, people, plaintext hashes or cross-matter equality. Encrypt identifying metadata, private indexes, queries, annotations, tensor state and recipient maps as appropriate to their disclosure risk.

A private bit flag marks a policy constraint; it is not protection by itself. Tensorization, compression, erasure coding and embeddings are not encryption or de-identification. [Research on embedding inversion](https://arxiv.org/abs/2310.06816) demonstrates that particular text embeddings can reveal source text and identifying details; it does not prove that every tensor is invertible. The safe engineering rule is to protect derived representations according to their source and output restrictions.

Storage-only clients may hold or relay admitted ciphertext without receiving source decryption keys. Semantic indexing or tensor population needs an independent current grant binding the principal, source version/ranges, operation, purpose, approved device/processor, output destination, limits and expiry. A narrow range permission must not distribute a whole-source key and hide the rest in the interface. Use suitable protection units or a specifically authorized redacted derivative.

The human bearer of authority is not synonymous with anyone possessing a URL. If transport uses bearer tokens, their theft and replay risks require explicit controls: bounded audience/scope/lifetime, protected storage and an appropriate session/sender-binding profile. A saved query is not a grant. Recheck scope at key release, computation, persistence and disclosure. Revocation blocks future authorized delivery; it cannot recall a plaintext copy or key already retained by an uncooperative recipient. Browser/GPU/process-memory cleanup is best-effort, not a claim of perfect erasure.

## Distributed resilience, not indestructibility

Use an enrolled private replication network, not a public BitTorrent/DHT swarm. A chunk transport may use peer techniques, but public discovery, public magnet descriptors and unsolicited seeding are outside the initial profile. Peers receive only their allowed objects. Network endpoints still create traffic/account metadata; the threat model must state what padding, opaque routing or relays reduce and what they do not hide.

Choose replication or a declared k-of-n erasure-code profile. With a k-of-n design, recovery requires enough distinct valid shards plus the manifest and usable key material. Losing all clients is not necessary to lose recoverability. For example, a hypothetical three-of-five code cannot recover from only two remaining distinct shards. Five logical holders on one device or account are not five independent failure domains. Neither a surviving ciphertext shard nor a hash establishes access to the original.

Keep three lifecycles separate: retained originals/recovery sets; replaceable derived views; and opportunistic client caches. Cache leases and eviction can create a measured availability half-life. That half-life is not decay of the evidence's meaning, permission to erase originals, or a legal retention policy. Repair maintains an approved recoverability target or reports degradation; it must not silently rely on browser caches as the only archive.

Original retirement requires a specifically authorized, authenticated custodian and applicable hold checks, not merely any signed-in individual. Local device owners and browsers can still remove their own cache files. The application cannot forbid their operating system from doing so or prove that every unauthorized copy was destroyed. Distinguish cache eviction, stop-seeding, grant withdrawal, original retirement, provider deletion request, key erasure and verified/unknown physical deletion. Use scoped signed retirement events to prevent repair or old backups from silently resurrecting logically deleted material. Recovery must not restore revoked authority.

## Reuse the idle synchronizer and distributed Construct

The existing [kernel HIIS #126](https://github.com/grwtsk/noeaaeue-kernel/issues/126) and [browser host #80](https://github.com/grwtsk/neurology/issues/80) already separate computational opportunity from permission. Reuse their pinned implementation/profile rather than recoding the equations in an upload component. An idle signal offers bounded work credits. It never supplies a new source grant, user readiness, willingness, reading comprehension or authority to publish.

A device explicitly opts into ciphertext storage/synchronization with storage, CPU, network and other supported resource limits. Pause sets the permitted budget to zero promptly. Do not accumulate catch-up work during suspension. Use permitted local lifecycle/activity signals without exporting a behavioral surveillance record. Signing in or uploading evidence does not enroll a client as a custodian.

[Browser lifecycle documentation](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) explains that pages can freeze or be discarded. Storage and execution are therefore best-effort at the browser layer. Resume from checked state, handle quota eviction and distinguish scheduled opportunity from completed transfer. Optional native/persistent execution would need a separately scoped implementation, not a claim that an open webpage runs forever.

Distribute the same kernel rules and each client's allowed state, not the entire private atlas. Clients cannot create authority by voting, computing longer or returning a plausible result. Define signed issuer/domain ordering and freshness. A first implementation may retain an identified authoritative service for fresh grant/key decisions while distributing verification/storage; it must not advertise unimplemented decentralized consensus. Offline revocation-sensitive actions defer unless a reviewed bounded offline policy actually authorizes them.

## Sealed review, publication and legal confidentiality

Support a private state machine: sealed -> invited review -> attributable review/evidence -> release predicates evaluated -> eligible -> authorized publication. Review may be an explicit prerequisite without being sufficient authority. An author can supply a bounded conditional release grant in advance; satisfying its exact conditions then permits the scoped action, not a new destination or revised text. In its absence, keep the work sealed until a separate publication instruction.

Bind review to the exact draft/version, reviewer scope, relevant supporting or contradicting material, source permissions and any counsel hold. A second account, signature or copied assertion is not automatically independent corroboration. Do not require agreement as a condition of receiving testimony. Preserve competing statements under their authors rather than overwrite them with a consensus narrative. A source change can invalidate the affected review; a privacy change can block release even after a review is complete.

For counsel work, segregate matters, keys, indexes, recipients and exports. Preserve original evidence separately from confidential legal communications. California Evidence Code [952](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EVID&sectionNum=952.) and [954](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=EVID&sectionNum=954.) concern the actual relationship and confidential communication, not a software badge. Encryption or attorney participation alone does not create blanket privilege. An existing document does not automatically become privileged merely by being placed in a lawyer's folder. Record counsel-attributed assessments and unresolved legal scope; do not claim a judicial determination or select an attorney for the author.

## Attention without unauthorized intervention

Keep ordinary reviewer notices, allegations requiring qualified review, and current safety concerns in distinct profiles. A notification can disclose private facts even without an attachment. Default external messages should carry no allegation, medical detail, person name or excerpt; the authorized recipient opens an authenticated scoped view. Record delivery and acknowledgment without claiming those establish understanding, legal notice or acceptance of responsibility.

A source match, an accusation and a reviewed supporting statement do not authorize an autonomous criminal report. Do not notify an alleged perpetrator or institution merely because it appears in a claim. Prepare a bounded recipient/trigger/payload proposal for an accountable human. Supporting and contrary evidence both remain available to the permitted reviewer.

Crisis routing cannot wait for browser idle time or a finished legal case. Nor can an unstaffed encrypted archive promise crisis detection or emergency response. Historical testimony, quotation, fiction, dysarthria or silence cannot be treated as automatic evidence of present danger. Any semantic review requires its own source/processing grant and actual operational coverage. HHS [serious/imminent-threat guidance](https://www.hhs.gov/hipaa/for-professionals/faq/what-constitutes-serious-imminent-threat-that-would-permit-health-care-provider-disclose-phi-to-prevent-harm-patient-public-without-patients-authorization-permission/index.html) is scoped to applicable healthcare actors, professional judgment and law; it is not an unrestricted platform disclosure permission. No such monitor or external reporting is activated here.

## Filed implementation and human gates

| Issue | Scope |
|---|---|
| [N101](https://github.com/grwtsk/neurology/issues/101) | Controlling extension epic |
| [N102](https://github.com/grwtsk/neurology/issues/102) | Risk model, legal roles, provider eligibility and compliance evidence |
| [N103](https://github.com/grwtsk/neurology/issues/103) | Human: actual Google account, scope and recovery binding |
| [N104](https://github.com/grwtsk/neurology/issues/104) | BYOC adapter and Google-first encrypted backup/restore |
| [N105](https://github.com/grwtsk/neurology/issues/105) | Secondary iCloud prototype; regulated PHI denied under current terms |
| [N106](https://github.com/grwtsk/neurology/issues/106) | Opt-in browser ciphertext cache and private synchronization |
| [N107](https://github.com/grwtsk/neurology/issues/107) | Sealed reviewer contributions and conditional release |
| [N108](https://github.com/grwtsk/neurology/issues/108) | Matter isolation and actual privilege review |
| [N109](https://github.com/grwtsk/neurology/issues/109) | Separate human-governed attention profiles |
| [N110](https://github.com/grwtsk/neurology/issues/110) | Human: exact attention recipients and operational coverage |
| [N111](https://github.com/grwtsk/neurology/issues/111) | Integrated privacy/recovery/regulated-release evidence |
| [K145](https://github.com/grwtsk/noeaaeue-kernel/issues/145) | Encrypted shards, manifests and key custody |
| [K146](https://github.com/grwtsk/noeaaeue-kernel/issues/146) | Scope-bound private materialization |
| [K147](https://github.com/grwtsk/noeaaeue-kernel/issues/147) | Retention, leases, cache half-life and authorized deletion |
| [K148](https://github.com/grwtsk/noeaaeue-kernel/issues/148) | Distributed rule/authority state and client computation |
| [H79](https://github.com/grwtsk/huey/issues/79) | This source-free book integration handoff |

N103 and N110 are assigned to the author. They become actionable only after the actual account/operations or recipient/coverage packet exists. Reuse Huey #2, kernel #135 and neurology #93/#96 for their original scope. Provider prohibition, failed security checks and unsupported capability are technical/legal blockers, not choices human approval can turn into evidence.

The first ready work is the N102 source-free risk/eligibility matrix and N104 synthetic backup contract. Existing local intake work remains independently ready. No regulated account activation waits for all peer/review features, and no packet waits for approval of itself before preparation. Future real peer/counsel/hosting decisions create narrower human issues only when their concrete context is known. The JSON is a stage plan, not a running scheduler or permission engine.

## Acceptance boundaries

Owning implementations must test: exact encrypted restore; wrong/unknown provider rejection; missing keys/manifests; distinct-shard thresholds and correlated failures; source/recipient isolation; revoked authority and stale restore; lease eviction versus original deletion; repair suppression after retirement; frozen/discarded browser behavior; scoped tensor materialization; unauthorized release despite supporting review; confidential notice payloads and disabled unstaffed crisis routes.

Those runtime scenarios are requirements, not results of this documentation change. Completion of H79 establishes a checked handoff only. It does not close any facility implementation or human gate, move current evidence, establish HIPAA compliance, enroll a peer, create privilege, publish the book or start unattended work.
