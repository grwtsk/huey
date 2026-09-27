"""Synthetic integrity regressions; no test adjudicates a person or certifies meaning."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('lg', ROOT / 'scripts/lexical_geometry.py')
lg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lg)


class AtlasTests(unittest.TestCase):
    def setUp(self):
        self.a = lg.load(lg.DATA / 'atlas.json')
        self.o = lg.load(lg.DATA / 'retrieval-observations.json')

    def reject(self, change, code=None):
        change(self.a, self.o)
        with self.assertRaises(lg.Invalid) as cm:
            lg.validate(self.a, self.o)
        if code:
            self.assertEqual(str(cm.exception), code)

    def test_counts(self):
        self.assertEqual(lg.validate(self.a, self.o),
                         dict(sources=41, senses=29, relations=25, comparisons=8, research_areas=13))

    def test_required_forms(self):
        self.assertEqual({s['term'] for s in self.a['senses']}, lg.TERMS)

    def test_duplicate_source(self):
        self.reject(lambda a,o: a['sources'].append(deepcopy(a['sources'][0])), 'duplicate_id')

    def test_unknown_reference(self):
        self.reject(lambda a,o: a['senses'][0]['sources'].append('none'), 'references')

    def test_missing_form(self):
        self.reject(lambda a,o: a.update(senses=[s for s in a['senses'] if s['term'] != 'is']), 'term_coverage')

    def test_invalid_endpoint(self):
        self.reject(lambda a,o: a['relations'][0].update(to_id='missing'), 'relation_endpoint')

    def test_bad_relation_kind(self):
        self.reject(lambda a,o: a['relations'][0].update(kind='proves_a_verdict'), 'relation_type')

    def test_bad_relation_status(self):
        self.reject(lambda a,o: a['relations'][0].update(status='verified_everywhere'), 'relation_status')

    def test_no_totality(self):
        self.reject(lambda a,o: a.update(exhaustive_authorities=True), 'coverage_overclaim')

    def test_no_accusation(self):
        self.reject(lambda a,o: a.update(case_classification='racism'), 'imposed_classification')

    def test_no_exoneration(self):
        self.reject(lambda a,o: a.update(case_classification='not_racism'), 'imposed_classification')

    def test_identity_retained(self):
        self.reject(lambda a,o: a['context_fields'].remove('identities_supplied'), 'relational_scope')

    def test_unknown_retained(self):
        self.reject(lambda a,o: a['context_fields'].remove('unknown_relations'), 'relational_scope')

    def test_no_metadata_argument(self):
        self.reject(lambda a,o: a['senses'][0].update(sources=['P05']), 'metadata_is_not_argument')

    def test_no_metadata_summary(self):
        self.reject(lambda a,o: next(s for s in a['sources'] if s['id']=='P05').update(summary='Unread argument'), 'metadata_is_not_argument')

    def test_access_drift(self):
        self.reject(lambda a,o: next(s for s in a['sources'] if s['id']=='G01').update(access='text'), 'access_or_scope_drift')

    def test_scope_drift(self):
        self.reject(lambda a,o: a['sources'][0].update(scope='Every historical corpus'), 'access_or_scope_drift')

    def test_missing_observation(self):
        self.reject(lambda a,o: o['observations'].pop('L01'), 'observation_coverage')

    def test_observation_not_authentication(self):
        # Matching declarations can be forged together. This tool cannot detect that.
        self.a['sources'][0]['scope'] = 'A caller-supplied scope'
        self.o['observations']['L01']['scope'] = 'A caller-supplied scope'
        self.assertEqual(lg.validate(self.a, self.o)['sources'], 41)

    def test_credentials(self):
        self.reject(lambda a,o: a['sources'][0].update(url='https://user:secret@example.org'), 'source_url')

    def test_query(self):
        self.reject(lambda a,o: a['sources'][0].update(url='https://example.org/?token=secret'), 'source_url')

    def test_local_url(self):
        self.reject(lambda a,o: a['sources'][0].update(url='https://127.0.0.1/'), 'source_url')

    def test_local_domain(self):
        self.reject(lambda a,o: a['sources'][0].update(url='https://files.local/'), 'source_url')

    def test_nonhttps(self):
        self.reject(lambda a,o: a['sources'][0].update(url='file:///private'), 'source_url')

    def test_is_ism_relation(self):
        self.reject(lambda a,o: next(r for r in a['relations'] if r['id']=='R09').update(kind='derivational_relation'), 'etymology_boundary')

    def test_is_ist_relation(self):
        self.reject(lambda a,o: next(r for r in a['relations'] if r['id']=='R10').update(kind='semantic_comparison'), 'etymology_boundary')

    def test_missing_gap(self):
        self.reject(lambda a,o: a['gaps'].pop(), 'gap_coverage')

    def test_no_flag_only_gap_closure(self):
        self.reject(lambda a,o: a['gaps'][0].update(status='resolved_with_evidence'), 'gap_resolution_requires_evidence_schema')

    def test_comparison_reference(self):
        self.reject(lambda a,o: a['disagreements'][0]['sources'].append('unread'), 'references')

    def test_no_private_scope(self):
        self.reject(lambda a,o: a.update(private_sources_included=True), 'private_scope')

    def test_unknown_top_field(self):
        self.reject(lambda a,o: a.update(approved=True), 'fields')

    def test_real_date(self):
        self.reject(lambda a,o: a.update(retrieved_utc='2026-02-30'), 'date')

    def test_malformed_types(self):
        mutations = [lambda a,o: a['senses'][0].update(term=[]),
                     lambda a,o: a['relations'][0].update(from_id={}),
                     lambda a,o: a['relations'][0].update(kind=[]),
                     lambda a,o: a['sources'][0].update(access={}),
                     lambda a,o: a.update(context_fields=[{}])]
        for change in mutations:
            with self.subTest(change=mutations.index(change)):
                a,o = deepcopy(self.a),deepcopy(self.o)
                change(a,o)
                with self.assertRaises(lg.Invalid): lg.validate(a,o)

    def test_render_deterministic(self):
        self.assertEqual(lg.render(self.a), lg.render(deepcopy(self.a)))
        for name, body in lg.render(self.a).items():
            self.assertEqual((lg.DATA/name).read_text(),body)

    def test_duplicate_json(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'a'; p.write_text('{"a":1,"a":2}')
            with self.assertRaisesRegex(lg.Invalid,'duplicate_json_key'): lg.load(p)

    def test_nonfinite_json(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'a'; p.write_text('{"a":NaN}')
            with self.assertRaisesRegex(lg.Invalid,'nonfinite_json'): lg.load(p)

    def test_oversize_json(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'a'; p.write_bytes(b' '*(lg.MAX_BYTES+1))
            with self.assertRaisesRegex(lg.Invalid,'input_too_large'): lg.load(p)

    def test_corrected_titles(self):
        sources={s['id']:s for s in self.a['sources']}
        self.assertEqual(sources['H04']['title'],'Understanding racism')
        self.assertEqual(sources['H05']['title'],'Moral status of believing in races')
        self.assertIn('Journal of Social Philosophy',sources['H09']['version'])
        self.assertNotIn('radix',sources['L08']['summary'])

    def test_differences_retained(self):
        kinds={d['kind'] for d in self.a['disagreements']}
        self.assertTrue({'internal_inconsistency','argument_disagreement','domain_distinction'}<=kinds)

    def cli(self,*args):
        return subprocess.run([sys.executable,str(ROOT/'scripts/lexical_geometry.py'),*args],
                              capture_output=True,text=True)

    def test_cli_read_only(self):
        before={p.name:p.read_bytes() for p in lg.DATA.iterdir() if p.is_file()}
        result=self.cli('check')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertTrue(json.loads(result.stdout)['semantic_review_required'])
        self.assertEqual(before,{p.name:p.read_bytes() for p in lg.DATA.iterdir() if p.is_file()})

    def test_failure_no_payload_echo(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d); (p/'atlas.json').write_text('{"private-marker-secret":1}')
            (p/'retrieval-observations.json').write_text('{}')
            result=self.cli('validate','--data-dir',d)
            self.assertEqual(result.returncode,2)
            self.assertNotIn('private-marker-secret',result.stdout+result.stderr)

    def test_bad_argument_no_echo(self):
        result=self.cli('private-argument-secret')
        self.assertEqual(result.returncode,2)
        self.assertNotIn('private-argument-secret',result.stdout+result.stderr)

    def test_generated_drift(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)
            for name in ['atlas.json','retrieval-observations.json']:
                (p/name).write_bytes((lg.DATA/name).read_bytes())
            for name,content in lg.render(self.a).items(): (p/name).write_text(content+'drift\n')
            result=self.cli('check','--data-dir',d)
            self.assertEqual(result.returncode,2)
            self.assertIn('generated_document_drift',result.stderr)

    def test_only_read_only_imports(self):
        import ast
        tree=ast.parse((ROOT/'scripts/lexical_geometry.py').read_text())
        names=[]
        for node in ast.walk(tree):
            if isinstance(node,ast.Import): names.extend(n.name for n in node.names)
            elif isinstance(node,ast.ImportFrom): names.append(node.module or '')
        self.assertTrue(set(names)<={'__future__','argparse','collections','datetime','ipaddress',
                                    'json','pathlib','re','sys','urllib.parse'})


if __name__ == '__main__':
    unittest.main()
