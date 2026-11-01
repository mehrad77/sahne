// The lesson plugin's editor half (sahne-lesson is its story half): what an episode teaches in its head, the quiz after
// it and its glosses (words the cards do not have, glossed in each translation), the grammar spot in the script, a
// line's note for the learner, and the new episode's "What it teaches" step (the target words, read live from the cards,
// whose text is never stored; and its lessons).

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { allLanguages, type StoryDoc } from "sahne-story";
import { lessonOf } from "sahne-lesson";
import { api } from "../../api.ts";
import { get, set } from "../../model/path.ts";
import { blocks } from "../../model/script.ts";
import { world } from "../../store.ts";
import { Icon } from "../kit/index.ts";
import { inLang, langName, Texts, useLangs } from "../lang.ts";
import type { EditorPlugin, EpisodeProps } from "./types.ts";

/** What it teaches: the target words and lessons, as chips. */
function Head(p: EpisodeProps) {
  const l = lessonOf(p.story);
  return html`<div class="row teaches"><span class="note">Teaches</span>${(l.words ?? []).map(id => html`<span class="chip">${id}</span>`)}
    ${(l.lessons ?? []).map(id => html`<span class="chip ok">${id}</span>`)}</div>`;
}

/** The quiz after the episode. */
function Quiz(p: EpisodeProps) {
  const langs = useLangs(), all = allLanguages(langs);
  const quiz = (lessonOf(p.story).quiz ?? []) as unknown as Record<string, any>[];
  const put = (i: number, path: (string | number)[], v: unknown, field?: string) => p.edit(s => set(s, ["quiz", i, ...path], v), field ?? `quiz.${i}.${path.join(".")}`);
  return html`<div class="section-block"><h3><${Icon} name="review" size=${16} /> The quiz after it</h3>
    ${quiz.map((q, i) => html`<div class="quiz-item">
      <div class="row"><b>Question ${i + 1}</b>
        <select value=${q.kind} aria-label="Kind" onChange=${(e: Event) => put(i, ["kind"], (e.target as HTMLSelectElement).value)}><option value="comp">understanding</option><option value="word">a word</option></select></div>
      <${Texts} label="Question" value=${q.q} onInput=${(l: string, v?: string) => put(i, ["q", l], v ?? "")} />
      ${(q.options ?? []).map((o: string, k: number) => html`<label class=${`option${q.a === k ? " right" : ""}`}>
        <input type="radio" name=${`quiz${i}`} checked=${q.a === k} onChange=${() => put(i, ["a"], k)} aria-label=${`Option ${k + 1} is right`} />
        <input ...${inLang(langs.main)} value=${o} aria-label=${`Option ${k + 1}`} onInput=${(e: Event) => put(i, ["options", k], (e.target as HTMLInputElement).value)} /></label>`)}
      <div class="field"><label>Why (quote the line in “ ”)</label><input ...${inLang(langs.main)} value=${q.why ?? ""} onInput=${(e: Event) => put(i, ["why"], (e.target as HTMLInputElement).value)} /></div>
    </div>`)}
    ${quiz.length < 3 && html`<button onClick=${() => p.edit(s => set(s, ["quiz", quiz.length], { q: Object.fromEntries(all.map(l => [l, ""])), options: ["", "", ""], a: 0, why: "", kind: "comp" }))}>+ a question</button>`}
  </div>`;
}

/** Words the cards do not have, glossed in each translation. */
function Glosses(p: EpisodeProps) {
  const langs = useLangs();
  const [word, setWord] = useState("");
  const gl = Object.entries(lessonOf(p.story).gl ?? {});
  return html`<div class="section-block"><h3><${Icon} name="note" size=${16} /> Glosses: words the cards do not have</h3>
    ${gl.length ? html`<table class="grid"><thead><tr><th ...${inLang(langs.main)}>${langName(langs.main)}</th>${langs.translations.map(l => html`<th>${langName(l)}</th>`)}<th></th></tr></thead><tbody>
      ${gl.map(([w, g]) => html`<tr><td ...${inLang(langs.main)}>${w}</td>
        ${langs.translations.map(l => html`<td><input ...${inLang(l)} value=${g[l] ?? ""} aria-label=${`${w} in ${langName(l)}`} onInput=${(e: Event) => p.edit(s => set(s, ["gl", w, l], (e.target as HTMLInputElement).value), `gl.${w}.${l}`)} /></td>`)}
        <td><button class="iconbtn" aria-label=${`Remove ${w}`} onClick=${() => p.edit(s => set(s, ["gl", w], undefined))}><${Icon} name="trash" size=${15} /></button></td></tr>`)}
    </tbody></table>` : html`<p class="note">None yet.</p>`}
    <form class="row" onSubmit=${(e: Event) => { e.preventDefault(); const w = word.trim().toLocaleLowerCase(langs.main); if (!w) return; p.edit(s => set(s, ["gl", w], Object.fromEntries(langs.translations.map(l => [l, ""])))); setWord(""); }}>
      <input ...${inLang(langs.main)} value=${word} placeholder="a word, lower case" style="max-width:220px" aria-label="A word to gloss" onInput=${(e: Event) => setWord((e.target as HTMLInputElement).value)} /><button>Gloss it</button></form>
  </div>`;
}

