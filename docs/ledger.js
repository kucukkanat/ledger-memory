/* ============================================================================
   LEDGER docs — vanilla, no dependencies, no network.
   Every animation is purposeful and every one of them is disabled under
   prefers-reduced-motion.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => motionQuery.matches;

  /* ------------------------------------------------------------- reveals */

  const revealables = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('in'));
  }

  /* --------------------------------------------- rail + progress segments */

  const sections = $$('[data-sec]');
  const railItems = $$('[data-rail] > li');
  const segbar = $('[data-segbar]');
  const pctOut = $('[data-pct]');
  const segs = sections.map(() => {
    const i = document.createElement('i');
    segbar && segbar.appendChild(i);
    return i;
  });

  let boxes = [];
  let scrollSpan = 1;
  const measure = () => {
    const y = window.scrollY;
    boxes = sections.map((s) => {
      const r = s.getBoundingClientRect();
      return { top: r.top + y, bottom: r.bottom + y };
    });
    // Cached here rather than read in paint(): reading scrollHeight after the
    // style writes above forces a synchronous reflow on every scroll frame.
    scrollSpan = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  };

  const paint = () => {
    // The reference line sits just under the instrument bar: a section's tick
    // fills from the moment its top crosses that line until its bottom does.
    const ref = window.scrollY + 140;
    let active = -1;
    boxes.forEach((b, i) => {
      const f = clamp((ref - b.top) / Math.max(1, b.bottom - b.top), 0, 1);
      const tick = railItems[i] && railItems[i].querySelector('.tick b');
      if (tick) tick.style.setProperty('--f', f.toFixed(3));
      if (segs[i]) segs[i].style.setProperty('--f', f.toFixed(3));
      if (ref >= b.top) active = i;
    });
    railItems.forEach((li, i) => {
      const on = i === active;
      li.classList.toggle('is-on', on);
      const a = li.querySelector('a');
      if (a) { if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }
    });
    if (pctOut) pctOut.textContent = String(Math.round(clamp(window.scrollY / scrollSpan, 0, 1) * 100)).padStart(3, '0');
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { paint(); ticking = false; });
  };
  const remeasure = () => { measure(); paint(); };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  remeasure();

  /* ------------------------------------------------------- hero simulation */

  const heroCanvas = $('[data-hero]');
  if (heroCanvas) {
    const ctx = heroCanvas.getContext('2d');
    const palette = ['#b7c14a', '#4a9fd4', '#cf6fb8', '#4fb8a8', '#6fbf73', '#d9a03c', '#6f86e0', '#9a76dd', '#e0793f', '#d6606a'];
    const names = ['prefs', 'people', 'code', 'travel', 'health', 'money', 'home', 'reading', 'proc', 'projects'];
    const weights = [11, 14, 17, 7, 6, 12, 8, 9, 10, 13];
    const modes = ['clusters', 'heat', 'time'];
    const modeOut = $('[data-hero-mode]');
    const countOut = $('[data-hero-count]');

    const total = weights.reduce((a, b) => a + b, 0);
    const nodes = [];
    for (let c = 0; c < 10; c++) {
      const n = Math.round((weights[c] / total) * 300);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        nodes.push({
          c, x: 0, y: 0, tx: 0, ty: 0,
          a, rr: Math.sqrt(Math.random()),
          hit: Math.pow(Math.random(), 2.2),
          str: 0.17 + Math.random() * 0.8,
          t: Math.pow(Math.random(), 0.8),
          j: Math.random() - 0.5,
          size: 1.1 + Math.random() * 1.9,
        });
      }
    }
    if (countOut) countOut.textContent = String(nodes.length);

    let W = 0, H = 0, mode = 0, ready = false;

    /* The caption strip is painted over the bottom of the canvas, so the
       simulation lays out inside a shorter box — otherwise the bottom row of
       cluster labels sits underneath it, which is exactly what happens on a
       narrow screen where the canvas is short. */
    const CAPTION = 28;
    const plotH = () => Math.max(120, H - CAPTION);

    const layout = () => {
      const cols = 5, rows = 2;
      const PH = plotH();
      const cw = W / cols, ch = PH / rows;
      for (const n of nodes) {
        if (modes[mode] === 'clusters') {
          const cx = (n.c % cols + 0.5) * cw;
          const cy = (Math.floor(n.c / cols) + 0.5) * ch;
          const rad = Math.min(cw, ch) * (0.20 + (weights[n.c] / 17) * 0.16);
          n.tx = cx + Math.cos(n.a) * n.rr * rad;
          n.ty = cy + Math.sin(n.a) * n.rr * rad * 0.86;
        } else if (modes[mode] === 'heat') {
          n.tx = W * (0.08 + n.hit * 0.84);
          n.ty = PH * (0.92 - ((n.str - 0.17) / 0.82) * 0.84);
        } else {
          const band = (n.c + 0.5) / 10;
          n.tx = W * (0.06 + n.t * 0.88);
          n.ty = PH * (0.08 + band * 0.84) + n.j * (PH / 10) * 0.5;
        }
      }
    };

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = heroCanvas.getBoundingClientRect();
      W = Math.max(320, r.width); H = Math.max(200, r.height);
      heroCanvas.width = Math.round(W * dpr);
      heroCanvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      if (!ready) { for (const n of nodes) { n.x = n.tx; n.y = n.ty; } ready = true; }
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#08090a';
      ctx.fillRect(0, 0, W, H);
      if (modes[mode] === 'clusters') {
        ctx.font = '9px "Geist Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        for (let c = 0; c < 10; c++) {
          const cx = (c % 5 + 0.5) * (W / 5);
          const cy = (Math.floor(c / 5) + 0.5) * (plotH() / 2);
          const rad = Math.min(W / 5, plotH() / 2) * (0.20 + (weights[c] / 17) * 0.16);
          ctx.fillStyle = '#7d858d'; /* matches --trace; canvas text cannot read CSS vars */
          ctx.fillText(names[c].toUpperCase(), cx, cy + rad + 16);
        }
      }
      for (const n of nodes) {
        n.x += (n.tx - n.x) * 0.075;
        n.y += (n.ty - n.y) * 0.075;
        ctx.globalAlpha = 0.35 + n.str * 0.6;
        ctx.fillStyle = palette[n.c];
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0, last = 0, visible = false;
    const loop = (t) => {
      if (t - last > 5200) { last = t; mode = (mode + 1) % modes.length; layout(); if (modeOut) modeOut.textContent = modes[mode].toUpperCase(); }
      draw();
      raf = requestAnimationFrame(loop);
    };

    size();
    draw();
    window.addEventListener('resize', () => { size(); draw(); });

    if (!still() && 'IntersectionObserver' in window) {
      new IntersectionObserver((es) => {
        for (const e of es) {
          if (e.isIntersecting && !visible) { visible = true; last = performance.now(); raf = requestAnimationFrame(loop); }
          else if (!e.isIntersecting && visible) { visible = false; cancelAnimationFrame(raf); }
        }
      }, { threshold: 0 }).observe(heroCanvas);
    }
    // Two-way: stop when the user asks for reduced motion, and resume if they
    // turn it back off mid-session. One-way meant the hero froze for good.
    motionQuery.addEventListener && motionQuery.addEventListener('change', () => {
      if (still()) {
        if (visible) { visible = false; cancelAnimationFrame(raf); }
        draw();
      } else if (!visible && heroCanvas.getBoundingClientRect().top < window.innerHeight) {
        visible = true; last = performance.now(); raf = requestAnimationFrame(loop);
      }
    });
  }

  /* --------------------------------------------------------- strength demo */

  const demo = $('[data-demo]');
  if (demo) {
    const TAU = 190, CEIL = Math.log(301), FLEET = ['wren', 'forge', 'claude'];
    const out = {
      score: $('[data-demo-score]', demo), fill: $('[data-demo-fill]', demo),
      meter: $('[data-demo-meter]', demo), day: $('[data-demo-day]', demo),
      hits: $('[data-demo-hits]', demo), used: $('[data-demo-used]', demo),
      fresh: $('[data-demo-fresh]', demo), corr: $('[data-demo-corr]', demo),
      msg: $('[data-demo-msg]', demo), state: $('[data-demo-state]', demo),
      rate: $('[data-demo-rate]', demo),
    };
    let s = { day: 0, since: 0, hits: 0, readers: new Set(['claude']), next: 0 };

    const tint = (v) => (v > 0.7 ? '#c0f24a' : v > 0.4 ? '#d9a03c' : '#e0555f');

    const render = () => {
      const used = clamp(Math.log1p(Math.max(0, s.hits)) / CEIL, 0, 1);
      const fresh = Math.exp(-Math.max(0, s.since) / TAU);
      const corr = clamp((1 + Math.max(1, s.readers.size) - 2) / 3, 0, 1);
      const v = clamp(0.17 + 0.27 * used + 0.34 * fresh + 0.22 * corr, 0.04, 0.99);
      const c = tint(v);
      out.score.textContent = String(Math.round(v * 100));
      out.score.style.color = c;
      out.fill.style.width = (v * 100).toFixed(1) + '%';
      out.fill.style.background = c;
      out.day.textContent = String(Math.round(s.day));
      out.hits.textContent = String(s.hits);
      out.used.textContent = used.toFixed(3);
      out.fresh.textContent = fresh.toFixed(3);
      out.corr.textContent = corr.toFixed(3);
    };

    const say = (text, warn) => {
      out.msg.textContent = text;
      out.msg.classList.toggle('is-warn', Boolean(warn));
    };

    const pulse = () => {
      if (still()) return;
      out.meter.classList.add('is-pulse');
      setTimeout(() => out.meter.classList.remove('is-pulse'), 220);
    };

    $('[data-demo-recall]', demo).addEventListener('click', () => {
      const who = FLEET[s.next % FLEET.length];
      s.next += 1; s.hits += 1; s.since = 0; s.readers.add(who);
      pulse(); render();
      say('recall by ' + who + ' — freshness back to 1.000, hits ' + s.hits +
        ', distinct readers ' + s.readers.size + '. Retrieval is the only thing that moves used and fresh.');
    });

    $('[data-demo-search]', demo).addEventListener('click', () => {
      render();
      say('search ran and nothing moved. A human reading the store does not count as a retrieval — if it did, supervising the numbers would inflate them.', true);
    });

    $('[data-demo-skip]', demo).addEventListener('click', () => {
      s.day += 30; s.since += 30; render();
      say('30 days with nothing reading it. fresh = exp(−' + Math.round(s.since) + '/190).');
    });

    $('[data-demo-reset]', demo).addEventListener('click', () => {
      s = { day: 0, since: 0, hits: 0, readers: new Set(['claude']), next: 0 };
      render();
      say('A brand-new claim scores 51. Left alone it falls to 40 in 74.3 days.');
    });

    render();

    if (!still()) {
      let raf = 0, prev = 0, on = false;
      const tick = (t) => {
        const dt = Math.min(0.1, (t - prev) / 1000);
        prev = t;
        s.day += dt * 14; s.since += dt * 14;
        render();
        raf = requestAnimationFrame(tick);
      };
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((es) => {
          for (const e of es) {
            if (e.isIntersecting && !on) { on = true; prev = performance.now(); raf = requestAnimationFrame(tick); out.state.textContent = 'DECAYING'; }
            else if (!e.isIntersecting && on) { on = false; cancelAnimationFrame(raf); out.state.textContent = 'PAUSED'; }
          }
        }, { threshold: 0.25 }).observe(demo);
      }
    } else {
      out.state.textContent = 'STEPPED';
      out.rate.textContent = 'manual';
    }
  }

  /* -------------------------------------------------------- terminal typing */

  const term = $('[data-term]');
  if (term) {
    const target = $('[data-type]', term);
    const caret = $('[data-caret]', term);
    const outBlock = $('[data-out]', term);
    const text = target ? target.textContent : '';
    const lines = outBlock ? outBlock.innerHTML.split('\n') : [];
    if (outBlock) {
      outBlock.innerHTML = lines.map((l) => '<span class="ln">' + l + '</span>').join('\n');
    }
    const linesEls = outBlock ? $$('.ln', outBlock) : [];

    const finish = () => {
      if (target) target.textContent = text;
      linesEls.forEach((l) => l.classList.add('in'));
      if (caret) caret.classList.add('is-off');
    };

    const run = () => {
      if (still()) { finish(); return; }
      if (target) target.textContent = '';
      let i = 0;
      const step = () => {
        i += 1;
        if (target) target.textContent = text.slice(0, i);
        if (i < text.length) { setTimeout(step, 22 + Math.random() * 26); return; }
        setTimeout(() => {
          linesEls.forEach((l, k) => setTimeout(() => l.classList.add('in'), k * 90));
          if (caret) setTimeout(() => caret.classList.add('is-off'), linesEls.length * 90 + 200);
        }, 260);
      };
      setTimeout(step, 220);
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          io.disconnect();
          run();
        }
      }, { threshold: 0.4 });
      if (target) target.textContent = '';
      linesEls.forEach((l) => l.classList.remove('in'));
      io.observe(term);
    } else finish();
  }

  /* ------------------------------------------------------------------ copy */

  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const wrap = btn.closest('[data-copy-wrap]');
      const src = wrap && wrap.querySelector('[data-copy-src]');
      if (!src) return;
      const value = src.textContent.trim();
      let done = false;
      try {
        await navigator.clipboard.writeText(value);
        done = true;
      } catch {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { done = document.execCommand('copy'); } catch { done = false; }
        ta.remove();
      }
      btn.textContent = done ? 'COPIED' : 'SELECT + ⌘C';
      btn.classList.toggle('is-done', done);
      setTimeout(() => { btn.textContent = 'COPY'; btn.classList.remove('is-done'); }, 1800);
    });
  });
})();
