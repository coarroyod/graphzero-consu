/* ==========================================================================
   gen-europe-figure — the About fold's map, generated rather than drawn
   ==========================================================================

   Nobody hand-draws a coastline here. FINE is Natural Earth's country
   outlines sampled onto a 46x36 grid; the coarse grid the page actually shows
   is derived from it in code, never retyped: a coarse cell is land when at
   least two of the four fine cells under it are.

   Written into about.html between two markers, so the figure is inline SVG
   (the breathing is CSS, and CSS wants to be the page's) and re-running is
   safe.

   Run:  node scripts/gen-europe-figure.mjs      (or: npm run gen:europe)

   Deterministic: one seeded generator, drawn in a fixed order.

   Two things this figure deliberately does not have:

     No links between cells. On the Product hero, node-and-link means
     "knowledge graph" and earns its keep. On a map it signifies nothing — it
     is texture borrowing authority it has not earned.

     No sparks. Tiles flashing to full orange pull the eye around the frame
     and read as busy. The only saturated marks in the whole figure are the
     two cities, which is what makes them read as the point of it.
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = resolve(HERE, "..", "about.html");

const START = "<!-- gz:europe:start -->";
const END = "<!-- gz:europe:end -->";

/* ---------- the sampled outline, 46 x 36 ---------- */

const FINE = `
....................................#####.....
................................##########....
.............................###########......
...........................##############.....
.........................################.....
........................###########.######....
......................###########...######....
.....................###########..########....
..................############...##########...
................#############....#########....
.................############....#######......
.................#############................
.................###...#####.......####.......
.....##.#..............#####........###.......
.....####...........##..####.....#######......
......###...........#.####.......##########...
...##...##..........##......##....#########...
..###...###.......##########################..
..##...######...############################..
.......######..###############################
......##.....#################################
.........#####################################
.......#######################################
.........#####################################
..........################################..##
..........##############.#################....
..........##########.###...##############.....
..#############..#....###...############......
..############......#..###.....##.######......
..###########............###...#..####........
..#########.........#......#...###.#..........
..#########.........#.......#...###...........
..#########.............#.##.....###..........
..#######.................#......##...........
.....#........................................
.....................................#......##
`
  .trim()
  .split("\n");

/* ---------- the coarse grid, derived ---------- */

const COLS = 23;
const ROWS = 18;
const CELL = 24;
const W = COLS * CELL;
const H = ROWS * CELL;

const fineAt = (c, r) => (FINE[r] && FINE[r][c] === "#" ? 1 : 0);

const land = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const n =
      fineAt(2 * c, 2 * r) +
      fineAt(2 * c + 1, 2 * r) +
      fineAt(2 * c, 2 * r + 1) +
      fineAt(2 * c + 1, 2 * r + 1);
    if (n >= 2) land.push({ c, r });
  }
}

/* The two cities sit at their true projected longitudes and share a latitude,
   so they share a row. Their cells are markers, not tiles. */
const CITIES = [
  { name: "Amsterdam", c: 8, r: 9 },
  { name: "Berlin", c: 12, r: 9 },
];
const isCity = (c, r) => CITIES.some((x) => x.c === c && x.r === r);

const tiles = land.filter((p) => !isCity(p.c, p.r));

/* ---------- seeded, so the figure is the same every load ---------- */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(1977);

for (const t of tiles) {
  t.w = rnd();
  t.group = Math.floor(rnd() * 4) % 4;
}

/* The palette is inverted from the Product hero on purpose: almost everything
   is the palest orange and the peak opacity is 0.34, so the two cities are
   the only saturated marks on the page. */
const cutoff = [...tiles].sort((a, b) => b.w - a.w)[
  Math.floor(tiles.length * 0.1)
].w;
/* One accent. The figure used to carry three oranges of its own —
   #FF8A33, #FFB27A, and #FF6A00 for the cities — none of them the oxide
   the rest of the site runs on. Everything is oxide now, and the depth
   comes from the per-tile opacity below, which already varies. */
for (const t of tiles) t.fill = "#EC5B23";

const SIDE = 13;
const RX = SIDE / 5;
const CITY_SIDE = SIDE * 1.4;
const CITY_RX = CITY_SIDE / 5;

const f = (v) => Number(v.toFixed(2));
const cx = (c) => c * CELL + CELL / 2;
const cy = (r) => r * CELL + CELL / 2;

function tileRect(t) {
  const o = Math.min(0.34, (0.16 + 0.26 * t.w) * 1.3);
  return `<rect x="${f(cx(t.c) - SIDE / 2)}" y="${f(cy(t.r) - SIDE / 2)}" width="${SIDE}" height="${SIDE}" rx="${f(RX)}" fill="${t.fill}" fill-opacity="${f(o)}"></rect>`;
}

const groups = [0, 1, 2, 3].map(
  (gi) =>
    `<g class="gzeu-t${gi + 1}">` +
    tiles
      .filter((t) => t.group === gi)
      .map(tileRect)
      .join("") +
    `</g>`,
);

const markers = CITIES.map(
  (p) =>
    `<rect x="${f(cx(p.c) - CITY_SIDE / 2)}" y="${f(cy(p.r) - CITY_SIDE / 2)}" width="${f(CITY_SIDE)}" height="${f(CITY_SIDE)}" rx="${f(CITY_RX)}" fill="#EC5B23"></rect>`,
).join("");

const svg = `<svg class="gzeu" viewBox="0 0 ${W} ${H}" width="100%" aria-hidden="true" focusable="false">${groups.join("")}<g class="gzeu-cities">${markers}</g></svg>`;

/* ---------- write it in ---------- */

const page = readFileSync(PAGE, "utf8");
const i = page.indexOf(START);
const j = page.indexOf(END);
if (i === -1 || j === -1) throw new Error(`markers not found in about.html`);

writeFileSync(
  PAGE,
  page.slice(0, i + START.length) +
    "\n          " +
    svg +
    "\n          " +
    page.slice(j),
);

console.log(
  `wrote the Europe figure into about.html\n` +
    `  land cells   ${land.length}\n` +
    `  tiles        ${tiles.length}  (land minus the two city cells)\n` +
    `  groups       ${groups.map((g) => (g.match(/<rect/g) || []).length).join(" / ")}\n` +
    `  cities       ${CITIES.length}, both on row ${CITIES[0].r}\n` +
    `  peak opacity ${Math.max(...tiles.map((t) => Math.min(0.34, (0.16 + 0.26 * t.w) * 1.3))).toFixed(3)}\n` +
    `  size         ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`,
);
