// A new episode's first draft, pure (test/skeleton.test.ts checks one in every kind of series). `skeleton` builds it from
// its brief: what the story check needs to read it (a scene with the cast on floor marks, the narrator's opening, a few
// lines; an interactive episode's choice; with the lesson plugin, one spot and three quiz items), every text a placeholder
// to write in each of the series' languages (Turkish gets a few real words to start from), marked `draft: true`. `duplicate` starts one from another episode
// instead: its place, cast, structure and staging kept, every text cleared to a placeholder.

import { allLanguages, DEFAULT_LANGUAGES, type Arc, type Languages, type LangText, type PlayMode, type StoryDoc, type StoryPlace } from "sahne-story";

export interface Brief {
  id: string; season: number; releaseDate: string; kind: "episode" | "special"; week: number;
  arc: { id: string } & Omit<Arc, "id">;
  place: string; cast: string[];
  /** The lesson plugin's: the target words (card ids) and the grammar lessons. */
  words?: string[]; lessons?: string[];
  /** The title (the main language's at least) and the premise, by language. */
  title: LangText; summary?: LangText;
  /** The lesson plugin's: the level the season's other episodes name (a story still names one; series and seasons do not). */
  level?: string;
}

/** The kind of series it is written for: whether the lesson plugin is on (default on, the samples'), and how it plays. */
export interface SkeletonOptions {
  narrator: string; standin: string; places: Record<string, StoryPlace>; languages?: Languages;
  /** The series has the lesson plugin: the draft gets the lesson fields, a spot and the quiz. */
  lesson?: boolean;
  /** How the episode plays (sahne-story `playOf`): a watch-only one has no choice. */
  play?: PlayMode;
}

const DOTS = "…";
/** A text in every language: each its own, or the placeholder. */
const texts = (langs: string[], t: Partial<Record<string, string>> = {}) => Object.fromEntries(langs.map(l => [l, t[l] || DOTS]));
/** Starting words for a Turkish story with English and Persian (others start from placeholders). */
const SAY: Record<string, Partial<Record<string, string>>> = {
  hello: { tr: "Merhaba!", en: "Hello!", fa: "سلام!" },
  please: { tr: "Buyrun?", en: "Yes, please?", fa: "بفرمایید؟" },
  thanks: { tr: "Teşekkürler!", en: "Thanks!", fa: "ممنون!" },
  ok: { tr: "Tamam.", en: "OK.", fa: "باشه." },
};

export function skeleton(b: Brief, o: SkeletonOptions): StoryDoc {
  const { narrator, standin } = o, langs = o.languages ?? DEFAULT_LANGUAGES, all = allLanguages(langs), main = langs.main;
  const said = (k: keyof typeof SAY) => texts(all, main === "tr" ? SAY[k] : {});
  const other = b.cast.find(c => c !== standin) ?? b.cast[0];
  const level = b.level ?? "A1";
  // people stand on floor marks: not a spot in the air (Kerim's), a seat or a door
  const floor = Object.entries(o.places[b.place]?.marks ?? {}).filter(([, m]) => !m.air && m.seat === undefined && !m.door).map(([id]) => id);
  const who = [standin, ...b.cast.filter(c => c !== standin)];
  const hello = said("hello")[main];
  const quiz = (kind: "comp" | "word") => ({ q: texts(all, { [main]: `${DOTS}?` }), options: [DOTS, DOTS, DOTS], a: 0, why: `“${hello}”`, kind });
  const lesson = o.lesson ?? true, watch = o.play === "watch";
  const lessonFields = lesson ? { level, ref: `${level}_${Math.min(Math.max(b.week, 1), 6)}`, lessons: b.lessons ?? [], words: b.words ?? [], gl: {} } : {};
  return {
    id: b.id, releaseDate: b.releaseDate, kind: b.kind, ...(lesson ? { level } : {}), season: b.season,
    arc: b.arc, ...lessonFields,
    title: texts(all, { ...Object.fromEntries(all.map(l => [l, b.title[l] || b.title[main]])) }),
    summary: texts(langs.translations, b.summary),
    place: b.place, cast: [...new Set(who)],
    ...(watch ? { play: "watch" } : {}),
    steps: [
      { scene: b.place, at: Object.fromEntries(who.map((c, i) => [c, floor[i] ?? ""]).filter(([, m]) => m)) },
      { who: narrator, narr: true, ...texts(all, Object.fromEntries(langs.translations.map(l => [l, b.summary?.[l] ?? ""]))) },
      { who: other, ...said("hello") },
      { who: standin, ...said("hello") },
      { who: other, ...said("please") },
      // a watch-only episode says the line; an interactive one lets the viewer choose it
      watch ? { who: standin, ...said("thanks") } : { choice: { id: "secim", kind: "polite", to: other, options: [{ ...said("thanks"), ok: true }, { ...said("ok") }] } },
      ...(lesson ? [{ spot: { lesson: (b.lessons ?? [])[0], ex: hello, ...texts(langs.translations) } }] : []),
    ],
    ...(lesson ? { quiz: [quiz("comp"), quiz("word"), quiz("comp")] } : {}),
    followUp: [],
    draft: true,
  } as unknown as StoryDoc;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** Every text in a step (its language keys, its replies', its options') set to the placeholder; its staging kept. */
function clear(v: unknown, all: string[]): unknown {
  if (Array.isArray(v)) return v.map(x => clear(x, all));
  if (!isObj(v)) return v;
  const out: Obj = {};
  for (const [k, x] of Object.entries(v)) {
    if (all.includes(k) && typeof x === "string") out[k] = DOTS;
    else if (k === "ex" && typeof x === "string") out[k] = DOTS;
    else if (k === "note" || k === "mistake" || k === "link" || k === "on") continue; // tied to the words, which are gone
    else out[k] = clear(x, all);
  }
  return out;
}

/** A new episode from another: its place, cast, steps and staging, every text a placeholder; the brief's id, date, week and words. */
export function duplicate(source: StoryDoc, b: Brief, langs: Languages = DEFAULT_LANGUAGES): StoryDoc {
  const all = allLanguages(langs), main = langs.main;
  // the flags it sets are named for the story that sets them (`s1e04_paid`)
  const steps = JSON.parse(JSON.stringify(clear(source.steps, all)).replaceAll(`"sets":"${source.id}_`, `"sets":"${b.id}_`)) as StoryDoc["steps"];
  const quiz = (source.quiz as Obj[] | undefined ?? []).map(q => ({ ...q, q: texts(all, { [main]: `${DOTS}?` }), options: [DOTS, DOTS, DOTS], a: 0, why: `“${DOTS}”` }));
  const { followUp: _f, names: _n, ...rest } = source as StoryDoc & Obj;
  return {
    ...rest,
    id: b.id, releaseDate: b.releaseDate, kind: b.kind, season: b.season, arc: b.arc,
    title: texts(all, Object.fromEntries(all.map(l => [l, b.title[l] || b.title[main]]))),
    summary: texts(langs.translations, b.summary),
    ...(source.words !== undefined || b.words?.length ? { words: b.words?.length ? b.words : source.words, lessons: b.lessons?.length ? b.lessons : source.lessons, gl: {}, quiz } : {}),
    steps, draft: true,
  } as StoryDoc;
}
