# Versioned evidence-to-literary linkage

This read-only preparation slice of [#363](https://github.com/grwtsk/huey/issues/363)
connects an existing public certificate relationship, an existing claim/incident
target and, when available, an exact admitted literary paragraph. The actual
[ledger](ledger.json) is empty. No evidence has been admitted or substantively
mapped by this implementation. [Transformation planning](../transformation/README.md)
keeps the proposed reading sequence separate from these source relationships.

The ledger is a sidecar to the existing [public certificate contract](../evidence-intake/README.md),
not a replacement. The vault exporter still uses the unchanged certificate schema.
Raw evidence, private locators, private fingerprints, completed analysis templates
and sensitive testimony remain on their permitted restricted surfaces.

## What a link records

The JSON root has exactly `schema: "huey.evidence-linkage.v1"` and `links: []`.
Each future public-safe link has the following fields:

| Field | Meaning |
| --- | --- |
| `id` | Assigned opaque `hl_<UUIDv4>` link identity; not derived from contents |
| `certificate` | `evidenceId`, positive integer `version`, and SHA-256 of the exact **public certificate** bytes |
| `relationshipIndex` | Zero-based index of one relationship inside that pinned certificate |
| `target` | Existing registry name, existing `id`, and SHA-256 of the complete public registry artifact |
| `paragraph` | Null, or the existing bridge's exact six fields: `chapterId`, `chapterBlob`, `ordinal`, `rawSha256`, `entityId`, `entityVersion` |
| `mapping` | `kind` (`quotation`, `derivation`, `context`), `fidelity` (`exact`, `lossy`, `approximate`, `unsupported`, `unknown`), and nonempty `limits` |
| `dependence` | `status` (`unknown`, `copied`, `same-source-family`, `reported-independent`), optional opaque `sourceFamily`, and nonempty `limits` |
| `review` | `state` (`pending`, `assessed`, `needs-reassessment`) and a public Huey issue/PR `reference`, null while pending |

The certificate relationship already contains its target, relation type, permitted
locator, contribution and what it does not establish. Those fields stay in the
certificate rather than being copied into a second ledger. Its target must exactly
match the existing ID selected by the linkage record. The full certificate hash
detects a changed locator, reordered relationship or changed contribution even if
someone leaves its integer version unchanged.

This profile accepts existing IDs from five public registries:

| Registry | Existing artifact | ID family |
| --- | --- | --- |
| `core` | `planning/standard-of-care/claims.tsv` | SOC-C |
| `ancillary` | `planning/standard-of-care/ancillary-r02/claims.tsv` | ANC-C |
| `authority` | `planning/standard-of-care/authority-q03/claims.tsv` | Q03-C |
| `incidents` | `planning/standard-of-care/incident-register/register.json` | SOC-I |
| `care-law` | `planning/standard-of-care/care-law/revision.md` | C unit IDs, explicitly in this namespace |

These registries describe existing assertions and review targets; they do not
establish their truth. The complete artifact pin is deliberately conservative:
any registry change requires explicit reconciliation of a prior link. No new
claim wording or claim identity is minted by the checker.
The loader checks the current registry headers, row structure and ID coverage;
its adapters are bounded to these existing snapshots. New rows, formats or
namespaces need an explicit adapter update, not silent discovery of new targets.

The wider certificate protocol also permits issue and other targets. This first
linkage profile does not resolve those targets. An issue-only certificate remains
valid intake material and waits for an explicit adapter; do not re-export or
rewrite it, or invent a claim ID, to pass this narrower check. A source-family
relationship pointing to another evidence object likewise remains in its original
certificate until an appropriate target adapter exists.

## Representation and review limits

All nine certificate relation types are preserved: `supports`, `contradicts`,
`limits`, `context`, `duplicate`, `same_source_family`, `supersedes`,
`provenance_only`, `unresolved`. The mapping kind and fidelity are separate from
that evidentiary relation. An exact representation can carry a disputed assertion;
a `supports` label cannot make a quotation exact or a statement established.

Null paragraph references are permitted for unknown/unsupported mappings and stay
unlocated. They cannot be marked assessed. Located mappings must match every field
of a binding produced by [the existing paragraph bridge](../routes/paragraphs.md).
That producer checks source bytes, range, raw paragraph hash and stable entity
version. Merely retaining an ordinal, route or inscription is insufficient.

Copied/same-family statuses require an opaque `hsf_<UUIDv4>` family reference.
Duplicate and same-family certificate relations cannot be declared independent.
Distinct delivery/evidence IDs, different hashes or repeated mentions do not
themselves establish independent corroboration. `reported-independent` remains an
attributed assessment, not a result computed from IDs or source labels.

Nonactive certificates can remain pending or needing reassessment, but cannot
support an `assessed` link. Prior versions remain recoverable through Git and the
vault's custody history; this current-ledger checker is not a supersession engine
and never silently resolves an old pin to newer content. Counterevidence requires
renewed review of the affected proposition, not erasure of testimony.

Review states, reference URLs, hashes and a passing check do not authenticate a
reviewer or human instruction. `assessed` does not mean promotion-cleared,
independently proved, reader-published or accepted manuscript. A mapping's fidelity
and substantive contribution still require inspection of the actual authorized
representation and relevant context.

## Commands and checked boundary

Use the repository check environment with `requirements-checks.txt` installed and
Node with Unicode 17.0 (the current CI pin is Node 22.23.2). Activate the configured
Python environment first; alternatively `HUEY_PYTHON` selects its interpreter.

```sh
source .venv/bin/activate
npm run test:evidence-linkage
npm run evidence:check
npm run --silent evidence:index
```

`check` is read-only. `emit` (the `evidence:index` script) returns source, target
and paragraph lookups containing link IDs, plus unlocated links. These are views
over one ledger, not separate inventories or support counts. There is no network
lookup, source retrieval, write, commit, export, watch or publication operation.

For a nonempty ledger the loader first runs the existing Python public evidence
verifier against the selected public checkout, then consumes the pinned public
certificates. It loads the known public targets and current exact paragraph
bindings. It rejects unknown fields, duplicate JSON keys/links, malformed pins,
missing/stale references and unsupported states. Fixed paths and opaque evidence
IDs constrain filesystem reads; reason-only diagnostics avoid echoing submitted
source values. The selected checkout/runtime is trusted, not a sandbox for running
an untrusted repository.

The lower-level JavaScript validator accepts a checked context for composition
and synthetic tests. Calling that function with fabricated context is not a
substitute for the loader's certificate/index validation. The synthetic integration
test uses the real public schema/index verifier with synthetic certificates and
explicitly supplied synthetic paragraph bindings; it does not inspect private
source bytes or perform a real vault admission/reverse receipt.

Closed fields prohibit dedicated private-path/hash fields; they cannot detect
all sensitive information in free-text limits or in a permitted locator. Whole
object and source-aware disclosure review still applies. The certificate's
private commitment is not independently verified here. Likewise, a permitted
locator in a certificate is not a verified mapping into withheld raw bytes.

## Work left open

#363 still owns richer source representation/range resolution and other literary
entity mappings. #377 owns source revision reconciliation; #368 owns lifecycle
lineage. #307 owns actual intake. #314 owns reader projection, including its
narrower relation vocabulary; this tool never writes `reader/content/evidence.json`.
#326 owns substantive evidence emphasis. The separate main-promotion review and
actual human decision remain required under [the staging policy](../pre-release.md).

The next ready action is a reviewed public certificate-to-existing-target mapping
against an exact current paragraph, or an explicit target adapter where needed.
An empty ledger means public linkage is pending, not that no evidence exists.

Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.
