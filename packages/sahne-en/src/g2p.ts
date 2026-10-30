// English spelling to the sounds that move a mouth. English spelling is not phonetic, so this is a set
// of grapheme rules (digraphs such as th sh ch ph ee oo ou ai igh, the magic e, the silent final e, -ed,
// -es, -le) plus a small table of words the rules get wrong (one, two, the, of, said, people…).
//
// The result is a "respelling" the timing reads: one letter per sound, where
//   a e i o u    the pure vowels (u as in cup is a: the open mouth), @ the unstressed schwa
//   Y W J Q O    the gliding vowels of eye, cow, boy, say, go
//   b c d f g h j k l m n p r s t v w x y z    consonants (c is ch, x is sh; only m b p and f v show on the mouth)
// Every vowel letter is a syllable; every other letter is a consonant.

/** Words whose spelling the rules do not read right, as respelled above. Keys have no apostrophes. */
const EXC: Record<string, string> = {
  // small words
  a: "@", an: "@n", and: "@nd", the: "d@", of: "@v", to: "tu", too: "tu", two: "tu", do: "du", you: "yu", your: "yo", i: "Y", ive: "Yv", id: "Yd", im: "Ym",
  be: "bi", he: "hi", she: "xi", me: "mi", we: "wi", was: "woz", were: "w@", are: "a", or: "o", for: "fo", nor: "no", four: "fo", fourth: "fot", door: "do", floor: "flo", poor: "po", more: "mo", before: "bifo",
  one: "wan", once: "wans", none: "nan", only: "Onli", oh: "O", ok: "OkQ", okay: "OkQ", yeah: "ye@", yay: "yQ", hi: "hY", bye: "bY", goodbye: "gudbY", hello: "h@lO",
  who: "hu", whom: "hum", whose: "huz", what: "wot", where: "we", there: "de", their: "de", they: "dQ", them: "dem", then: "den", these: "diz", those: "dOz", this: "dis", that: "dat", with: "wid", from: "from",
  have: "hav", has: "haz", had: "had", give: "giv", live: "liv", love: "lav", above: "@bav", some: "sam", come: "kam", done: "dan", gone: "gon", does: "daz", said: "sed", says: "sez", again: "@gen", against: "@genst",
  any: "eni", many: "meni", very: "veri", every: "evri", everyone: "evriwan", everything: "evritin", someone: "samwan", anyone: "eniwan", people: "pip@l", word: "wed", work: "wek", world: "weld", worry: "wari", would: "wud", could: "kud", should: "xud",
  put: "put", push: "pux", pull: "pul", full: "ful", bush: "bux", good: "gud", look: "luk", book: "buk", cook: "kuk", foot: "fut", wood: "wud", stood: "stud", took: "tuk", blood: "blad", flood: "flad",
  mother: "mad@", brother: "brad@", other: "ad@", another: "@nad@", father: "fad@", water: "wot@", because: "bikoz", beautiful: "byutiful", beauty: "byuti", evening: "ivnin", hundred: "handr@d", safety: "sQfti", friend: "frend", sure: "xo", sugar: "xug@", piece: "pis", busy: "bizi", build: "bild", building: "bilding", built: "bilt",
  guess: "ges", guest: "gest", guitar: "gita", heart: "hat", heard: "hed", early: "eli", earth: "eth", learn: "len", search: "sec", pearl: "pel", bear: "be", pear: "pe", wear: "we", swear: "swe", great: "grQt", break: "brQk", steak: "stQk",
  head: "hed", bread: "bred", breakfast: "brekf@st", dead: "ded", ready: "redi", heavy: "hevi", health: "helt", weather: "wed@", instead: "insted", idea: "Ydi@", area: "e@ri@", create: "kriQt", being: "biin", going: "gOin", doing: "duin",
  eye: "Y", eyes: "Yz", height: "hYt", quiet: "kwY@t", diet: "dY@t", science: "sY@ns", giant: "jY@nt", client: "klY@nt", million: "milyan", billion: "bilyan", isle: "Yl", wind: "wind", key: "ki", shoe: "xu", tie: "tY", lie: "lY", pie: "pY", die: "dY",
  enough: "inaf", though: "dO", through: "tru", thought: "tot", tough: "taf", rough: "raf", laugh: "laf", cough: "kof", daughter: "dot@", bought: "bot", brought: "brot", caught: "kot", taught: "tot", night: "nYt",
  // contractions, with the apostrophe gone
  dont: "dOnt", cant: "kant", wont: "wOnt", isnt: "iz@nt", arent: "ant", wasnt: "woz@nt", werent: "went", didnt: "did@nt", doesnt: "daz@nt", hasnt: "haz@nt", havent: "hav@nt", hadnt: "had@nt", wouldnt: "wud@nt", couldnt: "kud@nt", shouldnt: "xud@nt",
  youre: "yo", hes: "hiz", shes: "xiz", thats: "dats", theres: "dez", whats: "wots", lets: "lets", youve: "yuv", weve: "wiv", theyre: "de", theyve: "dQv", youll: "yul", theyll: "dQl", whos: "huz", oclock: "@klok",
  // words with a long o that the ow rule would read as cow
  know: "nO", snow: "snO", show: "xO", grow: "grO", low: "lO", slow: "slO", blow: "blO", throw: "trO", flow: "flO", glow: "glO", crow: "krO", own: "On", owe: "O", yellow: "yelO", window: "windO", follow: "folO", below: "bilO", borrow: "borO", tomorrow: "t@morO",
  pillow: "pilO", shadow: "xadO", narrow: "narO", arrow: "arO", rainbow: "rQnbO", elbow: "elbO", mow: "mO", tow: "tO",
};

