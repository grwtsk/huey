"""Read-only source identity and claim-route checks, not truth certification."""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DISCLAIMER = 'Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.'
PINNED = {
    'audio': ('articles/discipline-and-punish.json', '17aab6ab4008a2b2873aae0b9adc5c6b177c9d7f', 5432),
    'harm': ('articles/neurology-cannot-undo-the-harm.json', '2eab197970746ee67d97bcd0c7bf3d25f6a6125e', 2264),
    'dignity': ('articles/on-dignity.json', '75c80e06a66bb8edf9d9972d5c1fd3003f1d1616', 2096),
    'painting': ('articles/i-bledsoe-i-bled-so.json', 'b120e14daf7731e4ec12dcd7603d9a90bdac28f1', 2634),
    'site': ('site.json', '16b7edd3a92f5e34de821756ad0a165822481d50', 11774),
}
ISSUES = {144, 145, 175, 188, 189, 190}
COMMIT = 'c920e426b8b6753b9f4bacf019e48010e57918c2'

def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)

def git_blob(raw: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()

def pointer(obj: Any, location: str) -> Any:
    require(location.startswith('/'), 'A source pointer must be absolute')
    for component in location[1:].split('/'):
        component = component.replace('~1', '/').replace('~0', '~')
        obj = obj[int(component)] if isinstance(obj, list) else obj[component]
    return obj

def walk(obj: Any, location: str = ''):
    yield location, obj
    if isinstance(obj, dict):
        for key, value in obj.items():
            yield from walk(value, location + '/' + key.replace('~', '~0').replace('/', '~1'))
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            yield from walk(value, location + '/' + str(index))

def verify(root: Path = ROOT) -> dict:
    root = root.resolve()
    review = root / 'planning/standard-of-care/ancillary-r02'
    manifest = json.loads((review / 'manifest.json').read_text())
    require(manifest['repository'] == 'grwtsk/huey', 'Wrong destination')
    require(manifest['source_repository'] == 'grwtsk/neurology', 'Wrong source')
    require(manifest['approval'] == 'SOC-PUBLIC-01', 'Approval identity changed')
    require(manifest['source_commit'] == COMMIT, 'Source version changed')
    require(manifest['disclaimer'] == DISCLAIMER, 'Missing disclaimer')
    for flag in ['source_originals_modified', 'raw_clinical_records_included', 'external_research_performed', 'media_bytes_copied', 'full_conversation_capture_complete', 'whole_corpus_semantic_review_complete']:
        require(manifest[flag] is False, 'Unestablished completion: ' + flag)
    require(set(manifest['records']) == set(PINNED), 'Incomplete or expanded selection')
    source_root = root / 'sources/standard-of-care/neurology-current/content'
    require(manifest['source_root'] == str(source_root.relative_to(root)), 'Source-root mismatch')
    sources = {}
    for key, (name, sha, size) in PINNED.items():
        expected = {'path': name, 'git_blob': sha, 'bytes': size}
        require(manifest['records'][key] == expected, 'Pinned identity changed: ' + key)
        file = source_root / name
        require(not file.is_symlink() and file.resolve().is_relative_to(source_root.resolve()), 'Unsafe source path')
        raw = file.read_bytes()
        require(len(raw) == size and git_blob(raw) == sha, 'Source-byte mismatch: ' + key)
        sources[key] = json.loads(raw)
    with (review / 'claims.tsv').open(newline='') as stream:
        claims = list(csv.DictReader(stream, delimiter='\t'))
    require([c['id'] for c in claims] == [f'ANC-C{i:03}' for i in range(1, 71)], 'Lost/reordered/duplicate claims')
    for claim in claims:
        value = pointer(sources[claim['source']], claim['pointer'])
        exact = json.loads(claim['exact_json'])
        match = isinstance(value, str) and isinstance(exact, str) and exact in value
        if not isinstance(value, str):
            match = type(value) is type(exact) and value == exact
        require(match, 'Unmatched exact proposition: ' + claim['id'])
        require(int(claim['issue']) in ISSUES, 'Missing scoped issue: ' + claim['id'])
        require(claim['support'] in {'artifact', 'provenance', 'reasoning', 'substantial'}, 'Unknown support type')
        require(claim['disposition'] and claim['disposition'] not in {'verified', 'proved', 'true'}, 'Overbroad verification status')
        if claim['kind'] in {'visual-description', 'operational-claim', 'verification-claim', 'resource-availability', 'cross-authority-description', 'media-availability'}:
            require(claim['support'] == 'substantial', 'Lost substantial-support flag: ' + claim['id'])
        if claim['kind'] == 'visual-description':
            require(claim['disposition'] == 'image-not-yet-inspected', 'Invented visual inspection')
    require(sum(c['support'] == 'substantial' for c in claims) == 16, 'Unexpected support total')
    with (review / 'leaf-dispositions.tsv').open(newline='') as stream:
        leaves = list(csv.DictReader(stream, delimiter='\t'))
    require(len(leaves) == 24, 'Lost source-text dispositions')
    leaf_map = {}
    for leaf in leaves:
        key = (leaf['source'], leaf['pointer'])
        require(key not in leaf_map, 'Duplicate leaf disposition')
        require(pointer(sources[key[0]], key[1]) == json.loads(leaf['exact_json']), 'Stale leaf disposition')
        require(int(leaf['issue']) in ISSUES and leaf['disposition'], 'Missing leaf issue or disposition')
        leaf_map[key] = leaf
    nodes, occurrences, links = [], [], []
    for source, obj in sources.items():
        own = [c for c in claims if c['source'] == source]
        seen = set()
        for loc, value in walk(obj):
            if isinstance(value, dict) and 'id' in value:
                require(value['id'] not in seen, 'Duplicate source node ID')
                seen.add(value['id'])
                related = [c['id'] for c in own if c['pointer'].startswith(loc + '/')]
                nodes.append({'source': source, 'pointer': loc, 'id': value['id'], 'type': value.get('type', 'metadata'), 'claim_ids': related, 'issue': 190 if source == 'site' else 189, 'disposition': 'source-node-preserved; see literal occurrences and scoped claims; no external verification'})
            if isinstance(value, dict) and ('target' in value or 'href' in value or 'sourcePath' in value):
                links.append({'source': source, 'pointer': loc, 'target': value.get('target', value.get('href', value.get('sourcePath'))), 'issue': 190 if source in {'site', 'dignity'} else 189, 'disposition': 'source-reference-preserved; no live target or media test'})
            if isinstance(value, (dict, list)):
                continue
            related = []
            for claim in own:
                exact = json.loads(claim['exact_json'])
                duplicate = claim['kind'] not in {'source-metadata', 'attribution', 'media-reference', 'generated-anchor'} and isinstance(value, str) and isinstance(exact, str) and len(exact) > 10 and exact in value
                if claim['pointer'] == loc or duplicate:
                    related.append(claim['id'])
            prose = isinstance(value, str) and loc.rsplit('/', 1)[-1] in {'value', 'originalText', 'description', 'notes', 'sourceNote', 'alt'}
            disposition = 'linked-to-scoped-claim-review' if related else ('additional-atomic-review-pending' if prose else 'source-metadata-or-structure-only')
            leaf = leaf_map.get((source, loc))
            if not related and leaf:
                disposition = leaf['disposition']
            occurrences.append({'source': source, 'pointer': loc, 'value': value, 'claim_ids': related, 'verification_issue': int(leaf['issue']) if leaf else (145 if not related else None), 'disposition': disposition})
    require(not any(o['disposition'] == 'additional-atomic-review-pending' for o in occurrences), 'Unreviewed prose occurrence')
    require(len(nodes) == 59, 'Source-node coverage changed')
    with (review / 'nodes.tsv').open(newline='') as stream:
        saved_nodes = list(csv.DictReader(stream, delimiter='\t'))
    expected_nodes = [{'source': n['source'], 'pointer': n['pointer'], 'id': n['id'], 'type': n['type'], 'claim_ids': ','.join(n['claim_ids']), 'verification_issue': str(n['issue'])} for n in nodes]
    require(saved_nodes == expected_nodes, 'Committed node index differs from source traversal')
    notice = (review / 'README.md').read_text()
    require('WORKING DRAFT' in notice and 'claim verification incomplete' in notice.lower(), 'Missing prominent README notice')
    return {'summary': {'sources': len(sources), 'source_bytes': sum(x[2] for x in PINNED.values()), 'identity_matches': len(sources), 'nodes': len(nodes), 'scalar_occurrences': len(occurrences), 'scoped_claims': len(claims), 'substantial_support': 16, 'references': len(links), 'additional_prose_occurrences_pending': sum(o['disposition'] == 'additional-atomic-review-pending' for o in occurrences), 'external_truth_verified': False}, 'nodes': nodes, 'occurrences': occurrences, 'links': links}

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, help='Optional local directory for generated source indexes')
    args = parser.parse_args()
    result = verify()
    if args.output_dir:
        destination = args.output_dir.resolve()
        require(not destination.is_relative_to(ROOT), 'Write generated indexes outside the repository')
        destination.mkdir(parents=True, exist_ok=True)
        for name in ['nodes', 'occurrences', 'links']:
            (destination / (name + '.jsonl')).write_text(''.join(json.dumps(x, ensure_ascii=False) + '\n' for x in result[name]))
        (destination / 'summary.json').write_text(json.dumps(result['summary'], indent=2) + '\n')
    print(json.dumps(result['summary'], indent=2))

if __name__ == '__main__':
    main()
