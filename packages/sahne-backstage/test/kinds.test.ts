// The kit page's kinds (src/model/kinds.ts): on the full kit, each named look and each `kind` no look draws is one kind,
// named as a place names it, and each one draws.

import { test } from "node:test";
import assert from "node:assert/strict";
import full from "sahne-kit/full";
import { pieceSvg } from "sahne-kit/set-svg";
import { lookRef, looksOf } from "../src/model/kinds.ts";

test("named looks first, then the kinds no look draws; one look is none", () => {
  const def = { draw: () => null, meta: { params: { kind: { type: "enum", values: ["a", "b", "c"] } } }, variants: { big: { kind: "a", size: 2 }, b: { kind: "b" } } } as never;
  assert.deepEqual(looksOf(def).map(l => `${l.by}:${l.name}`), ["variant:big", "variant:b", "kind:c"]);
  assert.deepEqual(looksOf({ draw: () => null, variants: { only: {} } } as never), []);
  assert.equal(lookRef("pastry", { name: "croissant", params: { variant: "croissant" }, by: "variant" }), `"kit": "pastry", "variant": "croissant"`);
  assert.equal(lookRef("traveller", { name: "pack", params: { kind: "pack" }, by: "kind" }), `"kit": "traveller", "kind": "pack"`);
});

test("every kind of every prop and set piece draws", () => {
  let n = 0;
  for (const which of ["props", "set"] as const) for (const [id, def] of Object.entries(full[which])) for (const l of looksOf(def)) {
    assert.ok(pieceSvg(full, def, l.params, id, 64).startsWith("<svg"), `${which} ${id} ${l.name} draws nothing`);
    n++;
  }
  assert.ok(n > 1000, `${n} kinds`);
});
