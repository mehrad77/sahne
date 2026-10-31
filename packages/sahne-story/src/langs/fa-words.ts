// Persian word resolving for the story check: whether a token of a story's text is a form of a card, a name, a
// particle or a number. sahne-fa's `match` handles a noun's endings; verbs are not matched (a verb a story uses
// must be a card's entry or one of the particles below). A word is split at its ZWNJ first: می‌خواهم is می and
// خواهم, کتاب‌ها is کتاب and ها, so the parts of a verb are particles, and a part that is only endings (هایم, هاست) resolves.

import { isEnding, lowerFa, match, readNumber, tokens } from "sahne-fa";

export const PARTICLES = new Set((
  "و یا اما ولی ولیکن اگر که را به از در با برای تا بر هم نیز همین همان این آن اون اینها آنها اونا اینجا آنجا اونجا اینکه آنکه چون زیرا پس سپس بعد قبل " +
  "من تو او ما شما ایشان آنان اینان مرا ترا شمارا خودم خودت خودش خودمان خودتان خودشان منو تورو " +
  "چه چی چیه چیست کی کیست کجا کجاست کدام کدوم چرا چطور چگونه چند چقدر چندتا آیا مگر مگه " +
  "خیلی بسیار کمی کم زیاد خوب بد هر همه همیشه هرگز هیچ هیچی هیچکس دیگر دیگه دیگری باز هنوز الان حالا فقط تنها اصلا واقعا حتما شاید " +
  "نه بله آره اره خب باشه لطفا ممنون مرسی متشکرم ببخشید بفرمایید بفرما سلام خداحافظ عزیز آقا خانم " +
  "است هست نیست بود شد می نمی ب ن هستم هستی هستیم هستید هستند نیستم نیستی نیستیم نیستید نیستند داشت دارم داری داریم دارید دارند دارد ندارم نداری نداریم ندارید ندارند ندارد " +
  "ام ای ایم اید اند ات اش مان تان شان ها های ان ات ی م ت ش یم ید ند ه ست " +
  "بیا بیایید برو بروید بده بدهید بگیر بگیرید بگو بگویید ببین ببینید"
).split(" "));

const NUMBERS = new Set((
  "اول دوم سوم چهارم پنجم ششم هفتم هشتم نهم دهم نیم نیمه ربع درصد ممیز تومان ریال دلار یورو دقیقه ساعت ثانیه روز ماه سال هفته تا عدد دانه نفر"
).split(" "));

/** The Persian words of a text, folded, each ZWNJ part apart (می‌خواهم → می, خواهم), numerals left out. */
export function words(text: string): string[] {
  return tokens(text).filter(t => t.kind === "word" && !/^\d/.test(lowerFa(t.text))).flatMap(t => t.text.split(/[‌-]/)).map(lowerFa).filter(Boolean);
}

export type Resolver = (token: string) => boolean;

/**
 * A resolver for a list of dictionary forms (cards' Persian, glosses, names), plus numbers and particles. A token
 * resolves when it is an entry, or a form of one: `match(token, entry)`, with the endings of a noun.
 */
export function resolver(entries: Iterable<string>, opts: { particles?: boolean } = {}): Resolver {
  const buckets = new Map<string, string[]>();
  const exact = new Set<string>();
  for (const e of entries) for (const w of words(e)) {
    exact.add(w);
    (buckets.get(w[0]) ?? buckets.set(w[0], []).get(w[0])!).push(w);
  }
  return token => {
    if (exact.has(token) || NUMBERS.has(token) || readNumber([token], 0) || (opts.particles !== false && PARTICLES.has(token))) return true;
    // a part after a ZWNJ may be only endings: نان‌هایم, بچه‌هایی, نان‌هاست
    if (opts.particles !== false && isEnding(token)) return true;
    for (const w of buckets.get(token[0]) ?? []) if (match(token, w)) return true;
    return false;
  };
}
