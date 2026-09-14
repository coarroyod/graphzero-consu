/* ==========================================================================
   gen-hero-field — draws the Early Access hero's field, once, at build time
   ==========================================================================

   Writes assets/brand/ea-field.svg. The Product hero earns its canvas: it
   moves, and the movement is the point. This one does not move, so there is no
   reason to ship a thousand points and a render loop to a phone in order to
   arrive at a picture that never changes. It is a picture.

   Depth is the whole effect. The surviving points are sorted by distance and
   cut into three even bands; the far third is blurred hard and drawn large and
   faint, the middle third softly, the near third sharp and small, with the
   links only among the near ones. That is what a lens does, and it is why the
   flat thing reads as deep.

   Run:  node scripts/gen-hero-field.mjs     (or: npm run gen:hero)

   Deterministic: every random number comes from one seeded generator, drawn in
   a fixed order and never conditionally, so two runs on two machines produce
   the same bytes. The output is committed; regenerate only when you mean to.

   No dependencies, and nothing here runs in a browser.
   ========================================================================== */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "..", "assets", "brand", "ea-field.svg");

/* ---------- constants ---------- */

const W = 1280;
const H = 560;
const SEED = 90210;
const N = 520;
const SPAN = 3.4;

const PLAIN = "#17232B";
const ACCENT = "#FF6A00";
const WARM = "#FF8A33";

const CLUSTERS = 14;
const EYE = 2.15;
const MIN_Z = 0.6;
const LINK_DIST = 70;

const BANDS = [
  { name: "far", blur: 5, alpha: 0.44, rmul: 1.6 },
  { name: "mid", blur: 1.6, alpha: 0.54, rmul: 1.15 },
  { name: "sharp", blur: 0, alpha: 0.68, rmul: 1.0 },
];

/* ---------- the generator ---------- */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(SEED);

/* ---------- the cloud ---------- */

const centres = [];
for (let i = 0; i < CLUSTERS; i++) {
  centres.push({
    x: -0.85 + rnd() * 1.7,
    y: -0.55 + rnd() * 1.1,
    z: -1.3 + rnd() * 2.6,
    r: 0.12 + rnd() * 0.3,
  });
}

/* Uneven shares, so the field has knots and thin places rather than an even
   sprinkle. Each cluster takes 60-140% of a flat share. */
const weights = [];
let weightTotal = 0;
for (let i = 0; i < CLUSTERS; i++) {
  const w = 0.6 + rnd() * 0.8;
  weights.push(w);
  weightTotal += w;
}

/* Every per-node random is drawn here, in one pass, before anything is
   projected or dropped. Drawing them later would make the sequence depend on
   which nodes survive the filters, and the file would stop being reproducible
   the moment a constant moved. */
const nodes = [];
for (let c = 0; c < CLUSTERS; c++) {
  const centre = centres[c];
  let n = Math.round(N * (weights[c] / weightTotal));
  if (c === CLUSTERS - 1) n = N - nodes.length;

  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1;
    const theta = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const rad = Math.pow(rnd(), 0.55) * centre.r;

    nodes.push({
      X: centre.x + s * Math.cos(theta) * rad,
      Y: centre.y + u * rad * 0.7,
      Z: centre.z + s * Math.sin(theta) * rad,
      w: rnd(),
      rr: rnd(),
    });
  }
}

/* ---------- project ---------- */

const half = SPAN / 2;
const scale = H * 0.82;
const live = [];

for (const n of nodes) {
  let zr = n.Z % SPAN;
  if (zr < 0) zr += SPAN;
  zr -= half;

  const zc = zr + EYE;
  if (zc < MIN_Z) continue;

  const k = 2.4 / zc;
  const px = W * 0.58 + n.X * k * scale * 1.15;
  const py = H * 0.5 + n.Y * k * scale;
  if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;

  const fade = Math.min(1, Math.min((half + zr) / 0.55, (half - zr) / 0.7));
  if (fade < 0.05) continue;

  live.push({
    px,
    py,
    zc,
    fade,
    w: n.w,
    r: Math.max(0.9, k * (0.4 + n.rr * 0.7) * 1.5),
  });
}

/* ---------- three even bands ----------

   Even thirds, not fixed depth thresholds. This cloud sits mostly at one
   distance, so cutting it at chosen zc values empties the middle band and the
   effect collapses into "some blurred dots and some sharp ones". Thirds
   guarantee all three are populated whatever the seed does. */
live.sort((a, b) => b.zc - a.zc);

const third = Math.floor(live.length / 3);
const split = [
  live.slice(0, third),
  live.slice(third, third * 2),
  live.slice(third * 2),
];

split.forEach((band, i) => {
  if (!band.length) {
    throw new Error(
      `band "${BANDS[i].name}" is empty — the field would lose its depth`,
    );
  }
});

