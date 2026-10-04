#!/usr/bin/env python3
"""Build pipeline: images -> optimized, src -> public/, standalone single-file build, ref check."""
import base64, json, re, shutil, sys, pathlib
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC, PUB, STA = ROOT / "src", ROOT / "public", ROOT / "standalone"
CACHE = ROOT / ".build/img"   # optimized copies live here; src/ is never rewritten (no generational JPEG loss)
IMGOPT = dict(quality=78, optimize=True, progressive=True, subsampling=2)

def optimize_images():
    """Non-destructive: src/assets/img -> .build/img (re-encoded only when newer than the cache)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    report = {}
    for f in sorted((SRC / "assets/img").glob("*.jpg")):
        out = CACHE / f.name
        if out.exists() and out.stat().st_mtime >= f.stat().st_mtime:
            im = Image.open(out)
            report[f.name] = (im.size, out.stat().st_size, "cached")
            continue
        im = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
        if f.name == "portrait.jpg":                       # 4:5 portrait
            im = im.resize((1100, 1375), Image.LANCZOS)
        else:
            w, h = im.size
            if max(w, h) > 1280:
                r = 1280 / max(w, h)
                im = im.resize((int(w * r), int(h * r)), Image.LANCZOS)
        im.save(out, "JPEG", **IMGOPT)
        report[f.name] = (im.size, out.stat().st_size, "encoded")
    return report


def b64(p: pathlib.Path):
    return "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode()

def build_public():
    if PUB.exists():
        shutil.rmtree(PUB)
    PUB.mkdir(parents=True)
    shutil.copytree(CACHE, PUB / "assets/img")
    shutil.copy2(SRC / "index.html", PUB / "index.html")
    for d in ("css", "js"):
        shutil.copytree(SRC / d, PUB / d)
    for extra in ("robots.txt", "site.webmanifest", "favicon.svg"):
        if (SRC / extra).exists():
            shutil.copy2(SRC / extra, PUB / extra)
    (PUB / "assets/fonts").mkdir(parents=True, exist_ok=True)
    for f in (SRC / "assets/fonts").glob("*.woff2"):
        shutil.copy2(f, PUB / "assets/fonts" / f.name)

def build_standalone():
    if STA.exists():
        shutil.rmtree(STA)
    STA.mkdir(parents=True)
    build_public()
    html = (SRC / "index.html").read_text(encoding="utf-8")

    css = (SRC / "css/styles.css").read_text(encoding="utf-8")
    # inline fonts as data URIs
    def font_repl(m):
        name = m.group(1)
        p = SRC / "assets/fonts" / name
        return f'url("data:font/woff2;base64,{base64.b64encode(p.read_bytes()).decode()}") format("woff2")'
    css = re.sub(r'url\("\.\./assets/fonts/([^"]+)"\)\s*format\("woff2"\)', font_repl, css)
    html = html.replace('<link rel="stylesheet" href="./css/styles.css">', "<style>\n" + css + "\n</style>")

    js = (SRC / "js/main.js").read_text(encoding="utf-8")
    js = js.replace("</script", "<\\/script")
    html = html.replace('<script src="./js/main.js" defer></script>', "<script>\n" + js + "\n</script>")

    def img_to_data(m):
        rel = m.group(2)
        p = SRC / rel[2:]
        if not p.exists():
            return m.group(0)
        return f'{m.group(1)}"{b64(p)}"'
    html = re.sub(r'(<img[^>]*?\s)src="(\./assets/img/[^"]+)"', img_to_data, html)

    # drop canonical (points to the hosted copy) and keep everything else
    (STA / "resume-standalone.html").write_text(html, encoding="utf-8")
    return (STA / "resume-standalone.html").stat().st_size

def check_refs():
    bad = []
    html = (PUB / "index.html").read_text(encoding="utf-8")
    for m in re.finditer(r'(?:src|href)="(\./[^"]+)"', html):
        u = m.group(1)
        if not (PUB / u[2:]).exists():
            bad.append("index.html -> " + u)
    css = (PUB / "css/styles.css").read_text(encoding="utf-8")
    for m in re.finditer(r'url\("\.\./([^"]+)"\)', css):
        if not (PUB / "css" / ".." / m.group(1)).resolve().exists():
            bad.append("styles.css -> " + m.group(1))
    js = (PUB / "js/main.js").read_text(encoding="utf-8")
    # every #id referenced by JS selectors must exist in the HTML
    for m in re.finditer(r'\$\("#([A-Za-z][\w-]*)"', js):
        if f'id="{m.group(1)}"' not in html:
            bad.append("main.js -> #" + m.group(1))
    for m in re.finditer(r'href="#(i-[\w-]+)"', html):
        if f'id="{m.group(1)}"' not in html:
            bad.append("missing symbol -> #" + m.group(1))
    return bad

def sync_root():
    """GitHub Pages serves the repository root on `main`, so mirror public/ there."""
    for d in ("css", "js", "assets"):
        tgt = ROOT / d
        if tgt.exists():
            shutil.rmtree(tgt)
        shutil.copytree(PUB / d, tgt)
    for f in ("index.html", "robots.txt", "site.webmanifest", "favicon.svg"):
        if (PUB / f).exists():
            shutil.copy2(PUB / f, ROOT / f)


if __name__ == "__main__":
    rep = optimize_images()
    build_public()
    sync_root()
    size = build_standalone()
    bad = check_refs()
    total = sum(v[1] for v in rep.values())
    print(json.dumps({
        "images": {k: {"size": f"{v[0][0]}x{v[0][1]}", "bytes": v[1]} for k, v in rep.items()},
        "images_total_kb": round(total / 1024),
        "image_status": {k: v[2] for k, v in rep.items()},
        "standalone_kb": round(size / 1024),
        "broken_refs": bad
    }, ensure_ascii=False, indent=1))
    if bad:
        sys.exit(1)
