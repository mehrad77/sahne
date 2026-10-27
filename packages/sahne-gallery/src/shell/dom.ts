// The gallery's small UI: elements, buttons, rows of choices, toggles, sliders and fact lists. Every
// section builds its controls from these, so they look and behave the same everywhere.

/** An element with a class and text. */
export const $ = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function button(label: string, onclick: () => void, pressed?: boolean, title?: string): HTMLButtonElement {
  const b = $("button", "", label);
  b.type = "button";
  b.onclick = onclick;
  if (pressed !== undefined) b.setAttribute("aria-pressed", String(pressed));
  if (title) b.title = title;
  return b;
}

/** A labelled row of controls. */
export function bar(label: string, ...items: (Node | string)[]): HTMLDivElement {
  const d = $("div", "bar");
  if (label) d.append($("b", "", label));
  d.append(...items);
  return d;
}

/** A row of buttons of which one is pressed; `pick` runs on a press (not at the start). Returns the row, with `set(o)` to press one from code. */
export function choice<T extends string>(label: string, options: readonly T[], start: T | undefined, pick: (o: T) => void, names: Partial<Record<T, string>> = {}) {
  const row = bar(label);
  const press = (o: T) => { for (const b of row.querySelectorAll<HTMLButtonElement>("button")) b.setAttribute("aria-pressed", String(b.dataset.v === o)); };
  for (const o of options) {
    const b = button(names[o] ?? o, () => { press(o); pick(o); }, o === start);
    b.dataset.v = o;
    row.append(b);
  }
  return Object.assign(row, { set: press });
}

/** A button that stays pressed or not. */
export function toggle(label: string, start: boolean, change: (on: boolean) => void, title?: string): HTMLButtonElement {
  let on = start;
  const b = button(label, () => { on = !on; b.setAttribute("aria-pressed", String(on)); change(on); }, on, title);
  return b;
}

/** A labelled range input that reports its value as it moves. */
export function slider(label: string, min: number, max: number, step: number, start: number, change: (v: number) => void, fmt = (v: number) => String(v)) {
  const wrap = $("label", "slider"), out = $("output", "", fmt(start)), input = $("input");
  Object.assign(input, { type: "range", min: String(min), max: String(max), step: String(step), value: String(start) });
  input.oninput = () => { out.textContent = fmt(Number(input.value)); change(Number(input.value)); };
  wrap.append($("span", "", label), input, out);
  return wrap;
}

/** A select from a list of values (or [value, label] pairs). */
export function select(label: string, options: (string | [string, string])[], start: string, change: (v: string) => void) {
  const wrap = $("label", "pick"), s = $("select");
  for (const o of options) {
    const [v, l] = typeof o === "string" ? [o, o] : o;
    s.append(Object.assign($("option", "", l), { value: v, selected: v === start }));
  }
  s.onchange = () => change(s.value);
  if (label) wrap.append($("span", "", label));
  wrap.append(s);
  return wrap;
}

/** A small rounded label: ok (accent), warn, bad, or plain. */
export const chip = (text: string, kind: "" | "ok" | "warn" | "bad" | "ph" = "", title?: string) => {
  const c = $("span", `chip ${kind}`.trim(), text);
  if (title) c.title = title;
  return c;
};

/** A definition list of facts; empty values are left out. */
export function facts(rows: [string, string | Node | undefined | null][]): HTMLDListElement {
  const dl = $("dl", "facts");
  for (const [k, v] of rows) {
    if (v === undefined || v === null || v === "") continue;
    const dd = $("dd");
    dd.append(v);
    dl.append($("dt", "", k), dd);
  }
  return dl;
}

/** A link inside the gallery. */
export const link = (text: string, hash: string) => Object.assign($("a", "", text), { href: hash });

/** A heading with a line under it saying what the block shows and where it is in DESIGN.md. */
export function head(title: string, about?: string, design?: string) {
  const h = $("header", "head");
  const h2 = $("h2", "", title);
  if (design) h2.append(" ", chip(design));
  h.append(h2);
  if (about) h.append($("p", "note", about));
  return h;
}

/** A box for a stage, 16:9 unless told otherwise. */
export const frame = (ratio = "16 / 9", cls = "") => {
  const f = $("div", `frame ${cls}`.trim());
  f.style.aspectRatio = ratio;
  return f;
};

/** A view's own CSS, put in the page once (the shell's one stylesheet holds what every view shares). */
export function css(id: string, text: string) {
  if (document.getElementById(`css-${id}`)) return;
  const s = document.createElement("style");
  s.id = `css-${id}`;
  s.textContent = text;
  document.head.append(s);
}
