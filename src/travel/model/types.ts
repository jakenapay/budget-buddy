import type { ThemeChoice } from "../../ui/theme";

export const CATEGORY_IDS = ["food", "transport", "lodging", "activities", "shopping", "other"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  food: "Food",
  transport: "Transport",
  lodging: "Lodging",
  activities: "Activities",
  shopping: "Shopping",
  other: "Other",
};

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

export interface Trip {
  id: string;
  name: string;
  destination?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  homeCurrency: string;
  tripCurrency: string;
  budget?: number; // home currency
  dailyBudget?: number; // home currency
  createdAt: string;
}

export interface TripDay {
  tripId: string;
  date: string;
  itinerary?: string;
}

export type ExpenseStatus = "planned" | "actual";

/**
 * Amounts are stored in major units (e.g. 1500.5), already rounded to the
 * currency's decimals. Totals are added up as integer minor units (see
 * money.ts) so they never drift.
 */
export interface Expense {
  id: string;
  tripId: string;
  date: string | null; // null = whole-trip expense
  status: ExpenseStatus;
  category: CategoryId;
  note?: string;

  // The estimate. Kept after "Mark as paid" so planned vs spent can be compared.
  plannedAmount?: number;
  plannedAmountHome?: number;

  // What was really paid.
  amount?: number;
  amountHome?: number;

  currency: string;
  rateToHome: number; // 1 unit of `currency` = rateToHome units of the home currency
  paidAt?: string;
  createdAt: string;
}

export interface RateCache {
  base: string;
  rates: Record<string, number>; // 1 base = rates[X] X
  fetchedAt: string;
}

/** A rate the user typed, e.g. from the money changer. Stored as 1 `from` = rate `to`. */
export interface RateOverride {
  from: string;
  to: string;
  rate: number;
}

export interface Settings {
  homeCurrency: string;
  overrides: RateOverride[];
  theme: ThemeChoice;
  /** The Travel guide opens by itself once, on the first visit. */
  guideSeen: boolean;
}

export interface TravelData {
  trips: Trip[];
  days: TripDay[];
  expenses: Expense[];
  settings: Settings;
  rateCache: RateCache | null;
}

export const DEFAULT_SETTINGS: Settings = { homeCurrency: "PHP", overrides: [], theme: "system", guideSeen: false };
