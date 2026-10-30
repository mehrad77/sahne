// Backstage as an MCP server (Node only): the tools an agent (Claude Code, the editor's own assistant, any MCP client)
// uses to read and edit the content root, every one through content.ts, so an agent's edit passes the same check as a
// person's. Served over Streamable HTTP at /mcp (http.ts), over stdio (`cli.ts mcp`), and in memory to the assistant.
//
// Edits follow the agent-edits mode:
//   proposals (the default)  a write tool computes the whole new document, checks it, and queues it (proposals.ts) for a
//                            person to accept in the editor. Nothing is written.
//   direct                   a write tool saves (content.ts `save`: 403 read-only, 400 a refused id, 409 changed on disk,
//                            422 a new error) and tells the open editors (`doc` event).
// Either way an edit that brings a new error is refused, and nothing is edited while backstage is read-only (no --write,
// or a root in the old language shape). Review comments are notes, not content: `comment` writes the sidecar at once
// (with --write) in both modes; `set_review` is direct mode's only, since in proposals mode a person decides where an
// episode stands.
//
// What an agent learns of the word cards: their ids and levels, and with --share-cards the main language's word. Never
// a card's translations, notes or lesson text.

import { readFileSync } from "node:fs";
import * as z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IS_SAMPLES } from "../../sahne-story/paths.ts";
import { arcId } from "../../sahne-story/check/rules.ts";
import { allLanguages, languagesOf, seasonOf, textOf, type Languages, type SeasonDoc, type SeriesDoc, type StoryPlace } from "../../sahne-story/src/index.ts";
import { check, exists, forget, idsOf, kit as kitOf, listing, oldShape, readDoc, save, searchCards, type Edit, type Kind, type Problem } from "./content.ts";
import { readReview, STATUSES, writeReview, type EpisodeReview } from "./review.ts";
import type { Call } from "./agents.ts";
import type { Events, Selection } from "./events.ts";
import { latestOf, proposalsOf, type ProposalEdit, type Queue } from "./proposals.ts";
import { get, insert, move, set, type Key } from "../src/model/path.ts";
import { skeleton } from "../src/model/skeleton.ts";

export type AgentEdits = "proposals" | "direct";

export interface McpOptions {
  /** Backstage may write (--write). */
  write: boolean;
  /** Where an agent's edits go. */
  agentEdits: AgentEdits;
  /** search_words may show a card's main-language word (--share-cards). */
  shareCards: boolean;
  events: Events;
  /** Where proposals go (default: this process's queue). */
  queue?: Queue;
  /** Who the edits are by (the assistant says "assistant"); default the MCP client's name. */
  by?: string;
  /** Read the content root again before each call (stdio: another process may write the same files). */
  fresh?: boolean;
  /** The open editor's selection (default: the one posted to this process). */
  selection?: () => Promise<Selection | null> | Selection | null;
  /** Told of every tool call, for the editor's Agents page (agents.ts). */
  onCall?(c: Call): void;
}

const FORMAT = new URL("../../sahne-story/README.md", import.meta.url);

/** The staging keys a line, an option or a beat carries beside its texts, in the editor's order. */
const STAGING = ["to", "emo", "do", "at", "cam", "voice", "tempo", "n", "loop", "obj", "move", "react", "link", "sfx", "env", "via", "on", "wait", "frame", "looks", "costume"];

// ---- small helpers -----------------------------------------------------------------------------------------------------

class Refusal extends Error {}

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
/** An answer: a line for the agent, then the data as JSON in its own block. */
const ok = (text: string, data?: unknown): Result => ({ content: [{ type: "text", text }, ...(data === undefined ? [] : [{ type: "text" as const, text: JSON.stringify(data, null, 1) }])] });
const fail = (text: string): Result => ({ isError: true, content: [{ type: "text", text }] });

const BAD_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/** A path as a tool takes it: "steps/3/choice/options/1", a step number, or a list of keys. Numbers become numbers. */
export function pathOf(p: unknown): Key[] {
  let keys: Key[];
  if (typeof p === "number") keys = ["steps", p];
  else if (Array.isArray(p)) keys = p.map(k => (typeof k === "number" ? k : /^\d+$/.test(String(k)) ? Number(k) : String(k)));
  else if (typeof p === "string") keys = p.replace(/^\/+|\/+$/g, "").split("/").filter(s => s !== "").map(s => (/^\d+$/.test(s) ? Number(s) : s));
  else throw new Refusal("a path is like \"steps/3\" or \"steps/12/choice/options/0\"");
  if (typeof keys[0] === "number") keys = ["steps", ...keys];
  if (!keys.length) throw new Refusal("the path is empty");
  for (const k of keys) if (typeof k === "string" && BAD_KEYS.has(k)) throw new Refusal(`no such path: ${k}`);
  return keys;
}
const pathText = (p: readonly Key[]) => p.join("/");

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** RFC 7386 merge patch: objects merge key by key, null removes a key, anything else replaces. */
function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isObject(patch)) return patch;
  const out: Record<string, unknown> = isObject(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (BAD_KEYS.has(k)) continue;
    if (v === null) delete out[k];
    else out[k] = mergePatch(out[k], v);
  }
  return out;
}

/** A step key of the review notes: "12", "12.0" (an option), "12.0.1" (its reply). */
function stepKey(p: readonly Key[]): string | undefined {
  if (p[0] !== "steps" || typeof p[1] !== "number") return undefined;
  const out = [p[1]];
  if (p[2] === "choice" && p[3] === "options" && typeof p[4] === "number") {
    out.push(p[4]);
    if (p[5] === "reply" && typeof p[6] === "number") out.push(p[6]);
  }
  return out.join(".");
}

