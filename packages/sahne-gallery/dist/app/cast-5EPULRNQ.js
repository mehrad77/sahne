import {
  textIn,
  textOf
} from "./chunk-6JPAPIMW.js";
import {
  K_BUST,
  K_HEAD,
  K_HEAD_VB,
  kerimPortrait
} from "./chunk-GKR3PCTG.js";
import "./chunk-ZT53KTYM.js";
import {
  $,
  chip,
  choice,
  css,
  head,
  link
} from "./chunk-4TGKXDN4.js";
import {
  AVATAR_MAX_BYTES,
  applyLook,
  portrait,
  serialize
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/sections/cast.ts
var FRAMINGS = ["head", "bust", "full"];
var bytes = (doc) => new TextEncoder().encode(serialize(doc)).length;
css("cast", `
.cast-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 540px), 1fr)); gap: 12px; margin-top: 10px; }
.cast-card { background: var(--chip); border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; display: grid; gap: 6px; min-width: 0; }
.cast-card h3 { margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 16px; }
.cast-card h3 .fa { color: var(--mute); font-weight: 400; }
.cast-card .swatch { width: 14px; height: 14px; border-radius: 50%; border: 1px solid var(--line); flex: none; }
.cast-card .role { color: var(--mute); margin: 0; }
.cast-card .bar { margin: 0; }
.cast-pics { display: flex; gap: 8px; flex-wrap: wrap; align-items: end; }
.cast-pics figure { margin: 0; display: grid; justify-items: center; gap: 2px; font: 11px ui-monospace, monospace; color: var(--mute); }
.cast-pics .pic { width: 160px; height: 160px; background: #EDE6DA; border-radius: 8px; display: grid; place-items: center; overflow: hidden; }
.cast-pics .pic svg { display: block; max-width: 100%; max-height: 100%; }
.cast-pics .puppet { width: 160px; height: 160px; border-radius: 50%; background: #EDE6DA; overflow: hidden; }
`);
function pictures(doc, label, kit) {
  const row = $("div", "cast-pics");
  for (const framing of FRAMINGS) {
    const f = $("figure"), pic = $("div", "pic");
    pic.innerHTML = portrait(doc, kit, { framing, size: 160, trusted: true, label });
    f.append(pic, framing);
    row.append(f);
  }
  return row;
}
function card(ctx, o) {
  const el = $("article", "cast-card"), h = $("h3");
  if (o.color) {
    const sw = $("span", "swatch");
    sw.style.background = o.color;
    sw.title = o.color;
    h.append(sw);
  }
  h.append($("span", "", o.name));
  if (o.nameFa) h.append(Object.assign($("span", "fa", o.nameFa), { dir: "rtl" }));
  h.append($("code", "", o.id));
  el.append(h);
  if (o.role) el.append($("p", "role", o.role));
  if (!o.avatar) {
    const row = $("div", "cast-pics"), f = $("figure");
    if (o.puppet === "bird") {
      const pic = $("div", "puppet");
      pic.append(kerimPortrait({ vb: K_HEAD_VB, bust: K_BUST, head: K_HEAD }));
      f.append(pic, "kit puppet: bird");
    } else f.append($("div", "pic", o.puppet ? `puppet ${o.puppet}` : "no avatar"), o.puppet ? "kit puppet" : "");
    row.append(f);
    const note = $("p", "role");
    if (o.puppet === "bird") note.append("She plays on stage as the kit's bird puppet: ", link("Kit \u2192 Kerim", "#/kit/kerim"));
    else note.append(o.puppet ? "A kit puppet with no portrait in the gallery yet." : "No avatar document.");
    el.append(row, note);
    return el;
  }
  const outfits = Object.keys(o.outfits ?? {});
  const names = ["default", ...outfits];
  const key = `o.${o.id}`, start = names.find((n) => n === ctx.route.query.get(key)) ?? "default";
  const body = $("div"), meta = $("div", "bar");
  const show = (name) => {
    const doc = name === "default" ? o.avatar : applyLook(o.avatar, o.outfits[name]);
    const base = o.studio ?? o.id, n = bytes(doc), look = name === "default" ? base : `${base}.${name}`;
    body.replaceChildren(pictures(doc, o.name, ctx.kit));
    meta.replaceChildren(chip(`${n} / ${AVATAR_MAX_BYTES} bytes`, n <= AVATAR_MAX_BYTES ? "ok" : "bad", "the raw document, before normalize"), link("open in the studio", `#/kit/people?tab=studio&look=${encodeURIComponent(look)}`));
  };
  if (outfits.length) el.append(choice("outfit", names, start, (n) => {
    ctx.setQuery({ [key]: n === "default" ? null : n });
    show(n);
  }));
  el.append(body, meta);
  show(start);
  return el;
}
async function render(host, ctx) {
  const view = ctx.route.path[0] === "extras" ? "extras" : "roster";
  if (view === "roster") {
    host.append(head("The cast", "Every character of the stories, from the roster in $SAHNE_CONTENT/characters/ (one document per character, the one every story reads), by order: head, bust and full as the still backend draws them, each outfit as a tab, and a link to the studio where the same look plays live. The clipping test over these is sahne-story/test/cast.test.ts.", "\xA710"));
    const cast = await ctx.data("cast");
    const grid2 = $("div", "cast-grid");
    for (const c of cast) grid2.append(card(ctx, { id: c.id, name: textOf(c.name) ?? c.id, nameFa: textIn(c.name, "fa"), role: textOf(c.role, "en"), color: c.color, avatar: c.avatar, outfits: c.outfits, puppet: c.puppet }));
    if (!cast.length) grid2.append($("p", "note", "No characters in $SAHNE_CONTENT/characters/ yet."));
    host.append(grid2);
    return;
  }
  host.append(head("Extras", "The generic extras (clerks, \xE7ayc\u0131, crowds, children) from $SAHNE_CONTENT/characters/ (kind extra, written by sahne-story/cast/extras.ts), drawn the same way.", "\xA710"));
  const extras = await ctx.data("extras");
  const grid = $("div", "cast-grid");
  for (const x of extras) {
    const doc = x.avatar ?? ("v" in x && "body" in x ? x : void 0);
    grid.append(card(ctx, { id: x.file, name: textOf(x.name) ?? x.file, nameFa: textIn(x.name, "fa"), role: textOf(x.role, "en"), color: typeof x.color === "string" ? x.color : void 0, avatar: doc, outfits: x.outfits, studio: `extra.${x.file}` }));
  }
  if (!extras.length) grid.append($("p", "note", "No extras yet: node packages/sahne-story/cast/extras.ts writes them into $SAHNE_CONTENT/characters/."));
  host.append(grid);
}
export {
  render
};
//# sourceMappingURL=cast-5EPULRNQ.js.map
