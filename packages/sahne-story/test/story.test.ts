// The story adapter and the story lints, on the bakkal test scene (Kumru's STORIES_STAGE.md
// §10) written as a story document: test/fixtures/bakkal.json, with its place and characters.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AvatarDoc, Cue, LineCue, PlaceDoc } from "sahne";
import kit from "../../sahne-kit/src/full.ts";
import { PLACES } from "../paths.ts";
import { adaptStory, lintStory, suggest, type BeatStep, type CharacterDoc, type ChoiceStep, type ActStep, type LineStep, type Looks, type Problem, type SceneStep, type StoryDoc } from "../src/index.ts";

const json = <T>(f: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
const STORY = json<StoryDoc>("bakkal.json");
const places: Record<string, PlaceDoc> = { bakkal: JSON.parse(readFileSync(new URL("bakkal.json", PLACES), "utf8")) };
const characters: Record<string, CharacterDoc> = Object.fromEntries(["ismail", "nima", "kerim"].map(id => [id, json<CharacterDoc>(`characters/${id}.json`)]));
const story = (): StoryDoc => structuredClone(STORY);
const kinds = (s: StoryDoc, picks = {}) => adaptStory(s, { places, characters }).perform(picks).info.map(i => i.kind);
const lineOf = (c: unknown) => (c as LineCue).line;

test("adapter: every step becomes its cue, in order", () => {
  assert.deepEqual(kinds(story()), ["scene", "line", "line", "say", "line", "act", "react", "line", "spot", "say", "reply", "line", "say", "line"]);
  const { script } = adaptStory(story(), { places, characters }).perform();
  assert.deepEqual(script.cues[0], { scene: { place: "bakkal", at: { ismail: "counter" }, time: "day", perch: "ledge" } });
  assert.equal(script.v, 1);
});

test("adapter: staging passes through unchanged, and Kerim narrates to the viewer", () => {
  const { script } = adaptStory(story(), { places, characters }).perform();
  const { who: _w, tr: _t, en: _e, fa: _f, ...staging } = STORY.steps[2] as LineStep;
  assert.deepEqual(lineOf(script.cues[2]), { who: "ismail", text: "Hoş geldiniz! Buyrun.", ...staging });
  assert.deepEqual(lineOf(script.cues[1]), { who: "kerim", text: "Nima bakkalda.", to: "viewer" });
  assert.equal(lineOf(script.cues[13]).to, "viewer");
});

test("adapter: translations never reach the stage", () => {
  const { script, info } = adaptStory(story(), { places, characters }).perform({ ask: 1 });
  const s = JSON.stringify(script);
  assert.ok(!/[؀-ۿ]/.test(s), "no Persian on the stage");
  for (const en of ["Welcome", "Two loaves", "Is there bread", "Slowly", "outline"]) assert.ok(!s.includes(en), en);
  // they stay with the cue, for the log and the card
  assert.equal(info[2].en, "Welcome! Come in.");
  assert.equal(info[2].fa, "خوش آمدید! بفرمایید.");
});

test("adapter: every stand-in line is a card, even with one option; the '…' line is the silent card", () => {
  const a = adaptStory(story(), { places, characters });
  const { script, info } = a.perform();
  assert.deepEqual(a.turns.map(t => t.kind), ["say", "act", "choice", "say"]);
  const say = info[3].turn!;
  assert.equal(say.kind, "say");
  assert.deepEqual(say.kind === "say" && say.options, [{ tr: "Ekmek var mı? Süt var mı?", en: "Is there bread? Is there milk?", fa: "نان هست؟ شیر هست؟", text: { tr: "Ekmek var mı? Süt var mı?", en: "Is there bread? Is there milk?", fa: "نان هست؟ شیر هست؟" } }]);
  assert.equal(say.kind === "say" && say.silent, false);
  const dots = info[12].turn!;
  assert.ok(dots.kind === "say" && dots.silent);
  assert.deepEqual(lineOf(script.cues[12]), { who: "nima", text: "…", emo: "nervous", sfx: { at: "mark:clock", id: "clock_tick", word: "tik tak" }, voice: "silent" });
});

test("adapter: a choice is the same card with its options; the pick, its reactions and the reply become cues", () => {
  const a = adaptStory(story(), { places, characters });
  const polite = a.perform(), blunt = a.perform({ ask: 1 });
  const turn = polite.info[9].turn!;
  assert.ok(turn.kind === "choice");
  assert.deepEqual(turn.kind === "choice" && turn.options.map(o => [o.tr, o.ok ?? false, o.tone]), [["İki ekmek, lütfen.", true, "polite"], ["İki ekmek ver.", false, "blunt"]]);
  assert.deepEqual(lineOf(polite.script.cues[9]), { who: "nima", text: "İki ekmek, lütfen.", do: "count", n: 2, link: { ekmek: "obj:ekmek" }, react: { ismail: { do: "nod", emo: "happy" } } });
  assert.deepEqual(lineOf(polite.script.cues[10]).obj, [{ id: "ekmek", n: 2, op: "give", to: "nima" }]);
  assert.deepEqual(blunt.info.map(i => i.kind).slice(9, 13), ["say", "reply", "reply", "line"]);
  assert.deepEqual(blunt.script.cues[10], { beat: { wait: 900 } });
  assert.equal(lineOf(blunt.script.cues[11]).text, "…Buyrun.");
  assert.equal(blunt.info[9].option, 1);
  // the stage loads the other branches' art
  const ats = a.load.extra!.map(e => e.at);
  assert.deepEqual(ats, [5, 9]);
  assert.deepEqual(a.load.extra![1].cues, blunt.script.cues.slice(9));
});

test("adapter: an act is a cue whose result goes back like a choice; its reaction is a beat", () => {
  const a = adaptStory(story(), { places, characters });
  const ok = a.perform(), miss = a.perform({ which_bread: "obj:simit" });
  assert.deepEqual(ok.script.cues[5], { act: { kind: "tap", targets: ["obj:ekmek", "obj:simit"], expect: "obj:ekmek", prompt: "Hangi ekmek?", who: "nima", by: "ismail" } });
  assert.deepEqual(ok.script.cues[6], { beat: { react: { ismail: { do: "nod", emo: "happy" } } } });
  assert.deepEqual(miss.script.cues[6], { beat: { react: { ismail: "confused" } } });
  const t = ok.info[5].turn!;
  assert.ok(t.kind === "act" && t.id === "which_bread" && t.prompt?.en === "Which one is \"şu ekmek\"?");
  assert.equal(a.defaults.which_bread, "obj:ekmek");
});

test("adapter: the cast is the learner as Nima, the others from their documents; Kerim is the narrator inset", () => {
  const plain = adaptStory(story(), { places, characters });
  assert.deepEqual(Object.keys(plain.load.cast).sort(), ["ismail", "nima"]);
  assert.deepEqual(plain.load.cast.nima, characters.nima.avatar);
  assert.equal(plain.load.narrator, "kerim");
  assert.deepEqual(plain.load.names, { ismail: "İsmail", nima: "Nima", kerim: "Kerim" });
  assert.deepEqual(plain.load.voices!.ismail, { rate: 1.05, pitch: 0.78 });
  assert.equal(plain.load.tempo!.ismail, 1.1);
  const learner = { ...characters.ismail.avatar!, skin: "skin_10" } as AvatarDoc;
  assert.equal(adaptStory(story(), { places, characters, learner }).load.cast.nima, learner);
});

test("adapter: a character with a puppet joins the cast as it, with its terms; Kerim without one stays the window", () => {
  const bird = { ...characters, kerim: { ...characters.kerim, puppet: "bird", terms: ["a1-w-kus"] } };
  const a = adaptStory(story(), { places, characters: bird });
  assert.deepEqual(Object.keys(a.load.cast).sort(), ["ismail", "kerim", "nima"]);
  assert.deepEqual([a.load.cast.kerim, a.load.terms, a.load.narrator], [{ puppet: "bird" }, { kerim: ["a1-w-kus"] }, "kerim"]);
  assert.deepEqual(adaptStory(story(), { places, characters }).load.terms, {});
});

test("lint: Kerim on stage is at her perch, so ch:kerim has a place", () => {
  const s = story(), l = line(s, 4);
  Object.assign(l, { tr: "Bu kuş!", link: { "kuş": "ch:kerim" }, do: "point", at: "ch:kerim" });
  const bird = { ...characters, kerim: { ...characters.kerim, puppet: "bird" } };
  assert.ok(lintStory(s, { places, characters: bird }).some(p => p.rule === "deixis" && /ch:kerim is 2\.\d m away/.test(p.message)), "bu at a bird on the ledge, 2 m off");
  assert.ok(!lintStory(s, { places, characters }).some(p => p.rule === "deixis"), "only in her window: no distance to check");
});

test("adapter: personalising runs on every text that reaches the stage", () => {
  const s = story();
  s.props = { canta: { kit: "bag", at: "customer", label: "Nima'nın çantası", screen: { title: "Tahran", lines: ["Nima"] } } } as StoryDoc["props"];
  s.steps.splice(2, 0, { who: "ismail", tr: "Nima, Tahran'dan mı?", en: "Nima, from Tehran?", fa: "نیما، از تهران؟", link: { nima: "ch:nima" }, obj: [{ id: "canta", op: "set", set: { label: "Nima" } }], sfx: { id: "doorbell", word: "Nima!" } } as LineStep);
  (s.steps[6] as { act: { prompt: { tr: string } } }).act.prompt.tr = "Nima, hangi ekmek?";
  (s.steps[8] as { spot: { ex: string } }).spot.ex = "Nima: süt yok.";
  const personalise = (t: string) => t.replace(/Nima/g, "Ali").replace(/Tahran/g, "Herat");
  const a = adaptStory(s, { places, characters, personalise });
  const { script, info } = a.perform();
  const stage = JSON.stringify(script) + JSON.stringify(a.load.places);
  // ids stay ("nima" is the stand-in's id); no token is left in any text
  assert.ok(!/Nima|Tahran/.test(stage), stage.match(/.{30}(Nima|Tahran).{30}/)?.[0]);
  assert.equal(lineOf(script.cues[1]).text, "Ali bakkalda.");
  assert.equal(lineOf(script.cues[2]).text, "Ali, Herat'dan mı?");
  assert.deepEqual(lineOf(script.cues[2]).link, { ali: "ch:nima" });
  assert.deepEqual(lineOf(script.cues[2]).obj, [{ id: "canta", op: "set", set: { label: "Ali" } }]);
  assert.equal((lineOf(script.cues[2]).sfx as { word: string }).word, "Ali!");
  assert.equal(a.load.places!.bakkal.props!.canta.label, "Ali'nın çantası");
  assert.deepEqual(a.load.places!.bakkal.props!.canta.screen, { title: "Herat", lines: ["Ali"] });
  assert.equal((script.cues[6] as { act: { prompt: string } }).act.prompt, "Ali, hangi ekmek?");
  assert.equal((script.cues[9] as { overlay: { ex: string } }).overlay.ex, "Ali: süt yok.");
  // the card shows the personalised Turkish; the place's own props keep their art
  assert.equal(info[1].tr, "Ali bakkalda.");
  assert.equal(a.load.names!.nima, "Ali", "the name a screen reader says before the line");
  assert.deepEqual(a.load.places!.bakkal.props!.ekmek, places.bakkal.props!.ekmek);
});

test("adapter: if / unless lines follow the flags of earlier stories", () => {
  const s = story();
  s.steps.splice(2, 0, { who: "ismail", if: "s1e00_x", tr: "Yine siz!" } as LineStep, { who: "ismail", unless: "s1e00_x", tr: "Merhaba!" } as LineStep);
  const text = (flags: string[]) => lineOf(adaptStory(s, { places, characters, flags }).perform().script.cues[2]).text;
  assert.equal(text([]), "Merhaba!");
  assert.equal(text(["s1e00_x"]), "Yine siz!");
});

// ---- lints ------------------------------------------------------------------------------

const lint = (s: StoryDoc) => lintStory(s, { places });
const rules = (ps: Problem[], level?: Problem["level"]) => ps.filter(p => !level || p.level === level).map(p => `${p.rule}@${p.step}${p.option !== undefined ? "." + p.option : ""}`);
const line = (s: StoryDoc, i: number) => s.steps[i] as LineStep;

test("lints: the bakkal scene is clean", () => {
  assert.deepEqual(lint(story()), []);
});

test("lint deixis: bu/şu/o + a linked noun needs a gesture at it, and they agree", () => {
  let s = story(); delete line(s, 4).do;
  const p = lint(s);
  assert.deepEqual(rules(p), ["deixis@4"]);
  assert.deepEqual(p[0].fix, { do: "point", at: "obj:ekmek" });

  s = story(); line(s, 4).at = "obj:simit";
  assert.deepEqual(rules(lint(s)), ["deixis@4"], "pointing at the wrong thing");
  s = story(); line(s, 4).do = "point_far";
  assert.deepEqual(rules(lint(s)), ["deixis@4"], "şu points, point_far is o");
  s = story(); line(s, 4).tr = "Ekmek var. Bu ekmek çok taze."; line(s, 4).do = "hold_up";
  assert.deepEqual(lint(s), [], "bu with hold_up");
  s = story(); line(s, 4).tr = "Ekmek var. Bu ekmek çok taze."; line(s, 4).who = "nima"; line(s, 3).who = "ismail";
  line(s, 2).move = { who: "nima", to: "door" } as LineStep["move"];
  assert.ok(rules(lint(s)).includes("deixis@4"), "bu at a loaf 3.7 m away");
  s = story(); line(s, 4).tr = "Ekmek var. O ekmek çok taze.";
  assert.deepEqual(rules(lint(s), "warning"), ["deixis@4"], "o at a loaf within reach");
  // o as a pronoun, before no linked noun, is no demonstrative
  s = story(); line(s, 9).tr = "O çok taze."; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), []);
});

