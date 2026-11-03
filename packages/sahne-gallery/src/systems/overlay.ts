// Bubbles and the narrator (DESIGN.md §6.8, §8.5): on a real stage, a line in each voice (normal,
// whisper, silent, mouthing), sound words where a sound comes from, a line and a sound at once, and
// Kerim's window for the narrator, at phone and desktop widths. Then the HTML Overlay alone on a
// plain backdrop with figures you can drag and a pretend camera, so every bubble case can be pushed
// around without WebGL, with the cost of each layout().

import { Overlay, type Bubble, type Cue, type Vec3 } from "sahne";
import { K_HEAD_VB, K_BUST, K_HEAD } from "sahne-kit/kerim/art";
import { $, bar, button, choice, css, toggle } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { BAKKAL, ISMAIL, NIMA, VOICES } from "../bakkal.ts";
import { kerimPortrait, kerimOnTalk } from "sahne-kit/kerim/portrait";
import { bench } from "./bench.ts";

const ART = { vb: K_HEAD_VB, bust: K_BUST, head: K_HEAD };
const NAMES = { ismail: "İsmail", nima: "Nima", kerim: "Kerim" };
const LONG = "Ekmek var, simit var, peynir de var. Şu ekmek çok taze, bu sabah fırından geldi. Ama süt yok, kusura bakmayın.";

