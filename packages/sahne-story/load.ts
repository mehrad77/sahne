// Node-only loaders for what the lints read from the content root (paths.ts): the card index and the places' needs. Used by the
// tests, the gallery's dev server (serve.mjs) and the place checker. Reads only, never writes. Card ids
// are the file names.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { CardIndex, CardInfo } from "./src/cards.ts";
import type { Needs } from "./src/needs.ts";
import { CARDS, CARDS_EXTRA, NEEDS } from "./paths.ts";

/** Every card of `cards/` and `cards-extra/`: id → level, Turkish, English and whether it is retired; null when the content root has no cards. */
export function loadCards(): CardIndex | null {
  if (!existsSync(CARDS)) return null;
  const out: CardIndex = {};
  for (const url of [CARDS, CARDS_EXTRA]) {
    if (!existsSync(url)) continue;
    for (const f of readdirSync(url).filter(f => f.endsWith(".json")).sort()) {
      const c = JSON.parse(readFileSync(new URL(f, url), "utf8"));
      const info: CardInfo = { tr: c.tr ?? "", en: c.en ?? "" };
      if (c.level) info.level = c.level;
      if (c.retired) info.retired = true;
      out[f.slice(0, -5)] = info;
    }
  }
  return out;
}

/** What the briefs ask of each place (`needs.json` of the content root); undefined when it has none, and the needs rules do not run. */
export function loadNeeds(): Needs | undefined {
  return existsSync(NEEDS) ? JSON.parse(readFileSync(NEEDS, "utf8")) : undefined;
}
