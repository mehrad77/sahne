// What a kit gives the engine (DESIGN.md §4.1, §5.3). The engine owns the formats and the
// rendering; the kit owns every drawing, palette and proportion, so another app can ship a
// kit in another style.

import type { Group } from "../art/shape.ts";
import type { Path } from "../art/path.ts";
import type { Box } from "./math.ts";
import type { Rng } from "./rng.ts";
import type { AvatarDoc, BodyDims, Build, Garment, ViewName, WearSide } from "./types.ts";
import type { BoneDef } from "../rig/skeleton.ts";
import type { PoseInput, PoseOut } from "../rig/pose.ts";
import type { FaceParams, FacePreset } from "../face/params.ts";
import type { Patch } from "../audio/dsp.ts";
import type { Instrument, MotifDef } from "../audio/motif.ts";

/** A limb strip: a tapered band along a three-joint chain, bent smoothly at the middle joint. */
export interface StripSpec {
  chain: "arm_l" | "arm_r" | "leg_l" | "leg_r";
  widths: [number, number, number];
  color: string;
  /** The covered part of the chain, 0 (root joint) … 1 (end joint): a short sleeve is 0 … 0.42. */
  from?: number;
  to?: number;
  /** Stripes across the band: [colour, period in cm, duty 0…1] (the stripe is the first `duty` of every period). */
  stripes?: [string, number, number];
  /**
   * Which ends are round. By default the start is round when the strip starts at the root joint
   * (`from` ≤ 0.01: a shoulder, a hip) and the end only on the skin layers `arm` and `leg` (a
   * wrist, an ankle); every other end is cut flat (a cuff, a hem, a boot shaft).
   */
  caps?: "both" | "from" | "to" | "none";
}

export interface Item {
  layer: string;
  bone: string;
  group?: Group;
  strip?: StripSpec;
  /** The face texture goes here (exactly one item per view that shows a face). */
  face?: true;
  /** Pixels per centimetre for this piece's raster (the default comes from the backend). */
  ppcm?: number;
  /**
   * One of several alternatives for the same spot (hand shapes): drawn only while the actor's
   * `alt[key]` is `value`. The item marked `default` is drawn when the actor names none.
   */
  alt?: { key: string; value: string; default?: boolean };
  /** A piece of a held part (`hold`) in this hand: the stage leaves it out while the script puts a prop in the same hand. */
  hold?: "l" | "r";
}

// ---- Gestures (DESIGN.md §7) -------------------------------------------------------------
//
// A gesture is keyframed data, written once for an *acting side* and mirrored onto whichever
// arm the director picks (the one nearer the target or the addressee).
//
// Conventions, in the actor's paper plane (front view; the back view mirrors itself):
// - Limb angles (arm, forearm, hand, thigh, shin, foot, and the `2` versions for the other side)
//   are radians added to the rest pose. Positive swings the bone outwards and up on its own side:
//   a hanging arm at +π/2 points straight out sideways, at +π straight up. A forearm at +π/2 on a
//   horizontal upper arm points up (a wave); a forearm at −1.6 on a hanging arm crosses the chest.
// - spine, neck and head: positive leans the top towards the acting side.
// - Every key is a whole pose: a channel a key leaves out is 0 (rest) at that key.

export type Side = "l" | "r";

/** Points a hand can reach: the gesture's target, or a place on the actor's own body. */
export type ReachTo = "target" | "mouth" | "chin" | "nose" | "eye" | "ear" | "forehead" | "head_top" | "chest" | "belly" | "hip" | "shoulder2" | "front";

export interface Reach {
  to: ReachTo;
  /** "pos" (default): the wrist goes to the point, as far as the arm reaches. "dir": the arm extends towards the point to `ext` of its full length (pointing); a point within reach is pointed at from just above and outside it, never past it. */
  aim?: "pos" | "dir";
  ext?: number;
  /** Offset of the wrist from the point in cm, mirrored like the limbs (+x towards the acting side, +y down). With `dir`, the finger still turns onto the point itself. */
  off?: [number, number];
  /** How much the IK solution overrides the key's own arm angles, 0…1 (default 1). */
  w?: number;
}

export interface GesturePose {
  arm?: number; forearm?: number; hand?: number;
  arm2?: number; forearm2?: number; hand2?: number;
  thigh?: number; shin?: number; foot?: number;
  thigh2?: number; shin2?: number; foot2?: number;
  spine?: number; neck?: number; head?: number;
  /** Whole body down (+) or up (−), cm: a bow, a hop. */
  dy?: number;
  /** The head drops (+) or lifts (−) along the neck, cm: a nod, the *cık*. */
  headDy?: number;
  /** The face slides across the head (a fraction of its width, + towards the acting side) and up or down (− up): a head turn or lift. */
  faceX?: number;
  faceY?: number;
  /** Thigh foreshortening, 1 = none, 0.8 = the knee comes towards the viewer (a step, sitting). */
  thighLen?: number; thighLen2?: number;
}

