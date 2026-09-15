/* ==========================================================================
   gen-hero-graph — the Product hero's ground: the mark, drawn as a graph
   ==========================================================================

   The mark is not placed here; it is discovered. Points are thrown at the
   canvas, kept only where they land on the mark's own geometry — disc plus
   stem, minus the aperture — and then joined to their nearest neighbours. The
   silhouette is whatever the points and the links make of it, which is the
   point: a knowledge graph that happens to be the shape of the company.

   Written straight into index.html between two markers, so it is inline SVG
   (the animation is CSS, and CSS wants to be the page's) and so re-running the
   script is safe and idempotent.

   Run:  node scripts/gen-hero-graph.mjs     (or: npm run gen:graph)

   Deterministic: one seeded generator, drawn in a fixed order. Two runs give
   the same bytes.
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = resolve(HERE, "..", "index.html");

const START = "<!-- gz:hero-graph:start -->";
const END = "<!-- gz:hero-graph:end -->";

/* ---------- the canvas ---------- */

const W = 1280;
const H = 742;
const SEED = 7731;

/* Where the mark sits on it, and how big. The mark is authored in a 96x96
   box; these three numbers are the whole of the mapping. */
const CX = W * 0.78;
const CY = H * 0.44;
const SCALE = H * 0.0068;

/* ---------- the mark, in its own 96x96 space ---------- */

const DISC = { x: 48, y: 40, r: 32 };
const STEM = { x0: 38, x1: 58, y0: 40, y1: 86 };
const APERTURE = { x0: 38, x1: 58, y0: 52, y1: 74 };

function toMark(x, y) {
  return { mx: (x - CX) / SCALE + 48, my: (y - CY) / SCALE + 44 };
}

function onMark(x, y) {
  const { mx, my } = toMark(x, y);
  const dx = mx - DISC.x,
    dy = my - DISC.y;
  const inDisc = dx * dx + dy * dy <= DISC.r * DISC.r;
  const inStem =
    mx >= STEM.x0 && mx <= STEM.x1 && my >= STEM.y0 && my <= STEM.y1;
  const inAperture =
    mx >= APERTURE.x0 &&
    mx <= APERTURE.x1 &&
    my >= APERTURE.y0 &&
    my <= APERTURE.y1;
  return (inDisc || inStem) && !inAperture;
}

/* How far a point sits from the disc's rim, in mark units. Nodes are graded by
   it so the silhouette does not read as a cut edge. */
function distFromDiscEdge(x, y) {
  const { mx, my } = toMark(x, y);
  const dx = mx - DISC.x,
    dy = my - DISC.y;
  return Math.abs(Math.sqrt(dx * dx + dy * dy) - DISC.r);
}

/* ---------- generator ---------- */

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

/* ---------- nodes on the mark ----------

   Rejection sampling with a minimum spacing. The spacing is the load-bearing
   part: without it the sampler piles points on top of each other and the dense
   places stop reading as points at all — they read as a blot. */
const WANT = 230;
const MIN_GAP = 17;
const MAX_TRIES = 400000;

/* The mark's bounding box in canvas coordinates, so darts are thrown where
   they can actually land. */
const bx0 = (16 - 48) * SCALE + CX,
  bx1 = (80 - 48) * SCALE + CX;
const by0 = (8 - 44) * SCALE + CY,
  by1 = (86 - 44) * SCALE + CY;

const nodes = [];
let tries = 0;
while (nodes.length < WANT && tries < MAX_TRIES) {
  tries++;
  const x = bx0 + rnd() * (bx1 - bx0);
  const y = by0 + rnd() * (by1 - by0);
  if (!onMark(x, y)) continue;

  let clear = true;
  for (const n of nodes) {
    const dx = n.x - x,
      dy = n.y - y;
    if (dx * dx + dy * dy < MIN_GAP * MIN_GAP) {
      clear = false;
      break;
    }
  }
  if (clear) nodes.push({ x, y, ring: false });
}
const onMarkCount = nodes.length;

/* ---------- the loose ring ----------

   Forty points orbiting the mark. They are what stops the graph ending at a
   hard silhouette: the structure thins outward instead of being cut out. Any
   that fall into the left half are dropped — that is where the headline is. */
for (let i = 0; i < 40; i++) {
  const a = rnd() * Math.PI * 2;
  const r = 210 + rnd() * 210;
  const x = CX + Math.cos(a) * r * 1.15;
  const y = CY + Math.sin(a) * r * 0.86;
  if (x < 563 || x < 0 || x > W || y < 0 || y > H) continue;
  nodes.push({ x, y, ring: true });
}

/* ---------- per-node properties ---------- */

const PALETTE = [
  { c: "#FF6A00", p: 0.26 },
  { c: "#FF8A33", p: 0.42 },
  { c: "#FFB27A", p: 0.32 },
];

for (const n of nodes) {
  n.w = rnd();

  const roll = rnd();
  let acc = 0;
  n.fill = PALETTE[PALETTE.length - 1].c;
  for (const band of PALETTE) {
    acc += band.p;
    if (roll < acc) {
      n.fill = band.c;
      break;
    }
  }

  n.group = Math.floor(rnd() * 4) % 4;

  n.side = (1.9 + n.w * 1.6) * 1.85 * 1.25;
  n.rx = n.side / 5;

  const edgeFalloff = Math.min(1, distFromDiscEdge(n.x, n.y) / 14);
  n.opacity = Math.min(
    0.92,
    (0.34 + 0.46 * n.w) * (0.45 + 0.55 * (1 - edgeFalloff * 0.5)) * 1.95,
  );
}

/* ---------- links ----------

   Each node reaches for its three nearest neighbours inside 34px. Pairs are
   de-duplicated, so a link drawn from A to B is not drawn again from B to A. */
