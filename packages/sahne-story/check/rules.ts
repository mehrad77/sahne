// The story check: every draft, the cast roster, character and place against what Kumru's STORIES_SCHEMA.md
// §3-§5, §10, Kumru's STORIES_DESIGN.md and Kumru's STORIES_AUTHORING.md require, plus lintStory and lintPlace. Pure over a
// World (check/world.ts), so tests seed breaks by editing a clone. Errors stop `pnpm sahne check`;
// warnings and info are the report.

import { lowerTr } from "sahne-tr";
import { applyLook, AVATAR_MAX_BYTES, compose, GARMENT_FIELDS, normalize, serialize, type AvatarDoc, type AvatarNote, type Kit, type KitManifest, type Solid } from "sahne";
import { puppets as KERIM_PUPPETS } from "../../sahne-kit/src/kerim/index.ts";
import { puppets as ANIMAL_PUPPETS } from "../../sahne-kit/src/puppets/index.ts";
import { isAct, isChoice, isLine, isSpot, isScene, lintPlace, lintStory, NARRATOR, seasonOf, STANDIN, type CharacterDoc, type LineStep, type Needs, type StoryDoc, type Step } from "../src/index.ts";
import type { CardIndex } from "../src/index.ts";
import { validateDoc, type SchemaKind } from "./schema.ts";
import { resolver, words, type Resolver } from "./words.ts";
import type { Draft, World } from "./world.ts";

export type CheckRule = "schema" | "id" | "series" | "calendar" | "ref" | "cast" | "counts" | "flags" | "quiz" | "mistake" | "text" | "words" | "recycle" | "character" | "lint" | "place";
export interface CheckProblem { rule: CheckRule | string; level: "error" | "warning" | "info"; story: string; step?: number; message: string }
/**
 * `kit` is a whole `Kit` (sahne-kit's full.ts) when the cast's avatars are to be composed; a bare manifest
 * skips that. `puppets` names the kit puppets a character's `puppet` may name beyond the kit's own
 * (default: Kerim's, from sahne-kit/kerim, which full.ts leaves out so a page that never casts her never loads her).
 */
export interface CheckOptions { kit?: KitManifest | Kit; puppets?: string[]; solids?: Record<string, Record<string, Solid[]>>; cards?: CardIndex | null; needs?: Needs; recycleDays?: number }

/** s1e45 has six speakers in an episode, the owner's choice (Kumru's STORIES_A1.md). */
export const CAST_ALLOW = new Set(["s1e45"]);
/** Character ids of the series Kumru replaced: never used again (ids are permanent). */
export const RETIRED_CHARACTERS = new Set("ada can dede deniz ela marti mert selin simit zeynep".split(" "));
const BREAKS: [string, string][] = [["2026-11-02", "2026-11-07"], ["2027-01-04", "2027-01-09"]];
const LEVELS = ["A1", "A2", "B1"];
/** Lines per story (Kumru's STORIES_DESIGN.md §1, proposed): [min, max] by level and kind. */
const LINES: Record<string, Record<string, [number, number]>> = { A1: { episode: [10, 14], special: [20, 28] }, A2: { episode: [14, 18], special: [26, 34] }, B1: { episode: [16, 22], special: [30, 40] } };

/** A week's arc id: season 1, week 3 → `s1w03`. */
export const arcId = (season: number, week: number) => `s${season}w${String(week).padStart(2, "0")}`;

/** The unit a week teaches: weeks 1-6 their own, weeks 7-8 all of A1 (Kumru's STORIES_A1.md *Weeks*). */
export const unitOfWeek = (week: number) => Math.min(week, 6);
/** Where a ref sits in the course: A1_1–A1_6 are units 1–6, A2 7–12, B1 13–18; 0 for none. An A2 or B1 card is never an A1 week's. */
export const unitOfRef = (ref?: string) => { const m = /^(A1|A2|B1)_(\d)$/.exec(ref ?? ""); return m ? LEVELS.indexOf(m[1]) * 6 + Number(m[2]) : 0; };

/** Every Turkish text of a story with where it is: steps, choice options and their replies, follow-ups. */
export interface Text { tr: string; step: number; kind: "line" | "option" | "reply" | "follow"; who?: string; narr?: boolean }
export function texts(story: StoryDoc): Text[] {
  const out: Text[] = [];
  const line = (s: Step, step: number, kind: Text["kind"]) => {
    if (isLine(s)) out.push({ tr: s.tr, step, kind, who: s.who, narr: !!s.narr });
  };
  story.steps.forEach((s, i) => {
    line(s, i, "line");
    if (isChoice(s)) for (const o of s.choice.options) {
      out.push({ tr: o.tr, step: i, kind: "option", who: STANDIN });
      for (const r of o.reply ?? []) line(r as Step, i, "reply");
    }
  });
  ((story.followUp as Step[] | undefined) ?? []).forEach((s, i) => {
    line(s, story.steps.length + i, "follow");
    if (isChoice(s)) for (const o of s.choice.options) out.push({ tr: o.tr, step: story.steps.length + i, kind: "option", who: STANDIN });
  });
  return out;
}

