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
// Conversations are kept with the series, in the content root's sidecar (`.backstage/chats/`, server/chats.ts), when
// backstage runs with --write; a read-only one keeps them in this browser (localStorage, per series, the newest 30), and
// the browser's move to the series once it can. The last one opens again after a reload, *New conversation* keeps the one
// before it, and *History* lists them with the tasks (live, or from their records), newest first, to open again or
// delete. What is kept is trimmed (src/model/chats.ts: the thinking shortened, the tools' results left out, no pictures).

import { html } from "htm/preact";
import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Path } from "../model/path.ts";
import { api } from "../api.ts";
import { go, loadWorld, route, say, setReview, world, type EpisodeReview } from "../store.ts";
import { acceptAndSave, proposals, selection, usage } from "../events.ts";
import { abilities } from "../model/abilities.ts";
import { Icon, Popover } from "./kit/index.ts";
import { Markdown } from "./md.ts";
import { loadSettings, settingsNow } from "./settings.ts";
import { hrefOf } from "./proposed.ts";
import { hostOf } from "../model/tools.ts";
import { keptChat, KEEP_CHATS, toMove, type ChatSummary } from "../model/chats.ts";
import { elsewhere, loadRecords, runs } from "../runs.ts";
import { liveLine, scrollerOf, ThinkingBlock, tick, ToolGroup, useStickToBottom, type Thinking, type ToolPart } from "./chat/parts.ts";

export type Part = { type: "start_run"; goal: string; started?: string } | { type: "text"; text: string } | Thinking | ToolPart | { type: "proposal"; id: string } | { type: "confirm"; estimateUsd: number; why: string } | { type: "error"; message: string } | { type: "done"; usd?: number } | { type: "stopped" } | AskPart | { type: "sources"; list: { url: string; title?: string }[] } | { type: "remembered"; id: string; text: string; undone?: boolean };
/** A question the assistant put to the person (ask_person, set_review): buttons that answer, proposals to accept and save, a status to set. */
type AskPart = { type: "ask"; question: string; options?: string[]; save?: string[]; review?: { id: string; status: string }; remember?: string; answered?: string };
export interface Turn { role: "user" | "assistant"; content: string; parts?: Part[]; fresh?: boolean; at?: number; /** The files the person attached (their names; the pictures are not kept). */ files?: string[] }
/** A file attached to a message: a picture sent as it is, a text file as words in the message. */
interface Attached { name: string; mediaType: string; data: string; text?: string }

/** The side panel is open (side.ts), and the tab it shows; an ask turns it to the assistant. */
export const assistantOpen = signal(false);
export type SideTab = "assistant" | "agents" | "docs";
const saved = (() => { try { return localStorage.getItem("backstage:side"); } catch { return null; } })();
export const sideTab = signal<SideTab>(saved === "agents" || saved === "docs" ? saved : "assistant");
const turns = signal<Turn[]>([]);
const busy = signal(false);

// ---- the conversations: with the series (server/chats.ts), or in this browser on a read-only backstage ---------------------

