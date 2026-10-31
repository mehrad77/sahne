// A person's AI settings (Node only): which provider the assistant uses, its model and server, the budget's caps, when
// to ask before a big ask, and how the assistant edits. They live in the person's own config folder, not in the content
// root (its sidecar may be committed and shared; the settings and the usage log are one person's):
// <config>/settings.json, where <config> is $SAHNE_BACKSTAGE_CONFIG or ~/.config/sahne-backstage/. The environment
// overrides the file: SAHNE_AI_PROVIDER, SAHNE_AI_BASE_URL, SAHNE_AI_MODEL (the CLI's --ai-* flags set them). Keys are
// never stored: ANTHROPIC_API_KEY and OPENAI_API_KEY are read from the environment, and a key-like field sent to be saved
// is dropped.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentEdits } from "./mcp.ts";

export type ProviderId = "anthropic" | "openai";
export const PROVIDERS: ProviderId[] = ["anthropic", "openai"];

export interface Caps { dayUsd?: number; monthUsd?: number; dayTokens?: number; monthTokens?: number }

export interface Settings {
  provider: ProviderId;
  /** The model: for Anthropic, one of the price table's (ai/budget.ts); for an OpenAI-compatible server, its model name. */
  model?: string;
  /** An OpenAI-compatible server's base URL (LM Studio's is http://localhost:1234/v1). */
  baseUrl?: string;
  caps: Caps;
  /** Ask before an ask estimated to cost more than this (USD). */
  confirmOverUsd?: number;
  /** How the assistant edits (default: the server's --agent-edits). */
  agentEdits?: AgentEdits;
  /** The editor applies the assistant's suggestions without asking (the editor's own preference). */
  applySuggestions?: boolean;
  /** How the assistant searches the web: auto (Tavily when TAVILY_API_KEY is set, else Anthropic's own tools on Claude), one of them, or off. */
  web?: WebMode;
}

export type WebMode = "auto" | "anthropic" | "tavily" | "off";
export const WEB_MODES: WebMode[] = ["auto", "anthropic", "tavily", "off"];
/** The web the assistant has with these settings: Anthropic's server tools, Tavily (its key in the environment only), or none. */
export function webOf(s: Pick<Settings, "web" | "provider">): "anthropic" | "tavily" | null {
  const mode = s.web ?? "auto", tavily = !!process.env.TAVILY_API_KEY;
  if (mode === "off") return null;
  if (mode === "tavily") return tavily ? "tavily" : null;
  if (mode === "anthropic") return s.provider === "anthropic" ? "anthropic" : null;
  return tavily ? "tavily" : s.provider === "anthropic" ? "anthropic" : null;
}

/** LM Studio's default server; Ollama's is http://localhost:11434/v1, llama.cpp's http://localhost:8080/v1. */
export const LOCAL_BASE = "http://localhost:1234/v1";

export const DEFAULTS: Settings = { provider: "anthropic", caps: { dayUsd: 5, monthUsd: 50, dayTokens: 2_000_000, monthTokens: 20_000_000 }, confirmOverUsd: 0.5 };

/** The person's config folder. */
export const configDir = (): string => process.env.SAHNE_BACKSTAGE_CONFIG || join(homedir(), ".config", "sahne-backstage");
export const settingsFile = (): string => join(configDir(), "settings.json");

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
const url = (v: unknown) => {
  if (typeof v !== "string" || !v.trim()) return undefined;
  try { const u = new URL(v.trim()); return u.protocol === "http:" || u.protocol === "https:" ? u.href.replace(/\/+$/, "") : undefined; } catch { return undefined; }
};

