// Under the stage: the times the place is seen at (a click shows one; × drops it, + adds one), its states as switches
// (one of a group at a time), and its ambience as a sound board (a chip turns a sound on, ▶ plays it).

import { html } from "htm/preact";
import { TIMES } from "sahne";
import type { StoryPlace } from "sahne-story";
import { set } from "../../model/path.ts";
import { KIT } from "../../stage.ts";
import { playSound, soundPlaying } from "../galleries.ts";

const AMBIENT = /amb|crowd|traffic|rain|wind|sea|gull|cafe|room|street|metro|kitchen|birds|hum|train/;
const SOUNDS = Object.keys(KIT.sounds ?? {}).sort();

export function MoodStrip(p: { doc: StoryPlace; edit(fn: (x: StoryPlace) => StoryPlace): void; time?: string; setTime(t: string | undefined): void; states: string[]; setStates(s: string[]): void }) {
  const { doc } = p, times = doc.times ?? [];
  const more = Object.keys(TIMES).filter(t => !times.includes(t));
  const setTimes = (l: string[]) => p.edit(x => set(x, ["times"], l.length ? l : undefined));
  const toggle = (s: string) => {
    const group = doc.states?.[s]?.group;
    const others = p.states.filter(x => x !== s && !(group && doc.states?.[x]?.group === group));
    p.setStates(p.states.includes(s) ? others : [...others, s]);
  };
  const amb = doc.ambience ?? [];
  const sounds = SOUNDS.filter(s => AMBIENT.test(s) || amb.includes(s));
  const setAmb = (l: string[]) => p.edit(x => set(x, ["ambience"], l.length ? l : undefined));
  return html`<div class="panel pl-strip">
    <div class="group" role="group" aria-label="Times of day"><b>Time</b>
      ${times.map(t => html`<span class=${`pl-chip${t === (p.time ?? times[0]) ? " on" : ""}`} onClick=${() => p.setTime(t)} title=${`Show it at ${t}`}>${t}
        <button class="x" aria-label=${`Not seen at ${t}`} onClick=${(e: Event) => { e.stopPropagation(); setTimes(times.filter(x => x !== t)); if (p.time === t) p.setTime(undefined); }}>×</button></span>`)}
      ${more.length > 0 && html`<select style="width:auto;font-size:13px" aria-label="Add a time" value="" onChange=${(e: Event) => { const t = (e.target as HTMLSelectElement).value; if (t) { setTimes([...times, t]); p.setTime(t); } }}>
        <option value="">+ time</option>${more.map(t => html`<option>${t}</option>`)}</select>`}
    </div>
    ${Object.keys(doc.states ?? {}).length > 0 && html`<div class="group" role="group" aria-label="States"><b>State</b>
      ${Object.keys(doc.states ?? {}).map(s => html`<button class=${`pl-chip${p.states.includes(s) ? " on" : ""}`} aria-pressed=${p.states.includes(s)} onClick=${() => toggle(s)}>${s}</button>`)}
    </div>`}
    <div class="group" role="group" aria-label="Ambience"><b>Sound</b>
      ${sounds.map(s => html`<span class=${`pl-chip${amb.includes(s) ? " on" : " off"}`} onClick=${() => setAmb(amb.includes(s) ? amb.filter(x => x !== s) : [...amb, s])} title=${amb.includes(s) ? `${s}: on (click to turn off)` : `${s}: off (click to turn on)`}>
        ${s.replace(/_/g, " ")}<button class="play" aria-label=${`Play ${s}`} onClick=${(e: Event) => { e.stopPropagation(); playSound(s); }}>${soundPlaying.value === s ? "■" : "▶"}</button></span>`)}
    </div>
  </div>`;
}
