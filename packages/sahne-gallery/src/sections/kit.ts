// #/kit/<view>: the kit's set and props, people, gestures and faces, sounds and music, Kerim, and the animals.

import type { Ctx } from "../shell/ctx.ts";

export async function render(host: HTMLElement, ctx: Ctx) {
  const [view = "set", id] = ctx.route.path;
  switch (view) {
    case "set": return id ? (await import("../kit/piece-view.ts")).render(host, ctx, id) : (await import("../kit/set-view.ts")).render(host, ctx);
    case "people": return (await import("../kit/people.ts")).render(host, ctx);
    case "gestures": return (await import("../kit/gestures.ts")).render(host, ctx);
    case "sound": return (await import("../kit/sound.ts")).render(host, ctx);
    case "kerim": return (await import("../kit/kerim.ts")).render(host, ctx);
    case "animals": return (await import("../kit/animals.ts")).render(host, ctx);
  }
  host.textContent = `No kit view ${view}.`;
}