test("lint var/yok: the prop is shown or hidden by then; questions are not assertions", () => {
  let s = story(); delete line(s, 6).obj;
  const p = lint(s);
  assert.deepEqual(rules(p), ["var_yok@6"]);
  assert.deepEqual(p[0].fix, { obj: [{ id: "sut", op: "hide" }] });
  s = story(); line(s, 9).tr = "Süt yok, ekmek var."; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "after the hide, süt yok holds; ekmek var too");
  s = story(); line(s, 9).tr = "Süt var."; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), ["var_yok@9"]);
  s = story(); line(s, 9).tr = "Süt var mı?"; delete line(s, 9).do;
  assert.deepEqual(rules(lint(s)), [], "a question");
});

test("lint number: a number before a linked prop matches n", () => {
  let s = story();
  const ch = (s.steps[8] as { choice: { options: { n?: number; reply?: LineStep[] }[] } }).choice;
  ch.options[1].n = 3;
  assert.deepEqual(rules(lint(s)), ["number@8.1"]);
  s = story(); (s.steps[8] as typeof s.steps[8] & { choice: { options: { reply: LineStep[] }[] } }).choice.options[0].reply[0].tr = "Üç ekmek, buyrun!";
  assert.deepEqual(rules(lint(s)), ["number@8.0"], "the give's n is 2");
  s = story(); line(s, 4).tr = "Üç ekmek var. Şu ekmek çok taze.";
  assert.deepEqual(lint(s), [], "three loaves are on the counter");
  s = story(); line(s, 4).tr = "İki ekmek var. Şu ekmek çok taze.";
  assert.deepEqual(rules(lint(s)), ["number@4"]);
  s = story(); line(s, 4).tr = "Bir ekmek var. Şu ekmek çok taze.";
  assert.deepEqual(lint(s), [], "bir is also the article");
});

