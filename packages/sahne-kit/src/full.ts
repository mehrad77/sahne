// The kit with every set piece and prop (`sahne-kit/full`): for the gallery, the tests and the lints.
// An app takes `sahne-kit` and loads the families its places use from `sahne-kit/set`.

import type { Kit } from "sahne";
import kit from "./index.ts";
import { SET, PROPS } from "./set/all.ts";

export * from "./index.ts";
const full: Kit = { ...kit, set: SET, props: PROPS };
export default full;
