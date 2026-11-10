// Renders a release banner (assets/releases/<name>.html → <name>.jpg, 1600 × 800, shown at the head of the release in
// What's new and on its GitHub release). From the repo root: node assets/releases/banner.mjs [banner]
import { chromium } from "../../packages/sahne-gallery/node_modules/@playwright/test/index.mjs";
import { fileURLToPath } from "node:url";

const name = process.argv[2] ?? "banner";
const page = new URL(`${name}.html`, import.meta.url), out = fileURLToPath(new URL("sahne-0.3.jpg", import.meta.url));
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1600, height: 800 }, deviceScaleFactor: 1 });
await tab.goto(page.href);
await tab.evaluate(() => document.fonts.ready);
await tab.screenshot({ path: out, type: "jpeg", quality: 88 });
await browser.close();
console.log(`wrote ${out}`);
