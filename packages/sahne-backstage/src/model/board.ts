// A season as a board (ui/board.ts), pure: its weeks as rows, Monday to Saturday as columns (an episode on a weekday, a
// special on Saturday; no Sunday), each day with the episode released then. The rows run from the season's launch week
// (or its first episode's) to its last episode's week, plus one more to plan into. Moving an episode to a day gives its
// calendar row: the date, the kind the day takes and the week it falls in. A row's week is the one its episodes' calendar
// rows name (a series may skip a break week, so the n-th row need not be week n), else counted from the first row.

import type { CalendarRow, SeasonDoc } from "sahne-story";

export interface Day { date: string; kind: "episode" | "special"; episode?: string }
/** A row: its week (null for a break, a week with no episodes between two that have theirs), Monday, and six days. */
export interface Week { week: number | null; monday: string; days: Day[] }

const DAY = 864e5;
const toDate = (s: string) => new Date(`${s}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * DAY));
/** The Monday of a date's week. */
export const mondayOf = (s: string) => addDays(s, -((toDate(s).getUTCDay() + 6) % 7));
/** Whether a date is a Sunday (no release). */
export const isSunday = (s: string) => toDate(s).getUTCDay() === 0;

/** Every episode's date: the season's calendar where it has a row, else the story's own `releaseDate`. */
export function datesOf(season: SeasonDoc, episodes: { id: string; releaseDate?: string }[]): Record<string, string> {
  return Object.fromEntries(episodes.map(e => [e.id, season.calendar?.[e.id]?.date ?? e.releaseDate ?? ""]).filter(([, d]) => d));
}

/**
 * The board's weeks. `extra` weeks after the last episode's are added to plan into (at least one when it has none).
 * `weeks` gives an episode's week where the season's calendar has no row for it (the week of its arc, `s1w03` → 3).
 */
export function boardOf(season: SeasonDoc, dates: Record<string, string>, extra = 1, weeks: Record<string, number> = {}): Week[] {
  const named = (ids: string[]) => ids.map(id => season.calendar?.[id]?.week ?? weeks[id]).find((w): w is number => typeof w === "number");
  const all = Object.values(dates).filter(Boolean).sort();
  const start = mondayOf(season.launch ?? all[0] ?? iso(new Date()));
  const last = all.length ? mondayOf(all[all.length - 1]) : start;
  const n = Math.max(1, Math.round((toDate(last).getTime() - toDate(start).getTime()) / (7 * DAY)) + 1) + extra;
  const by = new Map<string, string>(Object.entries(dates).map(([id, d]) => [d, id]));
  const rows = Array.from({ length: n }, (_, i) => {
    const monday = addDays(start, i * 7);
    const days = Array.from({ length: 6 }, (_, k) => {
      const date = addDays(monday, k);
      return { date, kind: k === 5 ? "special" : "episode", ...(by.has(date) ? { episode: by.get(date)! } : {}) } as Day;
    });
    return { monday, days, named: named(days.flatMap(d => (d.episode ? [d.episode] : []))) };
  });
  let prev = 0;
  return rows.map((r, i) => {
    // an empty row: a break when the next named row takes up where the one before left off
    const next = rows.slice(i + 1).find(x => x.named !== undefined)?.named;
    const week = r.named ?? (next !== undefined && next <= prev + 1 ? null : prev + 1);
    if (week !== null) prev = week;
    return { week, monday: r.monday, days: r.days };
  });
}

/** The week a date falls in: its row's (null for a break, or a date off the board). */
export const weekOf = (weeks: Week[], date: string): number | null => weeks.find(w => w.monday === mondayOf(date))?.week ?? null;

/** An episode's calendar row on `date` (Saturday makes it a special, any other day an episode), or null in a break. */
export function rowOn(weeks: Week[], date: string): CalendarRow | null {
  const week = weekOf(weeks, date);
  return week === null ? null : { date, kind: toDate(date).getUTCDay() === 6 ? "special" : "episode", week };
}

/** The week an arc id names (`s1w03` → 3), or undefined. */
export const weekOfArc = (id: string | undefined) => { const m = /w(\d+)$/.exec(id ?? ""); return m ? Number(m[1]) : undefined; };

/** The arc id of a season's week. */
export const arcOfWeek = (n: number, week: number) => `s${n}w${String(week).padStart(2, "0")}`;
