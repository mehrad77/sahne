import {
  data
} from "./chunk-6PR3AWGB.js";
import {
  puppets
} from "./chunk-GO2IY55S.js";
import {
  puppets as puppets2
} from "./chunk-3BCF3C4G.js";
import {
  src_default
} from "./chunk-ZT53KTYM.js";
import {
  full_default
} from "./chunk-MK75BOA5.js";

// src/shell/kit.ts
var KIT = { ...full_default, puppets: { ...full_default.puppets, ...puppets, ...puppets2 } };
var LANG = src_default;
async function addContentKit() {
  try {
    const docs = await data("kit");
    if (!docs.length) return;
    const { withDrawings } = await import("./drawing-6BXEH2ZC.js");
    Object.assign(KIT, withDrawings(KIT, docs));
  } catch (e) {
    console.warn(`the content root's kit items are not on the stage: ${e.message}`);
  }
}

export {
  KIT,
  LANG,
  addContentKit
};
//# sourceMappingURL=chunk-C3Y47KXC.js.map