/** A grammar spot in the script: the lesson it explains, and the line of the story it explains it on. */
function SpotBlock(p: EpisodeProps & { path: (string | number)[]; keys(e: KeyboardEvent): void; translations(at: (string | number)[]): unknown }) {
  const { main } = useLangs();
  const sp = (get(p.story, [...p.path, "spot"]) ?? {}) as Record<string, unknown>;
  const lines = blocks(p.story).filter(b => b.kind === "line").map(b => String((get(p.story, b.path) as Record<string, unknown>)[main] ?? "")).filter(Boolean);
  return html`<div class="spot-head"><b data-main tabindex="0" onKeyDown=${p.keys}>Grammar spot</b>
    <select value=${String(sp.lesson ?? "")} aria-label="Lesson" onChange=${(e: Event) => p.edit(s => set(s, [...p.path, "spot", "lesson"], (e.target as HTMLSelectElement).value))}>
      ${(lessonOf(p.story).lessons ?? []).map(l => html`<option value=${l}>${l}</option>`)}</select>
    <span class="note">on the line</span>
    <select value=${String(sp.ex ?? "")} ...${inLang(main)} aria-label="The line it points at" onChange=${(e: Event) => p.edit(s => set(s, [...p.path, "spot", "ex"], (e.target as HTMLSelectElement).value))}>
      <option value="">pick a line…</option>${lines.map(t => html`<option value=${t}>${t}</option>`)}</select></div>
    ${p.translations([...p.path, "spot"])}`;
}

/** A line's note for the learner, in the translations. */
function LineFields(p: EpisodeProps & { path: (string | number)[] }) {
  const v = (get(p.story, p.path) ?? {}) as Record<string, unknown>, where = p.path.join(".");
  return html`<${Texts} label="A note for the learner" need="translations" multi value=${v.note} onInput=${(l: string, x?: string) => p.edit(s => {
    const n = { ...((get(s, [...p.path, "note"]) as object) ?? {}), [l]: x } as Record<string, unknown>;
    if (x === undefined) delete n[l];
    return set(s, [...p.path, "note"], Object.keys(n).length ? n : undefined);
  }, `${where}.note.${l}`)} />`;
}

/** How many target words an episode or a special has (sahne-lesson's check). */
const wordsFor = (kind: "episode" | "special") => (kind === "special" ? [10, 12] : [5, 8]);

/** The target words: cards searched live (their text shown, never stored); on a root without cards, ids typed in. */
function Words(p: { value: string[]; onChange(v: string[]): void; want: number[]; special: boolean }) {
  const w = world.value!;
  const [q, setQ] = useState(""), [cards, setCards] = useState<{ id: string; tr: string; en: string }[]>([]);
  const [known, setKnown] = useState<Record<string, { tr: string; en: string }>>({});
  useEffect(() => { if (!w.cards) return; const t = setTimeout(() => void api.get<{ cards: { id: string; tr: string; en: string }[] }>(`cards?q=${encodeURIComponent(q)}`).then(r => setCards(r.cards ?? [])), 250); return () => clearTimeout(t); }, [q]);
  const add = (c: { id: string; tr: string; en: string }) => { setKnown(k => ({ ...k, [c.id]: c })); p.onChange([...p.value, c.id]); };
  return html`<div class="fields">
    <div class="row"><b>Target words</b><span class="note">${p.value.length} of ${p.want[0]}–${p.want[1]} for ${p.special ? "a special" : "an episode"}</span></div>
    <div class="row">${p.value.map(id => html`<span class="chip">${known[id]?.tr ?? id} <button class="small" style="border:0;padding:0 2px" aria-label=${`Remove ${id}`} onClick=${() => p.onChange(p.value.filter(x => x !== id))}>×</button></span>`)}</div>
    ${w.cards ? html`<input type="search" placeholder="search the cards (any language)" value=${q} aria-label="Search the cards" onInput=${(e: Event) => setQ((e.target as HTMLInputElement).value)} />
      <div class="word-list">${cards.filter(c => !p.value.includes(c.id)).map(c => html`<button class="word" onClick=${() => add(c)}><b>${c.tr}</b><small>${c.en}</small></button>`)}</div>`
    : html`<input placeholder="this root has no cards: type card ids, comma between" value=${p.value.join(", ")} aria-label="Card ids" onInput=${(e: Event) => p.onChange([...new Set((e.target as HTMLInputElement).value.split(",").map(s => s.trim()).filter(Boolean))])} />`}
  </div>`;
}