const isV = (c: string | undefined): boolean => c !== undefined && "aeiou".includes(c);

/** A unit of a parsed word: a consonant sound with its weight (letters it spans), or a vowel. */
type U = { c: string; w: number } | { v: string; single?: boolean; sil?: boolean; ing?: boolean; le?: boolean };

const SUFFIX: [RegExp, (n: number) => U[]][] = [
  [/^[ts]ion$|^cian$/, () => [{ c: "c", w: 2 }, { v: "@" }, { c: "n", w: 1 }]],
  [/^[ct]ious$|^cious$/, () => [{ c: "c", w: 2 }, { v: "@" }, { c: "s", w: 1 }]],
  [/^[ct]ial$/, () => [{ c: "c", w: 2 }, { v: "@" }, { c: "l", w: 1 }]],
  [/^ture$/, () => [{ c: "c", w: 2 }, { v: "@" }]],
  [/^(?:i|e)ous$/, () => [{ v: "i" }, { v: "@" }, { c: "s", w: 1 }]],
  [/^ous$/, () => [{ v: "@" }, { c: "s", w: 1 }]],
  [/^ing$/, () => [{ v: "i", ing: true }, { c: "n", w: 1 }]],
  [/^que$/, () => [{ c: "k", w: 1 }]],
];

/** Parse the letters of a word (no suffix -s or -ed) into consonant and vowel units. */
function parse(b: string): U[] {
  const out: U[] = [], n = b.length;
  const groups = (b.match(/[aeiou]+/g) ?? []).length;
  const cons = (c: string, w = 1) => out.push({ c, w });
  const hasVowel = () => out.some(u => "v" in u && !u.sil);
  let i = 0;
  while (i < n) {
    const rest = b.slice(i), ch = b[i];
    // endings
    if (i > 0) for (const [re, f] of SUFFIX) if (re.test(rest)) { out.push(...f(n)); i = n; break; }
    if (i >= n) break;
    let m: RegExpExecArray | null;
    // silent starts
    if (i === 0 && (m = /^(?:kn|gn|pn|wr|ps|wh)/.exec(rest))) { cons(m[0] === "wr" ? "r" : m[0] === "wh" ? "w" : m[0] === "ps" ? "s" : "n"); i += 2; continue; }
    if (!isV(ch) && ch !== "y" || (ch === "y" && i === 0)) {
      if ((m = /^tch/.exec(rest))) { cons("c", 3); i += 3; continue; }
      if ((m = /^dg(?=e)/.exec(rest))) { cons("j", 2); i += 2; continue; }
      if ((m = /^(?:ch)/.exec(rest))) { cons("c"); i += 2; continue; }
      if ((m = /^sh/.exec(rest))) { cons("x"); i += 2; continue; }
      if ((m = /^th/.exec(rest))) { cons("t"); i += 2; continue; }
      if ((m = /^ph/.exec(rest))) { cons("f"); i += 2; continue; }
      if ((m = /^ck/.exec(rest))) { cons("k", 2); i += 2; continue; }
      if ((m = /^ng/.exec(rest))) { cons("n"); i += 2; continue; }
      if ((m = /^gh/.exec(rest))) { if (i === 0) cons("g"); i += 2; continue; }
      if ((m = /^mb$/.exec(rest))) { cons("m"); i += 2; continue; }
      if ((m = /^gn$/.exec(rest))) { cons("n"); i += 2; continue; }
      if ((m = /^qu/.exec(rest))) { cons("k"); cons("w"); i += 2; continue; }
      if ((m = /^(.)\1/.exec(rest))) { cons(ch === "c" ? "k" : ch, 2); i += 2; continue; }
      if (ch === "c") { cons(/^c[eiy]/.test(rest) ? "s" : "k"); i++; continue; }
      if (ch === "q") { cons("k"); i++; continue; }
      if (ch === "x") { cons("x", 2); i++; continue; }
      cons(ch); i++; continue;
    }
    // the silent final e, and the e of -le
    if (ch === "e" && i === n - 1) {
      const prev = out[out.length - 1];
      if (prev && "c" in prev && hasVowel() && n >= 3) {
        if (n >= 4 && b[n - 2] === "l" && !isV(b[n - 3]) && b[n - 3] !== "l" && "c" in out[out.length - 2]) {
          // table, little, apple: a schwa then l (the l is already placed, so put the schwa before it)
          out.splice(out.length - 1, 0, { v: "@", le: true });
        } else out.push({ v: "", sil: true });
      } else if (prev && "v" in prev && prev.v) out.push({ v: "", sil: true });
      else out.push({ v: "i" });
      i++; continue;
    }
    // silent e in lovely, movement, careless, homesick…
    if (ch === "e" && /^e(?:ly|ment|ness|ful|less|some)/.test(rest) && out.length >= 2 && "c" in out[out.length - 1] && "v" in out[out.length - 2] && (out[out.length - 2] as { single?: boolean }).single) { out.push({ v: "", sil: true }); i++; continue; }

    // vowels, longest team first
    const teams: [RegExp, string][] = [
      [/^eigh/, "Q"], [/^igh/, "Y"], [/^(?:augh|ough)/, "o"],
      [/^ea(?=d|th|lth|ther|vy|sure)/, "e"], [/^(?:ai|ay|ei)/, "Q"],
      [/^(?:ee|ea|ie|ae)/, "i"], [/^(?:oo|ue|ui|eu|ew)/, "u"], [/^(?:oa|oe)/, "O"], [/^(?:oi|oy)/, "J"], [/^(?:au|aw)/, "o"], [/^ou/, "W"], [/^uy/, "Y"],
    ];
    let done = false;
    // ey: they, grey (Q) but monkey, money (i) at the end of a longer word
    if ((m = /^ey/.exec(rest))) { out.push({ v: groups > 1 && i === n - 2 ? "i" : "Q" }); i += 2; continue; }
    // ie at the end: tie, tried (Y) but cookie, movie (i)
    if (/^ie$/.test(rest)) { out.push({ v: hasVowel() ? "i" : "Y" }); i += 2; continue; }
    // ow: cow (W), but the end of a longer word is O (yellow, window) and EXC lists the short ones
    if ((m = /^ow/.exec(rest))) { out.push({ v: i === n - 2 && groups > 1 ? "O" : "W" }); i += 2; continue; }
    for (const [re, code] of teams) if ((m = re.exec(rest))) { out.push({ v: code }); i += m[0].length; done = true; break; }
    if (done) continue;
    // vowel + r
    if ((m = /^([aeiou])r(?![aeiou]|e$)/.exec(rest))) {
      const v = m[1], endOfLonger = i + 2 === n && groups > 1;
      const w = b[i - 1] === "w";
      const code = w && v === "o" && /^or[dklmst]/.test(rest) ? "e" : v === "a" ? (w ? "o" : "a") : v === "o" ? "o" : "e";
      out.push({ v: endOfLonger && "aeo".includes(v) && (v !== "a" || true) ? "@" : code });
      cons("r"); i += 2; continue;
    }
    // a before ll, lk, lt: all, talk, salt
    if (ch === "a" && /^al(?:l|k|t)/.test(rest)) { out.push({ v: "o" }); i++; continue; }
    // y: a vowel after the first letter
    if (ch === "y") {
      if (i === n - 1 && groups === 0) out.push({ v: "Y" });
      else if (i === n - 1) out.push({ v: "i" });
      else out.push({ v: "y", single: true });
      i++; continue;
    }
    out.push({ v: ch, single: true }); i++;
  }
  return out;
}

