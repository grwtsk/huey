"""Synthetic structural tests, not clinical or legal evidence review."""
import copy
import csv
import json
from pathlib import Path
import unittest
import check_support as c

D = Path(__file__).parent


class SupportTests(unittest.TestCase):
    def setUp(self):
        self.registry = json.loads((D / 'registry.json').read_text())
        self.policy = json.loads((D / 'support-policy.json').read_text())
        self.approval = json.loads((D / 'approval.json').read_text())
        with (D / 'claims.tsv').open(newline='') as f:
            self.rows = list(csv.DictReader(f, delimiter='\t'))

    def run_check(self):
        return c.validate(self.registry, self.rows, self.policy, self.approval)

    def test_current(self):
        self.assertEqual(self.run_check()['substantial_support_targets'], 111)

    def test_missing_claim(self):
        self.rows.pop()
        with self.assertRaises(ValueError): self.run_check()

    def test_duplicate_claim(self):
        self.rows[-1] = copy.deepcopy(self.rows[0])
        with self.assertRaises(ValueError): self.run_check()

    def test_wrong_issue(self):
        self.rows[0]['verification_issue'] = '999'
        with self.assertRaises(ValueError): self.run_check()

    def test_empty_target(self):
        self.rows[0]['target'] = ' '
        with self.assertRaises(ValueError): self.run_check()

    def test_unknown_support(self):
        self.rows[0]['support_level'] = 'certain'
        with self.assertRaises(ValueError): self.run_check()

    def test_status_promotion(self):
        self.rows[0]['verified'] = True
        with self.assertRaises(ValueError): self.run_check()

    def test_wrong_count(self):
        self.policy['substantial_count'] = 0
        with self.assertRaises(ValueError): self.run_check()

    def test_reopened_approval(self):
        self.approval['another_approval_required_for_this_scope'] = True
        with self.assertRaises(ValueError): self.run_check()

    def test_research_gate(self):
        self.approval['research_completion_required_for_draft_transfer'] = True
        with self.assertRaises(ValueError): self.run_check()

    def test_removed_exclusion(self):
        self.approval['excluded'].remove('raw clinical PDFs and records')
        with self.assertRaises(ValueError): self.run_check()

    def test_automatic_truth(self):
        self.policy['automatic_verification'] = True
        with self.assertRaises(ValueError): self.run_check()

    def test_exact_commit_notice(self):
        c.check_message('Subject\n\n' + c.MARKER + '\n')

    def test_missing_commit_notice(self):
        with self.assertRaises(ValueError): c.check_message('Everything is verified.')


if __name__ == '__main__':
    unittest.main()
