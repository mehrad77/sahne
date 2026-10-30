// The kit every gallery stage plays with: the whole kit (every set family, `sahne-kit/full`),
// Kerim's puppet and the animals' (Pisi, the gulls), with the Turkish plugin.

import type { Kit } from "sahne";
import full from "sahne-kit/full";
import { puppets as kerim } from "sahne-kit/kerim";
import { puppets as animals } from "sahne-kit/puppets";
import tr from "sahne-tr";

export const KIT: Kit = { ...full, puppets: { ...full.puppets, ...kerim, ...animals } };
export const LANG = tr;
