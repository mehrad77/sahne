import {
  EMOTIONS
} from "./chunk-MK75BOA5.js";
import "./chunk-6IX3XYSS.js";
import {
  BAKKAL,
  ISMAIL,
  NIMA
} from "./chunk-VFMRH5SO.js";
import {
  bench
} from "./chunk-ZRNRQOB7.js";
import "./chunk-J3KVAIQI.js";
import {
  $,
  bar,
  button,
  choice,
  select,
  toggle
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/actors.ts
var WARDROBE = {
  nima: { coat: { ...NIMA, outfit: { ...NIMA.outfit, outer: { id: "outer_coat_parka", colors: ["fab_07", "fab_02"] } }, wear: { hat: { id: "hat_beanie", colors: ["fab_21"] } } } },
  ismail: { coat: { ...ISMAIL, outfit: { ...ISMAIL.outfit, outer: { id: "outer_coat_long", colors: ["fab_24", "fab_20"] } }, wear: {} } }
};
function build(host, ctx) {
  host.append($("p", "note", "Pick who acts, then play. Each button is a beat or a line for them (the cue shows under the stage). The camera frames them alone (single) unless you pick another framing."));
  const cols = $("div", "cols"), stageCol = $("div"), side = $("div");
  const top = (document.querySelector(".topbar")?.getBoundingClientRect().height ?? 56) + 8;
  stageCol.style.cssText = `position:sticky;top:${top}px;z-index:1`;
  cols.append(stageCol, side);
  host.append(cols);
  const shop = bench(stageCol, ctx, {
    places: [BAKKAL],
    cast: { ismail: ISMAIL, nima: NIMA },
    cues: [{ scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "customer" } } }],
    load: { wardrobe: WARDROBE }
  });
  let who = "nima", cam = "single";
  const other = () => who === "nima" ? "ismail" : "nima";
  const beat = (s) => ({ beat: { who, cam, ...s } });
  const line = (text, s = {}) => ({ line: { who, text, cam, ...s } });
  const c = (label, f, title) => shop.cue(label, f, title);
  side.append(
    choice("who", ["nima", "ismail"], "nima", (o) => {
      who = o;
      shop.play({ beat: { who, cam } });
    }, { nima: "Nima", ismail: "\u0130smail" }),
    choice("frame", ["single", "close", "wide"], "single", (o) => {
      cam = o;
      shop.play({ beat: { who, cam } });
    }),
    $("h2", "", "Emotions: emo"),
    $("p", "note", "An emotion is a face preset (eyes, lids, brows, mouth, a blush, a sweat drop, tears) plus a head tilt and a posture. It lasts two cues, then fades back to the character's resting mood."),
    bar("emo", ...Object.keys(EMOTIONS).map((e) => c(e, () => beat({ emo: e }))))
  );
  const gestures = Object.keys(ctx.kit.gestures).sort();
  let g = "point", at = "obj:ekmek", n = 0, loop = false;
  const targets = () => ["(none)", "obj:ekmek", "obj:simit", "obj:sut", "obj:kasa", "mark:shelf", "mark:door", `ch:${other()}`, `ch:${other()}.head`, "viewer"];
  side.append(
    $("h2", "", "Gestures: do, at, n, loop"),
    $("p", "note", "Gestures are keyframed poses on the upper body, layered over the stance; a hand travels on an arc and the head leads. at aims it (and the eyes); n counts on the fingers (count, n 1\u20135); loop repeats its middle while the cue is on screen (think, wave, clap, knit \u2026)."),
    bar(
      "do",
      select("", gestures, g, (v) => {
        g = v;
      }),
      select("at", targets(), at, (v) => {
        at = v;
      }),
      select("n", ["0", "1", "2", "3", "4", "5"], "0", (v) => {
        n = +v;
      }),
      toggle("loop", false, (on) => {
        loop = on;
      }),
      c("do it", () => beat({ do: g, at: at === "(none)" ? void 0 : at.replace(/^ch:(ismail|nima)/, () => `ch:${other()}`), n: n || void 0, loop: loop || void 0 }))
    ),
    $("p", "note", "Hand shapes switch with the gesture: open, relaxed, point, fist, hold, pinch, wave, thumb, and one to five fingers for counting."),
    bar(
      "hands",
      ...[1, 2, 3, 4, 5].map((k) => c(`count ${k}`, () => beat({ do: "count", n: k }))),
      c("wave", () => beat({ do: "wave" })),
      c("pinch (type)", () => beat({ do: "type" })),
      c("stop", () => beat({ do: "stop" })),
      c("hold up", () => beat({ do: "hold_up" })),
      c("think (loop)", () => beat({ do: "think", loop: true }))
    ),
    $("p", "note", "Reaching is two-bone IK in the puppet's plane: a thing in reach is never pointed past (the hand comes from just above it, the finger ends on it); a far one is pointed at across the room; a body part is a target too."),
    bar(
      "reach",
      c("the bread (near)", () => beat({ do: "point", at: "obj:ekmek" })),
      c("the milk (far)", () => beat({ do: "point", at: "obj:sut" })),
      c("the door", () => beat({ do: "point_far", at: "mark:door" })),
      c("the other's head", () => beat({ do: "point", at: `ch:${other()}.head` })),
      c("us", () => beat({ do: "point", at: "viewer" })),
      c("look at the shelf", () => beat({ do: "look", at: "mark:shelf" }))
    )
  );
  side.append(
    $("h2", "", "The mouth"),
    $("p", "note", "Eight mouth shapes (rest MBP A E I O U FV) timed from the spelling by the Turkish plugin, about 200 ms a vowel, pausing at commas. The mouth blends with the emotion's, so a sad line still looks sad; a whisper moves it less; mouthing moves the lips with no voice and no bubble words. Framed close to see it."),
    bar(
      "say",
      c("Merhaba, ekmek var m\u0131?", () => line("Merhaba, ekmek var m\u0131?", { cam: "close" })),
      c("\u2026sadly", () => line("S\xFCt yok mu? Hi\xE7 yok mu?", { cam: "close", emo: "sad" })),
      c("\u2026happily", () => line("Ooo, \xE7ok g\xFCzel!", { cam: "close", emo: "happy" })),
      c("whisper", () => line("\xC7ok pahal\u0131\u2026", { cam: "close", voice: "whisper" })),
      c("mouthing", () => line("Te\u015Fekk\xFCrler!", { cam: "close", voice: "mouthing" }))
    )
  );
  const turn = (label, yaw) => button(label, () => {
    shop.note(`stage.turnTo("${who}", ${yaw().toFixed(2)}): a gallery control, not a script field`);
    shop.stage.turnTo(who, yaw());
  });
  side.append(
    $("h2", "", "Turning is a paper flip"),
    $("p", "note", "The puppet's plane turns about its vertical axis; past 90\xB0 the front pieces give way to the back pieces (with a paper sound). Up to about \xB130\xB0 the paper shows in perspective and stands in for a three-quarter view; facing someone in conversation is up to \xB135\xB0. Walking into depth flips to the back."),
    bar(
      "turn",
      turn("back", () => Math.PI),
      turn("three-quarter left", () => -0.5),
      turn("front", () => 0),
      turn("three-quarter right", () => 0.5),
      c("walk to the door", () => ({ beat: { cam: "wide", move: { who, to: "door", how: "walk" } } })),
      c("and back", () => ({ beat: { cam: "wide", move: { who, to: who === "nima" ? "customer" : "counter", how: "walk" } } }))
    ),
    $("p", "note", "Idle life: breathing, blinks (one on every head turn), a little sway and settling springs, seeded per actor and cue so seeking is exact. It stops after 20 s with no input or new cue, and whenever the stage is hidden or off screen; any input wakes it. Calm and Still (top bar) quieten it."),
    bar("idle", button("wake", () => {
      shop.note("stage.poke(): input happened, idle life wakes up");
      shop.stage.poke();
    }))
  );
  side.append(
    $("h2", "", "A change of clothes: costume"),
    $("p", "note", `The wardrobe (LoadOptions.wardrobe) holds each actor's other clothes, composed on their own body, face and hair. costume dresses them at once as the cue starts (after any walk on), in every motion setting; "" is the cast document again. Clothes stay on across scenes.`),
    bar(
      "costume",
      c("coat on", () => beat({ costume: { [who]: "coat" } })),
      c("coat off", () => beat({ costume: { [who]: "" } })),
      c("coat on as they leave", () => ({ line: { who, text: "Ho\u015F\xE7a kal\u0131n!", do: "wave", costume: { [who]: "coat" }, cam: "wide" } }))
    )
  );
}
export {
  build
};
//# sourceMappingURL=actors-MFFW2ILC.js.map
