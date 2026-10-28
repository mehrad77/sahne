// A series started on a content root that has stories already: its series.json and, so the story check can pass, a
// season document for every season its stories use, each with the arcs those stories carry (the first story of an arc
// gives its words) and no calendar (the dates stay where they are until a calendar is started). Pure.

import type { SeasonDoc, SeriesDoc, StoryDoc } from "sahne-story";

export function startSeries(id: string, stories: StoryDoc[], o: { narrator: string; standin: string }): { series: SeriesDoc; seasons: SeasonDoc[] } {
  const series: SeriesDoc = { v: 1, id, title: id, titleEn: id, titleFa: id, narrator: o.narrator, standin: o.standin };
  const by = new Map<number, StoryDoc[]>();
  for (const s of [...stories].sort((a, b) => a.id.localeCompare(b.id))) {
    const n = Number(/^s([1-9][0-9]?)e/.exec(s.id)?.[1] ?? 0);
    if (n) by.set(n, [...(by.get(n) ?? []), s]);
  }
  const seasons = [...by].sort(([a], [b]) => a - b).map(([n, list]): SeasonDoc => {
    const arcs: NonNullable<SeasonDoc["arcs"]> = {};
    for (const s of list) if (s.arc && !arcs[s.arc.id]) { const { id: _id, ...rest } = s.arc; arcs[s.arc.id] = rest as NonNullable<SeasonDoc["arcs"]>[string]; }
    return { v: 1, id: `s${n}`, n, title: `${n}. sezon`, titleEn: `Season ${n}`, titleFa: `فصل ${n}`, ...(Object.keys(arcs).length ? { arcs } : {}) };
  });
  return { series, seasons };
}
