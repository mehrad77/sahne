// The command palette's matching (ui/kit/palette.ts), pure: a query's words each found in an item's label or its
// keywords, ignoring case and accents, the closest first (a label that starts with the query, then one with a word
// that does, then the rest, each in its own order).

export interface Command { id: string; label: string; what: string; keywords?: string; hint?: string; run(): void }

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en").replace(/ı/g, "i");

/** The commands that match `query`, best first, at most `limit`. */
export function search<T extends Pick<Command, "label" | "keywords">>(items: readonly T[], query: string, limit = 40): T[] {
  const q = fold(query.trim());
  if (!q) return items.slice(0, limit);
  const words = q.split(/\s+/);
  const scored: [T, number, number][] = [];
  items.forEach((it, i) => {
    const label = fold(it.label), hay = `${label} ${fold(it.keywords ?? "")}`;
    if (!words.every(w => hay.includes(w))) return;
    const score = label.startsWith(q) ? 0 : label.split(/[\s·:/-]+/).some(w => w.startsWith(words[0])) ? 1 : 2;
    scored.push([it, score, i]);
  });
  return scored.sort((a, b) => a[1] - b[1] || a[2] - b[2]).slice(0, limit).map(([it]) => it);
}
