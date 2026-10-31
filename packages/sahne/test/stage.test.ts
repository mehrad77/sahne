// Tests of the lone-actor preview (DESIGN.md §10): the framings on the kit's real bodies and hair,
// the camera's ease, the atlas layout and face-slot sizing, the queue that lets the last look win,
// and the Stage itself on a fake page (a WebGL2 and a 2D context that accept anything), so that what
// the app relies on is checked without a GPU: the camera it ends up with, swaps, trust, hiding,
// losing the context, and giving everything back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyDims, figureCam, figureDims, stepCam, sameCam, type CamState, type Framing, type FigureDims } from "../src/render/paper/camera.ts";
import { Atlas, packShelves, faceSlots, textureBytes, MAX_FACES, type AtlasHook } from "../src/render/paper/atlas.ts";
import { Latest, Stage, type StudioOptions } from "../src/stage.ts";
import { compose } from "../src/avatar/compose.ts";
import { solve, restPose } from "../src/rig/skeleton.ts";
import { composePose } from "../src/rig/pose.ts";
import { perspective, lookAt, mat4Mul, project, apply } from "../src/core/math.ts";
import { rng } from "../src/core/rng.ts";
import type { AvatarDoc, PlaceDoc } from "../src/core/types.ts";
import type { FlatSpec, Item, Kit, KitPuppet, PieceDef } from "../src/core/kit.ts";
import type { PoseInput } from "../src/rig/pose.ts";
import type { Vec3 } from "../src/core/math.ts";
import { MODE, PaperRenderer } from "../src/render/paper/renderer.ts";
import { rect } from "../src/art/path.ts";
import { flatMatrix } from "../src/ui/prop-text.ts";
import { NEAR, FAR } from "../src/render/paper/camera.ts";
import kit from "../../sahne-kit/src/full.ts";
import { NIMA, ISMAIL } from "../../sahne-gallery/src/bakkal.ts";

// ---- the kit's people ---------------------------------------------------------------------------

const BUILDS = ["adult", "elder", "child", "toddler"] as const;
const ASPECTS = [0.4, 0.56, 0.65, 1, 1.58, 2.4];
const FRAMINGS: Framing[] = ["full", "bust", "head"];
const HAIRS = Object.keys(kit.parts).filter(k => kit.parts[k].slot === "hair");
const docOf = (build: (typeof BUILDS)[number], height = 0.5, extra: Partial<AvatarDoc> = {}): AvatarDoc => ({ ...kit.defaultDoc, body: { build, height, shape: "average" }, ...extra });
const withHair = (style: string, build: (typeof BUILDS)[number] = "adult", height = 0.5) => docOf(build, height, { hair: { style, color: "hair_02" } });
const dimsOf = (doc: AvatarDoc): FigureDims => figureDims(compose(doc, kit));
/** The tallest body of a document's build, which the full frame is built for (what the stage's `refBody` asks the kit). */
const refOf = (doc: AvatarDoc) => bodyDims(kit.body({ ...doc.body, height: 1 }));

/** Where a point of the plane the figure stands in lands in the frame: x and y in −1…1 across it. */
function lens(cam: CamState, aspect: number) {
  const vp = mat4Mul(perspective(cam.fov, aspect, 0.1, 200), lookAt(cam.eye, cam.target));
  return (x: number, y: number): [number, number] => { const q = project(vp, [x, y, 0]); return [q[0], q[1]]; };
}

/** The art on the head bone at rest, both views, as its true extent (from the paths, without the rim and shadow `groupBounds` adds): the oracle for the framings. */
function headArt(doc: AvatarDoc) {
  const p = compose(doc, kit), head = solve(p.bones, restPose()).get("head")!;
  let crown = 0, half = 0;
  for (const v of [p.views.front, p.views.back]) for (const it of v) {
    if (it.bone !== "head" || !it.group) continue;
    for (const s of it.group.shapes) {
      const [x0, y0, x1, y1] = s.path.bounds();
      for (const q of [apply(head, x0, y0), apply(head, x1, y0), apply(head, x1, y1), apply(head, x0, y1)]) { crown = Math.max(crown, -q[1]); half = Math.max(half, Math.abs(q[0])); }
    }
  }
  return { crown, half, H: p.body.H };
}

test("a figure's measurements come from its body and the art on its head", () => {
  const d = dimsOf(withHair("hair_bun")), plain = dimsOf(withHair("hair_short")), bald = dimsOf(withHair("hair_bald"));
  assert.ok(d.crown! > d.H + 10 && d.crown! < d.H + 14, "a bun stands about 11 cm above the crown");
  assert.ok(plain.crown! > plain.H + 3 && plain.crown! < plain.H + 6);
  assert.ok(bald.crown! < bald.H + 2);
  assert.ok(dimsOf(withHair("hair_long")).headHalf! > dimsOf(withHair("hair_short")).headHalf! + 6, "long hair is wider than the head");
  assert.ok(d.armL! > 60 && d.armL! < 75);
  // the same body, the same height: one number per kind, whatever the hair
  assert.equal(d.H, plain.H);
});

// ---- the framings ---------------------------------------------------------------------------------

test("full framing shows head to toe with equal room above and below, on any canvas", () => {
  for (const build of BUILDS) for (const aspect of ASPECTS) {
    const doc = docOf(build, 1), d = dimsOf(doc);
    const at = lens(figureCam("full", d, aspect, refOf(doc)), aspect), H = d.H / 100;
    const top = 1 - at(0, H)[1], bottom = at(0, 0)[1] + 1;
    assert.ok(top > 0 && bottom > 0, `${build} @${aspect}: head and feet inside (${top.toFixed(3)}, ${bottom.toFixed(3)})`);
    const [l] = at(-d.shoulderW / 200, H * 0.8), [r] = at(d.shoulderW / 200, H * 0.8);
    assert.ok(l > -1 && r < 1, `${build} @${aspect}: shoulders inside`);
    // the same room above and below (the foot of a nearer figure is a little lower in the frame: perspective)
    assert.ok(Math.abs(top - bottom) < 0.05, `${build} @${aspect}: even margins (${top.toFixed(3)} vs ${bottom.toFixed(3)})`);
  }
});

test("full framing fills the height wherever the canvas is wide enough for an arm stretched out", () => {
  for (const build of BUILDS) for (const aspect of [1, 1.58, 2.4]) {
    const doc = docOf(build, 1), d = dimsOf(doc);
    const at = lens(figureCam("full", d, aspect, refOf(doc)), aspect), H = d.H / 100;
    const fill = (at(0, H)[1] - at(0, 0)[1]) / 2;
    assert.ok(fill > 0.8 && fill < 0.93, `${build} @${aspect}: the figure fills ${fill.toFixed(3)} of the height`);
  }
});

test("a tall phone canvas gets a smaller figure, never a cut one: an arm stretched out always fits", () => {
  const doc = docOf("adult", 1), d = dimsOf(doc), reach = (d.shoulderW! / 2 + d.armL!) / 100;
  const size = (aspect: number) => { const at = lens(figureCam("full", d, aspect, refOf(doc)), aspect); return at(0, d.H / 100)[1] - at(0, 0)[1]; };
  assert.ok(size(0.4) < size(0.65) * 0.8 && size(0.65) < size(1) * 0.9, "the narrower the canvas, the smaller the figure");
  for (const aspect of ASPECTS) {
    const at = lens(figureCam("full", d, aspect, refOf(doc)), aspect);
    for (const y of [0.4, 1.2, 1.5, 1.8]) { const [l] = at(-reach, y), [r] = at(reach, y); assert.ok(l >= -1 && r <= 1, `@${aspect}: the hand at ±${reach.toFixed(2)} m, ${y} m up`); }
  }
});

test("no gesture of the kit leaves the full frame, on a phone canvas or a wide one", () => {
  for (const build of BUILDS) for (const aspect of [0.63, 1, 1.6]) {
    const doc = docOf(build, 1), p = compose(doc, kit), b = p.body, d = figureDims(p);
    const at = lens(figureCam("full", d, aspect, refOf(doc)), aspect);
    let worst = 0;
    for (const [name, def] of Object.entries(kit.gestures)) {
      const target: [number, number] | undefined = def.needs?.includes("target") ? [90, -170] : undefined;
      for (const side of ["l", "r"] as const) for (let t = 0; t <= def.dur; t += 60) {
        const out = composePose({ bones: p.bones, body: b, defs: kit.gestures, gestures: [{ id: name, t, side, n: 3, target }] });
        const world = solve(p.bones, out.pose);
        for (const hs of ["l", "r"]) for (const f of [0.45, 1]) {
          const q = apply(world.get("hand_" + hs)!, 0, b.handL * f), [x, y] = at(q[0] / 100, -q[1] / 100);
          worst = Math.max(worst, Math.abs(x), y);
          assert.ok(Math.abs(x) <= 1 && y <= 1, `${build} @${aspect}: ${name} at ${t} ms leaves the frame (${x.toFixed(2)}, ${y.toFixed(2)})`);
        }
      }
    }
    assert.ok(worst > 0.5, "the sweep really reached out");
  }
});

test("the full frame is built for the build's tallest body, so a height slider shows", () => {
  const short = docOf("adult", 0), tall = docOf("adult", 1), ref = refOf(tall);
  assert.deepEqual(refOf(short), ref, "one reference for the whole build");
  assert.ok(dimsOf(short).H < dimsOf(tall).H - 20);
  const a = figureCam("full", dimsOf(short), 1, ref), b = figureCam("full", dimsOf(tall), 1, ref);
  assert.ok(sameCam(a, b), "the frame stays put while the body grows in it");
  const at = lens(a, 1), ratio = (at(0, dimsOf(short).H / 100)[1] - at(0, 0)[1]) / (at(0, dimsOf(tall).H / 100)[1] - at(0, 0)[1]);
  assert.ok(Math.abs(ratio - dimsOf(short).H / dimsOf(tall).H) < 0.02, "the shorter body is that much smaller in the same frame");
  // without a reference a body is framed by itself
  assert.ok(!sameCam(figureCam("full", dimsOf(short), 1), b));
  // and a toddler fills its own frame as much as an adult fills its
  const fill = (doc: AvatarDoc) => { const a = lens(figureCam("full", dimsOf(doc), 1, refOf(doc)), 1); return (a(0, dimsOf(doc).H / 100)[1] - a(0, 0)[1]) / 2; };
  assert.ok(Math.abs(fill(docOf("toddler", 1)) - fill(docOf("adult", 1))) < 0.05);
});

