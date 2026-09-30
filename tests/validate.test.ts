import { describe, expect, it } from "vitest";
import { cleanDate, cleanText, parseAmount, parseNumber, parsePay, parsePercent } from "../src/model/validate";

describe("parseNumber", () => {
  it.each([
    ["45000", 45000],
    ["45,000.50", 45000.5],
    [" 1 000 ", 1000],
    ["", 0],
    ["12.", 12],
    [".5", 0.5],
  ])("accepts %j", (raw, value) => {
    expect(parseNumber(raw)).toEqual({ ok: true, value });
  });

  it.each(["-5", "abc", "1e5", "Infinity", "NaN", ".", "1.2.3", "0x10"])("rejects %j", (raw) => {
    expect(parseNumber(raw).ok).toBe(false);
  });
});

describe("ranges", () => {
  it("limits pay to 1,000,000,000", () => {
    expect(parsePay("1000000000").ok).toBe(true);
    expect(parsePay("1000000000.01").ok).toBe(false);
  });

  it("limits percent to 0–100 and allows a trailing %", () => {
    expect(parsePercent("100")).toEqual({ ok: true, value: 100 });
    expect(parsePercent("25%")).toEqual({ ok: true, value: 25 });
    expect(parsePercent("100.01").ok).toBe(false);
  });

  it("stops one category exceeding pay", () => {
    expect(parseAmount("500", 1000).ok).toBe(true);
    expect(parseAmount("1000.01", 1000).ok).toBe(false);
  });
});

describe("cleanText", () => {
  it("strips control characters, collapses spaces and trims", () => {
    expect(cleanText("  Rent\n\tand\u0000 bills  ", 40)).toBe("Rent and bills");
  });

  it("cuts to the limit without splitting an emoji", () => {
    const s = cleanText("🏠".repeat(50), 40);
    expect(Array.from(s)).toHaveLength(40);
    expect(s).toBe("🏠".repeat(40));
  });

  it("keeps markup as plain text (it is never parsed as HTML)", () => {
    expect(cleanText("<img src=x onerror=alert(1)>", 60)).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("cleanDate", () => {
  it("accepts real dates and empty", () => {
    expect(cleanDate("2026-10-15")).toBe("2026-10-15");
    expect(cleanDate("")).toBe("");
  });

  it.each(["2026-02-30", "2026-13-01", "15/10/2026", "2026-1-5", "0001-01-01"])("rejects %j", (raw) => {
    expect(cleanDate(raw)).toBe("");
  });
});
