import {
  solo
} from "./chunk-PRZYX3JM.js";
import {
  hashString
} from "./chunk-BLASJ6YA.js";

// src/shell/thumbs.ts
var W = 360;
var H = 240;
var DB = "sahne-gallery-thumbs";
var STORE = "thumbs";
var dbp = null;
function db() {
  return dbp ??= new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}
async function get(key) {
  const d = await db();
  if (!d) return void 0;
  return new Promise((res) => {
    const r = d.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(void 0);
  });
}
async function put(key, url) {
  const d = await db();
  d?.transaction(STORE, "readwrite").objectStore(STORE).put(url, key);
}
async function clearThumbs() {
  const d = await db();
  d?.transaction(STORE, "readwrite").objectStore(STORE).clear();
}
var keyOf = (gen, o) => `${gen.id}|${hashString(gen.def.draw.toString() + JSON.stringify(gen.meta ?? {}))}|${JSON.stringify(o)}`;
var queue = [];
var stage = null;
var host = null;
var busy = false;
var thumb = (ctx, gen, o) => snapshot(ctx, keyOf(gen, o), gen.id, () => solo(gen, o));
async function snapshot(ctx, key, label, scene) {
  const hit = await get(key);
  if (hit) return hit;
  return new Promise((done) => {
    queue.push({ key, label, scene, done });
    pump(ctx);
  });
}
function cancelThumbs() {
  for (const j of queue.splice(0)) j.done(null);
}
async function pump(ctx) {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    if (!stage) {
      host = Object.assign(document.createElement("div"), { ariaHidden: "true" });
      Object.assign(host.style, { position: "fixed", left: "0", bottom: "0", width: `${W}px`, height: `${H}px`, opacity: "0", pointerEvents: "none", zIndex: "-1" });
      document.body.append(host);
      const { mountStage } = await import("./src-U6EFLB7U.js");
      stage = mountStage(host, { kit: ctx.kit, bubbles: false, motion: "still", maxDpr: 1 });
    }
    let url = null;
    try {
      url = await bake(stage, job.scene());
    } catch (e) {
      console.warn(`thumb ${job.label}: ${e.message}`);
    }
    if (url) put(job.key, url);
    job.done(url);
  }
  busy = false;
}
function bake(st, { place, cues, cast }) {
  st.load({ v: 1, cues }, { cast, places: { [place.id]: place } });
  st.show(cues.length - 1);
  return new Promise((res) => {
    const timer = setTimeout(() => {
      off();
      res(null);
    }, 4e3);
    const off = st.onFrame(() => {
      off();
      clearTimeout(timer);
      res(host.querySelector("canvas").toDataURL("image/webp", 0.82));
    });
    st.poke();
  });
}

export {
  clearThumbs,
  thumb,
  snapshot,
  cancelThumbs
};
//# sourceMappingURL=chunk-C7IA2YNY.js.map
