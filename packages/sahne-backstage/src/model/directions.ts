// A step's stage directions in plain words (pure; the episode page's Script stage shows them under each line, and its
// next step and notes speak the same way). The file's words stay in the file: `do: "nod"` is "nods", `to: "ismail"` is
// "says it to İsmail", `cam: "two"` is "camera: two people". Each direction keeps its key, so a chip can clear it.

import type { Staging } from "sahne";

export interface Direction { key: string; label: string }

const CAMERA: Record<string, string> = { wide: "wide", two: "two people", single: "one person", close: "close", ots: "over the shoulder", obj: "on the thing", follow: "following", split: "split", photo: "a photo" };

/** A gesture's id as a verb: `nod` "nods", `look_around` "looks around", `hand_over` "hands over". */
export function verb(id: string): string {
  const [head, ...rest] = id.split("_");
  const s = /(s|sh|ch|x|z)$/.test(head) ? `${head}es` : /[^aeiou]y$/.test(head) ? `${head.slice(0, -1)}ies` : `${head}s`;
  return [s, ...rest].join(" ");
}

/** What a target is called: a character by name, a prop by its id in words, a mark as it is. */
const targetName = (t: string, name: (id: string) => string) =>
  t.startsWith("ch:") ? name(t.slice(3).split(".")[0]) : t.startsWith("obj:") ? `the ${t.slice(4).replace(/_/g, " ")}` : t.startsWith("mark:") ? t.slice(5).replace(/_/g, " ") : name(t);

/** A step's staging as directions in plain words, in the order a reader takes them in. */
export function directionsOf(st: Partial<Staging> & Record<string, unknown>, name: (id: string) => string): Direction[] {
  const out: Direction[] = [];
  if (st.do) out.push({ key: "do", label: verb(String(st.do)) });
  if (st.emo) out.push({ key: "emo", label: String(st.emo) });
  if (st.at) out.push({ key: "at", label: `looks at ${targetName(String(st.at), name)}` });
  if (st.to) out.push({ key: "to", label: st.to === "viewer" ? "says it to us" : `says it to ${name(String(st.to))}` });
  for (const mv of [st.move ?? []].flat() as { who?: string; to?: string; how?: string }[]) {
    const who = mv.who ? name(mv.who) : "";
    out.push({ key: "move", label: mv.how === "enter" ? `${who} comes in${mv.to ? `, to ${mv.to.replace(/_/g, " ")}` : ""}` : mv.how === "exit" ? `${who} leaves` : `${who ? `${who} ` : ""}walks${mv.to ? ` to ${mv.to.replace(/_/g, " ")}` : ""}` });
  }
  for (const op of (st.obj ?? []) as { id: string; op: string; to?: string; n?: number }[]) out.push({ key: "obj", label: `${verb(op.op)} ${op.to ? `${name(op.to)} ` : ""}${op.n && op.n > 1 ? `${op.n} ` : "the "}${op.id.replace(/_/g, " ")}` });
  if (st.react) for (const [who, r] of Object.entries(st.react as Record<string, unknown>)) {
    const x = r as { do?: string; emo?: string } | string;
    out.push({ key: "react", label: `${name(who)} ${typeof x === "string" ? x : x.do ? verb(x.do) : x.emo ?? "reacts"} too` });
  }
  if (st.link) for (const [w, t] of Object.entries(st.link as Record<string, string>)) out.push({ key: "link", label: `times “${w}” to ${targetName(t, name)}` });
  if (st.cam) out.push({ key: "cam", label: `camera: ${CAMERA[String(st.cam)] ?? st.cam}` });
  if (st.sfx) out.push({ key: "sfx", label: `sound: ${[st.sfx].flat().map(x => (typeof x === "string" ? x : (x as { id?: string }).id)).join(", ")}` });
  if (st.via) out.push({ key: "via", label: `on the ${st.via}` });
  if (st.voice === "whisper") out.push({ key: "voice", label: "whispers" });
  else if (st.voice === "silent") out.push({ key: "voice", label: "says nothing" });
  else if (st.voice === "mouthing") out.push({ key: "voice", label: "mouths it" });
  return out;
}
