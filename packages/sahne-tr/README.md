# sahne-tr

The Turkish plugin of [Sahne](../sahne/README.md) ([DESIGN.md](../sahne/DESIGN.md) §4.1, §7, §9). Sahne knows no language: mouth timing and word matching come from a `LangPlugin`, and this is the Turkish one.

```ts
import tr from "sahne-tr";
const stage = await mountStage(el, { kit, lang: tr });
tr.speech("Şu ekmek çok taze.", { rate: 1.2 }); // { dur, keys, words }
tr.match("ekmeği", "ekmek");                    // true
tr.matchLine("2 ekmek lütfen", ["İki ekmek, lütfen.", "İki ekmek ver."]); // { matched: true, best: 0, heard, score }
```

It depends on `sahne` for types only. Besides the plugin it exports the helpers it is built from: `lowerTr`, `isVowel`, `VOWELS`, `sayWord`, `sayNumber`, `sayNumeral`, `sayDigits`, `ordinal`, `tokens`, `syllables`, `phonemes`, `stems`, `deixis`, the `TIMING` table and the `VISEME` map; for *say it aloud*, `normalise`, `sayWords`, `letters` and `allowance`; and for the story lints (`sahne-story`), `readNumber` ("on beş" → 15), `readClock` ("Ona çeyrek var" → 9:45) and `clockMinutes`.

## Timing

Turkish is written as it is said, so the spelling gives the syllables: one vowel per syllable.

| What | ms at rate 1 |
|---|---|
| A syllable (its onset and its vowel) | 200 |
| m b p: lips closed, taken from the start of the syllable, or added at its end | 70 |
| f v: lower lip on the teeth, the same way | 60 |
| A dip to rest between two syllables with the same shape (ka-la-cak), so the mouth does not freeze | 50, taken from the syllable |
| Each extra consonant of a cluster at the start or end of a word (tren, Türk) | 40 |
| ğ lengthening the vowel before it (dağ, doğru) | 60 |
| Between words | 60 |
| Comma, semicolon, colon, dash | 250 |
| Full stop, ? and ! | 450 |
| … or ... | 600 |
| A line that is only "…" (the silent card) | 900 |

`rate` divides every time. `voice` does not change the timing. Several marks in a row (`?!`) are one pause, the longest.

Mouth shapes: a → A, e → E, ı and i → I, o and ö → O, u and ü → U, â î û as their base vowel. ı takes I rather than E because it is a close vowel like i: the jaw is nearly shut, and E's open jaw would read as a different vowel. Other consonants have no shape of their own and blend into the vowels.

Words keep their character index in the original text. Apostrophes belong to the word (Nima'nın). Numbers are timed as their Turkish words (1990 is *bin dokuz yüz doksan*, 10:30 is *on otuz*, %50 is *yüzde elli*, "2. kat" is *ikinci kat*) while the span covers the digits as written. A word with no vowel is spelled out (TL is *te le*), except hums (hmm, closed lips) and shushes (şşt, rounded lips).

Keys are sorted, start at 0, never repeat a shape twice in a row, and end on `rest`: at `dur` when the line ends on a word, or where the closing pause begins when it ends on punctuation (the mouth holds rest to `dur`).

## Matching

`match(word, token)` says whether a word of a line is a form of a `link` token given in its dictionary form. The word must be the token, or one of its stems, followed by a chain of noun endings in order (plural, possessive, case, -ki, copula, person), each with the buffer letter it takes after a vowel or a consonant and in vowel harmony with what precedes it. The stems are the token, its softened form before a vowel (kitap → kitabı, ekmek → ekmeği, renk → rengi), the high vowel dropped before a vowel (ağız → ağzı), a doubled consonant for a few loans (hak → hakkı) and suy- for su. Names take their endings after an apostrophe (İsmail'in).

Derived words are other words and do not match: ekmekçi, kitaplık, sütlü, çaydanlık, sucuk, Türkçe. Known misses: a homograph that is also an inflected form matches (ada is ad + a, kalem is kale + m); verbs are not supported; the plural of a compound token (çay bardakları for "çay bardağı") is missed. `deixis(word)` says whether a word is a form of bu, şu or o.

## Tests

```bash
node --test test/*.test.ts         # here, or pnpm test
pnpm sahne check                    # from the repo root: types, sizes and every Sahne package's tests
```

## Say it aloud

`matchLine(heard, expected, {names, tolerance})` decides whether a recogniser's transcript (or any of its n-best alternatives) is one of the card's lines. Both sides become spoken words with `normalise`: Turkish lower case, numerals in words (*2* → *iki*), no punctuation, apostrophes or fillers (*ıı*, *eee*, *hmm*; *şey* is a word and stays), and a few recogniser spellings (*buyurun* → *buyrun*). Then a word-level edit distance, weighted by letters:

| Difference | Cost |
|---|---|
| A different letter | 1 |
| The same letter but its dot or cedilla (ı/i, ş/s, ç/c, ğ/g, ö/o, ü/u), or a lost ğ | 0.25 |
| A word of the line not said | its letters |
| A word said that is not in the line (*evet* before it) | half its letters |
| Two words heard as one, or one as two (*varmı*, *teşekkürederim*) | the letters that differ once joined |
| A name in `names` | 0 against any one or two words; 1 if missing |

A line matches when the cost is within its allowance: half a letter for three letters or fewer, then one letter, then about one in six (`tolerance` overrides the ratio). The closest line within its allowance wins, so a choice between *İki ekmek, lütfen.* and *İki ekmek ver.* picks the option that was said, and *Ekmek yok* never passes for *Ekmek var*. The plugin carries `locale: "tr-TR"` for the recogniser (`sahne/listen`).
