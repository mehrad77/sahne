// AI help (Node only, optional): Claude through the Messages API, with plain fetch and the key from the environment
// (ANTHROPIC_API_KEY; without it the editor hides these buttons). Three asks, each answering JSON to a schema
// (`output_config.format`; these models take no forced tool call):
//   rewrite  one line, option or reply, at the episode's level, with an instruction ("simpler", "warmer")
//   review   a second pass over the whole episode against its brief, which never sees how it was drafted
//   draft    the steps of an episode from its brief and its skeleton
// Only story text goes out: the story document (with its card ids, never a card's text) and the cast's names and roles.
// A reply is a suggestion: the editor shows it as a change to accept, and it goes through the same checks as any edit.
// Refusals are handled: `fallbacks: "default"` lets the API re-run a declined request on another model; a refusal that
// stands is an error to show.

const API = "https://api.anthropic.com/v1/messages";
/** The models: the strongest for a review and a draft, a faster one for rewriting a line. */
export const MODELS = { review: "claude-opus-5-5", draft: "claude-opus-5-5", rewrite: "claude-sonnet-5-5" } as const;

export const aiReady = () => !!process.env.ANTHROPIC_API_KEY;

type Fetch = typeof fetch;
let fetcher: Fetch = (...a) => fetch(...a);
/** Tests stub the network. */
export const setFetch = (f: Fetch) => { fetcher = f; };

class AiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const SYSTEM = `You help edit the stories of a language-learning series: short scenes played on a paper-theatre stage, in Turkish for the learner, with English and Persian translations. The stand-in is the learner (named in the series as "standin"); the narrator is Kerim, a collared dove. Lines are short, natural, everyday Turkish at the episode's level. Keep every id, character id and mark as it is. Never invent a nationality or language for the stand-in. Persian is natural, colloquial where the Turkish is, and written right to left. Answer only with the JSON the schema asks for.`;

