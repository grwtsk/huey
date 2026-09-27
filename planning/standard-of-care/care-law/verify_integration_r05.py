#!/usr/bin/env python3
"""Read-only checks of the HUEY-CL05 private author-review packet.

No network, publication, case finding, or source modification. Output is limited
to counts/check names. Consistency checks do not authenticate testimony, decide
law or theology, or accept a manuscript for the author.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import re
import sys
from pathlib import Path

REPO = 'grwtsk/huey'
OWNERS = {50, 178, 179, 180, 181, 182, 183, 184, 185, 186}
NEW_KINDS = {'argument','request','question','hypothesis','interpretation','scope',
             'source-description','ethics','theology','law','literary-source',
             'metaphor','editorial'}
CIDS = {f'C{i:03d}' for i in range(1,257)}


def need(value: bool, message: str) -> None:
    if not value:
        raise ValueError(message)


def digest(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def words(text: str) -> int:
    return len(' '.join(line for line in text.splitlines()
                        if not line.startswith('#') and line.strip() != '* * *').split())


def body_paragraphs(text: str) -> list[tuple[int,int,str]]:
    start, end = text.index('### 14. '), text.index('### 15. ')
    return [(start+m.start(), start+m.end(), m.group())
            for m in re.finditer(r'[^\n].*?(?=\n\n|\Z)', text[start:end], re.S)
            if not m.group().startswith('#')]


def validate(base: str, candidate: str, data: dict) -> dict:
    need(data.get('repository') == REPO and data.get('work_id') == 'HUEY-CL05', 'work target')
    need(data.get('pr') == 122 and data.get('issue') == 186 and data.get('chapter_issue') == 50, 'issue target')
    need(digest(base) == data.get('baseline_sha256') and digest(candidate) == data.get('candidate_sha256'), 'identity')
    ops, units, retained = data['operations'], data['units'], data['retained_units']
    need(len(ops) == 11 and {o['id'] for o in ops} == {f'CL05-E{i:02d}' for i in range(1,12)}, 'operation IDs')
    need(len(units) == 78 and {u['id'] for u in units} == {f'HUEY-CL05-U{i:03d}' for i in range(1,79)}, 'new unit IDs')
    need(len(retained) == 189 and {u['id'] for u in retained} == {f'HUEY-CL05-R{i:03d}' for i in range(1,190)}, 'retained unit IDs')
    sources = {s['id']:s for s in data['sources']}
    need(len(data['sources']) == len(sources) == 11, 'sources')
    need(set(sources) == {'A','B','M','L17'}|{f'W{i:02d}' for i in range(1,8)}, 'source aliases')
    for s in sources.values():
        need(s.get('locator') and s.get('limit') and s.get('kind'), 'source scope')
        need(s.get('case_finding') is False, 'source finding')
    need(sources['M']['kind'] == 'supplied-meditation', 'meditation falsely authenticated')
    need(sources['B']['kind'] == 'editorial-predecessor', 'predecessor falsely authenticated')
    checks = data.get('source_checks', {})
    need(checks.get('primary_public_texts_read') == 7, 'primary source declaration')
    for k in ('new_clinical_record_query','raw_pdf_upload','institutional_contact',
              'icon_image_inspected','historical_case_law_review_complete',
              'retained_declaration_original_retrieved'):
        need(checks.get(k) is False, 'unsupported review declaration')
    by_id = {u['id']:u for u in units}
    c0, c1 = base.index('### 14. '), base.index('### 15. ')
    previous = c0
    linked = []
    for o in sorted(ops, key=lambda o:o['source_start']):
        a,b = o['source_start'],o['source_end']
        need(o['chapter'] == 14 and c0 <= a < b <= c1 and a >= previous, 'operation range')
        previous = b
        need(base[a:b] == o['before'] and o.get('reason'), 'before and reason')
        need(o['mode'] in ('after','replace'), 'mode')
        addition = o['after']
        if o['mode'] == 'after':
            need(addition.startswith(o['before']+'\n\n'), 'retained insertion anchor')
            addition = addition[len(o['before'])+2:]
        entries = [by_id[uid] for uid in o['unit_ids']]
        need(all(u['edit'] == o['id'] and u['chapter'] == 14 for u in entries), 'unit operation')
        need(' '.join(addition.split()) == ' '.join(' '.join(u['text'] for u in entries).split()), 'changed text coverage')
        need(candidate[o['current_start']:o['current_end']] == o['after'], 'current operation span')
        linked += o['unit_ids']
    need(len(linked) == len(set(linked)) == len(units), 'unit ownership coverage')
    expected = base
    for o in sorted(ops, key=lambda o:o['source_start'], reverse=True):
        expected = expected[:o['source_start']] + o['after'] + expected[o['source_end']:]
    need(expected == candidate, 'unlisted change')
    inverse = candidate
    for o in sorted(ops, key=lambda o:o['current_start'], reverse=True):
        a,b = o['current_start'],o['current_end']
        need(inverse[a:b] == o['after'], 'inverse span')
        inverse = inverse[:a]+o['before']+inverse[b:]
    need(inverse == base, 'inverse reconstruction')
    need(base[:c0] == candidate[:candidate.index('### 14. ')], 'earlier narrative changed')
    need(base[c1:] == candidate[candidate.index('### 15. '):], 'later narrative changed')
    need(re.findall(r'^#{1,3} .+$',base,re.M) == re.findall(r'^#{1,3} .+$',candidate,re.M), 'headings')
    need(re.findall('“[^”]*”',base) == re.findall('“[^”]*”',candidate), 'quotations')
    for u in units+retained:
        need(u['owner'] in OWNERS and u['issue'] == f'https://github.com/{REPO}/issues/{u["owner"]}', 'unit owner')
        need(u['source_ids'] and set(u['source_ids']) <= set(sources), 'unit sources')
        need(u['case_finding'] is False and u['adoption'] == 'candidate-not-author-accepted', 'unit finding or acceptance')
        need(candidate[u['current_char_start']:u['current_char_end']] == u['text'], 'unit span')
        need(u['current_line'] == candidate.count('\n',0,u['current_char_start'])+1, 'unit line')
    for u in units:
        need(u['kind'] in NEW_KINDS and set(u['carelaw_ids']) <= CIDS, 'new unit classification')
        need(all(u.get(k) for k in ('source_support','review_question','evidence_needed','counterevidence_or_limit','closure_test','competent_review_function')), 'unit review')
        need({s['source_id'] for s in u['source_support']} == set(u['source_ids']), 'specific source support')
    paragraphs = data['paragraph_dispositions']
    raw_paragraphs = body_paragraphs(base)
    need(len(paragraphs) == len(raw_paragraphs) == 48, 'paragraph census')
    rby = {u['id']:u for u in retained}; rlinked=[]
    for n,(p,(a,b,text)) in enumerate(zip(paragraphs,raw_paragraphs),1):
        need(p['id'] == f'CL05-P{n:03d}' and p['baseline_paragraph'] == n, 'paragraph order')
        need((p['baseline_start'],p['baseline_end'],p['exact_before']) == (a,b,text), 'paragraph original')
        if p['status'] == 'retained-exact':
            need(candidate[p['current_start']:p['current_end']] == text, 'retained paragraph exactness')
            ru = [rby[i] for i in p['retained_unit_ids']]
            need(all(u['paragraph'] == p['id'] and u['review_limit'] for u in ru), 'retained review')
            need(' '.join(text.split()) == ' '.join(' '.join(u['text'] for u in ru).split()), 'retained text coverage')
            rlinked += p['retained_unit_ids']
        else:
            need(p['status'] == 'replaced-with-lineage', 'paragraph status')
            need(any(o['id'] == p['edit'] and o['mode'] == 'replace' and n in o['baseline_paragraphs'] for o in ops), 'replacement lineage')
    need(len(rlinked) == len(set(rlinked)) == len(retained), 'retained unit coverage')
    lineage_open = [u for u in retained if u['status'] == 'retained-source-lineage-open']
    need(lineage_open and all(u['owner'] == 50 and u['source_ids'] == ['B'] for u in lineage_open), 'retained source gap concealed')
    # Complete current chapter body accounted for, including unchanged prose.
    spans = sorted(units+retained,key=lambda u:u['current_char_start'])
    chapter_text = '\n\n'.join(t for _,_,t in body_paragraphs(candidate))
    need(' '.join(chapter_text.split()) == ' '.join(' '.join(u['text'] for u in spans).split()), 'whole chapter coverage')
    prior = data['prior_units']
    need(len(prior) == 226 and len({u['id'] for u in prior}) == 226, 'prior unit inventory')
    need(all(u['text'] in base and u['text'] in candidate for u in prior), 'prior unit lost')
    disposition = data['carelaw_dispositions']
    need(len(disposition) == 256 and {d['id'] for d in disposition} == CIDS, 'prior corpus census')
    for d in disposition:
        old = [u['id'] for u in prior if d['id'] in u['carelaw_ids']]
        new = [u['id'] for u in units if d['id'] in u['carelaw_ids']]
        need(d['earlier_units'] == old and d['new_units'] == new, 'cumulative links')
        need(d['source_issue'].startswith('https://github.com/grwtsk/huey/issues/'), 'corpus issue destination')
        need(d['status'] == ('adaptation-recorded' if old or new else 'retained-not-yet-adapted'), 'adaptation status')
    guards = data['scope_guards']
    need(set(guards) == {'legal_scope','noncondemnation','actual_effect','no_forgiveness_condition'}, 'scope guards')
    for name in ('legal_scope','noncondemnation','actual_effect'):
        need(guards[name] and guards[name] in candidate, 'lost source qualification')
    need(guards['no_forgiveness_condition'] and any(guards['no_forgiveness_condition'] == u['review_limit'] for u in retained), 'lost reader-agency review')
    return {'result':'PASS: structural and declared-source consistency only',
            'operations':11,'new_or_rewritten_units':78,'retained_units':189,
            'chapter_body_units':267,'prior_integration_units_preserved':226,
            'prior_corpus_units':256,
            'cumulative_prior_units_adapted':sum(bool(d['earlier_units'] or d['new_units']) for d in disposition),
            'baseline_words':words(base),'candidate_words':words(candidate),
            'net_words_added':words(candidate)-words(base),
            'other_chapters_unchanged':True,'quotation_sequence_unchanged':True,
            'source_lineage_gap_preserved':True,
            'limits':'No historical authentication, legal applicability, universal theology, complete subclause atomization, human acceptance or release certification.'}


def negative_tests(base: str, candidate: str, data: dict) -> list[str]:
    cases=[]
    def obj(name,edit):
        value=copy.deepcopy(data);edit(value);cases.append((name,base,candidate,value))
    def prose(name,edit):
        c=edit(candidate);d=copy.deepcopy(data);d['candidate_sha256']=digest(c);cases.append((name,base,c,d))
    prose('unlisted-earlier-edit',lambda t:t.replace('### 10. ','Unlisted edit.\n\n### 10. ',1))
    prose('unlisted-later-edit',lambda t:t.replace('### 15. ','Unlisted edit.\n\n### 15. ',1))
    obj('wrong-repository',lambda d:d.update(repository='grwtsk/neurology'))
    obj('wrong-issue',lambda d:d.update(issue=125))
    obj('missing-new-unit',lambda d:d['units'].pop())
    obj('missing-retained-unit',lambda d:d['retained_units'].pop())
    obj('wrong-owner',lambda d:d['units'][0].update(owner=120))
    obj('unknown-source',lambda d:d['units'][0].update(source_ids=['UNKNOWN']))
    obj('invented-acceptance',lambda d:d['units'][0].update(adoption='accepted'))
    obj('invented-factual-finding',lambda d:d['units'][0].update(case_finding=True))
    obj('omitted-counterevidence',lambda d:d['units'][0].update(counterevidence_or_limit=''))
    obj('untracked-changed-prose',lambda d:d['operations'][0].update(after=d['operations'][0]['after']+' Extra sentence.'))
    obj('operation-outside-chapter',lambda d:d['operations'][0].update(chapter=15))
    obj('lost-corpus-disposition',lambda d:d['carelaw_dispositions'].pop())
    obj('invented-source-finding',lambda d:d['sources'][0].update(case_finding=True))
    obj('changed-source-kind',lambda d:d['sources'][2].update(kind='signed-original-testimony'))
    obj('claimed-image-inspection',lambda d:d['source_checks'].update(icon_image_inspected=True))
    obj('concealed-declaration-gap',lambda d:d['source_checks'].update(retained_declaration_original_retrieved=True))
    obj('lost-prior-integration-unit',lambda d:d['prior_units'].pop())
    obj('wrong-before-text',lambda d:d['operations'][0].update(before='Invented predecessor.'))
    obj('duplicate-retained-owner',lambda d:d['paragraph_dispositions'][0]['retained_unit_ids'].append(d['paragraph_dispositions'][0]['retained_unit_ids'][0]))
    obj('invented-source-locator',lambda d:d['sources'][0].update(locator=''))
    for name,b,c,d in cases:
        try:
            validate(b,c,d)
        except (ValueError, KeyError):
            continue
        raise ValueError('invalid mutation accepted: '+name)
    return [name for name,_,_,_ in cases]


def local_file(root: Path, name: str) -> Path:
    path=(root/name).resolve()
    need(path.is_relative_to(root) and path.is_file(), 'unsafe or missing packet path')
    return path


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packet',required=True,type=Path)
    args=parser.parse_args()
    try:
        root=args.packet.resolve()
        data=json.loads(local_file(root,'changes-and-claims.json').read_text(encoding='utf-8'))
        base=local_file(root,data['baseline_file']).read_text(encoding='utf-8')
        candidate=local_file(root,data['candidate_file']).read_text(encoding='utf-8')
        report=validate(base,candidate,data)
        report['negative_tests_passed']=negative_tests(base,candidate,data)
        print(json.dumps(report,indent=2))
        return 0
    except (OSError, UnicodeError, ValueError, KeyError, TypeError):
        print('FAIL: packet consistency; inspect locally without posting private text.',file=sys.stderr)
        return 1

if __name__=='__main__':
    raise SystemExit(main())