test("bust and head frame the head, centred, whatever the height", () => {
  for (const f of ["bust", "head"] as Framing[]) for (const aspect of ASPECTS) for (const build of BUILDS) {
    const doc = docOf(build, 1), d = dimsOf(doc), at = lens(figureCam(f, d, aspect), aspect), H = d.H / 100, chin = (d.H - d.headH) / 100;
    const [, yTop] = at(0, H), [, yChin] = at(0, chin), [xl] = at(-d.headW / 200, H - d.headH / 200), [xr] = at(d.headW / 200, H - d.headH / 200);
    assert.ok(yTop < 1 && yChin > -1, `${f} ${build} @${aspect}: crown and chin inside`);
    assert.ok(xl > -1 && xr < 1, `${f} ${build} @${aspect}: the head's width inside`);
    assert.ok(Math.abs(xl + xr) < 1e-3, `${f} ${build} @${aspect}: centred across`);
    // the head is a good part of the picture, across or up: a head more than a bust
    const share = Math.max((yTop - yChin) / 2, (xr - xl) / 2);
    assert.ok(share > (f === "head" ? 0.5 : 0.33), `${f} ${build} @${aspect}: the head fills ${share.toFixed(2)}`);
  }
  const height = (doc: AvatarDoc, f: Framing) => { const a = lens(figureCam(f, dimsOf(doc), 1), 1), d = dimsOf(doc); return a(0, d.H / 100)[1] - a(0, (d.H - d.headH) / 100)[1]; };
  assert.ok(height(docOf("adult"), "head") > height(docOf("adult"), "bust") * 1.3);
  // the head stays put in the frame when the body grows
  const mid = (doc: AvatarDoc) => { const d = dimsOf(doc), a = lens(figureCam("head", d, 1), 1); return a(0, (d.H - d.headH / 2) / 100)[1]; };
  assert.ok(Math.abs(mid(docOf("adult", 0)) - mid(docOf("adult", 1))) < 0.02);
});

test("every hair style and the scarf stay inside the bust and head frames and under the full one's top", () => {
  const scarf: Partial<AvatarDoc> = { wear: { head: { id: "headscarf_wrap" } } };
  const docs: [string, AvatarDoc][] = [...HAIRS.map(h => [h, withHair(h)] as [string, AvatarDoc]), ["scarf", docOf("adult", 0.5, scarf)]];
  for (const [name, base] of docs) for (const build of BUILDS) for (const height of [0, 1]) {
    const doc = { ...base, body: { build, height, shape: "average" as const } }, art = headArt(doc), d = dimsOf(doc);
    for (const f of FRAMINGS) for (const aspect of [0.56, 1, 1.6]) {
      const at = lens(figureCam(f, d, aspect, refOf(doc)), aspect), why = `${name} ${build} h${height} ${f} @${aspect}`;
      const [xl, yTop] = at(-art.half / 100, art.crown / 100), [xr] = at(art.half / 100, art.crown / 100);
      assert.ok(yTop < 1, `${why}: the top of the hair is in (${yTop.toFixed(3)})`);
      assert.ok(xl > -1 && xr < 1, `${why}: the sides are in (${xl.toFixed(3)}, ${xr.toFixed(3)})`);
    }
  }
});

test("a damaged body never makes a camera of NaN", () => {
  const dmg = { H: NaN, headH: -3, headW: Infinity, shoulderW: 0, armL: NaN, crown: NaN, headHalf: -1 };
  for (const f of FRAMINGS) {
    const cam = figureCam(f, dmg, 1, NaN);
    for (const v of [...cam.eye, ...cam.target, cam.fov]) assert.ok(Number.isFinite(v), f);
    assert.deepEqual(cam, figureCam(f, { H: 172, headH: 50, headW: 44, shoulderW: 42 }, 1, 172));
  }
  assert.ok(Number.isFinite(figureDims(compose({ v: 1, kit: "x", body: { build: "adult", height: NaN, shape: "average" } } as never, kit)).H));
});

// ---- the camera's ease -----------------------------------------------------------------------

const A: CamState = { eye: [0, 1, 4], target: [0, 1, 0], fov: 0.5 }, B: CamState = { eye: [0, 2, 8], target: [1, 1, 0], fov: 0.4 };

test("the camera eases to a target in about the time asked for, and cuts when asked to", () => {
  assert.equal(stepCam(A, B, 16, 0), B);
  assert.equal(stepCam(A, B, 450, 450), B, "a long gap since the last step: it is there");
  assert.equal(stepCam(B, B, 16, 450), B, "nothing to do when it is there already");
  let c = A, t = 0, moved = 0;
  for (; c !== B && t < 2000; t += 16) { const n = stepCam(c, B, 16, 450); assert.ok(n.eye[2] >= c.eye[2], "it only moves towards the target"); moved += n.eye[2] - c.eye[2]; c = n; }
  assert.equal(c, B);
  assert.ok(t > 400 && t < 800, `arrived after ${t} ms`);
  assert.ok(Math.abs(moved - 4) < 0.01);
  // the same path whatever the frame rate
  const at = (dt: number) => { let q = A; for (let i = 0; i < 200 / dt; i++) q = stepCam(q, B, dt, 450); return q.eye[2]; };
  assert.ok(Math.abs(at(8) - at(40)) < 0.01, "frame-rate independent");
});

test("a target that moves every frame is followed, never stalled or jumped to", () => {
  // a height slider dragged for a second: the target slides 0.3 m, a step per 16 ms frame
  let cam = A, worst = 0, prev = 0;
  for (let i = 0; i <= 60; i++) {
    const target: CamState = { ...A, eye: [0, 1 + 0.3 * i / 60, 4], target: [0, 1 + 0.3 * i / 60, 0] };
    cam = stepCam(cam, target, 16, 450);
    const lag = target.eye[1] - cam.eye[1];
    worst = Math.max(worst, lag);
    assert.ok(cam.eye[1] >= prev - 1e-9, "it never goes back");
    prev = cam.eye[1];
  }
  assert.ok(worst < 0.05, `lags ${worst.toFixed(3)} m behind a 0.3 m/s target`);
  assert.ok(cam.eye[1] > 1.2, "and is well on its way at the end of the drag");
  // let go: it arrives within half a second
  const final: CamState = { ...A, eye: [0, 1.3, 4], target: [0, 1.3, 0] };
  let t = 0;
  while (cam !== final && t < 1000) { cam = stepCam(cam, final, 16, 450); t += 16; }
  assert.equal(cam, final);
  assert.ok(t <= 500, `settled ${t} ms after the last change`);
});

// ---- the atlas layout and the face slots ------------------------------------------------------

test("shelf packing places every cell apart from the others and from the edge", () => {
  const R = rng("atlas"), cells = Array.from({ length: 70 }, () => ({ w: R.int(8, 220), h: R.int(8, 300) }));
  const size = 1024, pad = 6, { slots, layers } = packShelves(cells, size, pad);
  assert.equal(slots.length, cells.length);
  cells.forEach((c, i) => {
    const s = slots[i];
    assert.ok(s.x >= pad && s.y >= pad && s.x + c.w + pad <= size && s.y + c.h + pad <= size, `cell ${i} inside its layer`);
    assert.ok(s.layer >= 0 && s.layer < layers);
  });
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    const a = slots[i], b = slots[j];
    if (a.layer !== b.layer) continue;
    const apart = a.x + cells[i].w + pad <= b.x || b.x + cells[j].w + pad <= a.x || a.y + cells[i].h + pad <= b.y || b.y + cells[j].h + pad <= a.y;
    assert.ok(apart, `cells ${i} and ${j} keep ${pad}px apart`);
  }
  // a shelf wastes little: the layers are mostly full
  const used = cells.reduce((s, c) => s + c.w * c.h, 0);
  assert.ok(used / (layers * size * size) > 0.45, `layers are ${(used / (layers * size * size) * 100).toFixed(0)}% full`);
  assert.deepEqual(packShelves(cells, size, pad), { slots, layers }, "deterministic");
});

test("packing refuses a piece that cannot fit, and an empty atlas has no layers", () => {
  assert.throws(() => packShelves([{ w: 1100, h: 10 }], 1024), /too large/);
  assert.throws(() => packShelves([{ w: 1013, h: 10 }], 1024), /too large/);
  assert.doesNotThrow(() => packShelves([{ w: 1012, h: 1012 }], 1024));
  assert.deepEqual(packShelves([], 1024), { slots: [], layers: 0 });
});

test("face slots follow the cast, within bounds", () => {
  assert.equal(faceSlots(1), 1);
  assert.equal(faceSlots(4), 4);
  assert.equal(faceSlots(MAX_FACES), MAX_FACES);
  assert.equal(faceSlots(40), MAX_FACES);
  for (const bad of [0, -2, NaN, 0.4]) assert.equal(faceSlots(bad), 1);
  assert.equal(faceSlots(2.7), 2);
});

test("texture memory counts a third more for the mips", () => {
  assert.equal(textureBytes(1024, 1), Math.round(1024 * 1024 * 4 * 4 / 3));
  assert.equal(textureBytes(2048, 2), textureBytes(1024, 8));
  // one lone actor: two 1024 layers and one 512 face slot, against the old 2048 layer and twelve slots
  const lone = textureBytes(1024, 2) + textureBytes(512, 1), old = textureBytes(2048, 1) + textureBytes(512, 12);
  assert.ok(lone < old / 3, `${(lone / 1e6).toFixed(1)} MB against ${(old / 1e6).toFixed(1)} MB`);
});

// ---- the queue of looks ------------------------------------------------------------------------

test("the last look asked for wins, and every caller hears when it is on screen", async () => {
  const q = new Latest<string, number>();
  const seen: number[] = [], heard: number[] = [];
  const ps = [1, 2, 3].map(v => q.put("me", v).then(() => heard.push(v)));
  assert.equal(q.size, 1);
  q.drain((k, v) => { seen.push(v); });
  await Promise.all(ps);
  assert.deepEqual(seen, [3]);
  assert.deepEqual(heard.sort(), [1, 2, 3]);
  assert.equal(q.size, 0);
  // nothing queued: nothing to apply
  q.drain(() => assert.fail("empty"));
});

