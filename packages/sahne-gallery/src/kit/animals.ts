// #/kit/animals: the animal puppets (sahne-kit/puppets): Pisi the street cat on the cat rig and a gull on the bird rig,
// live on a stage (any place document, `?place=`, the pier by default) with buttons for their moods, walks, flights and
// gestures, and a tour that plays them all (`?tour` starts it on load, for headless shots). Below: their poses as
// stills from the SVG backend.

import { renderSvg, type Cue, type KitPuppet, type PlaceDoc, type PoseInput, type Stage } from "sahne";
import { cat, gull, CAT_EMO, CAT_MOODS, CAT_GESTURES, GULL_EMO, GULL_MOODS, GULL_GESTURES } from "sahne-kit/puppets";
import { $, bar, button, frame, head, select } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";

/** A kit emotion that shows each mood (the reverse of the EMO tables). */
const shows = (emo: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(emo).reverse().map(([e, m]) => [m, e]));
const CAT_SHOWS = shows(CAT_EMO), GULL_SHOWS = shows(GULL_EMO);
const CAST = { pisi: { puppet: "cat" }, gull: { puppet: "gull" } };

export async function render(host: HTMLElement, ctx: Ctx) {
  const places = await ctx.data("places").catch(() => [] as PlaceDoc[]);
  host.append(
    $("h1", "", "Animals"),
    $("p", "note", `Pisi, the building's black street cat, on sahne's cat rig (rig/cat.ts: ${Object.keys(CAT_MOODS).length} moods over four postures, a four-beat stride, ${Object.keys(CAT_GESTURES).length} gestures), and a gull on the bird rig (rig/bird.ts, as Kerim: ${Object.keys(GULL_MOODS).length} moods, ${Object.keys(GULL_GESTURES).length} gestures, flight). Both are side-on: they turn by mirroring and never take a seat. A cast entry { "puppet": "cat" } or { "puppet": "gull" } plays them (sahne-kit/puppets).`),
  );

  // ---- on the stage ----
  const q = ctx.route.query, withFloor = places.filter(p => Object.values(p.marks).filter(m => !(m.y ?? 0) && !m.door).length >= 3);
  let place = withFloor.find(p => p.id === q.get("place")) ?? withFloor.find(p => p.id === "vapur_pier") ?? withFloor[0];
  host.append(head("On the stage", "Pisi starts sitting, the gull standing. Walk Pisi between the floor marks (it strides, mirrored going left, its paws silent); give it a mood (a posture: sit, loaf, asleep, standing); miaow (the gesture with the kit's meow sound), yawn, eat (it gets up to the bowl), look at the gull. Fly the gull to a mark in the air or up high, and back.", "§5.4 §6.3"));
  if (!place) { host.append($("p", "note bad", "No place document has three floor marks.")); return; }
  const box = frame("16 / 9", "an-stage"), now = $("p", "note"), rows = $("div", "");
  now.className = "note an-now";
  host.append(bar("place", select("", withFloor.map(p => [p.id, `${p.name?.en ?? p.id} (${p.id})`] as [string, string]), place.id, v => { place = withFloor.find(p => p.id === v)!; ctx.setQuery({ place: v }); load(); })), box, rows, now);
  const stage: Stage = ctx.mount(box, { bubbles: false });
  const floor = (p: PlaceDoc) => Object.entries(p.marks).filter(([, m]) => !(m.y ?? 0) && !m.door && !m.air && m.seat === undefined).map(([n]) => n);
  const above = (p: PlaceDoc) => Object.entries(p.marks).filter(([, m]) => m.air || ((m.y ?? 0) > 0.5 && (m.y ?? 0) < 6)).map(([n]) => n);
  let home = { pisi: "", gull: "" };
  // the camera on whoever acts: following a walk or a flight, a single otherwise (in a wide shot a cat is a few pixels)
  const cam = (c: Cue): Cue => {
    if (!("beat" in c) || c.beat.cam) return c;
    const mv = Array.isArray(c.beat.move) ? c.beat.move[0] : c.beat.move, who = mv?.who ?? c.beat.who;
    return { beat: { ...c.beat, ...(who && !c.beat.who ? { who } : {}), cam: mv ? "follow" : "single" } };
  };
  const act = (label: string, c: Cue) => { now.textContent = label; return stage.act(cam(c)); };
  const load = () => {
    const f = floor(place!);
    home = { pisi: f[Math.floor(f.length / 2)] ?? f[0], gull: f[f.length - 1] };
    stage.load({ v: 1, cues: [{ scene: { place: place!.id, at: { pisi: home.pisi, gull: home.gull }, cam: "wide" } }, { beat: { who: "pisi", cam: "single" } }] }, { cast: CAST, places: { [place!.id]: place! } });
    stage.show(1);
    now.textContent = `Pisi on ${home.pisi}, the gull on ${home.gull}`;
    const cg = (g: string): Cue => ({ beat: { who: "pisi", do: g, ...(CAT_GESTURES[g].needs?.includes("target") ? { at: "ch:gull" } : {}), ...(g === "meow" ? { sfx: { id: "meow", at: "ch:pisi" } } : {}) } });
    rows.replaceChildren(
      bar("Pisi walks to", ...f.map(m => button(m, () => act(`Pisi walks to ${m}`, { beat: { move: { who: "pisi", to: m } } }))), button("run home", () => act("Pisi runs home", { beat: { move: { who: "pisi", to: home.pisi, how: "run" } } }))),
      bar("Pisi's mood", ...Object.keys(CAT_MOODS).map(m => button(m, () => act(`Pisi: ${m} (${CAT_MOODS[m].posture})`, { beat: { who: "pisi", emo: CAT_SHOWS[m] ?? "neutral" } }), undefined, `worn for ${Object.entries(CAT_EMO).filter(([, v]) => v === m).map(([k]) => k).join(", ")}`))),
      bar("Pisi does", ...Object.keys(CAT_GESTURES).map(g => button(g, () => act(`Pisi: ${g}`, cg(g)), undefined, `${CAT_GESTURES[g].dur} ms`))),
      bar("the gull flies to", ...above(place!).map(m => button(m, () => act(`the gull flies to ${m}`, { beat: { move: { who: "gull", to: m, how: "fly" } } }))), button("home", () => act("the gull flies home", { beat: { move: { who: "gull", to: home.gull, how: "fly" } } }))),
      bar("the gull", ...Object.keys(GULL_MOODS).map(m => button(m, () => act(`gull: ${m}`, { beat: { who: "gull", emo: GULL_SHOWS[m] ?? "neutral" } }))),
        ...Object.keys(GULL_GESTURES).map(g => button(g, () => act(`gull: ${g}`, { beat: { who: "gull", do: g, ...(g === "look" ? { at: "ch:pisi" } : { n: 3 }) } })))),
      bar("", button("▶ the tour", () => void tour(), undefined, "Pisi walks out and back, sits, loafs, sleeps, miaows, yawns and eats; the gull flaps, flies off and comes back"), button("■", () => { tourN++; load(); })),
    );
  };
  let tourN = 0;
  const tour = async () => {
    const me = ++tourN, f = floor(place!), far = f[0] === home.pisi ? f[f.length - 1] : f[0], up = above(place!)[0];
    load();
    const steps: [string, Cue][] = [
      ["Pisi walks out", { beat: { move: { who: "pisi", to: far } } }],
      ["and back", { beat: { move: { who: "pisi", to: home.pisi } } }],
      ["meow", { beat: { who: "pisi", do: "meow", sfx: { id: "meow", at: "ch:pisi" }, wait: 300 } }],
      ["loaf", { beat: { who: "pisi", emo: "happy", wait: 1200 } }],
      ["asleep", { beat: { who: "pisi", emo: "tired", wait: 1200 } }],
      ["yawn", { beat: { who: "pisi", do: "yawn", emo: "neutral" } }],
      ["eat", { beat: { who: "pisi", do: "eat", wait: 300 } }],
      ["the gull flaps", { beat: { who: "gull", do: "flap", n: 3 } }],
      ...(up ? [["the gull flies off", { beat: { move: { who: "gull", to: up, how: "fly" }, wait: 800 } }], ["and back", { beat: { move: { who: "gull", to: home.gull, how: "fly" } } }]] as [string, Cue][] : []),
      ["Pisi looks at the gull", { beat: { who: "pisi", do: "look", at: "ch:gull", emo: "curious" } }],
    ];
    for (const [label, c] of steps) {
      if (me !== tourN) return;
      now.textContent = `tour: ${label}`;
      await stage.act(cam(c)).done;
    }
  };
  ctx.cleanup(() => { tourN++; });
  load();
  if (q.has("tour")) void tour();

  // ---- stills ----
  const still = (K: KitPuppet, key: string, o: Partial<PoseInput>) => {
    const fig = { ...K, bones: [...K.bones, { name: "neck", parent: "head", x: 0, y: 0, rot: 0 }] }; // renderSvg's framing asks for a neck
    const out = K.pose({ bones: K.bones, body: K.body, defs: K.gestures, gestures: [], idle: { t: 0, seed: key, amount: 0 }, ...o });
    const el = $("figure", "an-still");
    el.innerHTML = renderSvg(fig, ctx.kit, { framing: "full", pose: out.pose, alt: out.alt, size: 110, idPrefix: `an-${key}-` }); // trusted: the kit's own art
    el.append($("figcaption", "", key));
    return el;
  };
  const C = cat(ctx.kit), G = gull(ctx.kit), strip = (...els: HTMLElement[]) => { const d = $("div", "an-row"); d.append(...els); return d; };
  host.append(
    head("As stills", "The same puppets drawn by the SVG backend (renderSvg): Pisi's moods, a stride through one cycle (two steps) and its gestures at their stroke; the gull's moods, perched and in flight.", "§6.3"),
    strip(...Object.keys(CAT_MOODS).map(m => still(C, m, { emo: CAT_SHOWS[m] }))),
    strip(...[0, 0.25, 0.5, 0.75, 1, 1.5].map(ph => still(C, `walk ${ph}`, { walk: { phase: ph, amount: 1, dir: 1 } }))),
    strip(...Object.entries(CAT_GESTURES).map(([g, d]) => still(C, g, { gestures: [{ id: g, t: d.loop ? d.loop[0] + 200 : d.stroke + 120, side: "l", target: [40, -90] }] }))),
    strip(...Object.keys(GULL_MOODS).map(m => still(G, `gull ${m}`, { emo: GULL_SHOWS[m] })), still(G, "gull hovering", { air: true }),
      ...[0, 0.25, 0.5].map(ph => still(G, `gull flying ${ph}`, { walk: { phase: ph, amount: 1, dir: 1, how: "fly" } }))),
  );
  host.querySelectorAll<HTMLElement>(".an-row").forEach(r => { r.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:6px 0"; });
  host.querySelectorAll<HTMLElement>(".an-still").forEach(f => { f.style.cssText = "margin:0;text-align:center;font-size:12px"; });
}
