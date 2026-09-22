#!/usr/bin/env python3
"""
gen-og-cards — the social share card for each page

Every page needs an og:image or its link renders as a blank grey card
wherever it is posted. These are built rather than photographed: the same
oxide band, the same mark, the same two typefaces as the site.

The cards are drawn as SVG and rasterised with qlmanage, which is WebKit, so
it honours the embedded @font-face. The fonts are fetched from Google once
per run and inlined as base64 — nothing about that reaches the published
page, which only ever serves the finished PNG.

macOS only: qlmanage and sips. Run it when a page's headline changes.

    python3 scripts/gen-og-cards.py
"""

import base64, io, os, re, subprocess, sys, tempfile, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets", "og")

FONTS = ("https://fonts.googleapis.com/css2"
         "?family=Archivo:wght@500;600&family=JetBrains+Mono:wght@400")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")

# The headline is split by hand rather than wrapped by measurement: there are
# four of them and a line break is a typographic decision, not arithmetic.
CARDS = [
    ("home",         ["The toolbox to deploy", "enterprise AI."]),
    ("early-access", ["Turn what your people know", "into what your company knows."]),
    ("security",     ["Secure by design,", "sovereign by default."]),
    ("about",        ["Made in Europe.", "For Europe."]),
]

TAGLINE = "European infrastructure for sovereign enterprise AI"


def faces():
    req = urllib.request.Request(FONTS, headers={"User-Agent": UA})
    css = urllib.request.urlopen(req).read().decode()
    out = []
    for subset, body in re.findall(r"/\*\s*(\S+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S):
        if subset != "latin":
            continue
        fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        wt = re.search(r"font-weight:\s*(\d+)", body).group(1)
        url = re.search(r"url\((https[^)]+)\)", body).group(1)
        b = base64.b64encode(urllib.request.urlopen(url).read()).decode()
        out.append("@font-face{font-family:'%s';font-weight:%s;font-style:normal;"
                   "src:url(data:font/woff2;base64,%s) format('woff2');}" % (fam, wt, b))
    return "\n".join(out)


def mark():
    p = os.path.join(ROOT, "assets", "brand", "graphzero-compact.png")
    return base64.b64encode(open(p, "rb").read()).decode()


def card(lines, css, logo):
    """1200x630 of content, centred on a 1200x1200 canvas.

    qlmanage always renders to a square, so the card is drawn into the middle
    of one and sips centre-crops back to 1200x630. Laying it out at the offset
    is the only way to land the crop exactly on the artwork."""
    T = 285  # (1200 - 630) / 2
    y = lambda v: v + T
    esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;")

    title = "".join(
        '<text x="80" y="%d" font-family="Archivo" font-weight="500" font-size="66" '
        'letter-spacing="-2.4" fill="#FFFFFF">%s</text>' % (y(300 + i * 78), esc(t))
        for i, t in enumerate(lines))

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
<style>{css}</style>
<defs>
<linearGradient id="band" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#3A1B0F"/><stop offset="0.55" stop-color="#241610"/><stop offset="1" stop-color="#1B120D"/></linearGradient>
<linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#EC5B23" stop-opacity="0.9"/><stop offset="0.46" stop-color="#EC5B23" stop-opacity="0.2"/><stop offset="0.82" stop-color="#FFFFFF" stop-opacity="0.06"/></linearGradient>
<radialGradient id="bloom"><stop offset="0" stop-color="#EC5B23" stop-opacity="0.34"/><stop offset="0.7" stop-color="#EC5B23" stop-opacity="0"/></radialGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="56"/></filter>
</defs>
<rect width="1200" height="1200" fill="#1B120D"/>
<rect x="0" y="{T}" width="1200" height="630" fill="url(#band)"/>
<ellipse cx="1060" cy="{y(70)}" rx="340" ry="280" fill="url(#bloom)" filter="url(#soft)"/>
<rect x="0" y="{T}" width="1200" height="1" fill="url(#edge)"/>

<image href="data:image/png;base64,{logo}" x="80" y="{y(64)}" width="34" height="41"/>
<text x="126" y="{y(93)}" font-family="Archivo" font-weight="500" font-size="27" letter-spacing="-0.7" fill="#FFFFFF">graphzero</text>

{title}

<rect x="80" y="{y(492)}" width="1040" height="1" fill="#FBF9F5" fill-opacity="0.16"/>
<text x="80" y="{y(540)}" font-family="JetBrains Mono" font-size="19" letter-spacing="1.1" fill="#C9C0B6">{TAGLINE}</text>
<g>
  <line x1="1067" y1="{y(533)}" x2="1089" y2="{y(533)}" stroke="#EC5B23" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="1067" cy="{y(533)}" r="5.4" fill="#F7F4EF"/>
  <circle cx="1089" cy="{y(533)}" r="5.4" fill="#EC5B23"/>
</g>
</svg>'''


def main():
    if sys.platform != "darwin":
        sys.exit("macOS only: this uses qlmanage and sips.")
    os.makedirs(OUT, exist_ok=True)
    css, logo = faces(), mark()
    tmp = tempfile.mkdtemp()
    for name, lines in CARDS:
        svg = os.path.join(tmp, name + ".svg")
        io.open(svg, "w", encoding="utf-8").write(card(lines, css, logo))
        subprocess.run(["qlmanage", "-t", "-s", "1200", "-o", tmp, svg],
                       capture_output=True)
        png = svg + ".png"
        sq = os.path.join(tmp, name + "-crop.png")
        subprocess.run(["sips", "-c", "630", "1200", png, "--out", sq],
                       capture_output=True)
        # JPEG at 92, not PNG. The card is a smooth gradient behind a little
        # text, which is what JPEG is good at: 70KB against 659 for a file
        # that is indistinguishable side by side. A share image that takes a
        # moment to arrive is a share image some scrapers skip.
        dest = os.path.join(OUT, "og-%s.jpg" % name)
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "92",
                        sq, "--out", dest], capture_output=True)
        kb = os.path.getsize(dest) / 1024
        print("  og-%-18s %-46s %3.0f KB" % (name + ".jpg", " / ".join(lines)[:44], kb))
    print("wrote %d cards into assets/og/" % len(CARDS))


if __name__ == "__main__":
    main()
