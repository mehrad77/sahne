// The assistant (server/assistant.ts): a conversation in a drawer beside any page, with what is open as its context (the
// page, the episode, the selected block), and one-click asks where you work (`ask`): fill the missing translations,
// simplify a line, suggest staging, propose choice options, check a scene, draft an episode from its brief, and a second
// reader that never saw the drafting. Its answer streams in, with the tools it uses; its edits arrive as proposals (or
// are written, in direct mode), never as hidden changes. A big ask says what it would cost and waits for a yes. It runs
// on Claude or on any OpenAI-compatible server (LM Studio, Ollama), within the budget (#/settings).
//
// An answer shows its work (chat/parts.ts): the model's thinking, folded once it moves on, and its tool calls grouped, in
// plain words, each opening to what it was given and what came back. A live line says what it is doing; *Stop* ends it.
//
// Conversations are kept in this browser (localStorage, per series), never on the server: the last one opens again after
// a reload, *New conversation* keeps the one before it, and *History* lists them to open again or delete (the newest 30).
// What is kept is trimmed (the thinking shortened, the tools' results left out), and the oldest go when the browser's
// storage is full.

import { html } from "htm/preact";
import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Path } from "../model/path.ts";
import { route, say, world } from "../store.ts";
import { proposals, selection, usage } from "../events.ts";
import { abilities } from "../model/abilities.ts";
import { Icon } from "./kit/index.ts";
import { Markdown } from "./md.ts";
import { liveLine, ThinkingBlock, tick, ToolGroup, type Thinking, type ToolPart } from "./chat/parts.ts";

type Part = { type: "text"; text: string } | Thinking | ToolPart | { type: "proposal"; id: string } | { type: "confirm"; estimateUsd: number; why: string } | { type: "error"; message: string } | { type: "done"; usd?: number } | { type: "stopped" };
interface Turn { role: "user" | "assistant"; content: string; parts?: Part[]; fresh?: boolean; at?: number }

/** The side panel is open (side.ts), and the tab it shows; an ask turns it to the assistant. */
export const assistantOpen = signal(false);
export type SideTab = "assistant" | "agents" | "docs";
const saved = (() => { try { return localStorage.getItem("backstage:side"); } catch { return null; } })();
export const sideTab = signal<SideTab>(saved === "agents" || saved === "docs" ? saved : "assistant");
const turns = signal<Turn[]>([]);
const busy = signal(false);

// ---- the conversations kept in this browser ----------------------------------------------------------------------------

interface Chat { id: string; title: string; at: number; turns: Turn[] }
const KEEP = 30;
const storeKey = () => `backstage:chats:${world.value?.series?.id ?? "root"}`;
const readChats = (): Chat[] => { try { return JSON.parse(localStorage.getItem(storeKey()) ?? "[]") as Chat[]; } catch { return []; } };
/** The longest thinking kept with a conversation, and the most of one conversation kept. */
const KEEP_THINKING = 2000, KEEP_CHAT = 200_000;
/** A turn as it is kept: the thinking shortened, no tool's result (it can be long and is not needed to read it again). */
const trimmed = (t: Turn): Turn => !t.parts ? t : { ...t, parts: t.parts.map(p => p.type === "thinking" ? { ...p, text: p.text.slice(0, KEEP_THINKING) } : p.type === "tool" ? { ...p, detail: undefined } : p) };
const chatJson = (c: Chat) => { const turns = c.turns.map(trimmed); let j = JSON.stringify({ ...c, turns }); for (let n = 1; j.length > KEEP_CHAT && n < turns.length; n++) j = JSON.stringify({ ...c, turns: turns.slice(n) }); return j; };
/** Write the conversations; when the browser's storage is full, the oldest go until they fit. */
const writeChats = (cs: Chat[]) => {
  const list = cs.slice(0, KEEP).map(chatJson);
  for (let n = list.length; n > 0; n--) {
    try { localStorage.setItem(storeKey(), `[${list.slice(0, n).join(",")}]`); return; } catch { /* full: try with fewer */ }
  }
  // blocked: the conversation stays in this tab
};
/** The conversations kept, newest first, and the one open. */
export const chats = signal<Chat[]>([]);
const chatId = signal<string>("");
const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let loadedFor = "";
/** Read the kept conversations once per series, and open the newest. */
function loadChats() {
  const k = storeKey();
  if (loadedFor === k) return;
  loadedFor = k;
  chats.value = readChats();
  const last = chats.value[0];
  chatId.value = last?.id ?? newId();
  turns.value = last?.turns ?? [];
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Keep the open conversation (a moment after it changes, so a streaming answer is not written at every word). */
function keep() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // nothing new: an empty one, or one just opened as it was kept (its time stays)
    if (!turns.value.length || chats.value.find(c => c.id === chatId.value)?.turns === turns.value) return;
    const first = turns.value.find(t => t.role === "user")?.content ?? "A conversation";
    const chat: Chat = { id: chatId.value, title: first.replace(/\s+/g, " ").slice(0, 80), at: Date.now(), turns: turns.value };
    chats.value = [chat, ...chats.value.filter(c => c.id !== chat.id)].slice(0, KEEP);
    writeChats(chats.value);
  }, 400);
}
turns.subscribe(() => { if (loadedFor) keep(); });
/** Start a new conversation (the one open stays in the history). */
export function newChat() { chatId.value = newId(); turns.value = []; }
function openChat(id: string) { const c = chats.value.find(x => x.id === id); if (c && !busy.value) { chatId.value = c.id; turns.value = c.turns; } }
function forgetChat(id: string) {
  chats.value = chats.value.filter(c => c.id !== id);
  writeChats(chats.value);
  if (chatId.value === id) newChat();
}
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString(); };

