import { describe, expect, it } from "vitest";
import { allocate, currencySymbol, formatMoney, formatPercent, formatWithCode, toMinor } from "../src/model/money";

describe("allocate", () => {
  it("makes rows add up to the pay when percents total 100", () => {
    const amounts = allocate(10000, [33.3333333, 33.3333333, 33.3333334]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(10000);
    amounts.forEach((a) => expect(Math.abs(a - 3333.33)).toBeLessThanOrEqual(1));
  });

  it("keeps every row within one minor unit of its exact share", () => {
    const pay = 4_567_891;
    const percents = [7, 13.5, 21.25, 8.33, 49.92];
    allocate(pay, percents).forEach((a, i) => {
      expect(Math.abs(a - (pay * (percents[i] ?? 0)) / 100)).toBeLessThanOrEqual(1);
    });
  });

  it("gives back a typed amount exactly and leaves other rows alone", () => {
    const pay = 4_500_050; // ₱45,000.50
    const before = allocate(pay, [10, 20, 30]);
    const typed = 777_777; // ₱7,777.77 in row 1
    const after = allocate(pay, [10, (typed / pay) * 100, 30]);
    expect(after[1]).toBe(typed);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
  });

  it("handles zero pay and an empty list", () => {
    expect(allocate(0, [50, 50])).toEqual([0, 0]);
    expect(allocate(1000, [])).toEqual([]);
  });

  it("sums to more than pay when over-assigned", () => {
    expect(allocate(10000, [60, 60]).reduce((a, b) => a + b, 0)).toBe(12000);
  });
});

describe("formatting", () => {
  it("formats money with symbol and code", () => {
    expect(formatMoney(4_500_050, "PHP")).toBe("₱45,000.50");
    expect(formatWithCode(4_500_050, "PHP")).toBe("PHP 45,000.50");
    expect(formatMoney(45000, "JPY")).toBe("¥45,000");
    expect(currencySymbol("INR")).toBe("₹");
  });

  it("uses no decimals for yen", () => {
    expect(toMinor(45000.6, "JPY")).toBe(45001);
    expect(toMinor(45000.6, "USD")).toBe(4_500_060);
  });

  it("formats percents with at most 2 decimals", () => {
    expect(formatPercent(25)).toBe("25");
    expect(formatPercent(12.5)).toBe("12.5");
    expect(formatPercent(100 / 3)).toBe("33.33");
  });
});
