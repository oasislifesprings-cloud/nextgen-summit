/* NextGen "What's Next" behaviour. Runs after site.js (nav, drawer, reveals).
   Everything here is an enhancement: without JavaScript the hero shows its first photograph, the
   waitlist form posts normally, the music links work and every album photo opens on its own. */
(function () {
  'use strict';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  function still() { return !!(reduced && reduced.matches); }

  /* ---------- Home: the flashbulb ----------
     Five real 2026 photographs, one at a time: a white camera-flash bloom reveals each one, it holds
     for HOLD ms, then fades to dark before the next. With reduced motion: a slow crossfade, no flash.
     The next photograph is decoded before its flash, the sequence rests when the hero is off screen
     or the tab is hidden, and the Pause button stops it for good (WCAG 2.2.2). */
  var fb = document.querySelector('[data-flashbulb]');
  if (fb) {
    var shots = Array.prototype.slice.call(fb.querySelectorAll('.fb__shot'));
    var flash = fb.querySelector('.fb__flash');
    var pauseBtn = fb.querySelector('[data-fb-pause]');
    var HOLD = 4600, DARK = 650, FADE = 800;
    var i = 0, timer = null, paused = false, seen = true, running = false;

    function load(n) {
      var pic = shots[n];
      if (!pic || pic.__ready) return Promise.resolve();
      Array.prototype.forEach.call(pic.querySelectorAll('[data-srcset]'), function (s) { s.srcset = s.getAttribute('data-srcset'); s.removeAttribute('data-srcset'); });
      var img = pic.querySelector('img');
      if (img.getAttribute('data-src')) { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); }
      pic.__ready = true;
      return (img.decode ? img.decode() : Promise.resolve()).catch(function () {});
    }
    function show(n) {
      shots.forEach(function (s, k) { if (k !== n) s.classList.remove('is-on'); });
      shots[n].classList.add('is-on');
      if (!still() && flash) {
        flash.classList.remove('is-pop');
        void flash.offsetWidth;
        flash.classList.add('is-pop');
      }
      load((n + 1) % shots.length);
    }
    function step() {
      timer = null;
      if (paused || !seen || document.hidden) { running = false; return; }
      running = true;
      if (still()) {
        // a crossfade: the next photograph comes up while this one goes
        var n = (i + 1) % shots.length;
        load(n).then(function () { i = n; show(i); timer = setTimeout(step, HOLD + 1400); });
        return;
      }
      shots[i].classList.remove('is-on');                       // fade to dark
      timer = setTimeout(function () {
        var n = (i + 1) % shots.length;
        load(n).then(function () {
          if (paused || !seen || document.hidden) { running = false; return; }
          i = n; show(i); timer = setTimeout(step, HOLD);
        });
      }, FADE + DARK);
    }
    function resume() { if (!running && !paused && seen && !document.hidden && !timer) { running = true; timer = setTimeout(step, HOLD); } }
    function halt() { if (timer) { clearTimeout(timer); timer = null; } running = false; }

    if (shots.length > 1) {
      if (pauseBtn) {
        pauseBtn.hidden = false;
        pauseBtn.addEventListener('click', function () {
          paused = !paused;
          pauseBtn.setAttribute('aria-pressed', String(paused));
          pauseBtn.textContent = paused ? 'Play photos' : 'Pause photos';
          if (paused) { halt(); if (!shots[i].classList.contains('is-on')) shots[i].classList.add('is-on'); } else resume();
        });
      }
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) resume(); else halt(); }, { threshold: 0.2 }).observe(fb);
      }
      document.addEventListener('visibilitychange', function () { if (document.hidden) halt(); else resume(); });
      load(1);
      if (!still() && flash) { flash.classList.add('is-pop'); }      // the first photograph gets its flash too
      fb.setAttribute('data-flashbulb-ready', '');
      resume();
    }
  }

  /* ---------- NextGen 2027: the waitlist, NextGen's own ----------
     Posts to /api/register.php (form-name "waitlist", list 2027): name, email, phone and one or more
     cities. The browser validates the fields; a city is checked here and again on the server. On
     success the chosen cities light up on the map and the form says "Seat saved." */
  Array.prototype.forEach.call(document.querySelectorAll('form[data-waitlist]'), function (form) {
    if (!window.fetch || !window.URLSearchParams || !window.FormData) return;
    var wrap = form.closest('.wl') || form.parentNode;
    var btn = form.querySelector('button[type=submit]');
    var label = btn.querySelector('.btn__t');
    var err = form.querySelector('.wl__err');
    var done = wrap.querySelector('.wl__done');
    var cities = form.querySelector('.wl__cities');
    function fail(msg, fields) {
      err.textContent = msg;
      err.hidden = false;
      var first = null;
      (fields || []).forEach(function (f) {
        if (f === 'cities') { cities.setAttribute('aria-invalid', 'true'); first = first || cities.querySelector('input'); return; }
        var i = form.elements[f];
        if (i && i.setAttribute) { i.setAttribute('aria-invalid', 'true'); first = first || i; }
      });
      if (first) first.focus();
    }
    form.addEventListener('change', function (e) {
      if (e.target.name === 'cities[]' && form.querySelector('input[name="cities[]"]:checked')) { cities.removeAttribute('aria-invalid'); if (!err.hidden && /city/i.test(err.textContent)) err.hidden = true; }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      cities.removeAttribute('aria-invalid');
      Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (i) { i.removeAttribute('aria-invalid'); });
      if (!form.querySelector('input[name="cities[]"]:checked')) { fail('Pick at least one city.', ['cities']); return; }
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      var was = label.textContent;
      label.textContent = 'Saving your seat';
      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: new URLSearchParams(new FormData(form)).toString()
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.ok && d.ok) return;
          var x = new Error('waitlist ' + r.status);
          x.msg = d.error || '';
          x.fields = Array.isArray(d.fields) ? d.fields : [];
          throw x;
        });
      }).then(function () {
        wrap.classList.add('is-saved');
        Array.prototype.forEach.call(form.querySelectorAll('input[name="cities[]"]'), function (c) { c.disabled = true; });
        form.hidden = true;
        done.hidden = false;
        done.focus();
      }).catch(function (x) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        label.textContent = was;
        fail((x && x.msg) || 'That didn’t go through. Please check your connection and try again.', x && x.fields);
      });
    });
  });

  /* ---------- Explore: the Spotify player loads only when asked for ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-embed]'), function (box) {
    var btn = box.querySelector('[data-embed-load]');
    var src = box.getAttribute('data-src') || '';
    if (!btn || !/^https:\/\/open\.spotify\.com\/embed\//.test(src)) return;
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.title = box.getAttribute('data-title') || 'Player';
      f.width = '100%'; f.height = '152';
      f.allow = 'encrypted-media; clipboard-write; picture-in-picture';
      f.src = src;
      box.replaceWith(f);
      f.focus();
    });
  });

  /* ---------- the 2026 photo album: a simple viewer ----------
     Each photo is a link to its full-size file; with JavaScript it opens in a dialog instead, with
     previous, next, the arrow keys and Escape. */
  var grid = document.querySelector('[data-album]');
  var lb = document.getElementById('lightbox');
  if (grid && lb && typeof lb.showModal === 'function') {
    var items = Array.prototype.slice.call(grid.querySelectorAll('a.al__item'));
    var big = lb.querySelector('img');
    var count = lb.querySelector('.lb__n');
    var at = 0, opener = null;
    function open(n) {
      at = (n + items.length) % items.length;
      var a = items[at], im = a.querySelector('img');
      big.classList.remove('is-in');
      big.src = a.href;
      big.alt = im.alt;
      void big.offsetWidth;
      big.classList.add('is-in');
      count.textContent = (at + 1) + ' of ' + items.length;
      if (!lb.open) lb.showModal();
    }
    items.forEach(function (a, n) {
      a.addEventListener('click', function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        opener = a;
        open(n);
      });
    });
    lb.querySelector('.lb__x').addEventListener('click', function () { lb.close(); });
    lb.querySelector('.lb__prev').addEventListener('click', function () { open(at - 1); });
    lb.querySelector('.lb__next').addEventListener('click', function () { open(at + 1); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); open(at - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); open(at + 1); }
    });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb__fig')) lb.close(); });
    lb.addEventListener('close', function () { big.removeAttribute('src'); if (opener) opener.focus(); });
  }

  /* ---------- NextGen 2026: the pitch reel ----------
     Each card is a link to its pitch film, so without script it simply opens the video. With script a
     card loads its film into the screen above and plays it; the arrows scroll the reel a page at a time. */
  var pr = document.querySelector('[data-pitch]');
  if (pr) {
    var vid = pr.querySelector('[data-pr-video]');
    var reel = pr.querySelector('[data-pr-reel]');
    var cards = Array.prototype.slice.call(pr.querySelectorAll('[data-pr-pick]'));
    var nowBox = pr.querySelector('.pr__now');
    var out = { n: pr.querySelector('[data-pr-n]'), co: pr.querySelector('[data-pr-co]'), who: pr.querySelector('[data-pr-who]'), blurb: pr.querySelector('[data-pr-blurb]') };
    var prev = pr.querySelector('[data-pr-prev]'), next = pr.querySelector('[data-pr-next]');
    var total = (cards.length < 10 ? '0' : '') + cards.length;
    function pick(a) {
      cards.forEach(function (c) { c.removeAttribute('aria-current'); });
      a.setAttribute('aria-current', 'true');
      vid.pause();
      vid.poster = a.getAttribute('data-poster');
      vid.src = a.href;
      nowBox.classList.add('is-swap');
      setTimeout(function () {
        out.n.textContent = a.getAttribute('data-n') + ' / ' + total;
        out.co.textContent = a.getAttribute('data-co');
        out.who.textContent = a.getAttribute('data-who');
        out.blurb.textContent = a.getAttribute('data-blurb');
        nowBox.classList.remove('is-swap');
      }, still() ? 0 : 200);
      var r = vid.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) vid.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'center' });
      var p = vid.play();
      if (p && p.catch) p.catch(function () {});
    }
    cards.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        pick(a);
      });
    });
    function ends() {
      prev.disabled = reel.scrollLeft < 8;
      next.disabled = reel.scrollLeft + reel.clientWidth > reel.scrollWidth - 8;
    }
    function page(dir) { reel.scrollBy({ left: dir * reel.clientWidth * 0.8, behavior: still() ? 'auto' : 'smooth' }); }
    prev.addEventListener('click', function () { page(-1); });
    next.addEventListener('click', function () { page(1); });
    reel.addEventListener('scroll', function () { window.requestAnimationFrame(ends); }, { passive: true });
    window.addEventListener('resize', ends);
    ends();
  }

  /* ---------- reveals: blocks below the first screen rise in once as they arrive ----------
     Only on What's Next pages, only below the fold at load, never under reduced motion; without
     script, or if the observer is missing, everything is simply visible. */
  if (document.body.classList.contains('wn') && 'IntersectionObserver' in window && !still()) {
    var rv = document.querySelectorAll('.xv__grid, .road__list li, .xm__in, .xa__in, .faq__t, .faq details, .wl__panel, .ys__in, .al__grid');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(rv, function (el, k) {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add('wn-rv');
      if (el.matches('.road__list li, .faq details')) el.style.transitionDelay = ((k % 4) * 0.07) + 's';
      io.observe(el);
    });
  }
})();
