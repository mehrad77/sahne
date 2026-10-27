// What the A1 briefs ask of each place ($SAHNE_CONTENT/needs.json),
// keyed by site (Kumru's STORIES_WORLD.md §2). Hand-kept from Kumru's STORIES_A1.md, reviewed by the owner;
// `lintPlace` checks a place document against its entry.

/** Story ids that ask for a thing, with why. */
interface Asked { why?: string; stories: string[] }

export interface NeedMark extends Asked { perch?: true; air?: true; door?: true; pace?: true; /** Someone sits there (a car's seats, a bench, a desk): the place's mark is a seat. */ seat?: true }
export interface NeedProp extends Asked { kit: string; /** One of the generator's named looks (`PieceDef.variants`, or planned in sahne-kit/set/plan.json). */ variant?: string; n?: number; terms: string[] }
/** States in one `group` exclude each other; `default` is the one a scene starts in. */
export interface NeedState extends Asked { group?: string; default?: true }

export interface PlaceNeeds {
  why: string;
  stories: string[];
  times?: string[];
  weather?: string[];
  marks?: Record<string, NeedMark>;
  /** Things that are part of the place whenever a story is there. */
  props?: Record<string, NeedProp>;
  /** Things a story brings for itself: listed so the kit draws them, checked against the story, not the place. */
  storyProps?: Record<string, NeedProp>;
  states?: Record<string, NeedState>;
  crowd?: string;
  /** Kit sound ids (every one is a kit sound: test/needs.test.ts). */
  sounds?: string[];
  landmarks?: string[];
  notes?: string;
}

export interface SiteNeeds { stories: string[]; places: Record<string, PlaceNeeds> }
export type Needs = Record<string, SiteNeeds>;

/** A place's entry and its site, or null. */
export function needsOf(needs: Needs, placeId: string): { site: string; place: PlaceNeeds } | null {
  for (const [site, s] of Object.entries(needs)) if (Object.hasOwn(s.places, placeId)) return { site, place: s.places[placeId] };
  return null;
}
