// A new episode's first draft, from its brief: what the story check needs to read it (a scene with the cast on floor
// marks, Kerim's opening, a few lines, one choice, one spot, three quiz items), every text a placeholder to write, marked
// `draft: true`. Pure (test/server.test.ts checks one against the samples).

import type { Arc, LangText, StoryDoc, StoryPlace } from "sahne-story";

export interface Brief {
  id: string; season: number; releaseDate: string; kind: "episode" | "special"; week: number;
  arc: { id: string } & Omit<Arc, "id">;
  place: string; cast: string[]; words: string[]; lessons: string[];
  /** The title (the main language's at least) and the premise, by language. */
  title: LangText; summary?: LangText;
  /** The level the season's other episodes name (a story still names one; series and seasons do not). */
  level?: string;
}

export function skeleton(b: Brief, o: { narrator: string; standin: string; places: Record<string, StoryPlace> }): StoryDoc {
  const { narrator, standin } = o;
  const other = b.cast.find(c => c !== standin) ?? b.cast[0];
  const level = b.level ?? "A1";
  // people stand on floor marks: not a spot in the air (Kerim's), a seat or a door
  const floor = Object.entries(o.places[b.place]?.marks ?? {}).filter(([, m]) => !m.air && m.seat === undefined && !m.door).map(([id]) => id);
  const who = [standin, ...b.cast.filter(c => c !== standin)];
  return {
    id: b.id, releaseDate: b.releaseDate, kind: b.kind, level, season: b.season,
    arc: b.arc, ref: `${level}_${Math.min(Math.max(b.week, 1), 6)}`,
    title: { tr: b.title.tr, en: b.title.en || b.title.tr, fa: b.title.fa || b.title.tr },
    summary: { en: b.summary?.en || "…", fa: b.summary?.fa || "…" },
    place: b.place, cast: [...new Set(who)], lessons: b.lessons, words: b.words, gl: {},
    steps: [
      { scene: b.place, at: Object.fromEntries(who.map((c, i) => [c, floor[i] ?? ""]).filter(([, m]) => m)) },
      { who: narrator, narr: true, tr: "…", en: b.summary?.en || "…", fa: b.summary?.fa || "…" },
      { who: other, tr: "Merhaba!", en: "Hello!", fa: "سلام!" },
      { who: standin, tr: "Merhaba!", en: "Hello!", fa: "سلام!" },
      { who: other, tr: "Buyrun?", en: "Yes, please?", fa: "بفرمایید؟" },
      { choice: { id: "secim", kind: "polite", to: other, options: [{ tr: "Teşekkürler!", en: "Thanks!", fa: "ممنون!", ok: true }, { tr: "Tamam.", en: "OK.", fa: "باشه." }] } },
      { spot: { lesson: b.lessons[0], ex: "Merhaba!", en: "…", fa: "…" } },
    ],
    quiz: [
      { q: { tr: "…?", en: "…?", fa: "…؟" }, options: ["…", "…", "…"], a: 0, why: "“Merhaba!”", kind: "comp" },
      { q: { tr: "…?", en: "…?", fa: "…؟" }, options: ["…", "…", "…"], a: 0, why: "“Merhaba!”", kind: "word" },
      { q: { tr: "…?", en: "…?", fa: "…؟" }, options: ["…", "…", "…"], a: 0, why: "“Merhaba!”", kind: "comp" },
    ],
    followUp: [],
    draft: true,
  } as unknown as StoryDoc;
}
