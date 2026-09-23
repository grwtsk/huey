#!/usr/bin/env python3
"""Read-only consistency checks for the private HUEY-CL10 review packet.

Run with --packet DIRECTORY. No network, manuscript writes or source disclosure.
Passing checks do not authenticate sources, establish clinical/legal findings,
certify semantic completeness, or accept a manuscript. Output is source-neutral.
"""
from __future__ import annotations
import argparse
import copy
import csv
import hashlib
import io
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

OWNERS = {24, 180, 181, 186}
EXPECTED = {'notes': 8, 'units': 56, 'review_units': 40,
            'selected_paragraphs': 23, 'selected_sentence_units': 91,
            'annotation_operations': 23, 'prior_passages': 660,
            'prior_reference_units': 141, 'prior_measurement_units': 97,
            'prior_measurement_passages': 31, 'prior_allocations': 256,
            'prior_residual_allocations': 91}


def need(value: bool, message: str) -> None:
    if not value:
        raise ValueError(message)


def digest(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def normalize(text: str) -> str:
    return ' '.join(text.split())


def validate(data: dict, texts: dict[str, str], old: dict) -> dict:
    need(data.get('repository') == 'grwtsk/huey', 'wrong repository')
    need(data.get('work_id') == 'HUEY-CL10' and data.get('pr') == 122
         and data.get('issue') == 186 and data.get('source_issue') == 24, 'wrong work target')
    need(data.get('adoption') == 'candidate-not-author-accepted', 'invented acceptance')
    need(data.get('clinical_or_legal_finding') is False and data.get('narrative_edits') == [], 'invented finding or narrative edit')
    for key, count in EXPECTED.items():
        need(len(data[key]) == count, 'coverage count: ' + key)
    base = texts[data['baseline_file']]
    candidate = texts[data['candidate_file']]
    reference = texts[data['reference_file']]
    need(base == candidate and base == texts[old['candidate_file']], 'clean narrative changed')
    need(digest(base) == data['baseline_sha256'] == data['candidate_sha256'], 'narrative identity mismatch')
    words = len(' '.join(line for line in candidate.splitlines()
                        if not line.startswith('#') and line.strip() != '* * *').split())
    need(words == 49841, 'narrative word convention mismatch')
    notes = {n['id']: n for n in data['notes']}
    need(set(notes) == {f'K{i:02}' for i in range(1, 9)}, 'note identifiers')
    sources = {s['id']: s for s in data['sources']}
    need(len(sources) == 13 and set(sources) == {'A', 'B', 'D01', 'D02'} | {f'W{i:02}' for i in range(1, 10)}, 'source identifiers')
    for s in sources.values():
        need(s.get('case_finding') is False and all(s.get(k) for k in ('title', 'locator', 'inspection', 'limit')), 'source scope/status')
    need(sources['W03']['inspection'] == 'abstract-and-indexed-discussion-read', 'fabricated full Methods access')
    need(sources['W06']['inspection'] == 'publisher-change-history-and-correction-record-read', 'correction access status')
    need(sources['W07']['inspection'] == 'full-text-prose-read' and 'retrieval failed' in sources['W07']['limit'], 'unseen table status')
    all_units = data['units'] + data['review_units']
    need(len({u['id'] for u in all_units}) == 96, 'duplicate reference unit')
    need({u['id'] for u in data['units']} == {f'HUEY-CL10-U{i:03}' for i in range(1, 57)}, 'body unit identifiers')
    for u in all_units:
        need(u['note'] in notes and u['owner'] == notes[u['note']]['owner'] and u['owner'] in OWNERS, 'reference owner')
        need(u.get('case_finding') is False and u.get('adoption') == data['adoption'], 'reference status')
        need(reference[u['start']:u['end']] == u['text'], 'reference exact span')
        need(set(u.get('source_ids', [])) <= set(sources), 'unknown reference source')
    for n in notes.values():
        need(all(n.get(k) for k in ('question', 'evidence', 'alternative', 'reviewer', 'closure')), 'incomplete inquiry')
        need(n['body'] == [u['id'] for u in data['units'] if u['note'] == n['id']], 'note/body links')
        need(len([u for u in data['review_units'] if u['note'] == n['id']]) == 5, 'note/review links')
    paragraphs = {p['id']: p for p in data['selected_paragraphs']}
    need(len(paragraphs) == 23, 'duplicate paragraph')
    for p in paragraphs.values():
        need(candidate[p['start']:p['end']] == p['text'] and p['owner'] in OWNERS, 'paragraph span/owner')
        need(set(p['notes']) <= set(notes) and set(p['source_ids']) <= set(sources), 'paragraph links')
        sentences = [u for u in data['selected_sentence_units'] if u['paragraph_id'] == p['id']]
        need(normalize(' '.join(u['text'] for u in sentences)) == normalize(p['text']), 'untracked selected prose')
    need(len({u['id'] for u in data['selected_sentence_units']}) == 91, 'duplicate selected sentence')
    for u in data['selected_sentence_units']:
        p = paragraphs[u['paragraph_id']]
        need(candidate[u['start']:u['end']] == u['text'] and p['start'] <= u['start'] < u['end'] <= p['end'], 'sentence span')
        need(u['owner'] == p['owner'] and u['source_ids'] == p['source_ids'] and u['notes'] == p['notes'], 'sentence linkage')
        need(u['case_finding'] is False and u['limit'] and u['status'] == 'retained-exact-bounded-source-review', 'sentence status')
    prior = texts[data['prior_annotated_file']]
    annotated = texts[data['annotated_file']]
    made = prior
    for operation in data['annotation_operations']:
        p = paragraphs[operation['paragraph_id']]
        need(operation['before'] == p['text'] and made.count(operation['before']) == 1, 'annotation anchor')
        made = made.replace(operation['before'], operation['after'], 1)
    need(made == annotated, 'unlisted annotation change')
    for operation in reversed(data['annotation_operations']):
        need(made.count(operation['after']) == 1, 'inverse annotation anchor')
        made = made.replace(operation['after'], operation['before'], 1)
    need(made == prior, 'annotation inverse mismatch')
    for key in ('prior_passages', 'prior_allocations', 'prior_residual_allocations', 'prior_reference_units'):
        need(data[key] == old[key], 'changed prior register: ' + key)
    need(data['prior_measurement_units'] == old['units'] + old['review_units'], 'changed measurement units')
    need(data['prior_measurement_passages'] == old['selected_sentence_units'], 'changed measurement passages')
    for u in data['prior_passages']:
        need(u['text'] in candidate, 'prior narrative passage lost')
    for key, filename in [('prior_reference_units', 'huey-care-law-r08-reference.md'),
                          ('prior_measurement_units', old['reference_file'])]:
        for u in data[key]:
            need(texts[filename][u['start']:u['end']] == u['text'], 'prior reference span lost')
    version = data['source_version_record']
    need(version['corrected_attitudes'] == ['20.3', '25.1'] and version['corrected_treatment'] == ['4.7', '5.3'], 'stale corrected values')
    need(version['original_abstract_attitudes'] == ['20.6', '25.6'] and version['original_abstract_treatment'] == ['5.56', '6.22'], 'lost discrepancy record')
    need(version['published_correction_date'] == '2018-10-18' and version['corrected_p'] == 'p < 0.001 for both', 'correction provenance')
    checks = {'HUEY-CL10-U018': 'no significant effect on transcription accuracy',
              'HUEY-CL10-U029': 'not observations of medication administered',
              'HUEY-CL10-U036': 'odds ratio 3.00',
              'HUEY-CL10-U040': 'not freshly verified in this pass'}
    by_id = {u['id']: u for u in data['units']}
    for uid, phrase in checks.items():
        need(phrase in by_id[uid]['text'], 'specified outcome qualification lost')
    return {'result': 'PASS: bounded consistency checks', 'narrative_words': words,
            **EXPECTED, 'public_source_records': 9,
            'limits': 'Not source authentication, complete clause-level truth, a clinical/legal finding, final acceptance or release.'}


def negative_tests(data: dict, texts: dict, old: dict) -> list[str]:
    cases = []
    def add(name, edit):
        d, t = copy.deepcopy(data), copy.deepcopy(texts)
        edit(d, t)
        d['baseline_sha256'] = digest(t[d['baseline_file']])
        d['candidate_sha256'] = digest(t[d['candidate_file']])
        cases.append((name, d, t))
    add('wrong-repository', lambda d,t: d.update(repository='grwtsk/neurology'))
    add('wrong-pr', lambda d,t: d.update(pr=129))
    add('invented-acceptance', lambda d,t: d.update(adoption='accepted'))
    add('invented-clinical-finding', lambda d,t: d.update(clinical_or_legal_finding=True))
    add('clean-narrative-edit', lambda d,t: t.update({d['candidate_file']:t[d['candidate_file']]+'\nUnlisted text.\n'}))
    add('omitted-unit', lambda d,t: d['units'].pop())
    add('duplicate-unit', lambda d,t: d['units'][0].update(id=d['units'][1]['id']))
    add('unknown-source', lambda d,t: d['units'][0].update(source_ids=['MISSING']))
    add('wrong-owner', lambda d,t: d['units'][0].update(owner=120))
    add('source-finding', lambda d,t: d['sources'][0].update(case_finding=True))
    add('invented-full-methods-read', lambda d,t: d['sources'][6].update(inspection='complete-paper-read'))
    add('omitted-alternative', lambda d,t: d['notes'][0].update(alternative=''))
    add('sentence-coverage-loss', lambda d,t: d['selected_sentence_units'].pop())
    add('changed-sentence-span', lambda d,t: d['selected_sentence_units'][0].update(start=0))
    add('unlisted-annotation', lambda d,t: t.update({d['annotated_file']:t[d['annotated_file']]+'Unlisted annotation.'}))
    add('lost-prior-narrative-register', lambda d,t: d['prior_passages'].pop())
    add('changed-prior-measurement', lambda d,t: d['prior_measurement_units'][0].update(text='Changed historical unit.'))
    add('changed-allocation', lambda d,t: d['prior_allocations'][0].update(status='independently-proved'))
    add('stale-study-statistic', lambda d,t: d['source_version_record'].update(corrected_treatment=['5.56','6.22']))
    add('erased-publisher-discrepancy', lambda d,t: d['source_version_record'].update(original_abstract_attitudes=['20.3','25.1']))
    for name, d, t in cases:
        try:
            validate(d, t, old)
        except (ValueError, KeyError):
            continue
        raise ValueError('invalid fixture accepted: ' + name)
    return [name for name, _, _ in cases]


def public_checks(root: Path, data: dict) -> None:
    def rows(name):
        return list(csv.DictReader(io.StringIO((root/'public'/name).read_text()), delimiter='\t'))
    expected = [{'unit':u['id'], 'note':u['note'], 'type':u['kind'], 'huey_issue':str(u['owner']),
                 'sources':','.join(u.get('source_ids', []))} for u in data['units']+data['review_units']]
    need(rows('communication-r10-units.tsv') == expected, 'public reference index mismatch')
    expected = [{'unit':u['id'], 'paragraph':u['paragraph_id'], 'chapter':str(u['chapter']),
                 'huey_issue':str(u['owner']), 'sources':','.join(u['source_ids']),
                 'notes':','.join(u['notes'])} for u in data['selected_sentence_units']]
    need(rows('communication-r10-passages.tsv') == expected, 'public passage index mismatch')
    public = json.loads((root/'public/communication-r10-sources.json').read_text())
    need(public['sources'] == [s for s in data['sources'] if s['url']], 'public source scope mismatch')


def link_checks(root: Path) -> int:
    count = 0
    for path in root.glob('*.md'):
        for target in re.findall(r'\]\(([^)]+)\)', path.read_text()):
            if re.match(r'[a-z]+:', target):
                continue
            name, _, anchor = unquote(target).partition('#')
            other = path.parent/name if name else path
            need(other.is_file(), 'missing local link target')
            if anchor:
                text = other.read_text()
                explicit = set(re.findall(r'<a id="([^"]+)"', text))
                headings = set(re.sub(r'[^\w\s-]', '', h.lower()).strip().replace(' ', '-')
                               for h in re.findall(r'^#{1,6}\s+(.+)$', text, re.M))
                need(anchor in explicit | headings, 'missing local anchor')
            count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packet', type=Path, required=True)
    args = parser.parse_args()
    try:
        root = args.packet.resolve()
        data = json.loads((root/'communication-r10.json').read_text())
        old = json.loads((root/data['prior_state_file']).read_text())
        texts = {p.name:p.read_text() for p in root.glob('*.md')}
        result = validate(data, texts, old)
        need(hashlib.sha256((root/data['prior_archive']).read_bytes()).hexdigest() == data['prior_archive_sha256'], 'prior archive identity')
        public_checks(root, data)
        result['local_links_checked'] = link_checks(root)
        result['negative_tests_passed'] = negative_tests(data, texts, old)
        print(json.dumps(result, indent=2))
        return 0
    except (OSError, UnicodeError, ValueError, KeyError, TypeError):
        print('FAIL: packet consistency; inspect locally without posting private source text.', file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
