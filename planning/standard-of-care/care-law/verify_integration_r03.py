#!/usr/bin/env python3
"""Read-only validation of the private HUEY-CL03 author-review packet.

Requires --packet pointing to its directory. No network or source modification.
The JSON output contains counts and check names, not manuscript text or hashes.
Consistency checks are not source authentication or legal/clinical findings.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import re
import sys
from pathlib import Path

OWNERS = {178,179,180,181,182,183,184,185,186}
KINDS = {'argument','request','law','question','interpretation','source-description',
         'scope','ethics','policy','hypothesis','testimony','editorial'}

def need(ok: bool, why: str) -> None:
    if not ok: raise ValueError(why)

def digest(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()

def words(text: str) -> int:
    # Same whitespace convention used for comparison, including the author line.
    return len(' '.join(l for l in text.splitlines()
                        if not l.startswith('#') and l.strip() != '* * *').split())

def validate(base: str, candidate: str, data: dict) -> dict:
    need(data.get('repository') == 'grwtsk/huey', 'wrong repository')
    need(data.get('work_id') == 'HUEY-CL03' and data.get('issue') == 186 and data.get('pr') == 122, 'wrong work target')
    need(data.get('baseline_sha256') == digest(base), 'baseline identity')
    need(data.get('candidate_sha256') == digest(candidate), 'candidate identity')
    ops, units = data['operations'], data['units']
    need(len(ops)==11 and len(units)==109, 'incorrect operation or unit count')
    need({o['id'] for o in ops}=={f'CL03-E{i:02d}' for i in range(1,12)}, 'operation IDs')
    need({u['id'] for u in units}=={f'HUEY-CL03-U{i:03d}' for i in range(1,110)}, 'unit IDs')
    sources={s['id']:s for s in data['sources']}
    need(len(sources)==13 and all(s.get('case_finding') is False for s in sources.values()), 'source status')
    need(all(s.get('locator') and s.get('limit') for s in sources.values()), 'source limits')
    need(sum(bool(s.get('url')) for s in sources.values())==8, 'public source count')
    by_id={u['id']:u for u in units}; linked=[]
    last_end=-1
    for o in sorted(ops,key=lambda o:o['source_start']):
        start,end=o['source_start'],o['source_end']
        need(start>=last_end and end>start, 'overlap or empty operation')
        last_end=end
        need(o['chapter'] in (10,11), 'outside permitted chapters')
        chstart=base.index(f'### {o["chapter"]}. ')
        chend=base.index(f'### {o["chapter"]+1}. ',chstart)
        need(chstart<=start<end<=chend, 'operation outside declared chapter')
        need(base[start:end]==o['before'], 'exact before-text mismatch')
        need(o['mode'] in ('replace','after'), 'unknown edit operation')
        if o['mode']=='after':
            need(o['after'].startswith(o['before']+'\n\n'), 'lost retained anchor')
            addition=o['after'][len(o['before'])+2:]
        else: addition=o['after']
        entries=[by_id[i] for i in o['unit_ids']]
        need(all(u['edit']==o['id'] and u['chapter']==o['chapter'] for u in entries), 'wrong unit association')
        need(' '.join(addition.split()) == ' '.join(' '.join(u['text'] for u in entries).split()), 'untracked changed prose')
        linked.extend(o['unit_ids'])
    need(len(linked)==len(set(linked))==len(units), 'missing or duplicate unit ownership')
    expected=base
    for o in sorted(ops,key=lambda o:o['source_start'],reverse=True):
        expected=expected[:o['source_start']]+o['after']+expected[o['source_end']:]
    need(expected==candidate, 'unlisted or unapplied manuscript change')
    need(re.findall(r'^#{1,3} .+$',base,re.M)==re.findall(r'^#{1,3} .+$',candidate,re.M), 'heading or movement change')
    need(re.findall('“[^”]*”',base)==re.findall('“[^”]*”',candidate), 'quotation sequence change')
    need(base[:base.index('### 10. ')]==candidate[:candidate.index('### 10. ')], 'earlier chapters changed')
    need(base[base.index('### 12. '):]==candidate[candidate.index('### 12. '):], 'later chapters or protected ending changed')
    for u in units:
        need(u['owner'] in OWNERS and u['issue']==f'https://github.com/grwtsk/huey/issues/{u["owner"]}', 'wrong issue owner')
        need(u['kind'] in KINDS and set(u['source'])<=set(sources), 'unknown source or type')
        need(u['adoption']=='candidate-not-author-accepted', 'invented acceptance')
        need(u['review_question'] and u['evidence_needed'] and u['counterevidence_or_limit'], 'incomplete review')
        need(candidate[u['current_char_start']:u['current_char_end']]==u['text'], 'unit exact span')
    dispositions=data['carelaw_dispositions']
    need(len(dispositions)==256 and {d['id'] for d in dispositions}=={f'C{i:03d}' for i in range(1,257)}, 'incomplete prior-corpus accounting')
    used={c for u in units for c in u['carelaw_ids']}
    need(len(used)==65, 'incorrect prior-corpus selection')
    for d in dispositions:
        expected_links=[u['id'] for u in units if d['id'] in u['carelaw_ids']]
        need(d['new_units']==expected_links, 'incorrect source-to-prose mapping')
    # These source limits are checked in addition to the full text/lineage comparison.
    joined=' '.join(u['text'] for u in units)
    guards = data.get('scope_guards', {})
    need(set(guards) == {'burden','policy_version','presumption','role_limit'}, 'missing scope guards')
    for required in guards.values():
        need(isinstance(required,str) and required and required in joined, 'source-scope qualification lost')
    # The inverse comparison preserves all prior text, including displaced paragraphs.
    inverse=candidate
    for o in sorted(ops,key=lambda o:candidate.index(o['after']),reverse=True):
        at=inverse.index(o['after'])
        inverse=inverse[:at]+o['before']+inverse[at+len(o['after']):]
    need(inverse==base, 'reverse reconstruction')
    return {'operations':11,'new_or_rewritten_units':109,'prior_corpus_units':256,
            'prior_units_selectively_adapted':65,'public_authorities_checked':8,
            'baseline_words':words(base),'candidate_words':words(candidate),
            'net_words_added':words(candidate)-words(base),
            'unchanged_other_chapters':True,'unchanged_quotation_sequence':True,
            'scope':'Exact reconstruction and declared source/review consistency; not truth, acceptance or release.'}

def negative_tests(base: str, candidate: str, data: dict) -> list[str]:
    cases=[]
    def change(name,index,func):
        args=[base,candidate,copy.deepcopy(data)]
        if index<2: args[index]=func(args[index])
        else: func(args[index])
        # Mutations recompute top-level digests so hash disagreement is not the defense.
        args[2]['baseline_sha256']=digest(args[0]); args[2]['candidate_sha256']=digest(args[1])
        cases.append((name,args))
    change('unlisted-later-edit',1,lambda x:x.replace('### 12. ', 'Synthetic unlisted paragraph.\n\n### 12. ', 1))
    change('omitted-unit',2,lambda d:d['units'].pop())
    change('wrong-repository',2,lambda d:d.update(repository='grwtsk/neurology'))
    change('wrong-owner',2,lambda d:d['units'][0].update(owner=120))
    change('unknown-source',2,lambda d:d['units'][0].update(source=['MISSING']))
    change('invented-acceptance',2,lambda d:d['units'][0].update(adoption='accepted'))
    change('lost-counterevidence',2,lambda d:d['units'][0].update(counterevidence_or_limit=''))
    change('untracked-sentence',2,lambda d:d['operations'][0].update(after=d['operations'][0]['after']+' Untracked sentence.'))
    change('wrong-chapter',2,lambda d:d['operations'][0].update(chapter=15))
    change('omitted-prior-unit',2,lambda d:d['carelaw_dispositions'].pop())
    change('fabricated-source-finding',2,lambda d:d['sources'][0].update(case_finding=True))
    change('before-text-mismatch',2,lambda d:d['operations'][0].update(before='Invented source.'))
    for name,args in cases:
        try: validate(*args)
        except (ValueError,KeyError): continue
        raise ValueError('invalid mutation accepted: '+name)
    return [name for name,_ in cases]

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packet',required=True,type=Path)
    args=parser.parse_args()
    try:
        root=args.packet.resolve()
        data=json.loads((root/'changes-and-claims.json').read_text())
        base=(root/data['baseline_file']).read_text()
        candidate=(root/data['candidate_file']).read_text()
        result=validate(base,candidate,data)
        result['negative_tests_passed']=negative_tests(base,candidate,data)
        result['result']='PASS'
        print(json.dumps(result,indent=2))
        return 0
    except (OSError,ValueError,KeyError,TypeError):
        print('FAIL: packet consistency check; inspect locally without posting source text.',file=sys.stderr)
        return 1
if __name__=='__main__': raise SystemExit(main())
