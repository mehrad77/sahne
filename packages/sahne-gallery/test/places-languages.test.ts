// The places board lints a place in the series' languages (src/places/common.ts `problems`): data.mjs serves the content root's
// series, and a place named only in a series' own languages is not held to Turkish, English and Persian.

import { test } from "node:test";
import assert from "node:assert/strict";
import { languagesOf, lintPlace, type StoryPlace } from "sahne-story";
import full from "sahne-kit/full";
import { DATA } from "../data.mjs";

test("data.mjs serves the series, and its languages decide which names a place needs", () => {
  assert.deepEqual(DATA.series()?.languages, { main: "tr", translations: ["en", "fa"] }, "the samples' series");
  const place = JSON.parse(JSON.stringify(DATA.places()[0])) as StoryPlace & { name: Record<string, string> };
  place.name = { de: "Der Ort" };
  const names = (series: unknown) => lintPlace(place, { kit: full, languages: languagesOf(series as never) }).filter(p => /^no name in/.test(p.message)).map(p => p.message);
  assert.deepEqual(names({ languages: { main: "de", translations: [] } }), []);
  assert.deepEqual(names(null), ["no name in tr", "no name in en", "no name in fa"]);
});
