// sahne-voice's generator: every line of every story in its character's own voice (README.md). From the repo root, with
// SAHNE_CONTENT set to the content root and SAHNE_VOICE_PYTHON to a Python that has the worker's packages (build/worker.py):
//
//   node packages/sahne-voice/build/voices.ts audition [--who a,b] [--n 5]  each character's candidates reading their lines
//   node packages/sahne-voice/build/voices.ts generate [--story a,b] [--who a,b]  the clips of the confirmed voices
//   node packages/sahne-voice/build/voices.ts --check                          fails when a confirmed voice has a missing or stale clip
//   node packages/sahne-voice/build/voices.ts status                           how many lines each voice has, made and doubted
//
// Casting happens between audition and generate, in backstage's Voices page (or by hand in voices/cast.json): pick a
// candidate, set its tempo, confirm. Only confirmed voices are generated or checked. A clip is made, heard back by Whisper
// and kept only if the language plugin's matchLine accepts what was heard and its length is near the language's own
// timing of the line; else it is made again with another seed, up to four times, and the best is kept and marked `doubt`.

import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LangPlugin } from "sahne";
import { tr } from "sahne-tr";
import { en } from "sahne-en";
import { de } from "sahne-de";
import { fa } from "sahne-fa";
import { CHARACTERS, SERIES, STORIES, VOICE_AUDITION, VOICE_CAST, VOICE_CLIPS, VOICE_POOL, VOICE_REFS, storyIds } from "../../sahne-story/paths.ts";
import { MODEL, clipFile, hash, type Clip, type Manifest, type VoiceBrief, type VoiceCast, type VoiceChoice } from "../src/index.ts";

const LANGS: Record<string, LangPlugin> = { tr, en, de, fa };
const STANDIN = "nima";
const path = (u: URL) => fileURLToPath(u);
const readJson = <T>(u: URL, or: T): T => (existsSync(u) ? (JSON.parse(readFileSync(u, "utf8")) as T) : or);
const writeJson = (u: URL, v: unknown) => writeFileSync(u, JSON.stringify(v, null, 1) + "\n");
const main = (readJson<{ languages?: { main: string } }>(SERIES, {}).languages?.main) ?? "tr";
const lang = LANGS[main];
if (!lang) throw new Error(`sahne-voice: no language plugin for "${main}"`);
const spoken = (t: string) => lang.spoken?.(t) ?? t;

// ---- the lines ----

export interface Line { who: string; text: string; emo?: string; whisper: boolean; story: string }

/** Every voiced line of a story, as the stage speaks it (the adapter's `said`: the main language, unpersonalised). */
export function linesOf(story: string): Line[] {
  const doc = JSON.parse(readFileSync(new URL(`${story}.json`, STORIES), "utf8")) as { steps: Record<string, unknown>[] };
  const out: Line[] = [];
  const add = (who: unknown, l: Record<string, unknown>) => {
    const text = l[main];
    if (typeof who !== "string" || typeof text !== "string" || !text.trim() || l.voice === "silent" || l.voice === "mouthing") return;
    if (!/[\p{L}\p{N}]/u.test(text)) return; // "…": the silent card
    out.push({ who, text, emo: typeof l.emo === "string" ? l.emo : undefined, whisper: l.voice === "whisper", story });
  };
  const walk = (s: Record<string, unknown>) => {
    add(s.who, s);
    const ch = s.choice as { options?: Record<string, unknown>[] } | undefined;
    for (const o of ch?.options ?? []) {
      add(STANDIN, o);
      for (const r of (o.reply as Record<string, unknown>[] | undefined) ?? []) walk(r);
    }
  };
  doc.steps.forEach(walk);
  return out;
}

// ---- the worker ----

