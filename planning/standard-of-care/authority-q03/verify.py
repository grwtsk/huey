#!/usr/bin/env python3
"""Read-only, offline consistency checks; no semantic or factual certification."""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Iterator

SOURCE = 'sources/standard-of-care/neurology-current/content/authority-quotes.json'
DIR = 'planning/standard-of-care/authority-q03'
BLOB = '69f35715a28dc800250959ee2a19cf67bfa91e90'
IDS = ['quote-wma-cordoba','quote-un-udhr-dignity','quote-doj-equal-access',
       'quote-988-heard-cared','quote-christian-truth','quote-jewish-neighbor',
       'quote-islam-preserve-life','quote-buddhist-non-hatred',
       'quote-wma-geneva-dignity','quote-un-crpd-health',
       'quote-ama-patient-rights','quote-who-health-right']
TRAILER = 'Disclaimer: Working draft; claim verification incomplete; not medical/legal advice or adjudicated findings.'
TEXT_RESULTS = {'matched-sentence','matched-excerpt','matched-verse','matched-item',
                'index-excerpt-only','not-verified'}
ATTEMPT_RESULTS = {'read','http-403','unavailable','reader-shell','index-excerpt'}

class Invalid(ValueError):
    """The supplied research packet violates a declared structural invariant."""

def require(ok: bool, message: str) -> None:
    if not ok:
        raise Invalid(message)