test("lint budget: one move each, two reactions, a word for the gesture and for `on`", () => {
  let s = story(); line(s, 4).react = { nima: "happy", ismail: "happy", kerim: "happy" };
  assert.deepEqual(rules(lint(s)), ["budget@4"]);
  s = story(); line(s, 2).move = [{ who: "nima", to: "customer", how: "enter" }, { who: "nima", to: "front" }];
  assert.deepEqual(rules(lint(s)), ["budget@2"]);
  s = story(); line(s, 6).on = "var";
  assert.deepEqual(rules(lint(s)), ["budget@6"]);
  s = story(); line(s, 9).do = "shrug";
  assert.deepEqual(rules(lint(s), "warning"), ["budget@9"], "a shrug at Başka bir şey?");
  s = story(); line(s, 9).do = "count";
  assert.deepEqual(rules(lint(s), "warning"), ["budget@9"], "counting with no number");
});

test("lint via: a phone line needs its speaker off stage", () => {
  let s = story(); line(s, 9).via = "phone";
  assert.deepEqual(rules(lint(s)), ["via@9"]);
  s = story(); s.cast.push("farzad");
  s.steps.splice(9, 0, { who: "farzad", tr: "Alo, Nima?", via: "phone" } as LineStep);
  assert.deepEqual(rules(lint(s)), []);
});

