// Tests of the still backend: the compact path text, the safe SVG of a group, the recording
// canvas context, the strip geometry (against the stage's own formulas), the figure and the
// portrait: deterministic, finite, well formed, ids that never collide, nothing hostile in the
// markup, and the size budgets of DESIGN.md §10.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Path, ellipse, circle, rect, rrect, smooth, band, cmdsToD, asEllipse, svgGeom, svgNums, type Cmd } from "../src/art/path.ts";
import { groupSvg, shadowFilter, svgColor, drawGroup, groupBounds, shapeBounds, type Group } from "../src/art/shape.ts";
import { tone } from "../src/core/color.ts";
import { humanoid, solve, restPose, CHAINS } from "../src/rig/skeleton.ts";
import { stripGeometry, stripJoints, stripOutline, stripSlice, stripeSpans } from "../src/rig/strip.ts";
import { apply, type Vec2 } from "../src/core/math.ts";
import { SvgContext } from "../src/render/still/recorder.ts";
import { renderSvg, finishSvg, detailOf } from "../src/render/still/render.ts";
import { portrait, silhouette, clearPortraits, portraitCacheSize, onPortraitError } from "../src/render/still/portrait.ts";
import { compose } from "../src/avatar/compose.ts";
import { GARMENT_FIELDS } from "../src/avatar/rules.ts";
import type { AvatarDoc } from "../src/core/types.ts";
import type { Item } from "../src/core/kit.ts";
import kit from "../../sahne-kit/src/full.ts";

const NIMA: AvatarDoc = {
  v: 1, kit: "sahne-kit@1", body: { build: "adult", height: 0.45, shape: "average" }, skin: "skin_04",
  face: { shape: "oval", eyes: "round", brows: "soft", nose: "button", mouth: "wide" }, hair: { style: "hair_short", color: "hair_02" },
  outfit: { top: { id: "top_shirt", colors: ["fab_05"] }, bottom: { id: "bottom_jeans", colors: ["fab_03"] }, shoes: { id: "shoes_sneakers", colors: ["fab_01", "fab_01"] } },
};
const ISMAIL: AvatarDoc = {
  v: 1, kit: "sahne-kit@1", body: { build: "adult", height: 0.38, shape: "round" }, skin: "skin_05",
  face: { shape: "round", eyes: "round", brows: "thick", nose: "round", mouth: "wide" }, hair: { style: "hair_classic", color: "hair_08" },
  facialHair: { style: "moustache_thick", color: "#4A4440" },
  outfit: { top: { id: "top_shirt_rolled", colors: ["fab_02"] }, bottom: { id: "bottom_trousers", colors: ["fab_24"] }, shoes: { id: "shoes_leather", colors: ["fab_20"] } },
  wear: { waist: { id: "apron_shop", colors: ["fab_04"] } },
};
const CAST = { trusted: true };
const FRAMINGS = ["head", "bust", "full"] as const;

// ---- helpers -------------------------------------------------------------------------------------

/** The path text read back into absolute commands (M L H V C S Q Z, absolute and relative, implicit repeats). */
function parseD(d: string): Cmd[] {
  const out: Cmd[] = [], toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, px = 0, py = 0, prevC = false, cmd = "";
  const n = () => { const v = Number(toks[i++]); assert.ok(Number.isFinite(v), "number expected in " + d); return v; };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), c = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (c === "Z") { out.push(["Z"]); x = sx; y = sy; prevC = false; continue; }
    if (c === "M") { x = n() + ox; y = n() + oy; sx = x; sy = y; out.push(["M", x, y]); cmd = rel ? "l" : "L"; prevC = false; continue; }
    if (c === "L") { x = n() + ox; y = n() + oy; out.push(["L", x, y]); prevC = false; }
    else if (c === "H") { x = n() + ox; out.push(["L", x, y]); prevC = false; }
    else if (c === "V") { y = n() + oy; out.push(["L", x, y]); prevC = false; }
    else if (c === "Q") { const a = n() + ox, b = n() + oy; x = n() + ox; y = n() + oy; out.push(["Q", a, b, x, y]); prevC = false; }
    else if (c === "C" || c === "S") {
      const a = c === "S" ? (prevC ? 2 * x - px : x) : n() + ox, b = c === "S" ? (prevC ? 2 * y - py : y) : n() + oy;
      px = n() + ox; py = n() + oy; x = n() + ox; y = n() + oy;
      out.push(["C", a, b, px, py, x, y]); prevC = true;
    } else assert.fail("unexpected command " + cmd);
  }
  return out;
}

/** Points along a path: the ends of its segments and a few between, to compare shapes. */
function sample(cmds: Cmd[]): Vec2[] {
  const pts: Vec2[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  for (const c of cmds) {
    if (c[0] === "M") { x = sx = c[1]; y = sy = c[2]; pts.push([x, y]); continue; }
    if (c[0] === "Z") { pts.push([sx, sy]); x = sx; y = sy; continue; }
    for (const t of [0.25, 0.5, 0.75, 1]) {
      const u = 1 - t;
      if (c[0] === "L") pts.push([x + (c[1] - x) * t, y + (c[2] - y) * t]);
      else if (c[0] === "Q") pts.push([u * u * x + 2 * u * t * c[1] + t * t * c[3], u * u * y + 2 * u * t * c[2] + t * t * c[4]]);
      else if (c[0] === "C") pts.push([u * u * u * x + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5], u * u * u * y + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]]);
    }
    const e = c.slice(-2) as number[]; x = e[0]; y = e[1];
  }
  return pts;
}

