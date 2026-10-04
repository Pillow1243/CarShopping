/* ==========================================================================
   امیر رستگاری — رزومه | main.js
   Vanilla JS · بدون وابستگی · RTL-aware
   ========================================================================== */
(() => {
'use strict';

/* ---------- helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
const toFa = v => String(v).replace(/\d/g, d => FA_DIGITS[+d]);
const faNum = n => toFa(Math.round(n).toLocaleString('en-US').replace(/,/g, '٬'));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const lerp  = (a, b, t) => a + (b - a) * t;
const STORE = {
  get(k, d) { try { const v = localStorage.getItem('resume:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('resume:' + k, JSON.stringify(v)); } catch {} }
};
const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const html = document.documentElement;
const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
let MOTION = STORE.get('motion', true) && !reducedMQ.matches;
const setMotion = () => html.classList.toggle('no-motion', !MOTION);
setMotion();

/* ==========================================================================
   1) Preloader
   ========================================================================== */
(() => {
  const el = $('#preload'), pct = $('#preloadPct');
  if (!el) return;
  let p = 0;
  const tick = setInterval(() => { p = Math.min(96, p + Math.random() * 17); if (pct) pct.textContent = toFa(Math.round(p)); }, 110);
  const finish = () => {
    clearInterval(tick); if (pct) pct.textContent = toFa(100);
    el.classList.add('done');
    setTimeout(() => el.remove(), 800);
    document.body.dispatchEvent(new CustomEvent('site:ready'));
  };
  const fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(r => setTimeout(r, 1600))]).then(() => setTimeout(finish, MOTION ? 320 : 0));
})();

/* ==========================================================================
   2) Theme + accent
   ========================================================================== */
(() => {
  const btn = $('#themeBtn');
  const apply = t => {
    html.dataset.theme = t;
    if (btn) { const a = btn.querySelector(':scope > .t-dark'), b2 = btn.querySelector(':scope > .t-light');
               if (a) a.style.display = t === 'dark' ? '' : 'none';
               if (b2) b2.style.display = t === 'dark' ? 'none' : ''; }
    const mt = $('meta[name="theme-color"]'); if (mt) mt.content = t === 'dark' ? '#08090b' : '#f3f1ec';
  };
  apply(STORE.get('theme', 'dark'));
  btn && btn.addEventListener('click', () => { const t = html.dataset.theme === 'dark' ? 'light' : 'dark'; STORE.set('theme', t); apply(t); SFX.ping(); });

  const ACCENTS = ['gold', 'ember', 'ice'];
  const accBtn = $('#accentBtn');
  const setAcc = a => { html.dataset.accent = a; STORE.set('accent', a); if (accBtn) accBtn.animate([{transform:'rotate(0)'},{transform:'rotate(120deg)'}], {duration:520, easing:'cubic-bezier(.22,1,.36,1)'}); };
  setAcc(ACCENTS.includes(STORE.get('accent', 'gold')) ? STORE.get('accent', 'gold') : 'gold');
  accBtn && accBtn.addEventListener('click', () => setAcc(ACCENTS[(ACCENTS.indexOf(html.dataset.accent) + 1) % ACCENTS.length]));
})();

/* ==========================================================================
   3) Header: stuck / autohide / progress / smooth anchors / burger
   ========================================================================== */
let scrollP = 0;
(() => {
  const hdr = $('#hdr'), bar = $('#progressBar');
  let last = window.scrollY, ticking = false;
  const upd = () => {
    const y = window.scrollY;
    const h = document.documentElement.scrollHeight - innerHeight;
    scrollP = h > 0 ? clamp(y / h, 0, 1) : 0;
    if (bar) bar.style.transform = `scaleX(${scrollP})`;
    hdr.classList.toggle('stuck', y > 8);
    if (y > 340 && y > last + 4) hdr.classList.add('hide');
    else if (y < last - 4 || y < 200) hdr.classList.remove('hide');
    last = y; ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, {passive: true});
  upd();

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (!id || id === '#') return;
    const t = $(id); if (!t) return;
    e.preventDefault();
    closeNav();
    t.scrollIntoView({behavior: MOTION ? 'smooth' : 'auto', block: 'start'});
    history.replaceState(null, '', id);
  }));

  const burger = $('#burger'), nav = $('#nav');
  window.closeNav = () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('is-locked'); };
  burger && burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
})();

/* ==========================================================================
   4) Scrollspy (nav + rail)
   ========================================================================== */
