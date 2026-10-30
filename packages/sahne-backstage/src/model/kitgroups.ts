// The kit page's shelves (ui/kitpage.ts), pure: which category each prop, set piece, gesture, emotion and sound sits in.
// The kit gives tags, many of them on one item each; a shelf gathers several tags, and an item goes on the first shelf one
// of its tags (in its own order) belongs to, else on "Other". A shelf with nothing on it is not shown.

export interface Shelf { id: string; label: string; tags?: readonly string[] }

export const PROP_SHELVES: readonly Shelf[] = [
  { id: "food", label: "Food & drink", tags: ["food", "drink", "sweet", "snack", "fruit", "vegetable", "pantry", "bottle", "dish", "cookware", "cutlery", "kitchen", "stove"] },
  { id: "home", label: "Home", tags: ["home", "furniture", "bed", "rug", "linen", "cleaning", "laundry", "toiletry", "bathroom", "sewing", "light", "door", "window", "floor", "box", "appliance", "fire", "seating"] },
  { id: "nature", label: "Animals & nature", tags: ["animal", "bird", "pet", "farm", "insect", "zoo", "nature", "plant", "garden"] },
  { id: "transport", label: "Transport & travel", tags: ["vehicle", "metro", "airport", "transport", "travel", "ticket", "pass"] },
  { id: "street", label: "Shops & street", tags: ["shop", "market", "vendor", "street", "sign", "flag", "building", "money", "cash", "lira", "card", "id"] },
  { id: "wear", label: "Clothes & carry", tags: ["clothes", "bag", "shoes", "jewellery", "pocket", "cloth", "charm", "souvenir", "turkey", "carry"] },
  { id: "paper", label: "Paper & school", tags: ["paper", "school", "stationery", "desk", "print", "reading", "words"] },
  { id: "tech", label: "Tech & tools", tags: ["tech", "phone", "gadget", "machine", "hardware", "tool"] },
  { id: "health", label: "Health & care", tags: ["medicine", "pharmacy", "health", "care"] },
  { id: "play", label: "Play & events", tags: ["toy", "party", "game", "music", "instrument", "art", "sport", "outing", "event"] },
];

export const SET_SHELVES: readonly Shelf[] = [
  { id: "transit", label: "Airport & metro", tags: ["airport", "metro", "station", "vehicle", "rail", "gate"] },
  { id: "room", label: "Rooms & walls", tags: ["wall", "floor", "room", "window", "door", "barrier"] },
  { id: "outside", label: "Streets & buildings", tags: ["street", "building", "landmark", "city", "park", "market"] },
  { id: "nature", label: "Sky, water & trees", tags: ["sky", "water", "tree", "plant", "ground", "view"] },
  { id: "shop", label: "Shops & food", tags: ["shop", "food", "vendor", "kitchen"] },
  { id: "furniture", label: "Furniture & seating", tags: ["seating", "furniture", "rug", "home", "tech", "machine", "appliance"] },
  { id: "signs", label: "Lights & signs", tags: ["light", "sign", "hung", "clock", "picture", "flag", "paper"] },
  { id: "life", label: "People & animals", tags: ["people", "animal"] },
];

export const GESTURE_SHELVES: readonly Shelf[] = [
  { id: "alone", label: "On its own" },
  { id: "target", label: "At something" },
  { id: "prop", label: "With a prop" },
  { id: "partner", label: "With a partner" },
];

export const EMOTION_SHELVES: readonly Shelf[] = [
  { id: "bright", label: "Bright", tags: ["neutral", "happy", "laugh", "proud", "moved", "surprised", "curious"] },
  { id: "low", label: "Low", tags: ["sad", "sorry", "tired", "shy"] },
  { id: "tense", label: "Tense", tags: ["annoyed", "nervous", "confused", "angry", "scared"] },
];

export const SOUND_SHELVES: readonly Shelf[] = [
  { id: "fx", label: "Effects", tags: ["fx"] },
  { id: "ambience", label: "Ambience loops", tags: ["ambience"] },
];

export const OTHER: Shelf = { id: "other", label: "Other" };

/** The shelf an item with these tags goes on. */
export function shelfOf(shelves: readonly Shelf[], tags: readonly string[] | undefined): Shelf {
  for (const t of tags ?? []) for (const s of shelves) if (s.tags?.includes(t)) return s;
  return OTHER;
}

/** A gesture's shelf, from what it needs. */
export const gestureShelf = (needs: readonly string[] | undefined) =>
  GESTURE_SHELVES.find(s => s.id === (needs?.includes("partner") ? "partner" : needs?.includes("prop") ? "prop" : needs?.includes("target") ? "target" : "alone"))!;

/** The shelves that have something on them, in order (Other last), with how many. */
export function shelvesWith<T>(shelves: readonly Shelf[], items: readonly T[], shelf: (it: T) => string): { shelf: Shelf; n: number }[] {
  const n = new Map<string, number>();
  for (const it of items) n.set(shelf(it), (n.get(shelf(it)) ?? 0) + 1);
  return [...shelves, OTHER].filter(s => n.has(s.id)).map(s => ({ shelf: s, n: n.get(s.id)! }));
}
