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

    /* the observer's word, checked against the layout: an observer can report a stale state while
       the page is still settling, and the sequence must not stall on it */
    function looking() { var r = fb.getBoundingClientRect(), h = window.innerHeight; return seen || (r.bottom > h * 0.2 && r.top < h * 0.8); }
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
      if (paused || !looking() || document.hidden) { running = false; return; }
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
          if (paused || !looking() || document.hidden) { running = false; return; }
          i = n; show(i); timer = setTimeout(step, HOLD);
        });
      }, FADE + DARK);
    }
    function resume() { if (!running && !paused && looking() && !document.hidden && !timer) { running = true; timer = setTimeout(step, HOLD); } }
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

  /* ---------- NextGen 2026: the pitch stage ----------
     The homepage's People's Choice stage, as an archive: the film behind the words is the pitch of the
     founder chosen in the rail, all twenty of them, and no place or ranking is shown. Two layers cross-fade
     and the outgoing one gives up its source, so no more than two films are ever loaded (the iOS limit the
     founder reels learned). Nothing loads until the section is near. Each portrait is a link to its film,
     so without script it simply opens the video. */
  var st = document.querySelector('[data-stage]');
  if (st) {
    var layers = st.querySelectorAll('[data-st-layer]');
    var bubs = Array.prototype.slice.call(st.querySelectorAll('[data-st-pick]'));
    var nowEl = st.querySelector('[data-st-now]');
    var sBtn = st.querySelector('[data-st-sound]'), pBtn = st.querySelector('[data-st-pause]');
    var conn = navigator.connection || navigator.webkitConnection || null;
    var thrifty = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));
    var front = 0, live = bubs[0], muted = true, held = still(), seen = false, near = false;
    var PAUSE = '<path d="M8 5.5v13M16 5.5v13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';
    var PLAY = '<path d="M8 5.2v13.6L19 12z" fill="currentColor"/>';
    var fore = function () { return layers[front]; };
    var vOf = function (l) { return l.querySelector('video'); };
    function fit(l) {
      var v = vOf(l), r = st.getBoundingClientRect();
      if (!v || !v.videoWidth || !r.width) return;
      var k = (v.videoWidth / v.videoHeight) / (r.width / r.height);
      l.setAttribute('data-fit', k > 0.82 && k < 1.25 ? 'cover' : 'contain');
    }
    /* the observer can report the stage as visible before the page has settled; ask the layout itself
       so a stage still below the fold never starts a download */
    function onScreen() { var r = st.getBoundingClientRect(), h = window.innerHeight; return r.top < h * 0.8 && r.bottom > h * 0.2; }
    function run(v) {
      if (!v || held || !seen || !onScreen()) return;
      /* the film is attached only when it is about to play, so a stage that is merely near costs a poster */
      if (!v.getAttribute('src') && v.getAttribute('data-src')) v.src = v.getAttribute('data-src');
      v.muted = muted;
      var p = v.play();
      if (p && p.catch) p.catch(function () {
        v.addEventListener('canplay', function () { if (!held && seen) { var q = v.play(); if (q && q.catch) q.catch(function () {}); } }, { once: true });
      });
    }
    function paint() {
      sBtn.setAttribute('aria-pressed', muted ? 'false' : 'true');
      sBtn.querySelector('[data-st-sound-t]').textContent = muted ? 'Watch with sound' : 'Turn the sound off';
      pBtn.setAttribute('aria-pressed', held ? 'true' : 'false');
      pBtn.querySelector('[data-st-pause-t]').textContent = held ? 'Play the film' : 'Pause the film';
      pBtn.querySelector('[data-st-pause-i]').innerHTML = held ? PLAY : PAUSE;
    }
    function show(a) {
      var back = layers[front ? 0 : 1], out = fore(), poster = a.getAttribute('data-poster');
      back.setAttribute('data-fit', 'cover');
      back.innerHTML = '<div class="pcs__bg"></div><img class="pcs__still" alt="" decoding="async"><video class="pcs__fg" playsinline muted loop preload="none" tabindex="-1"></video>';
      back.querySelector('.pcs__bg').style.backgroundImage = 'url("' + poster + '")';
      back.querySelector('.pcs__still').src = poster;
      var v = vOf(back);
      if (!thrifty) {
        v.setAttribute('data-src', a.getAttribute('href'));
        v.addEventListener('playing', function () { back.classList.add('is-playing'); }, { once: true });
        v.addEventListener('loadedmetadata', function () { fit(back); }, { once: true });
        run(v);
      }
      back.classList.add('is-on');
      out.classList.remove('is-on');
      setTimeout(function () {
        if (out === fore()) return;            // switched back to this layer since: it is live again
        var ov = vOf(out);
        if (ov) { try { ov.pause(); ov.removeAttribute('src'); ov.load(); } catch (e) {} }
        out.classList.remove('is-playing');
      }, still() ? 0 : 950);
      front = front ? 0 : 1;
      bubs.forEach(function (b) { if (b === a) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      if (a !== live) {
        live = a;
        nowEl.classList.add('is-turning');
        setTimeout(function () {
          nowEl.innerHTML = '<span class="pcs__now-co"></span><span class="pcs__now-by"></span>';
          nowEl.firstChild.textContent = a.getAttribute('data-co');
          nowEl.lastChild.textContent = a.getAttribute('data-who');
          nowEl.classList.remove('is-turning');
        }, still() ? 0 : 180);
      }
    }
    bubs.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        held = false; paint();
        if (a === live && vOf(fore())) { run(vOf(fore())); return; }
        show(a);
      });
    });
    /* hover changes the film on a mouse, after a short beat so sweeping across the rail does not
       start twenty downloads; never on touch, where a tap fires a hover first */
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var hov;
      bubs.forEach(function (a) {
        a.addEventListener('pointerenter', function (e) {
          if (e.pointerType !== 'mouse') return;
          clearTimeout(hov);
          hov = setTimeout(function () { if (a !== live) show(a); }, 260);
        });
        a.addEventListener('pointerleave', function () { clearTimeout(hov); });
      });
    }
    sBtn.addEventListener('click', function () {
      muted = !muted;
      var v = vOf(fore());
      if (!muted) { held = false; if (v) { try { v.currentTime = 0; } catch (e) {} } }
      if (v) v.muted = muted;
      paint();
      run(v);
    });
    pBtn.addEventListener('click', function () {
      held = !held;
      var v = vOf(fore());
      if (held) { if (v) v.pause(); } else run(v);
      paint();
    });
    sBtn.hidden = false; pBtn.hidden = false;
    paint();
    var refit;
    window.addEventListener('resize', function () { clearTimeout(refit); refit = setTimeout(function () { fit(fore()); }, 180); }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      var v = vOf(fore());
      if (!v) return;
      if (document.hidden) v.pause(); else run(v);
    });
    if ('IntersectionObserver' in window) {
      /* load when a screen and a half away; play only while at least a sliver is on screen */
      new IntersectionObserver(function (es, o) {
        if (!es[0].isIntersecting || near) return;
        near = true; o.disconnect();
        show(live);
      }, { rootMargin: '150% 0px 150% 0px' }).observe(st);
      new IntersectionObserver(function (es) {
        seen = es[0].isIntersecting;
        var v = vOf(fore());
        if (!v) return;
        if (seen) run(v); else v.pause();
      }, { threshold: 0.15 }).observe(st);
    } else { seen = true; show(live); }
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