(() => {
  const links = $$('#nav a, #rail a');
  const map = new Map();
  links.forEach(a => { const s = $(a.getAttribute('href')); if (s) (map.get(s) || map.set(s, []).get(s)).push(a); });
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      const ls = map.get(e.target); if (!ls) return;
      if (e.isIntersecting) { links.forEach(l => l.removeAttribute('aria-current')); ls.forEach(l => l.setAttribute('aria-current', 'true')); }
    });
  }, {rootMargin: '-45% 0px -50% 0px', threshold: 0});
  map.forEach((_, s) => io.observe(s));
})();

/* ==========================================================================
   5) Reveal on scroll (with stagger)
   ========================================================================== */
(() => {
  const els = $$('[data-reveal]');
  if (!els.length) return;
  $$('.svc, .gal, .tools, .cert, .about__facts, .techs, .price, .tl, .bars, .tags').forEach(g => {
    Array.from(g.children).forEach((c, i) => c.style.setProperty('--d', `${Math.min(i, 8) * 70}ms`));
  });
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), {rootMargin: '0px 0px -12% 0px', threshold: .12});
  els.forEach(el => (el.getBoundingClientRect().top < innerHeight * .92 && scrollY < 40) ? el.classList.add('in') : io.observe(el));
})();

/* ==========================================================================
   6) Counters (Persian digits)
   ========================================================================== */
const animateCount = (el) => {
  const target = parseFloat(el.dataset.count), div = parseFloat(el.dataset.div || 1);
  const suf = el.dataset.suffix || ''; const dur = 1500 + Math.min(900, target / 4);
  const t0 = performance.now();
  const out = v => el.textContent = (div > 1 ? toFa((v / div).toFixed(1)) : faNum(v)) + suf;
  if (!MOTION) return out(target);
  const step = now => { const p = clamp((now - t0) / dur, 0, 1); out(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
};
(() => {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { animateCount(e.target); io.unobserve(e.target); } }), {threshold: .5});
  $$('.num[data-count]').forEach(el => io.observe(el));
})();

/* ==========================================================================
   7) Skill bars
   ========================================================================== */
(() => {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    $$('.bar__fill', e.target).forEach((f, i) => setTimeout(() => f.style.width = f.dataset.pct + '%', i * 110));
    io.unobserve(e.target);
  }), {threshold: .3});
  const b = $('#bars'); if (b) io.observe(b);
})();

/* ==========================================================================
   8) Hero typewriter
   ========================================================================== */
(() => {
  const el = $('#typed'); if (!el) return;
  const roles = ['استادکار ارشد موتور','متخصص عیب‌یابی و دیاگ','تیونر ECU و دینو','کارشناس گیربکس اتوماتیک','مربی فنی سازمان آموزش'];
  let i = 0, j = 0, del = false;
  if (!MOTION) { el.textContent = roles[0]; return; }
  const tick = () => {
    const w = roles[i];
    el.textContent = w.slice(0, j);
    if (!del) { if (++j > w.length) { del = true; return setTimeout(tick, 1650); } setTimeout(tick, 62 + Math.random() * 46); }
    else { if (--j <= 0) { del = false; i = (i + 1) % roles.length; } setTimeout(tick, 26); }
  };
  setTimeout(tick, 900);
})();

/* ==========================================================================
   9) Tachometer: ticks + needle (also = scroll progress)
   ========================================================================== */
