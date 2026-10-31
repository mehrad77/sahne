// A new document's id from its name (src/model/newid.ts): folded to a-z, 0-9 and _, numbered when taken, none from a
// name with no Latin letters, and what is wrong with one typed by hand.

import { test } from "node:test";
import assert from "node:assert/strict";
import { idFrom, idProblem } from "../src/model/newid.ts";

test("a name becomes an id, numbered when it is taken", () => {
  const none = () => false;
  assert.equal(idFrom("Elif", none), "elif");
  assert.equal(idFrom("Kırlangıç Ana", none), "kirlangic_ana");
  assert.equal(idFrom("  Zafer Hoca! ", none), "zafer_hoca");
  assert.equal(idFrom("Großmutter", none), "grossmutter");
  assert.equal(idFrom("2 Brüder", none), "bruder");
  assert.equal(idFrom("پروانه", none), "");
  assert.equal(idFrom("Nima", id => id === "nima" || id === "nima_2"), "nima_3");
});

test("a typed id: its pattern, a retired one, a taken one", () => {
  const taken = (id: string) => id === "nima", retired = (id: string) => id === "ada";
  assert.equal(idProblem("elif", taken, retired), null);
  assert.equal(idProblem("", taken, retired), "an id is needed");
  assert.match(idProblem("Elif", taken, retired)!, /a-z/);
  assert.match(idProblem("ada", taken, retired)!, /retired/);
  assert.equal(idProblem("nima", taken, retired), "taken");
});
