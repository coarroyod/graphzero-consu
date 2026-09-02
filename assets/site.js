/* Knowledge Base selector (section 03).

   A numbered list on the left drives a detail panel on the right. It advances
   on its own every 6s, and the rule under the active row is the progress bar —
   it fills over that interval, so the change is signalled before it happens
   rather than surprising the reader. Click or arrow keys select directly and
   restart the interval.

   Hovering the list pauses it: the panel changing mid-sentence while someone is
   reading is the main failure mode of an auto-advancing control. That pause only
   lasts as long as the pointer is there, so the marker square on the active row
   is also a latch — click it and the list stays stopped after you move away.
   Filled means running, hollow means stopped.

   Under prefers-reduced-motion it does not advance or animate at all — the bar
   is drawn full width as a plain underline and selection is click-only.

   Rendered from a data array rather than markup so the list and the panel
   cannot drift apart. */
(function () {
  'use strict';

  var DURATION = 6000;
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ITEMS = [
    {
      title: 'Centralizes knowledge, with continuous sync',
      tags: ['Incremental sync', 'Change detection', 'Deletion propagation', 'Permission refresh', 'Entity resolution'],
      body: 'Scheduled and incremental sync across AFAS, Exact, DATEV, Personio, SharePoint, Drive, Slack and your file shares, with change detection, deletion propagation and permission refresh on every pass. Entities and typed edges are extracted as content lands and resolved into canonical nodes, so one customer is one node across all of them. The unit is the entity, not the chunk. No manual uploads, no stale context, no migration project.'
    },
    {
      title: 'Finds the complete answer, with proof',
      tags: ['Exhaustive scan', 'Multi-hop reasoning', 'Temporality', 'Provenance', 'Coverage reporting'],
      body: 'A subscription assistant fires one query and cannot tell you what it missed, because it has nothing to enumerate. This layer knows the boundary of its own corpus, so it can walk all of it, carry a complex question across multiple hops, and report what it has covered. Older versions are retained rather than overwritten, so an answer can be asked for as of any date. Every claim comes back pinned to the passage it came from.'
    },
    {
      title: 'Gives access to answers AND sources',
      tags: ['Ranked source set', 'Direct document access', 'Passage-level citations', 'Wiki pages', 'Editable in place'],
      body: 'Answers arrive with the ranked source set behind them and direct access to the documents themselves, which almost nothing on the market returns. What the system derives on top, the summaries, connections and conclusions, is written to a wiki: one page per customer, product, process or policy, every claim linked back to its source. Humans can browse it, search it, and even correct it in place. No embeddings-only store, no query language, no black box.'
    },
    {
      title: 'Maintains and optimizes knowledge',
      tags: ['Gap & contradiction detection', 'Graph inference', 'Draft & human approval', 'Write-back to your files', 'Org-level learning'],
      body: 'Continuous detection of gaps, contradictions and stale pages, each queued with the missing piece already drafted; a person approves, and it lands in the knowledge base and, where you want it, in your own canonical files. It learns from everyday communication too, deriving new knowledge across the graph rather than only retrieving what a vector store already holds. Those learnings are written to the organisation’s knowledge, never to a private per-user memory. Claude, ChatGPT and Copilot learn into a store no colleague can read; this one warms up for whoever asks next.'
    },
    {
      title: 'Makes no compromises to security & control',
      tags: ['Fact-level permissions', 'Permission propagation', 'Sensitivity tagging', 'Source-side rerouting', 'Retrieval logging', 'Full export'],
      body: 'Fact-level access control that propagates into everything derived from it: a summary carries the combined permissions of its sources, and revoking one document withdraws access to every answer built on it since. Sensitivity is tagged and rerouted at the source, so confidential content never reaches a model that should not see it. Your knowledge stays yours, with full export in open formats at any time. No lock-in, no vendor-held copy, no export project.'
    }
  ];

  var list = document.getElementById('kb-list');
  var detail = document.getElementById('kb-detail');
  var text = document.getElementById('kb-text');
  if (!list || !detail || !text) return;

  var active = 0;
  var buttons = [];
  var progress = null;

  /* Three independent reasons to hold the timer. Latched is the only one the
     reader sets deliberately, so it is the only one the square reports. */
  var latched = false;
  var hovering = false;
  var focused = false;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function pad(i) { return ('0' + (i + 1)).slice(-2); }

  /* A row is a div rather than a button so the square inside it can be a real
     button — a control nested in a control is not valid markup. The tab role and
     its keyboard contract are reproduced below. */
  ITEMS.forEach(function (item, i) {
    var row = el('div', 'kb-item');
    row.id = 'kb-tab-' + i;
    row.setAttribute('role', 'tab');
    row.tabIndex = -1;
    row.appendChild(el('span', 'kb-item__num', pad(i)));
    row.appendChild(el('span', 'kb-item__title', item.title));

    var mark = el('button', 'kb-item__mark');
    mark.type = 'button';
    mark.tabIndex = -1;
    mark.setAttribute('aria-hidden', 'true');
    mark.addEventListener('click', function (e) {
      /* Without this the click reaches the row and restarts what it just stopped. */
      e.stopPropagation();
      setLatched(!latched);
    });
    row.appendChild(mark);
    row.appendChild(el('span', 'kb-item__bar'));

    row.addEventListener('click', function () { select(i, false); });
    row.addEventListener('keydown', onKeydown);

    buttons.push(row);
    list.appendChild(row);
  });

  detail.setAttribute('role', 'tabpanel');

  /* Reading should not be interrupted by the thing you are reading about. */
  list.addEventListener('mouseenter', function () { hovering = true; sync(); });
  list.addEventListener('mouseleave', function () { hovering = false; sync(); });
  list.addEventListener('focusin', function () { focused = true; sync(); });
  list.addEventListener('focusout', function () { focused = false; sync(); });

  /* The square is decorative to assistive tech — the latch it sets is announced
     on the list itself, where a screen reader is already told the list advances. */
  function setLatched(next) {
    latched = next;
    list.setAttribute('data-paused', latched ? 'true' : 'false');
    list.setAttribute('aria-label',
      'Knowledge base capabilities' + (latched ? ', auto-advance paused' : ''));
    buttons.forEach(function (row) {
      row.querySelector('.kb-item__mark').title = latched ? 'Resume' : 'Pause';
    });
    sync();
  }

  function sync() {
    if (!progress) return;
    if (latched || hovering || focused) progress.pause();
    else progress.play();
  }

  function runProgress(row) {
    if (progress) { progress.onfinish = null; progress.cancel(); progress = null; }
    var bar = row.querySelector('.kb-item__bar');
    if (!bar || REDUCED) return;
    progress = bar.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: DURATION, easing: 'linear', fill: 'forwards' }
    );
    progress.onfinish = function () { select((active + 1) % ITEMS.length, false); };
    /* A fresh animation starts playing — hand it straight back to the held state. */
    sync();
  }

  function onKeydown(e) {
    /* A div does not activate itself the way the button it replaced did. */
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      select(buttons.indexOf(e.currentTarget), false);
      return;
    }
    var delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1
              : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1
              : 0;
    if (!delta) return;
    e.preventDefault();
    select((active + delta + ITEMS.length) % ITEMS.length, true);
  }

  function select(i, moveFocus) {
    active = i;
    var item = ITEMS[i];

    buttons.forEach(function (b, n) {
      var on = n === i;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    if (moveFocus) buttons[i].focus();
    runProgress(buttons[i]);

    detail.setAttribute('aria-labelledby', 'kb-tab-' + i);
    text.textContent = '';
    /* The reference repeats the title in the eyebrow, but its titles are one
       word. These are sentences, so the eyebrow carries the position only. */
    text.appendChild(el('span', 'eyebrow', pad(i) + ' / ' + pad(ITEMS.length - 1)));
    text.appendChild(el('h3', 'h3-fixed', item.title));

    var tags = el('div', 'chip-row kb-tags');
    item.tags.forEach(function (t) { tags.appendChild(el('span', 'chip-outline', t)); });
    text.appendChild(tags);

    text.appendChild(el('p', 'body', item.body));
  }

  setLatched(false);
  select(0, false);
})();

