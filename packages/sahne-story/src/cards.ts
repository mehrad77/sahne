// The app's cards as the place and story lints see them (Kumru's STORIES_SCHEMA.md §2): every card
// id in `$SAHNE_CONTENT/cards` and `cards-extra`, with its level, its words and whether it is
// retired. The lints take the index as an argument and stay pure; `load.ts` builds it in node, and the
// gallery gets it from serve.mjs. A card's level is its `level` field, never its id's prefix
// (`a1-w-bal` is A2).

/** `level` is absent only on notes (the starter note `seed-n01`). */
export interface CardInfo { level?: "A1" | "A2" | "B1"; tr: string; en: string; retired?: true }
export type CardIndex = Record<string, CardInfo>;

/** A card that exists and is not retired: one a `terms` entry may name. */
export const isCard = (cards: CardIndex, id: string) => Object.hasOwn(cards, id) && !cards[id].retired;
/** A live A1 card: one that counts toward a place's tappable words. */
export const isA1 = (cards: CardIndex, id: string) => isCard(cards, id) && cards[id].level === "A1";

/** Why a `terms` entry is not usable, or null: missing, or retired. */
export function cardProblem(cards: CardIndex, id: string): string | null {
  if (!Object.hasOwn(cards, id)) return `${id} is not a card`;
  return cards[id].retired ? `${id} (${cards[id].tr}) is retired` : null;
}
