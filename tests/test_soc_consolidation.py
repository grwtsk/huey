"""Synthetic mutation tests for the pinned working-source import boundary."""
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
spec = importlib.util.spec_from_file_location('soc_consolidation', ROOT / 'scripts/soc_consolidation.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
SENTINEL = 'SYNTHETIC_PRIVATE_SENTINEL'


class SocConsolidationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True, capture_output=True)
        for relative in [checker.MANIFEST, *checker.EXPECTED,
                         checker.ancillary.MANIFEST, *checker.ancillary.EXPECTED]:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)
        self.manifest = json.loads((self.root / checker.MANIFEST).read_text())
        self.data = {path: json.loads((self.root / path).read_text())
                     for path in checker.EXPECTED if path.endswith('.json')}

    def save_manifest(self):
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

    def test_current_copy_and_claim_route_counts(self):
        result = checker.verify(self.root)
        self.assertEqual(result['files'], 51)
        self.assertEqual(result['core_files'], 36)
        self.assertEqual(result['ancillary_files'], 15)
        self.assertEqual(result['exact_copies'], 49)
        self.assertEqual(result['adapted_navigation_files'], 2)
        self.assertEqual(result['initial_claim_targets'], 188)
        self.assertEqual(result['substantial_support_targets'], 111)
        self.assertEqual(result['ancillary_claim_targets'], 70)
        self.assertEqual(result['ancillary_substantial_support_targets'], 16)
        self.assertEqual(result['original_git_objects_checked'], 0)
        self.assertIn('not upstream extraction verification', result['limits'])
        self.assertIn('disclosure authority', result['limits'])

    def test_original_object_check_fails_without_local_objects_instead_of_fetching(self):
        self.rejects('git-input-unavailable', lambda: checker.verify(self.root, source_objects=True))

    def test_git_helpers_disable_lazy_fetch_and_prompts(self):
        with patch.object(checker.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, b'')) as run:
            checker.git(self.root, 'show', 'synthetic-object')
        environment = run.call_args.kwargs['env']
        self.assertEqual(environment['GIT_NO_LAZY_FETCH'], '1')
        self.assertEqual(environment['GIT_TERMINAL_PROMPT'], '0')

    def test_duplicate_missing_and_unknown_selected_files_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for change in [lambda x: x['files'].pop(),
                       lambda x: x['files'].__setitem__(-1, copy.deepcopy(x['files'][0])),
                       lambda x: x['files'][0].update(path=f'sources/standard-of-care/{SENTINEL}')]:
            self.manifest = copy.deepcopy(baseline)
            change(self.manifest)
            self.save_manifest()
            self.rejects()

    def test_source_and_basis_pins_cannot_drift(self):
        for field in ['basisRevision', 'sourceCommit']:
            baseline = copy.deepcopy(self.manifest)
            self.manifest[field] = '0' * 40
            self.save_manifest()
            self.rejects()
            self.manifest = baseline
        self.manifest['files'][0]['sourceBlob'] = '0' * 40
        self.save_manifest()
        self.rejects('source-blob-pin')

    def test_false_completion_admission_or_authority_rejects(self):
        baseline = copy.deepcopy(self.manifest)
        for field, value in checker.FLAGS.items():
            self.manifest = copy.deepcopy(baseline)
            self.manifest[field] = not value
            self.save_manifest()
            self.rejects('completion-or-authority-claim')

    def test_reference_urls_are_fixed_context_not_arbitrary_grants(self):
        self.manifest['scopeRefs'].append('https://example.invalid/' + SENTINEL)
        self.save_manifest()
        self.rejects('scope-limits')
        self.manifest['scopeRefs'].pop()
        self.manifest['approval'] = True
        self.save_manifest()
        self.rejects('manifest-fields')

    def test_core_coverage_requires_validated_ancillary_selection(self):
        target = self.root / checker.ancillary.MANIFEST
        target.unlink()
        self.rejects('ancillary-unreadable-or-malformed-input')

    def test_core_check_cannot_greenlight_changed_ancillary_bytes(self):
        target = self.root / 'planning/standard-of-care/ancillary-r02/claims.tsv'
        target.write_text(target.read_text().replace('ANC-C001', 'ANC-C002', 1))
        self.rejects('ancillary-staged-byte-drift')

    def test_exact_source_bytes_cannot_be_rebound_as_adapted_navigation(self):
        row = next(x for x in self.manifest['files'] if x['path'].endswith('/context/standard.md'))
        row['representation'] = 'adapted-navigation'
        self.save_manifest()
        self.rejects('representation')
        row['representation'] = 'exact'
        row['stagedBlob'] = 'a' * 40
        self.save_manifest()
        self.rejects('exact-copy-pin')

    def test_changed_source_and_navigation_bytes_reject(self):
        for path in ['sources/standard-of-care/context/standard.md',
                     'sources/standard-of-care/README.md']:
            target = self.root / path
            original = target.read_bytes()
            target.write_bytes(original + SENTINEL.encode())
            self.rejects('staged-byte-drift')
            target.write_bytes(original)

    def test_claim_identity_and_verifier_route_drift_reject(self):
        target = self.root / 'planning/standard-of-care/claims.tsv'
        original = target.read_text()
        for changed in [original.replace('SOC-C001', 'SOC-C002', 1),
                        original.replace('\t127\t', '\t999\t', 1)]:
            self.assertNotEqual(changed, original)
            target.write_text(changed)
            self.rejects('staged-byte-drift')

    def test_unselected_ancillary_and_raw_additions_reject_without_read(self):
        for path in ['sources/standard-of-care/raw/synthetic.pdf',
                     'sources/standard-of-care/neurology-current/content/articles/unselected.json',
                     'planning/standard-of-care/incident-register/unselected.json']:
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(SENTINEL)
            self.rejects('source-tree-coverage')
            target.unlink()

    def test_missing_file_and_symlink_reject(self):
        target = self.root / 'sources/standard-of-care/context/standard.md'
        original = target.read_bytes()
        target.unlink()
        self.rejects()
        outside = self.root / SENTINEL
        outside.write_bytes(original)
        target.symlink_to(outside)
        self.rejects('symlink-input')

    def test_source_completion_flags_remain_false(self):
        for path, pointer in [
            ('sources/standard-of-care/transfer-manifest.json', ('summary', 'full_presentation_json_transfer_complete')),
            ('sources/standard-of-care/context/manifest.json', ('automated_verbatim_chat_export',)),
            ('planning/standard-of-care/registry.json', ('coverage', 'verification_complete')),
            ('planning/standard-of-care/support-policy.json', ('automatic_verification',)),
        ]:
            changed = copy.deepcopy(self.data)
            value = changed[path]
            for key in pointer[:-1]:
                value = value[key]
            value[pointer[-1]] = True
            self.rejects(action=lambda: checker.validate_membership(changed))

    def test_prose_context_and_atlas_reference_membership_rejects_drift(self):
        mutations = [
            lambda d: d['sources/standard-of-care/transfer-manifest.json']['prose_exports'][0].update(
                destination='../../' + SENTINEL),
            lambda d: d['sources/standard-of-care/context/manifest.json']['files'][0].update(path=SENTINEL),
            lambda d: d['sources/standard-of-care/neurology-current/content/articles/atlas.json']['current']['atlas'][
                'principles'][0]['article_links'][0].update(work=SENTINEL),
            lambda d: d['sources/standard-of-care/neurology-current/content/articles/atlas.json']['current']['atlas'][
                'principles'][0]['principle_links'][0].update(target=SENTINEL),
        ]
        for mutate in mutations:
            changed = copy.deepcopy(self.data)
            mutate(changed)
            self.rejects(action=lambda: checker.validate_membership(changed))

    def test_duplicate_and_nonfinite_manifest_json_rejects_without_echo(self):
        target = self.root / checker.MANIFEST
        for raw in [f'{{"x":"{SENTINEL}","x":2}}', '{"x":NaN}', '{']:
            target.write_text(raw)
            self.rejects()

    def test_checker_leaves_source_tree_bytes_unchanged(self):
        before = {p: (self.root / p).read_bytes() for p in [
            checker.MANIFEST, *checker.EXPECTED, checker.ancillary.MANIFEST, *checker.ancillary.EXPECTED]}
        checker.verify(self.root)
        after = {p: (self.root / p).read_bytes() for p in before}
        self.assertEqual(before, after)
        self.assertFalse(list(self.root.rglob('__pycache__')))


if __name__ == '__main__':
    unittest.main()
