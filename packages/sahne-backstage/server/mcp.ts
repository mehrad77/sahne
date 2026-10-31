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
import { rng } from "../../sahne/src/core/rng.ts";
import { IS_SAMPLES } from "../../sahne-story/paths.ts";
import { arcId } from "../../sahne-story/check/rules.ts";
import { allLanguages, langFor, languagesOf, seasonOf, suggest, textOf, type Languages, type SeasonDoc, type SeriesDoc, type StoryDoc, type StoryPlace } from "../../sahne-story/src/index.ts";
import { allProblems, check, refuse, usesOf, exists, forget, idsOf, kit as kitOf, listing, oldShape, readDoc, save, searchCards, type Edit, type Kind, type Problem } from "./content.ts";
import { readReview, standingFor, STATUSES, writeReview, type EpisodeReview } from "./review.ts";
import { fail, ok, Refusal, type Result } from "./result.ts";
import { pieceRows, registerKitTools } from "./kittools.ts";
import type { Call } from "./agents.ts";
import type { Events, Selection } from "./events.ts";
import { latestOf, proposalsOf, type ProposalEdit, type Queue } from "./proposals.ts";
import { get, insert, move, set, type Key } from "../src/model/path.ts";
import { toolLabel } from "../src/model/tools.ts";
import { lookAt } from "./look.ts";
import { DOCS, guideText, headingsOf, sectionOf } from "./guides.ts";
import { suggestionsOf } from "../src/model/autostage.ts";
import { boardOf, datesOf, themed, weekOfArc } from "../src/model/board.ts";
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
  /** A running backstage whose editors draw `look`'s pictures (stdio mode with --backstage); default: this process's. */
  backstage?: URL | null;
  /** Told of every tool call, for the editor's Agents page (agents.ts). */
  onCall?(c: Call): void;
}

const FORMAT = new URL("../../sahne-story/README.md", import.meta.url);

/** The staging keys a line, an option or a beat carries beside its texts, in the editor's order. */
const STAGING = ["to", "emo", "do", "at", "cam", "voice", "tempo", "n", "loop", "obj", "move", "react", "link", "sfx", "env", "via", "on", "wait", "frame", "looks", "costume"];

