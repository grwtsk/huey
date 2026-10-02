# Verification receipt: bounded middle source crosswalk

**Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.**

The original candidate, local results and failed hosted run below remain dated
history. The 2026-10-01 continuation records current status and a separate
compatibility check; it does not relabel those earlier checks.

Content candidate: `7a586c77ad77c093d309f505337743f8162b7a33`. Base:
`664f9b62d70d7f24e2519918357ec262d86eb6c4`. The three content files were
checked in the full checkout. This receipt is a later documentation-only addition;
it does not describe itself as having been present in the earlier test run.

## Environment and results

Final Python environment: **3.12.14**, with all eight exact dependencies from
`requirements-checks.txt`, installed in an external temporary virtual environment.
The commands below used that environment's `python3`. Node: **22.23.2**, Unicode
**17.0**. No repository dependency or source code was changed for these checks.

| Executed command | Actual result |
| --- | --- |
| `python3 -m unittest discover -s tests -v` | 421 tests passed; no skipped tests. Repeated against the committed content candidate. |
| `python3 scripts/book.py validate` | Book source tree OK. |
| `python3 scripts/catalog.py validate` and `python3 scripts/catalog.py check` | 26 aliases, zero bound sources, service pending; consistency passed, not service verification. |
| `python3 scripts/consolidation.py` | 20 historical receipts / 18 PRs checked; zero original Git objects checked by that tool. |
| `python3 planning/evidence-intake/verify_public_evidence.py` | 44 certificate/index rows passed structure and public-byte checks. This total is distinct from the completed 43-object real batch. No new item was admitted. |
| `python3 scripts/soc_consolidation.py` | 87 selected files, 85 exact copies, two adapted navigation files; copy/registration checks passed. Private packets not read; original upstream Git objects not checked by this tool. |
| `python3 planning/standard-of-care/check_registry.py` | 30 arguments, 19 verification owners, 188 initial targets passed. |
| `python3 planning/standard-of-care/check_support.py --message-file .gitmessage` | 188 targets / 111 substantial-support flags passed consistency checks. |
| `python3 scripts/soc_cl05.py` | Four public files, 78 changed and 189 retained mappings passed in the initial environment; no private checker or historical mutation rerun. |
| `python3 scripts/framing.py cases planning/framing-cases.json` | Declarations consistent; semantic truth not verified by checker. |
| `python3 scripts/framing.py check planning/framing-handoff.example.json` | Declaration consistency passed. |
| `python3 scripts/framing.py scan planning/descent/README.md` | No known pattern flagged. |
| `python3 scripts/framing.py scan planning/descent/middle-reading.md` | No known pattern flagged. |
| `python3 scripts/framing.py scan planning/descent/middle-crosswalk.json` | No known pattern flagged, including final terminology revision. |
| `python3 scripts/lexical_geometry.py validate` and `python3 scripts/lexical_geometry.py check` | Structurally consistent; 41 sources / 29 senses / 25 relations / eight comparisons / 13 research areas. |
| `npm test` | 274 reader tests passed; zero skipped. |
| `npm run build` | Content generation and Vite 8.1.0 local build passed; one admitted reader chapter / 260 paragraphs. No tracked-file drift. |
| `git diff --cached --check` and `git diff --check` | Passed for content candidate. |
| Bounded reference check reproduced below | Twelve public file pins, seven exact existing paragraph spans, Atlas/claim/owner identities, five card references with unchanged relationships/status, three incident targets and R25 identity passed. |

Initial execution with system **Python 3.9.6**, `jsonschema 4.23.0`, and no
`rfc3339-validator` ran all 421 tests but produced five failures: authority timestamp
validation; two evidence schema/format cases; and two lexical CLI error-path cases.
That run is not a pass. A separate environment using the repository's pinned
Python/dependency setup passed all 421; no gate was weakened and no application
code or tests were edited to obtain the pass.

The ad hoc locator check initially scanned its own newly added receipt, including
the prohibited-string literals in the reproduction code, and failed on those
literals. Its final scope explicitly names the three content files; the corrected
check passed. This was a check-scope error, not a discovered private source leak.

## Semantic and source review