interface Chat { id: string; title: string; at: number; turns: Turn[] }
/** A conversation in History: its turns once they are read (a list from the server has none). */
interface ChatItem { id: string; title: string; at: number; messages: number; turns?: Turn[] }
/** The most kept in a browser (a read-only backstage keeps none). */
const KEEP_LOCAL = 30;
const storeKey = () => `backstage:chats:${world.value?.series?.id ?? "root"}`;
const readLocal = (k = storeKey()): Chat[] => { try { return JSON.parse(localStorage.getItem(k) ?? "[]") as Chat[]; } catch { return []; } };
/** Write the conversations to this browser; when its storage is full, the oldest go until they fit. */
const writeLocal = (cs: Chat[]) => {
  const list = cs.slice(0, KEEP_LOCAL).map(c => JSON.stringify(keptChat(c)));
  for (let n = list.length; n > 0; n--) {
    try { localStorage.setItem(storeKey(), `[${list.slice(0, n).join(",")}]`); return; } catch { /* full: try with fewer */ }
  }
  // blocked: the conversation stays in this tab
};
const itemOf = (c: Chat): ChatItem => ({ id: c.id, title: c.title, at: c.at, messages: c.turns.filter(t => t.role === "user").length, turns: c.turns });
/** The conversations kept, newest first, and the one open. */
export const chats = signal<ChatItem[]>([]);
/** Where they are kept: with the series once the server said it writes them (`GET /api/chats`), else in this browser. */
export const chatsKept = signal<"series" | "browser">("browser");
const chatId = signal<string>("");
const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let loadedFor = "";
/** Read the kept conversations once per series, and open the newest: this browser's at once, then the series' from the server. */
function loadChats() {
  const k = storeKey();
  if (loadedFor === k) return;
  loadedFor = k;
  const local = readLocal(k);
  chats.value = local.map(itemOf);
  chatId.value = local[0]?.id ?? newId();
  turns.value = local[0]?.turns ?? [];
  void fromSeries(k, local);
}
/** The series' conversations, when this backstage writes them; this browser's move there once (then are cleared from it). */
async function fromSeries(k: string, local: Chat[]) {
  const r = await api.get<{ chats: ChatSummary[]; write: boolean }>("chats");
  if (r.status !== 200 || !r.write || loadedFor !== k) return;
  const move = toMove(local, r.chats);
  let moved = 0;
  for (const c of move) if ((await api.put(`chats/${c.id}`, keptChat(c))).status === 200) moved++;
  if (moved === move.length) { try { localStorage.removeItem(k); } catch { /* blocked */ } }
  const list = move.length ? await api.get<{ chats: ChatSummary[] }>("chats") : r;
  if (loadedFor !== k || list.status !== 200) return;
  chatsKept.value = "series";
  // the one open keeps its turns, so opening it again does not count as a change
  const open = chats.value.find(c => c.id === chatId.value);
  chats.value = list.chats.map(s => ({ id: s.id, title: s.title, at: s.at, messages: s.messages, ...(s.id === open?.id ? { turns: open.turns } : {}) }));
  if (!turns.value.length && chats.value[0]) await openChat(chats.value[0].id);
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
    const series = chatsKept.value === "series";
    chats.value = [itemOf(chat), ...chats.value.filter(c => c.id !== chat.id)].slice(0, series ? KEEP_CHATS : KEEP_LOCAL);
    if (series) void api.put<{ message?: string }>(`chats/${chat.id}`, keptChat(chat)).then(r => { if (r.status !== 200) say(`the conversation was not kept: ${r.message ?? r.status}`, true); });
    else writeLocal(chats.value.flatMap(c => (c.turns ? [{ id: c.id, title: c.title, at: c.at, turns: c.turns }] : [])));
  }, 400);
}
turns.subscribe(() => { if (loadedFor) keep(); });
/** Start a new conversation (the one open stays in the history). */
export function newChat() { loadChats(); chatId.value = newId(); turns.value = []; }
async function openChat(id: string) {
  const c = chats.value.find(x => x.id === id);
  if (!c || busy.value) return;
  let got = c.turns;
  if (!got) {
    const r = await api.get<{ chat: Chat; message?: string }>(`chats/${id}`);
    if (r.status !== 200) { say(r.message ?? "the conversation could not be read", true); return; }
    got = r.chat.turns;
    chats.value = chats.value.map(x => (x.id === id ? { ...x, turns: got } : x));
  }
  chatId.value = id; turns.value = got;
}
async function forgetChat(id: string) {
  if (chatsKept.value === "series") {
    const r = await api.del<{ message?: string }>(`chats/${id}`);
    if (r.status !== 200 && r.status !== 404) { say(r.message ?? "the conversation was not deleted", true); return; }
  }
  chats.value = chats.value.filter(c => c.id !== id);
  if (chatsKept.value === "browser") writeLocal(chats.value.flatMap(c => (c.turns ? [{ id: c.id, title: c.title, at: c.at, turns: c.turns }] : [])));
  if (chatId.value === id) newChat();
}
const TASK_WORD: Record<string, string> = { running: "working", gate: "waiting for you", paused: "paused", done: "done", stopped: "stopped" };
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString(); };