/** One-click asks, by the page open and what is selected on it: `block` needs a selected block of the script. */
export const ASKS: { id: string; label: string; prompt: string; on: "block" | "episode" | "page"; pages: string[]; fresh?: boolean }[] = [
  { id: "translate", label: "Fill the missing translations", prompt: "Fill in every missing translation in this episode (only the series' languages), natural and at the episode's level. Propose them.", on: "episode", pages: ["episode"] },
  { id: "simplify", label: "Simplify this line", prompt: "Make the selected line simpler and more natural at the episode's level, keeping its meaning and the words it teaches. Update its translations too. Propose it.", on: "block", pages: ["episode"] },
  { id: "stage", label: "Suggest staging for this line", prompt: "Suggest staging for the selected line: a gesture, a feeling, whom it is said to, what it points at, with a one-line reason each. Propose the best one.", on: "block", pages: ["episode"] },
  { id: "options", label: "Propose choice options", prompt: "Propose two or three options for the learner's choice at or after the selected block, one clearly fitting, in every language, with a reply each. Propose them.", on: "block", pages: ["episode"] },
  { id: "scene", label: "Check this scene", prompt: "Read the scene the selected block is in and tell me what does not work: words, translations, staging, who is spoken to. Be brief, and propose fixes only for clear mistakes.", on: "block", pages: ["episode"] },
  { id: "draft", label: "Draft this episode from its brief", prompt: "This episode is a draft. Write its steps and quiz from its title, premise, cast, place, target words and lessons, in the series' languages, using the place's marks. Propose the result.", on: "episode", pages: ["episode"] },
  { id: "second", label: "Second reader", prompt: "Review this episode as a careful second reader who did not write it: the main language, the translations against it, the quiz, the staging. List what must be fixed, most important first. Propose fixes for clear mistakes.", on: "episode", pages: ["episode"], fresh: true },
  { id: "season-needs", label: "What needs work this season", prompt: "Look at this season: its weeks and their themes, its episodes, their check results and review notes. Tell me briefly what needs work first, most important first. Change nothing.", on: "page", pages: ["board", "season"] },
  { id: "season-next", label: "Propose an episode for the next free day", prompt: "Propose one new episode for the first free weekday of this season, in a week that has an arc, fitting that week's theme and the episodes around it, with a place and cast that exist. Draft its steps and quiz, check it, and tell me what you proposed.", on: "page", pages: ["board", "season"] },
  { id: "place-uses", label: "Which episodes are set here", prompt: "Which episodes are set in this place, and which of its marks and props do they use? Say which marks and props no episode uses yet. Change nothing.", on: "page", pages: ["place"] },
  { id: "place-ideas", label: "Scene ideas for this place", prompt: "Suggest three short scene ideas for this place at the series' level, each naming the marks people stand on and the props they use. Change nothing.", on: "page", pages: ["place"] },
  { id: "places-fit", label: "Which place suits a scene", prompt: "List the places briefly, with what kind of scene each suits and which marks it has. Change nothing.", on: "page", pages: ["places"] },
  { id: "char-voice", label: "How this character speaks", prompt: "Read the episodes this character speaks in and describe how they speak: their words, tone and level, with two short examples. Change nothing.", on: "page", pages: ["character"] },
  { id: "char-where", label: "Where this character appears", prompt: "List the episodes this character is in, with their place and a line each about what they do there. Change nothing.", on: "page", pages: ["character"] },
  { id: "cast-fit", label: "Who suits a scene", prompt: "List the cast briefly: who each is, how they speak and which episodes they are in. Change nothing.", on: "page", pages: ["cast"] },
  { id: "review-first", label: "What to review first", prompt: "From the review notes and the checks, which episodes should I review first, and why? Be brief. Change nothing.", on: "page", pages: ["review"] },
];

