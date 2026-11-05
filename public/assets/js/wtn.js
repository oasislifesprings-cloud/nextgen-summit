/* "Where To Next?" gateway behaviour. Runs after site.js (nav, drawer, reveals).
   Everything here is an enhancement: without JavaScript every sign is a plain link, the waitlist
   shows its static state, and the chapter rail is a plain list of in-page links.
   This website never links to the 2026 archive (archive.nextgensummit.us is a separate site). */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- homepage scene: the 2026 hero film over its photograph ----------
     Same rules as the 2026 hero (site.js initHeroFilm): never loaded with reduced motion or Data
     Saver, requested only once the page is idle, shown only when frames are playing, paused when
     the hero is off screen or the tab is hidden. Without JavaScript the photograph stays. */
  var film = document.querySelector('.wtn-scene__video');
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

  /* ---------- travel between destinations (provisional) ----------
     A sign click sets html[data-travel=<direction>] so CSS can move the scene, then navigates.
     The choreography is a placeholder until the artwork exists; the contract is the attribute
     and TRAVEL_MS. Only the homepage has a scene to move: everywhere else, and with reduced motion,
     modified clicks or new-tab clicks, a link navigates immediately (the page cross-fade is CSS). */
  var TRAVEL_MS = 420;
  var scene = document.querySelector('.wtn-scene');
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-travel]');
    if (!a) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (!scene || (reduced && reduced.matches)) return;
    e.preventDefault();
    doc.setAttribute('data-travel', a.getAttribute('data-travel'));
    setTimeout(function () { location.href = a.href; }, TRAVEL_MS);
  });
  // returning with the back button restores a page from the bfcache mid-transition: reset it
  window.addEventListener('pageshow', function () { doc.removeAttribute('data-travel'); });

  /* ---------- Eventbrite waitlist ----------
     Configure on the [data-eventbrite] element, nothing else:
       data-eventbrite-event="<event id>"   embedded Eventbrite checkout in a modal (preferred)
       data-eventbrite-url="<event url>"    plain link to the Eventbrite page
     With neither set, the button stays in its "opening soon" state. No data is collected here;
     Eventbrite's own script is loaded only when an event id is configured and the button is used. */
  var box = document.querySelector('[data-eventbrite]');
  if (box) {
    var btn = box.querySelector('[data-eventbrite-button]');
    var status = box.querySelector('[data-eventbrite-status]');
    var id = (box.getAttribute('data-eventbrite-event') || '').trim();
    var url = (box.getAttribute('data-eventbrite-url') || '').trim();
    if (btn && id && /^\d+$/.test(id)) {
      enable('Join the waitlist');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        loadEventbrite(function () {
          window.EBWidgets.createWidget({ widgetType: 'checkout', eventId: id, modal: true, modalTriggerElementId: btn.id });
          btn.click();
        });
      }, { once: true });
    } else if (btn && url && /^https:\/\/(www\.)?eventbrite\.[a-z.]+\//.test(url)) {
      enable('Join the waitlist');
      btn.href = url;
      btn.target = '_blank';
      btn.rel = 'noopener';
      btn.insertAdjacentHTML('beforeend', '<span class="sr"> (opens Eventbrite in a new tab)</span>');
    }
    function enable(label) {
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('tabindex');
      btn.querySelector('[data-label]').textContent = label;
      if (status) status.textContent = 'Opens Eventbrite to reserve your place.';
    }
  }
  /* City interest: each confirmed city gets its own Eventbrite waitlist link. A slot with no
     valid Eventbrite URL stays a disabled placeholder. Nothing is stored or sent from this page. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-cities] .wtn-city'), function (a) {
    var u = (a.getAttribute('data-eventbrite-url') || '').trim();
    if (!/^https:\/\/(www\.)?eventbrite\.[a-z.]+\//.test(u)) return;
    a.href = u;
    a.target = '_blank';
    a.rel = 'noopener';
    a.removeAttribute('aria-disabled');
    a.insertAdjacentHTML('beforeend', '<span class="sr"> (opens Eventbrite in a new tab)</span>');
  });

  function loadEventbrite(done) {
    if (window.EBWidgets) return done();
    var s = document.createElement('script');
    s.src = 'https://www.eventbrite.com/static/widgets/eb_widgets.js';
    s.async = true;
    s.onload = done;
    document.head.appendChild(s);
  }

  // a disabled link must not navigate or scroll
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[aria-disabled="true"]');
    if (a) e.preventDefault();
  });
})();
