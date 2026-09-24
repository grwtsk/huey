#!/usr/bin/env python3
"""Read-only checks for the private HUEY-CL07 author-review packet.

Run with --packet DIRECTORY. Output contains counts and check names, not private
prose or fingerprints. No network requests or source writes. These checks establish
consistency, not historical truth, medical/legal adequacy, assent or publication.
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

OWNERS = set(range(178,188))
KINDS = {'argument','request','question','source-description','interpretation',
         'law','ethics','guidance','scope','testimony','editorial'}

def need(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)

def digest(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def words(text: str) -> int:
    return len(' '.join(line for line in text.splitlines()
                        if not line.startswith('#') and line.strip()!='* * *').split())

def validate(base: str, candidate: str, data: dict) -> dict:
    need(data.get('repository')=='grwtsk/huey', 'wrong repository')
    need((data.get('work_id'),data.get('issue'),data.get('pr'))==('HUEY-CL07',186,122), 'wrong work target')
    need(data.get('allowed_chapters')==[6,7], 'wrong target chapters')
    need(data.get('adoption')=='candidate-not-author-accepted', 'invented acceptance')
    need(data.get('baseline_sha256')==digest(base) and data.get('candidate_sha256')==digest(candidate),'identity mismatch')
    ops=data['operations'];units=data['units'];sources=data['sources']
    need(len(ops)==19 and len(units)==88,'operation or unit coverage')
    need({o['id'] for o in ops}=={f'CL07-E{i:02}' for i in range(1,20)},'operation IDs')
    need({u['id'] for u in units}=={f'HUEY-CL07-U{i:03}' for i in range(1,89)},'unit IDs')
    src={s['id']:s for s in sources};byid={u['id']:u for u in units}
    need(len(src)==len(sources)==13 and sum(bool(s.get('url')) for s in sources)==5,'source coverage')
    for s in sources:
        need(s.get('case_finding') is False and s.get('locator') and s.get('limit') and s.get('inspection'),'incomplete source or fabricated finding')
    end=-1;linked=[]
    for op in sorted(ops,key=lambda o:o['source_start']):
        start,stop=op['source_start'],op['source_end']
        need(isinstance(start,int) and isinstance(stop,int) and end<=start<stop<=len(base),'overlapping/invalid operation')
        end=stop
        need(op['chapter'] in (6,7),'outside target chapters')
        a=base.index(f'### {op["chapter"]}. ');b=base.index(f'### {op["chapter"]+1}. ')
        need(a<=start<stop<=b,'outside declared chapter')
        need(base[start:stop]==op['before'],'before-text mismatch')
        need(op['mode'] in ('replace','after'),'unknown mode')
        if op['mode']=='after':
            need(op['after'].startswith(op['before']+'\n\n'),'lost anchor')
            change=op['after'][len(op['before'])+2:]
        else:
            change=op['after']
        group=[byid[x] for x in op['unit_ids']]
        need(all(u['edit']==op['id'] and u['chapter']==op['chapter'] for u in group),'incorrect unit relation')
        need(' '.join(change.split())==' '.join(' '.join(u['text'] for u in group).split()),'untracked changed prose')
        linked.extend(op['unit_ids'])
        for key in ('source_locator','review_question','evidence_needed','counterevidence_or_limit','competent_review_function','closure_test'):
            need(bool(op.get(key)),'incomplete operation review')
    need(len(linked)==len(set(linked))==88,'unit assignment')
    expected=base
    for op in sorted(ops,key=lambda o:o['source_start'],reverse=True):
        expected=expected[:op['source_start']]+op['after']+expected[op['source_end']:]
    need(expected==candidate,'unlisted or unapplied manuscript change')
    # Derive current replacement spans without relying on substring uniqueness.
    delta=0;located=[]
    for op in sorted(ops,key=lambda o:o['source_start']):
        a=op['source_start']+delta;b=a+len(op['after'])
        need(candidate[a:b]==op['after'],'forward span mismatch')
        located.append((a,b,op['before']))
        delta+=len(op['after'])-len(op['before'])
    inverse=candidate
    for a,b,before in reversed(located):
        inverse=inverse[:a]+before+inverse[b:]
    need(inverse==base,'reverse reconstruction')
    need(base[:base.index('### 6. ')]==candidate[:candidate.index('### 6. ')],'earlier prose changed')
    need(base[base.index('### 8. '):]==candidate[candidate.index('### 8. '):],'later prose or protected close changed')
    need(re.findall(r'^#{1,3} .+$',base,re.M)==re.findall(r'^#{1,3} .+$',candidate,re.M),'headings/movements changed')
    need(re.findall('“[^”]*”',base)==re.findall('“[^”]*”',candidate),'quote sequence changed')
    for u in units:
        need(u['kind'] in KINDS and u['owner'] in OWNERS,'unknown kind/owner')
        need(u['issue']==f'https://github.com/grwtsk/huey/issues/{u["owner"]}','wrong issue URL')
        need(u['source_ids'] and set(u['source_ids'])<=set(src),'unknown source')
        need(u['case_finding'] is False and u['adoption']=='candidate-not-author-accepted','invented case result or acceptance')
        for key in ('source_locator','review_question','evidence_needed','counterevidence_or_limit','competent_review_function','closure_test'):
            need(bool(u.get(key)),'incomplete unit review')
        a,b=u['current_char_start'],u['current_char_end']
        need(candidate[a:b]==u['text'],'unit exact span')
        need(candidate[:a].count('\n')+1==u['current_line'],'unit line locator')
    previous=data['prior_units']
    need(len(previous)==len({p['id'] for p in previous})==572,'prior passage coverage')
    for p in previous:
        need(p['text'] in base and candidate.count(p['text'])>=base.count(p['text']),'earlier passage removed')
    paragraphs=data['paragraph_dispositions']
    need(len(paragraphs)==len({p['id'] for p in paragraphs})==87,'paragraph coverage')
    expected_ps=[]
    for c in (6,7):
        text=base[base.index(f'### {c}. '):base.index(f'### {c+1}. ')]
        for i,p in enumerate(p for p in re.split(r'\n\s*\n',text) if p.strip()):
            if not p.startswith('#') and p.strip()!='* * *':expected_ps.append((c,i,p))
    need([(p['chapter'],p['baseline_index'],p['text']) for p in paragraphs]==expected_ps,'paragraph source drift')
    for p in paragraphs:
        need(p['owner'] in OWNERS and set(p['source_ids'])<=set(src),'paragraph owner/source')
        need(p['review_state']=='source-aware-paragraph-review-not-independent-verification','overstated paragraph review')
        edits=[o for o in ops if o['chapter']==p['chapter'] and o['baseline_paragraph']==p['baseline_index']]
        need(p['edit_ids']==[o['id'] for o in edits],'paragraph edit link')
        replaced=any(o['mode']=='replace' for o in edits)
        need(p['disposition']==('replaced-with-lineage' if replaced else 'retained-exact'),'paragraph disposition')
        need(replaced or p['text'] in candidate,'retained paragraph missing')
    original=data['carelaw_dispositions']
    need(len(original)==256 and {p['id'] for p in original}=={f'C{i:03}' for i in range(1,257)},'C001–C256 coverage')
    all_cids={p['id'] for p in original}
    need(all(set(u['carelaw_ids'])<=all_cids for u in units),'unknown original claim')
    for p in original:
        now=[u['id'] for u in units if p['id'] in u['carelaw_ids']]
        before=[u['id'] for u in previous if p['id'] in u.get('carelaw_ids',[])]
        need(p['new_units']==now and p['earlier_units']==before,'C-to-manuscript lineage')
        need(p['source_issue'].startswith('https://github.com/grwtsk/huey/issues/'),'wrong original owner')
    guards=data.get('scope_guard_ids',[])
    need(len(guards)==len(set(guards))==8 and set(guards)<=set(byid),'missing source-scope guards')
    counts={'operations':len(ops),'new_units':len(units),'target_paragraphs':len(paragraphs),
            'retained_paragraphs':sum(p['disposition']=='retained-exact' for p in paragraphs),
            'baseline_words':words(base),'candidate_words':words(candidate),'net_words_added':words(candidate)-words(base),
            'previous_units_preserved':len(previous),'selected_prior_ids':len({c for u in units for c in u['carelaw_ids']}),
            'cumulative_prior_ids':sum(bool(p['earlier_units'] or p['new_units']) for p in original),
            'sources':len(sources),'fresh_public_sources':5}
    need(data['counts']==counts,'reported count mismatch')
    return counts

def negative_tests(base: str, candidate: str, data: dict) -> list[str]:
    cases=[]
    def obj(name,action):
        d=copy.deepcopy(data);action(d);cases.append((name,base,candidate,d))
    def prose(name,anchor,insertion):
        need(anchor in candidate,'invalid mutation setup')
        c=candidate.replace(anchor,insertion+anchor,1);d=copy.deepcopy(data)
        d['candidate_sha256']=digest(c);cases.append((name,base,c,d))
    prose('unlisted-later-change','### 8. ','Synthetic extra paragraph.\n\n')
    prose('unlisted-earlier-change','### 3. ','Synthetic extra paragraph.\n\n')
    obj('wrong-repository',lambda d:d.update(repository='grwtsk/neurology'))
    obj('wrong-pr',lambda d:d.update(pr=131))
    obj('wrong-issue-owner',lambda d:d['units'][0].update(owner=120))
    obj('wrong-issue-url',lambda d:d['units'][0].update(issue='https://github.com/grwtsk/neurology/issues/178'))
    obj('omitted-unit',lambda d:d['units'].pop())
    obj('duplicate-unit',lambda d:d['units'][-1].update(id=d['units'][0]['id']))
    obj('unknown-source',lambda d:d['units'][0].update(source_ids=['UNKNOWN']))
    obj('invented-acceptance',lambda d:d['units'][0].update(adoption='accepted'))
    obj('invented-finding',lambda d:d['sources'][0].update(case_finding=True))
    obj('missing-counterevidence',lambda d:d['units'][0].update(counterevidence_or_limit=''))
    obj('missing-review-question',lambda d:d['operations'][0].update(review_question=''))
    obj('lost-before-text',lambda d:d['operations'][0].update(before='Invented original.'))
    obj('wrong-target-chapter',lambda d:d['operations'][0].update(chapter=15))
    obj('untracked-added-sentence',lambda d:d['operations'][0].update(after=d['operations'][0]['after']+' Untracked sentence.'))
    obj('lost-prior-passage',lambda d:d['prior_units'].pop())
    obj('lost-original-unit',lambda d:d['carelaw_dispositions'].pop())
    obj('wrong-corpus-link',lambda d:d['carelaw_dispositions'][0].update(new_units=['HUEY-CL07-U001']))
    obj('missing-baseline-paragraph',lambda d:d['paragraph_dispositions'].pop())
    obj('invented-paragraph-verification',lambda d:d['paragraph_dispositions'][0].update(review_state='independently-verified'))
    obj('false-disposition',lambda d:d['paragraph_dispositions'][0].update(disposition='replaced-with-lineage'))
    obj('wrong-line-locator',lambda d:d['units'][0].update(current_line=1))
    obj('inflated-word-count',lambda d:d['counts'].update(candidate_words=d['counts']['candidate_words']+1000))
    obj('missing-scope-guard',lambda d:d['scope_guard_ids'].pop())
    for name,b,c,d in cases:
        try:
            validate(b,c,d)
        except (ValueError,KeyError,TypeError):
            continue
        raise ValueError('invalid mutation accepted: '+name)
    return [n for n,_,_,_ in cases]

def check_public_indexes(root: Path, data: dict) -> None:
    path=root/'public/integration-r07.tsv'
    rows=list(csv.DictReader(path.open(encoding='utf-8'),delimiter='\t'))
    need(len(rows)==88,'public unit index count')
    for row,u in zip(rows,data['units']):
        expected=[u['id'],u['edit'],str(u['chapter']),u['kind'],str(u['owner']),','.join(u['source_ids']),','.join(u['carelaw_ids']) or '-']
        need(list(row.values())==expected,'public unit index differs')
    rows=list(csv.DictReader((root/'public/integration-r07-paragraphs.tsv').open(encoding='utf-8'),delimiter='\t'))
    need(len(rows)==87,'public paragraph index count')
    for row,p in zip(rows,data['paragraph_dispositions']):
        expected=[p['id'],str(p['chapter']),p['disposition'],','.join(p['edit_ids']) or '-',str(p['owner']),','.join(p['source_ids']),p['review_state']]
        need(list(row.values())==expected,'public paragraph index differs')

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packet',required=True,type=Path)
    args=parser.parse_args()
    try:
        root=args.packet.resolve();data=json.loads((root/'changes-and-claims.json').read_text())
        def read_named(name: str) -> str:
            p=(root/name).resolve();need(p.is_relative_to(root),'path outside packet');return p.read_text(encoding='utf-8')
        base=read_named(data['baseline_file']);candidate=read_named(data['candidate_file'])
        result=validate(base,candidate,data)
        result['negative_tests_passed']=negative_tests(base,candidate,data)
        check_public_indexes(root,data)
        result['public_indexes_match']=True;result['result']='PASS'
        result['limits']='Structural and lineage checks, not independent source truth, clinical/legal findings, acceptance or a release.'
        print(json.dumps(result,indent=2));return 0
    except (OSError,UnicodeError,ValueError,KeyError,TypeError):
        print('FAIL: inspect packet locally without posting private source text.',file=sys.stderr);return 1

if __name__=='__main__':
    raise SystemExit(main())
