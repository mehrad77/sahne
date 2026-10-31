// What the assistant spends (Node only): the price of each model in one place, a log of every call, and the caps a call
// is refused at. The log is <config>/usage.jsonl (settings.ts `configDir`), one JSON line per call: { at, provider, model,
// input, output, cacheRead, cacheWrite, tokens, usd }. It is in the person's config folder, not the content root's sidecar,
// since a content root may be committed and shared and what one person spends is theirs. Caps are per day and per month
// (local time), in USD and in tokens; the token caps bind local models too, which cost nothing.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { configDir, type Caps, type ProviderId } from "../settings.ts";

/**
 * USD per million tokens, from the Claude API's model and prompt-caching docs (claude-api skill, shared/models.md and
 * shared/prompt-caching.md, October 2026): input, output, cache reads, and cache writes (1.25× input, 5-minute TTL).
 */
export const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

export interface Usage { input: number; output: number; cacheRead?: number; cacheWrite?: number; /** Anthropic web searches (server tools), each priced on its own. */ searches?: number }
/** What one Anthropic web search costs (USD): $10 per 1000. */
export const SEARCH_USD = 0.01;

export const tokensOf = (u: Usage) => u.input + u.output + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);

/** What a call cost. Local models (an OpenAI-compatible server) cost nothing; an Anthropic model not in the table is priced as the dearest one. */
export function costOf(provider: ProviderId, model: string, u: Usage): number {
  if (provider !== "anthropic") return 0;
  const p = PRICES[model] ?? Object.values(PRICES).reduce((a, b) => (b.output > a.output ? b : a));
  return (u.input * p.input + u.output * p.output + (u.cacheRead ?? 0) * p.cacheRead + (u.cacheWrite ?? 0) * p.cacheWrite) / 1e6 + (u.searches ?? 0) * SEARCH_USD;
}

export const usageFile = (): string => join(configDir(), "usage.jsonl");

export interface Entry { at: string; provider: ProviderId; model: string; input: number; output: number; cacheRead: number; cacheWrite: number; tokens: number; usd: number }
export interface Totals { today: { usd: number; tokens: number }; month: { usd: number; tokens: number } }

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Today's and this month's spending (local time), from the log. */
export function totals(now = new Date()): Totals {
  const out: Totals = { today: { usd: 0, tokens: 0 }, month: { usd: 0, tokens: 0 } };
  const f = usageFile();
  if (!existsSync(f)) return out;
  const today = day(now), month = today.slice(0, 7);
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let e: Entry;
    try { e = JSON.parse(line); } catch { continue; }
    const d = day(new Date(e.at));
    if (d.slice(0, 7) !== month) continue;
    out.month.usd += e.usd || 0; out.month.tokens += e.tokens || 0;
    if (d === today) { out.today.usd += e.usd || 0; out.today.tokens += e.tokens || 0; }
  }
  return out;
}

export class BudgetError extends Error {}

const money = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

/** Refuse a call when a cap is reached. */
export function guard(caps: Caps, t: Totals = totals()): void {
  const at = (what: string, spent: string, cap: string) => { throw new BudgetError(`the ${what} cap is reached (${spent} of ${cap}): raise it in the assistant's settings, or wait`); };
  if (caps.dayUsd !== undefined && t.today.usd >= caps.dayUsd) at("daily spending", money(t.today.usd), money(caps.dayUsd));
  if (caps.monthUsd !== undefined && t.month.usd >= caps.monthUsd) at("monthly spending", money(t.month.usd), money(caps.monthUsd));
  if (caps.dayTokens !== undefined && t.today.tokens >= caps.dayTokens) at("daily token", `${t.today.tokens}`, `${caps.dayTokens}`);
  if (caps.monthTokens !== undefined && t.month.tokens >= caps.monthTokens) at("monthly token", `${t.month.tokens}`, `${caps.monthTokens}`);
}

/** Log one call; returns its entry. */
export function record(provider: ProviderId, model: string, u: Usage, now = new Date()): Entry {
  const e: Entry = { at: now.toISOString(), provider, model, input: u.input, output: u.output, cacheRead: u.cacheRead ?? 0, cacheWrite: u.cacheWrite ?? 0, tokens: tokensOf(u), usd: costOf(provider, model, u) };
  mkdirSync(configDir(), { recursive: true });
  appendFileSync(usageFile(), JSON.stringify(e) + "\n", { mode: 0o600 });
  return e;
}
