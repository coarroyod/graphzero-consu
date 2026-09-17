/* ==========================================================================
   product.js — the one linked behaviour on the page
   ==========================================================================

   Hovering a band in Figure B lights the matching module row beside it, and
   the other way round. One piece of state — the active layer index — and both
   sides read from it. Nothing here mutates inline styles; it toggles a class
   and the stylesheet decides what that looks like.

   Finds its own elements and returns if they are absent, so it is safe on any
   page. Nothing is hidden if this never runs.
   ========================================================================== */

(function () {
  "use strict";

  var bands = [].slice.call(document.querySelectorAll(".gz4-band[data-layer]"));
  var rows = [].slice.call(document.querySelectorAll(".tc-item[data-layer]"));
  if (!bands.length || !rows.length) return;

  var active = null;

  function render() {
    bands.concat(rows).forEach(function (el) {
      var on = active !== null && el.getAttribute("data-layer") === String(active);
      el.classList.toggle("is-on", on);
    });
  }

  function bind(el) {
    var i = Number(el.getAttribute("data-layer"));
    function on() { if (active !== i) { active = i; render(); } }
    function off() { if (active === i) { active = null; render(); } }
    el.addEventListener("mouseenter", on);
    el.addEventListener("mouseleave", off);
    el.addEventListener("focusin", on);
    el.addEventListener("focusout", off);
  }

  bands.forEach(bind);
  rows.forEach(bind);
})();
