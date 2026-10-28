// A new episode (#/new/<season>), from the brief a story starts from: its id (the season's next free one), release date,
// kind, week and arc, place, cast, target words, lessons and premise, and its titles. It writes a skeleton the story check
// can read (a scene, the lines to write, one choice, one spot, three quiz items, all to fill in) marked `draft: true`, and
// opens it in the episode editor; it is saved, with its row in the season's calendar, only once the check finds no error.
// The word picker reads the cards live from the server; their text is never stored.

import { html } from "htm/preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { SeasonDoc, StoryDoc } from "sahne-story";
import { api } from "../api.ts";
import { set } from "../model/path.ts";
import { change, createDoc, draftOf, go, openDoc, world } from "../store.ts";
import { Select, Text, Tri } from "./fields.ts";
import { skeleton } from "../model/skeleton.ts";

const pad = (n: number) => String(n).padStart(2, "0");

export function NewEpisode(p: { season?: string }) {
  const w = world.value!;
  const se = p.season ? w.seasons[p.season] : undefined;
  const taken = new Set(w.episodes.map(e => e.id));
  const next = useMemo(() => { if (!se) return ""; let k = 1; while (taken.has(`s${se.n}e${pad(k)}`)) k++; return `s${se.n}e${pad(k)}`; }, [se?.n]);
  const [f, setF] = useState<Record<string, any>>({ id: next, kind: "episode", cast: [], words: [], lessons: [], title: "", titleEn: "", titleFa: "", summary: "", summaryFa: "" });
  const [q, setQ] = useState(""), [cards, setCards] = useState<{ id: string; tr: string; en: string }[]>([]);
  const [lessons, setLessons] = useState<{ id: string; ref?: string }[]>([]);
  useEffect(() => { void api.get<{ lessons: { id: string; ref?: string }[] }>("lessons").then(r => setLessons(r.lessons ?? [])); }, []);
  useEffect(() => { if (!w.cards) return; const t = setTimeout(() => void api.get<{ cards: { id: string; tr: string; en: string }[] }>(`cards?q=${encodeURIComponent(q)}`).then(r => setCards(r.cards ?? [])), 250); return () => clearTimeout(t); }, [q]);
  if (!se) return html`<p>No season ${p.season}. <a href="#/">The series</a></p>`;
  const put = (k: string, v: unknown) => setF(x => ({ ...x, [k]: v }));
  const narrator = w.series?.narrator ?? "kerim", standin = w.series?.standin ?? "nima";
  const arcs = Object.entries(se.arcs ?? {});
  const arcId = f.arc ?? arcs[0]?.[0];
  const week = Number(/w(\d+)$/.exec(arcId ?? "")?.[1] ?? 0);
  const people = Object.values(w.characters).filter(c => c.kind === "cast" || c.kind === "extra");
  const cast = f.cast as string[], words = f.words as string[], ls = f.lessons as string[];
  const nWords = f.kind === "special" ? [10, 12] : [5, 8];
  const problems = [
    !/^s[1-9][0-9]?e[0-9]{2}$/.test(f.id) && "the id is s<season>e<NN>",
    taken.has(f.id) && `${f.id} exists already`,
    !f.releaseDate && "a release date",
    !f.place && "a place",
    !cast.length && "at least one of the cast",
    !arcId && "the season has no week yet: add one on the season's page",
    words.length < nWords[0] && `${nWords[0]}–${nWords[1]} target words (${words.length} now)${w.cards ? "" : ": type card ids, comma between"}`,
    !ls.length && "1–3 lessons",
    !f.title && "a Turkish title",
  ].filter(Boolean) as string[];

  const create = async () => {
    // a story still names its level (Kumru's): as the season's other episodes do
    const levels = w.episodes.filter(e => e.season === se.n).map(e => (draftOf("story", e.id)?.doc as StoryDoc | undefined)?.level).filter(Boolean) as string[];
    const level = levels.sort((a, b) => levels.filter(x => x === b).length - levels.filter(x => x === a).length)[0];
    const a = se.arcs?.[arcId!] ?? { tr: "…", en: "…", fa: "…", mechanics: ["say" as const] };
    const doc = skeleton({ id: f.id, season: se.n, releaseDate: f.releaseDate, kind: f.kind, week, arc: { ...a, id: arcId! }, place: f.place, cast, words, lessons: ls,
      title: f.title, titleEn: f.titleEn, titleFa: f.titleFa, summary: f.summary, summaryFa: f.summaryFa, level }, { narrator, standin, places: w.places });
    createDoc("story", f.id, doc);
    // its row in the season's calendar, saved with it
    if (se.calendar) {
      await openDoc("season", se.id);
      change<SeasonDoc>("season", se.id, s => set(s, ["calendar", f.id], { date: f.releaseDate, kind: f.kind, week }));
    }
    go("episode", f.id);
  };

  return html`<section>
    <h2>A new episode of ${se.titleEn}</h2>
    <p class="note">The brief: what the episode is about and what it teaches. The editor then opens a skeleton to write and stage; it is saved once the story check finds no error. It starts as a draft.</p>
    <div class="episode">
      <div class="fields panel">
        <div class="row">
          <div class="grow"><${Text} label="Id" value=${f.id} onInput=${(v: string | undefined) => put("id", v ?? "")} /></div>
          <div class="grow field"><label>Release date</label><input type="date" value=${f.releaseDate ?? ""} onInput=${(e: Event) => put("releaseDate", (e.target as HTMLInputElement).value)} /></div>
          <div class="grow"><${Select} label="Kind" value=${f.kind} options=${[["episode", "episode (Mon–Fri)"], ["special", "special (Sat)"]]} onInput=${(v: string | undefined) => put("kind", v ?? "episode")} /></div>
        </div>
        <${Select} label="Week (its arc)" value=${arcId} options=${arcs.map(([id, a]) => [id, `${id} · ${a.en}`] as [string, string])} onInput=${(v: string | undefined) => put("arc", v)} />
        <${Select} label="Place" value=${f.place} options=${Object.entries(w.places).map(([id, pl]) => [id, `${pl.name?.en ?? id} (${id})`] as [string, string])} onInput=${(v: string | undefined) => put("place", v)} />
        <div class="field"><label>Cast (${w.characters[standin]?.name ?? standin} is always in it)</label>
          <div class="row">${people.filter(c => c.id !== standin && c.id !== narrator).map(c => html`<label class="row"><input type="checkbox" style="width:auto" checked=${cast.includes(c.id)} onChange=${(e: Event) => put("cast", (e.target as HTMLInputElement).checked ? [...cast, c.id] : cast.filter(x => x !== c.id))} /> ${c.name}${c.kind === "extra" ? html` <small class="note">${c.id}</small>` : ""}</label>`)}</div></div>
        <${Tri} label="Title" keys=${["title", "titleEn", "titleFa"]} doc=${f} onInput=${(k: string, v: string | undefined) => put(k, v ?? "")} />
        <${Text} label="Premise · English (becomes the summary)" multi value=${f.summary} onInput=${(v: string | undefined) => put("summary", v ?? "")} />
        <${Text} label="Premise · Persian" lang="fa" multi value=${f.summaryFa} onInput=${(v: string | undefined) => put("summaryFa", v ?? "")} />
      </div>
      <div class="fields">
        <div class="panel fields">
          <b>Target words (${words.length}; ${nWords[0]}–${nWords[1]} for ${f.kind === "special" ? "a special" : "an episode"})</b>
          <div class="row">${words.map(id => html`<span class="chip">${id} <button class="small" aria-label=${`Remove ${id}`} onClick=${() => put("words", words.filter(x => x !== id))}>×</button></span>`)}</div>
          ${w.cards ? html`<input placeholder="search the cards (Turkish or English)" value=${q} aria-label="Search the cards" onInput=${(e: Event) => setQ((e.target as HTMLInputElement).value)} />
            <div style="max-height:200px;overflow:auto">${cards.filter(c => !words.includes(c.id)).map(c => html`<div class="row"><button class="small" onClick=${() => put("words", [...words, c.id])}>+</button><span lang="tr">${c.tr}</span><small class="note">${c.en} · ${c.id}</small></div>`)}</div>`
          : html`<${Text} label="Card ids (this root has no cards: comma between)" value=${words.join(", ")} onInput=${(v: string | undefined) => put("words", [...new Set((v ?? "").split(",").map(s => s.trim()).filter(Boolean))])} />`}
        </div>
        <div class="panel fields">
          <b>Lessons (1–3)</b>
          ${lessons.length ? html`<div style="max-height:160px;overflow:auto">${lessons.map(l => html`<label class="row"><input type="checkbox" style="width:auto" checked=${ls.includes(l.id)} onChange=${(e: Event) => put("lessons", (e.target as HTMLInputElement).checked ? [...ls, l.id].slice(0, 3) : ls.filter(x => x !== l.id))} /> ${l.id}${l.ref ? ` · ${l.ref}` : ""}</label>`)}</div>`
          : html`<${Text} label=${"Lesson ids (this root has no grammar: g_a1_<n>_<slug>, comma between)"} value=${ls.join(", ")} onInput=${(v: string | undefined) => put("lessons", (v ?? "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 3))} />`}
        </div>
        ${problems.length ? html`<p class="note">Still needed: ${problems.join(" · ")}</p>` : ""}
        <div class="row"><span class="grow"></span><button class="primary" disabled=${problems.length > 0 || !!draftOf("story", f.id)} onClick=${() => void create()}>Write the skeleton and open it</button></div>
      </div>
    </div>
  </section>`;
}
