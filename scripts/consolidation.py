#!/usr/bin/env python3
"""Read-only byte checks for historical receipts, never source or acceptance checks."""
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = 'planning/consolidation/legacy-receipts.json'
# Frozen reviewed source selection: changing it requires another scoped review.
EXPECTED = {'planning/writing/C01-first-draft.md': (83,
                                         '6be7c5a61d4b2c10b95ad10186de8ac10715bae4',
                                         'ececa0233fcb5e2af1785fb53081ae20a49342fa'),
 'planning/writing/C01-opening-r02.md': (83,
                                         '6be7c5a61d4b2c10b95ad10186de8ac10715bae4',
                                         '0db3b3e109a1a7d6c631cd8bb58a33c347160ae6'),
 'planning/writing/C01-opening-r03.md': (83,
                                         '6be7c5a61d4b2c10b95ad10186de8ac10715bae4',
                                         'd4085f109b24a5c5e764b32595c55eb17d0f6f67'),
 'planning/writing/C02-first-draft.md': (84,
                                         '2c289001ce81039065b9c092fea4ac6084396d06',
                                         'c77d9c2e003c6019c001debd494c056f065a5544'),
 'planning/writing/C03-first-draft.md': (85,
                                         '8eae727739e4b95a9b80bcff5091ca706f2249e4',
                                         '346b471a91510dc7e772a636f1cf4c9a561b4b5c'),
 'planning/writing/C04-first-draft.md': (86,
                                         '86dab6c4592015ee5d465fb5b25ae411606295e2',
                                         'b93d908bfe3ad59953ae2b2492c677e53ae6480d'),
 'planning/writing/C05-first-draft.md': (87,
                                         '1e9833c7df4157e87c8175fbfc06b055c7b08cbf',
                                         '72806bfa5cb19c163471e147a1fa53f64fd2fa3f'),
 'planning/writing/C06-first-draft.md': (88,
                                         'b7f39d41c2d00e07e6727921aba0134e87feb6ce',
                                         '321e75d4b352c71327edcc56237418db5750e36d'),
 'planning/writing/C07-first-draft.md': (89,
                                         'ab6f9f22a6c94a35c407619a5097a03078827340',
                                         '7a0b724e4300f1986888df7950b41bc052cc666b'),
 'planning/writing/Preamble-R01-review.md': (90,
                                             'f85fa655e3ebe9a3709bb25e1b76450bbd702a2a',
                                             'aa31f500e19dd1cbce963f7e26f0e0cf80634129'),
 'planning/writing/C08-first-draft.md': (91,
                                         'a28a3a565b0d7f74fc880fb1cba0537fac09863f',
                                         '04f7d6583f31e519b67985c53644ec76f712f7cd'),
 'planning/writing/C09-first-draft.md': (92,
                                         'e450f2d8827202f36da8a5135c99ad35ae2da967',
                                         '9c54fd9fcb5571c2175a98b0e6ae238b9690cd39'),
 'planning/writing/C10-first-draft.md': (93,
                                         'b99d6286ac562d7f4234a518453abd15f0331f83',
                                         'dc039165817b409d7f49920e9c8a72a1d062faac'),
 'planning/writing/C11-first-draft.md': (94,
                                         '3a244a22fbb24245b8ea5551647385122e92e6cf',
                                         '69eb0ac882c5e10628374e3c52b660e756814f8d'),
 'planning/writing/C12-first-draft.md': (95,
                                         '3e473dde595c670a6c3df13a76e742f3b9793fe3',
                                         'e9bb6505dd24a38088fed6fb8ad9451dee3e85ea'),
 'planning/writing/Identity-R01-progress.md': (97,
                                               '1c3a9d57064dd88d910436c09194c70c37fd5762',
                                               '17ac9cbea148bc3652182fbcc098cfb016002524'),
 'planning/writing/C13-first-draft.md': (117,
                                         'da12db289fc99932bd03ad769dffe13f75f2df74',
                                         'b336c948684a2f929229548ffbbde5488f5a5be6'),
 'planning/writing/C14-first-draft.md': (118,
                                         '5d2c71bb8b503c08627ff79a70fcdcf92fdb40a0',
                                         '3ca1aba6184edb4aa56cabe22acdbeed0ac9f0c4'),
 'planning/writing/C15-first-draft.md': (120,
                                         '103ae503d9f41cd54c38da9397ed66b3f0040796',
                                         '62665ce90a7b141cb512271228b1eb3191e3b6e5'),
 'planning/writing/Interlude-R01-progress.md': (121,
                                                'b3f6d06a750729e462d89d6d21d4a00c7f994c5b',
                                                '1cfab1a4e86dc305e779a10ef751dc1031c967d2')}

MARKERS = {
    'schema': 'huey.legacy-receipts.v1',
    'basisRevision': 'ab501a00c167f6d85de59e4e22920dd3e2c5b546',
    'historicalOnly': True,
    'manuscriptImported': False,
    'claimVerificationPerformed': False,
    'authorAcceptanceRecorded': False,
    'runtimeInput': False,
}
NOTICE = 'These unchanged progress receipts describe earlier private deliveries. Current instructions and linked supersession records govern; old next-task, PR-state, count and test statements remain historical, not current acceptance, evidence verification or source-service claims.'
LIMITS = ['no-manuscript-or-raw-evidence-import', 'historical-checks-not-rerun',
          'not-acceptance-or-clearance', 'current-instructions-govern']
