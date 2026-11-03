// The lesson checks: what a story teaches against the course, run by sahne-story's story check while a series has the
// plugin on (src/plugin.ts there). Errors: the ref and the lessons against the week's unit, the target words as cards of the
// story's level and unit, a character above the story's level, how many target words and spots, a spot's lesson among the
// story's and its example a line of it, the quiz, a mistake's fix used within three lines, and words that resolve to no card,
// gloss or name. Warnings and info: the line counts by level, the 95% known-word ratio, and recycling across the season.
// The rules that need the cards, the grammar, the syllabus or the calendar run only when the content root has them.

import { isLine, type LineStep, type PluginCheckContext, type PluginSeasonContext, type StoryDoc } from "sahne-story";
import { isSpot, LEVELS, lessonOf, unitOfRef, unitOfWeek, type LessonLine, type SpotStep } from "./types.ts";

/** The parts of the check's World the lesson checks read (sahne-story check/world.ts). */
interface LessonWorld {
  cards: Record<string, { level?: string; ref?: string; tr: string }> | null;
  lessons: Record<string, { ref: string; level: string }> | null;
  days: Record<string, { id: string; date: string; week: number }> | null;
  syllabus: { words: Record<string, { tr: string; unit: number }> } | null;
}

/** Lines per story (Kumru's STORIES_DESIGN.md §1, proposed): [min, max] by level and kind. */
const LINES: Record<string, Record<string, [number, number]>> = { A1: { episode: [10, 14], special: [20, 28] }, A2: { episode: [14, 18], special: [26, 34] }, B1: { episode: [16, 22], special: [30, 40] } };
const levelIndex = (l?: string) => (LEVELS as readonly string[]).indexOf(l ?? "A1");
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export function checkLesson({ story, characters, world: w, lang, texts: all, names, norm, add }: PluginCheckContext): void {
  const world = w as LessonWorld, s = lessonOf(story), id = story.id;
  const day = world.days?.[id], unit = day ? unitOfWeek(day.week) : 0, level = s.level ?? "A1";

  // ref is a constraint (DESIGN §2): the week's unit
  if (day && s.ref !== `${level}_${unit}`) add("ref", "error", `ref ${s.ref} but week ${day.week} teaches ${level}_${unit}`);
  if (world.lessons) for (const l of s.lessons ?? []) {
    const g = world.lessons[l];
    if (!g) add("ref", "error", `lesson ${l} is not in grammar/`);
    else if (unit && unitOfRef(g.ref) > unit) add("ref", "error", `lesson ${l} is from ${g.ref}, after week ${day?.week}'s ${level}_${unit}`);
  }
  story.steps.forEach((st, i) => { if (isSpot(st) && !(s.lessons ?? []).includes(st.spot.lesson)) add("ref", "error", `spot lesson ${st.spot.lesson} is not in the story's lessons`, i); });
  if (world.cards) for (const wd of s.words ?? []) {
    const c = world.cards[wd];
    if (!c) add("ref", "error", `word ${wd} is not a card`);
    else if (!unitOfRef(c.ref)) add("ref", "error", `word ${wd} (${c.tr}) has no unit: its card has no ref`);
    else if (c.level && levelIndex(c.level) > levelIndex(level)) add("ref", "error", `word ${wd} (${c.tr}) is ${c.level.startsWith("A") ? "an" : "a"} ${c.level} card, above the story's ${level}`);
    else if (unit && unitOfRef(c.ref) > unit) add("ref", "error", `word ${wd} (${c.tr}) is from ${c.ref}, after week ${day?.week}'s ${level}_${unit}`);
  }
  for (const c of story.cast ?? []) {
    const doc = characters[c];
    if (doc && levelIndex(doc.level as string) > levelIndex(level)) add("character", "error", `${c} is level ${doc.level}, after the story's ${s.level}`);
  }

  // counts
  const special = story.kind === "special";
  const nWords = (s.words ?? []).length, [wMin, wMax] = special ? [10, 12] : [5, 8];
  if (nWords < wMin || nWords > wMax) add("counts", "error", `${nWords} target words; a${special ? " special" : "n episode"} has ${wMin}-${wMax}`);
  const spots = story.steps.filter(isSpot).length;
  if (special ? spots < 1 || spots > 2 : spots !== 1) add("counts", "error", `${spots} grammar spots; ${special ? "a special has 1-2" : "an episode has 1"}`);
  const lines = story.steps.filter(isLine).length, size = LINES[level]?.[story.kind ?? "episode"];
  if (size && (lines < size[0] || lines > size[1])) add("counts", "warning", `${lines} lines; ${level} ${story.kind ?? "episode"}s have ${size[0]}-${size[1]} (proposed)`);

  // quiz
  const quiz = s.quiz ?? [];
  if (!quiz.some(q => q.kind === "comp") || !quiz.some(q => q.kind === "word")) add("quiz", "error", "the quiz needs at least one comp and one word item");
  const haystack = all.map(t => norm(t.tr)).join(" | ");
  quiz.forEach((q, k) => {
    const quoted = [...(q.why ?? "").matchAll(/[“"]([^”"]+)[”"]/g)].map(m => m[1]);
    if (!quoted.length) add("quiz", "warning", `quiz item ${k + 1}: why quotes no line`);
    for (const t of quoted) if (!haystack.includes(norm(t))) add("quiz", "error", `quiz item ${k + 1}: “${t}” is not a line of the story`);
  });

  // spot examples are lines of the story
  story.steps.forEach((st, i) => { if (isSpot(st) && !haystack.includes(norm((st as SpotStep).spot.ex))) add("ref", "error", `spot example “${(st as SpotStep).spot.ex}” is not a line of the story`, i); });

  // mistake.fix is used within 3 lines (of the main language, whatever its code)
  const ls = story.steps.map((st, i) => [st, i] as const).filter(([st]) => isLine(st)) as [LineStep & LessonLine, number][];
  const said = (x: object) => String((x as Record<string, unknown>)[lang.id] ?? "");
  ls.forEach(([l, i], k) => {
    if (!l.mistake) return;
    const next = ls.slice(k + 1, k + 4).map(([x]) => norm(said(x)));
    if (!next.some(t => t.includes(norm(l.mistake!.fix)))) add("mistake", "error", `the fix “${l.mistake.fix}” is not used in the next 3 lines`, i);
  });

  // unknown tokens and the known-word ratio need a dictionary: the cards (or the syllabus)
  const { checkWords: words, resolver } = lang;
  const dictionary = !!world.cards || !!world.syllabus;
  const resolves = resolver([...Object.values(world.cards ?? {}).map(c => c.tr), ...Object.keys(s.gl ?? {}), ...names, ...(world.syllabus ? Object.values(world.syllabus.words).map(x => x.tr) : [])]);
  const main = lang.id;
  const unknown = new Map<string, number>();
  for (const t of [...all, ...quiz.flatMap(q => [{ tr: String(q.q?.[main] ?? ""), step: -1 }, ...q.options.map(tr => ({ tr, step: -1 }))])]) {
    for (const x of words(t.tr)) if (!resolves(x)) unknown.set(x, (unknown.get(x) ?? 0) + 1);
  }
  if (dictionary && unknown.size) add("text", "error", `${unknown.size} words resolve to no card, gloss or name: ${[...unknown].map(([x, n]) => (n > 1 ? `${x}×${n}` : x)).join(", ")}`);

  // known-word ratio (a warning for now): names, numbers and particles count; glosses do not
  if (day && dictionary) {
    const known = resolver([...Object.values(world.cards ?? {}).filter(c => c.level === "A1" && unitOfRef(c.ref) > 0 && unitOfRef(c.ref) <= unit).map(c => c.tr), ...names, ...(world.syllabus ? Object.values(world.syllabus.words).filter(x => x.unit <= unit).map(x => x.tr) : [])]);
    const toks = all.flatMap(t => words(t.tr));
    const miss = new Map<string, number>();
    for (const x of toks) if (!known(x)) miss.set(x, (miss.get(x) ?? 0) + 1);
    const total = toks.length, missed = [...miss.values()].reduce((a, b) => a + b, 0), ratio = total ? 1 - missed / total : 1;
    add("words", ratio < 0.95 ? "warning" : "info", `known words ${(ratio * 100).toFixed(1)}% of ${total} (95% wanted); not known: ${[...miss].map(([x, n]) => (n > 1 ? `${x}×${n}` : x)).join(", ")}`);
  }
}

/** Recycling across the season: a story's target words come back in two of the next stories within `days` days (a warning once those exist), and what it reuses of the stories before (info). */
export function checkLessonSeason({ world: w, stories, lang, texts, add }: PluginSeasonContext, days = 14): void {
  const world = w as LessonWorld;
  const uses = (s: StoryDoc, card: string): boolean => {
    const c = world.cards?.[card];
    if (!c) return false;
    const r = lang.resolver([c.tr], { particles: false });
    return texts(s).some(t => lang.checkWords(t.tr).some(r));
  };
  for (const story of stories) {
    const date = story.releaseDate;
    if (!date) continue;
    const later = Object.values(world.days ?? {}).filter(x => x.date > date && x.date <= addDays(date, days));
    const have = later.map(x => stories.find(e => e.id === x.id)).filter((e): e is StoryDoc => !!e);
    if (later.length && have.length === later.length) {
      const lacking = (lessonOf(story).words ?? []).filter(wd => have.filter(e => uses(e, wd)).length < 2);
      if (lacking.length) add("recycle", "warning", story.id, `target words used in fewer than 2 of the next ${later.length} stories (${days} days): ${lacking.map(wd => world.cards?.[wd]?.tr ?? wd).join(", ")}`);
    }
    const before = stories.filter(e => e.releaseDate && e.releaseDate < date && e.releaseDate >= addDays(date, -days));
    if (before.length) {
      const reused = before.flatMap(e => (lessonOf(e).words ?? []).filter(wd => uses(story, wd)));
      add("recycle", "info", story.id, `reuses ${new Set(reused).size} target words of the previous ${days} days (${before.map(e => e.id).join(", ")})`);
    }
  }
}
