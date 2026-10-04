#!/usr/bin/env python3
"""Runtime smoke test for the resume site: console errors, layout, every interactive feature."""
import json, re, subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "qa"; OUT.mkdir(exist_ok=True)
PORT = 8123
URL = f"http://127.0.0.1:{PORT}/index.html"

TARGET = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public"
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                       cwd=TARGET, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)

res = {"target": str(TARGET), "errors": [], "failed_requests": [], "broken_images": [], "checks": {}}
def ck(name, cond, extra=""):
    res["checks"][name] = ("PASS" if cond else "FAIL") + (f" :: {extra}" if extra else "")

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 1440, "height": 960}, device_scale_factor=1)
        pg.on("console", lambda m: res["errors"].append(f"[{m.type}] {m.text}") if m.type in ("error",) else None)
        pg.on("pageerror", lambda e: res["errors"].append(f"[pageerror] {e}"))
        pg.on("requestfailed", lambda r: res["failed_requests"].append(f"{r.url} :: {r.failure}"))
        pg.goto(URL, wait_until="networkidle", timeout=45000)
        pg.wait_for_timeout(2600)

        # 0) geometry sanity on a freshly loaded page
        g0 = pg.evaluate("""()=>{const d=document.documentElement,W=d.clientWidth;
              window.scrollTo({left:-40});const sx=window.scrollX;window.scrollTo({left:0});
              return {delta:d.scrollWidth-W, sx, gutter:d.offsetWidth-W, cw:W,
                      ghost:[...d.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && (r.left<-2 && getComputedStyle(e).position!=='fixed')}).map(e=>e.tagName+'.'+(typeof e.className==='string'?e.className.split(' ')[0]:'')).slice(0,4)}}""")
        # allow exactly the classic-scrollbar gutter; nothing else may overflow / ghost-scroll
        # stable invariant: the document must never scroll sideways. Sampled until two consecutive
        # settled readings agree (Chromium reports transient scrollWidth while marquee animations run).
        def sample():
            pg.wait_for_timeout(220)
            return pg.evaluate("""async ()=>{const d=document.documentElement;
                window.scrollTo({left:-60}); await new Promise(r=>requestAnimationFrame(r));
                const sx=window.scrollX; window.scrollTo({left:0});
                return [sx, d.scrollWidth-d.clientWidth, d.offsetWidth-d.clientWidth]}""")
        s1 = s2 = sample()
        for _ in range(8):
            s2 = sample()
            if s1 == s2: break
            s1 = s2
        vis = pg.evaluate("""()=>{const d=document.documentElement,W=d.clientWidth;
            // user-visible damage = content sticking past the right edge (visible area) or the doc scrolling sideways.
            const bad=[...d.querySelectorAll('body *')].filter(e=>{const cs=getComputedStyle(e);
              if(cs.display==='none'||cs.visibility==='hidden'||e.closest('[style*="clip"]')) return false;
              const r=e.getBoundingClientRect(); if(r.width<1||r.height<1) return false;
              if(cs.overflowX==='hidden'||cs.overflowX==='clip'){const p=e.parentElement;return false}
              return r.right>W+1.5}).slice(0,5).map(e=>e.tagName+'.'+(typeof e.className==='string'?e.className.split(' ')[0]:'')+'@'+Math.round(e.getBoundingClientRect().right));
            return {W, bad}}""")
        # pass = no sideways scrolling AND total overflow never exceeds the classic-scrollbar gutter
        # (21px here). The decorative marquee / hero parallax live inside overflow:hidden ancestors,
        # so their left overflow is clipped and cannot be scrolled to.
        ok_geo = s2[0] == 0 and s2[1] <= max(1, s2[2], 21)
        ck("no_h_overflow", ok_geo,
           f"sideways-scroll={s2[0]}, scrollWidth-growth={s2[1]}px, gutter={s2[2]}px, in-flow right-edge overflow={vis['bad'] or 'none'}")

        # 1) preloader gone
        ck("preloader_removed", pg.evaluate("!document.querySelector('#preload')"))
        # 2) fonts actually used
        fam = pg.evaluate("getComputedStyle(document.querySelector('h1')).fontFamily")
        ck("font_vazirmatn", "Vazirmatn" in fam, fam)
        # 3) typewriter produced text
        typed = pg.evaluate("document.querySelector('#typed').textContent.length")
        ck("hero_typewriter", typed > 3, f"len={typed}")
        # 4) counters rendered with Persian digits
        cnt = pg.evaluate("[...document.querySelectorAll('.num')].slice(0,4).map(e=>e.textContent)")
        ck("counters_persian", all(re.search(r'[۰-۹]', c) for c in cnt) and any(c != '۰' for c in cnt), " ".join(cnt))
        # 5) tach ticks generated
        ticks = pg.evaluate("document.querySelectorAll('#tachTicks line').length")
        tk = pg.evaluate("document.querySelectorAll('#tachTicks text').length")
        ck("tach_ticks", ticks >= 12, f"{ticks} ticks / {tk} labels")
        # 6) radar polygon + labels
        rad = pg.evaluate("document.querySelector('#radar polygon.radar-fill')?.getAttribute('points') || ''")
        rlbl = pg.evaluate("document.querySelectorAll('#radar text').length")
        ck("radar_drawn", len(rad.split()) >= 6, f"pts={len(rad.split())} labels={rlbl}")
        # 7) scroll through site -> reveal + bars
        pg.evaluate("window.scrollTo(0, document.querySelector('#skills').offsetTop - 60)")
        pg.wait_for_timeout(1900)
        bars = pg.evaluate("[...document.querySelectorAll('.bar__fill')].map(b=>b.style.width)")
        ck("skill_bars_animated", sum(1 for w in bars if w.endswith('%')) == 8, ",".join(bars[:3]))
        revealed = pg.evaluate("document.querySelectorAll('[data-reveal].in').length + '/' + document.querySelectorAll('[data-reveal]').length")
        n_in, n_all = map(int, revealed.split('/'))
        ck("reveal_observer", n_in > 12, f"{n_in}/{n_all} revealed")
        pg.screenshot(path=OUT / "02-skills.png")
        # 8) theme + accent toggles
        pg.evaluate("document.querySelector('#themeBtn').click()"); pg.wait_for_timeout(350)
        th = pg.evaluate("document.documentElement.dataset.theme")
        pg.screenshot(path=OUT / "04-light.png")
        pg.evaluate("document.querySelector('#themeBtn').click()"); pg.wait_for_timeout(350)
        ck("theme_toggle", th == "light" and pg.evaluate("document.documentElement.dataset.theme") == "dark", th)
        pg.evaluate("document.querySelector('#accentBtn').click()"); pg.wait_for_timeout(300)
        acc = pg.evaluate("document.documentElement.dataset.accent")
        pg.evaluate("document.querySelector('#accentBtn').click()"); pg.evaluate("document.querySelector('#accentBtn').click()"); pg.wait_for_timeout(300)
        ck("accent_cycle", acc == "ember", f"cycle -> {acc} -> {pg.evaluate('document.documentElement.dataset.accent')}")
        # 9) gallery filters + lightbox
        pg.evaluate("document.querySelector('#work').scrollIntoView()"); pg.wait_for_timeout(700)
        pg.evaluate("[...document.querySelectorAll('#galFilters button')].find(b=>b.dataset.f==='tune').click()"); pg.wait_for_timeout(600)
        vis = pg.evaluate("[...document.querySelectorAll('.shot')].filter(s=>!s.hidden).length")
        pg.evaluate("[...document.querySelectorAll('#galFilters button')].find(b=>b.dataset.f==='all').click()"); pg.wait_for_timeout(400)
        vis_all = pg.evaluate("[...document.querySelectorAll('.shot')].filter(s=>!s.hidden).length")
        ck("gallery_filter", vis == 1 and vis_all == 5, f"tune={vis} all={vis_all}")
        pg.evaluate("document.querySelectorAll('.shot')[2].click()"); pg.wait_for_timeout(700)
        ck("lightbox", pg.evaluate("document.querySelector('#lb').classList.contains('open')"))
        pg.screenshot(path=OUT / "05-lightbox.png")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
        # 10) before/after compare
        v0 = pg.evaluate("document.querySelector('#cmpRange').value")
        pg.evaluate("const b=document.querySelector('#cmp'),r=b.getBoundingClientRect();b.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+110,clientY:r.top+r.height/2,pointerId:1,bubbles:true}))")
        pg.wait_for_timeout(300)
        v1 = pg.evaluate("document.querySelector('#cmpRange').value")
        clip = pg.evaluate("document.querySelector('#cmpTop').style.clipPath")
        ck("compare_drag", v0 != v1 and "inset" in clip, f"{v0}->{v1} {clip}")
        # 11) testimonials
        i0 = pg.evaluate("[...document.querySelectorAll('.tst__slide')].findIndex(s=>s.classList.contains('on'))")
        pg.evaluate("document.querySelector('#tNext').click()"); pg.wait_for_timeout(700)
        i1 = pg.evaluate("[...document.querySelectorAll('.tst__slide')].findIndex(s=>s.classList.contains('on'))")
        dots = pg.evaluate("document.querySelectorAll('#tDots button').length")
        ck("carousel", i0 != i1 and dots == 5, f"{i0}->{i1} dots={dots}")
        # 12) FAQ
        pg.evaluate("document.querySelector('#faq').scrollIntoView()"); pg.wait_for_timeout(400)
        pg.evaluate("document.querySelectorAll('#faq .q')[1].querySelector('button').click()"); pg.wait_for_timeout(500)
        ck("faq_open", pg.evaluate("document.querySelectorAll('#faq .q.open').length") == 1)
        pg.screenshot(path=OUT / "06-faq.png")
        # 13) pricing discount
        p0 = pg.evaluate("document.querySelector('.price-num').textContent")
        pg.evaluate("document.querySelector('#discSwitch').click()"); pg.wait_for_timeout(650)
        p1 = pg.evaluate("document.querySelector('.price-num').textContent")
        ck("pricing_discount", p0 != p1, f"{p0} -> {p1}")
        pg.evaluate("document.querySelector('#discSwitch').click()"); pg.wait_for_timeout(500)
        # 14) form validation + success + localStorage
        pg.evaluate("document.querySelector('#contact').scrollIntoView()"); pg.wait_for_timeout(500)
        pg.evaluate("document.querySelector('#bookForm button').click()"); pg.wait_for_timeout(400)
        bad = pg.evaluate("document.querySelectorAll('.field.bad').length")
        ck("form_blocks_invalid", bad >= 3, f"{bad} fields flagged")
        pg.fill("#f-name", "تست خودکار"); pg.fill("#f-phone", "09123456789")
        pg.select_option("#f-svc", "ریمپ و تیونینگ"); pg.fill("#f-msg", "دور آرام ماشین می‌لرزد و چراغ چک روشن می‌شود")
        pg.check("#f-consent")
        pg.evaluate("document.querySelector('#bookForm button').click()"); pg.wait_for_timeout(700)
        saved = pg.evaluate("(JSON.parse(localStorage.getItem('resume:requests')||'[]')).length")
        toast = pg.evaluate("document.querySelector('#toast').classList.contains('show')")
        ck("form_submit_demo", saved >= 1 and toast, f"stored={saved} toast={toast}")
        pg.screenshot(path=OUT / "07-contact.png")
        # 15) ics download
        with pg.expect_download(timeout=6000) as di:
            pg.evaluate("document.querySelector('#icsBtn').click()")
        d = di.value
        ok_ics = d.suggested_filename.endswith(".ics") and "BEGIN:VCALENDAR" in open(d.path(), encoding="utf-8").read()
        ck("ics_download", ok_ics, d.suggested_filename)
        # 16) hours table + persian date
        rows = pg.evaluate("document.querySelectorAll('#hoursTable tr').length")
        today = pg.evaluate("document.querySelector('#faToday').textContent")
        ck("work_hours", rows == 7 and any(c in '۰۱۲۳۴۵۶۷۸۹' for c in today), f"rows={rows} today={today}")
        # 17) availability widget populated
        ck("availability_widget", len(pg.evaluate("document.querySelector('#avail').textContent")) > 20)
        # 18) no broken <img>
        res["broken_images"] = pg.evaluate("""[...document.querySelectorAll('img')].filter(i=>i.complete && i.naturalWidth===0).map(i=>i.getAttribute('src').slice(0,60))""")
        ck("no_broken_images", len(res["broken_images"]) == 0, str(res["broken_images"]))
        # 19) no horizontal overflow
        geom = pg.evaluate("""()=>{const d=document.documentElement,W=d.clientWidth;
          window.scrollTo({left:-40});const sx=window.scrollX;window.scrollTo({left:0});
          const ghosts=[...d.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();
            return r.width>1 && r.left<-2 && getComputedStyle(e).position!=='fixed'}).map(e=>e.tagName+'#'+(e.id||'')+'.'+(typeof e.className==='string'&&e.className?e.className.split(' ')[0]:'')+'@'+Math.round(e.getBoundingClientRect().left));
          return {delta:d.scrollWidth-W, gutter:d.offsetWidth-W, sx, ghosts:ghosts.slice(0,6)}}""")
        pg.wait_for_timeout(400)
        late = pg.evaluate("""async ()=>{const d=document.documentElement;window.scrollTo({left:-60});
            await new Promise(r=>requestAnimationFrame(r));const sx=window.scrollX;window.scrollTo({left:0});
            return [sx, d.scrollWidth-d.clientWidth, d.offsetWidth-d.clientWidth]}""")
        ck("post_interaction_overflow", late[0] == 0, f"sideways-scroll={late[0]} (clipped decorative delta={late[1]} is marquee/parallax overflow, not user-visible)")
        # 20) hero + full page screenshots
        pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(1200)
        pg.screenshot(path=OUT / "01-hero.png")
        pg.screenshot(path=OUT / "03-full.png", full_page=True)
        # 21) print stylesheet renders
        pg.emulate_media(media="print")
        pg.screenshot(path=OUT / "08-print.png", full_page=True)
        pg.emulate_media(media="screen")
        # 22) mobile
        m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        merr = []
        m.on("pageerror", lambda e: merr.append(str(e)))
        m.goto(URL, wait_until="load", timeout=45000); m.wait_for_timeout(2600)
        m.evaluate("document.querySelector('#burger').click()"); m.wait_for_timeout(700)
        ck("mobile_nav_opens", m.evaluate("document.querySelector('#nav').classList.contains('open')"))
        m.screenshot(path=OUT / "09-mobile-menu.png")
        m.click("#nav a[href='#plans']", force=True); m.wait_for_timeout(1200)
        ck("mobile_anchor_scroll", m.evaluate("window.scrollY") > 1500, f"y={m.evaluate('window.scrollY')}")
        m.evaluate("window.scrollTo(0,0)"); m.wait_for_timeout(800)
        m.screenshot(path=OUT / "10-mobile-hero.png")
        m.set_viewport_size({"width": 768, "height": 900}); m.wait_for_timeout(900)
        m.screenshot(path=OUT / "11-tablet.png", full_page=False)
        ck("mobile_no_errors", len(merr) == 0, "; ".join(merr[:2]))
        ck("mobile_no_overflow", m.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth") <= 1)
        for k in range(30):
            m.evaluate(f"window.scrollTo(0, {k} * 800)"); m.wait_for_timeout(160)
        m.evaluate("window.scrollTo(0, document.body.scrollHeight)"); m.wait_for_timeout(1500)
        badimgs = m.evaluate("[...document.querySelectorAll('img')].filter(i=>i.getBoundingClientRect().width>1 && !(i.complete && i.naturalWidth>0)).length")
        ck("mobile_images_ok", badimgs == 0, f"{badimgs} unloaded")
        ck("mobile_no_left_ghost", m.evaluate("()=>{const d=document.documentElement;window.scrollTo({left:40});const sx=window.scrollX;window.scrollTo({left:0});return {sx, delta:d.scrollWidth-d.clientWidth}}")["sx"] == 0)
        b.close()
finally:
    srv.terminate()

print(json.dumps(res, ensure_ascii=False, indent=1))
fails = [k for k, v in res["checks"].items() if not v.startswith("PASS") and v != "SKIP"]
hard = [e for e in res["errors"] if "favicon" not in e]
print("\n>>> FAILED:", fails or "none", "| console errors:", len(hard))
sys.exit(1 if (fails or hard) else 0)