/* Closing line of the Knowledge Base section — the last word cycles through the
   clients the layer plugs into, so the claim reads as a list without being one.

   The name leaves upward and the next arrives from below, which reads as one
   list moving rather than two unrelated words. Under prefers-reduced-motion it
   crossfades in place instead: the names still get shown, but nothing travels.

   The line sits at the end of the section, so a longer name would push the page
   under it. The tallest variant's height is measured once and held. */
(function () {
  'use strict';

  var HOLD = 2000;
  var OUT = 260;
  var IN = 320;
  var EASE = 'cubic-bezier(.2,.6,.2,1)';
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var WORDS = ['Claude', 'Copilot', 'ChatGPT', 'Langdock', 'white-label UI by Ascending'];
  /* The full stop travels with the name rather than sitting outside the animated
     span. Left outside it would stay lit while the name is faded out, and jump
     sideways on its own as the next name changes the width. */
  var STOP = '.';

  var slot = document.getElementById('kb-rot');
  var word = slot && slot.querySelector('.rot__word');
  var line = slot && slot.closest('.kb-close__with');
  if (!word) return;

  var i = 0;
  var timer = null;
  var anim = null;

  function reserve() {
    if (!line) return;
    var keep = word.textContent;
    line.style.minHeight = '';
    var tallest = 0;
    WORDS.forEach(function (w) {
      word.textContent = w + STOP;
      tallest = Math.max(tallest, line.getBoundingClientRect().height);
    });
    word.textContent = keep;
    line.style.minHeight = Math.ceil(tallest) + 'px';
  }

  /* Cancelling the previous animation first keeps one filled animation on the
     element rather than a new one every couple of seconds for as long as the
     page is open. Both end states match the element's base style, so the drop is
     invisible — and it means a stalled animation can only ever revert to a
     visible word, never strand an invisible one. */
  function play(frames, duration) {
    if (anim) anim.cancel();
    anim = word.animate(frames, { duration: duration, easing: EASE, fill: 'forwards' });
  }

  /* Timers drive the swap, not the animation's finish event. A browser that is
     not rendering — a background tab — never dispatches that event, and hanging
     the sequence off it leaves the word faded out and never brought back. */
  function step() {
    var next = (i + 1) % WORDS.length;
    var out = REDUCED ? [{ opacity: 1 }, { opacity: 0 }]
                      : [{ transform: 'translateY(0)', opacity: 1 },
                         { transform: 'translateY(-0.55em)', opacity: 0 }];
    var into = REDUCED ? [{ opacity: 0 }, { opacity: 1 }]
                       : [{ transform: 'translateY(0.55em)', opacity: 0 },
                          { transform: 'translateY(0)', opacity: 1 }];

    play(out, OUT);
    setTimeout(function () {
      word.textContent = WORDS[next] + STOP;
      i = next;
      play(into, IN);
      queue();
    }, OUT);
  }

  function queue() {
    clearTimeout(timer);
    timer = setTimeout(step, HOLD);
  }

  /* Coming back to a backgrounded tab, a half-run fade is stale and its timer
     was throttled. Drop it and restart cleanly — cancelling can only ever leave
     the word at its base style, which is visible. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (anim) { anim.cancel(); anim = null; }
    queue();
  });

  /* Measure once the real face is in, or the reserved height is Arial's. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);
  else reserve();
  addEventListener('resize', reserve);

  queue();
})();

/* Header nav.

   Solutions opens on hover where there is a pointer and on click everywhere, so
   it works the same whether it is a menu bar or a panel. The scroll spy marks
   whichever section is currently under the header, which is what makes the
   Solutions group light up for both of the sections behind it. */
(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  var nav = document.getElementById('site-nav');
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.nav-menu');
  if (!header || !nav) return;

  var trigger = menu && menu.querySelector('.nav-menu__trigger');
  var COMPACT = '(max-width: 900px)';

  function openMenu(open) {
    if (!menu || !trigger) return;
    menu.setAttribute('data-open', open ? 'true' : 'false');
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function openNav(open) {
    header.setAttribute('data-nav-open', open ? 'true' : 'false');
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) openMenu(false);
  }

  openMenu(false);
  openNav(false);

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = header.getAttribute('data-nav-open') !== 'true';
      openNav(next);
      /* The group starts open on a phone. The sheet is the whole screen and has
         room for it, and it saves a tap to reach the one live entry in there.
         Guarded on width so the floating dropdown does not open by itself. */
      if (next && matchMedia(COMPACT).matches) openMenu(true);
    });
  }

  if (menu && trigger) {
    trigger.addEventListener('click', function () {
      openMenu(menu.getAttribute('data-open') !== 'true');
    });
    /* Hover is an accelerator on top of the click, never the only way in. */
    menu.addEventListener('mouseenter', function () {
      if (!matchMedia(COMPACT).matches) openMenu(true);
    });
    menu.addEventListener('mouseleave', function () {
      if (!matchMedia(COMPACT).matches) openMenu(false);
    });
    menu.addEventListener('focusout', function (e) {
      if (!matchMedia(COMPACT).matches && !menu.contains(e.relatedTarget)) openMenu(false);
    });
  }

  document.addEventListener('click', function (e) {
    /* The menu button is excluded: it opens the group itself on a phone, and
       this handler runs after it as the click bubbles, so without the guard it
       shut the group again on the way up. */
    var onToggle = toggle && toggle.contains(e.target);
    if (menu && !menu.contains(e.target) && !onToggle) openMenu(false);
    if (!header.contains(e.target)) openNav(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (menu && menu.getAttribute('data-open') === 'true') {
      openMenu(false);
      if (trigger) trigger.focus();
      return;
    }
    if (header.getAttribute('data-nav-open') === 'true') {
      openNav(false);
      if (toggle) toggle.focus();
    }
  });

  /* Following a link closes the panel, otherwise it covers what you jumped to. */
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) { openNav(false); openMenu(false); }
  });

  /* Scroll spy. Rather than "most visible", this asks which section the header
     is currently sitting in — the one the reader is actually looking at. */
  var links = [].slice.call(nav.querySelectorAll('a[href^="#"]'));
  var targets = links
    .map(function (a) {
      return { link: a, section: document.getElementById(a.getAttribute('href').slice(1)) };
    })
    .filter(function (t) { return t.section; });
  if (!targets.length) return;

  var ticking = false;

  function markCurrent() {
    ticking = false;
    var current = null;
    targets.forEach(function (t) {
      /* Measure against the section's own scroll-margin, which is the offset the
         anchor jump uses. Anything else marks the previous section on landing. */
      var top = t.section.getBoundingClientRect().top + window.scrollY;
      var margin = parseFloat(getComputedStyle(t.section).scrollMarginTop) || header.offsetHeight;
      if (top - margin <= window.scrollY + 1) current = t;
    });
    /* Past the last section the page is in the footer; keep the last mark. */
    targets.forEach(function (t) {
      if (t === current) t.link.setAttribute('aria-current', 'true');
      else t.link.removeAttribute('aria-current');
    });
    if (menu) {
      var inside = current && menu.contains(current.link);
      menu.setAttribute('data-current', inside ? 'true' : 'false');
    }
  }

  addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(markCurrent);
  }, { passive: true });
  addEventListener('resize', markCurrent);
  markCurrent();
})();

