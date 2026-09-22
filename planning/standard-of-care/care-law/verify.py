#!/usr/bin/env python3
"""Check Huey's recovered care-law packet and export its exact-text ledger.

This is a structural/source-recovery check, not historical or legal verification.
Standard library only. No network, source modification, publication or grants.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

REPO = 'grwtsk/huey'
NS = 'HUEY-CARELAW-01'
PATTERN = re.compile(r'^(?P<text>.+?)\s*<!-- (?P<id>C\d{3}) \| (?P<kind>[a-z]+) \| (?P<issue>\d+) \| (?P<sources>S\d{2}(?:,S\d{2})*) -->$')
KINDS = {'proposal','testimony','question','inference','ethics','law','framework','metaphor','document','policy'}
AUTHORITY = {'ethics','law','framework','policy','document'}
OWNERS = set(range(178,186)) | {187}
IDS = {f'C{i:03}' for i in range(1,257)}
NEW = {f'C{i:03}' for i in range(152,257)}
SIDS = {f'S{i:02}' for i in range(41)}
INSPECTIONS = {'read-this-pass','carried-forward-from-pass-1','source-text-retrieved-this-pass','recheck-failed','access-result-only'}
MAP = {'119':125,'120':178,'121':179,'122':180,'123':181,'124':182,'125':183,'126':184,'127':185,'128':186,'130':187}
FIELDS = ('claim_ids','issue','source_ids','source_locator','source_based_observation','question_for_review','evidence_needed','alternative_or_limitation','competent_review_function','proposed_low_burden_step','closure_test','institutional_status','evidentiary_status')


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def sha(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def inspect(text: str, source_data: dict, review: dict, integration: dict, lineage: dict) -> list[dict]:
    for obj in (source_data, review, integration, lineage):
        require(obj.get('repository') == REPO and obj.get('namespace') == NS, 'Wrong repository or namespace')
    require(review.get('parent_issue') == 125 and review.get('development_pr') == 122, 'Wrong program or PR')
    require(review.get('integration_issue') == integration.get('integration_issue') == 186, 'Wrong integration owner')
    require(lineage.get('issue_map') == MAP, 'Incomplete or incorrect repository correction map')
    require(integration.get('status') == 'candidate-joins-not-applied', 'Unperformed manuscript integration claimed')
    require(bool(source_data.get('inspection_scope')), 'Missing inherited-inspection explanation')
    require(text.count('## Source catalogue and limits') == 1, 'Source catalogue boundary missing or duplicated')
    body, catalogue = text.split('## Source catalogue and limits',1)
    sr = source_data.get('sources',[])
    sources = {s.get('id'):s for s in sr}
    declared = re.findall(r'^- \*\*(S\d{2}) —',catalogue,re.M)
    require(len(sr) == len(sources) == len(declared) == 41 and set(declared) == set(sources) == SIDS, 'Source coverage mismatch')
    for sid,s in sources.items():
        require(all(s.get(k) for k in ('title','category','locator','scope_limit','inspection','case_application')), f'{sid}: incomplete source')
        require(s['inspection'] in INSPECTIONS and s['case_application'] == 'not-adjudicated', f'{sid}: unsupported source status')
    require(sources['S13']['inspection'] == 'recheck-failed', 'Fabricated S13 recheck')
    require(sources['S39']['inspection'] == 'access-result-only', 'Unseen policy presented as read')
    section = None
    records = []
    for line_no,line in enumerate(body.splitlines(),1):
        if line.startswith('## '):
            section = line[3:]
            continue
        if section is None or not line.strip():
            continue
        match = PATTERN.fullmatch(line)
        require(match is not None, f'Untracked body prose at line {line_no}')
        row = match.groupdict()
        sid_list = row['sources'].split(',')
        owner = int(row['issue'])
        visible = set(re.findall(r'\[(S\d{2})\]',row['text']))
        require(row['kind'] in KINDS and owner in OWNERS, f'{row["id"]}: unknown type or Huey owner')
        require(len(set(sid_list)) == len(sid_list) and set(sid_list) <= SIDS, f'{row["id"]}: unknown/duplicate source')
        require(visible <= set(sid_list), f'{row["id"]}: visible source not in metadata')
        require(row['kind'] not in AUTHORITY or bool(visible), f'{row["id"]}: missing visible reference')
        records.append({'id':row['id'],'qualified_id':NS+':'+row['id'],'exact_text':row['text'],'text_sha256':sha(row['text']),
                        'kind':row['kind'],'section':section,'source_line':line_no,'source_ids':sid_list,
                        'issue_number':owner,'issue':f'https://github.com/{REPO}/issues/{owner}',
                        'disposition':'open','case_application':'not-adjudicated'})
    by_id = {r['id']:r for r in records}
    require(len(records) == len(by_id) == 256 and set(by_id) == IDS, 'Missing or duplicate C001–C256')
    require(set(review.get('new_claim_ids',[])) == NEW, 'Incorrect added-ID declaration')
    changed = set(review.get('edited_existing_claims',{}))
    require(len(changed) == 10 and changed <= IDS-NEW, 'Incorrect earlier-edit declaration')
    rows = review.get('review_rows',[])
    require(len(rows) == 34 and {r.get('id') for r in rows} == {f'R{i:02}' for i in range(1,35)}, 'Review coverage mismatch')
    covered = set()
    for r in rows:
        require(all(r.get(k) for k in FIELDS), f'{r.get("id")}: incomplete review')
        require(r['issue'] in OWNERS and set(r['source_ids']) <= SIDS and set(r['claim_ids']) <= IDS, f'{r["id"]}: invalid link')
        require(r['institutional_status'] == 'not-initiated-by-this-packet', 'Invented institutional investigation')
        covered.update(r['claim_ids'])
    require(NEW|changed <= covered, 'Added/edited prose lacks a review')
    guards = {'C198':['signing its acknowledgment','MyChart message'], 'C203':['from the date of the letter','not from actual receipt'],
              'C194':['does not say','exclusive'], 'C195':['reports','threat'], 'C174':['reasonable amount of time'],
              'C240':['For hospitals subject to'], 'C213':['not accessible']}
    for cid,phrases in guards.items():
        require(all(p in by_id[cid]['exact_text'] for p in phrases), f'{cid}: source correction lost')
    joins = integration.get('sections',[])
    joins_by_title = {j.get('section'):j for j in joins}
    require(len(joins) == len(joins_by_title) == 17 and set(joins_by_title) == {r['section'] for r in records}, 'Missing or duplicate book disposition')
    for j in joins:
        require(j.get('role') and j.get('chapters') and j.get('chapter_issues') and j.get('soc_issues'), 'Incomplete candidate join')
        require(all(isinstance(c,int) and 1 <= c <= 14 for c in j['chapters']), 'Protected close or invalid chapter targeted')
    edits = lineage.get('pass_two_text_changes',[])
    require(len(edits) == 10 and {e.get('id') for e in edits} == changed, 'Earlier edit lineage lost')
    for e in edits:
        require(e.get('before') and e.get('reason') and e.get('after') == by_id[e['id']]['exact_text'], 'Incorrect before/after lineage')
    require(set(lineage.get('new_in_pass_two',[])) == NEW, 'Added-unit lineage lost')
    for rec in records:
        linked = [r for r in rows if rec['id'] in r['claim_ids']]
        rec['review_ids'] = [r['id'] for r in linked]
        rec['source_support'] = [{'id':s,'locator':sources[s]['locator'],'prior_inspection':sources[s]['inspection'],'limit':sources[s]['scope_limit']} for s in rec['source_ids']]
        rec['specific_review_locators'] = [{'review_id':r['id'],'locator':r['source_locator']} for r in linked]
        rec['candidate_book_join'] = joins_by_title[rec['section']]
        rec['book_application'] = 'Not applied; exact current manuscript reconciliation is Huey #186'
        rec['depth'] = 'Prior-pass detailed source review recovered' if rec['id'] in NEW|changed else 'Retained first-pass unit; deeper clause review open'
        rec['counterevidence_status'] = 'Document qualifications retained; independent firsthand evidence collection remains open'
    return records


def negative_tests(text: str, sources: dict, review: dict, integration: dict, lineage: dict) -> list[str]:
    cases=[]
    base=(text,sources,review,integration,lineage)
    def mutation(name: str, old: str, new: str) -> None:
        require(old in text, f'Unchanged mutation: {name}')
        cases.append((name,(text.replace(old,new,1),*base[1:])))
    mutation('duplicate-id','<!-- C152 |','<!-- C151 |')
    mutation('unknown-source','| S25 -->','| S99 -->')
    mutation('unknown-owner','| 187 |','| 999 |')
    mutation('untracked-prose','<!-- C152 | document | 187 | S25 -->','')
    mutation('missing-visible-authority','subpart bears the burden of demonstrating that basis. [S32]','subpart bears the burden of demonstrating that basis.')
    mutation('signature-alternative-lost','or by sending a MyChart message indicating agreement','without another permitted method')
    mutation('wrong-notice-clock','from the date of the letter, not from actual receipt','from actual receipt, not from the date of the letter')
    mutation('offer-erased','reasonable amount of time','complete refusal of time')
    def objcase(name: str, index: int, edit) -> None:
        values=list(copy.deepcopy(base));edit(values[index]);cases.append((name,tuple(values)))
    objcase('fabricated-recheck',1,lambda d:d['sources'][13].update(inspection='read-this-pass'))
    objcase('unseen-policy-read',1,lambda d:d['sources'][39].update(inspection='read-this-pass'))
    objcase('unmapped-added-unit',2,lambda d:d['review_rows'][0]['claim_ids'].remove('C152'))
    objcase('unknown-review-source',2,lambda d:d['review_rows'][0].update(source_ids=['S99']))
    objcase('invented-investigation',2,lambda d:d['review_rows'][0].update(institutional_status='investigation-opened'))
    objcase('missing-alternative',2,lambda d:d['review_rows'][0].pop('alternative_or_limitation'))
    objcase('wrong-repository',1,lambda d:d.update(repository='grwtsk/neurology'))
    mutation('old-repository-owner','| 178 |','| 120 |')
    objcase('missing-book-disposition',3,lambda d:d['sections'].pop())
    objcase('invented-manuscript-integration',3,lambda d:d.update(status='applied'))
    objcase('protected-close-targeted',3,lambda d:d['sections'][0].update(chapters=[16]))
    objcase('incorrect-issue-map',4,lambda d:d['issue_map'].update({'120':120}))
    objcase('lost-edit-lineage',4,lambda d:d['pass_two_text_changes'].pop())
    for name,values in cases:
        try:
            inspect(*values)
        except ValueError:
            continue
        raise ValueError(f'Invalid fixture accepted: {name}')
    return [name for name,_ in cases]


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',required=True,type=Path)
    args=parser.parse_args()
    try:
        root=Path(__file__).resolve().parent
        output=args.output_dir.resolve()
        require(output != root and root not in output.parents, 'Use an export directory outside the source packet')
        text=(root/'revision.md').read_text(encoding='utf-8')
        names=['sources.json','review.json','book-integration.json','lineage.json']
        data=[json.loads((root/n).read_text(encoding='utf-8')) for n in names]
        claims=inspect(text,*data)
        mutations=negative_tests(text,*data)
        report={'result':'PASS: bounded structural and recovery checks only','repository':REPO,'namespace':NS,
                'prose_units':len(claims),'sources':len(data[0]['sources']),'review_rows':len(data[1]['review_rows']),
                'book_section_dispositions':len(data[2]['sections']),'negative_tests':mutations,
                'by_kind':dict(Counter(c['kind'] for c in claims)),
                'by_issue':dict(Counter(str(c['issue_number']) for c in claims)),
                'files':{},
                'limits':['Not historical truth, independent corroboration, medical adequacy, legal applicability or admissibility.',
                          'Not complete semantic atomization of every subordinate clause or source apparatus assertion.',
                          'Book joins are candidates; the private manuscript and protected ending were not edited.',
                          'Full Huey checkout tests and hosted CI were not run; these are isolated packet checks.',
                          'Earlier source-inspection states remain dated prior-pass records, not freshly executed research.']}
        for name in ['revision.md',*names,'verify.py']:
            b=(root/name).read_bytes()
            report['files'][name]={'sha256':hashlib.sha256(b).hexdigest(),'git_blob_sha1':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()}
        ledger={'schema_version':3,'repository':REPO,'namespace':NS,'author':'R.A. Jacob Martone',
                'status':'working-editorial-input-not-final-adoption','revision_sha256':sha(text),'claims':claims}
        output.mkdir(parents=True,exist_ok=True)
        for name,value in [('claims.json',ledger),('verification.json',report)]:
            (output/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(report,indent=2))
        return 0
    except (OSError,UnicodeError,ValueError,KeyError,TypeError) as error:
        print(f'Validation failed: {error}',file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
