#!/usr/bin/env python3
"""Read-only HUEY-CL06 private-packet checks; no network or manuscript disclosure.

Checks exact changes, attribution fields and specified regressions, not truth,
clinical/legal adequacy, witness credibility, author acceptance or publication.
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

OWNERS={178,179,180,181,184}
TYPES={'argument','question','request','law','scope','ethics'}
SOURCE_IDS={'A','B','L08','L10','L17'}|{f'W{i:02d}' for i in range(1,9)}

def need(ok: bool, message: str)->None:
    if not ok: raise ValueError(message)

def digest(s: str)->str:
    return hashlib.sha256(s.encode('utf-8')).hexdigest()

def words(s: str)->int:
    return len(' '.join(l for l in s.splitlines() if not l.startswith('#') and l.strip()!='* * *').split())

def paras(s: str,a: int,b: int):
    for m in re.finditer(r'[^\n]+(?:\n(?!\n)[^\n]+)*',s[a:b]):
        if not m.group().startswith('#') and m.group().strip()!='* * *':
            yield a+m.start(),a+m.end(),m.group()

def check(base: str, candidate: str, d: dict)->dict:
    need(d.get('repository')=='grwtsk/huey','wrong repository')
    need((d.get('work_id'),d.get('pr'),d.get('issue'))==('HUEY-CL06',122,186),'wrong target')
    need(d.get('allowed_chapters')==[3,4,5],'wrong permitted scope')
    need(d.get('adoption')=='candidate-not-author-accepted','invented adoption')
    need(d.get('baseline_sha256')==digest(base) and d.get('candidate_sha256')==digest(candidate),'identity mismatch')
    ops=d['operations'];units=d['units'];by_id={u['id']:u for u in units}
    need(len(ops)==16 and {o['id'] for o in ops}=={f'CL06-E{i:02d}' for i in range(1,17)},'operations')
    need(len(units)==len(by_id)==79 and set(by_id)=={f'HUEY-CL06-U{i:03d}' for i in range(1,80)},'unit IDs')
    ss={s['id']:s for s in d['sources']}
    need(len(d['sources'])==len(ss)==13 and set(ss)==SOURCE_IDS,'source IDs')
    for s in ss.values():
        need(s.get('locator') and s.get('limit') and s.get('case_finding') is False,'source status/limits')
        need(s.get('inspection') in {'read-in-this-pass','mounted-bytes-compared-and-target-chapters-read'},'unsupported inspection status')
    need(sum(bool(s.get('url')) for s in ss.values())==8,'public source count')
    ordered=sorted(ops,key=lambda o:o['source_start']);last=-1;shift=0;owned=[]
    for o in ordered:
        a,b=o['source_start'],o['source_end'];ch=o['chapter']
        need(ch in (3,4,5) and a>=last and b>a,'overlap/invalid scope')
        need(base.index(f'### {ch}. ')<=a<b<base.index(f'### {ch+1}. '),'outside declared chapter')
        need(base[a:b]==o['before'],'before text')
        need(o['current_start']==a+shift and o['current_end']==a+shift+len(o['after']),'operation spans')
        need(candidate[o['current_start']:o['current_end']]==o['after'],'after text')
        need(o['mode'] in {'after','replace'},'edit mode')
        added=o['after']
        if o['mode']=='after':
            need(added.startswith(o['before']+'\n\n'),'lost anchor')
            added=added[len(o['before'])+2:]
        us=[by_id[k] for k in o['unit_ids']]
        need(all(u['edit']==o['id'] and u['chapter']==ch for u in us),'unit association')
        need(' '.join(added.split())==' '.join(' '.join(u['text'] for u in us).split()),'untracked changed prose')
        owned.extend(o['unit_ids']);last=b;shift+=len(o['after'])-len(o['before'])
    need(len(owned)==len(set(owned))==79,'unit ownership')
    expected=base
    for o in reversed(ordered):expected=expected[:o['source_start']]+o['after']+expected[o['source_end']:]
    need(expected==candidate,'unlisted change')
    inverse=candidate
    for o in reversed(ordered):inverse=inverse[:o['current_start']]+o['before']+inverse[o['current_end']:]
    need(inverse==base,'inverse mismatch')
    need(base[:base.index('### 3. ')]==candidate[:candidate.index('### 3. ')],'earlier material changed')
    need(base[base.index('### 6. '):]==candidate[candidate.index('### 6. '):],'later material changed')
    need(re.findall(r'^#{1,3} .+$',base,re.M)==re.findall(r'^#{1,3} .+$',candidate,re.M),'heading sequence')
    need(re.findall('“[^”]*”',base)==re.findall('“[^”]*”',candidate),'quotation sequence')
    for u in units:
        need(u['owner'] in OWNERS and u['issue']==f'https://github.com/grwtsk/huey/issues/{u["owner"]}','wrong owner')
        need(u['kind'] in TYPES and u['source_ids'] and set(u['source_ids'])<=SOURCE_IDS,'unit type/source')
        need(u['adoption']=='candidate-not-author-accepted' and u['case_finding'] is False,'unsupported finding/adoption')
        need(all(u.get(k) for k in ('review_question','evidence_needed','counterevidence_or_limit','competent_review_function','closure_test')),'review incomplete')
        need(candidate[u['current_char_start']:u['current_char_end']]==u['text'],'exact unit span')
        need(u['current_line']==candidate[:u['current_char_start']].count('\n')+1,'line mismatch')
        need([x['source_id'] for x in u['source_support']]==u['source_ids'],'support IDs')
        for sup in u['source_support']:
            need(sup['locator']==ss[sup['source_id']]['locator'] and sup['limit']==ss[sup['source_id']]['limit'],'support mismatch')
    pr=d['paragraph_dispositions']
    expected_paras=[]
    for ch in (3,4,5):
        expected_paras += [(ch,a,b,t) for a,b,t in paras(base,base.index(f'### {ch}. '),base.index(f'### {ch+1}. '))]
    need(len(pr)==len(expected_paras)==140,'paragraph coverage')
    for p,(ch,a,b,t) in zip(pr,expected_paras):
        need((p['chapter'],p['baseline_start'],p['baseline_end'],p['text'])==(ch,a,b,t),'retained source paragraph')
        need(p['case_finding'] is False and p['source_ids'] and p['review_limit'],'retained status')
        covering=[o for o in ops if o['source_start']<=a and o['source_end']>=b and o['mode']=='replace']
        need(p['status']==('replaced-with-lineage' if covering else 'retained-exact'),'paragraph disposition')
        if not covering:need(candidate[p['current_start']:p['current_end']]==t,'retained paragraph changed')
    prior=d['prior_units']
    need(len(prior)==493 and len({u['id'] for u in prior})==493,'earlier unit coverage')
    for u in prior:need(u['text'] in base and u['text'] in candidate and u['status']=='retained-exact-from-r05','lost earlier unit')
    disp=d['carelaw_dispositions'];need(len(disp)==256 and {r['id'] for r in disp}=={f'C{i:03d}' for i in range(1,257)},'prior C coverage')
    for r in disp:
        need(r['new_units']==[u['id'] for u in units if r['id'] in u['carelaw_ids']],'C mapping')
        need(r['source_issue'].startswith('https://github.com/grwtsk/huey/issues/'),'prior C owner')
        state='adapted-in-this-pass' if r['new_units'] else 'adapted-in-earlier-pass' if r['earlier_units'] else 'retained-not-yet-adapted'
        need(r['status']==state,'C disposition')
    need(words(base)==46804 and words(candidate)==48212,'word count')
    return dict(result='PASS: structural checks only',operations=16,new_or_rewritten_units=79,
       baseline_words=words(base),candidate_words=words(candidate),net_words_added=words(candidate)-words(base),
       target_paragraphs=140,unchanged_paragraphs=137,previously_tracked_units_preserved=493,
       prior_corpus_ids=256,cumulative_adapted_ids=sum(bool(r['earlier_units'] or r['new_units']) for r in disp),
       sources=13,fresh_public_authorities=8,unchanged_other_chapters=True,unchanged_quote_sequence=True)

def mutations(base: str,candidate: str,d: dict)->list[str]:
    tests=[]
    def obj(name,fn):
        x=copy.deepcopy(d);fn(x);tests.append((name,base,candidate,x))
    def text(name,fn):
        c=fn(candidate);x=copy.deepcopy(d);x['candidate_sha256']=digest(c);tests.append((name,base,c,x))
    obj('wrong-repository',lambda x:x.update(repository='grwtsk/neurology'))
    obj('wrong-PR',lambda x:x.update(pr=131))
    obj('invented-acceptance',lambda x:x.update(adoption='accepted'))
    obj('scope-expanded',lambda x:x.update(allowed_chapters=[3,4,5,15]))
    obj('lost-unit',lambda x:x['units'].pop())
    obj('duplicate-unit',lambda x:x['units'][1].update(id=x['units'][0]['id']))
    obj('wrong-unit-owner',lambda x:x['units'][0].update(owner=120))
    obj('unknown-source',lambda x:x['units'][0].update(source_ids=['X99']))
    obj('invented-case-finding',lambda x:x['units'][0].update(case_finding=True))
    obj('lost-counterevidence',lambda x:x['units'][0].update(counterevidence_or_limit=''))
    obj('lost-closure-test',lambda x:x['units'][0].update(closure_test=''))
    obj('source-promoted-to-finding',lambda x:x['sources'][2].update(case_finding=True))
    obj('invented-original-note-inspection',lambda x:x['sources'][3].update(inspection='original-note-authenticated'))
    obj('lost-source-limit',lambda x:x['sources'][5].update(limit=''))
    obj('untracked-new-sentence',lambda x:x['operations'][0].update(after=x['operations'][0]['after']+' Untracked sentence.'))
    obj('source-anchor-rewritten',lambda x:x['operations'][0].update(before='Not the supplied source.'))
    obj('lost-retained-paragraph',lambda x:x['paragraph_dispositions'].pop())
    obj('lost-prior-unit',lambda x:x['prior_units'].pop())
    obj('lost-C-disposition',lambda x:x['carelaw_dispositions'].pop())
    obj('incorrect-C-adaptation',lambda x:x['carelaw_dispositions'][0].update(new_units=['HUEY-CL06-U001']))
    obj('unit-span-shifted',lambda x:x['units'][0].update(current_char_start=x['units'][0]['current_char_start']+1))
    text('unlisted-later-change',lambda c:c.replace('### 6. ','Unlisted paragraph.\n\n### 6. ',1))
    text('opening-altered',lambda c:'Unlisted opening.\n\n'+c)
    text('original-quotation-altered',lambda c:re.sub('“[^”]*”','“Altered source wording.”',c,count=1))
    for name,b,c,x in tests:
        try:check(b,c,x)
        except (ValueError,KeyError):continue
        raise ValueError('invalid fixture accepted: '+name)
    return [t[0] for t in tests]

def safe(root:Path,name:str)->Path:
    p=(root/name).resolve();need(root in p.parents,'path outside packet');return p

def main()->int:
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--packet',type=Path,required=True);a=ap.parse_args()
    try:
        root=a.packet.resolve();d=json.loads((root/'changes-and-claims.json').read_text())
        base=safe(root,d['baseline_file']).read_text();candidate=safe(root,d['candidate_file']).read_text()
        result=check(base,candidate,d)
        with zipfile.ZipFile(root/'huey-care-law-r05-author-review.zip') as z:
            need(z.read('huey-narrative-care-law-r05.md')==base.encode(),'predecessor archive mismatch')
            old=json.loads(z.read('changes-and-claims.json'))
        old_units=old['prior_units']+old['units']+old['retained_units']
        need([(u['id'],u['text']) for u in d['prior_units']]==[(u['id'],u['text']) for u in old_units],'inherited record mismatch')
        old_disp={r['id']:r for r in old['carelaw_dispositions']}
        for r in d['carelaw_dispositions']:
            prev=old_disp[r['id']];need(r['earlier_units']==prev.get('earlier_units',[])+prev.get('new_units',[]),'earlier lineage lost')
        result['negative_tests_passed']=mutations(base,candidate,d)
        result['predecessor_archive_and_ledgers_compared']=True
        result['limits']=['Not historical authenticity, source truth, legal/clinical sufficiency, author acceptance or release.',
                          'Retained paragraph mapping is not complete clause-level factual verification.',
                          'Original note, separate witness account and audit logs were not recovered; unavailable is not nonexistent.',
                          'Full repository suite and hosted CI were not run.']
        print(json.dumps(result,indent=2));return 0
    except (OSError,ValueError,KeyError,TypeError,zipfile.BadZipFile):
        print('FAIL: private packet consistency; inspect locally without posting manuscript text.',file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