/* Inline popovers holding an address, with a button that copies it.

   The address is not a mailto: the point is to hand it over, not to launch
   whatever the machine has registered as a mail client. Copy needs a secure
   context, so where the clipboard is unavailable the button says so rather
   than silently doing nothing. */
(function () {
  'use strict';

  var pops = [].slice.call(document.querySelectorAll('.pop'));
  if (!pops.length) return;

  function close(pop) {
    pop.setAttribute('data-open', 'false');
    pop.querySelector('.pop__trigger').setAttribute('aria-expanded', 'false');
  }
  function closeAll() { pops.forEach(close); }

  pops.forEach(function (pop) {
    var trigger = pop.querySelector('.pop__trigger');
    var copy = pop.querySelector('.pop__copy');
    close(pop);

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = pop.getAttribute('data-open') === 'true';
      closeAll();
      if (wasOpen) return;
      pop.setAttribute('data-open', 'true');
      trigger.setAttribute('aria-expanded', 'true');
    });

    if (!copy) return;
    var label = copy.textContent;
    var revert = null;
    copy.addEventListener('click', function (e) {
      e.stopPropagation();
      var say = function (msg) {
        copy.textContent = msg;
        clearTimeout(revert);
        revert = setTimeout(function () { copy.textContent = label; }, 2000);
      };
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        say('Select it and copy');
        return;
      }
      navigator.clipboard.writeText(copy.getAttribute('data-copy')).then(
        function () { say('Copied'); },
        function () { say('Select it and copy'); }
      );
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.pop')) closeAll();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = pops.filter(function (p) { return p.getAttribute('data-open') === 'true'; })[0];
    if (!open) return;
    close(open);
    open.querySelector('.pop__trigger').focus();
  });
})();

/* Language. The copy is English only for now, so this records the choice and
   sets the document language; it does not yet swap any text. */
(function () {
  'use strict';

  var opts = [].slice.call(document.querySelectorAll('.lang__opt'));
  if (!opts.length) return;

  var KEY = 'ascending:lang';

  function apply(code) {
    opts.forEach(function (b) {
      var on = b.dataset.lang === code;
      if (on) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    document.documentElement.lang = code;
  }

  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
  if (saved && opts.some(function (b) { return b.dataset.lang === saved; })) apply(saved);

  opts.forEach(function (b) {
    b.addEventListener('click', function () {
      apply(b.dataset.lang);
      try { localStorage.setItem(KEY, b.dataset.lang); } catch (e) {}
    });
  });
})();

/* Hero mark comparison. Two drawings, one shown at a time, remembered so the
   choice survives a reload while it is being lived with. Scaffolding: remove
   this block with the .hero__marks markup and rules once a mark is picked. */
(function () {
  'use strict';

  var stage = document.querySelector('[data-mark-switch]');
  if (!stage) return;
  var marks = [].slice.call(stage.querySelectorAll('.hero__mark'));
  if (marks.length < 2) return;

  var KEY = 'graph0:hero-mark';
  var index = 0;

  /* A stored name with no drawing left falls back to the first, so removing a
     mark cannot strand the fold on nothing. */
  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
  marks.forEach(function (m, i) { if (m.dataset.mark === saved) index = i; });

  function apply() {
    marks.forEach(function (m, i) {
      if (i === index) m.setAttribute('data-current', 'true');
      else m.removeAttribute('data-current');
    });
    try { localStorage.setItem(KEY, marks[index].dataset.mark); } catch (e) {}
  }

  apply();

  stage.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mark-step]');
    if (!btn) return;
    var step = parseInt(btn.dataset.markStep, 10) || 1;
    index = (index + step + marks.length) % marks.length;
    apply();
  });
})();

/* Identity switch — graphzero / vongraph.

   Two names under comparison. The wordmark is the only text that changes; the
   accent, and the plate on the Knowledge Base fold, follow from the attribute
   this sets on .page rather than from anything here, so adding a third
   identity is a CSS block and an entry below.

   Scaffolding: remove this block with the .brand-switch markup and rules once
   a name is chosen. */
