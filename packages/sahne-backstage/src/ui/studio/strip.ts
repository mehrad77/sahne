// The storyboard strip over the stage: one picture per beat of the episode as it plays now (each scene, line, reply and
// action, at its end), drawn once on the hidden stage and kept (thumbs.ts: a picture's key is everything up to its cue,
// so an edit late in the episode keeps the pictures before it). A click goes there in the script and on the stage; the
// one playing is marked, and a choice shows as a fork (its other options are another way through).

import { html } from "htm/preact";
import { useEffect, useRef } from "preact/hooks";
import { textOf, type CueInfo, type StoryDoc } from "sahne-story";
import { cuePath, type Path } from "../../model/path.ts";
import type { Preview } from "../../stage.ts";
import { cueThumb } from "../../thumbs.ts";
import { world } from "../../store.ts";
import { Picture } from "../kit/gallery.ts";
import { useLangs } from "../lang.ts";

const SHOWN = new Set<CueInfo["kind"]>(["scene", "line", "say", "reply", "beat", "act"]);

export function Strip(p: { preview: Preview; story: StoryDoc; at: number; select(path: Path, focus?: boolean): void; jump(i: number): void }) {
  const w = world.value!, { main } = useLangs();
  const pl = p.preview.player, info = pl.info;
  const perf = p.preview.adapted.perform(pl.picks);
  const cues = perf.script.cues, load = p.preview.adapted.load;
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => { el.current?.querySelector(".frame.now")?.scrollIntoView({ inline: "nearest", block: "nearest" }); }, [p.at]);
  return html`<div class="strip" ref=${el} role="list" aria-label="Storyboard">
    ${info.map((c, i) => {
      if (!SHOWN.has(c.kind) || i >= cues.length) return null;
      const who = c.who ? textOf(w.characters[c.who]?.name, main) ?? c.who : "";
      const label = c.kind === "scene" ? `${i} · scene` : c.kind === "act" ? `${i} · act` : `${i}${who ? ` · ${who}` : ""}`;
      const fork = c.turn?.kind === "choice";
      return html`<button role="listitem" class=${`frame${i === p.at ? " now" : ""}${fork ? " fork" : ""}`} title=${c.tr ? `${who}: ${c.tr}` : label}
        onClick=${() => { p.jump(i); p.select(cuePath(c), true); }}>
        <${Picture} art=${() => cueThumb(cues, i, load)} label=${label} />
        <small>${fork ? "⑂ " : ""}${label}</small></button>`;
    })}
  </div>`;
}
