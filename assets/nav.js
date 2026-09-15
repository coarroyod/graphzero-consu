/* ==========================================================================
   nav.js — the bar changes its own ink over a dark band
   ==========================================================================

   A transparent bar over navy is unreadable and no fill level fixes it:
   backdrop-filter: blur() only defocuses what is behind, it adds no luminance.
   At 27% white the ground under the links composites to about rgb(86,95,101)
   and the links measure 1.10:1. So the bar flips instead.

   The test is geometric — is a dark band overlapping the bar's own box right
   now — rather than a scroll position. That way it stays right when sections
   are reordered, resized, or added, and on any viewport, without anyone
   having to remember a magic number.

   Finds its own bar and returns if there is none, so it is safe on any page.
   ========================================================================== */

(function () {
  "use strict";

  var nav = document.querySelector(".gznav");
  if (!nav) return;

  var veil = nav.querySelector(".nav-veil");
  var links = nav.querySelector(".nav-links");
  var wordmark = nav.querySelector(".nav-wordmark");
  var active = nav.querySelector(".nav-active");
  var darks = document.querySelectorAll("[data-dark]");
  if (!veil || !links) return;

  var LIGHT = {
    fill: "linear-gradient(to bottom, rgba(255,255,255,.42) 0%, rgba(255,255,255,.16) 55%, rgba(255,255,255,0) 100%)",
    links: "#59666B",
    ink: "#17232B",
  };
  var DARK = {
    fill: "linear-gradient(to bottom, rgba(23,35,43,.58) 0%, rgba(23,35,43,.24) 55%, rgba(23,35,43,0) 100%)",
    links: "rgba(255,255,255,.82)",
    ink: "#FFFFFF",
  };

  var state = null;

  function apply() {
    var n = nav.getBoundingClientRect();
    var over = false;

    for (var i = 0; i < darks.length; i++) {
      var r = darks[i].getBoundingClientRect();
      /* Two pixels of slack at each edge, so a band that merely touches the
         bar's edge does not flicker the whole thing on and off. */
      if (r.top < n.bottom - 2 && r.bottom > n.top + 2) {
        over = true;
        break;
      }
    }

    if (over === state) return; /* only touch the DOM when it changes */
    state = over;

    var t = over ? DARK : LIGHT;
    veil.style.background = t.fill;
    links.style.color = t.links;
    if (wordmark) wordmark.style.color = t.ink;
    if (active) active.style.color = t.ink;
  }

  apply();

  var raf = null;
  window.addEventListener(
    "scroll",
    function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        apply();
      });
    },
    { passive: true },
  );

  window.addEventListener("resize", apply);
})();
