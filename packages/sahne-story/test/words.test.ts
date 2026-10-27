// The story check's word resolver (check/words.ts): a token of a story's text resolves when it is a
// dictionary entry or a form of one, a number or a particle.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolver, words } from "../check/words.ts";

test("an inflected form of an entry resolves; the entry does not resolve from its inflected forms", () => {
  const r = resolver(["fırın", "masa", "ev", "kitap"]);
  for (const t of ["fırının", "masada", "eve", "evler", "kitabı"]) assert.ok(r(t), t);
  // the forms the M5 passes glossed by hand because the reversed match missed them: -DA after k, possessives,
  // and the consonant softening (k → ğ, p → b, ç → c)
  const more = resolver(["mutfak", "telefon", "çocuk", "ağaç", "renk"]);
  for (const t of ["mutfakta", "mutfağa", "telefonum", "telefonun", "çocuğum", "ağaçta", "rengi"]) assert.ok(more(t), t);
  // the other way round: a short word is not known because a longer form of it is listed
  const longer = resolver(["kalemler"]);
  assert.ok(!longer("kalem"), "kalem from kalemler");
});

test("verbs listed as -mAk resolve in their forms; numbers and particles resolve", () => {
  const r = resolver(["gelmek", "gitmek"]);
  for (const t of ["geliyorum", "gidiyor", "iki", "mi", "evet"]) assert.ok(r(t), t);
  assert.ok(!resolver(["gelmek"], { particles: false })("mi"));
});

test("a verb's stem is not a wildcard: a made-up word that starts like a verb does not resolve", () => {
  const r = resolver(["gelmek", "takmak", "bakmak", "kalmak", "satmak", "pişmek", "almak", "okumak", "etmek", "demek", "yemek", "beklemek", "gitmek"]);
  for (const t of ["tavuzgo", "gemizak", "bazırgo", "okzumpa", "kaşık", "salata", "pilav", "alfabe", "kapı"]) assert.ok(!r(t), t);
  // and the real forms still do, the irregular ones too
  for (const t of ["gelmiyor", "geldim", "bekliyor", "gidiyor", "ediyorum", "diyor", "yiyor", "okudum", "kalıyor", "aldım"]) assert.ok(r(t), t);
});

test("words: lower-cased the Turkish way, a name's apostrophe tail cut", () => {
  assert.deepEqual(words("İstanbul'a Kerim'in ışığı"), ["istanbul", "kerim", "ışığı"]);
});
