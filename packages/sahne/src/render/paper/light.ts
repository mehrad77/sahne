// Time of day (DESIGN.md §6.5): the light changes, the art never does.

import { hexToRgb, type RGB } from "../../core/color.ts";

export interface LightState {
  skyTop: RGB; skyBottom: RGB;
  amb: RGB; key: RGB;
  haze: RGB; hazeDensity: number;
  /** How strongly lit windows and bulbs glow (0 by day). */
  glow: number;
  /** Multiplier for the place's practical lights (lamps). */
  practical: number;
  /** Opacity of contact and drop shadows. */
  shadow: number;
  grain: number;
}

const L = (s: { skyTop: string; skyBottom: string; amb: string; ambK: number; key: string; keyK: number; haze: string; hazeDensity: number; glow: number; practical: number; shadow: number; grain?: number }): LightState => ({
  skyTop: hexToRgb(s.skyTop), skyBottom: hexToRgb(s.skyBottom),
  amb: hexToRgb(s.amb).map(v => v * s.ambK) as RGB, key: hexToRgb(s.key).map(v => v * s.keyK) as RGB,
  haze: hexToRgb(s.haze), hazeDensity: s.hazeDensity, glow: s.glow, practical: s.practical, shadow: s.shadow, grain: s.grain ?? 0.07,
});

export const TIMES: Record<string, LightState> = {
  // before sunrise: a cool sky warming at the horizon, a low key, the lamps and windows still lit
  dawn: L({ skyTop: "#6E76A8", skyBottom: "#F0B9B4", amb: "#9C9CC0", ambK: 0.6, key: "#FFC9B0", keyK: 0.25, haze: "#C8B4C4", hazeDensity: 0.028, glow: 0.55, practical: 0.8, shadow: 0.7 }),
  day: L({ skyTop: "#8CC8EE", skyBottom: "#E4F1F4", amb: "#D7DEE8", ambK: 0.6, key: "#FFF3DF", keyK: 0.46, haze: "#DCE8EE", hazeDensity: 0.012, glow: 0, practical: 0.12, shadow: 1, grain: 0.06 }),
  golden: L({ skyTop: "#E99B6A", skyBottom: "#FBD7A2", amb: "#B79FB4", ambK: 0.58, key: "#FFC889", keyK: 0.6, haze: "#F2C59B", hazeDensity: 0.02, glow: 0.25, practical: 0.45, shadow: 0.95 }),
  dusk: L({ skyTop: "#33406E", skyBottom: "#E2876C", amb: "#7177A6", ambK: 0.62, key: "#FF9C7C", keyK: 0.22, haze: "#8B7EA3", hazeDensity: 0.03, glow: 0.75, practical: 0.9, shadow: 0.75 }),
  night: L({ skyTop: "#0D1430", skyBottom: "#26325C", amb: "#4C5A8E", ambK: 0.62, key: "#7E92D0", keyK: 0.1, haze: "#1D2646", hazeDensity: 0.035, glow: 1, practical: 1.25, shadow: 0.6, grain: 0.08 }),
  overcast: L({ skyTop: "#AAB4BE", skyBottom: "#D9DEE2", amb: "#D3D8DE", ambK: 0.78, key: "#F2F2F0", keyK: 0.2, haze: "#C9D0D6", hazeDensity: 0.02, glow: 0.05, practical: 0.3, shadow: 0.55 }),
};

const mixRgb = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mixN = (a: number, b: number, t: number) => a + (b - a) * t;

export function blendLight(a: LightState, b: LightState, t: number): LightState {
  return {
    skyTop: mixRgb(a.skyTop, b.skyTop, t), skyBottom: mixRgb(a.skyBottom, b.skyBottom, t),
    amb: mixRgb(a.amb, b.amb, t), key: mixRgb(a.key, b.key, t), haze: mixRgb(a.haze, b.haze, t),
    hazeDensity: mixN(a.hazeDensity, b.hazeDensity, t), glow: mixN(a.glow, b.glow, t),
    practical: mixN(a.practical, b.practical, t), shadow: mixN(a.shadow, b.shadow, t), grain: mixN(a.grain, b.grain, t),
  };
}