/** One-click asks, by the page open and what is selected on it: `block` needs a selected block of the script. */
export const ASKS: { id: string; label: string; prompt: string; on: "block" | "episode" | "page"; pages: string[]; fresh?: boolean }[] = [
  { id: "translate", label: "Fill the missing translations", prompt: "Fill in every missing translation in this episode (only the series' languages), natural and simple. Propose them.", on: "episode", pages: ["episode"] },
  { id: "simplify", label: "Simplify this line", prompt: "Make the selected line simpler and more natural, keeping its meaning (and, with the lesson plugin, the words it teaches). Update its translations too. Propose it.", on: "block", pages: ["episode"] },
  { id: "stage", label: "Suggest staging for this line", prompt: "Suggest staging for the selected line: a gesture, a feeling, whom it is said to, what it points at, with a one-line reason each. Propose the best one.", on: "block", pages: ["episode"] },
  { id: "options", label: "Propose choice options", prompt: "Propose two or three options for the stand-in's choice at or after the selected block, one clearly fitting, in every language, with a reply each. Propose them.", on: "block", pages: ["episode"] },
  { id: "scene", label: "Check this scene", prompt: "Read the scene the selected block is in and tell me what does not work: words, translations, staging, who is spoken to. Be brief, and propose fixes only for clear mistakes.", on: "block", pages: ["episode"] },
  { id: "draft", label: "Draft this episode from its brief", prompt: "This episode is a draft. Write its steps from its title, premise, cast and place, and what the series' plugins ask of it (with the lesson plugin: its target words, lessons and quiz), in the series' languages, using the place's marks. Propose the result.", on: "episode", pages: ["episode"] },
  { id: "second", label: "Second reader", prompt: "Review this episode as a careful second reader who did not write it: the main language, the translations against it, the staging, and what the series' plugins ask (the quiz, with the lesson plugin). List what must be fixed, most important first. Propose fixes for clear mistakes.", on: "episode", pages: ["episode"], fresh: true },
  { id: "season-needs", label: "What needs work this season", prompt: "Look at this season: its weeks and their themes, its episodes, their check results and review notes. Tell me briefly what needs work first, most important first. Change nothing.", on: "page", pages: ["board", "season"] },
  { id: "season-week", label: "Plan a week of episodes", prompt: "Plan the next week of this season that has no episodes yet: its episodes, one for each free weekday, fitting the week's theme and the episodes around it, with any new people and places they need. It is a long task: offer it to me as a task with start_run, with the whole goal written out.", on: "page", pages: ["board", "season"] },
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

/**
 * The context the assistant gets: the page, what it shows (an episode, a season, a place, a character) and what is selected
 * on it. A selection counts only on its own page and document: one made in another episode is not this one's.
 */
export const contextNow = () => {
  const r = route.value, page = pageNow(), w = world.value;
  const firstSeason = w ? Object.values(w.seasons).sort((a, b) => a.n - b.n)[0]?.id : undefined;
  const shown: { kind?: string; id?: string } = page === "episode" ? { kind: "story", id: r[1] } : page === "season" ? { kind: "season", id: r[1] } : page === "board" && firstSeason ? { kind: "season", id: firstSeason }
    : page === "place" ? { kind: "place", id: r[1] } : page === "character" ? { kind: "character", id: r[1] } : {};
  const sel = selection.value, s = sel?.page === page && (!shown.id || sel.id === shown.id) ? sel : null;
  return { page, ...(s?.kind ?? shown.kind ? { kind: s?.kind ?? shown.kind } : {}), ...(s?.id ?? shown.id ? { id: s?.id ?? shown.id } : {}), ...(s?.path ? { path: s.path } : {}) };
};

let stopper: AbortController | null = null;
/** Stop the answer that is running: the request is aborted, so the server stops before its next tool or word. */
export function stop() { stopper?.abort(); }

/** Send a message (or an ask), streaming the answer into the conversation. */
/** The pictures attached to a message, while this tab is open (they are not kept), for a retry or a Go ahead to send again. */
const picturesOf = new WeakMap<Turn, Attached[]>();

/**
 * What the model is given before the message: the conversation's words (an answer with no words, only tools or stopped,
 * is not sent again). A Go ahead (`confirm`) sends the question it answers again as the message, so not also before it.
 */
export function historyOf(list: Turn[], o: { fresh?: boolean; confirm?: boolean } = {}): { role: Turn["role"]; content: string }[] {
  if (o.fresh) return [];
  const past = o.confirm ? list.slice(0, Math.max(0, list.map(t => t.role).lastIndexOf("user"))) : list;
  return past.filter(t => (!t.fresh || t.role === "user") && t.content.trim()).map(t => ({ role: t.role, content: t.content }));
}

/** The person's message an answer is to, while that answer is the last turn (an older card's button answers nothing now). */
export function askedBy(list: Turn[], answer: object): Turn | null {
  const q = list.at(-2);
  return list.at(-1) === answer && q?.role === "user" ? q : null;
}

export async function send(content: string, o: { fresh?: boolean; confirm?: boolean; files?: Attached[]; /** The names to show, when sent again. */ named?: string[] } = {}) {
  if (busy.value || !content.trim()) return;
  // the kept conversations are read before this one grows (an ask from a page can come before the panel ever opened)
  loadChats();
  assistantOpen.value = true;
  sideTab.value = "assistant";
  const history = historyOf(turns.value, o);
  // a text file is part of the message; a picture goes beside it
  const texts = (o.files ?? []).filter(f => f.text !== undefined), pictures = (o.files ?? []).filter(f => f.text === undefined);
  if (texts.length) content = `${content}\n\n${texts.map(f => `File ${f.name}:\n\`\`\`\n${f.text}\n\`\`\``).join("\n\n")}`;
  if (!o.confirm) {
    const names = o.named ?? o.files?.map(f => f.name) ?? [], q: Turn = { role: "user", content, fresh: o.fresh, ...(names.length ? { files: names } : {}) };
    if (pictures.length) picturesOf.set(q, pictures);
    turns.value = [...turns.value, q];
  }
  const reply: Turn = { role: "assistant", content: "", parts: [], fresh: o.fresh, at: Date.now() };
  turns.value = [...turns.value, reply];
  const update = (fn: (t: Turn) => void) => { fn(reply); turns.value = [...turns.value.slice(0, -1), { ...reply, parts: [...(reply.parts ?? [])] }]; };
  busy.value = true;
  tick(true);
  stopper = new AbortController();
  try {
    const r = await fetch("/api/assistant", { method: "POST", signal: stopper.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [...history, { role: "user", content }], context: contextNow(), fresh: !!o.fresh, confirm: !!o.confirm, ...(pictures.length ? { pictures: pictures.map(({ name, mediaType, data }) => ({ name, mediaType, data })) } : {}) }) });
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
        update(t => fold(t, e));
      }
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") update(t => { endThinking(t); t.parts!.push({ type: "stopped" }); });
    else update(t => t.parts!.push({ type: "error", message: (e as Error).message }));
  } finally { busy.value = false; stopper = null; tick(false); }
}

/** The thinking before this part is over: how long it took. */
const endThinking = (t: { parts?: Part[] }, now = Date.now()) => { const th = t.parts!.at(-1); if (th?.type === "thinking" && th.ms === undefined) th.ms = now - (th.at ?? now); };

/** One of the assistant's events into an answer's parts (the chat's, and a run step's log: runs.ts). */
export function fold(t: { content: string; parts?: Part[] }, e: { type: string; [k: string]: any }): void {
  // a logged event says when it came (a run's); a live one is now
  const parts = (t.parts ??= []), last = parts.at(-1), at: number = typeof e.at === "number" ? e.at : Date.now();
  if (e.type === "thinking") { if (last?.type === "thinking" && last.ms === undefined) last.text += e.text; else parts.push({ type: "thinking", text: e.text, at }); return; }
  if (e.type !== "tool_result" && e.type !== "proposal") endThinking(t, at);
  if (e.type === "text") { t.content += e.text; if (last?.type === "text") last.text += e.text; else parts.push({ type: "text", text: e.text }); }
  else if (e.type === "tool") parts.push({ type: "tool", id: e.id, name: e.name, input: e.input, at });
  else if (e.type === "tool_result") {
    const tool = [...parts].reverse().find((p): p is ToolPart => p.type === "tool" && (e.id ? p.id === e.id : p.name === e.name && p.ok === undefined));
    if (tool) Object.assign(tool, { ok: e.ok, summary: e.summary, detail: e.detail, ms: e.ms ?? (tool.at ? at - tool.at : undefined) });
  } else if (e.type === "proposal") {
    // shown under the call that made it
    const tool = [...parts].reverse().find((p): p is ToolPart => p.type === "tool");
    if (tool && !tool.proposal) tool.proposal = e.id; else parts.push({ type: "proposal", id: e.id });
  } else if (e.type === "done") parts.push({ type: "done", usd: e.usage?.usd });
  else { const { at: _at, ...rest } = e; parts.push(rest as Part); }
}

/**
 * A task the assistant offers for a long task: its goal, and the person's choice that starts it. Either way it writes as
 * it goes, within a budget, and anything it made can be undone. Check with me: the plan waits for a look, and a step
 * asks when the goal leaves a real choice open. Just do it: no stop at all; it decides and says what it chose. The last
 * choice is remembered (the settings' runMode) and offered first.
 */
function StartRunCard(p: { part: Extract<Part, { type: "start_run" }> }) {
  const [budget, setBudget] = useState(10), [busy2, setBusy2] = useState(false), [last, setLast] = useState<"check" | "auto">(settingsNow()?.runMode ?? "check");
  useEffect(() => { if (!settingsNow()) void loadSettings().then(() => setLast(settingsNow()?.runMode ?? "check")); }, []);
  const x = p.part;
  const start = async (mode: "check" | "auto") => {
    setBusy2(true);
    const r = await api.post<{ run: { id: string } }>("runs", { goal: x.goal, mode, maxUsd: budget });
    setBusy2(false);
    if (r.status !== 200) { say((r as { message?: string }).message ?? "the task did not start", true); return; }
    if (mode !== settingsNow()?.runMode) void api.post("settings", { runMode: mode }).then(() => loadSettings());
    x.started = r.run.id; turns.value = [...turns.value];
    go("agents", "tasks", r.run.id);
  };
  const choice = (mode: "check" | "auto", icon: string, title: string, about: string) => html`<button class=${last === mode ? "primary" : ""} disabled=${busy2} onClick=${() => void start(mode)}><b><${Icon} name=${icon} size=${15} /> ${title}</b><small>${about}</small></button>`;
  return html`<div class="ask-card start-run" role="group" aria-label="A task the assistant offers">
    <b><${Icon} name="list" size=${15} /> A task for this</b><blockquote>${x.goal}</blockquote>
    ${x.started ? html`<a class="button" href=${`#/agents/tasks/${x.started}`}><${Icon} name="play" size=${14} /> Follow task ${x.started}</a>` : html`
      <p class="note">It plans itself, then each part (a person, a place, an episode, a check) is made by its own agent, while this editor may be closed. It saves as it goes, and you can undo anything it made, or all of it.</p>
      <div class="start-run-choices">
        ${choice("check", "hand", "Check with me", "You see the plan first. After that it asks only when there is a real choice to make.")}
        ${choice("auto", "spark", "Just do it", "No stops: it decides the choices itself and tells you what it chose.")}
      </div>
      <label class="row">Up to $ <input type="number" min="1" step="1" style="max-width:80px" value=${budget} onInput=${(e: Event) => setBudget(Math.max(1, Number((e.target as HTMLInputElement).value) || 1))} /></label>`}
  </div>`;
}

