/**
 * Every row belongs to one of three fixed slots. The "Group by" switch only
 * changes what the slots are called, so switching never loses a row's
 * assignment. Savings rate always means the "saving" slot.
 */
export const SLOTS = ["saving", "fixed", "flexible"] as const;
export type Slot = (typeof SLOTS)[number];

interface SchemeDef {
  label: string;
  names: Record<Slot, string>;
  order: readonly Slot[];
}

export const SCHEMES = {
  sbs: {
    label: "Save / Bill / Spend",
    names: { saving: "Save", fixed: "Bill", flexible: "Spend" },
    order: ["saving", "fixed", "flexible"],
  },
  nws: {
    label: "Needs / Wants / Savings",
    names: { saving: "Savings", fixed: "Needs", flexible: "Wants" },
    order: ["fixed", "flexible", "saving"],
  },
} as const satisfies Record<string, SchemeDef>;

export type Scheme = keyof typeof SCHEMES;

export function isScheme(value: string): value is Scheme {
  return Object.hasOwn(SCHEMES, value);
}

export function isSlot(value: string): value is Slot {
  return (SLOTS as readonly string[]).includes(value);
}

export function slotName(scheme: Scheme, slot: Slot): string {
  return SCHEMES[scheme].names[slot];
}