SUPERSESSION = ['https://github.com/grwtsk/huey/issues/' + str(n) for n in [98, 100, 310, 380]]
RUNTIME_PATHS = ['book.yaml', 'reader/content/book.json',
                 'planning/editorial-inventory/registry.json', 'planning/editorial-pages/plan.json']
SHA = re.compile(r'[0-9a-f]{40}\Z')


class Invalid(ValueError):
    pass


def require(condition, code):
    if not condition:
        raise Invalid(code)


def pairs(rows):
    result = {}
    for key, value in rows:
        require(key not in result, 'DUPLICATE_JSON_KEY')
        result[key] = value
    return result


def load(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=pairs,
                          parse_constant=lambda _value: (_ for _ in ()).throw(Invalid('NONFINITE_JSON')))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise Invalid('INVALID_JSON') from None


def blob(payload):
    return hashlib.sha1(b'blob ' + str(len(payload)).encode('ascii') + b'\0' + payload).hexdigest()


def shape(value, fields, code):
    require(type(value) is dict and set(value) == set(fields), code)


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)


def check_runtime_boundary(root):
    for path in RUNTIME_PATHS:
        file = root / path
        if file.exists():
            for value in strings(load(file)):
                require(not any(receipt in value for receipt in EXPECTED), 'RUNTIME_INPUT')


def validate(manifest, root=ROOT, source_objects=False):
    root = Path(root)
    shape(manifest, [*MARKERS, 'notice', 'records'], 'MANIFEST_FIELDS')
    for key, expected in MARKERS.items():
        require(type(manifest[key]) is type(expected) and manifest[key] == expected, 'HISTORICAL_SCOPE')
    require(manifest['notice'] == NOTICE, 'SUPERSESSION_NOTICE')
    rows = manifest['records']
    require(type(rows) is list and len(rows) == len(EXPECTED), 'COVERAGE')
    seen, checked = set(), 0
    for row in rows:
        shape(row, ['path', 'pr', 'commit', 'blob', 'originalCommit', 'recordedAt', 'issueRefs',
                    'disposition', 'supersessionRefs', 'limits'], 'RECORD_FIELDS')
        path = row['path']
        require(type(path) is str and path in EXPECTED and path not in seen, 'COVERAGE')
        seen.add(path)
        require(type(row['pr']) is int and (row['pr'], row['commit'], row['blob']) == EXPECTED[path], 'SOURCE_PIN')
        require(type(row['originalCommit']) is str and SHA.fullmatch(row['originalCommit']), 'ORIGINAL_COMMIT')
        require(type(row['recordedAt']) is str, 'RECORDED_DATE')
        try:
            stamp = datetime.fromisoformat(row['recordedAt'])
            require(stamp.tzinfo is not None, 'RECORDED_DATE')
        except ValueError:
            raise Invalid('RECORDED_DATE') from None
        refs = row['issueRefs']
        require(type(refs) is list and all(type(n) is int and n > 0 for n in refs)
                and refs == sorted(set(refs)), 'ISSUE_REFS')
        require(row['disposition'] == 'historical-receipt-only' and row['limits'] == LIMITS, 'HISTORICAL_SCOPE')
        links = row['supersessionRefs']
        require(type(links) is list and all(type(link) is str for link in links)
                and len(links) == len(set(links))
                and all(re.fullmatch(r'https://github\.com/grwtsk/huey/(?:issues/\d+|pull/\d+#issuecomment-\d+)', link) for link in links)
                and set(SUPERSESSION) <= set(links), 'SUPERSESSION_REFS')
        file = root / path
        require(file.is_file() and not file.is_symlink()
                and root.resolve() in file.resolve().parents, 'RECEIPT_PATH')
        payload = file.read_bytes()
        require(blob(payload) == row['blob'], 'RECEIPT_BYTES')
        text = payload.decode('utf-8')
        require(refs == sorted(set(map(int, re.findall(r'#(\d+)', text)))), 'ISSUE_REFS')
        if source_objects:
            result = subprocess.run(['git', 'show', row['commit'] + ':' + path], cwd=root,
                                    capture_output=True, check=False)
            require(result.returncode == 0, 'SOURCE_OBJECT_UNAVAILABLE')
            require(result.stdout == payload, 'SOURCE_OBJECT_MISMATCH')
            date = subprocess.run(['git', 'log', '-1', '--format=%H %cI', row['commit'], '--', path],
                                  cwd=root, capture_output=True, text=True, check=False)
            require(date.returncode == 0 and date.stdout.strip() == row['originalCommit'] + ' ' + row['recordedAt'], 'SOURCE_HISTORY_MISMATCH')
            checked += 1
    require(seen == set(EXPECTED), 'COVERAGE')
    check_runtime_boundary(root)
    return {'receipts': len(rows), 'source_prs': len({row['pr'] for row in rows}),
            'original_git_objects_checked': checked, 'historical_only': True,
            'semantic_review_required': True}


if __name__ == '__main__':
    try:
        require(sys.argv[1:] in ([], ['--source-objects']), 'USAGE')
        print(json.dumps(validate(load(ROOT / MANIFEST), source_objects=bool(sys.argv[1:]))))
    except (Invalid, OSError, UnicodeError, TypeError) as error:
        print(str(error) if isinstance(error, Invalid) else 'INVALID_INPUT', file=sys.stderr)
        raise SystemExit(2)