/** Ask again after an error: the failed exchange is replaced, not added to. */
function retry() {
  const at = turns.value.map(t => t.role).lastIndexOf("user");
  if (at < 0 || busy.value) return;
  const q = turns.value[at];
  turns.value = turns.value.slice(0, at);
  void send(q.content, { fresh: q.fresh, files: picturesOf.get(q), named: q.files });
}

/** An ask from the list, about what is selected. */
export function ask(id: string) {
  const a = ASKS.find(x => x.id === id);
  if (!a) return;
  if (a.on === "block" && !contextNow().path) { say("Select a block of the script first", true); return; }
  void send(a.prompt, { fresh: a.fresh });
}

/** The asks as a menu (where you work). */
export function AskMenu(p: { onDone?(): void; chips?: boolean }) {
  const w = world.value!;
  if (!w.ai) return html`<p class="note">The assistant is off: start backstage with <code>ANTHROPIC_API_KEY</code> set, or choose a local model in <a href="#/settings">Settings</a>.</p>`;
  const hasBlock = !!contextNow().path, asks = asksHere();
  if (!asks.length) return null;
  const about = (a: (typeof asks)[number]) => `${a.on === "block" ? "the selected block" : a.on === "episode" ? "the whole episode" : ABOUT[pageNow()] ?? "this page"}${a.fresh ? ", in a new conversation" : ""}`;
  // in the empty chat, the asks are chips; in the Ask menu, rows
  if (p.chips) return html`<div class="ask-chips">${asks.map(a => html`<button type="button" class="ask-chip" disabled=${a.on === "block" && !hasBlock}
    title=${a.on === "block" && !hasBlock ? "Select a block in the script first" : undefined} onClick=${() => { ask(a.id); p.onDone?.(); }}><span>${a.label}</span><small>${about(a)}</small></button>`)}</div>`;
  return html`<div class="menu">${asks.map(a => html`<button disabled=${a.on === "block" && !hasBlock} onClick=${() => { ask(a.id); p.onDone?.(); }}><b>${a.label}</b><small>${about(a)}</small></button>`)}</div>`;
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
  const a = abilities({ writable: w.writable, agentEdits: w.agentEdits ?? "proposals", shareCards: w.shareCards, cards: w.cards, page: pageNow(), web: typeof w.ai === "object" ? w.ai.web : null });
  return html`<div class="abilities">
    <div><b>It can</b><ul>${a.can.map(x => html`<li>${x}</li>`)}</ul></div>
    <div><b>It cannot</b><ul>${a.cannot.map(x => html`<li>${x}${/word cards/.test(x) ? html` <a href="#/agents/activity">Share them</a>` : ""}</li>`)}</ul></div></div>`;
}