test("lint silent: only on the stand-in's '…'", () => {
  let s = story(); line(s, 9).voice = "silent";
  assert.deepEqual(rules(lint(s)), ["silent@9"]);
  s = story(); line(s, 10).tr = "Hayır.";
  assert.deepEqual(rules(lint(s)), ["silent@10"]);
  s = story(); delete line(s, 10).voice;
  assert.deepEqual(rules(lint(s), "warning"), ["silent@10"]);
});

test("lint time: a clock time said aloud matches the linked clock", () => {
  const s = story();
  s.props = { saat: { kit: "clock", at: { x: -3.5, y: 2.3, z: -2.1 }, time: "10:10" } } as StoryDoc["props"];
  line(s, 9).tr = "Saat on buçuk!"; delete line(s, 9).do;
  assert.deepEqual(lint(s), [], "not linked to the clock");
  line(s, 9).link = { saat: "obj:saat" };
  const p = lint(s);
  assert.deepEqual(rules(p), ["time@9"]);
  assert.deepEqual(p[0].fix, { obj: [{ id: "saat", op: "set", set: { time: "10:30" } }] });
  line(s, 9).obj = [{ id: "saat", op: "set", set: { time: "10:30" } }];
  assert.deepEqual(lint(s), [], "the hands move to the time said");
  line(s, 9).tr = "Saat ona on var!";
  assert.deepEqual(rules(lint(s)), ["time@9"]);
});

