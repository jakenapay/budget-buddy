import { cleanDate, cleanText, parseNumber, type Parsed } from "../../model/validate";
import { MAX_TRIP_DAYS, dayCount } from "./dates";
import { isCurrencyCode, roundMoney } from "./money";
import {
  DEFAULT_SETTINGS,
  isCategoryId,
  type Expense,
  type RateCache,
  type RateOverride,
  type Settings,
  type TravelData,
  type Trip,
  type TripDay,
} from "./types";

export const MAX_TRIP_NAME = 60;
export const MAX_DESTINATION = 60;
export const MAX_NOTE = 80;
export const MAX_ITINERARY = 300;
export const MAX_AMOUNT = 1_000_000_000_000; // ₫1 trillion: covers big totals in low-value currencies
export const MAX_RATE = 10_000_000;
export const MAX_TRIPS = 100;
export const MAX_EXPENSES_PER_TRIP = 2000;

export function parseMoneyInput(raw: string, { required = false } = {}): Parsed {
  const r = parseNumber(raw);
  if (!r.ok) return r;
  if (required && r.value === 0) return { ok: false, error: "Enter an amount." };
  if (r.value > MAX_AMOUNT) return { ok: false, error: "That amount is too large." };
  return r;
}

export function parseRateInput(raw: string): Parsed {
  const r = parseNumber(raw);
  if (!r.ok) return r;
  if (r.value <= 0) return { ok: false, error: "Enter a rate above 0." };
  if (r.value > MAX_RATE) return { ok: false, error: "That rate is too large." };
  return r;
}

/** Problems with a trip's dates, or "" if they're fine. */
export function tripDatesError(start: string, end: string): string {
  if (!start || !end) return "Pick a start and end date.";
  if (end < start) return "The trip can't end before it starts.";
  if (dayCount(start, end) > MAX_TRIP_DAYS) return `A trip can be at most ${MAX_TRIP_DAYS} days.`;
  return "";
}

// ---------------------------------------------------------------------------
// Import. The file could have been edited by hand or come from somewhere
// else, so every record is rebuilt field by field from known-good values.
// Anything unexpected is dropped rather than trusted.
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === "string" ? cleanText(v, max) : "");
const id = (v: unknown): string | null => (typeof v === "string" && /^[\w-]{1,64}$/.test(v) ? v : null);
const date = (v: unknown): string => (typeof v === "string" ? cleanDate(v) : "");
const timestamp = (v: unknown): string =>
  typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : new Date(0).toISOString();
const money = (v: unknown, currency: string): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_AMOUNT ? roundMoney(v, currency) : undefined;
const rate = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= MAX_RATE ? v : null;

function sanitizeTrip(v: unknown): Trip | null {
  if (!isObj(v)) return null;
  const tripId = id(v["id"]);
  const name = str(v["name"], MAX_TRIP_NAME);
  const startDate = date(v["startDate"]);
  const endDate = date(v["endDate"]);
  const { homeCurrency, tripCurrency } = v;
  if (!tripId || !name || tripDatesError(startDate, endDate)) return null;
  if (!isCurrencyCode(homeCurrency) || !isCurrencyCode(tripCurrency)) return null;
  const trip: Trip = { id: tripId, name, startDate, endDate, homeCurrency, tripCurrency, createdAt: timestamp(v["createdAt"]) };
  const destination = str(v["destination"], MAX_DESTINATION);
  if (destination) trip.destination = destination;
  const budget = money(v["budget"], homeCurrency);
  if (budget) trip.budget = budget;
  const dailyBudget = money(v["dailyBudget"], homeCurrency);
  if (dailyBudget) trip.dailyBudget = dailyBudget;
  return trip;
}

function sanitizeDay(v: unknown, trips: Map<string, Trip>): TripDay | null {
  if (!isObj(v)) return null;
  const tripId = id(v["tripId"]);
  const d = date(v["date"]);
  if (!tripId || !trips.has(tripId) || !d) return null;
  const itinerary = typeof v["itinerary"] === "string" ? cleanItinerary(v["itinerary"]) : "";
  return itinerary ? { tripId, date: d, itinerary } : null;
}