const KIND_WORD: Record<string, string> = { story: "episode", season: "season", series: "series", place: "place", character: "character" };
/** A proposal the assistant made, with where to answer it; once answered, only that it was. */
function Proposed(p: { id: string }) {
  const x = proposals.value.find(y => y.id === p.id);
  if (!x) return html`<div class="tool ok">Proposed an edit (${p.id}): answered, no longer waiting.</div>`;
  const href = hrefOf(x.kind, x.doc), what = KIND_WORD[x.kind] ?? x.kind;
  if (x.create) return html`<div class="tool ok">${x.after ? `Updated the proposed new ${what}` : `Proposed a new ${what},`} <b>${x.doc}</b>. <a href=${href}>Open it</a> to accept or reject it; nothing is saved until you do.</div>`;
  return html`<div class="tool ok">Proposed an edit to the ${what} <b>${x.doc}</b>: <a href=${href}>accept or reject it</a> ${x.kind === "story" ? "above the script" : "on its page"}.</div>`;
}

/**
 * An episode's notes with a status the assistant asked to set, other than approved (approving signs the episode as it is,
 * on its Review tab): the signature of an earlier approval goes with it, so it is not read as approved and changed since.
 */
export function withStatus(r: EpisodeReview, status: NonNullable<EpisodeReview["status"]>): EpisodeReview {
  const { sig: _sig, ...rest } = r;
  return { ...rest, status };
}

/** A question for the person, as a card: its buttons answer it (the answer is sent as their message), save proposals, or set a status. */
function AskCard(p: { part: AskPart; latest: boolean }) {
  const [busy2, setBusy2] = useState(false);
  const x = p.part, open = !x.answered && p.latest && !busy.value;
  const answer = (said: string) => { x.answered = said; turns.value = [...turns.value]; };
  const waiting = (x.save ?? []).map(id => proposals.value.find(q => q.id === id)).filter((q): q is NonNullable<typeof q> => !!q);
  return html`<div class="ask-card" role="group" aria-label="The assistant asks">
    <b>${x.question}</b>${x.remember && html`<blockquote>${x.remember}</blockquote>`}
    ${x.save && html`<ul class="ask-list">${x.save.map(id => { const q = proposals.value.find(y => y.id === id); return html`<li>${q ? html`${q.summary} <span class="note">(${q.kind} ${q.doc})</span>` : html`<span class="note">${id}: answered already</span>`}</li>`; })}</ul>`}
    ${x.answered ? html`<div class="note">${x.answered}</div>` : html`<div class="row wrap">
      ${x.remember && html`<button class="primary" disabled=${busy2} onClick=${async () => { setBusy2(true); const r = await fetch("/api/memory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: x.remember }) }); setBusy2(false); answer(r.ok ? "Kept for later conversations." : "Not kept: backstage could not write it."); }}>Keep it</button>`}
      ${x.review && (x.review.status === "approved"
        // approving is a sign-off on a Ready episode: it happens on the episode's Review tab, which says what is missing
        ? html`<a class="button primary" href=${`#/episode/${x.review.id}/review`}>Open ${x.review.id}'s review</a>`
        : html`<button class="primary" disabled=${!p.latest || busy2} onClick=${() => { void setReview(x.review!.id, r => withStatus(r, x.review!.status as never)); answer(`Marked ${x.review!.id} ${x.review!.status}.`); }}>Mark ${x.review.status}</button>`)}
      ${waiting.length > 0 && html`<button class="primary" disabled=${busy2} onClick=${async () => { setBusy2(true); let n = 0; for (const q of waiting) if (await acceptAndSave(q)) n++; setBusy2(false); answer(n ? `Accepted and saved ${n} proposal${n > 1 ? "s" : ""}.` : "Nothing was saved."); }}>Accept and save ${waiting.length > 1 ? `all ${waiting.length}` : "it"}</button>`}
      ${(x.options ?? []).map(o => html`<button disabled=${!open} onClick=${() => { answer(`You answered: ${o}`); void send(o); }}>${o}</button>`)}
      ${(x.review || x.remember || waiting.length > 0) && html`<button disabled=${!open} onClick=${() => answer("Not now.")}>Not now</button>`}
    </div>`}
  </div>`;
}

