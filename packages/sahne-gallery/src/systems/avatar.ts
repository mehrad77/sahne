// Avatar documents (DESIGN.md §5.2, §5.3, §10): what `normalize` makes of a document from outside and
// the notes it leaves, hostile documents (each comes out null, as the silhouette, or as a safe
// document), the 2 KB cap and what goes first when a document is over it, trusted (the cast) against
// untrusted (another learner), `compose`'s own notes (hidden and clipped parts), and `applyLook`
// dressing a body. Each case shows its input beside its output, with a small portrait.

import { normalize, compose, applyLook, lookFields, portrait, serialize, isLegacyChar, AVATAR_MAX_BYTES, type AvatarDoc, type AvatarNote, type Look } from "sahne";
import { $, bar, chip, choice, slider } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { NIMA, ISMAIL } from "../bakkal.ts";

const KIT_ID = "sahne-kit@1";
const bytes = (x: unknown) => new TextEncoder().encode(JSON.stringify(x) ?? "").length;
const json = (x: unknown) => { try { return JSON.stringify(x, null, 1)?.replace(/\n\s*([\]}])/g, " $1").replace(/\n\s+/g, " ") ?? String(x); } catch { return "(cannot be written as JSON)"; } };

// ---- the documents --------------------------------------------------------------------------------
const MESSY = {
  v: 1, kit: KIT_ID,
  body: { build: "child", height: 3, shape: "pear" },
  skin: "skin_07",
  face: { shape: "oval", eyes: "laser", marks: ["freckles", "freckles", "mole", "dimples", "laugh_lines", "crows_feet", "vitiligo"] },
  hair: { style: "hair_mohawk", color: "hair_04" },
  outfit: { top: { id: "bottom_jeans" }, bottom: { id: "bottom_skirt_long" }, dress: { id: "dress_midi", colors: ["fab_10", "fab_12", "fab_99"] }, shoes: { id: "shoes_sneakers", colors: ["fab_01"] } },
  wear: { hands: { id: "ring_band" }, eyes: "glasses_round", ears: { id: "ear_stud", side: "left" } },
  motion: { tempo: 1.2 }, nickname: "not a field",
};
const GOOD = { v: 1, kit: KIT_ID, body: { build: "adult", height: 0.5, shape: "average" }, skin: "skin_05", face: {}, hair: { style: "hair_short", color: "hair_03" }, outfit: { top: { id: "top_tee", colors: ["fab_12"] } } };
const THROWS = { v: 1, kit: KIT_ID, get body(): unknown { throw new Error("a getter that throws"); } };
const HOSTILE: [string, unknown][] = [
  ["nothing (null)", null], ["a string", "hello"], ["an array", [1, 2, 3]], ["empty object", {}],
  ["Kumru's old char", { skin: 2, hair: 3, top: 1 }], ["another kit family", { ...GOOD, kit: "other-kit@2" }],
  ["hex skin with an attribute", { ...GOOD, skin: "#000\" onload=\"alert(1)" }],
  ["hex shirt colour", { ...GOOD, outfit: { top: { id: "top_tee", colors: ["#FF00FF"] } } }],
  ["part id __proto__", { ...GOOD, hair: { style: "__proto__", color: "hair_03" } }],
  ["part id with markup", { ...GOOD, outfit: { top: { id: "<img src=x onerror=alert(1)>" } } }],
  ["colors not an array", { ...GOOD, outfit: { top: { id: "top_tee", colors: "abc" } } }],
  ["height \"abc\"", { ...GOOD, body: { build: "adult", height: "abc", shape: "average" } }],
  ["50 KB of junk keys", { ...GOOD, ...Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`junk${i}`, "x".repeat(100)])) }],
  ["a getter that throws", THROWS],
];
/** Every optional slot worn, with patterns and inks: about as large as a learner's document gets. */
const g = (id: string, ...colors: string[]) => ({ id, colors });
const FULL: AvatarDoc = {
  v: 1, kit: KIT_ID, body: { build: "adult", height: 0.6, shape: "broad" }, skin: "skin_09",
  face: { shape: "long", eyes: "almond", brows: "thick", nose: "long", mouth: "full", eyeColor: "eye_green", marks: ["freckles", "mole", "dimples", "laugh_lines", "birthmark"] },
  hair: { style: "hair_curly", color: "hair_06" }, facialHair: { style: "beard_short", color: "hair_06" },
  outfit: { top: { ...g("top_shirt", "fab_05"), pattern: "pat_check", inks: ["fab_01", "fab_22"] }, bottom: { ...g("bottom_salvar", "fab_09", "fab_11"), pattern: "pat_floral", inks: ["fab_03", "fab_14"] }, outer: g("outer_coat_parka", "fab_17", "fab_02"), shoes: g("shoes_boots_ankle", "fab_20", "fab_01", "fab_04") },
  wear: { hat: g("hat_beanie", "fab_06", "fab_07"), eyes: g("glasses_rectangle", "fab_22", "fab_01"), ears: { ...g("ear_stud", "fab_23", "fab_24"), side: "l" }, aid: { ...g("ear_hearing_aid_bte", "fab_21", "fab_18"), side: "r" }, neck: { ...g("scarf_wool", "fab_15"), pattern: "pat_stripe_h", inks: ["fab_01", "fab_02"] }, wrist: { ...g("watch_classic", "fab_19", "fab_20"), side: "r" }, hands: g("ring_band", "fab_23"), waist: { ...g("apron_cafe", "fab_10", "fab_12"), pattern: "pat_gingham", inks: ["fab_05", "fab_06"] } },
  carry: { ...g("bag_tote", "fab_13", "fab_16"), pattern: "pat_dots", inks: ["fab_08", "fab_09"], side: "r" }, hold: { ...g("umbrella_closed", "fab_02", "fab_03"), side: "r" },
};
/** A cast member as the authors write one: hex colours, a part reserved for the cast, a custom part. */
const CAST = { ...ISMAIL, skin: "#B07A55", wear: { waist: g("apron_pockets", "#5B4636") }, custom: [g("apron_shop", "#3E5C76")] };
const COMPOSE: [string, unknown][] = [
  ["a headscarf hides the hair and the ears", { ...NIMA, hair: { style: "hair_long", color: "hair_05" }, wear: { head: g("headscarf_wrap", "fab_17", "fab_15"), ears: g("ear_drop", "fab_23") } }],
  ["a cap keeps only the hair below its line", { ...NIMA, hair: { style: "hair_afro", color: "hair_01" }, wear: { hat: g("cap_baseball", "fab_06", "fab_01"), hair: g("headband_band", "fab_10") } }],
  ["a bodysuit hides the bottom (a toddler)", { ...NIMA, body: { build: "toddler", height: 0.5, shape: "round" }, outfit: { top: g("top_bodysuit", "fab_14"), bottom: g("bottom_trousers", "fab_03"), shoes: g("shoes_velcro", "fab_11") } }],
  ["a turban replaces a hat (normalize)", { ...NIMA, wear: { head: g("turban_dastar", "fab_18"), hat: g("hat_beanie", "fab_06") } }],
];
const DRESSED: AvatarDoc = { ...NIMA, outfit: { ...NIMA.outfit, outer: g("outer_coat_long", "fab_08") }, wear: { eyes: g("glasses_round", "fab_22") } };
const LOOKS: Record<string, Look & Record<string, unknown>> = {
  "rainy day": { outfit: { shoes: g("shoes_boots_rain", "fab_12") }, hold: { id: "umbrella_closed", colors: ["fab_02"] }, wear: { neck: "scarf_wool" } },
  "indoors: coat and glasses off": { outfit: { outer: null }, wear: { eyes: null } },
  "a dress (hair and body ignored)": { outfit: { dress: g("dress_shalwar_kameez", "fab_16", "fab_09", "fab_01") }, hair: { style: "hair_bob", color: "hair_09" }, body: { build: "child", height: 0, shape: "slim" } },
  "school: bare part ids": { outfit: { top: "top_hoodie", outer: null }, carry: "bag_backpack", wear: { wrist: "watch_classic" } },
};