function sanitizeExpense(v: unknown, trips: Map<string, Trip>): Expense | null {
  if (!isObj(v)) return null;
  const expenseId = id(v["id"]);
  const tripId = id(v["tripId"]);
  const trip = tripId ? trips.get(tripId) : undefined;
  const { status, category, currency } = v;
  const r = rate(v["rateToHome"]);
  if (!expenseId || !tripId || !trip || !isCategoryId(category) || !isCurrencyCode(currency) || r === null) return null;
  if (status !== "planned" && status !== "actual") return null;
  let d = v["date"] === null ? null : date(v["date"]);
  if (d === "") return null;
  if (d !== null && (d < trip.startDate || d > trip.endDate)) d = null; // keep the cost, as whole-trip

  const e: Expense = { id: expenseId, tripId, date: d, status, category, currency, rateToHome: r, createdAt: timestamp(v["createdAt"]) };
  const note = str(v["note"], MAX_NOTE);
  if (note) e.note = note;
  const home = trip.homeCurrency;
  const planned = money(v["plannedAmount"], currency);
  const plannedHome = money(v["plannedAmountHome"], home);
  if (planned !== undefined && plannedHome !== undefined) {
    e.plannedAmount = planned;
    e.plannedAmountHome = plannedHome;
  }
  const amount = money(v["amount"], currency);
  const amountHome = money(v["amountHome"], home);
  if (amount !== undefined && amountHome !== undefined) {
    e.amount = amount;
    e.amountHome = amountHome;
  }
  if (status === "actual" && e.amountHome === undefined) return null;
  if (status === "planned" && e.plannedAmountHome === undefined) return null;
  if (typeof v["paidAt"] === "string") e.paidAt = timestamp(v["paidAt"]);
  return e;
}

function sanitizeSettings(v: unknown): Settings {
  if (!isObj(v)) return { ...DEFAULT_SETTINGS };
  const home = isCurrencyCode(v["homeCurrency"]) ? v["homeCurrency"] : DEFAULT_SETTINGS.homeCurrency;
  const theme = v["theme"] === "light" || v["theme"] === "dark" ? v["theme"] : "system";
  const overrides: RateOverride[] = [];
  if (Array.isArray(v["overrides"])) {
    for (const o of v["overrides"].slice(0, 200)) {
      if (!isObj(o)) continue;
      const r = rate(o["rate"]);
      if (isCurrencyCode(o["from"]) && isCurrencyCode(o["to"]) && o["from"] !== o["to"] && r !== null) {
        overrides.push({ from: o["from"], to: o["to"], rate: r });
      }
    }
  }
  return { homeCurrency: home, overrides, theme, guideSeen: v["guideSeen"] === true };
}

function sanitizeRateCache(v: unknown): RateCache | null {
  if (!isObj(v) || !isCurrencyCode(v["base"]) || !isObj(v["rates"])) return null;
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(v["rates"]).slice(0, 400)) {
    const r = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
    if (r !== null && /^[A-Z]{3}$/.test(code)) rates[code] = r;
  }
  return { base: v["base"], rates, fetchedAt: timestamp(v["fetchedAt"]) };
}

export const EXPORT_APP = "budget-buddy-travel";
export const EXPORT_VERSION = 1;

export type ImportResult = { ok: true; data: TravelData; skipped: number } | { ok: false; error: string };

export function parseImport(text: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!isObj(json) || json["app"] !== EXPORT_APP) {
    return { ok: false, error: "That file isn't a Budget Buddy travel backup." };
  }
  if (typeof json["version"] !== "number" || json["version"] > EXPORT_VERSION) {
    return { ok: false, error: "That backup was made by a newer version of Budget Buddy." };
  }
  const list = (key: string): unknown[] => (Array.isArray(json[key]) ? json[key] : []);
  let skipped = 0;
  const keep = <T>(items: unknown[], fn: (v: unknown) => T | null, limit: number): T[] => {
    const out: T[] = [];
    for (const item of items) {
      const clean = out.length < limit ? fn(item) : null;
      if (clean) out.push(clean);
      else skipped++;
    }
    return out;
  };

  const trips = new Map<string, Trip>();
  for (const t of keep(list("trips"), sanitizeTrip, MAX_TRIPS)) {
    if (trips.has(t.id)) skipped++;
    else trips.set(t.id, t);
  }
  const days = keep(list("days"), (v) => sanitizeDay(v, trips), MAX_TRIPS * MAX_TRIP_DAYS);
  const expenseIds = new Set<string>();
  const perTrip = new Map<string, number>();
  const expenses = keep(
    list("expenses"),
    (v) => {
      const e = sanitizeExpense(v, trips);
      if (!e || expenseIds.has(e.id)) return null;
      const n = (perTrip.get(e.tripId) ?? 0) + 1;
      if (n > MAX_EXPENSES_PER_TRIP) return null;
      perTrip.set(e.tripId, n);
      expenseIds.add(e.id);
      return e;
    },
    MAX_TRIPS * MAX_EXPENSES_PER_TRIP,
  );

  return {
    ok: true,
    skipped,
    data: {
      trips: [...trips.values()],
      days,
      expenses,
      settings: sanitizeSettings(json["settings"]),
      rateCache: sanitizeRateCache(json["rateCache"]),
    },
  };
}

/** Itinerary notes keep line breaks (one stop per line is common). */
export function cleanItinerary(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => cleanText(line, MAX_ITINERARY))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_ITINERARY);
}
