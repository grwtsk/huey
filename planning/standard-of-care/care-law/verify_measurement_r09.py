#!/usr/bin/env python3
"""Read-only validation of the private HUEY-CL09 measurement-review packet.

No network, device queries, source edits or publication. Arithmetic uses the
reported inputs, not independently authenticated health records. Output is
source-neutral. A consistent packet is not a clinical or legal finding.
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
from decimal import Decimal, ROUND_HALF_UP, localcontext
from fractions import Fraction
from pathlib import Path

OWNERS = {25, 129, 186, 320}
KINDS = {'analysis','arithmetic','arithmetic-example','documentation','method',
         'normative','research','research-scope','retrieval-scope','scope',
         'source-discrepancy','source-report'}
PAIR_KEYS = [
 ('first_month_mi_per_day','pre31_mi_per_day'),
 ('first_month_steps_per_day','pre31_steps_per_day'),
 ('late2019_mi_per_day','pre31_mi_per_day'),
 ('late2019_steps_per_day','pre31_steps_per_day'),
 ('late2019_mi_per_day','annual_mi_per_day'),
 ('late2019_steps_per_day','annual_steps_per_day')]
AUX_KEYS = [
 ('pre31_total_mi','/','pre31_days'),
 ('pre31_mi_per_day','*','pre31_days'),
 ('annual_projection_mi','-','later_total_mi'),
 ('immediate_projection_mi','-','later_total_mi'),
 ('annual_projection_mi','/','annual_mi_per_day'),
 ('immediate_projection_mi','/','pre31_mi_per_day')]

def need(value: bool, why: str) -> None:
    if not value:
        raise ValueError(why)

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def display(value: Fraction, places: int) -> str:
    with localcontext() as ctx:
        ctx.prec = 50
        n = Decimal(value.numerator) / Decimal(value.denominator)
        return format(n.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP), f'.{places}f')

def safe_file(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    need(path != root and root in path.parents, 'path outside packet')
    return path

def load_prior(root: Path, data: dict) -> dict:
    archive = safe_file(root, data['prior_archive'])
    need(digest(archive.read_bytes()) == data['prior_archive_sha256'], 'prior archive identity')
    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        need(len(names) == len(set(names)), 'duplicate archive entries')
        name = next(n for n in names if n.endswith('/manifest.json'))
        prefix = name.rsplit('/', 1)[0] + '/'
        manifest = json.loads(z.read(name))
        need(len(manifest['files']) == data['prior_manifest_entries_checked'] == 20, 'prior manifest count')
        for row in manifest['files']:
            content = z.read(prefix + row['path'])
            need(len(content) == row['bytes'] and digest(content) == row['sha256'], 'prior manifest mismatch')
        prior = json.loads(z.read(prefix + 'allocation-and-claims.json'))
        old = z.read(prefix + prior['candidate_file']).decode('utf-8')
        old_annotated = z.read(prefix + 'huey-narrative-care-law-r08-annotated.md').decode('utf-8')
        for name in ('huey-narrative-care-law-r08-annotated.md', 'huey-care-law-r08-reference.md', 'huey-care-law-r08-concordance.md'):
            need((root / name).read_bytes() == z.read(prefix + name), 'altered prior reference copy')
    return {'data': prior, 'clean': old, 'annotated': old_annotated}

def validate(d: dict, base: str, clean: str, ref: str, annotated: str, prior: dict) -> dict:
    need(d['repository'] == 'grwtsk/huey' and d['work_id'] == 'HUEY-CL09', 'wrong repository or work')
    need(d['pr'] == 122 and d['issue'] == 186 and d['paper_issue'] == 320, 'wrong task')
    need(d['adoption'] == 'candidate-not-author-accepted', 'invented acceptance')
    need(d['narrative_edits'] == [] and base == clean == prior['clean'], 'narrative changed')
    need(d['baseline_sha256'] == digest(base.encode()) and d['candidate_sha256'] == digest(clean.encode()), 'narrative identity')
    need(all(d[k] is False for k in ('raw_activity_data_recovered','raw_device_queries_run','clinical_or_legal_finding')), 'invented measurement or finding')
    old = prior['data']
    for key, old_key, count in [('prior_passages','prior_units',660),('prior_allocations','previous_dispositions',256),('prior_residual_allocations','residual_allocations',91),('prior_reference_units','reference_units',141)]:
        need(len(d[key]) == count and d[key] == old[old_key], 'changed prior ledger')
    need(all(row['text'] in clean for row in d['prior_passages']), 'prior passage lost')
    sources = {s['id']:s for s in d['sources']}
    need(len(d['sources']) == len(sources) == 11, 'source count')
    need(all(s.get('locator') and s.get('limit') and s.get('case_finding') is False for s in sources.values()), 'source scope')
    need(all(sources[f'W{i:02}']['inspection'] == 'indexed-primary-text-read' for i in range(2,7)), 'indexed source falsely upgraded')
    need(len(d['source_discrepancies']) == 2 and all(x['owner'] == 320 and x['status'] == 'primary-source-internal-discrepancy-open' for x in d['source_discrepancies']), 'paper discrepancy lost')
    inputs = {r['id']:r for r in d['reported_inputs']}
    need(len(inputs) == len(d['reported_inputs']) == 15, 'input coverage')
    vals = {}
    for key,row in inputs.items():
        need(row['raw_verified'] is False and row['status'] in {'source-reported-rounded','source-reported-window-count'}, 'input falsely verified')
        need(row['source_ids'] and set(row['source_ids']) <= set(sources), 'input source')
        vals[key] = Fraction(row['value'])
        need(vals[key] > 0 and f'| `{key}` | {row["value"]} |' in ref, 'input value or table mismatch')
    need(len(d['comparisons']) == len(d['arithmetic']) == 6, 'arithmetic count')
    for i,(row,(after,before)) in enumerate(zip(d['comparisons'],PAIR_KEYS),1):
        need(row['id'] == f'Q{i:02}' and (row['after'],row['before']) == (after,before), 'comparison denominator')
        ratio = 100 * vals[after] / vals[before]
        need(Fraction(row['remaining_percent']) == ratio and Fraction(row['decrease_percent']) == 100-ratio, 'ratio or decrease')
        need(row['display_remaining'] == display(ratio,2) and row['display_decrease'] == display(100-ratio,2), 'percentage rounding')
        need(row['raw_verified'] is False and row['scope'] == 'arithmetic-on-reported-rounded-inputs', 'arithmetic status')
        need(f'| {row["id"]} | {row["label"]} | {row["display_remaining"]}% | {row["display_decrease"]}% |' in ref, 'comparison table')
    for i,(row,(left,op,right)) in enumerate(zip(d['arithmetic'],AUX_KEYS),7):
        result = vals[left] / vals[right] if op == '/' else vals[left] * vals[right] if op == '*' else vals[left] - vals[right]
        need(row['id'] == f'Q{i:02}' and row['expression'] == f'{inputs[left]["value"]} {op} {inputs[right]["value"]}', 'arithmetic inputs')
        need(Fraction(row['exact_result']) == result and row['approximation'] == display(result,9), 'arithmetic result')
        need(row['raw_verified'] is False and row['scope'] == 'arithmetic-on-reported-rounded-inputs', 'arithmetic status')
    need(len(d['synthetic_examples']) == 2 and all(e['observed'] is False for e in d['synthetic_examples']), 'synthetic promoted to observation')
    ex1,ex2 = d['synthetic_examples']
    need(display(Fraction(ex1['total']),1) == ex1['display_total'] and display(Fraction(ex1['total'])/Fraction(ex1['days']),2) == ex1['display_mean'], 'rounding example')
    need(all(display(Fraction(ex2[f'total_{k}'])/Fraction(ex2['days']),2) == ex2[f'display_rate_{k}'] for k in ('a','b')), 'common-horizon example')
    notes = {n['id']:n for n in d['notes']}
    need(len(d['notes']) == len(notes) == 8 and len(d['units']) == 57 and len(d['review_units']) == 40, 'note coverage')
    ids = [u['id'] for u in d['units']]
    need(ids == [f'HUEY-CL09-U{i:03}' for i in range(1,58)], 'body IDs')
    need(sorted(ids) == sorted(u for n in notes.values() for u in n['body']), 'body-to-note links')
    calcids = {r['id'] for r in d['comparisons']+d['arithmetic']+d['synthetic_examples']}
    for u in d['units']+d['review_units']:
        need(ref[u['start']:u['end']] == u['text'] and u['note'] in notes and u['owner'] in OWNERS, 'reference text or owner')
        need(u['case_finding'] is False and u['adoption'] == 'candidate-not-author-accepted', 'reference finding')
    for u in d['units']:
        need(u['kind'] in KINDS and u['source_ids'] and set(u['source_ids']) <= set(sources), 'body source or kind')
        need(set(u['calculation_ids']) <= calcids, 'unknown calculation')
        tail = ref[u['end']:].split('\n',1)[0]
        need(all(f'[{s}](#src-{s.lower()})' in tail for s in u['source_ids']), 'visible reference lost')
    for n in notes.values():
        for field in ('question','evidence','alternative','reviewer','closure'):
            matches=[u for u in d['review_units'] if u['note']==n['id'] and u['kind']=='review-'+field]
            need(len(matches)==1 and matches[0]['text']==n[field] and bool(n[field]), 'incomplete review row')
    need(len(d['selected_paragraphs']) == 8 and len(d['selected_sentence_units']) == 31, 'selected span coverage')
    expected = prior['annotated']
    for p in d['selected_paragraphs']:
        need(p['chapter'] in (2,4) and clean[p['start']:p['end']] == p['text'], 'paragraph source')
        sentences=[u for u in d['selected_sentence_units'] if u['paragraph_id']==p['id']]
        need(' '.join(' '.join(u['text'] for u in sentences).split()) == ' '.join(p['text'].split()), 'paragraph sentence coverage')
        links=' · '.join(f'[{n}]({d["reference_file"]}#{n.lower()})' for n in p['notes'])
        need(expected.count(p['text']) == 1, 'ambiguous paragraph anchor')
        expected=expected.replace(p['text'],f'<a id="cl09-{p["id"].lower()}"></a>\n'+p['text']+f'\n\n*Measurement/source review: {links}.*',1)
    need(expected == annotated, 'unlisted annotated edit')
    need(len({u['id'] for u in d['selected_sentence_units']}) == 31, 'duplicate sentence ID')
    for u in d['selected_sentence_units']:
        need(clean[u['start']:u['end']] == u['text'] and u['owner'] in OWNERS and u['support'] and u['limit'], 'sentence text or scope')
        need(set(u['source_ids']) <= set(sources) and u['case_finding'] is False, 'sentence source or finding')
    return {'result':'PASS: conditional arithmetic and packet consistency only','narrative_words':len(' '.join(l for l in clean.splitlines() if not l.startswith('#') and l.strip()!='* * *').split()),'narrative_changed':False,'reported_inputs':15,'arithmetic_checks':12,'synthetic_examples':2,'new_notes':8,'reference_body_units':57,'review_units':40,'selected_paragraphs':8,'selected_sentences':31,'prior_passages_preserved':660,'prior_reference_units_preserved':141}

def negative_tests(data, base, clean, ref, annotated, prior):
    cases=[]
    def mutate(name, change):
        d=copy.deepcopy(data);change(d);cases.append((name,d,clean,ref))
    mutate('wrong-repository',lambda d:d.update(repository='grwtsk/neurology'))
    mutate('invented-raw-recovery',lambda d:d.update(raw_activity_data_recovered=True))
    mutate('invented-acceptance',lambda d:d.update(adoption='accepted'))
    mutate('invented-finding',lambda d:d.update(clinical_or_legal_finding=True))
    mutate('missing-prior-passage',lambda d:d['prior_passages'].pop())
    mutate('missing-input',lambda d:d['reported_inputs'].pop())
    mutate('wrong-denominator',lambda d:d['comparisons'][0].update(before='annual_mi_per_day'))
    mutate('remaining-as-decrease',lambda d:d['comparisons'][0].update(decrease_percent=d['comparisons'][0]['remaining_percent']))
    mutate('changed-arithmetic-result',lambda d:d['arithmetic'][0].update(exact_result='0'))
    mutate('synthetic-as-observed',lambda d:d['synthetic_examples'][0].update(observed=True))
    mutate('indexed-as-rendered',lambda d:next(s for s in d['sources'] if s['id']=='W02').update(inspection='primary-page-read'))
    mutate('paper-discrepancy-closed',lambda d:d['source_discrepancies'][0].update(status='corrected'))
    mutate('untracked-reference-unit',lambda d:d['units'].pop())
    mutate('old-repository-owner',lambda d:d['units'][0].update(owner=120))
    mutate('missing-competing-explanation',lambda d:d['notes'][0].update(alternative=''))
    mutate('untracked-sentence',lambda d:d['selected_sentence_units'].pop())
    mutate('changed-residual-allocation',lambda d:d['prior_residual_allocations'][0].update(category='verified'))
    d=copy.deepcopy(data);altered=clean+'\nUnlisted change.\n';d['candidate_sha256']=digest(altered.encode());cases.append(('unlisted-narrative-edit',d,altered,ref))
    cases.append(('missing-visible-source',copy.deepcopy(data),clean,ref.replace('[D01](#src-d01)','',1)))
    for name,d,c,r in cases:
        try: validate(d,base,c,r,annotated,prior)
        except (ValueError,KeyError): continue
        raise ValueError('invalid fixture accepted: '+name)
    return [name for name,_,_,_ in cases]

def check_links(root: Path, names: list[str]) -> int:
    checked = 0
    for name in names:
        text = (root / name).read_text()
        for link in re.findall(r'\]\(([^)]+)\)', text):
            if link.startswith(('https://','http://','mailto:')):
                continue
            path, separator, anchor = link.partition('#')
            target = safe_file(root, path or name)
            need(target.is_file(), 'missing local reference target')
            if separator:
                target_text = target.read_text()
                need(f'id="{anchor}"' in target_text, 'missing explicit anchor')
            checked += 1
    return checked


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--packet',type=Path,required=True);args=parser.parse_args()
    try:
        root=args.packet.resolve();d=json.loads((root/'measurement-r09.json').read_text())
        prior=load_prior(root,d)
        strings=[safe_file(root,d[k]).read_text() for k in ('baseline_file','candidate_file','reference_file','annotated_file')]
        result=validate(d,*strings,prior);result['negative_tests_passed']=negative_tests(d,*strings,prior)
        for name,key in [('measurement-r09-units.tsv','units'),('measurement-r09-passages.tsv','selected_sentence_units')]:
            rows=list(csv.DictReader((root/'public'/name).open(),delimiter='\t'))
            wanted=d[key]+d['review_units'] if key=='units' else d[key]
            need(len(rows)==len(wanted) and all(r['unit']==u['id'] and int(r['huey_issue'])==u['owner'] for r,u in zip(rows,wanted)), 'public index mismatch')
        public=json.loads((root/'public/measurement-r09-sources.json').read_text())
        need(public['sources']==[s for s in d['sources'] if s['id'].startswith('W')] and public['source_discrepancies']==d['source_discrepancies'], 'public source mismatch')
        result['public_indexes_checked']=2;result['prior_archive_entries_checked']=20
        result['local_links_checked']=check_links(root,[d['reference_file'],d['annotated_file'],'huey-care-law-r08-reference.md','huey-care-law-r08-concordance.md'])
        print(json.dumps(result,indent=2));return 0
    except (OSError,ValueError,KeyError,TypeError,StopIteration,zipfile.BadZipFile,ZeroDivisionError):
        print('FAIL: packet consistency; inspect locally without posting source text.',file=sys.stderr);return 1
if __name__=='__main__': raise SystemExit(main())