test("different actors each keep their last look, oldest first", () => {
  const q = new Latest<string, string>(), seen: string[] = [];
  q.put("a", "a1"); q.put("b", "b1"); q.put("a", "a2");
  q.drain((k, v) => seen.push(`${k}=${v}`));
  assert.deepEqual(seen, ["a=a2", "b=b1"]);
});

test("a look that fails to apply still lets its callers go, and the others are applied", async () => {
  const q = new Latest<string, number>(), seen: string[] = [];
  const p1 = q.put("a", 1), p2 = q.put("b", 2);
  assert.throws(() => q.drain((k, v) => { if (k === "a") throw new Error("boom"); seen.push(k + v); }), /boom/);
  await Promise.all([p1, p2]);
  assert.deepEqual(seen, ["b2"]);
  // and it can be used again
  q.put("a", 3); q.drain((k, v) => seen.push(k + v));
  assert.deepEqual(seen, ["b2", "a3"]);
});

test("clearing the queue releases its callers without applying anything", async () => {
  const q = new Latest<string, number>(), p = q.put("a", 1);
  q.clear();
  await p;
  assert.equal(q.size, 0);
  q.drain(() => assert.fail("cleared"));
});

test("a look put without waiting is kept for later, and its caller is not held", async () => {
  const q = new Latest<string, number>(), seen: number[] = [];
  await q.put("a", 1, false);
  assert.equal(q.size, 1, "the look is queued");
  const p = q.put("a", 2);
  await q.put("a", 3, false);
  q.drain((k, v) => seen.push(v));
  await p;
  assert.deepEqual(seen, [3]);
});

// ---- a stage on a fake page ----------------------------------------------------------------------

/** Anything: callable, any property is another one, anything assigned is ignored (a 2D context). */
const ghost = (): any => new Proxy(function () {}, { get: (_t, k) => (k === "then" ? undefined : k === Symbol.toPrimitive ? () => 0 : ghost()), set: () => true, apply: () => ghost() });

interface Page {
  stage: Stage;
  el: HTMLElement;
  /** What the GL context was asked to create and delete, and whether it was told to let go. */
  gl: { textures: number; deleted: number; released: number };
  /** Run the animation frames asked for so far, `ms` later than the last. */
  frame(ms?: number): void;
  /** `n` frames of 16 ms. */
  frames(n: number): void;
  hide(on: boolean): void;
  /** The stage's element scrolls out of view (or back in). */
  inView(on: boolean): void;
  /** The browser's GL context events. */
  lose(): void;
  restore(): void;
  warned: unknown[][];
  contexts: boolean[];
  canvasRemoved: () => boolean;
  done(): void;
}

/** A page with a stage on it. `webgl: false` gives a canvas without a WebGL2 context. */
function page(o: { w?: number; h?: number; webgl?: boolean; alpha?: boolean; kit?: Kit; idleTimeout?: number } = {}): Page {
  const g = globalThis as Record<string, unknown>, keep: Record<string, PropertyDescriptor | undefined> = {};
  const set = (k: string, v: unknown) => { keep[k] = Object.getOwnPropertyDescriptor(g, k); Object.defineProperty(g, k, { value: v, configurable: true, writable: true }); };
  let clock = 5000, nextRaf = 1;
  const rafs = new Map<number, (t: number) => void>(), visListeners: (() => void)[] = [], gl = { textures: 0, deleted: 0, released: 0 };
  const glx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => {
      if (typeof k !== "string") return undefined;
      if (k === "getShaderParameter" || k === "getProgramParameter") return () => true;
      if (k === "createTexture") return () => { gl.textures++; return {}; };
      if (k === "deleteTexture") return () => { gl.deleted++; };
      if (k === "getExtension") return () => ({ loseContext() { gl.released++; } });
      return /^[A-Z][A-Z0-9_]+$/.test(k) ? 1 : () => ({});
    },
  });
  const canvases: any[] = [];
  const makeCanvas = () => {
    const L: Record<string, ((e: unknown) => void)[]> = {};
    const cv: any = {
      width: 300, height: 150, style: {}, removed: false, setAttribute() {}, remove() { cv.removed = true; },
      getContext: (type: string) => (type === "webgl2" ? (o.webgl === false ? null : glx) : ghost()),
      addEventListener: (n: string, f: (e: unknown) => void) => { (L[n] ??= []).push(f); },
      removeEventListener: (n: string, f: (e: unknown) => void) => { L[n] = (L[n] ?? []).filter(x => x !== f); },
      emit: (n: string) => { for (const f of L[n] ?? []) f({ preventDefault() {} }); },
    };
    canvases.push(cv);
    return cv;
  };
  const document: any = { hidden: false, createElement: makeCanvas, addEventListener: (n: string, f: () => void) => { if (n === "visibilitychange") visListeners.push(f); }, removeEventListener() {} };
  let io: ((es: { isIntersecting: boolean }[]) => void) | null = null;
  set("document", document); set("window", { devicePixelRatio: 1 });
  set("ResizeObserver", class { observe() {} disconnect() {} });
  set("IntersectionObserver", class { constructor(cb: typeof io) { io = cb; } observe() {} disconnect() {} });
  set("requestAnimationFrame", (cb: (t: number) => void) => { rafs.set(nextRaf, cb); return nextRaf++; });
  set("cancelAnimationFrame", (id: number) => { rafs.delete(id); });
  set("performance", { now: () => clock });
  const warned: unknown[][] = [], warn = console.warn;
  console.warn = (...a: unknown[]) => { warned.push(a); };
  const el = { clientWidth: o.w ?? 330, clientHeight: o.h ?? 520, append() {}, addEventListener() {}, removeEventListener() {} } as unknown as HTMLElement;
  const contexts: boolean[] = [];
  const stage = new Stage(el, { kit: o.kit ?? kit, bubbles: false, alpha: o.alpha, idleTimeout: o.idleTimeout, onContext: l => contexts.push(l) });
  const frame = (ms = 16) => { clock += ms; const q = [...rafs]; rafs.clear(); for (const [, cb] of q) cb(clock); };
  return {
    stage, el, gl, frame, warned, contexts, frames: n => { for (let i = 0; i < n; i++) frame(); },
    hide: on => { document.hidden = on; for (const f of visListeners) f(); },
    inView: on => io?.([{ isIntersecting: on }]),
    lose: () => canvases[0].emit("webglcontextlost"), restore: () => canvases[0].emit("webglcontextrestored"),
    canvasRemoved: () => canvases[0].removed,
    done: () => {
      stage.destroy(); console.warn = warn;
      for (const k of Object.keys(keep)) { const d = keep[k]; if (d) Object.defineProperty(g, k, d); else delete g[k]; }
    },
  };
}

/** Run `fn` on a page, and always put the globals back. */
async function onPage(o: Parameters<typeof page>[0], fn: (p: Page) => void | Promise<void>) {
  const p = page(o);
  try { await fn(p); } finally { p.done(); }
}

const STUDIO: StudioOptions = { trusted: true };
/** A promise that must settle without a frame being run: it fails the test instead of hanging it. */
const promptly = (p: Promise<void>) => Promise.race([p, new Promise<void>((_, no) => setTimeout(() => no(new Error("still waiting for a frame")), 50))]);
const actorOf = (s: Stage, id = "me") => (s as unknown as { actors: Map<string, { puppet: { avatar: AvatarDoc; body: { H: number } }; grips: Record<string, [number, number, number]> }> }).actors.get(id)!;
const camOf = (p: Page) => lens(p.stage.cam, p.stage.aspect);

test("a lone actor shows up in a few small textures, and the stage says how many", () => onPage({}, p => {
  assert.equal(p.stage.webgl, true);
  assert.equal(p.stage.studio(NIMA, STUDIO), "me");
  const { layers, texKB } = p.stage.stats;
  assert.ok(layers >= 1 && layers <= 2, `${layers} layer(s) of 1024`);
  assert.ok(texKB < 14000, `${texKB} KB of textures, against about 39 MB for a 2048 layer and twelve face slots`);
  // the smaller bodies have less to draw
  p.stage.studio(docOf("toddler"), STUDIO);
  assert.equal(p.stage.stats.layers, 1);
  assert.ok(p.stage.stats.texKB < 8000);
}));

test("through the stage, a shorter body is smaller in the same frame", () => onPage({}, p => {
  const sizes: number[] = [];
  p.stage.studio(docOf("adult", 0), STUDIO);
  for (const h of [0, 0.5, 1]) {
    p.stage.setAvatar("me", docOf("adult", h));
    p.frames(3);
    const H = actorOf(p.stage).puppet.body.H / 100, at = camOf(p);
    sizes.push(at(0, H)[1] - at(0, 0)[1]);
  }
  assert.ok(sizes[0] < sizes[1] && sizes[1] < sizes[2], `the figure grows with the slider: ${sizes.map(s => s.toFixed(3)).join(", ")}`);
  const H0 = kit.body(docOf("adult", 0).body).H, H1 = kit.body(docOf("adult", 1).body).H;
  assert.ok(Math.abs(sizes[0] / sizes[2] - H0 / H1) < 0.03, "by as much as the body does");
}));

test("a height slider dragged in the bust frame keeps the head in view all the way", () => onPage({}, p => {
  for (const framing of ["bust", "head"] as const) {
    p.stage.studio(docOf("adult", 0), { ...STUDIO, framing });
    p.frames(2);
    for (let i = 0; i <= 60; i++) {
      p.stage.setAvatar("me", docOf("adult", i / 60));
      p.frame();
      const H = actorOf(p.stage).puppet.body.H / 100, [, top] = camOf(p)(0, H);
      assert.ok(top < 1, `${framing}: the crown is in view at step ${i} (${top.toFixed(3)})`);
    }
  }
}));

test("swaps asked for in one frame build once, the last look winning, and the caller hears", async () => onPage({}, async p => {
  p.stage.studio(NIMA, STUDIO);
  p.frame();
  const before = p.stage.stats.swaps;
  const ps = [0.1, 0.4, 0.8].map(h => p.stage.setAvatar("me", docOf("adult", h)));
  p.frame();
  await Promise.all(ps);
  assert.equal(p.stage.stats.swaps, before + 1);
  assert.equal(actorOf(p.stage).puppet.avatar.body.height, 0.8);
  // the same look again builds nothing
  const same = p.stage.setAvatar("me", docOf("adult", 0.8));
  p.frame();
  await same;
  assert.equal(p.stage.stats.swaps, before + 1);
}));

