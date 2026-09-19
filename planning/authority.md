# Authority and decision records

## Current execution instruction

The following was received directly from R.A. Jacob Martone in the active conversation on September 19, 2026. This file and [the repository receipt](https://github.com/grwtsk/huey/issues/1#issuecomment-5746181851) are agent transcriptions, not newly human-authored GitHub approvals. No public conversation-message identifier was supplied.

> Begin working through the issues. Open one pull request per response merge the issue if it is complete. If it is blocked mark issues that it is blocked by such that the need for agency becomes gradually more explicit until I the author (R.A. Jacob Martone aka @grwtsk) act.

This starts bounded execution. Interpret "merge the issue" as merging its completed, checked work PR and closing the completed work issue. Exactly one new PR is the response budget, not permission to invent changes. Existing unfinished work may be resumed without duplication. This supersedes setup-only language and permits immediate checked work merges, not unattended auto-merge, bypass of repository rules or publication of an edition.

The instruction is standing workflow authority, not exact-artifact acceptance. Do not enter it into the decision schema with invented artifact approval hashes. The executor must compare each proposed action to the actual instruction and record the reviewed scope and head SHA in the PR receipt. If the original instruction is unavailable or its scope is uncertain, refer the specific uncertainty to the author.

## Separate stages

| Stage | Meaning |
|---|---|
| Proposed | An agent has prepared an option; no human acceptance is implied. |
| Drafted | Work exists on an authorized surface. |
| Verified | Listed checks actually ran against the identified version. |
| Human-accepted | An actual human instruction accepts the identified content or decision. |
| Merged | A reviewed work change entered the repository under workflow authority. |
| Released | An exact edition went to an explicitly authorized destination under #14. |

A workflow merge does not perform the other transitions. Rejected, deferred and revoked decisions remain distinct from accepted ones. Closing an issue alone changes no permission. A new version, destination or meaning requires checking whether existing permission still applies. Optional matter may be explicitly omitted.

## Human gates and progressive blockers

Source custody/disclosure is #2; autobiographical uncertainty #3; participant representation #4; sensitive framing/review #5; rights/imprint #6; personal optional matter #7; narration/voice #8; cutoff and external actions #9; movement acceptance #10 and #11; closing text #12; packaging #13; edition release #14.

Only activate the decision needed by the present stage. Example: source-catalog metadata can be prepared while source-byte import is `Blocked by: #2`. The gate should list `Blocks: #16 (source import)` with the requested decision and safe route. This does not mark all research or infrastructure blocked. If a broad gate requires several distinct choices, open a linked child human issue for the next concrete proposition, not a batch of speculative demands. Keep its assignment with `grwtsk`.

Use an issue-body blocker section with affected stage, blocking issue number, reason, resolution condition and still-ready work. Mirror the link on the blocking issue. Use native relationships only when actually available. Do not erase unrelated dependencies or confuse a later acceptance gate with a draft prerequisite. On resolution, record the actual human instruction, reassess its scope and remove only the resolved blocker.

## Exact-action decision schema

`decisions.schema.json` describes future concrete decisions, not the standing workflow instruction above. It records author identity, transcriber, exact instruction and source reference, input version, output digest, permitted actions/destinations, limits, state, date and revocation. Proposed/rejected/deferred records need not pretend to contain an approval payload. Accepted records must identify it. Expiration is optional and chosen by the human; it is never a deadline imposed for replying.

Store private instruction text through the route approved in #2. The schema's existence does not authorize public storage of its contents. Public projections use non-sensitive IDs/links; preserve the complete decision on its admitted surface.

`scripts/authority.py` is a **read-only decision-consistency checker**, not an authorization service. Its evaluator requires a separately supplied `LiveObservation` from the current execution session. The executor must derive that observation from the original human message and current revocation context, not from a PR fixture, owner username or record's assertions. Reported agent/unknown origin is rejected. An agent transcription may carry a genuine human instruction, but only the independently rechecked original can support it.

The checker binds the reviewed record digest, instruction source, issue, state, session, action, version, destination and output digest. Free-text limits require explicit review for that exact request. It has no credentials, network calls, GitHub writes or release code. A fully forged trusted observation is outside this checker's ability to detect; JSON booleans and hashes do not authenticate a person. Likewise it cannot decide whether prose invents a memory or a title description leaks PR-01. These remain source-aware human/executor reviews. Never describe these tests as security certification.

## Checks

Use Python 3.11 or later and `python3 -m pip install -r requirements-checks.txt`, then `python3 -m unittest discover -s tests -v`. Installation is a local environment step, not enrollment in a paid service. `python3 scripts/authority.py PATH` validates one JSON decision record; exit 0 means structurally valid, **not authorized**. Error output contains fixed reason codes rather than private field contents. Missing or malformed input fails closed.

No CI, auto-merge, protected-branch rule or publishing action is installed in #15. Those are separate work/configuration decisions. Branch policy is checked live before each actual merge; required checks and reviews must not be bypassed.

Implementation references: [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/json-schema-core) and [jsonschema validation](https://python-jsonschema.readthedocs.io/en/stable/validate/). Merge execution uses [GitHub's expected-head SHA constraint](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request). These references explain tools, not the book's literary sources.
