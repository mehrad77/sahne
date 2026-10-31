import {
  BENCH_DOCS
} from "./chunk-WB6XEHS3.js";
import "./chunk-D3OMKUXF.js";
import "./chunk-6JPAPIMW.js";
import {
  FIGURE
} from "./chunk-YGBM7NGP.js";
import "./chunk-CMLP3XCI.js";
import "./chunk-6PR3AWGB.js";
import "./chunk-GO2IY55S.js";
import "./chunk-3BCF3C4G.js";
import "./chunk-ZT53KTYM.js";
import "./chunk-DDNHNEH6.js";
import "./chunk-6IX3XYSS.js";
import "./chunk-J3KVAIQI.js";
import {
  $,
  link
} from "./chunk-4TGKXDN4.js";
import {
  mountStage,
  propText
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/place-check.ts
var plain = (el2, o) => mountStage(el2, o);
var WIDTHS = [1100, 390];
var SHOTS = ["wide", "two", "close"];
var el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
function box(parent, w) {
  const b = el("div", "stagebox");
  b.style.width = `${w}px`;
  b.style.maxWidth = "none";
  parent.append(b);
  return b;
}
function contactSheet(host, doc, kit, mount = plain) {
  for (const w of WIDTHS) {
    const row = el("div", "sheetrow");
    row.append(el("h3", "", `${w} px`));
    for (const time of doc.times?.length ? doc.times : ["day"]) {
      const fig = el("figure", "sheetcell");
      fig.dataset.time = time;
      fig.dataset.w = String(w);
      const stage = mount(box(fig, w), { kit, bubbles: false });
      stage.load({ v: 1, cues: [{ scene: { place: doc.id, time, at: {}, cam: "wide" } }] }, { cast: {}, places: { [doc.id]: doc } });
      fig.append(el("figcaption", "", time));
      row.append(fig);
    }
    host.append(row);
  }
}
function cameraCheck(host, doc, kit, standIn, mount = plain) {
  const out = [];
  const marks = Object.entries(doc.marks);
  const ground = marks.filter(([, m]) => !m.air && !((m.y ?? 0) > 0)).map(([id]) => id);
  const high = [.../* @__PURE__ */ new Set([...doc.perch ? [doc.perch] : [], ...marks.filter(([, m]) => m.air).map(([id]) => id)])];
  const time = doc.times?.[0] ?? "day";
  for (const w of WIDTHS) {
    const stage = mount(box(host, w), { kit, bubbles: false });
    stage.pickable = true;
    stage.resize();
    const [cw, ch] = stage.cssSize;
    const inside = (b) => !!b && b[2] - b[0] > 4 && b[3] - b[1] > 4 && b[0] >= -1 && b[1] >= -1 && b[2] <= cw + 1 && b[3] <= ch + 1;
    for (const mark of ground) {
      const cues = [{ scene: { place: doc.id, time, at: { a: mark }, cam: "wide" } }, { beat: { who: "a", cam: "two" } }, { beat: { who: "a", cam: "close" } }];
      stage.load({ v: 1, cues }, { cast: { a: standIn }, places: { [doc.id]: doc } });
      SHOTS.forEach((shot, i) => {
        stage.show(i);
        stage.render();
        const b = stage.bounds(shot === "wide" ? "ch:a" : "ch:a.head");
        out.push({ mark, who: "stand-in", shot, width: w, box: b && b.map(Math.round), ok: inside(b) });
      });
    }
    for (const mark of high) {
      stage.load({ v: 1, cues: [{ scene: { place: doc.id, time, at: { kerim: mark }, cam: "wide" } }] }, { cast: { kerim: { puppet: "bird" } }, places: { [doc.id]: doc } });
      stage.show(0);
      stage.render();
      const b = stage.bounds("ch:kerim");
      out.push({ mark, who: "kerim", shot: "wide", width: w, box: b && b.map(Math.round), ok: inside(b) });
    }
  }
  return out;
}
function cameraTable(results) {
  const t = el("table", "linttable t"), head = el("tr");
  const cols = WIDTHS.flatMap((w) => SHOTS.map((s) => `${w} ${s}`));
  head.append(el("th", "", "mark"), ...cols.map((c) => el("th", "", c)));
  t.append(head);
  const rows = [...new Set(results.map((r) => `${r.who}|${r.mark}`))];
  for (const key of rows) {
    const [who, mark] = key.split("|"), tr = el("tr");
    tr.append(el("td", "", `${mark}${who === "kerim" ? " (Kerim)" : ""}`));
    for (const w of WIDTHS) for (const s of SHOTS) {
      const r = results.find((x) => x.who === who && x.mark === mark && x.width === w && x.shot === s);
      const td = el("td", !r ? "" : r.ok ? "ok" : "bad", !r ? "\u2013" : r.ok ? "\u2713" : "\u2717");
      if (r?.box) td.title = r.box.join(", ");
      tr.append(td);
    }
    t.append(tr);
  }
  return t;
}

// src/places/checks.ts
async function render(host, ctx, id, which) {
  const doc = (await ctx.data("places")).find((d) => d.id === id) ?? BENCH_DOCS.find((d) => d.id === id);
  host.append(link(`\u2190 ${id}`, `#/places/${id}`));
  delete window.cameraCheck;
  if (!doc) {
    host.append($("p", "note bad", `No place document ${id}.`));
    window.cameraCheck = { place: id, results: [], ok: false };
    return;
  }
  ctx.maxStages = 14;
  const mount = (el2, o) => {
    const st = ctx.mount(el2, o);
    propText(st);
    return st;
  };
  if (which === "sheet") {
    host.append($("h1", "", `Contact sheet \xB7 ${id}`), $("p", "note", "Every time the place lists, at a desktop's width and a phone's. Checked against STYLE.md for the owner's approval."));
    contactSheet(host, doc, ctx.kit, mount);
    return;
  }
  host.append($("h1", "", `Camera check \xB7 ${id}`), $("p", "note", "A stand-in on every mark people stand on, framed wide, two and close; Kerim on the perch and every air mark, framed wide; each inside the frame at 1100 and 390 px."));
  const summary = $("div"), stages = $("div", "camstages");
  host.append(summary, stages);
  const results = cameraCheck(stages, doc, ctx.kit, FIGURE, mount);
  const bad = results.filter((r) => !r.ok);
  summary.append($("p", bad.length ? "note bad" : "note ok", bad.length ? `${bad.length} out of frame: ${bad.map((r) => `${r.mark} ${r.shot} ${r.width}`).join(", ")}` : `All ${results.length} framings inside the frame.`), cameraTable(results));
  window.cameraCheck = { place: id, results, ok: !bad.length };
}
export {
  render
};
//# sourceMappingURL=checks-B5SNNBUE.js.map
