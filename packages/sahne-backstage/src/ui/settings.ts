// Settings (#/settings): the assistant's model (Claude, or any OpenAI-compatible server such as LM Studio or Ollama, by
// its base URL), the budget (caps per day and month, in dollars and in tokens, which hold for local models too, and the
// cost above which an ask waits for a yes), how agents' edits land (as proposals, or written), and whether the rules'
// staging suggestions are taken as you leave a line. They are kept in this person's config folder
// (`~/.config/sahne-backstage/settings.json`), never in the content root; API keys stay in the environment.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { api } from "../api.ts";
import { loadWorld, say } from "../store.ts";
import { usage } from "../events.ts";

export interface Settings {
  provider: "anthropic" | "openai"; model?: string; baseUrl?: string;
  caps: { dayUsd?: number; monthUsd?: number; dayTokens?: number; monthTokens?: number };
  confirmOverUsd?: number; agentEdits?: "proposals" | "direct"; applySuggestions?: boolean;
}
interface Answer { settings: Settings; file: string; overrides: Record<string, string>; keys: { anthropic: boolean; openai: boolean } }

/** The settings as last read (the studio reads `applySuggestions`). */
let current: Settings | null = null;
export const settingsNow = () => current;
export async function loadSettings() { const r = await api.get<Answer>("settings"); if (r.status === 200) current = r.settings; return r; }

export function SettingsPage() {
  const [a, setA] = useState<Answer | null>(null), [s, setS] = useState<Settings | null>(null);
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
    <div class="pagehead"><h2 class="grow">Settings</h2><span class="note">Kept in <code>${a.file}</code>, for you only.</span></div>
    <div class="step-card fields"><h3>The assistant's model</h3>
      <div class="segmented" role="group" aria-label="Provider">
        <button aria-pressed=${s.provider === "anthropic"} onClick=${() => put("provider", "anthropic")}>Claude</button>
        <button aria-pressed=${s.provider === "openai"} onClick=${() => put("provider", "openai")}>A local model (LM Studio, Ollama…)</button></div>
      ${over("provider")}
      ${s.provider === "anthropic"
        ? html`<p class="note">${a.keys.anthropic ? "The API key is set (ANTHROPIC_API_KEY)." : html`No key: start backstage with <code>ANTHROPIC_API_KEY</code> set. Keys never go in a file.`}</p>`
        : html`<div class="field"><label>Base URL${over("baseUrl")}</label><input value=${s.baseUrl ?? ""} placeholder="http://localhost:1234/v1" onInput=${(e: Event) => put("baseUrl", (e.target as HTMLInputElement).value || undefined)} /></div>
          <p class="note">LM Studio serves at <code>http://localhost:1234/v1</code>, Ollama at <code>http://localhost:11434/v1</code>. Use a model that calls tools.${a.keys.openai ? " OPENAI_API_KEY is set." : ""}</p>`}
      <div class="field"><label>Model${over("model")}</label><input value=${s.model ?? ""} placeholder=${s.provider === "anthropic" ? "claude-sonnet-5-5 (claude-opus-5-5 for drafts and reviews)" : "the model's id on the server"} onInput=${(e: Event) => put("model", (e.target as HTMLInputElement).value || undefined)} /></div>
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
    <div class="step-card fields"><h3>Agents and suggestions</h3>
      <div class="field"><label>When the assistant or an outside agent (over MCP) edits</label>
        <div class="segmented" role="group"><button aria-pressed=${(s.agentEdits ?? "proposals") === "proposals"} onClick=${() => put("agentEdits", "proposals")}>it proposes; I accept</button>
          <button aria-pressed=${s.agentEdits === "direct"} onClick=${() => put("agentEdits", "direct")}>it writes, checked</button></div>
        <p class="note">Takes effect when backstage starts again (or with <code>--agent-edits</code>).</p></div>
      <label class="row"><input type="checkbox" style="width:auto" checked=${!!s.applySuggestions} onChange=${(e: Event) => put("applySuggestions", (e.target as HTMLInputElement).checked)} /> Take the rules' staging suggestions as I leave each line</label>
    </div>
    <div class="row"><span class="grow"></span><button class="primary" onClick=${() => void save()}>Save the settings</button></div>
  </section>`;
}