/** What a page's asks are about, under each. */
const ABOUT: Record<string, string> = { board: "this season", season: "this season", place: "this place", places: "every place", character: "this character", cast: "the whole cast", review: "the review notes" };
/** The page open, as the assistant names it: an episode's own page, the board for a season. */
const pageNow = () => route.value[0] || "board";
/** The asks of the page open. */
const asksHere = () => ASKS.filter(a => a.pages.includes(pageNow()));

/** The context the assistant gets: the page, what it shows (an episode, a season, a place, a character) and what is selected on it. */
const contextNow = () => {
  const r = route.value, page = pageNow(), w = world.value;
  const s = selection.value?.page === page ? selection.value : null;
  const firstSeason = w ? Object.values(w.seasons).sort((a, b) => a.n - b.n)[0]?.id : undefined;
  const shown: { kind?: string; id?: string } = page === "episode" ? { kind: "story", id: r[1] } : page === "season" ? { kind: "season", id: r[1] } : page === "board" && firstSeason ? { kind: "season", id: firstSeason }
    : page === "place" ? { kind: "place", id: r[1] } : page === "character" ? { kind: "character", id: r[1] } : {};
  return { page, ...(s?.kind ?? shown.kind ? { kind: s?.kind ?? shown.kind } : {}), ...(s?.id ?? shown.id ? { id: s?.id ?? shown.id } : {}), ...(s?.path ? { path: s.path } : {}) };
};

let stopper: AbortController | null = null;
/** Stop the answer that is running: the request is aborted, so the server stops before its next tool or word. */
export function stop() { stopper?.abort(); }

