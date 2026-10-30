// The rules' staging suggestions, reviewed before they are added: every one the episode has, under the line (or action,
// or option) it is for, in plain words (a gesture, a feeling, who it is said to…), with why the rules suggest it and,
// where the block already has staging of that kind, what it replaces. Each has a box, all ticked; *Add* writes the ticked
// ones as one edit (undo takes them back). A line's words jump to it in the script.

import { html } from "htm/preact";
import { useMemo, useState } from "preact/hooks";
import { textOf, type StoryDoc } from "sahne-story";
import type { Suggest } from "../../model/autostage.ts";
import { chipsOf } from "../../model/parenthetical.ts";
import { get, type Path } from "../../model/path.ts";
import { Modal } from "../kit/index.ts";
import { inLang, useLangs } from "../lang.ts";

/** What each kind of staging is, in words. */
const KIND: Record<string, string> = { do: "Gesture", emo: "Feeling", to: "Said to", at: "Looks at", move: "Moves", obj: "Prop", cam: "Shot", voice: "Voice", sfx: "Sound", react: "Others react", link: "Tap the word", via: "Heard" };
/** A target as words: `obj:portakal` is the portakal on stage, `ch:nima` Nima. */
const thing = (t: string, name: (id: string) => string) => (t.startsWith("obj:") ? `the ${t.slice(4).replace(/_/g, " ")} on stage` : t.startsWith("ch:") ? name(t.slice(3).split(".")[0]) : t.startsWith("piece:") ? `the ${t.slice(6)}` : t);
/** A staging's chips, with word links spelled out (“portakal” → the portakal on stage) instead of counted. */
const described = (fix: Record<string, unknown>, name: (id: string) => string) => [
  ...chipsOf(fix, name).filter(c => c.key !== "link"),
  ...Object.entries((fix.link ?? {}) as Record<string, string>).map(([w, t]) => ({ key: "link", label: `“${w}” → ${thing(String(t), name)}` })),
];
const FROM: Record<Suggest["from"], string> = { lint: "a check", words: "the words", punctuation: "the punctuation" };

const pathOf = (k: string): Path => k.split("/").map(v => (/^\d+$/.test(v) ? Number(v) : v));
/** Where a block's staging is: a beat's own, else the step's. */
export const stagingAt = (s: StoryDoc, at: Path): { base: Path; st: Record<string, unknown> } => {
  const b = get(s, at) as Record<string, unknown> | undefined;
  const base = b && "beat" in b ? [...at, "beat"] : at;
  return { base, st: (get(s, base) ?? {}) as Record<string, unknown> };
};

export function SuggestionsReview(p: {
  story: StoryDoc; suggestions: Record<string, Suggest[]>; name(id: string): string;
  onAdd(picked: Record<string, Suggest[]>): void; onGo(at: Path): void; onClose(): void;
}) {
  const { main } = useLangs();
  const all = useMemo(() => Object.entries(p.suggestions).flatMap(([k, ss]) => ss.map((sg, i) => `${k}#${i}`)), [p.suggestions]);
  const [on, setOn] = useState<Set<string>>(() => new Set(all));
  const toggle = (id: string) => setOn(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const add = () => {
    const picked: Record<string, Suggest[]> = {};
    for (const [k, ss] of Object.entries(p.suggestions)) { const keep = ss.filter((_, i) => on.has(`${k}#${i}`)); if (keep.length) picked[k] = keep; }
    p.onAdd(picked);
  };
  return html`<${Modal} title=${`${all.length} suggested staging${all.length === 1 ? "" : "s"}`} wide onClose=${p.onClose}>
    <div class="fields sugg-review">
      <p class="note" style="margin:0">The rules found staging these lines do not have yet. Untick any you do not want; the rest are added to the script in one edit, and Undo takes them all back. Nothing is saved until you save.</p>
      ${Object.entries(p.suggestions).map(([k, ss]) => {
        const at = pathOf(k), block = (get(p.story, at) ?? {}) as Record<string, unknown>;
        const who = (block.who ?? (block.beat as Record<string, unknown> | undefined)?.who) as string | undefined;
        const words = textOf(block, main) ?? (block.beat ? "an action" : "");
        const { st } = stagingAt(p.story, at);
        return html`<section class="sugg-block">
          <button class="sugg-line" onClick=${() => p.onGo(at)} title="Show it in the script">
            ${who && html`<b>${p.name(who)}</b>`} <span ...${inLang(main)}>${words ? `“${words}”` : `step ${at.filter(x => typeof x === "number").join(".")}`}</span></button>
          ${ss.map((sg, i) => {
            const id = `${k}#${i}`, fix = sg.fix as Record<string, unknown>;
            const chips = described(fix, p.name);
            const replaces = Object.keys(fix).filter(x => st[x] !== undefined && JSON.stringify(st[x]) !== JSON.stringify(fix[x]) && x !== "link" && x !== "obj");
            return html`<label class=${`sugg-row${on.has(id) ? "" : " off"}`}>
              <input type="checkbox" checked=${on.has(id)} onChange=${() => toggle(id)} />
              <span class="what">${chips.map(c => html`<span class="sugg-chip"><small>${KIND[c.key] ?? c.key}</small> ${c.label}</span>`)}</span>
              <span class="why">${sg.why.replace(/\bobj:/g, "").replace(/\bch:/g, "")} <small>· from ${FROM[sg.from]}</small>
                ${replaces.length > 0 && html`<span class="replaces">Replaces ${replaces.map(x => `${(KIND[x] ?? x).toLowerCase()} “${chipsOf({ [x]: st[x] } as Record<string, unknown>, p.name)[0]?.label ?? String(st[x])}”`).join(", ")}</span>`}</span>
            </label>`;
          })}
        </section>`;
      })}
      <div class="row sugg-foot"><button class="small" onClick=${() => setOn(on.size === all.length ? new Set() : new Set(all))}>${on.size === all.length ? "Untick all" : "Tick all"}</button>
        <span class="grow"></span><button onClick=${p.onClose}>Cancel</button>
        <button class="primary" disabled=${!on.size} onClick=${add}>Add ${on.size} to the script</button></div>
    </div></${Modal}>`;
}
