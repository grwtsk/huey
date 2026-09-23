import json
import unittest

from scripts import book


class BookSourceTests(unittest.TestCase):
    def test_manifest_and_structure_validate(self):
        self.assertEqual([], book.validate())

    def test_word_target_and_movement_envelopes(self):
        manifest = book.load_manifest()
        target = manifest["word_target"]
        self.assertEqual(80000, target["min"])
        self.assertEqual(114000, target["max"])
        envelopes = target["movement_envelopes"]
        self.assertEqual(target["min"], sum(v["min"] for v in envelopes.values()))
        self.assertEqual(target["max"], sum(v["max"] for v in envelopes.values()))
        self.assertEqual(600, envelopes["excursion"]["min"])
        self.assertEqual(600, envelopes["excursion"]["max"])

    def test_planned_chapters_are_structural_placeholders(self):
        manifest = book.load_manifest()
        for item in manifest["items"]:
            if item["status"] != "planned":
                continue
            text = (book.ROOT / item["path"]).read_text(encoding="utf-8")
            self.assertEqual("", book.visible_text(text), item["id"])

    def test_emit_uses_manifest_not_directory_glob(self):
        manifest = book.load_manifest()
        emitted = book.render(manifest)
        included = [item for item in manifest["items"] if item["include"]]
        held = [item for item in manifest["items"] if not item["include"]]
        for item in included:
            self.assertIn(f"<!-- BEGIN {item['id']} ", emitted)
        for item in held:
            self.assertNotIn(f"<!-- BEGIN {item['id']} ", emitted)

    def test_experiential_insertions_preserve_distance_and_do_not_guess_ex_ids(self):
        manifest = book.load_manifest()
        ids = [item["id"] for item in manifest["items"]]
        self.assertEqual(19, len(ids))
        self.assertEqual("C02A", ids[ids.index("C02") + 1])
        self.assertEqual("C08A", ids[ids.index("C08") + 1])
        self.assertEqual("C12A", ids[ids.index("C12") + 1])
        self.assertGreater(ids.index("C08A") - ids.index("C02A"), 1)
        self.assertGreater(ids.index("C12A") - ids.index("C08A"), 1)
        structure = manifest["experiential_structure"]
        self.assertEqual(5, structure["registered_experiences"])
        self.assertEqual(3, structure["captured_in_C08A"])
        self.assertEqual("pending_private_register_reconciliation", structure["ex_id_reconciliation"])
        self.assertTrue(all(slot["exact_EX_id"] is None for slot in structure["remaining_insertion_slots"]))

    def test_count_report_is_machine_readable(self):
        report = book.count_report()
        encoded = json.dumps(report)
        self.assertIn('"included_words"', encoded)
        self.assertEqual({"min": 80000, "max": 114000}, report["target"])


if __name__ == "__main__":
    unittest.main()
