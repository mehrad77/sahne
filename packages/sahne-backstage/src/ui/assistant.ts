// The assistant (server/assistant.ts): a conversation in a drawer beside any page, with what is open as its context (the
// page, the episode, the selected block), and one-click asks where you work (`ask`): fill the missing translations,
// simplify a line, suggest staging, propose choice options, check a scene, draft an episode from its brief, and a second
// reader that never saw the drafting. Its answer streams in, with the tools it uses; its edits arrive as proposals (or
// are written, in direct mode), never as hidden changes. A big ask says what it would cost and waits for a yes. It runs
// on Claude or on any OpenAI-compatible server (LM Studio, Ollama), within the budget (#/settings).

import { html } from "htm/preact";
import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Path } from "../model/path.ts";
import { route, say, world } from "../store.ts";
import { selection, usage } from "../events.ts";
import { Drawer, Icon } from "./kit/index.ts";

type Part = { type: "text"; text: string } | { type: "tool"; name: string; input?: unknown; ok?: boolean; summary?: string } | { type: "proposal"; id: string } | { type: "confirm"; estimateUsd: number; why: string } | { type: "error"; message: string } | { type: "done"; usd?: number };
interface Turn { role: "user" | "assistant"; content: string; parts?: Part[]; fresh?: boolean }

export const assistantOpen = signal(false);
const turns = signal<Turn[]>([]);
const busy = signal(false);

/** One-click asks, by what is selected. */
export const ASKS: { id: string; label: string; prompt: string; on: "block" | "episode"; fresh?: boolean }[] = [
  { id: "translate", label: "Fill the missing translations", prompt: "Fill in every missing translation in this episode (only the series' languages), natural and at the episode's level. Propose them.", on: "episode" },
  { id: "simplify", label: "Simplify this line", prompt: "Make the selected line simpler and more natural at the episode's level, keeping its meaning and the words it teaches. Update its translations too. Propose it.", on: "block" },
  { id: "stage", label: "Suggest staging for this line", prompt: "Suggest staging for the selected line: a gesture, a feeling, whom it is said to, what it points at, with a one-line reason each. Propose the best one.", on: "block" },
  { id: "options", label: "Propose choice options", prompt: "Propose two or three options for the learner's choice at or after the selected block, one clearly fitting, in every language, with a reply each. Propose them.", on: "block" },
  { id: "scene", label: "Check this scene", prompt: "Read the scene the selected block is in and tell me what does not work: words, translations, staging, who is spoken to. Be brief, and propose fixes only for clear mistakes.", on: "block" },
  { id: "draft", label: "Draft this episode from its brief", prompt: "This episode is a draft. Write its steps and quiz from its title, premise, cast, place, target words and lessons, in the series' languages, using the place's marks. Propose the result.", on: "episode" },
  { id: "second", label: "Second reader", prompt: "Review this episode as a careful second reader who did not write it: the main language, the translations against it, the quiz, the staging. List what must be fixed, most important first. Propose fixes for clear mistakes.", on: "episode", fresh: true },
];

/** The context the assistant gets: the page and what is selected on it. */
const contextNow = () => { const s = selection.value, r = route.value; return { page: r[0] ?? "board", ...(s?.kind ? { kind: s.kind } : {}), ...(s?.id ?? (r[0] === "episode" ? r[1] : undefined) ? { id: s?.id ?? r[1] } : {}), ...(s?.path ? { path: s.path } : {}) }; };

/** Send a message (or an ask), streaming the answer into the conversation. */
export async function send(content: string, o: { fresh?: boolean; confirm?: boolean } = {}) {
  if (busy.value || !content.trim()) return;
  assistantOpen.value = true;
  const history = o.fresh ? [] : turns.value.filter(t => !t.fresh || t.role === "user").map(t => ({ role: t.role, content: t.content }));
  if (!o.confirm) turns.value = [...turns.value, { role: "user", content, fresh: o.fresh }];
  const reply: Turn = { role: "assistant", content: "", parts: [], fresh: o.fresh };
  turns.value = [...turns.value, reply];
  const update = (fn: (t: Turn) => void) => { fn(reply); turns.value = [...turns.value.slice(0, -1), { ...reply, parts: [...(reply.parts ?? [])] }]; };
  busy.value = true;
  try {
    const r = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [...history, { role: "user", content }], context: contextNow(), fresh: !!o.fresh, confirm: !!o.confirm }) });
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
        const e = JSON.parse(data) as Part & { usage?: { usd?: number } };
        update(t => {
          if (e.type === "text") { t.content += e.text; const last = t.parts!.at(-1); if (last?.type === "text") last.text += e.text; else t.parts!.push({ type: "text", text: e.text }); }
          else if (e.type === "tool") t.parts!.push({ type: "tool", name: e.name, input: e.input });
          else if ((e as { type: string }).type === "tool_result") { const x = e as unknown as { name: string; ok: boolean; summary: string }; const tool = [...t.parts!].reverse().find(p => p.type === "tool" && p.name === x.name && p.ok === undefined) as Extract<Part, { type: "tool" }> | undefined; if (tool) { tool.ok = x.ok; tool.summary = x.summary; } }
          else if (e.type === "done") t.parts!.push({ type: "done", usd: e.usage?.usd });
          else t.parts!.push(e);
        });
      }
    }
  } catch (e) { update(t => t.parts!.push({ type: "error", message: (e as Error).message })); }
  finally { busy.value = false; }
}

