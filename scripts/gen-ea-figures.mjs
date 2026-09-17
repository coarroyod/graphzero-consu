/* ==========================================================================
   gen-ea-figures — the Early Access page's three drawings
   ==========================================================================

   Fig. 01  the toolbox: nine sources, curves into the base, a link out to
            search and agents. 560x400.
   Fig. 05  today: 23 scattered dots. 636x240.
   Fig. 06  with graphzero: the same 23 dots, now linked to a hub.

   Fig. 05 and 06 share one dot set on purpose — that is the whole argument of
   the pair, and generating them from the same seeded list is the only way to
   guarantee it stays true after an edit.

   Every viewBox matches the box it renders into, so nothing is ever stretched:
   preserveAspectRatio="none" turns a round dot into a soft ellipse and the
   plate stops looking drawn and starts looking like a low-quality image.

   Run:  node scripts/gen-ea-figures.mjs      (or: npm run gen:ea)
   ========================================================================== */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = resolve(HERE, "..", "early-access.html");

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (v) => Number(v.toFixed(2));

/* ==========================================================================
   Fig. 01 — the toolbox, 560 x 400
   ========================================================================== */

const SOURCES = [
  "SharePoint",
  "Outlook",
  "Google Drive",
  "Gmail",
  "HubSpot",
  "DATEV",
  "AFAS",
  "Exact",
  "Personio",
];

const HUB = { x: 352, y: 196 };
const PILL = { w: 150, h: 26, r: 7, x: 0 };

function toolbox() {
  const pills = SOURCES.map((name, i) => {
    const y = 40 + i * 40;
    return { name, y, cy: y + PILL.h / 2 };
  });

  const curves = pills.map((p, i) => {
    const x0 = PILL.x + PILL.w,
      y0 = p.cy;
    const c1 = x0 + 74,
      c2 = HUB.x - 84;
    return {
      d: `M${x0},${f(y0)} C${c1},${f(y0)} ${c2},${HUB.y} ${HUB.x},${HUB.y}`,
      i,
    };
  });

  const pillMarkup = pills
    .map(
      (p) =>
        `<g class="eaf-pill"><rect x="${PILL.x}" y="${p.y}" width="${PILL.w}" height="${PILL.h}" rx="${PILL.r}"></rect>` +
        `<text x="12" y="${p.y + 17.5}">${p.name}</text></g>`,
    )
    .join("");

  const curveMarkup = curves
    .map((c) => `<path class="eaf-curve" d="${c.d}"></path>`)
    .join("");
  const cometMarkup = curves
    .map(
      (c) =>
        `<path class="eaf-comet" d="${c.d}" style="animation-delay:${f(-0.58 * c.i)}s"></path>`,
    )
    .join("");

  /* The link out is horizontal, so its gradient has to be userSpaceOnUse — an
     objectBoundingBox gradient has zero height to resolve against here and the
     line disappears entirely. */
  const link =
    `<path class="eaf-link" d="M364,196 L416,196"></path>` +
    `<path class="eaf-link-comet" d="M364,196 L416,196"></path>`;

  const tiles = [
    { src: "assets/media/logo-claude.svg", x: 428, y: 124 },
    { src: "assets/media/logo-copilot.svg", x: 492, y: 124 },
    { src: "assets/media/logo-chatgpt.svg", x: 428, y: 188 },
    { src: "assets/brand/icon-prism.svg", x: 492, y: 188 },
  ]
    .map(
      (t) =>
        `<g class="eaf-tile"><rect x="${t.x}" y="${t.y}" width="52" height="52" rx="12"></rect>` +
        `<image href="${t.src}" x="${t.x + 14}" y="${t.y + 14}" width="24" height="24"></image></g>`,
    )
    .join("");

  return `<svg class="eaf-fig" viewBox="0 0 560 400" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Nine business systems feeding a knowledge base in the EU or your own cloud, which answers through Claude, Copilot, ChatGPT or graphzero's own search and agents.">
<defs>
<linearGradient id="eaCurve" gradientUnits="userSpaceOnUse" x1="150" y1="196" x2="352" y2="196"><stop offset="0" stop-color="rgba(23,19,16,0.14)"></stop><stop offset="1" stop-color="rgba(236,91,35,0.85)"></stop></linearGradient>
<linearGradient id="eaLink" gradientUnits="userSpaceOnUse" x1="364" y1="196" x2="416" y2="196"><stop offset="0" stop-color="rgba(236,91,35,0.4)"></stop><stop offset="1" stop-color="rgba(236,91,35,0.95)"></stop></linearGradient>
<filter id="eaGlow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="20"></feGaussianBlur></filter>
</defs>
<text class="eaf-cap" x="0" y="22">YOUR SYSTEMS</text>
<g class="eaf-pills">${pillMarkup}</g>
<g class="eaf-curves">${curveMarkup}</g>
<g class="eaf-comets">${cometMarkup}</g>
${link}
<ellipse class="eaf-glow" cx="300" cy="196" rx="86" ry="82" fill="#EC5B23" filter="url(#eaGlow)"></ellipse>
<g class="eaf-base"><rect x="236" y="130" width="128" height="132" rx="16"></rect>
<image href="assets/brand/graphzero-compact.png?v=2" x="272" y="146" width="56" height="56"></image>
<text class="eaf-base-t" x="300" y="222" text-anchor="middle">Knowledge Base</text>
<text class="eaf-cap" x="300" y="242" text-anchor="middle">EU OR OWN CLOUD</text></g>
<g class="eaf-agents"><rect x="416" y="104" width="144" height="184" rx="16"></rect>${tiles}
<text class="eaf-cap" x="488" y="268" text-anchor="middle">WEB &#183; SLACK &#183; TEAMS</text></g>
</svg>`;
}

