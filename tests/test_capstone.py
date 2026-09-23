"""Source-free planning regressions. No private prose or semantic certification."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('framing', ROOT / 'scripts/framing.py')
framing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(framing)

class CapstoneTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads((ROOT / 'planning/capstone-placement.json').read_text())
        self.sources = json.loads((ROOT / 'research/lexical-geometry/confession-dialogue-sources.json').read_text())

    def test_supplied_source_is_not_new_inference(self):
        self.assertEqual(self.plan['source_status'], 'explicit_author_supplied')
        self.assertEqual(self.plan['self_attribution_policy'], 'preserve_not_impose_or_euphemize')

    def test_exact_stage(self):
        p = self.plan['position']
        self.assertEqual((p['movement'], p['chapter'], p['section']), ('Interlude', 15, 'last'))
        self.assertEqual(p['following'], 'Excursion: Edna')
        self.assertIs(p['intervening_adult_prose'], False)

    def test_question_is_last_not_an_extra_epilogue(self):
        self.assertEqual(self.plan['position']['reader_question'], 'last_prose_of_section')
        self.assertIs(self.plan['ending_anchor_unchanged'], True)
        self.assertIs(self.plan['PR_01_unchanged'], True)

    def test_reader_not_answered_or_classified(self):
        self.assertEqual(self.plan['reader_answer'], 'not_supplied')
        self.assertIs(self.plan['silence_or_denial_as_proof'], False)
        self.assertIs(self.plan['third_party_classification_from_self_report'], False)

    def test_no_automatic_absolution_or_equivalence(self):
        for key in ['confession_is_absolution', 'partner_as_exonerating_evidence', 'all_harms_equivalent']:
            self.assertIs(self.plan[key], False)

    def test_source_payloads_stay_private(self):
        for key in ['source_payload_public', 'private_fingerprints_public', 'historical_source_rewrite']:
            self.assertIs(self.plan[key], False)
        self.assertEqual(self.plan['public_private_text_gate'], 2)

    def test_preparation_not_completed_chapter_or_acceptance(self):
        self.assertIs(self.plan['preceding_chapters_complete'], False)
        self.assertIs(self.plan['full_chapter_15_complete'], False)
        self.assertEqual(self.plan['prose_status'], 'candidate_not_accepted')
        self.assertEqual(self.plan['placement_instruction'], 'settled_author_direction')

    def test_sources_resolve_without_duplicate_independence(self):
        rows = self.sources['sources']
        self.assertEqual({s['id'] for s in rows}, set(self.plan['external_source_ids']))
        self.assertEqual(len(rows), 6)
        self.assertEqual(len({s['family'] for s in rows}), 4)
        self.assertEqual(len({s['author'] for s in rows}), 4)

    def test_source_urls_and_scopes(self):
        for s in self.sources['sources']:
            u = urlsplit(s['url'])
            self.assertEqual(u.scheme, 'https')
            self.assertIsNone(u.username)
            self.assertIsNone(u.password)
            self.assertTrue(s['locator'] and s['scope'])
            self.assertLessEqual(len(s['quotation_used'].split()), 25)

    def test_smith_access_is_not_full_book(self):
        s = next(x for x in self.sources['sources'] if x['id']=='CD01')
        self.assertEqual(s['access'], 'search_indexed_primary_preview')
        self.assertEqual(s['composition_date'], '2017-01-18')

    def test_ahmed_translation_is_not_english_original(self):
        a = {s['id']: s for s in self.sources['sources']}
        self.assertEqual(a['CD05']['access'], 'direct_primary_abstract')
        self.assertEqual(a['CD06']['language'], 'French')
        self.assertEqual(len(a['CD06']['translators']), 8)
        self.assertEqual(a['CD05']['family'], a['CD06']['family'])

    def test_research_is_not_consensus_or_endorsement(self):
        self.assertEqual(self.sources['comparison_status'], 'editorial_synthesis_not_author_consensus')
        self.assertIs(self.sources['no_author_endorsement_inferred'], True)
        self.assertIs(self.sources['original_case_evidence'], False)
        self.assertIs(self.plan['semantic_review_required'], True)

    def test_rf01_accepts_known_author_self_attribution(self):
        record = {**framing.EXPECTED, 'sources':[{'id':'SYNTHETIC_AUTHOR','kind':'author_report'}],
                  'relations':[{'id':'SYNTHETIC_SELF_DESCRIPTION','status':'reported',
                  'source_refs':['SYNTHETIC_AUTHOR'],'operator_status':'known','classification_status':'known'}]}
        self.assertEqual(framing.violations(record), [])
        # The status says how a source is attributed; it does not authenticate it.
        changed = deepcopy(record); changed['task_frame']='global_accusation'
        self.assertIn('IMPOSED_TASK_FRAME', framing.violations(changed))
        changed = deepcopy(record); changed['relations'][0]['source_refs']=[]
        self.assertIn('UNSOURCED_NONUNKNOWN_RELATION', framing.violations(changed))

    def test_original_atlas_not_turned_into_case_classifier(self):
        atlas = json.loads((ROOT/'research/lexical-geometry/atlas.json').read_text())
        self.assertIsNone(atlas['case_classification'])

    def test_societal_language_braid_preserves_private_final_question(self):
        braid = (ROOT / 'planning/writing/c15-societal-language-braid.md').read_text()
        self.assertIn('[EXISTING DIRECT READER QUESTION — UNCHANGED]', braid)
        self.assertNotIn('Are you a racist?', braid)
        social = self.plan['societal_language_braid']
        self.assertIs(social['final_reader_question_public'], False)
        self.assertIs(social['final_reader_question_changed'], False)
        self.assertIs(social['reader_answer_added'], False)
        self.assertIs(social['final_sequence_preserved'], True)

    def test_societal_language_sources_are_context_not_case_evidence(self):
        source_path = ROOT / 'research/lexical-geometry/language-power-sources.json'
        data = json.loads(source_path.read_text())
        self.assertIs(data['original_case_evidence'], False)
        self.assertEqual({x['id'] for x in data['sources']}, set(self.plan['societal_source_ids']))
        self.assertEqual(len(data['sources']), 5)
        for row in data['sources']:
            u = urlsplit(row['url'])
            self.assertEqual(u.scheme, 'https')
            self.assertTrue(row['supports'])
            self.assertTrue(row['limits'])
            self.assertLessEqual(len(row['quotation_used'].split()), 10)

    def test_societal_braid_is_not_political_verdict_or_prediction(self):
        social = self.plan['societal_language_braid']
        for key in ['political_endorsement', 'political_fitness_judgment',
                    'election_prediction', 'legal_verdict_from_rhetoric']:
            self.assertIs(social[key], False)
        braid = (ROOT / social['public_candidate']).read_text()
        for phrase in ['The label is cached.', 'authority is an amplifier',
                       'That is the social responsibility of confession.']:
            self.assertIn(phrase, braid)

    def test_handoffs_link_current_contract(self):
        for name in ['AGENTS.md', 'planning/framing-resume.md', 'planning/relational-framing.md']:
            self.assertIn('capstone-placement.md', (ROOT/name).read_text())
        self.assertEqual(self.plan['later_acceptance_issues'], [11, 12])
        self.assertIn(51, self.plan['later_integration_issues'])
        self.assertNotIn('automatic', self.plan['reader_answer'])

if __name__ == '__main__':
    unittest.main()
