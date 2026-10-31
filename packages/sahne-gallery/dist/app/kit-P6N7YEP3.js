import "./chunk-PZ5AY32C.js";

// src/sections/kit.ts
async function render(host, ctx) {
  const [view = "set", id] = ctx.route.path;
  switch (view) {
    case "set":
      return id ? (await import("./piece-view-TZONIGME.js")).render(host, ctx, id) : (await import("./set-view-2OYHJ5GV.js")).render(host, ctx);
    case "people":
      return (await import("./people-WS5EJCC3.js")).render(host, ctx);
    case "gestures":
      return (await import("./gestures-V2X5GORT.js")).render(host, ctx);
    case "sound":
      return (await import("./sound-I2SZLTOH.js")).render(host, ctx);
    case "kerim":
      return (await import("./kerim-AEECAPOH.js")).render(host, ctx);
    case "animals":
      return (await import("./animals-KHI6CI22.js")).render(host, ctx);
  }
  host.textContent = `No kit view ${view}.`;
}
export {
  render
};
//# sourceMappingURL=kit-P6N7YEP3.js.map