export interface GestureKey extends GesturePose {
  /** Time in ms at tempo 1. */
  t: number;
  /** The easing into this key from the one before (default "inOut"). */
  ease?: "inOut" | "out" | "in" | "linear" | "spring";
  /** Hand shapes from this key on, from the kit's hands (`count` takes the cue's `n`). */
  shape?: string; shape2?: string;
  /** IK for the acting hand or the other hand at this key. */
  reach?: Reach; reach2?: Reach;
  /** Face changes during the gesture (raised brows for the cık), blended in like the angles. */
  face?: FacePreset;
  /** Where the eyes go from this key on. */
  look?: "target" | "up" | "down" | "away" | "addressee" | null;
}

export interface GestureDef {
  /** Length in ms at tempo 1. */
  dur: number;
  /** The moment (ms) that should meet the word that motivates the gesture (DESIGN.md §7). */
  stroke: number;
  keys: GestureKey[];
  /** Repeat the keys in [from, to] ms while a cue asks for `loop`. */
  loop?: [number, number];
  /** What the gesture needs from the cue. */
  needs?: ("target" | "partner" | "prop")[];
  /** Two-handed gestures. */
  hands?: 1 | 2;
  /** The gesture hands a held prop over (`give`) or takes one (`take`) at its stroke. */
  hold?: "give" | "take";
}