(function () {
  'use strict';

  var sw = document.querySelector('[data-identity-switch]');
  var page = document.querySelector('.page');
  if (!sw || !page) return;

  var NAMES = ['graphzero', 'vongraph'];
  var KEY = 'graphzero:identity';
  var brand = sw.querySelector('.brand');
  if (!brand) return;
  /* Every place the name is written out, not just the wordmark: the diagram's
     fourth assistant tile is ours too, and hard-coding one name there would
     leave it wrong under the other identity. */
  var labels = document.querySelectorAll('.brand__name, [data-identity-name]');

  var index = 0;
  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
  /* A stored name that no longer exists falls back to the first, so dropping
     an identity cannot strand the site on one nothing can switch away from. */
  var at = NAMES.indexOf(saved);
  if (at > -1) index = at;

  function apply() {
    var name = NAMES[index];
    page.setAttribute('data-identity', name);
    for (var i = 0; i < labels.length; i++) labels[i].textContent = name;
    brand.title = '/' + name;
    try { localStorage.setItem(KEY, name); } catch (e) {}
  }

  apply();

  sw.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-identity-step]');
    if (!btn) return;
    var step = parseInt(btn.dataset.identityStep, 10) || 1;
    index = (index + step + NAMES.length) % NAMES.length;
    apply();
  });
})();

/* Hero shimmer — vongraph's plate, lit.

   Specks drift across the picture: white squares a pixel or two across that
   fade up and back down over a second or two each, staggered so a scattering
   is always mid-life while the rest of the plate stays plain. Individually
   they are hard pixel artefacts; together, because each fades rather than
   switches, they read as a shimmer.

   The reference draws the photograph into its own canvas and repaints the
   whole plate every frame. Here the picture stays a real <img> underneath, so
   this canvas is transparent and a frame is a clear plus ~48 fillRects.

   Costs kept down rather than assumed cheap: ~24fps, paused when the fold is
   off screen or the canvas is not being shown, and never started at all under
   prefers-reduced-motion — where the plate alone is the design. */
(function () {
  'use strict';

  var cv = document.querySelector('canvas[data-shimmer]');
  var page = document.querySelector('.page');
  if (!cv || !page) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var FRAME_MS = 1000 / 24;
  var SPECKS = 48;

  var ctx = cv.getContext('2d');
  if (!ctx) return;
  var bits = [], raf = null, last = 0, onScreen = true, dpr = 1;

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* Most specks are one or two pixels at a few percent opacity; a few are a
     shade larger and brighter. Without that spread it reads as even static
     rather than glinting. Deliberately at the edge of noticing: on a plate
     this dark, anything you can pick out frame by frame reads as dirt. */
  function spawn(w, h, now) {
    var loud = Math.random() < 0.15;
    var size = Math.round(rand(loud ? 2 : 1, loud ? 3 : 2));
    return {
      x: Math.round(rand(0, Math.max(0, w - size))),
      y: Math.round(rand(0, Math.max(0, h - size))),
      w: size,
      h: size,
      peak: loud ? rand(0.15, 0.25) : rand(0.04, 0.12),
      /* a long wait before each one returns, so only about half the set is
         alive at any moment and the rest of the plate stays plain */
      born: now + rand(0, 2600),
      life: rand(900, 2400)
    };
  }

  function size() {
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function draw(now) {
    var w = cv.width / dpr, h = cv.height / dpr;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < bits.length; i++) {
      var b = bits[i];
      var age = now - b.born;
      if (age < 0) continue;
      if (age > b.life) { bits[i] = spawn(w, h, now); continue; }
      /* sin over the lifetime: up and back down, so nothing ever pops on */
      ctx.globalAlpha = Math.sin((age / b.life) * Math.PI) * b.peak;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.globalAlpha = 1;
  }

  function seed() {
    if (!size()) return false;
    var w = cv.width / dpr, h = cv.height / dpr;
    var now = performance.now();
    bits.length = 0;
    for (var i = 0; i < SPECKS; i++) {
      var b = spawn(w, h, now);
      /* seeded mid-life at staggered phases: spawning the set together leaves
         them in step, and every so often they all fade out on one frame and
         the shimmer blinks off */
      b.born -= Math.random() * (b.life + 260);
      bits.push(b);
    }
    return true;
  }

  /* Read off the CSS rather than off the attribute: which identity shows the
     plate is a styling decision, and this way the script does not hold a
     second copy of it. */
  function live() {
    return onScreen && getComputedStyle(cv).display !== 'none';
  }

  function loop(now) {
    if (!live()) { raf = null; return; }
    raf = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    draw(now);
  }

  function start() {
    if (raf || !live()) return;
    if (!bits.length && !seed()) return;
    /* One frame up front. Without it the first paint waits on the first
       animation frame, and the plate arrives bare for a beat on switching. */
    last = performance.now();
    draw(last);
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (cv.width) ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
  }

  function refresh() {
    if (live()) { bits.length = 0; start(); } else { stop(); }
  }

  if (window.MutationObserver) {
    new MutationObserver(refresh).observe(page, {
      attributes: true, attributeFilter: ['data-identity']
    });
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (onScreen) start(); else stop();
    }, { threshold: 0 }).observe(cv);
  }
  if (window.ResizeObserver) {
    new ResizeObserver(function () { if (live()) { bits.length = 0; start(); } }).observe(cv);
  }

  refresh();
})();

/* Challenges by area. The open area is recorded in one place — data-area on
   the card track — and the stylesheet decides from that which cards show.
   Nothing is written onto the cards themselves, so there is no state to clean
   up and no way for the two to disagree.

   Arrow keys move between the tabs, which is what a tablist is expected to do
   and what a row of buttons does not give you for free. */
(function () {
  'use strict';

  var tabs = document.querySelector('.areas .tabs');
  var cards = document.getElementById('challenge-cards');
  if (!tabs || !cards) return;

  var buttons = [].slice.call(tabs.querySelectorAll('[data-area]'));

  function show(area, focus) {
    cards.setAttribute('data-area', area);
    buttons.forEach(function (b) {
      var open = b.getAttribute('data-area') === area;
      b.setAttribute('aria-selected', open);
      /* only the open tab is in the tab order; the arrows reach the others */
      b.tabIndex = open ? 0 : -1;
      if (open && focus) b.focus();
    });
  }

  tabs.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-area]');
    if (btn) show(btn.getAttribute('data-area'), false);
  });

  tabs.addEventListener('keydown', function (e) {
    var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    var at = buttons.indexOf(document.activeElement);
    if (at < 0) return;
    var next = buttons[(at + step + buttons.length) % buttons.length];
    show(next.getAttribute('data-area'), true);
  });

  show(cards.getAttribute('data-area') || 'strategy', false);
})();


/* Hero plates. The arrows step between the two plates the fold has been tried
   with. Each stop names its own image set, its intrinsic size - they are not
   the same shape, and getting that wrong makes the hero jump as a plate decodes
   - and whether the type reverses out of it.

   The plate is fetched before it goes in. Assigning src directly leaves the
   <img> empty until the new one arrives: a white hero, with white type on it
   for a beat, because the tone flips at once while the picture takes a moment.
   `load` rather than decode(), which never settles in a background tab; the
   timeout is the same argument one step on, so a plate that stalls or 404s
   cannot strand the carousel on the stop before it. */
