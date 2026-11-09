// The gallery's sections and what their sidebar lists. Each section's view is its own chunk, loaded
// when it is first opened; the lists here are light (data files and the systems' registry), so the
// sidebar can show everything at once. The first four answer why and how (the home, what's new, how to
// start, the docs); the rest are the workshop's pages, folded under Explore (`explore`).

import type { Ctx } from "./shell/ctx.ts";
import { data } from "./shell/data.ts";
import { SYSTEMS } from "./systems/registry.ts";

export interface NavItem { label: string; hash: string; group?: string; note?: string; /** A picture before the label (a package's favicon). */ icon?: string }
export interface View { render(host: HTMLElement, ctx: Ctx): void | Promise<void> }
export interface Section { id: string; title: string; about: string; nav?: () => NavItem[] | Promise<NavItem[]>; load: () => Promise<View>; /** Folded under Explore in the sidebar. */ explore?: boolean }

export const SECTIONS: Section[] = [
  { id: "", title: "Home", about: "What Sahne is, why it exists and how it works", load: () => import("./sections/home.ts") },
  // these two are docs (guide/whats-new.md, guide/get-started.md) with a place of their own
  {
    id: "new", title: "What's new", about: "Each release, newest first: Backstage in 0.2 (and the optional quiz in 0.2.1), the first stage in 0.1",
    nav: () => RELEASES.map((r, i) => ({ label: i ? `Sahne ${r}` : `Sahne ${r} · latest`, hash: `#/new?at=sahne-${r.replace(".", "")}` })),
    load: () => import("./sections/docs.ts"),
  },
  { id: "get-started", title: "Get started", about: "Write episodes, put a stage in an app, or draw for the kit", load: () => import("./sections/docs.ts") },
  {
    id: "docs", title: "Docs", about: "Every package, the engine's design, the kit, the story format",
    nav: async () => (await data("docs")).filter(d => d.slug !== "new" && d.slug !== "get-started").map(d => ({ label: d.title, hash: `#/docs/${d.slug}`, group: d.group, ...(d.group === "Packages" ? { icon: `assets/brand/${d.title.split(":")[0]}-favicon.svg` } : {}) })),
    load: () => import("./sections/docs.ts"),
  },
  {
    id: "systems", title: "Systems", about: "The engine, one live demo per system", explore: true,
    nav: () => SYSTEMS.map(s => ({ label: s.title, hash: `#/systems/${s.id}`, group: s.group })),
    load: () => import("./systems/view.ts"),
  },
  {
    id: "kit", title: "Kit", about: "People, gestures, the set and props, sounds, Kerim", explore: true,
    nav: () => KIT_NAV,
    load: () => import("./sections/kit.ts"),
  },
  {
    id: "places", title: "Places", about: "Every story place: the board, each place scouted", explore: true,
    nav: async () => {
      const places = await data("places");
      const { BENCH_DOCS } = await import("./places/common.ts");
      return [{ label: "The board", hash: "#/places" }, ...places.map(p => ({ label: p.id, hash: `#/places/${p.id}`, group: "built" })), ...BENCH_DOCS.map(p => ({ label: p.id.replace(/^bench_/, ""), hash: `#/places/${p.id}`, group: "test benches" }))];
    },
    load: () => import("./sections/places.ts"),
  },
  {
    id: "stories", title: "Stories", about: "The stories played through the adapter", explore: true,
    nav: async () => (await data("drafts")).map(d => ({ label: d.id, hash: `#/stories/${d.id}`, note: d.fixture ? "test scene" : undefined })),
    load: () => import("./sections/stories.ts"),
  },
  {
    id: "cast", title: "Cast", about: "The stories' characters: the roster and the extras, at every framing", explore: true,
    nav: () => [{ label: "Roster", hash: "#/cast" }, { label: "Extras", hash: "#/cast/extras" }],
    load: () => import("./sections/cast.ts"),
  },
  { id: "dev", title: "For maintainers", about: "Engine coverage and the changes to review", load: () => import("./sections/dev.ts"), explore: true },
];

/** The releases guide/whats-new.md has a section for, newest first. */
export const RELEASES = ["0.2", "0.1"];

export const KIT_NAV: NavItem[] = [
  { label: "Set and props", hash: "#/kit/set" },
  { label: "People", hash: "#/kit/people" },
  { label: "Gestures and faces", hash: "#/kit/gestures" },
  { label: "Sounds and music", hash: "#/kit/sound" },
  { label: "Kerim", hash: "#/kit/kerim" },
  { label: "Animals", hash: "#/kit/animals" },
];
