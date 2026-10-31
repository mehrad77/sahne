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
  button
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/camera.ts
var OPEN = { scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "customer", kerim: "ledge" } } };
function build(host, ctx) {
  const cast = { ismail: ISMAIL, nima: NIMA, kerim: { puppet: "bird" } };
  host.append($("h2", "", "The framings"), $("p", "note", "Framings are worked out from where the actors will stand when the cue ends, so the camera never drifts: wide fits the back of the set; two frames the speaker and the addressee from the waist up; single one of them; close the head. obj adds a prop to whoever acts on it. A change of shot eases over at most 450 ms (it cuts under Still, and when the place changes)."));
  const shop = bench(host, ctx, { places: [BAKKAL], cast, cues: [OPEN] });
  const c = shop.cue;
  host.append(
    bar(
      "framing",
      c("wide", { beat: { cam: "wide" } }),
      c("two", { line: { who: "ismail", to: "nima", text: "Buyrun.", cam: "two" } }),
      c("single \u0130smail", { beat: { who: "ismail", cam: "single" } }),
      c("single Nima", { beat: { who: "nima", cam: "single" } }),
      c("close \u0130smail", { beat: { who: "ismail", cam: "close" } }),
      c("close Nima", { beat: { who: "nima", cam: "close" } }),
      c("single Kerim", { beat: { who: "kerim", cam: "single" } })
    ),
    bar(
      "obj",
      c("obj: the simit", { beat: { who: "ismail", do: "point", at: "obj:simit", cam: "obj" } }),
      c("obj: the milk", { beat: { who: "nima", do: "look", at: "obj:sut", cam: "obj" } }),
      c("obj: the till", { beat: { who: "ismail", do: "point", at: "obj:kasa", cam: "obj" } })
    ),
    $("p", "note", "follow: a frame round the actor's live position, eased towards it every frame (cut under Still). Nima walks to the door and back; Kerim flies from her ledge into the air spot and home."),
    bar(
      "follow",
      c("follow Nima to the door", { beat: { who: "nima", cam: "follow", move: { who: "nima", to: "door", how: "walk" } } }),
      c("follow Nima back", { beat: { who: "nima", cam: "follow", move: { who: "nima", to: "customer", how: "walk" } } }),
      c("follow Kerim up", { beat: { who: "kerim", cam: "follow", move: { who: "kerim", to: "air", how: "fly" } } }),
      c("follow Kerim home", { beat: { who: "kerim", cam: "follow", move: { who: "kerim", to: "ledge", how: "fly" } } })
    ),
    $("p", "note", "Typed, not built yet: ots (over the learner's shoulder), split (a second viewport, for a call) and photo (a freeze-frame with a shutter). The director accepts them; each is framed as a plain bust of the speaker for now."),
    bar(
      "typed",
      c("ots", { line: { who: "ismail", to: "nima", text: "Ba\u015Fka bir \u015Fey?", cam: "ots" } }),
      c("split", { line: { who: "nima", text: "Alo?", via: "video", cam: "split" } }),
      c("photo", { beat: { who: "nima", do: "photo", cam: "photo" } })
    ),
    $("p", "note", "Depth of field is a mipmap bias by distance from the focus plane: in a close, the shelves behind soften. The haze thickens with depth and with the time (dusk and night more than day)."),
    bar(
      "depth",
      c("close by day", { beat: { who: "nima", cam: "close", env: "time:day" } }),
      c("close at dusk", { beat: { who: "nima", cam: "close", env: "time:dusk" } }),
      c("wide at night", { beat: { cam: "wide", env: "time:night" } }),
      c("wide by day", { beat: { cam: "wide", env: "time:day" } })
    )
  );
  host.append($("h2", "", "Headroom for the bubbles"), $("p", "note", "With bubbles over the stage (theatre mode), a shot keeps room above the heads so a line sits over its speaker: 38 cm in a single or two, 20 cm in a close. Without them (log mode, where the app shows the lines) the frame comes down to the heads."));
  const pair = $("div");
  pair.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:10px";
  const sides = [true, false].map((on) => {
    const col = $("div");
    col.append($("b", "", on ? "bubbles on" : "bubbles off (log mode)"));
    pair.append(col);
    return bench(col, ctx, { places: [BAKKAL], cast: { ismail: ISMAIL, nima: NIMA }, cues: [{ scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "customer" } } }], stage: { bubbles: on } });
  });
  host.append(pair);
  const both = (cue) => {
    for (const s of sides) {
      s.stage.show(0);
      s.play(cue);
    }
  };
  host.append(bar(
    "line",
    button("a line in a single", () => both({ line: { who: "nima", text: "Ekmek var m\u0131?", cam: "single" } })),
    button("a line in a two", () => both({ line: { who: "ismail", to: "nima", text: "Var, buyrun.", cam: "two" } })),
    button("a line in a close", () => both({ line: { who: "nima", text: "Te\u015Fekk\xFCrler!", cam: "close" } }))
  ));
}
export {
  build
};
//# sourceMappingURL=camera-R3YU4WDA.js.map
