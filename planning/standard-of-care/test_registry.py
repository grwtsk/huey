"""Synthetic mutations; no private source material."""
import copy
import json
from pathlib import Path
import unittest
from check_registry import validate


class RegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = json.loads(Path(__file__).with_name('registry.json').read_text())

    def mutation(self):
        return copy.deepcopy(self.baseline)

    def test_valid(self):
        validate(self.mutation())

    def test_missing_claim(self):
        d = self.mutation(); d['verifications'][0][4] = 8
        with self.assertRaises(ValueError): validate(d)

    def test_duplicate_claim(self):
        d = self.mutation(); d['verifications'][1][3] = 9
        with self.assertRaises(ValueError): validate(d)

    def test_orphan_claim(self):
        d = self.mutation(); d['arguments'][0][4] += ',999'
        with self.assertRaises(ValueError): validate(d)

    def test_wrong_verifier(self):
        d = self.mutation(); d['arguments'][0][3].remove(128)
        with self.assertRaises(ValueError): validate(d)

    def test_fabricated_transfer_completion(self):
        d = self.mutation(); d['coverage']['full_text_transfer_complete'] = True
        with self.assertRaises(ValueError): validate(d)

    def test_fabricated_audit_completion(self):
        d = self.mutation(); d['coverage']['source_unit_audit_complete'] = True
        with self.assertRaises(ValueError): validate(d)

    def test_private_locator(self):
        d = self.mutation(); d['extra'] = '/mnt/data/private.pdf'
        with self.assertRaises(ValueError): validate(d)

    def test_normative_id_missing(self):
        d = self.mutation(); d['arguments'][0][2] = None
        with self.assertRaises(ValueError): validate(d)

    def test_changed_issue_identity(self):
        d = self.mutation(); d['verifications'][0][1] = 999
        with self.assertRaises(ValueError): validate(d)


if __name__ == '__main__':
    unittest.main()