async function ask<T>(model: string, effort: "low" | "medium" | "high", user: string, schema: object, maxTokens = 16000): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError(503, "AI help is off: start backstage with ANTHROPIC_API_KEY set");
  let r: Response;
  try {
    r = await fetcher(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-beta": "server-side-fallback-2026-07-01" },
      body: JSON.stringify({
        model, max_tokens: maxTokens, system: SYSTEM, fallbacks: "default",
        output_config: { effort, format: { type: "json_schema", schema } },
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (e) { throw new AiError(502, `could not reach the API: ${(e as Error).message}`); }
  const body = await r.json().catch(() => ({})) as { error?: { type?: string; message?: string }; stop_reason?: string; stop_details?: { explanation?: string }; content?: { type: string; text?: string }[] };
  if (!r.ok) {
    const why = body.error?.message ?? r.statusText;
    if (r.status === 401) throw new AiError(502, "the API key was refused");
    if (r.status === 429 || r.status === 529) throw new AiError(503, `the API is busy, try again in a moment (${why})`);
    throw new AiError(502, `the API answered ${r.status}: ${why}`);
  }
  if (body.stop_reason === "refusal") throw new AiError(422, `Claude declined this request${body.stop_details?.explanation ? `: ${body.stop_details.explanation}` : ""}`);
  if (body.stop_reason === "max_tokens") throw new AiError(502, "the answer was cut off (too long): try a smaller ask");
  const text = (body.content ?? []).filter(b => b.type === "text").map(b => b.text ?? "").join("");
  try { return JSON.parse(text) as T; } catch { throw new AiError(502, "the answer was not the JSON asked for"); }
}

const T3 = { type: "object", additionalProperties: false, required: ["tr", "en", "fa"], properties: { tr: { type: "string" }, en: { type: "string" }, fa: { type: "string" } } };

interface Cast { [id: string]: { name?: string; role?: string; kind?: string } }
const who = (cast: Cast) => Object.entries(cast).map(([id, c]) => `${id}: ${c.name ?? id}${c.kind ? ` (${c.kind})` : ""}${c.role ? `, ${c.role}` : ""}`).join("\n");
/** What leaves the machine of a story: the document as it is (texts, staging, card ids), never a card's text. */
const storyText = (story: unknown) => JSON.stringify(story, null, 1);

export async function ai(action: string, body: unknown): Promise<unknown> {
  const b = (body ?? {}) as { story?: unknown; path?: (string | number)[]; instruction?: string; brief?: string; cast?: Cast };
  if (!b.story || typeof b.story !== "object") throw new AiError(400, "expected { story, ... }");
  const cast = b.cast ?? {};
  if (action === "rewrite") {
    if (!Array.isArray(b.path)) throw new AiError(400, "expected { story, path, instruction? }");
    let v: unknown = b.story;
    for (const k of b.path) v = (v as Record<string | number, unknown>)?.[k];
    if (!v || typeof v !== "object" || typeof (v as { tr?: unknown }).tr !== "string") throw new AiError(400, "the path names no line");
    const out = await ask<{ tr: string; en: string; fa: string; why: string }>(MODELS.rewrite, "low",
      `The episode (JSON):\n${storyText(b.story)}\n\nThe cast:\n${who(cast)}\n\nRewrite the text at ${JSON.stringify(b.path)}:\n${JSON.stringify(v)}\n\n${b.instruction?.trim() ? `How: ${b.instruction.trim()}` : "Make it read naturally at the episode's level."}\nKeep its meaning in the scene and the words the episode teaches (its "words" are card ids; keep the Turkish words they name where the line uses them). Give the Turkish, English and Persian, and in "why" one short sentence on what you changed.`,
      { ...T3, required: ["tr", "en", "fa", "why"], properties: { ...T3.properties, why: { type: "string" } } }, 4000);
    return { suggestion: out, model: MODELS.rewrite };
  }
  if (action === "review") {
    const out = await ask<{ findings: unknown[]; summary: string }>(MODELS.review, "high",
      `Review this episode as a careful second reader who did not write it. ${b.brief?.trim() ? `Its brief:\n${b.brief.trim()}\n\n` : ""}The cast:\n${who(cast)}\n\nThe episode (JSON):\n${storyText(b.story)}\n\nFind what a reviewer must fix: Turkish that is wrong, unnatural or above the level; English or Persian that does not match the Turkish; a line that does not fit the scene or the brief; a quiz item whose answer or "why" does not hold; staging that contradicts the words (who is spoken to, what is pointed at). For each, the step number (-1 for the episode as a whole), a severity, the problem in one or two sentences, and where you can, the corrected line (Turkish, English, Persian; leave it out for anything but a line). In "summary", two sentences on the episode as a whole.`,
      { type: "object", additionalProperties: false, required: ["findings", "summary"], properties: {
        summary: { type: "string" },
        findings: { type: "array", items: { type: "object", additionalProperties: false, required: ["step", "severity", "message"], properties: {
          step: { type: "integer" }, severity: { enum: ["error", "warning", "note"] }, message: { type: "string" }, fix: T3,
        } } },
      } });
    return { ...out, model: MODELS.review };
  }
  if (action === "draft") {
    if (!b.brief?.trim()) throw new AiError(400, "expected { story, brief }");
    const out = await ask<{ steps_json: string; quiz_json: string; notes: string }>(MODELS.draft, "high",
      `Write the steps of this episode from its brief, in the story format its skeleton already uses (its scene, lines with "who", "tr", "en", "fa" and staging such as "to", "emo", "do", "at", one or two "choice" steps with two or three options, a "spot" whose "ex" is one of the lines and whose "lesson" is one of the episode's lessons). Use only the cast and the place the skeleton names, and the place's marks it uses. Use the episode's target words (its "words" are card ids). 10 to 14 lines for an episode, 20 to 28 for a special. Then three quiz items like the skeleton's, each "why" quoting a line in “ ”.\n\nThe brief:\n${b.brief.trim()}\n\nThe cast:\n${who(cast)}\n\nThe skeleton (JSON):\n${storyText(b.story)}\n\nAnswer "steps_json" as the JSON text of the whole steps array, "quiz_json" as the JSON text of the quiz array, and in "notes" what a reviewer should look at first.`,
      { type: "object", additionalProperties: false, required: ["steps_json", "quiz_json", "notes"], properties: { steps_json: { type: "string" }, quiz_json: { type: "string" }, notes: { type: "string" } } });
    let steps: unknown, quiz: unknown;
    try { steps = JSON.parse(out.steps_json); quiz = JSON.parse(out.quiz_json); } catch { throw new AiError(502, "the draft was not valid JSON"); }
    if (!Array.isArray(steps) || !Array.isArray(quiz)) throw new AiError(502, "the draft had no steps");
    return { steps, quiz, notes: out.notes, model: MODELS.draft };
  }
  throw new AiError(404, `no AI ask ${action}`);
}
