"""Read-only registration checks; not source authentication or a findings engine."""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPECTED = {'R': 43, 'S': 40, 'Q': 14, 'C': 10, 'X': 5}
NOTICE = 'Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.'
CLASSES = {'R': 'reported-departure', 'S': 'unresolved-safeguard', 'Q': 'investigative-question', 'C': 'clinical-review-question', 'X': 'context-and-consequence'}
COLUMNS = ['number', 'issue', 'class', 'source', 'locator', 'title']


def validate(data, sources, rendered_index=None):
    """Raise ValueError for an inconsistent initial snapshot; perform no network writes."""
    def require(ok, message):
        if not ok:
            raise ValueError(message)
    require(data.get('repository') == 'grwtsk/huey', 'wrong repository')
    require(data.get('columns') == COLUMNS, 'unexpected columns')
    require(data.get('classifications') == CLASSES, 'classification meanings changed')
    require(data.get('all_incidents_enumerated') is False, 'unwarranted exhaustive claim')
    require(data.get('finding_status') == 'not-determined', 'registration promoted to finding')
    require(data.get('new_collection_status') == 'planned-not-started', 'invented collection')
    require(data.get('disclaimer') == NOTICE, 'missing disclaimer')
    require([data.get(k) for k in ('register_issue', 'coverage_issue', 'evidence_intake_issue')] == [193, 306, 307], 'missing work owners')
    rows = data.get('entries', [])
    require(len(rows) == 112, 'initial snapshot entry count')
    require(all(isinstance(r, list) and len(r) == 6 for r in rows), 'malformed row')
    require([r[0] for r in rows] == list(range(1, 113)), 'lost, duplicate or reordered identifier')
    require([r[1] for r in rows] == list(range(194, 306)), 'issue differs from observed creation receipts')
    require(collections.Counter(r[2] for r in rows) == EXPECTED, 'classification count mismatch')
    require(all(isinstance(x, str) and x.strip() for r in rows for x in r[2:]), 'empty entry field')
    catalog = sources.get('sources', {})
    require(all(r[3] in catalog for r in rows), 'unresolved source alias')
    require(all(catalog[r[3]].get('location') for r in rows), 'source location absent')
    for n, kind in {5:'S', 6:'R', 14:'S', 21:'R', 23:'S', 24:'S', 25:'S', 76:'Q', 85:'R', 88:'C', 100:'X', 103:'X', 105:'Q', 110:'X', 111:'R', 112:'S'}.items():
        require(rows[n-1][2] == kind, 'source status lost at I%03d' % n)
    if rendered_index is not None:
        require(rendered_index == render(data), 'rendered index differs from source rows')
    return {'entries': len(rows), 'classes': dict(EXPECTED), 'finding_status': 'not-determined', 'new_collection_status': 'planned-not-started', 'limits': 'Index consistency only; no substantive or live-issue-body certification.'}


def render(data):
    lines = ['# Individual entries', '', '> Working register; evidence review incomplete. Entry counts are not counts of proven violations. See [scope](README.md).', '', '| Entry | Explicit issue | Kind | Source and locator | Subject |', '|---|---|---|---|---|']
    def clean(value):
        return str(value).replace('|', '&#124;').replace('\n', ' ')
    for n, issue, kind, source, locator, title in data['entries']:
        lines.append('| SOC-I%03d | [#%d](https://github.com/grwtsk/huey/issues/%d) | %s | %s: %s | %s |' % (n, issue, issue, kind, clean(source), clean(locator), clean(title)))
    lines.extend(['', 'R: reported departure; S: unresolved safeguard; Q: investigative question; C: clinical review question; X: context/consequence.', '', NOTICE, ''])
    return '\n'.join(lines)


if __name__ == '__main__':
    data = json.loads((ROOT / 'register.json').read_text())
    sources = json.loads((ROOT / 'sources.json').read_text())
    print(json.dumps(validate(data, sources, (ROOT / 'index.md').read_text()), indent=2))
