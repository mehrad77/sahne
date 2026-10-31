<!-- sahne:brand: written by packages/sahne-gallery/brand/build.mjs, edit that and run it -->
<p><picture><source media="(prefers-color-scheme: dark)" srcset="../../assets/brand/sahne-de-header-dark.svg"><img src="../../assets/brand/sahne-de-header.svg" alt="sahne DE" height="64"></picture></p>
<!-- /sahne:brand -->

# sahne-de

The German plugin of [Sahne](../sahne/README.md) ([DESIGN.md](../sahne/DESIGN.md) §4.1, §7, §9). Sahne knows no language: mouth timing and word matching come from a `LangPlugin`, and this is the German one (`locale: "de-DE"`).

```ts
import de from "sahne-de";
const stage = await mountStage(el, { kit, lang: de });
de.speech("Zwei Brezeln, bitte.", { rate: 1.2 }); // { dur, keys, words }
de.match("Äpfel", "Apfel");                       // true
de.matchLine("2 Brote bitte", ["Zwei Brezeln, bitte.", "Zwei Brote, bitte."]); // { matched: true, best: 1, heard, score }
```

It depends on `sahne` for types and for the shared `lineMatcher`. Besides the plugin it exports the helpers it is built from: `lowerDe`, `isVowel`, `VOWELS`, `sayWord`, `sayNumber`, `sayNumeral`, `sayDigits`, `ordinal`, `tokens`, `syllables`, `phonemes`, `deixis`, the `TIMING` table and the `VISEME` map; for *say it aloud*, `normalise`, `sayWords`, `letters` and `allowance`; and for the story lints (`sahne-story`), `readNumber` ("einundzwanzig" → 21), `readClock` ("Halb drei" → 2:30) and `clockMinutes`.

**Every language rule here was written without a native speaker and wants one's check**, as the Turkish names do: the timing table, the sound rules, the plural endings and the clock phrases below. They are heuristics. Where a rule is a guess, it is said so.

## Timing

German spelling is nearly phonetic, so rules over the letters give the syllables. One vowel (or diphthong) is one syllable.

| What | ms at rate 1 |
|---|---|
| A stressed syllable (its onset and its vowel) | 200 |
| An unstressed schwa (the -e of Katze, -en, -er, -el, -es) | 120 |
| m b p and pf: lips closed, taken from the start of the syllable, or added at its end | 70 |
| f v w: lower lip on the teeth, the same way | 60 |
| A dip to rest between two syllables with the same shape (Ba-na-ne), so the mouth does not freeze | 50, taken from the syllable |
| Each extra consonant of a cluster at the start of a word or in a syllable's coda (Strand, Herbst) | 40 |
| A diphthong's second shape (ei A→I, au A→U, eu and äu O→I) | at 55 % of the vowel |
| Between words | 60 |
| Comma, semicolon, colon, dash | 250 |
| Full stop, ? and ! | 450 |
| … or ... | 600 |
| A line that is only "…" (the silent card) | 900 |

`rate` divides every time. `voice` does not change the timing. Several marks in a row (`?!`) are one pause, the longest.

Sounds, in the order the rules apply: `sch` and `tsch` are one sound, `ch` one, `ck` is k, `ph` is f, `th` and `dt` are t, `tz` and `z` are one (ts), `pf` is one (lips), `ng` one, `qu` is kv, `x` is ks, `c` is k (ts before e or i), `ß` is s, `w` is v, `sp` and `st` at the start of a word begin with sch. An unstressed final `-e`, `-en`, `-er`, `-el`, `-es`, `-em`, `-est` is a schwa when the word has another vowel before it (Katze, Lehrer, Fenster; a guess that wrongly shortens the stress of Hotel and Student). `ei ai ey ay`, `au`, `eu äu` are diphthongs, `ie` is one i, a doubled vowel (aa ee oo) is one, and an `h` after a vowel is silent (Bahn, sehr, Ruhe). Doubled consonants are one, and a syllable takes the last consonant of a cluster as its onset (Fens-ter).

Mouth shapes: a → A, e and ä and the schwa → E, i → I, o and ö → O, u and ü → U, y as ü (i at the end). Other consonants have no shape of their own and blend into the vowels.

