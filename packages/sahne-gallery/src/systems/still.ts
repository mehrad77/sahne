// Portraits, the still backend (DESIGN.md §10): an avatar document as an SVG string for lists,
// profiles and story tiles. Nima and İsmail at every framing and list size, the emotions, the back,
// the silhouette, a host stylesheet that cannot reach inside, two copies on one page (idPrefix), a
// list of fifty with its timing (and 450 in chunks), and the fallback a page shows while a stage's
// WebGL context is lost (StageOptions.onContext), drawn beside the paper stage it stands in for.

import { portrait, silhouette, clearPortraits, portraitCacheSize, onPortraitError, GARMENT_FIELDS, type AvatarDoc, type Framing, type Garment, type PortraitOptions } from "sahne";
import { $, bar, button, chip } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { NIMA, ISMAIL } from "../bakkal.ts";

const FRAMINGS: Framing[] = ["head", "bust", "full"];
const SIZES = [28, 48, 96, 160];
const kb = (s: string) => (s.length / 1024).toFixed(1) + " KB";
const pad = (n: number) => String(n).padStart(2, "0");

/** `n` documents that between them wear every part of the kit (each part's doc field comes from its slot). */
function sampleDocs(kit: Ctx["kit"], n: number): AvatarDoc[] {
  const BUILDS = ["adult", "adult", "elder", "child", "adult", "toddler", "elder", "adult"] as const, SHAPES = ["average", "slim", "broad", "round"] as const;
  const pick = <T,>(a: readonly T[], i: number) => a[Math.floor(i) % a.length];
  const docs = Array.from({ length: n }, (_, i): AvatarDoc => ({
    v: 1, kit: kit.id, body: { build: pick(BUILDS, i), height: (i * 0.37) % 1, shape: pick(SHAPES, i + (i >> 2)) }, skin: `skin_${pad(i * 5 % 12 + 1)}`,
    face: { shape: pick(["oval", "round", "square", "long", "heart"], i), eyes: pick(["round", "almond", "sleepy", "dot"], i * 3), brows: pick(["soft", "thick", "thin", "arched"], i + 1), mouth: pick(["wide", "small", "full"], i), marks: i % 5 === 2 ? ["freckles"] : [] },
    hair: { style: "hair_short", color: `hair_${pad(i * 3 % 10 + 1)}` },
    outfit: { top: { id: "top_tee", colors: [`fab_${pad(i * 7 % 24 + 1)}`] }, bottom: { id: "bottom_jeans" }, shoes: { id: "shoes_sneakers" } }, wear: {},
  }));
  const used = new Map<string, number>();
  for (const [id, part] of Object.entries(kit.parts)) {
    const k = used.get(part.slot) ?? 0, d = docs[(k + part.slot.length * 3) % n];
    used.set(part.slot, k + 1);
    const garment: Garment = { id, colors: Array.from({ length: Math.max(1, part.colors ?? 1) }, (_, c) => `fab_${pad((k * 5 + c * 7 + 3) % 24 + 1)}`) };
    const [a, b] = (GARMENT_FIELDS.find(f => f.slot === part.slot)?.field ?? "").split(".");
    if (part.slot === "hair") d.hair.style = id;
    else if (a && b) ((d as unknown as Record<string, Record<string, Garment>>)[a] ??= {})[b] = garment;
    else if (a) (d as unknown as Record<string, Garment>)[a] = garment;
  }
  return docs;
}

