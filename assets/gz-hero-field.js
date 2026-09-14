/* ==========================================================================
   gz-hero-field — the node field the Product hero travels through
   ==========================================================================

   A cloud of points sitting in front of the navy, drifting toward the viewer.
   Two canvases draw one scene between them: everything beyond NEAR goes on the
   back canvas, everything nearer than NEAR on the front one, with the headline
   sitting between the two. That split is the whole point — the closest points
   pass in front of the type, so the words are inside the field rather than on
   top of a picture of one.

   Both canvases build the same field, because the field is seeded: the same
   points, in the same places, on every load. Only the pointer moves the camera;
   nothing rotates on its own, so a still page is genuinely still except for the
   forward travel.

   Plain browser JS, no build step and no dependencies. It finds its own
   canvases and does nothing if there are none, so it is safe to load anywhere.
   ========================================================================== */

(function () {
  "use strict";

  var canvases = document.querySelectorAll("canvas[data-gz-field]");
  if (!canvases.length) return;

  /* ---------- constants the scene is built around ---------- */

  /* How deep the cloud runs before it repeats. A point leaving the front is
     the same point re-entering at the back; the fade at both ends is what
     hides the seam. */
  var SPAN = 3.4;

  /* The plane that divides the two canvases. In camera depth, not model
     depth: a point is "near" once it is closer than this to the eye. */
  var NEAR = 1.45;

  /* The eye sits this far back from the model's origin. */
  var EYE = 2.15;

  /* Closer than this and the projection blows up, so the point is dropped. */
  var MIN_Z = 0.3;

  var NAVY = "#17232B";
  var ORANGE = "#FF6A00";
  var WARM = "#FF8A33";

  /* Link search. Cells are a shade smaller than the reach so a pair can never
     sit more than one cell apart and be missed. */
  var LINK_DIST = 36;
  var CELL = 34;

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    /* older browsers: treat as no preference */
  }

  /* ---------- a small seeded generator ----------

     mulberry32. Deterministic, which is the only property that matters here:
     the field has to be the same on the back canvas and the front one, and the
     same on every visit, or the two halves would not compose into one scene. */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function num(el, name, fallback) {
    var v = parseFloat(el.getAttribute(name));
    return isFinite(v) ? v : fallback;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /* ---------- building one field ----------

     Points are grouped rather than scattered: 22 loose clusters, each filled
     from its centre outward. Scattered points read as static; clusters read as
     structure, which is what the page is about. */
  function buildNodes(count, seed) {
    var rnd = mulberry32(seed);
    var i, c;

    var CLUSTERS = 22;
    var centres = [];
    for (i = 0; i < CLUSTERS; i++) {
      centres.push({
        x: -1.1 + rnd() * 2.2,
        y: -0.6 + rnd() * 1.2,
        z: -1.2 + rnd() * 2.4,
        r: 0.1 + rnd() * 0.26,
      });
    }

    /* Share the points out, but unevenly — a cluster takes anywhere from 60%
       to 140% of an even share, so the field has dense knots and thin ones. */
    var weights = [];
    var total = 0;
    for (i = 0; i < CLUSTERS; i++) {
      var wgt = 0.6 + rnd() * 0.8;
      weights.push(wgt);
      total += wgt;
    }

    var nodes = [];
    for (c = 0; c < CLUSTERS; c++) {
      var centre = centres[c];
      var n = Math.round(count * (weights[c] / total));
      if (c === CLUSTERS - 1)
        n = count - nodes.length; /* absorb the rounding */

      for (i = 0; i < n; i++) {
        /* A direction picked evenly over the sphere, then a radius biased
           outward so the cluster has a body rather than a hot centre. The y
           component is squeezed, which settles the clusters into the
           horizontal band the headline sits in. */
        var u = rnd() * 2 - 1;
        var theta = rnd() * Math.PI * 2;
        var s = Math.sqrt(1 - u * u);
        var rad = Math.pow(rnd(), 0.55) * centre.r;

        nodes.push({
          X: centre.x + s * Math.cos(theta) * rad,
          Y: centre.y + u * rad * 0.7,
          Z: centre.z + s * Math.sin(theta) * rad,
          w: rnd(),
          ph: rnd() * Math.PI * 2,
          amp: 0.004 + rnd() * 0.012,
        });
      }
    }
    return nodes;
  }

  /* ---------- the grain ----------

     One tile of grey noise, built once per size and laid over the finished
     frame. It is what stops the gradients behind it from banding on a wide
     navy ground. */
  function buildGrain(w, h) {
    var tile = document.createElement("canvas");
    tile.width = Math.max(1, Math.round(w));
    tile.height = Math.max(1, Math.round(h));
    var g = tile.getContext("2d");
    if (!g) return null;

    var img = g.createImageData(tile.width, tile.height);
    var d = img.data;
    var a = Math.round(0.04 * 255);
    for (var i = 0; i < d.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = a;
    }
    g.putImageData(img, 0, 0);
    return tile;
  }

  /* ---------- one canvas ---------- */

  function Scene(el) {
    this.el = el;
    this.ctx = el.getContext("2d");
    if (!this.ctx) return;

    this.layer =
      el.getAttribute("data-gz-layer") === "front" ? "front" : "back";
    this.spread = num(el, "data-gz-spread", 1.55);
    this.dot = num(el, "data-gz-dot", 0.95);
    this.bright = num(el, "data-gz-bright", 1.35);
    this.edge = num(el, "data-gz-edge", 1);
    this.speed = num(el, "data-gz-speed", 0.95);
    this.scrim = el.getAttribute("data-gz-scrim") || "none";
    this.scrimStrength = num(el, "data-gz-scrim-strength", 0.82);

    var count = Math.max(1, Math.round(num(el, "data-gz-nodes", 1100)));

    /* The seed is fixed unless the markup names one. Both hero canvases carry
       the same attributes, so both build the same field and their two halves
       line up. */
    this.nodes = buildNodes(count, num(el, "data-gz-seed", 0x9e3779b9));

    /* Reused every frame so the draw allocates nothing. */
    this.proj = [];
    for (var i = 0; i < count; i++) {
      this.proj.push({ x: 0, y: 0, r: 0, a: 0, w: 0, zc: 0, fade: 0, k: 0 });
    }
    this.live = 0;
    this.buckets = {};

    this.camX = 0;
    this.camY = 0;
    this.targetX = 0;
    this.targetY = 0;

    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.grain = null;
    this.visible = true;

    this.fit();
    this.bind();
  }

  Scene.prototype.fit = function () {
    var rect = this.el.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (w === this.w && h === this.h && dpr === this.dpr) return;

    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.el.width = Math.round(w * dpr);
    this.el.height = Math.round(h * dpr);
    /* Every measurement below is in CSS pixels; the backing store scale is
       set once here and never thought about again. */
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.layer === "back") this.grain = buildGrain(w, h);
  };

  Scene.prototype.bind = function () {
    var self = this;

    /* The pointer is read from the window rather than the canvas: the front
       canvas and the copy over the hero both let clicks through, so a listener
       on the canvas itself would only ever hear about half the hero. Both
       canvases share a rect, so both arrive at the same camera. */
    this.onPointer = function (e) {
      var rect = self.el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      self.targetX = clamp(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -1,
        1,
      );
      self.targetY = clamp(
        ((e.clientY - rect.top) / rect.height) * 2 - 1,
        -1,
        1,
      );
    };
    window.addEventListener("pointermove", this.onPointer, { passive: true });

    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(function () {
        self.fit();
      });
      this.ro.observe(this.el);
    } else {
      window.addEventListener("resize", function () {
        self.fit();
      });
    }
  };

  /* ---------- project every point, once per frame ---------- */

  Scene.prototype.project = function (t) {
    var nodes = this.nodes,
      proj = this.proj;
    var w = this.w,
      h = this.h;

    /* Time only ever enters as forward travel and as the points' own small
       wander. The camera angle comes from the pointer alone. */
    var flow = t * 0.000092 * this.speed;

    this.camX += (this.targetX - this.camX) * 0.05;
    this.camY += (this.targetY - this.camY) * 0.05;

    var yaw = this.camX * 0.26;
    var pitch = -0.06 + this.camY * 0.1;
    var cy = Math.cos(yaw),
      sy = Math.sin(yaw);
    var cp = Math.cos(pitch),
      sp = Math.sin(pitch);

    var scale = h * 0.82;
    var half = SPAN / 2;
    var wob1 = t * 0.00024,
      wob2 = t * 0.0002;
    var near = this.layer === "front";
    var live = 0;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];

      /* Wrap the depth so the cloud never runs out. */
      var zr = (n.Z - flow) % SPAN;
      if (zr < 0) zr += SPAN;
      zr -= half;

      /* Fade in at the far plane and out as it passes, so the wrap cannot be
         seen happening. */
      var fade = (half + zr) / 0.55;
      var out = (half - zr) / 0.7;
      if (out < fade) fade = out;
      if (fade <= 0) continue;
      if (fade > 1) fade = 1;

      var x = n.X + Math.sin(wob1 + n.ph) * n.amp;
      var y = n.Y + Math.cos(wob2 + n.ph * 1.3) * n.amp;

      /* Yaw about Y, then pitch about X. */
      var x1 = x * cy + zr * sy;
      var z1 = -x * sy + zr * cy;
      var y2 = y * cp - z1 * sp;
      var z2 = y * sp + z1 * cp;

      var zc = z2 + EYE;
      if (zc < MIN_Z) continue;

      /* This canvas draws only its own half of the field. */
      if (near ? zc >= NEAR : zc < NEAR) continue;

      var k = 2.4 / zc;
      var p = proj[live++];
      p.x = w * 0.62 + x1 * k * scale * this.spread;
      p.y = h * 0.5 + y2 * k * scale;
      p.zc = zc;
      p.fade = fade;
      p.k = k;
      p.w = n.w;
    }
    this.live = live;
  };

  /* ---------- links ----------

     Worked out from where the points land on screen, not from a list drawn up
     in advance. That is what gives the field its behaviour: a point arrives
     alone out of the far distance, picks up links as it comes forward and into
     company, and loses them again as it passes. Nothing is choreographed.

     A bucket grid keeps it honest — each point only ever looks at the nine
     cells around it, so the cost stays linear however many points there are. */
  Scene.prototype.links = function () {
    var ctx = this.ctx,
      proj = this.proj,
      live = this.live;
    var buckets = this.buckets;
    var key, i;

    for (key in buckets) {
      if (buckets[key]) buckets[key].length = 0;
    }

    for (i = 0; i < live; i++) {
      var p = proj[i];
      key = ((p.x / CELL) | 0) + ":" + ((p.y / CELL) | 0);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(i);
    }

    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 1;

    for (i = 0; i < live; i++) {
      var a = proj[i];
      var cx = (a.x / CELL) | 0,
        cyi = (a.y / CELL) | 0;

      for (var gx = cx - 1; gx <= cx + 1; gx++) {
        for (var gy = cyi - 1; gy <= cyi + 1; gy++) {
          var cell = buckets[gx + ":" + gy];
          if (!cell) continue;

          for (var m = 0; m < cell.length; m++) {
            var j = cell[m];
            if (j <= i) continue; /* each pair once */
            var b = proj[j];

            var dx = a.x - b.x,
              dy = a.y - b.y;
            var d2 = dx * dx + dy * dy;
            if (d2 > LINK_DIST * LINK_DIST) continue;

            var d = Math.sqrt(d2);
            var zc = a.zc < b.zc ? a.zc : b.zc;
            var forward = clamp(1 - (zc - 1.4) / 1.9, 0, 1);
            var f = a.fade < b.fade ? a.fade : b.fade;
            var alpha = 0.4 * this.edge * (1 - d / LINK_DIST) * forward * f;
            if (alpha < 0.007) continue;

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  };

  /* ---------- the far half ---------- */

  Scene.prototype.drawBack = function () {
    var ctx = this.ctx,
      proj = this.proj,
      live = this.live;
    var w = this.w,
      h = this.h;

    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, w, h);

    this.links();

    /* Flat fills, never a gradient per point: at a thousand points a frame the
       gradient objects alone would cost more than everything else here. */
    var sizeAt = this.dot * (h / 760);
    for (var i = 0; i < live; i++) {
      var p = proj[i];
      var r = p.k * (0.34 + p.w * 0.8) * sizeAt;
      if (r < 0.35) r = 0.35;

      var fog = clamp(1 - (p.zc - 0.9) / 2.9, 0, 1) * p.fade;
      var alpha = 0.75 * fog * (0.5 + 0.5 * p.w) * this.bright;
      if (alpha > 1) alpha = 1;
      if (alpha < 0.004) continue;

      /* Weight decides colour: a few points carry the accent, a few more the
         warm tint, and the rest are white and hold back. */
      if (p.w > 0.86) {
        ctx.fillStyle = ORANGE;
      } else if (p.w > 0.56) {
        ctx.fillStyle = WARM;
      } else {
        ctx.fillStyle = "#FFFFFF";
        alpha *= 0.62;
      }

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 6.283185307179586);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.grain) {
      ctx.globalAlpha = 0.45;
      ctx.drawImage(this.grain, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    this.drawScrim();
  };

  /* ---------- the near half ----------

     Drawn as soft discs rather than points. These are the ones passing the
     camera, and a lens would not hold them in focus; a hard dot this close
     reads as dirt on the screen instead of depth. */
  Scene.prototype.drawFront = function () {
    var ctx = this.ctx,
      proj = this.proj,
      live = this.live;

    ctx.clearRect(0, 0, this.w, this.h);

    var sizeAt = this.dot * (this.h / 760);
    for (var i = 0; i < live; i++) {
      var p = proj[i];
      var r = p.k * (0.34 + p.w * 0.8) * sizeAt;
      if (r < 0.35) r = 0.35;

      var fog = clamp(1 - (p.zc - 0.9) / 2.9, 0, 1) * p.fade;
      var alpha = 0.3 * fog * (0.5 + 0.5 * p.w) * this.bright;
      if (alpha > 1) alpha = 1;
      if (alpha < 0.004) continue;

      var col =
        p.w > 0.86 ? "255,106,0" : p.w > 0.56 ? "255,138,51" : "255,255,255";
      if (p.w <= 0.56) alpha *= 0.62;

      var spread = r * 4.5;
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, spread);
      g.addColorStop(0, "rgba(" + col + "," + alpha * 0.55 + ")");
      g.addColorStop(1, "rgba(" + col + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, spread, 0, 6.283185307179586);
      ctx.fill();
    }
  };

  /* ---------- the scrim ----------

     Navy laid back over the left of the frame, heaviest where the headline
     starts and thinning to nothing on the right. It is what lets white type at
     80px sit on a field of moving points and still read: behind the words the
     ground is the page's own navy, and the field only appears past them. */
  Scene.prototype.drawScrim = function () {
    if (this.scrim !== "soft") return;

    var ctx = this.ctx,
      w = this.w,
      h = this.h;
    var s = this.scrimStrength;
    var r = Math.max(w * 0.52, h * 0.95);

    var g = ctx.createRadialGradient(w * 0.3, h * 0.5, 0, w * 0.3, h * 0.5, r);
    g.addColorStop(0, "rgba(23,35,43," + 0.88 * s + ")");
    g.addColorStop(0.42, "rgba(23,35,43," + 0.72 * s + ")");
    g.addColorStop(0.72, "rgba(23,35,43," + 0.3 * s + ")");
    g.addColorStop(1, "rgba(23,35,43,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(23,35,43," + 0.16 * s + ")";
    ctx.fillRect(0, 0, w, h);
  };

  Scene.prototype.frame = function (t) {
    this.project(t);
    if (this.layer === "front") this.drawFront();
    else this.drawBack();
  };

  /* ---------- drive them all from one loop ---------- */

  var scenes = [];
  for (var i = 0; i < canvases.length; i++) {
    var scene = new Scene(canvases[i]);
    if (scene.ctx) scenes.push(scene);
  }
  if (!scenes.length) return;

  /* Visibility is measured, not observed. An IntersectionObserver reports
     against the nearest scrolling ancestor and gets the answer wrong whenever
     something above the canvas carries a CSS transform — which a hero often
     does. A rect every fifth of a second costs nothing and is always right. */
  function measure() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var s = 0; s < scenes.length; s++) {
      var rect = scenes[s].el.getBoundingClientRect();
      scenes[s].visible = rect.bottom > -300 && rect.top < vh + 300;
    }
  }
  measure();
  setInterval(measure, 220);

  var start = 0;
  function tick(now) {
    if (!start) start = now;
    var t = now - start;
    for (var s = 0; s < scenes.length; s++) {
      if (scenes[s].visible) scenes[s].frame(t);
    }
    requestAnimationFrame(tick);
  }

  if (reduced) {
    /* One frame, held. The field is a still image of itself. */
    for (var r = 0; r < scenes.length; r++) scenes[r].frame(0);
  } else {
    requestAnimationFrame(tick);
  }
})();
