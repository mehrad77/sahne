// The docs of #/docs (data.mjs DOCS): every file is there and renders, every link between two of them
// stays in the gallery and lands on a heading that exists, and every `sahne` block is a script.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DOCS, doc } from "../data.mjs";

test("every doc renders, with its headings' anchors", () => {
  for (const { slug } of DOCS) {
    const d = doc(slug);
    assert.ok(d && d.html.length > 200, slug);
  }
});

test("links between docs land on a heading", () => {
  const ids = new Map(DOCS.map(({ slug }) => [slug, new Set([...doc(slug)!.html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]))]));
  const secs = new Map(DOCS.map(({ slug }) => [slug, new Set([...doc(slug)!.html.matchAll(/ data-sec="([^"]+)"/g)].map(m => `s${m[1]}`))]));
  for (const { slug } of DOCS) {
    for (const [, to, at] of doc(slug)!.html.matchAll(/href="#\/docs\/([a-z]+)(?:\?at=([^"]+))?"/g)) {
      assert.ok(ids.has(to), `${slug} links to a doc that is not there: ${to}`);
      if (at) assert.ok(ids.get(to)!.has(at) || secs.get(to)!.has(at), `${slug} links to ${to}?at=${at}, a heading that is not there`);
    }
  }
});

test("every sahne block is a script", () => {
  for (const { slug } of DOCS) {
    for (const [, json] of doc(slug)!.html.matchAll(/data-script="([^"]*)"/g)) {
      const script = JSON.parse(json.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
      assert.equal(script.v, 1, slug);
      assert.ok("scene" in script.cues[0], `${slug}: a script opens with a scene`);
    }
  }
});
