import { SLOTS, type Scheme, type Slot } from "./groups";
import { allocate, toMajor, toMinor, type Currency } from "./money";
import { nextSlot } from "./palette";
import { TEMPLATES, type TemplateId } from "./templates";
import { MAX_CATEGORIES, MAX_CATEGORY_NAME, MAX_PLAN_NAME, MAX_PAY, cleanDate, cleanText } from "./validate";

export interface Category {
  id: number;
  name: string;
  slot: Slot;
  /** Source of truth for the row. Amounts are always derived from it. */
  percent: number;
  /** Color slot 0–19; see palette.ts. */
  colorSlot: number;
}

export interface Plan {
  payMinor: number;
  currency: Currency;
  name: string;
  /** "" or YYYY-MM-DD */
  payday: string;
  scheme: Scheme;
  categories: readonly Category[];
  /** Template last applied; the chip stays highlighted until a row is edited. */
  template: TemplateId | null;
  /** True once any row is edited, so replacing rows asks first. */
  dirty: boolean;
}

// Ids only need to be unique within this page load (nothing is saved).
let lastId = 0;
const newId = (): number => ++lastId;

const clampPercent = (p: number): number => (Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 0);

export function createPlan(): Plan {
  return applyTemplate(
    { payMinor: 0, currency: "PHP", name: "", payday: "", scheme: "sbs", categories: [], template: null, dirty: false },
    "balanced",
  );
}

export function applyTemplate(plan: Plan, id: TemplateId): Plan {
  const t = TEMPLATES[id];
  const categories = t.rows.map((r, i) => ({ id: newId(), name: r.name, slot: r.slot, percent: r.percent, colorSlot: i }));
  return { ...plan, scheme: t.scheme, categories, template: id, dirty: false };
}

export function setPay(plan: Plan, major: number): Plan {
  const safe = Number.isFinite(major) ? Math.min(MAX_PAY, Math.max(0, major)) : 0;
  return { ...plan, payMinor: toMinor(safe, plan.currency) };
}

/** Keeps the same pay value; re-rounds it if the new currency has fewer decimals (JPY). */
export function setCurrency(plan: Plan, currency: Currency): Plan {
  return { ...plan, currency, payMinor: toMinor(toMajor(plan.payMinor, plan.currency), currency) };
}

export function setPlanName(plan: Plan, name: string): Plan {
  return { ...plan, name: cleanText(name, MAX_PLAN_NAME) };
}

export function setPayday(plan: Plan, payday: string): Plan {
  return { ...plan, payday: cleanDate(payday) };
}

export function setScheme(plan: Plan, scheme: Scheme): Plan {
  return { ...plan, scheme };
}

function editRow(plan: Plan, id: number, change: (c: Category) => Category): Plan {
  return { ...plan, dirty: true, categories: plan.categories.map((c) => (c.id === id ? change(c) : c)) };
}

export function setPercent(plan: Plan, id: number, percent: number): Plan {
  return editRow(plan, id, (c) => ({ ...c, percent: clampPercent(percent) }));
}

/**
 * Typing an amount stores the matching percent, not the amount, so a later
 * pay change scales every row the same way. The percent is exact (not
 * rounded), so the amount shows back exactly as typed; see allocate().
 */
export function setAmount(plan: Plan, id: number, major: number): Plan {
  if (plan.payMinor === 0) return plan;
  const minor = Math.min(plan.payMinor, toMinor(Math.max(0, major), plan.currency));
  return setPercent(plan, id, (minor / plan.payMinor) * 100);
}

export function setCategoryName(plan: Plan, id: number, name: string): Plan {
  return editRow(plan, id, (c) => ({ ...c, name: cleanText(name, MAX_CATEGORY_NAME) }));
}

export function setSlot(plan: Plan, id: number, slot: Slot): Plan {
  return editRow(plan, id, (c) => ({ ...c, slot }));
}

export function addCategory(plan: Plan): Plan {
  if (plan.categories.length >= MAX_CATEGORIES) return plan;
  const colorSlot = nextSlot(plan.categories.map((c) => c.colorSlot));
  const category: Category = { id: newId(), name: "", slot: "flexible", percent: 0, colorSlot };
  return { ...plan, dirty: true, categories: [...plan.categories, category] };
}

export function removeCategory(plan: Plan, id: number): Plan {
  return { ...plan, dirty: true, categories: plan.categories.filter((c) => c.id !== id) };
}

export type Status = "nopay" | "balanced" | "under" | "over";

export interface Summary {
  /** One amount per category, same order, in minor units. */
  amounts: number[];
  assignedMinor: number;
  unassignedMinor: number;
  assignedPercent: number;
  groups: Record<Slot, { minor: number; percent: number }>;
  savingsRate: number;
  status: Status;
}

export function summarize(plan: Plan): Summary {
  const amounts = allocate(plan.payMinor, plan.categories.map((c) => c.percent));
  // Assigned is the sum of the displayed amounts, so the table always adds up.
  const assignedMinor = amounts.reduce((a, b) => a + b, 0);
  const unassignedMinor = plan.payMinor - assignedMinor;
  const assignedPercent = plan.categories.reduce((a, c) => a + c.percent, 0);

  const groups = Object.fromEntries(SLOTS.map((s) => [s, { minor: 0, percent: 0 }])) as Summary["groups"];
  plan.categories.forEach((c, i) => {
    groups[c.slot].minor += amounts[i] ?? 0;
    groups[c.slot].percent += c.percent;
  });

  // Money decides the status: at 99.999% the amounts can still sum to the
  // exact pay, and that plan is fully assigned.
  const status: Status =
    plan.payMinor === 0 ? "nopay" : unassignedMinor === 0 ? "balanced" : unassignedMinor > 0 ? "under" : "over";

  return { amounts, assignedMinor, unassignedMinor, assignedPercent, groups, savingsRate: groups.saving.percent, status };
}
