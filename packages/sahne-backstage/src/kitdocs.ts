// The content root's own kit items in the browser: the server serves the good documents (`GET /api/kit`, server/content.ts
// `kitDocs`), and they are added to the stage's kit (stage.ts `KIT`) in place, so the stage, the pickers and the kit page all see
// them. `own` holds their ids (the kit page's "This series" shelf); `kitVersion` changes whenever they are loaded again.

import { signal } from "@preact/signals";
import { withDrawings, type DrawingDoc, type VariantDoc } from "sahne-kit/drawing";
import full from "sahne-kit/full";
import { KIT } from "./stage.ts";

/** The ids of the set pieces and props the content root drew. */
export const own = new Set<string>();
/** Variants the content root added: `<generator>.<name>`. */
export const ownVariants = new Set<string>();
/** Changes at each load, so a page that lists the kit draws it again. */
export const kitVersion = signal(0);

/** Read the content root's kit items again and put them on the stage's kit (replacing the earlier ones). */
export async function loadKitDocs(): Promise<void> {
  try {
    const r = await fetch("/api/kit");
    if (!r.ok) return;
    const { docs, problems } = await r.json() as { docs: (DrawingDoc | VariantDoc)[]; problems: string[] };
    for (const p of problems) console.warn(`kit: ${p}`);
    const next = withDrawings(full, docs);
    // `full` is the base: the earlier items go with a fresh set and props, then the new ones come in
    Object.assign(KIT, { set: next.set, props: next.props });
    own.clear(); ownVariants.clear();
    for (const d of docs) { if ("of" in d) ownVariants.add(`${d.of}.${d.name}`); else own.add(d.id); }
  } catch (e) { console.warn(`the content root's kit items are not on the stage: ${(e as Error).message}`); }
  kitVersion.value++;
}
