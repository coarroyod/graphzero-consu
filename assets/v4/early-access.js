/* ==========================================================================
   early-access.js — the toolbox figure follows the module you point at
   ==========================================================================

   One piece of state: activeModule, 0-2. The rows and the figure both read
   from it, and the figure's stage is written as a data-stage attribute so the
   stylesheet decides what each stage looks like. Nothing here sets a colour.

   The highlight is cumulative by design — stage 02 does not dim the sources
   stage 01 lit, because the point being made is that the toolbox accumulates,
   not that it switches. That rule lives in the CSS selectors, not here.

   When nothing is hovered the figure walks the three stages on its own, so a
   reader who never touches it still sees what it is saying. A hover takes over
   at once and the cycle resumes when the pointer leaves.

   Safe if any of it is missing, and nothing is hidden when it does not run.
   ========================================================================== */

(function () {
  "use strict";

  var card = document.querySelector(".eaf-figcard");
  var rows = [].slice.call(document.querySelectorAll(".eaf-mod[data-module]"));
  var stageLabel = document.querySelector(".eaf-stage");
  if (!card || !rows.length) return;

  var NAMES = ["Stage 01 · Ingestion", "Stage 02 · Knowledge base", "Stage 03 · Search & agents"];

  var active = null;   /* what the pointer is on, or null */
  var cycle = 0;       /* where the unattended walk has got to */
  var timer = null;

  function render() {
    var stage = active === null ? cycle : active;
    card.setAttribute("data-stage", String(stage));
    if (stageLabel) stageLabel.textContent = NAMES[stage];
    rows.forEach(function (r) {
      r.classList.toggle("is-on", active !== null && Number(r.getAttribute("data-module")) === active);
    });
  }

  function start() {
    stop();
    timer = setInterval(function () {
      cycle = (cycle + 1) % 3;
      render();
    }, 3200);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  rows.forEach(function (row) {
    var i = Number(row.getAttribute("data-module"));
    function on() { active = i; cycle = i; stop(); render(); }
    function off() { active = null; render(); start(); }
    row.addEventListener("mouseenter", on);
    row.addEventListener("mouseleave", off);
    row.addEventListener("focusin", on);
    row.addEventListener("focusout", off);
  });

  var reduced = false;
  try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  render();
  if (!reduced) start();
})();
