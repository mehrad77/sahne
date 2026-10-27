// The stage: loads a script with its places and cast, and plays it cue by cue with the paper
// backend. The director (director/direct.ts) turns each cue into a timeline; every frame the
// stage evaluates the timeline, poses each puppet (rig/pose.ts), redraws faces that changed,
// and draws the scene back to front in one call. Nothing is drawn while nothing moves.
// `studio()` shows one actor alone for the avatar builder's preview (DESIGN.md §10): framed head to
// toe, as a bust or as a head, with `setAvatar` swapping the look live, `mood`, `gesture` and `flip`.

import { peopleSamples, flights, fleeAt, lookToward, reactShows, type Sample, type Flight } from "./anim/react.ts";
import type { EmitSpec, Kit, KitPuppet, Item, FlatSpec, FlatMotion, FlatReact, LightSpec, PieceOut, Side, Bus } from "./core/kit.ts";
import { placeSolids } from "./director/route.ts";
import { withVariant, TIMETABLE } from "./core/kit.ts";
import type { AvatarDoc, PieceRef, PlaceDoc, PuppetRef } from "./core/types.ts";
import { clamp, apply, ease, project, type Vec2, type Vec3, type Affine, type Mat4 } from "./core/math.ts";
import { hexToRgb } from "./core/color.ts";
import { hashString, rng } from "./core/rng.ts";
import { MAX_SPRITES, breathAt, burstAt, flameAt, puffAt, rainAt, type Sprite } from "./render/paper/particles.ts";
import { speechFallback, matchFallback, type LangPlugin } from "./core/lang.ts";
import { groupBounds, type Group } from "./art/shape.ts";
import { compose, type Puppet } from "./avatar/compose.ts";
import { solve, seatedSide, ARM_BONE } from "./rig/skeleton.ts";
import { stripGeometry, stripJoints, stripeDuty } from "./rig/strip.ts";
import { composePose, type GestureRun } from "./rig/pose.ts";
import { blendFace, faceFrom, faceKey, type FaceParams } from "./face/params.ts";
import { PaperRenderer, MODE, type PointLight } from "./render/paper/renderer.ts";
import { Atlas, FaceAtlas, faceSlots, type AtlasHook, type AtlasRect } from "./render/paper/atlas.ts";
import { TIMES, WEATHER, blendLight, cloudAt, glowWeight, withFlash, withWeather, type LightState } from "./render/paper/light.ts";
import { frameBoxes, wideBox, blendCam, bodyDims, figureCam, figureDims, stepCam, type CamState, type FigureDims, type FrameBox, type Framing } from "./render/paper/camera.ts";
import type { Cue, Script, Target } from "./script/types.ts";
import { moveAt } from "./anim/move.ts";
import { cloneWorld, inState, propKey, whenWeight, type PropState, type Shot, type World } from "./script/world.ts";
import { CAM_MS, emptyTrack, evaluate, type ActorFrame, type Frame, type Perf, type VoiceLine } from "./anim/timeline.ts";
import { direct, directAll, glance, type DirectCtx } from "./director/direct.ts";
import type { Pick } from "./interact/hit.ts";
import { Overlay, type Bubble, type InsetOptions } from "./ui/overlay.ts";
import type { GlossOptions } from "./ui/gloss.ts";
import { AudioEngine, type AudioSessionType } from "./audio/engine.ts";
import { SpeechClock } from "./audio/clock.ts";
import type { Speaking, VoiceProvider, VoiceSpec } from "./audio/voice.ts";

export type Motion = "full" | "calm" | "still";

export type { Framing };
/** What the studio shows behind the actor: the sky of its time of day, a plain cream wall and floor, or nothing (a transparent canvas, see `StageOptions.alpha`). */
export type Backdrop = "sky" | "wall" | "none";

export interface StudioOptions {
  /** The actor's id (default "me"). */
  id?: string;
  /** How much of the actor shows (default "full"); `setFraming` changes it later. */
  framing?: Framing;
  /** The light: a time of day (default "day", whose colours are the truest). */
  time?: string;
  /** Default "sky". "none" needs a stage made with `alpha: true` (else the sky is drawn, with a warning). */
  backdrop?: Backdrop;
  /** Idle life (breathing, blinks, glances) runs this long after the last call or tap, in ms (default: for as long as the stage is visible). */
  idle?: number;
  /** Whether the document is the app's own (an author's cast, which may use hex colours and custom parts) rather than a learner's (default false: `compose`'s `trusted`, DESIGN.md §10). `setAvatar` takes its own. */
  trusted?: boolean;
  /** What the canvas is called for screen readers ("Your character"). */
  label?: string;
}

/** The id of the studio's actor unless `StudioOptions.id` says otherwise. */
export const STUDIO_ID = "me";

export interface StageOptions {
  kit: Kit;
  /** The language plugin (`sahne-tr`): mouth timing and word matching. */
  lang?: LangPlugin;
  maxDpr?: number;
  /** Dims the whole stage (0.92 in a dark app theme). */
  dim?: number;
  /** Full, Calm or Still (DESIGN.md §7). Default: Still under reduced motion, else Full. */
  motion?: Motion;
  /** Lines as bubbles over the stage (`true`, theatre mode); `"log"` keeps Kerim's window and the sound words but leaves the lines
   * to the app (log mode, switchable with `setBubbles`); `false` draws no overlay at all. */
  bubbles?: boolean | "log";
  /** Idle life stops after this long without input or a new cue (ms; DESIGN.md §7: 20 s). */
  idleTimeout?: number;
  /** Tap-to-translate on the bubbles' words: the app's lookup (and optionally its own popup). */
  gloss?: GlossOptions;
  /** Whether glosses start on (default off); `setGlosses` changes it. */
  glosses?: boolean;
  /** A canvas with an alpha channel, so a stage with `backdrop: "none"` lets the page show through (default: opaque). */
  alpha?: boolean;
  /** Frames per second for idle life alone, once nothing else moves (default: every frame). The studio draws 30. */
  idleFps?: number;
  /** The GPU took the drawing context away (`true`) or gave it back (`false`): a page can show an SVG still meanwhile. See `Stage.lost`. */
  onContext?: (lost: boolean) => void;
  /** Sound (DESIGN.md §8). Off until the app turns it on from a tap (`setSound`); the app remembers the choice. */
  sound?: boolean;
  /** Sound words as bubbles even while sound is on (they always show while it is off). */
  captions?: boolean;
  volumes?: Partial<Record<Bus, number>>;
  /** Speaks the lines while sound is on (`browserVoice()`). Without one, lines are silent and mouths follow the estimate. */
  voice?: VoiceProvider;
  /** The page's audio session where Safari supports it (default "ambient": the iPhone's silent switch silences the stage). */
  audioSession?: AudioSessionType;
  /** Where the kit's recordings are served (a URL ending in "/"). Without it, every sound is synthesized. */
  sounds?: string;
}

export interface LoadOptions {
  /** Each actor's avatar document, or a puppet the kit builds in code (`{ puppet: "bird" }`, `Kit.puppets`). */
  cast: Record<string, AvatarDoc | PuppetRef>;
  /** The clothes each actor may change into (DESIGN.md §5.6 costume): actor → key → document, composed on the actor's own body (its body, skin, face, hair, facial hair and custom parts are the cast document's). */
  wardrobe?: Record<string, Record<string, AvatarDoc>>;
  places: Record<string, PlaceDoc>;
  /**
   * Cues that may replace the script's from cue `at` on (a choice's other branch): only scanned for the art they need. A branch is one
   * sequence, each cue directed from the world the one before it left (from cue `at - 1`'s for the first): alternatives that don't follow
   * one another are branches of their own. A cue played with `act` that reaches a place or a prop's look nothing loaded is drawn then.
   */
  extra?: { at: number; cues: Cue[] }[];
  /** Lines by this id go to the narrator inset. */
  narrator?: string;
  /** The narrator's picture for the inset (the app draws it), and what to do while the narrator talks (move the beak). */
  narratorEl?: HTMLElement;
  onNarratorTalk?: (talking: boolean, text: string) => void;
  /** Display names, read by screen readers before a bubble's line ("İsmail: …"). */
  names?: Record<string, string>;
  tempo?: Record<string, number>;
  rest?: Record<string, string>;
  /** Each character's voice: rate and pitch (the cast's `voice` field). */
  voices?: Record<string, VoiceSpec>;
  /** A kit sound the narrator makes before speaking (Kerim's coo). */
  narratorSound?: string;
  /** The side of the atlas layers in pixels (default 2048; one actor alone needs only 1024). */
  atlas?: number;
  /** The app's ids for what each character is called (Kumru's card ids), passed back in `inspect` events. A prop's are its place's `terms`. */
  terms?: Record<string, string[]>;
}

/** What plays an act cue that has no answer yet: the interaction layer (interact/index.ts) when one is attached. */
export interface ActHandler { play(i: number): Run; destroy(): void }

/** The sounds and lines of the performance on stage, and which have been played (or skipped). */
interface AudioRun { perf: Perf; fired: boolean[]; said: boolean[]; real0: number }

/** A line being voiced: the stage's clock follows it (unless the stage is still). */
interface Voicing { line: VoiceLine; clock: SpeechClock | null; handle: Speaking | null }

/** A cue being performed. */
export interface Run {
  readonly cue: number;
  readonly dur: number;
  /** Ms into the performance. */
  readonly t: number;
  /** Jump to the end pose (the learner tapped Devam). */
  finish(): void;
  seek(t: number): void;
  pause(): void;
  resume(): void;
  /** Resolves when the performance reaches its end (or is finished early). */
  readonly done: Promise<void>;
}

interface Flat {
  spec: FlatSpec;
  rect: AtlasRect; glow?: AtlasRect;
  O: Vec3; R: Vec3; D: Vec3;
  yaw: number; pitch: number;
  lit: number; shadow: boolean; floor: boolean;
  center: Vec3;
  piece?: string;
  hinge?: number; swing?: number;
  /** Only in these states of its place (`PieceRef.in`). */
  in?: string[];
  /** Its glow is on the place's light switch (`lights_off` dims it). */
  sw?: boolean;
  /** Its motion held where it starts (a prop set `still`). */
  still?: boolean;
  /** Wholly below the floor (the streets seen from a roof): drawn before the floor, which hides it. */
  under?: boolean;
  /** The words of this flat (`textFlat`): drawn just after `base`, as near as it is. */
  base?: Flat;
}

/** The studio's setup: the actor, the framing and backdrop, the tallest body of the build the full frame is made for, and the camera for the current framing and canvas. */
interface StudioCfg { id: string; framing: Framing; backdrop: Backdrop; ref?: FigureDims; cam?: { key: string; cam: CamState } }

/** A prop look and its cells; `at`: the places whose performances show it (its cells are in the atlas while one of them is). */
interface PropArt { specs: FlatSpec[]; rects: AtlasRect[]; glows: (AtlasRect | undefined)[]; ghosts: AtlasRect[]; at: Set<string>; emitters?: EmitSpec[] }

/** What an actor is drawn from: a composed `Puppet`, or a kit puppet (DESIGN.md §5.4), which has no document and no face texture. */
type Doll = Omit<Puppet, "avatar" | "faceStyle" | "faceRegion" | "notes"> & Partial<Puppet>;

/** An actor's art in one set of clothes: the cast document's (the actor itself) or a wardrobe's. */
interface Costume {
  puppet: Doll;
  rects: Map<Item, AtlasRect>;
  altDefault: Record<string, string>;
}

interface Actor extends Costume {
  id: string;
  /** A kit puppet (`Kit.puppets`): it poses itself, with its own gestures; no costumes, no face, no hands. */
  kit?: KitPuppet;
  /** Its wardrobe (`LoadOptions.wardrobe`) by key, on its body; the frame's `costume` picks one, an unknown key the cast document. */
  costumes: Map<string, Costume>;
  slot: number;
  drawnFace: string;
  face: FaceParams;
  /** Grip points of each hand in the last frame (world), for targets on held things. */
  grips: Partial<Record<Side, Vec3>>;
  /** The normalized document it was made from, to skip a swap that changes nothing. */
  key: string;
  /** Counts its looks, so what is cached for a look (the studio's camera) knows when it is out of date. */
  ver: number;
  /** What a framing reads of it (`figureDims`), once asked for. */
  dims?: FigureDims;
  /** Where a speech bubble goes and points, from the last frame (world): above the head, the mouth, the head's oval. */
  talk?: { top: Vec3; mouth: Vec3; head: [Vec3, Vec3, Vec3] };
}

/** How long a vehicle takes to slow to a halt where it is, or to get going again from one (`env: stop`, `depart`), ms. */
const HALT_MS = 2000;
/** The axes of a flat: R per cm along the art's x, D per cm along its y (down). */
function axes(yaw = 0, pitch = 0): { R: Vec3; D: Vec3 } {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const d0: Vec3 = [0, -cp, -sp];
  return { R: [cy / 100, 0, -sy / 100], D: [(d0[0] * cy + d0[2] * sy) / 100, d0[1] / 100, (-d0[0] * sy + d0[2] * cy) / 100] };
}
const at = (O: Vec3, R: Vec3, D: Vec3, x: number, y: number): Vec3 => [O[0] + R[0] * x + D[0] * y, O[1] + R[1] * x + D[1] * y, O[2] + R[2] * x + D[2] * y];
/** How tall the smallest words of a flat are painted, px (`textFlat`). */
const TEXT_PX = 28;
/** A reacting animal's key: its home and how it reacts, shared by all its flats (`FlatReact`). */
const reactKey = (rc: FlatReact, O: Vec3) => `${O[0].toFixed(3)},${O[2].toFixed(3)},${rc.flee?.r ?? ""},${rc.flee?.away ?? ""},${rc.flee?.speed ?? ""}`;
/** Where a reacting flat's animal lives (`FlatReact.home`, cm in its piece), from the flat's origin less its own offset. */
const homeOf = (fl: Flat, rc: FlatReact): Vec3 => rc.home ? [fl.O[0] + (rc.home[0] - (fl.spec.x ?? 0)) / 100, fl.O[1] - (fl.spec.y ?? 0) / 100, fl.O[2] + (rc.home[1] - (fl.spec.z ?? 0)) / 100] : fl.O;
/** How long a tapped animal's look lasts, ms (a flutter takes the first 0.9 s of it). */
const TAP_MS = 1400;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rgba = (hex: string, a = 1): [number, number, number, number] => { const c = hexToRgb(hex); return [c[0] * a, c[1] * a, c[2] * a, a]; };

/** Where a flat's rect points until the atlas has placed it. */
const NO_RECT: AtlasRect = { layer: 0, u0: 0, v0: 0, u1: 0, v1: 0, box: [0, 0, 0, 0] };

/** Where a prop is: who holds it, or where it lies (a drag ends when this changes). */
export const heldKey = (s: PropState) => s.holder ? "h:" + s.holder.actor : "a:" + (s.at?.join() ?? "");

/** A prop's look: lying where it is, or held (a prop may draw itself as it is carried). */
const artKey = (s: PropState) => propKey(s) + (s.holder ? "|held" : "");

/** A prop's outline, dashed, for the place a thing is missing from (*yok*): light dashes on a dark line, so it shows on any background. */
function ghostOf(g: Group): Group {
  const outline = g.shapes.filter(s => !s.flat && s.fill);
  return { edge: 0, shapes: [
    ...outline.map(s => ({ path: s.path, fill: "#FFFFFF", flat: true, opacity: 0.16 })),
    ...outline.map(s => ({ path: s.path, stroke: { color: "#3A302B", width: 1.0, cap: "round" as const }, flat: true, opacity: 0.55 })),
    ...outline.map(s => ({ path: s.path, stroke: { color: "#FFF8EC", width: 0.7, dash: [2, 1.5], cap: "round" as const }, flat: true })),
  ] };
}

/**
 * The studio's place: a plain cream wall and floor behind the actor, or nothing (the sky of the time
 * of day, or a transparent canvas, needs no pieces). `aside` is what a pointing gesture aims at: up
 * and to the side, clear of the face (a point at the viewer folds the arm across it).
 */
