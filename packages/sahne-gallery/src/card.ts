// The reply card of the gallery's story pages (Kumru's STORIES_STAGE.md §7): the learner's
// line (or 2–3 options for a real choice) in the footer, each with its translation, and Söyle; the
// "…" card for a silent line; and, when the page passes `aloud`, a microphone that says the line by
// speaking it (DESIGN.md §9). A tap always works. Gallery code, not app code: Kumru draws its own.

/** One option: the Turkish line and its translation. */
export interface CardLine { tr: string; en?: string }

/** What listening heard: the option said (`best`, −1 for none), the transcript, or why nothing came. */
export interface Aloud { matched: boolean; best: number; heard: string; error?: string }

export interface CardOptions {
  /** The small label on top ("Nima", "Nima — choose"). */
  label: string;
  options: CardLine[];
  /** The "…" card: no words, the button reads "…". */
  silent?: boolean;
  /** Writes a Turkish line into an element (glossable words). */
  text: (el: HTMLElement, tr: string) => void;
  /** Show each option's translation under it. */
  translate?: boolean;
  onPick: (k: number) => void;
  /** Listen for the options; present only where the microphone may show. */
  aloud?: (expected: string[], onInterim: (t: string) => void, signal: AbortSignal) => Promise<Aloud>;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

const WHY: Record<string, string> = {
  "no-speech": "Duyamadım. I heard nothing: try again, or tap.",
  denied: "The microphone is off for this page: tap instead.",
  network: "No connection to the recogniser: tap instead.",
  offline: "Offline: tap instead.",
  timeout: "That took too long: try again, or tap.",
};

/** The card, ready to put in the footer. */
export function replyCard(o: CardOptions): HTMLElement {
  const card = el("div", "card");
  card.dataset.kind = o.silent ? "silent" : o.options.length > 1 ? "choice" : "say";
  card.append(el("small", "", o.label));
  const buttons: HTMLButtonElement[] = [];
  let ctl: AbortController | null = null;
  const pick = (k: number) => { ctl?.abort(); o.onPick(k); };

  if (o.silent) {
    const b = el("button", "primary", "…"); b.type = "button"; b.onclick = () => pick(0); b.setAttribute("aria-label", "… (stay silent)");
    card.append(b);
    return card;
  }
  if (o.options.length === 1) {
    const p = el("p", "glossable"); o.text(p, o.options[0].tr); card.append(p);
    if (o.translate && o.options[0].en) card.append(el("span", "tl", o.options[0].en));
    const row = el("div", "row");
    const b = el("button", "primary", "Söyle"); b.type = "button"; b.onclick = () => pick(0); buttons.push(b);
    row.append(b); card.append(row);
  } else {
    o.options.forEach((op, k) => {
      const b = el("button", "option"); b.type = "button"; b.onclick = () => pick(k);
      // plain text: a tap anywhere on the option picks it (glosses are on the log line after)
      b.append(el("span", "", op.tr)); b.lang = "tr";
      if (o.translate && op.en) b.append(el("span", "tl", op.en));
      buttons.push(b); card.append(b);
    });
  }

  if (o.aloud) {
    const row = card.querySelector(".row") ?? card.appendChild(el("div", "row"));
    const mic = el("button", "mic", "🎤 Say it"); mic.type = "button"; mic.setAttribute("aria-label", "Say it aloud");
    const status = el("span", "heard"); status.setAttribute("aria-live", "polite");
    mic.onclick = async () => {
      if (ctl) { ctl.abort(); return; }
      ctl = new AbortController();
      const mine = ctl;
      mic.setAttribute("aria-pressed", "true"); mic.textContent = "● Listening…"; status.textContent = "";
      const r = await o.aloud!(o.options.map(x => x.tr), t => { status.textContent = `“${t}”`; }, mine.signal);
      if (ctl !== mine) return;
      ctl = null; mic.setAttribute("aria-pressed", "false"); mic.textContent = "🎤 Say it";
      if (r.matched && r.best >= 0) { status.textContent = `✓ “${r.heard}”`; card.dataset.heard = String(r.best); o.onPick(r.best); return; }
      if (r.error === "aborted") { status.textContent = ""; return; }
      status.textContent = r.heard ? `“${r.heard}”: that was not the line. Try again, or tap.` : WHY[r.error ?? ""] ?? "Not heard: tap instead.";
      card.dataset.heard = "-1";
    };
    row.append(mic, status);
  }
  return card;
}
