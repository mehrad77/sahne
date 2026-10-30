// The series' languages in the editor (sahne-story src/texts.ts): the main one and its translations, each named in
// English (`Intl.DisplayNames`) and written in its own direction. `<Texts>` edits one text in every language: a map
// (`title`, `summary`, a character's `name`), or a step's flat keys (`{ who, tr, en, fa }`). The main language is the
// large field; the translations are smaller rows under it.

import { html } from "htm/preact";
import { useId } from "preact/hooks";
import { dirOf, languagesOf, textOf, type Languages } from "sahne-story";
import { world } from "../store.ts";

/** The open series' languages. */
export const useLangs = (): Languages => languagesOf(world.value?.series);

/** The open series' main language: the one the stage plays and its words are in. */
export const mainLang = (): string => languagesOf(world.value?.series).main;

/** A text map (a place's name, a title) in the series' main language, else a translation, else any it has. */
export const inSeries = (t: unknown): string | undefined => { const l = languagesOf(world.value?.series); return textOf(t, l.main, ...l.translations); };

const names = (() => { try { return new Intl.DisplayNames(["en"], { type: "language" }); } catch { return null; } })();
/** A language's English name (`fa` → Persian). */
export const langName = (code: string): string => { try { return names?.of(code) ?? code; } catch { return code; } };

/** `lang` and `dir` attributes for text in a language. */
export const inLang = (code: string) => ({ lang: code, dir: dirOf(code) });

/** One text in the series' languages: the main language large, each translation a row under it. */
export function Texts(p: {
  /** The map, or the step whose flat keys hold the texts. */
  value: Record<string, unknown> | undefined;
  /** The saved one, to mark what changed. */
  saved?: Record<string, unknown> | undefined;
  /** Which languages it needs: all (the default), the main one, or the translations. */
  need?: "all" | "main" | "translations";
  label?: string;
  multi?: boolean;
  placeholder?: string;
  onInput(lang: string, text: string | undefined): void;
}) {
  const l = useLangs(), id = useId();
  const langs = p.need === "main" ? [l.main] : p.need === "translations" ? l.translations : [l.main, ...l.translations];
  const field = (code: string, big: boolean) => {
    const v = p.value?.[code], text = typeof v === "string" ? v : "";
    const changed = !!p.saved && p.saved[code] !== p.value?.[code];
    const onInput = (e: Event) => { const t = (e.target as HTMLInputElement).value; p.onInput(code, t === "" ? undefined : t); };
    const attrs = { ...inLang(code), id: `${id}-${code}`, value: text, placeholder: big ? p.placeholder : `${langName(code)}…`, onInput, "aria-label": `${p.label ?? "Text"} in ${langName(code)}` };
    return html`<div class=${`text-row${big ? " main" : ""}${changed ? " changed" : ""}`}>
      <label class="lang-tag" for=${attrs.id} title=${langName(code)}>${code}</label>
      ${p.multi || big && p.multi !== false && text.length > 60 ? html`<textarea rows=${Math.min(6, Math.max(1, Math.ceil(text.length / 60)))} ...${attrs} />` : html`<input ...${attrs} />`}
      ${!text && html`<span class="missing" title=${`No ${langName(code)} yet`}>·</span>`}
    </div>`;
  };
  return html`<div class="texts" role="group" aria-label=${p.label}>
    ${p.label && html`<div class="texts-label">${p.label}</div>`}
    ${langs.map((code, i) => field(code, i === 0 && p.need !== "translations"))}
  </div>`;
}
