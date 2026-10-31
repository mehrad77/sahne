// Review mode on an episode's page: one block at a time, the stage playing it beside the card. The card shows the block's
// words in the main language and each translation it holds, each with its check; Enter marks it right (reviewed, and
// every translation checked) and moves to the next block still to review; J and K move on and back without marking, C
// writes a comment on it, E edits it in the script, 1 to 9 check a translation, Escape leaves. The keys are ignored while
// typing (an input, a textarea, an editable field, an IME composing) and while the command palette is open. At the end,
// the episode's stage: Approve when it is Ready, or what keeps it from Ready.

import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { StoryDoc } from "sahne-story";
import { review, reviewer } from "../../store.ts";
import { checkedOf, STAGE_NAME, type Block, type Standing } from "../../model/review.ts";
import type { Path } from "../../model/path.ts";
import { markDone, markStep, putReview, Stepper } from "../review.ts";
import { inLang, langName } from "../lang.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const now = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const words = (story: StoryDoc, b: Block, lang: string): string | undefined => {
  let x: any = story;
  for (const k of b.path) x = x?.[k];
  for (const y of [x, x?.spot, x?.act?.prompt]) if (y && typeof y[lang] === "string" && y[lang].trim()) return y[lang];
  return undefined;
};

/** The review card: the block now under review, its checks, a comment, and the way on. */
export function ReviewMode(p: { id: string; story: StoryDoc; blocks: Block[]; standing: Standing; path: Path | null; main: string; select(path: Path, focus?: boolean): void; onExit(): void }) {
  const st = p.standing, open = (k: string) => ["todo", "partial", "changed"].includes(st.states[k] ?? "todo");
  const atKey = p.path ? p.blocks.find(b => b.path.join("/") === p.path!.join("/"))?.key : undefined;
  const [key, setKey] = useState<string | null>(() => atKey ?? p.blocks.find(b => open(b.key))?.key ?? p.blocks[0]?.key ?? null);
  const [end, setEnd] = useState(false), [text, setText] = useState("");
  const note = useRef<HTMLTextAreaElement>(null);
  const i = p.blocks.findIndex(b => b.key === key), b = p.blocks[i];
  const go = (k: string | undefined) => { if (!k) { setEnd(true); return; } setEnd(false); setKey(k); setText(""); p.select(p.blocks.find(x => x.key === k)!.path); };
  // the block picked in the script becomes the card's
  useEffect(() => { if (atKey && atKey !== key) { setKey(atKey); setEnd(false); } }, [atKey]);
  // the stage plays the block when the card opens on it
  useEffect(() => { if (b && !atKey) p.select(b.path); }, []);
  const nextOpen = () => p.blocks.slice(i + 1).find(x => open(x.key) && x.key !== key)?.key ?? p.blocks.slice(0, i).find(x => open(x.key))?.key;
  const right = () => { if (!b) return; markDone(p.id, p.story, b); go(nextOpen()); };
  const comment = () => {
    if (!b || !text.trim()) return;
    putReview(p.id, x => ({ ...x, comments: [...(x.comments ?? []), { id: Math.random().toString(36).slice(2, 10), at: b.key, by: reviewer.value || "someone", text: text.trim(), date: now() }] }));
    setText("");
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".palette")) return;
      if (e.key === "Escape") { if (typing(e.target)) (e.target as HTMLElement).blur(); else p.onExit(); e.preventDefault(); return; }
      if (typing(e.target) || end && e.key !== "k" && e.key !== "K") return;
      const k = e.key.toLowerCase();
      if (k === "enter") right();
      else if (k === "j") go(p.blocks[i + 1]?.key);
      else if (k === "k") { if (end) { setEnd(false); return; } go(p.blocks[Math.max(0, i - 1)]?.key); }
      else if (k === "c") note.current?.focus();
      else if (k === "e" && b) p.select(b.path, true);
      else if (/^[1-9]$/.test(k) && b?.langs[Number(k) - 1]) { const l = b.langs[Number(k) - 1]!; markStep(p.id, p.story, b.path, l, !(checkedOf(review.value[p.id]?.steps?.[b.key]).includes(l) && st.states[b.key] !== "changed")); }
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  const bar = html`<div class="rm-head"><b>Reviewing</b><span class="note">${st.done} of ${st.total} blocks</span><span class="grow"></span><button class="small" onClick=${p.onExit} title="Leave review mode (Escape)">Done</button></div>
    <div class="rm-progress" role="progressbar" aria-valuemin="0" aria-valuemax=${st.total} aria-valuenow=${st.done}><span style=${`width:${st.total ? (st.done / st.total) * 100 : 0}%`}></span></div>`;
  if (end || !b) return html`<div class="review-mode">${bar}
    <${Stepper} stage=${st.stage} />
    ${st.stage === "ready" ? html`<p>Every block is reviewed. ${STAGE_NAME.ready}: approve it when it can ship.</p><div class="row"><button class="primary" onClick=${() => { putReview(p.id, x => ({ ...x, status: "approved" })); p.onExit(); }}>Approve</button><button onClick=${() => setEnd(false)}>Back to the blocks</button></div>`
      : st.stage === "approved" ? html`<p>Approved, and nothing changed since.</p><div class="row"><button onClick=${p.onExit}>Leave review mode</button></div>`
      : html`<p>Not ready yet: ${st.missing.join(" · ")}.</p><div class="row"><button onClick=${() => setEnd(false)}>Back to the blocks (K)</button><button onClick=${p.onExit}>Leave review mode</button></div>`}
  </div>`;
  const checked = checkedOf(review.value[p.id]?.steps?.[b.key]), state = st.states[b.key] ?? "todo", stale = state === "changed";
  const comments = (review.value[p.id]?.comments ?? []).filter(c => c.at === b.key && !c.done);
  return html`<div class="review-mode">${bar}
    <div class="rm-card">
      <div class="rm-meta"><span>Block ${i + 1} of ${p.blocks.length}</span><span class="note">${b.kind}${b.who ? ` · ${b.who}` : ""}</span><span class=${`rm-state ${state}`}>${stale ? "changed since review" : state === "done" || state === "unverified" ? "reviewed" : state === "partial" ? "partly reviewed" : "to review"}</span></div>
      <p class="rm-main" ...${inLang(p.main)}>${b.text || html`<span class="note">(no words: staging)</span>`}</p>
      ${b.langs.map((l, n) => { const on = checked.includes(l) && !stale; return html`<div class=${`rm-tr${on ? " on" : ""}`}>
        <button class="rm-check" aria-pressed=${on} title=${`${on ? "Checked" : "Mark it checked"} (${n + 1})`} onClick=${() => markStep(p.id, p.story, b.path, l, !on)}>${on ? "✓" : n + 1}</button>
        <span class="lang-tag" title=${langName(l)}>${l}</span><span class="grow" ...${inLang(l)}>${words(p.story, b, l)}</span></div>`; })}
      ${comments.length > 0 && html`<ul class="rm-comments">${comments.map(c => html`<li><b>${c.by}</b> ${c.text}</li>`)}</ul>`}
      <textarea ref=${note} rows=${2} placeholder="A comment on this block (C)" value=${text} aria-label="A comment on this block" onInput=${(e: Event) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown=${(e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); comment(); } }} />
    </div>
    <div class="rm-actions">
      <button onClick=${() => go(p.blocks[Math.max(0, i - 1)]?.key)} disabled=${i === 0} title="The block before (K)">← Back</button>
      <button onClick=${() => go(p.blocks[i + 1]?.key)} title="The next block, without marking (J)">Skip →</button>
      <button onClick=${() => p.select(b.path, true)} title="Edit it in the script (E)">Edit</button>
      ${text.trim() && html`<button onClick=${comment}>Comment</button>`}
      <span class="grow"></span>
      <button class="primary" onClick=${right} title="Reviewed, every translation checked, and on to the next (Enter)">Looks right ↵</button>
    </div>
    <p class="rm-keys note"><kbd>↵</kbd> looks right · <kbd>J</kbd> <kbd>K</kbd> next, back · <kbd>C</kbd> comment · <kbd>E</kbd> edit${b.langs.length ? html` · <kbd>1</kbd>–<kbd>${b.langs.length}</kbd> check a translation` : ""} · <kbd>Esc</kbd> leave</p>
  </div>`;
}
