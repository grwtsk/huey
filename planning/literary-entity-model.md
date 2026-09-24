# Huey literary entity model v1

Normative foundation for [#348](https://github.com/grwtsk/huey/issues/348), within
[#347](https://github.com/grwtsk/huey/issues/347). Profile: `huey-literary-model/1`.
This contract defines Huey's literary vocabulary and identity invariants. It does
not migrate the manuscript, compile Markdown, accept prose, or admit evidence.

The [machine-readable profile](literary-model/v1.json),
[synthetic examples](literary-model/examples.json),
[hostile cases](literary-model/hostile.json), and
[read-only checker](../scripts/literary_model.mjs) make the bounded contract
testable. They are conformance fixtures, not a second manuscript database. Only
synthetic text belongs in those fixtures. No existing source admission changes.

## Ownership and governing distinctions

**Huey owns literary meaning. Shard identity more finely than storage.** An
addressable word occurrence does not need its own file. Human-readable Markdown
remains the prose source; future sidecars may preserve logical IDs and mappings
without becoming a competing editable prose master. Generated graphs and reader
JSON must remain derived, version-bound representations.

The following distinctions are requirements, including when a future adapter uses
the same primitive data type for both sides:

```text
route != entity identity
ReadingPage != Chapter
paragraph ordinal != paragraph identity
Git path != entity identity
token != lexical occurrence
lexeme != lexical occurrence
glyph != grapheme
style != inscription
edit != committed state
source provenance != literary revision lineage
Git commit != manuscript acceptance
```

Kernel/Construct may provide generic identity, structure, restrictions and
operational receipts. Huey supplies the literary interpretation. These entities
are not K2 mathematical constructs or `VerifiedSyntax`. A structural digest binds
represented state, not literary truth, source authenticity or permission.
[Kernel #153](https://github.com/grwtsk/noeaaeue-kernel/issues/153) and Huey #362
own the future bridge. Kernel #125/#127 authority admission is unfinished; this
profile implements no permission engine or authority runtime in a browser or host.

## Vocabulary

An **Entity** is an independently addressable literary or presentation object.
Its **EntityID** names its continuing identity; an **EntityVersion** names one
exact represented state. An **Occurrence** is a particular inscription occurrence,
not an equivalence class of equal strings.

| Kind | Literary meaning and boundary |
| --- | --- |
| Work | The continuing literary work. An edition, reading session or Git checkout does not replace it. |
| Matter | Abstract family for the work's broad matter divisions; instantiate the concrete kinds below. |
| FrontMatter | Preliminary matter before the narrative body; not a movement opening duplicated outside the body. |
| Body | Narrative body containing the literary movements. |
| BackMatter | Separately marked reference or supplementary matter; not an explanatory continuation of the narrative close. |
| MatterUnit | A unit such as a title page, contents, note or optional preliminary. Its presence is explicit. |
| Movement | An authorial division of the body. Huey's existing three movements remain unchanged. |
| Chapter | A literary division, independent of printed numbering, file boundaries and reading pages. |
| ChapterPart | An explicit division within a chapter, when the source actually provides one. |
| Section | A structural subdivision; its existence does not automatically imply a scene or argument. |
| Block | A block-level inscription such as a heading or separator; Paragraph is the prose specialization. |
| Paragraph | A particular prose paragraph with continuing identity across ordinary revisions and moves. |
| Sentence | An identified sentence occurrence, subject to literary interpretation; punctuation heuristics cannot establish its identity. |
| LexicalOccurrence | A particular lexical inscription occurrence. Equal words at two locations have two identities. |
| GraphemeOccurrence | A particular extended grapheme cluster occurrence; equal clusters at two locations still have two identities. |
| ReadingPage | An ordered reading projection. It references literary entities without becoming their literary parent or a chapter. |
| PresentationBasis | A versioned basis for presentation, separate from textual inscription. |
| PresentationRelation | A relation of a target to a presentation basis; changing appearance does not rewrite the target's text. |

**Scene**, **Reflection**, **Argument**, and **Transition** are literary-role
annotations, not mutually exclusive structural classes. A section or passage may
carry more than one role. Annotation absence does not establish absence of a role.
Role assertions are attributable interpretation; neither this vocabulary nor its
checker classifies passages automatically. Future finer ranges retain this rule.

**Structure** is the explicit ownership arrangement at a selected state.
**Sequence** is an ordered list of memberships, not an ordinal-based identity
scheme. **Projection** is a view through references, including a ReadingPage or
future TOC. A **Route** locates a projection or entity and may change independently
of it. No final URL grammar is selected here.

**EditorialOperation** names a proposed change; **EditorialQueue** names bounded
pending operations; **Materialization** names producing reviewable source from an
accepted representation. Their schemas, execution and authorization are deferred
to #355 and #358–#361. **RevisionLineage** relates exact earlier and later literary
states and their structural contexts. It is distinct from source provenance and
from the Git commits that happen to store representations of those states.

## Stable identity

New IDs in v1 use `he_` followed by a lowercase UUID v4. Allocate once, retain it
through ordinary revisions, and never recycle a retired ID. The ID contains no
kind, title, chapter number, path, ordinal, route, text digest or tokenizer result.
Fixtures use fixed synthetic UUIDs for reproducibility; production allocation and
collision handling belong to the later identity-persistence work.

There is exactly one record per EntityID in a snapshot. Repeated records in later
snapshots describe the same entity; its kind cannot silently change. Two records
with equal text but different IDs are distinct occurrences, including the two
`the` occurrences and their two `t` occurrences in the fixture. A copy receives
new occurrence IDs; a move retains the existing IDs. An editor must record this
distinction instead of guessing from text equality.

ID syntax alone cannot prove allocation history. A UUID generated from a route or
ordinal and disguised as random would still violate the contract. The checker
rejects positional/path/route strings as IDs, duplicate IDs and collapsed
memberships; it cannot authenticate how an opaque identifier was allocated.

Existing `C01`–`C15`, `C02A`, `C08A`, `C12A` and other legacy identifiers are
preserved in their existing systems. No identifier is reassigned by this PR.
Future migration must keep explicit scoped aliases and old-version resolution,
not reinterpret legacy strings as fresh UUIDs or discard their continuity.

## Exact entity versions

An entity record contains `id`, `kind`, `state`, and `version`. The version is:

```text
hev1: + lowercase SHA-256 hex of UTF-8 bytes:
  "Huey EntityVersion v1\n" + canonical({model,id,kind,state})
```

`model` is exactly `huey-literary-model/1`. `version` itself is excluded from the
input. Canonicalization sorts nonempty printable ASCII object keys ascending,
preserves array order, and joins object members and array elements without
whitespace. String/key escaping and primitive spelling use ECMAScript
`JSON.stringify`; non-ASCII string contents remain literal UTF-8. The checker's
`canonical` function defines this restricted serialization, including numeric-key
sorting; it is not a claim to implement a generic canonical-JSON standard.
String content is preserved exactly. Only well-formed
Unicode strings, booleans, null, arrays, objects and safe integer numbers are
allowed; floats, negative zero and non-finite values are excluded. There is no
Unicode normalization, whitespace normalization, Markdown rendering or case
folding before hashing. Precomposed and decomposed text can look alike while
having different versions. Fixture formatting outside JSON values is irrelevant.

This binds the entity's **local represented state**, not a recursively expanded
subtree, a complete manuscript, an evidence object or source file. A container's
ordered child IDs are in its state; child versions are pinned by the snapshot's
full entity records. Revising a child need not alter its parent's local version.
Resolving an exact historical tree therefore requires its complete selected
snapshot, not just a Work or Chapter version. An EntityID-only reference is
resolved in that snapshot; a versioned endpoint names `{id,version}` explicitly.

Consequences:

- A paragraph text change keeps its ID and produces a new EntityVersion.
- Reordering or moving a paragraph changes its owner containers' sequences, not
  the paragraph's own version when its local state is unchanged.
- A ReadingPage membership change changes that page's version; it does not
  redefine the referenced paragraphs.
- A route-only change changes the route binding, not its target's identity or
  version. A path move likewise does not become a literary revision by itself.
- An annotation or presentation change is distinct from inscription. Evidence
  annotations must remain bound to their actual source/paragraph version.
- Returning to an identical earlier local state may return the same version.
  Separate lineage events preserve the intervening history; a digest is not an
  event counter, timestamp, signature, acceptance or release receipt.

Changing a hashed field or its semantics requires a new EntityVersion. Changing
this canonical profile requires a new model/version namespace and an explicit
compatibility mapping; do not silently reinterpret `hev1` values. Historical
records remain readable under their original profile. A hash collision or the
same claimed version with unequal canonical bytes is an error, never permission
to merge entities.

## Containment, references and order

Ownership is explicit. Structural containers use ordered `children`; textual
containers can use ordered `spans` identifying child occurrences. A child has at
most one owning parent in the selected snapshot. Duplicate memberships, dangling
references, prohibited parent/child kinds and ownership cycles are invalid.
Unplaced entities may remain roots; an incomplete fixture does not pretend to be
a complete book. No owner or order is inferred from file enumeration or names.

A snapshot describes one Huey work, with at most one Work, FrontMatter, Body and
BackMatter record each. This cardinality includes detached roots: a second Body
does not become valid by leaving it unowned. A Body owns only Movement entities;
chapters, sections, blocks and paragraphs cannot bypass that division by attaching
directly to Body. Incomplete or unplaced literary entities may remain roots until
their actual placement is represented. This is not a provisional ownership edge.
At most three Movement records may be represented, including detached ones.
Incomplete snapshots may contain fewer; this does not authorize a reduced or
different complete-book structure. The existing three-movement architecture
remains controlling; the fixture's partial representation does not establish a
complete or accepted book or authenticate movement names and placements.

The machine-readable profile supplies the permitted containment pairs for this
bounded fixture. It is not a demand that every work have every optional level or
that every paragraph already have sentence/lexical/grapheme decomposition.
Unrepresented decomposition stays unknown. Overlapping linguistic analyses belong
to annotations, not rival owning parents. Canonical ownership must not duplicate
an occurrence just because two analyses describe it differently.

ReadingPage `members` and routes are references. The same paragraph may be
referenced by multiple projections without acquiring multiple literary parents.
Reusing its inscription as a second actual literary occurrence instead requires
a new ID and appropriate lineage. A ReadingPage may project matter or paragraphs;
it must not silently turn an ownership relationship into pagination. Cross-chapter
page policy, page ranges, book page order and navigation belong to #349/#351.

Array order determines sequence at the selected state. Display numbers and
positions are derived from that sequence. The fixture's snapshot array is an
ordered example history, not a concurrent editing/reconciliation protocol.
Real concurrent histories require explicit selected versions and conflict handling
under #360; neither last-write-wins nor Git's textual merge establishes literary
identity or accepted order.

## Occurrences and textual boundaries

The fixture's `text` is synthetic plain inscription, not normalized reader text
or a replacement for Markdown. Textual child spans use half-open UTF-16 offsets
`[start,end)` in the owning entity's exact `text`. Offsets are locators within a
versioned state, never stable IDs. The child's text must equal that exact slice.
Sibling owned spans must be ordered and non-overlapping; gaps may represent
unmodeled spaces or punctuation. These spans need not exhaust a paragraph.

Every represented endpoint must be an extended grapheme boundary. A
GraphemeOccurrence contains one complete cluster, not one raw code point, UTF-16
unit or glyph. Combining sequences, surrogate pairs and emoji sequences therefore
must not be split by an ordinary edit. A font's ligatures and glyph shaping do
not replace this textual boundary. The Unicode definition and segmentation
profiles are described in [UAX #29, revision 47](https://www.unicode.org/reports/tr29/tr29-47.html).

The checker uses `Intl.Segmenter` with grapheme granularity, requires the fixture
profile's Unicode 17.0 runtime, and reports Node, ICU and Unicode versions. A
different Unicode runtime produces an explicit unsupported-runtime result; this
requirement applies to the dedicated `npm run test:model` and `npm run model:check`
commands. The root `npm test` runs the reader suite and retains its existing Node
engine range. It does not run or certify the model gate. These checks do not
implement a new Unicode segmenter or certify all scripts, IMEs, browser selection behaviors or
accessibility. Pinning and testing production segmentation across runtimes belongs
to #353/#365; a changed segmentation policy cannot silently reissue occurrence IDs.

Tokenization, lexeme assignment, morphology and syntax are annotations over exact
text states. Their algorithms, disagreements and revisions cannot allocate,
collapse or replace stable occurrence identity. A tokenizer's two equal tokens
cannot justify one occurrence ID. The fixture's selected word and sentence spans
are supplied synthetic examples, not a linguistic authority or universal parser.

## Presence and optional matter

MatterUnit requires explicit `optional` and `presence` fields. Missing data is an
error in this fixture profile, never an implicit omission. Presence is not source
admission, publication status, completed writing or a human decision receipt.

| Presence | Meaning |
| --- | --- |
| `present` | The unit itself is present in the represented matter. Empty content does not prove completeness or acceptance. |
| `pending` | The unit or decision remains pending; no represented content is supplied here. |
| `omitted` | Explicitly recorded omission of an optional unit; not inferred from a missing file or empty array. |
| `absent` | Explicit observation that content is unavailable in this representation; the reason or eventual disposition remains unresolved. |

`omitted` is prohibited for required matter. Pending, omitted and absent units
have no represented children in this profile. The omission fixture is a fictional
decision, not authority to omit Huey matter. Actual optional selections and
omissions still require their scoped #7/#13 decisions. An excluded/unavailable
chapter likewise must not be relabeled omitted simply because it is not served.

## Revision lineage without rewriting history

Retain exact predecessor and successor ID/version endpoints and enough structural
context to distinguish a revision from a move. The fixture's `beforeSnapshot` and
`afterSnapshot` select that context and pin their full entity records. The before
snapshot precedes the after snapshot; the declaration belongs to the latter.
A fixture `move` retains the same exact entity version and changes its direct
owning slot (parent and sequence position, or textual span position). Its owner
sequence versions can therefore differ while its entity endpoints remain equal.
An unchanged root cannot be declared moved. A simultaneous text revision and move
needs separately represented steps here; composed operations belong to later work.

The ordered snapshot context and lineage entry position distinguish these
synthetic declarations; they are not durable EditorialOperation IDs. The fixture
checks bounded `revise` and `move` declarations for consistency. It does not
execute editorial operations, infer missing history or authenticate an editor.

The reserved lineage vocabulary also includes `split`, `join`, `replace` and
`retire`. #368 must implement their full rules, endpoint cardinalities, survival
policy and conflict cases. At minimum it must preserve predecessor versions,
explicitly identify any surviving ID and newly allocated IDs, record retirement
without ID reuse, and avoid silently treating a replacement as the same entity.
If survival is unresolved, preserve the old entities and leave the relationship
pending instead of guessing. Later moves cannot erase earlier lineage.

Source provenance answers which supplied source, record or testimony supports a
representation and with what limits. Literary lineage answers how an inscription
or structure changed. A Git commit can store either, both or neither; Git history
does not supply missing literary operations or evidence clearance. Historical
source text and reviews remain unchanged; a correction has visible before/after
lineage and supersession. No automatic conclusion about truth follows from a
valid endpoint, checksum or lineage declaration.

## Compatibility with the inspected repository

Inspected staging base: `1f5171cf5df9114e1edec18f193c904e6a51f2f8`. This table
describes actual files at that base, not an assumption that an open PR is merged.

| Existing surface | Preservation and eventual adapter responsibility |
| --- | --- |
| `book.yaml` (`huey.book.v1`) | Retain stable chapter IDs, movement assignments, order, explicit status/include fields and canonical source paths. Paths and printed labels are locators. No source tree or manifest migration here. |
| `manuscript/` Markdown | Remains human-readable canonical prose. Planned comment-only files, unplaced files and excluded content must not be discovered or admitted merely because they exist in Git. |
| `reader/content/book.json` | Retain the separate explicit admission allowlist: chapter path, exact Git blob, containing revision and admission reference. Only C08A is served at this base. New identities do not bypass those checks. |
| Excursion legacy identifiers | `book.yaml` uses `E01`; the reader uses `EX`, with display label `E`. Preserve both until a reviewed migration explicitly reconciles their namespaces. This PR creates no alias or new literary unit. |
| `reader/scripts/content.mjs` | Preserve explicit source selection, realpath containment, exact admitted blob checks, deterministic output and evidence validation. Its generated JSON remains derived and noncanonical. |
| `reader/src/text.mjs` | `C08A-p0001` is a position inside a pinned chapter version. Its formatting-run `tokens` are not lexical occurrences. Preserve raw Markdown, normalized plain text, formatting runs and line locators as distinct representations. |
| Existing paragraph routes | Current chapter/ordinal/blob hash routes remain version-bound locators. Future #352/#364 must retain their resolution or visible incompatibility; do not reinterpret an old ordinal as a new stable ID. |
| `reader/content/evidence.json` | Preserve existing claim/source namespaces, exact raw-paragraph SHA bindings, coverage status and `supports`/`contradicts`/`context` relations. Missing annotations remain pending. The current empty ledger is not a claim of no evidence. |
| Evidence paragraph mapping | A later mapping needs the old chapter ID, chapter blob, paragraph ordinal and raw paragraph SHA, plus the selected new EntityID/EntityVersion. Text equality alone is insufficient to choose the mapping. Source ranges remain #363. |
| `reader/src/editor.mjs` | Local contenteditable/DOM presentation remains in-memory drafting. It supplies no accepted canonical state, Git grant or source-map rewrite. Evidence dialogs continue to show pinned admitted wording. |

The public evidence certificate work referenced by #314 is in another open PR;
an `evidence/` implementation is not present at this base. No such implementation
or source service is claimed here. Structural model validity does not certify
literary correctness, independent factual truth, accessibility, human acceptance,
kernel admission, manuscript admission or evidence coverage.

## Verification and handoff boundary

The fixture CLI reads trusted repository JSON using `JSON.parse`; duplicate JSON
object keys are unsupported and must not be supplied. Duplicate entity records
and duplicate ownership are separately rejected. This is not a hostile network
ingestion endpoint or a generic JSON Schema validator. Model changes require both
the ordinary reader suite and the dedicated model gate. From the repository root:

```sh
# Reader suite: the declared ^22.12.0 || >=24.0.0 Node range.
npm test
# Model fixtures and invariant tests: a runtime exposing Unicode 17.0.
npm run test:model
# Fixture-only check, also requiring Unicode 17.0.
npm run model:check
```

The dedicated gate keeps the exact segmentation requirement explicit without
excluding otherwise supported reader runtimes. It first checks the complete
fixture profile, then runs all model tests. On a mismatched Unicode runtime it
fails with `SEGMENTATION_RUNTIME`; no model test is silently skipped or counted
as passed. A passing `npm test` alone is not model conformance.

Run the read-only fixture checker, its deterministic Node tests, the full existing
Python suite, existing reader tests, catalog/book checks, content generation,
available Vite build and whitespace checks. Report actual commands and outcomes
in the PR; do not substitute historical receipts. No browser UI changed here;
native accessibility, full Unicode conformance, source review and real concurrent
editing are not established by these tests.

Before handoff, reread this contract and actual examples for page/chapter,
route/identity, equality/occurrence, Git/lineage and token/word conflation. Check
that generated structure cannot become another manuscript master and that kernel
structure cannot become literary truth. RF-01 and PR-01 apply to documentation,
fixture text and public review records as well as manuscript prose.

After #348 is reviewed and its foundation is available, the next bounded task is
[#349](https://github.com/grwtsk/huey/issues/349), the front-matter ReadingPage
contract and synthetic fixtures. #353 can also build from this foundation; #350
has additional kernel locality coordination. Actual front-matter content remains
with #34/#36/#7 and acceptance with #13. All implementations #349–#368, main
promotion, deployment and release remain outside this PR. No continuation is
scheduled.
