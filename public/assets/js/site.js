/* Next Gen Summit, V1 prototype.
   Plain JavaScript, no dependencies. Each section is one small init function. */
(function () {
  'use strict';
  document.documentElement.classList.add('js-ready');

  var doc = document.documentElement;
  var reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = reduceMQ.matches;
  var motionHooks = [];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, text, hidden) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (hidden) n.setAttribute('aria-hidden', 'true');
    return n;
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function onMotionChange(fn) { motionHooks.push(fn); }

  var fontsReady = (document.fonts && document.fonts.load)
    ? Promise.all([
        document.fonts.load('900 100px Fraunces'),
        document.fonts.load('800 100px Montserrat')
      ]).catch(function () {})
    : Promise.resolve();

  /* ---------- registration plates ---------- */
  function buildReg(node) {
    if (node.__reg) return node;
    var text = node.textContent;
    node.textContent = '';
    node.appendChild(el('span', 'reg__k', text));
    ['c', 'm', 'y'].forEach(function (p) {
      node.appendChild(el('span', 'reg__p reg__p--' + p, text, true));
    });
    node.__reg = true;
    return node;
  }

  function regPlay(node, delay) {
    if (reduced) return;
    clearTimeout(node.__t1);
    clearTimeout(node.__t2);
    node.classList.remove('is-in', 'is-done');
    node.classList.add('is-armed');
    void node.offsetWidth;                 // commit the misregistered start state
    node.__t1 = setTimeout(function () {
      node.classList.add('is-in');
      node.__t2 = setTimeout(function () { node.classList.add('is-done'); }, 1700);
    }, delay || 0);
  }

  function regReset(node) {
    clearTimeout(node.__t1);
    clearTimeout(node.__t2);
    node.classList.remove('is-armed', 'is-in', 'is-done');
  }

  /* ---------- reveals ---------- */
  function settle(node) {
    var d = parseFloat(node.style.getPropertyValue('--d')) || 0;
    setTimeout(function () { node.classList.add('settled'); }, d * 1000 + 1400);
  }

  function initReveals() {
    var items = $$('.rv').filter(function (n) { return !n.closest('.hero'); });
    if (!('IntersectionObserver' in window) || reduced) {
      items.forEach(function (n) { n.classList.add('in', 'settled'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        settle(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------- hero entrance ---------- */
  function initHero() {
    var hero = $('.hero');
    if (!hero) return;
    var img = $('.hero__img', hero);
    var mark = $('.hero__title .reg', hero);
    if (mark) buildReg(mark);
    var imgReady = new Promise(function (res) {
      if (!img || img.complete) return res();
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    });
    var timeout = new Promise(function (res) { setTimeout(res, 800); });
    Promise.race([Promise.all([imgReady, fontsReady]), timeout]).then(function () {
      doc.classList.add('is-ready');
      $$('.rv', hero).forEach(function (n) { n.classList.add('in'); settle(n); });
      if (mark) regPlay(mark, 280);
    });
  }

  /* ---------- hero countdown ---------- */
  function initCountdown() {
    var box = $('.count');
    if (!box) return;
    var target = new Date(box.getAttribute('data-until')).getTime();
    if (!target) { box.hidden = true; return; }
    var out = {};
    ['days', 'hours', 'minutes', 'seconds'].forEach(function (k) { out[k] = $('[data-count="' + k + '"]', box); });
    var sr = $('[data-count-sr]', box);
    var timer = null, visible = false;

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function tick() {
      var left = Math.max(0, target - Date.now());
      var sec = Math.floor(left / 1000);
      var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
      out.days.textContent = pad(d);
      out.hours.textContent = pad(h);
      out.minutes.textContent = pad(m);
      out.seconds.textContent = pad(sec % 60);
      if (sr) sr.textContent = left ? d + ' days until NextGen Summit on October 30.' : 'NextGen Summit is here.';
      if (!left && timer) { clearInterval(timer); timer = null; }
    }
    function run() {                        // only ticks while the hero is on screen and the tab is open
      var on = visible && !document.hidden;
      if (on && !timer) { tick(); timer = setInterval(tick, 1000); }
      else if (!on && timer) { clearInterval(timer); timer = null; }
    }
    tick();
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; run(); }).observe(box);
    document.addEventListener('visibilitychange', run);
  }

  /* ---------- nav theme ---------- */
  var requestNav = function () {};
  function initNav() {
    var nav = $('.nav');
    if (!nav) return;
    var sections = $$('[data-nav]');
    var hero = $('.hero');
    var state = '';
    var raf = null;

    function update() {
      raf = null;
      var y = nav.offsetHeight / 2;
      var theme = 'paper';
      for (var i = 0; i < sections.length; i++) {
        var r = sections[i].getBoundingClientRect();
        if (r.top <= y && r.bottom > y) {
          var s = sections[i];
          var mode = s.getAttribute('data-nav');
          theme = (mode === 'photo' || (mode === 'xp' && s.classList.contains('is-lit'))) ? 'photo' : 'paper';
          break;
        }
      }
      var atHero = !!hero && hero.getBoundingClientRect().bottom > window.innerHeight * 0.42;
      var next = theme + (atHero ? ':hero' : '');
      if (next === state) return;
      state = next;
      nav.classList.toggle('on-photo', theme === 'photo');
      nav.classList.toggle('on-paper', theme === 'paper');
      nav.classList.toggle('at-hero', atHero);
    }

    requestNav = function () { if (raf === null) raf = requestAnimationFrame(update); };
    addEventListener('scroll', requestNav, { passive: true });
    addEventListener('resize', requestNav);
    update();
  }

  /* ---------- 02 rotating identity ---------- */
  function initRotator() {
    var box = $('[data-rotator]');
    if (!box) return;
    var words;
    try { words = JSON.parse(box.getAttribute('data-rotator')); } catch (e) { return; }
    var toggle = $('[data-rotator-toggle]');
    var title = box.closest('h2') || box;
    box.textContent = '';
    var nodes = words.map(function (w, i) {
      var wrap = el('span', 'what__word' + (i === 0 ? ' is-current' : ''));
      var r = el('span', 'reg', w);
      wrap.appendChild(buildReg(r));
      wrap.appendChild(el('span', 'what__dot', '.'));
      box.appendChild(wrap);
      return wrap;
    });

    var idx = 0, timer = null, visible = false, userPaused = false, hovering = false;

    function canRun() { return visible && !userPaused && !hovering && !reduced && !document.hidden; }
    function step() {
      var cur = nodes[idx];
      idx = (idx + 1) % nodes.length;
      var nxt = nodes[idx];
      cur.classList.remove('is-current');
      cur.classList.add('is-leaving');
      setTimeout(function () { cur.classList.remove('is-leaving'); }, 650);
      nxt.classList.add('is-current');
      regPlay($('.reg', nxt), 60);
    }
    function schedule() {
      clearTimeout(timer);
      timer = null;
      if (canRun()) timer = setTimeout(function () { step(); schedule(); }, 1500);   // time each word holds
    }
    function showFirst() {
      nodes.forEach(function (n, i) {
        n.classList.toggle('is-current', i === 0);
        n.classList.remove('is-leaving');
        regReset($('.reg', n));
      });
      idx = 0;
    }

    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; schedule(); }, { threshold: 0.3 }).observe(title);
    title.addEventListener('pointerenter', function () { hovering = true; schedule(); });
    title.addEventListener('pointerleave', function () { hovering = false; schedule(); });
    document.addEventListener('visibilitychange', schedule);

    if (toggle) {
      toggle.addEventListener('click', function () {
        userPaused = !userPaused;
        toggle.setAttribute('aria-pressed', String(userPaused));
        var label = userPaused ? 'Play the rotating words' : 'Pause the rotating words';
        $('.toggle__t', toggle).textContent = userPaused ? 'Play words' : 'Pause words';
        toggle.setAttribute('aria-label', label);
        schedule();
      });
    }

    onMotionChange(function () {
      if (reduced) showFirst();
      if (toggle) toggle.hidden = reduced;
      schedule();
    });
    if (toggle) toggle.hidden = reduced;
  }

  /* ---------- 03 the experience ---------- */
  function initExperience() {
    var xp = $('.xp');
    if (!xp) return;
    var items = $$('.xp__item', xp);
    var bgs = $$('.xp__bg', xp);
    var touchMQ = matchMedia('(hover:none),(pointer:coarse),(max-width:900px)');
    var active = null, leaveTimer = null, loaded = false;

    function loadImages() {
      if (loaded) return;
      loaded = true;
      bgs.forEach(function (f) {
        $$('source, img', f).forEach(function (n) {    // sources first, so the img picks from them
          if (n.dataset.srcset) n.srcset = n.dataset.srcset;
          if (n.dataset.src) n.src = n.dataset.src;
        });
      });
    }
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) loadImages(); }, { rootMargin: '50% 0px' }).observe(xp);

    function setActive(key) {
      if (key === active) return;
      active = key;
      items.forEach(function (it) { it.classList.toggle('is-active', it.getAttribute('data-key') === key); });
      bgs.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-key') === key); });
      xp.classList.toggle('has-active', !!key);
      xp.classList.toggle('is-lit', !!key);
      requestNav();
    }

    // desktop: hover a phrase
    items.forEach(function (it) {
      var key = it.getAttribute('data-key');
      $('.xp__phrase', it).addEventListener('pointerenter', function () {
        if (touchMQ.matches) return;
        clearTimeout(leaveTimer);
        setActive(key);
      });
      it.addEventListener('click', function () { if (touchMQ.matches) setActive(key); });
    });
    $('.xp__list', xp).addEventListener('pointerleave', function () {
      if (touchMQ.matches) return;
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(function () { setActive(null); }, 260);
    });

    // touch and narrow screens: the phrase crossing the middle of the screen is active
    var centerIO = new IntersectionObserver(function (es) {
      if (!touchMQ.matches) return;
      es.forEach(function (e) { if (e.isIntersecting) setActive(e.target.getAttribute('data-key')); });
    }, { rootMargin: '-46% 0px -46% 0px' });
    items.forEach(function (it) { centerIO.observe(it); });
    new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting && touchMQ.matches) setActive(null);
    }).observe(xp);

    touchMQ.addEventListener('change', function () { setActive(null); });
  }

  /* ---------- 04 the invitation ---------- */
  function initInvite() {
    var sec = $('.invite');
    if (!sec) return;
    var canvas = $('canvas', sec);
    var dateBox = $('.invite__date', sec);
    var dates = $$('.reg', dateBox);
    dates.forEach(buildReg);
    var liquid = null, played = false, mounting = false;
    var SEP_OPEN = 28, SEP_REST = 8;

    function mount() {
      if (liquid || mounting) return;
      mounting = true;
      fontsReady.then(function () {
        if (!window.NGLiquid || !canvas) { doc.classList.add('no-webgl'); return; }
        liquid = window.NGLiquid.mount(canvas, {
          sep: (played || reduced) ? SEP_REST : SEP_OPEN,
          time: 14,
          frameY: [0.12, 0.86]
        });
        if (!liquid) { doc.classList.add('no-webgl'); return; }
        if (!reduced) liquid.play();
      });
    }

    new IntersectionObserver(function (es) { if (es[0].isIntersecting) mount(); }, { rootMargin: '60% 0px' }).observe(canvas);
    new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting || played) return;
      played = true;
      dates.forEach(function (d, i) { regPlay(d, i * 180); });
      if (liquid) liquid.setSep(SEP_REST);
    }, { threshold: 0.45 }).observe(dateBox);

    onMotionChange(function () {
      if (!liquid) return;
      if (reduced) { liquid.pause(); liquid.setSep(SEP_REST, true); }
      else liquid.play();
      if (reduced) dates.forEach(regReset);
    });
  }

  /* ---------- 06 who nextgen is for ---------- */
  // One composition: the 17—29 headline hands off to the numerals behind the portraits (--p),
  // a turquoise thread draws 01 → 02 → 03 → the ending, and one portrait at a time comes alive
  // while the others make room for it.
  function initGen() {
    var gen = $('.gen');
    if (!gen) return;
    var range = $('.gen__range .reg', gen);
    if (range) {
      buildReg(range);
      new IntersectionObserver(function (es, io) {
        if (!es[0].isIntersecting) return;
        regPlay(range, 200);
        io.disconnect();
      }, { threshold: 0.5 }).observe(range);
    }

    var set = $('.gen__set', gen);
    if (!set) return;
    var stages = $$('.gen__stage', set);
    var art = $('.gen__art', gen);
    var end = $('.gen__end', gen);
    var path = $('.gen__thread path', gen);
    var hoverMQ = matchMedia('(hover:hover) and (pointer:fine)');

    /* --- the active portrait, and the others yielding to it --- */
    var active = null, leaveT = null;
    function setActive(st) {
      if (reduced) st = null;
      if (st === active) return;
      active = st;
      var ai = stages.indexOf(st);
      stages.forEach(function (s, i) {
        s.classList.toggle('is-active', s === st);
        s.classList.toggle('is-before', !!st && i < ai);
        s.classList.toggle('is-after', !!st && i > ai);
      });
      set.classList.toggle('has-active', !!st);
    }
    function settle() {                       // after hover or focus leaves, keep whatever still holds it
      clearTimeout(leaveT);
      leaveT = setTimeout(function () {
        var focused = stages.filter(function (s) { return s.contains(document.activeElement); })[0];
        var hovered = hoverMQ.matches && stages.filter(function (s) { return s.matches(':hover'); })[0];
        if (focused || hovered) setActive(focused || hovered);
        else if (hoverMQ.matches) setActive(null);
        else pickCentered();
      }, 90);
    }
    stages.forEach(function (st) {
      st.addEventListener('pointerenter', function () {
        if (!hoverMQ.matches) return;
        clearTimeout(leaveT);
        setActive(st);
      });
      st.addEventListener('pointerleave', function () { if (hoverMQ.matches) settle(); });
      st.addEventListener('focusin', function () { clearTimeout(leaveT); setActive(st); });
      st.addEventListener('focusout', settle);
    });

    // touch: while the collage crosses the middle of the screen, its first, second and last thirds
    // hand the active state 01 → 02 → 03 (works stacked, two-row and side by side alike)
    function pickCentered() {
      if (hoverMQ.matches) return;
      var r = set.getBoundingClientRect(), mid = window.innerHeight / 2, best = null;
      if (r.top < mid && r.bottom > mid) {
        best = stages[Math.min(stages.length - 1, Math.floor((mid - r.top) / r.height * stages.length))];
      }
      if (!best && stages.some(function (s) { return s.contains(document.activeElement); })) return;
      setActive(best);
    }

    /* --- the thread: an elbowed 1px line from label to label, routed through the gaps --- */
    var threadLen = 0;
    function box(el) {                        // layout box relative to the section, ignoring transforms
      var x = 0, y = 0, n = el;
      while (n && n !== gen) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { l: x, t: y, r: x + el.offsetWidth, b: y + el.offsetHeight, cy: y + el.offsetHeight / 2 };
    }
    function elbow(sx, sy, xv, ey, ex) {      // horizontal, vertical, horizontal, with soft corners
      var d1 = xv > sx ? 1 : -1, dy = ey > sy ? 1 : -1, d2 = ex > xv ? 1 : -1;
      var r = Math.max(0, Math.min(10, Math.abs(xv - sx), Math.abs(ey - sy) / 2, Math.abs(ex - xv)));
      var p = 'M' + sx + ' ' + sy + 'L' + (xv - d1 * r) + ' ' + sy + 'Q' + xv + ' ' + sy + ' ' + xv + ' ' + (sy + dy * r) +
              'L' + xv + ' ' + (ey - dy * r);
      return p + (Math.abs(ex - xv) < 1 ? '' : 'Q' + xv + ' ' + ey + ' ' + (xv + d2 * r) + ' ' + ey + 'L' + ex + ' ' + ey);
    }
    function link(a, b, fa, fb) {             // label a to label b
      if (b.l - a.r >= 40) {                  // b sits to the right: leave a's end, climb in the gap, arrive at b
        var sx = a.r + 12, ex = b.l - 10;
        var xv = (fa && fb && fa.r < fb.l) ? (fa.r + fb.l) / 2 : (sx + ex) / 2;
        return elbow(sx, a.cy, Math.min(xv, ex), b.cy, ex);
      }
      if (a.l - b.r >= 40) {                  // b sits to the left: mirror it
        var sx2 = a.l - 12, ex2 = b.r + 12;
        var xv2 = (fa && fb && fb.r < fa.l) ? (fb.r + fa.l) / 2 : (sx2 + ex2) / 2;
        return elbow(sx2, a.cy, Math.max(xv2, ex2), b.cy, ex2);
      }
      var xv3 = Math.max(a.r, b.r, fb ? fb.r : 0) + 16;   // stacked: step out past both (and b's photo), come back to b
      return elbow(a.r + 12, a.cy, xv3, b.cy, b.r + 12);
    }
    function drop(x, y, ey, ex) {             // vertical, then horizontal, with a soft corner
      var dy = ey > y ? 1 : -1, dx = ex > x ? 1 : -1;
      var r = Math.max(0, Math.min(10, Math.abs(ey - y) / 2, Math.abs(ex - x)));
      return 'M' + x + ' ' + y + 'L' + x + ' ' + (ey - dy * r) + 'Q' + x + ' ' + ey + ' ' + (x + dx * r) + ' ' + ey + 'L' + ex + ' ' + ey;
    }
    function toEnd(st, kicker) {              // from under the last caption down to the ending's label
      var s = box(st), k = box(kicker), tag = box($('.gen__tag', st));
      var x0 = tag.l + 4, y0 = s.b + 14;
      if (k.l - x0 >= 40) return drop(x0, y0, k.cy, k.l - 10);
      if (x0 - k.r >= 40) return drop(x0, y0, k.cy, k.r + 12);
      return 'M' + (k.l + 4) + ' ' + y0 + 'L' + (k.l + 4) + ' ' + (k.t - 12);
    }
    function buildThread() {
      if (!path) return;
      var tags = stages.map(function (s) { return box($('.gen__tag', s)); });
      var frames = stages.map(function (s) { return box(s.firstElementChild); });
      var d = link(tags[0], tags[1], frames[0], frames[1]) + link(tags[1], tags[2], frames[1], frames[2]);
      var kicker = $('.gen__end-kicker', gen);
      if (kicker) d += toEnd(stages[2], kicker);
      path.setAttribute('d', d);
      threadLen = path.getTotalLength();
      path.style.strokeDasharray = threadLen + ' ' + threadLen;
      paint();
    }

    /* --- scroll: one rAF-throttled passive listener, only while the section is on screen --- */
    var onScreen = false, raf = null;
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function paint() {
      raf = null;
      var vh = window.innerHeight;
      if (reduced) {
        gen.style.removeProperty('--p');
        if (path) path.style.strokeDashoffset = '0';
        return;
      }
      // --p: 0 while 17—29 sits in view, 1 once it has handed off to the portraits
      pickCentered();
      var anchor = range || $('.gen__title', gen);
      var rt = anchor ? anchor.getBoundingClientRect().top : 0;
      gen.style.setProperty('--p', clamp01((vh * 0.35 - rt) / (vh * 0.55)).toFixed(3));
      // the thread draws as the collage passes, finishing as the ending arrives
      if (path && threadLen) {
        var a = art.getBoundingClientRect(), e = (end || art).getBoundingClientRect();
        var q = clamp01((vh * 0.85 - a.top) / Math.max(1, e.bottom - a.top));
        path.style.strokeDashoffset = (threadLen * (1 - q)).toFixed(1);
      }
    }
    function request() { if (raf === null && onScreen) raf = requestAnimationFrame(paint); }
    new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; request(); }, { rootMargin: '25% 0px' }).observe(gen);
    addEventListener('scroll', request, { passive: true });
    new ResizeObserver(buildThread).observe(gen);
    fontsReady.then(buildThread);

    hoverMQ.addEventListener('change', function () { setActive(null); pickCentered(); });
    onMotionChange(function () {
      if (reduced) setActive(null); else pickCentered();
      paint();
    });
  }

  /* ---------- 07 finale ---------- */
  function initFinale() {
    var t = $('.finale__title .reg');
    if (!t) return;
    buildReg(t);
    new IntersectionObserver(function (es, io) {
      if (!es[0].isIntersecting) return;
      regPlay(t, 120);
      io.disconnect();
    }, { threshold: 0.6 }).observe(t);
  }

  /* ---------- utilities: drawers ---------- */
  function initDialogs() {
    var dialogs = {};
    $$('dialog.drawer').forEach(function (d) {
      dialogs[d.id] = d;
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
      // browsers close a modal dialog on Escape themselves; this covers the non-modal fallback too
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); d.close(); } });
      d.addEventListener('close', function () {
        if (location.hash === '#' + d.id) history.replaceState(null, '', location.pathname + location.search);
      });
    });

    function open(id) {
      var d = dialogs[id];
      if (!d) return;
      Object.keys(dialogs).forEach(function (k) { if (k !== id && dialogs[k].open) dialogs[k].close(); });
      if (!d.open) {
        if (typeof d.showModal === 'function') d.showModal();
        else d.setAttribute('open', '');
      }
      if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    }

    document.addEventListener('click', function (e) {
      var opener = e.target.closest('[data-open]');
      if (opener) {
        e.preventDefault();
        open(opener.getAttribute('data-open'));
        return;
      }
      var closer = e.target.closest('[data-close]');
      if (closer) {
        var d = closer.closest('dialog');
        if (d) d.close();
      }
    });

    function fromHash() {
      var id = location.hash.slice(1);
      if (dialogs[id]) open(id);
    }
    addEventListener('hashchange', fromHash);
    fromHash();
  }

  /* ---------- utilities: forms, saved by /api/register.php without leaving the page ---------- */
  // On file:// or a plain local preview server there is no PHP to receive the post, so the preview
  // shows the success state and says plainly that nothing was sent.
  var FORM_ENDPOINT = '/api/register.php';
  var LOCAL_PREVIEW = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  function sendForm(form) {
    if (LOCAL_PREVIEW) return new Promise(function (res) { setTimeout(res, 450); });
    return fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams(new FormData(form)).toString()
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.ok && data.ok) return;
        var err = new Error('Form post failed with ' + r.status);
        err.userMessage = data.error || '';
        throw err;
      });
    });
  }

  function setBusy(btn, on) {
    var t = $('.btn__t', btn);
    btn.disabled = on;
    if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
    if (!t) return;
    if (on) { t.__label = t.textContent; t.textContent = 'Sending'; }
    else if (t.__label) t.textContent = t.__label;
  }

  function firstName(v) { return (v || '').trim().split(/\s+/)[0] || 'friend'; }

  function showError(err, text) {
    if (!err) return;
    err.textContent = text;
    err.hidden = false;
  }

  function initForms() {
    $$('[data-expand]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.getAttribute('aria-controls'));
        if (!target) return;
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        target.hidden = open;
        if (!open) {
          var first = $('input:not([type=hidden]):not([name=bot-field])', target);
          if (first) first.focus();
        }
      });
    });

    // volunteer and partner notes
    $$('form.mini').forEach(function (form) {
      var btn = $('button[type=submit]', form);
      var err = $('.form__error', form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (err) err.hidden = true;
        setBusy(btn, true);
        sendForm(form).then(function () {
          var done = el('div', 'mini__done');
          done.setAttribute('role', 'status');
          done.tabIndex = -1;
          done.id = form.id;
          done.appendChild(document.createTextNode('Thanks, ' + firstName(form.elements.name.value) + '. We received your note and will reach out at ' + form.elements.email.value.trim() + '.'));
          if (LOCAL_PREVIEW) done.appendChild(el('small', null, 'Local preview: nothing was sent. This form works once the site is live.'));
          form.replaceWith(done);
          done.focus();
        }).catch(function (e) {
          setBusy(btn, false);
          showError(err, (e && e.userMessage) || "That didn't go through. Please check your connection and try again.");
        });
      });
    });

    initRegistration();
  }

  // Drives the waitlist form, or the paused registration form if it is restored in index.html.
  function initRegistration() {
    var form = $('form[name="waitlist"]') || $('form[name="registration"]');
    if (!form) return;
    var dialog = form.closest('dialog');
    var wrap = $('[data-form-wrap]', dialog);
    var done = $('[data-form-done]', dialog);
    var btn = $('button[type=submit]', form);
    var err = $('.form__error', form);
    var school = form.elements.school_name;
    var schoolHint = $('[data-school-hint]', form);
    var mark = $('.done__title .reg', done);
    if (mark) buildReg(mark);

    // registration form only: school becomes optional for "Other" (the waitlist has no school question)
    function syncSchool() {
      if (!school || !form.elements.education_level) return;
      var other = form.elements.education_level.value === 'Other';
      school.required = !other;
      if (schoolHint) schoolHint.hidden = !other;
    }
    $$('input[name="education_level"]', form).forEach(function (i) { i.addEventListener('change', syncSchool); });
    syncSchool();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var who = {
        first: firstName((form.elements.first_name || form.elements.name).value),
        email: form.elements.email.value.trim(),
        volunteer: !!form.elements.volunteer_interest && form.elements.volunteer_interest.value === 'Yes'
      };
      setBusy(btn, true);
      sendForm(form).then(function () {
        $('[data-done-name]', done).textContent = who.first;
        $('[data-done-email]', done).textContent = who.email;
        var vol = $('[data-done-volunteer]', done);
        if (vol) vol.hidden = !who.volunteer;
        $('[data-done-local]', done).hidden = !LOCAL_PREVIEW;
        wrap.hidden = true;
        done.hidden = false;
        dialog.scrollTop = 0;
        done.focus();
        if (mark) regPlay(mark, 120);
        form.reset();
        syncSchool();
      }).catch(function (e) {
        showError(err, (e && e.userMessage) || "Your registration didn't go through. Please check your connection and try again.");
        err.focus();
      }).then(function () {
        setBusy(btn, false);
      });
    });

    $('[data-form-again]', done).addEventListener('click', function () {
      done.hidden = true;
      wrap.hidden = false;
      dialog.scrollTop = 0;
      (form.elements.first_name || form.elements.name).focus();
    });
  }

  /* ---------- motion preference, live in both directions ---------- */
  function initMotionPrefs() {
    doc.classList.toggle('is-reduced', reduced);
    reduceMQ.addEventListener('change', function (e) {
      reduced = e.matches;
      doc.classList.toggle('is-reduced', reduced);
      if (reduced) {
        $$('.rv').forEach(function (n) { n.classList.add('in', 'settled'); });
        $$('.reg').forEach(regReset);
      }
      motionHooks.forEach(function (fn) { fn(); });
    });
    document.addEventListener('visibilitychange', function () {
      document.body.classList.toggle('paused', document.hidden);
    });
  }

  initMotionPrefs();
  initNav();
  initCountdown();
  initHero();
  initReveals();
  initRotator();
  initExperience();
  initInvite();
  initGen();
  initFinale();
  initDialogs();
  initForms();
})();
