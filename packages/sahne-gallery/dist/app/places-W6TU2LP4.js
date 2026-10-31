import "./chunk-PZ5AY32C.js";

// src/sections/places.ts
async function render(host, ctx) {
  const [id, check] = ctx.route.path;
  if (!id) return (await import("./board-5QJFXGKS.js")).render(host, ctx);
  if (check === "sheet" || check === "camera") return (await import("./checks-B5SNNBUE.js")).render(host, ctx, id, check);
  return (await import("./scout-AMONNWCE.js")).render(host, ctx, id);
}
export {
  render
};
//# sourceMappingURL=places-W6TU2LP4.js.map
