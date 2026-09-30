import type { Scheme, Slot } from "./groups";

export interface TemplateRow {
  name: string;
  slot: Slot;
  percent: number;
}

export interface Template {
  label: string;
  /** One line under the chip label. */
  blurb: string;
  scheme: Scheme;
  rows: readonly TemplateRow[];
}

const row = (name: string, percent: number, slot: Slot): TemplateRow => ({ name, percent, slot });

export const TEMPLATES = {
  balanced: {
    label: "Balanced",
    blurb: "A bit of everything",
    scheme: "sbs",
    rows: [
      row("Emergency fund", 10, "saving"),
      row("Goals & investing", 10, "saving"),
      row("Rent", 25, "fixed"),
      row("Utilities & internet", 10, "fixed"),
      row("Debt", 5, "fixed"),
      row("Health & insurance", 5, "fixed"),
      row("Family support", 5, "fixed"),
      row("Food & groceries", 15, "flexible"),
      row("Transport", 8, "flexible"),
      row("Fun & personal", 7, "flexible"),
    ],
  },
  "50-30-20": {
    // Needs → fixed, Wants → flexible, Savings → saving.
    label: "50/30/20",
    blurb: "Needs, wants, savings",
    scheme: "nws",
    rows: [
      row("Rent", 25, "fixed"),
      row("Utilities", 10, "fixed"),
      row("Food", 10, "fixed"),
      row("Transport", 5, "fixed"),
      row("Fun & dining", 15, "flexible"),
      row("Shopping & personal", 15, "flexible"),
      row("Savings", 10, "saving"),
      row("Goals", 10, "saving"),
    ],
  },
  saver: {
    label: "Saver first",
    blurb: "Save 35% up front",
    scheme: "sbs",
    rows: [
      row("Emergency fund", 25, "saving"),
      row("Goals", 10, "saving"),
      row("Rent", 25, "fixed"),
      row("Utilities", 8, "fixed"),
      row("Health", 4, "fixed"),
      row("Family", 4, "fixed"),
      row("Food", 12, "flexible"),
      row("Transport", 6, "flexible"),
      row("Fun", 6, "flexible"),
    ],
  },
} as const satisfies Record<string, Template>;

export type TemplateId = keyof typeof TEMPLATES;

export function isTemplateId(value: string): value is TemplateId {
  return Object.hasOwn(TEMPLATES, value);
}
