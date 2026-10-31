// Settings (#/settings): the assistant's provider (Claude, or any OpenAI-compatible server such as LM Studio or Ollama, by
// its base URL; the model itself is picked in the chat), the budget (caps per day and month, in dollars and in tokens, which hold for local models too, and the
// cost above which an ask waits for a yes), and whether the rules' staging suggestions are taken as you leave a line. They are kept in this person's config folder
// (`~/.config/sahne-backstage/settings.json`), never in the content root; API keys stay in the environment.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { api } from "../api.ts";
import { loadWorld, say } from "../store.ts";
import { usage } from "../events.ts";
import { JsonCode } from "./kit/json.ts";

export interface Settings {
  provider: "anthropic" | "openai"; model?: string; baseUrl?: string;
  caps: { dayUsd?: number; monthUsd?: number; dayTokens?: number; monthTokens?: number };
  confirmOverUsd?: number; agentEdits?: "proposals" | "direct"; applySuggestions?: boolean; web?: "auto" | "anthropic" | "tavily" | "off";
}
interface Answer { settings: Settings; file: string; overrides: Record<string, string>; keys: { anthropic: boolean; openai: boolean; tavily?: boolean }; web?: "anthropic" | "tavily" | null; /** The file as it is on disk, null before the first save. */ raw?: string | null }

/** The settings as last read (the studio reads `applySuggestions`). */
let current: Settings | null = null;
export const settingsNow = () => current;
export async function loadSettings() { const r = await api.get<Answer>("settings"); if (r.status === 200) current = r.settings; return r; }

/** What the assistant remembers: the notes kept in the series (.backstage/memory.json), each to delete. */
function Memory() {
  const [notes, setNotes] = useState<{ id: string; text: string; at: number }[] | null>(null);
  useEffect(() => { void fetch("/api/memory").then(r => r.json()).then(j => setNotes(j.notes ?? [])).catch(() => setNotes([])); }, []);
  const drop = async (id: string) => { const r = await fetch(`/api/memory/${id}`, { method: "DELETE" }); if (r.ok) setNotes((await r.json()).notes); else say("not deleted: backstage is read-only", true); };
  return html`<div class="step-card fields"><h3>What the assistant remembers</h3>
    <p class="note">Notes it keeps between conversations, in the series (<code>.backstage/memory.json</code>): everyone who works on it shares them, and they are committed with it.</p>
    ${notes === null ? html`<p class="note">Reading…</p>` : !notes.length ? html`<p class="note">Nothing yet. Tell it a preference and it may keep it.</p>`
      : html`<ul class="memory">${notes.map(n => html`<li class="row"><span class="grow">${n.text} <small class="note">${new Date(n.at).toLocaleDateString()}</small></span><button class="small" onClick=${() => void drop(n.id)}>Delete</button></li>`)}</ul>`}
  </div>`;
}

