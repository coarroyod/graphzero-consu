/* The header reveals on the way up and leaves on the way down.

   Three states on data-hdr, which the sheet reads:
     top     at rest against the top of the page — no ground, no rule
     pinned  scrolled, moving up or holding — ground and hairline
     hidden  moving down — translated off

   Deliberately small: no library, no observer, one passive listener and a
   frame to read scrollY in, so the measurement never lands mid-layout. */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  if (!header) return;

  /* Below this the bar is always shown and always bare: the first screenful
     should not flicker between states while someone nudges the page. */
  var TOP_ZONE = 72;
  /* Trackpads and phones report a lot of one- and two-pixel deltas. Anything
     under this is not a direction. */
  var DELTA = 6;

  var last = window.pageYOffset || 0;
  var queued = false;

  function set(state) {
    if (header.getAttribute('data-hdr') !== state) {
      header.setAttribute('data-hdr', state);
    }
  }

  function navOpen() {
    return header.getAttribute('data-nav-open') === 'true';
  }

  function update() {
    queued = false;

    var y = window.pageYOffset || 0;
    if (y < 0) y = 0;

    if (y <= TOP_ZONE) {
      set('top');
      last = y;
      return;
    }

    var delta = y - last;
    if (delta > -DELTA && delta < DELTA) return;

    /* Never hide it out from under an open menu, and never while something
       inside it has focus — a keyboard user would lose what they are on. */
    if (delta > 0 && !navOpen() && !header.contains(document.activeElement)) {
      set('hidden');
    } else {
      set('pinned');
    }
    last = y;
  }

  function onScroll() {
    if (!queued) {
      queued = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  /* Tabbing into a hidden bar brings it back. */
  header.addEventListener('focusin', function () {
    if (header.getAttribute('data-hdr') === 'hidden') set('pinned');
  });

  update();
})();
