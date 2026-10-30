<!-- sahne:brand: written by packages/sahne-gallery/brand/build.mjs, edit that and run it -->
<p><picture><source media="(prefers-color-scheme: dark)" srcset="../../assets/brand/sahne-fa-header-dark.svg"><img src="../../assets/brand/sahne-fa-header.svg" alt="sahne FA" height="64"></picture></p>
<!-- /sahne:brand -->

# sahne-fa

The Persian plugin of [Sahne](../sahne/README.md) ([DESIGN.md](../sahne/DESIGN.md) §4.1, §7, §9). Sahne knows no language: mouth timing and word matching come from a `LangPlugin`, and this is the Persian one (`fa-IR`, written right to left: the plugin carries `dir: "rtl"`, which the stage gives the bubbles).

> **Every rule here wants a native speaker's check.** The rules were written from the grammar, not from a speaker's ear: the short vowels the script leaves out, the endings a noun takes, the way numbers and clock times are said, the words that motivate a gesture, the letters a recogniser mixes up. The tests keep the rules from drifting; they do not prove them. Known misses are listed in each section and tested as misses, so a change to one is on purpose.

```ts
import fa from "sahne-fa";
const stage = await mountStage(el, { kit, lang: fa });
fa.speech("دو تا نان، لطفاً.", { rate: 1.2 });   // { dur, keys, words }
fa.match("نان‌هایم", "نان");                       // true
fa.matchLine("۲ تا نون لطفا", ["دو تا نان، لطفاً.", "دو تا نان بدهید."]); // { matched: true, best: 0, heard, score }
```

It depends on `sahne` for types and the shared line matcher. Besides the plugin it exports the helpers it is built from: `lowerFa`, `foldLetters`, `sayWord`, `tokens`, `ZWNJ`, `syllables`, `phonemes`, `respell`, `deixis`, `placeDeixis`, `isNear`, the `TIMING` table and the `VISEME` map; for *say it aloud*, `normalise`, `sayWords`, `letters` and `allowance`; and for the story lints (`sahne-story`, `langs/fa.ts`), `sayNumber`, `sayNumeral`, `readNumber` ("بیست و یک" → 21), `readClock` ("یه ربع به ده" → 9:45) and `clockMinutes`.

## Writing

- **Letter forms.** Arabic letter forms are folded to the Persian ones: ي ى → ی, ك → ک, ة ھ → ه, أ إ ٱ → ا, ؤ → و (ۀ is ه with the ezafe hamza, which the speech reads). The short-vowel marks (harakat), tatweel and ZWNJ are dropped for matching; the speech reads the marks.
- **ZWNJ** (U+200C) joins a word: می‌روم and کتاب‌ها are one word to the tokenizer and the timing, and one word to `match`, with or without the ZWNJ (میروم). A word keeps its character index in the original text.
- **Digits.** ۰–۹ (Persian) and ٠–٩ (Arabic-Indic) are read as the numbers they are, like 0–9; ٫ and ٬ are the decimal point and the thousands comma, ٪ is %.
- **Pauses.** `،` `؛` `؟` `۔`, the Latin `, ; : . ! ?`, `…`, `—` and a lone hyphen. Quotes («»), brackets and symbols are skipped.

## Timing

Persian writes its long vowels (ا آ و ی) and leaves the short ones out, so the sounds come from rules (`g2p.ts`); after that a line is laid out like any language: one syllable per vowel.

- **The long vowels and the mouth.** ā → `A`, i → `I`, u → `U`, o → `O` (تو, and an initial او), a short e → `E`, a short a → `A`.
- **و** is the vowel u between consonants (دوست), the consonant v at the start of a word or between vowels (ولی, گاو) and lip-to-teeth, silent after خ before ا (خواب), and the word و is o. **ی** is i after a consonant (شیر), y at the start of a word or after a vowel (یک, پای), and `iy` before ا (پیاده). A final **ه** after a consonant is the silent, light e of خانه; after a long vowel it is h (شاه, کوه).
- **The unwritten short vowels** are estimated so that no syllable has more than one consonant before its vowel or two after: a word that starts with two consonants gets a vowel after the first (کتاب *ke-tāb*, سلام *se-lām*); three consonants between vowels split two and one, and with ر or ل in the middle one and a vowel after the liquid (مدرسه *mad-re-se*); a final run of three gets a vowel before the last (کردم *kar-dam*), and so does a stop or fricative before a final ر (پدر *pe-dar*, مادر *mā-dar*). The estimated vowel is `a`, except `e` where the rules place one after a liquid.
- **Marks the writer put.** Fatha, kasra and damma give their vowel, sukun none, shadda doubles the consonant, tanween is *-an* (لطفاً *lotfan*), a kasra or the hamza on ه at the end of a word is the **ezafe** (*-e*, *-ye*), and a lone ی after ZWNJ (خانه‌ی) is *ye*. **An unwritten ezafe is not said**: it is the usual case, and the timing is a syllable short wherever one is spoken.