class Worker {
  private p: ChildProcess;
  private waiting = new Map<number, (r: Record<string, unknown>) => void>();
  private n = 0;
  readonly ready: Promise<void>;
  constructor() {
    const py = process.env.SAHNE_VOICE_PYTHON ?? "python3";
    this.p = spawn(py, [path(new URL("worker.py", import.meta.url))], { stdio: ["pipe", "pipe", "ignore"] });
    let ok: () => void;
    this.ready = new Promise(r => { ok = r; });
    createInterface({ input: this.p.stdout! }).on("line", l => {
      let m: Record<string, unknown>;
      try { m = JSON.parse(l); } catch { return; }
      if (m.ready) { ok(); return; }
      this.waiting.get(m.id as number)?.(m);
      this.waiting.delete(m.id as number);
    });
    this.p.on("exit", c => { for (const w of this.waiting.values()) w({ ok: false, error: `the worker stopped (${c}): is SAHNE_VOICE_PYTHON a Python with chatterbox-tts?` }); });
  }
  async ask(q: Record<string, unknown>): Promise<Record<string, unknown>> {
    await this.ready;
    const id = ++this.n;
    return new Promise(r => { this.waiting.set(id, r); this.p.stdin!.write(JSON.stringify({ ...q, id }) + "\n"); });
  }
  close() { this.p.stdin!.end(); }
}

// ---- making one clip ----

const TMP = join(tmpdir(), `sahne-voice-${process.pid}`);
const ffmpeg = (...a: string[]) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...a]);
const lengthMs = (f: string) => Math.round(Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString()) * 1000);
const FEELING: Record<string, number> = { surprised: 0.15, laugh: 0.15, excited: 0.15, angry: 0.1, scared: 0.1, proud: 0.05, sad: -0.05, tired: -0.1 };

/** Trim the silence, level the loudness, set the tempo, and encode (AAC, mono, 24 kHz). */
function finish(wav: string, out: string, tempo: number) {
  const t = Math.min(1.5, Math.max(0.6, tempo));
  ffmpeg("-i", wav, "-af", `silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-18:TP=-1.5,atempo=${t}`,
    "-ar", "24000", "-ac", "1", "-c:a", "aac", "-b:a", "48k", out);
}

/** Whether a clip says the line: the language's say-it-aloud matching, and a length near its own timing of the line. */
function judge(text: string, heard: string, ms: number): { ok: boolean; doubt?: string; score: number } {
  const said = spoken(text);
  const m = lang.matchLine?.(heard, [said], { names: [STANDIN === "nima" ? "Nima" : STANDIN] });
  const score = m ? m.score : lang.normalise?.(heard) === lang.normalise?.(said) ? 1 : 0;
  const expect = lang.speech(said).dur, ratio = expect ? ms / expect : 1;
  if (m && !m.matched) return { ok: false, score, doubt: `heard "${heard}"` };
  if (ratio < 0.45 || ratio > 2.2) return { ok: false, score: score * 0.5, doubt: `${ms} ms for a line timed at ${expect} ms` };
  return { ok: true, score };
}

/** One clip in a voice, checked; the best of up to four takes. */
async function make(w: Worker, l: { who: string; text: string; emo?: string }, v: VoiceChoice, ref: string, out: string, takes = 4): Promise<{ ms: number; doubt?: string; heard: string }> {
  mkdirSync(TMP, { recursive: true });
  let best: { score: number; ms: number; doubt?: string; heard: string; f: string } | null = null;
  const exaggeration = Math.min(1, Math.max(0.25, v.exaggeration + (FEELING[l.emo ?? ""] ?? 0)));
  for (let i = 0; i < takes; i++) {
    const raw = join(TMP, `raw${i}.wav`), f = join(TMP, `take${i}.m4a`);
    const r = await w.ask({ op: "say", text: spoken(l.text), lang: main, ref, exaggeration, cfg: v.cfg, seed: parseInt(hash(`${l.who}${l.text}${i}`).slice(0, 8), 16), out: raw });
    if (!r.ok) throw new Error(String(r.error));
    finish(raw, f, v.tempo);
    const h = await w.ask({ op: "hear", path: f, lang: main });
    const heard = String(h.heard ?? ""), ms = lengthMs(f), j = judge(l.text, heard, ms);
    if (!best || (j.ok ? 2 : 0) + j.score > (best.doubt ? 0 : 2) + best.score) best = { score: j.score, ms, doubt: j.doubt, heard, f };
    if (j.ok) break;
  }
  copyFileSync(best!.f, out);
  return { ms: best!.ms, doubt: best!.doubt, heard: best!.heard };
}

