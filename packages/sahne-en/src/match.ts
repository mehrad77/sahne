// Whether a word of a line is a form of a `link` token given in its dictionary form: bread, loaves ← loaf,
// went ← go, baking ← bake, children ← child, the baker's ← baker. The forms are the regular ones
// (plural -s -es -ies, possessive 's, verb -s -ed -ing with the e dropped and the consonant doubled)
// and a table of the irregular ones. Derived words are other words: baker is not a form of bake.

import { lowerEn } from "./text.ts";

/** Irregular forms: lemma → its other forms. */
const IRREGULAR: Record<string, string> = {
  // nouns
  child: "children", man: "men", woman: "women", mouse: "mice", foot: "feet", tooth: "teeth", person: "people", goose: "geese", ox: "oxen",
  wolf: "wolves", knife: "knives", leaf: "leaves", life: "lives", loaf: "loaves", shelf: "shelves", half: "halves", thief: "thieves", calf: "calves", wife: "wives", scarf: "scarves",
  sheep: "sheep", fish: "fish fishes", deer: "deer", series: "series", police: "police",
  // verbs
  be: "am is are was were been being", have: "has had having", do: "does did done doing", go: "goes went gone going",
  buy: "bought buys buying", bring: "brought", take: "took taken taking", give: "gave given giving", get: "got gotten getting", make: "made making",
  eat: "ate eaten eating", drink: "drank drunk", see: "saw seen seeing", come: "came coming", say: "said", tell: "told", sell: "sold", pay: "paid",
  leave: "left leaving", find: "found", know: "knew known", think: "thought", write: "wrote written writing", run: "ran running", sit: "sat sitting",
  stand: "stood", speak: "spoke spoken", wear: "wore worn", break: "broke broken", choose: "chose chosen choosing", drive: "drove driven driving",
  ride: "rode ridden riding", sing: "sang sung", swim: "swam swum swimming", begin: "began begun beginning", forget: "forgot forgotten forgetting", meet: "met",
  read: "read", lose: "lost losing", hold: "held", keep: "kept", sleep: "slept", feel: "felt", put: "putting", cut: "cutting", hit: "hitting", let: "letting",
  catch: "caught", teach: "taught", fall: "fell fallen", draw: "drew drawn", grow: "grew grown", throw: "threw thrown", fly: "flew flown flying",
  wake: "woke woken waking", build: "built", send: "sent", spend: "spent", lend: "lent", hang: "hung", dig: "dug digging", win: "won winning",
  steal: "stole stolen", hide: "hid hidden hiding", bite: "bit bitten biting", lead: "led", feed: "fed", hear: "heard", mean: "meant", lie: "lay lying",
  die: "dying", tie: "tying", bake: "baking", ask: "asks asked asking",
};
const IRR = new Map<string, Set<string>>(Object.entries(IRREGULAR).map(([k, v]) => [k, new Set(v.split(" "))]));
/** A form back to its lemmas, so "went" finds "go" and "go" finds "went". */
const LEMMAS = new Map<string, string[]>();
for (const [k, forms] of IRR) for (const f of forms) (LEMMAS.get(f) ?? LEMMAS.set(f, []).get(f)!).push(k);

const V = "aeiou";
const isV = (c: string | undefined) => c !== undefined && V.includes(c);

/** The regular forms of a dictionary word: plural / third person, past, -ing, and the doubled spellings. */
export function forms(t: string): Set<string> {
  const out = new Set<string>([t]);
  const last = t[t.length - 1], pre = t[t.length - 2];
  // -s
  if (/(?:[sxz]|ch|sh)$/.test(t) || (last === "o" && !isV(pre) && t.length > 2)) { out.add(`${t}es`); if (last === "o") out.add(`${t}s`); }
  else if (last === "y" && !isV(pre)) out.add(`${t.slice(0, -1)}ies`);
  else out.add(`${t}s`);
  // -ed, -ing, -d
  const stems: string[] = [];
  if (last === "e") { out.add(`${t}d`); stems.push(t.slice(0, -1)); }
  else if (last === "y" && !isV(pre)) { out.add(`${t.slice(0, -1)}ied`); stems.push(t); }
  else stems.push(t);
  if (t.endsWith("ie")) out.add(`${t.slice(0, -2)}ying`);
  for (const s of stems) { out.add(`${s}ed`); out.add(`${s}ing`); }
  // a consonant after one vowel doubles before -ed / -ing: stop → stopped, begin → beginning, but also open → opened
  if (t.length >= 3 && !isV(last) && !"wxy".includes(last) && isV(pre) && !isV(t[t.length - 3])) {
    out.add(`${t}${last}ed`); out.add(`${t}${last}ing`);
    // and the -er / -est / -y of short words are other words: not added
  }
  // -ing of a word that ends in e keeps ee: see → seeing (the e-drop above would make "seing")
  if (t.endsWith("ee")) { out.delete(`${t.slice(0, -1)}ing`); out.add(`${t}ing`); }
  return out;
}

/** Every form of a dictionary word the plugin knows, regular and irregular: loaf → loaves, go → went, and a form → its lemma's forms. */
export function inflections(t: string): Set<string> {
  const out = forms(t);
  for (const f of IRR.get(t) ?? []) out.add(f);
  for (const l of LEMMAS.get(t) ?? []) { out.add(l); for (const f of forms(l)) out.add(f); for (const f of IRR.get(l) ?? []) out.add(f); }
  return out;
}

const clean = (s: string): string => lowerEn(s).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/** A written word without its possessive: dog's, dogs', the baker's → dog, dogs, baker. */
const bare = (w: string): string => w.replace(/'s$/, "").replace(/(?<=s)'$/, "");

/**
 * Whether `word`, as written in a line, is a form of `token`. Case-insensitive; the possessive 's is ignored.
 * A token of several words ("ice cream") is matched on its last word, the one that takes the endings.
 */
export function match(word: string, token: string): boolean {
  const w = bare(clean(word)), parts = clean(token).split(/[\s-]+/).filter(Boolean);
  if (!w || !parts.length) return false;
  const t = parts[parts.length - 1];
  if (matchOne(w, t)) return true;
  // "ice cream" is also written icecream (the endings go on the last word)
  const head = parts.slice(0, -1).join("");
  return !!head && w.startsWith(head) && w.length > head.length && matchOne(w.slice(head.length), t);
}

function matchOne(w: string, t: string): boolean {
  if (w === t || forms(t).has(w)) return true;
  if (IRR.get(t)?.has(w)) return true;
  // the token is an irregular form itself ("went") and the word its lemma or another form
  for (const l of LEMMAS.get(t) ?? []) if (w === l || forms(l).has(w) || IRR.get(l)?.has(w)) return true;
  // the word is irregular and the token its lemma's regular form ("loaves" ← "loaf")
  return false;
}

/** The demonstrative a word is: this and these (here), that and those (there, pointing). */
export function deixis(word: string): "this" | "these" | "that" | "those" | null {
  const w = clean(word);
  return w === "this" || w === "these" || w === "that" || w === "those" ? w : null;
}

/** Whether a demonstrative points at what is near (this, these) or far (that, those). */
export const isNear = (d: "this" | "these" | "that" | "those"): boolean => d === "this" || d === "these";
