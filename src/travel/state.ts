import * as db from "./db";
import { paidCountsAsPlanned } from "./model/calc";
import { todayIso } from "./model/dates";
import { roundMoney } from "./model/money";
import { DEFAULT_SETTINGS, type Expense, type RateCache, type Settings, type TravelData, type Trip } from "./model/types";

// The UI reads from this in-memory copy and every change is written through
// to IndexedDB right away. Memory updates first so the screen never waits on
// storage; if a write fails, the user is told (their data on disk is
// whatever was last saved successfully).

let data: TravelData = { trips: [], days: [], expenses: [], settings: { ...DEFAULT_SETTINGS }, rateCache: null };
const listeners: (() => void)[] = [];
let onSaveError: (message: string) => void = () => undefined;

export const get = (): TravelData => data;
export const subscribe = (fn: () => void): void => void listeners.push(fn);
export const setSaveErrorHandler = (fn: (message: string) => void): void => void (onSaveError = fn);

function commit(next: TravelData, write: () => Promise<void>, { render = true } = {}): Promise<void> {
  data = next;
  if (render) listeners.forEach((fn) => fn());
  return write().catch((error: unknown) => {
    console.error(error);
    onSaveError("Couldn't save that change on this device. Check that storage isn't full or blocked, then try again.");
  });
}

export async function load(): Promise<void> {
  data = await db.loadAll();
}

export const newId = (): string => crypto.randomUUID();

export function tripById(id: string): Trip | undefined {
  return data.trips.find((t) => t.id === id);
}

export const tripExpenses = (tripId: string): Expense[] => data.expenses.filter((e) => e.tripId === tripId);

export function itinerary(tripId: string, date: string): string {
  return data.days.find((d) => d.tripId === tripId && d.date === date)?.itinerary ?? "";
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export function saveTrip(trip: Trip): Promise<void> {
  const isNew = !tripById(trip.id);
  // Expenses whose day is no longer in the trip become whole-trip expenses,
  // so nothing silently disappears from the totals when dates are shortened.
  const moved: Expense[] = [];
  const expenses = data.expenses.map((e) => {
    if (e.tripId !== trip.id || e.date === null || (e.date >= trip.startDate && e.date <= trip.endDate)) return e;
    const next = { ...e, date: null };
    moved.push(next);
    return next;
  });
  const trips = isNew ? [...data.trips, trip] : data.trips.map((t) => (t.id === trip.id ? trip : t));
  if (isNew) void db.requestPersistence();
  return commit({ ...data, trips, expenses }, async () => {
    await db.putTrip(trip);
    for (const e of moved) await db.putExpense(e);
  });
}

/** How many of a trip's expenses would fall outside new dates. */
export function expensesOutside(tripId: string, start: string, end: string): number {
  return tripExpenses(tripId).filter((e) => e.date !== null && (e.date < start || e.date > end)).length;
}

export function removeTrip(tripId: string): Promise<void> {
  return commit(
    {
      ...data,
      trips: data.trips.filter((t) => t.id !== tripId),
      days: data.days.filter((d) => d.tripId !== tripId),
      expenses: data.expenses.filter((e) => e.tripId !== tripId),
    },
    () => db.deleteTrip(tripId),
  );
}

/** Saved as the user types; no re-render so the textarea keeps its caret. */
export function setItinerary(tripId: string, date: string, text: string): Promise<void> {
  const day = { tripId, date, itinerary: text };
  const days = [...data.days.filter((d) => !(d.tripId === tripId && d.date === date)), day];
  return commit({ ...data, days }, () => db.putDay(day), { render: false });
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export interface ExpenseInput {
  id?: string;
  tripId: string;
  date: string | null;
  status: Expense["status"];
  category: Expense["category"];
  note: string;
  amount: number; // the estimate when planned, what was paid when actual
  /** Editing a paid item that has an estimate: the (possibly changed) estimate. */
  plannedAmount?: number | undefined;
  currency: string;
  rateToHome: number;
}

/**
 * Builds the stored expense from the form. The home amount is computed from
 * the rate once, now, and saved, so later rate changes never rewrite history.
 */
export function buildExpense(input: ExpenseInput, existing: Expense | undefined, trip: Trip, now = new Date()): Expense {
  const home = trip.homeCurrency;
  const amount = roundMoney(input.amount, input.currency);
  const amountHome = roundMoney(amount * input.rateToHome, home);
  const e: Expense = {
    id: input.id ?? newId(),
    tripId: input.tripId,
    date: input.date,
    status: input.status,
    category: input.category,
    currency: input.currency,
    rateToHome: input.rateToHome,
    createdAt: existing?.createdAt ?? now.toISOString(),
  };
  if (input.note) e.note = input.note;

  if (input.status === "planned") {
    e.plannedAmount = amount;
    e.plannedAmountHome = amountHome;
    return e;
  }

  e.amount = amount;
  e.amountHome = amountHome;
  e.paidAt = existing?.paidAt ?? now.toISOString();
  if (input.plannedAmount !== undefined) {
    const planned = roundMoney(input.plannedAmount, input.currency);
    // An untouched estimate keeps the home value from its original rate.
    const kept =
      existing?.plannedAmount === planned && existing.currency === input.currency ? existing.plannedAmountHome : undefined;
    e.plannedAmount = planned;
    e.plannedAmountHome = kept ?? roundMoney(planned * input.rateToHome, home);
  } else if (!existing && paidCountsAsPlanned(trip, todayIso(now))) {
    e.plannedAmount = amount;
    e.plannedAmountHome = amountHome;
  }
  return e;
}

export function saveExpense(e: Expense): Promise<void> {
  const exists = data.expenses.some((x) => x.id === e.id);
  const expenses = exists ? data.expenses.map((x) => (x.id === e.id ? e : x)) : [...data.expenses, e];
  return commit({ ...data, expenses }, () => db.putExpense(e));
}

/**
 * "Mark as paid": the estimate stays for comparison; the real amount is
 * converted at today's rate (what the money actually cost), which is then
 * the rate saved on the expense.
 */
export function markPaid(e: Expense, amount: number, rateToHome: number, home: string, now = new Date()): Promise<void> {
  const paidAmount = roundMoney(amount, e.currency);
  return saveExpense({
    ...e,
    status: "actual",
    amount: paidAmount,
    amountHome: roundMoney(paidAmount * rateToHome, home),
    rateToHome,
    paidAt: now.toISOString(),
  });
}

export function removeExpense(id: string): Promise<void> {
  return commit({ ...data, expenses: data.expenses.filter((e) => e.id !== id) }, () => db.deleteExpense(id));
}

// ---------------------------------------------------------------------------
// Settings, rates, backup
// ---------------------------------------------------------------------------

export function saveSettings(patch: Partial<Settings>): Promise<void> {
  const settings = { ...data.settings, ...patch };
  return commit({ ...data, settings }, () => db.putSettings(settings));
}

export function saveRates(cache: RateCache): Promise<void> {
  return commit({ ...data, rateCache: cache }, () => db.putRates(cache));
}

export function replaceAll(next: TravelData): Promise<void> {
  return commit(next, () => db.replaceAll(next));
}
