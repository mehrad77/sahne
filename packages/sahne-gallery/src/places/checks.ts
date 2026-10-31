// #/places/<id>/sheet and #/places/<id>/camera: a place's contact sheet (every time it lists, at 1100 and
// 390 px) and its camera check (place-check.ts), each a view of its own: they mount many stages.
// shots.mjs --places photographs the sheet's cells and reads the check from window.cameraCheck.

import { propText } from "sahne";
import { $, link } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { FIGURE } from "../kit/solo.ts";
import { cameraCheck, cameraTable, contactSheet, type CameraResult } from "../place-check.ts";
import { BENCH_DOCS } from "./common.ts";

declare global { interface Window { cameraCheck?: { place: string; results: CameraResult[]; ok: boolean } } }

export async function render(host: HTMLElement, ctx: Ctx, id: string, which: "sheet" | "camera") {
  const doc = (await ctx.data("places")).find(d => d.id === id) ?? BENCH_DOCS.find(d => d.id === id);
  host.append(link(`← ${id}`, `#/places/${id}`));
  delete window.cameraCheck;
  if (!doc) { host.append($("p", "note bad", `No place document ${id}.`)); window.cameraCheck = { place: id, results: [], ok: false }; return; }
  // each width × each time (or each width) is a stage of its own; browsers keep about 16
  ctx.maxStages = 14;
  const mount = (el: HTMLElement, o: Parameters<Ctx["mount"]>[1]) => { const st = ctx.mount(el, o); propText(st); return st; };
  if (which === "sheet") {
    host.append($("h1", "", `Contact sheet · ${id}`), $("p", "note", "Every time the place lists, at a desktop's width and a phone's. Checked against STYLE.md for the owner's approval."));
    contactSheet(host, doc, ctx.kit, mount);
    return;
  }
  host.append($("h1", "", `Camera check · ${id}`), $("p", "note", "A stand-in on every mark people stand on, framed wide, two and close; Kerim on the perch and every air mark, framed wide; each inside the frame at 1100 and 390 px."));
  const summary = $("div"), stages = $("div", "camstages");
  host.append(summary, stages);
  const results = cameraCheck(stages, doc, ctx.kit, FIGURE, mount);
  const bad = results.filter(r => !r.ok);
  summary.append($("p", bad.length ? "note bad" : "note ok", bad.length ? `${bad.length} out of frame: ${bad.map(r => `${r.mark} ${r.shot} ${r.width}`).join(", ")}` : `All ${results.length} framings inside the frame.`), cameraTable(results));
  window.cameraCheck = { place: id, results, ok: !bad.length };
}