test("lint link, standin, mechanics", () => {
  let s = story(); line(s, 4).link = { simit: "obj:simit", ekmek: "obj:ekmek" };
  assert.deepEqual(rules(lint(s)), ["link@4"]);
  s = story(); s.steps.splice(4, 0, { who: "nima", tr: "Teşekkürler." } as LineStep);
  assert.deepEqual(rules(lint(s)), ["standin@4"], "two stand-in lines in a row");
  s = story(); s.steps.splice(3, 0, ...[1, 2, 3].map(() => ({ who: "ismail", tr: "Buyrun." } as LineStep)));
  assert.deepEqual(rules(lint(s)), ["standin@0"], "the learner's first turn is the fifth line");
  s = story(); s.arc!.mechanics = ["say", "explore"];
  assert.deepEqual(rules(lint(s)), ["mechanics@5"]);
});

test("suggest: links for words that name a prop, and the lints' fixes", () => {
  const s = story();
  delete line(s, 4).link; delete line(s, 4).do; delete line(s, 4).at; delete line(s, 6).link; delete line(s, 6).obj;
  const out = suggest(s, { places });
  const at = (step: number) => out.filter(x => x.step === step).map(x => x.fix);
  assert.deepEqual(at(4), [{ do: "point", at: "obj:ekmek" }, { link: { ekmek: "obj:ekmek" } }]);
  assert.deepEqual(at(6), [{ obj: [{ id: "sut", op: "hide" }] }, { link: { süt: "obj:sut" } }]);
  assert.deepEqual(suggest(story(), { places }), [], "the bakkal scene is fully staged");
});

// ---- story props per place (Kumru's STORIES_SCHEMA.md §3)

/** The bakkal scene, then the street outside with Nima's bag: a story prop in two places. */
const STREET: PlaceDoc = { v: 1, id: "sokak", size: { w: 6, d: 4 }, pieces: [], marks: { kapi: { x: -1, z: 0 }, yol: { x: 1, z: 0 } }, props: { simit: { kit: "simit", at: "yol" } } };
const two = () => {
  const s = story();
  s.props = { canta: { kit: "bag", n: 1, shown: false, terms: ["a1-w-canta"], at: { bakkal: "front", sokak: { x: 0.5, y: 0, z: 0.2 } } } };
  s.steps.push({ scene: "sokak", at: { nima: "kapi" } });
  return s;
};
const both = { ...places, sokak: STREET };

test("adapter: a story prop goes to every place its at names, with keep", () => {
  const { load } = adaptStory(two(), { places: both, characters });
  assert.deepEqual(load.places!.bakkal.props!.canta, { kit: "bag", n: 1, shown: false, terms: ["a1-w-canta"], at: "front", keep: true });
  assert.deepEqual(load.places!.sokak.props!.canta.at, { x: 0.5, y: 0, z: 0.2 });
  assert.equal(load.places!.sokak.props!.simit.keep, undefined, "a place's own prop is not kept");
  // a plain `at` still means the opening place
  const one = two(); one.props!.canta.at = "front";
  const l1 = adaptStory(one, { places: both, characters }).load;
  assert.ok(l1.places!.bakkal.props!.canta && !l1.places!.sokak.props!.canta);
});

test("lint: a scene in the same place keeps the props; a new place brings kept ones as they were", () => {
  // the milk hidden on step 6 stays hidden after a second scene in the bakkal: "Süt var" is an error
  const s = story();
  s.steps.splice(9, 0, { scene: "bakkal", at: { ismail: "counter", nima: "customer" } }, { who: "ismail", tr: "Süt var.", link: { süt: "obj:sut" } } as LineStep);
  assert.ok(lint(s).some(p => p.rule === "var_yok" && p.step === 10));
  // the bag shown in the bakkal is shown in the street
  const t = two();
  t.steps.splice(3, 0, { beat: { obj: [{ id: "canta", op: "show" }] } });
  t.steps.push({ who: "nima", tr: "Çanta yok!", link: { çanta: "obj:canta" } } as LineStep);
  assert.ok(lintStory(t, { places: both }).some(p => p.rule === "var_yok" && /canta is still shown/.test(p.message)));
});

