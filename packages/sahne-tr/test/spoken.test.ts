import { test } from "node:test";
import assert from "node:assert/strict";
import { spoken, tr } from "../src/index.ts";

test("spoken: a line as a voice reads it", () => {
  assert.equal(spoken("Merhaba! Ama “Hoş bulduk!” diyoruz."), "Merhaba! Ama Hoş bulduk! diyoruz.");
  assert.equal(spoken("…Buyrun."), "Buyrun.");
  assert.equal(spoken("Bir, iki, üç… Bunlar ne?"), "Bir, iki, üç… Bunlar ne?");
  assert.equal(spoken("Saat 14:30. 3 bavul!"), "Saat on dört otuz. üç bavul!");
  assert.equal(spoken("2. kat"), "ikinci kat");
  assert.equal(tr.spoken, spoken);
});