test("a look is untrusted unless the call says otherwise, whatever the actor wore before", async () => onPage({}, async p => {
  const hex: AvatarDoc = { ...NIMA, skin: "#FF00FF", hair: { style: "hair_short", color: "#00FF00" } };
  p.stage.studio(NIMA, STUDIO);                 // the authors' cast: trusted
  p.stage.setAvatar("me", ISMAIL, { trusted: true }); p.frame();
  assert.equal(actorOf(p.stage).puppet.avatar.facialHair?.color, "#4A4440", "an author's hex colour is allowed when the call says so");
  p.stage.setAvatar("me", hex); p.frame();
  assert.notEqual(actorOf(p.stage).puppet.avatar.skin, "#FF00FF");
  assert.notEqual(actorOf(p.stage).puppet.avatar.hair.color, "#00FF00");
  // and a stage that loaded a trusted cast does not pass its trust on
  p.stage.load({ v: 1, cues: [] }, { cast: { me: NIMA }, places: {} });
  p.stage.setAvatar("me", hex); p.frame();
  assert.notEqual(actorOf(p.stage).puppet.avatar.skin, "#FF00FF");
}));

test("a stage that is not on screen takes a look at once and builds it when it is shown", async () => onPage({}, async p => {
  p.stage.studio(NIMA, STUDIO);
  p.frames(2);
  for (const [away, back] of [[() => p.hide(true), () => p.hide(false)], [() => p.inView(false), () => p.inView(true)]]) {
    const n = p.stage.stats.swaps;
    away();
    assert.equal(p.stage.shown, false);
    // the caller is not left waiting for a frame that will not come
    await promptly(p.stage.setAvatar("me", docOf("adult", 0.9)));
    await promptly(p.stage.setAvatar("me", docOf("elder", 0.1)));
    p.frames(3);
    assert.equal(p.stage.stats.swaps, n, "nothing is built while it cannot be seen");
    back();
    assert.equal(p.stage.shown, true);
    p.frames(3);
    assert.equal(p.stage.stats.swaps, n + 1, "one build for the last look");
    assert.equal(actorOf(p.stage).puppet.avatar.body.build, "elder");
    p.stage.setAvatar("me", NIMA); p.frames(2);
  }
}));

test("a lost context is reported, keeps the last look asked for, and everything comes back", async () => onPage({}, async p => {
  p.stage.studio(NIMA, STUDIO);
  p.stage.mood("me", "happy");
  p.frames(3);
  const lonely = p.gl.textures;
  p.lose();
  assert.equal(p.stage.lost, true);
  assert.deepEqual(p.contexts, [true]);
  p.frames(2);
  await promptly(p.stage.setAvatar("me", docOf("child", 0.3)));   // does not wait for a GPU that is gone
  p.frames(2);
  assert.equal(actorOf(p.stage).puppet.avatar.body.build, "adult", "not built while the GPU is away");
  p.restore();
  assert.equal(p.stage.lost, false);
  assert.deepEqual(p.contexts, [true, false]);
  assert.ok(p.gl.textures > lonely, "the textures were made again");
  p.frames(3);
  assert.equal(actorOf(p.stage).puppet.avatar.body.build, "child", "the look asked for meanwhile is on");
}));

test("transparent canvases need alpha; without it the sky is drawn, and the stage says so", () => onPage({ alpha: false }, p => {
  assert.equal(p.stage.alpha, false);
  p.stage.studio(NIMA, { ...STUDIO, backdrop: "none" });
  assert.equal(p.warned.length, 1);
  assert.match(String(p.warned[0][0]), /alpha: true/);
  assert.equal(p.stage.r!.transparent, false);
  p.stage.setBackdrop("none");
  assert.equal(p.warned.length, 2);
  assert.equal(p.stage.r!.transparent, false);
}));

test("with alpha, a backdrop of none is a transparent canvas, and the wall comes and goes without a restart", () => onPage({ alpha: true }, p => {
  assert.equal(p.stage.alpha, true);
  p.stage.studio(NIMA, { ...STUDIO, backdrop: "none" });
  p.stage.mood("me", "happy"); p.frames(2);
  assert.equal(p.stage.r!.transparent, true);
  assert.equal(p.warned.length, 0);
  const perf = p.stage.perf;
  p.stage.setBackdrop("wall"); p.frame();
  assert.equal(p.stage.r!.transparent, false);
  assert.equal(p.stage.perf, perf, "the performance goes on");
  assert.equal(p.stage.stats.layers >= 1, true);
  p.stage.setBackdrop("none"); p.frame();
  assert.equal(p.stage.r!.transparent, true);
}));

test("pointing aims aside, clear of the face, and an unknown actor is a warning, not an error", () => onPage({}, p => {
  p.stage.studio(NIMA, STUDIO);
  const cues: unknown[] = [], act = p.stage.act.bind(p.stage);
  p.stage.act = (c => { cues.push(c); return act(c); }) as Stage["act"];
  p.stage.gesture("me", "point");
  p.stage.gesture("me", "wave");
  p.stage.gesture("me", "point", { at: "viewer" });
  assert.deepEqual(cues.map(c => (c as { beat: { at?: string } }).beat.at), ["mark:aside", undefined, "viewer"]);
  // the hand never crosses the head while it points
  const run = p.stage.gesture("me", "point"), a = actorOf(p.stage), d = dimsOf(NIMA);
  for (let t = 0; t <= run.dur; t += 40) {
    run.seek(t);
    for (const g of Object.values(a.grips)) assert.ok(Math.abs(g[0]) * 100 > d.headHalf! + 4 || g[1] * 100 < d.H - d.headH * 1.25, `the hand at ${t} ms is away from the head (${(g[0] * 100).toFixed(0)}, ${(g[1] * 100).toFixed(0)} cm)`);
  }
  // an actor that is not there: nothing happens, and the caller can wait for it all the same
  assert.equal(p.stage.flip("nobody").dur, 0);
  assert.equal(p.stage.mood("nobody", "happy").dur >= 0, true);
  assert.equal(p.warned.length, 1);
  assert.match(String(p.warned[0]), /no actor/);
}));

test("flip turns to the back and returns", () => onPage({}, async p => {
  p.stage.studio(NIMA, STUDIO);
  const turn = p.stage.flip("me");
  assert.ok(turn.dur > 0);
  turn.finish();
  assert.ok(Math.cos(p.stage.world().actors.me.yaw) < 0, "showing the back");
  p.stage.flip("me").finish();
  assert.ok(Math.cos(p.stage.world().actors.me.yaw) > 0, "and the front again");
}));

test("destroy frees every texture, gives the context back, and takes the canvas off the page", () => onPage({}, p => {
  p.stage.studio(NIMA, STUDIO);
  p.stage.setAvatar("me", ISMAIL, STUDIO); p.frames(3);
  assert.ok(p.gl.textures > 0);
  p.stage.destroy();
  assert.equal(p.gl.deleted, p.gl.textures, "every texture made was deleted");
  assert.equal(p.gl.released, 1);
  assert.equal(p.canvasRemoved(), true);
  // nothing runs afterwards, and asking again is harmless
  p.stage.destroy();
  return p.stage.setAvatar("me", NIMA);
}));

// ---- costumes (a wardrobe on the actor's own body) -------------------------------------------------

type Art = { puppet: ReturnType<typeof compose>; rects: Map<unknown, object> };
const artOf = (s: Stage, id = "me") => (s as unknown as { actors: Map<string, Art & { costumes: Map<string, Art> }> }).actors.get(id)!;
const ROOM: PlaceDoc = { v: 1, id: "room", size: { w: 4, d: 3 }, marks: { here: { x: 0, z: 0 } }, pieces: [] };
/** A cast of Nima with İsmail's clothes (on a rounder, shorter body, with his skin, hair and moustache) as the costume `shop`, and one that throws as it is read; one cue per costume key. */
function dressed(p: Page, keys: (string | undefined)[]) {
  const bad = Object.defineProperty({ ...NIMA }, "outfit", { enumerable: true, get() { throw new Error("torn"); } });
  p.stage.load({ v: 1, cues: keys.map(k => ({ scene: { place: "room", at: { me: "here" }, ...(k === undefined ? {} : { costume: { me: k } }) } })) },
    { cast: { me: NIMA }, wardrobe: { me: { shop: ISMAIL, bad } }, places: { room: ROOM }, atlas: 1024 });
}

test("a costume is composed on the actor's own body: its clothes, the cast document's body, skin, face and hair", () => onPage({}, p => {
  dressed(p, [undefined]);
  const a = artOf(p.stage), c = a.costumes.get("shop")!;
  assert.deepEqual([...a.costumes.keys()], ["shop"], "the costume that cannot be read is left out");
  assert.ok(p.warned.some(w => /costume not applied/.test(String(w[0])) && w[2] === "bad"));
  for (const k of ["body", "skin", "face", "hair", "facialHair", "custom"] as const) assert.deepEqual(c.puppet.avatar[k], a.puppet.avatar[k], k);
  assert.equal(c.puppet.avatar.facialHair, undefined, "İsmail's moustache stays his");
  assert.equal(c.puppet.avatar.outfit.top.id, "top_shirt_rolled");
  assert.equal(c.puppet.avatar.wear?.waist?.id, "apron_shop");
  assert.deepEqual(c.puppet.bones, a.puppet.bones);
  assert.equal(c.puppet.body.H, a.puppet.body.H);
}));

test("the frame's costume key picks the clothes drawn, and an unknown key draws the cast document", () => onPage({}, p => {
  dressed(p, [undefined, "shop", "nope", ""]);
  const r = p.stage.r!, quad = r.quad.bind(r), drawn = new Set<object>();
  r.quad = ((...q: Parameters<typeof r.quad>) => { drawn.add(q[1]); return quad(...q); }) as typeof r.quad;
  const draw = (i: number) => { drawn.clear(); p.stage.show(i); return new Set(drawn); };
  const a = artOf(p.stage), mine = new Set(a.rects.values()), shop = new Set(a.costumes.get("shop")!.rects.values());
  const [cast, worn, unknown, back] = [0, 1, 2, 3].map(draw);
  assert.equal(p.stage.frame!.actors.me.costume, "");
  assert.ok(cast.size > 5 && [...cast].every(x => mine.has(x) || !shop.has(x)), "the cast document's pieces");
  assert.ok([...worn].some(x => !mine.has(x)), "the costume's own pieces (the apron, the rolled sleeves)");
  assert.ok([...cast].some(x => mine.has(x) && !shop.has(x) && !worn.has(x)), "and not the cast document's shirt");
  assert.ok([...worn].some(x => mine.has(x) && shop.has(x)), "a piece both share (the head) has one cell");
  assert.deepEqual(unknown, cast, "an unknown key: the cast document");
  assert.deepEqual(back, cast, '"" changes back');
}));

