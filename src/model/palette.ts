// Category colors. Rows store a slot number (0–19), not a hex, so each theme
// can use its own step: dark mode gets hues tuned for the dark surface, and
// the PDF (phase 2) uses the light ones for paper.
//
// Slots 1–8 are the validated categorical order (dataviz skill; checked for
// color-blind separation against both page surfaces). Past 8 hues, colors
// can't all stay distinct, so slots 9–16 are lighter tints and 17–20 deeper
// shades of the same hues. Color is never the only cue: every row is also
// numbered, named and labeled with its percent.

export const BASE_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"] as const;
export const BASE_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"] as const;

export const SLOT_COUNT = 20;

/** CSS custom property for a slot; the values live in styles.css per theme. */
export function slotVar(slot: number): string {
  return `var(--series-${(slot % SLOT_COUNT) + 1})`;
}

export type RGB = readonly [number, number, number];

const hexToRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as RGB;
const mix = (c: RGB, toward: number, keep: number): RGB =>
  c.map((v) => Math.round(v * keep + toward * (1 - keep))) as unknown as RGB;

/**
 * The light-theme color of a slot as RGB, for the PDF (paper is light).
 * Mirrors the CSS exactly: slots 9–16 are color-mix(in srgb, base 55%,
 * white) and 17–20 are color-mix(in srgb, base 65%, black).
 */
export function slotRgbLight(slot: number): RGB {
  const s = slot % SLOT_COUNT;
  const base = hexToRgb(BASE_LIGHT[s % BASE_LIGHT.length] ?? BASE_LIGHT[0]);
  if (s < 8) return base;
  if (s < 16) return mix(base, 255, 0.55);
  return mix(base, 0, 0.65);
}

/** Lowest slot not in use, so deleting a row never recolors the others. */
export function nextSlot(used: readonly number[]): number {
  for (let s = 0; s < SLOT_COUNT; s++) if (!used.includes(s)) return s;
  return 0;
}
