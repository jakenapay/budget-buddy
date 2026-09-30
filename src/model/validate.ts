export const MAX_PAY = 1_000_000_000;
export const MAX_CATEGORIES = 20;
export const MAX_CATEGORY_NAME = 40;
export const MAX_PLAN_NAME = 60;

export type Parsed = { ok: true; value: number } | { ok: false; error: string };

const NOT_A_NUMBER = "Use numbers only, like 45000 or 45,000.50.";

/**
 * Reads a number the way people type it from a payslip: "45,000.50" or
 * " 45000 ". Empty means 0. Anything else ("abc", "1e5", "-3", "Infinity")
 * is rejected, so NaN and negatives never reach the model.
 */
export function parseNumber(raw: string): Parsed {
  const text = raw.trim().replace(/[,\s]/g, "");
  if (text === "") return { ok: true, value: 0 };
  if (!/^\d*\.?\d*$/.test(text) || text === ".") return { ok: false, error: NOT_A_NUMBER };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: NOT_A_NUMBER };
  return { ok: true, value };
}

export function parsePay(raw: string): Parsed {
  const r = parseNumber(raw);
  if (r.ok && r.value > MAX_PAY) return { ok: false, error: "Pay can be at most 1,000,000,000." };
  return r;
}

export function parsePercent(raw: string): Parsed {
  const r = parseNumber(raw.replace(/%\s*$/, ""));
  if (r.ok && r.value > 100) return { ok: false, error: "A percentage can be at most 100." };
  return r;
}

export function parseAmount(raw: string, payMajor: number): Parsed {
  const r = parseNumber(raw);
  if (r.ok && r.value > payMajor) {
    return { ok: false, error: "One category can't be more than your take-home pay." };
  }
  return r;
}

/**
 * Removes control characters, collapses whitespace and cuts to `max`
 * characters. Cuts by code point so an emoji is never split in half.
 */
export function cleanText(raw: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  const flat = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(flat).slice(0, max).join("");
}

/** Accepts "" (no payday) or a real calendar date written YYYY-MM-DD. */
export function cleanDate(raw: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  const real = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  return real && y >= 1900 && y <= 2200 ? raw : "";
}