The full admitted C08A, three selected public essay exports and the selected
Atlas/claim/incident/care-law/card material were read. The crosswalk pins the public
representations actually used. Source paragraphs, cards and historical receipts
remain unchanged. Scene descriptions preserve author attribution, racial and
relational specificity, separate agency, the available apology/correction and
local uncertainty. No new narration, dialogue, private thought, clinical finding
or protected ending content is introduced.

A read-only assistant review caught and corrected one overbroad edge: a later
letter's quotation limits had been attached to C08A's telephone passage. The final
edge is contextual and expressly excludes that inference, while preserving the
card's existing SOC-C002/SOC-C004 relationships. The mathematical wording was
also made source-bound. The follow-up assistant review found no remaining
substantive semantic blocker for this bounded staging scope. This is agent review,
not independent source authentication or a human editorial decision.

Formal verification, original-source authentication, complete history/chronology
reconciliation, R06–R13 reconciliation, current legal/clinical research, whole-book
semantic review, editorial browser proofs, print/EPUB/audio proofs and human
acceptance were **not** performed by this tranche. Main promotion and release
are not cleared.

## Hosted and editorial follow-up

PR #457 at head `0c132e6a2e57d38cf580c586a1be3ecc49163d67` ran
[Huey checks 36502880564](https://github.com/grwtsk/huey/actions/runs/36502880564).
All three Reader jobs and the Python repository job passed. The literary job
passed its model/inventory steps, then failed during `npm run test:pages` with
`EDITORIAL_PAGES: source role differs from placement`. Subsequent editorial
steps did not execute. The hosted run is **not an all-checks pass**.

Local follow-up: `npm run test:model` passed all 53 tests; `npm run test:pages`
reproduced the placement error before its test runner. The error is already
documented by #441, including the front MatterUnit versus book-group condition
and the later source-plan reconciliation still required. None of
`scripts/editorial_pages.mjs`, `planning/editorial-inventory/registry.json`,
`planning/editorial-pages/plan.json` or `book.yaml` differs from the inspected
base in this PR. No check was bypassed or weakened. The PR remains open, and
this follow-up changes only the source packet's status documentation. A later
hosted run must be reported at its own head rather than inheriting this result.

## Reproduce the bounded reference check

This is the original historical reproduction body, preserved unchanged. Its
working-file equality assertions require the content candidate
`7a586c77ad77c093d309f505337743f8162b7a33`, whose twelve inputs match the pinned
base `664f9b62d70d7f24e2519918357ec262d86eb6c4`. Later plan/inventory versions
intentionally fail those old equality assertions. Use the separate current
compatibility check below for the resumed candidate; do not replace the original
pins or report a changed input as historically identical.

Run from the applicable repository root. The check reads public data and Git
objects; it does not decide truth, disclosure authority, source independence or
acceptance. The original execution used the same body as an external temporary
Python script.

```python
import csv,json,subprocess
from pathlib import Path
root=Path.cwd()
x=json.loads((root/'planning/descent/middle-crosswalk.json').read_text())
paths={s['key']:root/s['path'] for s in x['sources']}
for s in x['sources']:
 assert subprocess.check_output(['git','rev-parse',f"{s['revision']}:{s['path']}"],text=True).strip()==s['blob'],s['key']
 assert subprocess.check_output(['git','hash-object',s['path']],text=True).strip()==s['blob'],s['key']
plan=json.loads(paths['paragraphs'].read_text())
ps=next(s for s in plan['sources'] if s['sourceKey']=='public-01')
assert ps['blob']==next(s['blob'] for s in x['sources'] if s['key']=='baptism')
blocks={b['id']:b for b in ps['blocks']}
prose=paths['baptism'].read_text(); lines=prose.splitlines(); raw=prose.encode('utf-16-le')
principles={p['id'] for p in json.loads(paths['atlas'].read_text())['current']['atlas']['principles']}
claims={r['claim_id']:r for r in csv.DictReader(paths['claims'].open(),delimiter='\t')}
for r in x['crossings']:
 n=r['narrative']; b=blocks[n['entity_id']]
 assert b['kind']==n['entity_kind']=='Paragraph'
 assert [b['start'],b['end']]==[n['source_span']['start'],n['source_span']['end']]
 assert raw[2*b['start']:2*b['end']].decode('utf-16-le')==lines[n['line']-1],r['key']
 assert n['context_lines'][0]<=n['line']<=n['context_lines'][1]<=len(lines)
 assert set(r['atlas']['principle_ids'])<=principles
 for c in r['claim_targets']['ids']:
  assert c in claims
  assert int(claims[c]['verification_issue']) in r['review_issues'],(r['key'],c)
 assert r['does_not_establish']
cards={c['card_id']:c for c in json.loads(paths['cards'].read_text())['cards']}
for e in x['edges']:
 if 'card_id' not in e: continue
 c=cards[e['card_id']]
 assert e['review_status']==c['review_status']
 assert e['existing_relationships']==c['relationships']
 assert e['source_references']==[{'evidence_id':s['evidence_id'],'locator':s['locator']} for s in c['sources']]
 assert e['relationship'] in ('context','limits','unresolved')
i=json.loads(paths['incidents'].read_text()); entries={r[0]:r for r in i['entries']}
for t in x['return_to_care']['targets']:
 assert t['id']==f"SOC-I{t['number']:03d}"
 assert entries[t['number']][1]==t['issue']
r=next(r for r in json.loads(paths['care_law'].read_text())['review_rows'] if r['id']=='R25')
assert r['claim_ids']==['C236','C237','C238','C239'] and r['issue']==183
text='\n'.join(p.read_text() for p in [(root/'planning/descent')/n for n in ('README.md','middle-reading.md','middle-crosswalk.json')])
assert 'chatgpt.com/' not in text and '/Users/' not in text
print('PASS: 12 public source pins; 7 exact existing paragraph spans/context ranges; all Atlas/claim/owner IDs; 5 selected card references with preserved relationships/status; 3 distinct incident targets; R25 identity; no local/private-chat locators.')
```

## 2026-10-01 15:00 UTC continuation

Resumed branch input: `e3bff17fad633264e52cbfc043b321af2f2ebe4f`, incorporating
current staging `43a1fc9fcac8c04f4eefa1b7a8bfeb917eeb8e8d`. The historical
crosswalk JSON, all original public pins, content reading and earlier receipts
are unchanged. Only the two handoff documents receive current-status clarification.

Live #441 is closed for the bounded repair integrated through #463/#477 at
`bdbef69f07da16c32c037e94992e5128a02d7d25` and #462 at
`9589946cba2dcc3fe155b65588be5e72fd9d0a1b`. The old assembly failures are
historical results for their stated versions, not current blockers or current
passes. #461 entered staging separately at
`3edd78677b972b495c5949f426d643f1de8b1a88`; its support movement remains
unadopted and outside the selected canonical reading copy. These integrations
do not supersede this seven-crossing map or authenticate human acceptance.

The checker below was actually run from the resumed checkout with Python 3.9.6.
It passed all twelve historical-pin resolutions, ten unchanged current blobs,
the exact current staging input bytes, unchanged canonical C08A registration,
seven paragraph spans/context ranges, Atlas/claim/owner references, five preserved
card edges, three distinct incident targets and R25. Its current-input equality
is deliberately bound to `43a1fc9`; later input changes require a new source and
compatibility review rather than relaxing that assertion.

The source-aware reread covered full admitted C08A and all three selected public
essay exports, the selected principles/claim rows, five complete public cards,
three incident rows and the historical R25 row, together with all four packet
files. Source status, supplied identities, agency, care/correction and contrary
material remain distinct. The local/private-chat locator assertion checks only
the three content objects and complements that semantic review; it cannot prove
absence of every sensitive disclosure. No new source-fidelity or PR-01 defect
was found in the bounded added object. Complete protected-close comparison,
original-source authentication and broader source/acceptance review remain
unavailable or unperformed.

Full combined repository/editorial suites and both builds are not recorded as
passed by this continuation. They must be run and reported for the actual final
candidate, including remaining failures or unavailable checks. No commit, push,
#457 merge, main promotion or release is claimed by this document update.

### Current compatibility check

Save the following exact Python body outside the checkout and run it from the
repository root. It reads existing public files and Git objects without mutation.
It separates historical pins from current input bytes and checks the selected
relationships against the current plan/registry, without changing the JSON.

```python
import csv
import json
import subprocess
from pathlib import Path

root = Path.cwd()
staging = '43a1fc9fcac8c04f4eefa1b7a8bfeb917eeb8e8d'
x = json.loads((root / 'planning/descent/middle-crosswalk.json').read_text())
paths = {s['key']: root / s['path'] for s in x['sources']}
assert len(x['sources']) == len(paths) == 12
assert len(x['crossings']) == 7

def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()

changed = []
for s in x['sources']:
    assert git('rev-parse', f"{s['revision']}:{s['path']}") == s['blob'], s['key']
    current = git('hash-object', s['path'])
    assert current == git('rev-parse', f"{staging}:{s['path']}"), s['key']
    if current != s['blob']:
        changed.append(s['key'])
assert set(changed) == {'paragraphs', 'inventory'}, changed

registry = json.loads(paths['inventory'].read_text())
historical_registry = json.loads(git('show', f"{x['base_commit']}:{paths['inventory'].relative_to(root)}"))
source = next(s for s in registry['sources'] if s['key'] == 'public-01')
old_source = next(s for s in historical_registry['sources'] if s['key'] == 'public-01')
assert source == old_source
assert source['role'] == 'canonical' and source['extent'] == 'full'
assert source['targets'] == ['C08A']
assert source['blob'] == next(s['blob'] for s in x['sources'] if s['key'] == 'baptism')

plan = json.loads(paths['paragraphs'].read_text())
ps = next(s for s in plan['sources'] if s['sourceKey'] == 'public-01')
assert ps['blob'] == source['blob']
blocks = {b['id']: b for b in ps['blocks']}
prose = paths['baptism'].read_text()
lines = prose.splitlines()
raw = prose.encode('utf-16-le')
principles = {p['id'] for p in json.loads(paths['atlas'].read_text())['current']['atlas']['principles']}
with paths['claims'].open() as stream:
    claims = {r['claim_id']: r for r in csv.DictReader(stream, delimiter='\t')}
for crossing in x['crossings']:
    n = crossing['narrative']
    b = blocks[n['entity_id']]
    assert b['kind'] == n['entity_kind'] == 'Paragraph'
    assert [b['start'], b['end']] == [n['source_span']['start'], n['source_span']['end']]
    assert raw[2*b['start']:2*b['end']].decode('utf-16-le') == lines[n['line']-1], crossing['key']
    assert n['context_lines'][0] <= n['line'] <= n['context_lines'][1] <= len(lines)
    assert set(crossing['atlas']['principle_ids']) <= principles
    for claim in crossing['claim_targets']['ids']:
        assert claim in claims
        assert int(claims[claim]['verification_issue']) in crossing['review_issues']
    assert crossing['does_not_establish']

cards = {c['card_id']: c for c in json.loads(paths['cards'].read_text())['cards']}
card_edges = [e for e in x['edges'] if 'card_id' in e]
assert len(card_edges) == 5
for edge in card_edges:
    card = cards[edge['card_id']]
    assert edge['review_status'] == card['review_status']
    assert edge['existing_relationships'] == card['relationships']
    assert edge['source_references'] == [
        {'evidence_id': s['evidence_id'], 'locator': s['locator']} for s in card['sources']
    ]
    assert edge['relationship'] in ('context', 'limits', 'unresolved')

incidents = json.loads(paths['incidents'].read_text())
entries = {r[0]: r for r in incidents['entries']}
targets = x['return_to_care']['targets']
assert len(targets) == len({t['id'] for t in targets}) == 3
for target in targets:
    assert target['id'] == f"SOC-I{target['number']:03d}"
    assert entries[target['number']][1] == target['issue']
row = next(r for r in json.loads(paths['care_law'].read_text())['review_rows'] if r['id'] == 'R25')
assert row['claim_ids'] == ['C236', 'C237', 'C238', 'C239'] and row['issue'] == 183

content = '\n'.join((root / 'planning/descent' / n).read_text() for n in (
    'README.md', 'middle-reading.md', 'middle-crosswalk.json'
))
assert 'chatgpt.com/' not in content and '/Users/' not in content
print('PASS: 12 historical public pins resolve; 10 current blobs unchanged; only plan/inventory differ; '
      'all 12 current inputs match 43a1fc9; canonical C08A registration unchanged; '
      '7 exact spans/context ranges; Atlas/claim/owner IDs; 5 preserved card edges; '
      '3 distinct incident targets; R25 identity; no local/private-chat locators.')
```
