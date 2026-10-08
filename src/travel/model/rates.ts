import { decimalsOf, isCurrencyCode } from "./money";
import type { RateCache, RateOverride, Settings } from "./types";

export const RATES_HOST = "https://open.er-api.com";

export type RateSource = "same" | "manual" | "fetched";
export interface FoundRate {
  rate: number; // 1 `from` = rate `to`
  source: RateSource;
}

/**
 * Finds "1 from = ? to". A rate the user typed wins over a fetched one,
 * because it's what they actually got at the money changer. Overrides are
 * stored in whichever direction the user typed, so the inverse counts too.
 */
export function findRate(from: string, to: string, settings: Settings, cache: RateCache | null): FoundRate | null {
  if (from === to) return { rate: 1, source: "same" };
  const manual = findOverride(settings.overrides, from, to);
  if (manual !== null) return { rate: manual, source: "manual" };
  const fetched = cache ? crossRate(cache, from, to) : null;
  return fetched !== null ? { rate: fetched, source: "fetched" } : null;
}

export function findOverride(overrides: readonly RateOverride[], from: string, to: string): number | null {
  for (const o of overrides) {
    if (o.from === from && o.to === to) return o.rate;
    if (o.from === to && o.to === from) return 1 / o.rate;
  }
  return null;
}

/**
 * The cache is quoted against one base B (1 B = rates[X] X). Any pair can
 * be derived from it: 1 from = (rates[to] / rates[from]) to. This lets trips
 * with a different home currency than Settings still convert offline.
 */
export function crossRate(cache: RateCache, from: string, to: string): number | null {
  const perBase = (code: string): number | undefined => (code === cache.base ? 1 : cache.rates[code]);
  const f = perBase(from);
  const t = perBase(to);
  return f && t ? t / f : null;
}

/** Replaces any override for the pair (either direction). */
export function setOverride(overrides: readonly RateOverride[], next: RateOverride): RateOverride[] {
  return [...clearOverride(overrides, next.from, next.to), next];
}

export function clearOverride(overrides: readonly RateOverride[], a: string, b: string): RateOverride[] {
  return overrides.filter((o) => !((o.from === a && o.to === b) || (o.from === b && o.to === a)));
}

/**
 * Shows a rate the way a money changer would: with the stronger currency as
 * the "1". "1 USD = 58.2 PHP" and "1 PHP = 440 VND" read naturally;
 * "1 VND = 0.00227 PHP" doesn't.
 */
export function naturalDirection(from: string, to: string, rate: number): { one: string; other: string; value: number } {
  return rate >= 1 ? { one: from, other: to, value: rate } : { one: to, other: from, value: 1 / rate };
}

/**
 * The direction to ask for a rate that isn't known yet. Currencies without
 * decimals (VND, JPY, KRW, IDR) are almost always the weaker side, so ask
 * "1 PHP = ? VND" for those and "1 USD = ? PHP" otherwise.
 */
export function askDirection(from: string, to: string): { one: string; other: string } {
  return decimalsOf(from) === 0 && decimalsOf(to) > 0 ? { one: to, other: from } : { one: from, other: to };
}

/**
 * Validates the open.er-api.com response. It comes from the network, so it's
 * checked the same way as an imported file: only finite positive rates for
 * real currency codes are kept.
 */
export function parseRateResponse(json: unknown, expectedBase: string, now: Date): RateCache | null {
  if (typeof json !== "object" || json === null) return null;
  const body = json as { result?: unknown; base_code?: unknown; rates?: unknown };
  if (body.result !== "success" || body.base_code !== expectedBase) return null;
  if (typeof body.rates !== "object" || body.rates === null) return null;
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(body.rates as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0 && /^[A-Z]{3}$/.test(code)) rates[code] = value;
  }
  if (Object.keys(rates).length === 0 || !isCurrencyCode(expectedBase)) return null;
  return { base: expectedBase, rates, fetchedAt: now.toISOString() };
}

export async function fetchRates(base: string): Promise<RateCache> {
  // The only network request in the app. No cookies, no referrer; the URL
  // carries nothing but the home currency code.
  const res = await fetch(`${RATES_HOST}/v6/latest/${encodeURIComponent(base)}`, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Rates request failed (${res.status})`);
  const cache = parseRateResponse(await res.json(), base, new Date());
  if (!cache) throw new Error("Rates response was not in the expected format");
  return cache;
}
