/* "Where To Next?" gateway behaviour. Runs after site.js (nav, drawer, reveals).
   Everything here is an enhancement: without JavaScript every sign is a plain link, the waitlist
   shows its static state, and archive links point at the production archive address. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- archive links ----------
     Production: https://archive.nextgensummit.us/ (not live yet, see docs/2026-archive-plan.md).
     On a local preview the same links open the local archive build instead, so the 2026
     destination can be reviewed end to end before the archive exists. */
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var LOCAL_ARCHIVE = 'http://127.0.0.1:8811';
  if (LOCAL) {
    Array.prototype.forEach.call(document.querySelectorAll('a[data-archive]'), function (a) {
      var u = new URL(a.href);
      a.href = LOCAL_ARCHIVE + u.pathname + u.search + u.hash;
      a.setAttribute('data-archive-local', '');
    });
  }

  /* ---------- travel between destinations (provisional) ----------
     A sign click sets html[data-travel=<direction>] so CSS can move the scene, then navigates.
     The choreography is a placeholder until the artwork exists; the contract is the attribute
     and TRAVEL_MS. Reduced motion, modified clicks and new-tab clicks navigate immediately. */
  var TRAVEL_MS = 520;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-travel]');
    if (!a) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (reduced && reduced.matches) return;
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
    }
    function enable(label) {
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('tabindex');
      btn.querySelector('[data-label]').textContent = label;
      if (status) status.textContent = 'Opens Eventbrite to reserve your place.';
    }
  }
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
