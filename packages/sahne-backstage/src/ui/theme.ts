// Light, dark, or as the system is: the studio's theme, kept in this browser (`data-theme` on the page; index.html's
// tokens follow it).

import { signal } from "@preact/signals";

export type Theme = "system" | "light" | "dark";
const KEY = "backstage:theme";
const read = (): Theme => { try { const t = localStorage.getItem(KEY); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } };

export const theme = signal<Theme>(read());

function apply(t: Theme) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}
apply(theme.value);

/** The next theme in the cycle system → light → dark. */
export function cycleTheme() {
  const t: Theme = theme.value === "system" ? "light" : theme.value === "light" ? "dark" : "system";
  theme.value = t;
  apply(t);
  try { if (t === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* no storage */ }
}
