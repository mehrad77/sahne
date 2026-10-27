// The sound engine (DESIGN.md §8.1, §8.4, §8.5): the four buses and their volumes, ducking under a
// line (music silent, ambience at about half), the browser's voice speaking a line with the speech
// clock holding the stage to it (mouths stay on the words), the script's sfx with their sound words
// as captions, and a place's ambience crossfading at a change of place, with the rain's bed joining.
// Sound starts only once it is turned on in the top bar (browsers start audio only after a tap).

import { browserVoice, WEATHER, type Bus, type Cue } from "sahne";
import { K_HEAD_VB, K_BUST, K_HEAD } from "sahne-kit/kerim/art";
import { $, bar, button, slider } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { BAKKAL, ISMAIL, NIMA, VOICES } from "../bakkal.ts";
import { kerimPortrait, kerimOnTalk } from "../kerim.ts";
import { bench, BENCH_STREET, BENCH_SHORE } from "./bench.ts";

const BUSES: Bus[] = ["voice", "fx", "ambience", "music"];

export function build(host: HTMLElement, ctx: Ctx) {
  const warn = $("p", "card");
  const sound = () => { warn.textContent = ctx.settings.sound ? "Sound is on (top bar). Everything below plays." : "Sound is off: press “sound” in the top bar first. Browsers start audio only after a tap, and the engine keeps sound off until the learner turns it on. While it is off, the sound words show as bubbles instead."; };
  sound(); ctx.onSettings(sound);
  host.append(warn);

  const voice = browserVoice();
  const kerim = kerimPortrait({ vb: K_HEAD_VB, bust: K_BUST, head: K_HEAD });
  const inShop: Cue = { scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "customer" } } };
  const street: Cue = { scene: { place: "bench_street", time: "day", at: {} } }, shore: Cue = { scene: { place: "bench_shore", time: "day", at: {} } };
  const shop = bench(host, ctx, {
    places: [BAKKAL, BENCH_STREET, BENCH_SHORE], cast: { ismail: ISMAIL, nima: NIMA },
    // every place is in the script, so its art is built (a scene played in a place the script never visits keeps the old picture)
    cues: [street, shore, inShop],
    stage: { voice },
    load: { narrator: "kerim", narratorEl: kerim, onNarratorTalk: kerimOnTalk(kerim), narratorSound: "coo", voices: VOICES, tempo: { ismail: 1.1 }, names: { ismail: "İsmail", nima: "Nima", kerim: "Kerim" } },
  });
  const st = shop.stage, audio = st.audio;
  // a gallery readout peeks at two private fields: the duck gains, and the voice holding the clock
  const peek = () => ({
    ducks: (audio as unknown as { ducks: Partial<Record<Bus, GainNode>> }).ducks,
    speech: (st as unknown as { speech: { clock: { waiting: boolean } | null } | null }).speech,
  });
  const read = $("pre", "log");
  let real0 = 0;
  const tick = () => {
    const p = st.perf, { ducks, speech } = peek(), line = p?.lines[0];
    const place = st.place, weather = p?.after.weather, bed = WEATHER[weather ?? ""]?.bed;
    read.textContent = [
      `sound ${st.soundOn ? "on" : "off"} · context ${audio.ctx?.state ?? "not opened"} · a Turkish voice here: ${voice.available("tr") ? "yes" : "no (lines are silent; mouths follow the estimate)"}`,
      `volumes  ${BUSES.map(b => `${b} ${audio.volumes[b].toFixed(2)}`).join("  ")}`,
      `ducking  music ×${(ducks.music?.gain.value ?? 1).toFixed(2)}  ambience ×${(ducks.ambience?.gain.value ?? 1).toFixed(2)}  ${speech ? "← a voice is speaking" : ""}`,
      line ? `line     “${line.text}”: estimated ${Math.round(line.t1 - line.t0)} ms · stage clock ${Math.round(st.now() - line.t0)} ms · real ${Math.round(performance.now() - real0)} ms · ${speech ? speech.clock?.waiting ? "waiting for the voice to start" : "the voice keeps the time" : "the plain clock"}` : "line     (none in this cue)",
      `beds     ${[...place?.ambience ?? [], ...(bed ? [bed] : [])].join(" + ") || "none"} (${place?.id ?? "-"}, ${weather ?? "clear"})`,
    ].join("\n");
  };
  const timer = setInterval(tick, 100);
  ctx.cleanup(() => clearInterval(timer));
  host.append(read);
  const line = (label: string, cue: Cue) => shop.cue(label, () => { real0 = performance.now(); return cue; });

  host.append($("h2", "", "Four buses"), $("p", "note", "Voice, effects, ambience and music each have a volume (setVolume). A voice at 0 is not spoken at all. The ambience is the place's loops; the music is a motif (the place's, at a change of place)."));
  host.append(
    bar("volume", ...BUSES.map(b => slider(b, 0, 1, 0.05, audio.volumes[b], v => st.setVolume(b, v), v => v.toFixed(2)))),
    bar("try a bus",
      line("voice: a line", { line: { who: "ismail", text: "Hoş geldiniz! Buyrun.", to: "nima", emo: "happy" } }),
      button("fx: the doorbell", () => audio.play("doorbell")), button("fx: a coin", () => audio.play("coin_clink")),
      button("music: Kerim's theme", () => audio.motif("kerim")), button("music: the street", () => audio.motif("street")),
      button("stop", () => audio.stopAll()),
    ),
  );

  host.append($("h2", "", "Ducking"), $("p", "note", "While a voice speaks, music goes silent and ambience goes down to about half, then they come back: the readout's ducking line. Start the music, then a line over it."));
  host.append(bar("try",
    button("music, then a line over it", () => { audio.motif("home"); setTimeout(() => { real0 = performance.now(); shop.play({ line: { who: "ismail", text: "Ekmek var, simit var, peynir de var.", to: "nima", do: "explain" } }); }, 900); }),
    line("Kerim (her coo first)", { line: { who: "kerim", text: "Yavaş yavaş…" } }),
  ));

  host.append($("h2", "", "The browser's voice and the speech clock"), $("p", "note", "Each character's rate and pitch (VOICES) and the cue's tempo go to the browser's speech. The performance is planned on the plugin's estimate of each word; while the line is voiced the stage's clock follows the voice instead: it waits at the start until the voice starts, then catches up at each word mark, so the mouth and the gesture stay on the words (compare the stage clock with real time in the readout). A whisper is quieter; mouthing and silent lines are not voiced."));
  host.append(bar("lines",
    line("İsmail", { line: { who: "ismail", text: "Ekmek var. Şu ekmek çok taze.", do: "point", at: "obj:ekmek" } }),
    line("İsmail, quickly", { line: { who: "ismail", text: "Başka bir şey?", tempo: 1.4, do: "explain" } }),
    line("Nima", { line: { who: "nima", text: "Ekmek var mı? Süt var mı?", emo: "curious" } }),
    line("Nima whispers", { line: { who: "nima", text: "Taze mi acaba?", voice: "whisper" } }),
    line("Nima mouths (silent)", { line: { who: "nima", text: "Teşekkürler.", voice: "mouthing" } }),
  ));

  host.append($("h2", "", "Sounds and their words"), $("p", "note", "A script's sfx plays at its cue time, panned towards where it comes from. Its word (the cue's, or the kit's own) is the caption: a bubble at the source while sound is off, or with captions on in the top bar. Steps, doors and the paper flip are automatic and have no bubbles."));
  host.append(bar("sfx",
    shop.cue("çın çın at the door", { beat: { sfx: { id: "doorbell", word: "çın çın", at: "mark:door" } } }),
    shop.cue("tik tak at the clock", { beat: { sfx: { id: "clock_tick", word: "tik tak", at: "mark:clock" } } }),
    shop.cue("a knock (the kit's word)", { beat: { sfx: { id: "knock", at: "mark:door" } } }),
    shop.cue("a meow", { beat: { sfx: { id: "meow", at: "mark:ledge" } } }),
    shop.cue("steps (automatic)", { beat: { move: { who: "nima", to: "front" } } }),
  ));

  host.append($("h2", "", "Ambience"), $("p", "note", "A place's ambience loops quietly while a scene is there and crossfades (about a second) at a change of place; the new place's motif plays as the story moves there. Rain brings its own bed on top of the place's."));
  host.append(bar("places",
    shop.cue("the bakkal (street far, fridge)", inShop),
    shop.cue("the street (traffic)", street),
    shop.cue("the shore (waves, crowd)", shore),
  ), bar("weather", shop.cue("rain", { beat: { env: "weather:rain" } }), shop.cue("clear", { beat: { env: "weather:clear" } })));
}
