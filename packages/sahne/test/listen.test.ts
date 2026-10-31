// sahne/listen: the Web Speech wrapper, driven by a fake recogniser. The matching is the
// language plugin's (sahne-tr's tests); here a plugin without one uses the crude fallback.

import { test } from "node:test";
import assert from "node:assert/strict";
import { canListen, cannotListen, listen, listenFor, resetListen, type Recognition, type RecognitionEvent, type ListenEnv } from "../src/listen/index.ts";
import type { LangPlugin } from "../src/core/lang.ts";

type Script = (r: Fake) => void;
class Fake implements Recognition {
  static script: Script = () => {};
  static last: Fake | null = null;
  lang = ""; interimResults = false; maxAlternatives = 1; continuous = false;
  onstart: (() => void) | null = null; onspeechstart: (() => void) | null = null;
  onresult: ((e: RecognitionEvent) => void) | null = null; onerror: ((e: { error: string }) => void) | null = null; onend: (() => void) | null = null;
  started = false; stopped = false; aborted = false;
  start() { this.started = true; Fake.last = this; queueMicrotask(() => { this.onstart?.(); Fake.script(this); }); }
  stop() { this.stopped = true; queueMicrotask(() => this.onend?.()); }
  abort() { this.aborted = true; queueMicrotask(() => this.onend?.()); }
  /** Send a result: alternatives of one segment. */
  say(alts: string[], isFinal: boolean) {
    const r = Object.assign(alts.map(transcript => ({ transcript })), { isFinal });
    this.onresult?.({ resultIndex: 0, results: [r] });
  }
}
const env: ListenEnv = { Recognition: Fake, online: true, secure: true };
const plain: LangPlugin = { id: "x", speech: () => ({ dur: 0, keys: [], words: [] }) };
const tick = () => new Promise(r => setTimeout(r, 5));

test("canListen: a recogniser, a secure context, online", () => {
  assert.equal(canListen(env), true);
  assert.equal(cannotListen({ ...env, Recognition: null }), "unsupported");
  assert.equal(cannotListen({ ...env, secure: false }), "insecure");
  assert.equal(cannotListen({ ...env, online: false }), "offline");
  // Node has no recogniser of its own
  assert.equal(canListen(), false);
});

test("listen: the final alternatives, with the language and settings asked", async () => {
  Fake.script = r => { r.onspeechstart?.(); r.say(["iki ekmek", "iki"], false); r.say(["iki ekmek lütfen", "iki ekmek lütfen mi"], true); r.onend?.(); };
  const states: string[] = [], interim: string[] = [];
  const out = await listen({ env, lang: "tr-TR", onState: s => states.push(s), onInterim: t => interim.push(t) }).result;
  assert.deepEqual(out, { alternatives: ["iki ekmek lütfen", "iki ekmek lütfen mi"] });
  assert.equal(Fake.last!.lang, "tr-TR");
  assert.equal(Fake.last!.interimResults, true);
  assert.equal(Fake.last!.maxAlternatives, 5);
  assert.deepEqual(states, ["starting", "listening", "hearing", "done"]);
  assert.deepEqual(interim, ["iki ekmek"]);
});

test("listen: nobody speaks, the microphone is refused, the card aborts", async () => {
  Fake.script = r => { r.onerror?.({ error: "no-speech" }); r.onend?.(); };
  assert.deepEqual(await listen({ env }).result, { alternatives: [], error: "no-speech" });

  Fake.script = () => {};
  assert.deepEqual(await listen({ env, silence: 20 }).result, { alternatives: [], error: "no-speech" });
  assert.ok(Fake.last!.aborted);

  Fake.script = () => {};
  const ac = new AbortController();
  const run = listen({ env, signal: ac.signal });
  await tick(); ac.abort();
  assert.deepEqual(await run.result, { alternatives: [], error: "aborted" });

  Fake.script = r => { r.onerror?.({ error: "not-allowed" }); r.onend?.(); };
  assert.deepEqual(await listen({ env }).result, { alternatives: [], error: "denied" });
  // a refusal hides the microphone for the rest of the page's life, for that recogniser only (a demo's pretend one leaves the real one alone)
  assert.equal(cannotListen(env), "denied");
  assert.equal(cannotListen({ ...env, Recognition: class extends Fake {} }), null);
  assert.deepEqual(await listen({ env }).result, { alternatives: [], error: "denied" });
  resetListen();
  assert.equal(canListen(env), true);
});

test("listen: stop() finishes with what was heard so far", async () => {
  Fake.script = r => { r.onspeechstart?.(); r.say(["merhaba"], false); };
  const run = listen({ env });
  await tick(); run.stop();
  assert.deepEqual(await run.result, { alternatives: ["merhaba"] });
});

test("listenFor: the plugin's matcher decides, over the n-best list", async () => {
  const plugin: LangPlugin = { ...plain, locale: "tr-TR", matchLine: (h, ex) => {
    const alts = [h].flat(), k = alts.findIndex(a => ex.includes(a));
    return k >= 0 ? { matched: true, best: ex.indexOf(alts[k]), heard: alts[k], score: 1 } : { matched: false, best: -1, heard: alts[0], score: 0 };
  } };
  Fake.script = r => { r.onspeechstart?.(); r.say(["iki ekmek ver", "iki ekmek lütfen"], true); r.onend?.(); };
  const m = await listenFor(["iki ekmek lütfen", "x"], plugin, { env });
  assert.equal(m.matched, true); assert.equal(m.best, 0); assert.equal(m.heard, "iki ekmek lütfen");
  assert.deepEqual(m.alternatives, ["iki ekmek ver", "iki ekmek lütfen"]);

  Fake.script = r => { r.onspeechstart?.(); r.say(["dört simit"], true); r.onend?.(); };
  const no = await listenFor(["iki ekmek lütfen"], plugin, { env });
  assert.equal(no.matched, false); assert.equal(no.best, -1); assert.equal(no.heard, "dört simit");
});

test("listenFor: stops early once the interim text is the line; a plugin without a matcher compares words", async () => {
  Fake.script = r => { r.onspeechstart?.(); r.say(["Merhaba!"], false); };
  const m = await listenFor(["merhaba"], plain, { env });
  assert.ok(Fake.last!.stopped, "listening stopped on the interim match");
  assert.equal(m.matched, true);

  Fake.script = r => { r.onerror?.({ error: "network" }); r.onend?.(); };
  const off = await listenFor(["merhaba"], plain, { env });
  assert.deepEqual({ matched: off.matched, error: off.error }, { matched: false, error: "network" });
});
