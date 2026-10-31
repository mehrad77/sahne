// The side panel beside every page (✦ and ? in the top bar, or the palette): the assistant, the agents (what waits
// for you, how their edits land, how to connect one, what they did lately) and the guides (the part about the page
// you are on). The tab is kept in this browser.

import { html } from "htm/preact";
import { proposals } from "../events.ts";
import { AssistantChat, assistantOpen, sideTab, type SideTab } from "./assistant.ts";
import { AgentsPanel } from "./agents.ts";
import { DocsPanel } from "./docs.ts";
import { Drawer, Icon } from "./kit/index.ts";

const TABS: [SideTab, string, string][] = [["assistant", "spark", "Assistant"], ["agents", "plug", "Agents"], ["docs", "book", "Docs"]];

/** Open the panel on a tab; the same tab again closes it. */
export function toggleSide(tab: SideTab) {
  if (assistantOpen.value && sideTab.value === tab) { assistantOpen.value = false; return; }
  showTab(tab);
  assistantOpen.value = true;
}
function showTab(tab: SideTab) {
  sideTab.value = tab;
  try { localStorage.setItem("backstage:side", tab); } catch { /* kept only for this visit */ }
}

export function SidePanel() {
  if (!assistantOpen.value) return null;
  const tab = sideTab.value, n = proposals.value.length;
  const title = html`<div class="tabs side-tabs" role="tablist" aria-label="Side panel">${TABS.map(([id, icon, label]) => html`<button role="tab" aria-selected=${tab === id} onClick=${() => showTab(id)}>
    <${Icon} name=${icon} size=${14} /> ${label}${id === "agents" && n ? html` <span class="badge">${n}</span>` : ""}</button>`)}</div>`;
  return html`<${Drawer} title=${title} label="Side panel" onClose=${() => { assistantOpen.value = false; }}>
    ${tab === "assistant" ? html`<${AssistantChat} />` : tab === "agents" ? html`<${AgentsPanel} />` : html`<${DocsPanel} />`}
  </${Drawer}>`;
}
