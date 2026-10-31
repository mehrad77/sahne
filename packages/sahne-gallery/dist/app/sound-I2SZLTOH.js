import {
  SOUNDS_URL
} from "./chunk-6PR3AWGB.js";
import {
  $,
  bar,
  button,
  chip,
  choice,
  css,
  head,
  link,
  select,
  slider,
  toggle
} from "./chunk-4TGKXDN4.js";
import {
  AudioEngine
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/kit/sound.ts
var PX_PER_S = 220;
var H = 120;
var WAVE = 28;
var FMIN = 40;
var SURFACES = ["tile", "stone", "wood", "carpet"];
var takesSurface = (id) => id === "step";
function fft(re) {
  const n = re.length, im = new Float32Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const t = re[i];
      re[i] = re[j];
      re[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  const out = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(re[i], im[i]);
  return out;
}
function heat(v) {
  const stops = [[0, 20, 18, 34], [0.35, 92, 40, 92], [0.65, 224, 98, 44], [1, 255, 240, 205]];
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
    const [a, b] = [stops[i - 1], stops[i]], k = (v - a[0]) / (b[0] - a[0]);
    return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
  }
  return [255, 240, 205];
}
function spectrogram(r) {
  const dur = r.data.length / r.rate, W = Math.max(80, Math.min(900, Math.round(dur * PX_PER_S)));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H + WAVE;
  const g = c.getContext("2d"), img = g.createImageData(W, H), N = 1024, half = N / 2, fmax = r.rate / 2;
  const cols = [];
  let max = 1e-9;
  for (let x = 0; x < W; x++) {
    const at = Math.round(x / W * r.data.length) - half, buf = new Float32Array(N);
    for (let i = 0; i < N; i++) buf[i] = (r.data[at + i] ?? 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
    const m = fft(buf);
    cols.push(m);
    for (const v of m) if (v > max) max = v;
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    const f = FMIN * Math.pow(fmax / FMIN, 1 - y / (H - 1)), bin = Math.min(half - 1, Math.round(f / fmax * half));
    const db = 20 * Math.log10(cols[x][bin] / max + 1e-9), v = Math.max(0, Math.min(1, (db + 72) / 72));
    const [cr, cg, cb] = heat(v), o = (y * W + x) * 4;
    img.data[o] = cr;
    img.data[o + 1] = cg;
    img.data[o + 2] = cb;
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = "rgba(255,255,255,.25)";
  for (const f of [1e3, 4e3]) {
    const y = (1 - Math.log(f / FMIN) / Math.log(fmax / FMIN)) * (H - 1);
    g.fillRect(0, y, W, 1);
  }
  g.fillStyle = "#F4EFE6";
  g.fillRect(0, H, W, WAVE);
  g.fillStyle = "#2F8C88";
  const per = r.data.length / W;
  for (let x = 0; x < W; x++) {
    let lo = 0, hi = 0;
    for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i++) {
      const v = r.data[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    g.fillRect(x, H + WAVE / 2 - hi * WAVE / 2, 1, Math.max(1, (hi - lo) * WAVE / 2));
  }
  return c;
}
var peak = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
var ms = (r) => Math.round(r.data.length / r.rate * 1e3);
async function render(host, ctx) {
  css("sound", `
.snd-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.snd-card { margin: 0; background: var(--chip); border: 1px solid var(--line); border-radius: 12px; padding: 8px; max-width: 100%; min-width: 200px; }
.snd-card > header { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; margin-bottom: 4px; }
.snd-card > header b { font: 600 13px ui-monospace, monospace; }
.snd-card .word { font-weight: 600; }
.snd-card .word small { color: var(--mute); font-weight: 400; }
.snd-card .pics { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: flex-start; }
.snd-card .pic { display: grid; gap: 2px; }
.snd-card .pic small { color: var(--mute); font-size: 11.5px; }
.snd-card canvas { display: block; max-width: 100%; border-radius: 6px; }
.snd-card .wait { height: ${H + WAVE}px; width: 200px; border-radius: 6px; background: var(--line); }
.snd-place { border-top: 1px solid var(--line); padding: 8px 0; display: grid; gap: 4px; }
.snd-place h3 { margin: 0; }
.snd-place .bar button small { color: var(--mute); }
.snd-place .bar button[aria-pressed="true"] small { color: #fffc; }
`);
  const kit = ctx.kit, q = ctx.route.query;
  const sounds = Object.entries(kit.sounds ?? {}).sort(([a], [b]) => a < b ? -1 : 1);
  const motifs = Object.keys(kit.motifs ?? {});
  const [needs, places] = await Promise.all([ctx.data("needs").catch(() => ({})), ctx.data("places").catch(() => [])]);
  const audio = new AudioEngine(kit, { sounds: SOUNDS_URL }), synth = new AudioEngine(kit);
  ctx.cleanup(() => {
    for (const e of [audio, synth]) {
      e.ambience([]);
      e.stopAll();
      e.destroy();
    }
  });
  const on = () => {
    audio.setEnabled(true);
    synth.setEnabled(true);
  };
  const stop = () => {
    for (const e of [audio, synth]) {
      e.ambience([]);
      e.stopAll();
    }
  };
  const play = (id, o = {}) => {
    on();
    const e = o.synth ? synth : audio, def = kit.sounds?.[id];
    if (!def) return;
    if (def.loop) {
      (o.synth ? audio : synth).ambience([]);
      e.ambience([id], true);
    } else e.play(id, { take: o.take, params: o.params });
  };
  const st = { by: q.get("by") === "place" ? "place" : "kit", kind: q.get("kind") ?? "all", q: q.get("q") ?? "", takes: q.get("takes") === "1" };
  const fx = sounds.filter(([, d]) => !d.loop).length, loops = sounds.length - fx, rec = sounds.filter(([, d]) => d.recording).length;
  const intro = $("p", "note", `${sounds.length} sounds (${fx} effects, ${loops} ambience loops, ${rec} with a recording) and ${motifs.length} music motifs, all synthesized in code; a recording plays instead where it loads, and its patch stays as the fallback. Each picture is a spectrogram (time across, pitch up on a log scale, lines at 1 and 4 kHz) over the waveform: look for clicks at the ends, a loop's seam, and takes that differ a little but not too much. The play buttons here make sound from your tap even with sound off in the top bar (the stages follow the top bar). Sound words are teaching content: the Turkish ones change only with the owner (STYLE.md). `);
  intro.append(link("The audio system", "#/systems/audio"), " plays them on a stage.");
  host.append($("h1", "", "Sounds and music"), intro);
  const search = Object.assign($("input"), { type: "search", placeholder: "id or sound word\u2026", value: st.q });
  search.oninput = () => {
    st.q = search.value.trim();
    ctx.setQuery({ q: st.q || null });
    draw();
  };
  const vols = ["fx", "ambience", "music"].map((b) => slider(b, 0, 1, 0.05, audio.volumes[b], (v) => {
    audio.setVolume(b, v);
    synth.setVolume(b, v);
  }, (v) => v.toFixed(2)));
  host.append(
    bar(
      "show",
      choice("", ["kit", "place"], st.by, (v) => {
        st.by = v;
        ctx.setQuery({ by: v === "kit" ? null : v });
        draw();
      }, { kit: "by kit id", place: "by place" }),
      search,
      select("", [["all", "every sound"], ["fx", "effects"], ["loop", "ambience loops"], ["motif", "motifs"], ["recorded", "with a recording"]], st.kind, (v) => {
        st.kind = v;
        ctx.setQuery({ kind: v === "all" ? null : v });
        draw();
      }),
      toggle("every take", st.takes, (v) => {
        st.takes = v;
        ctx.setQuery({ takes: v ? "1" : null });
        draw();
      }, "a picture per take (and per surface for footsteps), not just the first"),
      button("\u25A0 stop all", stop)
    ),
    bar("volume", ...vols)
  );
  const out = $("div");
  host.append(out);
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) {
      io.unobserve(e.target);
      e.target.paint?.();
    }
  }, { rootMargin: "300px" });
  ctx.cleanup(() => io.disconnect());
  const pic = (label, make, timed = true) => {
    const p = $("div", "pic");
    const cap = $("small", "", label), wait = $("div", "wait");
    p.append(cap, wait);
    p.paint = async () => {
      let r = null, took = null;
      try {
        const t = performance.now(), v = make();
        took = performance.now() - t;
        r = await v;
      } catch (e) {
        cap.textContent = `${label}: ${e.message}`;
      }
      if (!r) {
        wait.replaceWith($("small", "bad", "did not load"));
        return;
      }
      cap.textContent = `${label} \xB7 ${ms(r)} ms \xB7 peak ${peak(r.data).toFixed(2)} \xB7 ${r.rate} Hz${timed && took !== null ? ` \xB7 rendered in ${took.toFixed(1)} ms` : ""}`;
      wait.replaceWith(spectrogram(r));
    };
    io.observe(p);
    return p;
  };
  const wordOf = (def) => {
    const w = $("span", "word");
    if (def.word) {
      w.append(`\u201C${def.word.tr}\u201D`);
      w.lang = "tr";
      w.append(" ", $("small", "", def.word.en ?? ""));
    } else w.append($("small", "", "no word (never captioned)"));
    return w;
  };
  function soundCard(id, def) {
    const f = $("figure", "snd-card"), top = $("header"), pics = $("div", "pics");
    f.id = `snd-${id}`;
    const takes = def.takes ?? 1, surfaces = takesSurface(id) ? SURFACES : [void 0];
    top.append($("b", "", id), wordOf(def), chip(def.loop ? "loop" : "effect"), ...takes > 1 ? [chip(`${takes} takes`)] : [], ...def.recording ? [chip("recording", "ok", `${def.recording.file} \xB7 sounds/SOURCES.md`)] : []);
    const plays2 = $("div", "bar");
    if (def.recording) plays2.append(button("\u25B6 recording", () => play(id)), button("\u25B6 patch", () => play(id, { synth: true }), void 0, "the synthesized fallback"));
    for (const surface of surfaces) for (let t = 0; t < takes; t++) {
      if (def.recording && !surface && takes === 1) break;
      const label = [surface, takes > 1 ? `take ${t + 1}` : ""].filter(Boolean).join(" \xB7 ") || "play";
      plays2.append(button(`\u25B6 ${label}`, () => play(id, { take: t, params: surface ? { surface } : {}, synth: !!def.recording })));
    }
    if (def.loop) plays2.append(button("\u25A0", stop, void 0, "stop the loop"));
    if (def.recording) pics.append(pic(`recording \xB7 ${def.recording.file}${def.recording.loop ? ` \xB7 loop ${def.recording.loop[0]}\u2013${def.recording.loop[1]} s` : ""}`, async () => {
      const buf = await audio.recording(id);
      return buf ? { rate: buf.sampleRate, data: buf.getChannelData(0) } : null;
    }, false));
    for (const surface of st.takes ? surfaces : surfaces.slice(0, 1)) for (let t = 0; t < (st.takes ? takes : 1); t++) {
      const label = [def.recording ? "patch (the fallback)" : "patch", surface, takes > 1 ? `take ${t + 1}` : ""].filter(Boolean).join(" \xB7 ");
      pics.append(pic(label, () => audio.render(id, t, surface ? { surface } : {})));
    }
    f.append(top, plays2, pics);
    return f;
  }
  function motifCard(id) {
    const m = kit.motifs[id], f = $("figure", "snd-card"), top = $("header");
    f.id = `snd-${id}`;
    top.append($("b", "", id), chip("motif"), $("small", "", `${m.bpm} bpm \xB7 ${m.tracks.length} track${m.tracks.length > 1 ? "s" : ""}`));
    f.append(top, bar("", button("\u25B6 play", () => {
      on();
      audio.motif(id);
    })), $("div", "pics"));
    f.lastElementChild.append(pic("rendered", () => audio.renderMotif(id)));
    return f;
  }
  const matches = (id, def) => {
    if (st.kind === "fx" && (!def || def.loop)) return false;
    if (st.kind === "loop" && (!def || !def.loop)) return false;
    if (st.kind === "motif" && def) return false;
    if (st.kind === "recorded" && !def?.recording) return false;
    if (!st.q) return true;
    const hay = [id, def?.word?.tr ?? "", def?.word?.en ?? ""].join(" ").toLocaleLowerCase("tr");
    return st.q.toLocaleLowerCase("tr").split(/\s+/).every((w) => hay.includes(w));
  };
  function byKit() {
    const groups = [
      ["Effects", "One-shots on the effects bus: the script's sfx, and the automatic ones (footsteps on the place's surface, doors, the paper flip, Kerim's coo).", sounds.filter(([id, d]) => !d.loop && matches(id, d)).map(([id, d]) => soundCard(id, d))],
      ["Ambience loops", "Seamless loops a place plays quietly while a scene is there, crossfading at a change of place. \u25A0 stops a loop.", sounds.filter(([id, d]) => d.loop && matches(id, d)).map(([id, d]) => soundCard(id, d))],
      ["Motifs", "Music from the step sequencer on the kit's instruments (ba\u011Flama, pad, bell, ney, frame drum): Kerim's theme, one per family of places, and the end stinger. Never under speech.", motifs.filter((id) => matches(id)).map(motifCard)]
    ];
    for (const [title, about, cards] of groups) {
      if (!cards.length) continue;
      const grid = $("div", "snd-grid");
      grid.append(...cards);
      out.append(head(`${title} \xB7 ${cards.length}`, about, title === "Motifs" ? "\xA78.3" : "\xA78.2"), grid);
    }
  }
  const plays = (doc) => {
    const d = bar("plays");
    for (const id of doc.ambience ?? []) d.append(button(`\u27F3 ${id}`, () => play(id), void 0, "its ambience bed"));
    if (doc.motif) d.append(button(`\u266A ${doc.motif}`, () => {
      on();
      audio.motif(doc.motif);
    }, void 0, "its motif, when a story moves here"));
    d.append(chip(`steps on ${doc.surface ?? "(no surface)"}`, doc.surface ? "" : "warn"));
    if (doc.surface && kit.sounds?.step) d.append(button("\u25B6 a step", () => play("step", { params: { surface: doc.surface } })));
    return d;
  };
  function byPlace() {
    const docs = new Map(places.map((p) => [p.id, p]));
    const asked = /* @__PURE__ */ new Set();
    out.append(head("By place", "What each place's stories ask to hear (needs.json), place by place, and what its document plays: its ambience bed, its motif and the surface its footsteps sound on. A tap plays an effect or starts a loop; \u25A0 stop all ends it. A sound the kit lacks is red.", "\xA78.1"));
    for (const [site, s] of Object.entries(needs)) for (const [pid, p] of Object.entries(s.places)) {
      const ids = (p.sounds ?? []).map((x) => x.replace(/^\+/, "")).filter((id) => matches(id, kit.sounds?.[id]));
      const doc = docs.get(pid);
      if (!ids.length && !(doc && !st.q && st.kind === "all")) continue;
      const row = $("div", "snd-place"), h = $("h3", "", pid);
      h.append(" ", chip(site), " ", doc ? link("scout \u2197", `#/places/${pid}`) : chip("not built", "ph"));
      row.append(h, $("small", "note", p.why));
      const b = bar("asks");
      for (const id of ids) {
        asked.add(id);
        const def = kit.sounds?.[id];
        if (!def) {
          b.append(chip(`${id}: not in the kit`, "bad"));
          continue;
        }
        const btn = button(`\u25B6 ${id} `, () => play(id), void 0, def.loop ? "a loop: plays until stopped" : "an effect");
        if (def.word) btn.append($("small", "", def.word.tr));
        if (def.loop) btn.append(" \u27F3");
        b.append(btn);
      }
      if (!ids.length) b.append($("small", "note", "nothing"));
      row.append(b);
      if (doc) row.append(plays(doc));
      out.append(row);
    }
    const inNeeds = new Set(Object.values(needs).flatMap((s) => Object.keys(s.places)));
    if (!st.q && st.kind === "all") for (const doc of places.filter((d) => !inNeeds.has(d.id))) {
      const row = $("div", "snd-place"), h = $("h3", "", doc.id);
      h.append(" ", chip("in no brief", "ph"), " ", link("scout \u2197", `#/places/${doc.id}`));
      row.append(h, plays(doc));
      out.append(row);
    }
    const rest = sounds.filter(([id, d]) => !asked.has(id) && matches(id, d));
    if (rest.length) {
      const b = bar("");
      for (const [id, d] of rest) b.append(button(`\u25B6 ${id}`, () => play(id), void 0, d.word ? `\u201C${d.word.tr}\u201D / ${d.word.en}` : "no word"));
      out.append(head(`Asked by no place \xB7 ${rest.length}`, "Sounds no brief names: the automatic ones (footsteps, doors, the paper flip, Kerim's coo, a UI tap) and those waiting for a story."), b);
    }
  }
  function draw() {
    stop();
    out.replaceChildren();
    if (!sounds.length && !motifs.length) {
      out.append($("p", "note", "The kit has no sounds yet."));
      return;
    }
    if (st.by === "place") byPlace();
    else byKit();
  }
  draw();
}
export {
  render
};
//# sourceMappingURL=sound-I2SZLTOH.js.map