(function () {
  'use strict';

  var swap = document.getElementById('hero-swap');
  var hero = document.getElementById('hero');
  var img = hero && hero.querySelector('.hero__img');
  if (!swap || !hero || !img) return;

  var PLATES = [
    { base: 'hero-pale',  widths: [900, 1600, 2157], w: 2157, h: 1180, light: true },
    { base: 'hero-plate', widths: [900, 1600, 2157], w: 2157, h: 1180 }
  ];

  var count = swap.querySelector('[data-swap-count]');
  var at = 0;
  var pending = 0;

  function url(plate, w) { return 'assets/media/' + plate.base + '-' + w + '.jpg'; }

  function srcsetFor(plate) {
    return plate.widths.map(function (w) { return url(plate, w) + ' ' + w + 'w'; }).join(', ');
  }

  function apply(plate) {
    img.srcset = srcsetFor(plate);
    img.src = url(plate, plate.widths[1]);
    img.width = plate.w;
    img.height = plate.h;
    hero.classList.toggle('hero--light', !!plate.light);
  }

  function show(i) {
    at = (i + PLATES.length) % PLATES.length;
    var plate = PLATES[at];
    var token = ++pending;

    if (count) count.textContent = (at + 1) + '/' + PLATES.length;

    function settle() {
      if (token !== pending) return;
      pending++;                /* so the losing callbacks stay dropped */
      apply(plate);
    }

    var pre = new Image();
    pre.sizes = img.sizes;
    pre.onload = settle;
    pre.onerror = settle;
    pre.srcset = srcsetFor(plate);
    pre.src = url(plate, plate.widths[1]);

    if (pre.complete) settle();
    else setTimeout(settle, 1200);
  }

  swap.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-step]');
    if (!btn) return;
    show(at + Number(btn.getAttribute('data-step')));
  });

  show(0);
})();

/* The challenge tabs. Only the open tab is recorded - on the track, as
   data-tab - and the stylesheet decides from that which pair shows. */
(function () {
  'use strict';

  var tabs = document.getElementById('challenge-tabs');
  var track = document.getElementById('challenge-track');
  if (!tabs || !track) return;

  var buttons = [].slice.call(tabs.querySelectorAll('[data-tab]'));

  function show(which, focus) {
    track.setAttribute('data-tab', which);
    buttons.forEach(function (b) {
      var open = b.getAttribute('data-tab') === which;
      b.setAttribute('aria-selected', open);
      b.tabIndex = open ? 0 : -1;
      if (open && focus) b.focus();
    });
  }

  tabs.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-tab]');
    if (btn) show(btn.getAttribute('data-tab'), false);
  });

  tabs.addEventListener('keydown', function (e) {
    var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    var i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    show(buttons[(i + step + buttons.length) % buttons.length].getAttribute('data-tab'), true);
  });

  show('0', false);
})();

/* Entry reveal — Early Access.

   Progressive, in both directions: the hidden state lives behind the
   [data-reveal-ready] flag this sets, so a page that never runs this script is
   never left with invisible copy, and under prefers-reduced-motion the flag is
   not set at all rather than being set and then undone.

   Each element is unobserved once it has come in. This is an entry, not a
   scroll effect — nothing should fade back out on the way up. */
