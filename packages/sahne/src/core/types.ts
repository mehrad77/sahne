// The formats Sahne reads (DESIGN.md §5). They are independent of the renderer.

export type Build = "adult" | "elder" | "child" | "toddler";
export type BodyShape = "slim" | "average" | "broad" | "round";

/** Which side a one-sided part is worn on: the wearer's left (`l`, +x in both views), right (`r`) or both (`b`). */
export type WearSide = "l" | "r" | "b";

/**
 * One worn or carried part: a kit part id, its colours (palette ids, one per colour of the part),
 * an optional pattern with up to two inks (fabric ids; a missing ink is derived from the ground by
 * the kit), and for a one-sided part the side it is worn on (left out when it is the part's
 * default). In input a garment may be a bare id string; `normalize` makes it `{ id }`.
 */
export interface Garment { id: string; colors?: string[]; pattern?: string | null; inks?: string[]; side?: WearSide }

/**
 * A character: a learner's or a cast member's (DESIGN.md §5.2). Colours are palette ids (a
 * `#RRGGBB` hex only in cast documents). The canonical form, which `normalize` writes, is at most
 * 2 KB and keeps this key order. `v`, `kit`, `body`, `skin`, `face`, `hair` and `outfit` are always
 * there; the rest is left out when it is empty or equals the kit's default (a face feature, a
 * part's default colours, no facial hair, no extras). Documents from outside are never drawn
 * before `normalize` has seen them: `char` is data from other people.
 */
export interface AvatarDoc {
  v: 1;
  kit: string;
  body: { build: Build; height: number; shape: BodyShape };
  skin: string;
  face: { shape?: string; eyes?: string; eyeColor?: string; brows?: string; nose?: string; mouth?: string; ears?: string; marks?: string[] };
  hair: { style: string; color: string };
  facialHair?: { style: string; color?: string } | null;
  outfit: { top?: Garment | null; bottom?: Garment | null; dress?: Garment | null; outer?: Garment | null; shoes?: Garment | null };
  /** `head` a covering, `hat` a hat or cap (also over a covering), `hair` a clip, bow or band, `aid` a hearing device, `hands` a ring or henna. */
  wear?: {
    head?: Garment | null; hat?: Garment | null; hair?: Garment | null; eyes?: Garment | null; ears?: Garment | null; aid?: Garment | null;
    neck?: Garment | null; wrist?: Garment | null; hands?: Garment | null; waist?: Garment | null;
  };
  /** A worn bag (a backpack, a tote). */
  carry?: Garment | null;
  /** What a hand holds (a cane, an umbrella, a phone): it keeps that hand closed. */
  hold?: Garment | null;
  custom?: Garment[];
}

/**
 * A change of clothes (DESIGN.md §5.2, Kumru's STORIES_SCHEMA.md §5.2): clothing fields only, the body stays.
 * A string is a part id; `null` takes the slot off. Glasses, aids and head coverings are clothes.
 */
export interface Look {
  outfit?: { top?: Garment | string; bottom?: Garment | string; dress?: Garment | string | null; outer?: Garment | string | null; shoes?: Garment | string };
  wear?: { [K in keyof NonNullable<AvatarDoc["wear"]>]?: Garment | string | null };
  carry?: Garment | string | null;
  hold?: Garment | string | null;
}

/**
 * What `normalize` and `compose` did to a part of a document, for the builder to explain: parts
 * refused (`unknown`, `slot`), replaced, hidden, clipped or left out for size. A value that was
 * only defaulted (an unknown feature value, a bad colour) is not noted.
 */
export interface AvatarNote {
  /** The doc field (`outfit.top`, `hair.style`, `custom.0`, `doc`). */
  field: string;
  /**
   * The part id concerned ("" when there is none). For `unknown` it is the document's own text,
   * cut to 48 characters with anything but letters, digits and `_ . @ -` replaced by `_`; still
   * show it as text, never as markup.
   */
  id: string;
  /**
   * `unknown` the kit has no such part (or it is reserved for the cast); `slot` the part belongs to
   * another slot; `replaced` another part took its place (a dress replaces top and bottom);
   * `hidden` it is not drawn (a headscarf hides hair); `clipped` it is cut (a cap cuts hair);
   * `build` the part is not made for the body's build (a ring on a toddler); `size` it was left out
   * to keep the document within 2 KB.
   */
  why: "unknown" | "slot" | "replaced" | "hidden" | "clipped" | "build" | "size";
  /** The part that replaced, hid or clipped it. */
  by?: string;
}

/** Body measurements in centimetres, computed by the kit from build, height and shape. */
export interface BodyDims {
  build: Build;
  H: number;
  headW: number; headH: number;
  neckL: number; neckW: number;
  torsoL: number; shoulderW: number; chestW: number; waistW: number; hipW: number;
  upperArmL: number; foreArmL: number; handL: number;
  armW: [number, number, number];
  thighL: number; shinL: number; footH: number; footW: number;
  legW: [number, number, number];
  /** Height of the hip joint above the floor. */
  legLen: number;
}

