// Trip dates are calendar dates (YYYY-MM-DD) with no time zone. All math
// runs in UTC so a day is always 24 hours and DST can't skip or repeat one.

export const MAX_TRIP_DAYS = 90;

const parse = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
const DAY_MS = 86_400_000;
const toIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Today on the user's own calendar (not UTC), so "today" matches their phone. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Number of days from start to end, inclusive: Nov 10 to Nov 14 is 5. */
export function dayCount(start: string, end: string): number {
  return Math.round((parse(end) - parse(start)) / DAY_MS) + 1;
}

export function tripDates(start: string, end: string): string[] {
  const n = Math.min(Math.max(dayCount(start, end), 0), MAX_TRIP_DAYS);
  const first = parse(start);
  return Array.from({ length: n }, (_, i) => toIso(first + i * DAY_MS));
}

/** 1 for the first day of the trip. */
export const dayNumber = (start: string, date: string): number => dayCount(start, date);

const fmt = (opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
const SHORT = fmt({ month: "short", day: "numeric" });
const WEEKDAY = fmt({ weekday: "short", month: "short", day: "numeric" });
const LONG = fmt({ month: "short", day: "numeric", year: "numeric" });

export const formatShortDate = (iso: string): string => SHORT.format(parse(iso));
export const formatDayDate = (iso: string): string => WEEKDAY.format(parse(iso));
export const formatLongDate = (iso: string): string => LONG.format(parse(iso));

/** "Nov 10 – 14, 2026", or the full form when months or years differ. */
export function formatRange(start: string, end: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .formatRange(parse(start), parse(end));
}
