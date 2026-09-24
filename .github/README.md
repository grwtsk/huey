# Hosted repository checks

At the author's explicit request, [Huey checks](workflows/checks.yml) runs on pull
requests targeting `pre-release` and pushes to `pre-release`. GitHub reports the
actual job results on the PR. PR jobs test GitHub's proposed merge commit; the run
records that commit and the PR head. No path filter hides checks on metadata-only
changes. A newer run cancels superseded work for the same PR or branch.

| Check | Scope |
| --- | --- |
| Reader (Node 22.12.0) | `npm test`, content generation, tracked-file drift; first declared Node engine floor. |
| Reader (Node 24.0.0) | Same checks at the second declared engine floor. |
| Reader (Node 22.23.2) | Same checks plus dependency installation and actual Vite build. |
| Literary model and editorial inventory | `npm run test:model`, `npm run test:inventory`, `npm run test:pages`, `npm run test:routes`, alias continuity against the PR base/previous staging head, full registered public-object coverage, selected-source page materialization and deterministic emission. |
| Python repository checks and whitespace | Python 3.12.14 with `requirements-checks.txt`, full unittest discovery, book/catalog/framing/lexical checks and changed-file whitespace. |

The literary-model job pins Node 22.23.2, which exposes Unicode 17.0. The validator
fails on a mismatched segmentation runtime. It remains a separate gate from the
ordinary reader suite and does not narrow `package.json`'s declared engine range.
These three reader versions are samples, not exhaustive runtime compatibility.

The inventory job fetches full repository history plus the two exact public
working commits already recorded in the source audit (PRs #319 and #122). It
checks each registry pin's path/blob and requires every registered public source
object to be available. This is deliberately stricter than ordinary offline
inventory use, where missing objects remain `unavailable-on-this-client` without
erasing literary slots. New source revisions need reviewed scope and an update to
the explicit fetch list when they are outside the fetched history. Restricted
remainder and unavailable prose stay unmaterialized; no private store is queried.

Actions are pinned to full commit SHAs. Jobs use ephemeral GitHub-hosted Ubuntu
24.04 runners, read-only repository permission, no persisted Git credentials and
ten-minute timeouts. No deployment, artifact upload, custom status writer,
schedule, external notification or privileged `pull_request_target` job is added.
Logs contain check results, not an uploaded manuscript bundle.

There is no reviewed npm lockfile. The build uses
`npm install --package-lock=false --no-audit --no-fund`; Vite is directly pinned,
but transitive resolution is not reproducible yet (#315). No cache or `npm ci`
claim substitutes for that missing lockfile.

These statuses are software checks, not required-check branch protection,
authenticated human approval, manuscript acceptance, factual verification,
source/evidence clearance, full Unicode conformance, browser/native accessibility
certification, deployment or release. Native enforcement remains #311. Hosted
availability does not replace local verification; failures or unavailable runs
must be reported as such. The workflow makes no billing or spending-limit changes.

For local reproduction, run the commands in the workflow with its stated runtimes
and source objects. Workflow syntax can additionally be checked with
`actionlint .github/workflows/checks.yml`. Report that separately from an actual
GitHub-hosted run.

The literary-model job also runs `npm run test:traversal` and
`npm run test:paragraphs` for the derived traversal payload and exact legacy/stable
paragraph correspondence, builds
the explicit editorial mode, and checks that build over loopback HTTP with
Playwright 1.58.0 Chromium. This includes history, deep links, input cancellation
and paragraph current/exact links, focus, context choice, evidence adjacency and
browser accessibility properties; it is not native VoiceOver/physical touch
or an accessibility certification. The existing admitted editor/evidence browser
suite also runs over loopback HTTP. Ordinary reader builds assert that the
editorial `traversal.json` and `paragraphs.json` payloads are absent. Neither build
is uploaded or deployed.
