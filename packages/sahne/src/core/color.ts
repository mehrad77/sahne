// Colour tones for the paper look. Every fill has a shade and a highlight derived from it, so
// light falls the same way across all the art, and a paper edge that reads as the cut rim.

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}

export function rgbToHsl([r, g, b]: RGB): RGB {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

export function hslToRgb([h, s, l]: RGB): RGB {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = (t % 1 + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Move the hue a little towards a target hue (shadows go cool, highlights go warm). */
function hueToward(h: number, target: number, amt: number) {
  let d = target - h;
  if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
  return h + d * amt;
}

export type Tone = "base" | "shade" | "deep" | "light" | "edge";

/**
 * The kit's tone ramp:
 * - shade: the side away from the key light (cooler and darker);
 * - deep: creases and the inside of a mouth or sleeve;
 * - light: the lit edge (warmer and lighter);
 * - edge: the paper's cut rim, close to the paper core.
 */
export function tone(hex: string, t: Tone): string {
  if (t === "base") return hex;
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  switch (t) {
    case "shade": return rgbToHex(hslToRgb([hueToward(h, 0.68, 0.08), Math.min(1, s * 1.05 + 0.03), l * 0.8]));
    case "deep": return rgbToHex(hslToRgb([hueToward(h, 0.7, 0.12), Math.min(1, s * 1.1 + 0.05), l * 0.6]));
    case "light": return rgbToHex(hslToRgb([hueToward(h, 0.11, 0.06), s * 0.95, l + (1 - l) * 0.22]));
    case "edge": return rgbToHex(hslToRgb([hueToward(h, 0.11, 0.05), s * 0.45, l + (1 - l) * 0.62]));
  }
}

/** Perceived lightness, for picking contrasting detail colours. */
export const luma = (hex: string) => { const [r, g, b] = hexToRgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