// ---- Parts and slots (DESIGN.md §5.2, §5.3) --------------------------------------------------
//
// THE CONTRACT FOR A NEW PART. A part is one entry in `kit.parts`. Its id is `<kind>_<variant>`
// (`^[a-z]+_[a-z_]+$`), unique and permanent: a retired part keeps working through `kit.aliases`.
// The id need not start with its slot's name (`glasses_round` is in `eyes`, `apron_shop` in `waist`,
// `headscarf_wrap` in `head`, `hat_cap` goes in `head`); the slot is what the part declares.
//
// A part goes in the slot it declares, and a document field accepts only parts of its slot. The
// engine owns this table (`avatar/rules.ts`); a kit fills the slots with parts:
//
//   field          slot    note
//   hair.style     hair    required: a kit default is drawn when the id is unusable
//   outfit.top     top     required, unless a part that `replaces` it is worn
//   outfit.bottom  bottom  required, unless a part that `replaces` it is worn
//   outfit.dress   dress   usually `replaces: ["top", "bottom"]`
//   outfit.outer   outer   a coat or jacket
//   outfit.shoes   shoes   required
//   wear.head      head      head coverings: headscarves, turbans, a kippah or takke
//   wear.hat       hat       hats and caps, worn alone or over a covering
//   wear.hair      hairwear  clips, bows, headbands (under a hat)
//   wear.eyes      eyes      glasses
//   wear.ears      ears      earrings, earbuds
//   wear.aid       aid       hearing devices: never hidden, so they go with earrings and a scarf
//   wear.neck      neck      scarves, necklaces, a lanyard
//   wear.wrist     wrist     a watch, beads, a bangle
//   wear.hands     hands     a ring, henna: drawn over the hand shapes (one item per shape, `alt`)
//   wear.waist     waist     an apron, a belt
//   carry          carry     a worn bag: a backpack, a tote
//   hold           hold      what a hand holds: a cane, an umbrella, a phone (see `PartOut.alt`, `Item.hold`)
//   custom[0..1]   any       trusted (cast) documents only: any part, usually one tagged `cast`; same rules
//
// What a part says about itself, besides `draw`:
// - `names`: its name per language (`{ en: "T-shirt", tr: "tişört" }`); the builder shows it.
// - `colors`, `palettes`, `defaults`: how many colours it takes, the palette each is chosen from
//   (default `fabric`) and the palette ids it wears when the document names none. Every part that
//   takes colours needs a default for each colour it must have; a colour with no default is one the
//   part derives itself (a scarf's trim). Defaults are permanent: a document that omits a colour
//   gets the default, and `normalize` omits colours equal to it.
// - `tags`: `modest` (long sleeves, long skirts, scarves: the randomiser gives the modest parts of
//   a slot at least 30% of its picks), `cast` (reserved for the cast: never offered, and refused
//   in learners' documents) and `hidden` (never offered, but drawn wherever a document has it: a
//   retired or unfinished part). Others are free labels for a UI and for `avoid`.
// - `avoid`: tags the randomiser never combines with this part (a white cane and dark glasses).
// - `odds`: how often the randomiser picks it, relative to its slot's other parts (default 1; `0`
//   never): a number, or one per build (`{ child: 0, toddler: 0 }` keeps bald heads off children;
//   a build left out is 1). Colours have theirs in `kit.odds`. It does not limit what a learner may pick.
// - `unlock`: an id the app must report as unlocked before the builder lets a learner pick it
//   (`bundle:iznik`). Colours and patterns have theirs in `kit.paletteUnlocks` and `PatternDef.unlock`.
//   `normalize` never refuses a locked id: a friend's document may use anything.
// - `builds`: the builds it is made for (default all). The builder offers it only to them and
//   `normalize` drops it from a document of another build (a `build` note). It must still draw for
//   every build (the kit tests draw every part on every body).
// - `sides`: a one-sided part (an earring, a watch, a cane) says which sides it may be worn on and
//   its default; the document's `Garment.side` picks one, `ctx.side` is the result. The wearer's
//   left (`l`) is +x in both views, so an item on the left is drawn at +x front and back.
// - `patterns`: the patterns it may wear (`kit.patterns` ids). The document's `Garment.pattern`
//   and `inks` reach the part as `ctx.pattern` and `ctx.inks`; the kit draws the print.
// - `hides`, `replaces`, `clips`, `over`: what it does to other slots (below).
//
// Slot rules, enforced by `normalize`/`compose` and offered by the builder:
// - `hides: ["hair"]`  the slot's part is not drawn (a headscarf), but stays in the document, so
//   taking the scarf off brings the hair back.
// - `replaces: ["top", "bottom"]`  the slots' parts are dropped from the document (a dress), and the
//   slots' requirement is met by the replacing part. Replacing parts act first (custom parts, then
//   the table's order), and a part that is itself replaced replaces nothing. Keep it to one level:
//   no part replaces a slot whose part replaces another (the kit tests check this).
// - `clips: { slots: ["hair"], keep }`  the slot's parts are cut to the region `keep(ctx, view)`
//   returns: a path in head-bone space (cm, the chin at the origin, the crown at y = -headH) that
//   stays visible, so a cap keeps only the hair below its line (a cap's band sits lower at the
//   back, so the region may differ per view). `compose` hands the regions to the clipped part as
//   `ctx.clip` (front) and `ctx.clipBack`; a part that does not look at them still gets them,
//   because `compose` adds them to `Shape.clip` of every shape of the part's head-bone pieces (a
//   shape with a clip of its own, a print, is cut to both). A part that draws differently under a
//   hat (a pony tail through the cap) reads `ctx.clip`. When several parts clip the same slot (a
//   kippah and a beanie), the slot is cut to the region inside all of them, and `ctx.clip` is the
//   last one's in the table's order (the hat's, since `wear.hat` follows `wear.head`).
// - `over: ["top"]`  informational: it is worn over these slots. Drawing order is the items'
//   `layer` (`kit.layers`), not this.

/** A text per language code (`en`, `tr`). */
export type Names = Record<string, string>;

/** Relative odds in the randomiser: one number, or one per build (a build left out is 1). */
export type Odds = number | Partial<Record<Build, number>>;

export interface PartCtx {
  /** The normalized document being composed. */
  avatar: AvatarDoc;
  body: BodyDims;
  skin: string;
  hair: string;
  /** This part's resolved colours: the document's, then the part's `defaults`, as hex. */
  colors: string[];
  pattern: string | null;
  /** The pattern's inks as the document gives them, as hex (none, one or two): the kit derives a missing one from the ground. */
  inks?: string[];
  /** The side a one-sided part is worn on (the document's, else the part's default); null for a part without `sides`. */
  side?: WearSide | null;
  garment: Garment | null;
  kit: Kit;
  /** The region in head-bone space this part is cut to when another part clips its slot (see above; the last one's when several do), else null. */
  clip: Path | null;
  /** The same for the back view (the front's when the clipping part gives one region). */
  clipBack?: Path | null;
}

