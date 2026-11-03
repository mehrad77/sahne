// A review signature (src/model/review.ts `hashOf`) is the same whatever the runtime's locale: the browser signs an
// approval that the server checks, and the other way round.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REVIEW = fileURLToPath(new URL("../src/model/review.ts", import.meta.url));
const VALUE = { gl: { çay: {}, cuma: {}, ılık: {}, iyi: {}, kör: {}, kos: {} }, steps: [{ link: { şu: "obj:a", su: "obj:b" } }] };

test("hashOf does not depend on the locale", () => {
  const code = `const { hashOf } = await import(${JSON.stringify(REVIEW)}); console.log(hashOf(${JSON.stringify(VALUE)}));`;
  const run = (locale: string) => execFileSync(process.execPath, ["--input-type=module", "-e", code], { env: { ...process.env, LC_ALL: locale, LANG: locale } }).toString().trim();
  const en = run("en_US.UTF-8");
  for (const l of ["tr_TR.UTF-8", "et_EE.UTF-8", "da_DK.UTF-8"]) assert.equal(run(l), en, l);
});
