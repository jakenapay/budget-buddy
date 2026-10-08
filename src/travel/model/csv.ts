import { dayNumber } from "./dates";
import { formatPlain } from "./money";
import { CATEGORY_LABEL, type Expense, type Trip } from "./types";

/**
 * Quotes a CSV cell. Cells starting with = + - @ (or a tab/CR) are prefixed
 * with an apostrophe so a spreadsheet shows them as text instead of running
 * them as a formula (CSV injection). Notes are user text, so this matters.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const plain = (v: number | undefined, currency: string): string =>
  v === undefined ? "" : formatPlain(v, currency).replace(/,/g, "");

export function tripCsv(trip: Trip, expenses: readonly Expense[]): string {
  const home = trip.homeCurrency;
  const header = [
    "Date", "Day", "Status", "Category", "Note", "Currency", "Planned", "Paid",
    "Rate to " + home, `Planned (${home})`, `Paid (${home})`, "Paid at",
  ];
  const sorted = [...expenses].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.createdAt.localeCompare(b.createdAt));
  const rows = sorted.map((e) => [
    e.date ?? "",
    e.date ? String(dayNumber(trip.startDate, e.date)) : "Whole trip",
    e.status === "actual" ? "Paid" : "Planned",
    CATEGORY_LABEL[e.category],
    e.note ?? "",
    e.currency,
    plain(e.plannedAmount, e.currency),
    plain(e.amount, e.currency),
    String(e.rateToHome),
    plain(e.plannedAmountHome, home),
    plain(e.amountHome, home),
    e.paidAt ?? "",
  ]);
  // CRLF and a BOM so Excel opens UTF-8 (₱, ₫, accents) correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