export interface PartDef {
  slot: string;
  /** English name; `names.en` is preferred. */
  name?: string;
  names?: Names;
  /** How many colours it takes. */
  colors?: number;
  /** The palette of each colour (default `fabric`). */
  palettes?: string[];
  /** The palette id of each colour when the document names none. */
  defaults?: string[];
  /** The patterns it can wear (`Garment.pattern`). */
  patterns?: string[];
  tags?: string[];
  /** Its odds in the randomiser (default 1): a number, or one per build. */
  odds?: Odds;
  /** Slots whose parts this part hides (a headscarf hides `hair`). */
  hides?: string[];
  /** Slots whose parts this part replaces (a dress replaces `top` and `bottom`). */
  replaces?: string[];
  /** Cuts the parts of other slots to a region (a cap cuts `hair`), per view. */
  clips?: { slots: string[]; keep(ctx: PartCtx, view: ViewName): Path };
  over?: string[];
  unlock?: string;
  /** The builds it is made for (default all). */
  builds?: Build[];
  /**
   * Tags the randomiser never puts on the same character as this part, either way round (a white
   * cane says `avoid: ["sunglasses"]`, so a random character never gets both: catalogue `pairing`).
   * A learner may still choose any combination.
   */
  avoid?: string[];
  /**
   * A hair style: how far it stands off the scalp over the crown, in adult cm (the kit scales it to
   * the build). The engine ignores it; a hat or covering reads it to sit on the hair (sahne-kit's
   * `hairBulk`).
   */
  bulk?: number;
  /** A one-sided part: the sides it may be worn on, and the one it is worn on unless the document says. */
  sides?: { allowed: WearSide[]; default: WearSide };
  draw(ctx: PartCtx): PartOut;
}

export interface PartOut {
  front?: Item[];
  back?: Item[];
  /**
   * The alternatives this part makes the default while it is worn: a held cane closes its hand
   * (`{ hand_r: "hold" }`). `compose` moves the base's `default` flag; a script still overrides it.
   */
  alt?: Record<string, string>;
}

/**
 * A pattern a garment can wear (`Garment.pattern`), as the engine sees it: its names, how many
 * inks it prints in, and its unlock. The kit draws it (flat printed shapes clipped to the garment).
 */
export interface PatternDef {
  names: Names;
  /** Inks after the ground: 1 or 2. */
  inks: number;
  unlock?: string;
}

/**
 * Text laid on a flat as HTML over the canvas (DESIGN.md §6.8, `propText`): a box in the flat's own
 * cm (x right, y down, from its origin). The kit writes the string from the prop's parameters.
 */
export interface TextSpec {
  text: string;
  x: number; y: number; w: number; h: number;
  /** The largest font size, cm (default h × 0.45); it shrinks to fit. */
  size?: number;
  /** Hex, default #2B2420. */
  color?: string;
  align?: "left" | "center" | "right";
  weight?: number;
  /** `--sahne-text-<font>` on the page, else the page's own font. */
  font?: "hand" | "print" | "screen";
  /** 1 takes the scene's light, 0 is self-lit (a screen); default the flat's. */
  lit?: number;
  /** Default "tr". */
  lang?: string;
}

/**
 * A flat that moves on its own while a scene is up (DESIGN.md §6.9): the life of a place. Every kind
 * loops forever from `phase` (0…1 of its period); reduced motion (`motion: "still"`) holds it at its
 * start. Offsets are cm in the flat's own plane, x right and y up, except `path`, which is in the
 * place (x right, y up, z towards the viewer).
 */
export interface FlatMotion {
  /** Slides by (dx, dy) every `ms` and starts over: a window's outside going by. Draw the art a period longer than the opening it shows through. */
  scroll?: { dx: number; dy?: number; ms: number };
  /**
   * Moves through these offsets in `ms` (an even speed), then waits `wait` ms there before starting over; `hide` hides it while waiting: a plane taxiing past, a passer-by. An offset may change depth (z): the flat comes nearer or goes away in perspective, and is drawn in order as it moves (the road coming at a car's windscreen).
   * `at` times each offset instead (0…1 of `ms`, rising; it holds still between two equal offsets, and before the first and after the last time): a door that opens, stays open and shuts. `show` draws it only inside these parts of the period (`[from, to]`, 0…1): a passenger who gets on, stands and gets off.
   */
  path?: { pts: [number, number, number][]; ms: number; wait?: number; hide?: boolean; at?: number[]; show?: [number, number][] };
  /** Rocks by ±`rot` radians about its origin and bobs ±`dy` cm, over `ms`: a strap, a carriage on the rails. */
  sway?: { rot?: number; dy?: number; ms: number };
  /** Shows for `on` of every `ms` (0…1), from `at` of the way through it (default 0): lights going by in a tunnel, a board's cursor, a walker's other stride. */
  blink?: { ms: number; on: number; at?: number };
  phase?: number;
  /**
   * A timetable: the motion's own clock (not `blink`'s) runs only for the first `run` ms of every `ms`, easing in over `ease` ms
   * (default 2500) and out over as many, and stands still for the rest: the outside of a train that stops at each station. Over one
   * `ms` the scroll, path or sway moves exactly as far as it would in `run` ms, so a strip `run` ms long comes back to the same place.
   */
  stops?: { ms: number; run: number; ease?: number };
  /** `"stops"`: on the place's stops clock instead of its life clock (a vehicle's timetable, `PlaceDoc.stops`), which a story can hold at a station and start again. Every flat that keeps a vehicle's timetable takes it. */
  clock?: "stops";
}

