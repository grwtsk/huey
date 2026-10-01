"""Real loopback Chromium regressions for book contents and working navigation.

Start an editorial dev server after generating its traversal/paragraph payloads.
HUEY_TRAVERSAL_URL selects it (default http://127.0.0.1:5173). These checks use
actual generated metadata and browser history; local draft text is synthetic and
stays in the disposable browser DOM. No source, private workspace, or issue is
changed. Mobile is viewport emulation, not physical-touch or accessibility
certification. Assertions deliberately do not print manuscript inscriptions.
"""

import copy
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("HUEY_TRAVERSAL_URL", "http://127.0.0.1:5173").rstrip("/")
MARKER = "Synthetic navigation draft. "


def page_path(entity_id):
    return f"/huey/page/{entity_id}"


class NavigationBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        parsed = urlsplit(BASE)
        if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("Navigation browser checks require a local HTTP server")
        cls.payload = json.loads((ROOT / "generated-editorial/data/traversal.json").read_text())
        cls.bindings = json.loads((ROOT / "generated-editorial/data/paragraphs.json").read_text())
        cls.order = cls.payload["readingOrder"]
        cls.unplaced = cls.payload["unplacedOrder"]
        cls.pages = {page["id"]: page for page in cls.payload["pages"]}
        cls.targets = {target["id"]: target for target in cls.payload["routes"]["targets"]}
        cls.slots = {slot["id"]: slot for slot in cls.payload["routes"]["slots"]}
        cls.c01 = next(alias["targetId"] for alias in cls.payload["routes"]["aliases"]
                       if alias["path"] == "/huey/chapter/c01")
        cls.c01_page = next(entity_id for entity_id in cls.order if entity_id in cls.targets[cls.c01]["pageIds"])
        cls.materialized = next(entity_id for entity_id in cls.order if cls.pages[entity_id]["blocks"])
        cls.denied = [next(entity_id for entity_id in cls.order
                          if cls.targets[entity_id]["access"] == access)
                      for access in ["unavailable-on-this-client", "restricted"]]
        cls.binding = next(row for row in cls.bindings["bindings"]
                           if row["chapterId"] == "C08A" and row["ordinal"] == 1)
        cls.legacy = (f"/#read/C08A/1/{cls.binding['chapterBlob']}")
        cls.exact = (f"/huey/paragraph/{cls.binding['entityId']}/v/{cls.binding['entityVersion']}")
        cls.pw = sync_playwright().start()
        executable = os.environ.get("HUEY_READER_BROWSER") or shutil.which("chromium")
        options = {"headless": True}
        if executable:
            options["executable_path"] = executable
        cls.browser = cls.pw.chromium.launch(**options)
        print(f"Navigation browser: Chromium {cls.browser.version}; actual loopback HTTP at {BASE}; "
              f"{len(cls.order)} book / {len(cls.unplaced)} unplaced pages")

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def open_editorial(self, path="/huey"):
        response = self.page.goto(BASE + path, wait_until="commit")
        self.assertEqual(response.status, 200)
        self.page.wait_for_function("document.querySelector('#book')?.hasAttribute('data-outcome')")
        expect(self.page.locator("#book-navigation")).to_be_visible()

    def open_admitted(self, path=None):
        response = self.page.goto(BASE + (self.legacy if path is None else path), wait_until="commit")
        # Native same-document hash navigation has no new HTTP response.
        if response is not None:
            self.assertEqual(response.status, 200)
        self.page.wait_for_function("document.querySelector('#book')?.isContentEditable")
        expect(self.page.locator("#book-navigation")).to_be_visible()

    def bar(self):
        return self.page.locator("#book-navigation")

    def contents_button(self):
        return self.bar().get_by_role("button", name="Contents", exact=True)

    def dialog(self):
        return self.page.locator("#book-contents-dialog")

    def open_contents(self):
        self.contents_button().click()
        expect(self.dialog()).to_be_visible()
        return self.dialog()

    def assert_page(self, entity_id):
        expect(self.page.locator("#book")).to_have_attribute("data-page-id", entity_id)

    def go_to_page(self, number, sequence="Book"):
        dialog = self.open_contents()
        dialog.get_by_label("Page sequence", exact=True).select_option(label=sequence)
        dialog.get_by_label("Page number", exact=True).fill(str(number))
        dialog.get_by_role("button", name="Go to page", exact=True).click()
        expect(dialog).not_to_be_visible()
        expect(self.page.locator("#book > h1")).to_be_focused()

    def make_local_draft(self):
        self.open_admitted()
        paragraph = self.page.locator("#C08A-p0001 .prose")
        paragraph.evaluate("""node => {
            node.closest('[contenteditable]')?.focus();
            const range = document.createRange(); range.selectNodeContents(node); range.collapse(true);
            const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        }""")
        self.page.keyboard.insert_text(MARKER)
        self.assertTrue(paragraph.evaluate("(node, marker) => node.textContent.startsWith(marker)", MARKER))
        paragraph.evaluate("node => { window.__navigationDraftHTML = node.innerHTML; }")
        return paragraph

    def assert_draft_retained(self, paragraph):
        self.assertTrue(paragraph.evaluate("node => node.innerHTML === window.__navigationDraftHTML"),
                        "Local text and formatting changed during navigation")

    def test_01_fixed_controls_remain_available_midscroll_at_phone_and_desktop_widths(self):
        for width in [319, 390, 1280]:
            with self.subTest(width=width):
                self.page.set_viewport_size({"width": width, "height": 844 if width < 500 else 800})
                self.open_editorial(page_path(self.materialized))
                self.page.evaluate("scrollTo(0, Math.max(1, (document.documentElement.scrollHeight-innerHeight)/2))")
                self.page.wait_for_timeout(60)
                self.assertGreater(self.page.evaluate("scrollY"), 0)
                for name in ["Previous page", "Contents", "Next page"]:
                    button = self.bar().get_by_role("button", name=name, exact=True)
                    expect(button).to_be_visible()
                    expect(button).to_be_in_viewport()
                    box = button.bounding_box()
                    self.assertGreaterEqual(box["height"], 24)
                    self.assertGreaterEqual(box["width"], 24)
                self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), width)

    def test_02_contents_preserve_known_slots_filter_c01_and_navigate_to_its_first_page(self):
        self.open_editorial(page_path(self.materialized))
        dialog = self.open_contents()
        links = dialog.locator("a[data-slot-id]")
        self.assertEqual(links.count(), len(self.slots))
        self.assertEqual(set(links.evaluate_all("nodes => nodes.map(node => node.dataset.slotId)")), set(self.slots))
        self.assertEqual(dialog.locator(".traversal-paragraph,.reader-paragraph").count(), 0)
        search = dialog.get_by_label("Find a chapter or section", exact=True)
        search.fill("C01")
        entry = dialog.locator(f'a[data-slot-id="{self.c01}"]')
        expect(entry).to_be_visible()
        expect(entry).to_have_attribute("href", page_path(self.c01_page))
        self.assertTrue(any(not link.is_visible() for link in links.all()))
        entry.click()
        expect(dialog).not_to_be_visible()
        self.assert_page(self.c01_page)
        self.assertEqual(urlsplit(self.page.url).path, page_path(self.c01_page))
        expect(self.page.locator("#book > h1")).to_be_focused()

    def test_03_number_jump_tracks_native_page_order_and_current_slot(self):
        self.open_editorial()
        index = self.order.index(self.materialized)
        self.go_to_page(index + 1)
        self.assert_page(self.materialized)
        expect(self.page.locator("#book-position")).to_contain_text(f"Page {index + 1} of {len(self.order)}")
        dialog = self.open_contents()
        for slot_id in self.targets[self.materialized]["slotIds"]:
            expect(dialog.locator(f'a[data-slot-id="{slot_id}"]')).to_have_attribute("aria-current", "location")
        self.page.keyboard.press("Escape")
        self.bar().get_by_role("button", name="Next page", exact=True).click()
        self.assert_page(self.order[index + 1])
        self.bar().get_by_role("button", name="Previous page", exact=True).click()
        self.assert_page(self.materialized)

    def test_04_invalid_number_cannot_navigate_and_book_boundaries_disable_turns(self):
        self.open_editorial()
        original_url = self.page.url
        dialog = self.open_contents()
        number = dialog.get_by_label("Page number", exact=True)
        for invalid in [0, len(self.order) + 1]:
            number.fill(str(invalid))
            dialog.get_by_role("button", name="Go to page", exact=True).click()
            self.assert_page(self.order[0])
            self.assertEqual(self.page.url, original_url)
            expect(dialog).to_be_visible()
        self.page.keyboard.press("Escape")
        expect(self.bar().get_by_role("button", name="Previous page", exact=True)).to_be_disabled()
        self.go_to_page(len(self.order))
        self.assert_page(self.order[-1])
        expect(self.bar().get_by_role("button", name="Next page", exact=True)).to_be_disabled()

    def test_05_unavailable_and_restricted_pages_keep_place_without_materializing_prose(self):
        self.open_editorial()
        for entity_id in self.denied:
            index = self.order.index(entity_id)
            self.go_to_page(index + 1)
            self.assert_page(entity_id)
            expected = "restricted" if self.targets[entity_id]["access"] == "restricted" else "unavailable"
            expect(self.page.locator("#book")).to_have_attribute("data-outcome", expected)
            self.assertEqual(self.page.locator(".traversal-paragraph,[data-entity-id]").count(), 0)
            self.open_contents()
            for slot_id in self.targets[entity_id]["slotIds"]:
                expect(self.dialog().locator(f'a[data-slot-id="{slot_id}"]')).to_be_visible()
            self.page.keyboard.press("Escape")
            if index + 1 < len(self.order):
                self.bar().get_by_role("button", name="Next page", exact=True).click()
                self.assert_page(self.order[index + 1])

    def test_06_unplaced_pages_have_their_own_numbers_and_hard_ends(self):
        self.open_editorial(page_path(self.order[-1]))
        self.go_to_page(1, sequence="Unplaced")
        self.assert_page(self.unplaced[0])
        expect(self.page.locator("#book-position")).to_contain_text(re.compile(f"[Pp]age 1 of {len(self.unplaced)}"))
        expect(self.bar().get_by_role("button", name="Previous page", exact=True)).to_be_disabled()
        expect(self.page.get_by_text("Unplaced material · outside the book sequence", exact=True)).to_be_visible()
        self.go_to_page(len(self.unplaced), sequence="Unplaced")
        self.assert_page(self.unplaced[-1])
        expect(self.bar().get_by_role("button", name="Next page", exact=True)).to_be_disabled()
        self.go_to_page(1, sequence="Book")
        self.assert_page(self.order[0])

    def test_07_contents_and_turn_buttons_use_history_without_reloading_the_document(self):
        self.open_editorial()
        original_length = self.page.evaluate("history.length")
        self.page.evaluate("window.__navigationDocument = 'same-document'")
        self.open_contents()
        self.dialog().locator(f'a[data-slot-id="{self.c01}"]').click()
        self.assert_page(self.c01_page)
        self.assertEqual(self.page.evaluate("history.length"), original_length + 1)
        self.bar().get_by_role("button", name="Next page", exact=True).click()
        following = self.order[self.order.index(self.c01_page) + 1]
        self.assert_page(following)
        self.assertEqual(self.page.evaluate("window.__navigationDocument"), "same-document")
        self.page.go_back()
        self.assert_page(self.c01_page)
        self.page.go_back()
        self.assert_page(self.order[0])
        self.page.go_forward()
        self.assert_page(self.c01_page)
        self.page.go_forward()
        self.assert_page(following)
        self.assertEqual(self.page.evaluate("window.__navigationDocument"), "same-document")

    def test_08_contents_is_a_modal_with_escape_focus_return_and_narrow_layout(self):
        self.page.set_viewport_size({"width": 319, "height": 844})
        self.open_editorial()
        dialog = self.open_contents()
        self.assertTrue(dialog.evaluate("node => node.matches(':modal')"))
        expect(dialog.get_by_label("Find a chapter or section", exact=True)).to_be_focused()
        self.page.keyboard.press("Shift+Tab")
        self.assertTrue(dialog.evaluate("node => node.contains(document.activeElement)"))
        self.page.keyboard.press("Tab")
        self.assertTrue(dialog.evaluate("node => node.contains(document.activeElement)"))
        box = dialog.bounding_box()
        self.assertGreaterEqual(box["x"], 0)
        self.assertLessEqual(box["x"] + box["width"], 319)
        self.page.keyboard.press("Escape")
        expect(dialog).not_to_be_visible()
        expect(self.contents_button()).to_be_focused()

    def test_09_same_surface_admitted_hash_jump_preserves_local_edits(self):
        paragraph = self.make_local_draft()
        destination = f"#read/C08A/2/{self.binding['chapterBlob']}"
        self.page.evaluate("hash => { location.hash = hash; }", destination)
        self.page.wait_for_function("hash => location.hash === hash", arg=destination)
        self.assert_draft_retained(paragraph)
        self.assertTrue(self.page.locator("#book").evaluate("node => node.isContentEditable"))
        expect(self.bar()).to_be_visible()
        self.page.go_back()
        self.page.wait_for_function("hash => location.hash === hash", arg=self.legacy.split("/", 1)[1])
        self.assert_draft_retained(paragraph)

    def test_10_dirty_admitted_working_link_opens_a_new_tab_and_keeps_the_draft(self):
        paragraph = self.make_local_draft()
        original_url = self.page.url
        self.open_contents()
        with self.page.expect_popup() as popup_info:
            self.dialog().get_by_text("Open working book here", exact=True).click()
        popup = popup_info.value
        popup.wait_for_load_state("domcontentloaded")
        expect(popup.locator("#book")).to_have_attribute("data-paragraph-id", self.binding["entityId"])
        self.assertEqual(urlsplit(popup.url).path, self.exact)
        self.assertEqual(self.page.url, original_url)
        self.assert_draft_retained(paragraph)

    def test_11_pristine_admitted_working_link_enters_the_exact_current_context(self):
        self.open_admitted()
        self.open_contents()
        self.dialog().get_by_text("Open working book here", exact=True).click()
        self.page.wait_for_function("document.querySelector('#book')?.hasAttribute('data-outcome')")
        expect(self.page.locator("#book")).to_have_attribute("data-paragraph-id", self.binding["entityId"])
        self.assertEqual(urlsplit(self.page.url).path, self.exact)
        self.assertEqual(len(self.context.pages), 1)
        expect(self.page.locator(f'#{self.binding["entityId"]}')).to_be_focused()

    def test_12_invalid_admitted_addresses_have_no_exact_working_context(self):
        wrong_blob = "0" * 40
        self.assertNotEqual(wrong_blob, self.binding["chapterBlob"])
        addresses = [
            (f"/#read/C08A/999999/{self.binding['chapterBlob']}", True),
            (f"/#read/C08A/1/{wrong_blob}", True),
            ("/#chapter/C01", False),
        ]
        for path, different_version in addresses:
            with self.subTest(address=path.split("/", 3)[:3]):
                self.open_admitted(path)
                version_dialog = self.page.locator("#evidence-dialog")
                expect(version_dialog).to_be_visible()
                if different_version:
                    expect(self.page.locator("#dialog-title")).to_have_text("Different manuscript version")
                # Contents remains closed behind the existing modal. Inspect its
                # metadata without forcing a click through that source outcome.
                expect(self.dialog()).not_to_be_visible()
                expect(self.page.locator("#open-working-book")).to_have_attribute("href", "/huey")
                expect(self.page.locator("#open-working-book")).to_have_text("Open working book")
                expect(self.page.locator("#book-position")).to_have_text("")
                expect(self.bar().get_by_role("button", name="Previous page", exact=True)).to_be_disabled()
                expect(self.bar().get_by_role("button", name="Next page", exact=True)).to_be_disabled()
                self.assertEqual(urlsplit(self.page.url).fragment, path.split("#", 1)[1])
                expect(version_dialog).to_be_visible()

    def test_13_scrolled_admitted_position_keeps_route_validity_and_updates_exact_context(self):
        visible = next(row for row in self.bindings["bindings"]
                       if row["chapterId"] == "C08A" and row["ordinal"] == 55)
        destination = f"/huey/paragraph/{visible['entityId']}/v/{visible['entityVersion']}"
        visible_page = self.targets[visible["entityId"]]["pageIds"][0]
        self.open_admitted()
        original_url = self.page.url
        paragraph = self.page.locator("#C08A-p0055")
        paragraph.evaluate("node => node.scrollIntoView({block:'start', behavior:'instant'})")
        # Continue an ordinary reading scroll past the fixed navigation inset;
        # do not focus another paragraph or change the original permalink.
        self.page.mouse.move(10, 200)
        self.page.mouse.wheel(0, 32)
        expect(paragraph).to_be_in_viewport()
        expect(self.page.locator("#open-working-book")).to_have_attribute("href", destination)
        expect(self.page.locator("#book-position")).to_contain_text(
            f"Page {self.order.index(visible_page) + 1} of {len(self.order)}")
        expect(self.bar().get_by_role("button", name="Previous page", exact=True)).to_be_enabled()
        expect(self.bar().get_by_role("button", name="Next page", exact=True)).to_be_enabled()
        self.assertEqual(self.page.url, original_url)
        dialog = self.open_contents()
        expect(dialog.get_by_text("Open working book here", exact=True)).to_have_attribute("href", destination)
        self.assertNotEqual(destination, self.exact)

    def assert_outside_chapter_draft_handoff(self, selector):
        self.open_admitted()
        subject = self.page.locator(selector)
        self.assertTrue(subject.evaluate("node => !node.closest('#chapters')"))
        subject.evaluate("""node => {
            node.closest('[contenteditable]')?.focus();
            const range = document.createRange(); range.selectNodeContents(node); range.collapse(true);
            const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        }""")
        self.page.keyboard.insert_text(MARKER)
        self.assertTrue(subject.evaluate("(node, marker) => node.textContent.startsWith(marker)", MARKER))
        subject.evaluate("node => { window.__outsideChapterDraft = node.innerHTML; }")
        self.assertTrue(self.page.evaluate("window.HueyEditor.hasLocalDraft()"))
        original_url = self.page.url
        self.open_contents()
        with self.page.expect_popup() as popup_info:
            self.dialog().locator(f'a[data-slot-id="{self.c01}"]').click()
        popup = popup_info.value
        expect(popup.locator("#book")).to_have_attribute("data-page-id", self.c01_page)
        self.assertEqual(urlsplit(popup.url).path, page_path(self.c01_page))
        self.assertEqual(self.page.url, original_url)
        self.assertTrue(subject.evaluate("node => node.innerHTML === window.__outsideChapterDraft"),
                        "Draft outside the chapter container was lost")
        self.assertTrue(self.page.evaluate("window.HueyEditor.hasLocalDraft()"))

    def test_14_edited_book_heading_is_a_draft_and_survives_external_contents_handoff(self):
        self.assert_outside_chapter_draft_handoff("#book > .book-title")

    def test_15_edited_byline_is_a_draft_and_survives_external_contents_handoff(self):
        self.assert_outside_chapter_draft_handoff("#book > .byline")

    def test_16_denied_projection_cannot_bridge_to_available_admitted_hash_wording(self):
        changed = copy.deepcopy(self.payload)
        c08a = next(alias["targetId"] for alias in changed["routes"]["aliases"]
                    if alias["path"] == "/huey/chapter/c08a")
        selected_page = self.targets[self.binding["entityId"]]["pageIds"][0]
        first_page = next(entity_id for entity_id in self.order if entity_id in self.targets[c08a]["pageIds"])
        self.assertEqual(selected_page, first_page)
        # Synthetic access metadata only. Membership and reciprocal slot links
        # remain intact; restricted targets carry no exact version. The admitted
        # source file and generated payload on disk are never changed.
        for target in changed["routes"]["targets"]:
            if target["id"] in {self.binding["entityId"], selected_page}:
                target.update(access="restricted", version=None)
        self.page.route("**/data/traversal.json", lambda route: route.fulfill(json=changed))
        self.open_admitted()
        expect(self.page.locator("#open-working-book")).to_have_attribute("href", "/huey")
        expect(self.page.locator("#book-position")).to_have_text("")
        expect(self.bar().get_by_role("button", name="Previous page", exact=True)).to_be_disabled()
        expect(self.bar().get_by_role("button", name="Next page", exact=True)).to_be_disabled()
        dialog = self.open_contents()
        self.assertEqual(dialog.locator("a[data-slot-id]").count(), len(self.slots))
        entry = dialog.locator(f'a[data-slot-id="{c08a}"]')
        expect(entry).to_have_attribute("href", page_path(first_page))
        entry.click()
        self.assert_page(first_page)
        self.assertEqual(urlsplit(self.page.url).path, page_path(first_page))
        expect(self.page.locator("#book")).to_have_attribute("data-outcome", "restricted")
        self.assertEqual(self.page.locator(".traversal-paragraph").count(), 0)

    def test_17_valid_permalink_remains_valid_when_reading_a_different_admitted_chapter(self):
        book = json.loads((ROOT / "generated-public/data/book.json").read_text())
        c08a = next(chapter for chapter in book["chapters"] if chapter["id"] == "C08A")
        c01 = next(chapter for chapter in book["chapters"] if chapter["id"] == "C01")
        paragraph = copy.deepcopy(next(block for block in c08a["blocks"] if block["type"] == "paragraph"))
        synthetic = "Synthetic first chapter paragraph for a multi-chapter navigation test."
        paragraph.update(id="C01-p0001", chapterId="C01", number=1, label="1:1", raw=synthetic,
                         text=synthetic, tokens=[{"type": "text", "text": synthetic}], startLine=3, endLine=3,
                         sha256=hashlib.sha256(synthetic.encode()).hexdigest(),
                         sourceUrl="https://example.invalid/synthetic-navigation-source")
        paragraph["evidence"] = {"coverage": "unmapped", "claims": [], "referenceIds": [], "reviewNote": "",
                                 "mappingIssue": "https://example.invalid/synthetic-navigation-mapping"}
        # Admission here is a disposable browser fixture condition. No canonical
        # source, publication metadata, or actual admission decision is changed.
        c01.update(status="admitted", blob="0" * 40, blocks=[paragraph], paragraphCount=1,
                   admission="https://example.invalid/synthetic-navigation-admission")
        self.page.route("**/data/book.json", lambda route: route.fulfill(json=book))
        requested = "/#read/C01/1/" + "0" * 40
        self.open_admitted(requested)
        self.assertEqual(self.page.locator(".chapter").count(), 2)
        expect(self.page.locator("#evidence-dialog")).not_to_be_visible()
        expect(self.page.locator("#open-working-book")).to_have_attribute("href", "/huey")
        expect(self.page.locator("#book-position")).to_have_text("")
        expect(self.bar().get_by_role("button", name="Previous page", exact=True)).to_be_disabled()
        expect(self.bar().get_by_role("button", name="Next page", exact=True)).to_be_disabled()
        original_url = self.page.url
        visible = self.page.locator("#C08A-p0001")
        visible.evaluate("node => node.scrollIntoView({block:'start', behavior:'instant'})")
        self.page.mouse.move(10, 200)
        self.page.mouse.wheel(0, 32)
        expect(visible).to_be_in_viewport()
        expect(self.page.locator("#open-working-book")).to_have_attribute("href", self.exact)
        page_id = self.targets[self.binding["entityId"]]["pageIds"][0]
        expect(self.page.locator("#book-position")).to_contain_text(
            f"Page {self.order.index(page_id) + 1} of {len(self.order)}")
        expect(self.bar().get_by_role("button", name="Previous page", exact=True)).to_be_enabled()
        expect(self.bar().get_by_role("button", name="Next page", exact=True)).to_be_enabled()
        self.assertEqual(self.page.url, original_url)
        self.assertFalse(self.page.evaluate("window.HueyEditor.hasLocalDraft()"))
        dialog = self.open_contents()
        expect(dialog.get_by_text("Open working book here", exact=True)).to_have_attribute("href", self.exact)


if __name__ == "__main__":
    unittest.main(verbosity=2)
