// Voices (#/voices): cast each character's recorded voice (sahne-voice). For every character who speaks: the brief the
// candidates are picked by (gender, age, accent), the candidates reading two of the character's own lines, a tempo (the
// clips are slowed or quickened without changing their pitch; the syllables per second say how fast), a pick and a
// confirmation. Then the generator makes every line of the confirmed voices (a story, or all of them), and a story's
// clips can be heard in order, the doubted ones marked. The work is server/voices.ts and sahne-voice's build/voices.ts.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import type { VoiceBrief, VoiceCast, VoiceChoice } from "sahne-voice";
import { world } from "../store.ts";
import { portraitOf } from "./galleries.ts";
import { tx } from "./fields.ts";

interface Cand { ref: string; lang: string; gender: string; f0: number; source: string; clips: { f: string; ms: number; doubt?: string; heard: string }[] }
interface Aud { who: string; brief: VoiceBrief; samples: string[]; candidates: Cand[] }
interface Job { args: string[]; done: boolean; code: number | null; started: number; log: string[] }
interface State { cast: VoiceCast; audition: Record<string, Aud>; counts: Record<string, { lines: number; made: number; doubt: number }>; pool: number; stories: string[]; job: Job | null; python: boolean }
interface StoryClips { story: string; lines: { who: string; text: string; clip: { f: string; ms: number; doubt?: string } | null }[] }

