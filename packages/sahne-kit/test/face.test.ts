// The face artist's checks: every eye, brow and mouth value still acts (blinks, squints, takes every
// emotion and mouth shape), the marks that read the expression change with it, the age cues stay
// off children, and no name or alias carries a word the catalogue rules out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { faceFrom, type AvatarDoc, type FaceParams } from "sahne";
import kit from "../src/index.ts";
import { faceStyle, draw, EMOTIONS, VISEMES } from "../src/face.ts";

const F = kit.features;
const log = (face: AvatarDoc["face"], p: FaceParams, extra: Partial<AvatarDoc> = {}) => {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (o, k) => (k in o ? o[k] : (...a: unknown[]) => { calls.push(`${String(k)}(${a.map(x => typeof x === "number" ? x.toFixed(2) : String(x)).join(",")})`); }),
    set: (o, k, v) => { calls.push(`${String(k)}=${v}`); o[k] = v; return true; },
  });
  draw(ctx as unknown as CanvasRenderingContext2D, faceStyle({ ...kit.defaultDoc, ...extra, face }, kit), p);
  return calls.join(";");
};

test("every eye shape blinks, squints, widens and takes every emotion", () => {
  const open = faceFrom(undefined), shut = faceFrom({ eyeOpen: [0, 0] }), wide = faceFrom({ eyeOpen: [1.2, 1.2] }), squint = faceFrom({ lower: [0.7, 0.7] });
  for (const eyes of F["face.eyes"].values) {
    const base = log({ eyes }, open);
    for (const [what, p] of [["blink", shut], ["wide", wide], ["squint", squint]] as const) assert.notEqual(log({ eyes }, p), base, `${eyes}: ${what}`);
    const seen = new Set(Object.values(EMOTIONS).map(e => log({ eyes }, faceFrom(e))));
    assert.equal(seen.size, Object.keys(EMOTIONS).length, `${eyes}: every emotion is its own face`);
  }
});

test("every mouth takes every mouth shape and the smile", () => {
  for (const mouth of F["face.mouth"].values) {
    const seen = new Set(Object.values(VISEMES).map(v => log({ mouth }, faceFrom({ mouth: v }))));
    assert.equal(seen.size, Object.keys(VISEMES).length, `${mouth}: every viseme differs`);
    assert.notEqual(log({ mouth }, faceFrom({ mouth: { smile: 1 } })), log({ mouth }, faceFrom({ mouth: { smile: -0.7 } })), `${mouth}: smile`);
  }
});

test("the brows follow the emotion, the joined bridge too", () => {
  for (const brows of F["face.brows"].values) assert.notEqual(log({ brows }, faceFrom(EMOTIONS.surprised)), log({ brows }, faceFrom(EMOTIONS.annoyed)), brows);
});

test("dimples and age lines read the expression", () => {
  for (const m of ["dimples", "laugh_lines", "crows_feet", "forehead_lines"]) assert.notEqual(log({ marks: [m] }, faceFrom(undefined)), log({ marks: [m] }, faceFrom(EMOTIONS.laugh)), m);
});

test("age cues are never picked for children; identity marks are free", () => {
  const w = F["face.marks"].weights ?? {};
  for (const m of ["laugh_lines", "crows_feet", "forehead_lines", "wrinkles_deep"]) {
    const o = w[m];
    assert.ok(typeof o === "object" && o.child === 0 && o.toddler === 0, `${m}: not on children`);
  }
  assert.deepEqual([...(F["face.marks"].free ?? [])].sort(), ["birthmark", "scar_brow", "vitiligo"]);
});

test("no face name uses a word the catalogue rules out", () => {
  for (const [field, c] of Object.entries(F)) for (const [v, n] of Object.entries(c.names ?? {})) {
    const all = JSON.stringify(n).toLocaleLowerCase("tr");
    assert.ok(!all.includes("çekik"), `${field}.${v}`);
  }
});

