// What the stories remember (src/memory.ts): flags, warmth, the album's bands and pages, the unlocks; on small fixtures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { albumBand, flagsOf, metIn, unlockedOf, warmthOf, type StoryDoc } from "../src/index.ts";

const base = { title: "", place: "p" } as const;
const A: StoryDoc = { ...base, id: "s1e01", cast: ["maria", "nima"], steps: [
  { who: "maria", tr: "Merhaba." },
  { choice: { id: "seat", options: [{ tr: "Buyurun.", ok: true, tone: "polite", sets: "s1e01_seat" }, { tr: "Hayır.", tone: "rude" }] } },
  { who: "ismail", tr: "Ekmek?" },
  { choice: { id: "both", options: [{ tr: "Evet.", ok: true, warm: { ismail: 1, maria: -1 } }, { tr: "Yok.", tone: "casual" }] } },
], followUp: [{ who: "maria", tr: "Görüşürüz." }, { choice: { id: "fu_bye", to: "maria", options: [{ tr: "Hoşça kal!", ok: true }, { tr: "…" }] } }] };
const B: StoryDoc = { ...base, id: "s1e02", cast: ["maria", "ismail"], unlocks: ["bundle:istanbul"], steps: [] };
const C: StoryDoc = { ...base, id: "s1e03", cast: ["maria", "kerim"], steps: [] };

test("flags come from the picked options' sets", () => {
  assert.deepEqual([...flagsOf([A], { s1e01: { seat: 0 } })], ["s1e01_seat"]);
  assert.deepEqual([...flagsOf([A], { s1e01: { seat: 1 } })], []);
  assert.deepEqual([...flagsOf([A], {})], []);
});

test("warmth: ok +1 to the speaker before, rude -1, warm overrides, follow-ups count", () => {
  assert.deepEqual(warmthOf([A], { s1e01: { seat: 0, both: 0, fu_bye: 0 } }), { maria: 1, ismail: 1 });
  assert.deepEqual(warmthOf([A], { s1e01: { seat: 1, both: 1 } }), { maria: -1 });
});

test("album bands and pages, and the unlocks of finished stories", () => {
  assert.deepEqual([-1, 0, 1, 2, 3, 5].map(albumBand), ["met", "met", "close", "close", "family", "family"]);
  const done = (id: string) => id !== "s1e04";
  assert.deepEqual(metIn([A, B, C], done), ["maria"]);
  assert.deepEqual(metIn([A, B, C], done, 1), ["maria", "ismail"]);
  assert.deepEqual([...unlockedOf([A, B, C], (id) => id === "s1e02")].sort(), ["bundle:istanbul", "story:s1e02"]);
});