/** An ask from the list, about what is selected. */
export function ask(id: string) {
  const a = ASKS.find(x => x.id === id);
  if (!a) return;
  if (a.on === "block" && !selection.value?.path) { say("Select a block of the script first", true); return; }
  void send(a.prompt, { fresh: a.fresh });
}

/** The asks as a menu (where you work). */
export function AskMenu(p: { onDone?(): void }) {
  const w = world.value!;
  if (!w.ai) return html`<p class="note">The assistant is off: set it up in <a href="#/settings">Settings</a>.</p>`;
  const hasBlock = !!selection.value?.path;
  return html`<div class="menu">${ASKS.map(a => html`<button disabled=${a.on === "block" && !hasBlock} onClick=${() => { ask(a.id); p.onDone?.(); }}><b>${a.label}</b><small>${a.on === "block" ? "the selected block" : "the whole episode"}${a.fresh ? ", in a new conversation" : ""}</small></button>`)}</div>`;
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

/** The conversation drawer. */
export function AssistantDrawer() {
  const w = world.value!;
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns.value]);
  if (!assistantOpen.value) return null;
  const ai = typeof w.ai === "object" ? w.ai : null;
  const ctx = contextNow();
  return html`<${Drawer} title=${html`<${Icon} name="spark" size=${16} /> Assistant ${ai ? html`<small class="note">${ai.provider} · ${ai.model ?? ""}</small>` : ""}`} label="Assistant" onClose=${() => { assistantOpen.value = false; }}>
    ${!w.ai ? html`<p>The assistant is off. Set up Claude (an API key) or a local model (LM Studio, Ollama) in <a href="#/settings">Settings</a>.</p>` : html`
    <div class="chat">
      ${!turns.value.length && html`<div class="note">Ask anything about the series, or pick an ask. It sees ${ctx.id ? html`<b>${ctx.id}</b>${(ctx as { path?: Path }).path ? html` at <b>${(ctx as { path: Path }).path.slice(1).join(".")}</b>` : ""}` : `the ${ctx.page}`}, and its edits arrive as proposals to accept.<${AskMenu} /></div>`}
      ${turns.value.map(t => html`<div class=${`turn ${t.role}${t.fresh ? " fresh" : ""}`}>
        ${t.role === "user" ? t.content : (t.parts ?? []).map(p => p.type === "text" ? html`<div class="said">${p.text}</div>`
          : p.type === "tool" ? html`<div class=${`tool${p.ok === false ? " bad" : ""}`}><${Icon} name="settings" size=${12} /> ${p.name}${p.summary ? `: ${p.summary}` : p.ok === undefined ? " …" : ""}</div>`
          : p.type === "proposal" ? html`<div class="tool ok">Proposed an edit: accept or reject it above the script.</div>`
          : p.type === "confirm" ? html`<div class="confirm">${p.why} It would cost about ${fmtUsd(p.estimateUsd)}. <button class="small primary" onClick=${() => { const q = [...turns.value].reverse().find(x => x.role === "user"); if (q) void send(q.content, { confirm: true, fresh: q.fresh }); }}>Go ahead</button></div>`
          : p.type === "error" ? html`<div class="tool bad">${p.message}</div>`
          : html`<div class="note">${p.usd !== undefined ? fmtUsd(p.usd) : ""}</div>`)}
      </div>`)}
      ${busy.value && html`<div class="note">Thinking…</div>`}
      <div ref=${end}></div>
    </div>
    <form class="chat-input" onSubmit=${(e: Event) => { e.preventDefault(); void send(text); setText(""); }}>
      <textarea rows=${2} value=${text} placeholder="Ask the assistant…" aria-label="Message" onInput=${(e: Event) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown=${(e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); setText(""); } }} />
      <div class="row"><button type="button" class="small" onClick=${() => { turns.value = []; }}>New conversation</button><span class="grow"></span><button class="primary" disabled=${busy.value || !text.trim()}>Send</button></div>
    </form>`}
  </${Drawer}>`;
}
