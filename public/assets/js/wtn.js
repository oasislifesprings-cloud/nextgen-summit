/* "Where To Next?" gateway behaviour. Runs after site.js (nav, drawer, reveals).
   Everything here is an enhancement: without JavaScript every sign is a plain link, the waitlist
   shows its static state, and the chapter rail is a plain list of in-page links.
   This website never links to the 2026 archive (archive.nextgensummit.us is a separate site). */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- homepage hero: the 2026 campaign film over its photograph ----------
     Same rules as the 2026 hero (site.js initHeroFilm): never loaded with reduced motion or Data
     Saver, requested only once the page is idle, shown only when frames are playing, paused when
     the hero is off screen or the tab is hidden. Without JavaScript the photograph stays. */
  var film = document.querySelector('.hh__video');
  if (film) {
    var saver = navigator.connection && navigator.connection.saveData;
    if (saver || (reduced && reduced.matches) || typeof film.play !== 'function') film.remove();
    else {
      var filmSeen = true;
      film.muted = true;
      film.addEventListener('playing', function () { film.classList.add('is-playing'); });
      film.addEventListener('error', function () { film.remove(); });
      var syncFilm = function () {
        if (filmSeen && !document.hidden) { var pl = film.play(); if (pl && pl.catch) pl.catch(function () {}); }
        else film.pause();
      };
      var startFilm = function () {
        film.preload = 'auto';
        film.src = film.getAttribute('data-src');
        syncFilm();
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(function (es) { filmSeen = es[0].isIntersecting; syncFilm(); }).observe(film.closest('section') || film);
        }
        document.addEventListener('visibilitychange', syncFilm);
      };
      var filmStarted = false;
      var whenIdle = function () {
        if (filmStarted) return;
        filmStarted = true;
        (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(startFilm, { timeout: 1500 });
      };
      if (document.readyState === 'complete') whenIdle();
      else { window.addEventListener('load', whenIdle, { once: true }); setTimeout(whenIdle, 3500); }
    }
  }

  /* ---------- 2026 Moments: mark the chapter in view on the rail ---------- */
  var rail = document.querySelector('.mo-rail');
  if (rail && 'IntersectionObserver' in window) {
    var links = {};
    Array.prototype.forEach.call(rail.querySelectorAll('a[href^="#"]'), function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || !links[e.target.id]) return;
        Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
        var a = links[e.target.id];
        a.setAttribute('aria-current', 'location');
        // keep the marked chapter visible on a narrow rail, without moving the page
        var list = a.parentNode.parentNode;
        list.scrollTo({ left: a.offsetLeft - 16, behavior: reduced && reduced.matches ? 'auto' : 'smooth' });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('[data-chapter]'), function (s) { io.observe(s); });
  }

  /* ---------- Explore: the Spotify player loads only when asked for ----------
     Nothing from Spotify is requested until the visitor presses the button. Without JavaScript the
     button stays hidden and the Spotify and Apple Music links below it do the job. */
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

  /* ---------- the waitlist: NextGen's own, saved by /api/register.php without leaving the page ----------
     Without JavaScript (or fetch) the form posts normally and the server answers with
     /registration-received/. The browser's own validation runs first (required, type=email). */
  Array.prototype.forEach.call(document.querySelectorAll('form[data-waitlist]'), function (form) {
    if (!window.fetch || !window.URLSearchParams || !window.FormData) return;
    var btn = form.querySelector('button[type=submit]');
    var label = btn.querySelector('.btn__t');
    var err = form.querySelector('.tkt__err');
    var done = form.parentNode.querySelector('.tkt__done');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (i) { i.removeAttribute('aria-invalid'); });
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
        form.hidden = true;
        done.hidden = false;
        done.focus();
      }).catch(function (x) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        label.textContent = was;
        err.textContent = (x && x.msg) || 'That didn\u2019t go through. Please check your connection and try again.';
        err.hidden = false;
        var first = null;
        ((x && x.fields) || []).forEach(function (f) {
          var i = form.elements[f];
          if (i && i.setAttribute) { i.setAttribute('aria-invalid', 'true'); first = first || i; }
        });
        if (first) first.focus();
      });
    });
  });
})();