const api = async <T>(path: string, body?: unknown): Promise<T> => {
  const r = await fetch(`/api/voices${path}`, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const v = await r.json();
  if (!r.ok) throw new Error(v.message ?? r.statusText);
  return v as T;
};

// one player for the page: a new sample stops the last
const player = typeof Audio !== "undefined" ? new Audio() : null;
function play(url: string, tempo = 1) {
  if (!player) return;
  player.src = url;
  player.preservesPitch = true;
  player.playbackRate = tempo;
  void player.play();
}

/** Syllables of a Turkish (or any Latin-script) line: one per vowel. */
const syllables = (t: string) => (t.match(/[aeıioöuüâîûy]/giu) ?? []).length;
const LANG: Record<string, string> = { tr: "Turkish", fa: "Persian", ru: "Russian", uz: "Uzbek", ar: "Arabic", el: "Greek" };

export function VoicesPage() {
  const [s, setS] = useState<State | null>(null);
  const [err, setErr] = useState("");
  const [story, setStory] = useState("s1e01");
  const [clips, setClips] = useState<StoryClips | null>(null);
  const load = () => api<State>("").then(setS, e => setErr(String(e)));
  useEffect(() => { void load(); }, []);
  // while the generator runs, follow it
  useEffect(() => {
    if (!s?.job || s.job.done) return;
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [s?.job?.done, s?.job?.started]);
  const loadClips = (id: string) => api<StoryClips>(`/story/${id}`).then(setClips, e => setErr(String(e)));
  useEffect(() => { if (s?.job?.done) void loadClips(story); }, [s?.job?.done]);
  if (!s) return html`<div class="voices-page"><h1>Voices</h1><p class="note">${err || "Loading…"}</p></div>`;

  const w = world.value!;
  const who = Object.keys(s.cast.characters).sort((a, b) => (s.counts[b]?.lines ?? 0) - (s.counts[a]?.lines ?? 0));
  const confirmed = who.filter(x => s.cast.characters[x].voice?.confirmed);
  const running = !!s.job && !s.job.done;
  const start = (path: string, body: unknown) => api(path, body).then(load, e => setErr(String(e)));

  return html`<div class="voices-page">
    <h1>Voices</h1>
    <p class="note">Each character's own voice, cloned from a short sample by a speech model on this machine (Chatterbox Multilingual), then every line of theirs is generated, heard back and checked. Pick a candidate for each character, set the tempo until the pace is right for the learners, and confirm. ${s.pool ? `${s.pool} candidate voices in the pool.` : html`<b>No candidate voices yet</b>: build the pool (packages/sahne-voice/README.md).`}</p>
    ${!s.python && html`<p class="note bad">Backstage was started without SAHNE_VOICE_PYTHON, so it cannot run the speech model: auditions and generation are off. Picking and confirming still work.</p>`}
    ${err && html`<p class="note bad">${err}</p>`}
    <div class="row voices-bar">
      <span class="chip ${confirmed.length === who.length ? "ok" : ""}">${confirmed.length} of ${who.length} voices confirmed</span>
      <span class="grow"></span>
      <select value=${story} onChange=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; setStory(v); void loadClips(v); }}>${s.stories.map(id => html`<option value=${id}>${id}</option>`)}</select>
      <button disabled=${running || !confirmed.length || !s.python} onClick=${() => start("/generate", { stories: [story] })}>Generate ${story}</button>
      <button disabled=${running || !confirmed.length || !s.python} onClick=${() => start("/generate", {})}>Generate every story</button>
      <button onClick=${() => loadClips(story)}>Listen to ${story}</button>
      ${running && html`<button onClick=${() => start("/stop", {})}>Stop</button>`}
    </div>
    ${s.job && html`<details class="voices-job" open=${running}><summary>${running ? "Working" : s.job.code === 0 ? "Done" : "Stopped"}: ${s.job.args.join(" ")}</summary><pre>${s.job.log.join("\n")}</pre></details>`}
    ${clips && html`<${StoryList} clips=${clips} />`}
    <div class="voices-list">
      ${who.map(id => html`<${Character} key=${id} id=${id} name=${tx(w.characters[id]?.name) || id} pic=${portraitOf(w.characters[id], 72, "head")}
        entry=${s.cast.characters[id]} aud=${s.audition[id]} counts=${s.counts[id]} busy=${running} python=${s.python} onChange=${load} onError=${(e: unknown) => setErr(String(e))} />`)}
    </div>
  </div>`;
}

function StoryList({ clips }: { clips: StoryClips }) {
  const all = clips.lines.filter(l => l.clip);
  const playAll = (i = 0) => {
    const l = all[i];
    if (!l || !player) return;
    play(`/voices/clips/${clips.story}/${l.clip!.f}`);
    player.onended = () => { player.onended = null; setTimeout(() => playAll(i + 1), 350); };
  };
  return html`<section class="voices-story">
    <div class="row"><b>${clips.story}</b><span class="note">${all.length} of ${clips.lines.length} lines have a clip</span><span class="grow"></span>${all.length > 0 && html`<button onClick=${() => playAll()}>▶ Play them all</button>`}</div>
    <ol>${clips.lines.map(l => html`<li class=${l.clip?.doubt ? "doubt" : ""}>
      ${l.clip ? html`<button class="mini" onClick=${() => play(`/voices/clips/${clips.story}/${l.clip!.f}`)}>▶</button>` : html`<span class="mini none" title="No clip: the device's voice says it">·</span>`}
      <b>${l.who}</b> ${l.text}${l.clip?.doubt ? html` <span class="chip warn" title=${l.clip.doubt}>doubt</span>` : ""}</li>`)}</ol>
  </section>`;
}

function Character(p: { id: string; name: string; pic: string; entry: VoiceCast["characters"][string]; aud?: Aud; counts?: { lines: number; made: number; doubt: number }; busy: boolean; python: boolean; onChange: () => void; onError: (e: unknown) => void }) {
  const v = p.entry.voice;
  const [pick, setPick] = useState<string | undefined>(v?.ref);
  const [tempo, setTempo] = useState(v?.tempo ?? 0.9);
  const [feel, setFeel] = useState(v?.exaggeration ?? 0.5);
  const b = p.entry.brief;
  const dirty = !v || v.ref !== pick || v.tempo !== tempo || v.exaggeration !== feel;
  const save = (confirmed: boolean) => {
    if (!pick) return;
    const voice: VoiceChoice = { ref: pick, tempo, exaggeration: feel, cfg: v?.cfg ?? 0.3, confirmed };
    api("/choose", { who: p.id, voice }).then(p.onChange, p.onError);
  };
  const brief = (k: keyof VoiceBrief, val: string) => api("/brief", { who: p.id, brief: { ...b, [k]: val || undefined } }).then(p.onChange, p.onError);
  const rate = (c: Cand) => {
    const n = c.clips.reduce((a, x, i) => a + syllables(p.aud!.samples[i] ?? ""), 0), ms = c.clips.reduce((a, x) => a + x.ms, 0);
    return ms ? (n / (ms / 1000 / tempo)).toFixed(1) : "–";
  };
  return html`<section class=${`voice-card${v?.confirmed ? " confirmed" : ""}`}>
    <div class="row">
      <span class="voice-pic" dangerouslySetInnerHTML=${{ __html: p.pic }}></span>
      <div class="grow"><b>${p.name}</b> <span class="note">${p.counts?.lines ?? 0} lines${p.counts?.made ? ` · ${p.counts.made} made` : ""}${p.counts?.doubt ? ` · ${p.counts.doubt} doubted` : ""}</span>
        <div class="row small">
          <select value=${b.gender} onChange=${(e: Event) => brief("gender", (e.target as HTMLSelectElement).value)}>${["female", "male", "neutral"].map(x => html`<option>${x}</option>`)}</select>
          <select value=${b.age} onChange=${(e: Event) => brief("age", (e.target as HTMLSelectElement).value)}>${["child", "young", "adult", "elder"].map(x => html`<option>${x}</option>`)}</select>
          <select value=${b.accent ?? ""} onChange=${(e: Event) => brief("accent", (e.target as HTMLSelectElement).value)}><option value="">no accent</option>${Object.entries(LANG).filter(([k]) => k !== "tr").map(([k, n]) => html`<option value=${k}>${n} accent</option>`)}</select>
          ${b.note && html`<span class="note">${b.note}</span>`}
        </div>
      </div>
      <span class=${`chip ${v?.confirmed ? "ok" : v ? "warn" : ""}`}>${v?.confirmed ? `confirmed: ${v.ref}` : v ? `picked, not confirmed: ${v.ref}` : "no voice yet"}</span>
    </div>
    ${p.aud ? html`
      <table class="voice-cands">
        <thead><tr><th></th><th>Voice</th><th>Its sample</th>${p.aud.samples.map(t => html`<th class="sample">“${t}”</th>`)}<th title="Syllables per second at this tempo">syl/s</th></tr></thead>
        <tbody>${p.aud.candidates.map(c => html`<tr class=${pick === c.ref ? "on" : ""} onClick=${() => setPick(c.ref)}>
          <td><input type="radio" name=${`pick-${p.id}`} checked=${pick === c.ref} /></td>
          <td><b>${c.ref}</b> <span class="note">${LANG[c.lang] ?? c.lang} · ${c.gender} · ${c.f0} Hz</span></td>
          <td><button class="mini" onClick=${(e: Event) => { e.stopPropagation(); play(`/voices/pool/${c.ref}.wav`); }} title=${c.source}>▶</button></td>
          ${c.clips.map(x => html`<td><button class="mini" onClick=${(e: Event) => { e.stopPropagation(); setPick(c.ref); play(`/voices/audition/${p.id}/${x.f}`, tempo); }} title=${x.doubt ? `Doubted: ${x.doubt}` : `Heard: ${x.heard}`}>▶</button>${x.doubt ? html`<span class="chip warn" title=${x.doubt}>?</span>` : ""}</td>`)}
          <td class="note">${rate(c)}</td>
        </tr>`)}</tbody>
      </table>
      <div class="row">
        <label class="row">Tempo <input type="range" min="0.7" max="1.1" step="0.05" value=${tempo} onInput=${(e: Event) => setTempo(Number((e.target as HTMLInputElement).value))} /> <b>${Math.round(tempo * 100)} %</b></label>
        <label class="row">Feeling <select value=${String(feel)} onChange=${(e: Event) => setFeel(Number((e.target as HTMLSelectElement).value))}>
          ${[[0.35, "calm"], [0.5, "natural"], [0.7, "lively"]].map(([x, n]) => html`<option value=${String(x)}>${n}</option>`)}</select></label>
        <span class="grow"></span>
        <button disabled=${p.busy || !p.python} onClick=${() => api("/audition", { who: p.id, force: true }).then(p.onChange, p.onError)} title="Make the auditions again">Audition again</button>
        <button disabled=${!pick || (!dirty && !!v)} onClick=${() => save(false)}>Pick</button>
        <button class="primary" disabled=${!pick || (!dirty && v?.confirmed)} onClick=${() => save(true)}>Confirm</button>
      </div>` : html`<div class="row"><span class="note">No auditions yet.</span><button disabled=${p.busy || !p.python} onClick=${() => api("/audition", { who: p.id }).then(p.onChange, p.onError)}>Audition</button></div>`}
  </section>`;
}
