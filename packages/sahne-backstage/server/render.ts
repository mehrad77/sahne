// An SVG as a PNG an agent can look at (the MCP tools' sheets, `call.ts`, `promote.ts`): @resvg/resvg-js, in Node, with the
// stage's own fonts from the repo where it has them and the system's otherwise.

import { Resvg } from "@resvg/resvg-js";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The widest a PNG is drawn: a sheet any wider is scaled down, since an agent reads the picture, not its pixels. */
export const MAX_WIDTH = 1600;

/** The repo's font files resvg can load (.ttf, .otf): `fonts/` beside this file, if it has any. */
function fontFiles(): string[] {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "fonts");
  return existsSync(dir) ? readdirSync(dir).filter(f => /\.(ttf|otf|ttc)$/i.test(f)).map(f => join(dir, f)) : [];
}

export interface RenderOpts { width?: number; background?: string }

/** `svg` as a PNG at most `MAX_WIDTH` wide (`width` asks for less), on `background` when given. */
export function renderPng(svg: string, opts: RenderOpts = {}): Buffer {
  const files = fontFiles();
  const probe = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: files } });
  const width = Math.min(opts.width ?? MAX_WIDTH, MAX_WIDTH), fit = probe.width > width ? { fitTo: { mode: "width" as const, value: width } } : {};
  const r = new Resvg(svg, { ...fit, background: opts.background, font: { fontFiles: files, loadSystemFonts: true, defaultFontFamily: "Helvetica Neue" } });
  return r.render().asPng();
}
