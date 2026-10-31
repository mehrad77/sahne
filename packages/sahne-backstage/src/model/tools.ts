// An agent's tool calls in plain words: "Read episode s1e01", "Edited step 3: the line's words". The assistant's chat
// (ui/chat/) and the Agents page's activity log (ui/agents.ts) show the same label and the same icon for a call, from its
// tool's name and input. Every tool backstage gives an agent (server/mcp.ts) and the assistant's own tools have an entry
// here: the MCP test fails on a tool without one.

/** What kind of thing a call does: its icon in the chat. */
export type ToolKind = "read" | "search" | "check" | "edit" | "create" | "comment" | "show" | "look" | "web" | "memory" | "ask";

type In = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

/** A path in a document as words: steps/12/choice/options/0/reply/1 → step 12 · option 1 · reply 2. */
export function pathWords(path: unknown): string {
  const keys = (Array.isArray(path) ? path : str(path).split("/")).filter(k => k !== "");
  if (!keys.length) return "the whole document";
  const out: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const k = String(keys[i]), n = keys[i + 1] !== undefined && /^\d+$/.test(String(keys[i + 1])) ? Number(keys[i + 1]) : null;
    if (k === "steps" && n !== null) { out.push(`step ${n}`); i++; }
    else if (k === "options" && n !== null) { out.push(`option ${n + 1}`); i++; }
    else if (k === "reply" && n !== null) { out.push(`reply ${n + 1}`); i++; }
    else if (k === "quiz" && n !== null) { out.push(`quiz question ${n + 1}`); i++; }
    else if (/^\d+$/.test(k) && i === 0) out.push(`step ${k}`);
    else if (k !== "choice" && k !== "beat") out.push(k);
  }
  return out.join(" · ");
}

/** The keys a patch changes, as words. */
const changes = (patch: unknown) => {
  const ks = patch && typeof patch === "object" ? Object.keys(patch) : [];
  return ks.length ? ks.slice(0, 4).join(", ") + (ks.length > 4 ? "…" : "") : "";
};
const at = (i: In, key = "path") => (i[key] !== undefined ? ` · ${pathWords(i[key])}` : "");

