import { dayCount, todayIso, tripDates } from "./dates";
import { sumMoney } from "./money";
import { CATEGORY_IDS, type CategoryId, type Expense, type Trip } from "./types";

/**
 * The three figures used everywhere, all in the home currency:
 *  - planned: the sum of estimates. Paid items keep their estimate, so a
 *    day still compares "planned ₱1,500" against "spent ₱1,820".
 *  - spent: what was actually paid.
 *  - toPay: estimates for items not paid yet.
 * spent + toPay is the expected total cost right now.
 */
export interface Totals {
  planned: number;
  spent: number;
  toPay: number;
}

export function totals(expenses: readonly Expense[], home: string): Totals {
  return {
    planned: sumMoney(expenses.map((e) => e.plannedAmountHome), home),
    spent: sumMoney(expenses.map((e) => (e.status === "actual" ? e.amountHome : undefined)), home),
    toPay: sumMoney(expenses.map((e) => (e.status === "planned" ? e.plannedAmountHome : undefined)), home),
  };
}

export const expected = (t: Totals, home: string): number => sumMoney([t.spent, t.toPay], home);

/** Positive = over plan, negative = under. Rounded like the inputs. */
export const difference = (t: Totals, home: string): number => sumMoney([t.spent, -t.planned], home);

export type Phase = "before" | "during" | "after";

export interface TripSummary {
  all: Totals;
  wholeTrip: Totals;
  days: { date: string; totals: Totals }[];
  byCategory: Record<CategoryId, Totals>;
  phase: Phase;
  daysElapsed: number;
  /** Average actual spend per elapsed day, counting per-day expenses only. */
  averagePerDay: number | null;
}

export function summarizeTrip(trip: Trip, expenses: readonly Expense[], today = todayIso()): TripSummary {
  const home = trip.homeCurrency;
  const dates = tripDates(trip.startDate, trip.endDate);
  const byDate = new Map<string, Expense[]>(dates.map((d) => [d, []]));
  const whole: Expense[] = [];
  for (const e of expenses) {
    // A date outside the trip shouldn't happen (saveTrip and import move
    // those to whole-trip), but if it does, the cost still counts.
    const day = e.date === null ? undefined : byDate.get(e.date);
    (day ?? whole).push(e);
  }

  const phase: Phase = today < trip.startDate ? "before" : today > trip.endDate ? "after" : "during";
  const daysElapsed = phase === "before" ? 0 : phase === "after" ? dates.length : dayCount(trip.startDate, today);
  const days = dates.map((date) => ({ date, totals: totals(byDate.get(date) ?? [], home) }));
  const perDaySpent = sumMoney(days.map((d) => d.totals.spent), home);

  const byCategory = Object.fromEntries(
    CATEGORY_IDS.map((c) => [c, totals(expenses.filter((e) => e.category === c), home)]),
  ) as Record<CategoryId, Totals>;

  return {
    all: totals(expenses, home),
    wholeTrip: totals(whole, home),
    days,
    byCategory,
    phase,
    daysElapsed,
    averagePerDay: daysElapsed > 0 ? perDaySpent / daysElapsed : null,
  };
}

/**
 * Something paid before the trip starts (flights, a hotel deposit) is part of
 * the plan, so it also counts as planned. Something paid during the trip with
 * no estimate is unplanned spending and should show up as "over".
 */
export const paidCountsAsPlanned = (trip: Trip, today = todayIso()): boolean => today < trip.startDate;