| What | ms at rate 1 |
|---|---|
| A syllable with a long vowel (its onset and its vowel) | 200 |
| A syllable with a short vowel (written with a mark, or estimated) | 160 |
| The silent final ه of خانه, a light e | 130 |
| م ب پ: lips closed, taken from the start of the syllable, or added at its end | 70 |
| ف and the consonant و: lower lip on the teeth, the same way | 60 |
| A dip to rest between two syllables with the same shape, so the mouth does not freeze | 50, taken from the syllable |
| Each extra consonant of a cluster at the start or end of a syllable | 40 |
| The shortest a vowel gets when labials eat into its syllable | 100 |
| Between words | 60 |
| Comma, semicolon, colon, dash, `،` `؛` | 250 |
| Full stop, `?` `!` `؟` | 450 |
| … or ... | 600 |
| A line that is only "…" (the silent card) | 900 |

`rate` divides every time. `voice` does not change the timing. Several marks in a row (`؟!`) are one pause, the longest. Numbers are timed as their Persian words (۲۱ is *بیست و یک*, 10:30 is *ده و سی*, 50% is *پنجاه درصد*) while the span covers the digits as written. A word in another script is timed by its length. Hums (هوم, ممم) close the lips and shushes (هیس) round them; هم (*also*) is a word.

Keys are sorted, start at 0, never repeat a shape twice in a row, and end on `rest`.

**Known misses.** Verbs with a و or a short vowel between consonants come out a syllable short or long (می‌روم is *mi-ra-vam*; the rules say *mi-rum*); words of Arabic or European origin with clusters (خداحافظ, تلفن, شکلات) are a syllable short; the choice between *e*, *a* and *o* for an estimated vowel is always *a*, so the open mouth is a little too often A. The mouth does not tell them apart much, and the syllable count is what the lips follow.

## Matching

`match(word, token)` says whether a word of a line is a form of a `link` token given in its dictionary form. A noun takes its endings one after the other, each optional, in this order:

| Ending | Forms |
|---|---|
| plural | ها (نان‌ها), ان (دوستان), ات (کلمات), the colloquial ا (نونا) |
| the indefinite or ezafe ی | ی, ای (خانه‌ای), یی after a vowel (جایی), as in نان‌هایی |
| possessive | م ت ش مان تان شان, with ا or ی before after a vowel or silent ه (خانه‌ام, جایم, بابام) |
| copula | است ست ه ام ایم اید اند یم ید ند (نان‌هاست, نانه) |

With or without ZWNJ (نان‌ها and نانها). Stems change in three places: a silent ه becomes گ before ان (بچه → بچگان) or goes before ات (کلمه → کلمات), and a vowel takes ی before ان (آقا → آقایان). A token of several words ("نان بربری") is matched on its last word, or run together (نانبربری). را is a separate word, not a form.

**Known misses.** Verbs (می‌خرم is not a form of خریدن), the Arabic broken plurals (کتب of کتاب), the colloquial object marker run on to the noun (نونو for نان را), and a token of two words where the first takes the ending (the head noun of an ezafe: نان‌های بربری matches only through بربری). The endings are generous: a few words that are not forms (تواند for تو + اند) match.

`deixis(word)` says whether a word is *این* (this, with همین), *اینها / اینا* (these), *آن / اون* (that, with همان / همون) or *آنها / اونا* (those); `placeDeixis` whether it is *اینجا* (here) or *آنجا / اونجا* (there); `isNear` whether it is near.

## Numbers and clocks

`sayNumber` writes Persian numbers joined by و: ۲۱ *بیست و یک*, ۱۰۵ *صد و پنج*, ۱۹۹۰ *هزار و نهصد و نود*, ۲۰۰۰ *دو هزار*, ۲۱۰۰۰ *بیست و یک هزار*, ۱٬۰۰۰٬۰۰۰ *یک میلیون* (a thousand is just *هزار*). `sayNumeral` reads a numeral as written: thousands, a decimal (*سه ممیز پنج*), a clock time, a percent, an ordinal (*اول, دوم, سوم, چهارم, بیست و یکم, سی‌ام*). `readNumber(words, i)` reads one back from lower-case words or digits: *بیست و یک* → 21 over three words, *دو هزار و پانصد* → 2500, *دوتا* (the counter joined on) → 2, colloquial *یه*, *شیش*, *پونزده* too. Two number words with no و between are two numbers (*دو سه*).