/** Send a message (or an ask), streaming the answer into the conversation. */
export async function send(content: string, o: { fresh?: boolean; confirm?: boolean } = {}) {
  if (busy.value || !content.trim()) return;
  assistantOpen.value = true;
  sideTab.value = "assistant";
  // an answer with no words (only tools, or stopped) is not sent again
  const history = o.fresh ? [] : turns.value.filter(t => (!t.fresh || t.role === "user") && t.content.trim()).map(t => ({ role: t.role, content: t.content }));
  if (!o.confirm) turns.value = [...turns.value, { role: "user", content, fresh: o.fresh }];
  const reply: Turn = { role: "assistant", content: "", parts: [], fresh: o.fresh, at: Date.now() };
  turns.value = [...turns.value, reply];
  const update = (fn: (t: Turn) => void) => { fn(reply); turns.value = [...turns.value.slice(0, -1), { ...reply, parts: [...(reply.parts ?? [])] }]; };
  /** The thinking before this part is over: how long it took. */
  const endThinking = (t: Turn) => { const th = t.parts!.at(-1); if (th?.type === "thinking" && th.ms === undefined) th.ms = Date.now() - (th.at ?? Date.now()); };
  busy.value = true;
  tick(true);
  stopper = new AbortController();
  try {
    const r = await fetch("/api/assistant", { method: "POST", signal: stopper.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [...history, { role: "user", content }], context: contextNow(), fresh: !!o.fresh, confirm: !!o.confirm }) });
    if (!r.ok || !r.body) { const b = await r.json().catch(() => ({})) as { message?: string }; update(t => t.parts!.push({ type: "error", message: b.message ?? `the assistant answered ${r.status}` })); return; }
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = block.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart()).join("\n");
        if (!data) continue;
        const e = JSON.parse(data) as { type: string; [k: string]: any };
        update(t => {
          const parts = t.parts!, last = parts.at(-1);
          if (e.type === "thinking") { if (last?.type === "thinking" && last.ms === undefined) last.text += e.text; else parts.push({ type: "thinking", text: e.text, at: Date.now() }); return; }
          if (e.type !== "tool_result" && e.type !== "proposal") endThinking(t);
          if (e.type === "text") { t.content += e.text; if (last?.type === "text") last.text += e.text; else parts.push({ type: "text", text: e.text }); }
          else if (e.type === "tool") parts.push({ type: "tool", id: e.id, name: e.name, input: e.input, at: Date.now() });
          else if (e.type === "tool_result") {
            const tool = [...parts].reverse().find((p): p is ToolPart => p.type === "tool" && (e.id ? p.id === e.id : p.name === e.name && p.ok === undefined));
            if (tool) Object.assign(tool, { ok: e.ok, summary: e.summary, detail: e.detail, ms: e.ms ?? (tool.at ? Date.now() - tool.at : undefined) });
          } else if (e.type === "proposal") {
            // shown under the call that made it
            const tool = [...parts].reverse().find((p): p is ToolPart => p.type === "tool");
            if (tool && !tool.proposal) tool.proposal = e.id; else parts.push({ type: "proposal", id: e.id });
          } else if (e.type === "done") parts.push({ type: "done", usd: e.usage?.usd });
          else parts.push(e as Part);
        });
      }
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") update(t => { endThinking(t); t.parts!.push({ type: "stopped" }); });
    else update(t => t.parts!.push({ type: "error", message: (e as Error).message }));
  } finally { busy.value = false; stopper = null; tick(false); }
}

/** Ask again after an error: the failed exchange is replaced, not added to. */
function retry() {
  const at = turns.value.map(t => t.role).lastIndexOf("user");
  if (at < 0 || busy.value) return;
  const q = turns.value[at];
  turns.value = turns.value.slice(0, at);
  void send(q.content, { fresh: q.fresh });
}

/** An ask from the list, about what is selected. */
export function ask(id: string) {
  const a = ASKS.find(x => x.id === id);
  if (!a) return;
  if (a.on === "block" && !contextNow().path) { say("Select a block of the script first", true); return; }
  void send(a.prompt, { fresh: a.fresh });
}

/** The asks as a menu (where you work). */
export function AskMenu(p: { onDone?(): void }) {
  const w = world.value!;
  if (!w.ai) return html`<p class="note">The assistant is off: set it up in <a href="#/settings">Settings</a>.</p>`;
  const hasBlock = !!contextNow().path, asks = asksHere();
  if (!asks.length) return null;
  return html`<div class="menu">${asks.map(a => html`<button disabled=${a.on === "block" && !hasBlock} onClick=${() => { ask(a.id); p.onDone?.(); }}><b>${a.label}</b><small>${a.on === "block" ? "the selected block" : a.on === "episode" ? "the whole episode" : ABOUT[pageNow()] ?? "this page"}${a.fresh ? ", in a new conversation" : ""}</small></button>`)}</div>`;
}

const fmtUsd = (n: number) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;