/** One to three lessons: the root's grammar, or ids typed in. */
function Lessons(p: { value: string[]; onChange(v: string[]): void }) {
  const [lessons, setLessons] = useState<{ id: string; ref?: string }[]>([]);
  useEffect(() => { void api.get<{ lessons: { id: string; ref?: string }[] }>("lessons").then(r => setLessons(r.lessons ?? [])); }, []);
  const toggle = (id: string) => p.onChange(p.value.includes(id) ? p.value.filter(x => x !== id) : [...p.value, id].slice(0, 3));
  return html`<div class="fields" style="margin-top:10px">
    <div class="row"><b>Lessons</b><span class="note">1 to 3</span></div>
    ${lessons.length ? html`<div class="row">${lessons.map(l => html`<button class=${`chip${p.value.includes(l.id) ? " on" : ""}`} aria-pressed=${p.value.includes(l.id)} onClick=${() => toggle(l.id)}>${l.id}${l.ref ? ` · ${l.ref}` : ""}</button>`)}</div>`
    : html`<input placeholder="lesson ids (g_a1_<n>_<slug>), comma between" value=${p.value.join(", ")} aria-label="Lesson ids" onInput=${(e: Event) => p.onChange((e.target as HTMLInputElement).value.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3))} />`}
  </div>`;
}

export const lessonEditor: EditorPlugin = {
  id: "lesson",
  standin: "the learner",
  Head,
  Sections: p => html`<${Quiz} ...${p} /><${Glosses} ...${p} />`,
  stage: {
    key: "lesson", name: "Lesson",
    state: ({ story, problems }) => {
      const mine = problems.filter(x => x.plugin === "lesson" && x.level === "error");
      if (!story.steps.length) return { done: false, state: "Nothing yet" };
      return mine.length ? { done: false, state: `${mine.length} problem${mine.length > 1 ? "s" : ""}` } : { done: true, state: "All checks pass" };
    },
  },
  blocks: [{
    kind: "spot",
    name: ["Grammar spot", "the narrator points out a line"],
    template: ({ story, langs }) => ({ spot: { lesson: (lessonOf(story as StoryDoc).lessons ?? [])[0] ?? "", ex: "", ...Object.fromEntries(langs.translations.map(l => [l, ""])) } }),
    View: SpotBlock,
  }],
  LineFields,
  // the brief's fields are the new-episode page's, on the story itself
  Brief: p => { const l = lessonOf(p.story); return html`<${Words} value=${l.words ?? []} onChange=${(v: string[]) => p.edit(s => set(s, ["words"], v), "words")} want=${wordsFor(p.story.kind === "special" ? "special" : "episode")} special=${p.story.kind === "special"} />
    <${Lessons} value=${l.lessons ?? []} onChange=${(v: string[]) => p.edit(s => set(s, ["lessons"], v), "lessons")} />`; },
  newEpisode: {
    title: "What it teaches",
    View: p => html`<${Words} value=${(p.value.words as string[]) ?? []} onChange=${(v: string[]) => p.onChange({ ...p.value, words: v })} want=${wordsFor(p.kind)} special=${p.kind === "special"} />
      <${Lessons} value=${(p.value.lessons as string[]) ?? []} onChange=${(v: string[]) => p.onChange({ ...p.value, lessons: v })} />`,
    wants: (v, kind) => { const n = ((v.words as string[]) ?? []).length, [lo, hi] = wordsFor(kind); return n < lo ? `${lo}–${hi} target words` : null; },
  },
};
