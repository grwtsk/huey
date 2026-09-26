"""Hostile checks for an exact ancillary copy, not source or authority review."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('soc_ancillary', ROOT / 'scripts/soc_ancillary.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
SENTINEL = 'SYNTHETIC_PRIVATE_SENTINEL'


class SocAncillaryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.paths = [checker.MANIFEST, checker.CORE_MANIFEST, *checker.EXPECTED, *checker.NAVIGATION]
        for relative in self.paths:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)
        self.manifest = json.loads((self.root / checker.MANIFEST).read_text())
        self.data = {path: json.loads((self.root / path).read_text())
                     for path in checker.EXPECTED if path.endswith('.json')}

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

    def test_current_selection_preserves_distinct_counts_and_limits(self):
        result = checker.verify(self.root)
        self.assertEqual(result['files'], 15)
        self.assertEqual(result['source_records'], 5)
        self.assertEqual(result['source_bytes'], 24200)
        self.assertEqual(result['id_bearing_nodes'], 59)
        self.assertEqual(result['scalar_occurrences'], 358)
        self.assertEqual(result['scoped_claims'], 70)
        self.assertEqual(result['substantial_support_targets'], 16)
        self.assertEqual(result['source_references'], 14)
        self.assertEqual(result['original_git_objects_checked'], 0)
        self.assertEqual(result['prior_navigation_objects_checked'], 0)
        self.assertIn('not source authentication', result['limits'])
        self.assertIn('media inspection', result['limits'])

    def test_missing_duplicate_or_out_of_scope_selection_rejects(self):
        baseline = copy.deepcopy(self.manifest)
        for mutate in [lambda x: x['files'].pop(),
                       lambda x: x['files'].__setitem__(-1, copy.deepcopy(x['files'][0])),
                       lambda x: x['files'][0].update(path='sources/standard-of-care/raw/' + SENTINEL)]:
            self.manifest = copy.deepcopy(baseline)
            mutate(self.manifest)
            self.save()
            self.rejects()

    def test_unknown_permission_fields_and_reference_expansion_reject(self):
        self.manifest['permission'] = 'granted'
        self.save()
        self.rejects('manifest-fields')
        del self.manifest['permission']
        self.manifest['scopeRefs'].append('https://example.invalid/' + SENTINEL)
        self.save()
        self.rejects('scope-limits')

    def test_completion_admission_media_or_active_metadata_flags_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for field, expected in checker.FLAGS.items():
            self.manifest = copy.deepcopy(baseline)
            self.manifest[field] = not expected
            self.save()
            self.rejects('completion-or-authority-claim')

    def test_changed_source_cannot_be_rebound_with_recomputed_pins(self):
        row = next(row for row in self.manifest['files'] if row['path'].endswith('/on-dignity.json'))
        target = self.root / row['path']
        raw = target.read_bytes().replace(b'"preview"', b'"published"')
        self.assertNotEqual(raw, target.read_bytes())
        target.write_bytes(raw)
        self.rejects('staged-byte-drift')
        row['sourceBlob'] = row['stagedBlob'] = checker.blob(raw)
        self.save()
        self.rejects('exact-copy-pin')

    def test_exact_review_draft_and_old_check_receipt_cannot_silently_change(self):
        for name in ['claims.tsv', 'argument-draft.md', 'checks.json', 'verify.py']:
            target = self.root / checker.REVIEW / name
            original = target.read_bytes()
            target.write_bytes(original + SENTINEL.encode())
            self.rejects('staged-byte-drift')
            target.write_bytes(original)

    def test_navigation_is_limited_to_two_previously_adaptable_readmes(self):
        row = self.manifest['navigationChanges'][0]
        row['path'] = 'planning/standard-of-care/claims.tsv'
        self.save()
        self.rejects('navigation-selection')

    def test_navigation_requires_exact_prior_pin_current_bytes_and_core_agreement(self):
        row = self.manifest['navigationChanges'][0]
        prior = row['priorStagedBlob']
        row['priorStagedBlob'] = '0' * 40
        self.save()
        self.rejects('navigation-prior-pin')
        row['priorStagedBlob'] = prior
        self.save()
        target = self.root / row['path']
        original = target.read_bytes()
        target.write_bytes(original + SENTINEL.encode())
        self.rejects('navigation-byte-drift')
        target.write_bytes(original)
        core_file = self.root / checker.CORE_MANIFEST
        core = json.loads(core_file.read_text())
        next(item for item in core['files'] if item['path'] == row['path'])['stagedBlob'] = 'a' * 40
        core_file.write_text(json.dumps(core))
        self.rejects('navigation-core-pin')

    def test_transfer_record_and_claim_references_remain_exact(self):
        for mutate in [
            lambda d: d['sources/standard-of-care/transfer-r02.json']['source_records_completed'][0].update(
                destination='../../' + SENTINEL),
            lambda d: d['sources/standard-of-care/transfer-r02.json']['claims'].update(table=SENTINEL),
            lambda d: d[checker.REVIEW + 'manifest.json']['records']['site'].update(path=SENTINEL),
        ]:
            data = copy.deepcopy(self.data)
            mutate(data)
            self.rejects(action=lambda: checker.validate_metadata(data))

    def test_inherited_flags_and_historical_checks_do_not_become_fresh_clearance(self):
        for path, field in [(checker.REVIEW + 'manifest.json', 'external_research_performed'),
                            (checker.REVIEW + 'manifest.json', 'whole_corpus_semantic_review_complete'),
                            ('sources/standard-of-care/transfer-r02.json', 'complete_corpus_verification'),
                            ('sources/standard-of-care/transfer-r02.json', 'image_and_audio_bytes_included'),
                            (checker.REVIEW + 'checks.json', 'full_repository_suite_run')]:
            data = copy.deepcopy(self.data)
            data[path][field] = True
            self.rejects(action=lambda: checker.validate_metadata(data))

    def test_manifest_duplicates_nonfinite_and_deep_json_have_reason_only_errors(self):
        path = self.root / checker.MANIFEST
        for raw in [f'{{"x":"{SENTINEL}","x":2}}', '{"x":NaN}', '[' * 1500 + '0' + ']' * 1500]:
            path.write_text(raw)
            self.rejects()

    def test_symlink_file_and_parent_reject_before_inherited_execution(self):
        path = self.root / (checker.REVIEW + 'claims.tsv')
        original = path.read_bytes()
        outside = self.root / SENTINEL
        outside.write_bytes(original)
        path.unlink()
        path.symlink_to(outside)
        with patch.object(checker.subprocess, 'run') as run:
            self.rejects('unreadable-or-malformed-input')
            run.assert_not_called()
        path.unlink()
        path.write_bytes(original)
        folder = self.root / 'sources/standard-of-care/neurology-current/content/articles'
        moved = self.root / 'synthetic-directory'
        folder.rename(moved)
        folder.symlink_to(moved, target_is_directory=True)
        with patch.object(checker.subprocess, 'run') as run:
            self.rejects('unreadable-or-malformed-input')
            run.assert_not_called()

    @unittest.skipUnless(hasattr(os, 'mkfifo'), 'FIFO creation unavailable')
    def test_nonregular_source_rejects_without_blocking(self):
        path = self.root / (checker.SOURCE_ROOT + 'site.json')
        path.unlink()
        os.mkfifo(path)
        self.rejects('nonregular-input')

    def test_optional_history_check_never_fetches_missing_objects(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True, capture_output=True)
        self.rejects('git-input-unavailable', lambda: checker.verify(self.root, source_objects=True))
        with patch.object(checker.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, b'')) as run:
            checker.git(self.root, 'show', 'synthetic-object')
        self.assertEqual(run.call_args.kwargs['env']['GIT_NO_LAZY_FETCH'], '1')
        self.assertEqual(run.call_args.kwargs['env']['GIT_TERMINAL_PROMPT'], '0')

    def test_default_has_no_file_mutations_or_generated_exports(self):
        before = {p: (self.root / p).read_bytes() for p in self.paths}
        files_before = {str(p.relative_to(self.root)) for p in self.root.rglob('*') if p.is_file()}
        checker.verify(self.root)
        self.assertEqual(before, {p: (self.root / p).read_bytes() for p in self.paths})
        self.assertEqual(files_before, {str(p.relative_to(self.root)) for p in self.root.rglob('*') if p.is_file()})

    def test_wrapper_exposes_no_export_option(self):
        target = self.root / 'forbidden-output'
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/soc_ancillary.py'),
                                 '--output-dir', str(target)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertFalse(target.exists())


if __name__ == '__main__':
    unittest.main()
