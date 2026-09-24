"""Chromium checks for the minimal Huey reader/editor.

HUEY_READER_MEMORY=1 executes the exact HTML/CSS/client modules with generated
book JSON supplied in memory. Speech events are mocked; this is not audible
speech, native VoiceOver, physical touch, Vite/HTTP or cross-browser evidence.
"""
import copy
import functools
import http.server
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MEMORY = os.environ.get("HUEY_READER_MEMORY") == "1"
FAKE_SPEECH = """
const voices=[{name:'Test local',voiceURI:'local',lang:'en-US',localService:true,default:true}];
class TestSynth extends EventTarget { getVoices(){return voices} cancel(){} speak(u){setTimeout(()=>u.onstart?.(),0)} }
Object.defineProperty(window,'speechSynthesis',{value:new TestSynth(),configurable:true});
Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(t){this.text=t}},configurable:true});
"""

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

class ReaderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(["node", str(ROOT / "scripts/content.mjs")], check=True)
        cls.data = json.loads((ROOT / "generated-public/data/book.json").read_text())
        cls.temp = tempfile.TemporaryDirectory(prefix="huey-reader-browser-")
        webroot = Path(cls.temp.name)
        shutil.copy2(ROOT / "index.html", webroot / "index.html")
        shutil.copytree(ROOT / "src", webroot / "src")
        shutil.copytree(ROOT / "generated-public/data", webroot / "data")
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(webroot)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/"
        cls.pw = sync_playwright().start()
        executable = os.environ.get("HUEY_READER_BROWSER") or shutil.which("chromium")
        opts = {"headless": True}
        if executable:
            opts["executable_path"] = executable
        cls.browser = cls.pw.chromium.launch(**opts)
        (ROOT / "test-results").mkdir(exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        self.context.add_init_script(FAKE_SPEECH)
        self.page = self.context.new_page()
        self.page.set_default_timeout(7000)
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.open_page()
        self.page.locator(".reader-paragraph").first.wait_for()
        self.page.wait_for_function("window.HueyEditor !== undefined")

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def open_page(self, data=None):
        payload = data or self.data
        if not MEMORY:
            if data is not None:
                self.page.route("**/data/book.json", lambda route: route.fulfill(json=payload))
            self.page.goto(self.url)
            return
        self.page.goto("about:blank")
        html = (ROOT / "index.html").read_text()
        html = re.sub(r'<link rel="stylesheet"[^>]+>', "", html)
        html = re.sub(r'<script type="module"[^>]+></script>', "", html)
        self.page.set_content(html)
        self.page.add_style_tag(content=(ROOT / "src/style.css").read_text())
        self.page.add_script_tag(content=FAKE_SPEECH)
        self.page.evaluate("(data)=>{window.__bookFixture=data;window.fetch=async()=>new Response(JSON.stringify(data),{status:200})}", payload)
        pieces = []
        for name in ["text.mjs", "speech.mjs", "main.mjs"]:
            script = (ROOT / "src" / name).read_text()
            script = re.sub(r"^import .*?;\n", "", script, flags=re.M)
            script = re.sub(r"^export ", "", script, flags=re.M)
            expected = "new URL('./data/book.json', document.baseURI)"
            if name == "main.mjs":
                self.assertEqual(script.count(expected), 1)
                script = script.replace(expected, "'./data/book.json'")
            pieces.append(script)
        self.page.add_script_tag(content="(function(){\n" + "\n".join(pieces) + "\n})();")
        self.page.add_script_tag(content=(ROOT / "src/editor.mjs").read_text(), type="module")

    def test_01_actual_text_and_subtractive_structure(self):
        self.assertEqual(self.page.locator(".reader-paragraph").count(), 260)
        self.assertEqual(self.page.locator(".chapter").count(), 1)
        self.assertIn("netch asheba", self.page.locator(".prose").nth(3).inner_text())
        self.assertEqual(self.page.locator(".paragraph-number").first.inner_text(), "8A:1")
        self.assertEqual(self.page.locator(".paragraph-number").last.inner_text(), "8A:260")
        self.assertTrue(self.page.locator(".legacy-reader").is_hidden())
        self.assertEqual(self.page.locator(".book-title").inner_text(), "Huey")
        self.assertEqual(self.page.locator(".chapter-title").inner_text(), "8A. Baptism in the Color of Rain")
        self.assertEqual(self.page.locator(".movement").text_content(), "Interlude")

    def test_02_toolbar_is_exactly_seven_primary_controls(self):
        buttons = self.page.locator("#editor-bar > button")
        self.assertEqual(buttons.count(), 7)
        self.assertEqual([buttons.nth(i).get_attribute("id") for i in range(7)],
            ["typography","bold","italic","underline","color-menu","link","theme"])
        self.assertTrue(self.page.locator("#type-pop").is_hidden())
        self.page.get_by_role("button", name="Typography").click()
        self.assertTrue(self.page.locator("#type-pop").is_visible())
        self.page.keyboard.press("Escape")
        self.assertTrue(self.page.locator("#type-pop").is_hidden())

    def test_03_margin_evidence_remains_source_bound_after_local_edit(self):
        source = self.page.locator(".prose").first.inner_text()
        self.page.locator(".prose").first.evaluate("e=>e.firstChild.textContent='Locally edited paragraph.'")
        self.page.locator(".paragraph-number").first.click()
        self.page.get_by_role("dialog").wait_for()
        body = self.page.locator("#dialog-body").inner_text()
        self.assertIn(source, body)
        self.assertIn("Local edits", body)
        self.assertIn("#evidence/C08A/1/", self.page.url)
        self.page.keyboard.press("Escape")

    def test_04_relative_type_survives_document_resize(self):
        self.assertTrue(self.page.evaluate("HueyEditor.selectText('white man')"))
        self.page.evaluate("HueyEditor.localSize(1.1)")
        node = self.page.locator("[data-size-ratio]")
        before = float(node.evaluate("e=>parseFloat(getComputedStyle(e).fontSize)"))
        parent_before = float(node.evaluate("e=>parseFloat(getComputedStyle(e.parentElement).fontSize)"))
        self.page.evaluate("HueyEditor.docSize(.8)")
        after = float(node.evaluate("e=>parseFloat(getComputedStyle(e).fontSize)"))
        parent_after = float(node.evaluate("e=>parseFloat(getComputedStyle(e.parentElement).fontSize)"))
        self.assertAlmostEqual(before / parent_before, 1.1, delta=.03)
        self.assertAlmostEqual(after / parent_after, 1.1, delta=.03)
        self.assertLess(after, before)

    def test_05_local_color_tracks_document_basis(self):
        self.assertTrue(self.page.evaluate("HueyEditor.selectText('white man')"))
        self.assertTrue(self.page.evaluate("HueyEditor.setLocalColor('#a03d50')"))
        node = self.page.locator("[data-color-rel]")
        before = node.evaluate("e=>getComputedStyle(e).color")
        self.page.evaluate("HueyEditor.setDocumentColor('#264c7a')")
        after = node.evaluate("e=>getComputedStyle(e).color")
        self.assertNotEqual(before, after)
        self.assertGreaterEqual(self.page.evaluate("HueyEditor.palette().contrast"), 4.5)

    def test_06_dark_role_exchange_stays_legible(self):
        self.page.evaluate("HueyEditor.toggleTheme()")
        state = self.page.evaluate("HueyEditor.palette()")
        self.assertEqual(state["theme"], "dark")
        self.assertGreaterEqual(state["contrast"], 4.5)

    def test_07_small_screens_reflow_without_visible_chrome(self):
        for width, height in [(1024,800),(768,1024),(390,844),(320,720),(720,500)]:
            self.page.set_viewport_size({"width":width,"height":height})
            self.page.wait_for_timeout(30)
            self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), width)
            self.assertTrue(self.page.locator(".legacy-reader").is_hidden())
            box = self.page.locator("#editor-bar").bounding_box()
            self.assertGreaterEqual(box["x"], 0)
            self.assertLessEqual(box["x"] + box["width"], width)

    def test_08_passive_progress_edge_tracks_scroll(self):
        self.page.evaluate("scrollTo(0, document.documentElement.scrollHeight)")
        self.page.wait_for_timeout(80)
        progress = self.page.evaluate("parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--progress'))")
        self.assertGreater(progress, .9)
        self.assertEqual(self.page.locator(".editor-progress").get_attribute("aria-hidden"), "true")

    def test_09_additional_admitted_chapters_need_no_rail(self):
        data = copy.deepcopy(self.data)
        proto = next(c for c in data["chapters"] if c["status"] == "admitted")
        clone = copy.deepcopy(proto)
        clone.update({"id":"C99","label":"99","title":"Synthetic second chapter","movement":"Excursion: Edna","blob":"1"*40})
        for b in clone["blocks"]:
            if b.get("type") == "paragraph":
                b["id"] = b["id"].replace("C08A","C99")
                b["chapterId"] = "C99"
                b["label"] = b["label"].replace("8A:","99:")
        data["chapters"] = [proto, clone]
        self.context.close()
        self.context = self.browser.new_context(viewport={"width":1440,"height":900}, reduced_motion="reduce")
        self.context.add_init_script(FAKE_SPEECH)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.open_page(data=data)
        self.page.locator(".chapter").nth(1).wait_for()
        self.page.wait_for_function("window.HueyEditor !== undefined")
        self.assertEqual(self.page.locator(".chapter").count(), 2)
        self.assertEqual(self.page.locator(".chapter-title").nth(1).inner_text(), "99. Synthetic second chapter")
        self.assertTrue(self.page.locator(".legacy-reader").is_hidden())

    def test_10_screenshot(self):
        self.page.screenshot(path=str(ROOT / "test-results/minimal-editor.png"), full_page=False)

if __name__ == "__main__":
    unittest.main(verbosity=2)
