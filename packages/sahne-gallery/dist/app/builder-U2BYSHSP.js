import {
  starterOffer
} from "./chunk-DDNHNEH6.js";
import "./chunk-6IX3XYSS.js";
import {
  $,
  choice,
  css
} from "./chunk-4TGKXDN4.js";
import {
  mountBuilder,
  serialize
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/kit/people/builder.ts
var WHO = ["starter", "everything", "author"];
var LANGS = ["en", "tr"];
var STARTS = ["default", "random", "hostile"];
var FRAMES = ["phone", "desktop"];
var PREVIEWS = ["stage", "still"];
var pick = (all, v, d) => all.find((x) => x === v) ?? d;
var HOSTILE = () => JSON.parse(JSON.stringify({
  v: 1,
  kit: "sahne-kit@1",
  ["__proto__"]: { polluted: true },
  body: { build: "giant", height: 99, shape: "<img src=x onerror=alert(1)>" },
  skin: "#FF0000",
  face: { shape: "oval", eyes: "javascript:alert(1)", marks: ["freckles", "freckles", "mole", "nope", "dimples", "scar", "x".repeat(300)] },
  hair: { style: "hair_does_not_exist", color: "url(evil)" },
  outfit: { top: { id: "top_tee", colors: ["#000000", "fab_01", "fab_02"], pattern: "pattern_nope" }, bottom: "apron_pockets", dress: { id: "dress_midi" } },
  wear: { waist: { id: "apron_pockets" }, eyes: { id: "glasses_round", side: "z" } },
  custom: [{ id: "apron_pockets" }, { id: "top_tee" }, { id: "x" }],
  padding: "x".repeat(6e3)
}));
function builder(host, ctx) {
  css("people-builder", `
.bld-work { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; margin-top: 10px; }
.bld-frame { border: 1px solid var(--line); border-radius: 18px; overflow: hidden; max-width: 100%; }
.bld-frame.phone { width: 375px; height: 720px; }
.bld-frame.desktop { width: 100%; height: 680px; }
.bld-out { flex: 1 1 280px; min-width: 0; }
.bld-status { color: var(--mute); font: 12px ui-monospace, monospace; margin: 0 0 6px; }
.bld-json { margin: 0; padding: 10px; background: var(--chip); border: 1px solid var(--line); border-radius: 12px; font: 11.5px/1.45 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 560px; overflow: auto; }
`);
  const kit = ctx.kit, q = ctx.route.query;
  const S = {
    who: pick(WHO, q.get("who"), "starter"),
    lang: pick(LANGS, q.get("lang"), "en"),
    unlock: q.get("unlock") === "1",
    start: pick(STARTS, q.get("start"), "default"),
    frame: pick(FRAMES, q.get("frame"), "phone"),
    preview: pick(PREVIEWS, q.get("preview"), "stage")
  };
  const save = () => ctx.setQuery({
    who: S.who === "starter" ? null : S.who,
    lang: S.lang === "en" ? null : S.lang,
    unlock: S.unlock ? "1" : null,
    start: S.start === "default" ? null : S.start,
    frame: S.frame === "phone" ? null : S.frame,
    preview: S.preview === "stage" ? null : S.preview
  });
  const allUnlocks = () => {
    const t = /* @__PURE__ */ new Set();
    for (const p of Object.values(kit.parts)) if (p.unlock) t.add(p.unlock);
    for (const u of Object.values(kit.paletteUnlocks ?? {})) t.add(u);
    for (const p of Object.values(kit.patterns ?? {})) if (p.unlock) t.add(p.unlock);
    return [...t];
  };
  host.append(
    $("p", "note", `The engine's mountBuilder with the whole kit. A learner (starter) is offered a small sample per field through the host's offer, with "More" on; a learner (everything) every learner part; an author every part, the cast's own marked. Locked options show a lock and how they are earned; "unlock everything" opens them. A hostile document must load as a clean one. Theme and motion follow the top bar.`),
    choice("who", WHO, S.who, (v) => {
      S.who = v;
      save();
      mount();
    }, { starter: "learner (starter)", everything: "learner (everything open)", author: "author (all, cast too)" }),
    choice("language", LANGS, S.lang, (v) => {
      S.lang = v;
      save();
      ui?.setLang(v);
      show();
    }, { en: "English", tr: "T\xFCrk\xE7e" }),
    choice("unlocks", ["none", "all"], S.unlock ? "all" : "none", (v) => {
      S.unlock = v === "all";
      save();
      ui?.setUnlocked(S.unlock ? allUnlocks() : []);
    }, { none: "none", all: "unlock everything" }),
    choice("start", STARTS, S.start, (v) => {
      S.start = v;
      save();
      mount();
    }, { default: "the default", random: "a random seed", hostile: "a hostile document" }),
    choice("frame", FRAMES, S.frame, (v) => {
      S.frame = v;
      save();
      frame.className = `bld-frame ${v}`;
    }, { phone: "phone 375 \xD7 720", desktop: "desktop" }),
    choice("preview", PREVIEWS, S.preview, (v) => {
      S.preview = v;
      save();
      mount();
    }, { stage: "paper stage", still: "still SVG (no WebGL)" })
  );
  const work = $("div", "bld-work"), frame = $("div", `bld-frame ${S.frame}`), out = $("div", "bld-out"), status = $("div", "bld-status"), json = $("pre", "bld-json");
  out.append(status, json);
  work.append(frame, out);
  host.append(work);
  let ui = null;
  const bytes = (d) => new TextEncoder().encode(serialize(d)).length;
  function show(note = "") {
    if (!ui) return;
    const d = ui.doc;
    status.textContent = `${bytes(d)} bytes (limit 2048) \xB7 ${S.who} \xB7 preview: ${ui.stage ? "paper stage" : "still SVG"}${note ? " \xB7 " + note : ""}`;
    json.textContent = JSON.stringify(d, null, 1);
  }
  function mount() {
    ui?.destroy();
    ui = mountBuilder(frame, {
      kit,
      doc: S.start === "hostile" ? HOSTILE() : void 0,
      lang: S.lang,
      mode: S.who === "author" ? "author" : "learner",
      offer: S.who === "starter" ? starterOffer : void 0,
      more: S.who === "starter",
      unlocked: S.unlock ? allUnlocks() : [],
      theme: ctx.settings.theme,
      preview: S.preview,
      motion: ctx.settings.motion,
      unlockLabel: (t) => {
        const [kind, name] = t.split(":");
        if (kind === "story") return S.lang === "tr" ? `${name} b\xF6l\xFCm\xFCn\xFC bitirince a\xE7\u0131l\u0131r` : `Opens when you finish episode ${name}`;
        return S.lang === "tr" ? `\u201C${name}\u201D paketiyle a\xE7\u0131l\u0131r` : `Comes with the \u201C${name}\u201D bundle`;
      },
      onChange: () => show(),
      onDone: (d) => show(`Done: ${bytes(d)} bytes handed to the host`),
      onCancel: () => show("Cancelled")
    });
    if (S.start === "random") ui.builder.randomize(Math.floor(Math.random() * 1e6));
    show();
  }
  ctx.onSettings((s) => {
    ui?.setTheme(s.theme);
    ui?.setMotion(s.motion);
  });
  ctx.cleanup(() => {
    ui?.destroy();
    ui = null;
  });
  mount();
  window.builderUI = () => ui;
}
export {
  builder
};
//# sourceMappingURL=builder-U2BYSHSP.js.map
