// The parts of an episode around its script: its head (the title and premise in the series' languages, the cast and the
// extras as portraits to add or take away, the target words and lessons it teaches), and after the script, its quiz (each
// question in every language, three options in the main language, the right one, the line its answer quotes) and its
// glosses (a word the cards do not have, with its meaning in each translation).

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { allLanguages, textOf, type StoryDoc } from "sahne-story";
import { set } from "../../model/path.ts";
import { world } from "../../store.ts";
import { portraitOf, Picker } from "../galleries.ts";
import { Icon } from "../kit/index.ts";
import { inLang, langName, Texts, useLangs } from "../lang.ts";

interface Props { story: StoryDoc; saved: StoryDoc; edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void }

export function EpisodeHead(p: Props) {
  const w = world.value!, langs = useLangs();
  const narrator = w.series?.narrator ?? "kerim", standin = w.series?.standin ?? "nima";
  const [pick, setPick] = useState<{ x: number; y: number } | null>(null);
  const cast = p.story.cast ?? [], extras = p.story.extras ?? [];
  const lines = new Map<string, number>();
  JSON.stringify(p.story.steps, (k, v) => { if (k === "who" && typeof v === "string") lines.set(v, (lines.get(v) ?? 0) + 1); return v; });
  const toggle = (id: string) => {
    const extra = w.characters[id]?.kind === "extra", key = extra ? "extras" : "cast", list = extra ? extras : cast;
    p.edit(s => set(s, [key], list.includes(id) ? list.filter(x => x !== id) : [...list, id]));
  };
  const person = (id: string) => {
    const c = w.characters[id], n = lines.get(id) ?? 0;
    return html`<span class="person" title=${`${textOf(c?.name, langs.main) ?? id}${n ? `: ${n} lines` : ""}`}>
      <span class="face" dangerouslySetInnerHTML=${{ __html: portraitOf(c, 40, "head") }}></span>
      <span>${textOf(c?.name, langs.main) ?? id}${n ? html`<small>${n}</small>` : ""}</span>
      ${id !== standin && html`<button aria-label=${`Take ${id} out`} onClick=${() => toggle(id)}>×</button>`}</span>`;
  };
  return html`<div class="ep-head">
    <${Texts} label="Title" value=${p.story.title} saved=${p.saved.title} onInput=${(l: string, v?: string) => p.edit(s => set(s, ["title", l], v ?? ""), `title.${l}`)} />
    <${Texts} label="Premise" need="translations" multi value=${p.story.summary} saved=${p.saved.summary} onInput=${(l: string, v?: string) => p.edit(s => set(s, ["summary", l], v ?? ""), `summary.${l}`)} />
    <div class="field"><label>Who is in it (the cast, 2 to 6; ${textOf(w.characters[narrator]?.name, langs.main) ?? narrator} narrates every episode)</label>
      <div class="people">${cast.map(person)}${extras.map(person)}
        <button class="schip add" onClick=${(e: MouseEvent) => setPick({ x: e.clientX, y: e.clientY })}><${Icon} name="plus" size=${12} /> someone</button></div></div>
    <div class="row teaches"><span class="note">Teaches</span>${(p.story.words ?? []).map(id => html`<span class="chip">${id}</span>`)}
      ${(p.story.lessons ?? []).map(id => html`<span class="chip ok">${id}</span>`)}</div>
    ${pick && html`<${Picker} kind="character" multi x=${pick.x} y=${pick.y} value=${[...cast, ...extras]} ids=${Object.keys(w.characters).filter(id => id !== narrator && id !== standin)} onPick=${toggle} onClose=${() => setPick(null)} />`}
  </div>`;
}

/** The quiz after the episode. */
export function Quiz(p: Props) {
  const langs = useLangs(), all = allLanguages(langs);
  const quiz = (p.story.quiz ?? []) as Record<string, any>[];
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
export function Glosses(p: Props) {
  const langs = useLangs();
  const [word, setWord] = useState("");
  const gl = Object.entries(p.story.gl ?? {});
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
