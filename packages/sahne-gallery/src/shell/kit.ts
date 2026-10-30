// The kit every gallery stage plays with: the whole kit (every set family, `sahne-kit/full`),
// Kerim's puppet and the animals' (Pisi, the gulls), with the Turkish plugin.

import type { Kit, LangPlugin } from "sahne";
import full from "sahne-kit/full";
import { puppets as kerim } from "sahne-kit/kerim";
import { puppets as animals } from "sahne-kit/puppets";
import en from "sahne-en";
import tr from "sahne-tr";

export const KIT: Kit = { ...full, puppets: { ...full.puppets, ...kerim, ...animals } };
export const LANG = tr;
/** The plugin of a series' main language (Turkish for a language with none), for a stage that plays another series. */
export const pluginFor = (main?: string): LangPlugin => ({ tr, en } as Record<string, LangPlugin>)[main ?? "tr"] ?? tr;