export function SettingsPage() {
  const [a, setA] = useState<Answer | null>(null), [s, setS] = useState<Settings | null>(null), [raw, setRaw] = useState(false);
  useEffect(() => { void loadSettings().then(r => { if (r.status === 200) { setA(r); setS(r.settings); } }); }, []);
  if (!a || !s) return html`<p class="note">Opening the settings…</p>`;
  const put = (k: keyof Settings, v: unknown) => setS({ ...s, [k]: v } as Settings);
  const cap = (k: keyof Settings["caps"], v: string) => setS({ ...s, caps: { ...s.caps, [k]: v === "" ? undefined : Number(v) } });
  const save = async () => {
    const r = await api.post<Answer>("settings", s);
    if (r.status !== 200) { say((r as { message?: string }).message ?? "not saved", true); return; }
    setA(r); setS(r.settings); current = r.settings; say("settings saved");
    await loadWorld();
    void fetch("/api/usage").then(x => x.json()).then(u => { usage.value = u; });
  };
  const over = (k: string) => a.overrides?.[k] ? html` <small class="note">(set by ${a.overrides[k]})</small>` : "";
  const u = usage.value;
  return html`<section class="settings">
    <div class="pagehead"><h2 class="grow">Settings</h2><span class="note">Kept in <code>${a.file}</code>, for you only.</span>
      <label class="switch"><input type="checkbox" role="switch" checked=${raw} onChange=${(e: Event) => setRaw((e.target as HTMLInputElement).checked)} /> Raw JSON</label></div>
    ${raw ? html`<div class="step-card"><p class="note">${a.raw == null ? "No file yet: the defaults are in effect, shown here as they would be saved." : "The file as saved, read-only. Edit the settings with the form."}${Object.keys(a.overrides ?? {}).length ? ` The environment sets ${Object.values(a.overrides).join(", ")} over it.` : ""}</p>
      <${JsonCode} class="settings-raw" name=${a.file.split("/").pop()} label="The settings file, read-only" text=${a.raw ?? JSON.stringify(a.settings, null, 2)} /></div>` : html`
    <div class="step-card fields"><h3>The assistant's model</h3>
      <div class="segmented" role="group" aria-label="Provider">
        <button aria-pressed=${s.provider === "anthropic"} onClick=${() => put("provider", "anthropic")}>Claude</button>
        <button aria-pressed=${s.provider === "openai"} onClick=${() => put("provider", "openai")}>A local model (LM Studio, Ollama…)</button></div>
      ${over("provider")}
      ${s.provider === "anthropic"
        ? html`<p class="note">${a.keys.anthropic ? "The API key is set (ANTHROPIC_API_KEY)." : html`No key: start backstage with <code>ANTHROPIC_API_KEY</code> set. Keys never go in a file.`}</p>`
        : html`<div class="field"><label>Base URL${over("baseUrl")}</label><input value=${s.baseUrl ?? ""} placeholder="http://localhost:1234/v1" onInput=${(e: Event) => put("baseUrl", (e.target as HTMLInputElement).value || undefined)} /></div>
          <p class="note">LM Studio serves at <code>http://localhost:1234/v1</code>, Ollama at <code>http://localhost:11434/v1</code>. Use a model that calls tools.${a.keys.openai ? " OPENAI_API_KEY is set." : ""}</p>`}
      <p class="note">The model is picked in the assistant's chat, beside the message box${a.overrides?.model ? html` (now set by <code>${a.overrides.model}</code>)` : ""}.</p>
    </div>
    <div class="step-card fields"><h3>The budget</h3>
      ${u && html`<p>Today ${"$"}${u.today.usd.toFixed(3)} and ${u.today.tokens.toLocaleString()} tokens; this month ${"$"}${u.month.usd.toFixed(2)}.</p>`}
      <div class="row">
        <div class="field grow"><label>A day, in dollars</label><input type="number" min="0" step="0.5" value=${s.caps.dayUsd ?? ""} onInput=${(e: Event) => cap("dayUsd", (e.target as HTMLInputElement).value)} /></div>
        <div class="field grow"><label>A month, in dollars</label><input type="number" min="0" step="1" value=${s.caps.monthUsd ?? ""} onInput=${(e: Event) => cap("monthUsd", (e.target as HTMLInputElement).value)} /></div>
        <div class="field grow"><label>Tokens a day</label><input type="number" min="0" step="100000" value=${s.caps.dayTokens ?? ""} onInput=${(e: Event) => cap("dayTokens", (e.target as HTMLInputElement).value)} /></div>
        <div class="field grow"><label>Tokens a month</label><input type="number" min="0" step="1000000" value=${s.caps.monthTokens ?? ""} onInput=${(e: Event) => cap("monthTokens", (e.target as HTMLInputElement).value)} /></div>
      </div>
      <div class="field"><label>Ask first when an ask would cost more than (dollars)</label><input type="number" min="0" step="0.1" style="max-width:160px" value=${s.confirmOverUsd ?? ""} onInput=${(e: Event) => put("confirmOverUsd", (e.target as HTMLInputElement).value === "" ? undefined : Number((e.target as HTMLInputElement).value))} /></div>
      <p class="note">At a cap the assistant stops and says so. A local model costs nothing, but its tokens count against the token caps.</p>
    </div>
    <div class="step-card fields"><h3>The web</h3>
      <div class="segmented" role="group" aria-label="How the assistant searches the web">
        ${([["auto", "Automatic"], ["anthropic", "Anthropic's search"], ["tavily", "Tavily"], ["off", "Off"]] as const).map(([k, label]) => html`<button aria-pressed=${(s.web ?? "auto") === k} onClick=${() => put("web", k)}>${label}</button>`)}</div>
      <p class="note">${a.web ? html`In effect: <b>${a.web === "tavily" ? "Tavily" : "Anthropic's search"}</b>. ` : "In effect: no web. "}Automatic takes Tavily when <code>TAVILY_API_KEY</code> is set${a.keys.tavily ? " (it is)" : ""}, else Anthropic's own search on Claude (a cent a search), and none with a local model and no Tavily key. Keys come from backstage's environment, never a file.</p>
    </div>
    <${Memory} />
    <div class="step-card fields"><h3>Staging suggestions</h3>
      <label class="row"><input type="checkbox" style="width:auto" checked=${!!s.applySuggestions} onChange=${(e: Event) => put("applySuggestions", (e.target as HTMLInputElement).checked)} /> Take the rules' staging suggestions as I leave each line</label>
    </div>
    <div class="row"><span class="grow"></span><button class="primary" onClick=${() => void save()}>Save the settings</button></div>`}
  </section>`;
}
