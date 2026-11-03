// The form controls every page edits with: a text field (in any language, written in its direction: Persian or Arabic
// right to left), a select, a number, a check box, and the problems list. A text in each of the series' languages is
// `Texts` (lang.ts). Each writes through `onInput` with the value only; the page turns it into an edit of its document.

import { html } from "htm/preact";
import type { ComponentChildren } from "preact";
import { useId } from "preact/hooks";
import { dirOf, languagesOf, textOf } from "sahne-story";
import type { Problem } from "../api.ts";
import { world } from "../store.ts";

/** A text map's entry in `lang`, else in the series' main language, a translation, or any, as a string to show. */
export const tx = (t: unknown, lang?: string): string => {
  const l = languagesOf(world.value?.series);
  return textOf(t, ...(lang ? [lang] : []), l.main, ...l.translations) ?? "";
};

export function Text(p: { label: string; value: unknown; lang?: string; multi?: boolean; changed?: boolean; placeholder?: string; onInput(v: string | undefined): void }) {
  const v = typeof p.value === "string" ? p.value : p.value === undefined ? "" : String(p.value);
  const dir = p.lang ? dirOf(p.lang) : "ltr";
  const onInput = (e: Event) => { const t = (e.target as HTMLInputElement).value; p.onInput(t === "" ? undefined : t); };
  const id = useId();
  return html`<div class=${`field${p.changed ? " changed" : ""}`}>
    <label for=${id}>${p.label}</label>
    ${p.multi
      ? html`<textarea id=${id} dir=${dir} lang=${p.lang} rows=${Math.min(6, Math.max(1, Math.ceil(v.length / 60)))} value=${v} placeholder=${p.placeholder} onInput=${onInput} />`
      : html`<input id=${id} dir=${dir} lang=${p.lang} value=${v} placeholder=${p.placeholder} onInput=${onInput} />`}
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
  const id = useId();
  return html`<div class=${`field${p.changed ? " changed" : ""}`}>
    <label for=${id}>${p.label}</label>
    <${NumberInput} id=${id} value=${p.value} step=${p.step ?? 1} min=${p.min} max=${p.max} onInput=${p.onInput} />
  </div>`;
}

/**
 * A number input on its own. Its value goes in as text, so what is being typed stays as typed ("-" or "1." on the way to
 * "-1.5": the browser reads both as no number, and a value set back would wipe them and move the caret). Only a number
 * is written; an emptied field writes undefined, unless `required` (then it writes nothing until a number is typed).
 */
export function NumberInput(p: { value: unknown; step?: number; min?: number; max?: number; id?: string; style?: string; label?: string; required?: boolean; onInput(v: number | undefined): void }) {
  return html`<input id=${p.id} type="number" step=${p.step} min=${p.min} max=${p.max} style=${p.style} aria-label=${p.label} value=${typeof p.value === "number" ? String(p.value) : ""}
    onInput=${(e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.validity.badInput) return;
      if (t.value === "") { if (!p.required) p.onInput(undefined); return; }
      const v = Number(t.value);
      if (Number.isFinite(v)) p.onInput(v);
    }} />`;
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