Words keep their character index in the original text. Apostrophes belong to the word (Nima's). Numbers are timed as their German words (21 is *einundzwanzig*, 1990 is *eintausendneunhundertneunzig*, 10:30 is *zehn Uhr dreißig*, 50% is *fünfzig Prozent*, "am 2. Mai" is *zweite*) while the span covers the digits as written. A year is read as a plain number, not "neunzehnhundert…". A word with no vowel is spelled out (TV is *te fau*), except hums (hmm, closed lips) and shushes (pst, rounded lips).

Keys are sorted, start at 0, never repeat a shape twice in a row, and end on `rest`: at `dur` when the line ends on a word, or where the closing pause begins when it ends on punctuation (the mouth holds rest to `dur`).

## Matching

`match(word, token)` says whether a word of a line is a form of a `link` token given in its dictionary form (the nominative singular, any capital). The word must be the token, or its umlauted stem (the last a, o, u or au: Apfel → Äpfel), followed by a noun ending of plural or case:

| Ending | Examples |
|---|---|
| none | Lehrer, Äpfel, Mütter |
| -e, -en, -n | Hunde, Katzen, Brezeln, Broten (dative plural) |
| -er, -ern | Kinder, Kindern, Bücher, Häuser |
| -s, -es | Autos, Brotes, Nimas (also Nima's) |
| -ns, -ens | Namens, Herzens |
| -se, -sen, -ses | Ergebnisse (a token in -nis, -us, -is, -as doubles its s) |
| -nen | Lehrerinnen (a token in -in doubles its n) |

The umlaut stem goes only with the endings that take one (none, -e, -en, -n, -er, -ern). ß and ss are one letter (Füße, Füsse; recognisers write either). A table holds the foreign and irregular plurals (Museum → Museen, Thema → Themen, Firma, Studium, Herr → Herren…).

Compounds and derived words are other words and do not match: Brotkorb, Brötchen, Bäckerei, Hundehütte, Kindheit. Known misses: **adjective endings** (a token that is an adjective, rot → rote, is out of scope for now); verbs (gehen → geht); a homograph that is also an ending-form matches (Hause for Haus, Bader for Bad). A token of several words ("rote Brezel") is matched on its last word.

`deixis(word, next?)` says whether a word points: `"dies"` for dieser, diese, dieses, diesem, diesen (here) and for an article followed by *hier* ("das hier"), `"jen"` for jener and its forms (there), `"da"` for an article followed by *da* or *dort* ("der da"), else null.

## Tests

```bash
node --test test/*.test.ts         # here, or pnpm test
pnpm sahne check                    # from the repo root: types, sizes and every Sahne package's tests
```

## Say it aloud

`matchLine(heard, expected, {names, tolerance})` decides whether a recogniser's transcript (or any of its n-best alternatives) is one of the card's lines. Both sides become spoken words with `normalise`: German lower case, numerals in words (*2* → *zwei*, *10:30* → *zehn Uhr dreißig*), no punctuation, apostrophes or fillers (*äh*, *ähm*, *öh*, *eh*, *hm*, *mhm*; *ach* and *oh* are words and stay), and a few recogniser spellings (*zwo* → *zwei*, *gibts* → *gibt es*, *dankeschön* → *danke schön*). Then the engine's word-level edit distance, weighted by letters:

| Difference | Cost |
|---|---|
| A different letter | 1 |
| The same letter but for its umlaut, or ß for ss (ä/a, ö/o, ü/u, ß/ss) | 0.25 |
| A word of the line not said | its letters |
| A word said that is not in the line (*ja* before it) | half its letters |
| Two words heard as one, or one as two (*dankeschön*) | the letters that differ once joined |
| A name in `names` | 0 against any one or two words; 1 if missing |

A line matches when the cost is within its allowance: half a letter for three letters or fewer, then one letter, then about one in six (`tolerance` overrides the ratio). The closest line within its allowance wins, so a choice between *Zwei Brezeln, bitte.* and *Zwei Brote, bitte.* picks the option that was said. The plugin carries `locale: "de-DE"` for the recogniser (`sahne/listen`).

## Numbers and clocks

`sayNumber(21)` is *einundzwanzig*: German puts the ones before the tens, writes a number below a million as one word and says *eins* only when it stands alone (*hunderteins*, but *einhundert*). `readNumber(words, i)` reads one back, in digits ("1.000") or in words, including *zwei Millionen dreihunderttausend*; *ein* and *eine* read as 1 and the caller decides whether that is the article.

`readClock(text)` finds every clock time said and counts toward the next hour the German way:

| Said | Time |
|---|---|
| Es ist zehn Uhr. / Zehn Uhr dreißig. / 10:30 Uhr | 10:00 / 10:30 / 10:30 |
| Halb drei | 2:30 |
| Viertel vor zehn / Viertel nach eins | 9:45 / 1:15 |
| Zehn nach drei / Zwanzig vor zwölf | 3:10 / 11:40 |
| Fünf nach halb drei / Fünf vor halb drei | 2:35 / 2:25 |
| Dreiviertel drei | 2:45 |

A bare number is no time (*Zwei Brezeln* is not 2:00). "Viertel drei" in the east means 2:15 and is read so too.
