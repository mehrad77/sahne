// Every set piece and prop describes itself (`PieceDef.meta`, DESIGN.md §5.5): what it draws and every
// param it reads. SET.md and the gallery's piece inspector are built from it, so it must not drift from
// the drawing. The rules are the kit's own checks (`src/check.ts`), which backstage's MCP tools run too:
// each generator is drawn with its defaults, each variant, each value of each enum and each flag, through
// a params object that records what is read, and every read must be declared.

import { test } from "node:test";
import assert from "node:assert/strict";
import kit from "../src/full.ts";
import { checkKit, problemLine, type Rule } from "../src/check.ts";

export { ENGINE_PARAMS } from "../src/check.ts";

const all = checkKit(kit);
// Each test lists every problem at once, one line per generator, so a family can be fixed in one go.
const none = (rule: Rule) => { const ps = all.filter(p => p.level === "error" && p.rule === rule).map(problemLine); assert.equal(ps.length, 0, `\n${ps.join("\n")}\n`); };

test("every set piece and prop has a meta: a line on what it is and its params", () => none("meta"));
test("every variant sets only declared params, to legal values", () => none("variants"));
test("every param a drawing reads is declared in its meta", () => none("reads"));
