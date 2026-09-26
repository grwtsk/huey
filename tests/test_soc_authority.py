"""Bounded Q03 copy and navigation-lineage tests, not renewed citation research."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('soc_authority', ROOT / 'scripts/soc_authority.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
SENTINEL = 'SYNTHETIC_PRIVATE_SENTINEL'


class SocAuthorityTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.paths = [checker.MANIFEST, checker.CORE_MANIFEST, checker.PREDECESSOR['path'],
                      *checker.EXPECTED, *checker.NAVIGATION]
        for relative in self.paths:
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, path)
        self.manifest = json.loads((self.root / checker.MANIFEST).read_text())
        self.data = {p: json.loads((self.root / p).read_text())
                     for p in checker.EXPECTED if p.endswith('.json')}

    def save(self):
        (self.root / checker.MANIFEST).write_text(json.dumps(self.manifest) + '\n')

    def rejects(self, reason=None, action=None):
        with self.assertRaises(checker.Invalid) as caught:
            (action or (lambda: checker.verify(self.root)))()
        message = str(caught.exception)
        self.assertRegex(message, r'^[a-z-]+$')
        self.assertNotIn(SENTINEL, message)
        self.assertNotIn(str(self.root), message)
        if reason:
            self.assertEqual(message, reason)

    def test_current_copy_and_historical_counts_remain_distinct(self):
        result = checker.verify(self.root)
        self.assertEqual(result['files'], 9)
        self.assertEqual(result['source_records'], 1)
        self.assertEqual(result['source_entries'], 12)
        self.assertEqual(result['scalar_fields'], 271)
        self.assertEqual(result['relationship_targets'], 68)
        self.assertEqual(result['substantial_field_targets'], 89)
        self.assertEqual(result['propositions'], 14)
        self.assertEqual(result['candidate_units'], 12)
        self.assertEqual(result['historical_text_dispositions'], {'matched': 9, 'index_only': 2, 'unverified': 1})
        self.assertEqual(result['original_git_objects_checked'], 0)
        self.assertIn('no fresh citation research', result['limits'])

    def test_missing_duplicate_unselected_and_unknown_manifest_fields_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for change in [lambda d: d['files'].pop(),
                       lambda d: d['files'].__setitem__(-1, copy.deepcopy(d['files'][0])),
                       lambda d: d['files'][0].update(path='sources/standard-of-care/raw/' + SENTINEL),
                       lambda d: d.update(approved=True)]:
            self.manifest = copy.deepcopy(baseline)
            change(self.manifest)
            self.save()
            self.rejects()

    def test_false_research_metadata_activation_admission_or_authority_rejects(self):
        baseline = copy.deepcopy(self.manifest)
        for key, expected in checker.FLAGS.items():
            self.manifest = copy.deepcopy(baseline)
            self.manifest[key] = not expected
            self.save()
            self.rejects('completion-or-authority-claim')

    def test_source_and_review_cannot_change_even_with_recomputed_pins(self):
        for path in [checker.SOURCE, checker.REVIEW + 'review.json', checker.REVIEW + 'fields.tsv']:
            target = self.root / path
            original = target.read_bytes()
            target.write_bytes(original + b' ')
            self.rejects('staged-byte-drift')
            row = next(row for row in self.manifest['files'] if row['path'] == path)
            previous = row['stagedBlob']
            row['stagedBlob'] = row['sourceBlob'] = checker.blob(target.read_bytes())
            self.save()
            self.rejects('exact-copy-pin')
            row['stagedBlob'] = row['sourceBlob'] = previous
            self.save()
            target.write_bytes(original)

    def test_predecessor_path_and_blob_are_fixed_before_read(self):
        for key, value in [('path', '../' + SENTINEL), ('blob', '0' * 40)]:
            original = self.manifest['predecessorManifest'][key]
            self.manifest['predecessorManifest'][key] = value
            self.save()
            self.rejects('predecessor-pin')
            self.manifest['predecessorManifest'][key] = original

    def test_historical_ancillary_receipt_cannot_be_rewritten(self):
        path = self.root / checker.PREDECESSOR['path']
        value = json.loads(path.read_text())
        value['navigationChanges'][0]['stagedBlob'] = 'a' * 40
        path.write_text(json.dumps(value))
        self.rejects('predecessor-byte-drift')

    def test_navigation_cannot_skip_predecessor_or_change_source_identity(self):
        baseline = copy.deepcopy(self.manifest)
        for field in ['sourceBlob', 'priorStagedBlob']:
            self.manifest = copy.deepcopy(baseline)
            self.manifest['navigationChanges'][0][field] = '0' * 40
            self.save()
            self.rejects('navigation-prior-pin')
        self.manifest = copy.deepcopy(baseline)
        self.manifest['navigationChanges'][0]['path'] = checker.REVIEW + 'claims.tsv'
        self.save()
        self.rejects('navigation-selection')

    def test_current_navigation_needs_exact_endpoint_and_core_manifest_agreement(self):
        row = self.manifest['navigationChanges'][0]
        path = self.root / row['path']
        original = path.read_bytes()
        path.write_bytes(original + b' ')
        self.rejects('navigation-byte-drift')
        path.write_bytes(original)
        core_path = self.root / checker.CORE_MANIFEST
        core = json.loads(core_path.read_text())
        next(r for r in core['files'] if r['path'] == row['path'])['stagedBlob'] = 'a' * 40
        core_path.write_text(json.dumps(core))
        self.rejects('navigation-core-pin')

    def test_transfer_bindings_and_historical_statuses_remain_unaltered(self):
        changes = [
            lambda d: d['sources/standard-of-care/transfer-q03.json'].update(destination=SENTINEL),
            lambda d: d['sources/standard-of-care/transfer-q03.json'].update(factual_verification_complete=True),
            lambda d: d[checker.REVIEW + 'review.json'].update(checked_at_utc='2026-09-25T00:00:00Z'),
            lambda d: d[checker.REVIEW + 'review.json'].update(manuscript_status='accepted'),
            lambda d: d[checker.SOURCE].update(verified_at='2026-09-25'),
        ]
        for change in changes:
            data = copy.deepcopy(self.data)
            change(data)
            self.rejects(action=lambda: checker.validate_metadata(data))

    def test_missing_predecessor_and_symlink_components_reject_before_execution(self):
        path = self.root / checker.PREDECESSOR['path']
        original = path.read_bytes()
        path.unlink()
        self.rejects('unreadable-or-malformed-input')
        path.write_bytes(original)
        folder = self.root / 'sources/standard-of-care/neurology-current/content'
        moved = self.root / SENTINEL
        folder.rename(moved)
        folder.symlink_to(moved, target_is_directory=True)
        with patch.object(checker.subprocess, 'run') as run:
            self.rejects('unreadable-or-malformed-input')
            run.assert_not_called()

    def test_duplicate_and_nonfinite_json_do_not_echo_input(self):
        path = self.root / checker.MANIFEST
        for raw in [f'{{"x":"{SENTINEL}","x":2}}', '{"x":NaN}', '{']:
            path.write_text(raw)
            self.rejects()

    def test_history_is_local_only_and_missing_objects_fail(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True, capture_output=True)
        self.rejects('git-input-unavailable', lambda: checker.verify(self.root, source_objects=True))

    def test_checker_preserves_all_selected_bytes_and_receipts(self):
        before = {p: (self.root / p).read_bytes() for p in self.paths}
        checker.verify(self.root)
        self.assertEqual(before, {p: (self.root / p).read_bytes() for p in self.paths})
        self.assertFalse(list(self.root.rglob('__pycache__')))

    def test_wrapper_offers_no_root_override_or_exports(self):
        for option in ['--root', '--output-dir']:
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/soc_authority.py'),
                                     option, str(self.root / 'forbidden')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertFalse((self.root / 'forbidden').exists())


if __name__ == '__main__':
    unittest.main()