test("lint: the number fix settles the lint, and take is the speaker's", () => {
  const s = story(); line(s, 4).tr = "İki ekmek var. Şu ekmek çok taze.";
  const [p] = lint(s);
  assert.deepEqual(p.fix, { obj: [{ id: "ekmek", op: "set", set: { n: 2 } }] });
  line(s, 4).obj = p.fix!.obj;
  assert.deepEqual(lint(s), []);
  // "Bu ekmek" in the hand of whoever took it is bu, even far from where it lay
  const t = story();
  t.steps.splice(9, 0, { who: "nima", tr: "Tamam.", obj: [{ id: "simit", op: "take" }] } as LineStep, { who: "nima", tr: "Bu simit.", do: "hold_up", at: "obj:simit", link: { simit: "obj:simit" } } as LineStep);
  const far = structuredClone(places); far.bakkal.props!.simit.at = { x: 3, y: 0.9, z: -1.5 };
  assert.ok(!lintStory(t, { places: far }).some(p => p.rule === "deixis"));
});

test("lint props: an unknown place, an unknown mark, a shadowed place prop", () => {
  const s = two();
  (s.props!.canta.at as Record<string, string>).ev = "kapi";
  (s.props!.canta.at as Record<string, string>).bakkal = "nowhere";
  s.props!.simit = { kit: "simit", at: { sokak: "yol" } };
  assert.deepEqual(lintStory(s, { places: both }).filter(p => p.rule === "props").map(p => p.message), [
    "prop canta stands on mark nowhere, which bakkal lacks",
    "prop canta stands in ev, which the story never visits",
    "prop simit shadows sokak's own simit: give the story's prop another id",
  ]);
});

test("lint link: an obj target not on stage", () => {
  const s = two();
  s.steps.push({ who: "nima", tr: "Süt yok.", do: "point", at: "obj:sut", link: { süt: "obj:sut" } } as LineStep);
  assert.deepEqual(lintStory(s, { places: both }).filter(p => p.rule === "link").map(p => p.message), ["obj:sut is not a prop on stage here"]);
});

// ---- looks: changes of clothes (Kumru's STORIES_SCHEMA.md §5.2) ------------------------------------

/** İsmail with two outfits: at home (no apron) and in a long coat. */
const dressed = (): Record<string, CharacterDoc> => {
  const c = structuredClone(characters);
  c.ismail.outfits = { home: { wear: { waist: null } }, coat: { outfit: { outer: "outer_coat_long" } } };
  return c;
};
const costumes = (cues: Cue[]) => cues.flatMap((c, k) => {
  const st = "scene" in c ? c.scene : "line" in c ? c.line : "beat" in c ? c.beat : null;
  return st?.costume ? [[k, st.costume] as const] : [];
});
/** The bakkal with looks: the story's, the scene's, and three lines'. */
const lookStory = (): StoryDoc => {
  const s = story();
  s.looks = { ismail: "coat" };
  (s.steps[0] as SceneStep).looks = { ismail: { wear: { eyes: "glasses_round" } } };
  line(s, 4).looks = { ismail: "home" };
  line(s, 6).looks = { ismail: { outfit: { outer: "outer_coat_long" } } };
  line(s, 9).looks = { ismail: "coat" };
  return s;
};

test("looks: default → story → scene → line, each kept until changed; a look changes only the slots it names", () => {
  const avatar = characters.ismail.avatar!;
  const a = adaptStory(lookStory(), { places, characters: dressed() });
  const w = a.load.wardrobe!.ismail;
  // the story's look dresses the cast document: the coat over his own clothes
  assert.equal(a.load.cast.ismail.outfit.outer!.id, "outer_coat_long");
  assert.deepEqual({ ...a.load.cast.ismail, outfit: { ...a.load.cast.ismail.outfit, outer: undefined } }, { ...avatar, outfit: { ...avatar.outfit, outer: undefined } });
  assert.deepEqual(Object.keys(w), ["look1", "home", "look2"]);
  // the scene's glasses go on over the coat, the apron stays
  assert.deepEqual([w.look1.outfit.outer!.id, w.look1.wear!.eyes!.id, w.look1.wear!.waist!.id], ["outer_coat_long", "glasses_round", "apron_shop"]);
  // "home" is his avatar without the apron: the coat and glasses were the story's and the scene's, not the outfit's
  assert.equal(w.home.outfit.outer, undefined);
  assert.deepEqual(w.home.wear, undefined);
  // a look on what he wears now: the coat goes back on, the apron stays off
  assert.deepEqual([w.look2.outfit.outer!.id, w.look2.wear], ["outer_coat_long", undefined]);
  // the cues: the scene, then lines 4, 6 and 9 (back to the cast document: ""); line 2 changes nothing
  assert.deepEqual(costumes(a.perform().script.cues), [[0, { ismail: "look1" }], [4, { ismail: "home" }], [7, { ismail: "look2" }], [11, { ismail: "" }]]);
});

