// A draft once written (src/model/history.ts `saved`): the version that was sent is the saved one, so what was typed
// while the save was on its way stays unsaved, to be saved next.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as H from "../src/model/history.ts";

test("edits made while a save is on its way stay unsaved", () => {
  let d = H.edit(H.open({ t: "a" }, 1), { t: "ab" }, "t", 0);
  const sent = d.doc;
  d = H.edit(d, { t: "abc" }, "t", 100);
  d = H.saved(d, 2, sent);
  assert.deepEqual(d.saved, { t: "ab" });
  assert.ok(H.dirty(d), "the c typed meanwhile is still to save");
  assert.ok(!H.dirty(H.saved(d, 3)), "a save of all of it leaves nothing");
});