/** The default timetable of a vehicle that stops (`PlaceDoc.stops`, `FlatMotion.stops`): an 11 s leg easing in and out over 2.5 s, a 7 s stop, held 4.5 s into it. */
export const TIMETABLE = { ms: 18000, run: 11000, ease: 2500, hold: 4500 };

/** A flat of a set piece or a prop: one paper piece in world space. Offsets in cm. */
export interface FlatSpec {
  group: Group;
  x?: number; y?: number; z?: number;
  /** Yaw turns the flat about its vertical axis; pitch -90° lays it on the floor. Radians. */
  yaw?: number; pitch?: number;
  shadow?: "drop" | "none";
  /** Drawn additively at night (lit windows, a lamp's bulb). */
  emissive?: Group;
  ppcm?: number;
  /** The glow's own resolution (pixels per cm), when lower than the art's: a glow is soft light, and a sparse one (a city's windows, a sky's stars) spread over a wide flat costs much atlas at full resolution. */
  glowPpcm?: number;
  /** 1 takes the scene's light fully; 0 is self-lit (a sky, a screen). */
  lit?: number;
  /** The prop or piece this flat belongs to, for hit tests and `obj` operations. */
  id?: string;
  /** A door leaf: it swings by up to `swing` radians about the vertical line at x = `hinge` (cm) when its piece opens. */
  hinge?: number;
  swing?: number;
  /** A door leaf that stands open, swung by all of `swing`, while one of these place states is on (a neighbour's door left open, warm light spilling out), opening and shutting as the state comes and goes. */
  openIn?: string[];
  /** A sliding door leaf: it slides `slide` cm along its own x (negative: to the left) when its piece opens, for an entrance or an exit through a door mark that names the piece. */
  slide?: number;
  /** Text on it, drawn as HTML by `propText` where the stage drew the flat. */
  text?: TextSpec[];
  /** Held, it is drawn over the arms and hands (a sign shown to someone), not cradled under them. */
  front?: boolean;
  /** Moves on its own (`FlatMotion`). */
  move?: FlatMotion;
  /** `false`: its glow is not on the place's switch (a street lamp, lit windows across the street): `lights_off` leaves it lit. */
  switch?: false;
  /** Shown only in these weathers, times of day or place states, fading in and out as they change (an umbrella in the rain, a walker who is home by night, a flag on the holiday). Each list given must match. */
  when?: FlatWhen;
  /** In a place state it is not faded but drawn from its top edge down: a roller shutter rolling down as its state comes on, and rolling up as it goes off (use `env state:…:roll`). */
  reveal?: "down";
  /** `false`: never hit-tested (a crowd: taps go through it to what is behind). */
  pick?: false;
  /** Its glow comes on only as the evening deepens: from the time's glow `glowAt` (0…1) over the next 0.12, so a city's windows light one by one (`glowWeight`). */
  glowAt?: number;
  /** Part of the sky (stars, the moon, the city's glow): drawn behind everything, held still while the camera pans and dollies, never blurred, and hidden by cloud (`WeatherMod.cloud`). */
  sky?: true;
  /** It answers people (not a kit puppet: Kerim) on stage (`FlatReact`, DESIGN.md §6.9): a pigeon flies off and lands further away, a cat turns its head. */
  react?: FlatReact;
}

/**
 * How a flat answers people, worked out by replaying where they walked in this place since its scene began (so seeking
 * and replaying land in the same state): `flee`: whenever someone comes within `r` m of where it is, it goes `away` m along
 * x away from them at `speed` m/s (default 2.4), up to `lift` cm high mid-way, and stays where it lands until someone comes
 * near it there; `look` turns it by up to `turn` radians about `pivot` (cm, the flat's own) towards anyone within `r` m
 * (`r` 0: only a tap turns it). `show` draws it only at `rest` or only while it is `away` (going), and `face` (−1 left,
 * 1 right) only while it goes that way: the flying pigeon and the walking cat are flats of their own. `asleep` draws it
 * only while its look is 0 and `awake` only while its head is turned: a sleeping dog's shut eyes, and its open ones as it
 * looks up. Reduced motion (`still`) keeps everything at home.
 * `tap`: a learner's tap in explore (DESIGN.md §9) makes it `hop` (a flutter up and down where it is) or `look` (its head
 * turned up) for a moment, with a kit `sound`; every flat of one animal (one home) answers the same tap.
 */
