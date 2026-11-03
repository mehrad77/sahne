// A new document's id from its name, pure: "Elif" → `elif`, "Kırlangıç Ana" → `kirlangic_ana`. Ids are permanent and
// `^[a-z][a-z0-9_]*$`; one that is taken (or retired) gets a number (`elif_2`). A name with no Latin letters (Persian)
// gives none, and the writer types one.

export const ID = /^[a-z][a-z0-9_]*$/;

/** The id a name suggests, free of `taken`; "" when the name has no letter to make one of. */
export function idFrom(name: string, taken: (id: string) => boolean): string {
  const base = name.normalize("NFD").replace(/\p{M}/gu, "").replace(/ı/g, "i").replace(/ß/g, "ss").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^[^a-z]+|_+$/g, "").slice(0, 32).replace(/_+$/, "");
  if (!base) return "";
  if (!taken(base)) return base;
  for (let n = 2; ; n++) if (!taken(`${base}_${n}`)) return `${base}_${n}`;
}

/** What is wrong with an id typed by hand, or null. */
export function idProblem(id: string, taken: (id: string) => boolean, retired: (id: string) => boolean): string | null {
  if (!id) return "an id is needed";
  if (!ID.test(id)) return "a-z, 0-9 and _, starting with a letter";
  if (retired(id)) return "a retired id: pick another";
  if (taken(id)) return "taken";
  return null;
}