test("looks: no look leaves the cast document itself and an empty wardrobe; a beat changes clothes too", () => {
  const c = dressed(), plain = adaptStory(story(), { places, characters: c });
  assert.equal(plain.load.cast.ismail, c.ismail.avatar);
  assert.deepEqual(plain.load.wardrobe, {});
  assert.deepEqual(costumes(plain.perform().script.cues), []);
  const s = story();
  s.steps.push({ beat: { who: "ismail", do: "nod", looks: { ismail: "home" } } } as BeatStep);
  const a = adaptStory(s, { places, characters: c });
  const cues = a.perform().script.cues;
  assert.deepEqual((cues.at(-1) as { beat: unknown }).beat, { do: "nod", costume: { ismail: "home" }, who: "ismail" });
  assert.equal(a.load.cast.ismail, c.ismail.avatar);
  // back to the avatar is the outfit "default" when the story's look dressed the cast
  const d = lookStory();
  line(d, 9).looks = { ismail: "default" };
  const b = adaptStory(d, { places, characters: dressed() });
  assert.deepEqual(costumes(b.perform().script.cues).at(-1), [11, { ismail: "default" }]);
  assert.deepEqual(b.load.wardrobe!.ismail.default, characters.ismail.avatar);
});

test("looks: a gated line's look follows the flags", () => {
  const s = story();
  line(s, 4).looks = { ismail: "home" };
  line(s, 4).if = "s1e00_x";
  assert.deepEqual(adaptStory(s, { places, characters: dressed() }).load.wardrobe, {});
  assert.deepEqual(Object.keys(adaptStory(s, { places, characters: dressed(), flags: ["s1e00_x"] }).load.wardrobe!.ismail), ["home"]);
});

test("looks: the learner keeps their own clothes: only a coat and a hat, never a hat over a head covering", () => {
  const c = dressed();
  c.nima.outfits = { out: { outfit: { outer: "outer_coat_long", top: "top_tee" }, wear: { hat: "hat_beanie" } } };
  const s = story();
  s.looks = { nima: "out" };
  line(s, 3).looks = { nima: { wear: { eyes: "glasses_round" } } };
  // Nima's own document: the coat and the hat, the shirt stays
  const own = adaptStory(s, { places, characters: c }).load;
  assert.deepEqual([own.cast.nima.outfit.outer!.id, own.cast.nima.wear!.hat!.id, own.cast.nima.outfit.top!.id], ["outer_coat_long", "hat_beanie", "top_shirt"]);
  // a learner in a headscarf: the coat, no hat
  const learner = { ...structuredClone(characters.nima.avatar!), wear: { head: { id: "headscarf_wrap" } } } as AvatarDoc;
  const a = adaptStory(s, { places, characters: c, learner });
  assert.deepEqual([a.load.cast.nima.outfit.outer!.id, a.load.cast.nima.wear, a.load.cast.nima.outfit.top], ["outer_coat_long", { head: { id: "headscarf_wrap" } }, learner.outfit.top]);
  // glasses are not the learner's to change: no costume, no wardrobe
  assert.deepEqual(a.load.wardrobe, {});
  assert.deepEqual(costumes(a.perform().script.cues), []);
  // a bare hat: off over the headscarf, on without one
  const t = story();
  line(t, 3).looks = { nima: { wear: { hat: "hat_beanie" } } };
  assert.deepEqual(adaptStory(t, { places, characters: c, learner }).load.wardrobe, {});
  assert.equal(adaptStory(t, { places, characters: c }).load.wardrobe!.nima.look1.wear!.hat!.id, "hat_beanie");
});

test("looks: every costume key of every branch is in the wardrobe", () => {
  const s = lookStory();
  (s.steps[10] as LineStep).looks = { nima: { outfit: { outer: "outer_coat_long" } } };
  const a = adaptStory(s, { places, characters: dressed() });
  const runs = [a.defaults, { ...a.defaults, ask: 1 }, { ...a.defaults, which_bread: "obj:simit" }];
  let n = 0;
  for (const picks of runs) for (const [, costume] of costumes(a.perform(picks).script.cues)) for (const [id, k] of Object.entries(costume)) {
    n++;
    assert.ok(k === "" || Object.hasOwn(a.load.wardrobe?.[id] ?? {}, k), `${id}: ${k}`);
  }
  for (const e of a.load.extra!) for (const [, costume] of costumes(e.cues)) for (const [id, k] of Object.entries(costume)) assert.ok(k === "" || Object.hasOwn(a.load.wardrobe![id], k));
  assert.equal(n, 15);
});

