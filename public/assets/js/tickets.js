/* NextGen Summit — tickets.
   Eventbrite owns the transaction: pricing, inventory, quantity rules, payment and the
   hidden scholarship ticket all live there. This file only opens their modal over our page
   and shows a NextGen confirmation afterwards. Nothing about the order is decided here. */
(function () {
  'use strict';

  var EVENT_ID = '1999190304016';
  var EVENT_URL = 'https://www.eventbrite.com/e/nextgen-summit-tickets-' + EVENT_ID;

  /* Brand for the Eventbrite modal. brandColor is the site's own --accent read from the
     stylesheet at runtime, so the checkout can never drift from the design token. The hex
     on the right is only the fallback if the variable cannot be read. */
  var BRAND_FALLBACK = '#1FC7BE';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function accentColor() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      return /^#[0-9a-f]{3,8}$/i.test(v) ? v.toUpperCase() : BRAND_FALLBACK;
    } catch (e) { return BRAND_FALLBACK; }
  }

  /* ---------- the confirmation, ours, after Eventbrite has done its own ---------- */
  function orderComplete() {
    var page = $('[data-tickets]');
    var done = $('[data-done]');
    if (!page || !done) return;
    page.hidden = true;
    done.hidden = false;
    done.focus();
    if (window.dataLayer) window.dataLayer.push({ event: 'nextgen_ticket_order_complete' });
  }

  /* ---------- the modal ----------
     Every ticket button is a real link to the Eventbrite page first, so the page works with
     no JavaScript and still works if their widget script is blocked or fails. Once the widget
     is up we intercept those clicks and open the modal instead, which is the normal path. */
  function initCheckout() {
    var links = $$('[data-eb]');
    if (!links.length) return;
    var trigger = $('#eb-trigger');
    if (!trigger || !window.EBWidgets || typeof window.EBWidgets.createWidget !== 'function') return;

    // Eventbrite refuses to draw the checkout on anything but https, and says so in the console
    // rather than throwing. Over http (local preview) we never intercept, so the links simply work.
    if (location.protocol !== 'https:') return;

    var ready = false;
    try {
      window.EBWidgets.createWidget({
        widgetType: 'checkout',
        eventId: EVENT_ID,
        modal: true,
        modalTriggerElementId: 'eb-trigger',
        themeSettings: {
          brandColor: accentColor(),
          fontColor: '#000000',
          background: '#FFFFFF'
        },
        onOrderComplete: orderComplete
      });
      ready = true;
    } catch (e) {
      ready = false;                                  // links stay as links
    }
    if (!ready) return;

    document.documentElement.classList.add('eb-ready');
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;   // let people open a tab
        e.preventDefault();
        trigger.click();
        // if the modal does not actually appear, send them to Eventbrite rather than nowhere
        setTimeout(function () {
          if (!document.querySelector('iframe[src*="eventbrite"],[id^="eventbrite-widget-modal"]')) {
            window.location.href = a.href;
          }
        }, 1200);
      });
    });
  }

  /* their script is async, so wait for it rather than racing it */
  function whenWidgetReady(done) {
    if (window.EBWidgets && window.EBWidgets.createWidget) return done();
    var tries = 0;
    var t = setInterval(function () {
      if (window.EBWidgets && window.EBWidgets.createWidget) { clearInterval(t); done(); }
      else if (++tries > 40) { clearInterval(t); }     // ~8s, then the links simply stand
    }, 200);
  }

  whenWidgetReady(initCheckout);

  /* the fallback link is also the link people copy, so keep it correct if the id ever moves */
  $$('[data-eb]').forEach(function (a) { if (!a.getAttribute('href')) a.href = EVENT_URL; });
})();