/* ---------- buckets ----------

   One path per (fill, alpha, radius) rather than one element per dot. Same
   picture, a fraction of the bytes: an element each would run to roughly
   800 KB of markup for a drawing nobody can tell apart from this one. */
const qAlpha = (a) => Math.round(a * 20) / 20;
const qRad = (r) => Math.round(r * 2) / 2;

function fillFor(w) {
  if (w > 0.9) return ACCENT;
  if (w > 0.68) return WARM;
  return PLAIN;
}

function dotArc(x, y, r) {
  return `M${x} ${y}m-${r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

function bandMarkup(band, spec) {
  const buckets = new Map();

  for (const p of band) {
    const fill = fillFor(p.w);
    let a = Math.min(1, spec.alpha * (0.55 + 0.45 * p.w) * p.fade);
    if (fill === PLAIN) a *= 0.72;
    if (a < 0.05) continue;

    const key = `${fill}|${qAlpha(a)}|${qRad(p.r * spec.rmul)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets
      .get(key)
      .push(dotArc(Math.round(p.px), Math.round(p.py), qRad(p.r * spec.rmul)));
  }

  const paths = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, ds]) => {
      const [fill, a] = key.split("|");
      return `<path fill="${fill}" fill-opacity="${a}" d="${ds.join("")}"/>`;
    })
    .join("");

  const filter = spec.blur ? ` filter="url(#blur-${spec.name})"` : "";
  return { markup: `<g${filter}>${paths}</g>`, count: buckets.size };
}

/* ---------- links, among the near third only ---------- */

function linkMarkup(band) {
  const buckets = new Map();
  let segments = 0;

  for (let i = 0; i < band.length; i++) {
    for (let j = i + 1; j < band.length; j++) {
      const dx = band[i].px - band[j].px;
      const dy = band[i].py - band[j].py;
      const d2 = dx * dx + dy * dy;
      if (d2 > LINK_DIST * LINK_DIST) continue;

      const a = 0.32 * (1 - Math.sqrt(d2) / LINK_DIST);
      if (a < 0.05) continue;

      const key = String(qAlpha(a));
      if (!buckets.has(key)) buckets.set(key, []);
      buckets
        .get(key)
        .push(
          `M${Math.round(band[i].px)} ${Math.round(band[i].py)}L${Math.round(band[j].px)} ${Math.round(band[j].py)}`,
        );
      segments++;
    }
  }

  const paths = [...buckets.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(
      ([a, ds]) =>
        `<path stroke="${ACCENT}" stroke-opacity="${a}" stroke-width="1" fill="none" d="${ds.join("")}"/>`,
    )
    .join("");

  return { markup: `<g>${paths}</g>`, segments };
}

const far = bandMarkup(split[0], BANDS[0]);
const mid = bandMarkup(split[1], BANDS[1]);
const sharp = bandMarkup(split[2], BANDS[2]);
const links = linkMarkup(split[2]);

/* ---------- assemble ----------

   The mask is on the field alone. The grain and the veil run the full height:
   they are the page's surface, not part of the drawing, and fading them would
   put a visible edge back exactly where the mask is there to remove one. */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="presentation">
<title>graphzero — Early Access field</title>
<defs>
<filter id="blur-far" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${BANDS[0].blur}"/></filter>
<filter id="blur-mid" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${BANDS[1].blur}"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer></filter>
<linearGradient id="fadeGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#fff" stop-opacity="0.35"/>
<stop offset="0.14" stop-color="#fff" stop-opacity="1"/>
<stop offset="0.66" stop-color="#fff" stop-opacity="1"/>
<stop offset="0.9" stop-color="#fff" stop-opacity="0.3"/>
<stop offset="1" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
<mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#fadeGrad)"/></mask>
<radialGradient id="veil" cx="0.28" cy="0.5" r="0.8">
<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.81"/>
<stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0.63"/>
<stop offset="0.75" stop-color="#FFFFFF" stop-opacity="0.234"/>
<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
<g mask="url(#fade)">${far.markup}${mid.markup}${links.markup}${sharp.markup}</g>
<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.4"/>
<rect width="${W}" height="${H}" fill="url(#veil)"/>
<rect width="${W}" height="${H}" fill="rgba(255,255,255,0.108)"/>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);

const kb = (Buffer.byteLength(svg) / 1024).toFixed(1);
console.log(
  `wrote ${OUT}\n` +
    `  nodes kept   ${live.length} of ${N}\n` +
    `  bands        far ${split[0].length} (${far.count} paths) · ` +
    `mid ${split[1].length} (${mid.count}) · sharp ${split[2].length} (${sharp.count})\n` +
    `  links        ${links.segments} segments\n` +
    `  size         ${kb} KB`,
);