test("a costume fits the texture budget, and a new look clears the wardrobe made on the old body", () => onPage({}, p => {
  dressed(p, [undefined, "shop"]);
  const { layers, texKB } = p.stage.stats;
  assert.ok(layers >= 1 && layers <= 2, `${layers} layer(s) of 1024`);
  assert.ok(texKB < 14000, `${texKB} KB of textures`);
  p.stage.setAvatar("me", docOf("adult", 0.9)); p.frame();
  assert.equal(artOf(p.stage).puppet.avatar.body.height, 0.9);
  assert.equal(artOf(p.stage).costumes.size, 0);
}));

// ---- text on props (DESIGN.md §6.8) ---------------------------------------------------------------

/** A sign whose `label` is its text, and a phone with a self-lit screen (its first flat, so it shows in a hand). */
const SIGN: PieceDef = { draw: p => ({ flats: [{ group: { shapes: [{ path: rect(-20, -30, 40, 30), fill: "#F4EAD2" }] }, ppcm: 2, text: [{ text: String(p.label ?? ""), x: -18, y: -28, w: 36, h: 26, font: "hand" }] }] }) };
const PHONE: PieceDef = { draw: () => ({ flats: [{ group: { shapes: [{ path: rect(-4, -15, 8, 15), fill: "#222222" }] }, ppcm: 5, text: [{ text: "Anne", x: -3.5, y: -14, w: 7, h: 12, lit: 0, font: "screen" }] }] }) };
const TEXT_KIT: Kit = { ...kit, props: { ...kit.props, t_sign: SIGN, t_phone: PHONE } };
const SHOP: PlaceDoc = { v: 1, id: "shop", size: { w: 4, d: 3 }, marks: { here: { x: 0, z: 0 } }, pieces: [], props: {
  sign: { kit: "t_sign", at: { x: -0.6, y: 0.8, z: -0.2 }, label: "Ekmek 10 TL" },
  phone: { kit: "t_phone", at: { x: 0.25, y: 0.9, z: 0.1 } },
  gone: { kit: "t_sign", at: { x: 0.8, y: 0.8, z: -0.2 }, label: "Süt" },
  unseen: { kit: "t_sign", at: { x: 1.2, y: 0.8, z: -0.2 }, label: "Yok", shown: false },
} };
/** Nima in the shop; then he takes the phone and the milk sign goes (a dashed outline). */
function textScene(p: Page) {
  p.stage.load({ v: 1, cues: [{ scene: { place: "shop", at: { me: "here" } } }, { beat: { who: "me", obj: [{ id: "phone", op: "take" }, { id: "gone", op: "hide" }] } }] },
    { cast: { me: NIMA }, places: { shop: SHOP }, atlas: 1024 });
}

test("the stage records where it drew each text flat: a lying sign, a phone in a hand at its grip, not a hidden or ghost one", () => onPage({ kit: TEXT_KIT }, p => {
  textScene(p);
  p.stage.show(0);
  assert.deepEqual(p.stage.texts.map(t => t.target).sort(), ["obj:gone", "obj:phone", "obj:sign"], "everything lying and shown");
  p.stage.show(1);
  const texts = p.stage.texts, by = (t: string) => texts.filter(x => x.target === t);
  assert.deepEqual(texts.map(t => t.target).sort(), ["obj:phone", "obj:sign"], "not the ghost, nor the one never shown");
  const sign = by("obj:sign")[0];
  assert.deepEqual(sign.O, [-0.6, 0.8, -0.2]);
  assert.deepEqual([sign.R, sign.D].map(v => v.map(x => +x.toFixed(9))), [[0.01, 0, 0], [0, -0.01, 0]]);
  assert.equal(sign.spec.text![0].text, "Ekmek 10 TL");
  // the phone: its origin in the grip (a little down the hand), along the actor's own axes
  const ph = by("obj:phone")[0], hold = p.stage.frame!.props.phone.holder!, a = actorOf(p.stage), handL = (a.puppet.body as unknown as { handL: number }).handL;
  assert.equal(hold.actor, "me");
  const want = a.grips[hold.side].map((v, i) => v + ph.D[i] * handL * 0.3);
  assert.ok(Math.hypot(...ph.O.map((v, i) => v - want[i])) < 1e-9, `the phone at the grip: ${ph.O} vs ${want}`);
  assert.ok(Math.abs(Math.hypot(...ph.R) - 0.01) < 1e-9 && Math.abs(Math.hypot(...ph.D) - 0.01) < 1e-9, "metres per cm");
  // a new frame starts afresh
  p.stage.show(0);
  assert.equal(p.stage.texts.filter(t => t.target === "obj:phone").length, 1);
}));

test("a held prop goes under its arm and hand; a `front` one (a sign shown) over the figure, with the fist again round its stick", async () => {
  const FRONT: Kit = { ...TEXT_KIT, props: { ...TEXT_KIT.props, t_phone: { draw: (q, r, k) => { const o = PHONE.draw(q, r, k); o.flats[0].front = true; return o; } } } };
  const order = async (k: Kit) => { let out = { after: false, fist: false }; await onPage({ kit: k }, p => {
    textScene(p);
    const r = p.stage.r!, quad = r.quad.bind(r), seq: object[] = [];
    r.quad = ((...q: Parameters<typeof r.quad>) => { seq.push(q[1]); return quad(...q); }) as typeof r.quad;
    p.stage.show(1);
    const art = (p.stage as unknown as { propArt: Map<string, { rects: object[] }> }).propArt;
    const side = p.stage.frame!.props.phone.holder!.side, rects = (actorOf(p.stage) as unknown as { rects: Map<{ bone: string }, object> }).rects;
    const body = new Set<object>(), fist = new Set<object>();
    for (const [it, rect] of rects) (it.bone === "hand_" + side ? fist : body).add(rect);
    const phone = art.get([...art.keys()].find(x => x.includes("t_phone") && x.endsWith("|held"))!)!.rects[0], at = seq.indexOf(phone);
    assert.ok(at >= 0, "the phone is drawn");
    out = { after: at > seq.reduce((m, x, i) => (body.has(x) ? i : m), -1), fist: seq.slice(at + 1).some(x => fist.has(x)) };
  }); return out; };
  assert.equal((await order(TEXT_KIT)).after, false, "cradled: the arm and hand come after it");
  assert.deepEqual(await order(FRONT), { after: true, fist: true }, "shown: over the whole figure, then the holding hand round it");
});

test("a recorded text's centre maps through flatMatrix to stage.project", () => onPage({ kit: TEXT_KIT }, p => {
  textScene(p);
  p.stage.show(1);
  const { cam, aspect, cssSize } = p.stage, vp = mat4Mul(perspective(cam.fov, aspect, NEAR, FAR), lookAt(cam.eye, cam.target));
  for (const r of p.stage.texts) for (const t of r.spec.text!) for (const k of [2, 5.66, 40]) {
    const m = flatMatrix(vp, cssSize, r, t, k);
    assert.ok(m, r.target);
    const v = m.slice(9, -1).split(",").map(Number), X = t.w * k / 2, Y = t.h * k / 2, w = v[3] * X + v[7] * Y + v[15];
    const got = [(v[0] * X + v[4] * Y + v[12]) / w, (v[1] * X + v[5] * Y + v[13]) / w];
    const c = [0, 1, 2].map(i => r.O[i] + r.R[i] * (t.x + t.w / 2) + r.D[i] * (t.y + t.h / 2)) as [number, number, number], want = p.stage.project(c)!;
    assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1]) < 0.001, `${r.target} @${k}: ${got} vs ${want}`);
  }
}));

// ---- kit puppets (DESIGN.md §5.4) ------------------------------------------------------------------

/** A tiny kit puppet: a body and a head, no hands, no face texture, eyes as art its pose switches (big while in the air); every pose input is kept. */
const posed: PoseInput[] = [];
const box = (w: number, h: number) => ({ shapes: [{ path: rect(-w / 2, -h, w, h), fill: "#8A7F8C" }] });
function tbird(k: Kit): KitPuppet {
  const body = { ...k.body({ build: "child", height: 0, shape: "average" }), H: 45, headH: 14, headW: 12, shoulderW: 20, legLen: 10, torsoL: 20 };
  const front: Item[] = [
    { layer: "body", bone: "body", group: box(24, 22), ppcm: 2 }, { layer: "head", bone: "head", group: box(12, 14), ppcm: 2 },
    { layer: "eyes", bone: "head", group: box(4, 3), ppcm: 2, alt: { key: "eyes", value: "calm", default: true } },
    { layer: "eyes", bone: "head", group: box(5, 5), ppcm: 2, alt: { key: "eyes", value: "big" } },
  ];
  return {
    kind: "test", body, views: { front, back: front }, gestures: { peck: { dur: 400, stroke: 200, keys: [], needs: ["target"] } },
    bones: [{ name: "root", parent: null, x: 0, y: 0, rot: 0 }, { name: "body", parent: "root", x: 0, y: -10, rot: 0 }, { name: "head", parent: "body", x: 0, y: -22, rot: 0 }],
    pose: i => { posed.push(i); return { pose: restPose(), alt: i.air ? { eyes: "big" } : {}, faces: [], faceOff: [0, 0], blink: 0, saccade: [0, 0] }; },
  };
}
const BIRD_KIT: Kit = { ...kit, puppets: { tbird } };
const PERCH: PlaceDoc = { v: 1, id: "perch", size: { w: 6, d: 3 }, pieces: [], marks: {
  here: { x: -1, z: 0 }, there: { x: 1.5, z: 0 }, ledge: { x: 1, y: 2, z: -1 }, sky: { x: -1, y: 1.5, z: 0, air: true },
} };
type Inside = { kit?: KitPuppet; slot: number; grips: object; talk?: object; rects: Map<Item, object>; puppet: { faceRegion?: unknown } };
const insideOf = (s: Stage, id: string) => (s as unknown as { actors: Map<string, Inside> }).actors.get(id);
const ctxOf = (s: Stage) => (s as unknown as { ctx: { puppets?: Record<string, { kind: string }>; heights: Record<string, number> } }).ctx;
/** The blobs (soft shadows) the next frames draw: where their middle is. */
function blobs(p: Page) {
  const r = p.stage.r!, cq = r.colorQuad.bind(r), out: Vec3[] = [];
  r.colorQuad = ((c, cols, mode, lit) => { if (mode === MODE.blob) out.push([(c[0][0] + c[1][0]) / 2, c[0][1], (c[0][2] + c[2][2]) / 2]); return cq(c, cols, mode, lit); }) as typeof r.colorQuad;
  return out;
}

