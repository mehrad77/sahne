// Read-only, explained where it shows: the top bar's state and every page's Save open one dialog that says why nothing
// is saved and how to start backstage so it is. Backstage writes only when it was started with `--write` (server/cli.ts):
// a switch on the page would let any page in the same browser turn writing on, so it is a start flag, not a button.
// Edits still work read-only (undo, the preview, the checks); they stay in this browser until the page reloads.

import { signal } from "@preact/signals";
import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { world } from "../store.ts";
import { Icon, Modal } from "./kit/index.ts";

/** Whether the read-only dialog is open (the top bar and the Save buttons open it). */
export const readOnlyHelp = signal(false);

function Command(p: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return html`<div class="ro-cmd"><code>${p.cmd}</code>
    <button class="small" onClick=${() => void navigator.clipboard?.writeText(p.cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>${copied ? "Copied" : "Copy"}</button></div>`;
}

/** The dialog: why nothing is saved here, and the command that starts backstage so it is. */
export function ReadOnlyHelp() {
  const w = world.value;
  if (!readOnlyHelp.value || !w) return null;
  const close = () => { readOnlyHelp.value = false; };
  return html`<${Modal} title="Read-only: nothing is saved" onClose=${close}>
    <div class="fields ro-help">
      ${w.oldShape ? html`
        <p>This content root has ${w.oldShape} file${w.oldShape === 1 ? "" : "s"} in the old language shape. Backstage saves nothing until the whole root is converted:</p>
        <${Command} cmd="node packages/sahne-story/convert/languages.ts" />` : html`
        <p>${w.samples ? "These are Sahne's own sample stories. " : ""}Backstage was started without <code>--write</code>, so it shows and checks everything but writes no file.</p>
        <p>You can still try things: edit, undo, play the stage and read the checks. Your edits stay in this tab until it reloads.</p>
        <p><b>To save,</b> stop backstage and start it again with <code>--write</code>${w.samples ? ", on your own content folder (saving the samples changes the repo's own files)" : ""}:</p>
        <${Command} cmd=${`node packages/sahne-backstage/server/cli.ts --content ${w.samples ? "/path/to/your/content" : "<the same folder>"} --write`} />
        <p class="note">It is a start flag, not a switch here, so that no other web page open in this browser can turn writing on.</p>`}
      <div class="row" style="justify-content:flex-end"><button class="primary" onClick=${close}>Got it</button></div>
    </div></${Modal}>`;
}

/** A page's Save: the save itself when backstage writes, else a Read-only button that says why. */
export function SaveButton(p: { onSave(): void; disabled?: boolean; label?: string; title?: string }) {
  if (!world.value?.writable) return html`<button class="ro-save" onClick=${() => { readOnlyHelp.value = true; }} title="Nothing is saved: backstage was started without --write. Click for how to save.">
    <${Icon} name="note" size=${16} /> Read-only</button>`;
  return html`<button class="primary" onClick=${p.onSave} disabled=${p.disabled} title=${p.title}><${Icon} name="save" size=${16} /> ${p.label ?? "Save"}</button>`;
}