// ---- the casting ----

interface PoolVoice { id: string; lang: string; gender: "female" | "male" | "child"; f0: number; source: string; license: string }
const pool = (): PoolVoice[] => readJson<PoolVoice[]>(new URL("pool.json", VOICE_POOL), []);
const cast = (): VoiceCast => readJson<VoiceCast>(VOICE_CAST, { model: MODEL, characters: {} });
/** The sample a confirmed voice is cloned from: the copy in refs/, made when it was picked. */
const refOf = (who: string) => path(new URL(`${who}.wav`, VOICE_REFS));
/** What a clip is made from: a change of any of these makes it stale. */
const sigOf = (l: Line, v: VoiceChoice) => hash(JSON.stringify([MODEL, v.ref, v.exaggeration, v.cfg, v.tempo, spoken(l.text), l.emo ?? "", 2]));

/** The best candidates for a brief: the right gender and accent, nearest the age's pitch. */
export function candidates(b: VoiceBrief, all: PoolVoice[], n: number): PoolVoice[] {
  const pitch = b.age === "child" ? 300 : b.gender === "neutral" ? 165 : b.gender === "female" ? (b.age === "elder" ? 190 : 225) : (b.age === "elder" ? 105 : b.age === "young" ? 130 : 118);
  const fits = (p: PoolVoice) => b.age === "child" ? p.gender === "child" || p.gender === "female" : p.gender !== "child" && (b.gender === "neutral" || p.gender === b.gender);
  const near = (ps: PoolVoice[]) => ps.filter(fits).sort((x, y) => Math.abs(x.f0 - pitch) - Math.abs(y.f0 - pitch));
  const accent = b.accent && b.accent !== main ? near(all.filter(p => p.lang === b.accent)) : [];
  const native = near(all.filter(p => p.lang === main));
  // an accented character: mostly their own language's voices, and a couple of Turkish ones to compare
  const take = accent.length ? [...accent.slice(0, n - 2), ...native.slice(0, 2)] : native.slice(0, n);
  return take.slice(0, n);
}

/** Two lines a character says, for the audition: a medium one and a question or an exclamation, from different stories. */
export function samplesOf(who: string, all: Line[]): string[] {
  const mine = all.filter(l => l.who === who && !/\bNima\b|Tahran/.test(l.text));
  const syl = (t: string) => lang.speech(spoken(t)).words.length;
  const mid = mine.filter(l => syl(l.text) >= 4 && syl(l.text) <= 9);
  const a = mid[Math.floor(mid.length / 3)] ?? mine[0];
  const b = mid.find(l => l !== a && l.story !== a?.story && /[?!]$/.test(l.text.trim())) ?? mid.find(l => l !== a) ?? mine.find(l => l !== a);
  return [a?.text, b?.text].filter((t): t is string => !!t);
}

interface Audition { who: string; brief: VoiceBrief; samples: string[]; candidates: { ref: string; lang: string; gender: string; f0: number; source: string; clips: { f: string; ms: number; doubt?: string; heard: string }[] }[] }

