// What changed, newest first, for review: each visual step adds an entry. An entry holds no demo of its own: its
// links open the gallery's permanent views, set up to show the change (`#/kit/set/road?variant=coast&time=dusk`),
// and `check` says what to look at.

export interface Change { date: string; step: string; title: string; check: string[]; links: [string, string][] }

export const CHANGES: Change[] = [
  {
    date: "2026-10-27", step: "repo", title: "Sahne in a repo of its own",
    check: [
      "#/stories/s1e00: the sample story plays from sahne-story/samples/ (Nima on the metro, then oranges at İsmail's bakkal); set SAHNE_CONTENT to play another content root's stories.",
      "#/places: the two sample places, bakkal and metro_m11, with their sheets and camera checks.",
      "#/kit/kerim: her art and her CSS now both come from the kit (sahne-kit/kerim.css).",
    ],
    links: [["the sample story", "#/stories/s1e00"], ["the places", "#/places"], ["Kerim", "#/kit/kerim"]],
  },
];