export function build(host: HTMLElement, ctx: Ctx) {
  // ---- a real stage: the bakkal ----
  host.append($("h2", "", "On the stage"), $("p", "note", "A bubble sits above its speaker; its tail aims at the mouth and stops outside the head. A whisper is a dashed, quieter bubble; a silent line is \"…\"; a mouthed line moves the lips in a dashed bubble and is never voiced. A sound word (çın çın, tik tak) floats where the sound comes from: it shows while sound is off, or with captions on in the top bar. Kerim's lines go to the round window in the corner. With bubbles on, the framings leave headroom above the heads. Try the phone width: the bubbles wrap and stay inside the frame."));
  const kerim = kerimPortrait(ART);
  const start: Cue = { scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "customer" } } };
  const shop = bench(host, ctx, {
    places: [BAKKAL], cast: { ismail: ISMAIL, nima: NIMA }, cues: [start],
    load: { narrator: "kerim", narratorEl: kerim, onNarratorTalk: kerimOnTalk(kerim), names: NAMES, voices: VOICES, narratorSound: "coo", tempo: { ismail: 1.1 } },
  });
  host.append(
    bar("voice",
      shop.cue("normal", { line: { who: "ismail", text: "Hoş geldiniz! Buyrun.", to: "nima", emo: "happy" } }),
      shop.cue("whisper", { line: { who: "nima", text: "Taze mi acaba?", voice: "whisper", to: "ismail" } }),
      shop.cue("silent", { line: { who: "nima", text: "…", voice: "silent", emo: "nervous" } }),
      shop.cue("mouthing", { line: { who: "nima", text: "Teşekkürler.", voice: "mouthing", to: "ismail" } }),
      shop.cue("a long line", { line: { who: "ismail", text: LONG, to: "nima", do: "explain" } }),
    ),
    bar("sound words",
      shop.cue("çın çın (door)", { beat: { cam: "wide", sfx: { id: "doorbell", word: "çın çın", at: "mark:door" } } }),
      shop.cue("tik tak (clock)", { beat: { cam: "wide", sfx: { id: "clock_tick", word: "tik tak", at: "mark:clock" } } }),
      shop.cue("knock (the kit's own word)", { beat: { cam: "wide", sfx: { id: "knock", at: "mark:door" } } }),
      shop.cue("a line and a sound", { line: { who: "nima", text: "…", voice: "silent", emo: "nervous", cam: "wide", sfx: { id: "clock_tick", word: "tik tak", at: "mark:clock" } } }),
    ),
    bar("narrator",
      shop.cue("Kerim speaks", { line: { who: "kerim", text: "Yavaş yavaş…" } }),
      shop.cue("Kerim, longer", { line: { who: "kerim", text: "Nima biraz heyecanlı. Ama sorun yok: yavaş yavaş, her gün biraz." } }),
      shop.cue("back to the start", start),
    ),
    choice("width", ["fit", "phone", "small"], "fit", w => { shop.box.style.maxWidth = { fit: "", phone: "390px", small: "320px" }[w]; }, { fit: "the view's width", phone: "390 px", small: "320 px" }),
  );

  // ---- the overlay alone, over a pretend scene ----
  host.append($("h2", "", "The overlay alone"), $("p", "note", "The same HTML layer on a plain backdrop: the figures and the two sound sources (the door, the clock) are boxes you can drag, and the bubbles follow their anchors (orange dots). A bubble near an edge flips its tail rather than leave the frame; two bubbles side by side push apart. The camera move runs layout() every frame; its cost is under the backdrop."));
  css("sys-overlay", `
.ov-host { position: relative; width: 100%; max-width: var(--frame-max); aspect-ratio: 16 / 10; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); touch-action: none; user-select: none; margin: 8px 0; background: linear-gradient(#EADCC4 0 74%, #C9B497 74% 76%, #D8C6A8 76%); }
.ov-host .fig { position: absolute; left: 0; top: 0; transform-origin: 0 0; cursor: grab; }
.ov-host .fig > * { position: absolute; }
.ov-host .tag { font: 600 11px/1 system-ui, sans-serif; color: #fff; background: rgba(43,36,32,.55); padding: 3px 6px; border-radius: 99px; white-space: nowrap; translate: -50% -50%; }
.ov-host .dot { width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: #E0622C; box-shadow: 0 0 0 2px #fff; }`);
  const ovHost = $("div", "ov-host"), scene = $("div");
  scene.style.cssText = "position:absolute;inset:0";
  ovHost.append(scene);
  const stats = $("p", "note");
  host.append(ovHost, stats);

  // the pretend world: x and y in host widths (y down); a figure is a head on a body, a spot a box
  type Thing = { id: string; label: string; x: number; y: number; h: number; w: number; color: string; head?: string; el?: HTMLElement };
  const things: Thing[] = [
    { id: "nima", label: "Nima", x: 0.3, y: 0.585, h: 0.31, w: 0.09, color: "#4F7FA8", head: "#C99A78" },
    { id: "ismail", label: "İsmail", x: 0.66, y: 0.585, h: 0.29, w: 0.09, color: "#E7E1D4", head: "#B98462" },
    { id: "ayse", label: "Ayşe", x: 0.88, y: 0.585, h: 0.27, w: 0.09, color: "#9C5B6E", head: "#D9AE8C" },
    { id: "door", label: "door", x: 0.07, y: 0.4625, h: 0.33, w: 0.065, color: "#8C6A4F" },
    { id: "clock", label: "clock", x: 0.2, y: 0.11, h: 0.05, w: 0.05, color: "#F6F1E6" },
  ];
  const HOME = { x: 0.5, y: 0.3125, z: 1 }, cam = { ...HOME }, U = 100;
  const size = () => [ovHost.clientWidth, ovHost.clientHeight];
  const toPx = (x: number, y: number): [number, number] => { const [W, H] = size(); return [(x - cam.x) * cam.z * W + W / 2, (y - cam.y) * cam.z * W + H / 2]; };
  const top = (id: string): Vec3 => { const t = things.find(t => t.id === id)!; return [t.x, t.y - t.h - 0.012, 0]; };
  for (const t of things) {
    const el = t.el = $("div", "fig"), box = (css: string) => { const d = $("div"); d.style.cssText = css; return d; };
    const body = t.head ? t.h * 0.74 : t.h;
    el.append(box(`left:${-t.w * U / 2}px;top:${-body * U}px;width:${t.w * U}px;height:${body * U}px;background:${t.color};border-radius:${t.head ? "40% 40% 8% 8%" : t.id === "clock" ? "50%" : "6px 6px 0 0"}`));
    if (t.head) el.append(box(`left:${-0.033 * U}px;top:${-t.h * U}px;width:${0.066 * U}px;height:${0.066 * U}px;border-radius:50%;background:${t.head}`));
    const tag = $("div", "tag", t.label), dot = $("div", "dot");
    tag.style.top = `${-t.h * U * 0.4}px`; dot.style.top = `${-(t.h + 0.012) * U}px`;
    el.append(tag, dot);
    scene.append(el);
  }

  const overlay = new Overlay(ovHost, { project: p => toPx(p[0], p[1]) });
  const portrait = kerimPortrait(ART), onTalk = kerimOnTalk(portrait);
  ctx.cleanup(() => overlay.destroy());
  const on = new Set(["ismail", "nima", "bell"]);
  let voice: "normal" | "whisper" | "mouthing" | "silent" = "whisper", long = false;
  const bubbles = (): Bubble[] => {
    const out: Bubble[] = [];
    if (on.has("ismail")) out.push({ id: "ismail" + long, kind: "speech", who: "ismail", name: "İsmail", text: long ? LONG : "Ekmek var. Şu ekmek çok taze.", anchor: top("ismail") });
    if (on.has("nima")) out.push({ id: "nima", kind: "speech", who: "nima", name: "Nima", text: "Ekmek var mı? Süt var mı?", anchor: top("nima") });
    if (on.has("ayse")) out.push({ id: "ayse" + voice, kind: "speech", who: "ayse", name: "Ayşe", text: voice === "silent" ? "" : "Taze mi acaba?", voice, anchor: top("ayse") });
    if (on.has("bell")) out.push({ id: "bell", kind: "sound", text: "çın çın", anchor: top("door") });
    if (on.has("clock")) out.push({ id: "tick", kind: "sound", text: "tik tak", anchor: top("clock") });
    if (on.has("kerim")) out.push({ id: "kerim", kind: "narrator", who: "kerim", name: "Kerim", text: "Yavaş yavaş…" });
    return out;
  };
  const times: number[] = [];
  const render = () => {
    const [W] = size(), k = cam.z * W / U;
    for (const t of things) { const [x, y] = toPx(t.x, t.y); t.el!.style.transform = `translate3d(${x}px,${y}px,0) scale(${k})`; for (const m of t.el!.querySelectorAll<HTMLElement>(".tag,.dot")) m.style.scale = String(1 / k); }
    const t0 = performance.now();
    overlay.layout();
    times.push(performance.now() - t0); if (times.length > 240) times.shift();
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    stats.textContent = `${overlay.el.children.length} overlay elements · layout() avg ${avg.toFixed(3)} ms, max ${Math.max(...times).toFixed(2)} ms over ${times.length} frames`;
  };
  const apply = () => { overlay.inset(on.has("kerim") ? { el: portrait, who: "kerim", side: on.has("right") ? "right" : "left", onTalk } : null); overlay.set(bubbles()); render(); };
  const ro = new ResizeObserver(render); ro.observe(ovHost); ctx.cleanup(() => ro.disconnect());
  ctx.onSettings(s => overlay.setStill(s.motion === "still"));
  overlay.setStill(ctx.settings.motion === "still");

  // drag a figure or a sound source: its anchor moves, the bubbles follow
  for (const t of things) t.el!.addEventListener("pointerdown", e => {
    e.preventDefault(); t.el!.setPointerCapture(e.pointerId);
    const x0 = e.clientX, y0 = e.clientY, fx = t.x, fy = t.y, [W] = size();
    const move = (m: PointerEvent) => { t.x = fx + (m.clientX - x0) / (W * cam.z); t.y = fy + (m.clientY - y0) / (W * cam.z); overlay.set(bubbles()); render(); };
    t.el!.addEventListener("pointermove", move);
    t.el!.addEventListener("pointerup", () => t.el!.removeEventListener("pointermove", move), { once: true });
  });
  // the camera: push in on İsmail, across to Nima, back out
  let raf = 0;
  ctx.cleanup(() => cancelAnimationFrame(raf));
  const camMove = () => {
    const keys = [{ t: 0, ...HOME }, { t: 900, x: 0.66, y: 0.27, z: 1.9 }, { t: 1900, x: 0.32, y: 0.28, z: 1.7 }, { t: 2800, ...HOME }], t0 = performance.now();
    times.length = 0;
    const step = (now: number) => {
      const t = now - t0; let i = 0;
      while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
      const a = keys[i], b = keys[i + 1], k = Math.min(1, (t - a.t) / (b.t - a.t)), e = k * k * (3 - 2 * k);
      cam.x = a.x + (b.x - a.x) * e; cam.y = a.y + (b.y - a.y) * e; cam.z = a.z + (b.z - a.z) * e;
      render();
      if (t < 2800) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const flag = (label: string, key: string) => toggle(label, on.has(key), v => { if (v) on.add(key); else on.delete(key); apply(); });
  host.append(
    bar("lines", flag("İsmail", "ismail"), toggle("long line", false, v => { long = v; apply(); }), flag("Nima", "nima"), flag("Ayşe", "ayse")),
    choice("Ayşe's voice", ["normal", "whisper", "mouthing", "silent"] as const, voice, v => { voice = v; on.add("ayse"); apply(); }),
    bar("sounds", flag("çın çın (door)", "bell"), flag("tik tak (clock)", "clock")),
    bar("narrator", flag("Kerim narrates", "kerim"), flag("window on the right", "right")),
    bar("camera", button("camera move", camMove), button("close-up İsmail", () => { Object.assign(cam, cam.z > 1.01 ? HOME : { x: 0.66, y: 0.3, z: 2.4 }); render(); })),
    choice("width", ["fit", "390", "320"], "fit", w => { ovHost.style.maxWidth = w === "fit" ? "" : `${w}px`; }, { fit: "the view's width", 390: "390 px", 320: "320 px" }),
  );
  apply();
}
