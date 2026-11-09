/* NextGen 2026: the winners showcase controls. The track is a native scroll-snap row, so swiping
   and the keyboard already work without this; the buttons step one card at a time and dim at the ends. */
(function () {
  'use strict';
  var box = document.querySelector('[data-ngw]');
  if (!box) return;
  var track = box.querySelector('[data-ngw-track]');
  var prev = box.querySelector('[data-ngw-prev]'), next = box.querySelector('[data-ngw-next]');
  if (!track || !prev || !next) return;
  var still = matchMedia('(prefers-reduced-motion: reduce)');
  function step() {
    var c = track.querySelector('.ngw__card');
    if (!c) return track.clientWidth;
    var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return c.getBoundingClientRect().width + gap;
  }
  function paint() {
    var max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
  }
  function go(dir) { track.scrollBy({ left: dir * step(), behavior: still.matches ? 'auto' : 'smooth' }); }
  prev.addEventListener('click', function () { go(-1); });
  next.addEventListener('click', function () { go(1); });
  track.addEventListener('scroll', function () { window.requestAnimationFrame(paint); }, { passive: true });
  window.addEventListener('resize', paint, { passive: true });
  prev.hidden = false; next.hidden = false;
  paint();
})();
