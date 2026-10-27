# assets

Pictures for the README and the repository's social preview. They are not part of any package, and nothing reads them.

- `scenes/*.jpg`: frames of the gallery (`pnpm dev`), shot with `packages/sahne-gallery/shots.mjs` (the sample story with `--story s1e00 --mid`, the test places with `--places <id>`), cropped to 16:9 at 960 × 540.
- `poster.jpg` (2400 × 1200) and `social-preview.jpg` (1280 × 640, for Settings → Social preview): a hand-made HTML poster rendered with Playwright from those frames, portraits of the sample characters from the engine's still backend (`portrait(doc, kit, { framing: "bust" })`), and Kerim's art from `sahne-kit/src/kerim/art.ts` with `sahne-kit/kerim.css`.

Kerim's art in these pictures stays all rights reserved ([LICENSE-ART](../LICENSE-ART)).