const TOOLS: Record<string, { kind: ToolKind; label: (i: In) => string }> = {
  series_overview: { kind: "read", label: () => "Read the series overview" },
  list_episodes: { kind: "read", label: i => `Listed the episodes${i.season ? ` of season ${str(i.season).replace(/^s/, "")}` : ""}` },
  read_episode: { kind: "read", label: i => `Read episode ${str(i.id)}` },
  read_step: { kind: "read", label: i => `Read ${str(i.id)}${at(i)}` },
  read_notes: { kind: "read", label: i => `Read the review notes of ${str(i.id)}` },
  read_doc: { kind: "read", label: i => `Read ${str(i.kind)} ${str(i.id)}` },
  read_guide: { kind: "read", label: i => `Read the guide ${str(i.name)}${i.section ? ` · ${str(i.section)}` : ""}` },
  kit_search: { kind: "search", label: i => `Looked up ${str(i.kind) || "the kit"}${i.query ? `: “${str(i.query)}”` : ""}` },
  kit_read: { kind: "read", label: i => `Read the kit item ${str(i.id)}` },
  kit_render: { kind: "look", label: i => `Drew ${Array.isArray(i.items) ? `${i.items.length} kit items` : i.doc ? `the drawing ${str((i.doc as In).id)}` : `the kit item ${str(i.id)}`}` },
  draft_kit_item: { kind: "look", label: i => `Tried ${Array.isArray(i.docs) ? `${i.docs.length} drawings` : `the drawing ${str((i.doc as In | undefined)?.id)}`}` },
  draft_variant: { kind: "look", label: i => `Tried the variant ${str(i.of)}.${str(i.name)}` },
  save_kit_item: { kind: "create", label: i => `Saved the drawing ${str((i.doc as In | undefined)?.id)}` },
  save_variant: { kind: "create", label: i => `Saved the variant ${str(i.of)}.${str(i.name)}` },
  promote_kit_item: { kind: "create", label: i => `${i.pr ? "Offered" : "Checked offering"} ${str(i.kitId)} to Sahne as ${str(i.id)}` },
  search_words: { kind: "search", label: i => `Searched the word cards: “${str(i.query)}”` },
  search_lines: { kind: "search", label: i => `Searched the lines: “${str(i.query)}”` },
  find_uses: { kind: "search", label: i => `Found where ${str(i.kind)} ${str(i.id)}${i.part ? ` · ${str(i.part)}` : ""} is used` },
  list_proposals: { kind: "read", label: () => "Listed the proposals" },
  check_episode: { kind: "check", label: i => `Checked ${str(i.id)}` },
  check_season: { kind: "check", label: i => `Checked season ${str(i.id).replace(/^s/, "")}` },
  suggest_staging: { kind: "check", label: i => `Asked the rules for staging in ${str(i.id)}` },
  edit_step: { kind: "edit", label: i => `Edited ${str(i.id)}${at(i)}${changes(i.patch) ? `: ${changes(i.patch)}` : ""}` },
  insert_step: { kind: "edit", label: i => `Added a step to ${str(i.id)}${at(i, "at")}` },
  delete_step: { kind: "edit", label: i => `Deleted ${str(i.id)}${at(i)}` },
  move_step: { kind: "edit", label: i => `Moved ${str(i.id)} · ${pathWords(i.from)} → ${pathWords(i.to)}` },
  set_staging: { kind: "edit", label: i => `Staged ${str(i.id)}${at(i)}${changes(i.staging) ? `: ${changes(i.staging)}` : ""}` },
  set_texts: { kind: "edit", label: i => `Wrote ${str(i.id)}${at(i)}${changes(i.texts) ? ` in ${changes(i.texts)}` : ""}` },
  set_calendar: { kind: "edit", label: i => `Put ${str(i.story)} on ${str((i.row as In | undefined)?.date)}` },
  set_review: { kind: "edit", label: i => `Marked ${str(i.id)} ${str(i.status)}` },
  edit_doc: { kind: "edit", label: i => `Edited ${str(i.kind)} ${str(i.id)}${i.path ? ` · ${str(i.path).replace(/\//g, " · ")}` : ""}` },
  set_week_theme: { kind: "edit", label: i => `Set week ${str(i.week)}'s theme in season ${str(i.season).replace(/^s/, "")}` },
  withdraw_proposal: { kind: "edit", label: i => `Took back proposal ${str(i.id)}` },
  create_episode: { kind: "create", label: i => `Started a new episode${i.id ? ` ${str(i.id)}` : ""} in season ${str(i.season)}` },
  create_season: { kind: "create", label: i => `Started season ${str(i.n)}` },
  create_character: { kind: "create", label: i => `Added the character ${str(i.id)}` },
  create_place: { kind: "create", label: i => `Added the place ${str(i.id)}${i.from ? ` (from ${str(i.from)})` : ""}` },
  comment: { kind: "comment", label: i => `Commented on ${str(i.id)}${at(i, "step")}` },
  show: { kind: "show", label: i => `Showed ${str(i.id)}${at(i, "step")} in the editor` },
  look: { kind: "look", label: i => `Looked at ${str(i.id)}${at(i, "step")}` },
  web_search: { kind: "web", label: i => `Searched the web: “${str(i.query)}”` },
  code_execution: { kind: "web", label: () => "Sorted the search results" },
  web_fetch: { kind: "web", label: i => `Read a web page${i.url ? `: ${hostOf(str(i.url))}` : ""}` },
  read_web_page: { kind: "web", label: i => `Read a web page: ${hostOf(str(i.url))}` },
  remember: { kind: "memory", label: () => "Remembered a note" },
  forget: { kind: "memory", label: i => `Forgot note ${str(i.id)}` },
  ask_person: { kind: "ask", label: () => "Asked you" },
};

export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url.slice(0, 60); } };

/** The tools that have words here (the MCP test checks every tool has). */
export const LABELLED = Object.keys(TOOLS);

/** A call as words, and its kind. An unknown tool reads as its name. */
export function toolLabel(name: string, input?: unknown): { label: string; kind: ToolKind } {
  const t = TOOLS[name], i = (input && typeof input === "object" ? input : {}) as In;
  if (!t) return { label: name.replace(/_/g, " "), kind: "read" };
  try { return { label: t.label(i), kind: t.kind }; } catch { return { label: name.replace(/_/g, " "), kind: t.kind }; }
}

/** What a run of calls did, in one line: "read 3 episodes · checked s1e01 · proposed 2 edits". */
export function groupSummary(calls: { name: string; input?: unknown; ok?: boolean }[]): string {
  const count: Partial<Record<ToolKind, number>> = {};
  for (const c of calls) { const k = toolLabel(c.name, c.input).kind; count[k] = (count[k] ?? 0) + 1; }
  const n = (k: ToolKind, one: string, many: string) => (count[k] ? `${count[k] === 1 ? one : `${count[k]} ${many}`}` : "");
  const parts = [n("read", "read 1 thing", "reads"), n("search", "1 lookup", "lookups"), n("check", "1 check", "checks"), n("edit", "1 edit", "edits"), n("create", "1 new document", "new documents"),
    n("comment", "1 comment", "comments"), n("show", "showed it", "shows"), n("look", "looked at the stage", "looks at the stage"), n("web", "1 web search", "web searches"), n("memory", "1 note", "notes"), n("ask", "a question", "questions")].filter(Boolean);
  const bad = calls.filter(c => c.ok === false).length;
  return parts.join(" · ") + (bad ? ` · ${bad} refused` : "");
}