/** An answer, its parts in order: thinking, runs of tool calls (one group each), words, cards. */
export function Answer(p: { turn: { content: string; parts?: Part[] }; live: boolean }) {
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
    else if (x.type === "confirm") out.push(html`<div class="confirm">${x.why} It would cost about ${fmtUsd(x.estimateUsd)}. ${(q => q && html`<button class="small primary" onClick=${() => void send(q.content, { confirm: true, fresh: q.fresh, files: picturesOf.get(q) })}>Go ahead</button>`)(askedBy(turns.value, p.turn))}</div>`);
    else if (x.type === "error") out.push(html`<div class="chat-error"><span class="grow">${x.message}</span>${!p.live && p.turn === turns.value.at(-1) && html`<button type="button" class="small" onClick=${retry}>Try again</button>`}</div>`);
    else if (x.type === "remembered") out.push(html`<div class="tool ok remembered">${x.undone ? html`Forgot: ${x.text}` : html`Remembered for later conversations: ${x.text} <button type="button" class="linkish" onClick=${async () => { const r = await fetch(`/api/memory/${x.id}`, { method: "DELETE" }); if (r.ok) { x.undone = true; turns.value = [...turns.value]; } }}>Undo</button>`}</div>`);
    else if (x.type === "sources") out.push(html`<div class="sources" aria-label="Sources">${x.list.map(s => html`<a class="chip" href=${s.url} target="_blank" rel="noreferrer" title=${s.title ?? s.url}>${hostOf(s.url)}</a>`)}</div>`);
    else if (x.type === "ask") out.push(html`<${AskCard} part=${x} latest=${p.turn === turns.value.at(-1)} />`);
    else if (x.type === "start_run") out.push(html`<${StartRunCard} part=${x} />`);
    else if (x.type === "stopped") out.push(html`<div class="note">Stopped. Nothing more ran after that.</div>`);
    else if (x.type === "done" && x.usd !== undefined) out.push(html`<div class="note cost">${fmtUsd(x.usd)}</div>`);
  }
  return html`${out}`;
}

/** A popover a button opens above (or below) itself and closes again (a click on the button while open closes it). */
function usePop(below = false): [{ x: number; y: number } | null, (e: MouseEvent, width: number) => void, () => void] {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null), shut = useRef(0);
  const toggle = (e: MouseEvent, width: number) => {
    if (at || Date.now() - shut.current < 300) return setAt(null);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAt({ x: Math.min(r.left, innerWidth - width - 8), y: below ? r.bottom + 6 : r.top - 6 });
  };
  return [at, toggle, () => { shut.current = Date.now(); setAt(null); }];
}

/** The ? atop the side panel: what the assistant can and cannot do here. */
export function AboutButton() {
  const [at, toggle, close] = usePop(true);
  return html`<button type="button" class="iconbtn about" title="What it can and cannot do here" aria-label="What it can and cannot do here" aria-expanded=${!!at} onClick=${(e: MouseEvent) => toggle(e, 420)}>?</button>
    ${at && html`<${Popover} x=${at.x} y=${at.y} label="What it can and cannot do here" onClose=${close}><${Abilities} /></${Popover}>`}`;
}

/** The Claude models the picker offers (ai/budget.ts prices them; a quick ask takes Sonnet whatever is picked). */
const CLAUDE = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "The strongest: drafts and reviews" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "Faster, and half the price" },
];
const modelName = (ai: { provider: string; model?: string }) => ai.provider === "anthropic" ? CLAUDE.find(m => m.id === (ai.model ?? CLAUDE[0]!.id))?.name ?? ai.model! : ai.model ?? "A local model";

interface LocalModel { id: string; loaded?: boolean; context?: number; kind?: string }
const ctxText = (n?: number) => (n ? `up to ${n >= 1000 ? `${Math.round(n / 1000)}k` : n} context` : "");