async function audition(o: { who?: string[]; n: number; force: boolean }) {
  const c = cast(), all = storyIds().flatMap(linesOf), voices = pool();
  if (!voices.length) throw new Error(`no candidate voices: build ${path(VOICE_POOL)}pool.json first (build/pool.py)`);
  const dir = VOICE_AUDITION, index = readJson<Record<string, Audition>>(new URL("audition.json", dir), {});
  const w = new Worker();
  try {
    for (const [who, ch] of Object.entries(c.characters)) {
      if ((o.who && !o.who.includes(who)) || ch.unvoiced) continue;
      const samples = samplesOf(who, all), out = new URL(`${who}/`, dir);
      mkdirSync(out, { recursive: true });
      const entry: Audition = { who, brief: ch.brief, samples, candidates: [] };
      for (const p of candidates(ch.brief, voices, o.n)) {
        const v: VoiceChoice = { ref: p.id, exaggeration: 0.5, cfg: 0.3, tempo: 1, confirmed: false };
        const clips = [];
        for (const [i, text] of samples.entries()) {
          const f = `${p.id}-${i}-${hash(text + v.cfg + v.exaggeration).slice(0, 6)}.m4a`, file = path(new URL(f, out));
          const old = index[who]?.candidates.find(x => x.ref === p.id)?.clips.find(x => x.f === f);
          if (old && existsSync(file) && !o.force) { clips.push(old); continue; }
          const r = await make(w, { who, text }, v, path(new URL(`${p.id}.wav`, VOICE_POOL)), file, 2);
          clips.push({ f, ...r });
          console.log(`${who.padEnd(10)} ${p.id.padEnd(6)} ${r.doubt ? "doubt" : "ok   "} ${text}`);
        }
        entry.candidates.push({ ref: p.id, lang: p.lang, gender: p.gender, f0: p.f0, source: p.source, clips });
      }
      // another run (backstage's Audition button) may have written since: merge into the file as it is now
      const now = readJson<Record<string, Audition>>(new URL("audition.json", dir), {});
      now[who] = index[who] = entry;
      writeJson(new URL("audition.json", dir), now);
    }
  } finally { w.close(); rmSync(TMP, { recursive: true, force: true }); }
}

/** Pick a voice for a character: its sample is copied to refs/ with its credit, and the choice is written (confirmed or not). */
export function choose(who: string, v: VoiceChoice) {
  const c = cast(), ch = c.characters[who];
  if (!ch) throw new Error(`no character "${who}" in voices/cast.json`);
  const p = pool().find(x => x.id === v.ref);
  if (!p) throw new Error(`no candidate "${v.ref}" in the pool`);
  mkdirSync(VOICE_REFS, { recursive: true });
  copyFileSync(path(new URL(`${p.id}.wav`, VOICE_POOL)), refOf(who));
  const credits = readJson<Record<string, unknown>>(new URL("CREDITS.json", VOICE_REFS), {});
  credits[who] = { sample: p.id, source: p.source, license: p.license, note: "The sample the voice is cloned from; the clips are made with Chatterbox Multilingual (MIT)." };
  writeJson(new URL("CREDITS.json", VOICE_REFS), credits);
  ch.voice = v;
  writeJson(VOICE_CAST, c);
}

// ---- generating ----

function stale(story: string, c: VoiceCast, who?: string[]) {
  const m = readJson<Manifest>(new URL(`${story}/manifest.json`, VOICE_CLIPS), { story, lines: {} });
  const todo: Line[] = [];
  for (const l of linesOf(story)) {
    const v = c.characters[l.who]?.unvoiced ? undefined : c.characters[l.who]?.voice;
    if (!v?.confirmed || (who && !who.includes(l.who))) continue;
    const have = m.lines[l.who]?.[l.text];
    if (!have || have.sig !== sigOf(l, v) || !existsSync(new URL(`${story}/${have.f}`, VOICE_CLIPS))) todo.push(l);
  }
  return { m, todo };
}

