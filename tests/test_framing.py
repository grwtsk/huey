"""Synthetic declaration and scanner tests; not a semantic judgment of the book."""
import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import framing as f
ROOT = Path(__file__).resolve().parents[1]
BASE = json.loads((ROOT/'planning/framing-handoff.example.json').read_text())

class FramingTests(unittest.TestCase):
    def record(self):return copy.deepcopy(BASE)
    def test_valid_unknown_operator_and_label(self):self.assertEqual(f.violations(self.record()),[])
    def test_independent_fixture_expectations(self):
        data=f.load(ROOT/'planning/framing-cases.json')
        self.assertEqual(len(data['cases']),16)
        for case in data['cases']:
            with self.subTest(case=case['id']):self.assertEqual(f.violations({**data['base'], **case['overrides']}),case['expected_codes'])
    def test_accusation(self):
        r=self.record();r['task_frame']='racism_claim';self.assertEqual(f.violations(r),['IMPOSED_TASK_FRAME'])
    def test_exoneration(self):
        r=self.record();r['task_frame']='not_racism';self.assertEqual(f.violations(r),['IMPOSED_TASK_FRAME'])
    def test_identity(self):
        r=self.record();r['identity_policy']='remove';self.assertEqual(f.violations(r),['IDENTITY_ERASURE'])
    def test_motive(self):
        r=self.record();r['motive_prerequisite']=True;self.assertEqual(f.violations(r),['MOTIVE_GATE'])
    def test_operator(self):
        r=self.record();r['operator_prerequisite']=True;self.assertEqual(f.violations(r),['OPERATOR_GATE'])
    def test_label(self):
        r=self.record();r['label_prerequisite']=True;self.assertEqual(f.violations(r),['LABEL_GATE'])
    def test_source_rewrite(self):
        r=self.record();r['source_policy']='rewrite';self.assertEqual(f.violations(r),['SOURCE_REWRITING'])
    def test_asymmetry(self):
        r=self.record();r['evidence_policy']='official';self.assertEqual(f.violations(r),['ASYMMETRIC_EVIDENCE'])
    def test_truth_ownership(self):
        for value in ['author_only','institution_only']:
            r=self.record();r['truth_access']=value;self.assertEqual(f.violations(r),['EXCLUSIVE_TRUTH'])
    def test_unknown_collapse(self):
        r=self.record();r['unknown_policy']='absent';self.assertEqual(f.violations(r),['UNKNOWN_COLLAPSED'])
    def test_bool_not_integer(self):
        r=self.record();r['motive_prerequisite']=0;self.assertEqual(f.violations(r),['MOTIVE_GATE'])
    def test_missing_field(self):
        r=self.record();del r['profile'];self.assertIn('UNKNOWN_OR_MISSING_FIELDS',f.violations(r))
    def test_extra_private_fields_not_accepted(self):
        r=self.record();r['private_text']='SECRET';out=f.violations(r);self.assertIn('UNKNOWN_OR_MISSING_FIELDS',out);self.assertNotIn('SECRET',str(out))
    def test_invalid_record(self):self.assertEqual(f.violations([]),['INVALID_RECORD'])
    def test_duplicate_source(self):
        r=self.record();r['sources'].append(r['sources'][0]);self.assertIn('INVALID_SOURCE_ID',f.violations(r))
    def test_bad_source_ref(self):
        r=self.record();r['relations'][0]['source_refs']=['MISSING'];self.assertEqual(f.violations(r),['INVALID_SOURCE_REFERENCE'])
    def test_missing_source(self):
        r=self.record();r['relations'][0]['source_refs']=[];self.assertEqual(f.violations(r),['UNSOURCED_NONUNKNOWN_RELATION'])
    def test_unknown_relation_may_lack_source(self):
        r=self.record();r['relations'][0].update(status='unknown',source_refs=[]);self.assertEqual(f.violations(r),[])
    def test_duplicate_relation(self):
        r=self.record();r['relations'].append(r['relations'][0]);self.assertIn('INVALID_RELATION_ID',f.violations(r))
    def test_malformed_source_kind(self):
        r=self.record();r['sources'][0]['kind']=[];self.assertIn('INVALID_SOURCE_KIND',f.violations(r))
    def test_nested_ref_does_not_crash(self):
        r=self.record();r['relations'][0]['source_refs']=[{}];self.assertIn('INVALID_SOURCE_REFERENCE',f.violations(r))
    def test_historical_hypothesis_does_not_set_task(self):
        r=self.record();r['relations'][0].update(status='modeled',source_refs=['S3']);self.assertEqual(f.violations(r),[])
    def test_scan_does_not_ban_word(self):self.assertEqual(f.scan('The original essay discusses racism. The current account preserves its source.'),[])
    def test_scan_known_frame(self):
        out=f.scan('A heading\nYour claim of racism is the subject.');self.assertEqual(out[0]['line'],2);self.assertEqual(out[0]['code'],'REVIEW_IMPOSED_RACISM_FRAME');self.assertNotIn('text',out[0])
    def test_scan_quoted_history_still_needs_review(self):
        self.assertEqual(len(f.scan('The old draft said “your claim of racism.” That framing is superseded.')),1)
    def test_scan_is_not_semantic_certification(self):
        self.assertEqual(f.scan('Here is a paraphrase beyond the limited patterns.'),[])
    def test_scan_motive_gate(self):self.assertEqual(f.scan('You must prove the motive before describing it.')[0]['code'],'REVIEW_MOTIVE_GATE')
    def test_case_expected_values_can_fail(self):
        d=f.load(ROOT/'planning/framing-cases.json');d['cases'][0]['expected_codes']=['IMPOSED_TASK_FRAME'];self.assertEqual(f.check_cases(d),['CASE_EXPECTATION_MISMATCH'])
    def test_empty_cases_fail(self):self.assertEqual(f.check_cases({'profile':'RF-01','base':self.record(),'cases':[]}),['INVALID_CASE_COUNT'])
    def test_load_duplicate_keys(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'x';p.write_text('{"x":1,"x":2}')
            with self.assertRaises(f.InvalidInput):f.load(p)
    def test_load_nonfinite(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'x';p.write_text('{"x":NaN}')
            with self.assertRaises(f.InvalidInput):f.load(p)
    def test_load_bounded(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'x';p.write_bytes(b'0'*40)
            with patch.object(f,'MAX_BYTES',10):
                with self.assertRaises(f.InvalidInput):f.load(p)
    def test_cli_read_only_and_fixed_errors(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'SECRET_NAME';p.write_text('not json SECRET_BODY');before=p.read_bytes()
            proc=subprocess.run([sys.executable,str(ROOT/'scripts/framing.py'),'check',str(p)],capture_output=True,text=True)
            self.assertEqual(proc.returncode,2);self.assertNotIn('SECRET',proc.stdout+proc.stderr);self.assertEqual(p.read_bytes(),before)
    def test_cli_scan_never_certifies(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'text';p.write_text('ordinary text')
            proc=subprocess.run([sys.executable,str(ROOT/'scripts/framing.py'),'scan',str(p)],capture_output=True,text=True)
            self.assertEqual(proc.returncode,0);self.assertTrue(json.loads(proc.stdout)['semantic_review_required'])
    def test_cli_scan_review_exit(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'text';p.write_text('Your claim of racism.')
            proc=subprocess.run([sys.executable,str(ROOT/'scripts/framing.py'),'scan',str(p)],capture_output=True,text=True)
            self.assertEqual(proc.returncode,3)
    def test_cli_invalid_arg_no_echo(self):
        proc=subprocess.run([sys.executable,str(ROOT/'scripts/framing.py'),'SECRET'],capture_output=True,text=True)
        self.assertEqual(proc.returncode,2);self.assertNotIn('SECRET',proc.stdout+proc.stderr)

class PropagationTests(unittest.TestCase):
    def test_all_preexisting_issues_have_receipts(self):
        d=f.load(ROOT/'planning/framing-coverage.json')
        numbers=set(d['body_replaced'])|{int(n) for n in d['issue_comment_ids']}
        self.assertEqual(numbers,set(range(1,72))|{73,75,77,79,81,96})
        self.assertEqual(len(d['body_replaced']),8)
        self.assertEqual(len(d['issue_comment_ids']),69)
        self.assertFalse(set(d['body_replaced'])&{int(n) for n in d['issue_comment_ids']})
        self.assertTrue(all(type(x) is int and x>0 for x in d['issue_comment_ids'].values()))
    def test_all_existing_prs_have_receipts(self):
        d=f.load(ROOT/'planning/framing-coverage.json')
        self.assertEqual({int(n) for n in d['pr_comment_ids']},{72,74,76,78,80,82,*range(83,96),97})
        self.assertEqual(len(d['pr_comment_ids']),20)
        self.assertEqual(d['historically_merged_prs'],[72,74,76,78,80,82])
    def test_entry_points(self):
        for rel in ['AGENTS.md','README.md','.github/ISSUE_TEMPLATE/work-item.md','.github/ISSUE_TEMPLATE/human-decision.md','.github/PULL_REQUEST_TEMPLATE.md','planning/framing-resume.md']:
            self.assertIn('RF-01',(ROOT/rel).read_text(),rel)
    def test_coverage_is_not_live_or_native(self):
        d=f.load(ROOT/'planning/framing-coverage.json')
        self.assertFalse(d['native_dependencies_set'])
        self.assertIn('not_live_monitor',d['observation_kind'])
        self.assertEqual(d['new_issues'],[98,99,100])
    def test_source_neutral_fixtures(self):
        data=f.load(ROOT/'planning/framing-cases.json')
        self.assertEqual([s['id'] for s in data['base']['sources']],['S1','S2','S3'])
        for source in data['base']['sources']:
            self.assertEqual(set(source),{'id','kind'})
        self.assertEqual(set(data['base']['relations'][0]),{'id','status','source_refs','operator_status','classification_status'})

if __name__=='__main__':unittest.main()
