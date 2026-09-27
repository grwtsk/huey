#!/usr/bin/env python3
"""Read-only checks for the private HUEY-CL04 manuscript packet.

Run with --packet DIRECTORY. No network, source edits, publication or permissions.
Output reports structural counts, not private prose or private fingerprints.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

REPO='grwtsk/huey'
KINDS={'testimony','argument','research-model','interpretation','question',
       'request','source-description','ethics','law','scope','design'}
OWNERS={178,179,180,181,182,183,184,185,186}
SOURCE_IDS={'A','B','T','L17','L04','R01','W01','W02','W03','W04','W05','W06'}
GUARD_KEYS={'workload-model','surcharge','noneconomic','legal-scope','future-service','prior-trust'}

def need(condition: bool, message: str) -> None:
    if not condition: raise ValueError(message)

def digest(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()

def word_count(text: str) -> int:
    return len(' '.join(l for l in text.splitlines()
                if not l.startswith('#') and l.strip()!='* * *').split())

def validate(base: str, current: str, data: dict, previous: dict) -> dict:
    need(data.get('repository')==REPO and data.get('work_id')=='HUEY-CL04','wrong work/repository')
    need(data.get('pr')==122 and data.get('issue')==186,'wrong target')
    need(data.get('baseline_sha256')==digest(base) and data.get('candidate_sha256')==digest(current),'identity mismatch')
    need(data.get('scope')=={'chapters':[12,13],'manuscript_adoption':'candidate-not-author-accepted','external_actions':False,'original_letters_changed':False,'normative_proposals_are_not_legal_findings':True},'unsupported scope')
    ops,units=data['operations'],data['units']
    need(len(ops)==16 and {o['id'] for o in ops}=={f'CL04-E{i:02d}' for i in range(1,17)},'operation coverage')
    need(len(units)==117 and {u['id'] for u in units}=={f'HUEY-CL04-U{i:03d}' for i in range(1,118)},'unit coverage')
    src=data['sources']; sources={s['id']:s for s in src}
    need(len(src)==12 and set(sources)==SOURCE_IDS,'source coverage')
    need(all(s.get('case_finding') is False and s.get('locator') and s.get('limit') for s in src),'source limits')
    need(sources['T']['kind']=='editorial-derivative','derivative promoted to independent testimony')
    need(sources['R01']['checked']=='indexed-primary-abstract-and-excerpt','unread full paper claimed')
    need(all(sources[s]['checked']=='primary-instruction-text-on-reproduction-host' for s in ['W03','W05']),'unread official edition claimed')
    need(sources['W06']['checked']=='fresh-primary-page-read-success','successful new check lost')
    guards=data.get('scope_guards',{})
    need(set(guards)==GUARD_KEYS and all(isinstance(p,str) and p and p in current for p in guards.values()),'scope qualification lost')
    by_id={u['id']:u for u in units}
    previous_end=-1; owned=[]
    for o in sorted(ops,key=lambda x:x['source_start']):
        a,b=o['source_start'],o['source_end']
        need(0<=a<b<=len(base) and a>=previous_end,'invalid/overlapping edit')
        previous_end=b
        need(o['chapter'] in [12,13],'wrong chapter')
        ch_a=base.index(f'### {o["chapter"]}. '); ch_b=base.index(f'### {o["chapter"]+1}. ')
        need(ch_a<=a<b<=ch_b,'outside permitted chapter span')
        need(base[a:b]==o['before'] and o.get('reason'),'before/source mismatch')
        need(o['mode'] in ['replace','after'],'unknown operation')
        passage=o['after']
        if o['mode']=='after':
            need(passage.startswith(o['before']+'\n\n'),'insertion anchor lost')
            passage=passage[len(o['before'])+2:]
        need(passage==o['new_passage'],'new passage mismatch')
        group=[by_id[i] for i in o['unit_ids']]
        need(all(u['chapter']==o['chapter'] and u['edit']==o['id'] for u in group),'wrong unit/edit link')
        need(' '.join(passage.split())==' '.join(' '.join(u['text'] for u in group).split()),'untracked changed prose')
        owned.extend(o['unit_ids'])
    need(len(owned)==len(set(owned))==117,'missing/duplicate ownership')
    rebuilt=base
    for o in sorted(ops,key=lambda x:x['source_start'],reverse=True):
        rebuilt=rebuilt[:o['source_start']]+o['after']+rebuilt[o['source_end']:]
    need(rebuilt==current,'unlisted or unapplied edit')
    inverted=current
    for o in sorted(ops,key=lambda x:x['current_start'],reverse=True):
        a,b=o['current_start'],o['current_end']
        need(inverted[a:b]==o['after'],'current edit span')
        inverted=inverted[:a]+o['before']+inverted[b:]
    need(inverted==base,'inverse reconstruction')
    for u in units:
        need(u['kind'] in KINDS and u['owner'] in OWNERS,'unknown type/owner')
        need(u['issue']==f'https://github.com/{REPO}/issues/{u["owner"]}','wrong issue URL')
        need(u['adoption']=='candidate-not-author-accepted' and u['case_finding'] is False,'invented adoption/finding')
        need(u['source_ids'] and set(u['source_ids'])<=SOURCE_IDS,'unknown source')
        need(all(u.get(k) for k in ['evidence_needed','counterevidence_or_limit','review_question','closure_test']),'missing review field')
        a,b=u['current_char_start'],u['current_char_end']
        need(current[a:b]==u['text'] and u['current_line']==current.count('\n',0,a)+1,'unit locator mismatch')
        need([s['id'] for s in u['source_support']]==u['source_ids'],'source support mismatch')
        for s in u['source_support']:
            original=sources[s['id']]
            need(s['locator']==original['locator'] and s['limit']==original['limit'] and s['inspection']==original['checked'],'source locator/support drift')
    need(base[:base.index('### 12. ')]==current[:current.index('### 12. ')],'earlier chapter changed')
    need(base[base.index('### 14. '):]==current[current.index('### 14. '):],'later chapter/protected close changed')
    need(re.findall(r'^#{1,3} .+$',base,re.M)==re.findall(r'^#{1,3} .+$',current,re.M),'headings changed')
    need(re.findall('“[^”]*”',base)==re.findall('“[^”]*”',current),'quotation changed')
    # This is lexical preservation, not a fresh audit of old quantitative sources.
    numeric=[p for p in re.split(r'\n\n',base[base.index('### 12. '):base.index('### 14. ')]) if re.search(r'\d',p)]
    need(all(p in current for p in numeric),'existing numerical paragraph changed')
    old_units=previous['units']
    need(data['prior_unit_ids']==[u['id'] for u in old_units] and len(old_units)==109,'earlier unit ledger lost')
    need(all(current[u['current_char_start']:u['current_char_end']]==u['text'] for u in old_units),'earlier applied prose changed')
    disp=data['carelaw_dispositions']; need(len(disp)==256 and {x['id'] for x in disp}=={f'C{i:03d}' for i in range(1,257)},'prior corpus incomplete')
    old_used={c for u in old_units for c in u['carelaw_ids']}; new_used={c for u in units for c in u['carelaw_ids']}
    for x in disp:
        old=[u['id'] for u in old_units if x['id'] in u['carelaw_ids']]
        new=[u['id'] for u in units if x['id'] in u['carelaw_ids']]
        status='adapted-in-both-passes' if old and new else 'adapted-in-r04' if new else 'adapted-in-r03-retained' if old else 'retained-not-yet-adapted'
        need(x['earlier_units']==old and x['new_units']==new and x['status']==status,'wrong cumulative disposition')
    blocks=data['paragraph_dispositions']; expected=[]
    for ch in [12,13]:
        a,b=base.index(f'### {ch}. '),base.index(f'### {ch+1}. ')
        for m in re.finditer(r'\S[\s\S]*?(?=\n\n|\Z)',base[a:b]):
            expected.append((ch,a+m.start(),a+m.end(),m.group(0)))
    need(len(blocks)==len(expected)==132,'baseline block coverage')
    for block,(ch,a,b,text) in zip(blocks,expected):
        need((block['chapter'],block['source_start'],block['source_end'],block['text'])==(ch,a,b,text),'block identity')
        links=[o['id'] for o in ops if o['source_start']<b and o['source_end']>a]
        need(block['operations']==links,'block disposition links')
    return {'result':'PASS: structural and lineage checks only','operations':16,'insertions':sum(o['mode']=='after' for o in ops),'replacements':sum(o['mode']=='replace' for o in ops),'new_or_rewritten_units':117,'earlier_applied_units_preserved':109,'baseline_blocks_accounted_for':132,'baseline_words':word_count(base),'candidate_words':word_count(current),'net_words_added':word_count(current)-word_count(base),'carelaw_used_this_pass':len(new_used),'carelaw_newly_adapted':len(new_used-old_used),'carelaw_cumulative_adapted':len(new_used|old_used),'carelaw_retained_for_later':256-len(new_used|old_used),'source_records':12,'fresh_official_professional_or_regulatory_pages':4,'primary_instruction_reproductions':2,'research_abstract_records':1,'existing_numeric_blocks_preserved':len(numeric),'unchanged_other_chapters':True,'full_repository_suite_run':False}

def negative_tests(base: str,current: str,data: dict,previous: dict) -> list[str]:
    cases=[]
    def case(name,idx,edit):
        vals=[base,current,copy.deepcopy(data),copy.deepcopy(previous)]
        if idx<2:vals[idx]=edit(vals[idx])
        else:edit(vals[idx])
        vals[2]['baseline_sha256']=digest(vals[0]);vals[2]['candidate_sha256']=digest(vals[1])
        cases.append((name,vals))
    case('unlisted-later-edit',1,lambda s:s.replace('### 14. ','Unlisted addition.\n\n### 14. ',1))
    case('omitted-unit',2,lambda d:d['units'].pop())
    case('wrong-repository',2,lambda d:d.update(repository='grwtsk/neurology'))
    case('wrong-issue-owner',2,lambda d:d['units'][0].update(owner=120))
    case('unknown-source',2,lambda d:d['units'][0].update(source_ids=['UNSEEN']))
    case('invented-adoption',2,lambda d:d['units'][0].update(adoption='accepted'))
    case('invented-finding',2,lambda d:d['units'][0].update(case_finding=True))
    case('missing-counterevidence',2,lambda d:d['units'][0].update(counterevidence_or_limit=''))
    case('untracked-prose',2,lambda d:d['operations'][0].update(after=d['operations'][0]['after']+' Untracked.'))
    case('wrong-chapter',2,lambda d:d['operations'][0].update(chapter=15))
    case('missing-corpus-disposition',2,lambda d:d['carelaw_dispositions'].pop())
    case('unread-full-paper',2,lambda d:next(s for s in d['sources'] if s['id']=='R01').update(checked='full-paper-read'))
    case('derivative-as-witness',2,lambda d:next(s for s in d['sources'] if s['id']=='T').update(kind='independent-testimony'))
    case('false-official-edition-read',2,lambda d:next(s for s in d['sources'] if s['id']=='W03').update(checked='official-edition-read'))
    case('lost-previous-pass',2,lambda d:d['prior_unit_ids'].pop())
    case('false-finished-work',2,lambda d:d['scope'].update(external_actions=True))
    case('lost-baseline-block',2,lambda d:d['paragraph_dispositions'].pop())
    case('source-locator-drift',2,lambda d:d['units'][0]['source_support'][0].update(locator='Unknown original'))
    for name,vals in cases:
        try:validate(*vals)
        except (ValueError,KeyError):continue
        raise ValueError('invalid fixture accepted')
    return [name for name,_ in cases]

def local_file(root: Path,name: str) -> Path:
    p=(root/name).resolve()
    need(root in p.parents,'file outside packet')
    return p

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packet',required=True,type=Path)
    args=parser.parse_args()
    try:
        root=args.packet.resolve();data=json.loads((root/'changes-and-claims.json').read_text(encoding='utf-8'))
        base=local_file(root,data['baseline_file']).read_text(encoding='utf-8')
        current=local_file(root,data['candidate_file']).read_text(encoding='utf-8')
        with zipfile.ZipFile(local_file(root,data['baseline_packet'])) as z:
            previous=json.loads(z.read('changes-and-claims.json'))
            need(z.read(previous['candidate_file']).decode('utf-8')==base,'prior archive candidate mismatch')
        result=validate(base,current,data,previous)
        result['negative_tests_passed']=negative_tests(base,current,data,previous)
        print(json.dumps(result,indent=2));return 0
    except (OSError,ValueError,KeyError,TypeError,zipfile.BadZipFile):
        print('FAIL: inspect the private packet locally; no source text is printed.',file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