const norm = (t: string) => lowerTr(t.replace(/[“”"‘’'.,!?…:;—-]/g, " ")).replace(/\s+/g, " ").trim();
/** The learner's hometown in the stories' text, replaced by the host (s1e01: "Tahran"). */
const HOMETOWN = "Tahran";
const nameWords = (d: Draft, world: World, story: StoryDoc) => {
  const names: string[] = [];
  // every roster character's name (a story may mention one not in its cast), and the hometown token the app personalises
  for (const c of [...Object.values(d.characters), ...Object.values(world.cast ?? {})]) names.push(c.name);
  names.push(HOMETOWN, `${HOMETOWN}lı`);
  for (const p of [story.place, ...story.steps.filter(isScene).map(s => s.scene)]) { const pl = world.places[p]; if (pl?.name?.tr) names.push(pl.name.tr); }
  return names;
};

/** Every choice option that sets a flag, in the steps and the follow-up, with its step (the follow-up's are not numbered). */
const flagOptions = (s: StoryDoc) => [
  ...s.steps.flatMap((st, step) => (isChoice(st) ? st.choice.options.filter(op => op.sets).map(op => ({ ...op, step })) : [])),
  ...((s.followUp ?? []) as Step[]).flatMap(st => (isChoice(st) ? st.choice.options.filter(op => op.sets).map(op => ({ ...op, step: undefined })) : [])),
];

/** A value's JSON with every object's keys sorted: equal documents compare equal whatever order their keys were written in. */
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));

const dayOfWeek = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** One story's own rules (nothing that needs another story). */
export function checkStory(d: Draft, world: World, o: CheckOptions = {}): CheckProblem[] {
  const s = d.story, id = s.id ?? d.id;
  const out: CheckProblem[] = [];
  const add = (rule: CheckProblem["rule"], level: CheckProblem["level"], message: string, step?: number) => out.push({ rule, level, story: id, step, message });

  for (const p of validateDoc("story", s)) add("schema", "error", `${p.path}: ${p.message}`);
  for (const [cid, c] of Object.entries(d.characters)) for (const p of validateDoc("character", c)) add("schema", "error", `character ${cid} ${p.path}: ${p.message}`);
  if (s.id !== d.id) add("id", "error", `the folder is ${d.id} but the story's id is ${s.id}`);

  // the calendar rules run when the content root has one (days.json)
  const day = world.days?.[d.id];
  const unit = day ? unitOfWeek(day.week) : 0;
  if (world.days && !day) add("calendar", "error", `${d.id} has no row in days.json`);
  else if (day) {
    if (s.releaseDate !== day.date) add("calendar", "error", `releaseDate ${s.releaseDate} but Days has ${day.date}`);
    if (s.kind !== day.kind) add("calendar", "error", `kind ${s.kind} but Days has ${day.kind}`);
    if (s.arc && s.arc.id !== arcId(seasonOf(d.id), day.week)) add("calendar", "error", `arc ${s.arc.id} but the story is in week ${day.week}`);
  }
  if (s.releaseDate && dayOfWeek(s.releaseDate) === 0) add("calendar", "error", `${s.releaseDate} is a Sunday`);
  if (s.releaseDate && BREAKS.some(([a, b]) => s.releaseDate! >= a && s.releaseDate! <= b)) add("calendar", "error", `${s.releaseDate} falls in a break week`);
  if (s.releaseDate && s.kind === "special" && dayOfWeek(s.releaseDate) !== 6) add("calendar", "error", "a special comes out on a Saturday");
  if (s.releaseDate && s.kind === "episode" && dayOfWeek(s.releaseDate) === 6) add("calendar", "error", "an episode comes out Monday to Friday");
  if (s.id && s.season && seasonOf(s.id) !== s.season) add("id", "error", `season ${s.season} does not match the id ${s.id}`);

  // ref is a constraint (DESIGN §2): the week's unit
  const level = s.level ?? "A1";
  if (day && s.ref !== `${level}_${unit}`) add("ref", "error", `ref ${s.ref} but week ${day.week} teaches ${level}_${unit}`);
  if (world.lessons) for (const l of s.lessons ?? []) {
    const g = world.lessons[l];
    if (!g) add("ref", "error", `lesson ${l} is not in grammar/`);
    else if (unit && unitOfRef(g.ref) > unit) add("ref", "error", `lesson ${l} is from ${g.ref}, after week ${day?.week}'s A1_${unit}`);
  }
  s.steps.forEach((st, i) => { if (isSpot(st) && !(s.lessons ?? []).includes(st.spot.lesson)) add("ref", "error", `spot lesson ${st.spot.lesson} is not in the story's lessons`, i); });
  if (world.cards) for (const w of s.words ?? []) {
    const c = world.cards[w];
    if (!c) add("ref", "error", `word ${w} is not a card`);
    else if (!unitOfRef(c.ref)) add("ref", "error", `word ${w} (${c.tr}) has no unit: its card has no ref`);
    else if (c.level && LEVELS.indexOf(c.level) > LEVELS.indexOf(s.level ?? "A1")) add("ref", "error", `word ${w} (${c.tr}) is ${c.level.startsWith("A") ? "an" : "a"} ${c.level} card, above the story's ${s.level ?? "A1"}`);
    else if (unit && unitOfRef(c.ref) > unit) add("ref", "error", `word ${w} (${c.tr}) is from ${c.ref}, after week ${day?.week}'s A1_${unit}`);
  }

  // cast
  const all = texts(s);
  const speakers = new Set(all.filter(t => t.kind !== "option" && t.who && !(t.who === NARRATOR && t.narr)).map(t => t.who!));
  const limit = s.kind === "special" || CAST_ALLOW.has(id) ? 6 : 4;
  if (speakers.size > limit) add("cast", "error", `${speakers.size} speakers (${[...speakers].join(", ")}); the limit is ${limit}${CAST_ALLOW.has(id) ? "" : " for an episode"}`);
  if ((s.cast ?? []).length > limit) add("cast", "error", `cast lists ${s.cast.length}; the limit is ${limit}`);
  for (const t of all) if (t.kind !== "option" && t.who && !t.narr && t.who !== STANDIN && !s.cast.includes(t.who)) add("cast", "error", `${t.who} speaks but is not in cast`, t.step);
  for (const t of all) if (t.narr && t.who !== NARRATOR) add("cast", "error", `narr is only for ${NARRATOR}, not ${t.who}`, t.step);
  for (const c of s.cast ?? []) {
    if (RETIRED_CHARACTERS.has(c)) add("cast", "error", `${c} is a retired character id`);
    const doc = d.characters[c];
    if (!doc) add("character", "error", `no character document for ${c}`);
    else if (LEVELS.indexOf(doc.level as string) > LEVELS.indexOf(s.level ?? "A1")) add("character", "error", `${c} is level ${doc.level}, after the story's ${s.level}`);
  }
  const kinds = Object.values(d.characters).map(c => c.kind);
  if (kinds.filter(k => k === "narrator").length !== 1) add("character", "error", "the draft needs exactly one narrator character");
  if (kinds.filter(k => k === "standin").length !== 1) add("character", "error", "the draft needs exactly one stand-in character");

  // counts
  const special = s.kind === "special";
  const nWords = (s.words ?? []).length, [wMin, wMax] = special ? [10, 12] : [5, 8];
  if (nWords < wMin || nWords > wMax) add("counts", "error", `${nWords} target words; a${special ? " special" : "n episode"} has ${wMin}-${wMax}`);
  const choices = s.steps.filter(isChoice).length;
  if (special ? choices !== 2 : choices < 1 || choices > 2) add("counts", "error", `${choices} choices; ${special ? "a special has 2" : "an episode has 1-2"}`);
  const spots = s.steps.filter(isSpot).length;
  if (special ? spots < 1 || spots > 2 : spots !== 1) add("counts", "error", `${spots} grammar spots; ${special ? "a special has 1-2" : "an episode has 1"}`);
  const lines = s.steps.filter(isLine).length, size = LINES[s.level ?? "A1"]?.[s.kind ?? "episode"];
  if (size && (lines < size[0] || lines > size[1])) add("counts", "warning", `${lines} lines; ${s.level} ${s.kind}s have ${size[0]}-${size[1]} (proposed)`);
  const acts = s.steps.filter(isAct).length;
  if (acts > 2 && day && day.week >= 2) add("counts", "warning", `${acts} acts; at most 2 from week 2 (Kumru's STORIES_STAGE.md §5, proposed)`);
  const ids = s.steps.filter(isChoice).map(c => c.choice.id);
  for (const cid of ids) if (ids.indexOf(cid) !== ids.lastIndexOf(cid)) add("counts", "error", `choice id ${cid} is used twice`);

  // flags set by this story
  for (const op of flagOptions(s)) if (!op.sets!.startsWith(`${id}_`)) add("flags", "error", `flag ${op.sets} must be named ${id}_<slug>`, op.step);

  // quiz
  const quiz = s.quiz ?? [];
  if (!quiz.some((q: { kind?: string }) => q.kind === "comp") || !quiz.some((q: { kind?: string }) => q.kind === "word")) add("quiz", "error", "the quiz needs at least one comp and one word item");
  const haystack = all.map(t => norm(t.tr)).join(" | ");
  (quiz as { why?: string }[]).forEach((q, k) => {
    const quoted = [...(q.why ?? "").matchAll(/[“"]([^”"]+)[”"]/g)].map(m => m[1]);
    if (!quoted.length) add("quiz", "warning", `quiz item ${k + 1}: why quotes no line`);
    for (const t of quoted) if (!haystack.includes(norm(t))) add("quiz", "error", `quiz item ${k + 1}: “${t}” is not a line of the story`);
  });

  // spot examples are lines of the story
  s.steps.forEach((st, i) => { if (isSpot(st) && !haystack.includes(norm(st.spot.ex))) add("ref", "error", `spot example “${st.spot.ex}” is not a line of the story`, i); });

  // mistake.fix is used within 3 lines
  const ls = s.steps.map((st, i) => [st, i] as const).filter(([st]) => isLine(st)) as [LineStep, number][];
  ls.forEach(([l, i], k) => {
    if (!l.mistake) return;
    const next = ls.slice(k + 1, k + 4).map(([x]) => norm(x.tr));
    if (!next.some(t => t.includes(norm(l.mistake!.fix)))) add("mistake", "error", `the fix “${l.mistake.fix}” is not used in the next 3 lines`, i);
  });

  // text: the language-neutral stand-in, glossed names, unknown tokens
  for (const t of all) {
    if (t.who === STANDIN && /İran|Farsça|[؀-ۿ]/.test(t.tr)) add("text", "warning", `a stand-in line names a country or language: “${t.tr}”`, t.step);
    if (/Kırlangıç/.test(t.tr) && !s.gl?.["kırlangıç"]) add("text", "warning", "Kırlangıç is used but not glossed in gl", t.step);
  }
  const glKeys = Object.keys(s.gl ?? {});
  // unknown tokens and the known-word ratio need a dictionary: the cards (or the syllabus)
  const dictionary = !!world.cards || !!world.syllabus;
  const resolves: Resolver = resolver([...Object.values(world.cards ?? {}).map(c => c.tr), ...glKeys, ...nameWords(d, world, s), ...Object.values(d.characters).map(c => c.name), ...(world.syllabus ? Object.values(world.syllabus.words).map(w => w.tr) : [])]);
  const unknown = new Map<string, number>();
  for (const t of [...all, ...(quiz as { q: string; options: string[] }[]).flatMap(q => [{ tr: q.q, step: -1 }, ...q.options.map(tr => ({ tr, step: -1 }))])]) {
    for (const w of words(t.tr)) if (!resolves(w)) unknown.set(w, (unknown.get(w) ?? 0) + 1);
  }
  if (dictionary && unknown.size) add("text", "error", `${unknown.size} words resolve to no card, gloss or name: ${[...unknown].map(([w, n]) => (n > 1 ? `${w}×${n}` : w)).join(", ")}`);

  // known-word ratio (a warning for now): names, numbers and particles count; glosses do not
  if (day && dictionary) {
    const known = resolver([...Object.values(world.cards ?? {}).filter(c => c.level === "A1" && unitOfRef(c.ref) > 0 && unitOfRef(c.ref) <= unit).map(c => c.tr), ...nameWords(d, world, s), ...(world.syllabus ? Object.values(world.syllabus.words).filter(w => w.unit <= unit).map(w => w.tr) : [])]);
    const toks = all.flatMap(t => words(t.tr));
    const miss = new Map<string, number>();
    for (const w of toks) if (!known(w)) miss.set(w, (miss.get(w) ?? 0) + 1);
    const total = toks.length, missed = [...miss.values()].reduce((a, b) => a + b, 0), ratio = total ? 1 - missed / total : 1;
    const msg = `known words ${(ratio * 100).toFixed(1)}% of ${total} (95% wanted); not known: ${[...miss].map(([w, n]) => (n > 1 ? `${w}×${n}` : w)).join(", ")}`;
    add("words", ratio < 0.95 ? "warning" : "info", msg);
  }

  // the stage lints
  const places = Object.fromEntries(Object.entries(world.places).filter(([k]) => true));
  const missing = [s.place, ...s.steps.filter(isScene).map(x => x.scene)].filter(p => !places[p]);
  for (const p of new Set(missing)) add("place", "error", `place ${p} has no document in places/`);
  if (!missing.length) {
    for (const p of lintStory(s, { places, characters: d.characters, kit: o.kit, solids: o.solids?.[id] })) {
      out.push({ rule: p.rule, level: p.level, story: id, step: p.step, message: p.message });
    }
    if (o.kit) {
      for (const pid of new Set([s.place, ...s.steps.filter(isScene).map(x => x.scene)])) {
        for (const p of lintPlace(world.places[pid], { kit: o.kit, cards: o.cards, needs: o.needs })) if (p.level === "error") add("place", "error", `${pid}: ${p.message}`);
      }
    }
  }
  return out;
}

/** Rules across stories: dates, arcs, flags, characters, albums, recycling. */
export function checkSeason(world: World, drafts: Draft[] = world.drafts, o: CheckOptions = {}): CheckProblem[] {
  const out: CheckProblem[] = [];
  const add = (rule: CheckProblem["rule"], level: CheckProblem["level"], story: string, message: string) => out.push({ rule, level, story, message });
  const byDate = new Map<string, string>();
  const arcs = new Map<string, { id: string; arc: string }>();
  const setBy = new Map<string, Draft>();
  for (const d of drafts) {
    const s = d.story;
    if (s.releaseDate) { const prev = byDate.get(s.releaseDate); if (prev) add("calendar", "error", s.id, `${s.releaseDate} is also ${prev}'s release date`); else byDate.set(s.releaseDate, s.id); }
    if (s.arc) { const k = canonical(s.arc), prev = arcs.get(s.arc.id); if (prev && prev.arc !== k) add("calendar", "error", s.id, `arc ${s.arc.id} differs from ${prev.id}'s`); else if (!prev) arcs.set(s.arc.id, { id: s.id, arc: k }); }
    for (const op of flagOptions(s)) setBy.set(op.sets!, d);
  }
  // callbacks name a flag an earlier story set; a story's date is the calendar's, or without one its own releaseDate
  const dateOf = (sid: string): string | undefined => world.days ? world.days[sid]?.date : [...drafts, ...world.drafts].find(x => x.story.id === sid)?.story.releaseDate;
  for (const d of drafts) {
    const flags = new Set<string>();
    const walk = (x: unknown) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { const g = x as { if?: unknown; unless?: unknown }; for (const k of ["if", "unless"] as const) if (typeof g[k] === "string") flags.add(g[k] as string); Object.values(x).forEach(walk); } };
    walk(d.story.steps); walk(d.story.followUp);
    for (const f of flags) {
      const owner = setBy.get(f), ownerId = /^(s\d+e\d+)_/.exec(f)?.[1];
      if (owner) { if ((owner.story.releaseDate ?? "") >= (d.story.releaseDate ?? "")) add("flags", "error", d.story.id, `flag ${f} is set by ${owner.story.id}, which is not earlier`); }
      else if (!ownerId || !dateOf(ownerId)) add("flags", "error", d.story.id, `flag ${f} names no story`);
      else if (dateOf(ownerId)! >= (d.story.releaseDate ?? "")) add("flags", "error", d.story.id, `flag ${f} belongs to ${ownerId}, which is not earlier`);
      // the story the flag names is written and sets no such flag (one not written yet may still set it)
      else {
        const named = [...drafts, ...world.drafts].find(x => x.story.id === ownerId);
        const sets = (x: Draft) => flagOptions(x.story).some(op => op.sets === f);
        if (named && !sets(named)) add("flags", "error", d.story.id, `flag ${f} is never set: ${ownerId} sets no such flag`);
      }
    }
  }
  // characters come from the roster and the extras only (world.ts charactersOf): the roster's documents, for the album
  const docs = new Map<string, CharacterDoc>(Object.entries(world.cast ?? {}));
  const seen = new Map<string, number>();
  for (const d of drafts) for (const c of new Set([...d.story.cast, ...(d.story.extras ?? [])])) seen.set(c, (seen.get(c) ?? 0) + 1);
  // the album is Kerim's and shows the people the learner met: not the stand-in (the learner) or the narrator (Kumru's STORIES_SCHEMA.md §4.8)
  const NO_ALBUM = new Set(["extra", "standin", "narrator"]);
  for (const [c, n] of seen) if (n >= 3 && !docs.get(c)?.album && !world.extras?.[c] && !NO_ALBUM.has(docs.get(c)?.kind as string)) add("character", "warning", "season", `${c} is in ${n} stories but has no album entry`);

  // recycling: forward (a warning once the next stories exist) and backward (a report)
  const days = o.recycleDays ?? 14;
  const uses = (d: Draft, card: string): boolean => {
    const c = world.cards?.[card];
    if (!c) return false;
    const r = resolver([c.tr], { particles: false });
    return texts(d.story).some(t => words(t.tr).some(r));
  };
  for (const d of drafts) {
    const date = d.story.releaseDate;
    if (!date) continue;
    const later = Object.values(world.days ?? {}).filter(x => x.date > date && x.date <= addDays(date, days));
    const have = later.map(x => drafts.find(e => e.story.id === x.id)).filter((e): e is Draft => !!e);
    if (later.length && have.length === later.length) {
      const lacking = (d.story.words ?? []).filter(w => have.filter(e => uses(e, w)).length < 2);
      if (lacking.length) add("recycle", "warning", d.story.id, `target words used in fewer than 2 of the next ${later.length} stories (${days} days): ${lacking.map(w => world.cards?.[w]?.tr ?? w).join(", ")}`);
    }
    const before = drafts.filter(e => e.story.releaseDate && e.story.releaseDate < date && e.story.releaseDate >= addDays(date, -days));
    if (before.length) {
      const reused = before.flatMap(e => (e.story.words ?? []).filter(w => uses(d, w)));
      add("recycle", "info", d.story.id, `reuses ${new Set(reused).size} target words of the previous ${days} days (${before.map(e => e.story.id).join(", ")})`);
    }
  }
  // season-wide choice kinds
  const kinds: Record<string, number> = {};
  for (const d of drafts) for (const st of d.story.steps) if (isChoice(st)) kinds[st.choice.kind ?? "polite"] = (kinds[st.choice.kind ?? "polite"] ?? 0) + 1;
  if (Object.keys(kinds).length) add("counts", "info", "season", `choice kinds: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(", ")} (a third each wanted over the season)`);
  return out;
}

/**
 * The series and its seasons: each document against its schema and its file name, the narrator and the
 * stand-in, every story's season, the calendar both ways (a row for every story of a season that has one, a
 * story for every row) and against days.json when the root still has one, and each story's arc against its
 * season's. Without series.json, one warning (the root predates series).
 */
export function checkSeries(world: World): CheckProblem[] {
  const out: CheckProblem[] = [];
  const add = (level: CheckProblem["level"], story: string, message: string, rule: CheckRule = "series") => out.push({ rule, level, story, message });
  const schema = (kind: SchemaKind, doc: unknown, at: string) => { for (const p of validateDoc(kind, doc)) add("error", at, `${p.path}: ${p.message}`, "schema"); };
  const sr = world.series;
  if (!sr) add("warning", "series", "the content root has no series.json: add one, with a seasons/s<n>.json per season");
  else {
    schema("series", sr, "series");
    for (const [role, id, kind, stage] of [["narrator", sr.narrator, "narrator", NARRATOR], ["stand-in", sr.standin, "standin", STANDIN]] as const) {
      const c = world.cast[id];
      if (!c) add("error", "series", `the ${role} ${id} has no character document`);
      else if (c.kind !== kind) add("error", "series", `the ${role} ${id} is a ${c.kind}, not a ${kind}`);
      if (id !== stage) add("error", "series", `the stage casts ${stage} as the ${role}; another ${role} is not supported yet`);
    }
  }
  for (const [file, se] of Object.entries(world.seasons)) {
    const at = `season:${file}`;
    schema("season", se, at);
    if (se.id !== file) add("error", at, `the file is ${file} but the season's id is ${se.id}`);
    if (se.n !== Number(file.slice(1))) add("error", at, `n is ${se.n} but the file is ${file}`);
    for (const id of Object.keys(se.calendar ?? {})) if (seasonOf(id) !== se.n) add("error", at, `the calendar names ${id}, a story of another season`);
    for (const id of Object.keys(se.arcs ?? {})) if (!id.startsWith(`s${se.n}w`)) add("error", at, `arc ${id} belongs to another season`);
    const episodes = world.drafts.filter(d => seasonOf(d.id) === se.n);
    if (!episodes.length) add("warning", at, "the season has no episodes yet");
    if (se.calendar) {
      for (const d of episodes) if (!se.calendar[d.id]) add("error", d.id, `${d.id} has no row in season ${file}'s calendar`, "calendar");
      for (const id of Object.keys(se.calendar)) if (!world.drafts.some(d => d.id === id)) add("warning", at, `the calendar has ${id}, which is not written yet`, "calendar");
    }
    for (const d of episodes) {
      const a = d.story.arc;
      if (!a || !se.arcs) continue;
      const want = se.arcs[a.id];
      if (!want) add("error", d.id, `arc ${a.id} is not one of season ${file}'s arcs`, "calendar");
      else if (canonical({ tr: a.tr, en: a.en, fa: a.fa, mechanics: a.mechanics }) !== canonical({ tr: want.tr, en: want.en, fa: want.fa, mechanics: want.mechanics })) add("error", d.id, `arc ${a.id} differs from season ${file}'s`, "calendar");
    }
  }
  if (world.series) for (const d of world.drafts) { const n = seasonOf(d.id); if (n && !world.seasons[`s${n}`]) add("error", d.id, `season s${n} has no document in seasons/`); }
  // days.json, where an app still writes it beside the seasons' calendars, follows them: the seasons are the source, so a
  // difference is days.json to regenerate (a warning; the app's own generator check is its gate)
  if (world.daysFile && Object.values(world.seasons).some(se => se.calendar)) {
    const stale = (id: string, why: string) => add("warning", id, `days.json is behind the season's calendar (${why}): regenerate it from the seasons`, "calendar");
    for (const [id, d] of Object.entries(world.days ?? {})) {
      const f = world.daysFile[id];
      if (!f) stale(id, `no ${id}`);
      else if (f.date !== d.date || f.kind !== d.kind || f.week !== d.week) stale(id, `${f.date} ${f.kind} week ${f.week}, the season ${d.date} ${d.kind} week ${d.week}`);
    }
    for (const id of Object.keys(world.daysFile)) if (!world.days?.[id]) stale(id, `${id} is in no season's calendar`);
  }
  return out;
}

/** Place documents against their schema. */
export function checkPlaces(world: World): CheckProblem[] {
  const out: CheckProblem[] = [];
  for (const [id, p] of Object.entries(world.places)) for (const e of validateDoc("place", p)) out.push({ rule: "schema", level: "error", story: `place:${id}`, message: `${e.path}: ${e.message}` });
  return out;
}

/** Notes of `compose` that mean a cast document is wrong; `hidden` and `clipped` are normal (a headscarf hides hair). */
const BAD_NOTES = new Set(["unknown", "slot", "build", "replaced", "size"]);
const utf8 = (s: string) => new TextEncoder().encode(s).length;
const isKit = (k: unknown): k is Kit => !!k && typeof (k as Kit).body === "function" && !!(k as Kit).parts;

/** `#rrggbb` in either case, as normalize writes it (upper case). */
const HEX6 = /^#[0-9a-f]{6}$/i;
const upHex = (v: unknown) => (typeof v === "string" && HEX6.test(v) ? v.toUpperCase() : v);
const AVATAR_KEYS = new Set(["v", "kit", "body", "skin", "face", "hair", "facialHair", "outfit", "wear", "carry", "hold", "custom"]);
const FACE_FIELDS = ["shape", "eyes", "eyeColor", "brows", "nose", "mouth", "ears"] as const;

/**
 * What a document means, flat (path → JSON), with every default written out, so a raw document and its
 * normalized copy compare equal unless `normalize` changed or dropped something: an unknown face value,
 * a colour the palette lacks, a pattern the part does not take, a key the format does not have. Each
 * entry also names the field it belongs to (for a garment its field, `outfit.top`), so changes a note
 * already explains (size, replaced, unknown part…) can be left to that note.
 */
function meaning(doc: Record<string, any>, kit: Kit): Map<string, [string, string]> {
  const out = new Map<string, [string, string]>(), F = kit.features as Record<string, { default?: string | null; values: string[] }>, D = kit.defaultDoc as unknown as Record<string, any>;
  const put = (path: string, v: unknown, field = path) => out.set(path, [field, JSON.stringify(v ?? null)]);
  for (const k of Object.keys(doc)) if (!AVATAR_KEYS.has(k)) put(k, doc[k]);
  put("v", doc.v); put("kit", doc.kit);
  for (const k of ["build", "height", "shape"]) put(`body.${k}`, doc.body?.[k] ?? D.body[k]);
  for (const k of Object.keys(doc.body ?? {})) if (!["build", "height", "shape"].includes(k)) put(`body.${k}`, doc.body[k]);
  put("skin", upHex(doc.skin ?? D.skin));
  for (const k of FACE_FIELDS) put(`face.${k}`, doc.face?.[k] ?? F[`face.${k}`]?.default);
  put("face.marks", [...new Set<string>(doc.face?.marks ?? [])].sort());
  for (const k of Object.keys(doc.face ?? {})) if (!(FACE_FIELDS as readonly string[]).includes(k) && k !== "marks") put(`face.${k}`, doc.face[k]);
  put("hair.color", upHex(doc.hair?.color ?? D.hair.color));
  put("facialHair", doc.facialHair ? { style: doc.facialHair.style, color: upHex(doc.facialHair.color) ?? null } : null);
  const garment = (field: string, raw: unknown) => {
    const g = (typeof raw === "string" ? { id: raw } : raw) as Record<string, any> | null | undefined;
    if (!g) return put(field, null);
    const part = kit.parts[g.id];
    put(field, g.id);
    for (const k of Object.keys(g)) if (!["id", "colors", "pattern", "inks", "side"].includes(k)) put(`${field}.${k}`, g[k], field);
    const n = Math.max(part?.colors ?? 0, g.colors?.length ?? 0), cols: unknown[] = [];
    for (let i = 0; i < n; i++) cols.push(upHex(g.colors?.[i] ?? part?.defaults?.[i] ?? null));
    put(`${field}.colors`, cols, field);
    put(`${field}.pattern`, g.pattern ?? null, field);
    put(`${field}.inks`, (g.inks ?? []).map(upHex), field);
    put(`${field}.side`, g.side ?? part?.sides?.default ?? null, field);
  };
  const at = (path: string) => path.split(".").reduce<any>((o, k) => o?.[k], doc);
  for (const g of GARMENT_FIELDS) garment(g.field, at(g.field));
  for (const group of ["outfit", "wear"]) for (const k of Object.keys(doc[group] ?? {})) if (!GARMENT_FIELDS.some(g => g.field === `${group}.${k}`)) put(`${group}.${k}`, doc[group][k]);
  (Array.isArray(doc.custom) ? doc.custom : []).forEach((c: unknown, i: number) => garment(`custom.${i}`, c));
  return out;
}

/** What `normalize` (trusted) changes or drops in a document, beyond what its notes already say: [] when nothing. */
export function normalizeChanges(doc: AvatarDoc, kit: Kit): string[] {
  const notes: AvatarNote[] = [], n = normalize(doc, kit, { trusted: true, notes });
  if (!n) return ["normalize refuses the whole document"];
  const noted = new Set(notes.map(x => x.field)), a = meaning(doc as unknown as Record<string, any>, kit), b = meaning(n as unknown as Record<string, any>, kit), out: string[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const field = (a.get(k) ?? b.get(k)!)[0], was = a.get(k)?.[1] ?? "null", now = b.get(k)?.[1] ?? "(dropped)";
    if (!noted.has(field) && was !== now) out.push(`${k} ${was} becomes ${now}`);
  }
  return out;
}

/** The checks every character document gets, roster or extra: schema, id = file and not retired, a puppet the kit has, and each look's size, parts and values. */
function checkCharacter(file: string, c: CharacterDoc, kit: Kit | null, puppetNames: Set<string>, add: (level: CheckProblem["level"], message: string, rule?: CheckRule) => void) {
  for (const p of validateDoc("character", c)) add("error", `${p.path}: ${p.message}`, "schema");
  if (c.id !== file) add("error", `the file is characters/${file}.json but the id is ${c.id}`);
  if (RETIRED_CHARACTERS.has(file)) add("error", `${file} is a retired character id`);
  if (c.puppet !== undefined && !puppetNames.has(c.puppet)) add("error", `puppet ${c.puppet} is not a kit puppet (${[...puppetNames].join(", ") || "none loaded"})`);
  if (!c.avatar) return;
  const looks: [string, AvatarDoc][] = [["avatar", c.avatar], ...Object.entries(c.outfits ?? {}).map(([n, l]): [string, AvatarDoc] => [`outfit ${n}`, applyLook(c.avatar!, l)])];
  for (const [what, doc] of looks) {
    const size = utf8(serialize(doc));
    if (size > AVATAR_MAX_BYTES) add("error", `${what} is ${size} bytes; the cap is ${AVATAR_MAX_BYTES}`);
    if (!kit) continue;
    const bad = compose(doc, kit, { trusted: true }).notes.filter(n => BAD_NOTES.has(n.why));
    if (bad.length) add("error", `${what}: ${bad.map(n => `${n.field}${n.id ? ` ${n.id}` : ""} ${n.why}${n.by ? ` by ${n.by}` : ""}`).join("; ")}`);
    const changed = normalizeChanges(doc, kit);
    if (changed.length) add("error", `${what}: normalize changes ${changed.join("; ")}`);
  }
}

/**
 * The characters (`characters/<id>.json`, CHARACTERS in paths.ts): the cast roster and the
 * generic extras (`kind: "extra"`, written by cast/extras.ts), in one folder, told apart by `kind`. Each
 * document against its schema, its id against its file name and never a retired id, `order` unique;
 * an avatar's raw size (and each outfit's, applied) within AVATAR_MAX_BYTES, measured before
 * `normalize`, which trims to fit; with a whole kit, the avatar and each outfit composed with no part
 * refused, replaced or dropped, and with no value `normalize` would change or drop (a colour the palette
 * lacks, a pattern the part does not take, an unknown face value); a puppet one the kit (or Kerim's
 * module) provides. An extra's `order` is at least 100.
 */
export function checkCast(world: World, o: CheckOptions = {}): CheckProblem[] {
  const out: CheckProblem[] = [];
  const kit = isKit(o.kit) ? o.kit : null;
  const puppetNames = new Set([...Object.keys(kit?.puppets ?? {}), ...(o.puppets ?? [...Object.keys(KERIM_PUPPETS), ...Object.keys(ANIMAL_PUPPETS)])]);
  const orders = new Map<number, string>();
  const order = (c: CharacterDoc, who: string, add: (level: CheckProblem["level"], message: string) => void) => {
    const n = c.order as number | undefined;
    if (typeof n === "number") { const prev = orders.get(n); if (prev) add("error", `order ${n} is also ${prev}'s`); else orders.set(n, who); }
  };
  for (const [file, c] of Object.entries(world.cast ?? {})) {
    const add = (level: CheckProblem["level"], message: string, rule: CheckRule = "character") => out.push({ rule, level, story: `cast:${file}`, message });
    checkCharacter(file, c, kit, puppetNames, add);
    order(c, file, add);
  }
  for (const [file, raw] of Object.entries(world.extras ?? {})) {
    const add = (level: CheckProblem["level"], message: string, rule: CheckRule = "character") => out.push({ rule, level, story: `extra:${file}`, message });
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { add("error", "not a character document"); continue; }
    const c = raw as CharacterDoc;
    checkCharacter(file, c, kit, puppetNames, add);
    order(c, file, add);
    if (c.kind !== "extra") add("error", `kind is ${c.kind}; an extra's is extra`);
    if (typeof c.order === "number" && c.order < 100) add("error", `order ${c.order}; an extra's is 100 or more, after the cast`);
    if (world.cast?.[file]) add("error", `${file} is both a roster character and an extra`);
  }
  return out;
}

export function checkAll(world: World, o: CheckOptions = {}): CheckProblem[] {
  return [...checkPlaces(world), ...checkCast(world, o), ...world.drafts.flatMap(d => checkStory(d, world, o)), ...checkSeason(world, world.drafts, o)];
}
