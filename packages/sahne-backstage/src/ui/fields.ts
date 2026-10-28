// The form controls every page edits with: a text field (Turkish, English or Persian: Persian runs right to left), a
// Turkish/English/Persian group for a step's or a title's three texts, a select, a number, a check box, and the problems
// list. Each writes through `onInput` with the value only; the page turns it into an edit of its document.

import { html } from "htm/preact";
import type { ComponentChildren } from "preact";
import { useId } from "preact/hooks";
import type { Problem } from "../api.ts";

export type Lang = "tr" | "en" | "fa";
const LANG_NAME: Record<Lang, string> = { tr: "Turkish", en: "English", fa: "Persian" };

export function Text(p: { label: string; value: unknown; lang?: Lang; multi?: boolean; changed?: boolean; placeholder?: string; onInput(v: string | undefined): void }) {
  const v = typeof p.value === "string" ? p.value : p.value === undefined ? "" : String(p.value);
  const dir = p.lang === "fa" ? "rtl" : "ltr";
  const onInput = (e: Event) => { const t = (e.target as HTMLInputElement).value; p.onInput(t === "" ? undefined : t); };
  const id = useId();
  return html`<div class=${`field${p.changed ? " changed" : ""}`}>
    <label for=${id}>${p.label}</label>
    ${p.multi
      ? html`<textarea id=${id} dir=${dir} lang=${p.lang} rows=${Math.min(6, Math.max(1, Math.ceil(v.length / 60)))} value=${v} placeholder=${p.placeholder} onInput=${onInput} />`
      : html`<input id=${id} dir=${dir} lang=${p.lang} value=${v} placeholder=${p.placeholder} onInput=${onInput} />`}
  </div>`;
}

/** Three texts of one thing: keys default to tr / en / fa (a title's are title / titleEn / titleFa). */
export function Tri(p: { label: string; doc: Record<string, unknown> | undefined; keys?: [string, string, string]; saved?: Record<string, unknown>; multi?: boolean; onInput(key: string, v: string | undefined): void }) {
  const keys = p.keys ?? ["tr", "en", "fa"];
  const langs: Lang[] = ["tr", "en", "fa"];
  return html`<div class="tri">
    ${keys.map((k, i) => html`<${Text} label=${`${p.label} · ${LANG_NAME[langs[i]]}`} lang=${langs[i]} multi=${p.multi} value=${p.doc?.[k]}
      changed=${!!p.saved && p.saved[k] !== p.doc?.[k]} onInput=${(v: string | undefined) => p.onInput(k, v)} />`)}
  </div>`;
}

export function Select(p: { label: string; value: unknown; options: readonly (string | [string, string])[]; none?: string; changed?: boolean; onInput(v: string | undefined): void }) {
  const v = p.value === undefined || p.value === null ? "" : String(p.value);
  const opts = p.options.map(o => (typeof o === "string" ? [o, o] : o));
  const known = !v || opts.some(([x]) => x === v);
  const id = useId();
  return html`<div class=${`field${p.changed ? " changed" : ""}`}>
    <label for=${id}>${p.label}</label>
    <select id=${id} value=${v} onChange=${(e: Event) => { const t = (e.target as HTMLSelectElement).value; p.onInput(t === "" ? undefined : t); }}>
      <option value="">${p.none ?? "—"}</option>
      ${!known && html`<option value=${v}>${v} (not in the list)</option>`}
      ${opts.map(([x, l]) => html`<option value=${x}>${l}</option>`)}
    </select>
  </div>`;
}

export function NumberField(p: { label: string; value: unknown; step?: number; min?: number; max?: number; changed?: boolean; onInput(v: number | undefined): void }) {
  const v = typeof p.value === "number" ? String(p.value) : "";
  const id = useId();
  return html`<div class=${`field${p.changed ? " changed" : ""}`}>
    <label for=${id}>${p.label}</label>
    <input id=${id} type="number" step=${p.step ?? 1} min=${p.min} max=${p.max} value=${v}
      onInput=${(e: Event) => { const t = (e.target as HTMLInputElement).value; p.onInput(t === "" ? undefined : Number(t)); }} />
  </div>`;
}

export function Check(p: { label: string; value: unknown; onInput(v: boolean): void }) {
  return html`<label class="row"><input type="checkbox" style="width:auto" checked=${!!p.value} onChange=${(e: Event) => p.onInput((e.target as HTMLInputElement).checked)} /> ${p.label}</label>`;
}

/** A list of problems, the ones an edit brought first and marked; `onPick` jumps to a problem's step. */
export function Problems(p: { problems: readonly Problem[]; empty?: string; onPick?(pr: Problem): void }) {
  const list = [...p.problems].sort((a, b) => Number(!!b.new) - Number(!!a.new) || rank(a.level) - rank(b.level));
  if (!list.length) return html`<p class="note">${p.empty ?? "No problems."}</p>`;
  return html`<ul class="problems">${list.map(pr => html`<li class=${`${pr.level}${pr.new ? " new" : ""}`} onClick=${() => p.onPick?.(pr)} style=${p.onPick && pr.step !== undefined ? "cursor:pointer" : ""}>
    ${pr.new ? html`<b>new </b>` : ""}${pr.level} · ${pr.rule}${pr.step !== undefined ? ` · step ${pr.step}` : ""}: ${pr.message}</li>`)}</ul>`;
}
const rank = (l: string) => (l === "error" ? 0 : l === "warning" ? 1 : 2);

export const Section = (p: { title: string; children?: ComponentChildren; open?: boolean }) =>
  html`<details class="panel" open=${p.open ?? true} style="margin-top:10px"><summary><b>${p.title}</b></summary><div style="margin-top:8px">${p.children}</div></details>`;