def git_blob(data: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def leaves(value: Any, pointer: str = '') -> Iterator[str]:
    if isinstance(value, dict):
        for key, item in value.items():
            yield from leaves(item, pointer+'/'+key.replace('~','~0').replace('/','~1'))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from leaves(item, pointer+'/'+str(index))
    else:
        yield pointer

def tsv(path: Path) -> list[dict[str,str]]:
    with path.open(encoding='utf-8', newline='') as stream:
        return list(csv.DictReader(stream, delimiter='\t'))

def validate(root: Path) -> dict[str, Any]:
    root = root.resolve()
    base = root / DIR
    data = (root / SOURCE).read_bytes()
    require(git_blob(data) == BLOB, 'Original source bytes changed')
    source = json.loads(data)
    require([q['id'] for q in source['quotations']] == IDS, 'Source order/IDs changed')
    report = json.loads((base/'review.json').read_text(encoding='utf-8'))
    require(report['repository'] == 'grwtsk/huey', 'Wrong destination repository')
    require(report['source']['path'] == SOURCE and report['source']['git_blob'] == BLOB,
            'Wrong source binding')
    require(report['source']['bytes'] == len(data), 'Wrong byte count')
    require(report['source']['lines'] == len(data.splitlines()), 'Wrong line count')
    require(report['raw_clinical_records_published'] is False, 'Clinical record scope changed')
    require(report['factual_clearance'] is False, 'Unsupported factual clearance')
    require(report['manuscript_status'] == 'candidate-only', 'Unsupported manuscript acceptance')
    require(report['source']['originals_modified'] is False, 'Source-original mutation claimed')
    observations = report['observations']
    require(len(observations) == 12, 'Missing source inspection row')
    for i, row in enumerate(observations):
        require(row['id'] == f'Q03-R{i+1:02d}' and row['quote_id'] == IDS[i], 'Review order/ID mismatch')
        require(row['text_result'] in TEXT_RESULTS, 'Invalid text disposition')
        require(row['verification_issue'] == 192 and row['relationship_issue'] == 144, 'Review ownership changed')
        for field in ('observation','limits','pinpoint','version_result'):
            require(bool(row.get(field,'').strip()), f'Missing {field}')
        require(bool(row['attempts']), 'No source attempt recorded')
        require(row['attempts'][0]['url'] == source['quotations'][i]['source_url'], 'Original URL lost')
        for attempt in row['attempts']:
            require(attempt['url'].startswith('https://'), 'Non-HTTPS source locator')
            require(attempt['result'] in ATTEMPT_RESULTS, 'Unknown retrieval status')
            require(bool(attempt['scope']), 'Missing inspected scope')
        if row['text_result'].startswith('matched-'):
            require(any(a['result'] == 'read' for a in row['attempts']), 'Match claimed without a text read')
        if i in (1,9):
            require(row['text_result'] == 'index-excerpt-only', 'Indexed excerpt promoted to full inspection')
        if i == 5:
            require(row['text_result'] == 'not-verified' and row['version_result'] == 'unverified', 'JPS edition falsely cleared')
        if i == 6:
            require(row['version_result'] == 'unverified', 'Translator credit falsely cleared')
        if i == 8:
            require(row['version_result'] == 'citation-version-qualified', 'Geneva version distinction lost')
    fields = tsv(base/'fields.tsv')
    pointers = [row['pointer'] for row in fields]
    require(len(pointers) == len(set(pointers)), 'Duplicate source pointer')
    require(set(pointers) == set(leaves(source)), 'Incomplete or fabricated scalar coverage')
    require([row['id'] for row in fields] == [f'Q03-F{i+1:03d}' for i in range(len(fields))], 'Field IDs changed')
    relationships = 0
    for row in fields:
        require(re.fullmatch(r'https://github\.com/grwtsk/huey/issues/(144|192)',row['verification_issue']) is not None,
                'Field has non-Huey or unassigned issue')
        require(re.fullmatch(r'Q03-R(0[0-9]|1[0-2])', row['review']) is not None, 'Unknown field review')
        p = row['pointer']
        if p.startswith('/quotations/'):
            require(row['review'] == f'Q03-R{int(p.split("/")[2])+1:02d}', 'Wrong field/source review')
        if '/principles/' in p or '/ethics_nodes/' in p:
            relationships += 1
            require(row['kind']=='conceptual-correspondence' and row['support']=='substantial'
                    and row['disposition']=='unreviewed-correspondence'
                    and row['verification_issue'].endswith('/144'), 'Relationship falsely cleared or unrouted')
        if p.endswith('/verified_at'):
            require(row['disposition']=='not-recertified','Historical date promoted to new certification')
    claims = tsv(base/'claims.tsv')
    claim_ids = [c['id'] for c in claims]
    require(len(claim_ids) == len(set(claim_ids)) == 14,'Missing/duplicate new proposition')
    review_ids = {r['id'] for r in observations}
    for row in claims:
        require(bool(row['proposition']), 'Empty proposition')
        require(set(row['reviews'].split()) <= review_ids, 'Orphan claim/source reference')
        require(re.fullmatch(r'https://github\.com/grwtsk/huey/issues/(192|160|142|144)',row['verification_issue']) is not None,
                'Claim has wrong repository or issue')
        require(row['disposition'] in {'supported-in-current-source','reasoning-not-empirical-finding','reasoning-not-case-verdict'},
                'Unsupported claim disposition')
    draft = (base/'argument-draft.md').read_text(encoding='utf-8')
    require('WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE' in draft, 'Draft notice missing')
    candidate = draft.split('<!-- BEGIN CANDIDATE -->',1)[1].split('<!-- END CANDIDATE -->',1)[0]
    blocks = re.findall(r'<!-- (Q03-P\d{2}) \| claims: ([A-Z0-9,-]+) -->\s*([^<]+)',candidate)
    require([b[0] for b in blocks] == [f'Q03-P{i:02d}' for i in range(1,13)], 'Candidate unit coverage changed')
    for _, refs, text in blocks:
        require(set(refs.split(',')) <= set(claim_ids), 'Unowned candidate proposition')
        require(len(text.strip().split('\n\n')) == 1, 'Unlisted candidate paragraph')
    intro = candidate.split('<!-- Q03-P01',1)[0]
    require(not intro.strip(), 'Unowned candidate introduction')
    readme = (base/'README.md').read_text(encoding='utf-8')
    require('WORKING DRAFT — CLAIM VERIFICATION INCOMPLETE' in readme and TRAILER in readme, 'README disclaimer missing')
    return dict(source_bytes=len(data),source_lines=len(data.splitlines()),source_entries=12,
                scalar_fields=len(fields),relationship_targets=relationships,
                substantial_field_targets=sum(f['support']=='substantial' for f in fields),
                new_propositions=len(claims),candidate_units=len(blocks),
                primary_text_matches=sum(r['text_result'].startswith('matched-') for r in observations),
                official_index_only=sum(r['text_result']=='index-excerpt-only' for r in observations),
                text_unverified=sum(r['text_result']=='not-verified' for r in observations),
                semantic_truth_certified=False)

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[3])
    args = parser.parse_args()
    try:
        result = validate(args.root)
    except (Invalid, OSError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        print(json.dumps({'ok':False,'error':str(exc)},ensure_ascii=False))
        return 1
    print(json.dumps({'ok':True,'checks':result},ensure_ascii=False,indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