export function build(host: HTMLElement, ctx: Ctx) {
  const kit = ctx.kit;
  host.append(Object.assign($("style"), { textContent: ".av-pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;align-items:start}.av-pair .log{max-height:260px;margin:4px 0}.av-pic{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.av-pic figure{margin:0;display:grid;justify-items:center;font-size:12px}.av-pic svg{background:#EDE6DA;border-radius:8px}.av-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}" }));
  const pic = (doc: unknown, caption: string, o: Parameters<typeof portrait>[2] = {}) => {
    const f = $("figure"), box = $("div");
    box.innerHTML = portrait(doc, kit, { framing: "bust", size: 96, ...o });
    f.append(box, caption);
    return f;
  };
  const pics = (...f: HTMLElement[]) => { const d = $("div", "av-pic"); d.append(...f); return d; };
  const why: Record<AvatarNote["why"], "" | "bad" | "warn"> = { unknown: "bad", slot: "bad", build: "warn", size: "warn", replaced: "", hidden: "", clipped: "" };
  const notesOf = (ns: AvatarNote[]) => {
    const d = $("div", "bar");
    d.append(...(ns.length ? ns.map(n => chip(`${n.why} · ${n.field}${n.id ? ` · ${n.id}` : ""}${n.by ? ` by ${n.by}` : ""}`, why[n.why])) : [chip("no notes", "ok")]));
    return d;
  };
  /** One column: a title, the JSON with its size, notes and pictures. */
  const col = (title: string, x: unknown, ...more: Node[]) => {
    const c = $("div");
    c.append($("b", "", `${title} `), chip(x === null ? "null" : `${bytes(x)} bytes`, x === null ? "bad" : ""), Object.assign($("pre", "log"), { textContent: json(x) }), ...more);
    return c;
  };
  const pair = (...cols: HTMLElement[]) => { const d = $("div", "av-pair"); d.append(...cols); return d; };
  const swap = (slot: HTMLElement) => (el: HTMLElement) => slot.replaceChildren(el);

  // ---- normalize and its notes ----
  host.append($("h2", "", "normalize: a document from outside, made safe"), $("p", "note", "Every id is looked up in the kit (after its aliases), every colour in a palette; numbers are clamped and unknown feature values defaulted. A part that is unknown, in the wrong slot or not made for the build is refused, and a dress replaces the top and bottom; each refusal is a note the builder can explain. A value that was only defaulted (the eyes, the shape) is not noted. Fields that are not the avatar's (motion, a nickname) are not kept. Running normalize on its own output changes nothing."));
  const nSlot = $("div");
  const showN = (input: unknown) => {
    const notes: AvatarNote[] = [], out = normalize(input, kit, { notes }), again = out && normalize(out, kit);
    swap(nSlot)(pair(col("in", input), col("out", out, notesOf(notes), bar("", chip(isLegacyChar(input) ? "isLegacyChar: yes" : "isLegacyChar: no"), chip(again && serialize(again) === serialize(out!) ? "normalize(out) is the same" : out ? "not idempotent!" : "out is null", again || !out ? "ok" : "bad"))), pics(pic(out, out ? "the output" : "null: the silhouette"))));
  };
  host.append(choice("in", ["a learner's messy document", "Nima, as written", "Kumru's old char"], "a learner's messy document", o => showN(o === "Nima, as written" ? NIMA : o === "Kumru's old char" ? { skin: 2, hair: 3, hairC: 1, top: 1 } : MESSY)), nSlot);
  showN(MESSY);

  // ---- hostile documents ----
  host.append($("h2", "", "Hostile documents"), $("p", "note", "Data from other learners, drawn by every viewer. normalize never throws: what is not a v:1 document of this kit family is null and draws as the paper silhouette; markup, __proto__ and hex in a learner's document never reach the drawing (hex falls back to the default colour); 50 KB of junk keys come out a few hundred bytes. The emotion __proto__ is refused by portrait too."));
  const tiles = $("div", "av-tiles");
  for (const [label, doc] of HOSTILE) {
    const notes: AvatarNote[] = [], out = normalize(doc, kit, { notes });
    const t = $("figure", "tile");
    t.append(pic(doc, "", { size: 72 }), $("figcaption", "", `${label}: ${out ? `${bytes(out)} B, ${notes.length} note(s)${notes.length ? ` (${notes.map(n => n.why).join(", ")})` : ""}` : "null → silhouette"}`));
    tiles.append(t);
  }
  const t = $("figure", "tile");
  t.append(pic(GOOD, "", { size: 72, emotion: "__proto__" }), $("figcaption", "", "emotion \"__proto__\": a calm face"));
  tiles.append(t);
  host.append(tiles);

  // ---- the 2 KB cap ----
  host.append($("h2", "", `The 2 KB cap (AVATAR_MAX_BYTES = ${AVATAR_MAX_BYTES})`), $("p", "note", "A document is stored as the learner's char and sent to every friend, so it is at most 2 KB of JSON. Over the limit, optional parts are left out, least missed first: the bag, the hands, wrist, neck, ears, hairwear, waist, the coat, the hat, marks, glasses, facial hair, the head covering, the held cane, the hearing aid, and last a cast member's custom parts (a size note each). A host may only make it stricter: maxBytes above 2048 is held at 2048. Here every optional slot is worn, with patterns and inks: about 1.5 KB, so it fits in 2 KB as it is; the slider starts at a stricter host's 1000 bytes to show what goes first."));
  const capSlot = $("div");
  const showCap = (max: number) => {
    const notes: AvatarNote[] = [], out = normalize(FULL, kit, { notes, maxBytes: max });
    swap(capSlot)(pair(col("in (every slot worn)", FULL, pics(pic(FULL, "in", { framing: "full", size: 120 }))), col(`out, maxBytes ${max}`, out, notesOf(notes), pics(pic(out, out ? "out" : "null: not even the required parts fit", { framing: "full", size: 120 })))));
  };
  host.append(slider("maxBytes", 400, 3000, 50, 1000, showCap), capSlot);
  showCap(1000);

  // ---- trusted and untrusted ----
  host.append($("h2", "", "Trusted (the cast) and untrusted (another learner)"), $("p", "note", "The app's own cast documents are trusted: hex colours, parts tagged cast (İsmail's pocketed apron) and up to two custom parts are kept. The same document from another learner (the default, in normalize, compose, portrait, the stage) keeps only palette colours and learner parts: the hex skin and moustache fall back to the defaults, the cast apron is refused, custom parts are dropped."));
  const tn: AvatarNote[] = [], un: AvatarNote[] = [], tr = normalize(CAST, kit, { trusted: true, notes: tn }), un0 = normalize(CAST, kit, { notes: un });
  host.append(pair(col("in (a cast document)", CAST), col("trusted: true", tr, notesOf(tn), pics(pic(CAST, "trusted", { trusted: true }))), col("untrusted (the default)", un0, notesOf(un), pics(pic(CAST, "untrusted")))));

  // ---- compose's notes ----
  host.append($("h2", "", "compose: hidden and clipped parts"), $("p", "note", "compose runs normalize, then the slot rules from the parts' own metadata: a part whose slot another hides is not drawn (hidden), a part another clips is cut to its region (clipped: the cap keeps the hair below its line). Its notes add these to normalize's. They are what the builder explains (\"the headscarf hides the hair\")."));
  const cSlot = $("div");
  const showC = (i: number) => {
    const [, doc] = COMPOSE[i], p = compose(doc as AvatarDoc, kit, { trusted: true });
    swap(cSlot)(pair(col("in", doc), col("compose(doc).notes", p.notes, notesOf(p.notes), pics(pic(doc, "front", { trusted: true }), pic(doc, "back", { trusted: true, view: "back" })))));
  };
  host.append(choice("case", COMPOSE.map(c => c[0]), COMPOSE[0][0], o => showC(COMPOSE.findIndex(c => c[0] === o))), cSlot);
  showC(0);

  // ---- applyLook ----
  host.append($("h2", "", "applyLook: a change of clothes over a fixed body"), $("p", "note", "A look names only clothing fields (every outfit and wear slot, carry, hold). Only the slots it names change; a bare string is a part id; null takes a slot off; hair, body and skin are ignored (lookFields lists them). The result goes through normalize like any document. A story's wardrobe is dressed this way before the stage sees it (§5.6 costume)."));
  const lSlot = $("div");
  const showL = (name: string) => {
    const look = LOOKS[name], { other } = lookFields(look), out = applyLook(DRESSED, look), notes: AvatarNote[] = [], n = normalize(out, kit, { notes });
    swap(lSlot)(pair(
      col("the body (Nima in a coat)", DRESSED, pics(pic(DRESSED, "before", { framing: "full", size: 130 }))),
      col("the look", look, bar("", ...(other.length ? other.map(o => chip(`ignored: ${o}`, "warn")) : [chip("only clothing fields", "ok")]))),
      col("normalize(applyLook(body, look))", n, notesOf(notes), pics(pic(n, "after", { framing: "full", size: 130 })))));
  };
  host.append(choice("look", Object.keys(LOOKS), "rainy day", showL), lSlot);
  showL("rainy day");
}