(() => {
  const g = $('#tachTicks'), arc = $('#tachArc'), arcBg = $('#tachArcBg'), svg = $('#tach'), needle = $('#tachNeedle');
  if (!svg) return {set(){}};
  const R = 96, A0 = -120, A1 = 120;                       // 240° sweep
  const pt = (a, r) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)];
  const path = (r0, r1, a0, a1, seg = 1) => {              // arc path helper
    const [x0, y0] = pt(a0, r1), [x1, y1] = pt(a1, r1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r1} ${r1} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  arc.setAttribute('d', path(R, R, A0, A1));
  arcBg.setAttribute('d', path(R, R, A0, A1));
  const L = arc.getTotalLength ? arc.getTotalLength() : 400;
  arc.style.strokeDasharray = L; arc.style.strokeDashoffset = L;
  arc.style.transition = 'stroke-dashoffset 1.9s cubic-bezier(.22,1,.36,1)';

  const ticks = [];
  for (let k = 0; k <= 12; k++) {
    const a = A0 + (A1 - A0) * (k / 12), major = k % 2 === 0;
    const [x1, y1] = pt(a, R - 10), [x2, y2] = pt(a, R - (major ? 24 : 16));
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', x1.toFixed(2)); ln.setAttribute('y1', y1.toFixed(2));
    ln.setAttribute('x2', x2.toFixed(2)); ln.setAttribute('y2', y2.toFixed(2));
    ln.setAttribute('stroke', major ? 'var(--ink-2)' : 'var(--line-2)'); ln.setAttribute('stroke-width', major ? 2 : 1);
    g.appendChild(ln);
    if (major) {
      const [tx, ty] = pt(a, R - 40);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', tx.toFixed(2)); t.setAttribute('y', (ty + 4).toFixed(2));
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '11');
      t.setAttribute('font-family', 'var(--ff-mono)'); t.setAttribute('fill', 'var(--ink-3)');
      t.textContent = k; g.appendChild(t);
    }
  }
  const set = p => {
    const a = A0 + (A1 - A0) * clamp(p, 0, 1);
    needle.style.transform = `rotate(${a}deg)`;
    needle.style.transformOrigin = '0px 0px';
    arc.style.strokeDashoffset = L * (1 - clamp(p, 0, 1));
  };
  let armed = false;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !armed) { armed = true; setTimeout(() => set(.98), 220); } }), {threshold: .4});
  io.observe(svg);
  // scroll progress drives the needle once the hero leaves the viewport
  const onScroll = () => { if (scrollY > innerHeight * .6) set(clamp(scrollP, 0, 1)); };
  addEventListener('scroll', onScroll, {passive: true});
  return {set};
})();

/* ==========================================================================
   10) Skill radar
   ========================================================================== */
(() => {
  const svg = $('#radar'); if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const cx = 200, cy = 168, R = 118;
  const data = [['عمق فنی', .98], ['سرعت عمل', .9], ['دقت و جزئیات', .96], ['مستندسازی', .88], ['آموزش نیرو', .84], ['مدیریت بحران', .92]];
  const N = data.length;
  const ang = i => (-Math.PI / 2) + i * 2 * Math.PI / N;
  const P = (i, r) => [cx + Math.cos(ang(i)) * R * r, cy + Math.sin(ang(i)) * R * r];
  const el = (t, a) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };

  for (let ring = 1; ring <= 4; ring++) {
    const pts = data.map((_, i) => P(i, ring / 4).map(v => v.toFixed(1)).join(',')).join(' ');
    svg.appendChild(el('polygon', {points: pts, class: 'radar-web', 'stroke-width': ring === 4 ? 1.4 : .8, opacity: ring === 4 ? .9 : .45}));
  }
  data.forEach((d, i) => {
    const [x, y] = P(i, 1);
    svg.appendChild(el('line', {x1: cx, y1: cy, x2: x.toFixed(1), y2: y.toFixed(1), class: 'radar-web', opacity: .4}));
    const [lx, ly] = P(i, 1.24);
    const t = el('text', {x: lx.toFixed(1), y: (ly + 4).toFixed(1), 'text-anchor': 'middle', class: 'radar-lbl'});
    t.textContent = d[0]; svg.appendChild(t);
  });
  const poly = el('polygon', {class: 'radar-fill', points: data.map(() => `${cx},${cy}`).join(' ')});
  svg.appendChild(poly);
  const dots = data.map(() => { const c = el('circle', {class: 'radar-pt', r: 3.6, cx, cy}); svg.appendChild(c); return c; });
  let done = false;
  const play = () => {
    if (done) return; done = true;
    const t0 = performance.now(), dur = MOTION ? 1400 : 1;
    const step = now => {
      const p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
      const pts = data.map((d, i) => P(i, d[1] * e));
      poly.setAttribute('points', pts.map(q => q.map(v => v.toFixed(1)).join(',')).join(' '));
      pts.forEach((q, i) => { dots[i].setAttribute('cx', q[0].toFixed(1)); dots[i].setAttribute('cy', q[1].toFixed(1)); });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  new IntersectionObserver(es => es.forEach(e => e.isIntersecting && play()), {threshold: .35}).observe(svg);
})();

/* ==========================================================================
   11) Hero sparks canvas
   ========================================================================== */
(() => {
  const cv = $('#sparks'); if (!cv || !MOTION) { if (cv) cv.style.opacity = 0; return; }
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = Math.min(2, devicePixelRatio || 1), ps = [], raf = 0, running = true;
  const N = innerWidth < 700 ? 28 : 58;
  const size = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const mk = () => ({x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.7 + .5, vy: -(Math.random() * .28 + .06), vx: (Math.random() - .5) * .18, a: Math.random() * .5 + .12, tw: Math.random() * .04 + .01, ph: Math.random() * 6});
  size(); ps = Array.from({length: N}, mk);
  addEventListener('resize', () => { size(); }, {passive: true});
  const loop = () => {
    ctx.clearRect(0, 0, W, H);
    ps.forEach(p => {
      p.y += p.vy; p.x += p.vx + Math.sin(p.ph) * .12; p.ph += p.tw;
      if (p.y < -8) { p.y = H + 6; p.x = Math.random() * W; }
      const al = p.a * (0.55 + 0.45 * Math.sin(p.ph * 3));
      ctx.beginPath(); ctx.fillStyle = `rgba(233,180,76,${al})`;
      ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    });
    raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && !running) { running = true; loop(); }
    else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
  }), {threshold: 0});
  io.observe(cv); loop();
})();

