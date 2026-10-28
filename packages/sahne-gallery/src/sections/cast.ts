// #/cast: the stories' characters. The roster is $SAHNE_CONTENT/characters/<id>.json
// (serve.mjs, sorted by `order`), each character as still portraits at head, bust and full (the still
// backend, DESIGN.md §10), with a tab per outfit and a link to the studio, where the same look plays
// live. Kerim is a kit puppet, shown as her portrait. #/cast/extras: the generic extras
// (the documents there with `kind: "extra"`), the same way. The clipping check of these is sahne-story/test/cast.test.ts.

import { applyLook, AVATAR_MAX_BYTES, portrait, serialize, type AvatarDoc, type Framing } from "sahne";
import { K_HEAD_VB, K_BUST, K_HEAD } from "sahne-kit/kerim/art";
import type { CharacterDoc } from "sahne-story";
import { $, chip, choice, css, head, link } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import type { Extra } from "../shell/data.ts";
import { kerimPortrait } from "sahne-kit/kerim/portrait";

const FRAMINGS: Framing[] = ["head", "bust", "full"];
const bytes = (doc: AvatarDoc) => new TextEncoder().encode(serialize(doc)).length;

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

/** Three portraits of `doc`: head, bust and full, 160 px. The cast is the app's own: trusted. */
function pictures(doc: AvatarDoc, label: string, kit: Ctx["kit"]): HTMLElement {
  const row = $("div", "cast-pics");
  for (const framing of FRAMINGS) {
    const f = $("figure"), pic = $("div", "pic");
    // the still backend's own markup: built from the document by `portrait`, never from its text
    pic.innerHTML = portrait(doc, kit, { framing, size: 160, trusted: true, label });
    f.append(pic, framing);
    row.append(f);
  }
  return row;
}

/** A card: the name, its colour, the role, the pictures, a tab per outfit and a link to the studio. */
function card(ctx: Ctx, o: { id: string; name: string; nameFa?: string; role?: string; color?: string; avatar?: AvatarDoc; outfits?: Record<string, unknown>; puppet?: string; studio?: string }): HTMLElement {
  const el = $("article", "cast-card"), h = $("h3");
  if (o.color) { const sw = $("span", "swatch"); sw.style.background = o.color; sw.title = o.color; h.append(sw); }
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
    if (o.puppet === "bird") note.append("She plays on stage as the kit's bird puppet: ", link("Kit → Kerim", "#/kit/kerim"));
    else note.append(o.puppet ? "A kit puppet with no portrait in the gallery yet." : "No avatar document.");
    el.append(row, note);
    return el;
  }

  const outfits = Object.keys(o.outfits ?? {});
  const names = ["default", ...outfits];
  const key = `o.${o.id}`, start = names.find(n => n === ctx.route.query.get(key)) ?? "default";
  const body = $("div"), meta = $("div", "bar");
  const show = (name: string) => {
    const doc = name === "default" ? o.avatar! : applyLook(o.avatar!, (o.outfits as Record<string, Parameters<typeof applyLook>[1]>)[name]);
    const base = o.studio ?? o.id, n = bytes(doc), look = name === "default" ? base : `${base}.${name}`;
    body.replaceChildren(pictures(doc, o.name, ctx.kit));
    meta.replaceChildren(chip(`${n} / ${AVATAR_MAX_BYTES} bytes`, n <= AVATAR_MAX_BYTES ? "ok" : "bad", "the raw document, before normalize"), link("open in the studio", `#/kit/people?tab=studio&look=${encodeURIComponent(look)}`));
  };
  if (outfits.length) el.append(choice("outfit", names, start, n => { ctx.setQuery({ [key]: n === "default" ? null : n }); show(n); }));
  el.append(body, meta);
  show(start);
  return el;
}

export async function render(host: HTMLElement, ctx: Ctx) {
  const view = ctx.route.path[0] === "extras" ? "extras" : "roster";
  if (view === "roster") {
    host.append(head("The cast", "Every character of the stories, from the roster in $SAHNE_CONTENT/characters/ (one document per character, the one every story reads), by order: head, bust and full as the still backend draws them, each outfit as a tab, and a link to the studio where the same look plays live. The clipping test over these is sahne-story/test/cast.test.ts.", "§10"));
    const cast: CharacterDoc[] = await ctx.data("cast");
    const grid = $("div", "cast-grid");
    for (const c of cast) grid.append(card(ctx, { id: c.id, name: c.name, nameFa: c.nameFa, role: typeof c.role === "string" ? c.role : undefined, color: c.color, avatar: c.avatar, outfits: c.outfits, puppet: c.puppet }));
    if (!cast.length) grid.append($("p", "note", "No characters in $SAHNE_CONTENT/characters/ yet."));
    host.append(grid);
    return;
  }
  host.append(head("Extras", "The generic extras (clerks, çaycı, crowds, children) from $SAHNE_CONTENT/characters/ (kind extra, written by sahne-story/cast/extras.ts), drawn the same way.", "§10"));
  const extras: Extra[] = await ctx.data("extras");
  const grid = $("div", "cast-grid");
  for (const x of extras) {
    const doc = x.avatar ?? ("v" in x && "body" in x ? (x as unknown as AvatarDoc) : undefined);
    grid.append(card(ctx, { id: x.file, name: typeof x.name === "string" ? x.name : x.file, nameFa: typeof x.nameFa === "string" ? x.nameFa : undefined, role: typeof x.role === "string" ? x.role : undefined, color: typeof x.color === "string" ? x.color : undefined, avatar: doc, outfits: x.outfits as Record<string, unknown> | undefined, studio: `extra.${x.file}` }));
  }
  if (!extras.length) grid.append($("p", "note", "No extras yet: node packages/sahne-story/cast/extras.ts writes them into $SAHNE_CONTENT/characters/."));
  host.append(grid);
}
