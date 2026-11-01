// The Translate stage of an episode: the series' main language beside one translation, a line at a time, each with its
// check. A tab for each language the series has (from its settings, with how far along each is); the main language is
// read-only here, and a translation's check holds until its line changes. A translator's link opens a language straight
// away (#/episode/<id>/translate/<lang>); the comments left for the translator are under the lines.

import { html } from "htm/preact";
import { textOf, type StoryDoc } from "sahne-story";
import { get, set, type Path } from "../../model/path.ts";
import { blocks } from "../../model/script.ts";
import { checkedOf, rowKey, sigAt } from "../../model/review.ts";
import type { LangProgress } from "../../model/progress.ts";
import { review, say, world } from "../../store.ts";
import { markStep } from "../review.ts";
import { inLang, langName, useLangs } from "../lang.ts";

interface Props {
  id: string; story: StoryDoc; selected: Path | null; lang: string; langs: LangProgress[];
  setLang(l: string): void; select(path: Path, focus?: boolean): void; edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void;
  /** Open the series' settings (where its languages are set). */
  onSettings(): void;
}

/** A row of the Translate stage: a block with words, and where its words are (a plugin's step holds them one level down). */
function rowsOf(story: StoryDoc, main: string): { path: Path; at: Path; who?: string }[] {
  const out: { path: Path; at: Path; who?: string }[] = [];
  for (const b of blocks(story)) {
    if (b.kind === "scene" || b.kind === "action" || b.kind === "choice" || b.kind === "act") continue;
    const at = b.kind === "line" || b.kind === "option" ? b.path : [...b.path, b.kind];
    const v = get(story, at) as Record<string, unknown> | undefined;
    if (typeof v?.[main] === "string" && (v[main] as string).trim()) out.push({ path: b.path, at, who: b.kind === "option" ? world.value?.series?.standin : b.who ?? (b.kind === "line" ? undefined : world.value?.series?.narrator) });
  }
  return out;
}

export function Translate(p: Props) {
  const w = world.value!, langs = useLangs(), main = langs.main;
  const name = (id?: string) => (id ? textOf(w.characters[id]?.name, main) ?? id : "");
  if (!langs.translations.length) return html`<div class="empty-stage"><p>This series has no translations yet.</p><button class="primary" onClick=${p.onSettings}>Add a language in the series settings</button></div>`;
  const l = langs.translations.includes(p.lang) ? p.lang : langs.translations[0];
  const notes = review.value[p.id]?.steps ?? {};
  const open = (review.value[p.id]?.comments ?? []).filter(c => !c.done);
  const link = `${location.origin}${location.pathname}#/episode/${p.id}/translate/${l}`;
  const copy = () => void navigator.clipboard?.writeText(link).then(() => say("the translator's link is copied"), () => say(link));
  return html`<div class="translate">
    <div class="tr-tabs">
      <span class="segmented" role="tablist" aria-label="The translation">${langs.translations.map(x => { const g = p.langs.find(y => y.lang === x); return html`<button role="tab" aria-selected=${x === l} aria-pressed=${x === l} onClick=${() => p.setLang(x)}>${langName(x)} <small class="note">${g ? `${g.done}/${g.total}` : ""}</small></button>`; })}</span>
      <button class="small quiet" onClick=${p.onSettings} title="The series' languages are set in its settings">+ Add a language</button>
      <span class="grow"></span><button class="small" onClick=${copy} title=${link}>Copy the translator's link</button></div>
    <p class="note from-series">Written in ${langName(main)}, translated into ${langs.translations.map(langName).join(", ")}: every episode of the series has the same languages. <button class="linkish" onClick=${p.onSettings}>Change in the series settings</button></p>
    <div class="tr-grid" role="table" aria-label=${`${langName(main)} and ${langName(l)}`}>
      <div class="tr-head" role="row"><span></span><span role="columnheader">${langName(main)}</span><span role="columnheader">${langName(l)}</span><span></span></div>
      ${rowsOf(p.story, main).map(r => {
        const v = (get(p.story, r.at) ?? {}) as Record<string, unknown>, note = notes[rowKey(r.path)];
        const stale = !!note?.sig && note.sig !== sigAt(p.story, r.path), on = checkedOf(note).includes(l) && !stale;
        const sel = !!p.selected && p.selected.join("/") === r.path.join("/");
        const has = typeof v[l] === "string" && (v[l] as string).trim() !== "";
        return html`<div class=${`tr-row${sel ? " on" : ""}`} role="row" onClick=${(e: MouseEvent) => { if (!(e.target as HTMLElement).closest("textarea,button")) p.select(r.path); }}>
          <span class="gut">${r.path.slice(1).filter(x => typeof x === "number").join(".")}</span>
          <div class="src" ...${inLang(main)}>${r.who && html`<small>${name(r.who)}</small>`}${String(v[main])}</div>
          <textarea ...${inLang(l)} rows=${2} value=${String(v[l] ?? "")} aria-label=${`${langName(l)}: ${String(v[main])}`} placeholder=${`${langName(l)}…`}
            onFocus=${() => p.select(r.path)} onInput=${(e: Event) => p.edit(s => set(s, [...r.at, l], (e.target as HTMLTextAreaElement).value), `${r.at.join(".")}.${l}`)} />
          <button class=${`check${on ? " on" : stale && checkedOf(note).includes(l) ? " stale" : ""}`} aria-pressed=${on} disabled=${!has}
            title=${!has ? `No ${langName(l)} yet` : on ? `${langName(l)} checked` : stale ? "Checked before the line changed: check it again" : `Mark the ${langName(l)} checked`}
            onClick=${() => markStep(p.id, p.story, r.path, l, !on)}>${on ? "✓ Checked" : "Check"}</button></div>`;
      })}
    </div>
    ${open.length > 0 && html`<div class="section-block"><h3>Comments</h3>${open.map(c => html`<div class="comment"><b>${c.by || "Someone"}</b>${c.at ? html` <span class="note">on line ${c.at}</span>` : ""}: ${c.text}</div>`)}</div>`}
  </div>`;
}
