import {
  K_BUST,
  K_HEAD,
  K_HEAD_VB,
  kerimOnTalk,
  kerimPortrait
} from "./chunk-GKR3PCTG.js";
import {
  BAKKAL,
  ISMAIL,
  NIMA,
  VOICES
} from "./chunk-VFMRH5SO.js";
import {
  bench
} from "./chunk-ZRNRQOB7.js";
import {
  BENCH_SHORE,
  BENCH_STREET
} from "./chunk-J3KVAIQI.js";
import {
  $,
  bar,
  button,
  slider
} from "./chunk-4TGKXDN4.js";
import {
  WEATHER,
  browserVoice
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/audio.ts
var BUSES = ["voice", "fx", "ambience", "music"];
function build(host, ctx) {
  const warn = $("p", "card");
  const sound = () => {
    warn.textContent = ctx.settings.sound ? "Sound is on (top bar). Everything below plays." : "Sound is off: press \u201Csound\u201D in the top bar first. Browsers start audio only after a tap, and the engine keeps sound off until the learner turns it on. While it is off, the sound words show as bubbles instead.";
  };
  sound();
  ctx.onSettings(sound);
  host.append(warn);
  const voice = browserVoice();
  const kerim = kerimPortrait({ vb: K_HEAD_VB, bust: K_BUST, head: K_HEAD });
  const inShop = { scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "customer" } } };
  const street = { scene: { place: "bench_street", time: "day", at: {} } }, shore = { scene: { place: "bench_shore", time: "day", at: {} } };
  const shop = bench(host, ctx, {
    places: [BAKKAL, BENCH_STREET, BENCH_SHORE],
    cast: { ismail: ISMAIL, nima: NIMA },
    // every place is in the script, so its art is built (a scene played in a place the script never visits keeps the old picture)
    cues: [street, shore, inShop],
    stage: { voice },
    load: { narrator: "kerim", narratorEl: kerim, onNarratorTalk: kerimOnTalk(kerim), narratorSound: "coo", voices: VOICES, tempo: { ismail: 1.1 }, names: { ismail: "\u0130smail", nima: "Nima", kerim: "Kerim" } }
  });
  const st = shop.stage, audio = st.audio;
  const peek = () => ({
    ducks: audio.ducks,
    speech: st.speech
  });
  const read = $("pre", "log");
  let real0 = 0;
  const tick = () => {
    const p = st.perf, { ducks, speech } = peek(), line2 = p?.lines[0];
    const place = st.place, weather = p?.after.weather, bed = WEATHER[weather ?? ""]?.bed;
    read.textContent = [
      `sound ${st.soundOn ? "on" : "off"} \xB7 context ${audio.ctx?.state ?? "not opened"} \xB7 a Turkish voice here: ${voice.available("tr") ? "yes" : "no (lines are silent; mouths follow the estimate)"}`,
      `volumes  ${BUSES.map((b) => `${b} ${audio.volumes[b].toFixed(2)}`).join("  ")}`,
      `ducking  music \xD7${(ducks.music?.gain.value ?? 1).toFixed(2)}  ambience \xD7${(ducks.ambience?.gain.value ?? 1).toFixed(2)}  ${speech ? "\u2190 a voice is speaking" : ""}`,
      line2 ? `line     \u201C${line2.text}\u201D: estimated ${Math.round(line2.t1 - line2.t0)} ms \xB7 stage clock ${Math.round(st.now() - line2.t0)} ms \xB7 real ${Math.round(performance.now() - real0)} ms \xB7 ${speech ? speech.clock?.waiting ? "waiting for the voice to start" : "the voice keeps the time" : "the plain clock"}` : "line     (none in this cue)",
      `beds     ${[...place?.ambience ?? [], ...bed ? [bed] : []].join(" + ") || "none"} (${place?.id ?? "-"}, ${weather ?? "clear"})`
    ].join("\n");
  };
  const timer = setInterval(tick, 100);
  ctx.cleanup(() => clearInterval(timer));
  host.append(read);
  const line = (label, cue) => shop.cue(label, () => {
    real0 = performance.now();
    return cue;
  });
  host.append($("h2", "", "Four buses"), $("p", "note", "Voice, effects, ambience and music each have a volume (setVolume). A voice at 0 is not spoken at all. The ambience is the place's loops; the music is a motif (the place's, at a change of place)."));
  host.append(
    bar("volume", ...BUSES.map((b) => slider(b, 0, 1, 0.05, audio.volumes[b], (v) => st.setVolume(b, v), (v) => v.toFixed(2)))),
    bar(
      "try a bus",
      line("voice: a line", { line: { who: "ismail", text: "Ho\u015F geldiniz! Buyrun.", to: "nima", emo: "happy" } }),
      button("fx: the doorbell", () => audio.play("doorbell")),
      button("fx: a coin", () => audio.play("coin_clink")),
      button("music: Kerim's theme", () => audio.motif("kerim")),
      button("music: the street", () => audio.motif("street")),
      button("stop", () => audio.stopAll())
    )
  );
  host.append($("h2", "", "Ducking"), $("p", "note", "While a voice speaks, music goes silent and ambience goes down to about half, then they come back: the readout's ducking line. Start the music, then a line over it."));
  host.append(bar(
    "try",
    button("music, then a line over it", () => {
      audio.motif("home");
      setTimeout(() => {
        real0 = performance.now();
        shop.play({ line: { who: "ismail", text: "Ekmek var, simit var, peynir de var.", to: "nima", do: "explain" } });
      }, 900);
    }),
    line("Kerim (her coo first)", { line: { who: "kerim", text: "Yava\u015F yava\u015F\u2026" } })
  ));
  host.append($("h2", "", "The browser's voice and the speech clock"), $("p", "note", "Each character's rate and pitch (VOICES) and the cue's tempo go to the browser's speech. The performance is planned on the plugin's estimate of each word; while the line is voiced the stage's clock follows the voice instead: it waits at the start until the voice starts, then catches up at each word mark, so the mouth and the gesture stay on the words (compare the stage clock with real time in the readout). A whisper is quieter; mouthing and silent lines are not voiced."));
  host.append(bar(
    "lines",
    line("\u0130smail", { line: { who: "ismail", text: "Ekmek var. \u015Eu ekmek \xE7ok taze.", do: "point", at: "obj:ekmek" } }),
    line("\u0130smail, quickly", { line: { who: "ismail", text: "Ba\u015Fka bir \u015Fey?", tempo: 1.4, do: "explain" } }),
    line("Nima", { line: { who: "nima", text: "Ekmek var m\u0131? S\xFCt var m\u0131?", emo: "curious" } }),
    line("Nima whispers", { line: { who: "nima", text: "Taze mi acaba?", voice: "whisper" } }),
    line("Nima mouths (silent)", { line: { who: "nima", text: "Te\u015Fekk\xFCrler.", voice: "mouthing" } })
  ));
  host.append($("h2", "", "Sounds and their words"), $("p", "note", "A script's sfx plays at its cue time, panned towards where it comes from. Its word (the cue's, or the kit's own) is the caption: a bubble at the source while sound is off, or with captions on in the top bar. Steps, doors and the paper flip are automatic and have no bubbles."));
  host.append(bar(
    "sfx",
    shop.cue("\xE7\u0131n \xE7\u0131n at the door", { beat: { sfx: { id: "doorbell", word: "\xE7\u0131n \xE7\u0131n", at: "mark:door" } } }),
    shop.cue("tik tak at the clock", { beat: { sfx: { id: "clock_tick", word: "tik tak", at: "mark:clock" } } }),
    shop.cue("a knock (the kit's word)", { beat: { sfx: { id: "knock", at: "mark:door" } } }),
    shop.cue("a meow", { beat: { sfx: { id: "meow", at: "mark:ledge" } } }),
    shop.cue("steps (automatic)", { beat: { move: { who: "nima", to: "front" } } })
  ));
  host.append($("h2", "", "Ambience"), $("p", "note", "A place's ambience loops quietly while a scene is there and crossfades (about a second) at a change of place; the new place's motif plays as the story moves there. Rain brings its own bed on top of the place's."));
  host.append(bar(
    "places",
    shop.cue("the bakkal (street far, fridge)", inShop),
    shop.cue("the street (traffic)", street),
    shop.cue("the shore (waves, crowd)", shore)
  ), bar("weather", shop.cue("rain", { beat: { env: "weather:rain" } }), shop.cue("clear", { beat: { env: "weather:clear" } })));
}
export {
  build
};
//# sourceMappingURL=audio-M6OUWTUV.js.map