export interface FlatReact {
  /** The animal's spot in its piece (cm, `x` and `z`), shared by all its flats, so they react as one; default the flat's own origin. */
  home?: [number, number];
  tap?: { do: "hop" | "look"; sound?: string };
  flee?: { r: number; away: number; lift?: number; speed?: number };
  look?: { r: number; turn: number; pivot: [number, number] };
  show?: "rest" | "away" | "asleep" | "awake";
  face?: -1 | 1;
}

/** When a flat shows (`FlatSpec.when`): each list given must hold; a missing list always does. */
export interface FlatWhen { weather?: string[]; time?: string[]; state?: string[] }

export interface LightSpec { x: number; y: number; z: number; color: string; radius: number; intensity?: number; at?: string[]; /** `false`: not on the place's switch (a street lamp, the city far away): `lights_off` leaves it on. */ switch?: false }

/** Something rising from a piece or a prop (DESIGN.md §6.7): steam from a kettle or fresh bread, smoke from a chimney. `x`, `y`, `z` in cm like a light (y up), `w` how wide it rises from. */
/** Particles from a piece or prop (cm from its origin, y up): `steam`, `smoke`, or a candle's `flame` on its wick (`w` the flame's width, default 1.2). */
export interface EmitSpec { kind: (typeof EMIT_KINDS)[number]; x: number; y: number; z?: number; w?: number }
export const EMIT_KINDS = ["steam", "smoke", "flame"] as const;
/** The kinds of `FlatMotion` (`phase` and `stops` are not kinds: they offset or time any of them). */
export const MOTION_KINDS = ["scroll", "path", "sway", "blink"] as const;

export interface PieceOut { flats: FlatSpec[]; lights?: LightSpec[]; emitters?: EmitSpec[] }
/**
 * A set piece or a prop. A prop also draws its held look: `params.held` is true when it is in
 * someone's hand, and the first flat's origin goes to the grip (the arm and hand are drawn over it, unless `front`).
 * Held, only the first flat is drawn, upright and lit, so a held prop's text goes on its first flat.
 */
export interface PieceDef {
  draw(params: Record<string, unknown>, rng: Rng, kit: Kit): PieceOut;
  /** Its named looks: each a set of params (a `chair`'s `folding`, a `door`'s `glass`). A place names one as `variant`; its own params override it. */
  variants?: Record<string, Record<string, unknown>>;
  /** What it is and the params it reads, for tools (the kit's SET.md, the gallery's inspector); the engine never reads it. */
  meta?: PieceMeta;
  /**
   * Its solid lines on the floor, in cm from its origin (`a`, `b`: x to the right, z towards the viewer): what people walk
   * round (DESIGN.md §7). A line with `door` is a leaf (a gate, a door): solid except to an entrance or an exit through a door
   * mark that names the piece. Pure and cheap: it reads the params only, never draws.
   */
  solid?(params: Record<string, unknown>): SolidLine[];
}

/** A solid line of a piece (`PieceDef.solid`), cm from its origin in the floor plane. */
export interface SolidLine { a: [number, number]; b: [number, number]; door?: true }

/**
 * A generator's description (`PieceDef.meta`): every param `draw` reads, with its type and default,
 * the place states it answers to, and its words. Tools build controls and docs from it, and the kit's
 * tests hold every variant to it.
 */
export interface PieceMeta {
  /** One line: what it draws. */
  about: string;
  params: Record<string, ParamSpec>;
  /** Place states its art answers to (by `when.state` or a param that names one). */
  states?: string[];
  /** Card ids a place usually gives it (`terms`). */
  terms?: string[];
  tags?: string[];
}
/** A param's kind: `enum` one of `values`; `color` a palette id or a hex; `list` an array (of numbers, points, lines); `object` a small record (`{x, w}`). */
export type ParamType = "enum" | "int" | "num" | "bool" | "text" | "color" | "list" | "object";
/** One param of a generator. A param that takes either of two kinds lists both (`["bool", "color"]`: a tablecloth, or one of this colour). */
export interface ParamSpec {
  type: ParamType | readonly ParamType[];
  values?: readonly string[];
  min?: number;
  max?: number;
  default?: unknown;
  about?: string;
}

/** The params a piece or prop is drawn with: its `variant`'s params (`PieceDef.variants`), then its own over them. */
export function withVariant(def: PieceDef, params: Record<string, unknown>): Record<string, unknown> {
  const v = typeof params.variant === "string" && def.variants && Object.hasOwn(def.variants, params.variant) ? def.variants[params.variant] : undefined;
  return v ? { ...v, ...params } : params;
}