async function generate(o: { story?: string[]; who?: string[] }) {
  const c = cast(), w = new Worker();
  let made = 0, doubted = 0;
  try {
    for (const story of storyIds()) {
      if (o.story && !o.story.includes(story)) continue;
      const { m, todo } = stale(story, c, o.who);
      m.unvoiced = Object.entries(c.characters).filter(([, ch]) => ch.unvoiced).map(([w]) => w).sort();
      if (!m.unvoiced.length) delete m.unvoiced;
      const dir = new URL(`${story}/`, VOICE_CLIPS);
      mkdirSync(dir, { recursive: true });
      for (const l of todo) {
        const v = c.characters[l.who].voice!, f = clipFile(l.who, l.text);
        const r = await make(w, l, v, refOf(l.who), path(new URL(f, dir)));
        const clip: Clip = { f, ms: r.ms, sig: sigOf(l, v), ...(r.doubt ? { doubt: r.doubt } : {}) };
        (m.lines[l.who] ??= {})[l.text] = clip;
        writeJson(new URL("manifest.json", dir), m);
        made++; if (r.doubt) doubted++;
        console.log(`${story} ${l.who.padEnd(10)} ${r.doubt ? `doubt (${r.doubt})` : "ok"}  ${l.text}`);
      }
      // drop what no line uses any more
      const live = new Set(linesOf(story).map(l => `${l.who}\u0000${l.text}`));
      for (const [who, per] of Object.entries(m.lines)) for (const t of Object.keys(per)) if (!live.has(`${who}\u0000${t}`) || !c.characters[who]?.voice?.confirmed || c.characters[who]?.unvoiced) delete per[t];
      for (const [who, per] of Object.entries(m.lines)) if (!Object.keys(per).length) delete m.lines[who];
      const used = new Set(Object.values(m.lines).flatMap(per => Object.values(per).map(x => x.f)));
      for (const f of readdirSync(dir)) if (f.endsWith(".m4a") && !used.has(f)) rmSync(new URL(f, dir));
      writeJson(new URL("manifest.json", dir), m);
    }
  } finally { w.close(); rmSync(TMP, { recursive: true, force: true }); }
  console.log(`${made} clips made, ${doubted} doubted (listen to them in backstage's Voices page)`);
}

function check(): number {
  if (!existsSync(VOICE_CAST)) return 0;
  const c = cast();
  let n = 0;
  for (const story of storyIds()) {
    const { todo } = stale(story, c);
    for (const l of todo) { n++; if (n <= 20) console.error(`  ${story} ${l.who}: ${l.text}`); }
  }
  if (n) console.error(`sahne-voice: ${n} line(s) of confirmed voices have no clip or a stale one: node packages/sahne-voice/build/voices.ts generate`);
  return n;
}

function status() {
  const c = cast(), per: Record<string, { lines: number; made: number; doubt: number }> = {};
  for (const story of storyIds()) {
    const m = readJson<Manifest>(new URL(`${story}/manifest.json`, VOICE_CLIPS), { story, lines: {} });
    for (const l of linesOf(story)) {
      const s = (per[l.who] ??= { lines: 0, made: 0, doubt: 0 }), have = m.lines[l.who]?.[l.text];
      s.lines++; if (have) s.made++; if (have?.doubt) s.doubt++;
    }
  }
  for (const [who, s] of Object.entries(per).sort((a, b) => b[1].lines - a[1].lines)) {
    const v = c.characters[who]?.voice;
    if (c.characters[who]?.unvoiced) { console.log(`${who.padEnd(12)} ${String(s.lines).padStart(4)} lines  not voiced`); continue; }
    console.log(`${who.padEnd(12)} ${String(s.lines).padStart(4)} lines  ${String(s.made).padStart(4)} made  ${s.doubt ? `${s.doubt} doubted  ` : ""}${v ? `${v.ref}${v.confirmed ? "" : " (not confirmed)"}` : "no voice"}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  const list = (k: string) => opt(k)?.split(",");
  const VALUED = ["--who", "--n", "--story", "--ref", "--tempo", "--exaggeration", "--cfg"];
  const cmd = args.find((a, i) => !a.startsWith("--") && !VALUED.includes(args[i - 1])) ?? (args.includes("--check") ? "check" : "status");
  if (cmd === "check") process.exit(check() ? 1 : 0);
  else if (cmd === "status") status();
  else if (cmd === "audition") await audition({ who: list("who"), n: Number(opt("n") ?? 5), force: args.includes("--force") });
  else if (cmd === "generate") await generate({ story: list("story"), who: list("who") });
  else if (cmd === "choose") {
    const [who, ref] = [opt("who"), opt("ref")];
    if (!who || !ref) throw new Error("choose --who <id> --ref <pool id> [--tempo 0.9] [--exaggeration 0.5] [--cfg 0.3] [--confirm]");
    choose(who, { ref, tempo: Number(opt("tempo") ?? 0.9), exaggeration: Number(opt("exaggeration") ?? 0.5), cfg: Number(opt("cfg") ?? 0.3), confirmed: args.includes("--confirm") });
  } else { console.error(`unknown command "${cmd}"`); process.exit(2); }
}