const fmt = (p: Problem) => `${p.level}${p.new ? " (new)" : ""} [${p.rule}] ${p.doc}${p.step !== undefined ? ` step ${p.step}` : ""}: ${p.message}`;
const short = (v: unknown, n = 140) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const now = () => { const d = new Date(), z2 = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())} ${z2(d.getHours())}:${z2(d.getMinutes())}`; };

// ---- reading -------------------------------------------------------------------------------------------------------------

interface Ctx { series: SeriesDoc | null; langs: Languages; all: string[] }
function ctx(): Ctx {
  const series = (listing().series ?? null) as SeriesDoc | null;
  const langs = languagesOf(series);
  return { series, langs, all: allLanguages(langs) };
}

/** A text in every language, the main one first: `"Merhaba!" | en: Hello! | fa: سلام!`. */
function texts(o: Record<string, unknown>, c: Ctx): string {
  const main = typeof o[c.langs.main] === "string" ? JSON.stringify(o[c.langs.main]) : "(no main text)";
  return [main, ...c.langs.translations.filter(l => typeof o[l] === "string").map(l => `${l}: ${o[l]}`)].join(" | ");
}

function staging(o: Record<string, unknown>): string {
  const parts = STAGING.filter(k => o[k] !== undefined && k !== "to").map(k => `${k} ${short(o[k], 80)}`);
  return parts.length ? `  {${parts.join(", ")}}` : "";
}

const gate = (s: Record<string, unknown>) => [s.if !== undefined ? `if ${short(s.if, 60)}` : "", s.unless !== undefined ? `unless ${short(s.unless, 60)}` : ""].filter(Boolean).map(g => ` [${g}]`).join("");

/** An episode as a script: one line per step (and per option and reply), each with its path. */
export function script(doc: Record<string, unknown>, c: Ctx): string {
  const out: string[] = [];
  const title = textOf(doc.title, c.langs.main);
  out.push(`${doc.id}: ${title ?? "(untitled)"} — ${doc.kind ?? "episode"}, ${doc.releaseDate ?? "no date"}, level ${doc.level ?? "?"}${doc.draft ? ", draft" : ""}`);
  out.push(`place ${doc.place ?? "?"}; cast ${short(doc.cast ?? [])}${doc.extras ? `; extras ${short(doc.extras)}` : ""}`);
  out.push(`words ${short(doc.words ?? [], 300)}; lessons ${short(doc.lessons ?? [])}`);
  if (isObject(doc.summary)) out.push(`summary: ${c.langs.translations.map(l => `${l}: ${(doc.summary as Record<string, unknown>)[l] ?? "—"}`).join(" | ")}`);
  out.push("");
  const steps = Array.isArray(doc.steps) ? doc.steps : [];
  steps.forEach((s0, i) => {
    const s = (isObject(s0) ? s0 : {}) as Record<string, unknown>;
    const p = `steps/${i}`;
    if (typeof s.scene === "string") {
      const at = isObject(s.at) ? Object.entries(s.at).map(([w, m]) => `${w}@${m}`).join(", ") : "";
      out.push(`${p}  [scene ${s.scene}${s.time ? `, ${s.time}` : ""}${s.weather ? `, ${s.weather}` : ""}${s.state ? `, state ${short(s.state, 40)}` : ""}]${at ? ` ${at}` : ""}${s.kerim ? `; kerim ${s.kerim}` : ""}${gate(s)}`);
    } else if (typeof s.who === "string") {
      out.push(`${p}  ${s.who}${s.narr ? " (narrates)" : ""}${s.to ? ` → ${short(s.to, 30)}` : ""}: ${texts(s, c)}${staging(s)}${s.note ? `  note ${short(s.note, 80)}` : ""}${gate(s)}`);
    } else if (isObject(s.choice)) {
      const ch = s.choice as Record<string, unknown>;
      out.push(`${p}  choice ${ch.id ?? "?"}${ch.kind ? ` (${ch.kind})` : ""}${ch.to ? ` to ${ch.to}` : ""}${gate(s)}`);
      (Array.isArray(ch.options) ? ch.options : []).forEach((o0, k) => {
        const o = (isObject(o0) ? o0 : {}) as Record<string, unknown>;
        out.push(`${p}/choice/options/${k}  ${o.ok ? "✓" : "·"} ${texts(o, c)}${o.tone ? `  tone ${o.tone}` : ""}${staging(o)}`);
        (Array.isArray(o.reply) ? o.reply : []).forEach((r0, j) => {
          const r = (isObject(r0) ? r0 : {}) as Record<string, unknown>;
          out.push(`${p}/choice/options/${k}/reply/${j}    ${r.who ?? "?"}: ${texts(r, c)}${staging(r)}`);
        });
      });
    } else if (isObject(s.spot)) {
      const sp = s.spot as Record<string, unknown>;
      out.push(`${p}  spot ${sp.lesson ?? "?"}: ${JSON.stringify(sp.ex ?? "")}${c.langs.translations.filter(l => sp[l]).map(l => ` | ${l}: ${sp[l]}`).join("")}${gate(s)}`);
    } else if (isObject(s.act)) {
      const a = s.act as Record<string, unknown>;
      out.push(`${p}  act ${a.id ?? "?"} (${a.kind ?? "?"}) targets ${short(a.targets ?? [])}${isObject(a.prompt) ? `  prompt ${texts(a.prompt as Record<string, unknown>, c)}` : ""}${gate(s)}`);
    } else if (isObject(s.beat)) {
      const b = s.beat as Record<string, unknown>;
      out.push(`${p}  beat ${b.who ?? ""}${staging(b)}${b.wait ? ` wait ${b.wait}` : ""}${gate(s)}`);
    } else out.push(`${p}  ${short(s, 200)}`);
  });
  const quiz = Array.isArray(doc.quiz) ? doc.quiz : [];
  if (quiz.length) {
    out.push("");
    quiz.forEach((q0, i) => {
      const q = (isObject(q0) ? q0 : {}) as Record<string, unknown>;
      out.push(`quiz/${i}  ${q.kind ?? ""} ${isObject(q.q) ? texts(q.q as Record<string, unknown>, c) : short(q.q)}  options ${short(q.options ?? [])} answer ${q.a ?? "?"}  why ${short(q.why ?? "", 80)}`);
    });
  }
  return out.join("\n");
}

const docOf = (kind: Kind, id: string): { doc: Record<string, unknown>; mtime: number } => {
  if (!exists(kind, id)) throw new Refusal(`there is no ${kind} ${id}${kind === "story" ? ` (list_episodes lists them)` : ""}`);
  return readDoc(kind, id) as { doc: Record<string, unknown>; mtime: number };
};

// ---- the server ------------------------------------------------------------------------------------------------------------

export function createMcp(o: McpOptions): McpServer {
  const queue = o.queue ?? proposalsOf(o.events);
  const server = new McpServer({ name: "sahne-backstage", version: "0.1.0" }, {
    instructions: `Backstage edits a Sahne content root: a series of short language-learning scenes played on a paper-theatre stage. Start with series_overview (the languages, the narrator, the stand-in, the seasons), read an episode with read_episode, and look up valid staging with kit_search. Paths name a place in a document: "steps/3", "steps/12/choice/options/0/reply/1", "quiz/0", "title". ${o.agentEdits === "proposals" ? "Your edits are proposals: each is checked and shown to a person in the editor, who accepts or rejects it. Nothing is saved until they do." : "Your edits are saved at once (direct mode), each after the same check a person's save passes."} An edit that brings a new error is refused: fix it and try again. Ids are permanent: never rename one.`,
  });
  const by = () => o.by ?? server.server.getClientVersion()?.name ?? "agent";

  /** A tool's body, with the content root read again when asked, a refusal or error as the agent's answer, and the call told to `onCall`. */
  const run = <A>(tool: string, fn: (a: A) => Promise<Result> | Result) => async (a: A): Promise<Result> => {
    if (o.fresh) forget();
    const t0 = Date.now();
    let r: Result;
    try { r = await fn(a); } catch (e) { r = fail(e instanceof Refusal ? e.message : `failed: ${(e as Error).message}`); }
    o.onCall?.({ at: t0, by: by(), tool, ok: !r.isError, ms: Date.now() - t0, summary: (r.content[0]?.text ?? "").split("\n")[0].slice(0, 300) });
    return r;
  };

  const readOnly = (): string | null => {
    if (!o.write) return IS_SAMPLES ? "backstage is read-only: the samples are edited only when backstage starts with --write" : "backstage is read-only: it was started without --write, so no agent or person can edit";
    if (oldShape().length) return `backstage is read-only: the content root is in the old language shape (${oldShape().length} files); run node packages/sahne-story/convert/languages.ts on it first`;
    return null;
  };

  /** The document an agent edits: its own latest pending proposal on it in proposals mode, else the file. */
  async function current(kind: Kind, id: string, mtime?: number): Promise<{ doc: Record<string, unknown>; mtime: number; after?: string }> {
    const disk = docOf(kind, id);
    if (mtime !== undefined && mtime !== disk.mtime) throw new Refusal(`${kind} ${id} changed on disk since you read it (mtime ${mtime}, now ${disk.mtime}): read it again`);
    if (o.agentEdits === "proposals") {
      const p = latestOf(await queue.pending(), by(), kind, id);
      if (p) return { doc: p.next as Record<string, unknown>, mtime: disk.mtime, after: p.id };
    }
    return disk;
  }

  /** Propose or save a set of documents (the first is the one edited; the rest change with it). */
  async function submit(edits: ProposalEdit[], m: { summary: string; paths: Key[][]; after?: string }): Promise<Result> {
    const why = readOnly();
    if (why) return fail(why);
    const list: Edit[] = edits.map(e => ({ kind: e.kind, id: e.doc, doc: e.next, mtime: e.base, create: e.create }));
    if (o.agentEdits === "direct") {
      const r = save(list, { write: o.write });
      if (r.status !== 200) {
        const errs = (r.problems ?? []).filter(p => p.new && p.level === "error");
        return fail(`not saved (${r.status}): ${r.message ?? ""}${errs.length ? `\n${errs.map(fmt).join("\n")}` : ""}`);
      }
      for (const [k, mtime] of Object.entries(r.saved ?? {})) {
        const [kind, id] = k.split(":");
        o.events.emit("doc", { kind, id, mtime, by: by() });
      }
      const fresh = (r.problems ?? []).filter(p => p.new);
      return ok(`saved: ${m.summary}`, { saved: r.saved, newProblems: fresh.map(fmt) });
    }
    const problems = check(list);
    const errs = problems.filter(p => p.new && p.level === "error");
    if (errs.length) return fail(`not proposed: the edit brings ${errs.length} error${errs.length > 1 ? "s" : ""}. Fix ${errs.length > 1 ? "them" : "it"} and try again:\n${errs.map(fmt).join("\n")}`);
    const [main, ...also] = edits;
    const p = await queue.add({
      kind: main.kind, doc: main.doc, next: main.next, ...(main.base !== undefined ? { base: main.base } : {}), ...(main.create ? { create: true } : {}),
      ...(also.length ? { also } : {}), paths: m.paths, summary: m.summary, by: by(), problems, ...(m.after ? { after: m.after } : {}),
    });
    return ok(`proposal ${p.id} is waiting in ${queue.where}: ${m.summary}. A person accepts or rejects it; nothing is saved until they accept.${m.after ? ` It holds your earlier proposal ${m.after} on this document too.` : ""}`, { proposal: p.id, newProblems: problems.filter(x => x.new).map(fmt) });
  }

  /** Edit one story: `fn` turns the document into the new one. */
  async function editStory(id: string, mtime: number | undefined, summary: string, paths: Key[][], fn: (doc: Record<string, unknown>) => Record<string, unknown>): Promise<Result> {
    const why = readOnly();
    if (why) return fail(why);
    const c = await current("story", id, mtime);
    const next = fn(c.doc);
    return submit([{ kind: "story", doc: id, next, base: c.mtime }], { summary, paths, after: c.after });
  }

  const objectAt = (doc: unknown, path: Key[]): Record<string, unknown> => {
    const v = get(doc, path);
    if (!isObject(v)) throw new Refusal(`${pathText(path)} is ${v === undefined ? "not in the document" : "not an object"}`);
    return v;
  };
  const arrayParent = (doc: unknown, path: Key[]): { parent: Key[]; i: number; list: unknown[] } => {
    const i = path[path.length - 1], parent = path.slice(0, -1);
    const list = get(doc, parent);
    if (typeof i !== "number" || !Array.isArray(list)) throw new Refusal(`${pathText(path)} is not a place in a list (like steps/3)`);
    return { parent, i, list };
  };

  // shared input pieces
  const ID = z.string().describe("The episode id, like s1e04");
  const PATH = z.union([z.string(), z.number().int().nonnegative()]).describe('A path in the episode: "steps/3", "steps/12/choice/options/0", "steps/12/choice/options/0/reply/1", "quiz/0", "title". A bare number is a step');
  const MTIME = z.number().optional().describe("The mtime read_episode gave; when given, the edit is refused if the file changed since");

  // ---- read tools -----------------------------------------------------------------------------------------------------------

  server.registerTool("series_overview", {
    title: "The series",
    description: "Start here. The series: its titles, its languages (the main one the stage plays and the learner learns, and the translations), the narrator and the stand-in (the learner's own character), and every season with its episodes (id, title, kind, release date, draft). Also whether backstage can edit, and how edits are made.",
    annotations: { readOnlyHint: true },
  }, run("series_overview", () => {
    const w = listing(), c = ctx();
    const seasons = new Map<string, { id: string; title?: string; launch?: string; episodes: unknown[] }>();
    for (const [id, se] of Object.entries(w.seasons as Record<string, SeasonDoc>)) seasons.set(id, { id, title: textOf(se.title, c.langs.main), launch: se.launch, episodes: [] });
    for (const e of w.episodes) {
      const sid = `s${seasonOf(e.id)}`;
      if (!seasons.has(sid)) seasons.set(sid, { id: sid, title: "(no season document)", episodes: [] });
      seasons.get(sid)!.episodes.push({ id: e.id, title: textOf(e.title, c.langs.main), kind: e.kind, releaseDate: e.releaseDate, draft: e.draft, place: e.place });
    }
    const name = (id?: string) => (id && w.characters[id] ? textOf(w.characters[id].name, c.langs.main) ?? id : id);
    return ok("The series", {
      id: c.series?.id ?? null, title: c.series?.title ?? null, summary: c.series?.summary ?? null,
      languages: c.langs, narrator: { id: c.series?.narrator, name: name(c.series?.narrator) }, standin: { id: c.series?.standin, name: name(c.series?.standin) },
      seasons: [...seasons.values()].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))),
      cards: w.cards, writable: !readOnly(), readOnly: readOnly() ?? undefined, agentEdits: o.agentEdits,
    });
  }));

  server.registerTool("list_episodes", {
    title: "List episodes",
    description: "The episodes (story documents), in order, with their title in the main language, kind (episode or special), release date, place, cast and whether they are a draft. Give a season (1, or \"s1\") to list only its episodes.",
    inputSchema: { season: z.union([z.number().int().positive(), z.string()]).optional().describe("A season number or id") },
    annotations: { readOnlyHint: true },
  }, run("list_episodes", ({ season }) => {
    const n = season === undefined ? 0 : Number(String(season).replace(/^s/, ""));
    const c = ctx();
    const list = listing().episodes.filter(e => !n || seasonOf(e.id) === n).map(e => ({ id: e.id, title: textOf(e.title, c.langs.main), kind: e.kind, releaseDate: e.releaseDate, place: e.place, cast: e.cast, draft: e.draft }));
    return ok(`${list.length} episode${list.length === 1 ? "" : "s"}`, list);
  }));

  server.registerTool("read_episode", {
    title: "Read an episode",
    description: "An episode as a script: its header (title, kind, date, level, place, cast, target words as card ids, lessons), then one line per step with its path (steps/3), the speaker, whom it is said to, the main-language text, the translations and a staging summary; a choice's options and replies on their own lines; then the quiz. Also its mtime, to pass to an edit. raw: true adds the whole JSON document.",
    inputSchema: { id: ID, raw: z.boolean().optional().describe("Also return the JSON document") },
    annotations: { readOnlyHint: true },
  }, run("read_episode", ({ id, raw }) => {
    const d = docOf("story", id);
    const text = `${script(d.doc, ctx())}\n\nmtime ${d.mtime}`;
    return raw ? ok(text, d.doc) : ok(text);
  }));

  server.registerTool("read_step", {
    title: "Read a step",
    description: "The JSON at a path of an episode: a step, a choice option, a reply, a quiz item or any field. Use it before edit_step to see exactly what is there.",
    inputSchema: { id: ID, path: PATH },
    annotations: { readOnlyHint: true },
  }, run("read_step", ({ id, path }) => {
    const p = pathOf(path), d = docOf("story", id), v = get(d.doc, p);
    if (v === undefined) return fail(`${pathText(p)} is not in ${id}`);
    return ok(`${id} ${pathText(p)} (mtime ${d.mtime})`, v);
  }));

  const KIT_KINDS = ["characters", "places", "props", "gestures", "emotions", "sounds"] as const;
  server.registerTool("kit_search", {
    title: "Search the cast, places and kit",
    description: "What a step may name: characters (ids, names, roles), places (with their marks, where people stand and move to, and their props), the kit's props, gestures (a line's `do`), emotions (`emo`) and sounds (`sfx`). Use it before staging a step so every id exists. An empty query lists everything of that kind.",
    inputSchema: { kind: z.enum(KIT_KINDS), query: z.string().optional().describe("Part of an id or description"), limit: z.number().int().positive().max(200).optional() },
    annotations: { readOnlyHint: true },
  }, run("kit_search", ({ kind, query, limit }) => {
    const c = ctx(), w = listing();
    let rows: { id: string; about: string }[] = [];
    if (kind === "characters") rows = Object.entries(w.characters).map(([id, ch]) => ({ id, about: `${textOf(ch.name, c.langs.main) ?? id}${ch.kind ? ` (${ch.kind})` : ""}${ch.role ? `: ${textOf(ch.role, ...c.langs.translations, c.langs.main)}` : ""}` }));
    else if (kind === "places") rows = Object.entries(w.places as Record<string, StoryPlace>).map(([id, p]) => {
      const marks = Object.keys(p.marks ?? {}), props = Object.keys((p as { props?: Record<string, unknown> }).props ?? {});
      const times = Object.keys((p as { times?: Record<string, unknown> }).times ?? {});
      return { id, about: `${textOf((p as { name?: unknown }).name, c.langs.main, ...c.langs.translations) ?? id}; marks ${marks.join(", ") || "none"}${props.length ? `; props ${props.join(", ")}` : ""}${times.length ? `; times ${times.join(", ")}` : ""}${p.perch ? `; kerim's perch ${Object.keys(p.perch).join(", ")}` : ""}` };
    });
    else if (kind === "props") rows = Object.entries(kitOf().props).map(([id, d]) => ({ id, about: d.meta?.about ?? "" }));
    else if (kind === "gestures") rows = Object.entries(kitOf().gestures ?? {}).map(([id, g]) => ({ id, about: `${Math.round(g.dur)} ms${g.needs?.length ? `, needs ${g.needs.join(" and ")}` : ""}${g.loop ? ", loops" : ""}` }));
    else if (kind === "emotions") rows = Object.keys(kitOf().face.emotions).map(id => ({ id, about: "a face" }));
    else rows = Object.entries(kitOf().sounds ?? {}).map(([id, s]) => ({ id, about: `${s.bus}${s.loop ? " loop" : ""}${s.word ? `, written ${JSON.stringify(s.word[c.langs.main] ?? s.word.en ?? Object.values(s.word)[0])}` : ""}` }));
    const q = (query ?? "").trim().toLowerCase();
    const hits = rows.filter(r => !q || r.id.toLowerCase().includes(q) || r.about.toLowerCase().includes(q)).sort((a, b) => a.id.localeCompare(b.id));
    const max = limit ?? 80;
    return ok(`${hits.length} ${kind}${hits.length > max ? ` (the first ${max})` : ""}`, hits.slice(0, max));
  }));

  server.registerTool("search_words", {
    title: "Search the word cards",
    description: `The word cards a story's \`words\` name, by part of an id or a word: their ids and levels${o.shareCards ? ", and each card's word in the main language" : ""}. Use the ids in an episode's \`words\`. ${o.shareCards ? "" : "The cards' words are not shared with agents on this backstage (no --share-cards): pick by id. "}A card's translations and notes are never shared.`,
    inputSchema: { query: z.string().describe("Part of a card id or a word"), limit: z.number().int().positive().max(100).optional() },
    annotations: { readOnlyHint: true },
  }, run("search_words", ({ query, limit }) => {
    if (!listing().cards) return ok("this content root has no word cards: a story's words are not checked against any", []);
    const hits = searchCards(query, limit ?? 40).map(c => (o.shareCards ? { id: c.id, ...(c.level ? { level: c.level } : {}), word: c.tr } : { id: c.id, ...(c.level ? { level: c.level } : {}) }));
    return ok(`${hits.length} card${hits.length === 1 ? "" : "s"}`, hits);
  }));

  server.registerTool("check_episode", {
    title: "Check an episode",
    description: "The story check on an episode as it is on disk (the same check a save passes): its errors, warnings and notes, each with its rule and step.",
    inputSchema: { id: ID },
    annotations: { readOnlyHint: true },
  }, run("check_episode", ({ id }) => {
    const d = docOf("story", id);
    const problems = check([{ kind: "story", id, doc: d.doc }]).map(p => ({ ...p, new: undefined }));
    const n = (l: string) => problems.filter(p => p.level === l).length;
    return ok(`${id}: ${n("error")} errors, ${n("warning")} warnings, ${n("info")} notes`, problems.map(fmt));
  }));

  server.registerTool("read_notes", {
    title: "Read the review notes",
    description: "An episode's review notes: where it stands (draft, reviewed, approved), whether AI wrote it, the steps reviewed and whose Persian was checked, and the comments on it and its steps (a step key is \"12\", or \"12.0.1\" for a choice's option and reply).",
    inputSchema: { id: ID },
    annotations: { readOnlyHint: true },
  }, run("read_notes", ({ id }) => {
    if (!exists("story", id)) return fail(`there is no story ${id}`);
    return ok(`${id}'s review notes`, readReview().episodes[id] ?? {});
  }));

  // ---- write tools ------------------------------------------------------------------------------------------------------------

  const writeNote = o.agentEdits === "proposals" ? "Proposes the change (a person accepts it in the editor)." : "Saves the change.";

  server.registerTool("edit_step", {
    title: "Edit a step",
    description: `Change a step (or any object in the episode: a choice option, a reply, a quiz item, the title; the path "" is the episode itself, for its level, ref, words, lessons, place, cast or draft) by a merge patch: each key of the patch replaces the one there, an object merges into the one there, and null removes a key. ${writeNote} Use set_texts for the words and set_staging for the staging when that is all you change.`,
    inputSchema: { id: ID, path: z.union([z.string(), z.number().int().nonnegative()]).describe('A path in the episode ("steps/3", "steps/12/choice/options/0", "quiz/0", "title"), or "" for the episode itself'), patch: z.record(z.string(), z.unknown()).describe("The keys to change, e.g. { \"tr\": \"…\", \"emo\": \"happy\", \"do\": null }"), mtime: MTIME },
    annotations: { destructiveHint: false },
  }, run("edit_step", ({ id, path, patch, mtime }) => {
    const p = path === "" || path === "/" ? [] : pathOf(path);
    if (!p.length && "id" in patch) throw new Refusal("ids are permanent: an episode's id never changes");
    const changed = p.length ? [p] : Object.keys(patch).map(k => [k]);
    return editStory(id, mtime, `edit ${p.length ? pathText(p) : "the episode"} of ${id} (${Object.keys(patch).join(", ")})`, changed, doc => (p.length ? set(doc, p, mergePatch(objectAt(doc, p), patch)) : mergePatch(doc, patch) as Record<string, unknown>));
  }));

  server.registerTool("insert_step", {
    title: "Insert a step",
    description: `Insert a step before the one at a place in a list ("steps/4" puts it fourth; past the end appends), or an option or reply in theirs ("steps/12/choice/options/2"). A line is { "who", "<lang>": text for every language, staging… }; a scene { "scene": place, "at": { who: mark } }; a choice { "choice": { "id", "kind", "to", "options": [...] } }; a spot { "spot": { "lesson", "ex" } }. ${writeNote}`,
    inputSchema: { id: ID, at: PATH, step: z.record(z.string(), z.unknown()).describe("The new step"), mtime: MTIME },
  }, run("insert_step", ({ id, at, step, mtime }) => {
    const p = pathOf(at);
    return editStory(id, mtime, `insert at ${pathText(p)} of ${id}`, [p], doc => {
      const { parent, i, list } = arrayParent(doc, p);
      return insert(doc, parent, Math.min(i, list.length), step);
    });
  }));

  server.registerTool("delete_step", {
    title: "Delete a step",
    description: `Delete the step (or option, or reply) at a path; the ones after it move up. ${writeNote}`,
    inputSchema: { id: ID, path: PATH, mtime: MTIME },
    annotations: { destructiveHint: true },
  }, run("delete_step", ({ id, path, mtime }) => {
    const p = pathOf(path);
    return editStory(id, mtime, `delete ${pathText(p)} of ${id}`, [p], doc => {
      const { i, list } = arrayParent(doc, p);
      if (i >= list.length) throw new Refusal(`${pathText(p)} is not in ${id}`);
      return set(doc, p, undefined);
    });
  }));

  server.registerTool("move_step", {
    title: "Move a step",
    description: `Move a step (or option, or reply) to another place in the same list: from "steps/5" to "steps/2". ${writeNote}`,
    inputSchema: { id: ID, from: PATH, to: PATH, mtime: MTIME },
  }, run("move_step", ({ id, from, to, mtime }) => {
    const a = pathOf(from), b = pathOf(to);
    if (pathText(a.slice(0, -1)) !== pathText(b.slice(0, -1))) throw new Refusal("a step moves within its own list: from and to must differ only in the last number");
    return editStory(id, mtime, `move ${pathText(a)} to ${pathText(b)} of ${id}`, [a, b], doc => {
      const { parent, i, list } = arrayParent(doc, a), j = b[b.length - 1] as number;
      if (i >= list.length || j >= list.length) throw new Refusal(`a place past the end of ${pathText(parent)} (it has ${list.length})`);
      return move(doc, parent, i, j);
    });
  }));

  server.registerTool("set_staging", {
    title: "Set a step's staging",
    description: `Set the staging of a line, an option, a reply, a beat or a scene: to (whom it is said to), emo (an emotion), do (a gesture), at (what is looked or pointed at, or for a scene who stands on which mark), cam, voice, tempo, move, obj, react, link, sfx, env, via, on, wait, frame, looks. Each key replaces the one there; null removes it. Names must exist: kit_search lists them. Texts go through set_texts. ${writeNote}`,
    inputSchema: { id: ID, path: PATH, staging: z.record(z.string(), z.unknown()).describe("e.g. { \"emo\": \"happy\", \"do\": \"wave\", \"to\": \"ismail\" }"), mtime: MTIME },
  }, run("set_staging", ({ id, path, staging: st, mtime }) => {
    const p = pathOf(path), c = ctx();
    const langKeys = Object.keys(st).filter(k => c.all.includes(k));
    if (langKeys.length) throw new Refusal(`${langKeys.join(", ")} ${langKeys.length > 1 ? "are languages" : "is a language"}: set texts with set_texts`);
    if ("who" in st || "id" in st) throw new Refusal("who and id are not staging: use edit_step");
    return editStory(id, mtime, `staging of ${pathText(p)} of ${id} (${Object.keys(st).join(", ")})`, [p], doc => set(doc, p, mergePatch(objectAt(doc, p), st)));
  }));

  server.registerTool("set_texts", {
    title: "Set texts",
    description: "Set the words of a line, an option, a reply, an arc, a title, a summary or a quiz question, by language: { \"<main>\": \"…\", \"<translation>\": \"…\" }. The languages are the series' (series_overview): the main one the stage plays, then the translations, which should say the same thing naturally. " + writeNote,
    inputSchema: { id: ID, path: PATH, texts: z.record(z.string(), z.string()).describe("Language code → text"), mtime: MTIME },
  }, run("set_texts", ({ id, path, texts: t, mtime }) => {
    const p = pathOf(path), c = ctx();
    const bad = Object.keys(t).filter(l => !c.all.includes(l));
    if (bad.length) throw new Refusal(`${bad.join(", ")}: not a language of this series (${c.all.join(", ")})`);
    if (!Object.keys(t).length) throw new Refusal("no texts given");
    return editStory(id, mtime, `texts of ${pathText(p)} of ${id} (${Object.keys(t).join(", ")})`, [p], doc => {
      const v = get(doc, p);
      const base = isObject(v) ? v : typeof v === "string" ? { [c.langs.main]: v } : v === undefined ? {} : null;
      if (!base) throw new Refusal(`${pathText(p)} holds no texts`);
      return set(doc, p, { ...base, ...t });
    });
  }));

  const TEXT = z.record(z.string(), z.string()).describe("Language code → text");
  server.registerTool("create_episode", {
    title: "Create an episode",
    description: `Start a new episode from a brief: a first draft the story check can read (a scene with the cast on the place's floor marks, the narrator's opening, a few placeholder lines, one choice, one spot and three quiz items, marked draft: true), with its row in the season's calendar when the season has one. Then write its steps with the other tools. The id defaults to the season's next free one. ${writeNote}`,
    inputSchema: {
      season: z.number().int().positive(), id: z.string().optional().describe("s<season>e<NN>; default the next free"),
      releaseDate: z.string().describe("YYYY-MM-DD"), kind: z.enum(["episode", "special"]), week: z.number().int().nonnegative().describe("Its week: its arc is the season's arc of that week"),
      place: z.string(), cast: z.array(z.string()).describe("Who speaks: 2 to 6 character ids, the stand-in among them"), words: z.array(z.string()).describe("Target word card ids (search_words)"),
      lessons: z.array(z.string()).describe("Grammar lesson ids"), title: TEXT, summary: TEXT.optional(), level: z.string().optional(),
    },
  }, run("create_episode", async b => {
    const why = readOnly();
    if (why) return fail(why);
    const w = listing(), sid = `s${b.season}`, se = (w.seasons as Record<string, SeasonDoc>)[sid];
    if (!se) return fail(`season ${sid} has no document: start it in the editor first`);
    const series = w.series as SeriesDoc | undefined;
    if (!series) return fail("the content root has no series.json: start the series in the editor first");
    let id = b.id;
    if (!id) {
      const used = idsOf("story").filter(x => seasonOf(x) === b.season).map(x => Number(x.slice(-2)));
      id = `${sid}e${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, "0")}`;
    }
    if (seasonOf(id) !== b.season) return fail(`${id} is not an episode id of season ${b.season} (s${b.season}eNN)`);
    if (exists("story", id)) return fail(`${id} exists already: ids are permanent, pick a new one`);
    if (!(w.places as Record<string, unknown>)[b.place]) return fail(`there is no place ${b.place} (kit_search places)`);
    const aid = arcId(b.season, b.week), arc = se.arcs?.[aid];
    if (!arc) return fail(`season ${sid} has no arc for week ${b.week} (${aid}): add the week's arc to the season first`);
    if (!b.title[languagesOf(series).main]) return fail(`the title needs the main language's (${languagesOf(series).main})`);
    const next = skeleton({ id, season: b.season, releaseDate: b.releaseDate, kind: b.kind, week: b.week, arc: { ...arc, id: aid }, place: b.place, cast: b.cast, words: b.words, lessons: b.lessons, title: b.title, summary: b.summary, level: b.level },
      { narrator: series.narrator, standin: series.standin, places: w.places as Record<string, StoryPlace> });
    const edits: ProposalEdit[] = [{ kind: "story", doc: id, next, create: true }];
    if (se.calendar) {
      const s = docOf("season", sid);
      edits.push({ kind: "season", doc: sid, next: { ...s.doc, calendar: { ...(s.doc.calendar as object), [id]: { date: b.releaseDate, kind: b.kind, week: b.week } } }, base: s.mtime });
    }
    return submit(edits, { summary: `create ${id} (${textOf(b.title, languagesOf(series).main)})`, paths: [["steps"]] });
  }));

  server.registerTool("set_calendar", {
    title: "Set an episode's date",
    description: `Set an episode's row in its season's calendar (date, kind, week), and with it the episode's own releaseDate and kind, and its arc when the week changes: the two documents change together. ${writeNote}`,
    inputSchema: { season: z.union([z.number().int().positive(), z.string()]), story: ID, row: z.object({ date: z.string().describe("YYYY-MM-DD"), kind: z.enum(["episode", "special"]), week: z.number().int().nonnegative() }), mtime: MTIME },
  }, run("set_calendar", async ({ season, story, row, mtime }) => {
    const why = readOnly();
    if (why) return fail(why);
    const n = Number(String(season).replace(/^s/, "")), sid = `s${n}`;
    if (seasonOf(story) !== n) return fail(`${story} is not an episode of ${sid}`);
    const se = docOf("season", sid);
    const st = await current("story", story, mtime);
    const aid = arcId(n, row.week), arcs = (se.doc.arcs ?? {}) as Record<string, object>;
    let next: Record<string, unknown> = { ...st.doc, releaseDate: row.date, kind: row.kind };
    if ((st.doc.arc as { id?: string } | undefined)?.id !== aid) {
      if (!arcs[aid]) return fail(`${sid} has no arc for week ${row.week} (${aid})`);
      next = { ...next, arc: { ...arcs[aid], id: aid } };
    }
    const nextSeason = { ...se.doc, calendar: { ...((se.doc.calendar ?? {}) as object), [story]: row } };
    return submit([{ kind: "season", doc: sid, next: nextSeason, base: se.mtime }, { kind: "story", doc: story, next, base: st.mtime }], { summary: `${story} on ${row.date} (${row.kind}, week ${row.week})`, paths: [["calendar", story]], after: st.after });
  }));

  server.registerTool("comment", {
    title: "Comment",
    description: "Leave a review comment on an episode, or on one of its steps (a path like steps/4, or steps/12/choice/options/0): a note for the people who review it, kept in the review notes beside the content, never in the story. It is written at once (with --write) in either edit mode.",
    inputSchema: { id: ID, step: PATH.optional(), text: z.string().min(1).max(4000) },
  }, run("comment", ({ id, step, text }) => {
    if (!o.write) return fail(readOnly() ?? "read-only");
    if (!exists("story", id)) return fail(`there is no story ${id}`);
    const at = step === undefined ? undefined : stepKey(pathOf(step));
    if (step !== undefined && !at) return fail("a comment's step is a step, an option or a reply (steps/4, steps/12/choice/options/0/reply/1)");
    const cur: EpisodeReview = readReview().episodes[id] ?? {};
    const c = { id: Math.random().toString(36).slice(2, 10), ...(at ? { at } : {}), by: by(), text, date: now() };
    writeReview({ id, review: { ...cur, comments: [...(cur.comments ?? []), c] } });
    return ok(`comment ${c.id} left on ${id}${at ? ` step ${at}` : ""}`);
  }));

  server.registerTool("set_review", {
    title: "Set where an episode stands",
    description: o.agentEdits === "proposals"
      ? "Not available in proposals mode: a person decides whether an episode is reviewed or approved. Leave a comment instead."
      : `Set an episode's review status: ${STATUSES.join(", ")}.`,
    inputSchema: { id: ID, status: z.enum(STATUSES as [string, ...string[]]) },
  }, run("set_review", ({ id, status }) => {
    if (o.agentEdits === "proposals") return fail("in proposals mode a person sets where an episode stands: leave a comment instead");
    if (!o.write) return fail(readOnly() ?? "read-only");
    if (!exists("story", id)) return fail(`there is no story ${id}`);
    const cur: EpisodeReview = readReview().episodes[id] ?? {};
    writeReview({ id, review: { ...cur, status } });
    return ok(`${id} is ${status}`);
  }));

  // ---- the editor ---------------------------------------------------------------------------------------------------------------

  server.registerTool("show", {
    title: "Show in the editor",
    description: "Open an episode, at a step, in the open backstage editors: to point a person at what you mean.",
    inputSchema: { id: ID, step: PATH.optional() },
    annotations: { readOnlyHint: true },
  }, run("show", ({ id, step }) => {
    if (!exists("story", id)) return fail(`there is no story ${id}`);
    const path = step === undefined ? undefined : pathOf(step);
    if (!o.events.size) return ok(`no editor is listening: open backstage in a browser to see ${id} (an MCP server on stdio reaches one only with --backstage)`);
    o.events.emit("show", { id, step: path ?? null });
    return ok(`the open editors show ${id}${path ? ` at ${pathText(path)}` : ""}`);
  }));

  // ---- resources ------------------------------------------------------------------------------------------------------------------

  server.registerResource("story-format", "sahne://format", { title: "The story format", description: "sahne-story's README: series, seasons and episodes, languages, places, the cast and the story check.", mimeType: "text/markdown" },
    uri => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: readFileSync(FORMAT, "utf8") }] }));
  server.registerResource("languages", "sahne://languages", { title: "The series' languages", description: "The main language and the translations, as series.json declares them.", mimeType: "application/json" },
    uri => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(ctx().langs) }] }));
  server.registerResource("selection", "sahne://selection", { title: "The editor's selection", description: "What the open backstage editor shows: its page, and the document and step selected there (null when no editor has said).", mimeType: "application/json" },
    async uri => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify((await (o.selection ?? (() => o.events.selection))()) ?? null) }] }));

  return server;
}
