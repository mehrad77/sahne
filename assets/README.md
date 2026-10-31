# assets

Pictures for the READMEs and the repository's social preview. They are not part of any package. The docs pages of the gallery show them, and its static site copies them.

- `brand/`: the Sahne logo of every package, written by `node packages/sahne-gallery/brand/build.mjs` (`--check` in `pnpm check`), never by hand. For each package `<id>`: `<id>.svg`, the mark (a lowercase n as a stage arch, its window filled with the package's ebru, a marbling seeded by the id: `packages/sahne-gallery/brand/ebru.mjs`); `<id>-header.svg` and `<id>-header-dark.svg`, the lockup ("sahne" and the package's name on a tab in its colour) that tops its README; for a package with a web app, `<id>-header-stacked.svg` and `-stacked-dark.svg`, the lockup with its tab under the word, for a narrow top bar; `<id>-favicon.svg`, the flat mark. Each package's colour is in `PACKAGES` in the generator; a new package gets one from its name. The words are outlined from Fraunces and Inter (@fontsource, SIL Open Font License), so they need no font.

- `scenes/*.jpg`: frames of the gallery (`pnpm dev`), shot with `packages/sahne-gallery/shots.mjs` (the sample story with `--story s1e00 --mid`, the test places with `--places <id>`), cropped to 16:9 at 960 × 540.
- `poster.jpg` (2400 × 1200) and `social-preview.jpg` (1280 × 640, for Settings → Social preview): a hand-made HTML poster rendered with Playwright from those frames, portraits of the sample characters from the engine's still backend (`portrait(doc, kit, { framing: "bust" })`), and Kerim's art from `sahne-kit/src/kerim/art.ts` with `sahne-kit/kerim.css`. The page itself was not kept: its title has since been replaced with the lockup (`brand/sahne-header-dark.svg`, rasterised and pasted over the old title on the poster's own background), so a new version of either picture means a new page.

Kerim's art in these pictures stays all rights reserved ([LICENSE-ART](../LICENSE-ART)).