/**
 * Weather over the time of day (DESIGN.md §6.5): the sky pulls towards grey, the sun (the key) weakens,
 * shadows soften and the haze thickens; rain also lights the lamps a little and has its own ambience bed.
 * `clear` changes nothing.
 */
export interface WeatherMod { sky: RGB; skyK: number; key: number; amb: number; haze: RGB; hazeAdd: number; shadow: number; glow: number; practical: number; /** How much of the sky (stars, the moon) the cloud hides, 0…1. */ cloud: number; bed?: string }

const W = (s: { sky: string; skyK: number; key: number; amb: number; haze: string; hazeAdd: number; shadow: number; glow?: number; practical?: number; cloud?: number; bed?: string }): WeatherMod =>
  ({ ...s, sky: hexToRgb(s.sky), haze: hexToRgb(s.haze), glow: s.glow ?? 0, practical: s.practical ?? 0, cloud: s.cloud ?? 0 });

export const WEATHER: Record<string, WeatherMod> = {
  clear: W({ sky: "#FFFFFF", skyK: 0, key: 1, amb: 1, haze: "#FFFFFF", hazeAdd: 0, shadow: 1 }),
  grey: W({ sky: "#A9B2BC", skyK: 0.7, key: 0.45, amb: 1.05, haze: "#C6CDD3", hazeAdd: 0.012, shadow: 0.55, glow: 0.05, cloud: 0.9 }),
  rain: W({ sky: "#7F8A96", skyK: 0.85, key: 0.3, amb: 0.85, haze: "#8C97A3", hazeAdd: 0.03, shadow: 0.4, glow: 0.15, practical: 0.2, cloud: 1, bed: "rain" }),
};

/** How much the cloud hides the sky as the weather blends from `from` to `to` by `k`. */
export function cloudAt(w: { from: string; to: string; k: number }): number {
  const c = (x: string) => (WEATHER[x] ?? WEATHER.clear).cloud;
  return c(w.from) + (c(w.to) - c(w.from)) * w.k;
}

/** How brightly a flat's glow shows at the time's glow `glow`: all of it without `glowAt`, else coming on from `glowAt` over the next 0.12 (`FlatSpec.glowAt`). */
export function glowWeight(glowAt: number | undefined, glow: number): number {
  if (glowAt === undefined) return 1;
  const u = Math.min(1, Math.max(0, (glow - glowAt) / 0.12));
  return u * u * (3 - 2 * u);
}

/** The light under a weather: `l` with `w`'s changes (an unknown weather is clear). */
export function withWeather(l: LightState, w: string | undefined): LightState {
  const m = WEATHER[w ?? "clear"] ?? WEATHER.clear;
  return {
    ...l, skyTop: mixRgb(l.skyTop, m.sky, m.skyK), skyBottom: mixRgb(l.skyBottom, m.sky, m.skyK),
    key: l.key.map(v => v * m.key) as RGB, amb: l.amb.map(v => v * m.amb) as RGB,
    haze: mixRgb(l.haze, m.haze, m.skyK), hazeDensity: l.hazeDensity + m.hazeAdd,
    shadow: l.shadow * m.shadow, glow: Math.min(1, l.glow + m.glow), practical: l.practical + m.practical,
  };
}

/** A flash of lightning, 0…1 `k`: the sky and the ambient light brighten by up to a third. */
export function withFlash(l: LightState, k: number): LightState {
  if (k <= 0) return l;
  const up = (c: RGB, a: number) => c.map(v => v + (1 - v) * a * k) as RGB;
  return { ...l, skyTop: up(l.skyTop, 0.3), skyBottom: up(l.skyBottom, 0.3), amb: up(l.amb, 0.25) };
}