test("a kit puppet draws with no hands or face; her shadow is on her ledge", () => onPage({ kit: BIRD_KIT }, p => {
  p.stage.load({ v: 1, cues: [{ scene: { place: "perch", at: { me: "here", kerim: "ledge" } } }, { scene: { place: "perch", at: { me: "here", kerim: "sky" } } }] },
    { cast: { me: NIMA, kerim: { puppet: "tbird" } }, places: { perch: PERCH }, atlas: 1024 });
  const b = insideOf(p.stage, "kerim")!, r = p.stage.r!, quad = r.quad.bind(r), drawn = new Set<object>();
  r.quad = ((...q: Parameters<typeof r.quad>) => { drawn.add(q[1]); return quad(...q); }) as typeof r.quad;
  assert.equal(b.kit?.kind, "test");
  assert.deepEqual(ctxOf(p.stage).puppets, { kerim: { kind: "test", gestures: b.kit!.gestures } }, "the director knows her kind and gestures");
  assert.equal(ctxOf(p.stage).heights.kerim, 0.45);
  assert.equal(r.faces.count, 1, "one face slot: Nima's");
  const shadows = blobs(p);
  posed.length = 0; drawn.clear();
  p.stage.show(0); p.frames(2);
  assert.equal(b.slot, -1, "no face slot");
  assert.equal(b.puppet.faceRegion, undefined);
  assert.deepEqual(b.grips, {}, "no hands, no grips");
  assert.ok(b.talk, "a bubble still has her head to sit over");
  const [eyes, big] = [...b.rects].filter(([it]) => it.alt).map(([, rc]) => rc);
  assert.ok(drawn.has(eyes) && !drawn.has(big), "her calm eyes, drawn as art");
  assert.ok(posed.length && posed.every(i => i.emo === "neutral" && i.talk === 0 && i.air === false && i.defs === b.kit!.gestures), "she poses herself, with her own gestures");
  assert.ok(shadows.some(q => Math.abs(q[1] - 2.004) < 1e-6 && Math.abs(q[0] - 1) < 1e-6 && Math.abs(q[2] + 1) < 1e-6), `her shadow on the ledge: ${JSON.stringify(shadows)}`);
  assert.ok(shadows.some(q => Math.abs(q[1] - 0.004) < 1e-6 && Math.abs(q[0] + 1) < 1e-6), "and Nima's on the floor");
  // in the air: no shadow, and her pose hears it
  shadows.length = 0; posed.length = 0; drawn.clear();
  p.stage.show(1);
  assert.ok(shadows.length === 1 && Math.abs(shadows[0][0] + 1) < 1e-6 && shadows[0][1] < 0.01, `only Nima's shadow: ${JSON.stringify(shadows)}`);
  assert.ok(posed.some(i => i.air) && drawn.has(big) && !drawn.has(eyes));
  // a gesture of hers that needs a target aims at the viewer
  const cues: unknown[] = [], act = p.stage.act.bind(p.stage);
  p.stage.act = (c => { cues.push(c); return { dur: 0 } as never; }) as Stage["act"];
  p.stage.gesture("kerim", "peck");
  assert.equal((cues[0] as { beat: { at?: string } }).beat.at, "viewer");
  p.stage.act = act;
  assert.equal(p.warned.length, 0, String(p.warned));
}));

test("an unknown puppet is a warning and the story plays", () => onPage({ kit: BIRD_KIT }, async p => {
  p.stage.load({ v: 1, cues: [{ scene: { place: "perch", at: { me: "here", ghost: "ledge" } } }, { line: { who: "me", text: "Merhaba!" } }, { beat: { who: "me", move: { who: "me", to: "there" } } }] },
    { cast: { me: NIMA, ghost: { puppet: "nobody" } }, places: { perch: PERCH }, atlas: 1024 });
  assert.equal(p.warned.length, 1);
  assert.match(String(p.warned[0]), /no puppet/);
  assert.equal(insideOf(p.stage, "ghost"), undefined, "she is left out");
  assert.equal(p.stage.perfs.length, 3);
  for (const i of [1, 2]) { const run = p.stage.play(i); p.frames(Math.ceil(run.dur / 16) + 2); await run.done; }
  assert.ok(Math.abs(p.stage.frame!.actors.me.pos[0] - 1.5) < 1e-6, "the story played to its end");
}));

test("a shot frames a perched actor where she is", () => onPage({}, p => {
  const place: PlaceDoc = { ...PERCH, marks: { ...PERCH.marks, high: { x: 0.5, y: 1.6, z: -0.5 } } };
  p.stage.load({ v: 1, cues: [{ scene: { place: "perch", at: { me: "high" } } }, { beat: { who: "me", cam: "single" } }] }, { cast: { me: NIMA }, places: { perch: place }, atlas: 1024 });
  p.stage.show(1);
  assert.equal(p.stage.frame!.shot.to.kind, "single");
  const H = actorOf(p.stage).puppet.body.H / 100, [w, h] = p.stage.cssSize;
  for (const y of [1.6 + H * 0.5, 1.6 + H]) {
    const q = p.stage.project([0.5, y, -0.5])!;
    assert.ok(q[0] > 0 && q[0] < w && q[1] > 0 && q[1] < h, `${y.toFixed(2)} m up is in the frame (${q.map(v => v.toFixed(0))})`);
  }
}));

test("follow keeps the moving actor in frame and settles", () => onPage({}, async p => {
  p.stage.load({ v: 1, cues: [{ scene: { place: "perch", at: { me: "here" } } }, { beat: { who: "me", move: { who: "me", to: "there" }, cam: "follow" } }] },
    { cast: { me: NIMA }, places: { perch: PERCH }, atlas: 1024 });
  p.stage.show(0); p.frame();
  const run = p.stage.play(1), [w, h] = p.stage.cssSize, H = actorOf(p.stage).puppet.body.H / 100, xs: number[] = [];
  assert.equal(p.stage.perf!.after.shot.kind, "follow");
  for (let i = 0; i < Math.ceil(run.dur / 16) + 60; i++) {
    p.frame();
    const a = p.stage.frame!.actors.me, q = p.stage.project([a.pos[0], a.pos[1] + H / 2, a.pos[2]])!;
    assert.ok(q[0] > w * 0.1 && q[0] < w * 0.9 && q[1] > 0 && q[1] < h, `frame ${i}: her middle is in view (${q.map(v => v.toFixed(0))})`);
    xs.push(p.stage.cam.target[0]);
  }
  await run.done;
  assert.ok(xs[xs.length - 1] > xs[0] + 1.5, "the camera went with her");
  assert.equal((p.stage as unknown as { camBusy: boolean }).camBusy, false, "and settled");
  assert.ok(Math.abs(p.stage.cam.target[0] - 1.5) < 0.05, `centred on where she stopped (${p.stage.cam.target[0].toFixed(3)})`);
  // Still cuts to her
  p.stage.setMotion("still");
  p.stage.show(0); p.frame();
  p.stage.play(1); p.frame();
  assert.ok(Math.abs(p.stage.cam.target[0] - 1.5) < 0.05);
  assert.equal((p.stage as unknown as { camBusy: boolean }).camBusy, false);
}));

test("setAvatar refuses a kit puppet", async () => onPage({ kit: BIRD_KIT }, async p => {
  p.stage.load({ v: 1, cues: [{ scene: { place: "perch", at: { me: "here", kerim: "ledge" } } }] }, { cast: { me: NIMA, kerim: { puppet: "tbird" } }, places: { perch: PERCH }, atlas: 1024 });
  const swaps = p.stage.stats.swaps;
  await promptly(p.stage.setAvatar("kerim", NIMA)); p.frames(2);
  await promptly(p.stage.setAvatar("me", { puppet: "tbird" } as never)); p.frames(2);
  assert.equal(p.stage.stats.swaps, swaps, "nothing swapped");
  assert.ok(insideOf(p.stage, "kerim")!.kit, "she is still herself");
  assert.equal(insideOf(p.stage, "me")!.kit, undefined, "and he himself");
  assert.equal(p.stage.studio({ puppet: "tbird" } as never), "me", "the studio shows no kit puppet");
  assert.ok(insideOf(p.stage, "kerim"), "and leaves the stage as it was");
  assert.equal(p.warned.length, 3);
  for (const w of p.warned) assert.match(String(w[0]), /kit puppet/);
}));

// ---- no WebGL2 ---------------------------------------------------------------------------------

test("a stage without WebGL2 is inert, not an error: the app shows a still instead", () => onPage({ webgl: false }, async p => {
  const doc = { v: 1, kit: "none" } as never, stage = p.stage;
  assert.equal(stage.webgl, false);
  assert.equal(p.warned.length, 1, "it says why, once");
  assert.equal(stage.r, null);
  assert.equal(stage.overlay, null);
  assert.equal(stage.lost, false);
  assert.equal(stage.alpha, false);
  assert.equal(stage.studio(doc), "me");
  await stage.setAvatar("me", doc);
  // every performance is over already, so a caller that waits for one does not hang
  for (const run of [stage.mood("me", "happy"), stage.gesture("me", "wave"), stage.flip("me"), stage.turnTo("me", 3), stage.play(0), stage.act({ beat: { who: "me", emo: "sad" } })]) {
    assert.equal(run.dur, 0);
    await run.done;
  }
  stage.setFraming("bust"); stage.setBackdrop("wall"); stage.resize(); stage.render(); stage.poke(); stage.show(0);
  p.frames(2);
  stage.destroy(); stage.destroy();
}));

// ---- the life of a place (DESIGN.md §6.9) -----------------------------------------------------------