const SHORT: Record<string, string> = { a: "a", e: "e", i: "i", o: "o", u: "a", y: "i" };
const LONG: Record<string, string> = { a: "Q", e: "i", i: "Y", o: "O", u: "u", y: "Y" };
const LONG_R: Record<string, string> = { a: "e", e: "i", i: "Y", o: "o", u: "u", y: "Y" };

/** Whether the consonants `cl` between a vowel and the next vowel let it be long (make, table, making). */
function openCluster(cl: { c: string; w: number }[]): boolean {
  if (cl.length === 1) return cl[0].w === 1;
  return cl.length === 2 && cl[0].c === "s" && cl[1].c === "t" && cl[0].w === 1 && cl[1].w === 1;
}

/** Spell a lower-case a–z word as sounds: the respelling described at the top of this file. */
export function respell(word: string): string {
  if (EXC[word]) return EXC[word];
  let w = word, tail = "";
  // plural and verb -s: boxes → box + iz; makes → make + s; bus, glass, famous keep theirs
  if (w.length > 3 && w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) {
    if (/(?:[sxz]|ch|sh|[cg])es$/.test(w)) { w = w.slice(0, -2); tail = "iz"; } else { w = w.slice(0, -1); tail = "s"; }
  }
  // -ed: wanted → want + id; walked → walke + d (the e stays, silent)
  if (w.length > 3 && w.endsWith("ed") && (w.match(/[aeiou]+/g) ?? []).length > 1 && !/eed$/.test(w)) {
    if (/[td]ed$/.test(w)) { w = w.slice(0, -2); tail = "id" + tail; } else { w = w.slice(0, -1); tail = "d" + tail; }
  }
  const units = parse(w);
  // pass 2: single vowels are short or long by what follows
  for (let k = 0; k < units.length; k++) {
    const u = units[k];
    if (!("v" in u) || !u.single) continue;
    const cl: { c: string; w: number }[] = [];
    let j = k + 1;
    while (j < units.length && "c" in units[j]) cl.push(units[j++] as { c: string; w: number });
    const next = units[j];
    let long = false, onR = false;
    if (j === units.length && cl.length === 0) long = (w.match(/[aeiou]+/g) ?? []).length === 1; // go, no, hi
    else if (next && "v" in next && cl.length > 0 && openCluster(cl) && (next.sil || next.le || next.ing)) long = true;
    else if (next && "v" in next && cl.length === 0 && next.ing && u.v === "y") long = true;
    else if (u.v === "o" && cl.length === 2 && cl[0].c === "l" && cl[1].c === "d" && j === units.length) long = true; // old, cold
    else if (u.v === "i" && cl.length === 2 && cl[0].c === "n" && cl[1].c === "d" && j === units.length) long = true; // find, kind
    else if (u.v === "i" && cl.length === 2 && cl[0].c === "l" && cl[1].c === "d" && j === units.length) long = true; // child, wild
    else if (u.v === "i" && cl.length === 1 && cl[0].c === "n" && j === units.length && /ign$/.test(w)) long = true;
    if (long && next && "v" in next && next.sil && cl.length === 1 && cl[0].c === "r") onR = true;
    const prev = units[k - 1];
    u.v = long ? (onR ? LONG_R : LONG)[u.v] : prev && "c" in prev && prev.c === "w" && u.v === "a" && /^(?:r|t|s|x|c|l|n)/.test((cl[0]?.c) ?? "") ? "o" : SHORT[u.v];
    delete u.single;
  }
  let out = "";
  for (const u of units) {
    const s = "c" in u ? u.c : u.v;
    if (s && !("c" in u && out[out.length - 1] === s)) out += s;
  }
  return out + tail;
}
