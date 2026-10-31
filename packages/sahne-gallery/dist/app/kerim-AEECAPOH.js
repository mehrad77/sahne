import {
  BIRD_GESTURES,
  EMO,
  KERIM_PARTS,
  MOODS,
  kerim
} from "./chunk-GO2IY55S.js";
import {
  $,
  bar,
  button,
  choice,
  css,
  frame,
  head,
  link,
  select,
  toggle
} from "./chunk-4TGKXDN4.js";
import {
  Path,
  SVG_BASE,
  groupSvg,
  renderSvg,
  wideBox
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/kit/kerim/app.ts
function kerimCss(K) {
  css("kerim-app", `${K.css}
.kv-light { --k-shadow: ${K.shadow.light}; }
.kv-dark { --k-shadow: ${K.shadow.dark}; }
.kv-still .kerim, .kv-still .kerim *, .kv-still .kv-head * { animation: none !important; transition: none !important; }`);
  css("kerim-view", `
.kv-panel { border-radius: 14px; padding: 12px 16px 16px; border: 1px solid var(--line); margin: 0 0 14px; }
.kv-light { background: #FFF8EC; color: #2B2420; }
.kv-dark { background: #191A12; color: #EFE7DC; }
.kv-panel h2 { font-size: 15px; margin: 2px 0 6px; }
.kv-row h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; opacity: .65; margin: 14px 0 6px; }
.kv-cells { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: flex-end; }
.kv-cell { margin: 0; display: grid; justify-items: center; gap: 4px; }
.kv-cell[title] { cursor: pointer; }
.kv-cell figcaption { font-size: 11px; opacity: .65; }
.kv-win { display: block; border-radius: 50%; overflow: hidden; cursor: pointer; background: radial-gradient(circle at 50% 35%, #BFE3EA, #6FA9B8); box-shadow: 0 0 0 4px #FFF4DA, 0 2px 6px rgba(40, 24, 16, .3); }
.kv-svg { display: block; }
.kv-svg svg { width: 100%; height: 100%; display: block; }
.kv-svg.round { border-radius: 50%; overflow: hidden; }
.kv-head { display: block; width: 100%; height: 100%; }
.kv-head svg { display: block; width: 100%; height: 100%; overflow: visible; }
.kv-head .k-head, .kv-head .k-beak-lo { transform-box: view-box; }
.kv-head .k-head { transform-origin: 57px 48px; }
.kv-head .k-beak-lo { transform-origin: 66.6px 41.5px; }
.kv-head .k-lid { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); }
.kv-head.talk .k-beak-lo { transform: rotate(22deg); }
@media (prefers-reduced-motion: no-preference) {
  .kv-head .k-lid { animation: kv-blink 4.8s infinite; }
  .kv-head.talk .k-beak-lo { animation: kv-beak .2s ease-in-out infinite alternate; }
  .kv-head.talk .k-head { animation: kv-nod .42s ease-in-out infinite alternate; }
}
@keyframes kv-blink { 0%, 93%, 100% { transform: scaleY(0); } 96% { transform: scaleY(1); } }
@keyframes kv-beak { from { transform: none; } to { transform: rotate(22deg); } }
@keyframes kv-nod { from { transform: rotate(-2deg); } to { transform: rotate(3deg) translateY(.5px); } }
`);
}
var timers = /* @__PURE__ */ new WeakMap();
function setMood(K, p, mood, hold = false) {
  clearTimeout(timers.get(p));
  p.classList.remove(...K.moods);
  void p.offsetWidth;
  p.classList.add(mood);
  const back = K.once[mood];
  if (back && !hold) timers.set(p, setTimeout(() => {
    p.classList.remove(mood);
    p.classList.add("happy");
  }, back));
}
function pup(K, mood, size, o = {}) {
  const pose = o.pose ?? "perched";
  const s = $("span", `kerim pose-${pose}`);
  if (size) s.style.cssText = `width:${size}px;height:${size}px`;
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", `Kerim, ${mood}`);
  s.innerHTML = pose === "head" ? K.head : K.art;
  if (o.enter) {
    s.classList.add("enter-land", K.once[mood] ? "happy" : mood);
    setTimeout(() => {
      s.classList.remove("enter-land");
      setMood(K, s, mood, o.hold);
    }, K.land);
  } else setMood(K, s, mood, o.hold);
  return s;
}
function cell(k, label, replay) {
  const f = $("figure", "kv-cell");
  f.append(k, $("figcaption", "", label));
  if (replay) {
    f.title = "Click to replay";
    f.onclick = replay;
  }
  return f;
}
function row(title, cells) {
  const r = $("section", "kv-row"), c = $("div", "kv-cells");
  c.append(...cells);
  r.append($("h3", "", title), c);
  return r;
}
var talkMs = (text) => Math.max(900, Math.min(4200, 500 + text.length * 55));
function narratorWindow(K, d) {
  const w = $("span", "kv-win"), art = $("span", "kv-head");
  w.style.cssText = `width:${d}px;height:${d}px`;
  art.setAttribute("role", "img");
  art.setAttribute("aria-label", "Kerim");
  art.innerHTML = K.head;
  w.append(art);
  w.onclick = () => {
    clearTimeout(timers.get(art));
    art.classList.add("talk");
    timers.set(art, setTimeout(() => art.classList.remove("talk"), talkMs("Yava\u015F yava\u015F, ad\u0131m ad\u0131m.")));
  };
  w.title = "Click: she talks";
  return w;
}
var pathOf = (d) => {
  const p = new Path();
  p.cmds = d.map((c) => [...c]);
  return p;
};
function shapes(s) {
  const path = pathOf(s.d), op = s.opacity === void 0 ? {} : { opacity: s.opacity };
  const fill = s.fill ? [{ path, fill: s.fill, flat: true, ...op }] : [];
  const stroke = s.stroke ? [{ path, stroke: { color: s.stroke, width: s.width ?? 1, ...s.cap ? { cap: s.cap } : {}, ...s.dash ? { dash: s.dash } : {} }, flat: true, ...op }] : [];
  return s.under ? [...stroke, ...fill] : [...fill, ...stroke];
}
function converted(size, flying = false) {
  const swap = { "wing.fold": "wing.spread", tail: "tail@fan" };
  const drop = /* @__PURE__ */ new Set(["legs", "head.eye.calm", "head.eye2.calm"]);
  const ids = KERIM_PARTS.filter((p) => !p.hidden).map((p) => p.id).flatMap((id) => !flying ? [id] : drop.has(id) ? [] : id === "wingFar" ? [] : id === "body" ? ["wingFar", id] : [swap[id] ?? id]);
  const by = new Map(KERIM_PARTS.map((p) => [p.id, p]));
  const g = { edge: 0, shapes: ids.flatMap((id) => by.get(id).shapes.flatMap(shapes)) };
  const el = $("span", "kerim");
  el.style.cssText = `width:${size}px;height:${size}px`;
  el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><g${SVG_BASE}>${groupSvg(g, { id: `kvg${size}${flying ? "f" : ""}_`, tiles: /* @__PURE__ */ new Map(), base: true })}</g></svg>`;
  return el;
}
function panel(K, theme) {
  const p = $("div", `kv-panel kv-${theme}`);
  const mood = (m, size, o = {}) => {
    const k = pup(K, m, size, { ...o, hold: true });
    return cell(k, m, () => setMood(K, k, m));
  };
  p.append($("h2", "", theme === "light" ? "The app, light (#FFF8EC)" : "The app, dark (#191A12)"));
  p.append(row("Perched, at the app's sizes", [cell(pup(K, "idle", 130, { pose: "hero" }), "hero 130"), ...[96, 88, 64, 44, 30].map((n) => cell(pup(K, "idle", n), `${n}`))]));
  p.append(row("Head crop (app bar, gate, lines)", [96, 64, 44, 34, 30, 16].map((n) => cell(pup(K, "idle", n, { pose: "head" }), `${n}`))));
  p.append(row("Moods, held (click one to replay it as the app does)", K.moods.map((m) => mood(m, 96))));
  p.append(row("Moods on the head", K.moods.map((m) => mood(m, 64, { pose: "head" }))));
  p.append(row("Moods at 44", K.moods.map((m) => mood(m, 44))));
  const talk = pup(K, "idle", 96), talkHead = pup(K, "idle", 64, { pose: "head" });
  talk.classList.add("talk");
  talkHead.classList.add("talk");
  const land = () => {
    const k = pup(K, "happy", 96, { enter: true });
    const c = cell(k, "landing (click)", () => c.replaceWith(land()));
    return c;
  };
  p.append(row("Poses", [cell(pup(K, "happy", 96, { pose: "flying" }), "flying"), cell(talk, "talk"), cell(talkHead, "talk, head"), land()]));
  p.append(row("The stage's converted copy beside the app's own", [
    cell(pup(K, "idle", 96, { hold: true }), "app 96"),
    cell(converted(96), "stage 96"),
    cell(pup(K, "idle", 44, { hold: true }), "app 44"),
    cell(converted(44), "stage 44"),
    cell(pup(K, "happy", 96, { pose: "flying", hold: true }), "app flying"),
    cell(converted(96, true), "stage flying")
  ]));
  p.append(row("Narrator window on the stage (click: she talks)", [100, 64, 40].map((n) => cell(narratorWindow(K, n), `${n}`))));
  return p;
}

// src/kit/kerim.ts
var SHOWS = Object.fromEntries(Object.entries(EMO).reverse().map(([emo, mood]) => [mood, emo]));
var kindOf = (place, name, m) => name === place.perch ? "perch" : m.air ? m.pace ? "pace" : "air" : m.door ? "door" : (m.y ?? 0) > 0 ? "high" : "ground";
var SYM = { perch: "\u2605", air: "\u25CC", pace: "\xBB", door: "\u21E5", high: "\u25B4", ground: "\u25CF" };
async function render(host, ctx) {
  css("kerim-stage", `.kv-stage { position: relative; }`);
  const [places, K] = await Promise.all([ctx.data("places").catch(() => []), ctx.data("kerim").catch(() => null)]);
  const moods = Object.keys(MOODS), gestures = Object.keys(BIRD_GESTURES);
  host.append(
    $("h1", "", "Kerim"),
    $("p", "note", `The kumru: her puppet on the stage (sahne-kit/kerim, the bird rig: ${moods.length} moods, ${gestures.length} gestures of her own, flight), and the app's own art and CSS below it. She is one drawing in both: the stage's copy is converted from the app's art, so the two should match line for line. Each kit emotion is worn as one of her moods. People's gestures and faces are on `)
  );
  host.lastElementChild.append(link("Gestures and faces", "#/kit/gestures"), ".");
  if (ctx.settings.motion === "still") host.classList.add("kv-still");
  ctx.onSettings((s) => host.classList.toggle("kv-still", s.motion === "still"));
  ctx.cleanup(() => host.classList.remove("kv-still"));
  const withPerch = places.filter((p) => p.perch || Object.values(p.marks).some((m) => (m.y ?? 0) > 0));
  const q = ctx.route.query;
  let place = withPerch.find((p) => p.id === q.get("place")) ?? withPerch.find((p) => p.id === "bakkal") ?? withPerch[0];
  host.append(head("On the stage", `She starts on the place's perch (\u2605). Each mark over the stage flies her there: \u25CC a spot in the air, where she hovers; \xBB one beside something moving, which she flies along with; \u25B4 somewhere up high to sit; \u25CF the floor, where people stand; \u21E5 a door. Watch the take-off and landing, the wingbeats, her shadow on a ledge (none in the air), and the camera following her (turn "follow" off to hold the wide shot; where her perch is above the wide shot, the stage starts on her alone).`, "\xA76.3 \xA75.4"));
  if (!place) {
    host.append($("p", "note bad", "No place document has a perch."));
  }
  let stage = null, follow = q.get("cam") !== "wide";
  const box = frame("16 / 9", "kv-stage"), layer = $("div", "marks"), marksRow = bar("fly to"), now = $("p", "note");
  if (place) {
    box.append(layer);
    host.append(
      bar(
        "place",
        select("", withPerch.map((p) => [p.id, `${p.name?.en ?? p.id} (${p.id})`]), place.id, (v) => {
          place = withPerch.find((p) => p.id === v);
          ctx.setQuery({ place: v });
          load();
        }),
        toggle("follow", follow, (on) => {
          follow = on;
          ctx.setQuery({ cam: on ? null : "wide" });
        }, "the camera follows her flight; off, it holds the wide shot"),
        button("wide", () => stage?.act({ beat: { cam: "wide" } })),
        button("close", () => stage?.act({ beat: { who: "kerim", cam: "close" } })),
        button("home", () => place && fly(place.perch ?? perchOf(place)))
      ),
      box,
      marksRow,
      now
    );
    stage = ctx.mount(box, { bubbles: false });
  }
  const perchOf = (p) => p.perch ?? Object.keys(p.marks).find((k2) => (p.marks[k2].y ?? 0) > 0) ?? Object.keys(p.marks)[0];
  const fly = (to) => {
    now.textContent = `flying to ${to}`;
    return stage?.act({ beat: { who: "kerim", move: { who: "kerim", to, how: "fly" }, cam: follow ? "follow" : "wide" } });
  };
  let pins = [];
  const load = () => {
    if (!stage || !place) return;
    const box2 = wideBox(place), m = place.marks[perchOf(place)], inWide = !m || (m.y ?? 0) <= box2.y1 && m.x >= box2.x0 && m.x <= box2.x1;
    stage.load({ v: 1, cues: [{ scene: { place: place.id, at: { kerim: perchOf(place) }, cam: inWide ? "wide" : "single" } }] }, { cast: { kerim: { puppet: "bird" } }, places: { [place.id]: place } });
    stage.show(0);
    now.textContent = `on ${perchOf(place)}`;
    layer.replaceChildren();
    marksRow.replaceChildren(Object.assign($("b", "", "fly to")));
    pins = Object.entries(place.marks).map(([name, m2]) => {
      const kind = kindOf(place, name, m2), label = `${SYM[kind]} ${name}`, title = `${kind} mark ${name} (${m2.x}, ${m2.y ?? 0}, ${m2.z})`;
      const pin = button(label, () => fly(name), void 0, title);
      pin.className = `pin ${kind}`;
      layer.append(pin);
      marksRow.append(button(label, () => fly(name), void 0, title));
      return { pin, p: [m2.x, m2.y ?? 0, m2.z] };
    });
  };
  if (stage) {
    ctx.cleanup(stage.onFrame(() => {
      for (const { pin, p } of pins) {
        const at = stage.project(p);
        pin.hidden = !at;
        if (at) {
          pin.style.left = `${at[0]}px`;
          pin.style.top = `${at[1]}px`;
        }
      }
    }));
    load();
    const moodRow = choice("mood", moods, "idle", (m) => {
      now.textContent = `${m} (the kit's ${SHOWS[m] ?? "neutral"})`;
      stage.act({ beat: { who: "kerim", emo: SHOWS[m] ?? "neutral", cam: "single" } });
    });
    for (const b of moodRow.querySelectorAll("button")) b.title = `worn for the kit's emotions ${Object.entries(EMO).filter(([, v]) => v === b.dataset.v).map(([k2]) => k2).join(", ")}`;
    const gRow = bar("gesture", ...gestures.map((g) => button(g, () => {
      now.textContent = g;
      const def = BIRD_GESTURES[g];
      stage.act({ beat: { who: "kerim", do: g, at: def.needs?.includes("target") ? "viewer" : void 0, n: def.keys.some((k2) => k2.shape === "count") || g === "count" ? 3 : void 0, cam: "single" } });
    }, void 0, `${BIRD_GESTURES[g].dur} ms${BIRD_GESTURES[g].needs?.length ? `, needs ${BIRD_GESTURES[g].needs.join(", ")}` : ""}`)));
    let tour = 0;
    const playTour = async () => {
      if (!place) return;
      const me = ++tour, p = place, marks = Object.entries(p.marks);
      const air = marks.filter(([, m]) => m.air).map(([n]) => n), high = marks.filter(([n, m]) => !m.air && (m.y ?? 0) > 0 && n !== perchOf(p)).map(([n]) => n);
      const cues = [
        ...moods.filter((m) => m !== "idle").map((m) => [m, { beat: { who: "kerim", emo: SHOWS[m] ?? m, wait: 1600, cam: "single" } }]),
        ["idle", { beat: { who: "kerim", emo: "neutral", wait: 400 } }],
        ...gestures.map((g) => [g, { beat: { who: "kerim", do: g, at: BIRD_GESTURES[g].needs?.includes("target") ? "viewer" : void 0, n: g === "count" ? 3 : void 0, wait: 400, cam: "single" } }]),
        ...[...air.slice(0, 2), ...high.slice(0, 1)].map((to) => [`fly to ${to}`, { beat: { who: "kerim", move: { who: "kerim", to, how: "fly" }, cam: "follow", wait: air.includes(to) ? 1500 : 300 } }]),
        ["home", { beat: { who: "kerim", move: { who: "kerim", to: perchOf(p), how: "fly" }, cam: "wide" } }]
      ];
      load();
      for (const [label, c] of cues) {
        if (me !== tour || !stage) return;
        now.textContent = `tour: ${label}`;
        await stage.act(c).done;
      }
    };
    ctx.cleanup(() => {
      tour++;
    });
    host.append(moodRow, gRow, bar("", button("\u25B6 the tour", () => void playTour(), void 0, "every mood, every gesture, a flight to the air marks and a high one, and home"), button("\u25A0", () => {
      tour++;
      load();
    })));
  }
  const k = kerim(ctx.kit);
  const still = (emo, flying) => {
    const out = k.pose({ bones: k.bones, body: k.body, defs: k.gestures, gestures: [], emo, ...flying ? { air: true } : {}, idle: { t: 0, seed: "kerim", amount: 0 } });
    const el = $("span", "kv-svg");
    el.style.cssText = "width:96px;height:96px";
    el.innerHTML = renderSvg(k, ctx.kit, { framing: "full", pose: out.pose, alt: out.alt, size: 96, idPrefix: `kvs-${emo}-${flying ? "f" : "p"}-` });
    return el;
  };
  const stills = $("div", "kv-panel kv-light");
  stills.append(
    row("Perched", moods.map((m) => cell(still(SHOWS[m] ?? "neutral", false), m, () => stage?.act({ beat: { who: "kerim", emo: SHOWS[m] ?? "neutral", cam: "single" } })))),
    row("Flying", moods.map((m) => cell(still(SHOWS[m] ?? "neutral", true), m)))
  );
  host.append(head("Her moods as stills", "The same puppet drawn by the SVG backend (renderSvg), as lists and the app's Still motion show her. Tap a perched one to wear it on the stage.", "\xA76.3"), stills);
  host.append(head("In the app", "Her art and her CSS (sahne-kit/kerim.css), as an app draws her, on its light and dark backgrounds, beside the stage's converted copy. Cheer and greet are one-shot moods: held here, and a click replays them as the app does, settling to happy. Read from the app on every load: reload after changing her art or CSS."));
  if (!K) {
    host.append($("p", "note bad", "The app's Kerim page data did not load (/data/kerim.json)."));
    return;
  }
  kerimCss(K);
  host.append(panel(K, "light"), panel(K, "dark"));
}
export {
  render
};
//# sourceMappingURL=kerim-AEECAPOH.js.map