const studioPlace = (backdrop: Backdrop): PlaceDoc => ({
  v: 1, id: "studio", size: { w: 4, d: 3 }, marks: { here: { x: 0, z: 0 }, aside: { x: 0.9, y: 1.7, z: 0 } },
  pieces: backdrop === "wall" ? [{ kit: "floor", x: 0, z: -1.4, w: 1000, d: 900 }, { kit: "wall", x: 0, z: -1.35, w: 1000, h: 380, tiles: 0 }] : [],
});

/**
 * Values queued for the next frame, the last per key winning (a learner scrubbing through options
 * asks for dozens of looks a second; only the one standing still is worth building). `put` returns a
 * promise that resolves once the latest value of its key has been taken, or at once with `wait` off.
 */
export class Latest<K, V> {
  private m = new Map<K, { v: V; waiting: (() => void)[] }>();
  put(k: K, v: V, wait = true): Promise<void> {
    return new Promise(res => {
      const e = this.m.get(k), w = wait ? [res] : [];
      if (e) { e.v = v; e.waiting.push(...w); } else this.m.set(k, { v, waiting: w });
      if (!wait) res();
    });
  }
  get size() { return this.m.size; }
  /** Drop everything queued, releasing the waiters. */
  clear() { for (const e of this.m.values()) for (const w of e.waiting) w(); this.m.clear(); }
  /** Hand every queued value to `apply`, oldest key first, and release its waiters whatever `apply` does; the first error is thrown after the rest are done. */
  drain(apply: (k: K, v: V) => void) {
    const all = [...this.m]; this.m.clear();
    let err: unknown, failed = false;
    for (const [k, e] of all) {
      try { apply(k, e.v); } catch (x) { if (!failed) { failed = true; err = x; } } finally { for (const w of e.waiting) w(); }
    }
    if (failed) throw err;
  }
}

/** The places a script visits, its other branches (`LoadOptions.extra`) included. */
export function scriptPlaces(script: Script, extra: { cues: Cue[] }[] = []): Set<string> {
  const out = new Set<string>();
  for (const c of [...script.cues, ...extra.flatMap(b => b.cues)]) if ("scene" in c) out.add(c.scene.place);
  return out;
}

/** What a stage without WebGL2 returns for a performance: one that is over already. */
const NO_RUN: Run = { cue: -1, dur: 0, t: 0, finish() {}, seek() {}, pause() {}, resume() {}, done: Promise.resolve() };

export class Stage {
  readonly el: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly kit: Kit;
  /** The paper renderer; null when the device has no WebGL2 (see `webgl`). */
  readonly r: PaperRenderer | null;
  /**
   * Whether the stage can draw. Without WebGL2 the constructor still succeeds, but the stage stays
   * inert: no canvas is added to `el`, `load`, `studio`, `show` and the like do nothing and
   * `act`, `play`, `turnTo`, `mood`, `gesture` and `flip` return performances that are over, so the
   * app can put an SVG still (`render/still`) in `el` instead.
   */
  readonly webgl: boolean;
  readonly lang: LangPlugin;
  readonly overlay: Overlay | null;
  /** Whether lines show as bubbles (theatre mode); off in log mode, where the host shows them. `setBubbles` switches it. */
  private lines: boolean;
  readonly audio: AudioEngine;
  motion: Motion;
  /** Sound is on; captions show sound words while it is. */
  soundOn = false;
  captions = false;
  dim: number;
  /** `atlasMs`: the last scene load; `swapMs`: the last `setAvatar` (`swaps` counts them); `texKB`: GPU memory of atlas and faces. */
  stats = { vertices: 0, frameMs: 0, atlasMs: 0, layers: 0, poseMs: 0, swapMs: 0, swaps: 0, texKB: 0, /** The places whose art the atlas holds now (the one on stage and the next, §6.2). */ places: [] as string[] };

  script: Script = { v: 1, cues: [] };
  perfs: Perf[] = [];
  /** The performance on stage and its frame. */
  perf: Perf | null = null;
  frame: Frame | null = null;
  /** This place's performances since its scene began, the last the one on stage: what reacting flats remember (`FlatReact`). */
  private history: Perf[] = [];
  /** Where people walked in `history` (`peopleSamples`), and each reacting flat's flights from it, by its home: made when first needed. */
  private reactMemo: { samples: Sample[] | null; flights: Map<string, Flight[]> } = { samples: null, flights: new Map() };
  /** What each tappable reacting flat does when tapped, by its key (filled as they are drawn), and the taps playing now. */
  private tapSpecs = new Map<string, NonNullable<FlatReact["tap"]>>();
  private taps = new Map<string, { t: number; do: "hop" | "look" }>();
  cam: CamState = { eye: [0, 1.4, 6], target: [0, 1.1, 0], fov: 0.52 };
  light: LightState = TIMES.day;

  private places: Record<string, PlaceDoc> = {};
  private sets = new Map<string, { flats: Flat[]; lamps: { pos: Vec3; spec: LightSpec; in?: string[]; sw: boolean }[]; emitters: { pos: Vec3; spec: EmitSpec; in?: string[]; seed: string }[] }>();
  private propArt = new Map<string, PropArt>();
  private actors = new Map<string, Actor>();
  private ctx!: DirectCtx;
  private inset: InsetOptions | null = null;
  private camFrom: CamState | null = null;
  /** Framings per performance (they depend on where its actors end up) and per shot. */
  private camCache = new WeakMap<Perf, Map<string, CamState>>();
  /** A number per performance, so a bubble of one is never mistaken for one of another. */
  private serials = new WeakMap<Perf, number>();
  private nextSerial = 1;
  /** Which actor's face is in each face slot now. */
  private slotOwner: (string | null)[] = [];
  private cssW = 1; private cssH = 1;
  private destroyed = false;
  private onDown = () => this.poke();
  private t0 = 0;
  private pausedAt: number | null = null;
  private resolveDone: (() => void) | null = null;
  private raf = 0;
  private lastInput = 0;
  private idleTimeout: number;
  private gloss: GlossOptions | null;
  private maxDpr: number;
  private vp: Mat4 | null = null;
  private visible = true;
  private bubbleIds = "";
  private bubbles = new Map<string, Bubble>();
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private onVis = () => { if (document.hidden) this.stop(); else this.kick(); };
  private voice: VoiceProvider | null;
  private voices: Record<string, VoiceSpec> = {};
  private ar: AudioRun | null = null;
  private speech: Voicing | null = null;
  private pumpTimer = 0;
  private ambientPlace: string | null | undefined = undefined;
  private atlasSize = 2048;
  /** The places whose art the atlas holds; a change of place to come is drawn in idle time (`plan`, timer `preT`), as `job`. */
  private res: string[] = [];
  private job = "";
  private preT = 0;
  /** The studio's setup while `studio()` is showing (null on a story stage). */
  private studioCfg: StudioCfg | null = null;
  /** When the studio's camera last stepped, and whether it is still on its way. */
  private camT = 0;
  private camBusy = false;
  private snapCam = false;
  /** A look was built last frame and is not drawn yet. */
  private built = false;
  private swaps = new Latest<string, { doc: AvatarDoc; trusted: boolean }>();
  /** The art could not be drawn again after the context came back. */
  private broken = false;
  private looping = false;
  private lastDraw = 0;
  private idleGap = 0;
  /** Idle settings from the options: a studio changes them and a later `load` puts them back. */
  private idleTimeout0: number;
  private idleGap0: number;
  private warmT = 0;
  private lifeT = 0;
  /** The stops clock (`FlatMotion.clock`, `PlaceDoc.stops`): the life clock until a story holds the vehicle at a station or starts it again; `a` is where it was last set (life time `L`, stops time `S`), `H` the station it holds at. */
  private stopsA: { key: string; L: number; S: number; H?: number; halt?: true; ease?: true } | null = null;
  private lifeAt = 0;
  /** The interaction layer (`interact(stage)`): plays act cues and hit-tests taps. Without one, an act cue performs its expected answer. */
  interaction: ActHandler | null = null;
  /** Record what each frame draws (`picks`), for hit tests. Set by the interaction layer, which also sets `atlasHook` (the alpha masks) before `load`. */
  pickable = false;
  atlasHook: AtlasHook | null = null;
  /** The quads of the last frame, in drawing order (while `pickable`). */
  picks: Pick[] = [];
  /** The flats with text the last frame drew (`FlatSpec.text`): where, in world space (`O` its origin, `R`/`D` metres per cm right and down), for `propText`. */
  readonly texts: { target: string; spec: FlatSpec; O: Vec3; R: Vec3; D: Vec3 }[] = [];
  /** A prop the learner is dragging, drawn at `at` (world) instead of where it is, until its state changes from `from`. */
  held: { id: string; at: Vec3; from: string } | null = null;
  /** Display names (actor ids, or targets such as `obj:sut`), and the cast's terms (`LoadOptions`). */
  names: Record<string, string> = {};
  terms: Record<string, string[]> = {};
  private frameFns = new Set<() => void>();
  private pickAs: string | null = null;

  constructor(el: HTMLElement, o: StageOptions) {
    this.el = el; this.kit = o.kit; this.maxDpr = o.maxDpr ?? 2; this.dim = o.dim ?? 1;
    this.lang = o.lang ?? { id: "und", speech: speechFallback, match: matchFallback };
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.motion = o.motion ?? (reduced ? "still" : "full");
    this.idleTimeout = this.idleTimeout0 = o.idleTimeout ?? 20000;
    this.idleGap = this.idleGap0 = o.idleFps ? Math.max(0, 1000 / o.idleFps - 4) : 0;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:manipulation";
    this.canvas.setAttribute("role", "img");
    // a device without WebGL2 (or whose shaders do not compile) gets an inert stage, not an error
    let r: PaperRenderer | null = null;
    try { r = new PaperRenderer(this.canvas, { alpha: o.alpha }); } catch (e) { console.warn("sahne: the paper stage needs WebGL2", e); }
    this.r = r; this.webgl = !!r;
    // `false` no overlay at all (a builder's preview, thumbnails); `"log"` the narrator's window and the sound words but no line
    // bubbles (the host shows the lines; setBubbles switches); `true` everything (theatre mode)
    this.lines = o.bubbles !== false && o.bubbles !== "log";
    this.overlay = o.bubbles === false || !r ? null : new Overlay(el, { project: p => this.project(p), still: this.motion === "still" });
    this.gloss = o.gloss ?? null;
    if (o.glosses && this.gloss) this.overlay?.setGloss(this.gloss);
    this.audio = new AudioEngine(this.kit, { volumes: o.volumes, sounds: o.sounds, session: o.audioSession });
    this.voice = o.voice ?? null;
    this.captions = !!o.captions;
    if (o.sound) this.setSound(true);
    if (!r) return;
    el.append(this.canvas);
    r.onLost = () => { this.stop(); o.onContext?.(true); };
    r.onRestore = () => { this.restoreArt(); o.onContext?.(this.lost); };
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    if (typeof IntersectionObserver === "function") {
      this.io = new IntersectionObserver(es => { this.visible = es.some(e => e.isIntersecting); if (this.visible) this.kick(); else this.stop(); });
      this.io.observe(el);
    }
    document.addEventListener("visibilitychange", this.onVis);
    document.fonts?.addEventListener("loadingdone", this.onFonts);
    el.addEventListener("pointerdown", this.onDown);
    this.resize();
  }

  get aspect() { return this.canvas.width / Math.max(1, this.canvas.height); }

  /** The GPU took the drawing context away and it has not come back (see `StageOptions.onContext`): nothing shows, and a page can put an SVG still up meanwhile. */
  get lost() { return !!this.r && (this.r.lost || this.broken); }

  /** Whether the canvas can have a transparent background (`StageOptions.alpha`). */
  get alpha() { return !!this.r?.alpha; }

  /** Whether the stage is on screen now: a hidden tab or an element out of view draws nothing, and `setAvatar` waits for it. */
  get shown() { return this.visible && !document.hidden && !this.destroyed; }

