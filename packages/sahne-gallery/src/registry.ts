// The gallery's sections and what their sidebar lists. Each section's view is its own chunk, loaded
// when it is first opened; the lists here are light (data files and the systems' registry), so the
// sidebar can show everything at once.

import type { Ctx } from "./shell/ctx.ts";
import { data } from "./shell/data.ts";
import { SYSTEMS } from "./systems/registry.ts";

export interface NavItem { label: string; hash: string; group?: string; note?: string }
export interface View { render(host: HTMLElement, ctx: Ctx): void | Promise<void> }
export interface Section { id: string; title: string; about: string; nav?: () => NavItem[] | Promise<NavItem[]>; load: () => Promise<View> }

export const SECTIONS: Section[] = [
  { id: "", title: "Home", about: "What Sahne is, a scene playing, what it does", load: () => import("./sections/home.ts") },
  {
    id: "docs", title: "Docs", about: "The guide, the engine's design, the kit, the story format",
    nav: async () => (await data("docs")).map(d => ({ label: d.title, hash: `#/docs/${d.slug}`, group: d.group })),
    load: () => import("./sections/docs.ts"),
  },
  {
    id: "systems", title: "Systems", about: "The engine, one live demo per system",
    nav: () => SYSTEMS.map(s => ({ label: s.title, hash: `#/systems/${s.id}`, group: s.group })),
    load: () => import("./systems/view.ts"),
  },
  {
    id: "kit", title: "Kit", about: "People, gestures, the set and props, sounds, Kerim",
    nav: () => KIT_NAV,
    load: () => import("./sections/kit.ts"),
  },
  {
    id: "places", title: "Places", about: "Every story place: the board, each place scouted",
    nav: async () => {
      const places = await data("places");
      const { BENCH_DOCS } = await import("./places/common.ts");
      return [{ label: "The board", hash: "#/places" }, ...places.map(p => ({ label: p.id, hash: `#/places/${p.id}`, group: "built" })), ...BENCH_DOCS.map(p => ({ label: p.id.replace(/^bench_/, ""), hash: `#/places/${p.id}`, group: "test benches" }))];
    },
    load: () => import("./sections/places.ts"),
  },
  {
    id: "stories", title: "Stories", about: "The stories played through the adapter",
    nav: async () => (await data("drafts")).map(d => ({ label: d.id, hash: `#/stories/${d.id}`, note: d.fixture ? "test scene" : undefined })),
    load: () => import("./sections/stories.ts"),
  },
  {
    id: "cast", title: "Cast", about: "The stories' characters: the roster and the extras, at every framing",
    nav: () => [{ label: "Roster", hash: "#/cast" }, { label: "Extras", hash: "#/cast/extras" }],
    load: () => import("./sections/cast.ts"),
  },
  { id: "dev", title: "For maintainers", about: "Engine coverage and the changes to review", load: () => import("./sections/dev.ts") },
];

export const KIT_NAV: NavItem[] = [
  { label: "Set and props", hash: "#/kit/set" },
  { label: "People", hash: "#/kit/people" },
  { label: "Gestures and faces", hash: "#/kit/gestures" },
  { label: "Sounds and music", hash: "#/kit/sound" },
  { label: "Kerim", hash: "#/kit/kerim" },
  { label: "Animals", hash: "#/kit/animals" },
];
