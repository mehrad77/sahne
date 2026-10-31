import {
  ISMAIL,
  NIMA
} from "./chunk-VFMRH5SO.js";
import {
  bench
} from "./chunk-ZRNRQOB7.js";
import {
  BENCH_CROWD,
  BENCH_ROOM,
  BENCH_STREET
} from "./chunk-J3KVAIQI.js";
import {
  $,
  bar,
  button,
  chip
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/perf.ts
var f1 = (x) => x.toFixed(1);
var med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
var raf = () => new Promise((r) => requestAnimationFrame(r));
var wait = (ms) => new Promise((r) => setTimeout(r, ms));
var pad = (n) => String(n).padStart(2, "0");
var g = (id, ...colors) => ({ id, colors });
function variant(i) {
  const pick = (a, k) => a[(i * k + (i >> 2)) % a.length];
  return {
    v: 1,
    kit: "sahne-kit@1",
    body: { build: ["adult", "adult", "adult", "elder", "child"][i * 3 % 5], height: i * 37 % 100 / 100, shape: ["slim", "average", "broad", "round"][i * 5 % 4] },
    skin: `skin_${pad(1 + i * 5 % 12)}`,
    face: { shape: ["oval", "round", "square", "long", "heart"][i % 5], eyes: ["round", "almond", "dot", "sleepy"][i % 4], mouth: ["wide", "small", "full"][i % 3] },
    hair: { style: pick(["hair_short", "hair_classic", "hair_buzz", "hair_bob", "hair_long", "hair_bun", "hair_curly", "hair_bald"], 3), color: `hair_${pad(1 + i * 3 % 10)}` },
    outfit: { top: g(pick(["top_tee", "top_shirt", "top_sweater", "top_blouse", "top_hoodie"], 2), `fab_${pad(1 + i * 7 % 24)}`), bottom: g(pick(["bottom_trousers", "bottom_jeans", "bottom_skirt_long"], 1), `fab_${pad(1 + i * 11 % 24)}`), shoes: g(pick(["shoes_sneakers", "shoes_leather", "shoes_flats"], 5)) },
    ...i % 3 === 0 ? { wear: { eyes: g("glasses_round") } } : {}
  };
}
var statLine = (st) => {
  const t = st.stats;
  return `frame ${t.frameMs} ms (pose ${t.poseMs} ms) \xB7 ${t.vertices} vertices \xB7 scene build (atlasMs) ${t.atlasMs} ms \xB7 ${t.layers} atlas layer(s) \xB7 ${f1(t.texKB / 1024)} MB textures \xB7 last look swap ${t.swapMs} ms (${t.swaps} swaps)`;
};
function build(host, ctx) {
  const every = (ms, f) => {
    const id2 = setInterval(f, ms);
    ctx.cleanup(() => clearInterval(id2));
  };
  host.append($("h2", "", "The stage's own numbers"), $("p", "note", "stage.stats, read twice a second. The crowd street runs its life (walkers, a queue, pigeons) at 30 frames a second, so frames keep coming while it lives (idle life stops 20 s after the last cue or tap, DESIGN.md \xA77: press a cue to wake it); the room at rest draws nothing once the actors settle: the frame time stops changing and the GPU is idle. A scene's build (atlasMs) is paid once, at load; the budget is \u2264 4 ms of CPU a frame and \u2264 150 ms a build on a mid-range phone."));
  const busy = bench(host, ctx, { places: [BENCH_CROWD, BENCH_ROOM], cast: { a: NIMA, b: ISMAIL }, cues: [{ scene: { place: "bench_crowd", time: "day", at: { a: "left", b: "mid" } } }] });
  const live = $("pre", "log");
  let last = "";
  every(500, () => {
    const k = `${busy.stage.stats.frameMs}|${busy.stage.stats.poseMs}`;
    live.textContent = `${k !== last ? "drawing" : "at rest (no new frame)"}
${statLine(busy.stage)}`;
    last = k;
  });
  host.append(live, bar(
    "try",
    busy.cue("crowd street", { scene: { place: "bench_crowd", time: "day", at: { a: "left", b: "mid" } } }),
    busy.cue("Nima walks across", { beat: { move: { who: "a", to: "right" } } }),
    busy.cue("rain", { beat: { env: "weather:rain" } }),
    busy.cue("night + fireworks", { beat: { env: ["time:night", "fireworks:6"] } }),
    busy.cue("\u0130smail waves", { beat: { who: "b", do: "wave" } }),
    busy.cue("the room (at rest)", { scene: { place: "bench_room", time: "day", at: { a: "mid" } } })
  ));
  host.append($("h2", "", "Stress runs on the studio"), $("p", "note", "The builder's preview: one actor alone (stage.studio). Swap 30: a new learner's look every frame; the build time is stats.swapMs. Scrub: 200 looks asked for in a second, of which only the last in each frame is built. Resize: the frame changes size every frame for 2 s. Lose and restore: the GPU takes the context and gives it back; the art is drawn again and the pose and mood carry on. Hide, then swap: a look asked for while the stage is off screen is taken at once and built when it shows again. Remount: destroy() gives the WebGL context back."));
  const sbox = $("div", "frame");
  sbox.style.cssText = "aspect-ratio:3/4;max-width:300px";
  const slog = $("pre", "log"), sread = $("pre", "log");
  host.append(sbox, sread, slog);
  const say = (t) => {
    slog.textContent = t;
  };
  say("Each stress run prints its result here.");
  let st, id = "me", loadMs = 0;
  const mountStudio = () => {
    const t = performance.now();
    st = ctx.mount(sbox, { bubbles: false, onContext: (lost) => say(lost ? "onContext(true): the context is gone (an app shows its SVG still now)" : "onContext(false): back, the look is drawn again by itself") });
    id = st.studio(NIMA, { framing: "full", trusted: true, label: "Nima" });
    loadMs = Math.round(performance.now() - t);
  };
  mountStudio();
  every(500, () => {
    sread.textContent = `first load ${loadMs} ms \xB7 ${statLine(st)}`;
  });
  let busyRun = false;
  const run = (label, f) => button(label, async () => {
    if (busyRun || !st.webgl) return;
    busyRun = true;
    say(`${label}\u2026`);
    try {
      say(await f());
    } finally {
      busyRun = false;
    }
  });
  host.append(bar(
    "stress",
    run("swap 30\xD7", async () => {
      const build2 = [], wall = [], gaps = [];
      let lastT = performance.now(), going = true;
      (async () => {
        while (going) {
          const t = await raf();
          gaps.push(t - lastT);
          lastT = t;
        }
      })();
      for (let i = 0; i < 30; i++) {
        const t = performance.now();
        await st.setAvatar(id, variant(i + 1));
        wall.push(performance.now() - t);
        build2.push(st.stats.swapMs);
        await raf();
      }
      going = false;
      return `30 swaps \xB7 build median ${f1(med(build2))} ms, worst ${f1(Math.max(...build2))} ms \xB7 call to screen median ${f1(med(wall))} ms, worst ${f1(Math.max(...wall))} ms \xB7 worst frame gap ${f1(Math.max(...gaps))} ms`;
    }),
    run("scrub 200 in 1 s", async () => {
      const before = st.stats.swaps, t = performance.now(), ps = [];
      for (let i = 0; i < 200; i++) {
        ps.push(st.setAvatar(id, variant(300 + i)));
        await wait(5);
      }
      await Promise.all(ps);
      return `200 looks asked for in ${Math.round(performance.now() - t)} ms \xB7 ${st.stats.swaps - before} built (the last in each frame wins)`;
    }),
    run("resize each frame", async () => {
      const w0 = sbox.offsetWidth, gaps = [], cost = [], t0 = performance.now();
      let lastT = t0;
      while (performance.now() - t0 < 2e3) {
        const t = await raf();
        gaps.push(t - lastT);
        lastT = t;
        sbox.style.width = Math.round(w0 * (0.55 + 0.45 * Math.abs(Math.cos((t - t0) / 600)))) + "px";
        cost.push(st.stats.frameMs);
      }
      sbox.style.width = "";
      return `resized every frame for 2 s \xB7 worst frame gap ${f1(Math.max(...gaps))} ms \xB7 frame median ${f1(med(cost))} ms, worst ${f1(Math.max(...cost))} ms`;
    }),
    run("lose + restore context", async () => {
      const ext = st.r.gl.getExtension("WEBGL_lose_context");
      if (!ext) return "no WEBGL_lose_context here";
      ext.loseContext();
      await wait(700);
      const lost = st.lost;
      ext.restoreContext();
      await wait(300);
      return `lost for 700 ms (stage.lost was ${lost}) \xB7 restored: stage.lost is ${st.lost}, the look came back by itself`;
    }),
    run("hide, then swap", async () => {
      const b = st.stats.swaps;
      sbox.style.display = "none";
      await wait(150);
      const shown = st.shown, t = performance.now();
      await st.setAvatar(id, variant(77));
      const took = performance.now() - t, hidden = st.stats.swaps - b;
      sbox.style.display = "";
      await wait(400);
      return `hidden (stage.shown ${shown}): the look was taken after ${f1(took)} ms, ${hidden} built while hidden \xB7 shown again: ${st.stats.swaps - b} built`;
    }),
    run("remount", async () => {
      ctx.unmount(st);
      sbox.replaceChildren();
      mountStudio();
      return `destroyed (its WebGL context given back) and mounted again in ${loadMs} ms`;
    }),
    button("Nima again", () => {
      void st.setAvatar(id, NIMA, { trusted: true });
    })
  ));
  host.append($("h2", "", "The atlas window: one place at a time"), $("p", "note", "A script of three places: a room, a street, a crowded square. The atlas holds the cast, the place on stage and the next place the script goes to, never the whole story. After a cut, the new window (this place and the one after) is drawn in idle time, about 8 ms a task, and swapped in when the cue is over; the place left behind is freed with the old atlas, so texture memory follows two places. A jump back to the room is drawn the same way. atlasMs is the whole scene's first build at load."));
  const cues = [
    { scene: { place: "bench_room", time: "day", at: { a: "mid" } } },
    { beat: { who: "a", do: "wave" } },
    { scene: { place: "bench_street", time: "day", at: { a: "mid" } } },
    { beat: { who: "a", do: "nod" } },
    { scene: { place: "bench_crowd", time: "dusk", at: { a: "mid" } } }
  ];
  const win = bench(host, ctx, { places: [BENCH_ROOM, BENCH_STREET, BENCH_CROWD], cast: { a: NIMA }, cues, show: 0 });
  const held = () => win.stage.stats.places.join(" + ") || "(none)";
  const wread = $("pre", "log");
  let asked = 0, was = held(), swapIn = "";
  every(100, () => {
    const now = held();
    if (now !== was) {
      swapIn = `the new window swapped in ${Math.round(performance.now() - asked)} ms after the cut`;
      was = now;
    }
    wread.textContent = `atlas holds: ${now}
${statLine(win.stage)}${swapIn ? `
${swapIn}` : ""}`;
  });
  const showAt = (i, label) => button(label, () => {
    asked = performance.now();
    swapIn = "";
    win.stage.show(i);
    win.note(`stage.show(${i}): ${JSON.stringify(cues[i])}`);
  });
  host.append(wread, bar(
    "cut to",
    showAt(0, "the room (cue 0)"),
    showAt(2, "the street (cue 2)"),
    showAt(4, "the square (cue 4)"),
    button("load the script again", () => {
      asked = performance.now();
      swapIn = "";
      win.load(cues, 0);
      win.note(`stage.load(script) \xB7 atlasMs ${win.stage.stats.atlasMs} ms`);
    })
  ));
  host.append($("h2", "", "Code budgets (\xA712)"), $("p", "note", "Each package bundled and minified on its own, then gzipped (size.mjs, part of the gallery's check, re-measured at most once a minute). A set family is loaded only when a story's places use it, and is measured without the kit code it shares; the whole set is reported, not held. Bars show the share of each budget."));
  const table = $("div");
  table.textContent = "Measuring\u2026";
  host.append(table);
  ctx.data("sizes").then((rows) => {
    const group = (title, rs) => {
      if (!rs.length) return;
      const t = $("table");
      t.style.cssText = "width:100%;border-collapse:collapse;font-size:13px;margin:6px 0 14px";
      t.append(Object.assign($("caption", "", title), { style: "text-align:left;font-weight:600;padding:4px 0" }));
      for (const r of rs) {
        const tr = $("tr"), pct = r.budget ? r.gzip / r.budget : 0, meter = $("div", "meter"), fill = $("i");
        fill.style.width = `${Math.min(100, pct * 100)}%`;
        if (pct > 1) fill.style.background = "var(--bad, #c33)";
        else if (pct > 0.85) fill.style.background = "var(--warn, #c90)";
        meter.append(fill);
        const cells = [r.name, `${f1(r.gzip / 1024)} KB`, r.budget ? `${r.budget / 1024} KB` : "\u2014", r.budget ? meter : "", r.budget === null ? chip("no budget") : r.ok ? chip("ok", "ok") : chip(r.warn ? "over (reported)" : "OVER", r.warn ? "warn" : "bad")];
        for (const c of cells) {
          const td = $("td");
          td.style.cssText = "padding:3px 6px;border-top:1px solid var(--line)";
          td.append(c);
          tr.append(td);
        }
        tr.children[3].style.width = "30%";
        t.append(tr);
      }
      table.append(t);
    };
    table.replaceChildren();
    const fam = rows.filter((r) => r.name.startsWith("set family ") || r.name.startsWith("the whole set"));
    group("Packages, and what an app loads for its lists and its builder", rows.filter((r) => !fam.includes(r) && !r.name.startsWith("A1 places")));
    group(`The set kit: ${fam.length - 1} families (\u2264 40 KB each), largest first, and the whole set`, [...fam.filter((r) => r.name.startsWith("set family ")).sort((a, b) => b.gzip - a.gzip), ...fam.filter((r) => r.name.startsWith("the whole set"))]);
    group("Place documents", rows.filter((r) => r.name.startsWith("A1 places")));
  }, (e) => {
    table.textContent = `Could not measure: ${e.message}`;
  });
}
export {
  build
};
//# sourceMappingURL=perf-YF23QK3H.js.map
