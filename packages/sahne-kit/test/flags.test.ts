// The flags (src/flags.ts): every country draws, ids are permanent, a bad id falls back to Turkey, and
// Turkey's shapes (and the pieces that draw it) are the same as before the table existed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { groupBounds, rng } from "sahne";
import kit from "../src/full.ts";
import { SET, PROPS } from "../src/set/all.ts";
import { COUNTRIES, countryOf, flagCloth, flagWidth } from "../src/flags.ts";

const hash = (v: unknown) => createHash("sha1").update(JSON.stringify(v)).digest("hex").slice(0, 10);

test("the country ids are permanent: ISO 3166 lowercase plus eu, gb_eng, gb_sct, gb_wls", () => {
  assert.equal(COUNTRIES.length, new Set(COUNTRIES).size);
  assert.equal(COUNTRIES[0], "tr");
  for (const id of ["tr", "de", "fr", "it", "es", "gb", "ie", "nl", "se", "ch", "ua", "eu", "gb_eng", "gb_sct", "gb_wls"]) assert.ok(COUNTRIES.includes(id), id);
  assert.ok(COUNTRIES.every(id => /^[a-z]{2}(_[a-z]{3})?$/.test(id)), "id shape");
});

test("every country draws finite shapes, flat and waving, at its own proportions", () => {
  for (const c of COUNTRIES) for (const amp of [0, 0.09]) {
    const sh = flagCloth(60, amp, 1.2, c);
    assert.ok(sh.length > 0, c);
    const w = flagWidth(60, c);
    assert.ok(Number.isFinite(w) && w > 30 && w < 150, `${c} width ${w}`);
    for (const s of sh) { const b = groupBounds({ shapes: [s] }); assert.ok(b.every(Number.isFinite), `${c} finite`); }
  }
});

test("a bad country id falls back to Turkey, never throws", () => {
  for (const bad of ["constructor", "toString", "__proto__", "hasOwnProperty", "zz", "", 7, null, undefined]) {
    assert.equal(countryOf(bad), "tr", String(bad));
    assert.ok(Number.isFinite(flagWidth(10, bad as string)), String(bad));
    assert.doesNotThrow(() => flagCloth(60, 0, 0, bad as string));
  }
});

test("Turkey's flag, and every piece drawing it by default, is unchanged", () => {
  assert.equal(hash(flagCloth(60, 0, 0)), hash(flagCloth(60, 0, 0, "tr")));
  assert.equal(flagWidth(10), 15);
  const cases: [string, Record<string, unknown>, string][] = [
    ["flag", {}, "23586f916a"], ["flag", { kind: "bunting" }, "4cf03ab591"], ["crowd", {}, "7cf3436e88"], ["crowd", { flags: 3 }, "57a0b9bfdd"],
    ["facade", { flag: true }, "1994e07b50"], ["balcony", { flag: true }, "8503015e40"], ["paper", { kind: "crown", flag: true }, "bc51b8be29"],
  ];
  for (const [id, p, h] of cases) assert.equal(hash((SET[id] ?? PROPS[id]).draw(p, rng("s-" + id), kit)), h, `${id} ${JSON.stringify(p)}`);
});

test("every flag-drawing piece declares a country enum with every id", () => {
  for (const [id, key] of [["flag", "country"], ["balcony", "country"], ["facade", "country"], ["crowd", "flagCountry"]] as const) {
    const m = (SET[id] ?? PROPS[id]).meta?.params?.[key] as { values?: string[] } | undefined;
    assert.deepEqual(m?.values, COUNTRIES, `${id}.${key}`);
  }
  assert.deepEqual(((PROPS.paper ?? SET.paper).meta?.params?.country as { values?: string[] }).values, COUNTRIES);
});

test("a balcony hangs another country's flag, and the pieces draw every country", () => {
  for (const c of COUNTRIES) for (const [id, p] of [["flag", { country: c }], ["balcony", { flag: true, country: c }], ["facade", { country: c }]] as const) assert.ok((SET[id] ?? PROPS[id]).draw({ ...p }, rng("c"), kit).flats.length > 0, `${id} ${c}`);
  const a = hash(SET.balcony.draw({ flag: true }, rng("b"), kit)), b = hash(SET.balcony.draw({ flag: true, country: "fr" }, rng("b"), kit));
  assert.notEqual(a, b);
});