/** Tags in order; fails unless every one that opens is closed (a well-formedness check good enough for our markup). */
function checkXml(svg: string) {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)((?:[^>"]|"[^"]*")*?)(\/?)>/g)) {
    if (m[4]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2], "closing " + m[2]); else stack.push(m[2]);
  }
  assert.deepEqual(stack, []);
  // nothing outside tags but whitespace
  assert.equal(svg.replace(/<(?:[^>"]|"[^"]*")*>/g, "").trim(), "");
}

const ids = (svg: string) => [...svg.matchAll(/ id="([^"]*)"/g)].map(m => m[1]);
const refs = (svg: string) => [...svg.matchAll(/url\(#([^)]*)\)/g)].map(m => m[1]);
const bytes = (s: string) => new TextEncoder().encode(s).length;
const SAFE_PAINT = /^(#[\da-fA-F]{3}|#[\da-fA-F]{6}|#[\da-fA-F]{8}|none|transparent)$/;

// What our markup may hold: these elements, these attributes on them, each value of its own shape. Anything else fails.
const NUMS = /^[\d. %-]+$/, ID = /^[\w-]+$/, URL = /^url\(#[\w-]+\)$/, UNIT = /^(?:0?\.\d+|[01])$/, EVEN = /^evenodd$/, TRANSFORM = /^(?:translate|matrix)\([\d. -]+\)$/;
const ATTR: Record<string, RegExp> = {
  xmlns: /^http:\/\/www\.w3\.org\/2000\/svg$/, viewBox: NUMS, width: NUMS, height: NUMS, role: /^img$/, "aria-label": /^(?:[^"<>&]|&#\d+;)*$/, id: ID, "clip-path": URL, filter: URL,
  fill: new RegExp(`${SAFE_PAINT.source}|${URL.source}`), stroke: SAFE_PAINT, patternUnits: /^userSpaceOnUse$/, "stroke-width": NUMS, "stroke-linecap": /^(?:butt|round|square)$/, "stroke-linejoin": /^(?:miter|round|bevel)$/, "paint-order": /^stroke$/, "stroke-dasharray": NUMS,
  opacity: UNIT, "fill-opacity": UNIT, "stroke-opacity": UNIT, "fill-rule": EVEN, "clip-rule": EVEN, transform: TRANSFORM, d: /^[MmLlHhVvCcSsQqZz\d. ,-]*$/,
  cx: NUMS, cy: NUMS, r: NUMS, rx: NUMS, ry: NUMS, x: NUMS, y: NUMS, stdDeviation: NUMS, dx: NUMS, dy: NUMS, values: NUMS, "color-interpolation-filters": /^sRGB$/,
};
const SHAPE = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "paint-order", "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity", "fill-rule", "clip-rule", "filter"];
const ELEMENT: Record<string, string[]> = {
  svg: ["xmlns", "viewBox", "width", "height", "role", "aria-label"], g: ["transform", "clip-path", "opacity", "stroke", "stroke-width", "stroke-linejoin", "paint-order"], defs: [],
  clipPath: ["id"], pattern: ["id", "patternUnits", "x", "y", "width", "height"], filter: ["id", "x", "y", "width", "height", "color-interpolation-filters"], feGaussianBlur: ["stdDeviation"], feOffset: ["dx", "dy"], feColorMatrix: ["values"],
  path: ["d", ...SHAPE], circle: ["cx", "cy", "r", ...SHAPE], ellipse: ["cx", "cy", "rx", "ry", ...SHAPE], rect: ["x", "y", "width", "height", ...SHAPE],
};

/** Reads the whole markup with that table: an unknown element or attribute, a duplicate, a value of the wrong shape, text, or an unclosed tag fails. */
function strict(svg: string) {
  const tag = /^<(\/?)([A-Za-z]+)((?:\s+[A-Za-z:-]+="[^"]*")*)\s*(\/?)>/, stack: string[] = [];
  for (let rest = svg; rest;) {
    const m = tag.exec(rest);
    assert.ok(m, "markup the checker does not know: " + rest.slice(0, 80));
    rest = rest.slice(m[0].length);
    const [, closing, name, attrs, selfClosing] = m;
    assert.ok(Object.hasOwn(ELEMENT, name), "element " + name);
    if (closing) { assert.equal(stack.pop(), name); continue; }
    const seen = new Set<string>();
    for (const a of attrs.matchAll(/\s+([A-Za-z:-]+)="([^"]*)"/g)) {
      assert.ok(ELEMENT[name].includes(a[1]), `${name} may not have ${a[1]}`);
      assert.ok(!seen.has(a[1]), `${name} has ${a[1]} twice`);
      seen.add(a[1]);
      assert.match(a[2], ATTR[a[1]], `${name} ${a[1]}="${a[2]}"`);
    }
    if (!selfClosing) stack.push(name);
  }
  assert.deepEqual(stack, []);
}

/** Every attribute value in the markup is plain: nothing but the elements and attributes above, colours hex, no stray words. */
function checkSafe(svg: string) {
  assert.ok(!/NaN|undefined|Infinity|null|onload|javascript|<script|<foreignObject|<image|href=|style=/i.test(svg), "no stray values or active content");
  // a fill may be a print's pattern, defined in the same picture
  for (const m of svg.matchAll(/\s(fill|stroke)="([^"]*)"/g)) assert.ok(SAFE_PAINT.test(m[2]) || (m[1] === "fill" && URL.test(m[2])), `${m[1]} value ${m[2]}`);
  strict(svg);
}

// ---- path text ---------------------------------------------------------------------------------------

test("numbers are as short as SVG allows and never NaN", () => {
  assert.equal(svgNums([0.5, -0.25, 1.5, 0.5, -3, 10, 0.004]), ".5-.25 1.5.5-3 10 0");
  assert.equal(svgNums([NaN, Infinity, -Infinity]), "000".replace(/0/g, (_, i) => i ? " 0" : "0"));
  assert.equal(svgNums([1.005, 2.5], 1), "1 2.5");
});

test("compact path text keeps the shape, to the rounding", () => {
  const paths: Path[] = [
    ellipse(3, -4, 5, 2), circle(0, 0, 7), rect(1, 2, 3, 4), rrect(-5, -5, 10, 6, [3, 0, 2, 1]),
    smooth([[0, 0], [10, 0], [10, 10, 0], [0, 12], [-4, 5]], true, 1), smooth([[-30, 5.55], [2, 9.1], [14.25, -3.3], [40, 8]], false, 0.8),
    band([[0, 0], [10, 5], [22, 4], [30, -6]], [4, 6, 6, 2], 1), new Path().moveTo(0, 0).quadTo(5, 5, 10, 0).lineTo(10, 7).lineTo(3.3, 7).close().moveTo(20, 20).lineTo(25, 20).close(),
  ];
  for (const digits of [1, 2]) for (const p of paths) {
    const back = parseD(cmdsToD(p.cmds, digits)), a = sample(p.cmds), b = sample(back);
    assert.equal(a.length, b.length);
    // rounding moves a point by at most half a step each way; the smooth shorthand by one step more
    a.forEach((q, i) => assert.ok(Math.hypot(q[0] - b[i][0], q[1] - b[i][1]) <= 3 * 10 ** -digits, `${digits} digits, point ${i}`));
  }
  // and it is shorter than the plain text
  const long = smooth([[0, 0], [10, 0], [10, 10], [0, 12], [-4, 5], [-9, -3]], true, 1);
  assert.ok(cmdsToD(long.cmds).length < long.toD().length * 0.8);
});

test("exact ellipses become ellipse elements, nothing else does", () => {
  assert.deepEqual(asEllipse(ellipse(3, 4, 5, 2)), [3, 4, 5, 2]);
  assert.equal(svgGeom(circle(1, 2, 3)).tag, "circle");
  assert.equal(svgGeom(ellipse(1, 2, 3, 2)).tag, "ellipse");
  assert.equal(svgGeom(rect(0, 0, 2, 2)).tag, "path");
  assert.deepEqual(asEllipse(ellipse(0, 0, 3, 2).move(5, -1)), [5, -1, 3, 2]);
  const bent = ellipse(0, 0, 3, 2);
  (bent.cmds[2] as number[])[1] += 0.01;
  assert.equal(asEllipse(bent), null);
  assert.equal(asEllipse(rrect(0, 0, 10, 10, 5)), null);
});

// ---- groups --------------------------------------------------------------------------------------------

test("groupSvg drops anything that is not a plain colour or a finite number", () => {
  const evil = [`red" onload="alert(1)`, "url(#x)", "rgb(1,2,3)", "javascript:alert(1)", `#fff" x="`, "#ggg", "#12345", "", " #fff", "var(--x)"];
  const g: Group = { shapes: [
    ...evil.map(c => ({ path: rect(0, 0, 1, 1), fill: c })),
    ...evil.map(c => ({ path: rect(0, 0, 1, 1), stroke: { color: c, width: 1 } })),
    { path: rect(0, 0, 1, 1), fill: "#abc" },
    { path: rect(0, 0, 1, 1), fill: "#AABBCC", opacity: NaN },
    { path: rect(0, 0, 1, 1), fill: "#aabbcc80" },
    { path: rect(0, 0, 1, 1), stroke: { color: "#000", width: NaN } },
    { path: rect(0, 0, 1, 1), stroke: { color: "#000", width: 1, dash: [NaN, 1] } },
    { path: rect(0, 0, 1, 1), stroke: { color: "#000", width: 1, cap: `butt" x="` as never, join: "bogus" as never } },
    { path: new Path().moveTo(0, 0).lineTo(NaN, 4).close(), fill: "#fff" },
    { path: rect(0, 0, 1, 1), fill: "#fff", clip: new Path().moveTo(0, 0).lineTo(Infinity, 1) },
    { path: rect(0, 0, 1, 1), fill: "none" },
  ], edge: NaN };
  const svg = groupSvg(g, { id: `a" b` });
  checkSafe(svg);
  assert.deepEqual(refs(groupSvg(g, { shadow: `s" x` })).filter((r, i, a) => a.indexOf(r) === i), ["sx"]);
  // the accepted ones are there (3, 6 and 8 digits, a stroke with a bad dash and bad caps), the others are not
  assert.equal([...svg.matchAll(/<(?:path|circle|ellipse)\b/g)].length, 5);
  assert.ok(svg.includes(`fill="#abc"`) && svg.includes(`fill="#AABBCC"`) && svg.includes(`fill="#aabbcc80"`));
  assert.ok(!svg.includes("stroke-dasharray") && !svg.includes("bogus"));
  assert.equal(svgColor("#abc"), "#abc");
  assert.equal(svgColor("red"), null);
  assert.ok(!/id="[^"]*[" ]b/.test(svg) && ids(svg).every(i => /^[\w-]+$/.test(i)));
});

test("the rim and the fill are one element, so opacity covers both", () => {
  const svg = groupSvg({ shapes: [{ path: ellipse(0, 0, 4, 3), fill: "#C4553A", opacity: 0.5 }] });
  assert.equal([...svg.matchAll(/<ellipse/g)].length, 1);
  assert.match(svg, /opacity="\.5"/);
  assert.match(svg, /paint-order="stroke"/);
  // flat shapes have no rim; a stroke is its own element
  const flat = groupSvg({ shapes: [{ path: rect(0, 0, 2, 2), fill: "#123456", flat: true }, { path: smooth([[0, 0], [3, 3]], false), stroke: { color: "#000", width: 0.4, dash: [0.9, 0.7] } }] });
  assert.ok(!flat.includes("stroke-width=\".9\""));
  assert.match(flat, /stroke-dasharray="\.9 \.7"/);
  // fill and stroke on one shape: a rim-fill element and a stroke element, inside one opacity group
  const both = groupSvg({ shapes: [{ path: rect(0, 0, 4, 4), fill: "#334455", stroke: { color: "#fff", width: 0.3 }, opacity: 0.7 }] });
  assert.equal([...both.matchAll(/<path/g)].length, 2);
  assert.match(both, /^<g opacity="\.7">/);
});

test("the shadow is a filter, on layers that lie on another one", () => {
  const g: Group = { shapes: [{ path: rect(0, 0, 9, 9), fill: "#C4553A" }, { path: rect(1, 1, 4, 4), fill: "#2E3A59" }, { path: rect(1, 1, 2, 2), fill: "#F7F3EA", flat: true }] };
  assert.equal(refs(groupSvg(g)).length, 0);
  assert.deepEqual(refs(groupSvg(g, { shadow: "sh" })), ["sh"]);
  assert.match(shadowFilter("sh"), /^<filter id="sh"[^>]*><feGaussianBlur stdDeviation="\.275"\/><feOffset dx="\.18" dy="\.32"\/><feColorMatrix [^>]*\/><\/filter>$/);
});

test("a clip is a clipPath with the group's prefix, and the canvas draws it too", () => {
  const g: Group = { shapes: [{ path: rect(0, 0, 8, 8), fill: "#336699" }, { path: rect(0, 0, 8, 8), fill: "#993366", clip: ellipse(4, 4, 3) }] };
  const svg = groupSvg(g, { id: "q_" });
  assert.deepEqual(ids(svg), ["q_1"]);
  assert.deepEqual(refs(svg), ["q_1"]);
  assert.match(svg, /<clipPath id="q_1"><circle cx="4" cy="4" r="3"\/><\/clipPath><g clip-path="url\(#q_1\)">/);
  checkXml(`<svg>${svg}</svg>`);
  // bounds shrink to the clip
  const b = groupBounds(g), plain = groupBounds({ shapes: [g.shapes[1] && { ...g.shapes[1], clip: undefined }] });
  assert.ok(shapeBounds(g.shapes[1], 0.45)[0] > plain[0]);
  assert.ok(b[2] - b[0] >= 8);
  // drawGroup: save, alpha, then the clip path and clip() before the shape's own path; an unclipped shape draws as before
  const calls: string[] = [], ctx = new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => { calls.push(k + (a.length && k !== "moveTo" && k !== "lineTo" && k !== "bezierCurveTo" && k !== "closePath" ? "(" + a.join(",") + ")" : "")); }, set: (_t, k: string, v) => { calls.push(k + "=" + v); return true; } });
  drawGroup(ctx as never, { shapes: [g.shapes[1]] }, 10);
  const at = (s: string) => calls.findIndex(c => c.startsWith(s));
  assert.ok(at("save") < at("clip") && at("clip") < at("fill") && calls[at("save") + 1] === "globalAlpha=1");
  assert.equal(calls.filter(c => c === "beginPath").length, 2);
  calls.length = 0;
  drawGroup(ctx as never, { shapes: [g.shapes[0]] }, 10);
  assert.equal(at("clip"), -1);
  assert.deepEqual(calls.slice(0, 3), ["save", "globalAlpha=1", "beginPath"]);
  // a list of clips is the region inside all of them: nested groups in SVG (each path written once per table), clip() per path on a canvas
  const a = ellipse(4, 4, 3), b2 = rect(0, 3, 8, 8), clips = new Map();
  const two: Group = { shapes: [{ path: rect(0, 0, 8, 8), fill: "#993366", clip: [a, b2] }, { path: rect(1, 1, 6, 6), fill: "#336699", clip: [a, b2] }] };
  const s2 = groupSvg(two, { id: "w_", clips });
  assert.deepEqual(ids(s2), ["w_0", "w_0k1"]);
  assert.match(s2, /<g clip-path="url\(#w_0k1\)"><g clip-path="url\(#w_0\)"><path/);
  assert.equal((s2.match(/<clipPath/g) ?? []).length, 2, "the second shape refers to the same two");
  checkXml(`<svg>${s2}</svg>`);
  const sb = shapeBounds(two.shapes[0], 0.45);
  assert.ok(sb[1] >= 2.9 && sb[0] >= 0.9 && sb[3] <= 7.2, "bounds inside both clips");
  calls.length = 0;
  drawGroup(ctx as never, { shapes: [two.shapes[0]] }, 10);
  assert.equal(calls.filter(c => c.startsWith("clip")).length, 2);
  // a non-finite path in the list drops the shape
  assert.equal(groupSvg({ shapes: [{ path: rect(0, 0, 1, 1), fill: "#fff", clip: [a, new Path().moveTo(0, 0).lineTo(NaN, 1)] }] }), "");
});

// ---- the recording canvas -----------------------------------------------------------------------------

test("the recording context turns canvas calls into SVG", () => {
  const c = new SvgContext("f_");
  c.fillStyle = "#336699"; c.globalAlpha = 0.5;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(4, 0); c.bezierCurveTo(5, 1, 5, 3, 4, 4); c.quadraticCurveTo(2, 6, 0, 4); c.closePath(); c.fill();
  c.globalAlpha = 1; c.strokeStyle = "#112233"; c.lineWidth = 0.5; c.lineCap = "round"; c.stroke();
  c.fillRect(1, 1, 2, 2);
  const svg = c.done();
  assert.match(svg, /<path d="[^"]+" fill="#336699" fill-opacity="\.5"\/>/);
  assert.match(svg, /<path d="[^"]+" fill="none" stroke="#112233" stroke-width="\.5" stroke-linecap="round"\/>/);
  assert.match(svg, /<rect x="1" y="1" width="2" height="2" fill="#336699"\/>/);
  assert.ok(!svg.includes("stroke-linejoin"), "the canvas default (miter) is the SVG default");
});

test("save and restore bracket the clips and the state", () => {
  const c = new SvgContext("k");
  c.fillStyle = "#111111";
  c.save();
  c.fillStyle = "#222222"; c.globalAlpha = 0.3;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(5, 0); c.lineTo(5, 5); c.closePath(); c.clip();
  c.save();
  c.beginPath(); c.moveTo(1, 1); c.lineTo(3, 1); c.lineTo(3, 3); c.closePath(); c.clip();
  c.fill();
  c.restore();
  c.fill();
  c.restore();
  c.fill();
  const svg = c.done();
  checkXml(`<svg>${svg}</svg>`);
  assert.deepEqual(ids(svg), ["k0", "k1"]);
  // the last fill is outside both groups, with the state before the first save
  assert.ok(svg.endsWith(`</g><path d="M1 1h2v2z" fill="#111111"/>`), svg);
  assert.match(svg, /fill="#222222" fill-opacity="\.3"\/><\/g><path [^>]*fill="#222222" fill-opacity="\.3"\/>/);
  // an unbalanced restore is ignored, an open clip is closed by done()
  const d = new SvgContext("z"); d.restore(); d.beginPath(); d.moveTo(0, 0); d.lineTo(1, 1); d.clip();
  checkXml(`<svg>${d.done()}</svg>`);
});

test("the recording context refuses hostile colours, widths and coordinates", () => {
  const c = new SvgContext(`p" x="`);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(3, 3); c.lineTo(3, 0);
  for (const v of [`red" onload="x`, "url(#a)", "rgba(1,2,3,.5)", "#12"]) { c.fillStyle = v; c.fill(); c.strokeStyle = v; c.stroke(); c.fillRect(0, 0, 1, 1); }
  c.strokeStyle = "#000"; for (const w of [0, -1, NaN, Infinity]) { c.lineWidth = w; c.stroke(); }
  c.lineWidth = 1; c.lineCap = `round" x="`; c.lineJoin = "bogus"; c.stroke();
  c.fillStyle = "#000"; c.globalAlpha = NaN; c.fill(); c.globalAlpha = 7; c.fill();
  c.beginPath(); c.moveTo(0, 0); c.lineTo(NaN, 1); c.fill(); c.stroke(); c.clip();
  c.beginPath(); c.fillRect(NaN, 0, 1, 1);
  const svg = c.done();
  checkSafe(svg);
  assert.equal([...svg.matchAll(/<path/g)].length, 3, svg);
  assert.ok(!svg.includes("clipPath") && !svg.includes("round\""));
});

// ---- strips ------------------------------------------------------------------------------------------------

/** The stage's drawStrip, transcribed (stage.ts, `drawStrip`): the reference for the shared geometry. Ends: round at the root joint, and at the far end only on the skin layers (or as `caps` says). */
function stageStrip(j: Vec2[], widths: [number, number, number], from: number, to: number, layer: string, ends?: "both" | "from" | "to" | "none") {
  const C: Vec2 = [2 * j[1][0] - (j[0][0] + j[2][0]) / 2, 2 * j[1][1] - (j[0][1] + j[2][1]) / 2];
  const B = (t: number): Vec2 => { const u = 1 - t; return [u * u * j[0][0] + 2 * u * t * C[0] + t * t * j[2][0], u * u * j[0][1] + 2 * u * t * C[1] + t * t * j[2][1]]; };
  const dB = (t: number): Vec2 => [2 * (1 - t) * (C[0] - j[0][0]) + 2 * t * (j[2][0] - C[0]), 2 * (1 - t) * (C[1] - j[0][1]) + 2 * t * (j[2][1] - C[1])];
  const width = (t: number) => t < 0.5 ? widths[0] + (widths[1] - widths[0]) * t * 2 : widths[1] + (widths[2] - widths[1]) * (t - 0.5) * 2;
  const N = 12, L: Vec2[] = [], R: Vec2[] = [], S: number[] = [];
  let len = 0, prev: Vec2 | null = null;
  for (let i = 0; i <= N; i++) {
    const t = from + (to - from) * (i / N), p = B(t), d = dB(t), l = Math.hypot(d[0], d[1]) || 1, w = width(t) / 2;
    const n: Vec2 = [-d[1] / l, d[0] / l];
    if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p; S.push(len);
    L.push([p[0] + n[0] * w, p[1] + n[1] * w]); R.push([p[0] - n[0] * w, p[1] - n[1] * w]);
  }
  const caps: { c: Vec2; pts: Vec2[]; s: number }[] = [];
  const cap = (t: number, sAt: number, dir: number) => {
    const p = B(t), d = dB(t), l = Math.hypot(d[0], d[1]) || 1, w = width(t) / 2;
    const tx = d[0] / l * dir, ty = d[1] / l * dir, nx = -ty, ny = tx, M = 8, pts: Vec2[] = [];
    for (let k = 0; k <= M; k++) { const a = Math.PI * k / M; pts.push([p[0] + (nx * Math.cos(a) + tx * Math.sin(a)) * w, p[1] + (ny * Math.cos(a) + ty * Math.sin(a)) * w]); }
    caps.push({ c: p, pts, s: sAt });
  };
  if (ends ? ends === "both" || ends === "from" : from <= 0.01) cap(from, 0, -1);
  if (ends ? ends === "both" || ends === "to" : layer === "arm" || layer === "leg") cap(to, len, 1);
  return { L, R, S, len, caps };
}

test("the strip geometry is the stage's, joint for joint", () => {
  const near = (a: Vec2, b: Vec2) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9);
  for (const build of ["adult", "child"] as const) {
    const body = kit.body({ build, height: 0.5, shape: "round" }), world = solve(humanoid(body), restPose());
    // a bent pose as well: the middle joint off the line
    const bent = solve(humanoid(body), { bones: { arm_l: 0.9, forearm_l: -1.4, thigh_r: -0.5, shin_r: 0.8 }, dx: 3, dy: -2 });
    for (const w of [world, bent]) for (const chain of Object.keys(CHAINS) as (keyof typeof CHAINS)[]) for (const [layer, from, to, ends] of [["arm", 0, 1], ["leg", 0, 1], ["sleeve", 0, 0.42], ["sleeve", 0.9, 1], ["sleeve", 0.3, 0.8], ["sleeve", 0.01, 0.5], ["trouser", 0, 0.97],
      ["outer_sleeve", 0, 1], ["outer_sleeve", 0.9, 1], ["shaft", 0.6, 1], ["trouser_hem", 0.85, 1], ["sleeve", 0.9, 1, "both"], ["arm", 0, 1, "none"], ["trouser", 0.2, 1, "to"], ["sleeve", 0, 1, "from"]] as const) {
      const j = stripJoints(w, chain as never)!, widths: [number, number, number] = [body.armW[0] * 1.2, body.armW[1], body.armW[2] * 0.8];
      const g = stripGeometry(j, { widths, from, to, caps: ends }, layer), ref = stageStrip(j, widths, from, to, layer, ends);
      assert.equal(g.left.length, 13);
      g.left.forEach((p, i) => { near(p, ref.L[i]); near(g.right[i], ref.R[i]); assert.ok(Math.abs(g.along[i] - ref.S[i]) < 1e-9); });
      assert.ok(Math.abs(g.length - ref.len) < 1e-9);
      const caps = [g.capFrom, g.capTo].filter(Boolean);
      assert.equal(caps.length, ref.caps.length, `${layer} ${from}`);
      caps.forEach((c, i) => { near(c!.center, ref.caps[i].c); assert.ok(Math.abs(c!.along - ref.caps[i].s) < 1e-9); c!.pts.forEach((p, k) => near(p, ref.caps[i].pts[k])); });
    }
  }
});

test("a strip's outline is one closed polygon, and its slices sit inside it", () => {
  const body = kit.body({ build: "adult", height: 0.5, shape: "average" }), world = solve(humanoid(body), restPose());
  const j = stripJoints(world, "arm_l")!, g = stripGeometry(j, { widths: body.armW }, "arm", { seg: 8, capSeg: 6 });
  const poly = stripOutline(g);
  assert.equal(poly.length, 9 + 5 + 9 + 5);
  const area = (p: Vec2[]) => Math.abs(p.reduce((s, q, i) => s + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0) / 2);
  const slice = stripSlice(g, g.length * 0.25, g.length * 0.5), whole = stripSlice(g, 0, g.length);
  assert.ok(area(slice) > 0 && area(slice) < area(whole) * 0.4);
  assert.deepEqual(stripSlice(g, 5, 5), []);
  // stripes: the first half of every period, or the duty's share of it
  assert.deepEqual(stripeSpans(10, 4), [[0, 2], [4, 6], [8, 10]]);
  assert.deepEqual(stripeSpans(10, 4, 0.25), [[0, 1], [4, 5], [8, 9]]);
  for (const bad of [0, 1, -1, NaN, 2]) assert.deepEqual(stripeSpans(10, 4, bad), [[0, 2], [4, 6], [8, 10]], `duty ${bad} is a half`);
  assert.deepEqual(stripeSpans(10, 0), []);
  assert.deepEqual(stripeSpans(10, 0.001), []);
  assert.equal(stripJoints(new Map(), "arm_l"), null);
  assert.deepEqual(apply([1, 0, 0, 1, 2, 3], 0, 0), [2, 3]);
});

// ---- the figure -----------------------------------------------------------------------------------------------

/**
 * A portrait's size in KB (DESIGN §12). Kit batch 1 (2026-10-10) made faces, textured hair, glasses
 * and headscarves about half again as detailed, which the art keeps on purpose: the budgets went from
 * 6 / 10 / 16 to 9 / 12 / 22 after shared clip groups and dropping sub-pixel details at list sizes.
 */
const BUDGET = { head: 9, bust: 12, full: 22 };

test("a figure renders deterministically, finite, well formed and in budget", () => {
  for (const [name, doc] of [["Nima", NIMA], ["İsmail", ISMAIL]] as const) {
    const puppet = compose(doc, kit, CAST), sizes: Record<string, number> = {};
    for (const framing of FRAMINGS) for (const size of [undefined, 28, 96, 160, 400]) {
      const a = renderSvg(puppet, kit, { framing, size }), b = renderSvg(compose(doc, kit, CAST), kit, { framing, size });
      assert.equal(a, b, `${name} ${framing} ${size} is deterministic`);
      checkXml(a); checkSafe(a);
      assert.ok(a.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="`));
      if (size === 96 || size === 160) sizes[framing + size] = bytes(a);
    }
    // DESIGN §12 budgets: a head 9 KB, a bust 12 KB, a whole figure 22 KB (at list sizes and at the first detail step)
    for (const s of [96, 160]) {
      assert.ok(sizes["head" + s] <= BUDGET.head * 1024, `${name} head ${s}: ${sizes["head" + s]}`);
      assert.ok(sizes["bust" + s] <= BUDGET.bust * 1024, `${name} bust ${s}: ${sizes["bust" + s]}`);
      assert.ok(sizes["full" + s] <= BUDGET.full * 1024, `${name} full ${s}: ${sizes["full" + s]}`);
      assert.ok(sizes["head" + s] < sizes["bust" + s] && sizes["bust" + s] < sizes["full" + s]);
    }
  }
});

test("framing and size set the view box and the pixel size", () => {
  const puppet = compose(NIMA, kit, CAST), box = (svg: string) => svg.match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);
  const head = box(renderSvg(puppet, kit, { framing: "head" })), bust = box(renderSvg(puppet, kit, { framing: "bust" })), full = box(renderSvg(puppet, kit, { framing: "full" }));
  assert.ok(Math.abs(head[2] - head[3]) < 1e-6 && Math.abs(bust[2] - bust[3]) < 1e-6, "head and bust are square");
  assert.ok(full[3] > full[2] * 2, "a figure is tall");
  assert.ok(head[2] < bust[2] && bust[3] < full[3]);
  // the crown of an adult is at -H; the head picture holds it, the feet are only in the full one
  const body = puppet.body;
  assert.ok(head[1] < -body.H + body.headH * 0.2 && head[1] + head[3] < -body.H + body.headH + body.neckL + 12);
  assert.ok(full[1] + full[3] > 0 && bust[1] + bust[3] < -body.legLen);
  // size is the longer side, and the other follows the view box
  const s = renderSvg(puppet, kit, { framing: "full", size: 200 });
  assert.match(s, /width="\d+" height="200"/);
  assert.ok(Math.abs(Number(s.match(/ width="(\d+)"/)![1]) / 200 - full[2] / full[3]) < 0.01, "the width of a tall figure");
  assert.match(renderSvg(puppet, kit, { framing: "head", size: 64 }), /width="64" height="64"/);
  for (const bad of [0, -5, NaN, Infinity, 1e9]) assert.ok(!/<svg[^>]* width="/.test(renderSvg(puppet, kit, { framing: "head", size: bad })), String(bad));
  assert.ok(!/<svg[^>]* width="/.test(renderSvg(puppet, kit, { framing: "head" })));
  // a background is a rect behind everything; only a colour is accepted
  assert.match(renderSvg(puppet, kit, { framing: "head", background: "#F4EFE6" }), /^<svg[^>]*>(<defs>.*<\/defs>)?<rect [^>]*fill="#F4EFE6"\/>/);
  assert.ok(!renderSvg(puppet, kit, { framing: "head", background: `red" onload="x` }).includes("<rect"));
});

test("ids are namespaced by the prefix and every reference resolves", () => {
  const puppet = compose(ISMAIL, kit, CAST);
  const a = renderSvg(puppet, kit, { framing: "bust", size: 200, idPrefix: "a1_" }), b = renderSvg(puppet, kit, { framing: "bust", size: 200, idPrefix: "b2_" });
  for (const svg of [a, b]) {
    const own = ids(svg);
    assert.ok(own.length >= 3 && new Set(own).size === own.length, "unique inside one SVG");
    assert.ok(refs(svg).every(r => own.includes(r)), "every url(#) has its element");
  }
  assert.ok(ids(a).every(i => i.startsWith("a1_")) && ids(b).every(i => i.startsWith("b2_")));
  assert.equal(ids(a).filter(i => ids(b).includes(i)).length, 0);
  // hostile prefixes are reduced to word characters
  assert.ok(ids(renderSvg(puppet, kit, { framing: "bust", size: 200, idPrefix: `x" onload="y` })).every(i => /^[\w-]+$/.test(i)));
});

test("the face draws the kit's own canvas code: emotions change it, the back has none", () => {
  const puppet = compose(NIMA, kit, CAST), neutral = renderSvg(puppet, kit, { framing: "head", size: 96 });
  for (const emo of Object.keys(kit.face.emotions)) {
    const s = renderSvg(puppet, kit, { framing: "head", size: 96, face: emo });
    checkXml(s); checkSafe(s);
    assert.equal(s !== neutral, emo !== "neutral", emo);
  }
  // a name that is not an emotion is neutral, also the names an object has anyway
  for (const bad of ["__proto__", "constructor", "toString", "nope"]) assert.equal(renderSvg(puppet, kit, { framing: "head", size: 96, face: bad }), neutral);
  assert.ok(neutral.includes("<clipPath"), "the eyes are clipped");
  assert.ok(!renderSvg(puppet, kit, { framing: "head", view: "back" }).includes("<clipPath"));
});

test("only the default hand is drawn, others on request; a raised arm is drawn after the head", () => {
  const puppet = compose(NIMA, kit, CAST), full = (o = {}) => renderSvg(puppet, kit, { framing: "full", size: 400, ...o });
  const rest = full(), point = full({ alt: { hand_l: "point" } });
  assert.notEqual(rest, point);
  assert.ok(bytes(point) < bytes(rest) * 1.2 && bytes(rest) < 24 * 1024, "one hand per side, not twelve");
  // a hand held at the face: the arm and hand come last (after the head's own group)
  const eat = full({ pose: { bones: { arm_l: 2.2, forearm_l: 1.2 }, dx: 0, dy: 0 } });
  assert.notEqual(eat, rest);
  checkXml(eat); checkSafe(eat);
  // a pose with garbage is no picture, and never markup with NaN
  assert.throws(() => full({ pose: { bones: { arm_l: NaN, head: NaN, neck: NaN }, dx: NaN, dy: 0 } }));
});

test("a striped strip draws bands and caps, in the rim tint where the rim is", () => {
  const puppet = compose(NIMA, kit, CAST);
  const striped = { ...puppet, views: { ...puppet.views, front: puppet.views.front.map(it => it.strip && it.layer === "sleeve" ? { ...it, strip: { ...it.strip, stripes: ["#F7F3EA", 6, 0.5] as [string, number, number] } } : it) } };
  const plain = renderSvg(puppet, kit, { framing: "full", size: 300 }), s = renderSvg(striped, kit, { framing: "full", size: 300 });
  checkXml(s); checkSafe(s);
  assert.ok(s.length > plain.length + 400 && s.includes("#F7F3EA"));
  // with a rim (from 100 px) the stripes are drawn twice, the wider one in the tint; without, once
  const flat = renderSvg(striped, kit, { framing: "full", size: 300, rim: false });
  assert.ok(flat.length < s.length && flat.includes("#F7F3EA"));
  // a hostile stripe colour or period is ignored
  for (const bad of [[`#fff" x="`, 6, 0.5], ["#fff", NaN, 0.5], ["#fff", 0, 0.5], ["#fff", 1e-9, 0.5]] as [string, number, number][]) {
    const h = { ...puppet, views: { ...puppet.views, front: puppet.views.front.map(it => it.strip ? { ...it, strip: { ...it.strip, stripes: bad } } : it) } };
    checkXml(renderSvg(h, kit, { framing: "full", size: 300 })); checkSafe(renderSvg(h, kit, { framing: "full", size: 300 }));
  }
});

// ---- portraits ------------------------------------------------------------------------------------------------------

test("a portrait is cached by content, whatever the key order", () => {
  clearPortraits();
  const a = portrait(NIMA, kit, { framing: "bust", size: 96, ...CAST });
  const reordered = JSON.parse(JSON.stringify({ outfit: NIMA.outfit, hair: NIMA.hair, body: { shape: "average", height: 0.45, build: "adult" }, kit: NIMA.kit, v: 1, skin: NIMA.skin, face: NIMA.face }));
  assert.equal(portrait(reordered, kit, { framing: "bust", size: 96, ...CAST }), a);
  assert.notEqual(portrait(NIMA, kit, { framing: "head", size: 96, ...CAST }), a);
  assert.notEqual(portrait({ ...NIMA, skin: "skin_09" }, kit, { framing: "bust", size: 96, ...CAST }), a);
  clearPortraits();
  assert.equal(portrait(NIMA, kit, { framing: "bust", size: 96, ...CAST }), a, "a rebuilt portrait is the same string");
  for (const doc of [NIMA, ISMAIL]) for (const framing of FRAMINGS) checkSafe(portrait(doc, kit, { framing, size: 48, ...CAST }));
});

test("portraits on one page never share an id", () => {
  const svgs = [NIMA, ISMAIL, { ...NIMA, skin: "skin_09" }, { ...ISMAIL, hair: { style: "hair_bob", color: "hair_05" } }].flatMap(d => FRAMINGS.map(framing => portrait(d, kit, { framing, size: 120, ...CAST })));
  const all = svgs.flatMap(ids);
  assert.ok(all.length > 20);
  assert.equal(new Set(all).size, all.length);
});

test("nothing, or a document that cannot be read, is the silhouette", () => {
  for (const framing of FRAMINGS) {
    const s = silhouette(kit, { framing, size: 64 });
    checkXml(s); checkSafe(s);
    assert.ok(!s.includes("<clipPath") && bytes(s) < 4 * 1024, "no face, small");
    assert.ok(/viewBox="[^"]+"/.test(s));
    for (const bad of [null, undefined, "x", 7, [], true, () => 1]) assert.equal(portrait(bad, kit, { framing, size: 64 }), s);
    // an old-style `char` (eight indices) and an empty object are not avatar documents
    assert.equal(portrait({ skin: 3, hair: 2, shirt: 5 }, kit, { framing, size: 64 }), s);
    assert.equal(portrait({}, kit, { framing, size: 64 }), s);
  }
  assert.notEqual(silhouette(kit, { framing: "head" }), silhouette(kit, { framing: "full" }));
});

test("a document from another learner cannot put anything into the markup", () => {
  const good = { ...NIMA };
  const hostile: unknown[] = [
    { ...good, skin: `#000" onload="alert(1)` }, { ...good, skin: "#000", hair: { style: "hair_short", color: `#fff"><script>alert(1)</script>` } },
    { ...good, outfit: { top: { id: "top_tee", colors: [`#fff" onload="x`, 5, null, {}] } } }, { ...good, outfit: { top: { id: "top_tee", colors: "abc" } } },
    { ...good, hair: { style: "__proto__", color: "hair_01" } }, { ...good, outfit: { top: { id: "constructor" }, bottom: { id: "toString" } } },
    { ...good, body: { build: "adult", height: "abc", shape: "__proto__" } }, { ...good, body: { build: "adult", height: Infinity, shape: "average" } },
    { ...good, face: { shape: "__proto__", eyes: 5, marks: "abc", eyeColor: `#fff" onload="x` } }, { ...good, facialHair: { style: `x"><b>`, color: `#fff" x="` } },
    { ...good, wear: { head: { id: "headscarf_wrap", colors: [`javascript:alert(1)`] } } }, { ...good, custom: [{ id: "top_tee" }, { id: "x".repeat(5000) }] },
  ];
  for (const doc of hostile) for (const trusted of [false, true]) for (const framing of FRAMINGS) {
    const s = portrait(doc, kit, { framing, size: 120, trusted });
    checkXml(s); checkSafe(s);
  }
  // other learners' hex colours are not drawn at all
  assert.ok(!portrait({ ...good, outfit: { top: { id: "top_tee", colors: ["#FF00FF"] } } }, kit, { framing: "bust" }).toLowerCase().includes("#ff00ff"));
  assert.ok(portrait({ ...good, outfit: { top: { id: "top_tee", colors: ["#FF00FF"] } } }, kit, { framing: "bust", trusted: true }).toLowerCase().includes("#ff00ff"));
});

/** Puts a garment in the document field of its slot (GARMENT_FIELDS); false for a slot with no field. */
function place(doc: AvatarDoc, slot: string, g: object): boolean {
  const f = GARMENT_FIELDS.find(x => x.slot === slot)?.field;
  if (!f || f === "hair.style") return false;
  const [a, b] = f.split(".") as [string, string | undefined], d = doc as unknown as Record<string, Record<string, unknown>>;
  if (b) d[a] = { ...(d[a] ?? {}), [b]: g }; else (d as Record<string, unknown>)[a] = g;
  return true;
}

test("every part draws in every build and shape without a stray value", () => {
  const builds = ["adult", "elder", "child", "toddler"] as const, shapes = ["slim", "average", "broad", "round"] as const;
  const parts = Object.entries(kit.parts);
  let n = 0;
  for (const build of builds) for (const shape of shapes) {
    // each part once per build and shape, in its own slot (the slot of a document field is the part's)
    const doc: AvatarDoc = { ...NIMA, body: { build, height: 0.5, shape }, outfit: { ...NIMA.outfit }, wear: {} };
    for (const [id, part] of parts) {
      if (part.builds && !part.builds.includes(build)) continue;
      if (part.slot === "hair") doc.hair = { ...doc.hair, style: id };
      else place(doc, part.slot, { id, colors: ["fab_12", "fab_03"], ...(part.patterns?.length ? { pattern: part.patterns[0] } : {}) });
    }
    for (const framing of FRAMINGS) { const s = renderSvg(compose(doc, kit, CAST), kit, { framing, size: 120 }); checkXml(s); checkSafe(s); n++; }
  }
  assert.equal(n, 48);
  // and each part alone, so a part hidden by another is still drawn once
  for (const [id, part] of parts) {
    const doc: AvatarDoc = { ...NIMA, wear: {}, outfit: { shoes: NIMA.outfit.shoes } };
    if (part.builds && !part.builds.includes("adult")) doc.body = { ...doc.body, build: part.builds[0] };
    if (part.slot === "hair") doc.hair = { ...doc.hair, style: id };
    else if (!place(doc, part.slot, { id })) continue;
    for (const framing of FRAMINGS) for (const view of ["front", "back"] as const) { const s = renderSvg(compose(doc, kit, CAST), kit, { framing, view, size: 120 }); checkXml(s); checkSafe(s); }
  }
});

test("rendering a portrait is quick enough to do fifty in a list", () => {
  clearPortraits();
  const docs = Array.from({ length: 50 }, (_, i) => ({ ...NIMA, skin: `skin_${String(i % 12 + 1).padStart(2, "0")}`, hair: { style: i % 2 ? "hair_bob" : "hair_short", color: `hair_${String(i % 10 + 1).padStart(2, "0")}` }, body: { build: "adult" as const, height: i / 50, shape: "average" as const } }));
  const t = performance.now();
  for (const d of docs) portrait(d, kit, { framing: "head", size: 48 });
  const cold = performance.now() - t;
  assert.ok(cold < 500, `fifty portraits took ${cold.toFixed(0)} ms`);
  const t2 = performance.now();
  for (const d of docs) portrait(d, kit, { framing: "head", size: 48 });
  assert.ok(performance.now() - t2 < cold);
});

// ---- review fixes: what the first round of tests left open ----------------------------------------------------------

test("the strict reader refuses markup it does not know", () => {
  for (const bad of [`<svg onload="x"/>`, `<svg><path d="M0 0" fill="red"/></svg>`, `<svg><path d="M0 0" fill="#fff" x="1"/></svg>`, `<svg><g stroke-linecap="butt" x=""/></svg>`, `<svg><script/></svg>`, `<svg>text</svg>`,
    `<svg><path d="M0 0" d="M1 1"/></svg>`, `<svg><g></svg>`, `<svg><use href="#a"/></svg>`, `<svg><path d="M0 0" opacity="2"/></svg>`]) assert.throws(() => strict(bad), bad);
  strict(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><g stroke="none"><path d="M0 0h1v1z" fill="#fff" opacity=".5"/></g></svg>`);
});

test("compact path text on the awkward cases", () => {
  const same = (p: Path) => { const a = sample(p.cmds), b = sample(parseD(cmdsToD(p.cmds))); assert.equal(a.length, b.length); a.forEach((q, i) => assert.ok(Math.hypot(q[0] - b[i][0], q[1] - b[i][1]) < 1e-9, `point ${i} of ${cmdsToD(p.cmds)}`)); };
  // two cubics whose controls do not mirror each other stay plain; ones that do become a smooth join
  const apart = new Path().moveTo(0, 0).cubicTo(1, 2, 3, 4, 5, 5).cubicTo(9, 9, 12, 3, 14, 0), mirrored = new Path().moveTo(0, 0).cubicTo(1, 2, 3, 4, 5, 5).cubicTo(7, 6, 12, 3, 14, 0);
  same(apart); same(mirrored);
  assert.ok(!/s/.test(cmdsToD(apart.cmds)), cmdsToD(apart.cmds));
  assert.ok(/s/.test(cmdsToD(mirrored.cmds)), cmdsToD(mirrored.cmds));
  // controls on the ends: a line
  assert.equal(cmdsToD(new Path().moveTo(0, 0).cubicTo(0, 0, 5, 5, 5, 5).cmds), "M0 0l5 5");
  // after a close the pen is back at the start of the subpath
  const closed = new Path().moveTo(1, 1).lineTo(10, 1).lineTo(10, 10).close().lineTo(5, 5).lineTo(2, 8).close().moveTo(20, 20).lineTo(21, 22);
  same(closed);
  assert.deepEqual(parseD(cmdsToD(closed.cmds)).slice(4, 6), [["L", 5, 5], ["L", 2, 8]]);
});

test("groupSvg: even-odd holes, the rim in the paper's tint, and hostile caps and joins", () => {
  const holes = groupSvg({ shapes: [{ path: rect(0, 0, 9, 9).add(rect(3, 3, 3, 3)), fill: "#123456", evenodd: true }, { path: rect(0, 0, 9, 9), fill: "#123456" }] });
  assert.equal([...holes.matchAll(/fill-rule="evenodd"/g)].length, 1);
  const rim = groupSvg({ shapes: [{ path: rect(0, 0, 4, 4), fill: "#C4553A" }] });
  assert.ok(rim.includes(`stroke="${tone("#C4553A", "edge")}"`) && tone("#C4553A", "edge") !== "#c4553a", rim);
  // a stroke's cap and join come from short lists; anything else becomes round
  const ink = (cap: unknown, join: unknown) => groupSvg({ shapes: [{ path: rect(0, 0, 1, 1), stroke: { color: "#000", width: 1, cap: cap as never, join: join as never } }] }, { base: true });
  for (const bad of [`butt" x="`, "bogus", 5, null, {}, undefined]) {
    const svg = ink(bad, bad);
    strict(svg);
    assert.match(svg, /stroke-linecap="round"/);
    assert.ok(!/stroke-linejoin/.test(svg), "round is the default under the base group");
  }
  assert.match(ink("square", "bevel"), /stroke-linecap="square" stroke-linejoin="bevel"/);
  assert.ok(!/stroke-linecap/.test(ink("butt", "round")));
});

test("hostile strip colours, stripe inks and labels reach the markup as nothing", () => {
  const puppet = compose(NIMA, kit, CAST), evil = `#fff" x="`;
  const strips = (f: (s: NonNullable<(typeof puppet.views.front)[number]["strip"]>) => object) => ({ ...puppet, views: { ...puppet.views, front: puppet.views.front.map(it => it.strip ? { ...it, strip: { ...it.strip, ...f(it.strip) } } : it) } });
  const plain = renderSvg(puppet, kit, { framing: "full", size: 300 });
  // a bad colour: the strip is not drawn; a bad stripe ink: it is drawn plain
  const noColor = renderSvg(strips(() => ({ color: evil })) as never, kit, { framing: "full", size: 300 }), noInk = renderSvg(strips(() => ({ stripes: [evil, 6, 0.5] })) as never, kit, { framing: "full", size: 300 });
  strict(noColor); strict(noInk);
  assert.ok(noColor.length < plain.length - 800, "no strip at all");
  assert.equal(noInk, plain);
  // a label is text in an attribute: escaped, cut, and only for strings
  for (const label of [`"><script>alert(1)</script>`, `a & b < c`, "x".repeat(500), 7 as never, null as never]) strict(finishSvg(plain, { label }));
  assert.ok(finishSvg(plain, { label: `"><b>` }).includes(`aria-label="&#34;&#62;&#60;b&#62;"`));
  assert.ok(!finishSvg(plain, { label: 7 as never }).includes("aria-label"));
  assert.ok(finishSvg(plain, { label: "x".repeat(500) }).includes(`aria-label="${"x".repeat(120)}"`));
});

test("the picture is a group of its own below the root, so a host stylesheet cannot ink it", () => {
  const puppet = compose(NIMA, kit, CAST);
  for (const framing of FRAMINGS) {
    const svg = renderSvg(puppet, kit, { framing, size: 120, background: "#F4EFE6" });
    assert.ok(!/^<svg[^>]*(stroke|paint-order)/.test(svg), "nothing on the root that a rule on `svg` can override");
    assert.match(svg, /<g stroke="none" stroke-width="\.9" stroke-linejoin="round" paint-order="stroke">/);
    // everything that draws is inside it: the background and the filter definitions are the only things before it
    const at = svg.indexOf(`<g stroke="none"`);
    assert.ok(at > 0 && !/<(path|circle|ellipse)\b/.test(svg.slice(0, at)) && svg.endsWith("</g></svg>"));
  }
});

test("the shadow filter is defined when a layer refers to it, and only then", () => {
  for (const doc of [NIMA, ISMAIL]) for (const framing of FRAMINGS) for (const size of [48, 120, 160, 400]) {
    const svg = renderSvg(compose(doc, kit, CAST), kit, { framing, size }), defs = [...svg.matchAll(/<filter id="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual([...new Set(refs(svg).filter(r => r.endsWith("s")))].sort(), defs.sort(), `${framing} ${size}`);
    assert.equal(svg.includes("<defs>"), defs.length > 0);
    assert.ok(defs.length === 0 || size >= 160);
  }
  assert.ok(!portrait(NIMA, kit, { framing: "head", size: 400, ...CAST }).includes("<defs>"), "a head has no layer lying on another");
  assert.ok(portrait(ISMAIL, kit, { framing: "full", size: 400, ...CAST }).includes("<defs>"));
});

test("a clip path that shapes share is written once; each bone keeps its own table", () => {
  const clip = ellipse(4, 4, 3), other = ellipse(4, 4, 2);
  const g: Group = { shapes: [{ path: rect(0, 0, 8, 8), fill: "#336699", clip }, { path: rect(1, 1, 6, 6), fill: "#993366", clip }, { path: rect(2, 2, 4, 4), fill: "#669933", clip: other }, { path: rect(3, 3, 2, 2), fill: "#222222" }] };
  const alone = groupSvg(g, { id: "u" });
  // shapes in a row under the same clip share one group
  assert.equal(ids(alone).length, 2, "no table: a copy per run of shapes");
  assert.equal((alone.match(/<g clip-path/g) ?? []).length, 2, "the first two shapes share their clip group");
  const clips = new Map<Path, string>(), a = groupSvg(g, { id: "u", clips }), b = groupSvg(g, { id: "v", clips });
  assert.deepEqual(ids(a), ["u0", "u2"]);
  assert.deepEqual(refs(a), ["u0", "u2"]);
  assert.deepEqual(ids(b), [], "the second group refers to what the first defined");
  assert.deepEqual(refs(b), ["u0", "u2"]);
  // apart, they need a group each
  const apart = groupSvg({ shapes: [g.shapes[0], g.shapes[3], g.shapes[1]] }, { id: "w" });
  assert.deepEqual(refs(apart), ["w0", "w2"]);
  checkXml(`<svg>${a}${b}</svg>`);
  strict(`<svg>${a}${b}</svg>`);

  // a part that clips another slot gives every shape of the slot the same path: hair under a cap, one clip path
  const cap = {
    slot: "head", names: { en: "Cap" }, colors: 1, palettes: ["fabric"], defaults: ["fab_05"],
    clips: { slots: ["hair"], keep: (c: { body: { headH: number } }) => rrect(-40, -c.body.headH * 0.62, 80, 80, 2) },
    draw: (c: { body: { headH: number; headW: number }; colors: string[] }) => {
      const H = c.body.headH, W = c.body.headW, dome = smooth([[-W * 0.5, -H * 0.62], [-W * 0.46, -H * 0.9], [0, -H * 1.04], [W * 0.46, -H * 0.9], [W * 0.5, -H * 0.62]], true, 1);
      return { front: [{ layer: "headwear", bone: "head", group: { shapes: [{ path: dome, fill: c.colors[0] ?? "#336699" }] } }], back: [] };
    },
  };
  const k2 = { ...kit, parts: { ...kit.parts, head_cap: cap } } as never as typeof kit;
  for (const hair of ["hair_short", "hair_long", "hair_curly", "hair_bun"]) {
    const doc = { ...NIMA, hair: { style: hair, color: "hair_02" }, wear: { head: { id: "head_cap", colors: ["fab_05"] } } };
    const svg = renderSvg(compose(doc, k2, CAST), k2, { framing: "head", size: 96 }), noCap = renderSvg(compose({ ...doc, wear: {} }, k2, CAST), k2, { framing: "head", size: 96 });
    const shared = (list: string[]) => list.filter(i => /_\d+$/.test(i));
    assert.equal(shared(ids(svg)).length, 1, `${hair}: one clip path for the hair`);
    assert.ok(shared(refs(svg)).length >= 1, `${hair}: the hair's shapes are drawn inside it`);
    assert.ok(bytes(svg) < bytes(noCap) + 600, `${hair}: a cap costs ${bytes(svg) - bytes(noCap)} bytes`);
    strict(svg);
  }
});

test("the recording context keeps the fill rule and the dash, draws rect and arc, and refuses what it lacks", () => {
  const c = new SvgContext("r");
  c.fillStyle = "#123456"; c.beginPath(); c.rect(0, 0, 9, 9); c.rect(3, 3, 3, 3); c.fill("evenodd"); c.fill();
  c.strokeStyle = "#000"; c.beginPath(); c.moveTo(0, 0); c.lineTo(5, 0);
  c.setLineDash([2, 1]); c.save(); c.setLineDash([4, 4]); c.restore(); c.stroke();
  c.setLineDash([]); c.stroke(); c.setLineDash([NaN, 1]); c.stroke(); c.setLineDash([0, 0]); c.stroke(); c.setLineDash(5 as never); c.stroke();
  c.beginPath(); c.rect(0, 0, 4, 4); c.clip("evenodd"); c.fill();
  const svg = c.done();
  strict(svg);
  assert.ok(svg.startsWith(`<path d="M0 0h9v9h-9zM3 3h3v3h-3z" fill="#123456" fill-rule="evenodd"/><path d="M0 0h9v9h-9zM3 3h3v3h-3z" fill="#123456"/>`), svg);
  assert.deepEqual([...svg.matchAll(/stroke-dasharray="([^"]*)"/g)].map(m => m[1]), ["2 1"], "the dash comes back with restore, and bad ones are dropped");
  assert.match(svg, /<clipPath id="r0"><path d="[^"]*" clip-rule="evenodd"\/><\/clipPath>/);
  // arcs: a full circle, a half circle anticlockwise (through the top, y down), a line from the pen to the start
  const rad = (f: (k: SvgContext) => void) => { const k = new SvgContext("a"); k.fillStyle = "#000"; k.beginPath(); f(k); k.fill(); return sample(parseD(k.done().match(/ d="([^"]+)"/)![1])); };
  for (const p of rad(k => k.arc(2, 3, 5, 0, Math.PI * 2))) assert.ok(Math.abs(Math.hypot(p[0] - 2, p[1] - 3) - 5) < 0.02);
  const half = rad(k => k.arc(0, 0, 5, 0, Math.PI, true));
  assert.ok(half.every(p => Math.abs(Math.hypot(...p) - 5) < 0.02) && half.some(p => p[1] < -4.9) && half.every(p => p[1] < 0.02), "anticlockwise from 0 to π passes through the top");
  assert.ok(rad(k => k.arc(0, 0, 5, 0, Math.PI)).every(p => p[1] > -0.02), "clockwise through the bottom");
  assert.equal(rad(k => { k.moveTo(-9, -9); k.arc(0, 0, 1, 0, Math.PI / 2); }).length > 0, true);
  // what the subset lacks is loud: no such method, no such property
  const d = new SvgContext("x");
  assert.throws(() => (d as never as { translate(x: number, y: number): void }).translate(1, 1), TypeError);
  assert.throws(() => { (d as never as Record<string, number>).shadowBlur = 4; }, TypeError);
  assert.throws(() => { (d as never as Record<string, string>).font = "12px serif"; }, TypeError);
});

test("one render serves every size; the size, id prefix and label go on the string", () => {
  clearPortraits();
  const a = portrait(NIMA, kit, { framing: "head", size: 48, ...CAST }), b = portrait(NIMA, kit, { framing: "head", size: 96, ...CAST });
  assert.notEqual(a, b);
  const bare = (s: string) => s.replace(/ width="\d+" height="\d+"/, "");
  assert.equal(bare(a), bare(b));
  assert.match(a, /width="48" height="48"/);
  assert.equal(portraitCacheSize().entries, 1, "28 to 99 px are one level of detail");
  assert.match(portrait(NIMA, kit, { framing: "full", size: 200, ...CAST }), /width="\d+" height="200"/);
  portrait(NIMA, kit, { framing: "head", size: 120, ...CAST });
  assert.equal(portraitCacheSize().entries, 3, "the full figure is one more, and the limb rim comes at 100 px: another render");
  // a prefix is put in front of every id and reference, and a label makes it an image
  const bar = portrait(NIMA, kit, { framing: "bust", size: 200, idPrefix: "bar-", label: "Nima", ...CAST }), pro = portrait(NIMA, kit, { framing: "bust", size: 200, idPrefix: "profile-", ...CAST }), none = portrait(NIMA, kit, { framing: "bust", size: 200, ...CAST });
  assert.ok(ids(bar).length > 2 && ids(bar).every(i => i.startsWith("bar-")) && ids(pro).every(i => i.startsWith("profile-")));
  assert.ok(refs(bar).every(r => ids(bar).includes(r)) && refs(pro).every(r => ids(pro).includes(r)));
  assert.equal(ids(bar).filter(i => ids(pro).includes(i)).length, 0);
  assert.match(bar, /<svg [^>]*role="img" aria-label="Nima"/);
  assert.ok(!none.includes("aria-label") && ids(none).every(i => i.startsWith("p")));
  for (const hostile of [`x" onload="y`, "a b", "<>", ""]) { const s = portrait(NIMA, kit, { framing: "bust", size: 200, idPrefix: hostile, label: hostile, ...CAST }); strict(s); }
});

test("emotion, view and background are part of a portrait's identity", () => {
  clearPortraits();
  const o = { framing: "head" as const, size: 96, ...CAST }, base = portrait(NIMA, kit, o), entries = () => portraitCacheSize().entries;
  const emotion = Object.keys(kit.face.emotions).find(e => e !== "neutral")!;
  const happy = portrait(NIMA, kit, { ...o, emotion }), back = portrait(NIMA, kit, { ...o, view: "back" }), paper = portrait(NIMA, kit, { ...o, background: "#F4EFE6" });
  assert.equal(new Set([base, happy, back, paper]).size, 4);
  assert.equal(entries(), 4);
  assert.ok(paper.includes(`<rect`) && !base.includes(`<rect`) && !back.includes("<clipPath"));
  // what is not an emotion, a view or a colour is the plain one, and shares its entry
  for (const bad of [{ emotion: "nope" }, { emotion: "__proto__" }, { emotion: 7 as never }, { view: "side" as never }, { background: `red" onload="x` }, { background: "none" }]) assert.equal(portrait(NIMA, kit, { ...o, ...bad }), base, JSON.stringify(bad));
  assert.equal(entries(), 4);
  assert.equal(portrait(NIMA, kit, { ...o, emotion }), happy);
  clearPortraits();
});

test("a missing size means a list: little detail; a stylesheet-sized portrait can ask for more", () => {
  assert.deepEqual(detailOf({ size: 28 }), { digits: 1, rim: false, shadow: false, small: true });
  assert.deepEqual(detailOf({}), detailOf({ size: 96 }));
  assert.deepEqual(detailOf({ size: 120 }), { digits: 1, rim: true, shadow: false, small: true });
  assert.deepEqual(detailOf({ size: 160 }), { digits: 1, rim: true, shadow: true, small: true });
  assert.deepEqual(detailOf({ size: 400 }), { digits: 2, rim: true, shadow: true, small: false });
  assert.deepEqual(detailOf({ size: 48, detail: 400 }), detailOf({ size: 400 }));
  assert.deepEqual(detailOf({ size: 400, rim: false, shadow: false, digits: 0, small: true }), { digits: 0, rim: false, shadow: false, small: true });
  assert.deepEqual(detailOf({ size: NaN, detail: -3, digits: NaN }), detailOf({}));
  const list = portrait(ISMAIL, kit, { framing: "bust", ...CAST }), same = portrait(ISMAIL, kit, { framing: "bust", size: 64, ...CAST }), big = portrait(ISMAIL, kit, { framing: "bust", detail: 400, ...CAST });
  const shadows = (svg: string) => [...svg.matchAll(/ filter="url/g)].length;
  assert.equal(shadows(list), 0);
  assert.equal(list.replace(/ width="\d+" height="\d+"/, ""), same.replace(/ width="\d+" height="\d+"/, ""));
  assert.ok(shadows(big) > 0 && bytes(big) > bytes(list) * 1.15);
  assert.ok(!/<svg[^>]* width=/.test(big));
  // no decimals at all at digits 0
  const flat = renderSvg(compose(NIMA, kit, CAST), kit, { framing: "head", digits: 0 });
  strict(flat);
  assert.ok(![...flat.matchAll(/ (?:d|cx|cy|rx|ry|r|viewBox)="([^"]*)"/g)].some(m => m[1].includes(".")));
});

test("the cache holds a list of friends, forgets the oldest first and keeps what is used", () => {
  const doc = (i: number) => ({ ...NIMA, body: { build: "adult" as const, height: i / 100, shape: "average" as const } });
  let drawn = 0;
  const counting = { ...kit, face: { ...kit.face, draw: (...a: Parameters<typeof kit.face.draw>) => { drawn++; return kit.face.draw(...a); } } } as typeof kit;
  const show = (i: number) => portrait(doc(i), counting, { framing: "head", size: 48, ...CAST });
  clearPortraits();
  show(0);
  const one = portraitCacheSize().chars;
  clearPortraits(Math.floor(one * 3.5));
  drawn = 0;
  show(0); show(1); show(2);
  assert.equal(drawn, 3);
  show(0);
  assert.equal(drawn, 3, "a hit draws nothing");
  show(3);
  assert.equal(drawn, 4);
  assert.ok(portraitCacheSize().chars <= one * 3.5 && portraitCacheSize().entries === 3);
  show(0);
  assert.equal(drawn, 4, "document 0 was used last but one: it stayed");
  show(1);
  assert.equal(drawn, 5, "document 1 was the oldest: it went");
  // equal documents share an entry, however they are written, and so do hostile extras
  clearPortraits();
  const t = drawn;
  show(5);
  portrait({ ...doc(5), junk: { a: 1 }, x: "y".repeat(10) }, counting, { framing: "head", size: 48, ...CAST });
  portrait(JSON.parse(JSON.stringify(doc(5))), counting, { framing: "head", size: 48, ...CAST });
  assert.equal(drawn - t, 1);
  // a list of 450 distinct characters fits, so that the next refresh draws none
  clearPortraits();
  const docs = Array.from({ length: 450 }, (_, i) => ({ ...NIMA, skin: `skin_${String(i % 12 + 1).padStart(2, "0")}`, hair: { style: ["hair_short", "hair_bob", "hair_long", "hair_curly"][i % 4], color: `hair_${String(i % 10 + 1).padStart(2, "0")}` }, body: { build: "adult" as const, height: (i % 50) / 50, shape: (["slim", "average", "broad", "round"] as const)[i % 4] }, outfit: { ...NIMA.outfit, top: { id: "top_shirt", colors: [`fab_${String(i % 24 + 1).padStart(2, "0")}`] } } }));
  const d0 = drawn;
  for (const d of docs) portrait(d, counting, { framing: "head", size: 48 });
  const first = drawn - d0;
  for (const d of docs) portrait(d, counting, { framing: "head", size: 48 });
  assert.ok(first >= 400 && drawn - d0 === first, `${first} drawn the first time, none the second`);
  clearPortraits();
});

test("a kit that cannot draw gives the silhouette and tells the hook; the silhouette itself never throws", () => {
  const errors: unknown[] = [];
  onPortraitError(e => errors.push(e));
  try {
    clearPortraits();
    const throws = { ...kit, face: { ...kit.face, draw: () => { throw new Error("boom"); } } } as typeof kit;
    for (const framing of FRAMINGS) assert.equal(portrait(NIMA, throws, { framing, size: 64, ...CAST }), silhouette(throws, { framing, size: 64 }));
    assert.ok(bytes(silhouette(throws)) > 600, "the kit's silhouette, which does not need its face");
    assert.equal(errors.length, 3);
    assert.match(String(errors[0]), /boom/);
    portrait(NIMA, throws, { framing: "head", size: 64, ...CAST });
    assert.equal(errors.length, 3, "once per picture");
    // a face that calls what the recording context lacks, or sets what it cannot keep
    for (const [label, draw] of [["translate", (ctx: never) => (ctx as { translate(x: number, y: number): void }).translate(1, 1)], ["shadowBlur", (ctx: never) => { (ctx as Record<string, number>).shadowBlur = 3; }]] as const) {
      errors.length = 0;
      clearPortraits();
      const odd = { ...kit, face: { ...kit.face, draw } } as unknown as typeof kit;
      assert.equal(portrait(NIMA, odd, { framing: "head", size: 64, ...CAST }), silhouette(odd, { framing: "head", size: 64 }), label);
      assert.ok(errors.length === 1 && errors[0] instanceof TypeError, label);
    }
    // a base part that reads the document is given a real one
    const reads = { ...kit, base: { ...kit.base, draw: (ctx: Parameters<typeof kit.base.draw>[0]) => { void ctx.avatar.body.build; void ctx.avatar.hair.style; return kit.base.draw(ctx); } } } as typeof kit;
    errors.length = 0;
    for (const framing of FRAMINGS) {
      clearPortraits();
      const real = silhouette(kit, { framing });
      clearPortraits();
      for (const bad of [null, { skin: 3 }, "x"]) assert.equal(portrait(bad, reads, { framing, size: 64 }), silhouette(reads, { framing, size: 64 }));
      assert.ok(bytes(silhouette(reads, { framing })) > 600, "the real silhouette, not the stand-in");
      assert.equal(silhouette(reads, { framing }), real);
    }
    assert.deepEqual(errors, []);
    // and a base that throws leaves two plain shapes, still valid markup
    const bad = { ...kit, base: { ...kit.base, draw: () => { throw new Error("no body"); } } } as typeof kit;
    clearPortraits();
    for (const framing of FRAMINGS) for (const bg of [undefined, "#F4EFE6", `red" x="`]) {
      const s = portrait(null, bad, { framing, size: 64, background: bg }), t = portrait(NIMA, bad, { framing, size: 64, background: bg, ...CAST });
      strict(s); strict(t);
      assert.ok(bytes(s) < 700 && s.includes("<circle") && /width="\d+" height="\d+"/.test(s), s);
      assert.equal(s.includes("<rect"), bg === "#F4EFE6");
    }
    assert.ok(errors.length >= 3);
    // a hook that throws is not allowed to break the portrait
    onPortraitError(() => { throw new Error("hook"); });
    clearPortraits();
    assert.doesNotThrow(() => portrait(NIMA, throws, { framing: "bust", size: 64, ...CAST }));
    assert.doesNotThrow(() => portrait(NIMA, bad, { framing: "bust", size: 64, ...CAST }));
  } finally { onPortraitError(null); clearPortraits(); }
});

test("an arm raised to the face is drawn after the head, a hanging one before, with everything on its bones; the default hands are drawn", () => {
  const puppet = compose(NIMA, kit, CAST), MARK = "#010203", WATCH = "#040506";
  // a watch on the wrist (layer over_sleeve, not hand): it goes where its arm goes
  const watch: Item = { layer: "over_sleeve", bone: "hand_l", group: { shapes: [{ path: rect(-2, 0, 4, 3), fill: WATCH }] } };
  const front = puppet.views.front.map(it => it.strip?.chain === "arm_l" ? { ...it, strip: { ...it.strip, color: MARK } } : it), at = front.findIndex(it => it.face);
  const marked = { ...puppet, views: { ...puppet.views, front: [...front.slice(0, at), watch, ...front.slice(at)] } };
  const order = (pose?: object) => { const svg = renderSvg(marked, kit, { framing: "full", size: 400, pose: pose as never }); return { arm: svg.indexOf(MARK), watch: svg.indexOf(WATCH), face: svg.indexOf(`<g stroke-linejoin="miter">`) }; };
  const rest = order(), eat = order({ bones: { arm_l: 2.2, forearm_l: 1.2 }, dx: 0, dy: 0 }), wave = order({ bones: { arm_l: 0.9, forearm_l: 0.2 }, dx: 0, dy: 0 });
  assert.ok(rest.arm > 0 && rest.face > 0 && eat.arm > 0 && rest.watch > 0 && eat.watch > 0);
  assert.ok(rest.arm < rest.face && rest.watch < rest.face, "a hanging arm is behind the face");
  assert.ok(eat.arm > eat.face && eat.watch > eat.face, "a hand at the face is in front of it, its watch too");
  assert.ok(wave.arm < wave.face, "an arm held out to the side is not at the face");
  // each side has its default hand
  const noHands = { ...puppet, views: { ...puppet.views, front: puppet.views.front.filter(it => !it.alt) } };
  assert.ok(puppet.views.front.some(it => it.alt?.default));
  const hands = bytes(renderSvg(puppet, kit, { framing: "full", size: 400 })) - bytes(renderSvg(noHands, kit, { framing: "full", size: 400 }));
  assert.ok(hands > 500 && hands < 4000, `two hands are ${hands} bytes`);
});

test("random characters stay near the size budgets", () => {
  let seed = 99;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32, pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const F = kit.features, bySlot: Record<string, string[]> = {};
  for (const [id, p] of Object.entries(kit.parts)) (bySlot[p.slot] ??= []).push(id);
  const fab = () => `fab_${String(Math.floor(rnd() * 24) + 1).padStart(2, "0")}`, garment = (id: string, n = 1) => ({ id, colors: Array.from({ length: n }, fab) });
  const doc = () => {
    const d: Record<string, unknown> = { v: 1, kit: kit.id, body: { build: pick(["adult", "adult", "elder", "child", "toddler"]), height: rnd(), shape: pick(["slim", "average", "broad", "round"]) }, skin: `skin_${String(Math.floor(rnd() * 12) + 1).padStart(2, "0")}`,
      face: { shape: pick(F["face.shape"].values), eyes: pick(F["face.eyes"].values), brows: pick(F["face.brows"].values), nose: pick(F["face.nose"].values), mouth: pick(F["face.mouth"].values), marks: pick([[], ["freckles"], ["mole"], ["freckles", "mole"]]) },
      hair: { style: pick(bySlot.hair), color: `hair_${String(Math.floor(rnd() * 10) + 1).padStart(2, "0")}` }, outfit: { top: garment(pick(bySlot.top)), bottom: garment(pick(bySlot.bottom)), shoes: garment(pick(bySlot.shoes), 2) } };
    const wear: Record<string, unknown> = {};
    if (rnd() < 0.4) d.facialHair = { style: pick(F.facialHair.values.filter(Boolean)) };
    if (rnd() < 0.4) wear.eyes = garment(pick(bySlot.eyes));
    if (rnd() < 0.3) wear.waist = garment(pick(bySlot.waist));
    if (rnd() < 0.3 && bySlot.head) wear.head = garment(pick(bySlot.head));
    d.wear = wear;
    return d;
  };
  const docs = Array.from({ length: 160 }, doc);
  for (const [framing, budget] of Object.entries(BUDGET) as [Framing, number][]) {
    const sizes = docs.map(d => bytes(portrait(d, kit, { framing, size: 96 }))).sort((a, b) => a - b);
    const p90 = sizes[Math.floor(sizes.length * 0.9)], max = sizes[sizes.length - 1];
    assert.ok(p90 <= budget * 1024 * 1.1, `${framing}: p90 ${p90}`);
    assert.ok(max <= budget * 1024 * 1.5, `${framing}: max ${max}`); // the worst of 160 (textured hair under glasses)
  }
  clearPortraits();
});
