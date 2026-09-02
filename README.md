# graphzero 2

A static site, no build step. GitHub Pages serves `main` from the repository root.

Two pages:

- `index.html` — the main page: the Knowledge Base 3 fold, then the Knowledge Base B
  content from "Companies that make the right architectural choices…" down.
- `early-access.html` — the Early Access / design-partner page. Five sections and
  one turn: the fold and the three modules beside the knowledge-graph flow sit on
  white and grey; the design-partner block, what a partner gets, and the close sit
  on navy and run unbroken into the footer.

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