export type ViewName = "front" | "back";

export interface PlaceDoc {
  v: 1;
  id: string;
  name?: Record<string, string>;
  /** The site this place is one space of (`metro` for `metro_m11`); absent when the place is the whole site. */
  site?: string;
  /** Out of doors: the far band is sky, skyline or water, not what a window shows. */
  outdoor?: boolean;
  size: { w: number; d: number };
  pieces: PieceRef[];
  marks: Record<string, Mark>;
  props?: Record<string, PropRef>;
  times?: string[];
  perch?: string;
  camera?: { eye?: number; wide?: { x: number; w: number; z?: number; /** The height the wide shot fits (metres; default 0.15 to 2.45). */ y0?: number; y1?: number } };
  /**
   * Variations of the place (DESIGN.md §5.5): the class empty or full, the shutter down, bunting up.
   * States in one `group` exclude each other; one without a group is a toggle. `default` states are
   * on when a scene starts here. Pieces, marks and props with `in` show only in those states.
   */
  states?: Record<string, PlaceState>;
  /**
   * `run`: the place's life never pauses while it is on stage (a vehicle: the view outside keeps
   * moving), at 30 frames a second when nothing else moves. Reduced motion still holds it.
   */
  life?: "run";
  /**
   * A vehicle that stops at stations (the metro car, DESIGN.md §6.9): its `stations` in the order it goes, and its timetable
   * (default `TIMETABLE` in `core/kit.ts`). Flats on the stops clock (`FlatMotion.clock`) follow it: on their own the car runs
   * from station to station; a scene can start standing at one (`scene.stop`), and `env: stop:<station>` brings it in to one and
   * holds it there, doors open, until `env: depart`.
   */
  stops?: PlaceStops;
  /** Kit sounds looped quietly while a scene is here (DESIGN.md §8.1). */
  ambience?: string[];
  /** The kit motif that plays when a scene moves here from another place. */
  motif?: string;
  /** What footsteps sound on: `stone`, `wood`, `tile`, `carpet` (the step sound's `surface`). */
  surface?: string;
}

/**
 * A named spot in a place, metres. `door` names the door piece an entrance comes through, and
 * `out` is where the street side of it is (an `enter` starts there, an `exit` ends there).
 */
export interface Mark { x: number; y?: number; z: number; /** Turned a little to screen left or right, or `back`: the back to the camera (a driver seen from the windscreen); on a seat, `side_l` or `side_r`: seen side on, facing screen left or right (a bus seat seen from the aisle), when the kit draws a side view. */ facing?: "l" | "r" | "back" | "side_l" | "side_r"; door?: string; out?: { x: number; z: number }; /** A spot in the air: a bird there keeps flying (hovers). */ air?: boolean; /** An air spot beside something moving (a train, a ferry): she flies along instead of hovering. */ pace?: boolean; /** A seat: whoever is put or walks here sits, the seat's top this many metres above the mark's floor (a chair 0.45, a car's bench 0.55), until they move away. */ seat?: number; /** Only in these states of the place. */ in?: string[] }

export interface PlaceState { group?: string; default?: true; /** Cold: breath shows (DESIGN.md §6.7). */ cold?: true }

/** A cast member the kit builds in code (`Kit.puppets`), not from an avatar document: Kerim is `{ puppet: "bird" }`. */
export interface PuppetRef { puppet: string }

/** A set piece in a place: its kit generator, where it stands (metres) and its parameters. `seed` pins its random art (the same building drawn in several places). */
export interface PieceRef { kit: string; /** One of the generator's named looks (`PieceDef.variants`); the piece's own params override it. */ variant?: string; id?: string; x: number; y?: number; z: number; seed?: string; /** Only in these states of the place. */ in?: string[]; /** `false`: none of its lights is on the place's switch. */ switch?: false; /** `false`: no solid line (a far or decorative piece people may pass), whatever its generator says (DESIGN.md §7). */ solid?: false; [param: string]: unknown }
/** A prop in a place. `keep`: the same thing in every place that lists it, so its count, showing and parameters come along (DESIGN.md §5.5). */
export interface PropRef { kit: string; /** One of the generator's named looks (`PieceDef.variants`). */ variant?: string; at: { x: number; y: number; z: number } | string; n?: number; terms?: string[]; shown?: boolean; keep?: boolean; /** Only in these states of the place. */ in?: string[]; [param: string]: unknown }

/** A place's stations and timetable (`PlaceDoc.stops`): ms, run and ease as `FlatMotion.stops`; `hold`, ms after the leg ends, where a held stop stands (the doors open, the passengers aboard). */
export interface PlaceStops { stations: string[]; ms?: number; run?: number; ease?: number; hold?: number }
