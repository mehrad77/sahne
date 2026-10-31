// src/shell/dom.ts
var $ = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== void 0) e.textContent = text;
  return e;
};
function button(label, onclick, pressed, title) {
  const b = $("button", "", label);
  b.type = "button";
  b.onclick = onclick;
  if (pressed !== void 0) b.setAttribute("aria-pressed", String(pressed));
  if (title) b.title = title;
  return b;
}
function bar(label, ...items) {
  const d = $("div", "bar");
  if (label) d.append($("b", "", label));
  d.append(...items);
  return d;
}
function choice(label, options, start, pick, names = {}) {
  const row = bar(label);
  const press = (o) => {
    for (const b of row.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.v === o));
  };
  for (const o of options) {
    const b = button(names[o] ?? o, () => {
      press(o);
      pick(o);
    }, o === start);
    b.dataset.v = o;
    row.append(b);
  }
  return Object.assign(row, { set: press });
}
function toggle(label, start, change, title) {
  let on = start;
  const b = button(label, () => {
    on = !on;
    b.setAttribute("aria-pressed", String(on));
    change(on);
  }, on, title);
  return b;
}
function slider(label, min, max, step, start, change, fmt = (v) => String(v)) {
  const wrap = $("label", "slider"), out = $("output", "", fmt(start)), input = $("input");
  Object.assign(input, { type: "range", min: String(min), max: String(max), step: String(step), value: String(start) });
  input.oninput = () => {
    out.textContent = fmt(Number(input.value));
    change(Number(input.value));
  };
  wrap.append($("span", "", label), input, out);
  return wrap;
}
function select(label, options, start, change) {
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
var chip = (text, kind = "", title) => {
  const c = $("span", `chip ${kind}`.trim(), text);
  if (title) c.title = title;
  return c;
};
function facts(rows) {
  const dl = $("dl", "facts");
  for (const [k, v] of rows) {
    if (v === void 0 || v === null || v === "") continue;
    const dd = $("dd");
    dd.append(v);
    dl.append($("dt", "", k), dd);
  }
  return dl;
}
var link = (text, hash) => Object.assign($("a", "", text), { href: hash });
function head(title, about, design) {
  const h = $("header", "head");
  const h2 = $("h2", "", title);
  if (design) h2.append(" ", chip(design));
  h.append(h2);
  if (about) h.append($("p", "note", about));
  return h;
}
var frame = (ratio = "16 / 9", cls = "") => {
  const f = $("div", `frame ${cls}`.trim());
  f.style.aspectRatio = ratio;
  return f;
};
function css(id, text) {
  if (document.getElementById(`css-${id}`)) return;
  const s = document.createElement("style");
  s.id = `css-${id}`;
  s.textContent = text;
  document.head.append(s);
}

export {
  $,
  button,
  bar,
  choice,
  toggle,
  slider,
  select,
  chip,
  facts,
  link,
  head,
  frame,
  css
};
//# sourceMappingURL=chunk-4TGKXDN4.js.map