/** A sign that goes 1 m to the right in 1 s and back to its start, and one that blinks. */
const MOVING_KIT: Kit = { ...kit, props: { ...kit.props,
  t_move: { draw: () => ({ flats: [{ group: { shapes: [{ path: rect(-20, -30, 40, 30), fill: "#F4EAD2" }] }, ppcm: 2, text: [{ text: "→", x: -18, y: -28, w: 36, h: 26 }], move: { path: { pts: [[0, 0, 0], [100, 0, 0]], ms: 1000 } } }] }) },
  t_blink: { draw: () => ({ flats: [{ group: { shapes: [{ path: rect(-5, -5, 10, 10), fill: "#FFE08A" }] }, ppcm: 2, text: [{ text: "•", x: -4, y: -4, w: 8, h: 8 }], move: { blink: { ms: 1000, on: 0.5 } } }] }) },
} };
const LIVE: PlaceDoc = { v: 1, id: "live", size: { w: 4, d: 3 }, marks: { here: { x: 0, z: 0 } }, pieces: [], props: {
  sign: { kit: "t_move", at: { x: 0, y: 1, z: -1 } }, lamp: { kit: "t_blink", at: { x: 1, y: 1, z: -1 } },
} };

test("a moving flat goes its way on the place's clock, and holds still in reduced motion", () => onPage({ kit: MOVING_KIT }, p => {
  p.stage.load({ v: 1, cues: [{ scene: { place: "live", at: {} } }] }, { cast: {}, places: { live: LIVE }, atlas: 1024 });
  p.stage.show(0);
  const x = () => p.stage.texts.find(t => t.target === "obj:sign")?.O[0], lit = () => p.stage.texts.some(t => t.target === "obj:lamp");
  const x0 = x()!;
  assert.ok(lit(), "the lamp starts on");
  p.frame(100); for (let i = 0; i < 15; i++) p.frame(16);
  const x1 = x()!;
  assert.ok(x1 > x0 + 0.25 && x1 < x0 + 0.5, `about a third of the way at ~340 ms: ${x0} → ${x1}`);
  for (let i = 0; i < 12; i++) p.frame(16);
  assert.ok(!lit(), "past half its period the lamp is off");
  // reduced motion: everything holds where it is
  p.stage.setMotion("still");
  p.frame(16); const held = x();
  for (let i = 0; i < 20; i++) p.frame(50);
  assert.equal(x(), held);
}));

// ---- one place at a time in the atlas (DESIGN.md §6.2) ------------------------------------------------

/** A room of a wall and a floor `w` cm wide; the third has a sign. */
const roomOf = (id: string, w: number, sign = false): PlaceDoc => ({ v: 1, id, size: { w: 4, d: 3 }, marks: { here: { x: 0, z: 0 } },
  pieces: [{ kit: "floor", x: 0, z: -1.4, w, d: 300 }, { kit: "wall", x: 0, z: -1.35, w, h: 250, tiles: 0 }],
  ...(sign ? { props: { sign: { kit: "t_sign", at: { x: 0, y: 0.8, z: -0.5 }, label: "Ev" } } } : {}) });
const ROOMS = { a: roomOf("a", 800), b: roomOf("b", 900), c: roomOf("c", 1000, true) };
type Placed = { sets: Map<string, { flats: { spec: { group: object }; rect: { u1: number } }[] }>; res: string[]; propArt: Map<string, { rects: unknown[] }> };
const placed = (s: Stage) => s as unknown as Placed;
/** Nima in three rooms, a cue in each between the cuts (2 and 4); every atlas made notes the art added to it, and the renderer each one it is given and every rect it draws. */
async function tour(p: Page, fn: (t: { uses: Atlas[]; holds: (pl: string) => boolean; drawn: Set<{ u1: number }>; idle: () => Promise<void> }) => Promise<void>) {
  const add0 = Atlas.prototype.add, added = new Map<Atlas, Set<object>>();
  Atlas.prototype.add = function (this: Atlas, g, ppcm, lazy) { let s = added.get(this); if (!s) added.set(this, s = new Set()); s.add(g); return add0.call(this, g, ppcm, lazy); };
  try {
    const r = p.stage.r!, use = r.use.bind(r), quad = r.quad.bind(r), uses: Atlas[] = [], drawn = new Set<{ u1: number }>();
    r.use = a => { uses.push(a); use(a); };
    r.quad = ((...q: Parameters<typeof r.quad>) => { drawn.add(q[1]); return quad(...q); }) as typeof r.quad;
    p.stage.load({ v: 1, cues: [
      { scene: { place: "a", at: { me: "here" } } }, { beat: { who: "me", emo: "happy" } },
      { scene: { place: "b", at: { me: "here" } } }, { beat: { who: "me", emo: "sad" } },
      { scene: { place: "c", at: { me: "here" } } }] }, { cast: { me: NIMA }, places: ROOMS, atlas: 1024 });
    // whether the atlas drawn from holds every flat of a place
    const holds = (pl: string) => placed(p.stage).sets.get(pl)!.flats.every(f => added.get(r.atlas)!.has(f.spec.group));
    await fn({ uses, holds, drawn, idle: () => new Promise(res => setTimeout(res, 150)) });
  } finally { Atlas.prototype.add = add0; }
}

test("the atlas holds the place on stage and the next; the next is drawn in idle time and is there at its cut", () => onPage({ kit: TEXT_KIT }, p => tour(p, async ({ uses, holds, drawn, idle }) => {
  const s = placed(p.stage), sign = () => s.propArt.get([...s.propArt.keys()].find(k => k.includes("sign"))!)!;
  assert.deepEqual(s.res, ["a", "b"]);
  assert.ok(holds("a") && holds("b") && !holds("c"), "the third room waits");
  assert.equal(sign().rects.length, 0, "and so does its sign");
  const lone = p.stage.stats.layers;
  // into b: nothing is drawn at the cut; c is drawn after it, swapped in once the cue is over, and a goes
  const cut = p.stage.play(2); p.frame();
  assert.equal(uses.length, 1, "no rebuild at the cut");
  await idle();
  assert.equal(uses.length, 1, "not while the cue plays");
  cut.finish();
  await idle();
  assert.equal(uses.length, 2);
  assert.deepEqual(s.res, ["b", "c"]);
  assert.ok(holds("b") && holds("c") && !holds("a"));
  assert.ok(sign().rects.length > 0);
  // into c: its art is there; nothing drawn at the cut points nowhere
  p.stage.play(3); const last = p.stage.play(4); drawn.clear(); p.frame();
  assert.equal(uses.length, 2, "no rebuild at the cut");
  assert.ok(drawn.size > 5 && [...drawn].every(x => x.u1 > 0), "every quad drawn has its cell");
  last.pause();
  await idle();
  assert.deepEqual(s.res, ["c"], "the last room alone");
  assert.ok(holds("c") && !holds("b"));
  assert.ok(p.stage.stats.layers <= lone);
})));

test("a cut before the next place is drawn draws it at once, never missing", () => onPage({ kit: TEXT_KIT }, p => tour(p, async ({ uses, holds, drawn }) => {
  p.stage.play(2); p.stage.play(4); drawn.clear(); p.frame();
  assert.equal(uses.length, 2, "drawn at the cut");
  assert.deepEqual(placed(p.stage).res, ["c"]);
  assert.ok(holds("c") && [...drawn].every(x => x.u1 > 0));
})));

test("after a change of place the hit tests' masks are the new atlas's, and a lost context brings back the place on stage", () => onPage({ kit: TEXT_KIT }, async p => {
  const told: number[] = [];
  p.stage.atlasHook = { layers: (_read, n) => { told.push(n); }, piece() {} } as AtlasHook;
  await tour(p, async ({ uses, holds, idle }) => {
    p.stage.play(2).finish(); p.frame();
    await idle();
    assert.equal(told.length, uses.length, "told of every atlas sent");
    assert.equal(told.at(-1), p.stage.stats.layers);
    assert.ok(placed(p.stage).sets.get("b")!.flats.every(f => f.rect.u1 > 0), "the flats on stage point into it");
    p.lose(); p.frames(2);
    p.restore();
    assert.equal(p.stage.lost, false);
    assert.deepEqual(placed(p.stage).res, ["b", "c"]);
    assert.ok(holds("b") && holds("c") && !holds("a"), "the place on stage and the next, not the first");
    assert.equal(told.length, uses.length);
  });
}));

// ---- the place's clock ----------------------------------------------------------

const clockPlace = (life?: "run"): PlaceDoc => ({ v: 1, id: "car", size: { w: 6, d: 3 }, pieces: [], marks: { here: { x: 0, z: 0 } }, ...(life ? { life } : {}) });
const lifeT = (s: Stage) => (s as unknown as { lifeT: number }).lifeT;

test("the place's clock runs while a cue plays, and stops a while after it when nothing happens", () => onPage({ idleTimeout: 1000 }, p => {
  p.stage.load({ v: 1, cues: [{ scene: { place: "car", at: { me: "here" } } }, { beat: { wait: 3000 } }] }, { cast: { me: NIMA }, places: { car: clockPlace() } });
  p.stage.play(1);
  p.frames(5);
  const a = lifeT(p.stage);
  p.frames(60);
  assert.ok(lifeT(p.stage) - a > 800, `ran through the cue (${lifeT(p.stage) - a} ms)`);
  p.frames(200);
  const b = lifeT(p.stage);
  p.frames(60);
  assert.equal(lifeT(p.stage), b, "stopped after the cue, with no input for longer than the idle timeout");
}));

test("a running place (a vehicle) keeps its clock going with no input; Still holds it", () => onPage({ idleTimeout: 1000 }, p => {
  p.stage.load({ v: 1, cues: [{ scene: { place: "car", at: { me: "here" } } }] }, { cast: { me: NIMA }, places: { car: clockPlace("run") } });
  p.stage.play(0);
  p.frames(300);
  const a = lifeT(p.stage);
  p.frames(60);
  assert.ok(lifeT(p.stage) - a > 500, `still running long after the cue (${lifeT(p.stage) - a} ms)`);
  p.stage.setMotion("still");
  p.frames(5);
  const b = lifeT(p.stage);
  p.frames(30);
  assert.equal(lifeT(p.stage), b, "Still holds it");
}));