/** The model, in the composer: a pick saves it in the settings. A local server's models are listed (LM Studio's, loaded or not: it loads one when asked). */
function ModelPicker(p: { ai: { provider: string; model?: string; pinned?: boolean } }) {
  const [at, toggle, close] = usePop();
  const [local, setLocal] = useState<LocalModel[] | null>(null);
  useEffect(() => { if (at && p.ai.provider !== "anthropic") void api.get<{ models: LocalModel[] }>("models").then(r => setLocal(r.status === 200 ? r.models : [])); }, [!!at]);
  const now = p.ai.model ?? (p.ai.provider === "anthropic" ? CLAUDE[0]!.id : "");
  const pick = async (id: string) => {
    close();
    if (id === now) return;
    if (p.ai.pinned) return say("backstage was started with --ai-model: restart it without that to pick the model here", true);
    const r = await api.post("settings", { model: id });
    if (r.status !== 200) return say((r as { message?: string }).message ?? "the model was not changed", true);
    await loadWorld();
  };
  return html`<button type="button" class="model-pick" aria-haspopup="menu" aria-expanded=${!!at} title="The assistant's model" onClick=${(e: MouseEvent) => toggle(e, 300)}>
      <${Icon} name="spark" size=${14} /><span>${modelName(p.ai)}</span><${Icon} name="down" size=${14} /></button>
    ${at && html`<${Popover} above x=${at.x} y=${at.y} label="The assistant's model" onClose=${close}><div class="model-menu" role="menu">
      ${p.ai.pinned && html`<p class="note model-wait">Backstage was started with <code>--ai-model</code>, which sets the model over this menu. Start it without that to pick one here.</p>`}
      ${p.ai.provider === "anthropic" ? CLAUDE.map(m => html`<button type="button" role="menuitemradio" aria-checked=${m.id === now} disabled=${!!p.ai.pinned && m.id !== now} onClick=${() => void pick(m.id)}>
        <span><b>${m.name}</b><small>${m.note}</small></span>${m.id === now && html`<${Icon} name="check" size=${16} />`}</button>`)
        : html`${local === null ? html`<p class="note model-wait">Asking the local server for its models…</p>`
            : local.length ? html`<div class="model-list">${[...local].sort((a, b) => Number(!!b.loaded) - Number(!!a.loaded) || a.id.localeCompare(b.id)).map(m => html`<button type="button" role="menuitemradio" aria-checked=${m.id === now} onClick=${() => void pick(m.id)}>
                <span><b>${m.id}</b><small>${[m.loaded ? "loaded" : m.loaded === false ? "loads when first asked" : "", ctxText(m.context), m.kind === "vlm" ? "sees pictures" : ""].filter(Boolean).join(" · ")}</small></span>${m.id === now && html`<${Icon} name="check" size=${16} />`}</button>`)}</div>`
            : html`<p class="note model-wait">The local server listed no models: is it running?</p>`}
          <form class="model-local" onSubmit=${(e: Event) => { e.preventDefault(); const v = ((e.currentTarget as HTMLFormElement).elements.namedItem("m") as HTMLInputElement).value.trim(); if (v) void pick(v); }}>
          <label for="model-id">Or a model's id</label><input id="model-id" name="m" value=${local?.some(m => m.id === now) ? "" : p.ai.model ?? ""} placeholder="qwen3-coder, llama3.1…" /></form>`}
      <a class="model-more" href="#/settings" onClick=${close}><${Icon} name="settings" size=${14} /> Another provider, and the budget</a></div></${Popover}>`}`;
}

