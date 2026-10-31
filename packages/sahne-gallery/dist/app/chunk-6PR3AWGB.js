// src/shell/data.ts
var SOUNDS_URL = typeof document === "undefined" ? "dist/sounds/" : new URL("dist/sounds/", document.baseURI).href;
var cache = /* @__PURE__ */ new Map();
function data(name) {
  let p = cache.get(name);
  if (!p) {
    p = fetch(new URL(`data/${name}.json`, document.baseURI)).then(async (r) => {
      if (!r.ok) throw new Error(`/data/${name}.json: ${await r.text()}`);
      return r.json();
    });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p;
}
var doc = (slug) => {
  const name = `docs/${slug}`;
  let p = cache.get(name);
  if (!p) {
    p = fetch(new URL(`data/${name}.json`, document.baseURI)).then((r) => {
      if (!r.ok) throw new Error(`no doc ${slug}`);
      return r.json();
    });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p;
};

export {
  SOUNDS_URL,
  data,
  doc
};
//# sourceMappingURL=chunk-6PR3AWGB.js.map