test("lights_off dims the place's lamps and glow, and leaves the street's lit", () => onPage({}, p => {
  const room: PlaceDoc = { v: 1, id: "room", size: { w: 8, d: 4 }, marks: { here: { x: 0, z: 0 } },
    pieces: [{ kit: "street", x: 0, z: -6 }, { kit: "lamp", x: 0, y: 2.3, z: -1 }] };
  p.stage.load({ v: 1, cues: [{ scene: { place: "room", time: "night", at: { me: "here" } } }] }, { cast: { me: NIMA }, places: { room } });
  const glows: number[][] = [], q = PaperRenderer.prototype.quad;
  PaperRenderer.prototype.quad = function (this: PaperRenderer, ...a: Parameters<typeof q>) { if (a[2] === MODE.glow) glows.push(a[5] ?? [1, 1, 1, 1]); return q.apply(this, a); };
  try {
    p.stage.play(0); p.frames(20);
    const before = glows.splice(0).slice(-2).map(t => t[3]);
    assert.deepEqual(before, [1, 1], "street and lamp both glow at night");
    p.stage.act({ beat: { env: "lights_off" } }); p.frames(60);
    const after = glows.splice(0).slice(-1);
    assert.equal(after.length, 1, "only the street's glow is drawn");
    assert.equal(after[0][3], 1);
  } finally { PaperRenderer.prototype.quad = q; }
}));

test("a prop on its way (obj go) is drawn and tapped where it is, not where it started", () => onPage({}, p => {
  const yard: PlaceDoc = { v: 1, id: "yard", size: { w: 8, d: 4 }, pieces: [], marks: { here: { x: -3, z: 0 }, a: { x: -2, z: -1 }, b: { x: 2, z: -1 } },
    props: { sut: { kit: "milk", at: "a" } } };
  p.stage.pickable = true;
  p.stage.load({ v: 1, cues: [{ scene: { place: "yard", at: { me: "here" } } }, { beat: { obj: [{ id: "sut", op: "go", to: "b", ms: 2000 }] } }] }, { cast: { me: NIMA }, places: { yard } });
  p.stage.play(1); p.frames(5);
  const x0 = p.stage.bounds("obj:sut")![0];
  p.frames(70);
  const x1 = p.stage.bounds("obj:sut")![0];
  p.frames(80);
  const x2 = p.stage.bounds("obj:sut")![0];
  assert.ok(x0 < x1 && x1 < x2, `its box goes right with it (${x0}, ${x1}, ${x2})`);
}));

test("rain draws particles only while it rains, and holds them still in reduced motion", () => onPage({}, p => {
  const yard: PlaceDoc = { v: 1, id: "yard", outdoor: true, size: { w: 8, d: 4 }, pieces: [], marks: { here: { x: 0, z: 0 } } };
  p.stage.load({ v: 1, cues: [{ scene: { place: "yard", at: { me: "here" } } }, { beat: { env: "weather:rain" } }] }, { cast: { me: NIMA }, places: { yard } });
  const particles = () => { let n = 0; const q = PaperRenderer.prototype.sprite; PaperRenderer.prototype.sprite = function (this: PaperRenderer, ...a: Parameters<typeof q>) { n++; return q.apply(this, a); }; try { p.stage.render(); } finally { PaperRenderer.prototype.sprite = q; } return n; };
  p.stage.play(0); p.frames(10);
  assert.equal(particles(), 0, "dry");
  p.stage.play(1); p.frames(150);
  assert.ok(particles() > 150, "raining");
  const drop = () => { let first: number[] | null = null; const q = PaperRenderer.prototype.sprite; PaperRenderer.prototype.sprite = function (this: PaperRenderer, ...a: Parameters<typeof q>) { first ??= [...a[0]]; return q.apply(this, a); }; try { p.stage.render(); } finally { PaperRenderer.prototype.sprite = q; } return first; };
  p.stage.setMotion("still"); p.frames(2);
  const a = drop(); p.frames(30);
  assert.deepEqual(drop(), a, "still in reduced motion");
}));

test("a crowd's flats are never tapped, and a flat shown only in the rain comes and goes with it (FlatSpec.pick, when)", () => {
  const flat = (o: Partial<FlatSpec> = {}): FlatSpec => ({ group: box(60, 170), ppcm: 1, ...o });
  const CROWD_KIT: Kit = { ...kit, set: { ...kit.set, t_people: { draw: () => ({ flats: [flat({ pick: false }), flat({ x: 100, pick: false })] }) }, t_shop: { draw: () => ({ flats: [flat()] }) }, t_umbrella: { draw: () => ({ flats: [flat({ when: { weather: ["rain"] } })] }) } } };
  return onPage({ kit: CROWD_KIT }, p => {
    const yard: PlaceDoc = { v: 1, id: "yard", outdoor: true, size: { w: 8, d: 4 }, marks: { here: { x: 0, z: 1 } },
      pieces: [{ kit: "t_people", id: "people", x: -2, z: -1 }, { kit: "t_shop", id: "shop", x: 0, z: -2 }, { kit: "t_umbrella", id: "umbrella", x: 2, z: -1 }] };
    p.stage.pickable = true;
    p.stage.load({ v: 1, cues: [{ scene: { place: "yard", at: { me: "here" } } }, { beat: { env: "weather:rain" } }] }, { cast: { me: NIMA }, places: { yard } });
    const targets = () => new Set((p.stage as unknown as { picks: { target: string }[] }).picks.map(k => k.target));
    p.stage.play(0); p.frames(10);
    assert.ok(targets().has("piece:shop") && !targets().has("piece:people"), "the crowd is not hit-tested");
    assert.ok(!targets().has("piece:umbrella"), "no umbrella while dry");
    p.stage.play(1); p.frames(150);
    assert.ok(targets().has("piece:umbrella"), "the umbrella in the rain");
  });
});

test("the sky stays put on screen as the camera moves, and a street below the roof is drawn before the roof's floor", () => {
  const flat = (o: Partial<FlatSpec> = {}): FlatSpec => ({ group: box(400, 300), ppcm: 0.5, ...o });
  const SKY_KIT: Kit = { ...kit, set: { ...kit.set, t_sky: { draw: () => ({ flats: [flat({ sky: true, lit: 0 })] }) }, t_low: { draw: () => ({ flats: [flat()] }) }, floor: kit.set.floor } };
  return onPage({ kit: SKY_KIT }, p => {
    const roof: PlaceDoc = { v: 1, id: "roof", outdoor: true, size: { w: 8, d: 4 }, marks: { l: { x: -3, z: 0 }, r: { x: 3, z: 0 } },
      pieces: [{ kit: "t_sky", id: "sky", x: 0, y: 2, z: -80 }, { kit: "t_low", id: "low", x: 0, y: -14, z: -30 }, { kit: "floor", x: 0, z: -3, w: 800, d: 600 }] };
    p.stage.load({ v: 1, cues: [{ scene: { place: "roof", at: { a: "l", b: "r" }, cam: "wide" } }, { beat: { who: "a", cam: "close" } }, { beat: { who: "b", cam: "close" } }] }, { cast: { a: NIMA, b: NIMA }, places: { roof } });
    // where the sky's quad lands on screen, and the order the quads are drawn in
    const draw = () => {
      const order: string[] = [], q = PaperRenderer.prototype.quad, me = p.stage as unknown as { flatOf?: unknown };
      let sky: number[] | null = null;
      PaperRenderer.prototype.quad = function (this: PaperRenderer, ...a: Parameters<typeof q>) {
        const w = Math.abs(a[0][1][0] - a[0][0][0]);
        if (a[2] === MODE.piece) order.push(w > 7 ? (a[0][0][1] > 1 ? "sky" : "floor") : w > 3.9 ? "low" : "other");
        if (a[2] === MODE.piece && a[0][0][1] > 1 && w > 3.9 && !sky) { const c = a[0][0]; sky = [...c]; }
        return q.apply(this, a);
      };
      try { p.stage.render(); } finally { PaperRenderer.prototype.quad = q; }
      void me;
      return { order, sky: sky!, eye: [...p.stage.cam.eye] };
    };
    p.stage.play(0); p.frames(30);
    const w = draw();
    const pieces = w.order.filter(o => o !== "other");
    assert.ok(pieces.indexOf("low") < pieces.indexOf("floor"), `the street below is drawn before the floor: ${pieces.join(" ")}`);
    p.stage.play(1); p.frames(60);
    const a = draw();
    p.stage.play(2); p.frames(60);
    const b = draw();
    // the sky moved with the camera (by 0.97 of the eye's move), so it stays on screen while the set pans
    for (const [u, v] of [[w, a], [a, b]]) for (const k of [0, 1, 2]) assert.ok(Math.abs((v.sky[k] - u.sky[k]) - 0.97 * (v.eye[k] - u.eye[k])) < 1e-3, `axis ${k}`);
    assert.ok(Math.abs(b.eye[0] - a.eye[0]) > 1, "the camera did pan");
  });
});

// ---- voices -------------------------------------------------------------------------------------

test("a voice that does not voice a line (speak returns null) leaves the stage's timing alone; one that does gets who and the bus", () => onPage({}, p => {
  const calls: { text: string; who?: string; out?: AudioNode | null }[] = [];
  let voiced = false;
  const provider = {
    id: "test", available: () => true, cancel() {},
    speak: (text: string, o: { who?: string; out?: AudioNode | null }) => { calls.push({ text, who: o.who, out: o.out }); return voiced ? { cancel() {} } : null; },
  };
  const s = p.stage as unknown as { voice: unknown; speech: unknown; t0: number; audio: { duck(on: boolean): void }; speakLine(l: unknown): void };
  s.voice = provider;
  const ducks: boolean[] = [], duck = s.audio.duck.bind(s.audio);
  s.audio.duck = on => { ducks.push(on); duck(on); };
  const line = { t0: 0, t1: 900, who: "ismail", text: "Hoş geldiniz!", whisper: false, rate: 1, words: [{ i: 0, text: "Hoş", t0: 0, t1: 300 }, { i: 4, text: "geldiniz", t0: 360, t1: 900 }] };
  const t0 = s.t0, now = p.stage.now();
  s.speakLine(line);
  assert.deepEqual(calls[0], { text: "Hoş geldiniz!", who: "ismail", out: null }, "the speaker and the voice bus (none yet: sound was never on)");
  assert.equal(s.speech, null, "nothing holds the clock");
  assert.equal(s.t0, t0, "the stage's time is not moved");
  assert.equal(p.stage.now(), now);
  assert.deepEqual(ducks, [true, false], "music comes back at once");
  voiced = true;
  s.speakLine(line);
  assert.ok(s.speech, "a voiced line holds the clock until the voice starts");
}));