(function () {
  'use strict';

  var items = [].slice.call(document.querySelectorAll('[data-reveal]'));
  if (!items.length) return;

  var page = document.querySelector('.page');
  if (!page) return;

  if (!('IntersectionObserver' in window) ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  page.setAttribute('data-reveal-ready', '');

  /* Failsafe, and the reason the hidden state is safe to declare at all.
     A renderer that is not painting — a tab opened in the background, a
     collapsed preview pane — delivers neither intersection entries nor
     animation frames, and the copy would sit at zero opacity for as long as
     that lasts. Timers still run there, so this is what actually guarantees
     the page is readable; the observer only decides whether it is read as an
     entry.

     The observer's first callback reports every target it was given, whether
     or not any of them intersect, so on a page that is painting this is
     cancelled within a frame of setup and never reaches the copy below the
     fold. It fires only where nothing is being drawn. */
  var failsafe = setTimeout(function () {
    /* Hard, not animated. Adding .is-in alone would only start a transition,
       and a transition cannot advance in the very renderer this exists for —
       the copy would hold at zero opacity exactly as before. The flag drops
       the transition with the hidden state, so the reveal is a style change
       that needs no frame to land. */
    page.setAttribute('data-reveal-skip', '');
    items.forEach(function (n) { n.classList.add('is-in'); });
    io.disconnect();
  }, 2000);

  var io = new IntersectionObserver(function (entries) {
    clearTimeout(failsafe);
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });

  items.forEach(function (n) { io.observe(n); });
})();

/* Hero band — the knowledge graph as the fold's rule.

   Every other division on this site is a hairline. Here the hairline is the
   network, and it carries the argument the sentence above it makes, left to
   right in the order the sentence makes it:

     left    points scattered and unjoined — fragmented across people,
             teams and tools
     middle  the same kind of points, now drawn together through one place
     hub     that place, and the only orange in the fold
     right   a small connected structure — available to people and AI

   The drawing is taller than the band, so it is cropped top and bottom: a
   window onto something larger rather than a picture with edges. Laid out in
   band space rather than a unit square, because a wide slice is what it is.

   Canvas rather than SVG: forty-odd points and their edges is a few lines of
   geometry against several hundred of path data, and the settle is a
   per-frame position rather than a keyframe. Seeded, so the arrangement is
   composed and not a fresh pile of points on every load. It settles once and
   then drifts about a pixel; under prefers-reduced-motion it draws settled on
   the first frame and never moves. Colours are read from the page. */
(function () {
  'use strict';

  var canvas = document.querySelector('[data-graph-hero]');
  if (!canvas) return;
  var ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;

  function seeded(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rand = seeded(20260902);
  var TAU = Math.PI * 2;

  var HUB_X = 0.62, HUB_Y = 0.5;
  var nodes = [], edges = [];

  function add(x, y, r, a) { nodes.push({ tx: x, ty: y, r: r, a: a }); return nodes.length - 1; }

  /* --- fragmented: no edges at all, which is the whole point of them --- */
  var loose = [];
  for (var i = 0; i < 16; i++) {
    var x = 0.015 + rand() * 0.30;
    var y = -0.14 + rand() * 1.28;
    loose.push(add(x, y, 1.7 + rand() * 0.5, 0.34 + rand() * 0.16));
  }

  /* --- gathering: each joins the hub, and reaches back to the nearest
         loose point it is picking up --- */
  var gather = [];
  for (var g = 0; g < 8; g++) {
    var gy = 0.06 + (g + rand() * 0.6) * (0.88 / 8);
    var gx = 0.36 + rand() * 0.17;
    var gi = add(gx, gy, 2.2, 0.62);
    gather.push(gi);
    edges.push([gi, -1, 'in']);              /* -1 stands for the hub */
    var best = -1, bd = 1e9;
    for (var l = 0; l < loose.length; l++) {
      var n = nodes[loose[l]];
      var d = Math.pow(n.tx - gx, 2) + Math.pow((n.ty - gy) * 0.4, 2);
      if (d < bd) { bd = d; best = loose[l]; }
    }
    if (best >= 0) edges.push([gi, best, 'pick']);
  }

  /* --- the hub --- */
  var HUB = add(HUB_X, HUB_Y, 6.5, 1);
  nodes[HUB].hub = true;

  /* --- resolved: joined to the hub and to each other --- */
  var out = [];
  for (var o = 0; o < 4; o++) {
    var oy = 0.17 + o * 0.22 + (rand() - 0.5) * 0.06;
    out.push(add(0.75 + rand() * 0.21, oy, 3, 0.8));
    edges.push([out[o], -1, 'out']);
  }
  edges.push([out[0], out[1], 'link'], [out[2], out[3], 'link']);

  nodes.forEach(function (n) {
    n.sx = -0.05 + rand() * 1.1;
    n.sy = -0.3 + rand() * 1.6;
    n.ph = rand() * TAU;
    n.dr = 0.3 + rand() * 0.5;
  });

  var C = { ink: '#17232B', line: 'rgba(23,35,43,0.16)', accent: '#D95C32' };
  function readColours() {
    var cs = getComputedStyle(canvas);
    C.ink = cs.getPropertyValue('--heading').trim() || C.ink;
    C.line = cs.getPropertyValue('--line').trim() || C.line;
    C.accent = cs.getPropertyValue('--accent').trim() || C.accent;
  }

  var W = 0, H = 0;
  function resize() {
    var box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = box.width; H = box.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function at(n, t, drift) {
    var e = 1 - Math.pow(1 - t, 3);
    var ux = n.sx + (n.tx - n.sx) * e;
    var uy = n.sy + (n.ty - n.sy) * e;
    var w = drift ? Math.sin(drift * n.dr + n.ph) * 1.1 : 0;
    return { x: ux * W + w, y: uy * H + (drift ? Math.sin(drift * n.dr + n.ph + 1.7) * 1.1 : 0) };
  }

  function draw(t, drift) {
    ctx.clearRect(0, 0, W, H);
    var pos = nodes.map(function (n) { return at(n, t, drift); });
    var hub = pos[HUB];

    var ea = Math.max(0, (t - 0.42) / 0.58);
    if (ea > 0) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.line;
      ctx.globalAlpha = Math.min(1, ea);
      ctx.beginPath();
      for (var i = 0; i < edges.length; i++) {
        var a = pos[edges[i][0]];
        var b = edges[i][1] === -1 ? hub : pos[edges[i][1]];
        var kind = edges[i][2];
        ctx.moveTo(a.x, a.y);
        if (kind === 'in' || kind === 'out') {
          /* A fan, so the run into and out of the hub reads as one movement
             rather than as spokes on a wheel. */
          var mx = (a.x + b.x) / 2;
          ctx.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y);
        } else {
          ctx.lineTo(b.x, b.y);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      ctx.fillStyle = n.hub ? C.accent : C.ink;
      ctx.globalAlpha = n.a * (0.3 + 0.7 * t);
      ctx.beginPath();
      ctx.arc(pos[j].x, pos[j].y, n.r * (0.6 + 0.4 * t), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = null, t0 = 0, settled = false, onscreen = true, ready = false;

  function frame(now) {
    raf = null;
    if (!onscreen) return;
    if (!t0) t0 = now;
    var el = now - t0;
    var t = Math.min(1, el / 2200);
    settled = t >= 1;
    draw(t, settled ? el / 1000 : 0);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (still || raf || !onscreen || !ready) return;
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  readColours();
  ready = resize();
  if (ready) { if (still) draw(1, 0); else start(); }

  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      if (resize() && (still || settled)) draw(1, 0);
    }).observe(canvas);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      onscreen = es[0].isIntersecting;
      if (onscreen) start(); else stop();
    }, { threshold: 0 }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (resize() && still) draw(1, 0); });
  }
})();

/* The design-partner chapters — vertical scroll, horizontal track.

   The section is given enough height to hold the sequence, its inner block is
   sticky, and where the page has scrolled through that height decides how far
   the track has moved. Nothing is dragged and nothing scrolls horizontally:
   the overflow is hidden and the movement is a transform, so there is no
   scrollbar and no second scroll surface to get trapped in.

   The pin is an enhancement and is treated as one. The markup and the CSS
   default to a plain stacked list; this adds .is-pinned only when the track
   genuinely overflows and the reader has not asked for reduced motion, and
   takes it off again the moment either stops being true. So no JS, a narrow
   screen, or reduce-motion all land on the same readable list rather than on
   a broken effect.

   Two details worth keeping:

   · The inset is measured off a real .wrap rather than recomputed from vw, so
     chapter 01 starts exactly on the container's left margin. A vw formula
     disagrees with the container by the width of the scrollbar.
   · Progress is read from the section's own top rather than from a running
     total, so it is correct on the first frame after a resize, a reload
     part-way down the page, or a jump via the back button. */
(function () {
  'use strict';

  var root = document.querySelector('[data-hscroll]');
  if (!root) return;
  var sticky = root.querySelector('.ea-hscroll__sticky');
  var viewport = root.querySelector('.ea-hscroll__viewport');
  var track = root.querySelector('.ea-hscroll__track');
  var fill = root.querySelector('.ea-hscroll__fill');
  if (!sticky || !viewport || !track || !track.children.length) return;

  var chapters = [].slice.call(track.children);
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var pinned = false, span = 0, drive = 0, tail = 0, ticking = false, activeIdx = -1;

  function unpin() {
    pinned = false;
    root.classList.remove('is-pinned');
    root.style.height = '';
    root.style.removeProperty('--page-inset');
    track.style.transform = '';
    if (fill) fill.style.transform = '';
    /* The stacked fallback has no 'current' chapter — the reader sees all
       four at once — so the accent comes off every number. */
    for (var i = 0; i < chapters.length; i++) chapters[i].classList.remove('is-active');
    activeIdx = -1;
  }

  function measure() {
    if (reduce.matches) { unpin(); return; }

    var wrap = document.querySelector('.page .wrap');
    if (wrap) {
      var inset = Math.max(0, Math.round(wrap.getBoundingClientRect().left));
      root.style.setProperty('--page-inset', inset + 'px');
    }

    /* Lay it out pinned before measuring: the chapters are a different width
       in the two states, so measuring the stacked one tells us nothing. */
    root.classList.add('is-pinned');
    root.style.height = '';
    track.style.transform = 'translate3d(0,0,0)';

    var vr = viewport.getBoundingClientRect();
    var last = track.children[track.children.length - 1];
    var padRight = parseFloat(getComputedStyle(track).paddingRight) || 0;
    span = Math.round(last.getBoundingClientRect().right - vr.left + padRight - vr.width);

    /* Nothing to travel — the four already fit, so pinning would hold the
       reader still for no reason. */
    if (!(span > 32)) { unpin(); return; }

    pinned = true;
    var h = sticky.offsetHeight;

    /* How far you scroll is not how far the track moves. Tied one to one the
       sequence is over in a third of a screen, because the four chapters only
       overhang the viewport by a few hundred pixels — the movement has to be
       slower than the scroll to read as deliberate rather than as a twitch.

       Held between 0.8 and 1.6 screens so the pace is the same wherever the
       geometry lands: on a wide screen the overhang is small and this pads it
       out, on a phone it is large and this reins it in. */
    drive = Math.round(Math.min(Math.max(span * 1.8, h * 0.8), h * 1.6));

    /* And a little past the end, so the last chapter is held in frame before
       the page moves on. Without it 04 arrives and is gone in one scroll and
       the sequence has no ending. */
    tail = Math.round(h * 0.2);

    root.style.height = (h + drive + tail) + 'px';
    update();
  }

  function update() {
    if (!pinned) return;
    var top = root.getBoundingClientRect().top;
    var p = drive > 0 ? -top / drive : 0;
    if (p < 0) p = 0; else if (p > 1) p = 1;
    track.style.transform = 'translate3d(' + (-(p * span)).toFixed(2) + 'px,0,0)';
    if (fill) fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';

    /* Which chapter it is currently the turn of. Taken from progress rather
       than from what is leftmost on screen: at the end of the run 04 is the
       conclusion even though 02 is still the leftmost thing in frame, and the
       numbers are what carry 01 → 02 → 03 → 04. */
    var idx = Math.floor(p * chapters.length);
    if (idx > chapters.length - 1) idx = chapters.length - 1;
    if (idx !== activeIdx) {
      if (activeIdx >= 0 && chapters[activeIdx]) chapters[activeIdx].classList.remove('is-active');
      chapters[idx].classList.add('is-active');
      activeIdx = idx;
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }

  var reflow = null;
  function schedule() {
    clearTimeout(reflow);
    reflow = setTimeout(measure, 140);
  }

  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  if (reduce.addEventListener) reduce.addEventListener('change', measure);
  else if (reduce.addListener) reduce.addListener(measure);
  /* The chapters are set in a web font; when it lands their widths change. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* A tab opened in the background paints no frames, so the first measure can
     run before layout has settled. Timers still fire there. */
  setTimeout(measure, 1200);
})();

/* About — Europe as a network.

   A field of dots in the shape of the landmass, nodes on the real coordinates
   of twenty European cities, and links that draw themselves between them.
   Amsterdam is the one node in the accent; everything else is ink and
   hairline, at the weights the rest of this site uses.

   The silhouette is a dot matrix rather than a drawn coastline. At this
   pitch the dots quantise the boundary, so the shape reads without a
   hand-authored outline pretending to a precision it does not have — and the
   result is a field, which is what the page is about, rather than a map.

   Positions are real: longitude and latitude through an equirectangular
   projection, with x scaled by the cosine of the mean latitude so Europe is
   not stretched sideways. The arrangement is therefore correct by
   construction rather than by eye.

   Canvas, like the other figures on this site. It settles once, then the
   nodes breathe and one link at a time draws itself; under
   prefers-reduced-motion it draws the settled state and never moves. */
(function () {
  'use strict';

  var canvas = document.querySelector('[data-europe-net]');
  if (!canvas) return;
  var ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;

  /* ---------- geography ---------- */
  var LON0 = -10.5, LON1 = 30.5, LAT0 = 35, LAT1 = 63.5;
  var KX = Math.cos(49 * Math.PI / 180);          /* mean-latitude correction */

  /* Coarse landmass outlines. Deliberately rough: they are a mask for a dot
     field, not a coastline anyone reads. */
  var LAND = [
    [[-9.5,38.7],[-8.8,42.0],[-9.0,43.5],[-4.0,43.6],[-1.7,43.4],[-1.1,45.8],[-2.1,47.1],
     [-4.7,48.4],[-1.4,48.7],[0.4,49.5],[2.2,51.1],[4.3,51.6],[5.0,53.2],[7.2,53.7],
     [8.4,55.0],[9.5,57.4],[10.7,57.6],[12.4,56.1],[14.3,55.4],[16.5,55.0],[18.6,54.6],
     [21.0,55.5],[23.5,55.5],[26.0,56.5],[28.5,56.0],[30.0,54.0],[30.0,48.0],[29.5,45.5],
     [28.5,44.0],[27.5,42.5],[26.5,41.0],[25.0,40.5],[23.5,38.0],[21.5,38.0],[20.0,39.5],
     [19.3,41.5],[18.0,42.8],[16.0,43.5],[13.6,45.5],[12.4,44.5],[13.5,42.0],[15.5,40.0],
     [17.2,40.5],[18.4,40.1],[16.5,38.9],[15.6,38.0],[15.9,40.0],[14.0,41.5],[12.0,43.8],
     [10.2,44.0],[8.8,44.4],[7.5,43.8],[4.8,43.4],[3.0,42.5],[0.7,40.6],[-0.3,38.9],
     [-2.2,36.8],[-5.4,36.1],[-7.0,37.0],[-8.9,37.0]],
    [[5.2,58.4],[4.9,60.5],[6.5,62.5],[9.0,63.5],[12.0,63.9],[15.0,63.5],[17.5,62.5],
     [19.0,60.5],[18.5,58.5],[16.5,56.4],[14.0,55.4],[12.0,55.5],[11.0,57.5],[8.0,58.2]],
    [[-5.3,50.1],[-3.0,51.4],[-4.8,53.4],[-5.0,55.0],[-5.8,57.5],[-3.0,58.6],[-1.5,57.5],
     [-0.2,53.7],[1.7,52.7],[0.7,51.0],[-2.5,50.6]],
    [[-10.2,51.6],[-10.0,54.3],[-8.0,55.2],[-6.0,54.4],[-6.1,52.2],[-8.3,51.5]]
  ];

  /* name kept only so the list is readable; nothing is drawn from it */
  var CITY = [
    ['Amsterdam',52.37,4.90,1], ['London',51.51,-0.13,0], ['Paris',48.86,2.35,0],
    ['Berlin',52.52,13.40,0],   ['Madrid',40.42,-3.70,0], ['Rome',41.90,12.50,0],
    ['Warsaw',52.23,21.01,0],   ['Stockholm',59.33,18.07,0], ['Copenhagen',55.68,12.57,0],
    ['Vienna',48.21,16.37,0],   ['Zurich',47.38,8.54,0],  ['Dublin',53.35,-6.26,0],
    ['Lisbon',38.72,-9.14,0],   ['Prague',50.08,14.44,0], ['Oslo',59.91,10.75,0],
    ['Milan',45.46,9.19,0],     ['Munich',48.14,11.58,0], ['Brussels',50.85,4.35,0],
    ['Barcelona',41.39,2.17,0], ['Hamburg',53.55,9.99,0], ['Helsinki',60.17,24.94,0],
    ['Budapest',47.50,19.04,0]
  ];

  var LINK = [[0,1],[0,3],[0,2],[0,17],[0,8],[3,6],[3,13],[2,4],[2,10],[5,15],[15,10],
              [8,7],[7,14],[7,20],[9,21],[9,16],[16,10],[4,18],[18,15],[1,11],[12,4],
              [6,20],[13,9],[19,8],[17,2],[0,19]];

  /* ---------- projection ---------- */
  var W = 0, H = 0, S = 1, OX = 0, OY = 0;
  function project(lon, lat) {
    return { x: OX + (lon - LON0) * KX * S, y: OY + (LAT1 - lat) * S };
  }
  function fit() {
    var uw = (LON1 - LON0) * KX, uh = LAT1 - LAT0;
    S = Math.min(W / uw, H / uh) * 0.98;
    OX = (W - uw * S) / 2;
    OY = (H - uh * S) / 2;
  }

  function inside(pt, poly) {
    var hit = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a.y > pt.y) !== (b.y > pt.y) &&
          pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  }

  var dots = [], nodes = [], polys = [];
  function build() {
    polys = LAND.map(function (ring) {
      return ring.map(function (p) { return project(p[0], p[1]); });
    });

    /* The matrix. Pitch is in screen pixels so the texture stays even
       whatever size the column resolves to. */
    var step = Math.max(7, Math.min(11, Math.round(Math.min(W, H) / 46)));
    dots = [];
    for (var y = step / 2; y < H; y += step) {
      for (var x = step / 2; x < W; x += step) {
        var pt = { x: x, y: y };
        for (var k = 0; k < polys.length; k++) {
          if (inside(pt, polys[k])) { dots.push({ x: x, y: y }); break; }
        }
      }
    }

    nodes = CITY.map(function (c, i) {
      var p = project(c[2], c[1]);
      return { x: p.x, y: p.y, accent: !!c[3], ph: (i * 2.399) % (Math.PI * 2) };
    });
  }

  var C = { ink: '#17232B', line: 'rgba(23,35,43,0.16)', accent: '#D95C32' };
  function readColours() {
    var cs = getComputedStyle(canvas);
    C.ink = cs.getPropertyValue('--heading').trim() || C.ink;
    C.line = cs.getPropertyValue('--line').trim() || C.line;
    C.accent = cs.getPropertyValue('--accent').trim() || C.accent;
  }

  function resize() {
    var box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = box.width; H = box.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fit(); build();
    return true;
  }

  /* ---------- drawing ---------- */
  var ACTIVE_EVERY = 2600, DRAW_MS = 1100, HOLD_MS = 900;

  function draw(t, still) {
    ctx.clearRect(0, 0, W, H);

    /* the landmass */
    ctx.fillStyle = C.ink;
    ctx.globalAlpha = 0.13;
    for (var i = 0; i < dots.length; i++) {
      ctx.beginPath();
      ctx.arc(dots[i].x, dots[i].y, 1.15, 0, Math.PI * 2);
      ctx.fill();
    }

    /* the standing links */
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var l = 0; l < LINK.length; l++) {
      var a = nodes[LINK[l][0]], b = nodes[LINK[l][1]];
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    /* one link at a time, drawing itself */
    if (!still) {
      var cycle = t % (ACTIVE_EVERY * LINK.length);
      var idx = Math.floor(cycle / ACTIVE_EVERY);
      var local = cycle - idx * ACTIVE_EVERY;
      var na = nodes[LINK[idx][0]], nb = nodes[LINK[idx][1]];
      var grow = Math.min(1, local / DRAW_MS);
      var fade = local < DRAW_MS + HOLD_MS ? 1
               : Math.max(0, 1 - (local - DRAW_MS - HOLD_MS) / 600);
      if (fade > 0) {
        ctx.save();
        ctx.strokeStyle = C.accent;
        ctx.globalAlpha = 0.55 * fade;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(na.x + (nb.x - na.x) * grow, na.y + (nb.y - na.y) * grow);
        ctx.stroke();
        ctx.restore();
      }
    }

    /* the cities */
    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n];
      var pulse = still ? 0 : Math.sin(t / 1000 * 0.55 + nd.ph);
      ctx.beginPath();
      ctx.fillStyle = nd.accent ? C.accent : C.ink;
      ctx.globalAlpha = nd.accent ? 1 : 0.62 + 0.14 * pulse;
      ctx.arc(nd.x, nd.y, (nd.accent ? 3.1 : 2.05) + (nd.accent ? 0.25 : 0.18) * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    /* the one ring, around the one accent node */
    var ams = nodes[0];
    ctx.globalAlpha = still ? 0.35 : 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(t / 1000 * 0.5));
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ams.x, ams.y, still ? 8 : 7 + 2.4 * (0.5 + 0.5 * Math.sin(t / 1000 * 0.5)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = null, t0 = 0, onscreen = true, ready = false, painted = false;

  function frame(now) {
    raf = null;
    if (!onscreen) return;
    if (!t0) t0 = now;
    draw(now - t0, false);
    painted = true;
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (!ready || !onscreen) return;
    if (still) { draw(0, true); painted = true; return; }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  readColours();
  ready = resize();
  start();

  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { if (resize()) { ready = true; if (still || !raf) draw(0, still); } }).observe(canvas);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      onscreen = es[0].isIntersecting;
      if (onscreen) start(); else stop();
    }, { threshold: 0 }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  /* A renderer that never paints — a backgrounded tab — produces no frames,
     so nothing would be drawn at all. Timers still run there. */
  setTimeout(function () { if (!painted && ready) draw(0, true); }, 1600);
})();