  resize() {
    if (!this.r) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.cssW = Math.max(1, this.el.clientWidth); this.cssH = Math.max(1, this.el.clientHeight);
    const w = Math.max(1, Math.round(this.cssW * dpr)), h = Math.max(1, Math.round(this.cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.camCache = new WeakMap(); this.snapCam = true; this.render(); }
  }

  // ---- Loading ----------------------------------------------------------------

  /** Build every place, actor and prop the script (and `extra`) can show, once; the atlas holds the cast and the place on stage and the next (`plan`). */
  load(script: Script, o: LoadOptions) { this.build(script, o, null, true); }

  private build(script: Script, o: LoadOptions, studio: StudioCfg | null, trusted: boolean) {
    const r = this.r;
    if (!r) return;
    const t0 = performance.now();
    this.script = script; this.places = o.places; this.atlasSize = o.atlas ?? 2048;
    this.studioCfg = studio; this.camBusy = false; this.snapCam = !!studio;
    this.idleTimeout = this.idleTimeout0; this.idleGap = this.idleGap0;
    this.sets.clear(); this.propArt.clear(); this.actors.clear(); this.camCache = new WeakMap(); this.slotOwner = []; this.swaps.clear(); this.perf = null; this.history = []; this.reactMemo = { samples: null, flights: new Map() };
    this.ctx = {
      places: o.places, gestures: this.kit.gestures, lang: this.lang, narrator: o.narrator, tempo: o.tempo, rest: o.rest ? { ...o.rest } : {}, heights: {},
      solids: Object.fromEntries(Object.entries(o.places).map(([id, pl]) => [id, placeSolids(pl, this.kit)])),
      soundWord: id => { const w = this.kit.sounds?.[id]?.word; return w ? w[this.lang.id] ?? w.en : undefined; },
      narratorSound: o.narratorSound && this.kit.sounds?.[o.narratorSound] ? { id: o.narratorSound, ms: Math.round(this.audio.length(o.narratorSound)) } : undefined,
    };
    this.voices = o.voices ?? {};
    this.ar = null; this.ambientPlace = undefined;
    this.inset = o.narratorEl ? { el: o.narratorEl, who: o.narrator ?? "", onTalk: o.onNarratorTalk } : null;
    this.names = o.names ?? {}; this.terms = o.terms ?? {}; this.held = null; this.picks = [];

    for (const [id, doc] of Object.entries(o.cast)) { const a = this.makeActor(id, doc, trusted, o.wardrobe?.[id]); if (a) this.actors.set(id, a); }
    // the studio frames full-length views for the build's tallest body (`refBody`)
    if (studio) studio.ref = this.refBody(this.actors.get(studio.id)!.puppet.avatar!);

    // the places the script visits
    for (const pid of scriptPlaces(script, o.extra)) {
      const place = o.places[pid];
      if (!place) { console.warn("sahne: no place", pid); continue; }
      this.sets.set(pid, this.makeSet(place));
    }

    // every look a prop takes in any cue (two loaves, one loaf, three)
    this.perfs = directAll(script.cues, [...this.actors.keys()], this.ctx);
    // (each with the place it shows in)
    const states: [PropState, string][] = [];
    const scan = (perfs: Perf[]) => { for (const p of perfs) for (const s of [...Object.values(p.before.props), ...Object.values(p.after.props), ...p.props.map(e => e.state)]) if (s) states.push([s, p.after.place ?? ""]); };
    scan(this.perfs);
    for (const b of o.extra ?? []) {
      // a branch starts from the world the cue before it left
      const w = b.at > 0 ? this.perfs[b.at - 1]?.after : undefined;
      scan(w ? this.directFrom(w, b.cues, b.at) : directAll([...script.cues.slice(0, b.at), ...b.cues], [...this.actors.keys()], this.ctx));
    }
    // a prop the learner may drag, lying anywhere or in anyone's hand
    const drags = new Set([...script.cues, ...(o.extra ?? []).flatMap(b => b.cues)].flatMap(c => "act" in c && c.act.kind === "drag" ? [c.act.obj ?? c.act.targets.find(t => t.startsWith("obj:"))?.slice(4) ?? ""] : []));
    for (const [s0, pl] of [...states]) if (drags.has(s0.of)) states.push([{ ...s0, holder: undefined }, pl], [{ ...s0, holder: { actor: "", side: "r" } }, pl]);
    // and every smaller count of a counted prop, lying or held, for whatever a later branch splits off
    for (const [s0, pl] of [...states]) if (typeof s0.n === "number") for (let n = 1; n < s0.n; n++) for (const holder of [undefined, { actor: "", side: "r" as Side }]) states.push([{ ...s0, n, holder }, pl]);
    for (const [s, pl] of states) this.propLook(s, pl);

    // one face slot per actor with a face, and the pixels
    r.newFaces(faceSlots([...this.actors.values()].filter(a => a.puppet.faceRegion).length));
    this.rasterise();
    this.stats.atlasMs = Math.round(performance.now() - t0);
    if (this.soundOn) this.prepareAudio();
    if (this.perfs.length) this.show(0);
  }

  /** A place's set: its pieces drawn into flats (no pixels yet) and its lamps, each piece on its own seed (`pieceSeed`). */
  private makeSet(place: PlaceDoc) {
    const set = { flats: [] as Flat[], lamps: [] as { pos: Vec3; spec: LightSpec; in?: string[]; sw: boolean }[], emitters: [] as { pos: Vec3; spec: EmitSpec; in?: string[]; seed: string }[] };
    for (const { p, out } of drawPieces(place, this.kit)) {
      for (const s of out.flats) {
        // a flat whose top is below the floor (a street far down from a roof) goes behind the floor; one on a path is as high as its path takes it (a gull)
        const lift = s.move?.path ? Math.max(...s.move.path.pts.map(q => q[1])) / 100 : 0;
        const under = !s.pitch && !s.sky && (p.y ?? 0) + lift + ((s.y ?? 0) - groupBounds(s.group)[1]) / 100 < -0.05;
        const fl: Flat = { ...this.makeFlat(s, [p.x, p.y ?? 0, p.z], p.id), ...(p.in ? { in: p.in } : {}), ...(under ? { under } : {}), sw: p.switch !== false && s.switch !== false };
        set.flats.push(fl);
        // its words, painted as a flat of their own just over it (DESIGN.md §6.8)
        const ts = this.textFlat(s);
        if (ts) set.flats.push({ ...this.makeFlat(ts, [p.x, p.y ?? 0, p.z], p.id), ...(p.in ? { in: p.in } : {}), ...(under ? { under } : {}), sw: fl.sw, base: fl });
      }
      for (const l of out.lights ?? []) set.lamps.push({ pos: [p.x + l.x / 100, (p.y ?? 0) + l.y / 100, p.z + l.z / 100], spec: l, ...(p.in ? { in: p.in } : {}), sw: p.switch !== false && l.switch !== false });
      for (const [k, e] of (out.emitters ?? []).entries()) set.emitters.push({ pos: [p.x + e.x / 100, (p.y ?? 0) + e.y / 100, p.z + (e.z ?? 5) / 100], spec: e, ...(p.in ? { in: p.in } : {}), seed: `${pieceSeed(place, p)}|e${k}` });
    }
    return set;
  }

  /**
   * An actor from its document: the puppet and what its drawing needs, with no pixels yet (`rasterise`). `compose` never throws: a document it cannot use draws the kit's default character.
   * Each of its `wardrobe` is composed with the cast document's body, skin, face, hair, facial hair and custom parts, so the bones, height and face are the actor's own.
   * A `{ puppet }` is built by the kit (`Kit.puppets`); an unknown one is a warning and null (the actor is left out, the story plays).
   */
  private makeActor(id: string, doc: AvatarDoc | PuppetRef, trusted: boolean, wardrobe: Record<string, AvatarDoc> = {}): Actor | null {
    const dress = (puppet: Doll): Costume => {
      const altDefault: Record<string, string> = {};
      for (const it of [...puppet.views.front, ...puppet.views.back, ...(puppet.side?.items ?? [])]) if (it.alt?.default) altDefault[it.alt.key] = it.alt.value;
      return { puppet, rects: new Map(), altDefault };
    };
    const kp = "puppet" in doc ? this.kit.puppets?.[doc.puppet]?.(this.kit) : undefined, costumes = new Map<string, Costume>();
    let me: Costume;
    if (kp) { me = dress(kp); (this.ctx.puppets ??= {})[id] = { kind: kp.kind, gestures: kp.gestures }; }
    else if ("puppet" in doc) { console.warn("sahne: no puppet", doc.puppet, id); return null; }
    else {
      me = dress(compose(doc, this.kit, { trusted }));
      const { body, skin, face, hair, facialHair, custom } = me.puppet.avatar!;
      for (const [k, w] of Object.entries(wardrobe)) {
        try { costumes.set(k, dress(compose({ ...w, body, skin, face, hair, facialHair, custom }, this.kit, { trusted }))); } catch (e) { console.warn("sahne: costume not applied", id, k, e); }
      }
    }
    this.ctx.heights![id] = me.puppet.body.H / 100;
    return { id, ...me, kit: kp, costumes, slot: -1, drawnFace: "", face: faceFrom(undefined), grips: {}, key: JSON.stringify(kp ? doc : me.puppet.avatar), ver: 0 };
  }

  /**
   * Draw the art into a new atlas: the actors' (the hand shapes the pose does not use and the back
   * view wait until they are needed), and the sets and props of the places `want` names (the one on
   * stage and the next, `want()`). Everything that holds a rect is pointed at the new ones in one go
   * once the atlas is sent, so a frame never sees half of the old atlas and half of the new. The art
   * itself stays in memory, which is how a lost context is restored (`restoreArt`). A piece too large
   * for a small atlas (`LoadOptions.atlas`) makes it a 2048 one, once and for good. With `bg` nothing
   * is drawn yet: the step returned paints until a time, and swaps the atlas in once all is painted and `go`.
   */
  private rasterise(want = this.want(), bg = false) {
    if (!bg) { clearTimeout(this.preT); this.job = ""; }
    try { return this.rasteriseAt(this.atlasSize, want, bg); } catch (e) {
      if (this.atlasSize >= 2048) throw e;
      this.atlasSize = 2048; return this.rasteriseAt(2048, want, bg);
    }
  }

  private rasteriseAt(size: number, want: string[], bg: boolean) {
    const r = this.r!, atlas = new Atlas(r.gl, size), bind: (() => void)[] = [];
    atlas.hook = this.studioCfg ? null : this.atlasHook;
    for (const a of this.actors.values()) {
      // what shows now is drawn now; the other hand shapes, the back and the costumes (`warm`) wait until they are needed.
      // With costumes, a piece they share with the cast document (the head, the hands, …) gets one cell, found by its art
      const seen = new Map<unknown, AtlasRect>();
      for (const c of [a, ...a.costumes.values()]) {
        const rects = new Map<Item, AtlasRect>();
        bind.push(() => c.rects = rects);
        // the side view (a seat seen side on) waits until it is needed, as the back does
        for (const [v, items] of [["front", c.puppet.views.front], ["back", c.puppet.views.back], ["side", c.puppet.side?.items ?? []]] as const) for (const it of items) {
          if (!it.group) continue;
          const k = a.costumes.size ? JSON.stringify([it.group, it.ppcm]) : it;
          let rect = seen.get(k);
          if (!rect) seen.set(k, rect = atlas.add(it.group, it.ppcm ?? 5, c !== a || v !== "front" || (!!it.alt && !it.alt.default)));
          rects.set(it, rect);
        }
      }
    }
    for (const pid of want) for (const fl of this.sets.get(pid)!.flats) {
      const s = fl.spec, rect = atlas.add(s.group, s.ppcm ?? 1.6), glow = s.emissive && atlas.add(s.emissive, s.glowPpcm ?? s.ppcm ?? 1.6), b = rect.box;
      bind.push(() => { fl.rect = rect; fl.glow = glow; fl.center = at(fl.O, fl.R, fl.D, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2); });
    }
    // a prop look of no place wanted has no cells
    for (const art of this.propArt.values()) {
      const cells = (g: (f: FlatSpec) => Group | undefined, glow = false) => want.some(p => art.at.has(p)) ? art.specs.map(f => { const x = g(f); return x && atlas.add(x, (glow ? f.glowPpcm : undefined) ?? f.ppcm ?? 1.6); }) : [];
      const rects = cells(f => f.group) as AtlasRect[], glows = cells(f => f.emissive, true), ghosts = cells(f => ghostOf(f.group)) as AtlasRect[];
      bind.push(() => Object.assign(art, { rects, glows, ghosts }));
    }
    atlas.pack();
    const swap = () => {
      // (the old atlas is freed first: if the GPU refuses the new one, the next frame tries again, `render`)
      this.res = []; r.use(atlas);
      for (const f of bind) f();
      this.res = want;
      this.stats.layers = atlas.layers;
      this.stats.places = [...want];
      this.stats.texKB = Math.round(r.textureBytes / 1024);
      this.warm();
    };
    if (!bg) { atlas.paint(); swap(); return; }
    return (until: number, go: boolean) => atlas.paint(until) && go && (swap(), true);
  }

  /** The places whose art the atlas holds: the one on stage (or first) and the next the script goes to. */
  private want(): string[] {
    const p = this.perf ?? this.perfs[0], here = p?.after.place;
    return [here, p && this.perfs.slice(p.cue + 1).find(q => q.after.place !== here)?.after.place].filter(x => x && this.sets.has(x)) as string[];
  }

  /** Keep the atlas to `want()` after a cue or a jump: a change is drawn in idle time, a few ms a task, and swapped in when done; the old place goes with it (DESIGN.md §6.2). */
  private plan() {
    const w = this.want(), key = w.join();
    if (!this.r || key === this.res.join() || key === this.job) return;
    clearTimeout(this.preT); this.job = key;
    let step: ((until: number, go: boolean) => boolean) | undefined;
    const run = () => {
      const p = this.perf;
      if (this.job !== key || this.r!.lost || this.destroyed) return;
      try {
        // painted, it is sent to the GPU (a few ms, more on a phone) once the cue on stage is over or paused, where a hitch does not show
        if (!(step ??= this.rasterise(w, true)!)(performance.now() + 8, !p || this.pausedAt !== null || this.now() >= p.dur)) { this.preT = setTimeout(run, 16) as unknown as number; return; }
        this.render();
      } catch (e) { console.warn("sahne: could not draw the next place", e); }
      this.job = "";
    };
    this.preT = setTimeout(run, 80) as unknown as number;
  }

  /** Draw the backs and the costumes soon after a rebuild, in tasks of their own (a few ms each): the rebuild stays short, and a flip does not stall. */
  private warm() {
    clearTimeout(this.warmT);
    const step = () => {
      this.warmT = 0;
      const r = this.r;
      if (!r || r.lost || this.destroyed) return;
      const until = performance.now() + 8;
      for (const a of this.actors.values()) for (const c of [a, ...a.costumes.values()]) for (const [it, rect] of c.rects) {
        if (!rect.lazy || it.alt) continue;
        r.atlas.ensure(rect);
        if (performance.now() > until) { this.warmT = setTimeout(step, 16) as unknown as number; return; }
      }
    };
    this.warmT = setTimeout(step, 80) as unknown as number;
  }

  /** The flats that are a flat's words (`textFlat`). */
  private texted = new WeakSet<FlatSpec>();

  /**
   * A flat's words (`FlatSpec.text`) as a flat of their own (DESIGN.md §6.8): painted into the atlas at a resolution that keeps
   * the smallest of them about `TEXT_PX` pixels tall, in the page's `--sahne-text-<font>`, and drawn just over the flat, so
   * whatever stands nearer covers them and they take the scene's light as the paper does. Untappable: the flat under it is the target.
   */
  private textFlat(s: FlatSpec): FlatSpec | null {
    if (!s.text?.length) return null;
    const css = typeof getComputedStyle === "function" && this.el.isConnected ? getComputedStyle(this.el) : null;
    const family = (f?: string) => (f && css?.getPropertyValue(`--sahne-text-${f}`).trim()) || css?.fontFamily || "system-ui, sans-serif";
    // the words' flat spans all their boxes (six pinned ads side by side): its widest side stays inside the atlas
    const small = Math.min(...s.text.map(t => t.size ?? t.h * 0.45));
    const span = Math.max(Math.max(...s.text.map(t => t.x + t.w)) - Math.min(...s.text.map(t => t.x)), Math.max(...s.text.map(t => t.y + t.h)) - Math.min(...s.text.map(t => t.y)));
    const ppcm = Math.max(s.ppcm ?? 1.6, Math.min(TEXT_PX / Math.max(0.1, small), 24, 1800 / Math.max(1, span)));
    const t: FlatSpec = {
      ...s, group: { shapes: [], edge: 0, text: s.text.map(x => ({ text: x.text, x: x.x, y: x.y, w: x.w, h: x.h, size: x.size, color: x.color, align: x.align, weight: x.weight, family: family(x.font) })) },
      ppcm, emissive: undefined, glowPpcm: undefined, shadow: "none", text: undefined, pick: false, lit: s.text[0].lit ?? s.lit,
    };
    this.texted.add(t);
    this.hasText = true;
    return t;
  }
  /** Some flat has words: the art is painted again once the page's fonts have loaded (`onFonts`). */
  private hasText = false;
  private onFonts = () => {
    if (!this.hasText || !this.r || this.r.lost || this.destroyed || !this.res.length) return;
    // the words were laid out in whatever font was there: lay them out again in the page's own
    try { this.rasterise(this.res); this.poke(); } catch (e) { console.warn("sahne: could not repaint the words", e); }
  };

  private makeFlat(s: FlatSpec, origin: Vec3, piece?: string): Flat {
    const yaw = s.yaw ?? 0, pitch = s.pitch ?? 0, { R, D } = axes(yaw, pitch);
    const O: Vec3 = [origin[0] + (s.x ?? 0) / 100, origin[1] + (s.y ?? 0) / 100, origin[2] + (s.z ?? 0) / 100];
    return {
      spec: s, rect: NO_RECT, O, R, D, yaw, pitch, lit: s.lit ?? 1, shadow: s.shadow === "drop", floor: Math.abs(pitch + Math.PI / 2) < 0.01,
      center: O, piece, hinge: s.hinge, swing: s.swing,
    };
  }

  /** The context came back after a loss: the atlases are empty, so draw them again. */
  private restoreArt() {
    if (this.destroyed || !this.r) return;
    this.broken = false;
    try { this.rasterise(); } catch (e) { console.warn("sahne: could not restore the art", e); this.broken = true; return; }
    for (const a of this.actors.values()) a.drawnFace = "";
    this.render();
    this.kick();
  }

  // ---- Studio: one actor alone, for the avatar builder's preview (DESIGN.md §10) -------------------

  /**
   * Show `doc` alone in a studio instead of a script: framed head to toe, as a bust or as a head
   * (`setFraming`), in the light of a time of day, over the sky, a plain wall or nothing at all (a
   * transparent canvas, with `StageOptions.alpha`). Idle life runs for as long as the stage is
   * visible. Returns the actor's id, which the other calls below take. Replaces whatever was loaded.
   */
  studio(doc: AvatarDoc, o: StudioOptions = {}): string {
    const id = o.id ?? STUDIO_ID;
    if (!this.r || this.notDoc(doc)) return id;
    const backdrop = this.backdropFor(o.backdrop ?? "sky");
    if (o.label) this.canvas.setAttribute("aria-label", o.label);
    const script: Script = { v: 1, cues: [{ scene: { place: "studio", time: o.time ?? "day", at: { [id]: "here" }, cam: "wide" } }] };
    const cfg: StudioCfg = { id, framing: o.framing ?? "full", backdrop };
    this.build(script, { cast: { [id]: doc }, places: { studio: studioPlace(backdrop) }, atlas: 1024 }, cfg, !!o.trusted);
    // a calm preview: idle life while it is visible, at 30 frames a second
    this.idleTimeout = o.idle ?? Infinity;
    if (!this.idleGap) this.idleGap = 1000 / 30 - 4;
    this.poke();
    return id;
  }

  /** "none" is a transparent canvas, which only a stage made with `alpha` has; any other draws the sky. */
  private backdropFor(b: Backdrop): Backdrop {
    if (b !== "none" || this.r?.alpha) return b;
    console.warn('sahne: backdrop "none" needs a stage made with alpha: true; drawing the sky');
    return "sky";
  }

  /** The tallest body of the document's build: the studio frames full-length views for it, so a taller body fills more of the frame. Pass a normalized document. */
  private refBody(doc: AvatarDoc): FigureDims { return bodyDims(this.kit.body({ ...doc.body, height: 1 })); }

  /** Change how much of the actor shows; the camera eases there. */
  setFraming(f: Framing) {
    if (!this.studioCfg || this.studioCfg.framing === f) return;
    this.studioCfg.framing = f;
    this.poke(); this.render();
  }

  /** Change what shows behind the actor. The wall and floor are set pieces, so the art is drawn again; the performance (mood, turn, idle life) goes on. */
  setBackdrop(b: Backdrop) {
    const c = this.studioCfg, was = c?.backdrop;
    if (!c || !this.r) return;
    b = this.backdropFor(b);
    if (was === b) return;
    c.backdrop = b;
    if (b === "wall" || was === "wall") {
      const put = (bd: Backdrop) => { const place = studioPlace(bd); this.places.studio = place; this.sets.set("studio", this.makeSet(place)); this.rasterise(); };
      try { put(b); } catch (e) {
        console.warn("sahne: backdrop not applied", e);
        c.backdrop = was!;
        try { put(was!); } catch (e2) { console.warn("sahne: could not restore the backdrop", e2); }
      }
    }
    this.poke(); this.render();
  }

  /**
   * Swap an actor's look live, without a restart: whatever the actor is doing (a gesture, a mood,
   * a turn, idle life) goes on. Calls are queued for the next frame and the last one wins, so a
   * learner scrubbing through options costs one rebuild per frame at most; each rebuild draws the
   * actor's art again in a few ms (the back and the hand shapes the pose does not use are drawn when
   * needed). The document goes through `compose`, which never throws: one it cannot use draws the
   * kit's default character. `trusted` is false unless said otherwise, whatever the actor wore
   * before: pass `true` only for the app's own cast. The promise resolves when the look (or a later
   * one) is built, and the next frame draws it; it never rejects. A stage that cannot draw now (a
   * hidden tab, a panel scrolled out of view, a lost context; see `shown` and `lost`) takes the
   * look at once: the promise resolves, and the look is built and drawn when the stage can draw
   * again. On a story stage the whole scene's art is drawn again, so this is for a lone actor, not
   * a crowd.
   */
  setAvatar(id: string, doc: AvatarDoc, o: { trusted?: boolean } = {}): Promise<void> {
    if (!this.r || this.destroyed || this.notDoc(doc, this.actors.get(id)?.kit)) return Promise.resolve();
    const done = this.swaps.put(id, { doc, trusted: !!o.trusted }, this.shown && !this.r.lost);
    this.poke();
    return done;
  }

  /** A kit puppet is not an avatar: neither swapped in nor out, nor shown in the studio (a warning). */
  private notDoc(doc: AvatarDoc | PuppetRef, kp?: KitPuppet): boolean {
    const no = !!kp || "puppet" in doc;
    if (no) console.warn("sahne: a kit puppet has no avatar");
    return no;
  }

  /** Apply the queued swaps (once per frame); the ms it took, 0 if there were none. */
  private applySwaps(): number {
    const r = this.r;
    if (!r || r.lost || !this.swaps.size) return 0;
    const t0 = performance.now();
    this.swaps.drain((id, q) => this.swap(id, q.doc, q.trusted));
    return Math.max(performance.now() - t0, 0.001);
  }

  private swap(id: string, doc: AvatarDoc, trusted: boolean) {
    const old = this.actors.get(id);
    if (!old) { console.warn("sahne: no actor", id); return; }
    const t0 = performance.now(), wasH = this.ctx.heights![id];
    let next: Actor | null;
    try { next = this.makeActor(id, doc, trusted); } catch (e) { console.warn("sahne: avatar not applied", e); return; }
    if (!next || next.key === old.key) { this.ctx.heights![id] = wasH; return; }
    // the new art takes the old actor's place on stage; its pose, face and slot carry on. Its costumes go: they were made on the old body
    const was = { puppet: old.puppet, altDefault: old.altDefault, rects: old.rects, costumes: old.costumes, key: old.key, drawnFace: old.drawnFace, ver: old.ver, dims: old.dims };
    const cfg = this.studioCfg, wasRef = cfg?.ref;
    Object.assign(old, { puppet: next.puppet, altDefault: next.altDefault, rects: next.rects, costumes: next.costumes, key: next.key, drawnFace: "", ver: old.ver + 1, dims: undefined });
    this.camCache = new WeakMap();
    if (cfg?.id === id) cfg.ref = this.refBody(next.puppet.avatar!);
    try { this.rasterise(); } catch (e) {
      // the art did not fit or the GPU refused: go back to the old look
      console.warn("sahne: avatar not applied", e);
      Object.assign(old, was); this.ctx.heights![id] = wasH;
      if (cfg && wasRef) cfg.ref = wasRef;
      try { this.rasterise(); } catch (e2) { console.warn("sahne: could not restore the old look", e2); }
      return;
    }
    this.stats.swapMs = +(performance.now() - t0).toFixed(2); this.stats.swaps++;
  }

  /** Make an actor feel `emo` and stay that way (the builder's emotion strip); "neutral" returns to rest. */
  mood(id: string, emo = "neutral"): Run {
    if (!this.r) return NO_RUN;
    this.ctx.rest![id] = emo;
    return this.act({ beat: { who: id, emo } });
  }

  /** Play a gesture by name. One that points at something aims at the studio's `aside` mark (up and to the side, clear of the face), or at the viewer on a story stage, unless `at` says otherwise. */
  gesture(id: string, name: string, o: { at?: Target; n?: number; loop?: boolean } = {}): Run {
    if (!this.r) return NO_RUN;
    const aim = (this.actors.get(id)?.kit ?? this.kit).gestures[name]?.needs?.includes("target") ? (this.studioCfg ? "mark:aside" : "viewer") : undefined;
    return this.act({ beat: { who: id, do: name, at: o.at ?? aim, n: o.n, loop: o.loop } });
  }

  /** Show the actor's back, or turn to the front again if it is showing the back (the builder's turn button). */
  flip(id: string): Run {
    if (!this.r) return NO_RUN;
    const a = this.world().actors[id];
    if (!a) { console.warn("sahne: no actor", id); return NO_RUN; }
    return this.turnTo(id, Math.cos(a.yaw) >= 0 ? Math.PI : 0);
  }

  // ---- Playing ----------------------------------------------------------------

  /** The world after cue `i`, with no performance. */
  show(i: number) {
    const p = this.perfs[i];
    if (!p || !this.r) return;
    this.finishRun();
    this.quiet();
    this.ar = null;
    this.perf = p; this.camFrom = null; this.onStage(p);
    this.t0 = performance.now() - p.dur;
    this.pausedAt = null;
    this.placeSound(); this.plan();
    this.poke();
    this.render();
  }

  /** Perform cue `i` from the world cue `i − 1` left. */
  play(i: number): Run {
    if (!this.r) return NO_RUN;
    const p = this.perfs[i];
    if (!p) throw new Error(`sahne: no cue ${i}`);
    // an act the learner has not answered yet waits for them (interact/index.ts)
    const c = this.script.cues[i];
    if (this.interaction && c && "act" in c && !c.act.result) return this.interaction.play(i);
    return this.start(p);
  }

  /** Perform a performance made off the script (`direct`, `glance`). */
  perform(p: Perf): Run { if (!this.r) return NO_RUN; this.adopt(p); return this.start(p); }

  /** Direct a cue from a world (default: the one on stage now) without performing it. */
  direct(cue: Cue, w: World = this.world(), i = w.i + 1): Perf { return direct(w, cue, i, this.ctx); }

  /** Actors glance at a target, and `point` points at it, from the world on stage (an act's hint); nothing else changes. */
  glance(ids: string[], at: Target, point?: string): Run {
    if (!this.r) return NO_RUN;
    const w = this.world();
    return this.start(glance(w, w.i, this.ctx, ids, at, point));
  }

  /** The place on stage now. */
  get place(): PlaceDoc | null { const id = this.perf?.after.place; return id ? this.places[id] ?? null : null; }

  /** Call `fn` after every frame drawn (the interaction layer follows the camera); returns a function that stops it. */
  onFrame(fn: () => void): () => void { this.frameFns.add(fn); return () => this.frameFns.delete(fn); }

  /** The size of the stage in CSS pixels (for a ray through a point of it). */
  get cssSize(): [number, number] { return [this.cssW, this.cssH]; }

  /**
   * Perform a cue that is not in the script (a gallery button, a reaction), from the world on stage now.
   * A place or a prop's look it reaches that the script never does is drawn first (once, at once).
   */
  act(cue: Cue): Run {
    if (!this.r) return NO_RUN;
    const w = this.world();
    const p = direct(w, cue, w.i + 1, this.ctx);
    this.adopt(p);
    return this.start(p);
  }

  /** Whatever a performance shows that the atlas has no art for (a place, a prop's look): made and drawn now. */
  private adopt(p: Perf) {
    let more = false;
    for (const pid of [p.before.place, p.after.place]) {
      if (!pid || this.sets.has(pid)) continue;
      const place = this.places[pid];
      if (!place) { console.warn("sahne: no place", pid); continue; }
      this.sets.set(pid, this.makeSet(place));
      more = true;
    }
    const pl = p.after.place ?? "";
    for (const s of [...Object.values(p.before.props), ...Object.values(p.after.props), ...p.props.map(e => e.state)]) if (s && this.propLook(s, pl)) more = true;
    if (!more) return;
    try { this.rasterise(); } catch (e) { console.warn("sahne: could not draw what the cue shows", e); }
  }

  /** A prop's look (its kit, params, count and whether it is held) in a place: drawn into flats once; true when it is new there. */
  private propLook(s: PropState, pl: string): boolean {
    const key = artKey(s), had = this.propArt.get(key);
    if (had) { if (had.at.has(pl)) return false; had.at.add(pl); return true; }
    const def = this.kit.props[s.kit];
    if (!def) { console.warn("sahne: no prop", s.kit); return false; }
    const out = def.draw(withVariant(def, { ...s.params, n: s.n, held: !!s.holder }), rng(s.of), this.kit);
    // each flat with words is followed by its words' own flat (DESIGN.md §6.8)
    this.propArt.set(key, { specs: out.flats.flatMap(f => { const t = this.textFlat(f); return t ? [f, t] : [f]; }), rects: [], glows: [], ghosts: [], at: new Set([pl]), ...(out.emitters?.length ? { emitters: out.emitters } : {}) });
    return true;
  }

  /** Turn an actor to `yaw` (a paper flip past ±π/2): a gallery control, not a script field. */
  turnTo(id: string, yaw: number): Run {
    if (!this.r) return NO_RUN;
    const w = this.world(), after = cloneWorld(w);
    if (!after.actors[id]) throw new Error(`sahne: no actor ${id}`);
    after.actors[id].yaw = yaw;
    const tr = emptyTrack(); tr.turns.push({ t: 0, yaw, dur: 520 });
    return this.start({ cue: w.i, dur: 600, before: w, after, tracks: { [id]: tr }, props: [], cams: [], bubbles: [], doors: [], times: [], sounds: [{ t: 260, id: "paper_flip", at: "ch:" + id, auto: true }], lines: [] });
  }

  /** Replace the cues from `i` on (a choice picked its branch). Their art must be loaded (`extra`). */
  setCues(i: number, cues: Cue[]) {
    this.script = { ...this.script, cues: [...this.script.cues.slice(0, i), ...cues] };
    const before = i > 0 ? this.perfs[i - 1].after : null;
    const rest = before ? this.directFrom(before, cues, i) : directAll(this.script.cues, [...this.actors.keys()], this.ctx);
    this.perfs = before ? [...this.perfs.slice(0, i), ...rest] : rest;
    this.plan();
  }

  private directFrom(w: World, cues: Cue[], i: number): Perf[] {
    const out: Perf[] = [];
    cues.forEach((c, k) => { const p = direct(w, c, i + k, this.ctx); out.push(p); w = p.after; });
    return out;
  }

  /** The world as it stands (or will stand, when the running cue ends). */
  world(): World {
    return this.perf ? cloneWorld(this.perf.after) : cloneWorld(this.perfs[0]?.before ?? { i: -1, place: null, time: "day", actors: {}, props: {}, shot: { kind: "wide", ids: [], objs: [] } });
  }

  private start(p: Perf): Run {
    this.finishRun();
    this.quiet();
    this.camFrom = this.perf && this.perf.after.place === p.before.place ? { ...this.cam } : null;
    this.perf = p; this.onStage(p);
    this.t0 = performance.now();
    this.pausedAt = null;
    this.ar = { perf: p, fired: p.sounds.map(() => false), said: p.lines.map(() => false), real0: this.t0 };
    this.poke();
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });
    this.resolveDone = resolve;
    if (this.motion === "still") this.t0 -= p.dur;
    this.placeSound(); this.plan();
    this.pump();
    this.kick();
    const stage = this;
    return {
      cue: p.cue, dur: p.dur, done,
      get t() { return stage.now(); },
      finish: () => { if (stage.perf === p) { stage.skipTo(p.dur); stage.t0 = performance.now() - p.dur; stage.pausedAt = null; stage.kick(); } },
      seek: (t: number) => { if (stage.perf === p) { stage.skipTo(t); stage.t0 = performance.now() - t; if (stage.pausedAt !== null) stage.pausedAt = performance.now(); stage.render(); } },
      pause: () => { if (stage.perf === p && stage.pausedAt === null) { stage.endSpeech(); stage.pausedAt = performance.now(); stage.skipTo(stage.now()); } },
      resume: () => { if (stage.perf === p && stage.pausedAt !== null) { stage.t0 += performance.now() - stage.pausedAt; stage.pausedAt = null; stage.pump(); stage.kick(); } },
    };
  }

  // ---- Sound --------------------------------------------------------------------------------

  /** Turn sound on (from a tap: browsers start audio only after one) or off. */
  setSound(on: boolean) {
    if (on === this.soundOn) return;
    this.soundOn = on;
    this.audio.setEnabled(on);
    if (on) {
      this.prepareAudio();
      // what has already happened stays silent
      if (this.ar) this.skipTo(this.now());
      this.ambientPlace = undefined;
      this.placeSound();
      this.pump();
    } else { this.quiet(); this.voice?.cancel(); }
    this.render();
  }

  /** Sound words as bubbles while sound is on. */
  setCaptions(on: boolean) { this.captions = on; this.render(); }

  setVolume(bus: Bus, v: number) { this.audio.setVolume(bus, v); }

  /** Render the sounds the loaded script uses, a little at a time. */
  private prepareAudio() {
    const list: (string | { id: string; params?: Record<string, unknown> })[] = [];
    for (const p of this.perfs) for (const s of p.sounds) list.push(s.music ? s.id : { id: s.id, params: s.params });
    for (const pl of Object.values(this.places)) {
      list.push(...pl.ambience ?? [], { id: "step", params: pl.surface ? { surface: pl.surface } : undefined });
      // the sounds its animals make when tapped (FlatReact.tap)
      for (const { out } of drawPieces(pl, this.kit)) for (const fs of out.flats) if (fs.react?.tap?.sound) list.push(fs.react.tap.sound);
      if (pl.motif) list.push(pl.motif);
    }
    list.push("door_open", "door_close", "paper_flip");
    this.audio.prepare(list);
  }

  /** The ambience of the place on stage. */
  private placeSound() {
    const place = this.perf?.after.place ?? null, weather = this.perf?.after.weather, key = `${place}|${weather ?? ""}`;
    if (key === this.ambientPlace) return;
    this.ambientPlace = key;
    // the weather's own bed (rain) joins the place's, when the kit has it
    const bed = WEATHER[weather ?? ""]?.bed, beds = place ? this.places[place]?.ambience ?? [] : [];
    this.audio.ambience(bed && this.kit.sounds?.[bed] && !beds.includes(bed) ? [...beds, bed] : beds);
  }

  /** Stop the voice and whatever is scheduled for later: the performance is being replaced or skipped. */
  private quiet() {
    this.endSpeech();
    this.audio.stopPending();
  }

  /** Jump the sound to `t`: what lies before it is skipped, not played late. */
  private skipTo(t: number) {
    this.quiet();
    const ar = this.ar;
    if (!ar) return;
    ar.perf.sounds.forEach((s, k) => { ar.fired[k] = s.t < t; });
    ar.perf.lines.forEach((l, k) => { ar.said[k] = l.t0 < t; });
  }

  /** The sound's own time: the stage's, except in Still, where the picture is the end pose and the sound runs from the start. */
  private audioNow(): number {
    return this.motion === "still" && this.ar ? performance.now() - this.ar.real0 : this.now();
  }

  /** Play what is due: sounds a little ahead on the audio clock, lines as their time comes. */
  private pump() {
    const p = this.perf, ar = this.ar;
    if (!p || !ar || ar.perf !== p || !this.soundOn || this.pausedAt !== null) { if (this.pumpTimer) clearInterval(this.pumpTimer); this.pumpTimer = 0; return; }
    const t = this.audioNow(), still = this.motion === "still";
    // lines: the voice takes over the clock (a line noticed a little late still starts from its first word)
    p.lines.forEach((line, k) => {
      if (ar.said[k] || line.t0 > t + 15 || this.speech) return;
      ar.said[k] = true;
      if (t < line.t0 + 800) this.speakLine(line);
    });
    const LOOK = 150, next = p.lines.find((l, k) => !ar.said[k])?.t0 ?? Infinity;
    for (let k = 0; k < p.sounds.length; k++) {
      const s = p.sounds[k];
      if (ar.fired[k]) continue;
      if (s.t > t + LOOK) break;
      // across a voiced line the clock may wait, so sounds there are played as their time comes
      if ((this.speech || s.t > next) && s.t > t) continue;
      ar.fired[k] = true;
      if (s.t < t - 250 || (still && s.auto)) continue;
      const when = this.audio.time + Math.max(0, s.t - t) / 1000;
      if (s.music) this.audio.motif(s.id, { when });
      else this.audio.play(s.id, { when, pan: this.panOf(s.at), params: s.params });
    }
    // the run ends here too, where animation frames are paused (a hidden page)
    if (this.resolveDone && this.now() >= p.dur) this.finishRun();
    const busy = !!this.speech || !!this.resolveDone || ar.said.some(x => !x) || ar.fired.some(x => !x);
    if (busy && !this.pumpTimer) this.pumpTimer = setInterval(() => this.pump(), 40) as unknown as number;
    if (!busy && this.pumpTimer) { clearInterval(this.pumpTimer); this.pumpTimer = 0; }
  }

  /** Left or right in the frame, for a sound from a target. */
  private panOf(at: Target | undefined): number {
    const f = this.frame, p = at && f ? this.point(at, f) : null, q = p ? this.project(p) : null;
    return q ? clamp(q[0] / this.cssW * 2 - 1, -1, 1) * 0.6 : 0;
  }

  private speakLine(line: VoiceLine) {
    const v = this.voice;
    if (!v || !v.available(this.lang.id) || this.audio.volumes.voice <= 0) return;
    const clock = this.motion === "still" ? null : new SpeechClock(line.t0, line.words, line.t1 - line.t0);
    const s: Voicing = { line, clock, handle: null };
    this.speech = s;
    this.audio.duck(true);
    let guard = 0;
    const done = () => {
      clearTimeout(guard);
      if (this.speech !== s) return;
      clock?.end(performance.now());
      this.releaseSpeech();
      this.pump();
    };
    // a voice that never starts, or never ends, lets go of the clock
    guard = setTimeout(done, 2500) as unknown as number;
    const handle = v.speak(line.text, {
      lang: this.lang.id, who: line.who, spec: this.voices[line.who], rate: line.rate, whisper: line.whisper, volume: this.audio.volumes.voice, out: this.audio.voiceOut,
      onStart: () => { clock?.start(performance.now()); clearTimeout(guard); guard = setTimeout(done, (line.t1 - line.t0) * 2.5 + 3000) as unknown as number; this.kick(); },
      onWord: i => { clock?.word(i, performance.now()); this.kick(); },
      onEnd: done,
    });
    // not voiced here: the line keeps the stage's own timing, as with no voice (the clock never started, so time runs on unchanged)
    if (!handle) {
      clearTimeout(guard);
      if (this.speech === s) { this.speech = null; this.audio.duck(false); }
      return;
    }
    s.handle = handle;
  }

  /** The voice let go of the clock: time runs on from where the voice left it. */
  private releaseSpeech() {
    const s = this.speech;
    if (!s) return;
    this.speech = null;
    if (s.clock) { const real = this.pausedAt ?? performance.now(); this.t0 = real - s.clock.at(real); }
    this.audio.duck(false);
    this.kick();
  }

  /** Cut the voice off, leaving the clock where it is. */
  private endSpeech() {
    const s = this.speech;
    if (!s) return;
    this.releaseSpeech();
    s.handle?.cancel();
  }

  private finishRun() { if (this.resolveDone) { const r = this.resolveDone; this.resolveDone = null; r(); } }

  /** Ms into the current performance (while a line is voiced, the voice's clock). */
  now() {
    const real = this.pausedAt ?? performance.now();
    return this.speech?.clock ? this.speech.clock.at(real) : real - this.t0;
  }

  /** Lines as bubbles (theatre mode) or not (log mode), without rebuilding the stage; the next cue frames for it. A stage made
   * with `bubbles: false` has no overlay, and this does nothing. */
  // bubbleIds becomes one no list makes ("" is the empty list's), so the next frame sets the overlay even when it is left empty
  setBubbles(on: boolean) { if (this.lines === on) return; this.lines = on; this.bubbleIds = "\0"; this.poke(); }
  /** Turn tap-to-translate on the bubbles on or off (it needs `gloss` in the options). */
  setGlosses(on: boolean) { this.overlay?.setGloss(on ? this.gloss : null); }

  setMotion(m: Motion) { this.motion = m; this.overlay?.setStill(m === "still"); this.poke(); }

  /** Input happened: idle life wakes up again. */
  poke() { this.lastInput = performance.now(); this.kick(); }

  private kick() { if (!this.raf && this.r && !this.destroyed && this.visible && !document.hidden) this.raf = requestAnimationFrame(() => this.tick()); }
  private stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

  private idleAmount() {
    if (this.motion === "still") return 0;
    const since = performance.now() - this.lastInput;
    return since > this.idleTimeout ? 0 : this.motion === "calm" ? 0.5 : 1;
  }

  /** A place whose life never pauses on stage (`life: "run"`, a vehicle). */
  private running() { const id = this.perf?.after.place; return !!id && this.places[id]?.life === "run"; }

  /**
   * How fast the place's own clock runs (DESIGN.md §6.9): held in Still; else at the motion's pace while
   * a cue plays, a line is voiced or the place runs (a vehicle's view keeps moving), and otherwise with
   * idle life, which stops a while after the last input.
   */
  private lifeRate() {
    if (this.motion === "still") return 0;
    const p = this.perf;
    if (this.running() || this.speech || (p && this.now() < p.dur)) return this.motion === "calm" ? 0.5 : 1;
    return this.idleAmount();
  }

  private tick() {
    this.raf = 0;
    const p = this.perf, now = performance.now();
    // idle life alone needs no more frames than `idleFps`, a running place (a vehicle) no more than 30; anything else (a swap, a cue, a camera move) draws at once
    const gap = this.idleGap || (this.running() ? 1000 / 30 - 4 : 0);
    if (gap && p && !this.swaps.size && !this.camBusy && !this.looping && !this.speech && this.now() >= p.dur + 50 && now - this.lastDraw < gap) { this.kick(); return; }
    this.lastDraw = now;
    this.pump();
    // a swap that took long (a slow phone) is a task of its own: the next frame draws the new look, and builds no other before it,
    // so a look asked for every frame (a slider being dragged) still gets drawn
    if (!this.built && this.applySwaps() > 20) { this.built = true; this.lastDraw = 0; this.kick(); return; }
    this.built = false;
    this.render();
    if (!p) return;
    const t = this.now();
    if (t >= p.dur && this.resolveDone) this.finishRun();
    this.looping = this.motion !== "still" && Object.values(this.frame?.actors ?? {}).some(a => a.gestures.some(g => g.loop));
    if (this.pausedAt === null && (t < p.dur + 50 || this.looping || this.lifeRate() > 0 || this.camBusy || (this.swaps.size && !this.r?.lost))) this.kick();
  }

  // ---- Targets ----------------------------------------------------------------

  private propPoint(s: PropState): Vec3 | null {
    if (this.held?.id === s.id) return this.held.at;
    if (s.holder) return this.actors.get(s.holder.actor)?.grips[s.holder.side] ?? null;
    if (!s.at) return null;
    const art = this.propArt.get(artKey(s)), b = art?.rects[0]?.box;
    return b ? [s.at[0] + (b[0] + b[2]) / 200, s.at[1] - (b[1] + b[3]) / 200, s.at[2]] : s.at;
  }

  /** A target as a world point, for gestures, gaze and sound words. */
  point(t: Target | null | undefined, f: Frame): Vec3 | null {
    if (!t) return null;
    if (t === "viewer") return [...this.cam.eye] as Vec3;
    const i = t.indexOf(":"), kind = t.slice(0, i), rest = t.slice(i + 1);
    if (kind === "obj") {
      const s = f.props[rest] ?? Object.values(f.props).find(p => p.of === rest);
      return s ? this.propPoint(s) : null;
    }
    if (kind === "ch") {
      const [id, part] = rest.split("."), a = this.actors.get(id), af = f.actors[id];
      if (!a || !af) return null;
      const b = a.puppet.body, y = part === "head" ? b.H - b.headH * 0.5 : part === "hand" ? b.legLen + 5 : b.H - b.headH - b.torsoL * 0.4;
      return [af.pos[0], af.pos[1] + y / 100, af.pos[2]];
    }
    if (kind === "mark") {
      const pl = f && this.perf?.after.place ? this.places[this.perf.after.place] : null, m = pl?.marks[rest];
      return m ? [m.x, m.y ?? 1.3, m.z] : null;
    }
    if (kind === "pass") {
      const [x, y] = rest.split(":").map(id => f.actors[id]);
      const hx = rest.split(":").map(id => this.actors.get(id)?.puppet.body);
      if (!x || !y || !hx[0] || !hx[1]) return null;
      const h = Math.min(hx[0].legLen + hx[0].torsoL * 0.45, hx[1].legLen + hx[1].torsoL * 0.45) / 100;
      return [(x.pos[0] + y.pos[0]) / 2, Math.max(h, 1.08), (x.pos[2] + y.pos[2]) / 2];
    }
    return null;
  }

  /** A world point in an actor's paper space (cm, y down). */
  private paperOf(af: ActorFrame, p: Vec3): Vec2 {
    const c = Math.cos(af.yaw), s = Math.sin(af.yaw);
    return [((p[0] - af.pos[0]) * c - (p[2] - af.pos[2]) * s) * 100, -(p[1] - af.pos[1]) * 100];
  }

  // ---- Camera ------------------------------------------------------------------

  /** The studio's camera: the actor framed for the canvas (cached until the framing, the canvas or the look changes). */
  private studioCam(): CamState {
    const c = this.studioCfg!, a = this.actors.get(c.id)!;
    const key = `${c.framing}|${this.aspect.toFixed(3)}|${a.ver}`;
    if (c.cam?.key !== key) c.cam = { key, cam: figureCam(c.framing, a.dims ??= figureDims(a.puppet as Puppet), this.aspect, c.ref) };
    return c.cam.cam;
  }

  private shotCam(shot: Shot, f: Frame): CamState {
    const p = this.perf;
    if (!p) return this.framing(shot, f);
    let m = this.camCache.get(p);
    if (!m) { m = new Map(); this.camCache.set(p, m); }
    const key = JSON.stringify(shot) + "|" + this.aspect.toFixed(3);
    let cam = m.get(key);
    if (!cam) { cam = this.framing(shot, f); m.set(key, cam); }
    return cam;
  }

  /** Framings from where the actors will stand when the cue ends (so the camera does not drift). */
  framing(shot: Shot, f: Frame): CamState {
    const aspect = this.aspect, place = this.perf?.after.place ? this.places[this.perf.after.place] : null;
    const end = this.perf?.after;
    const ids = shot.ids.filter(id => this.actors.has(id) && end?.actors[id]?.on);
    // the things a shot shows besides people (`obj`): each with a little room round it
    const objBoxes = (pad: number): FrameBox[] => shot.objs.flatMap(o => {
      const p = (end?.props[o] ?? f.props[o])?.at;
      return p ? [{ x0: p[0] - 0.12 - pad, x1: p[0] + 0.12 + pad, y0: p[1] - 0.05 - pad / 2, y1: p[1] + 0.3 + pad / 2, z: p[2] }] : [];
    });
    // the things alone, when no one performs (a beat that only points the camera at the bread)
    if (shot.kind === "obj" && !ids.length && shot.objs.length) {
      const boxes = objBoxes(0.35);
      if (boxes.length) return frameBoxes(boxes, { aspect, margin: 0.12, tilt: 0.08 });
    }
    if (shot.kind === "wide" || !ids.length) {
      // fit the width at the back of the set, so the walls fill the frame
      return frameBoxes([wideBox(place)], { aspect, margin: 0, tilt: 0.1, minDist: 3, lift: 0.04 });
    }
    // with bubbles on (theatre mode), room above the heads so a line sits over its speaker
    const room = this.overlay && this.lines ? (shot.kind === "close" ? 0.2 : 0.38) : 0.04;
    const box = (id: string, part: "upper" | "bust" | "head"): FrameBox => {
      const a = this.actors.get(id)!, b = a.puppet.body, H = b.H / 100, w = b.shoulderW / 100, p = end!.actors[id].pos;
      // a kit puppet (a 45 cm bird) is framed whole, with room round her: the human crops would fill the screen with a face
      if (a.kit) { const r = part === "head" ? 0.22 : part === "bust" ? 0.32 : 0.45; return { x0: p[0] - r - w / 2, x1: p[0] + r + w / 2, y0: p[1] - r * 0.4, y1: p[1] + H + r, z: p[2] }; }
      const y0 = part === "upper" ? H * 0.42 : part === "bust" ? H - b.headH / 100 * 1.9 : H - b.headH / 100 * 1.25;
      const half = part === "head" ? b.headW / 100 * 0.9 : w * 0.9;
      // from where she stands (a floor, a ledge), lower by as much as she sits down (pose.ts `seated`)
      const seat = end!.actors[id].seat, down = seat !== undefined ? Math.max(0, b.legLen / 100 - seat - 0.02) : 0;
      return { x0: p[0] - half, x1: p[0] + half, y0: p[1] + y0 - down, y1: p[1] + H + room - down, z: p[2] };
    };
    const boxes: FrameBox[] = shot.kind === "two" ? ids.map(id => box(id, "upper")) : shot.kind === "single" ? [box(ids[0], "upper")] : [box(ids[0], shot.kind === "close" ? "head" : "bust")];
    boxes.push(...objBoxes(0));
    return frameBoxes(boxes, { aspect, margin: shot.kind === "close" ? 0.22 : 0.1, tilt: shot.kind === "close" ? 0.04 : 0.08 });
  }

  /** `follow`: a box round the actor where she is now (a walk, a flight), framed afresh every frame; null for any other shot. */
  private follow(f: Frame): CamState | null {
    const s = f.shot.to, id = s.kind === "follow" ? s.ids.find(i => this.actors.has(i) && f.actors[i]?.on) : undefined;
    if (!id) return null;
    const p = f.actors[id].pos, y = p[1] + this.actors.get(id)!.puppet.body.H / 200;
    return frameBoxes([{ x0: p[0] - 0.9, x1: p[0] + 0.9, y0: y - 0.9, y1: y + 0.9, z: p[2] }], { aspect: this.aspect, minDist: 2, tilt: 0.08 });
  }

  // ---- Drawing ----------------------------------------------------------------

  render() {
    const p = this.perf, r = this.r;
    if (!p || !r || r.lost || this.destroyed) return;
    // the place's own clock: it runs with idle life, and pauses (never jumps back) without it
    const now = performance.now();
    this.lifeT += Math.min(100, now - (this.lifeAt || now)) * this.lifeRate(); this.lifeAt = now;
    const place = p.after.place, set = place ? this.sets.get(place) : null;
    if (!set) return;
    // a cut to a place the atlas lacks (its idle-time drawing not done yet): drawn now, never shown missing
    if (!this.res.includes(place!)) try { this.rasterise(); } catch (e) { console.warn("sahne: could not draw the place", e); this.broken = true; return; }
    const t0 = performance.now();
    const f = this.frame = evaluate(p, this.motion === "still" ? p.dur : Math.max(0, this.now()));
    this.stopsClock(f, place!);

    // light and camera
    const day = blendLight(TIMES[f.time.from] ?? TIMES.day, TIMES[f.time.to] ?? TIMES.day, f.time.k);
    // the weather over the time of day, and lightning (never in Still: no flashing for reduced motion)
    this.light = withFlash(f.weather.k < 1 ? blendLight(withWeather(day, f.weather.from), withWeather(day, f.weather.to), f.weather.k) : withWeather(day, f.weather.to), this.motion === "still" ? 0 : f.flash);
    // the studio ignores the script's shots: it frames its actor, and eases to a new framing or build; `follow` eases after its moving actor (Still cuts)
    const target = this.studioCfg ? this.studioCam() : this.follow(f);
    if (target) {
      this.cam = this.snapCam ? target : stepCam(this.cam, target, t0 - this.camT, this.motion === "still" ? 0 : CAM_MS);
      this.camBusy = this.cam !== target;
    } else {
      this.camBusy = false;
      const toCam = this.shotCam(f.shot.to, f);
      if (this.motion === "still") this.cam = toCam;
      else if (f.shot.k < 1) this.cam = blendCam(this.camFrom ?? this.shotCam(f.shot.from, f), toCam, f.shot.k);
      else if (this.camFrom && f.t < CAM_MS && p.cams.every(c => c.t === 0)) this.cam = blendCam(this.camFrom, toCam, ease.inOut(f.t / CAM_MS));
      else this.cam = toCam;
    }
    this.snapCam = false; this.camT = t0;
    // the lights switched off indoors: the room dims as much as the lamps lit it (by night far more than by day)
    const pl = this.places[place!];
    if (f.lights < 1 && !pl?.outdoor) { const k = 1 - 0.35 * (1 - f.lights) * this.light.glow; this.light = { ...this.light, amb: this.light.amb.map(v => v * k) as typeof this.light.amb }; }
    const L = this.light;

    r.begin();
    r.transparent = r.alpha && this.studioCfg?.backdrop === "none";
    if (!r.transparent) {
      const top = [...L.skyTop, 1] as [number, number, number, number], bot = [...L.skyBottom, 1] as [number, number, number, number];
      r.colorQuad([[-80, 45, -45], [80, 45, -45], [80, -5, -45], [-80, -5, -45]], [top, top, bot, bot], MODE.flat, 0);
    }

    // painter's order by depth along the view axis, from each object's floor position
    const eye = this.cam.eye, tg = this.cam.target, fl = dist(eye, tg) || 1;
    const fwd: Vec3 = [(tg[0] - eye[0]) / fl, (tg[1] - eye[1]) / fl, (tg[2] - eye[2]) / fl];
    const depth = (q: Vec3) => (q[0] - eye[0]) * fwd[0] + (q[1] - eye[1]) * fwd[1] + (q[2] - eye[2]) * fwd[2];
    const objs: { d: number; draw: () => void }[] = [];
    if (this.pickable) this.picks = [];
    this.texts.length = 0;
    // the place's states: what is in neither the old nor the new is skipped, what changes fades (a cut is k = 1)
    const shows = (list?: string[]) => { const a = inState(list, f.state.from) ? 1 : 0, b = inState(list, f.state.to) ? 1 : 0; return a + (b - a) * f.state.k; };
    const clear = 1 - cloudAt(f.weather);
    for (const fl0 of set.flats) {
      // a `reveal` flat does not fade: it is drawn down from its top edge by how much of its state is on
      const rv = fl0.spec.reveal && fl0.in ? shows(fl0.in) : undefined;
      const a = (rv !== undefined ? 1 : fl0.in ? shows(fl0.in) : 1) * (fl0.spec.when ? whenWeight(fl0.spec.when, f) : 1) * (fl0.spec.sky ? clear : 1);
      // the sky is behind everything, floors too (as the fireworks are); a flat on a path is where the path has it now
      const mv = fl0.spec.move?.path ? moveAt(fl0.spec.move, this.clockFor(fl0.spec.move, fl0.still)) : null;
      // words go just over their flat
      const c0 = fl0.base?.center ?? fl0.center, d0 = depth([c0[0] + (mv?.at[0] ?? 0), 0, c0[2] + (mv?.at[2] ?? 0)]) - (fl0.base ? 1e-4 : 0);
      if (a > 0.001 && (rv === undefined || rv > 0.001)) objs.push({ d: fl0.spec.sky ? 2e9 + 1 : fl0.under ? 1e9 + 1 + d0 : fl0.floor ? 1e9 : d0, draw: () => { this.pickAs = fl0.floor || a < 0.5 || fl0.spec.pick === false ? null : "piece:" + (fl0.piece ?? ""); this.drawFlat(fl0, f, a, rv); } });
    }
    // a dragged prop is drawn lying where the pointer is, until the performance moves it on
    const hd = this.held, hs = hd ? f.props[hd.id] : undefined;
    if (hd && (!hs || heldKey(hs) !== hd.from)) this.held = null;
    for (const s0 of Object.values(f.props)) {
      const s = this.held?.id === s0.id ? { ...s0, holder: undefined, at: this.held.at, shown: true } : s0;
      if (s.holder || !s.at || (!s.shown && !s.ghost)) continue;
      const pa = s.in ? shows(s.in) : 1;
      if (pa <= 0.001) continue;
      const art = this.propArt.get(artKey(s));
      if (!art) continue;
      art.specs.forEach((spec, k) => {
        const { R, D } = axes(spec.yaw, spec.pitch);
        const O: Vec3 = [s.at![0] + (spec.x ?? 0) / 100, s.at![1] + (spec.y ?? 0) / 100, s.at![2] + (spec.z ?? 0) / 100];
        const rect = s.shown ? art.rects[k] : art.ghosts[k];
        const flat: Flat = { spec, rect, glow: s.shown ? art.glows[k] : undefined, O, R, D, yaw: spec.yaw ?? 0, pitch: spec.pitch ?? 0, lit: spec.lit ?? 1, shadow: s.shown && spec.shadow === "drop", floor: false, center: O, still: s.still };
        objs.push({ d: (this.held?.id === s.id ? -1e9 : depth([O[0], 0, O[2]])) - (this.texted.has(spec) ? 1e-4 : 0), draw: () => { this.pickAs = s.shown && pa >= 0.5 ? "obj:" + s.id : null; this.drawFlat(flat, f, pa); } });
      });
    }
    this.assignSlots(f);
    const tp = performance.now();
    const posed: { a: Actor; af: ActorFrame; world: Map<string, Affine>; alt: Record<string, string>; faceOff: Vec2 }[] = [], held: { e: EmitSpec; seed: string; at: Vec3 }[] = [];
    for (const af of Object.values(f.actors)) {
      const a = this.actors.get(af.id);
      if (!a || !af.on) continue;
      const pz = this.pose(a, af, f), up = af.pos[1] > 0.01;
      // on the floor her shadow goes with the floor's (under every piece); up on a ledge, just before her
      if (!up) posed.push({ a, af, ...pz });
      objs.push({ d: depth([af.pos[0], 0, af.pos[2]]), draw: () => { if (up) this.drawBlob(af, a); this.drawActor(a, af, f, pz.world, pz.alt, pz.faceOff); } });
      // the steam or flames of what she holds, where drawHeld puts it: upright, its base in the grip
      for (const side of ["l", "r"] as const) {
        const h = af.hold[side], s = h?.prop ? f.props[h.prop] : undefined, art = s && this.propArt.get(artKey(s)), hb = pz.world.get("hand_" + side);
        if (!s || !art?.emitters?.length || !hb || s.holder?.actor !== a.id || this.held?.id === s.id) continue;
        const b = a.puppet.body, g = apply(hb, 0, b.handL * 0.45), ox = g[0], oy = g[1] + b.handL * 0.3, { R, D } = axes(af.yaw);
        for (const [k, e] of art.emitters.entries()) held.push({ e, seed: `${s.id}|e${k}`, at: at(af.pos, R, D, ox + e.x, oy - e.y) });
      }
    }
    this.stats.poseMs = +(performance.now() - tp).toFixed(2);
    this.particles(f, set, objs, depth, shows, held);
    objs.sort((x, y) => y.d - x.d);
    const floorEnd = objs.findIndex(o => o.d < 1e9);
    objs.splice(floorEnd < 0 ? objs.length : floorEnd, 0, { d: 0, draw: () => { for (const q of posed) this.drawBlob(q.af, q.a); } });
    for (const o of objs) o.draw();

    const lights: PointLight[] = set.lamps
      .filter(l => !l.spec.at || l.spec.at.includes(f.time.k < 0.5 ? f.time.from : f.time.to))
      .map(l => ({ pos: l.pos, color: hexToRgb(l.spec.color), intensity: (l.spec.intensity ?? 1) * L.practical * (l.in ? shows(l.in) : 1) * (l.sw ? f.lights : 1), radius: l.spec.radius }))
      .filter(l => l.intensity > 0.001);
    // the renderer lights with the first four: those nearest what the shot looks at (a stairwell's landing lamps, high up the stair)
    if (lights.length > 4) { const T = this.cam.target; lights.sort((a, b) => dist(a.pos, T) - dist(b.pos, T)); }
    const out = r.draw(this.cam, L, lights, this.dim);
    this.vp = out.viewProj;
    this.stats.vertices = out.vertices;
    this.stats.frameMs = +(performance.now() - t0).toFixed(2);
    this.updateBubbles(f);
    this.pickAs = null;
    for (const fn of this.frameFns) fn();
  }

  /**
   * The frame's particles (DESIGN.md §6.7), each sorted in with the rest by its depth: rain from the
   * weather (outdoors through the whole set; indoors only behind the back wall, so it shows through
   * the windows), steam and smoke from pieces and props, breath in a cold state, fireworks. Rain, steam
   * and breath run on the place's clock (still in reduced motion); fireworks on the cue's, and in reduced
   * motion each is a still burst.
   */
  private particles(f: Frame, set: { emitters: { pos: Vec3; spec: EmitSpec; in?: string[]; seed: string }[] }, objs: { d: number; draw: () => void }[], depth: (q: Vec3) => number, shows: (l?: string[]) => number, held: { e: EmitSpec; seed: string; at: Vec3 }[] = []) {
    const out: Sprite[] = [], place = this.places[this.perf!.after.place!], life = this.lifeT, still = this.motion === "still";
    // rain
    const rain = (f.weather.from === "rain" ? 1 - f.weather.k : 0) + (f.weather.to === "rain" ? f.weather.k : 0);
    if (rain > 0.01 && place) {
      const b = wideBox(place), outdoor = !!place.outdoor, span = (b.x1 - b.x0) / 2 + 1.5, cx = (b.x0 + b.x1) / 2;
      rainAt(`${place.id}|rain`, { x0: cx - span, x1: cx + span, y0: -0.1, y1: b.y1 + 1.6, z0: outdoor ? b.z - 1.5 : b.z - 3.5, z1: outdoor ? 1.2 : b.z - 0.15 }, life, Math.round((outdoor ? 220 : 150) * rain), out);
    }
    // steam and smoke, from the set and from the props standing in it
    const emit = (e: EmitSpec, seed: string, at: Vec3) => e.kind === "flame" ? flameAt(seed, at, life, out, (e.w ?? 1.2) / 100) : puffAt(e.kind, seed, at, life, out, (e.w ?? 6) / 100);
    for (const e of set.emitters) if (!e.in || shows(e.in) > 0.5) emit(e.spec, e.seed, e.pos);
    for (const s of Object.values(f.props)) {
      const art = s.at && !s.holder && s.shown ? this.propArt.get(artKey(s)) : undefined;
      for (const [k, e] of (art?.emitters ?? []).entries()) emit(e, `${s.id}|e${k}`, [s.at![0] + e.x / 100, s.at![1] + e.y / 100, s.at![2] + (e.z ?? 5) / 100]);
    }
    // and from the props in a hand, where this frame's pose puts them (as drawHeld draws them: upright, the base in the grip)
    for (const h of held) emit(h.e, h.seed, h.at);
    // breath: in a cold state every few seconds, and on `do: "breath"`
    const cold = !!place?.states && f.state.to.some(s => place.states![s]?.cold);
    for (const af of Object.values(f.actors)) {
      const mouth = af.on ? this.actors.get(af.id)?.talk?.mouth : undefined;
      if (!mouth) continue;
      const dir = Math.sin(af.yaw) > 0.2 ? 1 : Math.sin(af.yaw) < -0.2 ? -1 : 0;
      if (cold) breathAt(mouth, (life + (hashString(af.id) % 3500)) % 3500, dir, out);
      for (const pf of this.perf!.puffs ?? []) if (pf.who === af.id) breathAt(mouth, f.t - pf.t, dir, out);
    }
    // fireworks: on the cue's clock; in reduced motion a still burst
    for (const bu of this.perf!.bursts ?? []) if (bu.t <= f.t) burstAt(bu.seed, bu.at, still ? 700 : f.t - bu.t, out, 2.2);
    if (!out.length) return;
    // camera-facing quads: the view's right and up
    const e = this.cam.eye, tg = this.cam.target, fw = [tg[0] - e[0], tg[1] - e[1], tg[2] - e[2]], fl = Math.hypot(fw[0], fw[1], fw[2]) || 1;
    const fwd = fw.map(v => v / fl), rl = Math.hypot(fwd[2], fwd[0]) || 1, right: Vec3 = [-fwd[2] / rl, 0, fwd[0] / rl];
    const up: Vec3 = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    for (const s of out.slice(0, MAX_SPRITES)) {
      const R: Vec3 = [right[0] * s.w / 2, right[1] * s.w / 2, right[2] * s.w / 2], U: Vec3 = [up[0] * s.h / 2, up[1] * s.h / 2, up[2] * s.h / 2];
      // sky things go behind everything, floors too (the floors are drawn first of all, at 1e9)
      objs.push({ d: s.sky ? 2e9 : depth([s.pos[0], 0, s.pos[2]]), draw: () => this.r!.sprite(s.pos, R, U, s.color, s.shape, !!s.additive, s.lit ?? 0, s.slant ?? 0) });
    }
  }

  /** The face texture's slots go to the actors on stage (up to the slot count); a new owner redraws. */
  private assignSlots(f: Frame) {
    const n = this.r?.faces.count ?? 0, on = new Set(Object.values(f.actors).filter(a => a.on).map(a => a.id));
    for (let i = 0; i < n; i++) if (this.slotOwner[i] && !on.has(this.slotOwner[i]!)) this.slotOwner[i] = null;
    for (const id of on) {
      const a = this.actors.get(id);
      if (!a?.puppet.faceRegion || (a.slot >= 0 && this.slotOwner[a.slot] === id)) continue;
      const free = Array.from({ length: n }, (_, i) => i).find(i => !this.slotOwner[i]);
      if (free === undefined) { a.slot = -1; continue; }
      this.slotOwner[free] = id; a.slot = free; a.drawnFace = "";
    }
  }

  /** Pose an actor for this frame and bring its face texture up to date. */
  private pose(a: Actor, af: ActorFrame, f: Frame) {
    const E = this.kit.face.emotions, pa = E[af.emo.from] ?? {}, pb = E[af.emo.to] ?? {}, k = af.emo.k;
    const gestures: GestureRun[] = af.gestures.map(g => {
      const p = this.point(g.at, f);
      return { id: g.id, t: g.t, side: g.side, n: g.n, loop: g.loop, target: p ? this.paperOf(af, p) : undefined };
    });
    const cy = Math.cos(af.yaw), sy = Math.sin(af.yaw);
    const walkDir = af.walk ? Math.sign(af.walk.dir[0] * cy - af.walk.dir[2] * sy) || 1 : 1;
    // how open the mouth is (a kit puppet's beak): the visemes' openness, faded with the speech
    const V = this.kit.face.visemes, m = af.mouth, op = (v: string) => V[v]?.open ?? 0;
    const out = (a.kit?.pose ?? composePose)({
      bones: a.puppet.bones, body: a.puppet.body, defs: (a.kit ?? this.kit).gestures, gestures,
      hold: { l: af.hold.l?.w ?? 0, r: af.hold.r?.w ?? 0 },
      walk: af.walk ? { phase: af.walk.phase, amount: af.walk.amount, dir: walkDir, how: af.walk.how, climb: af.walk.climb } : undefined, seat: af.seat,
      emo: af.emo.to, talk: m ? clamp((op(m.v0) + (op(m.v1) - op(m.v0)) * m.k) * m.amount, 0, 1) : 0, air: af.air, pace: af.pace, life: this.lifeT,
      emotion: { headTilt: (pa.headTilt ?? 0) + ((pb.headTilt ?? 0) - (pa.headTilt ?? 0)) * k, posture: (pa.posture ?? 0) + ((pb.posture ?? 0) - (pa.posture ?? 0)) * k },
      idle: { t: performance.now(), seed: a.id, amount: this.idleAmount() },
    });
    // seated side on: the side view's own bones, the thighs level, the hands on the lap (no gestures but the face's)
    const side = this.sideOf(a, af);
    const world = side ? solve(seatedSide(a.puppet.body, af.seat!.h * 100)) : solve(a.puppet.bones, out.pose);
    // a kit puppet's eyes and beak are art its pose switches: no face texture
    if (a.kit) return { world, alt: out.alt, faceOff: out.faceOff };

    // the face: emotion, then the gesture's face, then gaze, blink and the mouth
    let face = k >= 1 ? faceFrom(pb) : blendFace(faceFrom(pa), faceFrom(pb), k);
    for (const x of out.faces) if (x.w > 0.001) face = blendFace(face, faceFrom(x.preset, face), clamp(x.w, 0, 1));
    const b = a.puppet.body, eyeY = -(b.H - b.headH * 0.57);
    const gaze = (t: Target | null): Vec2 => {
      if (!t) return [0, 0];
      const p = this.point(t, f);
      if (!p) return [0, 0];
      const q = this.paperOf(af, p);
      return [clamp(q[0] / 70, -0.85, 0.85), clamp((q[1] - eyeY) / 140, -0.55, 0.6)];
    };
    let pupil: Vec2;
    const gt = af.gestures.find(g => g.at)?.at;
    if (out.look === "target" && gt) pupil = gaze(gt);
    else if (out.look === "up") pupil = [0.25, -0.6];
    else if (out.look === "down") pupil = [0, 0.55];
    else if (out.look === "away") pupil = [-0.6, 0.1];
    else { const p0 = gaze(af.look.from), p1 = gaze(af.look.to); pupil = [p0[0] + (p1[0] - p0[0]) * af.look.k, p0[1] + (p1[1] - p0[1]) * af.look.k]; }
    face.pupil = [clamp(pupil[0] + out.saccade[0], -0.95, 0.95), clamp(pupil[1] + out.saccade[1], -0.8, 0.8)];
    // a blink goes with a head turn (DESIGN.md §7)
    const blink = Math.max(out.blink, af.turning !== null && af.turning < 0.45 ? Math.sin(Math.PI * af.turning / 0.45) : 0);
    if (blink > 0) face.eyeOpen = [face.eyeOpen[0] * (1 - blink), face.eyeOpen[1] * (1 - blink)];
    if (af.mouth) {
      const v0 = V[af.mouth.v0] ?? {}, v1 = V[af.mouth.v1] ?? {}, m = face.mouth, q = af.mouth.k;
      const scale = af.mouth.voice === "whisper" ? 0.6 : 1;
      const ch = (key: "open" | "round" | "teeth", def: number) => ((v0[key] ?? def) + ((v1[key] ?? def) - (v0[key] ?? def)) * q);
      const wide = ((v0.wide ?? m.wide) + ((v1.wide ?? m.wide) - (v0.wide ?? m.wide)) * q);
      const speak = { open: Math.max(m.open * 0.3, ch("open", 0) * scale), wide: m.wide + (wide - m.wide) * 0.75, round: ch("round", 0), smile: m.smile * 0.65, teeth: Math.max(ch("teeth", 0), m.teeth * 0.3) };
      const w = af.mouth.amount;
      face.mouth = { open: m.open + (speak.open - m.open) * w, wide: m.wide + (speak.wide - m.wide) * w, round: m.round + (speak.round - m.round) * w, smile: m.smile + (speak.smile - m.smile) * w, teeth: m.teeth + (speak.teeth - m.teeth) * w };
    }
    a.face = face;
    const key = faceKey(face) + (side ? "|side" : "");
    if (a.slot >= 0 && key !== a.drawnFace) {
      a.drawnFace = key;
      const { faceStyle } = a.puppet, region = side ? a.puppet.side!.faceRegion : a.puppet.faceRegion!;
      this.r!.faces.update(a.slot, region, c => side ? this.kit.face.drawSide!(c, faceStyle!, face, region) : this.kit.face.draw(c, faceStyle!, face, region));
    }
    const alt = { ...out.alt };
    for (const side of ["l", "r"] as const) if (!alt["hand_" + side] && (af.hold[side]?.w ?? 0) > 0.3 && af.hold[side]?.prop) alt["hand_" + side] = "hold";
    return { world, alt, faceOff: side ? [0, 0] as Vec2 : out.faceOff };
  }

  /** Seated side on (a seat mark facing side_l or side_r, `Kit.side`): which way the actor faces, once they are mostly down; else 0. */
  private sideOf(a: Actor, af: ActorFrame): 0 | 1 | -1 {
    return !a.kit && af.seat?.side && af.seat.k > 0.5 && a.puppet.side && this.kit.face.drawSide ? af.seat.side : 0;
  }

  /** One flat: its shadow, its art and its glow, faded by `a` (a place's state coming or going). */
  /** Where the sky is seen from as drawn: the eye of the place's wide shot (the sky moves with the camera from there). */
  private skyEye: { place: string; eye: Vec3 } | null = null;
  private skyRef(f: Frame): Vec3 {
    const place = this.perf?.after.place ?? "";
    if (this.skyEye?.place !== place) this.skyEye = { place, eye: this.shotCam({ kind: "wide", ids: [], objs: [] }, f).eye };
    return this.skyEye.eye;
  }

  /**
   * Sets the stops clock for this frame. On its own it is the life clock. When the script holds the vehicle at a station, it
   * runs on to that station's held moment and stays there: from where it is, if it is already on its way there (no jump); else
   * from the start of the leg to it (`arrive`: pulling out of the station before) or right at it (a scene that opens there). `go`
   * runs it on from where it stood.
   */
  private stopsClock(f: Frame, place: string) {
    const doc = this.places[place], tt = { ...TIMETABLE, ...doc?.stops }, sc = doc?.stops ? f.stops : null, L = this.lifeT;
    const key = `${place}|${sc?.at ?? "-"}|${sc?.go ? 1 : 0}`, a = this.stopsA;
    if (a?.key === key) return;
    const S0 = a && a.key.split("|")[0] === place ? this.stopsNow() : L;
    let S = S0, H: number | undefined;
    // a halt where it is (a jam): it slows to a stand over HALT_MS; going on from one, it speeds up over as long
    if (sc && sc.at < 0 && doc?.stops) { this.stopsA = sc.go ? { key, L, S: S0, ease: true } : { key, L, S: S0, halt: true }; return; }
    if (sc && !sc.go && doc?.stops) {
      const loop = Math.max(1, doc.stops.stations.length - 1) * tt.ms, h0 = (sc.at - 1) * tt.ms + tt.run + tt.hold;
      H = h0 + Math.max(0, Math.ceil((S0 - h0) / loop)) * loop;
      if (H - S0 > tt.ms) S = H - (sc.arrive ? tt.run + tt.hold : 0);
    }
    this.stopsA = { key, L, S, H };
  }
  private stopsNow() {
    const a = this.stopsA;
    if (!a) return this.lifeT;
    const e = this.lifeT - a.L, T = HALT_MS;
    if (a.halt) return a.S + (e < T ? e - e * e / (2 * T) : T / 2);
    if (a.ease) return a.S + (e < T ? e * e / (2 * T) : e - T / 2);
    const s = a.S + e;
    return a.H !== undefined ? Math.min(a.H, s) : s;
  }
  /** The clock a moving flat reads: the stops clock or the life clock; a still flat holds at the start (a held vehicle at its station). */
  private clockFor(m: FlatMotion, still?: boolean) { return m.clock === "stops" ? (still ? this.stopsA?.H ?? 0 : this.stopsNow()) : still ? 0 : this.lifeT; }

  private drawFlat(fl: Flat, f: Frame, a = 1, reveal = 1) {
    const r = this.r!;
    // drawn from the top edge down by `reveal` (0…1): the box and the corners, the picture and the hit area, all cut at the same line
    if (reveal < 0.999) { const [x0, y0, x1, y1] = fl.rect.box, k = Math.max(0, reveal); fl = { ...fl, rect: { ...fl.rect, box: [x0, y0, x1, y0 + (y1 - y0) * k], v1: fl.rect.v0 + (fl.rect.v1 - fl.rect.v0) * k }, glow: undefined }; }
    let { O, R, D } = fl;
    // it answers the nearest person: shown at rest or while fleeing (and which way), asleep or awake, pushed away and up, its head turned
    const rc = fl.spec.react, home = rc ? homeOf(fl, rc) : fl.O, re = rc ? this.reaction(rc, home, f) : null;
    if (rc?.tap) this.tapSpecs.set(reactKey(rc, home), rc.tap);
    if (rc && re && !reactShows(rc, re)) return;
    // a place's life: a flat that moves on its own (the window's outside, a plane taxiing, a strap)
    if (fl.spec.move) {
      const m = moveAt(fl.spec.move, this.clockFor(fl.spec.move, fl.still));
      if (!m) return;
      if (m.rot) { const c = Math.cos(m.rot), s = Math.sin(m.rot); [R, D] = [[R[0] * c + D[0] * s, R[1] * c + D[1] * s, R[2] * c + D[2] * s], [D[0] * c - R[0] * s, D[1] * c - R[1] * s, D[2] * c - R[2] * s]]; }
      O = at([O[0] + m.at[0], O[1] + m.at[1], O[2] + m.at[2]], R, D, m.dx, -m.dy);
    }
    if (rc && re) {
      if (re.dx || re.dz || re.up) O = [O[0] + re.dx, O[1] + (rc.flee?.lift ?? 0) / 100 * re.up, O[2] + re.dz];
      if (rc.look && re.look > 0) {
        const [px, py] = rc.look.pivot, P = at(O, R, D, px, py), a = rc.look.turn * re.look, c = Math.cos(a), s = Math.sin(a);
        [R, D] = [[R[0] * c + D[0] * s, R[1] * c + D[1] * s, R[2] * c + D[2] * s], [D[0] * c - R[0] * s, D[1] * c - R[1] * s, D[2] * c - R[2] * s]];
        O = at(P, R, D, -px, -py);
      }
    }
    if (fl.spec.slide && fl.piece && f.doors[fl.piece]) O = at(O, R, D, fl.spec.slide * f.doors[fl.piece], 0);
    // a leaf swings for an entrance or an exit through its door, and stands open in its `openIn` states
    const ajar = fl.swing && fl.spec.openIn ? whenWeight({ state: fl.spec.openIn }, f) : 0;
    if (fl.swing && fl.piece && (f.doors[fl.piece] || ajar)) {
      const open = Math.max(f.doors[fl.piece] ?? 0, ajar), hx = fl.hinge ?? 0, H = at(O, R, D, hx, 0);
      ({ R, D } = axes(fl.yaw + fl.swing * open, fl.pitch));
      O = [H[0] - R[0] * hx, H[1] - R[1] * hx, H[2] - R[2] * hx];
    }
    const corners = (o: Vec3, b = fl.rect.box): [Vec3, Vec3, Vec3, Vec3] => [at(o, R, D, b[0], b[1]), at(o, R, D, b[2], b[1]), at(o, R, D, b[2], b[3]), at(o, R, D, b[0], b[3])];
    if (fl.shadow && this.light.shadow > 0) {
      const off = at(O, R, D, 2.2, 3.4);
      r.quad(corners([off[0], off[1], off[2] - 0.012]), fl.rect, MODE.shadow, 0, 0, [0.16, 0.1, 0.12, 0.42 * this.light.shadow * a]);
    }
    // the sky goes where the camera goes, so it stays put on screen however the shot pans or dollies (parallax at infinity)
    if (fl.spec.sky) { const e = this.cam.eye, k = this.skyRef(f); O = [O[0] + (e[0] - k[0]) * 0.97, O[1] + (e[1] - k[1]) * 0.97, O[2] + (e[2] - k[2]) * 0.97]; }
    const c = corners(O), tint: [number, number, number, number] = [a, a, a, a];
    r.quad(c, fl.rect, MODE.piece, fl.lit, fl.spec.sky ? 0 : 1, tint);
    if (this.pickable && this.pickAs !== null) this.picks.push({ target: this.pickAs, c, rect: fl.rect, ...(rc?.tap ? { poke: reactKey(rc, home) } : {}) });
    if (fl.spec.text && this.pickAs) this.texts.push({ target: this.pickAs, spec: fl.spec, O, R, D });
    // a switched-off light keeps no glow (a street lamp, `switch: false`, does)
    const g = (fl.sw ? a * f.lights : a) * glowWeight(fl.spec.glowAt, this.light.glow);
    if (fl.glow && this.light.glow > 0.01 && g > 0.001) r.quad(corners(O, fl.glow.box), fl.glow, MODE.glow, 0, fl.spec.sky ? 0 : 1, [g, g, g, g]);
  }

  /**
   * How a reacting flat whose home is `O` stands now (`FlatReact`): `dx`, `dz`, where its flights from people have taken
   * it (metres; it stays where it lands, `flights` in `anim/react.ts`), `up` (0…1, the arc of a flight now), whether it is
   * `moving` and which way (`dir`); `look` (0…1) for a head turned to the nearest person within its `r`. Kit puppets
   * (Kerim) and anyone off stage do not count; reduced motion keeps it at home, at rest.
   */
  private reaction(rc: FlatReact, O: Vec3, f: Frame): { dx: number; dz: number; up: number; moving: boolean; dir: -1 | 1; look: number } {
    const rest = { dx: 0, dz: 0, up: 0, moving: false, dir: 1 as const, look: 0 };
    if (this.motion === "still") return rest;
    const puppet = (id: string) => !!this.actors.get(id)?.kit;
    let at = rest as { dx: number; dz: number; up: number; moving: boolean; dir: -1 | 1; look: number };
    if (rc.flee) {
      const key = reactKey(rc, O);
      let fl = this.reactMemo.flights.get(key);
      if (!fl) { this.reactMemo.samples ??= peopleSamples(this.history, puppet); fl = flights([O[0], O[2]], rc.flee, this.reactMemo.samples, Infinity); this.reactMemo.flights.set(key, fl); }
      const q = fleeAt([O[0], O[2]], fl, f.t);
      at = { ...rest, dx: q.dx, dz: q.dz, up: Math.sin(Math.PI * q.u), moving: q.u > 0, dir: q.dir };
    }
    // a learner's tap (explore): a flutter where it is, on the wall clock
    const tap = rc.tap ? this.taps.get(reactKey(rc, O)) : undefined, tu = tap ? (performance.now() - tap.t) / TAP_MS : 1;
    const hu = tu * TAP_MS / 900;
    if (tap && hu < 1 && tap.do === "hop" && !at.moving) at = { ...at, up: 0.45 * Math.sin(Math.PI * hu), moving: true };
    if (rc.look) {
      let d = Infinity;
      for (const af of Object.values(f.actors)) if (af.on && !puppet(af.id)) d = Math.min(d, Math.hypot(af.pos[0] - O[0] - at.dx, af.pos[2] - O[2] - at.dz));
      at = { ...at, look: at.moving ? 0 : lookToward(rc.look.r, d) };
      // looks up quickly, holds it, and looks down again
      if (tap && tu < 1 && tap.do === "look" && !at.moving) { const k = Math.max(0, Math.min(1, tu * 5, (1 - tu) * 4)); at = { ...at, look: Math.max(at.look, k * k * (3 - 2 * k)) }; }
    }
    return at;
  }

  /**
   * A learner tapped a flat that answers taps (`Pick.poke`, `FlatReact.tap`): it hops or looks up for a moment, with its
   * sound panned where it is. Not part of the performance: it plays on the wall clock and leaves the story as it was.
   */
  tapFlat(key: string, at?: Vec3) {
    const sp = this.tapSpecs.get(key);
    if (!sp || this.motion === "still") return;
    this.taps.set(key, { t: performance.now(), do: sp.do });
    if (sp.sound && this.soundOn) { const q = at ? this.project(at) : null; this.audio.play(sp.sound, { pan: q ? clamp(q[0] / this.cssW * 2 - 1, -1, 1) * 0.6 : 0 }); }
    this.poke();
  }

  /** The performance on stage now is `p`: this place's history since its scene began (a script's cues, or what was acted), for reacting flats. */
  private onStage(p: Perf) {
    const k = this.perfs.indexOf(p);
    if (k >= 0) { let j = k; while (j > 0 && this.perfs[j - 1].after.place === p.before.place && this.perfs[j].before.place === p.before.place && p.before.place) j--; this.history = this.perfs.slice(j, k + 1); }
    else this.history = this.history.length && this.history[this.history.length - 1].after.place === p.before.place ? [...this.history, p] : [p];
    this.reactMemo = { samples: null, flights: new Map() };
  }

  /** The soft shadow under an actor, where she stands (a ledge too); none while she is in the air or flying. */
  private drawBlob(af: ActorFrame, a: Actor) {
    if (af.air || af.walk?.how === "fly") return;
    const lift = af.walk ? af.walk.amount * 0.15 : 0;
    const w = a.puppet.body.shoulderW / 100 * (0.85 - lift), d = 0.2, p = af.pos, y = p[1] + 0.004;
    const c: [number, number, number, number] = [0.14, 0.09, 0.16, 0.38 * this.light.shadow];
    this.r!.colorQuad([[p[0] - w, y, p[2] - d], [p[0] + w, y, p[2] - d], [p[0] + w, y, p[2] + d], [p[0] - w, y, p[2] + d]], [c], MODE.blob);
  }

  private drawActor(a: Actor, af: ActorFrame, f: Frame, world: Map<string, Affine>, alt: Record<string, string>, faceOff: Vec2) {
    const r = this.r!, sideDir = this.sideOf(a, af), view = sideDir ? "side" : Math.cos(af.yaw) >= 0 ? "front" : "back";
    // the side view is drawn face on to the camera, facing right, and mirrored for a seat that faces left
    const ax = axes(sideDir ? 0 : af.yaw), R: Vec3 = sideDir < 0 ? [-ax.R[0], -ax.R[1], -ax.R[2]] : ax.R, D = ax.D;
    const toW = (p: Vec2): Vec3 => at(af.pos, R, D, p[0], p[1]);
    // where the hands grip, for held props and for targets next frame
    const b = a.puppet.body;
    // (a kit puppet may have no hands: no grips, nothing held, nothing raised)
    const hand = (side: Side) => world.get("hand_" + side);
    for (const side of ["l", "r"] as const) { const h = hand(side); if (h) a.grips[side] = toW(apply(h, 0, b.handL * 0.45)); }
    // a bubble sits above the head and points at the mouth (the head's middle, from behind); the oval takes in hair and ears
    const hd = world.get("head"), hp = (x: number, y: number) => toW(apply(hd!, x, y)), W = b.headW, H = b.headH;
    if (hd) a.talk = {
      top: hp(0, -H * 1.12),
      mouth: view === "front" ? hp(faceOff[0] * W, -H * 0.19 + faceOff[1] * H) : view === "side" ? hp(W * 0.42, -H * 0.22) : hp(0, -H * 0.5),
      head: [hp(0, -H * 0.5), hp(W * 0.5, -H * 0.5), hp(0, -H * 1.04)],
    };
    // an arm raised to the face (eat, drink, think, shush) comes in front of the head in the front view
    const chinY = hd ? apply(hd, 0, 0)[1] : -1e9;
    const raised = new Set<string>();
    if (view === "front") for (const side of ["l", "r"] as const) { const h = hand(side); if (h && apply(h, 0, b.handL * 0.5)[1] < chinY + 6) raised.add(side); }
    // with everything on that arm's bones: the hand shapes, a ring, a watch, a held phone
    const armSide = (it: Item) => it.strip?.chain.startsWith("arm_") ? it.strip.chain.slice(4) : ARM_BONE.exec(it.bone)?.[1] ?? null;
    const later: Item[] = [];
    const heldDone = new Set<Side>();
    // a held prop stands upright with its origin (its base) in the grip; its arm, sleeve and hand
    // are drawn over it, so the forearm cradles it and the fingers close round it; a `front` one (a sign) goes over them, last,
    // and then only the hand again, its fist round the stick (true when one was drawn)
    const drawHeld = (side: Side, last?: boolean): boolean | undefined => {
      const h = af.hold[side], s = h?.prop ? f.props[h.prop] : undefined, hb = hand(side), art = s && this.propArt.get(artKey(s)), rect = art?.rects[0];
      if (art?.specs[0].front && !last) return;
      heldDone.add(side);
      if (!s || !hb || s.holder?.actor !== a.id || this.held?.id === s.id || !rect) return;
      const g = apply(hb, 0, b.handL * 0.45), bx = rect.box, ox = g[0], oy = g[1] + b.handL * 0.3;
      const c = [[bx[0], bx[1]], [bx[2], bx[1]], [bx[2], bx[3]], [bx[0], bx[3]]].map(([x, y]) => toW([x + ox, y + oy])) as [Vec3, Vec3, Vec3, Vec3];
      r.quad(c, rect, MODE.piece, 1, 1);
      // its words, over it
      const wr = this.texted.has(art.specs[1]) ? art.rects[1] : undefined;
      if (wr) { const wb = wr.box; r.quad([[wb[0], wb[1]], [wb[2], wb[1]], [wb[2], wb[3]], [wb[0], wb[3]]].map(([x, y]) => toW([x + ox, y + oy])) as [Vec3, Vec3, Vec3, Vec3], wr, MODE.piece, art.specs[1].lit ?? 1, 1); }
      if (art.specs[0].text) this.texts.push({ target: "obj:" + s.id, spec: art.specs[0], O: toW([ox, oy]), R, D });
      if (this.pickable) this.picks.push({ target: "obj:" + s.id, c, rect });
      return last;
    };
    const armOf = (it: Item): Side | null => it.strip?.chain === "arm_l" || it.bone === "hand_l" ? "l" : it.strip?.chain === "arm_r" || it.bone === "hand_r" ? "r" : null;
    // the clothes worn (a wardrobe key; an unknown one is the cast document): the face, bones and grips stay the actor's own
    const cos = (af.costume && a.costumes.get(af.costume)) || a, items = view === "side" ? cos.puppet.side?.items ?? [] : cos.puppet.views[view];
    for (let i = 0; ; i++) {
      if (i >= items.length + later.length) {
        const sd = (["l", "r"] as const).find(x => !heldDone.has(x));
        if (!sd) break;
        if (drawHeld(sd, true)) later.push(...items.filter(it => it.bone === "hand_" + sd && !it.strip));
        i--; continue;
      }
      const it = i < items.length ? items[i] : later[i - items.length];
      if (it.alt && (alt[it.alt.key] ?? cos.altDefault[it.alt.key]) !== it.alt.value) continue;
      // a held part (a cane, a phone) gives way while the script puts a prop in the same hand
      if (it.hold && af.hold[it.hold]?.prop && (af.hold[it.hold]?.w ?? 0) > 0.3) continue;
      if (i < items.length && raised.size) { const s = armSide(it); if (s && raised.has(s)) { later.push(it); continue; } }
      { const sd = armOf(it); if (sd && !heldDone.has(sd)) drawHeld(sd); }
      if (it.strip) { this.drawStrip(it, world, toW, this.pickable ? a.id : null); continue; }
      const A = world.get(it.bone);
      if (!A) continue;
      if (it.face) {
        if (a.slot < 0) continue;
        const fb = FaceAtlas.squareBox(view === "side" ? a.puppet.side!.faceRegion : a.puppet.faceRegion!), dx = faceOff[0] * b.headW, dy = faceOff[1] * b.headH;
        const c = [apply(A, fb[0] + dx, fb[1] + dy), apply(A, fb[2] + dx, fb[1] + dy), apply(A, fb[2] + dx, fb[3] + dy), apply(A, fb[0] + dx, fb[3] + dy)].map(toW) as [Vec3, Vec3, Vec3, Vec3];
        r.quad(c, { layer: a.slot, u0: 0, v0: 0, u1: 1, v1: 1 }, MODE.face, 1, 1);
        if (this.pickable) this.picks.push({ target: "ch:" + a.id, bone: "head", c });
        continue;
      }
      const rect = cos.rects.get(it);
      if (!rect) continue;
      if (rect.lazy) r.atlas.ensure(rect);
      const bx = rect.box;
      const c = [apply(A, bx[0], bx[1]), apply(A, bx[2], bx[1]), apply(A, bx[2], bx[3]), apply(A, bx[0], bx[3])].map(toW) as [Vec3, Vec3, Vec3, Vec3];
      r.quad(c, rect, MODE.piece, 1, 1);
      if (this.pickable) this.picks.push({ target: "ch:" + a.id, bone: it.bone, c, rect });
    }
  }

  /** A limb strip: the band (rig/strip.ts, the geometry the still backend shares) as triangles, then round caps for shoulders, hips and wrists. */
  private drawStrip(it: Item, world: Map<string, Affine>, toW: (p: Vec2) => Vec3, pick: string | null) {
    const s = it.strip!, j = stripJoints(world, s.chain);
    if (!j) return;
    const G = stripGeometry(j, s, it.layer), r = this.r!;
    const col = rgba(s.color);
    const stripe: Vec3 = s.stripes ? hexToRgb(s.stripes[0]) : [0, 0, 0];
    // a strip has no depth-of-field lookup, so the third parameter carries the stripes' duty
    const P: [number, number, number, number] = [MODE.strip, 1, stripeDuty(s.stripes?.[2]), s.stripes ? s.stripes[1] : 0];
    for (let i = 0; i < G.left.length - 1; i++) {
      const a = toW(G.left[i]), b = toW(G.right[i]), c = toW(G.right[i + 1]), d = toW(G.left[i + 1]), s0 = G.along[i], s1 = G.along[i + 1];
      r.vert(a, stripe, col, P, [s0, 1]); r.vert(b, stripe, col, P, [s0, -1]); r.vert(c, stripe, col, P, [s1, -1]);
      r.vert(a, stripe, col, P, [s0, 1]); r.vert(c, stripe, col, P, [s1, -1]); r.vert(d, stripe, col, P, [s1, 1]);
      if (pick) this.picks.push({ target: "ch:" + pick, bone: s.chain, c: [a, b, c, d], tri: true });
    }
    for (const cap of [G.capFrom, G.capTo]) {
      if (!cap) continue;
      const center = toW(cap.center);
      for (let k = 0; k < cap.pts.length - 1; k++) {
        r.vert(center, stripe, col, P, [cap.along, 0]); r.vert(toW(cap.pts[k]), stripe, col, P, [cap.along, 1]); r.vert(toW(cap.pts[k + 1]), stripe, col, P, [cap.along, 1]);
      }
    }
  }

  // ---- Overlay ----------------------------------------------------------------

  /**
   * Where a target was drawn in the last frame, in CSS pixels inside the stage element: the box of its
   * quads (`ch:nima` takes every part of Nima, `ch:nima.head` one). Null when it was not drawn. Needs
   * `pickable` (the interaction layer sets it; the gallery's camera check sets it alone).
   */
  bounds(target: Target): [number, number, number, number] | null {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const pk of this.picks) {
      if (pk.target !== target && !(pk.bone && `${pk.target}.${pk.bone}` === target)) continue;
      for (const c of pk.c) {
        const q = this.project(c);
        if (!q) continue;
        x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
      }
    }
    return x0 <= x1 ? [x0, y0, x1, y1] : null;
  }

  /** A world point in CSS pixels inside the stage element. */
  project(p: Vec3): [number, number] | null {
    if (!this.vp) return null;
    const q = project(this.vp, p);
    if (q[3] <= 0) return null;
    return [(q[0] + 1) / 2 * this.cssW, (1 - q[1]) / 2 * this.cssH];
  }

  private updateBubbles(f: Frame) {
    const ov = this.overlay;
    if (!ov) return;
    const list: Bubble[] = [], perf = this.perf!;
    let sid = this.serials.get(perf);
    if (!sid) { sid = this.nextSerial++; this.serials.set(perf, sid); }
    for (const tb of f.bubbles) {
      // a sound word is the sound's caption: shown while sound is off, or on request
      if (tb.kind === "sound" && this.soundOn && !this.captions) continue;
      // in log mode the host shows the lines; Kerim's window and the sound words stay
      if (tb.kind === "speech" && !this.lines) continue;
      const id = `p${sid}:${tb.id}`;
      let b = this.bubbles.get(id);
      if (!b) {
        // a line whose speaker is off stage as it starts is heard on a phone (a `via` line): named, at the top, with no tail
        const remote = tb.kind === "speech" && !!tb.actor && !f.actors[tb.actor]?.on;
        b = { id, kind: tb.kind, text: tb.text, who: tb.who, voice: tb.voice, name: tb.who ? this.names[tb.who] : undefined, ...(remote ? { remote } : {}) };
        this.bubbles.set(id, b);
      }
      if (tb.actor && !b.remote) {
        const af = f.actors[tb.actor], a = this.actors.get(tb.actor);
        if (af?.on && a?.talk) { b.anchor = a.talk.top; b.mouth = a.talk.mouth; b.head = a.talk.head; }
        else if (af && a) { b.anchor = [af.pos[0], af.pos[1] + (a.puppet.body.H + 10) / 100, af.pos[2]]; b.mouth = undefined; b.head = undefined; }
      } else if (tb.at) {
        const p = this.point(tb.at, f);
        const mark = tb.at.startsWith("mark:");
        if (p) b.anchor = mark ? [p[0], Math.max(p[1], 2.0), p[2]] : p;
      }
      list.push(b);
    }
    const ids = list.map(b => b.id).join("|");
    if (ids !== this.bubbleIds) {
      this.bubbleIds = ids;
      for (const id of [...this.bubbles.keys()]) if (!list.some(b => b.id === id)) this.bubbles.delete(id);
      ov.inset(list.some(b => b.kind === "narrator") ? this.inset : null);
      ov.set(list);
    } else ov.layout();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop(); this.ro?.disconnect(); this.io?.disconnect();
    this.endSpeech(); if (this.pumpTimer) clearInterval(this.pumpTimer);
    this.audio.destroy();
    document.removeEventListener("visibilitychange", this.onVis);
    document.fonts?.removeEventListener("loadingdone", this.onFonts);
    this.el.removeEventListener("pointerdown", this.onDown);
    clearTimeout(this.warmT); clearTimeout(this.preT); this.finishRun(); this.swaps.clear();
    this.interaction?.destroy(); this.interaction = null; this.frameFns.clear();
    this.overlay?.destroy();
    // free the GPU memory and hand the context back, then the drawing buffer
    this.r?.dispose();
    this.canvas.width = this.canvas.height = 1;
    this.canvas.remove();
  }
}

/**
 * The seed of a set piece's random art (DESIGN.md §5.5): its `seed`, else the place's site (or id) with
 * the piece's id, or with its kit and position when it has none. Each piece draws from its own, so
 * adding, removing or reordering a piece leaves the others as they were, and a piece repeated in
 * another place of the same site draws the same.
 */
export function pieceSeed(place: { id: string; site?: string }, p: PieceRef): string {
  return p.seed ?? `${place.site ?? place.id}|${p.id ?? `${p.kit}@${p.x},${p.y ?? 0},${p.z}`}`;
}

/** A place's pieces drawn by their kit generators, each on its own seed; a piece the kit lacks is skipped with a warning. */
export function drawPieces(place: { id: string; site?: string; pieces: PieceRef[] }, kit: Kit): { p: PieceRef; out: PieceOut }[] {
  return place.pieces.flatMap(p => {
    const def = kit.set[p.kit];
    if (!def) { console.warn("sahne: no set piece", p.kit); return []; }
    return [{ p, out: def.draw(withVariant(def, p), rng(pieceSeed(place, p)), kit) }];
  });
}

export function mountStage(el: HTMLElement, o: StageOptions) { return new Stage(el, o); }
