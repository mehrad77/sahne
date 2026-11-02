// The sheets' grid (src/set-svg.ts): however large a cell's frame (a crop kilometres wide, `fit` on an item placed far off), it
// draws about 60 lines an axis at most, so a sheet stays small and fast.

import { test } from "node:test";
import assert from "node:assert/strict";
import full from "../src/full.ts";
import { cellSheetSvg } from "../src/set-svg.ts";

const id = Object.keys(full.props)[0], def = full.props[id];
const sheet = (big: number) => cellSheetSvg(full, [{ item: { id, def, kind: "props" }, label: "crop", params: {}, focus: [-big, -big, big, big] }]);

test("a huge crop draws a bounded grid, not lines without end", () => {
  const small = sheet(100).length;
  for (const big of [1e9, 1e11, 1e21, 1e308]) {
    const t0 = Date.now(), svg = sheet(big);
    assert.ok(svg.length < small * 3, `crop ±${big}: ${svg.length} chars`);
    assert.ok(Date.now() - t0 < 2000, `crop ±${big} took ${Date.now() - t0} ms`);
  }
});