/** Today's spending against the cap, in the top bar. */
export function Meter() {
  const w = world.value!, u = usage.value;
  useEffect(() => { if (w.ai && !u) void fetch("/api/usage").then(r => r.json()).then(x => { usage.value = x; }).catch(() => {}); }, []);
  if (!w.ai || !u) return null;
  const cap = u.caps.dayUsd, share = cap ? Math.min(1, u.today.usd / cap) : 0;
  return html`<a class="meter" href="#/settings" title=${`Today ${fmtUsd(u.today.usd)} of ${cap ? fmtUsd(cap) : "no cap"} · this month ${fmtUsd(u.month.usd)}${u.caps.monthUsd ? ` of ${fmtUsd(u.caps.monthUsd)}` : ""} · ${u.today.tokens.toLocaleString()} tokens today`}>
    <span class="bar"><span style=${`width:${Math.round(share * 100)}%`} class=${share > 0.85 ? "hot" : ""}></span></span>${fmtUsd(u.today.usd)}</a>`;
}

/** What the assistant can and cannot do here: the same list its instructions hold (model/abilities.ts). */
function Abilities() {
  const w = world.value!;
  const a = abilities({ writable: w.writable, agentEdits: w.agentEdits ?? "proposals", shareCards: w.shareCards, cards: w.cards, page: pageNow() });
  return html`<div class="abilities">
    <div><b>It can</b><ul>${a.can.map(x => html`<li>${x}</li>`)}</ul></div>
    <div><b>It cannot</b><ul>${a.cannot.map(x => html`<li>${x}</li>`)}</ul></div></div>`;
}

const PAGE: Record<string, string> = { story: "episode", character: "character", place: "place" };
/** A proposal the assistant made, with where to answer it; once answered, only that it was. */
function Proposed(p: { id: string }) {
  const x = proposals.value.find(y => y.id === p.id);
  if (!x) return html`<div class="tool ok">Proposed an edit (${p.id}): answered, no longer waiting.</div>`;
  const href = `#/${PAGE[x.kind] ?? "agents"}/${x.doc}`;
  if (x.create) return html`<div class="tool ok">${x.after ? "Updated the proposed new episode" : "Proposed a new episode,"} <b>${x.doc}</b>. <a href=${href}>Open it</a> to accept or reject it; nothing is saved until you do.</div>`;
  return html`<div class="tool ok">Proposed an edit to <b>${x.doc}</b>: <a href=${href}>accept or reject it</a> above the ${x.kind === "story" ? "script" : "page"}.</div>`;
}

/** An answer, its parts in order: thinking, runs of tool calls (one group each), words, cards. */
function Answer(p: { turn: Turn; live: boolean }) {
  const parts = p.turn.parts ?? [];
  const stopped = parts.some(x => x.type === "stopped");
  // the answer proper: the words after the last tool call, once it is done
  const lastTool = parts.map(x => x.type).lastIndexOf("tool");
  const out: unknown[] = [];
  for (let i = 0; i < parts.length; i++) {
    const x = parts[i];
    if (x.type === "tool") {
      const run: ToolPart[] = [];
      while (i < parts.length && parts[i].type === "tool") run.push(parts[i++] as ToolPart);
      i--;
      const made = run.filter(c => c.proposal).map(c => html`<${Proposed} id=${c.proposal!} />`);
      out.push(html`<${ToolGroup} calls=${run} live=${p.live} stopped=${stopped} after=${made} />`);
    } else if (x.type === "thinking") out.push(html`<${ThinkingBlock} part=${x} live=${p.live && i === parts.length - 1} />`);
    else if (x.type === "text") out.push(html`<${Markdown} class=${`said${!p.live && lastTool >= 0 && i > lastTool ? " answer" : ""}`} text=${x.text} />`);
    else if (x.type === "proposal") out.push(html`<${Proposed} id=${x.id} />`);
    else if (x.type === "confirm") out.push(html`<div class="confirm">${x.why} It would cost about ${fmtUsd(x.estimateUsd)}. <button class="small primary" onClick=${() => { const q = [...turns.value].reverse().find(y => y.role === "user"); if (q) void send(q.content, { confirm: true, fresh: q.fresh }); }}>Go ahead</button></div>`);
    else if (x.type === "error") out.push(html`<div class="chat-error"><span class="grow">${x.message}</span>${!p.live && p.turn === turns.value.at(-1) && html`<button type="button" class="small" onClick=${retry}>Try again</button>`}</div>`);
    else if (x.type === "stopped") out.push(html`<div class="note">Stopped. Nothing more ran after that.</div>`);
    else if (x.type === "done" && x.usd !== undefined) out.push(html`<div class="note cost">${fmtUsd(x.usd)}</div>`);
  }
  return html`${out}`;
}

