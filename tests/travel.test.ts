import { describe, expect, it } from "vitest";
import { difference, expected, summarizeTrip, totals } from "../src/travel/model/calc";
import { csvCell, tripCsv } from "../src/travel/model/csv";
import { dayCount, tripDates } from "../src/travel/model/dates";
import { decimalsOf, formatMoney, roundMoney, sumMoney } from "../src/travel/model/money";
import { crossRate, findRate, naturalDirection, parseRateResponse, setOverride } from "../src/travel/model/rates";
import { DEFAULT_SETTINGS, type Expense, type Trip } from "../src/travel/model/types";
import { EXPORT_APP, parseImport } from "../src/travel/model/validate";
import { buildExpense } from "../src/travel/state";

const trip: Trip = {
  id: "t1",
  name: "Vietnam 2026",
  startDate: "2026-11-10",
  endDate: "2026-11-14",
  homeCurrency: "PHP",
  tripCurrency: "VND",
  createdAt: "2026-10-01T00:00:00.000Z",
};

const base = { tripId: "t1", category: "food", currency: "PHP", rateToHome: 1, createdAt: "2026-10-01T00:00:00.000Z" } as const;
const planned = (id: string, date: string | null, amount: number): Expense => ({
  ...base, id, date, status: "planned", plannedAmount: amount, plannedAmountHome: amount,
});
const paid = (id: string, date: string | null, amount: number, plan?: number): Expense => ({
  ...base, id, date, status: "actual", amount, amountHome: amount,
  ...(plan !== undefined ? { plannedAmount: plan, plannedAmountHome: plan } : {}),
});

