// #/kit/kerim: Kerim, the kumru. Her puppet live in a place (every place document, `?place=`), on its
// perch, with each of its marks drawn over the stage as a button that flies her there; her moods and
// her own gestures as buttons, and a tour that plays them all. Below: her moods as stills from the SVG
// backend, perched and flying, then the app's own art and CSS on its light and dark backgrounds, the
// narrator window and the brand icon (ctx.data("kerim"), read from the app on each request).

import { renderSvg, wideBox, type Cue, type Mark, type PlaceDoc, type Stage, type Vec3 } from "sahne";
import { kerim, BIRD_GESTURES, MOODS, EMO } from "sahne-kit/kerim";
import { $, bar, button, choice, css, frame, head, link, select, toggle } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { cell, kerimCss, panel, row } from "./kerim/app.ts";

/** A kit emotion that shows each of her moods (the reverse of sahne-kit/kerim's EMO). */
const SHOWS: Record<string, string> = Object.fromEntries(Object.entries(EMO).reverse().map(([emo, mood]) => [mood, emo]));

const kindOf = (place: PlaceDoc, name: string, m: Mark) =>
  name === place.perch ? "perch" : m.air ? (m.pace ? "pace" : "air") : m.door ? "door" : (m.y ?? 0) > 0 ? "high" : "ground";
const SYM: Record<string, string> = { perch: "★", air: "◌", pace: "»", door: "⇥", high: "▴", ground: "●" };

