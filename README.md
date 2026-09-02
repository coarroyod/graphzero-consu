# graphzero 2

A static site, no build step. GitHub Pages serves `main` from the repository root.

Two pages:

- `index.html` — the main page: the Knowledge Base 3 fold, then the Knowledge Base B
  content from "Companies that make the right architectural choices…" down.
- `early-access.html` — the Early Access page. Eight sections on three grounds:
  a type-only fold, the tension, the Without/With comparison, the three modules
  beside the knowledge-graph flow, the capability rows, and three navy sections
  carrying sovereignty, the ask and the close. The comparison and the capability
  rows are the Product page blocks reused; the capability prose is dropped there
  and only the chips are kept.

`?v=N` on `assets/site.css` and `assets/site.js` is cache-busting. Pages serves
everything with `max-age=600`, so a browser can otherwise pick up new markup while
still running ten-minute-old CSS. Bump it on every page in the same commit as an
edit to either file.

The palette is declared once, at the end of `assets/site.css`, as a semantic-layer
override: navy `#17232B`, slate `#59666B`, burnt orange `#D95C32`, light grey
`#DDE4E5`. Components read the semantic tokens and never a raw value, so both
flow diagrams follow it without being touched. Orange is a fill, not an ink —
it fails AA as text, so anything that has to read as type uses `--accent-strong`
`#C24E27`.