**نه is nine and "no".** A lone *نه* is *no*; it reads as nine only before the counter *تا*, before *و*, before a scale (*نه هزار*), or inside a number (*بیست و نه*). "نه شیر" is not nine milks; write ۹ or *نه تا*.

`readClock(text)` finds the times said in a line:

- *ساعت سه* (3:00), *ساعت سه و نیم* (3:30), *ساعت چهار و ربع*, *ساعت سه و ده دقیقه*, *ساعت ۱۰:۳۰*, *ساعت ۹.۴۵*;
- minutes before the hour: *یه ربع به ده* (9:45), *ده دقیقه به هفت* (6:50), *ربع کم ده*, with *مانده به* too;
- minutes past: *ده دقیقه از سه گذشته* (3:10);
- *سه و نیم* alone is a time only at the end of a line or before a part of the day (*سه و نیم بود*, *سه و نیم صبح*), because *سه و نیم کیلو* is three and a half kilos. *ربع / دقیقه … به …* needs no *ساعت*.

A bare number is no time (*دو تا نان*), nor is a price (*۳.۵۰ تومان*) or a version. `clockMinutes` gives a time on a 12-hour face, from a prop's "10:10" or from `ClockTime`.

## Say it aloud

`matchLine(heard, expected, {names, tolerance})` decides whether a recogniser's transcript (or any of its n-best alternatives) is one of the card's lines. Both sides become spoken words with `normalise`: Arabic letter forms folded, harakat, tatweel and ZWNJ gone, digits and numerals in words (*۲* and *2* are *دو*), no punctuation or fillers (*اِم, ام, ممم, اوم, هوم*), and a few spellings a recogniser chooses for one word (*نون → نان, اون → آن, یه → یک, بدین → بدهید, میخوام → میخواهم*). *خب* is a word, not a filler: it is dropped from the start of what was heard unless an expected line starts with it. Then the engine's word-level edit distance (`lineMatcher`): a different letter costs a whole one; a missing word costs its letters, an extra one half of them; two words heard as one or one as two are forgiven (*می روم* is *میروم*).

**Letters that sound alike** cost a quarter of a letter: س ص ث, ز ذ ض ظ, ت ط, ه ح, ق غ, and ا ع ء (with آ). The matcher's table cannot see where in a word a letter stands, so ع and ء are near ا **anywhere in a word**, not only at its start.

A line matches when the cost is within its allowance: half a letter for three letters or fewer, then one letter, then about one in six. The closest line within its allowance wins, among the lines that agree with the heard one on negation: *نان داریم* is never *نان نداریم*, however few letters differ. The words that make a line negative are *نه, نخیر, نیست\*, ندار\*, نمی\*, نبود\*, نشد\*, نکن\*, هیچ\*, هرگز, بدون*; a bare ن is not one (*نان* and *نمک* start with it). At most 40 words are compared (the shared matcher's bound). The plugin carries `locale: "fa-IR"` for the recogniser (`sahne/listen`).

## The story language

`sahne-story` reads a Persian series through `langs/fa.ts` (and `fa-words.ts` for the check): words and pauses, `match`, the words that motivate each gesture (*سلام* waves, *ممنون* takes, *ببخشید* bows the head), numbers (`readNumber`), the check's dictionary forms (a card's entries and their noun endings, with the particles and numbers of Persian; a word is split at its ZWNJ, so a verb's parts are particles and a verb a story uses must be a card), and four lints:

- `deixis`: *این* is near and takes `hold_up`, `touch` or `point` within reach; *آن / اون* is far and takes `point_far`. Persian puts the noun right after (*این نان*), with a number allowed between.
- `var_yok`: *X هست / داریم* needs the prop shown by then, *X نیست / نداریم* hidden. The subject comes before the verb, so the lint looks back from it, and fires only when the linked noun stands right before the verb (only a quantifier like *هیچ* or *دیگر* may stand between): "این نان تازه نیست" says the bread is not fresh, not that it is gone. A question (*؟*, or *آیا*) is no assertion.
- `number`: *دو تا نان* → n = 2; the counters *تا, عدد, دانه, بسته* are skipped to find the noun.
- `time`: a clock time said aloud matches the linked clock.

## Tests

```bash
node --test test/*.test.ts         # here, or pnpm test
pnpm sahne check                    # from the repo root: types, sizes and every Sahne package's tests
```