describe("dates", () => {
  it("counts trip days inclusively, across month ends", () => {
    expect(dayCount("2026-11-10", "2026-11-14")).toBe(5);
    expect(tripDates("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  });
});

describe("money", () => {
  it("uses each currency's own decimals", () => {
    expect(decimalsOf("VND")).toBe(0);
    expect(decimalsOf("PHP")).toBe(2);
    expect(roundMoney(1234.567, "PHP")).toBe(1234.57);
    expect(roundMoney(1234.5, "VND")).toBe(1235);
    expect(formatMoney(500000, "VND")).toBe("₫500,000");
  });
  it("adds amounts exactly", () => {
    expect(sumMoney([0.1, 0.2], "PHP")).toBe(0.3);
  });
});

describe("totals", () => {
  it("matches the plan's day example: planned 1,500, spent 1,820, 320 over", () => {
    const t = totals([paid("a", "2026-11-11", 1820, 1500)], "PHP");
    expect(t).toEqual({ planned: 1500, spent: 1820, toPay: 0 });
    expect(difference(t, "PHP")).toBe(320);
  });

  it("splits planned, spent and still to pay", () => {
    const t = totals([planned("a", null, 9500), paid("b", null, 18000, 18000), paid("c", "2026-11-12", 100)], "PHP");
    expect(t).toEqual({ planned: 27500, spent: 18100, toPay: 9500 });
    expect(expected(t, "PHP")).toBe(27600);
  });

  it("keeps whole-trip costs out of the days", () => {
    const s = summarizeTrip(trip, [paid("f", null, 18000), paid("p", "2026-11-11", 300)], "2026-11-12");
    expect(s.wholeTrip.spent).toBe(18000);
    expect(s.days.map((d) => d.totals.spent)).toEqual([0, 300, 0, 0, 0]);
    expect(s.phase).toBe("during");
    expect(s.daysElapsed).toBe(3);
    expect(s.averagePerDay).toBe(100);
  });

  it("has no average before the trip", () => {
    expect(summarizeTrip(trip, [], "2026-11-01").averagePerDay).toBeNull();
  });
});

describe("buildExpense", () => {
  const input = { tripId: "t1", date: null, category: "transport", note: "", currency: "VND", rateToHome: 1 / 440 } as const;

  it("saves the home amount at the rate used, rounded to centavos", () => {
    const e = buildExpense({ ...input, status: "planned", amount: 500000 }, undefined, trip);
    expect(e.plannedAmount).toBe(500000);
    expect(e.plannedAmountHome).toBe(1136.36);
    expect(e.amountHome).toBeUndefined();
  });

  it("counts something paid before the trip as planned too", () => {
    const e = buildExpense({ ...input, status: "actual", amount: 4400 }, undefined, trip, new Date(2026, 9, 1));
    expect(e.amountHome).toBe(10);
    expect(e.plannedAmountHome).toBe(10);
  });

  it("treats something paid during the trip with no estimate as unplanned", () => {
    const e = buildExpense({ ...input, status: "actual", amount: 4400 }, undefined, trip, new Date(2026, 10, 11));
    expect(e.plannedAmountHome).toBeUndefined();
  });

  it("keeps an untouched estimate's original home value when editing a paid item", () => {
    const existing: Expense = { ...paid("x", null, 20, 15), currency: "VND", plannedAmount: 6600, plannedAmountHome: 15, amount: 8800, rateToHome: 1 / 440 };
    const e = buildExpense({ ...input, id: "x", status: "actual", amount: 8800, plannedAmount: 6600, rateToHome: 1 / 400 }, existing, trip);
    expect(e.plannedAmountHome).toBe(15);
    expect(e.amountHome).toBe(22);
  });
});

describe("rates", () => {
  const cache = { base: "PHP", rates: { PHP: 1, VND: 440, USD: 0.0172 }, fetchedAt: "2026-10-01T00:00:00Z" };

  it("derives any pair from one base", () => {
    expect(crossRate(cache, "VND", "PHP")).toBeCloseTo(1 / 440);
    expect(crossRate(cache, "USD", "VND")).toBeCloseTo(440 / 0.0172);
    expect(crossRate(cache, "XYZ", "PHP")).toBeNull();
  });

  it("prefers a manual rate, in either direction", () => {
    const settings = { ...DEFAULT_SETTINGS, overrides: setOverride([], { from: "PHP", to: "VND", rate: 450 }) };
    expect(findRate("VND", "PHP", settings, cache)).toEqual({ rate: 1 / 450, source: "manual" });
    expect(findRate("USD", "PHP", settings, cache)?.source).toBe("fetched");
    expect(findRate("PHP", "PHP", settings, null)).toEqual({ rate: 1, source: "same" });
  });

  it("shows rates the way a money changer would", () => {
    expect(naturalDirection("VND", "PHP", 1 / 440)).toEqual({ one: "PHP", other: "VND", value: 440 });
    expect(naturalDirection("USD", "PHP", 58)).toEqual({ one: "USD", other: "PHP", value: 58 });
  });

  it("only accepts a well-formed API response", () => {
    const now = new Date("2026-10-07T00:00:00Z");
    expect(parseRateResponse({ result: "success", base_code: "PHP", rates: { VND: 440, BAD: -1, x: 3 } }, "PHP", now)?.rates).toEqual({ VND: 440 });
    expect(parseRateResponse({ result: "error" }, "PHP", now)).toBeNull();
    expect(parseRateResponse({ result: "success", base_code: "USD", rates: { VND: 1 } }, "PHP", now)).toBeNull();
  });
});

describe("csv", () => {
  it("neutralizes formulas and quotes special characters", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("Pho, Hanoi")).toBe('"Pho, Hanoi"');
    expect(csvCell("plain")).toBe("plain");
  });

  it("writes one row per expense with a header", () => {
    const lines = tripCsv(trip, [paid("a", "2026-11-11", 1820.5, 1500), planned("b", null, 9500)]).trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Whole trip");
    expect(lines[2]).toContain("2026-11-11,2,Paid,Food,,PHP,1500.00,1820.50");
  });
});

describe("import", () => {
  const backup = (extra: object = {}): string =>
    JSON.stringify({ app: EXPORT_APP, version: 1, trips: [trip], days: [], expenses: [], settings: DEFAULT_SETTINGS, ...extra });

  it("round-trips a valid backup", () => {
    const r = parseImport(backup({ expenses: [paid("a", "2026-11-11", 100, 90)], days: [{ tripId: "t1", date: "2026-11-11", itinerary: "Old Quarter" }] }));
    expect(r.ok && r.data.expenses).toHaveLength(1);
    expect(r.ok && r.data.days[0]?.itinerary).toBe("Old Quarter");
    expect(r.ok && r.skipped).toBe(0);
  });

  it("rejects files that aren't backups", () => {
    expect(parseImport("not json").ok).toBe(false);
    expect(parseImport("{}").ok).toBe(false);
    expect(parseImport(JSON.stringify({ app: EXPORT_APP, version: 99 })).ok).toBe(false);
  });

  it("drops bad records instead of trusting them", () => {
    const r = parseImport(
      backup({
        expenses: [
          { ...paid("a", "2026-11-11", 100), amount: -5 }, // negative
          { ...paid("b", "2026-11-11", 100), tripId: "nope" }, // unknown trip
          { ...paid("c", "2026-11-11", 100), category: "<img>" }, // bad category
          { ...paid("d", "2026-11-11", 100), rateToHome: Number.NaN },
          { ...paid("e", "2026-12-25", 100) }, // outside the trip: kept as whole-trip
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.expenses.map((e) => [e.id, e.date])).toEqual([["e", null]]);
    expect(r.skipped).toBe(4);
  });

  it("cleans text fields", () => {
    const r = parseImport(backup({ trips: [{ ...trip, name: "  Trip\u0000 name  ".padEnd(200, "x") }] }));
    expect(r.ok && r.data.trips[0]?.name.length).toBe(60);
    expect(r.ok && r.data.trips[0]?.name.startsWith("Trip name")).toBe(true);
  });
});
