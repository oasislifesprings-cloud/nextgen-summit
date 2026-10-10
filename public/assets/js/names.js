/* NextGen Summit — who's coming: opted-in attendee names on the live tally card.
   The names arrive with the live count: counter.js fires "ngs:tally" with each reply from
   /api/attendee-count.php, whose "names" lists first name and last initial ("Maya R."), each name
   once, newest first (opt-in check temporarily off there: everyone is listed). Once there is at least
   one, they take the dot crowd's place on the card (.tally.has-names); with none, the dots stay.

   Two designs on trial, flipped by the switch (keep one, delete the other's view and the switch):
     [data-names="badge"]  a name badge on a lanyard; each name prints onto it and gets stamped
     [data-names="book"]   a guest book; each name signs itself in on the next ruled line

   Names turn over only while the card is on screen and the tab is open; Pause holds them, and
   with reduced motion nothing turns by itself. Screen readers get the names once, as a list.

   Preview: on localhost (or with ?names=demo) sample names stand in, marked "Sample names" so
   they are never mistaken for real attendees. They never leave the browser. */
(function () {
  'use strict';

  var box = document.querySelector('[data-names-box]');
  var tally = document.querySelector('[data-tally]');
  if (!box || !tally) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var host = location.hostname;
  var demo = /(?:^|[?&])names=demo(?:&|$)/.test(location.search) ||
    location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  var SAMPLE = ['Maya R.', 'Jordan T.', 'Aaliyah M.', 'Diego S.', 'Priya K.', 'Marcus J.', 'Sofia L.',
    'Kwame A.', 'Hannah B.', 'Elijah W.', 'Mei C.', 'Isaiah D.', 'Zainab O.', 'Maria-Guadalupe R.',
    'Lucas P.', 'Anaya H.'];

  var names = [];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- A: the name badge ---------- */
  function badge(view) {
    var hang = view.querySelector('.nb__hang');
    var slot = view.querySelector('.nb__names');
    var stamp = view.querySelector('.nb__stamp');
    var cur = null, idx = 0, ts = [], shown = null;

    function later(fn, ms) { ts.push(setTimeout(fn, ms)); }
    function make(name) {
      var p = el('p', 'nb__name reg');
      ['reg__k', 'reg__p reg__p--c', 'reg__p reg__p--m', 'reg__p reg__p--y'].forEach(function (c) { p.appendChild(el('span', c, name)); });
      return p;
    }
    // one line, always: a long name is set smaller rather than wrapped or cut
    function fit(p) {
      p.style.fontSize = '';
      var room = slot.clientWidth, w = p.scrollWidth;
      if (w > room && room > 0) p.style.fontSize = (room / w * 0.98).toFixed(3) + 'em';
    }
    function put(name) {
      ts.forEach(clearTimeout); ts = [];
      shown = name;
      slot.textContent = '';
      cur = make(name);
      slot.appendChild(cur);
      fit(cur);
      stamp.classList.remove('is-lift', 'is-hit');
    }
    function print(name) {
      ts.forEach(clearTimeout); ts = [];
      shown = name;
      var p = make(name);
      p.classList.add('is-pre');
      slot.appendChild(p);
      fit(p);
      if (cur) {
        var old = cur;
        old.classList.add('is-out');
        later(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 700);
      }
      cur = p;
      stamp.classList.remove('is-hit');
      stamp.classList.add('is-lift');
      hang.classList.remove('is-swing');
      void hang.offsetWidth;
      hang.classList.add('is-swing');
      // the name lands misregistered and its C, M and Y plates settle into black (site.css .reg)
      later(function () {
        p.classList.remove('is-pre');
        p.classList.add('is-armed');
        void p.offsetWidth;
        later(function () { p.classList.add('is-in'); }, 60);
        later(function () { p.classList.add('is-done'); }, 1760);
      }, 30);
      later(function () { stamp.classList.remove('is-lift'); stamp.classList.add('is-hit'); }, 950);
    }

    // refit whenever the slot changes size, including when the card first appears
    if ('ResizeObserver' in window) new ResizeObserver(function () { if (cur) fit(cur); }).observe(slot);
    else addEventListener('resize', function () { if (cur) fit(cur); });
    return {
      every: 3600,
      turns: function () { return names.length > 1; },
      reset: function () { idx = 0; put(names[0]); },
      next: function () { idx = (idx + 1) % names.length; print(names[idx]); },
      // a fresh list carries on from the name on the badge, so everyone gets a turn before any repeat
      follow: function () {
        var i = names.indexOf(shown);
        if (i >= 0) idx = i;
        else if (cur) idx = Math.min(idx, names.length - 1);
        else this.reset();
      },
      refit: function () { if (cur) fit(cur); }
    };
  }

  /* ---------- B: the guest book ---------- */
  function book(view) {
    var ol = view.querySelector('.gb__lines');
    var SHOW = 4;                                       // lines on the sheet; the oldest drops off the top
    var idx = 0, shown = null;

    function line(name, write) {
      shown = name;
      var li = el('li', 'gb__line');
      var wrap = el('span', 'gb__sigwrap');
      wrap.appendChild(el('span', 'gb__sig', name));
      wrap.appendChild(el('span', 'gb__nib'));
      var ready = el('span', 'gb__ready', 'is ready for ');
      ready.appendChild(el('b', null, 'NextGen Summit'));
      ready.appendChild(document.createTextNode('.'));
      li.appendChild(wrap);
      li.appendChild(ready);
      if (write && !reduce.matches) {
        // about a tenth of a second a letter, as a quick hand signs
        var t = Math.max(0.8, Math.min(1.9, name.length * 0.1));
        li.style.setProperty('--t', t + 's');
        li.classList.add('is-pre');
        ol.appendChild(li);
        void li.offsetWidth;
        requestAnimationFrame(function () {
          li.classList.remove('is-pre');
          li.classList.add('is-write');
          setTimeout(function () { li.classList.add('is-signed'); }, t * 1000 + 120);
        });
      } else {
        ol.appendChild(li);
      }
      while (ol.children.length > SHOW) ol.removeChild(ol.firstChild);
    }

    return {
      every: 3400,
      // with only a few names the sheet simply lists them all
      turns: function () { return names.length > SHOW - 1; },
      reset: function () {
        ol.textContent = '';
        var first = Math.min(names.length, SHOW - 1);
        for (var i = 0; i < first; i++) line(names[i], false);
        idx = first - 1;
      },
      next: function () { idx = (idx + 1) % names.length; line(names[idx], true); },
      // a fresh list carries on from the last signature on the sheet
      follow: function () {
        var i = names.indexOf(shown);
        if (i >= 0) idx = i;
        else if (ol.children.length) idx = Math.min(idx, names.length - 1);
        else this.reset();
      },
      refit: function () {}
    };
  }

  /* ---------- the clock, the switch and the pause ---------- */
  var views = {};
  Array.prototype.forEach.call(box.querySelectorAll('[data-names]'), function (v) {
    var kind = v.getAttribute('data-names');
    views[kind] = { node: v, run: kind === 'badge' ? badge(v) : book(v) };
  });
  var kinds = Object.keys(views);
  if (!kinds.length) return;
  var picks = box.querySelectorAll('[data-names-pick]');
  var active = views.badge ? 'badge' : kinds[0];
  var toggle = box.querySelector('[data-names-toggle]');
  var sr = box.querySelector('[data-names-sr]');
  var demoEl = box.querySelector('[data-names-demo]');
  var visible = false, seen = false, paused = false, timer = null;

  function run() { return views[active].run; }
  function canRun() { return visible && !paused && !reduce.matches && !document.hidden && run().turns(); }
  function schedule(ms) {
    clearTimeout(timer);
    timer = null;
    if (canRun()) timer = setTimeout(function () { run().next(); schedule(); }, ms || run().every);
  }
  function pick(kind) {
    if (!views[kind]) return;
    active = kind;
    kinds.forEach(function (k) { views[k].node.hidden = k !== kind; });
    Array.prototype.forEach.call(picks, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-names-pick') === kind)); });
    if (names.length) { run().reset(); schedule(500); }   // the next name at once, so the design is seen
  }
  function setPaused(on) {
    paused = on;
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(on));
      toggle.setAttribute('aria-label', on ? 'Play the names' : 'Pause the names');
      toggle.querySelector('.toggle__t').textContent = on ? 'Play' : 'Pause';
    }
    schedule();
  }

  Array.prototype.forEach.call(picks, function (b) {
    b.addEventListener('click', function () { pick(b.getAttribute('data-names-pick')); });
  });
  if (toggle) {
    toggle.addEventListener('click', function () { setPaused(!paused); });
    toggle.hidden = reduce.matches;
  }
  if (reduce.addEventListener) reduce.addEventListener('change', function () { if (toggle) toggle.hidden = reduce.matches; schedule(); });
  document.addEventListener('visibilitychange', function () { schedule(); });
  new IntersectionObserver(function (es) {
    visible = es[0].isIntersecting;
    if (visible && !seen && names.length) { seen = true; schedule(500); return; }
    schedule();
  }, { threshold: 0.3 }).observe(box);

  function use(list) {
    // each name once (the API already does this; a group order would otherwise repeat the buyer)
    var seenName = {};
    list = Array.isArray(list) ? list.filter(function (s) {
      if (typeof s !== 'string' || !s.trim()) return false;
      var k = s.trim().toLowerCase();
      if (seenName[k]) return false;
      seenName[k] = true;
      return true;
    }) : [];
    if (!list.length) {
      names = [];
      box.hidden = true;
      tally.classList.remove('has-names');
      clearTimeout(timer);
      timer = null;
      return;
    }
    var changed = list.join('|') !== names.join('|');
    var opening = box.hidden;
    names = list;
    box.hidden = false;
    tally.classList.add('has-names');
    if (demoEl) demoEl.hidden = !demo;
    if (sr) {
      var few = names.slice(0, 12).join(', ');
      sr.textContent = ('Some of the people coming: ' + few + (names.length > 12 ? ', and ' + (names.length - 12) + ' more.' : '.')).replace(/\.\.$/, '.');
    }
    // a changed list (every few minutes) carries on where it was; the same list leaves the clock alone,
    // so the ten-second refresh never holds a name longer or restarts the run
    if (opening) { run().reset(); schedule(); }
    else if (changed) { kinds.forEach(function (k) { views[k].run.follow(); }); if (!timer) schedule(); }
    else if (!timer) schedule();
  }

  pick(active);
  if (demo) use(SAMPLE);
  else document.addEventListener('ngs:tally', function (e) { use((e.detail || {}).names); });
})();