const LINK_MAX = 34;
const seen = new Set();
const links = [];

for (let i = 0; i < nodes.length; i++) {
  const a = nodes[i];
  const near = [];
  for (let j = 0; j < nodes.length; j++) {
    if (i === j) continue;
    const b = nodes[j];
    const dx = a.x - b.x,
      dy = a.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= LINK_MAX * LINK_MAX) near.push({ j, d: Math.sqrt(d2) });
  }
  near.sort((p, q) => p.d - q.d);

  for (const { j, d } of near.slice(0, 3)) {
    const key = i < j ? `${i}:${j}` : `${j}:${i}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const w = Math.max(a.w, nodes[j].w);
    const o = Math.min(
      0.78,
      0.42 * (1 - d / LINK_MAX) * (0.45 + 0.55 * Math.min(w + 0.3, 1)) * 1.85,
    );
    if (o < 0.05) continue;
    links.push({ a: i, b: j, o });
  }
}

/* ---------- the sparks ----------

   Thirty-six taken at an even stride through generation order, which spreads
   them over the mark without choosing them by hand. */
const SPARKS = 36;
const stride = Math.max(1, Math.floor(nodes.length / SPARKS));
const sparks = new Map();
for (let k = 0, i = 0; k < SPARKS && i < nodes.length; k++, i += stride) {
  sparks.set(i, +((k * 0.37) % 4.2).toFixed(2));
}

/* ---------- emit ---------- */

const f = (v) => Number(v.toFixed(2));

const linkMarkup = links
  .map((l) => {
    const a = nodes[l.a],
      b = nodes[l.b];
    return `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke-opacity="${f(l.o)}"/>`;
  })
  .join("");

const groups = [0, 1, 2, 3].map((gi) =>
  nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.group === gi)
    .map(({ n, i }) => {
      const spark = sparks.has(i);
      const fill = spark ? "#FF6A00" : n.fill;
      const cls = spark ? ' class="gzh-spark"' : "";
      const style = spark ? ` style="animation-delay:${sparks.get(i)}s"` : "";
      return `<rect x="${f(n.x - n.side / 2)}" y="${f(n.y - n.side / 2)}" width="${f(n.side)}" height="${f(n.side)}" rx="${f(n.rx)}" fill="${fill}" fill-opacity="${f(n.opacity)}"${cls}${style}/>`;
    })
    .join(""),
);

const svg = `<svg class="gzh" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
<defs>
<filter id="hbl" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="62"/></filter>
<radialGradient id="hga" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FF8A33" stop-opacity="0.15"/><stop offset="0.53" stop-color="#FF8A33" stop-opacity="0.053"/><stop offset="1" stop-color="#FF8A33" stop-opacity="0"/></radialGradient>
<radialGradient id="hgb" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFB27A" stop-opacity="0.17"/><stop offset="0.53" stop-color="#FFB27A" stop-opacity="0.063"/><stop offset="1" stop-color="#FFB27A" stop-opacity="0"/></radialGradient>
<linearGradient id="hv" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F3EDE2" stop-opacity="0.56"/><stop offset="0.42" stop-color="#F3EDE2" stop-opacity="0.4"/><stop offset="0.8" stop-color="#F3EDE2" stop-opacity="0"/></linearGradient>
<filter id="hgc"><feTurbulence type="fractalNoise" baseFrequency="0.28" numOctaves="3"/><feColorMatrix type="matrix" values="0 0 0 0 0.32 0 0 0 0 0.26 0 0 0 0 0.19 0 0 0 0.62 -0.27"/></filter>
<filter id="hgf"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2"/><feColorMatrix type="matrix" values="0 0 0 0 0.32 0 0 0 0 0.26 0 0 0 0 0.19 0 0 0 0.7 -0.31"/></filter>
</defs>
<rect width="100%" height="100%" fill="#F3EDE2"/>
<g filter="url(#hbl)"><g class="gzh-drift1"><ellipse cx="922" cy="267" rx="538" ry="405" fill="url(#hga)"/></g><g class="gzh-drift2"><ellipse cx="563" cy="519" rx="461" ry="347" fill="url(#hgb)"/></g></g>
<g class="gzh-links" stroke="#FF8A33" stroke-width="1.35" stroke-linecap="round">${linkMarkup}</g>
<g class="gzh-tile1">${groups[0]}</g>
<g class="gzh-tile2">${groups[1]}</g>
<g class="gzh-tile3">${groups[2]}</g>
<g class="gzh-tile4">${groups[3]}</g>
<rect width="100%" height="100%" fill="url(#hv)"/>
<rect width="100%" height="100%" filter="url(#hgc)" opacity="0.7"/>
<rect width="100%" height="100%" filter="url(#hgf)" opacity="0.46"/>
</svg>`;

/* ---------- write it into the page ---------- */

const page = readFileSync(PAGE, "utf8");
const i = page.indexOf(START);
const j = page.indexOf(END);
if (i === -1 || j === -1) {
  throw new Error(
    `markers not found in index.html — expected ${START} ... ${END}`,
  );
}

writeFileSync(
  PAGE,
  page.slice(0, i + START.length) +
    "\n      " +
    svg +
    "\n      " +
    page.slice(j),
);

console.log(
  `wrote the graph into index.html\n` +
    `  on the mark   ${onMarkCount} nodes (wanted ${WANT}, ${tries} darts thrown, ${MIN_GAP}px minimum gap)\n` +
    `  ring          ${nodes.length - onMarkCount} nodes\n` +
    `  total         ${nodes.length} nodes in 4 groups (${groups.map((g) => (g.match(/<rect/g) || []).length).join(" / ")})\n` +
    `  links         ${links.length}\n` +
    `  sparks        ${sparks.size}\n` +
    `  svg           ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`,
);
