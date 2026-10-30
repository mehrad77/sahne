// English word resolving for the story check: whether a token of a story's text is a form of a card, a name, a particle
// or a number. sahne-en's `inflections` give every regular and irregular form of a dictionary word; the rest of English
// (the small words every line is built from) is the particles.

import { expand, inflections, tokens } from "sahne-en";

export const PARTICLES = new Set((
  "a an the this that these those it its he she we they you i me him her us them my your his our their mine yours hers ours theirs myself yourself himself herself itself ourselves themselves " +
  "am is are was were be been being do does did done doing have has had having will would shall should can could may might must not no yes yeah yep nope ok okay " +
  "and or but so because if then than as of to in on at by for with from about into over under up down out off here there where when what who whom whose which why how " +
  "very too also just only still even all any some many much more most few little lot lots another each every both either neither other such own same " +
  "please thanks thank sorry hello hi hey goodbye bye welcome pardon excuse oh well now let lets us got get go going gonna wanna s t d ll re ve m"
).split(" "));

const NUMBERS = new Set((
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million " +
  "first second third fourth fifth sixth seventh eighth ninth tenth half quarter pound pounds pence penny dollar dollars cent cents euro euros oclock o clock percent point"
).split(" "));

/** The English words of a text, lower-cased, contractions opened (don't → do not), possessives dropped (Nima's → nima), numerals left out. */
export function words(text: string): string[] {
  return tokens(expand(text)).filter(t => t.kind === "word" && !/^[£$€]?\d/.test(t.text)).flatMap(t => t.text.split("-")).map(w => w.replace(/'/g, "")).filter(Boolean);
}

export type Resolver = (token: string) => boolean;

/** A resolver for a list of dictionary forms (cards' English, glosses, names), plus numbers and particles. */
export function resolver(entries: Iterable<string>, opts: { particles?: boolean } = {}): Resolver {
  const known = new Set<string>();
  for (const e of entries) for (const w of words(e)) for (const f of inflections(w)) known.add(f);
  return token => known.has(token) || NUMBERS.has(token) || (opts.particles !== false && PARTICLES.has(token));
}
