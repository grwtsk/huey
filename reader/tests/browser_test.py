"""Real Chromium DOM tests, using a source fixture server, not a claimed Vite run.

Requires Playwright Python and Chromium. Set HUEY_READER_MEMORY=1 for a network-free, in-memory loader fixture.
Speech events are mocked; audible output
and native VoiceOver must be checked separately on the target operating system.
"""
import copy
import re
from urllib.parse import urlsplit
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MEMORY = os.environ.get("HUEY_READER_MEMORY") == "1"
FAKE_SPEECH = """
const voices = [
 {name:'Test local',voiceURI:'local',lang:'en-US',localService:true,default:true},
 {name:'Test online',voiceURI:'remote',lang:'en-US',localService:false,default:false}
];
class TestSynth extends EventTarget {
 constructor(){super();this.spoken=[];this.cancelCount=0;}
 getVoices(){return voices;}
 cancel(){this.cancelCount++;}
 speak(u){this.spoken.push(u);setTimeout(()=>u.onstart?.(),0);}
}
window.__speech = new TestSynth();
Object.defineProperty(window,'speechSynthesis',{value:window.__speech,configurable:true});
Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(t){this.text=t;}},configurable:true});
"""

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

class ReaderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(['node', str(ROOT / 'scripts/content.mjs')], check=True)
        cls.temp = tempfile.TemporaryDirectory(prefix='huey-reader-browser-')
        webroot = Path(cls.temp.name)
        shutil.copy2(ROOT / 'index.html', webroot / 'index.html')
        shutil.copytree(ROOT / 'src', webroot / 'src')
        shutil.copytree(ROOT / 'generated-public/data', webroot / 'data')
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(webroot)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'
        cls.pw = sync_playwright().start()
        executable = os.environ.get('HUEY_READER_BROWSER') or shutil.which('chromium')
        options = {'headless': True}
        if executable:
            options['executable_path'] = executable
        cls.browser = cls.pw.chromium.launch(**options)
        (ROOT / 'test-results').mkdir(exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
        self.context.add_init_script(FAKE_SPEECH)
        self.page = self.context.new_page()
        self.page.set_default_timeout(7000)
        self.errors = []
        self.requests = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('request', lambda request: self.requests.append(request.url))
        self.open_page()
        self.page.locator('.paragraph').first.wait_for()

    def open_page(self, url=None, data=None):
        target = url or self.url
        if not MEMORY:
            if data is not None:
                self.page.route('**/data/book.json', lambda route: route.fulfill(json=data))
            self.page.goto(target)
            return
        # No network navigation: test the unchanged UI with an in-memory data loader.
        # This mode does not test HTTP serving, Vite, or an audible synthesis engine.
        self.page.goto('about:blank')
        html = (ROOT / 'index.html').read_text()
        html = re.sub(r'<link rel="stylesheet"[^>]+>', '', html)
        html = re.sub(r'<script type="module"[^>]+></script>', '', html)
        self.page.set_content(html)
        self.page.add_style_tag(content=(ROOT / 'src/style.css').read_text())
        self.page.add_script_tag(content=FAKE_SPEECH)
        payload = data or json.loads((ROOT / 'generated-public/data/book.json').read_text())
        self.page.evaluate('(data)=>{window.__bookFixture=data;window.fetch=async()=>new Response(JSON.stringify(window.__bookFixture),{status:200});}', payload)
        fragment = urlsplit(target).fragment
        if fragment:
            self.page.evaluate('(hash)=>{location.hash=hash;}', fragment)
        parts = []
        for name in ['text.mjs', 'speech.mjs', 'main.mjs']:
            script = (ROOT / 'src' / name).read_text()
            script = re.sub(r'^import .*?;\n', '', script, flags=re.M)
            script = re.sub(r'^export ', '', script, flags=re.M)
            if name == 'main.mjs':
                expected = "new URL('./data/book.json', document.baseURI)"
                assert script.count(expected) == 1
                script = script.replace(expected, "'./data/book.json'")
            parts.append(script)
        self.page.add_script_tag(content='(function(){\n'+'\n'.join(parts)+'\n})();')

    def reload_page(self):
        self.open_page(self.page.url)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def test_01_actual_text_and_accessible_structure(self):
        self.assertEqual(self.page.locator('.paragraph').count(), 260)
        self.assertEqual(self.page.locator('.chapter').count(), 1)
        self.assertEqual(self.page.locator('.chapter-link').count(), 17)
        self.assertIn('netch asheba', self.page.locator('.prose').nth(3).inner_text())
        self.assertEqual(self.page.locator('.paragraph-number').first.inner_text(), '8A:1')
        self.assertEqual(self.page.locator('.paragraph-number').last.inner_text(), '8A:260')
        self.assertEqual(self.page.get_by_role('main').count(), 1)
        self.assertEqual(self.page.get_by_role('navigation', name='Chapter index').count(), 1)
        self.assertEqual(self.page.evaluate('window.__speech.spoken.length'), 0)
        self.assertTrue(all(url.startswith(self.url) or url.startswith('data:') or url.startswith('about:') for url in self.requests))

    def test_02_margin_opens_collection_not_just_anchor(self):
        number = self.page.locator('.paragraph-number').first
        number.click()
        self.page.get_by_role('dialog').wait_for(state='visible')
        self.assertTrue(self.page.get_by_role('dialog').is_visible())
        self.assertIn('#evidence/C08A/1/', self.page.url)
        self.assertIn('Claim mapping pending', self.page.locator('#dialog-body').inner_text())
        self.assertEqual(self.page.get_by_role('link', name='Pinned manuscript · lines 3–3').count(), 1)
        self.page.keyboard.press('Escape')
        self.page.wait_for_function("!document.querySelector('dialog').open")
        self.assertEqual(self.page.evaluate('document.activeElement.className'), 'paragraph-number')

    def test_03_exact_version_reload_and_browser_back(self):
        number = self.page.locator('.paragraph-number').nth(24)
        number.click()
        url = self.page.url
        self.reload_page()
        self.page.get_by_role('dialog').wait_for()
        self.assertIn('Evidence · 8A:25', self.page.locator('#dialog-title').inner_text())
        self.page.get_by_role('button', name='Close', exact=True).click()
        self.assertIn('#read/C08A/25/', self.page.url)
        self.open_page(url.replace('e28d4b10c74f8ed6ec6e66b5131e0b25ab5479e1', '0'*40))
        self.page.get_by_role('dialog').wait_for()
        self.assertEqual(self.page.locator('#dialog-title').inner_text(), 'Different manuscript version')

    def test_04_current_index_and_hover(self):
        active = self.page.locator('.chapter-link[aria-current]')
        self.assertEqual(active.get_attribute('data-chapter'), 'C08A')
        self.assertEqual(active.locator('.chapter-label').evaluate('(e)=>getComputedStyle(e).opacity'), '1')
        missing = self.page.locator('.chapter-link').first
        self.assertEqual(missing.locator('.chapter-label').evaluate('(e)=>getComputedStyle(e).opacity'), '0')
        missing.hover()
        self.assertEqual(missing.locator('.chapter-label').evaluate('(e)=>getComputedStyle(e).opacity'), '1')
        missing.click()
        self.page.get_by_role('dialog').wait_for(state='visible')
        self.assertIn('not included', self.page.locator('#dialog-body').inner_text())

    def test_05_transport_and_no_numeric_narration(self):
        self.page.locator('.chapter-link[data-chapter="C08A"]').click()
        self.page.get_by_role('button', name='Play', exact=True).click()
        self.assertTrue(self.page.get_by_role('button', name='Pause', exact=True).is_visible())
        text = self.page.evaluate('window.__speech.spoken.at(-1).text')
        self.assertEqual(text, 'For the second time, I had been asked to come and be the white man in the room.')
        self.assertEqual(self.page.locator('[data-speaking="true"]').count(), 1)
        self.page.get_by_role('button', name='Pause', exact=True).click()
        self.page.get_by_role('button', name='Resume', exact=True).click()
        self.page.get_by_role('button', name='Stop', exact=True).click()
        self.assertTrue(self.page.get_by_role('button', name='Play', exact=True).is_visible())
        self.assertEqual(self.page.locator('[data-speaking="true"]').count(), 0)

    def test_06_online_voices_are_opt_in(self):
        self.page.locator('summary').click()
        self.assertEqual(self.page.locator('#voice option').count(), 1)
        self.page.locator('#remote-voices').check()
        self.assertEqual(self.page.locator('#voice option').count(), 2)
        self.reload_page()
        self.page.locator('.paragraph').first.wait_for()
        self.assertFalse(self.page.locator('#remote-voices').is_checked())

    def test_07_small_screens_and_zoom_reflow(self):
        for width, height in [(1024, 800), (768, 1024), (390, 844), (320, 720), (720, 500)]:
            self.page.set_viewport_size({'width':width,'height':height})
            self.page.locator('.chapter-link[data-chapter="C08A"]').click()
            self.page.wait_for_timeout(70)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
            current = self.page.locator('.chapter-link[aria-current] .chapter-label')
            self.assertEqual(current.evaluate('(e)=>getComputedStyle(e).opacity'), '1')
            box = current.bounding_box()
            self.assertGreaterEqual(box['x'], 0)
            self.assertLessEqual(box['x']+box['width'], width)
            self.page.locator('.paragraph-number').first.click()
            self.page.get_by_role('dialog').wait_for(state='visible')
            self.page.keyboard.press('Escape')
            self.page.wait_for_function("!document.querySelector('dialog').open")
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('.chapter-link[data-chapter="C08A"]').click()
        self.page.screenshot(path=str(ROOT / 'test-results/mobile.png'))

    def test_08_desktop_geometry_and_screenshots(self):
        self.page.locator('.chapter-link[data-chapter="C08A"]').click()
        self.page.wait_for_timeout(100)
        column = self.page.locator('.book').bounding_box()
        self.assertAlmostEqual(column['x']+column['width']/2, 720, delta=20)
        anchor = self.page.locator('.paragraph-number').first.bounding_box()
        prose = self.page.locator('.prose').first.bounding_box()
        self.assertLess(anchor['x']+anchor['width'], prose['x'])
        self.page.screenshot(path=str(ROOT / 'test-results/desktop.png'))
        self.page.locator('.paragraph-number').first.click()
        self.page.get_by_role('dialog').wait_for(state='visible')
        self.page.screenshot(path=str(ROOT / 'test-results/evidence.png'))

    def test_09_dialog_keyboard_and_read_from_here(self):
        self.page.locator('.paragraph-number').nth(100).click()
        self.page.get_by_role('dialog').wait_for(state='visible')
        for _ in range(12):
            self.page.keyboard.press('Tab')
            self.assertTrue(self.page.evaluate("document.querySelector('dialog').contains(document.activeElement)"))
        self.page.get_by_role('button', name='Read from here').click()
        self.assertFalse(self.page.get_by_role('dialog').is_visible())
        self.assertIn('#read/C08A/101/', self.page.url)
        self.assertEqual(self.page.locator('#current-location').inner_text(), '8A:101')
        self.assertTrue(self.page.get_by_role('button', name='Pause', exact=True).is_visible())

    def test_10_multiple_chapters_scrollspy(self):
        data = json.loads((ROOT / 'generated-public/data/book.json').read_text())
        prototype = next(c for c in data['chapters'] if c['status']=='admitted')
        data['chapters'] = []
        for n in range(1, 4):
            c = copy.deepcopy(prototype)
            c.update(id=f'C{n:02}', label=str(n), title=f'Synthetic layout fixture {n}', paragraphCount=20)
            c['blocks'] = []
            for p in range(1,21):
                c['blocks'].append({'type':'paragraph','id':f'C{n:02}-p{p:04}','chapterId':f'C{n:02}', 'number':p,'label':f'{n}:{p}',
                  'text':'Synthetic paragraph for interface tests only. '*5,
                  'tokens':[{'type':'text','text':'Synthetic paragraph for interface tests only. '*5}],
                  'evidence':{'coverage':'pending','claims':[],'referenceIds':[]}})
            data['chapters'].append(c)
        self.open_page(data=data)
        self.page.locator('.chapter').nth(2).wait_for()
        self.assertEqual(self.page.locator('.paragraph').count(),60)
        self.page.locator('.chapter-link[data-chapter="C03"]').click()
        self.page.wait_for_function("document.querySelector('.chapter-link[aria-current]').dataset.chapter==='C03'")
        self.page.locator('#C02-p0010').scroll_into_view_if_needed()
        self.page.wait_for_function("document.querySelector('.chapter-link[aria-current]').dataset.chapter==='C02'")

if __name__ == '__main__':
    unittest.main(verbosity=2)
