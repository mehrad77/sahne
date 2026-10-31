import "./chunk-PZ5AY32C.js";

// src/sections/places.ts
async function render(host, ctx) {
  const [id, check] = ctx.route.path;
  if (!id) return (await import("./board-3XUTHUP7.js")).render(host, ctx);
  if (check === "sheet" || check === "camera") return (await import("./checks-7ECMWR4K.js")).render(host, ctx, id, check);
  return (await import("./scout-ZAAJCPT5.js")).render(host, ctx, id);
}
export {
  render
};
//# sourceMappingURL=places-YYBFWCE7.js.map
