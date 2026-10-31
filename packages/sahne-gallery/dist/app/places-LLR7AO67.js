import "./chunk-PZ5AY32C.js";

// src/sections/places.ts
async function render(host, ctx) {
  const [id, check] = ctx.route.path;
  if (!id) return (await import("./board-6EWXZCW6.js")).render(host, ctx);
  if (check === "sheet" || check === "camera") return (await import("./checks-55WMCHAL.js")).render(host, ctx, id, check);
  return (await import("./scout-U4YAA7ZU.js")).render(host, ctx, id);
}
export {
  render
};
//# sourceMappingURL=places-LLR7AO67.js.map