const lookLint = (s: StoryDoc, c = dressed()) => lintStory(s, { places, characters: c, kit }).filter(p => p.rule === "look");
const said = (ps: Problem[]) => ps.map(p => `${p.level[0]}@${p.step}${p.option !== undefined ? "." + p.option : ""}${p.reply !== undefined ? "." + p.reply : ""}: ${p.message}`);

test("lint look: the looks story is clean", () => {
  assert.deepEqual(lookLint(lookStory()), []);
  assert.deepEqual(lintStory(lookStory(), { places, characters: dressed(), kit }), []);
});

test("lint look: who changes, into which outfit", () => {
  const s = story();
  s.looks = { kerim: "home", farzad: "home" };
  line(s, 4).looks = { ismail: "beach" };
  assert.deepEqual(said(lookLint(s)), [
    "e@0: kerim is the narrator: the inset wears no looks",
    "e@0: farzad is not in the story (cast, extras or a scene's at)",
    "e@4: ismail has no outfit \"beach\" (default, home, coat)",
  ]);
  const c = dressed();
  delete (c as Partial<typeof c>).ismail;
  assert.deepEqual(said(lookLint(s, c)).slice(2), ["e@4: ismail has no character document"]);
});

test("lint look: clothing only, and no null where the kit's default would come back", () => {
  const s = story();
  line(s, 2).looks = { ismail: { hair: { style: "hair_short", color: "hair_01" }, outfit: { cape: "x" } } as unknown as Looks[string] };
  line(s, 4).looks = { ismail: { outfit: { top: null, shoes: null } } as unknown as Looks[string] };
  assert.deepEqual(said(lookLint(s)), [
    "e@2: ismail: not clothing: hair, outfit.cape (a look changes only outfit.*, wear.*, carry and hold)",
    "e@4: ismail: outfit.top: null puts the kit's default back; name another part",
    "e@4: ismail: outfit.shoes: null puts the kit's default back; name another part",
  ]);
});

test("lint look: only on the story, a scene, a line or a beat", () => {
  const s = story();
  const ch = s.steps[8] as ChoiceStep;
  (ch.choice.options[0] as { looks?: Looks }).looks = { ismail: "home" };
  (ch.choice.options[1].reply![1] as LineStep).looks = { ismail: "home" };
  ((s.steps[5] as ActStep).act as { looks?: Looks }).looks = { ismail: "home" };
  assert.deepEqual(said(lookLint(s)), [
    "e@5: looks inside an act: a change of clothes goes on the story, a scene, a line or a beat",
    "e@8.0: looks inside a choice option: a change of clothes goes on the story, a scene, a line or a beat",
    "e@8.1.1: looks inside a reply: a change of clothes goes on the story, a scene, a line or a beat",
  ]);
});

test("lint look: the kit draws every part, in its slot, for the body's build; outfits too", () => {
  const s = story();
  line(s, 2).looks = { ismail: { outfit: { outer: "outer_nope" } } };
  line(s, 4).looks = { ismail: { outfit: { outer: "hat_beanie" }, wear: { hat: "hat_bonnet" } } };
  const c = dressed();
  c.ismail.outfits!.default = { carry: "bag_tote" };
  c.ismail.outfits!.odd = { wear: { neck: "nope_scarf" } };
  assert.deepEqual(said(lookLint(s, c)), [
    "e@0: ismail's outfit \"default\": the name is reserved for the avatar itself",
    "e@0: ismail's outfit \"odd\": wear.neck: the kit has no part nope_scarf",
    "e@2: ismail: outfit.outer: the kit has no part outer_nope",
    "e@4: ismail: outfit.outer: hat_beanie belongs to another slot",
    "e@4: ismail: wear.hat: hat_bonnet is not made for this body's build",
  ]);
  // without the kit, only what the story itself says
  assert.deepEqual(lintStory(s, { places, characters: c }).filter(p => p.rule === "look").length, 1);
});

test("lint look: warnings for the learner's other slots and for a look that changes nothing", () => {
  const s = story();
  line(s, 3).looks = { nima: { outfit: { top: "top_tee", outer: "outer_coat_long" } } };
  (s.steps[0] as SceneStep).looks = { ismail: "default" };
  line(s, 4).looks = { ismail: "home" };
  line(s, 6).looks = { ismail: { wear: { waist: null } } };
  line(s, 9).looks = { nima: { wear: { eyes: "glasses_round" } } };
  assert.deepEqual(said(lookLint(s)), [
    "w@0: ismail's look changes nothing: they already wear it",
    "w@3: nima is the learner, in their own clothes: only outfit.outer and wear.hat apply, not outfit.top",
    "w@6: ismail's look changes nothing: they already wear it",
    "w@9: nima is the learner, in their own clothes: only outfit.outer and wear.hat apply, not wear.eyes",
  ]);
});