/* ==========================================================================
   12) Magnetic buttons + card spotlight
   ========================================================================== */
(() => {
  if (isTouch || !MOTION) return;
  $$('[data-magnet]').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
      el.style.transform = `translate(${(-x * 16).toFixed(2)}px,${(-y * 12).toFixed(2)}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
  document.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.card, .tl__item, .tool, .fact');
    if (!c) return; const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, {passive: true});
})();

/* ==========================================================================
   13) Custom cursor
   ========================================================================== */
(() => {
  if (isTouch) return;
  const d = $('#cur'), r = $('#curR'); if (!d || !r) return;
  document.body.classList.add('cursor-on');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  let idle = 0;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY;
    d.style.transform = `translate(${mx}px,${my}px)`;
    document.body.classList.add('cursor-live'); clearTimeout(idle);
    idle = setTimeout(() => document.body.classList.remove('cursor-live'), 1600); }, {passive: true});
  const loop = () => {
    rx = lerp(rx, mx, .17); ry = lerp(ry, my, .17);
    r.style.transform = `translate(${rx}px,${ry}px)`;
    requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('a, button, input, textarea, select, [role="button"], .compare, [data-magnet]');
    r.classList.toggle('hot', !!t);
  });
})();

/* ==========================================================================
   14) SFX (WebAudio) — opt-in
   ========================================================================== */
const SFX = window.SFX = (() => {
  let on = STORE.get('sfx', false), ac = null;
  const ctx = () => (ac = ac || new (window.AudioContext || window.webkitAudioContext)());
  const env = (o, g, dur, peak = .05) => {
    const now = o.context.currentTime;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(peak, now + .012);
    g.gain.exponentialRampToValueAtTime(.0001, now + dur);
  };
  const click = () => {
    if (!on) return; const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(760, c.currentTime); o.frequency.exponentialRampToValueAtTime(190, c.currentTime + .09);
    o.connect(g).connect(c.destination); env(o, g, .12, .045); o.start(); o.stop(c.currentTime + .14);
  };
  const ping = () => {
    if (!on) return; const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 1180; o.connect(g).connect(c.destination); env(o, g, .2, .03); o.start(); o.stop(c.currentTime + .22);
  };
  const engine = () => {
    if (!on) return; const c = ctx(), t = c.currentTime;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(), n = c.createBufferSource();
    const buf = c.createBuffer(1, c.sampleRate * 1.4, c.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * .5;
    n.buffer = buf; f.type = 'lowpass'; f.frequency.setValueAtTime(320, t); f.frequency.linearRampToValueAtTime(1100, t + .8);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(38, t); o.frequency.exponentialRampToValueAtTime(96, t + .75); o.frequency.linearRampToValueAtTime(72, t + 1.3);
    o2.type = 'square'; o2.frequency.setValueAtTime(19, t); o2.frequency.exponentialRampToValueAtTime(48, t + .7);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .18); g.gain.linearRampToValueAtTime(.05, t + 1); g.gain.exponentialRampToValueAtTime(.0001, t + 1.45);
    o.connect(f); o2.connect(f); n.connect(f); f.connect(g).connect(c.destination);
    [o, o2].forEach(x => { x.start(t); x.stop(t + 1.5); }); n.start(t); n.stop(t + 1.45);
  };
  const btn = $('#sfxBtn');
  const paint = () => { if (btn) { btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('warn', on); btn.innerHTML = `<svg><use href="#i-${on ? 'sound' : 'mute'}"/></svg>`; } };
  paint();
  btn && btn.addEventListener('click', () => { on = !on; STORE.set('sfx', on); paint(); if (on) { ctx().resume && ctx().resume(); engine(); toast(on ? 'صدا روشن شد — صدای استارت موتور' : 'صدا خاموش شد'); } });
  document.addEventListener('click', e => { if (e.target.closest('[data-sfx]')) click(); }, {capture: true});
  return {on: () => on, click, ping, engine};
})();

/* ==========================================================================
   15) Toast
   ========================================================================== */
let toastT = 0;
function toast(msg, ms = 3400) {
  const t = $('#toast'), m = $('#toastMsg'); if (!t) return;
  m.textContent = msg; t.classList.add('show'); clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), ms);
}
window.toast = toast;

/* ==========================================================================
   16) Gallery filters + lightbox
   ========================================================================== */
(() => {
  const shots = $$('.shot');
  $$('#galFilters button').forEach(b => b.addEventListener('click', () => {
    $$('#galFilters button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.f;
    shots.forEach(s => {
      const show = f === 'all' || s.dataset.cat === f;
      s.hidden = !show;
      if (show && MOTION) s.animate([{opacity: 0, transform: 'scale(.96)'}, {opacity: 1, transform: 'none'}], {duration: 460, easing: 'cubic-bezier(.22,1,.36,1)'});
    });
  }));

  const lb = $('#lb'), img = $('#lbImg'), cap = $('#lbCap');
  let idx = -1;
  const open = i => {
    const s = shots[i]; if (!s || s.hidden) return;
    const im = $('img', s); idx = i;
    img.src = im.src; img.alt = im.alt; cap.textContent = ($('figcaption b', s) || {}).textContent || im.alt;
    lb.classList.add('open'); document.body.classList.add('is-locked'); $('#lbX').focus();
  };
  const close = () => { lb.classList.remove('open'); document.body.classList.remove('is-locked'); if (shots[idx]) shots[idx].focus({preventScroll: true}); idx = -1; };
  const step = d => { let i = idx; for (let k = 0; k < shots.length; k++) { i = (i + d + shots.length) % shots.length; if (!shots[i].hidden) break; } open(i); };
  shots.forEach((s, i) => {
    if (s.classList.contains('shot--compare')) return;
    s.addEventListener('click', () => open(i));
    s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
  });
  $('#lbX').addEventListener('click', close);
  $('#lbP').addEventListener('click', () => step(-1));
  $('#lbN').addEventListener('click', () => step(1));
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  addEventListener('keydown', e => { if (!lb.classList.contains('open')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') step(1); if (e.key === 'ArrowRight') step(-1); });
})();

/* ==========================================================================
   17) Before / After compare
   ========================================================================== */
(() => {
  const box = $('#cmp'), top = $('#cmpTop'), line = $('#cmpLine'), range = $('#cmpRange');
  if (!box) return;
  const rtl = getComputedStyle(html).direction === 'rtl';
  const paint = v => {
    v = clamp(v, 0, 100);
    line.style.insetInlineStart = v + '%';
    top.style.clipPath = rtl ? `inset(0 ${v}% 0 0)` : `inset(0 0 0 ${100 - v}%)`;
    range.value = String(v);
  };
  const fromEvent = e => { const r = box.getBoundingClientRect(); paint(((e.clientX - r.left) / r.width) * 100); };
  let drag = false;
  box.addEventListener('pointerdown', e => { drag = true; box.setPointerCapture(e.pointerId); fromEvent(e); });
  box.addEventListener('pointermove', e => { if (drag) fromEvent(e); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => box.addEventListener(t, () => drag = false));
  range.addEventListener('input', () => paint(+range.value));
  range.addEventListener('keydown', e => { const d = e.key === 'ArrowLeft' ? -3 : e.key === 'ArrowRight' ? 3 : 0; if (d) { paint(+range.value + (rtl ? -d : d)); e.preventDefault(); } });
  let io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting || io.fired) return; io.fired = true;
    const t0 = performance.now();
    const demo = now => { const p = clamp((now - t0) / 1600, 0, 1); paint(50 + Math.sin(p * Math.PI) * 26 * (MOTION ? 1 : 0)); if (p < 1) requestAnimationFrame(demo); };
    if (MOTION) requestAnimationFrame(demo);
  }), {threshold: .4});
  io.observe(box);
  paint(50);
})();

/* ==========================================================================
   18) Testimonials carousel
   ========================================================================== */
(() => {
  const stage = $('#tstStage'); if (!stage) return;
  const slides = $$('.tst__slide', stage), dots = $('#tDots');
  let i = 0, timer = 0;
  slides.forEach((_, k) => {
    const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.setAttribute('aria-label', `نظر ${toFa(k + 1)}`);
    b.addEventListener('click', () => { go(k); restart(); });
    dots.appendChild(b);
  });
  const paint = () => { slides.forEach((s, k) => s.classList.toggle('on', k === i)); $$('button', dots).forEach((d, k) => d.setAttribute('aria-current', String(k === i))); };
  const go = n => { i = (n + slides.length) % slides.length; paint(); };
  const restart = () => { clearInterval(timer); if (MOTION) timer = setInterval(() => go(i + 1), 7000); };
  $('#tNext').addEventListener('click', () => { go(i + 1); restart(); });
  $('#tPrev').addEventListener('click', () => { go(i - 1); restart(); });
  stage.addEventListener('mouseenter', () => clearInterval(timer));
  stage.addEventListener('mouseleave', restart);
  let sx = 0;
  stage.addEventListener('touchstart', e => sx = e.touches[0].clientX, {passive: true});
  stage.addEventListener('touchend', e => { const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 45) { go(i + (d < 0 ? 1 : -1)); restart(); } });
  addEventListener('keydown', e => {
    const r = stage.getBoundingClientRect(); if (r.top > innerHeight || r.bottom < 0) return;
    if (e.key === 'ArrowRight') { go(i - 1); restart(); } if (e.key === 'ArrowLeft') { go(i + 1); restart(); }
  });
  paint(); restart();
})();

/* ==========================================================================
   19) FAQ accordion
   ========================================================================== */
(() => {
  $$('#faq .q').forEach(q => {
    const b = $('button', q);
    b.addEventListener('click', () => {
      const open = q.classList.contains('open');
      $$('#faq .q').forEach(o => { o.classList.remove('open'); $('button', o).setAttribute('aria-expanded', 'false'); });
      if (!open) { q.classList.add('open'); b.setAttribute('aria-expanded', 'true'); }
    });
  });
})();

/* ==========================================================================
   20) Pricing discount switch
   ========================================================================== */
(() => {
  const sw = $('#discSwitch'); if (!sw) return;
  sw.addEventListener('click', () => {
    const on = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(on));
    $$('.price-num').forEach(el => {
      const base = +el.dataset.v, v = on ? Math.round(base * .85 / 1000) * 1000 : base;
      el.animate([{opacity: 1}, {opacity: 0}, {opacity: 1}], {duration: 420});
      setTimeout(() => el.textContent = faNum(v), 180);
    });
    toast(on ? 'تخفیف ناوگان ۱۵٪ اعمال شد' : 'نرخ انفرادی برگشت');
  });
})();

/* ==========================================================================
   21) Work hours + live availability + ICS
   ========================================================================== */
const HOURS = {6: [9, 19], 0: [9, 19], 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 13], 5: [null, null]}; // 6=Sat … 5=Fri
const DAYSD = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
(() => {
  const tbl = $('#hoursTable');
  const now = new Date();
  const fmt = h => h === null ? '—' : toFa(String(h).padStart(2, '0')) + ':۰۰';
  const order = [6, 0, 1, 2, 3, 4, 5];
  if (tbl) {
    tbl.innerHTML = order.map(d => {
      const [a, b] = HOURS[d]; const today = now.getDay() === d;
      return `<tr class="${today ? 'today' : ''}"><td>${DAYSD[d]}</td><td>${fmt(a)} تا ${fmt(b === null ? a : b)}</td></tr>`;
    }).join('');
    const todayLbl = new Intl.DateTimeFormat('fa-IR', {calendar: 'persian', weekday: 'long', day: 'numeric', month: 'long'}).format(now);
    const t = $('#faToday'); if (t) t.textContent = todayLbl;
  }

  // live availability widget
  const av = $('#avail');
  const render = () => {
    if (!av) return;
    const d = new Date(), day = d.getDay(), h = d.getHours() + d.getMinutes() / 60;
    const [a, b] = HOURS[day] || [null, null];
    let state, note, cls;
    if (a === null) { state = 'تعطیل — فقط امداد جاده‌ای'; note = 'جمعه‌ها تماس اضطراری پاسخ دارد.'; cls = 'busy'; }
    else if (h < a) { state = 'بزودی باز می‌شود'; note = `امروز ساعت ${toFa(a)} شروع کار است — درخواستت را الان بفرست.`; cls = 'ok'; }
    else if (h > b) { state = 'خارج از ساعت کاری'; note = 'پیامت را می‌بینم و فردا اول وقت جواب می‌دهم.'; cls = 'busy'; }
    else { state = 'امروز ظرفیت دارم'; note = `${toFa(Math.max(0, Math.floor(b - h)))} ساعت تا پایان وقت — رزرو همان روز ممکن است.`; cls = 'ok'; }
    const load = [2, 1, 3, 2, 4, 1];
    av.innerHTML = `<div class="avail__top"><i class="dot ${cls === 'busy' ? 'dot--warn' : ''}" style="${cls === 'busy' ? 'background:var(--danger);box-shadow:0 0 10px var(--danger)' : ''}"></i>${state}</div>
      <p>${note}</p>
      <div class="avail__grid">${['ش','ی','د','س','چ','پ'].map((k, i) => `<span class="${load[i] >= 3 ? 'busy' : 'ok'}">${k}·${toFa(load[i])}</span>`).join('')}</div>`;
  };
  render(); setInterval(render, 60000);

  // hero status pill
  const st = $('#heroStatus'), stx = $('.hero__status-txt', st);
  const stPaint = () => {
    const d = new Date(), [a, b] = HOURS[d.getDay()] || [null, null]; const h = d.getHours() + d.getMinutes() / 60;
    stx.textContent = a === null ? 'جمعه — فقط امداد جاده‌ای' : (h < a ? `امروز ${toFa(a)} شروع می‌کنم` : h > b ? 'خارج از ساعت کاری' : 'باز — پذیرش امروز');
    st.style.color = (a === null || h > b) ? 'var(--gold-1)' : '#7fe6d8';
  };
  stPaint(); setInterval(stPaint, 60000);
  const clk = $('#clusterClock');
  if (clk) { const c = () => clk.textContent = new Date().toLocaleTimeString('fa-IR', {hour12: false}); c(); setInterval(c, 1000); }
})();

/* next free slot */
function nextSlot() {
  const d = new Date();
  for (let k = 0; k < 14; k++) {
    const t = new Date(d.getTime() + k * 864e5);
    const [a] = HOURS[t.getDay()] || [null];
    if (a === null) continue;
    t.setHours(a + 1, 0, 0, 0);
    if (k === 0 && t < new Date()) t.setHours(a + 3);
    if (t > new Date()) return t;
  }
  const t = new Date(d.getTime() + 864e5); t.setHours(10, 0, 0, 0); return t;
}
(() => {
  const b = $('#icsBtn'); if (!b) return;
  b.addEventListener('click', () => {
    const s = nextSlot(), e = new Date(s.getTime() + 45 * 6e4);
    const z = x => x.toISOString().replace(/[-:]|\.\d{3}/g, '');
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//restagari//resume//FA','BEGIN:VEVENT',
      `UID:${Date.now()}@restagari.local`,`DTSTAMP:${z(new Date())}`,`DTSTART:${z(s)}`,`DTEND:${z(e)}`,
      'SUMMARY:عیب‌یابی خودرو — امیر رستگاری','DESCRIPTION:مکان: تهران، خیابان کارگر شمالی، پاساژ فنی آریا، پلاک ۲۱۴','LOCATION:پاساژ فنی آریا',
      'END:VEVENT','END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], {type: 'text/calendar;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = 'appointment.ics'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('فایل تقویم ساخته شد — «' + new Intl.DateTimeFormat('fa-IR', {calendar: 'persian', dateStyle: 'full'}).format(s) + '»');
  });
})();

/* ==========================================================================
   22) Contact form (demo, client-side only)
   ========================================================================== */
(() => {
  const f = $('#bookForm'); if (!f) return;
  const rules = {
    'f-name': v => v.trim().length >= 3,
    'f-phone': v => /^(\+?98|0)?9\d{9}$/.test(v.replace(/[\s().-]/g, '')),
    'f-svc': v => !!v,
    'f-msg': v => v.trim().length >= 15,
    'f-consent': (v, el) => el.checked
  };
  const ok = id => { const el = $('#' + id); return rules[id](el.value, el); };
  const mark = id => {
    const el = $('#' + id), wrap = el.closest('.field') || el.closest('.chk');
    if (!wrap) return;
    wrap.classList.toggle('bad', !ok(id));
  };
  Object.keys(rules).forEach(id => {
    const el = $('#' + id); if (!el) return;
    el.addEventListener('blur', () => mark(id));
    el.addEventListener('input', () => el.closest('.field') && el.closest('.field').classList.remove('bad'));
    el.addEventListener('change', () => mark(id));
  });
  const payload = () => ({
    name: $('#f-name').value.trim(), phone: $('#f-phone').value.trim(), car: $('#f-car').value.trim(),
    service: $('#f-svc').value, date: $('#f-date').value, km: $('#f-km').value, message: $('#f-msg').value.trim(), at: new Date().toISOString()
  });
  const text = () => { const p = payload(); return `رزومه امیر رستگاری — درخواست وقت\nنام: ${p.name}\nتماس: ${p.phone}\nخودرو: ${p.car || '—'}\nخدمت: ${p.service}\nتاریخ: ${p.date || 'هر زمان'}\nکارکرد: ${p.km || '—'}\n\nشرح مشکل:\n${p.message}`; };
  f.addEventListener('submit', e => {
    e.preventDefault();
    const bad = Object.keys(rules).filter(id => !ok(id));
    bad.forEach(mark);
    if (bad.length) { const el = $('#' + bad[0]); el.focus(); el.animate([{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}], {duration: 340}); toast('لطفاً ' + toFa(bad.length) + ' مورد از فیلدها را اصلاح کن'); return; }
    const reqs = STORE.get('requests', []); reqs.unshift(payload()); STORE.set('requests', reqs.slice(0, 20));
    SFX.engine();
    f.reset();
    toast('درخواستت ثبت شد (حالت دمو — در localStorage مرورگر). به‌زودی تماس می‌گیرم.');
    const btn = $('button[type=submit]', f);
    btn.animate([{transform:'scale(1)'},{transform:'scale(.95)'},{transform:'scale(1)'}], {duration: 300});
  });
  $('#waBtn').addEventListener('click', () => {
    Object.keys(rules).forEach(mark);
    if (Object.keys(rules).some(id => !ok(id))) { toast('اول فیلدهای ستاره‌دار را کامل کن'); return; }
    window.open('https://wa.me/989120000000?text=' + encodeURIComponent(text()), '_blank', 'noopener');
  });
  const d = $('#f-date'); if (d) { const t = nextSlot(); d.value = t.toISOString().slice(0, 10); d.min = new Date().toISOString().slice(0, 10); }
})();

/* ==========================================================================
   23) Print / misc
   ========================================================================== */
(() => {
  const go = () => { toast('در پنجره چاپ، «ذخیره به‌صورت PDF» را انتخاب کن'); setTimeout(() => print(), 420); };
  $('#printBtn') && $('#printBtn').addEventListener('click', go);
  const p2 = $('#printBtn2'); p2 && p2.addEventListener('click', e => { e.preventDefault(); go(); });

  const tt = $('#toTop');
  addEventListener('scroll', () => tt && tt.classList.toggle('show', scrollY > innerHeight * .9), {passive: true});
  tt && tt.addEventListener('click', () => scrollTo({top: 0, behavior: MOTION ? 'smooth' : 'auto'}));

  const y = $('#yr'); if (y) y.textContent = new Date().getFullYear();

  const mb = $('#motionBtn');
  const paintM = () => { const s = $('#motionState'); if (s) s.textContent = MOTION ? 'روشن' : 'خاموش'; };
  mb && mb.addEventListener('click', () => { MOTION = !MOTION; STORE.set('motion', MOTION); setMotion(); paintM(); toast(MOTION ? 'انیمیشن‌ها روشن شد' : 'حالت کاهش حرکت فعال شد'); });
  paintM();

  // keyboard focus ring polish for shot cards
  $$('.shot').forEach(s => s.addEventListener('keydown', e => { if (e.key === 'Enter') s.click(); }));

  // subtle parallax on hero image
  const hb = $('.hero__bg img');
  if (hb && MOTION && !isTouch) addEventListener('scroll', () => { const p = clamp(scrollY / innerHeight, 0, 1); hb.style.transform = `translateY(${p * 60}px) scale(${1 + p * .06})`; }, {passive: true});

  console.log('%c امیر رستگاری · Resume v1.0 ', 'background:#e9b44c;color:#171204;font-weight:700;border-radius:4px;padding:2px 6px', 'سایت نمونه — همه داده‌ها فیک است.');
})();

})();
