// Travel works with any ISO 4217 currency, not just the payslip list, so
// decimals come from Intl (VND, JPY, KRW have none; most have 2).

/** Common travel currencies, shown first in every currency menu. */
export const TRAVEL_CURRENCIES = [
  "PHP", "USD", "EUR", "GBP", "JPY", "KRW", "CNY", "HKD", "TWD", "SGD", "MYR", "THB", "VND",
  "IDR", "KHR", "LAK", "MMK", "INR", "LKR", "NPR", "AED", "SAR", "QAR", "TRY", "AUD", "NZD",
  "CAD", "MXN", "BRL", "CHF", "SEK", "NOK", "DKK", "CZK", "PLN", "HUF", "ZAR", "EGP", "MAD",
] as const;

const LOCALE = "en-US";
const decimalsCache = new Map<string, number>();

export function isCurrencyCode(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) return false;
  try {
    new Intl.NumberFormat(LOCALE, { style: "currency", currency: value });
    return true;
  } catch {
    return false;
  }
}

export function decimalsOf(currency: string): number {
  let d = decimalsCache.get(currency);
  if (d === undefined) {
    d = new Intl.NumberFormat(LOCALE, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    decimalsCache.set(currency, d);
  }
  return d;
}

export const toMinor = (major: number, currency: string): number => Math.round(major * 10 ** decimalsOf(currency));
export const toMajor = (minor: number, currency: string): number => minor / 10 ** decimalsOf(currency);

/** Rounds to the currency's own decimals (₫ to whole dong, ₱ to centavos). */
export const roundMoney = (major: number, currency: string): number => toMajor(toMinor(major, currency), currency);

/** Adds major-unit amounts exactly by summing integer minor units. */
export function sumMoney(values: readonly (number | undefined)[], currency: string): number {
  let minor = 0;
  for (const v of values) if (v !== undefined) minor += toMinor(v, currency);
  return toMajor(minor, currency);
}

export function formatMoney(major: number, currency: string): string {
  const d = decimalsOf(currency);
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(major);
}

/** Without the symbol, for number fields and CSV. */
export function formatPlain(major: number, currency: string): string {
  const d = decimalsOf(currency);
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d }).format(major);
}

/** Short form for chart axes: ₱1.2K, ₫3.5M. */
export function formatCompact(major: number, currency: string): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(major);
}

export function currencySymbol(currency: string): string {
  const part = new Intl.NumberFormat(LOCALE, { style: "currency", currency })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? currency;
}

const names = new Intl.DisplayNames(["en"], { type: "currency" });
export const currencyName = (code: string): string => names.of(code) ?? code;

/** Rates span 0.00004 (VND→USD) to 25,000 (USD→VND); keep 6 significant digits. */
export function formatRate(rate: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumSignificantDigits: 6 }).format(rate);
}