// ---- small helpers -----------------------------------------------------------------------------------------------------

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
    instructions: `Backstage edits a Sahne content root: a series of short language-learning scenes played on a paper-theatre stage. Start with series_overview (the languages, the narrator, the stand-in, the seasons), read an episode with read_episode, and look up valid staging with kit_search. To draw a new set piece, prop or variant of this series, read the sahne://kit-guide resource, then kit_search, kit_read a neighbour, draft_kit_item (or draft_variant) and look at its sheet, revise until it has no problems, and save_kit_item (save_variant). Paths name a place in a document: "steps/3", "steps/12/choice/options/0/reply/1", "quiz/0", "title". ${o.agentEdits === "proposals" ? "Your edits are proposals: each is checked and shown to a person in the editor, who accepts or rejects it. Nothing is saved until they do." : "Your edits are saved at once (direct mode), each after the same check a person's save passes."} An edit that brings a new error is refused: fix it and try again. Ids are permanent: never rename one.`,
  });
  const by = () => o.by ?? server.server.getClientVersion()?.name ?? "agent";

  /** A tool's body, with the content root read again when asked, a refusal or error as the agent's answer, and the call told to `onCall`. */
  const run = <A>(tool: string, fn: (a: A) => Promise<Result> | Result) => async (a: A): Promise<Result> => {
    if (o.fresh) forget();
    const t0 = Date.now();
    let r: Result;
    try { r = await fn(a); } catch (e) { r = fail(e instanceof Refusal ? e.message : `failed: ${(e as Error).message}`); }
    o.onCall?.({ at: t0, by: by(), tool, ok: !r.isError, ms: Date.now() - t0, summary: (r.content[0]?.type === "text" ? r.content[0].text : "").split("\n")[0].slice(0, 300), label: toolLabel(tool, a).label });
    return r;
  };

  const readOnly = (): string | null => {
    if (!o.write) return IS_SAMPLES ? "backstage is read-only: the samples are edited only when backstage starts with --write" : "backstage is read-only: it was started without --write, so no agent or person can edit";
    if (oldShape().length) return `backstage is read-only: the content root is in the old language shape (${oldShape().length} files); run node packages/sahne-story/convert/languages.ts on it first`;
    return null;
  };

  /**
   * The document an agent edits: its own latest pending proposal on it in proposals mode, else the file. A new episode it
   * proposed (create_episode) is not on disk yet: it is that proposal, `create`, with the documents that change with it.
   * A document its proposals only carry along (a season a new episode's calendar row goes in, the stories a week's new
   * theme reaches) is read as the latest of those, so a second proposal builds on the first instead of undoing it.
   */
  async function current(kind: Kind, id: string, mtime?: number): Promise<{ doc: Record<string, unknown>; mtime: number; after?: string; create?: boolean; also?: ProposalEdit[] }> {
    if (o.agentEdits === "proposals" && !exists(kind, id)) {
      const p = latestOf(await queue.pending(), by(), kind, id);
      if (p?.create) return { doc: p.next as Record<string, unknown>, mtime: 0, after: p.id, create: true, also: p.also };
    }
    const disk = docOf(kind, id);
    if (mtime !== undefined && mtime !== disk.mtime) throw new Refusal(`${kind} ${id} changed on disk since you read it (mtime ${mtime}, now ${disk.mtime}): read it again`);
    if (o.agentEdits === "proposals") {
      const pending = await queue.pending();
      const p = latestOf(pending, by(), kind, id);
      if (p) return { doc: p.next as Record<string, unknown>, mtime: disk.mtime, after: p.id };
      const carried = pending.filter(x => x.by === by()).sort((a, b) => b.at - a.at).flatMap(x => x.also ?? []).find(a => a.kind === kind && a.doc === id);
      if (carried) return { doc: carried.next as Record<string, unknown>, mtime: disk.mtime };
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
    // what a save would refuse whatever the check says (an id changed, an extra edited, a taken new id), a proposal is refused too
    for (const e of list) { const no = refuse(e); if (no) return fail(`not proposed: ${no}`); }
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

  /** Edit one document (a story, a season, the series, a place, a character): `fn` turns it into the new one. */
  async function editDoc(kind: Kind, id: string, mtime: number | undefined, summary: string, paths: Key[][], fn: (doc: Record<string, unknown>) => Record<string, unknown>): Promise<Result> {
    const why = readOnly();
    if (why) return fail(why);
    const c = await current(kind, id, mtime);
    const next = fn(c.doc);
    const main: ProposalEdit = c.create ? { kind, doc: id, next, create: true } : { kind, doc: id, next, base: c.mtime };
    return submit([main, ...(c.also ?? [])], { summary, paths, after: c.after });
  }
  const editStory = (id: string, mtime: number | undefined, summary: string, paths: Key[][], fn: (doc: Record<string, unknown>) => Record<string, unknown>) => editDoc("story", id, mtime, summary, paths, fn);

  /** A document as this agent reads it: as it would edit it (`current`), with a line saying what is not saved yet. */
  async function seen(id: string, kind: Kind = "story"): Promise<{ doc: Record<string, unknown>; mtime?: number; create?: boolean; note: string }> {
    const c = await current(kind, id);
    const what = kind === "story" ? "episode" : kind;
    const note = !c.after ? "" : c.create ? `${id} is your proposal ${c.after}, a new ${what}: nothing is on disk until a person accepts it. Edits build on it.` : `This is ${id} with your pending proposal ${c.after}, not saved yet.`;
    return { doc: c.doc, mtime: c.create ? undefined : c.mtime, create: c.create, note };
  }

  /** The answer for a document that is not on disk: none at all, or one only proposed so far. */
  const absent = async (id: string, what: string, kind: Kind = "story"): Promise<Result> => {
    const p = (await queue.pending()).find(x => x.kind === kind && x.doc === id && x.create);
    return fail(p ? `${id} is only proposed (${p.id}), not saved yet: ${what} once a person accepts it` : `there is no ${kind} ${id}${kind === "story" ? " (list_episodes lists them)" : ""}`);
  };

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
    description: "Start here. The series: its titles, its languages (the main one the stage plays and the learner learns, and the translations), the narrator and the stand-in (the learner's own character), and every season with the weeks it has arcs for (a new episode's week is one of them) and its episodes (id, title, kind, release date, draft). Also whether backstage can edit, and how edits are made.",
    annotations: { readOnlyHint: true },
  }, run("series_overview", () => {
    const w = listing(), c = ctx();
    const seasons = new Map<string, { id: string; title?: string; launch?: string; arcWeeks?: number[]; episodes: unknown[] }>();
    for (const [id, se] of Object.entries(w.seasons as Record<string, SeasonDoc>)) seasons.set(id, { id, title: textOf(se.title, c.langs.main), launch: se.launch, arcWeeks: Object.keys(se.arcs ?? {}).map(k => Number(k.split("w")[1])).sort((x, y) => x - y), episodes: [] });
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
  }, run("read_episode", async ({ id, raw }) => {
    const d = await seen(id);
    const text = `${d.note ? `${d.note}\n\n` : ""}${script(d.doc, ctx())}\n\nmtime ${d.mtime ?? "none (not on disk yet)"}`;
    return raw ? ok(text, d.doc) : ok(text);
  }));

  server.registerTool("read_step", {
    title: "Read a step",
    description: "The JSON at a path of an episode: a step, a choice option, a reply, a quiz item or any field. Use it before edit_step to see exactly what is there.",
    inputSchema: { id: ID, path: PATH },
    annotations: { readOnlyHint: true },
  }, run("read_step", async ({ id, path }) => {
    const p = pathOf(path), d = await seen(id), v = get(d.doc, p);
    if (v === undefined) return fail(`${pathText(p)} is not in ${id}`);
    return ok(`${id} ${pathText(p)} (mtime ${d.mtime ?? "none: not on disk yet"})${d.note ? ` ${d.note}` : ""}`, v);
  }));

  const KIT_KINDS = ["characters", "places", "props", "set", "gestures", "emotions", "sounds"] as const;
  server.registerTool("kit_search", {
    title: "Search the cast, places and kit",
    description: "What a step may name: characters (ids, names, roles), places (with their marks, where people stand and move to, and their props), the kit's props and set pieces (kind \"set\": each with its family, whether it is a prop, a set piece or both, what it draws and its variants; filter by family, tag or as), gestures (a line's `do`), emotions (`emo`) and sounds (`sfx`). Use it before staging a step so every id exists, and before drawing a kit item to find its neighbours (then kit_read one). An empty query lists everything of that kind; without a kind it searches the props and set pieces together.",
    inputSchema: {
      kind: z.enum(KIT_KINDS).optional().describe("What to search; left out: props and set pieces together (each row's `as` says which)"), query: z.string().optional().describe("Part of an id or description"), limit: z.number().int().positive().max(200).optional(),
      family: z.string().optional().describe("props and set only: the kit family (food, street, furniture; \"series\" for this content root's own drawings)"), tag: z.string().optional().describe("props and set only: a tag, like cafe"),
      as: z.enum(["set", "prop", "both"]).optional().describe("props and set only: whether it is a set piece, a prop or both"),
    },
    annotations: { readOnlyHint: true },
  }, run("kit_search", ({ kind, query, limit, family, tag, as }) => {
    const c = ctx(), w = listing();
    let rows: ({ id: string; about: string } & Record<string, unknown>)[] = [];
    if (kind === "characters") rows = Object.entries(w.characters).map(([id, ch]) => ({ id, about: `${textOf(ch.name, c.langs.main) ?? id}${ch.kind ? ` (${ch.kind})` : ""}${ch.role ? `: ${textOf(ch.role, ...c.langs.translations, c.langs.main)}` : ""}` }));
    else if (kind === "places") rows = Object.entries(w.places as Record<string, StoryPlace>).map(([id, p]) => {
      const marks = Object.keys(p.marks ?? {}), props = Object.keys((p as { props?: Record<string, unknown> }).props ?? {});
      const times = Object.keys((p as { times?: Record<string, unknown> }).times ?? {});
      return { id, about: `${textOf((p as { name?: unknown }).name, c.langs.main, ...c.langs.translations) ?? id}; marks ${marks.join(", ") || "none"}${props.length ? `; props ${props.join(", ")}` : ""}${times.length ? `; times ${times.join(", ")}` : ""}${p.perch ? `; kerim's perch ${Object.keys(p.perch).join(", ")}` : ""}` };
    });
    else if (kind === "props" || kind === "set" || kind === undefined) rows = pieceRows().filter(r => (kind === "set" ? r.as !== "prop" : kind === "props" ? r.as !== "set" : true) && (!family || r.family === family) && (!tag || r.tags.includes(tag)) && (!as || r.as === as))
      .map(r => ({ id: r.id, family: r.family, as: r.as, about: r.about, variants: r.variants, tags: r.tags }));
    else if (kind === "gestures") rows = Object.entries(kitOf().gestures ?? {}).map(([id, g]) => ({ id, about: `${Math.round(g.dur)} ms${g.needs?.length ? `, needs ${g.needs.join(" and ")}` : ""}${g.loop ? ", loops" : ""}` }));
    else if (kind === "emotions") rows = Object.keys(kitOf().face.emotions).map(id => ({ id, about: "a face" }));
    // a sound as words, since no model hears it: what it is, how long, how it varies, whether it is a recording
    else rows = Object.entries(kitOf().sounds ?? {}).map(([id, s]) => {
      let dur = "";
      try { dur = `, ${s.patch({ rng: rng(id), take: 0, params: {} }).dur.toFixed(1)} s`; } catch { /* a patch that needs params */ }
      return { id, about: `${s.bus === "ambience" ? "ambience" : "a sound effect"}${s.loop ? ", looping" : ""}${dur}${(s.takes ?? 1) > 1 ? `, ${s.takes} takes that vary` : ""}${s.recording ? ", a recording" : ", synthesised"}${s.word ? `, written ${JSON.stringify(s.word[c.langs.main] ?? s.word.en ?? Object.values(s.word)[0])}` : ""}` };
    });
    const q = (query ?? "").trim().toLowerCase();
    const hits = rows.filter(r => !q || r.id.toLowerCase().includes(q) || r.about.toLowerCase().includes(q) || (Array.isArray(r.tags) && (r.tags as string[]).some(t => t.toLowerCase().includes(q))) || r.family === q).sort((a, b) => a.id.localeCompare(b.id));
    const max = limit ?? 80;
    return ok(`${hits.length} ${kind === "set" ? "set pieces" : kind ?? "props and set pieces"}${hits.length > max ? ` (the first ${max})` : ""}`, hits.slice(0, max));
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
    description: "The story check on an episode (the same check a save passes), as you would edit it: your pending proposal on it included. Its errors, warnings and notes, each with its rule and step.",
    inputSchema: { id: ID },
    annotations: { readOnlyHint: true },
  }, run("check_episode", async ({ id }) => {
    const d = await seen(id);
    const problems = check([{ kind: "story", id, doc: d.doc, ...(d.create ? { create: true } : {}) }]).map(p => ({ ...p, new: undefined }));
    const n = (l: string) => problems.filter(p => p.level === l).length;
    return ok(`${id}: ${n("error")} errors, ${n("warning")} warnings, ${n("info")} notes${d.note ? `. ${d.note}` : ""}`, problems.map(fmt));
  }));

  server.registerTool("read_notes", {
    title: "Read the review notes",
    description: "An episode's review notes: where it stands (draft, reviewed, approved), whether AI wrote it, the steps reviewed and whose Persian was checked, and the comments on it and its steps (a step key is \"12\", or \"12.0.1\" for a choice's option and reply).",
    inputSchema: { id: ID },
    annotations: { readOnlyHint: true },
  }, run("read_notes", async ({ id }) => {
    if (!exists("story", id)) return absent(id, "it has review notes");
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
      releaseDate: z.string().describe("YYYY-MM-DD"), kind: z.enum(["episode", "special"]), week: z.number().int().nonnegative().describe("Its week: one the season has an arc for (series_overview lists each season's arcWeeks); its arc is that week's"),
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
    if (!arc) {
      const weeks = Object.keys(se.arcs ?? {}).map(k => Number(k.split("w")[1])).sort((x, y) => x - y);
      return fail(`season ${sid} has no arc for week ${b.week} (${aid}). ${weeks.length ? `It has arcs for week${weeks.length > 1 ? "s" : ""} ${weeks.join(", ")}: pick one of those` : "It has no arcs at all"}, or give week ${b.week} a theme first with set_week_theme.`);
    }
    if (!b.title[languagesOf(series).main]) return fail(`the title needs the main language's (${languagesOf(series).main})`);
    const next = skeleton({ id, season: b.season, releaseDate: b.releaseDate, kind: b.kind, week: b.week, arc: { ...arc, id: aid }, place: b.place, cast: b.cast, words: b.words, lessons: b.lessons, title: b.title, summary: b.summary, level: b.level },
      { narrator: series.narrator, standin: series.standin, places: w.places as Record<string, StoryPlace> });
    const edits: ProposalEdit[] = [{ kind: "story", doc: id, next, create: true }];
    if (se.calendar) {
      const s = await current("season", sid);
      edits.push({ kind: "season", doc: sid, next: { ...s.doc, calendar: { ...(s.doc.calendar as object), [id]: { date: b.releaseDate, kind: b.kind, week: b.week } } }, base: s.mtime, paths: [["calendar", id]] });
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
    const se = await current("season", sid);
    const st = await current("story", story, mtime);
    const aid = arcId(n, row.week), arcs = (se.doc.arcs ?? {}) as Record<string, object>;
    let next: Record<string, unknown> = { ...st.doc, releaseDate: row.date, kind: row.kind };
    if ((st.doc.arc as { id?: string } | undefined)?.id !== aid) {
      if (!arcs[aid]) return fail(`${sid} has no arc for week ${row.week} (${aid})`);
      next = { ...next, arc: { ...arcs[aid], id: aid } };
    }
    const nextSeason = { ...se.doc, calendar: { ...((se.doc.calendar ?? {}) as object), [story]: row } };
    const storyPaths = [["releaseDate"], ["kind"], ["arc"]];
    return submit([{ kind: "season", doc: sid, next: nextSeason, base: se.mtime }, st.create ? { kind: "story", doc: story, next, create: true, paths: storyPaths } : { kind: "story", doc: story, next, base: st.mtime, paths: storyPaths }], { summary: `${story} on ${row.date} (${row.kind}, week ${row.week})`, paths: [["calendar", story]], after: st.after });
  }));

  // ---- the series, its seasons, places and characters --------------------------------------------------------------------

  const TEXT0 = z.record(z.string(), z.string()).describe("Language code → text");
  const DOC_KIND = z.enum(["series", "season", "place", "character"]).describe("series (id \"series\"), a season (s1), a place, or a character");
  /** A path in any document (no step shorthand): "title", "arcs/s1w02", "marks/door", "" for the whole document. */
  const docPath = (p: string): Key[] => p.replace(/^\/+|\/+$/g, "").split("/").filter(x => x !== "").map(x => (/^\d+$/.test(x) ? Number(x) : x));

  server.registerTool("read_doc", {
    title: "Read a document",
    description: "Read the series, a season (its titles, launch day, week themes as arcs, calendar), a place (its size, set pieces, marks, props, times, camera) or a character (name, role, bio, look) as JSON, with its mtime. In proposals mode it is the document as you would edit it, your pending proposal on it included. Episodes are read with read_episode.",
    inputSchema: { kind: DOC_KIND, id: z.string() },
    annotations: { readOnlyHint: true },
  }, run("read_doc", async ({ kind, id }) => {
    const d = await seen(id, kind);
    return ok(`${d.note ? `${d.note}\n` : ""}${kind} ${id} · mtime ${d.mtime ?? "none (not on disk yet)"}`, d.doc);
  }));

  server.registerTool("edit_doc", {
    title: "Edit a document",
    description: `Change the series, a season, a place or a character by a merge patch at a path: each key of the patch replaces the one there, an object merges into the one there, and null removes a key. The path "" is the document itself; "title" a season's titles; "arcs/s1w02" a week's theme (prefer set_week_theme, which also updates that week's episodes); "marks/door" a place's mark; "name" a character's name. Ids never change. An edit that breaks an episode (a mark it stands on taken away, a character it names) is refused as a new error. ${writeNote}`,
    inputSchema: { kind: DOC_KIND, id: z.string(), path: z.string().describe('A path in the document, "" for the document itself'), patch: z.record(z.string(), z.unknown()).describe("The keys to change"), mtime: z.number().optional().describe("The mtime read_doc gave; when given, the edit is refused if the file changed since") },
  }, run("edit_doc", async ({ kind, id, path, patch, mtime }) => {
    const at = docPath(path);
    const changed = at.length ? [at] : Object.keys(patch).map(k => [k] as Key[]);
    return editDoc(kind, id, mtime, `${kind} ${id}: ${at.length ? pathText(at) : Object.keys(patch).join(", ")}`, changed, doc => {
      if (!at.length) return mergePatch(doc, patch) as Record<string, unknown>;
      const here = get(doc, at);
      if (here !== undefined && !isObject(here)) return set(doc, at, patch) as Record<string, unknown>;
      return set(doc, at, mergePatch(here ?? {}, patch)) as Record<string, unknown>;
    });
  }));

  server.registerTool("set_week_theme", {
    title: "Set a week's theme",
    description: `Set a week's theme (its arc) in a season: the theme's words in each language, and the mechanics it practises. Like the board, it is written in the season and in every episode of that week, together. A week without an arc gets one, so an episode can then be started in it. ${writeNote}`,
    inputSchema: { season: z.union([z.number().int().positive(), z.string()]), week: z.number().int().nonnegative(), texts: z.record(z.string(), z.string()).describe("Language code → the theme"), mechanics: z.array(z.string()).optional().describe("What the week practises (default: what it had, else [\"say\"])") },
  }, run("set_week_theme", async ({ season, week, texts, mechanics }) => {
    const why = readOnly();
    if (why) return fail(why);
    const n = Number(String(season).replace(/^s/, "")), sid = `s${n}`;
    const se = await current("season", sid);
    const was = ((se.doc as unknown as SeasonDoc).arcs ?? {})[arcId(n, week)] as Record<string, unknown> | undefined;
    const arc = { ...(was ?? {}), ...texts, mechanics: mechanics ?? (was?.mechanics as string[] | undefined) ?? ["say"] } as NonNullable<SeasonDoc["arcs"]>[string];
    const t = themed(se.doc as unknown as SeasonDoc, week, arc);
    const edits: ProposalEdit[] = [{ kind: "season", doc: sid, next: t.season, base: se.mtime }];
    for (const id of idsOf("story").filter(x => seasonOf(x) === n)) {
      const st = await current("story", id);
      const next = t.story(st.doc as { arc?: { id?: string } });
      if (next) edits.push({ kind: "story", doc: id, next, base: st.mtime, paths: [["arc"]] });
    }
    return submit(edits, { summary: `week ${week} of ${sid}: “${textOf(arc as unknown as Record<string, string>, ctx().langs.main) ?? Object.values(texts)[0]}”${edits.length > 1 ? `, with ${edits.length - 1} episode${edits.length > 2 ? "s" : ""}` : ""}`, paths: [["arcs", t.aid]], after: se.after });
  }));

  server.registerTool("create_season", {
    title: "Start a season",
    description: `Start a new season: its number (the next free one), its titles, its launch day, and the themes of its first weeks. Then plan its weeks with set_week_theme and start episodes in them. ${writeNote}`,
    inputSchema: { n: z.number().int().positive().optional().describe("Default: the next free number"), title: TEXT0, launch: z.string().optional().describe("YYYY-MM-DD, a Monday"), weeks: z.record(z.string(), z.record(z.string(), z.string())).optional().describe("Week number → its theme by language, e.g. { \"1\": { \"tr\": \"…\" } }") },
  }, run("create_season", async ({ n, title, launch, weeks }) => {
    const nn = n ?? Math.max(0, ...idsOf("season").map(x => Number(x.slice(1)))) + 1, id = `s${nn}`;
    if (exists("season", id)) return fail(`season ${id} exists already: pick another number`);
    const arcs = Object.fromEntries(Object.entries(weeks ?? { 1: Object.fromEntries(Object.keys(title).map(l => [l, "…"])) }).map(([w, t]) => [arcId(nn, Number(w)), { ...t, mechanics: ["say"] }]));
    const doc = { v: 1, id, n: nn, title, ...(launch ? { launch } : {}), arcs, calendar: {} };
    return submit([{ kind: "season", doc: id, next: doc, create: true }], { summary: `start season ${nn}`, paths: [[]] });
  }));

  server.registerTool("create_character", {
    title: "Add a character",
    description: `Add a character to the cast: an id (a-z, 0-9, _; permanent), a name, a role and a short bio in the series' languages, a level, and a colour. Their look starts as the stand-in's; a person shapes it on their page (you cannot draw it). ${writeNote}`,
    inputSchema: { id: z.string().regex(/^[a-z][a-z0-9_]*$/), name: TEXT0, role: TEXT0.optional(), bio: TEXT0.optional(), level: z.string().optional(), color: z.string().optional().describe("#RRGGBB") },
  }, run("create_character", async ({ id, name, role, bio, level, color }) => {
    if (exists("character", id)) return fail(`${id} is a character already: ids are permanent, pick a new one`);
    const w = listing(), chars = w.characters as Record<string, { kind?: string; order?: number; avatar?: unknown }>;
    const order = Math.max(0, ...Object.values(chars).filter(c => c.kind !== "extra").map(c => Number(c.order ?? 0))) + 1;
    const base = chars[(w.series as SeriesDoc | undefined)?.standin ?? ""]?.avatar;
    const doc = { id, order, name, kind: "cast", role: role ?? { en: "…" }, bio: bio ?? { en: "…" }, color: color ?? "#7A6A58", level: level ?? "A1", ...(base ? { avatar: base } : {}) };
    return submit([{ kind: "character", doc: id, next: doc, create: true }], { summary: `add the character ${id}`, paths: [[]] });
  }));

  server.registerTool("create_place", {
    title: "Add a place",
    description: `Add a place: an id (a-z, 0-9, _; permanent) and its name, as an empty room or a copy of another place (its set pieces, marks and props). Then change its marks and props with edit_doc; a person arranges it on its stage. ${writeNote}`,
    inputSchema: { id: z.string().regex(/^[a-z0-9_]+$/), name: TEXT0, from: z.string().optional().describe("A place to copy") },
  }, run("create_place", async ({ id, name, from }) => {
    if (exists("place", id)) return fail(`${id} is a place already: ids are permanent, pick a new one`);
    let doc: Record<string, unknown> = { v: 1, id, name, size: { w: 6, d: 4 }, pieces: [], marks: { a: { x: 0, z: 0 } } };
    if (from) { const b = docOf("place", from).doc; const { site: _site, ...rest } = structuredClone(b); doc = { ...rest, id, name }; }
    return submit([{ kind: "place", doc: id, next: doc, create: true }], { summary: `add the place ${id}${from ? ` (a copy of ${from})` : ""}`, paths: [[]] });
  }));

  server.registerTool("find_uses", {
    title: "Where it is used",
    description: "Which episodes use a place (set there, or a scene there), a character (in the cast, or saying a line), or a word card, with the paths that name it. With part (a place's mark or prop id), only the episodes and steps that name that mark or prop. Look before you change or take away a mark, a prop or a character: an episode that names one breaks.",
    inputSchema: { kind: z.enum(["place", "character", "card"]), id: z.string(), part: z.string().optional() },
    annotations: { readOnlyHint: true },
  }, run("find_uses", ({ kind, id, part }) => {
    const uses = usesOf(kind, id, part);
    return ok(uses.length ? `${uses.length} episode${uses.length > 1 ? "s" : ""} use ${kind} ${id}${part ? ` · ${part}` : ""}:\n${uses.map(u => `${u.story}: ${u.paths.join(", ")}`).join("\n")}` : `no episode uses ${kind} ${id}${part ? ` · ${part}` : ""}`, uses);
  }));

  server.registerTool("check_season", {
    title: "Check a season",
    description: "A season at a glance, in one call: each episode with its date, its review status and its problems (errors and warnings), the weekdays with no episode yet, and the weeks with no theme. Read this before saying what needs work in a season.",
    inputSchema: { id: z.union([z.number().int().positive(), z.string()]) },
    annotations: { readOnlyHint: true },
  }, run("check_season", ({ id }) => {
    const n = Number(String(id).replace(/^s/, "")), sid = `s${n}`;
    const se = docOf("season", sid).doc as unknown as SeasonDoc;
    const eps = listing().episodes.filter(e => e.season === n);
    const review = readReview().episodes, probs = allProblems();
    const weekOf = Object.fromEntries(eps.map(e => [e.id, weekOfArc((docOf("story", e.id).doc as { arc?: { id?: string } }).arc?.id)]).filter(([, w]) => w !== undefined));
    const weeks = boardOf(se, datesOf(se, eps), 0, weekOf as Record<string, number>);
    const rows = eps.map(e => {
      const mine = probs.filter(p => p.doc === `story:${e.id}`);
      const st = standingFor(e.id, probs, review[e.id]);
      return { id: e.id, date: datesOf(se, [e])[e.id] ?? null, draft: e.draft, status: review[e.id]?.status ?? "draft", stage: st.stage, reviewed: `${st.done}/${st.total}`, missing: st.missing, errors: mine.filter(p => p.level === "error").map(fmt), warnings: mine.filter(p => p.level === "warning").length };
    });
    const empty = weeks.flatMap(w => w.days.filter(d => d.kind === "episode" && !d.episode).map(d => d.date));
    const noTheme = weeks.map(w => w.week).filter((w): w is number => typeof w === "number" && !se.arcs?.[arcId(n, w)]);
    const lines = [
      `${sid}: ${eps.length} episode${eps.length === 1 ? "" : "s"}, ${rows.filter(r => r.errors.length).length} with errors, ${rows.filter(r => r.status === "approved").length} approved`,
      ...rows.map(r => `${r.id} · ${r.date ?? "no date"} · ${r.status}${r.draft ? " · draft" : ""}${r.errors.length ? ` · ${r.errors.length} error${r.errors.length > 1 ? "s" : ""}` : ""}${r.warnings ? ` · ${r.warnings} warning${r.warnings > 1 ? "s" : ""}` : ""}`),
      `free weekdays: ${empty.length ? empty.join(", ") : "none"}`,
      `weeks without a theme: ${noTheme.length ? noTheme.join(", ") : "none"}`,
    ];
    return ok(lines.join("\n"), { season: sid, episodes: rows, freeDays: empty, weeksWithoutTheme: noTheme });
  }));

  server.registerTool("comment", {
    title: "Comment",
    description: "Leave a review comment on an episode, or on one of its steps (a path like steps/4, or steps/12/choice/options/0): a note for the people who review it, kept in the review notes beside the content, never in the story. It is written at once (with --write) in either edit mode.",
    inputSchema: { id: ID, step: PATH.optional(), text: z.string().min(1).max(4000) },
  }, run("comment", async ({ id, step, text }) => {
    if (!o.write) return fail(readOnly() ?? "read-only");
    if (!exists("story", id)) return absent(id, "it takes comments");
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
      ? `Ask the person to set an episode's review status (${STATUSES.join(", ")}): in proposals mode a person decides where an episode stands${o.by === "assistant" ? ", with one click on the card this puts in the conversation" : ", on the Review page; tell them what you suggest and why"}.`
      : `Set an episode's review status: ${STATUSES.join(", ")}. "approved" is a sign-off, refused until the episode is ready (every block reviewed and its translations checked, no errors, no open comments: check_season says what is missing).`,
    inputSchema: { id: ID, status: z.enum(STATUSES as [string, ...string[]]) },
  }, run("set_review", async ({ id, status }) => {
    if (!o.write) return fail(readOnly() ?? "read-only");
    if (!exists("story", id)) return absent(id, "it has a review status");
    // proposals mode: the person decides; the assistant's conversation shows them a card to do it with one click
    if (o.agentEdits === "proposals") return o.by === "assistant"
      ? ok(`asked the person to mark ${id} ${status}: a card in the conversation does it when they click it`, { ask: { question: `Mark ${id} as ${status}?`, review: { id, status } } })
      : ok(`not set: in proposals mode a person decides where an episode stands. Tell them you suggest ${status} for ${id}, and why; they set it on the Review page`);
    const cur: EpisodeReview = readReview().episodes[id] ?? {};
    writeReview({ id, review: { ...cur, status } });
    // approving is a sign-off on a Ready episode, for agents as for the person (model/review.ts)
    if (status === "approved") { const st = standingFor(id, allProblems(), cur); if (st.missing.length) return fail(`not approved: ${id} is not ready (${st.missing.join(", ")})`); }
    return ok(`${id} is ${status}`);
  }));

  server.registerTool("look", {
    title: "Look at the stage",
    description: "A picture of the stage: an episode at a step (mid-way through it by default, `at` 0 to 1), or a place's wide shot. In proposals mode it is the document as you would edit it, your pending proposal included, so you can see what you changed. An open editor draws it: with none open and in view, there is no picture. Look after staging a scene, and fix what looks wrong: who faces whom, where people stand, what is out of frame.",
    inputSchema: { kind: z.enum(["story", "place"]).optional().describe("Default: story"), id: z.string(), step: PATH.optional().describe("An episode's step; default: its first scene"), at: z.number().min(0).max(1).optional() },
    annotations: { readOnlyHint: true },
  }, run("look", async ({ kind, id, step, at }) => {
    const k = kind ?? "story", c = await current(k, id);
    const png = await lookAt(o.events, { kind: k, id, doc: c.doc, ...(step !== undefined ? { step: pathOf(step) } : {}), at: at ?? 0.4 }, o.backstage);
    if (!png) return fail("no picture: no backstage editor is open and in view to draw it. Ask the person to open backstage (any page) and try again");
    return ok(`${k === "story" ? `${id}${step !== undefined ? ` at ${pathText(pathOf(step))}` : ""}` : `the place ${id}`}${c.after ? ` (with your pending proposal ${c.after})` : ""}`, undefined, [png]);
  }));

  server.registerTool("suggest_staging", {
    title: "The rules' staging suggestions",
    description: "The staging the editor's own rules suggest for an episode, line by line, with why: a gesture, a feeling, whom a line is said to, a prop to point at, a camera. The same suggestions a person reviews in the editor. Use them as a starting point; set the ones that fit with set_staging.",
    inputSchema: { id: ID },
    annotations: { readOnlyHint: true },
  }, run("suggest_staging", async ({ id }) => {
    const d = await seen(id), w = listing(), c = ctx(), k = kitOf();
    const lang = langFor(c.langs.main);
    const o = { places: w.places as Record<string, StoryPlace>, characters: w.characters, kit: k, lang };
    const story = d.doc as unknown as StoryDoc;
    const sugg = suggestionsOf(story, { lang, lints: suggest(story, o as never), gestures: Object.keys(k.gestures), emotions: Object.keys(k.face.emotions), narrator: (w.series as SeriesDoc | undefined)?.narrator ?? "kerim", standin: (w.series as SeriesDoc | undefined)?.standin ?? "nima" });
    const rows = Object.entries(sugg).flatMap(([path, ss]) => ss.map(sg => ({ path, staging: sg.fix, why: sg.why, from: sg.from })));
    return ok(rows.length ? `${rows.length} suggestion${rows.length > 1 ? "s" : ""} for ${id}:\n${rows.map(r => `${r.path}: ${JSON.stringify(r.staging)} (${r.why})`).join("\n")}` : `the rules suggest nothing more for ${id}`, rows);
  }));

  server.registerTool("search_lines", {
    title: "Search the lines",
    description: "Find words across every episode: each script line (as read_episode gives it, with its path, speaker and translations) that holds the words, in any language, optionally said by one character. For consistency (how a word was used before), recurring jokes, and what a character has said.",
    inputSchema: { query: z.string().min(1), who: z.string().optional().describe("A character id: only their lines"), limit: z.number().int().positive().max(200).optional() },
    annotations: { readOnlyHint: true },
  }, run("search_lines", ({ query, who, limit }) => {
    const c = ctx(), low = (t: string) => t.toLocaleLowerCase(c.langs.main), q = low(query);
    const hits: { story: string; line: string }[] = [];
    for (const id of idsOf("story")) {
      for (const line of script(docOf("story", id).doc, c).split("\n")) {
        if (!/^\s*(steps|quiz)\//.test(line) || !low(line).includes(q)) continue;
        if (who && !new RegExp(`\\b${who.replace(/[^a-z0-9_]/gi, "")}\\b`).test(line)) continue;
        hits.push({ story: id, line: line.trim() });
      }
    }
    const shown = hits.slice(0, limit ?? 60);
    return ok(hits.length ? `${hits.length} line${hits.length > 1 ? "s" : ""}${hits.length > shown.length ? ` (the first ${shown.length})` : ""}:\n${shown.map(h => `${h.story} ${h.line}`).join("\n")}` : `no line holds “${query}”${who ? ` said by ${who}` : ""}`, shown);
  }));

  server.registerTool("read_guide", {
    title: "Read a guide",
    description: `The guides the editor shows: ${Object.entries(DOCS).map(([id, d]) => `${id} (${d.title})`).join(", ")}. Without a section, the guide's headings; with one (words of a heading), that section. Read the story format's guide before you write something new in an episode.`,
    inputSchema: { name: z.enum(Object.keys(DOCS) as [string, ...string[]]), section: z.string().optional() },
    annotations: { readOnlyHint: true },
  }, run("read_guide", ({ name, section }) => {
    const md = guideText(name);
    if (!section) return ok(`${DOCS[name].title} (${DOCS[name].path}). Its sections:\n${headingsOf(md).join("\n")}`);
    const part = sectionOf(md, section);
    return part ? ok(part.length > 12000 ? `${part.slice(0, 12000)}\n…` : part) : fail(`no section of ${name} names “${section}”: read it without a section for its headings`);
  }));

  server.registerTool("list_proposals", {
    title: "The proposals",
    description: "The proposals waiting for a person (yours and other agents'), and the latest answered ones: accepted, rejected, or withdrawn. Read it to know whether the person took or turned down what you proposed before you build on it.",
    annotations: { readOnlyHint: true },
  }, run("list_proposals", async () => {
    const pending = await queue.pending(), done = await queue.resolved();
    const me = by(), who = (b: string) => (b === me ? "you" : b);
    const lines = [
      pending.length ? `waiting (${pending.length}):\n${pending.map(p => `${p.id} · ${p.kind} ${p.doc} · ${who(p.by)}: ${p.summary}${p.after ? ` (built on ${p.after})` : ""}`).join("\n")}` : "nothing waits",
      done.length ? `answered:\n${done.slice(0, 20).map(p => `${p.id} · ${p.outcome} · ${p.kind} ${p.doc} · ${who(p.by)}: ${p.summary}`).join("\n")}` : "none answered yet",
    ];
    return ok(lines.join("\n\n"), { pending: pending.map(p => ({ id: p.id, kind: p.kind, doc: p.doc, by: p.by, summary: p.summary, after: p.after })), resolved: done });
  }));

  server.registerTool("withdraw_proposal", {
    title: "Take back a proposal",
    description: "Take back a proposal of yours that is still waiting (and the ones you built on it), when it is wrong or a later one replaces it. Only your own: a person answers the others. Agents of the same client name share their proposals.",
    inputSchema: { id: z.string().describe("A proposal id, like p4") },
  }, run("withdraw_proposal", async ({ id }) => {
    const gone = await queue.withdraw(id, by()).catch((e: Error) => { throw new Refusal(e.message); });
    return ok(`withdrawn: ${gone.join(", ")}`, { withdrawn: gone });
  }));

  // ---- the editor ---------------------------------------------------------------------------------------------------------------

  server.registerTool("show", {
    title: "Show in the editor",
    description: "Open an episode, at a step, or a set piece or prop (by its id, on the kit page), in the open backstage editors: to point a person at what you mean.",
    inputSchema: { id: z.string().describe("An episode id like s1e04, or a set piece or prop id"), step: PATH.optional(), as: z.enum(["set", "prop"]).optional().describe("For a kit item that is both: which shelf") },
    annotations: { readOnlyHint: true },
  }, run("show", async ({ id, step, as }) => {
    // a proposed new episode shows too: the editor opens it as a preview to accept or reject
    const story = exists("story", id) || (await queue.pending()).some(x => x.kind === "story" && x.doc === id && x.create);
    const item = !story ? pieceRows().filter(r => r.id === id) : [];
    if (!story && !item.length) return fail(`there is no story, set piece or prop ${id} (list_episodes and kit_search list them)`);
    if (item.length) {
      const r = (as ? item.find(x => x.as === as || x.as === "both") : item[0]) ?? item[0];
      if (!o.events.size) return ok(`no editor is listening: open backstage in a browser to see ${id} (an MCP server on stdio reaches one only with --backstage)`);
      o.events.emit("show", { id, kit: r.slot });
      return ok(`the open editors show the ${r.slot === "set" ? "set piece" : "prop"} ${id} on the kit page`);
    }
    const path = step === undefined ? undefined : pathOf(step);
    if (!o.events.size) return ok(`no editor is listening: open backstage in a browser to see ${id} (an MCP server on stdio reaches one only with --backstage)`);
    o.events.emit("show", { id, step: path ?? null });
    return ok(`the open editors show ${id}${path ? ` at ${pathText(path)}` : ""}`);
  }));

  registerKitTools(server, {
    run, readOnly, submit, writeNote,
    latest: async (kind, id) => (o.agentEdits === "proposals" ? latestOf(await queue.pending(), by(), kind, id)?.id : undefined),
  });

  // ---- resources ------------------------------------------------------------------------------------------------------------------

  server.registerResource("story-format", "sahne://format", { title: "The story format", description: "sahne-story's README: series, seasons and episodes, languages, places, the cast and the story check.", mimeType: "text/markdown" },
    uri => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: readFileSync(FORMAT, "utf8") }] }));
  server.registerResource("languages", "sahne://languages", { title: "The series' languages", description: "The main language and the translations, as series.json declares them.", mimeType: "application/json" },
    uri => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(ctx().langs) }] }));
  server.registerResource("selection", "sahne://selection", { title: "The editor's selection", description: "What the open backstage editor shows: its page, and the document and step selected there (null when no editor has said).", mimeType: "application/json" },
    async uri => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify((await (o.selection ?? (() => o.events.selection))()) ?? null) }] }));

  return server;
}
