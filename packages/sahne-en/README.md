<!-- sahne:brand: written by packages/sahne-gallery/brand/build.mjs, edit that and run it -->
<p><picture><source media="(prefers-color-scheme: dark)" srcset="../../assets/brand/sahne-en-header-dark.svg"><img src="../../assets/brand/sahne-en-header.svg" alt="sahne EN" height="64"></picture></p>
<!-- /sahne:brand -->

# sahne-en

The English plugin of [Sahne](../sahne/README.md) ([DESIGN.md](../sahne/DESIGN.md) §4.1, §7, §9). Sahne knows no language: mouth timing and word matching come from a `LangPlugin`, and this is the English one (British spelling, `en-GB`).

```ts
import en from "sahne-en";
const stage = await mountStage(el, { kit, lang: en });
en.speech("Two loaves, please.", { rate: 1.2 });   // { dur, keys, words }
en.match("loaves", "loaf");                        // true
en.matchLine("2 loaves please", ["Two loaves, please.", "Two rolls, please."]); // { matched: true, best: 0, heard, score }
```

It depends on `sahne` for types and the shared line matcher. Besides the plugin it exports the helpers it is built from: `lowerEn`, `sayWord`, `tokens`, `syllables`, `phonemes`, `respell`, `forms`, `inflections`, `deixis`, `isNear`, the `TIMING` table and the `VISEME` map; for *say it aloud*, `normalise`, `sayWords`, `expand`, `letters` and `allowance`; and for the story lints (`sahne-story`, `langs/en.ts`), `sayNumber`, `sayNumeral`, `readNumber` ("twenty five" → 25), `readClock` ("quarter to ten" → 9:45) and `clockMinutes`.

## Timing

English spelling is not phonetic, so the sounds come from grapheme rules and a small table of exceptions (`g2p.ts`); after that a line is laid out like any language: one syllable per vowel.

| What | ms at rate 1 |
|---|---|
| A syllable (its onset and its vowel) | 200 |
| An unstressed schwa (the -er of water, the -le of table) | 140 |
| m b p: lips closed, taken from the start of the syllable, or added at its end | 70 |
| f v: lower lip on the teeth, the same way | 60 |
| A dip to rest between two syllables with the same shape, so the mouth does not freeze | 50, taken from the syllable |
| Each extra consonant of a cluster at the start or end of a word (street, next) | 40 |
| The shortest a vowel gets when labials eat into its syllable | 100 |
| Between words | 60 |
| Comma, semicolon, colon, dash | 250 |
| Full stop, ? and ! | 450 |
| … or ... | 600 |
| A line that is only "…" (the silent card) | 900 |

`rate` divides every time. `voice` does not change the timing. Several marks in a row (`?!`) are one pause, the longest. A gliding vowel (eye, cow, boy, say, go) moves the mouth through two shapes inside its syllable. Silent final *e*, *-ed*, *-es*, *-le* and the magic *e* are handled by the spelling rules; the tests count the syllables of common words.

Words keep their character index in the original text. Apostrophes and hyphens belong to the word (don't, well-known). Numbers are timed as their English words (1990 is *nineteen ninety*, 10:30 is *ten thirty*, 4:00 is *four o clock*, 50% is *fifty percent*) while the span covers the digits as written; a price is read with its minor unit (£5.50 is *five pounds fifty*, £0.50 is *fifty pence*). A word with no vowel is spelled out (TV is *tee vee*, PM is *pee em*), except hums (hmm, closed lips) and shushes (shh, rounded lips); a **y counts as a vowel**, so *my*, *by*, *why*, *try*, *sky*, *gym* are words of one syllable.

Keys are sorted, start at 0, never repeat a shape twice in a row, and end on `rest`.

## Matching

`match(word, token)` says whether a word of a line is a form of a `link` token given in its dictionary form: the regular plural / third person (-s, -es, -ies), possessive 's, past, -ing (with the e dropped and the consonant doubled: bake → baking, stop → stopped) and a table of the irregular ones (loaf → loaves, go → went, child → children, mouse → mice). A token of several words ("ice cream") is matched on its last word, or run together (icecream). `inflections(word)` gives every form it knows, for the story check's dictionary.

Derived words are other words and do not match: baker is not a form of bake. Known misses: comparatives and superlatives (bigger, happiest), adverbs (happily), the -er / -est / -y of short words, and irregular forms not in the table. `deixis(word)` says whether a word is *this*, *these*, *that* or *those*; `isNear` whether it is near.

## Say it aloud

`matchLine(heard, expected, {names, tolerance})` decides whether a recogniser's transcript (or any of its n-best alternatives) is one of the card's lines. Both sides become spoken words with `normalise`: lower case, contractions opened (*I'm* → *i am*, *isn't* → *is not*, *it's* → *it is*, *Nima's* → *nima*), numerals and prices in words (*2* → *two*, *£5.50* → *five pounds fifty*, *4:00* → *four o clock*), no punctuation or fillers (*um*, *uh*, *erm*, *hmm*), and a few spellings a recogniser chooses (*okay*, *gonna*, and the American *color* → *colour*). Then the engine's word-level edit distance (`lineMatcher`): English has no near letters, so a different letter costs a whole one; a missing word costs its letters, an extra one half of them; two words heard as one or one as two are forgiven.

A line matches when the cost is within its allowance: half a letter for three letters or fewer, then one letter, then about one in six. The closest line within its allowance wins, among the lines that agree with the heard one on *not*: *There is bread* is never *There isn't bread*, however few letters differ. At most 40 words are compared (the shared matcher's bound), so a long transcript is no match, and is refused at once. The plugin carries `locale: "en-GB"` for the recogniser (`sahne/listen`).

## The story language

`sahne-story` reads an English series through `langs/en.ts` (and `en-words.ts` for the check): words and pauses, `match`, the words that motivate each gesture (*hello* waves, *thanks* takes, *sorry* shrugs), numbers (`readNumber`), the check's dictionary forms (`inflections`, with the particles and numbers of English), and four lints: `deixis` (*this* is near and takes `hold_up`, `touch` or `point` within reach; *that* is far and takes `point_far`; *I think that bread…* points at nothing), `var_yok` (*There is / isn't X* about a linked prop needs it shown / hidden by then), `number` and `time`.

## Tests

```bash
node --test test/*.test.ts         # here, or pnpm test
pnpm sahne check                    # from the repo root: types, sizes and every Sahne package's tests
```
