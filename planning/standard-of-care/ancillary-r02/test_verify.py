"""Synthetic structural mutations; no external medical or legal verification."""
import csv
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('ancillary_verify', HERE / 'verify.py')
V = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(V)

class SourceReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / 'repo'
        self.review = self.root / 'planning/standard-of-care/ancillary-r02'
        shutil.copytree(HERE, self.review, ignore=shutil.ignore_patterns('__pycache__'))
        self.sources = self.root / 'sources/standard-of-care/neurology-current/content'
        source = V.ROOT / 'sources/standard-of-care/neurology-current/content'
        for name, _, _ in V.PINNED.values():
            target = self.sources / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / name, target)
    def tearDown(self):
        self.tmp.cleanup()
    def bad(self):
        with self.assertRaises((ValueError, KeyError, IndexError)):
            V.verify(self.root)
    def manifest(self, key, value):
        file = self.review / 'manifest.json'
        obj = json.loads(file.read_text()); obj[key] = value
        file.write_text(json.dumps(obj))
    def rows(self, mutate, filename='claims.tsv'):
        file = self.review / filename
        with file.open(newline='') as f:
            reader = csv.DictReader(f, delimiter='\t'); fields = reader.fieldnames; rows = list(reader)
        mutate(rows)
        with file.open('w', newline='') as f:
            writer = csv.DictWriter(f, fields, delimiter='\t', lineterminator='\n'); writer.writeheader(); writer.writerows(rows)
    def test_current_payload(self):
        result = V.verify(self.root)['summary']
        self.assertEqual(result['identity_matches'], 5)
        self.assertEqual(result['nodes'], 59)
        self.assertEqual(result['scoped_claims'], 70)
        self.assertEqual(result['additional_prose_occurrences_pending'], 0)
        self.assertFalse(result['external_truth_verified'])
    def test_changed_source_with_recomputed_manifest(self):
        path = self.sources / V.PINNED['dignity'][0]
        raw = path.read_bytes().replace(b'"preview"', b'"published"'); path.write_bytes(raw)
        file = self.review / 'manifest.json'; obj = json.loads(file.read_text())
        obj['records']['dignity']['git_blob'] = V.git_blob(raw); obj['records']['dignity']['bytes'] = len(raw)
        file.write_text(json.dumps(obj)); self.bad()
    def test_wrong_repository(self):
        self.manifest('repository', 'grwtsk/neurology'); self.bad()
    def test_ungranted_expansion(self):
        self.manifest('raw_clinical_records_included', True); self.bad()
    def test_false_media_copy(self):
        self.manifest('media_bytes_copied', True); self.bad()
    def test_false_full_corpus_review(self):
        self.manifest('whole_corpus_semantic_review_complete', True); self.bad()
    def test_missing_commit_notice(self):
        self.manifest('disclaimer', ''); self.bad()
    def test_missing_readme_notice(self):
        (self.review / 'README.md').write_text('No notice'); self.bad()
    def test_lost_claim(self):
        self.rows(lambda rows: rows.pop()); self.bad()
    def test_duplicate_claim(self):
        self.rows(lambda rows: rows[1].update(id=rows[0]['id'])); self.bad()
    def test_missing_issue(self):
        self.rows(lambda rows: rows[0].update(issue='0')); self.bad()
    def test_stale_exact_span(self):
        self.rows(lambda rows: rows[0].update(exact_json='"not in the source"')); self.bad()
    def test_false_visual_inspection(self):
        self.rows(lambda rows: next(r for r in rows if r['kind']=='visual-description').update(disposition='verified')); self.bad()
    def test_lost_substantial_support(self):
        self.rows(lambda rows: next(r for r in rows if r['kind']=='operational-claim').update(support='artifact')); self.bad()
    def test_lost_leaf_disposition(self):
        self.rows(lambda rows: rows.pop(), 'leaf-dispositions.tsv'); self.bad()
    def test_stale_leaf_disposition(self):
        self.rows(lambda rows: rows[0].update(exact_json='"changed attribution"'), 'leaf-dispositions.tsv'); self.bad()
    def test_lost_node(self):
        self.rows(lambda rows: rows.pop(), 'nodes.tsv'); self.bad()
    def test_source_version_change(self):
        self.manifest('source_commit','0'*40); self.bad()

if __name__ == '__main__':
    unittest.main()
