import subprocess, sys, time
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable,"-m","http.server","8125","--bind","127.0.0.1"],cwd="public",stdout=-3,stderr=-3)
time.sleep(1.1)
JS = """
(sel) => {
  const d = document.documentElement, W = d.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll(sel || '*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > W + 0.5 || r.left < -0.5) {
      let clip = false, a = el.parentElement;
      while (a) { const ov = getComputedStyle(a).overflowX; if (ov === 'hidden' || ov === 'clip' || ov === 'auto' || ov === 'scroll') { clip = true; break; } a = a.parentElement; }
      bad.push({cls:el.getAttribute('class'),tag: el.tagName + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+el.className.trim().split(/\\s+/).slice(0,2).join('.') : ''),
                left: +r.left.toFixed(1), right: +r.right.toFixed(1), W, clipped: clip});
    }
  }
  return {sw: d.scrollWidth, cw: W, bad: bad.filter(x=>!x.clipped).slice(0,14)};
}
"""
imgs = """() => [...document.querySelectorAll('img')].map(i=>({src:(i.currentSrc||i.src).slice(-26), complete:i.complete, nw:i.naturalWidth, w:Math.round(i.getBoundingClientRect().width), loading:i.loading}))"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--no-sandbox"])
    for vw,vh,label in [(1440,960,'DESKTOP')]:
        pg=b.new_page(viewport={'width':vw,'height':vh})
        pg.goto('http://127.0.0.1:8125/index.html', wait_until='load'); pg.wait_for_timeout(3000)
        r=pg.evaluate(JS)
        print(f"\n=== {label} === scrollWidth {r['sw']} vs clientWidth {r['cw']}")
        for x in r['bad']: print('  ', x)
        if vw==390:
            for i in pg.evaluate(imgs): print('   img:', i)
        pg.close()
    b.close()
srv.terminate()