export interface FaceStyle {
  skin: string;
  eyes: string;
  eyeColor: string;
  brows: string;
  browColor: string;
  nose: string;
  mouth: string;
  marks: string[];
  facialHair: { style: string; color: string } | null;
  build: BodyDims["build"];
}

// ---- Sounds (DESIGN.md §8) -------------------------------------------------------------------

export type Bus = "voice" | "fx" | "ambience" | "music";

/**
 * A recorded sound (DESIGN.md §8.3): a mono AAC file in the kit's sound folder. A loop's file
 * carries a little of the loop before `loop[0]` and after `loop[1]` (seconds), so the seam still
 * holds where a decoder shifts the samples by its padding.
 */
export interface Recording { file: string; loop?: [number, number] }

export interface SoundDef {
  /** The bus it plays on: effects (one-shots) or ambience (loops). */
  bus: "fx" | "ambience";
  /** Its written sound word per language (`tr`: "tik tak"), drawn as a bubble when sound is off or captions are on. */
  word?: Record<string, string>;
  /** Ambience: rendered as a seamless loop of the patch's `dur`. */
  loop?: boolean;
  /** How many takes to render; each play picks one, so a repeated sound varies (footsteps). Default 1. */
  takes?: number;
  /**
   * The patch for one take. `params` come from the cue or the place (a footstep's `surface`:
   * stone, wood, tile, carpet); `take` is 0 … takes − 1, and `rng` is seeded by both.
   */
  patch(o: { rng: Rng; take: number; params: Record<string, unknown> }): Patch;
  /** A recording that plays instead of the patch where it loads; the patch stays for the tests, the pictures and as the fallback. */
  recording?: Recording;
}

// ---- Face and body vocabularies (DESIGN.md §5.2, §10) -----------------------------------------

/** One choice of the face or body the builder offers, and which values the kit's drawing knows. */
export interface Choice {
  /** The values, in the order the builder lists them. */
  values: string[];
  /** The value left out of a document; `null` means none (facial hair). */
  default: string | null;
  /** Each value's name per language. */
  names?: Record<string, Names>;
  /**
   * Relative odds in the randomiser (default 1): rare or off-style values get less than 1; a number,
   * or one per build (`{ adult: 0.2, elder: 3, child: 0, toddler: 0 }`: deep wrinkles). For a
   * multiple choice (`face.marks`) each value is drawn on its own: about one character in six has
   * it at weight 1 (the chance is multiplied by the weight, up to certain).
   */
  weights?: Record<string, Odds>;
  /** For a multiple choice (`face.marks`): the most values a document may hold. */
  max?: number;
  /** For a multiple choice: values that do not count towards `max` (identity marks: vitiligo, a birthmark, a scar). */
  free?: string[];
}

/**
 * The builder's fields that take a value from the kit's own vocabulary. A kit lists a `Choice`
 * for each: `face.eyeColor`'s values are ids of the `eyes` palette; `facialHair` lists the styles
 * (colour: the `hair` palette) and has default `null`; `face.marks` is a multiple choice.
 */
export type FeatureField = "body.build" | "body.shape" | "face.shape" | "face.eyes" | "face.eyeColor" | "face.brows" | "face.nose" | "face.mouth" | "face.ears" | "face.marks" | "facialHair";

/** What a part's metadata says, without its drawing: all `normalize` and the rules read of a part. */
export type PartMeta = Pick<PartDef, "slot" | "colors" | "palettes" | "defaults" | "patterns" | "tags" | "hides" | "replaces" | "builds" | "sides">;

/**
 * What `normalize` reads of a kit: ids, palettes, vocabularies and the parts' metadata, no code. A
 * `Kit` is one, and `manifestOf(kit)` makes plain JSON of it, so a Worker can validate documents
 * without loading the kit's drawing.
 */
export interface KitManifest {
  id: string;
  palettes: Record<string, Record<string, string>>;
  aliases?: Record<string, string>;
  features: Record<FeatureField, Choice>;
  defaultDoc: AvatarDoc;
  parts: Record<string, PartMeta>;
  /** The patterns' ink counts. */
  patterns?: Record<string, Pick<PatternDef, "inks">>;
}

/**
 * A puppet the kit builds in code (DESIGN.md §5.4), for a cast member with no avatar document: Kerim's
 * bird. It brings its own bones, art, pose and gestures; it has no hands and no face texture (its eyes
 * and beak are art that the pose switches). `body` sizes it for framing, bubbles, targets and the shadow.
 */