/** The conversation, in the side panel's Assistant tab. */
export function AssistantChat() {
  const w = world.value!;
  loadChats();
  const [text, setText] = useState("");
  const [past, setPast] = useState(false);
  const [files, setFiles] = useState<Attached[]>([]);
  const [drop, setDrop] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null), pick = useRef<HTMLInputElement>(null);
  // the message box grows with what is typed, up to its CSS max-height, and shrinks back once sent
  useEffect(() => { const b = box.current; if (b) { b.style.height = "auto"; b.style.height = `${b.scrollHeight}px`; } }, [text]);
  // while an answer runs nothing is sent, so what is typed (and attached) stays in the box for after it
  const go = () => { if (busy.value || (!text.trim() && !files.length)) return; void send(text.trim() || "Look at what I attached.", { files }); setText(""); setFiles([]); };
  /** Read dropped or pasted files: pictures (up to 5 MB, four at most) and text files (up to 200 KB). */
  const attach = async (list: FileList) => {
    const got: Attached[] = [];
    for (const f of [...list]) {
      if (/^image\/(png|jpeg|webp|gif)$/.test(f.type) && f.size <= 5e6) got.push({ name: f.name || "picture", mediaType: f.type, data: await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1] ?? ""); fr.readAsDataURL(f); }) });
      else if ((f.type.startsWith("text/") || /\.(json|md|txt|csv)$/i.test(f.name)) && f.size <= 2e5) got.push({ name: f.name, mediaType: f.type || "text/plain", data: "", text: await f.text() });
      else say(`${f.name}: only pictures (PNG, JPEG, WebP, GIF, up to 5 MB) and text files (up to 200 KB) can be attached`, true);
    }
    setFiles(fs => [...fs, ...got].filter((f, i, all) => f.text !== undefined || all.slice(0, i + 1).filter(x => x.text === undefined).length <= 4));
  };
  // the panel follows the answer while the person is at its bottom; scrolled up, it stays where they read
  const end = useStickToBottom<HTMLDivElement>(turns.value, scrollerOf);
  const ai = typeof w.ai === "object" ? w.ai : null;
  const ctx = contextNow();
  const empty = !turns.value.length;
  // History: the conversations and the tasks together, newest first (a task this backstage does not run, from its record)
  const history = [
    ...chats.value.map(c => ({ at: c.at, chat: c, task: null })),
    ...runs.value.map(r => ({ at: r.at, chat: null, task: { id: r.id, goal: r.goal, status: TASK_WORD[r.status], elsewhere: false } })),
    ...elsewhere().map(r => ({ at: r.createdAt, chat: null, task: { id: r.id, goal: r.goal, status: `last seen ${TASK_WORD[r.status] ?? r.status}`, elsewhere: true } })),
  ].sort((a, b) => b.at - a.at);
  return html`
    ${!w.ai ? html`<p>The assistant is off. For Claude, stop backstage and start it again with <code>ANTHROPIC_API_KEY</code> set in its environment (the key never goes in a file). Or choose a local model (LM Studio, Ollama) in <a href="#/settings">Settings</a>.</p>` : html`
    <div class="chat">
      ${empty && html`<div class="note">Ask anything about the series, or pick an ask. It sees ${ctx.id ? html`${ctx.kind === "season" ? "season " : ctx.kind === "place" ? "the place " : ctx.kind === "character" ? "the character " : ""}<b>${ctx.id}</b>${(ctx as { path?: Path }).path ? html` at <b>${(ctx as { path: Path }).path.slice(1).join(".")}</b>` : ""}` : `the ${ctx.page} page`}.<${AskMenu} chips /></div>`}
      ${turns.value.map((t, i) => html`<div class=${`turn ${t.role}${t.fresh ? " fresh" : ""}`}>
        ${t.role === "user" ? html`${t.files?.length ? html`<div class="files">${t.files.map(f => html`<span class="chip">📎 ${f}</span>`)}</div>` : ""}${t.files?.length ? t.content.replace(/\n\nFile [\s\S]*$/, "") : t.content}` : html`<${Answer} turn=${t} live=${busy.value && i === turns.value.length - 1} />`}
      </div>`)}
      ${busy.value && html`<div class="live-line" role="status" aria-live="polite"><span class="spin" aria-hidden="true"></span>${liveLine(turns.value.at(-1)?.parts ?? [], turns.value.at(-1)?.at ?? Date.now())}</div>`}
      <div ref=${end}></div>
    </div>
    <form class="chat-input" onSubmit=${(e: Event) => { e.preventDefault(); go(); }}>
      <div class=${`composer${drop ? " drop" : ""}`} onDragOver=${(e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) { e.preventDefault(); setDrop(true); } }}
        onDragLeave=${() => setDrop(false)} onDrop=${(e: DragEvent) => { setDrop(false); if (e.dataTransfer?.files.length) { e.preventDefault(); void attach(e.dataTransfer.files); } }}>
        ${files.length > 0 && html`<div class="files">${files.map((f, i) => html`<span class="chip">📎 ${f.name}<button type="button" class="linkish" aria-label=${`Remove ${f.name}`} onClick=${() => setFiles(files.filter((_, k) => k !== i))}>×</button></span>`)}</div>`}
        <textarea ref=${box} rows=${1} value=${text} placeholder="Ask the assistant…" aria-label="Message" onInput=${(e: Event) => setText((e.target as HTMLTextAreaElement).value)}
          onPaste=${(e: ClipboardEvent) => { if (e.clipboardData?.files.length) { e.preventDefault(); void attach(e.clipboardData.files); } }}
          onKeyDown=${(e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); go(); } }} />
        <div class="tools">
          <button type="button" class="iconbtn" title="Attach a picture or a text file (or paste or drop one here)" aria-label="Attach a file" onClick=${() => pick.current?.click()}><${Icon} name="clip" size=${17} /></button>
          <input ref=${pick} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,text/*,.json,.md,.txt,.csv" onChange=${(e: Event) => { const el = e.target as HTMLInputElement; if (el.files?.length) void attach(el.files); el.value = ""; }} />
          ${ai && html`<${ModelPicker} ai=${ai} />`}<span class="grow"></span>
          ${busy.value ? html`<button type="button" class="send stop" onClick=${stop} title="Stop the answer: nothing more runs" aria-label="Stop"><${Icon} name="stop" size=${15} /></button>`
            : html`<button class="send primary" title="Send (Enter) · Shift+Enter for a new line" aria-label="Send" disabled=${!text.trim() && !files.length}><${Icon} name="send" size=${17} /></button>`}
        </div>
      </div>
      <div class="meta"><button type="button" class="linkish" disabled=${busy.value || !turns.value.length} onClick=${() => { newChat(); setPast(false); }}><${Icon} name="plus" size=${14} /> New conversation</button>
        <button type="button" class="linkish" aria-expanded=${past} disabled=${!history.length} onClick=${() => { if (!past) void loadRecords(); setPast(!past); }}><${Icon} name="history" size=${14} /> History${history.length ? ` (${history.length})` : ""}</button></div>
      ${past && html`<div class="chat-history" role="list" aria-label="Past conversations and tasks">
        <p class="note">${chatsKept.value === "series" ? html`Kept with the series (<code>.backstage/</code>), with the tasks: everyone who works on it sees them. The newest ${KEEP_CHATS} conversations.` : html`This backstage is read-only, so conversations are kept in this browser only, the newest ${KEEP_LOCAL}. With <code>--write</code> they move to the series.`}</p>
        ${history.map(h => h.chat ? html`<div role="listitem" class=${`chat-past${h.chat.id === chatId.value ? " on" : ""}`}>
          <button type="button" class="open" disabled=${busy.value} onClick=${() => { void openChat(h.chat!.id); setPast(false); }}><span class="kind">Conversation</span><b>${h.chat.title}</b><small>${ago(h.at)} · ${h.chat.messages} message${h.chat.messages === 1 ? "" : "s"}${h.chat.id === chatId.value ? " · open now" : ""}</small></button>
          <button type="button" class="iconbtn" title="Delete this conversation" aria-label=${`Delete “${h.chat.title}”`} onClick=${() => void forgetChat(h.chat!.id)}><${Icon} name="trash" size=${14} /></button></div>`
          : html`<div role="listitem" class="chat-past"><a class="open" href=${`#/agents/tasks/${h.task!.id}`} onClick=${() => setPast(false)}><span class="kind">Task ${h.task!.id}${h.task!.elsewhere ? " · ran elsewhere" : ""}</span><b>${h.task!.goal}</b><small>${ago(h.at)} · ${h.task!.status}</small></a></div>`)}
      </div>`}
    </form>`}`;
}