export function build(host: HTMLElement, ctx: Ctx) {
  const kit = ctx.kit;
  // a kit that cannot draw would show every character as the silhouette: say so
  onPortraitError(e => console.warn("portrait fell back to the silhouette:", e));
  ctx.cleanup(() => onPortraitError(null));
  // Nima and İsmail are the app's own cast: trusted (hex colours kept)
  const P = (doc: unknown, o: PortraitOptions = {}) => portrait(doc, kit, { trusted: true, ...o });
  host.append(Object.assign($("style"), { textContent: ".st-row{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:6px 0}.st-row figure{margin:0;display:grid;justify-items:center;gap:2px;font:11px ui-monospace,monospace;color:var(--mute)}.st-row svg{background:#EDE6DA;border-radius:6px}.st-dark{background:#26221F;padding:6px;border-radius:8px}.st-ink svg{stroke:#e00;stroke-width:6px;fill:#00e}.st-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:2px 10px;background:var(--chip);border:1px solid var(--line);border-radius:12px;padding:8px}.st-list div{display:flex;align-items:center;gap:8px;min-height:50px;font-size:13px}.st-list svg{flex:none;border-radius:50%}.st-many{grid-template-columns:repeat(auto-fill,minmax(42px,1fr));max-height:280px;overflow:auto}.st-many div{min-height:42px;justify-content:center}.st-pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;align-items:center}.st-pair .frame{margin:0}" }));
  const fig = (svg: string, caption: string, cls = "") => { const f = $("figure", cls), d = $("div"); d.innerHTML = svg; f.append(d, caption); return f; };
  const row = (...f: HTMLElement[]) => { const r = $("div", "st-row"); r.append(...f); return r; };

  // ---- framings and sizes ----
  host.append($("h2", "", "Framings and list sizes"), $("p", "note", "Head, bust and full, at 28 to 160 px. The detail follows the size: under 100 px the soft layer shadows and the limb rim are left out, and the numbers are rounded harder, so a 28 px head is a few KB. Each picture is cached by the normalized document, framing, face and detail; size, idPrefix and label are put on afterwards."));
  for (const [name, doc] of [["Nima", NIMA], ["İsmail", ISMAIL]] as const)
    host.append(row(...FRAMINGS.flatMap(fr => SIZES.map(size => { const s = P(doc, { framing: fr, size }); return fig(s, `${name} ${fr} ${size} · ${kb(s)}`); }))));

  // ---- emotions ----
  host.append($("h2", "", "Emotions"), $("p", "note", "Every emotion of the kit's face, at 96 px; an emotion the kit does not have (or __proto__) is the calm neutral face."));
  host.append(row(...Object.keys(kit.face.emotions).map(e => fig(P(NIMA, { framing: "head", size: 96, emotion: e }), e))));

  // ---- the back ----
  host.append($("h2", "", "From behind"), $("p", "note", "view: back draws the back of the head and the clothes (İsmail's apron strings); background puts a fill behind the figure, here a dark one."));
  host.append(row(...[NIMA, ISMAIL].flatMap(doc => [fig(P(doc, { framing: "bust", size: 130 }), "front"), fig(P(doc, { framing: "bust", size: 130, view: "back" }), "back"), fig(P(doc, { framing: "bust", size: 130, view: "back", background: "#26221F" }), "back, dark", "st-dark")])));

  // ---- the silhouette ----
  host.append($("h2", "", "The silhouette"), $("p", "note", "What lists show before a learner has designed a character, and for a document that is missing, old-style or hostile (portrait(null) is this): a neutral paper cut-out, the same in light and dark."));
  host.append(row(...FRAMINGS.flatMap(fr => [48, 96].map(size => fig(silhouette(kit, { framing: fr, size }), `${fr} ${size}`))), fig(portrait({ skin: 2, hair: 3 }, kit, { framing: "bust", size: 96 }), "portrait(old char)")));

  // ---- a host stylesheet ----
  host.append($("h2", "", "A host stylesheet cannot reach in"), $("p", "note", "The right-hand picture sits under a page rule that inks every svg (stroke red, 6 px, fill blue). Every shape sets its own fill and stroke, so the portrait looks the same."));
  host.append(row(fig(P(ISMAIL, { framing: "bust", size: 150 }), "no host rule"), fig(P(ISMAIL, { framing: "bust", size: 150 }), ".st-ink svg { stroke:red; fill:blue }", "st-ink")));

  // ---- idPrefix ----
  host.append($("h2", "", "The same character twice on a page (idPrefix, label)"), $("p", "note", "A portrait's ids (clip paths, the shadow filter) carry a prefix from its cache key, so different pictures never collide; two copies of one picture share theirs, which matters only if the first is hidden with display: none. idPrefix gives each place its own; label gives the picture role=img and an aria-label."));
  const twice = row(...["bar-", "profile-"].map(p => fig(P(NIMA, { framing: "bust", size: 110, idPrefix: p, label: "Nima" }), `idPrefix "${p}"`)));
  const ids = [...twice.querySelectorAll("svg [id]")].map(e => e.id);
  host.append(twice, bar("", chip(`${ids.length} ids in these two, ${new Set(ids).size} different`, ids.length === new Set(ids).size ? "ok" : "warn"), chip(`aria-label: ${twice.querySelector("svg")?.getAttribute("aria-label")}`)));

  // ---- a list of fifty ----
  host.append($("h2", "", "A list of fifty friends"), $("p", "note", "Fifty different documents (sixteen that wear every part of the kit between them, each with another skin and hair colour) as 48 px heads: no renderer is started, only fifty strings. Cold is the first draw of each; cached is the same fifty again. 450 are drawn 30 a frame, so no task runs long."));
  const docs = sampleDocs(kit, 16), timing = $("p", "note"), list = $("div", "st-list");
  const friends = Array.from({ length: 50 }, (_, i) => i === 0 ? NIMA : i === 1 ? ISMAIL : { ...docs[i % 16], skin: `skin_${pad(i % 12 + 1)}`, hair: { ...docs[i % 16].hair, color: `hair_${pad(i * 7 % 10 + 1)}` } });
  const drawFifty = () => {
    clearPortraits();
    const times: number[] = [], svgs = friends.map(d => { const t = performance.now(), s = P(d, { framing: "head", size: 48 }); times.push(performance.now() - t); return s; });
    const cold = times.reduce((a, b) => a + b, 0), t1 = performance.now();
    for (const d of friends) P(d, { framing: "head", size: 48 });
    const warm = performance.now() - t1, c = portraitCacheSize();
    list.replaceChildren(...svgs.map((s, i) => { const d = $("div"); d.innerHTML = s; d.append(i === 0 ? "Nima" : i === 1 ? "İsmail" : `friend ${i + 1}`); return d; }));
    timing.textContent = `50 portraits: ${cold.toFixed(0)} ms cold (${(cold / 50).toFixed(2)} ms each, slowest ${Math.max(...times).toFixed(1)} ms) · ${warm.toFixed(1)} ms cached · ${(svgs.reduce((a, s) => a + s.length, 0) / 1024).toFixed(0)} KB of markup · cache ${c.entries} pictures`;
  };
  const many = $("div", "st-list st-many"), manyNote = $("p", "note");
  many.style.display = "none";
  const draw450 = () => {
    clearPortraits(); many.replaceChildren(); many.style.display = "";
    const all = Array.from({ length: 450 }, (_, i) => ({ ...docs[i % 16], skin: `skin_${pad(i % 12 + 1)}`, hair: { ...docs[i % 16].hair, color: `hair_${pad(i * 7 % 10 + 1)}` }, body: { ...docs[i % 16].body, height: (i % 41) / 41 } }));
    let at = 0, longest = 0, alive = true;
    const t0 = performance.now();
    ctx.cleanup(() => { alive = false; });
    const step = () => {
      if (!alive) return;
      const t = performance.now();
      for (const d of all.slice(at, at + 30)) { const c = $("div"); c.innerHTML = portrait(d, kit, { framing: "head", size: 40 }); many.append(c); }
      longest = Math.max(longest, performance.now() - t); at += 30;
      if (at < all.length) { requestAnimationFrame(step); return; }
      const t2 = performance.now();
      for (const d of all) portrait(d, kit, { framing: "head", size: 40 });
      const c = portraitCacheSize();
      manyNote.textContent = `450 in chunks of 30: ${(performance.now() - t0).toFixed(0)} ms in all, longest chunk ${longest.toFixed(0)} ms · again from the cache ${(performance.now() - t2).toFixed(1)} ms · cache ${c.entries} pictures, ${(c.chars / 1e6).toFixed(1)} M characters (bounded at 6 M)`;
    };
    requestAnimationFrame(step);
  };
  host.append(bar("", button("draw the fifty again (cold)", drawFifty), button("450 friends (30 a frame)", draw450)), timing, list, manyNote, many);
  drawFifty();

  // ---- the fallback when WebGL is lost ----
  host.append($("h2", "", "When the GPU takes the context away"), $("p", "note", "A phone can take a stage's WebGL context at any time. The stage tells the page through onContext(true), and the page puts the SVG portrait up in its place (lose); when the context comes back, onContext(false), the stage draws its atlas again by itself and the portrait goes (restore). Without WebGL2 at all, stage.webgl is false and the page shows the portrait from the start."));
  const pairEl = $("div", "st-pair"), box = $("div", "frame"), still = $("div"), log = $("pre", "log");
  box.style.cssText = "aspect-ratio:3/4;max-width:320px;position:relative";
  still.style.cssText = "position:absolute;inset:0;display:none;place-items:center;background:#EDE6DA";
  still.innerHTML = P(NIMA, { framing: "full", detail: 400, label: "Nima" });
  (still.firstElementChild as SVGElement | null)?.setAttribute("style", "height:92%;width:auto");
  log.textContent = "The stage on the left, the SVG for the same document on the right.";
  const stage = ctx.mount(box, { bubbles: false, onContext: lost => { still.style.display = lost ? "grid" : "none"; log.textContent += `\nonContext(${lost}): ${lost ? "the SVG portrait stands in" : "the stage draws again; the portrait is taken down"}`; } });
  box.append(still);
  if (stage.webgl) stage.studio(NIMA, { framing: "full", trusted: true, label: "Nima" }); else still.style.display = "grid";
  pairEl.append(box, fig(P(NIMA, { framing: "full", size: 300 }), "the SVG, full, 300 px"));
  const ext = stage.r?.gl.getExtension("WEBGL_lose_context") ?? null;
  host.append(pairEl, bar("context", button("lose", () => { if (!ext) { log.textContent += "\nno WEBGL_lose_context here"; return; } if (!stage.lost) ext.loseContext(); }), button("restore", () => { if (ext && stage.lost) ext.restoreContext(); })), log);
}
