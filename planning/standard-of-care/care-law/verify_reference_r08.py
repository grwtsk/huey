#!/usr/bin/env python3
"""Read-only check of the private HUEY-CL08 reference/concordance packet.

Run with --packet DIR. No network, clinical action, publication, or source writes.
Output reports structural counts, not private text or fingerprints. Checks cannot
establish historical truth, legal applicability, source authorship or acceptance.
"""
from __future__ import annotations
import argparse
import copy
import csv
import hashlib
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

CIDS={f'C{i:03}' for i in range(1,257)}
CATEGORIES={'existing-narrative-correspondence':52,'reference-detail':31,
            'source-held':4,'editorial-noninsertion':4}
OWNERS=set(range(178,188))

def need(ok: bool, reason: str) -> None:
    if not ok: raise ValueError(reason)

def sha(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def words(text: str) -> int:
    return len(' '.join(l for l in text.splitlines()
                        if not l.startswith('#') and l.strip()!='* * *').split())

def annotated_text(base: str, data: dict) -> str:
    pnotes={}
    for n in data['notes']:
        for pid in n['paragraph_ids']: pnotes.setdefault(pid,[]).append(n['id'])
    for a in data['residual_allocations']:
        for p in a['paragraphs']:
            if a['note'] not in pnotes.setdefault(p['id'],[]): pnotes[p['id']].append(a['note'])
    pars={p['id']:p for p in data['note_paragraphs']}
    need(set(pars)==set(pnotes),'note paragraph coverage')
    result=base
    for pid in sorted(pnotes,key=lambda p:pars[p]['start'],reverse=True):
        p=pars[pid]
        links=' '.join(f'[{n}]({data["rendered_files"]["reference"]}#{n.lower()})' for n in sorted(pnotes[pid]))
        result=result[:p['start']]+f'<a id="{pid.lower()}"></a>\n\n'+p['text']+'\n\n<small>Reference notes: '+links+'</small>'+result[p['end']:]
    return result

def validate(base: str, candidate: str, d: dict, prior: dict, reference: str, annotated: str) -> dict:
    need(d.get('repository')=='grwtsk/huey' and d.get('work_id')=='HUEY-CL08','wrong repository/work')
    need(d.get('pr')==122 and d.get('integration_issue')==186 and d.get('parent_issue')==125,'wrong task')
    need(d.get('adoption')=='candidate-not-author-accepted','invented acceptance')
    need(not d.get('narrative_edits') and candidate==base,'undeclared narrative change')
    need(sha(base)==d.get('baseline_sha256')==d.get('candidate_sha256'),'narrative identity')
    need(words(candidate)==49841,'word convention mismatch')
    orig=d['original_units']; om={c['id']:c for c in orig}
    need(len(orig)==len(om)==256 and set(om)==CIDS,'original corpus coverage')
    for c in orig:
        need(sha(c['exact_text'])==c['text_sha256'],'original text hash')
        need(c['issue_number'] in OWNERS and c['issue']==f'https://github.com/grwtsk/huey/issues/{c["issue_number"]}','original owner')
    need(d['previous_dispositions']==prior['carelaw_dispositions'],'prior dispositions rewritten')
    remaining={c['id'] for c in prior['carelaw_dispositions'] if c['status']=='retained-not-yet-adapted'}
    need(len(remaining)==91,'prior residual count')
    earlier=prior['prior_units']+prior['units']
    expected={u['id']:u['text'] for u in earlier}
    need(len(expected)==660,'prior passage count')
    need({u['id']:u['text'] for u in d['prior_units']}==expected,'prior passage changed')
    need(all(t in candidate for t in expected.values()),'previous passage lost')
    sources={s['id']:s for s in d['sources']}
    need(len(sources)==len(d['sources'])==30,'source coverage')
    need(sources['W18']['inspection']=='retrieval-failed','failed retrieval promoted')
    need(all(s['case_finding'] is False and s['locator'] and s['limit'] for s in sources.values()),'source finding or scope')
    notes={n['id']:n for n in d['notes']}
    need(len(notes)==19 and set(notes)=={f'N{i:02}' for i in range(1,20)},'note coverage')
    routed=[c for n in notes.values() for c in n['carelaw_ids']]
    need(len(routed)==len(set(routed))==91 and set(routed)==remaining,'note source routing')
    allocations=d['residual_allocations']
    need(len(allocations)==91 and {a['id'] for a in allocations}==remaining,'residual coverage')
    need(dict(Counter(a['category'] for a in allocations))==CATEGORIES,'disposition count')
    for a in allocations:
        need(a['exact_text']==om[a['id']]['exact_text'] and a['text_sha256']==sha(a['exact_text']),'source modified')
        need(a['owner']==om[a['id']]['issue_number'] and a['issue']==f'https://github.com/grwtsk/huey/issues/{a["owner"]}','wrong owner')
        need(a['note'] in notes and a['id'] in notes[a['note']]['carelaw_ids'],'note mismatch')
        need(a['adoption']=='candidate-not-author-accepted' and a['case_finding'] is False,'false finding/adoption')
        need(all(a.get(k) for k in ('rationale','relation_scope','review_question','evidence_needed','counterevidence_or_limit','competent_review','closure')),'incomplete claim review')
        need(bool(a['paragraphs'])==(a['category']=='existing-narrative-correspondence'),'false narrative correspondence')
        for p in a['paragraphs']:
            need(1<=p['chapter']<=14 and candidate[p['start']:p['end']]==p['text'],'invalid or protected paragraph')
    for p in d['note_paragraphs']:
        need(1<=p['chapter']<=14 and candidate[p['start']:p['end']]==p['text'],'note exact paragraph')
    for n in notes.values():
        need(set(n['source_ids'])<=set(sources),'unknown note source')
        need(all(n.get(k) for k in ('body','question','evidence','competent_review','closure','limit')),'incomplete note')
        need(n['case_finding'] is False and n['adoption']=='candidate-not-author-accepted','note finding/acceptance')
        need(f'<a id="{n["id"].lower()}"></a>' in reference,'missing note anchor')
    units=d['reference_units']
    need(len(units)==len({u['id'] for u in units})==141,'reference unit count')
    texts=[]
    for n in d['notes']:
        texts.extend(n['body']);texts.extend(n[k] for k in ['question','evidence','competent_review','closure','limit'])
    need([u['text'] for u in units]==texts,'untracked reference content')
    for u in units:
        need(reference[u['start']:u['end']]==u['text'],'reference exact span')
        need(set(u['source_ids'])<=set(sources) and u['source_ids']==notes[u['note']]['source_ids'],'reference source links')
        need(not u['case_finding'] and u['adoption']=='candidate-not-author-accepted','reference finding')
    discrepancies=d['source_discrepancies']
    need({x['id'] for x in discrepancies}=={'SD01','SD02'},'source gap erased')
    need(next(x for x in discrepancies if x['id']=='SD01')['owner']==184,'discrepancy owner')
    need(next(x for x in discrepancies if x['id']=='SD02')['owner']==182,'retrieval owner')
    need('fifteen or more employees' in ' '.join(notes['N06']['body']) and 'fifty or more' in ' '.join(notes['N06']['body']),'threshold discrepancy obscured')
    need('retrieval' in ' '.join(notes['N12']['body']).lower() and 'failed' in ' '.join(notes['N12']['body']).lower(),'unverified regime interaction')
    need(annotated==annotated_text(base,d),'annotation changed prose or links')
    return {'result':'PASS: bounded consistency checks','narrative_words':words(candidate),'narrative_edits':0,
            'original_source_units':256,'prior_adapted_source_units':165,'residual_units_reviewed':91,
            'residual_dispositions':CATEGORIES,'previous_passages_preserved':660,'reference_notes':19,
            'reference_body_and_review_units':141,'public_source_entries':24,'public_sources_read':23,
            'public_source_retrieval_open':1,'annotated_paragraph_locations':len(d['note_paragraphs']),
            'limits':'Placement coverage is not semantic certification, historical truth, legal applicability or acceptance.'}

def negative_tests(base,candidate,data,prior,reference,annotated):
    cases=[]
    def alter(name,index,func):
        v=[base,candidate,copy.deepcopy(data),prior,reference,annotated]
        if index in (0,1,4,5): v[index]=func(v[index])
        else: func(v[index])
        v[2]['baseline_sha256']=sha(v[0]);v[2]['candidate_sha256']=sha(v[1])
        cases.append((name,v))
    alter('clean-narrative-edit',1,lambda t:t+'\nUnlisted paragraph.\n')
    alter('wrong-repository',2,lambda d:d.update(repository='grwtsk/neurology'))
    alter('wrong-pr',2,lambda d:d.update(pr=131))
    alter('invented-acceptance',2,lambda d:d.update(adoption='accepted'))
    alter('omitted-residual',2,lambda d:d['residual_allocations'].pop())
    alter('duplicate-residual',2,lambda d:d['residual_allocations'].__setitem__(1,d['residual_allocations'][0]))
    alter('wrong-owner',2,lambda d:d['residual_allocations'][0].update(owner=120))
    alter('changed-original',2,lambda d:d['original_units'][0].update(exact_text='Changed source.'))
    alter('source-status-invented',2,lambda d:d['sources'][0].update(case_finding=True))
    alter('lost-counterevidence',2,lambda d:d['residual_allocations'][0].update(counterevidence_or_limit=''))
    alter('wrong-note',2,lambda d:d['residual_allocations'][0].update(note='N19'))
    alter('invented-narrative-correspondence',2,lambda d:d['residual_allocations'][0].update(paragraphs=[]))
    alter('protected-chapter-target',2,lambda d:d['residual_allocations'][0]['paragraphs'][0].update(chapter=15))
    alter('bad-exact-span',2,lambda d:d['residual_allocations'][0]['paragraphs'][0].update(start=0))
    alter('lost-prior-passage',2,lambda d:d['prior_units'].pop())
    alter('prior-disposition-rewritten',2,lambda d:d['previous_dispositions'][0].update(status='verified'))
    alter('failed-source-promoted',2,lambda d:next(s for s in d['sources'] if s['id']=='W18').update(inspection='read-2026-09-22'))
    alter('lost-source-discrepancy',2,lambda d:d['source_discrepancies'].pop())
    alter('missing-reference-unit',2,lambda d:d['reference_units'].pop())
    alter('unknown-reference-source',2,lambda d:d['reference_units'][0].update(source_ids=['X99']))
    alter('changed-reference-text',4,lambda t:t.replace('The source proposal begins','Changed reference begins',1))
    alter('broken-reading-link',5,lambda t:t.replace('#n01','#missing',1))
    alter('annotated-extra-narrative',5,lambda t:t+'\nAn unlisted conclusion.\n')
    alter('missing-review-question',2,lambda d:d['notes'][0].update(question=''))
    for name,vals in cases:
        try: validate(*vals)
        except (ValueError,KeyError): continue
        raise ValueError('invalid fixture accepted: '+name)
    return [name for name,_ in cases]

def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--packet',required=True,type=Path);args=ap.parse_args()
    try:
        root=args.packet.resolve();d=json.loads((root/'allocation-and-claims.json').read_text())
        base=(root/d['baseline_file']).read_text();candidate=(root/d['candidate_file']).read_text()
        with zipfile.ZipFile(root/'prior-r07-author-review.zip') as z:
            names=z.namelist();mp=next(n for n in names if n.endswith('/manifest.json') or n=='manifest.json')
            prefix=mp[:-len('manifest.json')];manifest=json.loads(z.read(mp))
            for entry in manifest['files']:
                b=z.read(prefix+entry['path']);need(len(b)==entry['bytes'] and hashlib.sha256(b).hexdigest()==entry['sha256'],'prior archive identity')
            prior=json.loads(z.read(prefix+'changes-and-claims.json'))
            need(z.read(prefix+prior['candidate_file']).decode()==base,'baseline differs from delivered prior packet')
        original=json.loads((root/'original-corpus.json').read_text());need(original==d['original_units'],'source export mismatch')
        reference=(root/d['rendered_files']['reference']).read_text();annotated=(root/d['rendered_files']['annotated']).read_text()
        result=validate(base,candidate,d,prior,reference,annotated)
        result['negative_tests_passed']=negative_tests(base,candidate,d,prior,reference,annotated)
        # Check actual file-local links and every explicit destination fragment.
        for name in d['rendered_files'].values():
            text=(root/name).read_text()
            for dest in re.findall(r'\]\(([^)]+)\)',text):
                if '://' in dest: continue
                filename,_,fragment=dest.partition('#');target=root/(filename or name)
                need(target.is_file(),'missing local link file')
                if fragment: need(f'id="{fragment}"' in target.read_text(),'missing local link fragment')
        rows=list(csv.DictReader((root/'public/integration-r08.tsv').open(),delimiter='\t'))
        need(len(rows)==91,'public disposition index count')
        for row,a in zip(rows,d['residual_allocations']):
            need(row['source_unit']==a['id'] and row['editorial_disposition']==a['category'] and row['note']==a['note'] and row['huey_issue']==str(a['owner']),'public disposition mismatch')
        idx=list(csv.DictReader((root/'public/reference-r08-units.tsv').open(),delimiter='\t'))
        need([r['reference_unit'] for r in idx]==[u['id'] for u in d['reference_units']],'public reference index mismatch')
        result['prior_manifest_entries_checked']=len(manifest['files']);result['local_link_check']='PASS'
        print(json.dumps(result,indent=2));return 0
    except (OSError,ValueError,KeyError,TypeError,StopIteration,zipfile.BadZipFile):
        print('FAIL: packet integrity or declared coverage. Inspect locally; do not publish private text.',file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
