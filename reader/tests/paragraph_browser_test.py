"""Real HTTP Chromium checks for stable paragraph links and evidence compatibility.

Run an editorial dev server or preview first. HUEY_TRAVERSAL_URL selects a local
HTTP server (default http://127.0.0.1:5173). Reconciliation uses the generated
public fixtures; hostile/move/revision cases intercept JSON in memory only.
These checks do not establish native screen-reader, physical-touch, historical
archive, private-source, literary acceptance or accessibility-certification results.
"""

import copy
import json
import os
from pathlib import Path
import shutil
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("HUEY_TRAVERSAL_URL", "http://127.0.0.1:5173").rstrip("/")


def paragraph_path(entity_id, version=None):
    path = f"/huey/paragraph/{entity_id}"
    return path + f"/v/{version}" if version else path


def page_path(entity_id):
    return f"/huey/page/{entity_id}"


class ParagraphBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        parsed = urlsplit(BASE)
        if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("Paragraph browser checks require a local HTTP server")
        cls.payload = json.loads((ROOT / "generated-editorial/data/traversal.json").read_text())
        cls.bindings = json.loads((ROOT / "generated-editorial/data/paragraphs.json").read_text())
        cls.admitted = json.loads((ROOT / "generated-public/data/book.json").read_text())
        cls.binding = next(row for row in cls.bindings["bindings"] if row["ordinal"] == 10)
        cls.entity_id = cls.binding["entityId"]
        cls.version = cls.binding["entityVersion"]
        cls.current_path = paragraph_path(cls.entity_id)
        cls.exact_path = paragraph_path(cls.entity_id, cls.version)
        cls.targets = {target["id"]: target for target in cls.payload["routes"]["targets"]}
        cls.pages = {page["id"]: page for page in cls.payload["pages"]}
        cls.page_id = cls.targets[cls.entity_id]["pageIds"][0]
        cls.block = next(block for block in cls.pages[cls.page_id]["blocks"] if block["id"] == cls.entity_id)
        cls.destination_id = next(entity_id for entity_id in cls.payload["readingOrder"]
                                  if entity_id != cls.page_id and cls.pages[entity_id]["blocks"]
                                  and cls.targets[entity_id]["slotIds"] == cls.targets[cls.page_id]["slotIds"])
        cls.legacy_path = (f"/#evidence/{cls.binding['chapterId']}/{cls.binding['ordinal']}/"
                           f"{cls.binding['chapterBlob']}")
        chapter = next(chapter for chapter in cls.admitted["chapters"] if chapter["id"] == cls.binding["chapterId"])
        cls.legacy_block = next(block for block in chapter["blocks"]
                                if block["type"] == "paragraph" and block["number"] == cls.binding["ordinal"])
        cls.pw = sync_playwright().start()
        executable = os.environ.get("HUEY_READER_BROWSER") or shutil.which("chromium")
        options = {"headless": True}
        if executable:
            options["executable_path"] = executable
        cls.browser = cls.pw.chromium.launch(**options)
        print(f"Paragraph browser: Chromium {cls.browser.version}; actual HTTP at {BASE}")

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
        self.page = self.context.new_page()
        self.page.set_default_timeout(7000)
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def open(self, path=None):
        response = self.page.goto(BASE + (self.current_path if path is None else path))
        self.assertEqual(response.status, 200)
        self.page.wait_for_function("document.querySelector('#book')?.hasAttribute('data-outcome')")

    def intercept(self, payload=None, bindings=None):
        if payload is not None:
            self.page.route("**/data/traversal.json", lambda route: route.fulfill(json=payload))
        if bindings is not None:
            self.page.route("**/data/paragraphs.json", lambda route: route.fulfill(json=bindings))

    def subject(self, entity_id=None):
        return self.page.locator(f'p[data-entity-id="{entity_id or self.entity_id}"]')

    def paragraph_links(self, entity_id=None):
        return self.subject(entity_id).locator("..").locator("nav.paragraph-links")

    def assert_located(self, page_id=None, entity_id=None):
        expect(self.page.locator("#book")).to_have_attribute("data-paragraph-location", "located")
        expect(self.page.locator("#book")).to_have_attribute("data-paragraph-id", entity_id or self.entity_id)
        expect(self.page.locator("#book")).to_have_attribute("data-page-id", page_id or self.page_id)
        expect(self.subject(entity_id)).to_be_focused()
        self.assertIn("permalink-target", self.subject(entity_id).get_attribute("class"))

    def test_01_current_and_exact_addresses_focus_same_stable_occurrence(self):
        for path in [self.current_path, self.exact_path]:
            with self.subTest(path=path):
                self.open(path)
                self.assert_located()
                self.assertEqual(urlsplit(self.page.url).path, path)
                self.assertEqual(self.subject().text_content(), self.block["text"])
                self.assertEqual(self.subject().get_attribute("id"), self.entity_id)
                self.assertEqual(self.subject().get_attribute("tabindex"), "-1")
                expect(self.subject()).to_be_in_viewport()
        expect(self.page.get_by_text("Exact paragraph wording; surrounding text is from the selected current page.", exact=True)).to_be_visible()

    def test_02_links_history_reload_and_native_scroll_restoration(self):
        self.open(page_path(self.page_id))
        initial_length = self.page.evaluate("history.length")
        self.paragraph_links().get_by_role("link", name="Current link", exact=True).click()
        self.assert_located()
        self.assertEqual(self.page.evaluate("history.length"), initial_length + 1)
        expect(self.paragraph_links().get_by_role("link", name="Exact wording", exact=True)).to_have_attribute("href", self.exact_path)
        self.paragraph_links().get_by_role("link", name="Exact wording", exact=True).click()
        self.assertEqual(urlsplit(self.page.url).path, self.exact_path)
        self.assertEqual(self.page.evaluate("history.length"), initial_length + 2)
        self.page.reload()
        self.assert_located()
        self.page.go_back()
        self.assert_located()
        self.assertEqual(urlsplit(self.page.url).path, self.current_path)
        self.page.evaluate("scrollTo(0, 400)")
        self.page.wait_for_timeout(100)
        saved = self.page.evaluate("scrollY")
        self.page.keyboard.press("Alt+PageDown")
        expect(self.page.locator("#book")).to_have_attribute("data-paragraph-location", "not-paragraph")
        self.page.go_back()
        self.assert_located()
        self.page.wait_for_function("saved => Math.abs(scrollY - saved) <= 2", arg=saved)
        self.page.go_forward()
        expect(self.page.locator("#book")).to_have_attribute("data-paragraph-location", "not-paragraph")

    def test_03_move_changes_page_context_without_changing_either_paragraph_address(self):
        changed = copy.deepcopy(self.payload)
        for page in changed["pages"]:
            if page["id"] == self.page_id:
                page["blocks"] = [block for block in page["blocks"] if block["id"] != self.entity_id]
            if page["id"] == self.destination_id:
                page["blocks"].append(copy.deepcopy(self.block))
        next(target for target in changed["routes"]["targets"] if target["id"] == self.entity_id)["pageIds"] = [self.destination_id]
        self.intercept(payload=changed)
        for path in [self.current_path, self.exact_path]:
            with self.subTest(path=path):
                self.open(path)
                self.assert_located(page_id=self.destination_id)
                self.assertEqual(urlsplit(self.page.url).path, path)
                self.assertEqual(self.subject().text_content(), self.block["text"])

    def test_04_multiple_memberships_require_explicit_context_choice(self):
        changed = copy.deepcopy(self.payload)
        next(page for page in changed["pages"] if page["id"] == self.destination_id)["blocks"].append(copy.deepcopy(self.block))
        next(target for target in changed["routes"]["targets"] if target["id"] == self.entity_id)["pageIds"].append(self.destination_id)
        self.intercept(payload=changed)
        self.open()
        expect(self.page.locator("#book")).to_have_attribute("data-paragraph-location", "ambiguous")
        self.assertEqual(self.subject().count(), 0)
        choices = self.page.locator("button[data-page-choice]")
        self.assertEqual(choices.count(), 2)
        initial_length = self.page.evaluate("history.length")
        index = changed["readingOrder"].index(self.destination_id) + 1
        self.page.get_by_role("button", name=f"Show in book page {index}", exact=True).click()
        self.assert_located(page_id=self.destination_id)
        self.assertEqual(urlsplit(self.page.url).path, self.current_path)
        self.assertEqual(self.page.evaluate("history.length"), initial_length)
        self.assertEqual(self.page.evaluate("history.state.hueyParagraphPage"), self.destination_id)
        self.page.reload()
        self.assert_located(page_id=self.destination_id)

    def test_05_revision_keeps_id_but_old_exact_state_and_evidence_do_not_transfer(self):
        changed = copy.deepcopy(self.payload)
        new_version = "hev1:" + "a" * 64
        self.assertNotEqual(new_version, self.version)
        next(target for target in changed["routes"]["targets"] if target["id"] == self.entity_id)["version"] = new_version
        next(block for page in changed["pages"] for block in page["blocks"] if block["id"] == self.entity_id)["text"] = "Synthetic revised wording for the same occurrence."
        self.intercept(payload=changed)
        self.open(self.exact_path)
        expect(self.page.locator("#book")).to_have_attribute("data-outcome", "version-unavailable")
        expect(self.page.locator("#book")).to_have_attribute("data-paragraph-location", "unavailable")
        self.assertEqual(self.page.locator(".traversal-paragraph").count(), 0)
        self.assertEqual(urlsplit(self.page.url).path, self.exact_path)
        self.open()
        self.assert_located()
        expect(self.subject()).to_have_text("Synthetic revised wording for the same occurrence.")
        expect(self.paragraph_links().get_by_role("link", name="Exact wording", exact=True)).to_have_attribute("href", paragraph_path(self.entity_id, new_version))
        self.assertEqual(self.paragraph_links().get_by_role("link", name="Evidence", exact=False).count(), 0)
        expect(self.paragraph_links()).to_contain_text("No exact admitted evidence collection is mapped.")

    def test_06_restricted_occurrence_does_not_render_or_focus_inscription(self):
        changed = copy.deepcopy(self.payload)
        target = next(target for target in changed["routes"]["targets"] if target["id"] == self.entity_id)
        target.update(access="restricted", version=None)
        self.intercept(payload=changed)
        for path in [self.current_path, self.exact_path]:
            with self.subTest(path=path):
                self.open(path)
                expect(self.page.locator("#book")).to_have_attribute("data-outcome", "restricted")
                expect(self.page.locator("#book")).to_have_attribute("data-paragraph-location", "unavailable")
                self.assertEqual(self.page.locator(".traversal-paragraph").count(), 0)
                self.assertEqual(self.page.locator(".permalink-target").count(), 0)

    def test_07_unprojected_occurrence_does_not_infer_retirement_or_successor(self):
        changed = copy.deepcopy(self.payload)
        next(target for target in changed["routes"]["targets"] if target["id"] == self.entity_id)["pageIds"] = []
        for page in changed["pages"]:
            page["blocks"] = [block for block in page["blocks"] if block["id"] != self.entity_id]
        self.intercept(payload=changed)
        self.open()
        expect(self.page.locator("#book")).to_have_attribute("data-paragraph-location", "unprojected")
        expect(self.page.get_by_text("This paragraph is known but is not in the current page projection. No replacement or successor is inferred.", exact=True)).to_be_visible()
        self.assertEqual(self.page.locator(".traversal-paragraph").count(), 0)
        self.assertEqual(self.page.locator("button[data-page-choice]").count(), 0)
        self.assertEqual(urlsplit(self.page.url).path, self.current_path)

    def test_08_malformed_bindings_fail_closed_without_disabling_stable_links(self):
        malformed = copy.deepcopy(self.bindings)
        malformed["bindings"].append(copy.deepcopy(malformed["bindings"][0]))
        self.intercept(bindings=malformed)
        self.open()
        self.assert_located()
        self.assertEqual(self.paragraph_links().get_by_role("link").count(), 2)
        expect(self.paragraph_links()).to_contain_text("Evidence-link reconciliation is unavailable.")
        expect(self.paragraph_links().get_by_role("link", name="Current link", exact=True)).to_have_attribute("href", self.current_path)
        self.page.goto(BASE + self.legacy_path)
        expect(self.page.get_by_role("dialog")).to_be_visible()
        self.assertEqual(self.page.get_by_role("link", name="Current editorial paragraph", exact=True).count(), 0)
        self.assertIn(self.legacy_block["text"], self.page.locator("#dialog-body").inner_text())

    def test_09_exact_legacy_evidence_roundtrip_preserves_pinned_wording(self):
        self.open()
        evidence = self.paragraph_links().get_by_role("link", name="Evidence", exact=False)
        expect(evidence).to_have_attribute("href", self.legacy_path)
        evidence.click()
        expect(self.page.get_by_role("dialog")).to_be_visible()
        self.assertEqual(urlsplit(self.page.url).fragment, self.legacy_path.split("#", 1)[1])
        self.assertIn(self.legacy_block["text"], self.page.locator("#dialog-body").inner_text())
        current = self.page.get_by_role("link", name="Current editorial paragraph", exact=True)
        exact = self.page.get_by_role("link", name="Exact editorial wording", exact=True)
        expect(current).to_have_attribute("href", self.current_path)
        expect(exact).to_have_attribute("href", self.exact_path)
        exact.click()
        self.assert_located()
        self.assertEqual(urlsplit(self.page.url).path, self.exact_path)
        self.paragraph_links().get_by_role("link", name="Evidence", exact=False).click()
        self.page.get_by_role("link", name="Current editorial paragraph", exact=True).click()
        self.assert_located()
        self.assertEqual(urlsplit(self.page.url).path, self.current_path)

    def test_10_legacy_tuple_hash_mismatch_does_not_guess_an_editorial_link(self):
        changed = copy.deepcopy(self.bindings)
        row = next(row for row in changed["bindings"] if row["entityId"] == self.entity_id)
        row["rawSha256"] = "0" * 64
        self.intercept(bindings=changed)
        self.page.goto(BASE + self.legacy_path)
        expect(self.page.get_by_role("dialog")).to_be_visible()
        self.assertEqual(self.page.get_by_role("link", name="Current editorial paragraph", exact=True).count(), 0)
        self.assertEqual(self.page.get_by_role("link", name="Exact editorial wording", exact=True).count(), 0)
        self.assertIn(self.legacy_block["text"], self.page.locator("#dialog-body").inner_text())

    def test_11_unplaced_paragraph_stays_addressable_without_invented_evidence(self):
        page_id = self.payload["unplacedOrder"][0]
        block = next(block for block in self.pages[page_id]["blocks"] if block["kind"] == "Paragraph")
        self.open(paragraph_path(block["id"]))
        self.assert_located(page_id=page_id, entity_id=block["id"])
        self.assertEqual(self.subject(block["id"]).text_content(), block["text"])
        self.assertEqual(self.paragraph_links(block["id"]).get_by_role("link", name="Evidence", exact=False).count(), 0)
        expect(self.page.get_by_text("Unplaced material · outside the book sequence", exact=True)).to_be_visible()

    def test_12_keyboard_links_forced_colors_and_reflow_keep_identity(self):
        self.page.emulate_media(forced_colors="active", reduced_motion="reduce")
        self.open()
        self.assert_located()
        self.page.keyboard.press("Tab")
        expect(self.paragraph_links().get_by_role("link", name="Current link", exact=True)).to_be_focused()
        self.page.keyboard.press("Tab")
        exact = self.paragraph_links().get_by_role("link", name="Exact wording", exact=True)
        expect(exact).to_be_focused()
        self.assertNotEqual(exact.evaluate("node => getComputedStyle(node).outlineStyle"), "none")
        self.page.keyboard.press("Enter")
        self.assert_located()
        for width, height in [(390, 844), (320, 720), (1280, 800)]:
            self.page.set_viewport_size({"width": width, "height": height})
            self.page.evaluate("document.documentElement.style.setProperty('--doc-size', '24px')")
            self.assertEqual(urlsplit(self.page.url).path, self.exact_path)
            expect(self.page.locator("#book")).to_have_attribute("data-page-id", self.page_id)
            self.assertEqual(self.subject().text_content(), self.block["text"])
            self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), width)

    def test_13_emulated_touch_can_follow_exact_paragraph_link(self):
        phone = self.browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, reduced_motion="reduce")
        page = phone.new_page()
        try:
            page.goto(BASE + self.current_path)
            expect(page.locator("#book")).to_have_attribute("data-paragraph-location", "located")
            subject = page.locator(f'p[data-entity-id="{self.entity_id}"]')
            link = subject.locator("..").get_by_role("link", name="Exact wording", exact=True)
            link.tap()
            expect(subject).to_be_focused()
            self.assertEqual(urlsplit(page.url).path, self.exact_path)
            self.assertLessEqual(page.evaluate("document.documentElement.scrollWidth"), page.evaluate("innerWidth"))
        finally:
            phone.close()

    def test_14_inconsistent_page_cannot_claim_exact_paragraph_resolution(self):
        for mutation in ["missing", "duplicate", "wrong-kind"]:
            with self.subTest(mutation=mutation):
                changed = copy.deepcopy(self.payload)
                selected = next(page for page in changed["pages"] if page["id"] == self.page_id)
                if mutation == "missing":
                    selected["blocks"] = [block for block in selected["blocks"] if block["id"] != self.entity_id]
                elif mutation == "duplicate":
                    selected["blocks"].append(copy.deepcopy(self.block))
                else:
                    block = next(block for block in selected["blocks"] if block["id"] == self.entity_id)
                    block.update(kind="Block", format="markdown-heading", text="# Synthetic wrong-kind block")
                self.page.unroute("**/data/traversal.json")
                self.intercept(payload=changed)
                self.open(self.exact_path)
                expect(self.page.locator("#book")).to_have_attribute("data-paragraph-location", "unavailable")
                self.assertEqual(self.page.locator(".traversal-paragraph").count(), 0)
                self.assertEqual(self.page.locator(".permalink-target").count(), 0)
                self.assertEqual(self.page.get_by_text("Exact paragraph wording; surrounding text is from the selected current page.", exact=True).count(), 0)
                self.assertEqual(urlsplit(self.page.url).path, self.exact_path)

    def test_15_paragraph_link_rows_do_not_overlap_or_overflow_at_responsive_widths(self):
        # Short inscriptions still need enough row height for all three links.
        # Check real rendered geometry rather than mirroring a CSS layout rule.
        self.open(page_path(self.page_id))
        for width in [1280, 841, 840, 800, 390]:
            with self.subTest(width=width):
                self.page.set_viewport_size({"width": width, "height": 844})
                geometry = self.page.locator(".traversal-paragraph-row").evaluate_all("""rows => rows.map(row => {
                    const bounds = element => {
                        const r = element.getBoundingClientRect();
                        return {top: r.top, bottom: r.bottom, left: r.left, right: r.right};
                    };
                    const paragraph = row.querySelector('p[data-entity-id]');
                    const text = document.createRange(); text.selectNodeContents(paragraph);
                    return {row: bounds(row), links: bounds(row.querySelector('nav.paragraph-links')),
                            paragraph: bounds(paragraph),
                            text: Array.from(text.getClientRects()).map(r => ({left: r.left, right: r.right}))};
                })""")
                self.assertGreater(len(geometry), 1)
                for previous, current in zip(geometry, geometry[1:]):
                    self.assertLessEqual(previous["links"]["bottom"], current["links"]["top"] + 1,
                                         "Link collections on successive paragraph rows overlap")
                    self.assertLessEqual(previous["links"]["bottom"], current["paragraph"]["top"] + 1,
                                         "A paragraph's links extend into the next paragraph")
                for item in geometry:
                    self.assertGreaterEqual(item["links"]["left"], -1)
                    self.assertLessEqual(item["links"]["right"], width + 1)
                    for text in item["text"]:
                        self.assertGreaterEqual(text["left"], -1)
                        self.assertLessEqual(text["right"], width + 1)
                self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), width)


if __name__ == "__main__":
    unittest.main(verbosity=2)