/* ==========================================================================
   Fig. 05 and 06 — one dot set, two states, 636 x 240
   ========================================================================== */

const PW = 636,
  PH = 240,
  DOTS = 23;
const PHUB = { x: 318, y: 120 };

function plates() {
  const rnd = mulberry32(4051);
  const dots = [];
  let tries = 0;
  while (dots.length < DOTS && tries < 20000) {
    tries++;
    const x = 44 + rnd() * (PW - 88);
    const y = 34 + rnd() * (PH - 68);
    /* Keep them off the hub, so Fig. 06 has somewhere to put it. */
    if (Math.hypot(x - PHUB.x, y - PHUB.y) < 46) continue;
    if (dots.some((d) => Math.hypot(d.x - x, d.y - y) < 40)) continue;
    dots.push({ x, y, r: 3 + rnd() * 2.2 });
  }

  const today = dots
    .map(
      (d) =>
        `<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(d.r)}" fill="#171310" fill-opacity="0.5"></circle>`,
    )
    .join("");

  const linked = dots.filter((_, i) => i % 2 === 0);
  const lines = linked
    .map(
      (d, k) =>
        `<line x1="${f(d.x)}" y1="${f(d.y)}" x2="${PHUB.x}" y2="${PHUB.y}" stroke="rgba(236,91,35,0.42)" stroke-width="1"></line>` +
        (k % 4 === 0
          ? `<line class="eaf-plate-comet" x1="${f(d.x)}" y1="${f(d.y)}" x2="${PHUB.x}" y2="${PHUB.y}" style="animation-delay:${f(-0.7 * (k / 4))}s"></line>`
          : ""),
    )
    .join("");

  const withGz = dots
    .map(
      (d, i) =>
        `<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(d.r)}" fill="#171310" fill-opacity="${i % 2 === 0 ? 0.95 : 0.4}"></circle>`,
    )
    .join("");

  const hub =
    `<ellipse class="eaf-plate-glow" cx="${PHUB.x}" cy="${PHUB.y}" rx="34" ry="34" fill="#EC5B23" filter="url(#eaPlateGlow)"></ellipse>` +
    `<circle cx="${PHUB.x}" cy="${PHUB.y}" r="13" fill="none" stroke="#FFFFFF" stroke-width="2"></circle>` +
    `<circle cx="${PHUB.x}" cy="${PHUB.y}" r="8" fill="#EC5B23"></circle>`;

  const open = (id) =>
    `<svg class="eaf-plate-svg" viewBox="0 0 ${PW} ${PH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
    (id === "b"
      ? '<defs><filter id="eaPlateGlow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="14"></feGaussianBlur></filter></defs>'
      : "");

  return {
    today: open("a") + today + "</svg>",
    withGz: open("b") + lines + withGz + hub + "</svg>",
  };
}

/* ---------- write them in ---------- */

const marks = {
  "gz:ea-toolbox": toolbox(),
  "gz:ea-plate-today": plates().today,
  "gz:ea-plate-gz": plates().withGz,
};

let page = readFileSync(PAGE, "utf8");
for (const [name, svg] of Object.entries(marks)) {
  const S = `<!-- ${name}:start -->`,
    E = `<!-- ${name}:end -->`;
  const i = page.indexOf(S),
    j = page.indexOf(E);
  if (i === -1 || j === -1) throw new Error(`markers not found: ${name}`);
  page = page.slice(0, i + S.length) + "\n" + svg + "\n" + page.slice(j);
}
writeFileSync(PAGE, page);

const p = plates();
console.log(
  "wrote the Early Access figures\n" +
    `  fig 01   ${SOURCES.length} sources, ${SOURCES.length} curves + comets, base and agents cards\n` +
    `  fig 05   ${(p.today.match(/<circle/g) || []).length} dots\n` +
    `  fig 06   same dots, ${(p.withGz.match(/<line /g) || []).length} lines, hub at ${PHUB.x},${PHUB.y}\n` +
    `  sizes    ${(Buffer.byteLength(marks["gz:ea-toolbox"]) / 1024).toFixed(1)} / ` +
    `${(Buffer.byteLength(p.today) / 1024).toFixed(1)} / ${(Buffer.byteLength(p.withGz) / 1024).toFixed(1)} KB`,
);
