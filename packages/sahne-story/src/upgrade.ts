// The old language shape, upgraded. Before a series named its languages, every root was Turkish with English and
// Persian, and the texts that are not a line's sat in suffixed fields: `title` (Turkish), `titleEn`, `titleFa`; `summary`
// (English, in practice) and `summaryFa`; a character's `name` (Turkish), `nameFa`, `role` and `bio` (English), `roleFa`,
// `bioFa`; a quiz item's `q` (Turkish), `en`, `fa`; a gloss as `[fa, en]`. `upgrade` turns each into a map by language
// (src/texts.ts), by a fixed table per field and nothing guessed; a document in the new shape comes back as it is. Each
// map takes the place of the field it came from, so a file keeps its key order. The story check and the loaders read
// every document through it (check/world.ts), and `convert/languages.ts` writes it to disk.

export type UpgradeKind = "story" | "character" | "series" | "season";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";

/** `{ lang: text }` of the given pairs, leaving out a language with no text. */
const map = (...pairs: [string, unknown][]): Record<string, string> => Object.fromEntries(pairs.filter((p): p is [string, string] => str(p[1])));

/** `doc` with `key` set to `value` in its place (or last), and the `drop` keys removed. */
function replace(doc: Obj, key: string, value: unknown, drop: string[]): Obj {
  const out: Obj = {};
  let put = false;
  for (const [k, v] of Object.entries(doc)) {
    if (drop.includes(k)) { if (!put && !(key in doc)) { out[key] = value; put = true; } continue; }
    if (k === key) { out[key] = value; put = true; continue; }
    out[k] = v;
  }
  if (!put) out[key] = value;
  return out;
}

/** A field and its suffixed translations as one map: `title` + `titleEn` + `titleFa` → `title: { tr, en, fa }`. */
function fold(doc: Obj, key: string, base: string, suffixes: Record<string, string>): Obj {
  const v = doc[key];
  const extra = Object.keys(suffixes).filter(s => `${key}${s}` in doc);
  if (!str(v) && !extra.length) return doc;
  if (isObj(v) && !extra.length) return doc;
  const m = map(...(str(v) ? [[base, v] as [string, unknown]] : Object.entries(isObj(v) ? v : {})), ...Object.entries(suffixes).map(([s, l]) => [l, doc[`${key}${s}`]] as [string, unknown]));
  return replace(doc, key, m, extra.map(s => `${key}${s}`));
}

const TITLE = { En: "en", Fa: "fa" };
const FA = { Fa: "fa" };

/** Whether a document still has the old language shape. */
export const isOldShape = (kind: UpgradeKind, doc: unknown): boolean => upgrade(kind, doc) !== doc;

/** A document in the new language shape (the same object when it already is). */
export function upgrade<T>(kind: UpgradeKind, doc: T): T {
  if (!isObj(doc)) return doc;
  let d: Obj = doc;
  if (kind === "story" || kind === "series" || kind === "season") {
    d = fold(d, "title", "tr", TITLE);
    d = fold(d, "summary", "en", FA);
  }
  if (kind === "story") {
    if (Array.isArray(d.quiz) && d.quiz.some(q => isObj(q) && str(q.q))) {
      d = { ...d, quiz: d.quiz.map(q => (isObj(q) && str(q.q) ? replace(q, "q", map(["tr", q.q], ["en", q.en], ["fa", q.fa]), ["en", "fa"]) : q)) };
    }
    if (isObj(d.gl) && Object.values(d.gl).some(Array.isArray)) {
      d = { ...d, gl: Object.fromEntries(Object.entries(d.gl).map(([w, g]) => [w, Array.isArray(g) ? map(["fa", g[0]], ["en", g[1]]) : g])) };
    }
  }
  if (kind === "character") {
    d = fold(d, "name", "tr", FA);
    d = fold(d, "role", "en", FA);
    d = fold(d, "bio", "en", FA);
  }
  return (d === doc ? doc : d) as T;
}
