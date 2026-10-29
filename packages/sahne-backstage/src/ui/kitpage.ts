// The kit (#/kit): what a scene can be staged with, as galleries: props and set pieces, gestures, emotions, sounds. A
// sound plays on a click. The same galleries are the pickers of the script and of directing on the stage.

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { Gallery } from "./kit/gallery.ts";
import { emotionItems, gestureItems, pieceItems, playSound, soundItems } from "./galleries.ts";
import { useLangs } from "./lang.ts";

const TABS = [["props", "Props"], ["set", "Set pieces"], ["gestures", "Gestures"], ["emotions", "Emotions"], ["sounds", "Sounds"]] as const;

export function KitPage() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("props");
  const { main } = useLangs();
  const items = tab === "props" ? pieceItems("props") : tab === "set" ? pieceItems("set") : tab === "gestures" ? gestureItems() : tab === "emotions" ? emotionItems() : soundItems(main);
  return html`<section>
    <div class="pagehead"><h2 class="grow">The kit</h2><span class="note">What a scene is staged with. Pick from these in the script or on the stage.</span></div>
    <div class="tabs" role="tablist">${TABS.map(([id, label]) => html`<button role="tab" aria-selected=${tab === id} onClick=${() => setTab(id)}>${label}</button>`)}</div>
    <${Gallery} key=${tab} items=${items} label=${TABS.find(t => t[0] === tab)![1]} size=${tab === "emotions" || tab === "sounds" ? "s" : "m"} onPick=${tab === "sounds" ? playSound : undefined} searchable=${true} />
  </section>`;
}
