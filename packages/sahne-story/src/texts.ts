// The languages of a series and its texts. A series names one main language (the one the stage plays and the learner
// learns) and its translations (`series.json` `languages`; without it, Turkish with English and Persian). A text in
// every language is a map by language code (`{ "tr": "Portakal var mı?", "en": "…", "fa": "…" }`): a title, a summary,
// a character's name, role and bio, a quiz question, a gloss. A line, a choice's option, an act's prompt and an arc keep
// their language keys flat beside their other fields (`{ "who": "nima", "tr": "…", "en": "…", "fa": "…" }`), so a
// language code may never be one of a step's own keys (`STEP_KEYS`).

/** Language code → text. */
export type LangText = Record<string, string>;

/** The series' languages: the main one, then its translations. */
export interface Languages { main: string; translations: string[] }

/** A series without `languages` (every root before them): Turkish, with English and Persian. */
export const DEFAULT_LANGUAGES: Languages = { main: "tr", translations: ["en", "fa"] };

/** The languages a series declares, or the default. */
export const languagesOf = (series?: { languages?: Languages } | null): Languages => series?.languages ?? DEFAULT_LANGUAGES;

/** Every language of a series, the main one first. */
export const allLanguages = (l: Languages): string[] => [l.main, ...l.translations];

/** A language code as the series writes it: a 2–3 letter primary tag, with optional subtags (`pt-BR`). */
export const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

const RTL = new Set(["ar", "fa", "he", "ur", "ps", "sd", "ug", "yi", "dv", "ckb", "ku"]);
/** The writing direction of a language. */
export const dirOf = (lang: string): "rtl" | "ltr" => (RTL.has(lang.split("-")[0]) ? "rtl" : "ltr");

/**
 * The text of something in a language: a map's entry, else (for a plain string, as a document may still hold one) the
 * string itself when `lang` is `main` or no main is given. Undefined when there is none.
 */
export function textIn(t: unknown, lang: string, main?: string): string | undefined {
  if (typeof t === "string") return main === undefined || lang === main ? t : undefined;
  if (t && typeof t === "object" && !Array.isArray(t)) {
    const v = (t as Record<string, unknown>)[lang];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

/** The text in the first of `langs` that has one (a plain string counts for any). */
export function textOf(t: unknown, ...langs: string[]): string | undefined {
  if (typeof t === "string") return t;
  for (const l of langs) { const v = textIn(t, l); if (v) return v; }
  if (t && typeof t === "object" && !Array.isArray(t)) return Object.values(t as Record<string, unknown>).find((v): v is string => typeof v === "string");
  return undefined;
}

/** A step's own keys (a line's, an option's, a beat's, an act's and an arc's): no language code may be one. */
export const STEP_KEYS: readonly string[] = [
  "who", "narr", "note", "looks", "mistake", "of", "if", "unless", "id", "mechanics", "ok", "tone", "sets", "warm", "reply", "kind",
  "to", "emo", "do", "at", "n", "loop", "move", "obj", "link", "react", "cam", "via", "voice", "sfx", "env", "frame", "tempo", "on", "costume",
];