export async function render(host: HTMLElement, ctx: Ctx) {
  css("kerim-stage", `.kv-stage { position: relative; }`);
  const [places, K] = await Promise.all([ctx.data("places").catch(() => [] as PlaceDoc[]), ctx.data("kerim").catch(() => null)]);
  const moods = Object.keys(MOODS), gestures = Object.keys(BIRD_GESTURES);
  host.append(
    $("h1", "", "Kerim"),
    $("p", "note", `The kumru: her puppet on the stage (sahne-kit/kerim, the bird rig: ${moods.length} moods, ${gestures.length} gestures of her own, flight), and the app's own art and CSS below it. She is one drawing in both: the stage's copy is converted from the app's art, so the two should match line for line. Each kit emotion is worn as one of her moods. People's gestures and faces are on `),
  );
  host.lastElementChild!.append(link("Gestures and faces", "#/kit/gestures"), ".");
  if (ctx.settings.motion === "still") host.classList.add("kv-still");
  ctx.onSettings(s => host.classList.toggle("kv-still", s.motion === "still"));
  ctx.cleanup(() => host.classList.remove("kv-still"));

  // ---- on the stage, in a place, over its marks ----
  const withPerch = places.filter(p => p.perch || Object.values(p.marks).some(m => (m.y ?? 0) > 0));
  const q = ctx.route.query;
  let place = withPerch.find(p => p.id === q.get("place")) ?? withPerch.find(p => p.id === "bakkal") ?? withPerch[0];
  host.append(head("On the stage", "She starts on the place's perch (★). Each mark over the stage flies her there: ◌ a spot in the air, where she hovers; » one beside something moving, which she flies along with; ▴ somewhere up high to sit; ● the floor, where people stand; ⇥ a door. Watch the take-off and landing, the wingbeats, her shadow on a ledge (none in the air), and the camera following her (turn \"follow\" off to hold the wide shot; where her perch is above the wide shot, the stage starts on her alone).", "§6.3 §5.4"));
  if (!place) { host.append($("p", "note bad", "No place document has a perch.")); }
  let stage: Stage | null = null, follow = q.get("cam") !== "wide";
  const box = frame("16 / 9", "kv-stage"), layer = $("div", "marks"), marksRow = bar("fly to"), now = $("p", "note");
  if (place) {
    box.append(layer);
    host.append(
      bar("place", select("", withPerch.map(p => [p.id, `${p.name?.en ?? p.id} (${p.id})`] as [string, string]), place.id, v => { place = withPerch.find(p => p.id === v)!; ctx.setQuery({ place: v }); load(); }),
        toggle("follow", follow, on => { follow = on; ctx.setQuery({ cam: on ? null : "wide" }); }, "the camera follows her flight; off, it holds the wide shot"),
        button("wide", () => stage?.act({ beat: { cam: "wide" } })), button("close", () => stage?.act({ beat: { who: "kerim", cam: "close" } })),
        button("home", () => place && fly(place.perch ?? perchOf(place)))),
      box, marksRow, now,
    );
    stage = ctx.mount(box, { bubbles: false });
  }
  const perchOf = (p: PlaceDoc) => p.perch ?? Object.keys(p.marks).find(k => (p.marks[k].y ?? 0) > 0) ?? Object.keys(p.marks)[0];
  const fly = (to: string) => { now.textContent = `flying to ${to}`; return stage?.act({ beat: { who: "kerim", move: { who: "kerim", to, how: "fly" }, cam: follow ? "follow" : "wide" } }); };
  let pins: { pin: HTMLElement; p: Vec3 }[] = [];
  const load = () => {
    if (!stage || !place) return;
    // the wide shot when her perch is in it (a roof may be above it: then a single on her)
    const box = wideBox(place), m = place.marks[perchOf(place)], inWide = !m || ((m.y ?? 0) <= box.y1 && m.x >= box.x0 && m.x <= box.x1);
    stage.load({ v: 1, cues: [{ scene: { place: place.id, at: { kerim: perchOf(place) }, cam: inWide ? "wide" : "single" } }] }, { cast: { kerim: { puppet: "bird" } }, places: { [place.id]: place } });
    stage.show(0);
    now.textContent = `on ${perchOf(place)}`;
    layer.replaceChildren();
    marksRow.replaceChildren(Object.assign($("b", "", "fly to")));
    pins = Object.entries(place.marks).map(([name, m]) => {
      const kind = kindOf(place!, name, m), label = `${SYM[kind]} ${name}`, title = `${kind} mark ${name} (${m.x}, ${m.y ?? 0}, ${m.z})`;
      const pin = button(label, () => fly(name), undefined, title);
      pin.className = `pin ${kind}`;
      layer.append(pin);
      marksRow.append(button(label, () => fly(name), undefined, title));
      return { pin, p: [m.x, m.y ?? 0, m.z] as Vec3 };
    });
  };
  if (stage) {
    ctx.cleanup(stage.onFrame(() => {
      for (const { pin, p } of pins) {
        const at = stage!.project(p);
        pin.hidden = !at;
        if (at) { pin.style.left = `${at[0]}px`; pin.style.top = `${at[1]}px`; }
      }
    }));
    load();

    // moods, her gestures and the tour
    const moodRow = choice("mood", moods, "idle", m => { now.textContent = `${m} (the kit's ${SHOWS[m] ?? "neutral"})`; stage!.act({ beat: { who: "kerim", emo: SHOWS[m] ?? "neutral", cam: "single" } }); });
    for (const b of moodRow.querySelectorAll<HTMLButtonElement>("button")) b.title = `worn for the kit's emotions ${Object.entries(EMO).filter(([, v]) => v === b.dataset.v).map(([k]) => k).join(", ")}`;
    const gRow = bar("gesture", ...gestures.map(g => button(g, () => {
      now.textContent = g;
      const def = BIRD_GESTURES[g];
      stage!.act({ beat: { who: "kerim", do: g, at: def.needs?.includes("target") ? "viewer" : undefined, n: def.keys.some(k => k.shape === "count") || g === "count" ? 3 : undefined, cam: "single" } });
    }, undefined, `${BIRD_GESTURES[g].dur} ms${BIRD_GESTURES[g].needs?.length ? `, needs ${BIRD_GESTURES[g].needs!.join(", ")}` : ""}`)));
    let tour = 0;
    const playTour = async () => {
      if (!place) return;
      const me = ++tour, p = place, marks = Object.entries(p.marks);
      const air = marks.filter(([, m]) => m.air).map(([n]) => n), high = marks.filter(([n, m]) => !m.air && (m.y ?? 0) > 0 && n !== perchOf(p)).map(([n]) => n);
      const cues: [string, Cue][] = [
        ...moods.filter(m => m !== "idle").map(m => [m, { beat: { who: "kerim", emo: SHOWS[m] ?? m, wait: 1600, cam: "single" } }] as [string, Cue]),
        ["idle", { beat: { who: "kerim", emo: "neutral", wait: 400 } }],
        ...gestures.map(g => [g, { beat: { who: "kerim", do: g, at: BIRD_GESTURES[g].needs?.includes("target") ? "viewer" : undefined, n: g === "count" ? 3 : undefined, wait: 400, cam: "single" } }] as [string, Cue]),
        ...[...air.slice(0, 2), ...high.slice(0, 1)].map(to => [`fly to ${to}`, { beat: { who: "kerim", move: { who: "kerim", to, how: "fly" }, cam: "follow", wait: air.includes(to) ? 1500 : 300 } }] as [string, Cue]),
        ["home", { beat: { who: "kerim", move: { who: "kerim", to: perchOf(p), how: "fly" }, cam: "wide" } }],
      ];
      load();
      for (const [label, c] of cues) {
        if (me !== tour || !stage) return;
        now.textContent = `tour: ${label}`;
        await stage.act(c).done;
      }
    };
    ctx.cleanup(() => { tour++; });
    host.append(moodRow, gRow, bar("", button("▶ the tour", () => void playTour(), undefined, "every mood, every gesture, a flight to the air marks and a high one, and home"), button("■", () => { tour++; load(); })));
  }

  // ---- stills ----
  const k = kerim(ctx.kit);
  const still = (emo: string, flying: boolean) => {
    const out = k.pose({ bones: k.bones, body: k.body, defs: k.gestures, gestures: [], emo, ...(flying ? { air: true } : {}), idle: { t: 0, seed: "kerim", amount: 0 } });
    const el = $("span", "kv-svg");
    el.style.cssText = "width:96px;height:96px";
    el.innerHTML = renderSvg(k, ctx.kit, { framing: "full", pose: out.pose, alt: out.alt, size: 96, idPrefix: `kvs-${emo}-${flying ? "f" : "p"}-` }); // trusted: the kit's own art
    return el;
  };
  const stills = $("div", "kv-panel kv-light");
  stills.append(
    row("Perched", moods.map(m => cell(still(SHOWS[m] ?? "neutral", false), m, () => stage?.act({ beat: { who: "kerim", emo: SHOWS[m] ?? "neutral", cam: "single" } })))),
    row("Flying", moods.map(m => cell(still(SHOWS[m] ?? "neutral", true), m))),
  );
  host.append(head("Her moods as stills", "The same puppet drawn by the SVG backend (renderSvg), as lists and the app's Still motion show her. Tap a perched one to wear it on the stage.", "§6.3"), stills);

  // ---- the app's own art and CSS ----
  host.append(head("In the app", "Her art and her CSS (sahne-kit/kerim.css), as an app draws her, on its light and dark backgrounds, beside the stage's converted copy. Cheer and greet are one-shot moods: held here, and a click replays them as the app does, settling to happy. Read from the app on every load: reload after changing her art or CSS."));
  if (!K) { host.append($("p", "note bad", "The app's Kerim page data did not load (/data/kerim.json).")); return; }
  kerimCss(K);
  host.append(panel(K, "light"), panel(K, "dark"));
}