/** Settings from JSON, cleaned: only the known fields, of the right types (a key or a token is never one of them). */
export function clean(v: unknown): Partial<Settings> {
  const b = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: Partial<Settings> = {};
  if (PROVIDERS.includes(b.provider as ProviderId)) out.provider = b.provider as ProviderId;
  if (typeof b.model === "string" && b.model.trim() && b.model.length <= 120 && !/^sk-|key/i.test(b.model)) out.model = b.model.trim();
  const base = url(b.baseUrl);
  if (base) out.baseUrl = base;
  if (b.caps && typeof b.caps === "object") {
    const c = b.caps as Record<string, unknown>, caps: Caps = {};
    for (const k of ["dayUsd", "monthUsd", "dayTokens", "monthTokens"] as const) { const n = num(c[k]); if (n !== undefined) caps[k] = n; }
    out.caps = caps;
  }
  const over = num(b.confirmOverUsd);
  if (over !== undefined) out.confirmOverUsd = over;
  if (b.agentEdits === "proposals" || b.agentEdits === "direct") out.agentEdits = b.agentEdits;
  if (typeof b.applySuggestions === "boolean") out.applySuggestions = b.applySuggestions;
  if (WEB_MODES.includes(b.web as WebMode)) out.web = b.web as WebMode;
  return out;
}

/** What the file holds (cleaned), or nothing. A read never creates the folder. */
export function fileSettings(): Partial<Settings> {
  const f = settingsFile();
  if (!existsSync(f)) return {};
  try { return clean(JSON.parse(readFileSync(f, "utf8"))); } catch { return {}; }
}

/** Which fields the environment sets, over the file. */
export function overrides(): Partial<Record<"provider" | "baseUrl" | "model", string>> {
  const o: Partial<Record<"provider" | "baseUrl" | "model", string>> = {};
  if (PROVIDERS.includes(process.env.SAHNE_AI_PROVIDER as ProviderId)) o.provider = "SAHNE_AI_PROVIDER";
  if (url(process.env.SAHNE_AI_BASE_URL)) o.baseUrl = "SAHNE_AI_BASE_URL";
  if (process.env.SAHNE_AI_MODEL?.trim()) o.model = "SAHNE_AI_MODEL";
  return o;
}

/** The settings in effect: the defaults, the file, then the environment. */
export function readSettings(): Settings {
  const f = fileSettings();
  const s: Settings = { ...DEFAULTS, ...f, caps: { ...DEFAULTS.caps, ...(f.caps ?? {}) } };
  const ov = overrides();
  if (ov.provider) s.provider = process.env.SAHNE_AI_PROVIDER as ProviderId;
  if (ov.baseUrl) s.baseUrl = url(process.env.SAHNE_AI_BASE_URL);
  if (ov.model) s.model = process.env.SAHNE_AI_MODEL!.trim();
  return s;
}

/**
 * Save settings sent from the editor: merged over the file's, cleaned, written atomically. Choosing the OpenAI-compatible
 * provider without a server names LM Studio's. Returns the settings in effect.
 */
export function writeSettings(v: unknown): Settings {
  const cur = fileSettings(), next = clean(v);
  const merged: Partial<Settings> = { ...cur, ...next, ...(next.caps ? { caps: next.caps } : {}) };
  if ((merged.provider ?? DEFAULTS.provider) === "openai" && !merged.baseUrl) merged.baseUrl = LOCAL_BASE;
  const f = settingsFile();
  mkdirSync(configDir(), { recursive: true });
  const tmp = `${f}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(merged, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, f);
  return readSettings();
}

/** Whether the assistant can run, and on what, without reaching the network. */
export function readiness(s: Settings = readSettings()): { ready: boolean; provider: ProviderId; model?: string; why?: string } {
  if (s.provider === "anthropic") {
    return process.env.ANTHROPIC_API_KEY
      ? { ready: true, provider: "anthropic", model: s.model }
      : { ready: false, provider: "anthropic", why: "start backstage with ANTHROPIC_API_KEY set, or choose a local model" };
  }
  return s.baseUrl ? { ready: true, provider: "openai", model: s.model } : { ready: false, provider: "openai", why: "set the server's base URL (LM Studio: http://localhost:1234/v1)" };
}
