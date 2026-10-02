"""Public CL05 changed/retained indexes and private-packet boundary regressions; no private inputs."""
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
spec = importlib.util.spec_from_file_location('soc_cl05', ROOT / 'scripts/soc_cl05.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
SENTINEL = 'SYNTHETIC_PRIVATE_SENTINEL'


class SocCl05Tests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.paths = [checker.MANIFEST, checker.CORE_MANIFEST, checker.PREDECESSOR['path'],
                      *checker.EXPECTED, *checker.NAVIGATION]
        for relative in self.paths:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)
        self.manifest = json.loads((self.root / checker.MANIFEST).read_text())
        self.index = (self.root / (checker.REVIEW + 'integration-r05.tsv')).read_bytes()
        self.rows = [line.split('\t') for line in self.index.decode().splitlines()]
        self.retained = (self.root / (checker.REVIEW + 'integration-r05-retained.tsv')).read_bytes()
        self.retained_rows = [line.split('\t') for line in self.retained.decode().splitlines()]

    def save(self):
        (self.root / checker.MANIFEST).write_text(json.dumps(self.manifest, indent=2) + '\n')

    def rejects(self, reason=None, action=None):
        with self.assertRaises(checker.Invalid) as caught:
            (action or (lambda: checker.verify(self.root)))()
        message = str(caught.exception)
        self.assertRegex(message, r'^[a-z-]+$')
        self.assertNotIn(SENTINEL, message)
        self.assertNotIn(str(self.root), message)
        if reason:
            self.assertEqual(message, reason)

    def index_rejects(self, rows, reason=None, retained=False):
        raw = ('\n'.join('\t'.join(row) for row in rows) + '\n').encode()
        self.rejects(reason, lambda: checker.parse_index(raw, retained=retained))

    def test_public_indexes_do_not_claim_private_reconciliation_or_clearance(self):
        result = checker.verify(self.root)
        expected = {'files': 4, 'exact_copies': 4, 'changed_units': 78, 'changed_passage_groups': 11,
                    'retained_units': 189, 'retained_passage_groups': 44,
                    'changed_source_aliases': 10, 'changed_source_alias_references': 182,
                    'retained_source_aliases': 4, 'retained_source_alias_references': 300,
                    'combined_source_aliases': 11, 'combined_source_alias_references': 482,
                    'carelaw_references': 86, 'distinct_carelaw_references': 51,
                    'changed_units_without_carelaw_reference': 14,
                    'retained_source_lineage_open_units': 4, 'historical_negative_cases_rerun': 0,
                    'exports_written': 0, 'original_git_objects_checked': 0}
        for key, value in expected.items():
            self.assertEqual(result[key], value)
        self.assertEqual(result['historical_chapter_coordinate'], '14')
        self.assertIs(result['private_packet_checked'], False)
        self.assertIs(result['inherited_packet_verifier_executed'], False)
        self.assertIn('not independent events or verified claims', result['limits'])
        self.assertIn('do not convey human clearance', result['limits'])

    def test_schema_source_scope_and_basis_pins_cannot_drift(self):
        baseline = copy.deepcopy(self.manifest)
        for mutate in [lambda d: d.update(schema='huey.soc-cl05.v2'),
                       lambda d: d.update(basisRevision='0' * 40),
                       lambda d: d.update(sourceCommit='0' * 40),
                       lambda d: d.update(sourcePR=122.0),
                       lambda d: d['scopeRefs'].append('https://example.invalid/' + SENTINEL),
                       lambda d: d.update(authority=True)]:
            self.manifest = copy.deepcopy(baseline)
            mutate(self.manifest)
            self.save()
            self.rejects()

    def test_false_completion_authority_or_private_execution_flags_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for key, expected in checker.FLAGS.items():
            self.manifest = copy.deepcopy(baseline)
            self.manifest[key] = not expected
            self.save()
            self.rejects('completion-or-authority-claim')

    def test_missing_duplicate_extra_or_unselected_files_reject(self):
        baseline = copy.deepcopy(self.manifest)
        for mutate in [lambda d: d['files'].pop(),
                       lambda d: d['files'].append(copy.deepcopy(d['files'][0])),
                       lambda d: d['files'].__setitem__(-1, copy.deepcopy(d['files'][0])),
                       lambda d: d['files'][0].update(path='../' + SENTINEL)]:
            self.manifest = copy.deepcopy(baseline)
            mutate(self.manifest)
            self.save()
            self.rejects()

    def test_all_four_archived_files_are_pinned_even_after_manifest_rebinding(self):
        for path in checker.EXPECTED:
            target = self.root / path
            original = target.read_bytes()
            target.write_bytes(original + SENTINEL.encode())
            self.rejects('staged-byte-drift')
            row = next(row for row in self.manifest['files'] if row['path'] == path)
            previous = row['stagedBlob']
            row['sourceBlob'] = row['stagedBlob'] = checker.blob(target.read_bytes())
            self.save()
            self.rejects('exact-copy-pin')
            row['sourceBlob'] = row['stagedBlob'] = previous
            self.save()
            target.write_bytes(original)

    def test_index_requires_seven_named_fields_and_explicit_nonempty_values(self):
        for rows in [self.rows[:-1], self.rows + [self.rows[-1]],
                     [['other'] + self.rows[0][1:]] + self.rows[1:]]:
            self.index_rejects(rows, 'index-shape')
        for mutate in [lambda row: row.pop(), lambda row: row.append(SENTINEL),
                       lambda row: row.__setitem__(6, '')]:
            rows = copy.deepcopy(self.rows)
            mutate(rows[1])
            self.index_rejects(rows, 'index-fields')

    def test_duplicate_out_of_order_or_renumbered_units_reject(self):
        for value in ['HUEY-CL05-U002', 'HUEY-CL05-U000', 'HUEY-CL05-U999', SENTINEL]:
            rows = copy.deepcopy(self.rows)
            rows[1][0] = value
            self.index_rejects(rows, 'index-unit-identities')
        rows = copy.deepcopy(self.rows)
        rows[1], rows[2] = rows[2], rows[1]
        self.index_rejects(rows, 'index-unit-identities')

    def test_edit_group_boundaries_types_and_owners_reject_drift(self):
        for field, value, reason in [(1, 'CL05-E02', 'index-passage-membership'),
                                    (1, SENTINEL, 'index-passage-membership'),
                                    (2, '15', 'index-chapter-membership'),
                                    (2, SENTINEL, 'index-chapter-membership'),
                                    (3, 'request', 'index-type-membership'),
                                    (3, SENTINEL, 'index-type-membership'),
                                    (4, '178', 'index-owner-membership'),
                                    (4, '999', 'index-owner-membership')]:
            rows = copy.deepcopy(self.rows)
            rows[1][field] = value
            self.index_rejects(rows, reason)

    def test_changed_and_retained_indexes_cannot_be_swapped_or_collapse(self):
        self.rejects('index-shape', lambda: checker.inspect_indexes(self.retained, self.index))
        rows = copy.deepcopy(self.retained_rows)
        rows[1][0] = 'HUEY-CL05-U001'
        self.index_rejects(rows, 'index-unit-identities', retained=True)
        for name, raw in [('integration-r05.tsv', self.retained),
                          ('integration-r05-retained.tsv', self.index)]:
            path = self.root / (checker.REVIEW + name)
            original = path.read_bytes()
            path.write_bytes(raw)
            self.rejects('staged-byte-drift')
            path.write_bytes(original)

    def test_mapping_changes_cannot_hide_behind_unchanged_global_counts(self):
        rows = copy.deepcopy(self.rows)
        rows[1][6], rows[4][6] = rows[4][6], rows[1][6]
        raw = ('\n'.join('\t'.join(row) for row in rows) + '\n').encode()
        # A reference permutation can preserve memberships; exact copy pins remain required.
        self.assertNotEqual(raw, self.index)
        checker.parse_index(raw)
        (self.root / (checker.REVIEW + 'integration-r05.tsv')).write_bytes(raw)
        self.rejects('staged-byte-drift')

    def test_aliases_are_known_unique_references_never_paths(self):
        for value in ['A,A', '-', 'A,', '../' + SENTINEL, 'https://example.invalid/' + SENTINEL]:
            rows = copy.deepcopy(self.rows)
            rows[1][5] = value
            self.index_rejects(rows, 'index-source-membership')
        rows = copy.deepcopy(self.rows)
        for row in rows[1:]:
            row[5] = row[5].replace('W07', 'W06')
        self.index_rejects(rows, 'index-source-coverage')

    def test_prior_corpus_reference_range_duplicates_and_selection_reject_drift(self):
        for value in ['C000', 'C257', 'C14', 'C014,C014', '-,C014', SENTINEL]:
            rows = copy.deepcopy(self.rows)
            rows[1][6] = value
            self.index_rejects(rows, 'index-carelaw-membership')
        for value in ['C001', '-', 'C145,C001']:
            rows = copy.deepcopy(self.rows)
            rows[1][6] = value
            self.index_rejects(rows, 'index-carelaw-coverage')

    def test_malformed_index_diagnostics_never_echo_bytes(self):
        self.rejects('index-encoding', lambda: checker.parse_index(SENTINEL.encode() + b'\xff'))
        self.rejects('index-shape', lambda: checker.parse_index(SENTINEL.encode()))

    def test_retained_paragraph_boundaries_preserve_historical_gaps(self):
        self.assertEqual(len(checker.RETAINED_GROUP_COUNTS), 44)
        self.assertEqual({f'CL05-P{i:03}' for i in range(1, 49)} - set(checker.RETAINED_GROUP_COUNTS),
                         {'CL05-P011', 'CL05-P026', 'CL05-P038', 'CL05-P039'})
        for replacement in ['CL05-P002', 'CL05-P011', 'CL05-P026', 'CL05-P038', 'CL05-P039']:
            rows = copy.deepcopy(self.retained_rows)
            rows[1][1] = replacement
            self.index_rejects(rows, 'index-passage-membership', retained=True)
        rows = copy.deepcopy(self.retained_rows)
        rows[4][1], rows[5][1] = rows[5][1], rows[4][1]
        self.index_rejects(rows, 'index-passage-membership', retained=True)

    def test_retained_lineage_gap_cannot_be_cleared_reattributed_or_relocated(self):
        for index in range(89, 93):
            for field, value in [(3, 'normative'), (4, '185'), (5, 'M'),
                                 (5, 'B,M'), (6, 'retained-source-scoped-review'),
                                 (6, 'cleared'), (6, 'admitted')]:
                rows = copy.deepcopy(self.retained_rows)
                rows[index][field] = value
                self.index_rejects(rows, 'retained-lineage-gap', retained=True)
        rows = copy.deepcopy(self.retained_rows)
        rows[89][3:], rows[93][3:] = rows[93][3:], rows[89][3:]
        self.index_rejects(rows, 'retained-lineage-gap', retained=True)

    def test_retained_review_labels_cannot_claim_clearance_or_relocate_gap(self):
        for field, value in [(6, 'cleared'), (6, 'admitted'), (6, 'verified'),
                             (6, 'retained-source-lineage-open'),
                             (3, 'personal-declaration-lineage-pending')]:
            rows = copy.deepcopy(self.retained_rows)
            rows[1][field] = value
            self.index_rejects(rows, 'retained-review-state', retained=True)

    def test_retained_indexes_reject_missing_fields_duplicate_ids_and_alias_paths(self):
        for rows, reason in [(self.retained_rows[:-1], 'index-shape'),
                             (self.retained_rows + [self.retained_rows[-1]], 'index-shape')]:
            self.index_rejects(rows, reason, retained=True)
        for field, value, reason in [(0, 'HUEY-CL05-R002', 'index-unit-identities'),
                                     (2, '15', 'index-chapter-membership'),
                                     (3, 'unknown', 'index-type-membership'),
                                     (4, '999', 'index-owner-membership'),
                                     (5, 'B,B', 'index-source-membership'),
                                     (5, '../' + SENTINEL, 'index-source-membership'),
                                     (6, '', 'index-fields')]:
            rows = copy.deepcopy(self.retained_rows)
            rows[1][field] = value
            self.index_rejects(rows, reason, retained=True)

    def test_retained_mapping_permutations_still_require_exact_bytes(self):
        rows = copy.deepcopy(self.retained_rows)
        rows[1][5], rows[5][5] = rows[5][5], rows[1][5]
        raw = ('\n'.join('\t'.join(row) for row in rows) + '\n').encode()
        checker.parse_index(raw, retained=True)
        self.assertNotEqual(raw, self.retained)
        (self.root / (checker.REVIEW + 'integration-r05-retained.tsv')).write_bytes(raw)
        self.rejects('staged-byte-drift')

    def test_predecessor_is_fixed_and_historical_receipt_cannot_be_rewritten(self):
        baseline = copy.deepcopy(self.manifest)
        for key, value in [('path', '../' + SENTINEL), ('blob', '0' * 40)]:
            self.manifest = copy.deepcopy(baseline)
            self.manifest['predecessorManifest'][key] = value
            self.save()
            self.rejects('predecessor-pin')
        self.manifest = baseline
        self.save()
        path = self.root / checker.PREDECESSOR['path']
        value = json.loads(path.read_text())
        value['navigationChanges'][0]['stagedBlob'] = 'a' * 40
        path.write_text(json.dumps(value))
        self.rejects('predecessor-byte-drift')

    def test_navigation_cannot_skip_predecessor_or_adapt_private_packet(self):
        baseline = copy.deepcopy(self.manifest)
        for field in ['sourceBlob', 'priorStagedBlob']:
            self.manifest = copy.deepcopy(baseline)
            self.manifest['navigationChanges'][0][field] = '0' * 40
            self.save()
            self.rejects('navigation-prior-pin')
        self.manifest = copy.deepcopy(baseline)
        self.manifest['navigationChanges'][0]['path'] = checker.REVIEW + 'packet.json'
        self.save()
        self.rejects('navigation-selection')

    def test_current_navigation_requires_endpoint_and_core_agreement(self):
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

    def test_missing_files_and_symlink_components_reject(self):
        path = self.root / (checker.REVIEW + 'integration-r05.tsv')
        original = path.read_bytes()
        path.unlink()
        self.rejects('unreadable-or-malformed-input')
        path.write_bytes(original)
        folder = self.root / checker.REVIEW
        moved = self.root / SENTINEL
        folder.rename(moved)
        folder.symlink_to(moved, target_is_directory=True)
        self.rejects('unreadable-or-malformed-input')

    def test_duplicate_nonfinite_and_malformed_json_do_not_echo_input(self):
        path = self.root / checker.MANIFEST
        for raw in [f'{{"x":"{SENTINEL}","x":2}}', '{"x":NaN}', '{']:
            path.write_text(raw)
            self.rejects()

    def test_history_is_local_only_and_missing_objects_fail(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True, capture_output=True)
        self.rejects('git-input-unavailable', lambda: checker.verify(self.root, source_objects=True))

    def test_archived_checker_is_not_imported_executed_or_allowed_to_read_a_packet(self):
        private_path = self.root / 'unselected-private-packet.json'
        private_path.write_text(SENTINEL)
        before = {p: (self.root / p).read_bytes() for p in self.paths}
        with patch.object(checker, 'read', wraps=checker.read) as read, \
                patch('builtins.exec', side_effect=AssertionError('execution forbidden')), \
                patch('subprocess.run', side_effect=AssertionError('subprocess forbidden')):
            checker.verify(self.root)
        self.assertEqual(set(call.args[1] for call in read.call_args_list), set(self.paths))
        self.assertEqual(before, {p: (self.root / p).read_bytes() for p in self.paths})
        self.assertEqual(private_path.read_text(), SENTINEL)
        self.assertEqual({p.relative_to(self.root).as_posix() for p in self.root.rglob('*') if p.is_file()},
                         set(self.paths) | {'unselected-private-packet.json'})
        self.assertFalse(list(self.root.rglob('__pycache__')))

    def test_wrapper_has_no_packet_root_or_export_interface(self):
        for option in ['--packet', '--root', '--output-dir']:
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/soc_cl05.py'),
                                     option, str(self.root / 'forbidden')], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertFalse((self.root / 'forbidden').exists())


if __name__ == '__main__':
    unittest.main()
