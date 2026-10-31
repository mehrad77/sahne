// #/places: the board; #/places/<id>: a place scouted; #/places/<id>/sheet and /camera: its checks.

import type { Ctx } from "../shell/ctx.ts";

export async function render(host: HTMLElement, ctx: Ctx) {
  const [id, check] = ctx.route.path;
  if (!id) return (await import("../places/board.ts")).render(host, ctx);
  if (check === "sheet" || check === "camera") return (await import("../places/checks.ts")).render(host, ctx, id, check);
  return (await import("../places/scout.ts")).render(host, ctx, id);
}