/** The conversation, in the side panel's Assistant tab. */
export function AssistantChat() {
  const w = world.value!;
  loadChats();
  const [text, setText] = useState("");
  const [past, setPast] = useState(false);
  const [about, setAbout] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns.value]);
  const ai = typeof w.ai === "object" ? w.ai : null;
  const ctx = contextNow();
  const empty = !turns.value.length;
  return html`${ai ? html`<p class="note model">${ai.provider === "anthropic" ? "Claude" : "A local model"} · ${ai.model ?? ""} · <a href="#/settings">change</a>
      ${!empty && html` · <button type="button" class="linkish" aria-expanded=${about} onClick=${() => setAbout(!about)}>What it can do</button>`}</p>` : ""}
    ${w.ai && about && !empty && html`<${Abilities} />`}
    ${!w.ai ? html`<p>The assistant is off. Set up Claude (an API key) or a local model (LM Studio, Ollama) in <a href="#/settings">Settings</a>.</p>` : html`
    <div class="chat">
      ${empty && html`<div class="note">Ask anything about the series, or pick an ask. It sees ${ctx.id ? html`${ctx.kind === "season" ? "season " : ctx.kind === "place" ? "the place " : ctx.kind === "character" ? "the character " : ""}<b>${ctx.id}</b>${(ctx as { path?: Path }).path ? html` at <b>${(ctx as { path: Path }).path.slice(1).join(".")}</b>` : ""}` : `the ${ctx.page} page`}.<${Abilities} /><${AskMenu} /></div>`}
      ${turns.value.map((t, i) => html`<div class=${`turn ${t.role}${t.fresh ? " fresh" : ""}`}>
        ${t.role === "user" ? t.content : html`<${Answer} turn=${t} live=${busy.value && i === turns.value.length - 1} />`}
      </div>`)}
      ${busy.value && html`<div class="live-line" role="status" aria-live="polite"><span class="spin" aria-hidden="true"></span>${liveLine(turns.value.at(-1)?.parts ?? [], turns.value.at(-1)?.at ?? Date.now())}</div>`}
      <div ref=${end}></div>
    </div>
    <form class="chat-input" onSubmit=${(e: Event) => { e.preventDefault(); void send(text); setText(""); }}>
      <textarea rows=${2} value=${text} placeholder="Ask the assistant…" aria-label="Message" onInput=${(e: Event) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown=${(e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); setText(""); } }} />
      <div class="row"><button type="button" class="small" disabled=${busy.value || !turns.value.length} onClick=${() => { newChat(); setPast(false); }}>New conversation</button>
        <button type="button" class="small" aria-expanded=${past} disabled=${!chats.value.length} onClick=${() => setPast(!past)}>History${chats.value.length ? ` (${chats.value.length})` : ""}</button>
        <span class="grow"></span>${busy.value ? html`<button type="button" class="stop" onClick=${stop} title="Stop the answer: nothing more runs">Stop</button>` : html`<button class="primary" disabled=${!text.trim()}>Send</button>`}</div>
      ${past && html`<div class="chat-history" role="list" aria-label="Past conversations">
        <p class="note">Kept in this browser only, the newest ${KEEP}.</p>
        ${chats.value.map(c => html`<div role="listitem" class=${`chat-past${c.id === chatId.value ? " on" : ""}`}>
          <button type="button" class="open" disabled=${busy.value} onClick=${() => { openChat(c.id); setPast(false); }}><b>${c.title}</b><small>${ago(c.at)} · ${c.turns.filter(t => t.role === "user").length} message${c.turns.filter(t => t.role === "user").length === 1 ? "" : "s"}${c.id === chatId.value ? " · open now" : ""}</small></button>
          <button type="button" class="iconbtn" title="Delete this conversation" aria-label=${`Delete “${c.title}”`} onClick=${() => forgetChat(c.id)}><${Icon} name="trash" size=${14} /></button></div>`)}
      </div>`}
    </form>`}`;
}
