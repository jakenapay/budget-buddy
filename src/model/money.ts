export const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD", "INR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

// One fixed locale so grouping and decimal marks never change between
// devices (and match the PDF). Only the symbol follows the currency.
const LOCALE = "en-US";

const DECIMALS: Record<Currency, number> = {
  PHP: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0, SGD: 2, AUD: 2, CAD: 2, INR: 2,
};

/** Decimal places for a currency: 2 for most, 0 for JPY (yen has no minor unit). */
export function decimals(currency: Currency): number {
  return DECIMALS[currency];
}

/**
 * All money is held as integer minor units (centavos, cents, yen) so sums are
 * exact. Floats are only used for percentages.
 */
export function toMinor(major: number, currency: Currency): number {
  return Math.round(major * 10 ** decimals(currency));
}

export function toMajor(minor: number, currency: Currency): number {
  return minor / 10 ** decimals(currency);
}

function fmt(minor: number, currency: Currency, style: "currency" | "decimal"): string {
  const d = decimals(currency);
  return new Intl.NumberFormat(LOCALE, {
    style,
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(toMajor(minor, currency));
}

/** "₱45,000.00" for the page. */
export function formatMoney(minor: number, currency: Currency): string {
  return fmt(minor, currency, "currency");
}

/** "45,000.00": the value inside an amount field (the symbol sits outside it). */
export function formatPlain(minor: number, currency: Currency): string {
  return fmt(minor, currency, "decimal");
}

/** "PHP 45,000.00": for the PDF, whose built-in fonts have no ₱ or ₹ glyph. */
export function formatWithCode(minor: number, currency: Currency): string {
  return `${currency} ${formatPlain(minor, currency)}`;
}

export function currencySymbol(currency: Currency): string {
  const part = new Intl.NumberFormat(LOCALE, { style: "currency", currency })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? currency;
}

/** "25", "12.5", "33.33": at most 2 decimals, no trailing zeros. */
export function formatPercent(percent: number): string {
  return String(Math.round(percent * 100) / 100);
}

/**
 * Turns percentages into amounts that always add up.
 *
 * Rounding each row on its own can leave the total one centavo off (three
 * rows of 33.333…% of ₱100.00 round to ₱99.99). Instead we round the running
 * total and give each row the difference between consecutive rounded running
 * totals. The rows then sum to exactly round(pay × total%), so a plan at 100%
 * assigns exactly the pay, and each row stays within one minor unit of its
 * exact share.
 *
 * It also keeps amount edits stable: when someone types an amount, that row's
 * percent is set so its exact share is a whole number of minor units. That
 * moves the running total by a whole number, so the rows below keep their
 * rounding and the typed amount shows back exactly as typed.
 */
export function allocate(payMinor: number, percents: readonly number[]): number[] {
  let exactRunning = 0;
  let roundedPrev = 0;
  return percents.map((p) => {
    exactRunning += (payMinor * p) / 100;
    // Trim float noise (4499.9999999997) so it can't flip a rounding.
    const rounded = Math.round(Number(exactRunning.toFixed(6)));
    const amount = rounded - roundedPrev;
    roundedPrev = rounded;
    return amount;
  });
}