export interface KitPuppet {
  /** `bird` (`rig/bird.ts`: Kerim, the gulls) or `cat` (`rig/cat.ts`: Pisi); both are side-on to the director. */
  kind: string;
  body: BodyDims;
  bones: BoneDef[];
  /** Past side-on it mirrors: `back` is `front`. */
  views: Record<ViewName, Item[]>;
  /** Instead of `composePose`: `PoseOut.alt` switches its art (wings, eyes), `faces` stays empty. */
  pose(input: PoseInput): PoseOut;
  gestures: Record<string, GestureDef>;
}

/**
 * What a kit's seated side view is drawn from (`Kit.side`, DESIGN.md §6.3): the composed character, its body, skin and hair
 * colours, and the parts it wears with their colours resolved to hex, in the order `compose` drew them (hidden ones left out).
 */
export interface SideCtx {
  avatar: AvatarDoc; body: BodyDims; skin: string; hair: string; kit: Kit;
  worn: { slot: string; id: string; part: PartDef; colors: string[] }[];
}

export interface Kit {
  id: string;
  /**
   * A seated side view (DESIGN.md §6.3), optional: the profile of a composed character, facing screen right, for the bones of
   * `seatedSide` (rig/skeleton.ts: the usual bone names, the thighs level, the shins down, the hands on the lap), in draw order
   * (no layers: far limbs first, near limbs last), with exactly one `face` item. The stage mirrors it for a seat facing left.
   * A kit without one keeps its actors facing front on side seats.
   */
  side?(c: SideCtx): Item[];
  /** Puppets built in code, by the name a cast entry's `{ puppet }` gives. */
  puppets?: Record<string, (kit: Kit) => KitPuppet>;
  palettes: Record<string, Record<string, string>>;
  /** A palette id (`skin_07`, `fab_12`) or a `#RRGGBB` hex colour, as hex; anything else is the fallback. */
  color(id: string | undefined, fallback?: string): string;
  body(spec: AvatarDoc["body"]): BodyDims;
  /** Always drawn: the head, neck, ears, hands and the skin of the limbs. */
  base: PartDef;
  parts: Record<string, PartDef>;
  /** Retired ids of parts and palette colours, mapped to their replacements (ids are permanent, DESIGN.md §5). */
  aliases?: Record<string, string>;
  /** The face and body vocabularies the builder offers. */
  features: Record<FeatureField, Choice>;
  /**
   * Names of the builder's sections (`body`, `face`, `hair`, `clothes`, `extras`), fields
   * (`face.eyes`, `outfit.top`, …) and words (`none`, `colour`), per language. English is the fallback.
   */
  labels?: Record<string, Names>;
  /** The colour family of palette ids (`fab_03: "blue"`), so the randomiser can keep an outfit's colours apart. */
  families?: Record<string, string>;
  /** The names of palette colours per language, for the builder's swatches. */
  colorNames?: Record<string, Names>;
  /** Palette colours a learner picks only once the app reports their unlock (a dyed hair colour). */
  paletteUnlocks?: Record<string, string>;
  /** The patterns garments can wear; a part lists the ones it takes in `PartDef.patterns`. */
  patterns?: Record<string, PatternDef>;
  /** The randomiser's odds of palette colours by id (default 1): grey hair is rare, and not for children. */
  odds?: Record<string, Odds>;
  /**
   * The kit's default character: the builder starts from it, and it is drawn when a document is
   * unusable. Its hair, top, bottom and shoes are also the parts a required slot falls back to.
   */
  defaultDoc: AvatarDoc;
  /** Back-to-front layer order for each view. */
  layers: Record<ViewName, string[]>;
  face: {
    style(avatar: AvatarDoc, kit: Kit): FaceStyle;
    /** The face texture's box in head-bone space (cm). */
    region(b: BodyDims): Box;
    draw(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, style: FaceStyle, p: FaceParams, region: Box): void;
    /** The side view's face (`Kit.side`): its box in head-bone space, and a profile drawn into it (the near eye, its brow, the mouth at the edge), facing right. */
    regionSide?(b: BodyDims): Box;
    drawSide?(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, style: FaceStyle, p: FaceParams, region: Box): void;
    emotions: Record<string, FacePreset>;
    visemes: Record<string, Partial<FaceParams["mouth"]>>;
  };
  set: Record<string, PieceDef>;
  props: Record<string, PieceDef>;
  /** The gesture vocabulary (DESIGN.md §5.6). */
  gestures: Record<string, GestureDef>;
  /** Synthesized sounds (DESIGN.md §8.2): effects and ambience. */
  sounds?: Record<string, SoundDef>;
  /** The instruments music motifs are played on (DESIGN.md §8.3). */
  instruments?: Record<string, Instrument>;
  motifs?: Record<string, MotifDef>;
}
