// The Voices page's server side (sahne-voice): the casting, the auditions and the clips of the content root, a pick written
// back (`choose`), and the generator run as a child process whose log the page reads. Audio is served from the root's
// voices/ folder: the candidates' own samples, their auditions, and the clips.

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONTENT, VOICE_AUDITION, VOICE_CAST, VOICE_CLIPS, VOICE_POOL, storyIds } from "../../sahne-story/paths.ts";
import { MODEL, type Manifest, type VoiceBrief, type VoiceCast, type VoiceChoice } from "../../sahne-voice/src/index.ts";
import { choose, linesOf } from "../../sahne-voice/build/voices.ts";

const CLI = fileURLToPath(new URL("../../sahne-voice/build/voices.ts", import.meta.url));
const read = <T>(u: URL, or: T): T => (existsSync(u) ? (JSON.parse(readFileSync(u, "utf8")) as T) : or);
const castOf = () => read<VoiceCast>(VOICE_CAST, { model: MODEL, characters: {} });

/** A run of the generator: what it was asked, and its log so far. */
interface Job { args: string[]; log: string[]; done: boolean; code: number | null; started: number }
let job: Job | null = null;
let child: ChildProcess | null = null;

function run(args: string[]): Job {
  if (job && !job.done) throw new Error("the generator is already running");
  const j: Job = { args, log: [], done: false, code: null, started: Date.now() };
  job = j;
  child = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, SAHNE_CONTENT: fileURLToPath(CONTENT) }, stdio: ["ignore", "pipe", "pipe"] });
  const add = (d: Buffer) => { for (const l of d.toString().split("\n")) if (l.trim()) j.log.push(l); if (j.log.length > 400) j.log.splice(0, j.log.length - 400); };
  child.stdout!.on("data", add); child.stderr!.on("data", add);
  child.on("close", c => { j.done = true; j.code = c; child = null; });
  child.on("error", e => { j.log.push(String(e)); j.done = true; });
  return j;
}

/** Lines, clips and doubts per character, over every story. */
function counts() {
  const per: Record<string, { lines: number; made: number; doubt: number }> = {};
  for (const story of storyIds()) {
    const m = read<Manifest>(new URL(`${story}/manifest.json`, VOICE_CLIPS), { story, lines: {} });
    for (const l of linesOf(story)) {
      const s = (per[l.who] ??= { lines: 0, made: 0, doubt: 0 }), have = m.lines[l.who]?.[l.text];
      s.lines++; if (have) s.made++; if (have?.doubt) s.doubt++;
    }
  }
  return per;
}

/** The clips of one story, in story order, for listening: who, text, file, doubt. */
function storyClips(story: string) {
  const m = read<Manifest>(new URL(`${story}/manifest.json`, VOICE_CLIPS), { story, lines: {} });
  return linesOf(story).map(l => ({ who: l.who, text: l.text, clip: m.lines[l.who]?.[l.text] ?? null }));
}

export interface VoicesReply { status: number; body: unknown }

/** /api/voices…: GET the state; POST brief, choose, audition, generate, stop. */
export async function voicesApi(method: string, a: string | undefined, b: string | undefined, body: () => Promise<unknown>, writable: boolean): Promise<VoicesReply> {
  if (method === "GET" && !a) {
    return { status: 200, body: {
      cast: castOf(), audition: read(new URL("audition.json", VOICE_AUDITION), {}), counts: counts(),
      pool: read<unknown[]>(new URL("pool.json", VOICE_POOL), []).length, stories: storyIds(),
      job: job && { args: job.args, done: job.done, code: job.code, started: job.started, log: job.log.slice(-60) },
      python: !!process.env.SAHNE_VOICE_PYTHON,
    } };
  }
  if (method === "GET" && a === "story" && b) return { status: 200, body: { story: b, lines: storyClips(b) } };
  if (method !== "POST") return { status: 404, body: { message: "no such voices route" } };
  if (!writable) return { status: 403, body: { message: "backstage is read-only: start it with --write" } };
  const q = (await body()) as Record<string, unknown>;
  const who = typeof q.who === "string" ? q.who : undefined;
  if (a === "brief" && who) {
    const c = castOf(), brief = q.brief as VoiceBrief;
    (c.characters[who] ??= { brief }).brief = brief;
    writeFileSync(VOICE_CAST, JSON.stringify(c, null, 1) + "\n");
    return { status: 200, body: { ok: true } };
  }
  if (a === "unvoiced" && who) {
    const c = castOf(), ch = c.characters[who];
    if (!ch) return { status: 404, body: { message: `no character "${who}" in voices/cast.json` } };
    if (q.on === true) ch.unvoiced = true; else delete ch.unvoiced;
    writeFileSync(VOICE_CAST, JSON.stringify(c, null, 1) + "\n");
    return { status: 200, body: { ok: true } };
  }
  if (a === "choose" && who) {
    const v = q.voice as VoiceChoice;
    if (!v || typeof v.ref !== "string") return { status: 400, body: { message: "expected { who, voice: { ref, tempo, exaggeration, cfg, confirmed } }" } };
    choose(who, { ref: v.ref, tempo: Number(v.tempo) || 1, exaggeration: Number(v.exaggeration) || 0.5, cfg: Number(v.cfg) || 0.3, confirmed: v.confirmed === true });
    return { status: 200, body: { ok: true } };
  }
  if (a === "audition") return { status: 200, body: { job: run(["audition", ...(who ? ["--who", who] : []), ...(q.force ? ["--force"] : [])]) } };
  if (a === "generate") {
    const stories = Array.isArray(q.stories) ? (q.stories as string[]).filter(s => /^[a-z0-9_]+$/.test(s)) : [];
    return { status: 200, body: { job: run(["generate", ...(stories.length ? ["--story", stories.join(",")] : []), ...(who ? ["--who", who] : [])]) } };
  }
  if (a === "stop") { child?.kill(); return { status: 200, body: { ok: true } }; }
  return { status: 404, body: { message: "no such voices route" } };
}

const AUDIO: Record<string, string> = { m4a: "audio/mp4", wav: "audio/wav" };

/** A voices/ audio file for /voices/<pool|audition|clips>/…, or null (no such file, or a path that leaves the folder). */
export function voiceFile(pathname: string): { file: string; type: string } | null {
  const m = /^\/voices\/(pool|audition|clips)\/((?:[a-z0-9_]+\/)?[a-z0-9_-]+\.(m4a|wav))$/.exec(pathname);
  if (!m) return null;
  const base = m[1] === "pool" ? VOICE_POOL : m[1] === "audition" ? VOICE_AUDITION : VOICE_CLIPS;
  const u = new URL(m[2], base);
  return existsSync(u) ? { file: fileURLToPath(u), type: AUDIO[m[3]] } : null;
}
