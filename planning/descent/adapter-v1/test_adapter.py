"""Finite exact examples and adverse consumer mutations; no event authentication."""
import json
from copy import deepcopy
from fractions import Fraction
from pathlib import Path
import unittest
from adapter import (compare_operations, derivative_step, finite_jet, formal_use,
                     reading_view, render_view, signed_determinant, taylor_coefficients,
                     validate_view)

BUNDLE=json.loads(Path(__file__).with_name('reading-input.json').read_text())
CONTRACT=BUNDLE['formal_contract']

class MathematicalUse(unittest.TestCase):
    def test_literal_mode_recurrence(self):
        p0=(-3,2)
        self.assertEqual(derivative_step(p0),(-15,30,-8))
        self.assertEqual(derivative_step(derivative_step(p0)),(-75,330,-224,32))
    def test_rank_two_orientation(self):
        # Synthetic raw vector, NOT measured theta values.
        self.assertEqual(signed_determinant((1,2,7),2),-3)
    def test_empty_determinant(self):
        self.assertEqual(signed_determinant((),0),1)
    def test_rank_four_consumes_seven(self):
        # Synthetic four-node moments (nodes 0,1,2,3, unit weights).
        # Hankel determinant = Vandermonde(0,1,2,3)^2 = 12^2.
        self.assertEqual(signed_determinant((4,6,14,36,98,276,794),4),144)
    def test_rank_five_refuses_seven(self):
        with self.assertRaisesRegex(ValueError,'unavailable'):
            signed_determinant((1,2,7,11,17,29,43),5)
    def test_unknown_not_zero(self):
        with self.assertRaisesRegex(ValueError,'unknown'):
            finite_jet((1,None,7),2)
    def test_factorial_is_not_hankel_normalization(self):
        t=taylor_coefficients((1,2,7))
        self.assertEqual(t,(1,2,Fraction(7,2)))
        # A wrong caller would flip the sign. Tagged Taylor input is rejected.
        self.assertEqual(signed_determinant(t,2),Fraction(1,2))
        with self.assertRaisesRegex(ValueError,'convert back'):
            signed_determinant(t,2,'taylor')
    def test_no_positive_extension(self):
        with self.assertRaisesRegex(ValueError,'outside'):
            formal_use(CONTRACT,CONTRACT,5)
    def test_source_status_hypothesis_mutations(self):
        for key,value in [('id','other-version'),('all_rank_status','proved'),
                          ('evaluation_guard','all real t'),('normalization','taylor'),
                          ('verification','fresh Lean pass'),('orientation','unsigned')]:
            with self.subTest(key=key):
                bad=deepcopy(CONTRACT);bad[key]=value
                with self.assertRaisesRegex(ValueError,'drift'):
                    formal_use(bad,CONTRACT,4)

class ReadingUse(unittest.TestCase):
    def setUp(self): self.view=reading_view(BUNDLE,BUNDLE['views']['recipient'])
    def test_change_focus_not_record(self):
        sender=reading_view(BUNDLE,BUNDLE['views']['sender'])
        self.assertNotEqual(sender['focus'],self.view['focus'])
        self.assertEqual(sender['records'],self.view['records'])
    def test_preparation_cannot_be_promoted(self):
        self.view['records']['prepared']['status']='completed care'
        with self.assertRaises(ValueError): validate_view(self.view,BUNDLE)
    def test_no_unknown_as_zero(self):
        self.view['records']['authority']['status']=0
        with self.assertRaises(ValueError): validate_view(self.view,BUNDLE)
    def test_qualification_cannot_disappear(self):
        self.view['records']['access']['limit']=''
        with self.assertRaises(ValueError): validate_view(self.view,BUNDLE)
    def test_apology_cannot_disappear(self):
        del self.view['records']['apology']
        with self.assertRaises(ValueError): validate_view(self.view,BUNDLE)
    def test_correction_cannot_disappear(self):
        c=self.view['records']['ha_b3bcabe3-cf94-47db-9596-13b23a155b4c']['source_card']
        c['sources']=c['sources'][:2]
        with self.assertRaises(ValueError): validate_view(self.view,BUNDLE)
    def test_correction_actually_renders(self):
        s=render_view(self.view,BUNDLE)
        self.assertIn('6 mm',s)
        self.assertIn('not an original radiology amendment',s)
    def test_complete_card_and_passage_metadata_render(self):
        s=render_view(self.view,BUNDLE)
        for record in BUNDLE['records'].values():
            self.assertIn(json.dumps(record,indent=2,ensure_ascii=False),s)
        self.assertIn(json.dumps(BUNDLE['binding'],indent=2),s)
        self.assertIn('Assistant paraphrase; not a verbatim transcript',s)
        self.assertIn('2019-06-12 12:29 PM',s)
        self.assertIn('HUEY-EV-451494db-fe65-4a1a-947f-96b7d5060527',s)
        self.assertIn('does_not_establish',s)
    def test_copy_not_new_witness(self):
        self.view['records']['prepared-copy']=deepcopy(self.view['records']['prepared'])
        self.view['records']['prepared-copy']['source_group_id']='new-witness'
        with self.assertRaises(ValueError): validate_view(self.view,BUNDLE)
    def test_no_suppressed_context(self):
        self.view['context'].remove('authority')
        with self.assertRaises(ValueError): validate_view(self.view,BUNDLE)
    def test_source_pin_cannot_change(self):
        self.view['binding']['chapter_blob']='0'*40
        with self.assertRaises(ValueError): validate_view(self.view,BUNDLE)
        self.assertNotEqual(BUNDLE['binding']['chapter_blob'],'0'*40)
    def test_repetition_rejected(self):
        with self.assertRaises(ValueError): reading_view(BUNDLE,['prepared','prepared'])
    def test_no_theorem_to_history(self):
        with self.assertRaises(ValueError):
            compare_operations(CONTRACT,CONTRACT,self.view,BUNDLE,'proves-history')
    def test_routing_request_is_next_action(self):
        v=reading_view(BUNDLE,BUNDLE['views']['next_action'])
        out=compare_operations(CONTRACT,CONTRACT,v,BUNDLE)
        self.assertEqual(out['reading']['focus'][0],'routing')
        self.assertEqual(out['kind'],'proposed_operation_comparison')
        self.assertIn('No map',out['unproved_connection'])

if __name__=='__main__': unittest.main()
