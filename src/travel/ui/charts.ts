import { el } from "../../ui/dom";
import { difference, type Totals, type TripSummary } from "../model/calc";
import { dayNumber, formatDayDate } from "../model/dates";
import { formatMoney } from "../model/money";
import { CATEGORY_IDS, CATEGORY_LABEL, type Trip } from "../model/types";
import { href } from "../router";
import * as state from "../state";
import { CATEGORY_COLOR, diffText } from "./parts";

// Charts are plain HTML and SVG drawn from the numbers, no chart library.
// Every bar and slice also has its value written as text, so nothing
// depends on telling colors apart.

/** One labeled bar: planned is a dashed outline, spent is solid (readable in grayscale). */
function bar(kind: "planned" | "spent", value: number, scale: number, over: boolean): HTMLElement {
  const fill = el("span", {
    class:
      kind === "planned"
        ? "block h-full rounded-full border-2 border-dashed border-ink-2/70"
        : `block h-full rounded-full ${over ? "bg-danger" : "bg-brand"}`,
  });
  // A zero bar draws nothing (a 0-width box would still show its dashed border).
  const show = scale > 0 && value > 0;
  if (show) fill.style.width = `max(4px, ${(value / scale) * 100}%)`;
  return el("span", { class: "block h-3 min-w-0 rounded-full bg-surface-2" }, show ? fill : null);
}

function barPair(t: Totals, scale: number, home: string): HTMLElement {
  const over = t.planned > 0 && t.spent > t.planned;
  return el(
    "div",
    { class: "grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 text-xs", attrs: { "aria-hidden": "true" } },
    el("span", { class: "text-ink-2", text: "Planned" }),
    bar("planned", t.planned, scale, false),
    el("span", { class: "text-right tabular-nums text-ink-2", text: formatMoney(t.planned, home) }),
    el("span", { class: "text-ink-2", text: "Spent" }),
    bar("spent", t.spent, scale, over),
    el("span", { class: "text-right font-semibold tabular-nums", text: formatMoney(t.spent, home) }),
  );
}

function diffTag(t: Totals, home: string): HTMLElement | null {
  if (t.planned === 0 && t.spent === 0) return null;
  const diff = difference(t, home);
  if (t.planned === 0) return el("span", { class: "tag tag-unplanned", text: "Unplanned" });
  if (t.spent === 0) return null;
  return el("span", { class: `tag ${diff > 0 ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"}`, text: diffText(diff, home) });
}

/**
 * Per-day bars: planned vs spent side by side for each day, as a list of
 * links into the day view. All days share one scale so they compare;
 * whole-trip costs are drawn separately (see wholeTripBars) because one
 * flight would otherwise flatten every day's bars.
 */
export function dayBars(trip: Trip, s: TripSummary): HTMLElement {
  const home = trip.homeCurrency;
  const scale = Math.max(0, ...s.days.map((d) => Math.max(d.totals.planned, d.totals.spent)));
  return el(
    "ol",
    { class: "grid grid-cols-1 gap-1" },
    ...s.days.map(({ date, totals: t }) => {
      const n = dayNumber(trip.startDate, date);
      const note = state.itinerary(trip.id, date).split("\n")[0] ?? "";
      const diff = difference(t, home);
      const spoken = `Day ${n}, ${formatDayDate(date)}. Planned ${formatMoney(t.planned, home)}, spent ${formatMoney(t.spent, home)}${t.planned > 0 && t.spent > 0 ? `, ${diffText(diff, home)}` : ""}${t.toPay > 0 ? `, ${formatMoney(t.toPay, home)} still to pay` : ""}.`;
      return el(
        "li",
        {},
        el(
          "a",
          { class: "grid gap-1.5 rounded-2xl p-3 transition hover:bg-surface-2", attrs: { href: href.day(trip.id, date), "aria-label": spoken } },
          el(
            "span",
            { class: "flex flex-wrap items-center justify-between gap-x-3 gap-y-1" },
            el("span", { class: "font-semibold" }, `Day ${n}`, el("span", { class: "font-normal text-ink-2", text: ` · ${formatDayDate(date)}` })),
            diffTag(t, home),
          ),
          note ? el("span", { class: "truncate text-sm text-ink-2", text: note }) : null,
          barPair(t, scale, home),
        ),
      );
    }),
  );
}

export function wholeTripBars(trip: Trip, t: Totals): HTMLElement {
  return barPair(t, Math.max(t.planned, t.spent), trip.homeCurrency);
}

/**
 * Donut of spending by category. Each slice is a stroke on a circle whose
 * circumference is exactly 100 units (r = 100 / 2π), so a slice's dash
 * length is simply its percentage.
 */
export function categoryDonut(trip: Trip, s: TripSummary, mode: "spent" | "planned"): HTMLElement {
  const home = trip.homeCurrency;
  const rows = CATEGORY_IDS.map((c) => ({ c, value: s.byCategory[c][mode] })).filter((r) => r.value > 0);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const NS = "http://www.w3.org/2000/svg";
  const R = 100 / (2 * Math.PI);
  const ring = (stroke: string, dash: string, offset: number): SVGCircleElement => {
    const c = document.createElementNS(NS, "circle");
    for (const [k, v] of Object.entries({ cx: 21, cy: 21, r: R, fill: "none", "stroke-width": 6, "stroke-dasharray": dash, "stroke-dashoffset": offset })) {
      c.setAttribute(k, String(v));
    }
    c.style.stroke = stroke;
    return c;
  };

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 42 42");
  svg.setAttribute("class", "size-full -rotate-90");
  svg.setAttribute("aria-hidden", "true");
  svg.append(ring("var(--surface-2)", "100 0", 0));
  // A thin gap between slices keeps neighbors apart even in similar hues.
  const gap = rows.length > 1 ? 0.8 : 0;
  let at = 0;
  for (const r of rows) {
    const pct = (r.value / total) * 100;
    svg.append(ring(CATEGORY_COLOR[r.c], `${Math.max(0.01, pct - gap)} ${100 - pct + gap}`, -at));
    at += pct;
  }

  const pct = (v: number): string => `${Math.round((v / total) * 100)}%`;
  const label = total > 0
    ? `${mode === "spent" ? "Spent" : "Planned"} by category: ${rows.map((r) => `${CATEGORY_LABEL[r.c]} ${formatMoney(r.value, home)}, ${pct(r.value)}`).join("; ")}.`
    : `Nothing ${mode} yet.`;

  return el(
    "div",
    { class: "grid items-center gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]", attrs: { role: "group", "aria-label": label } },
    el(
      "div",
      { class: "relative mx-auto size-44" },
      svg,
      el(
        "div",
        { class: "absolute inset-0 grid place-content-center text-center", attrs: { "aria-hidden": "true" } },
        el("span", { class: "text-xs font-semibold text-ink-2 uppercase", text: mode === "spent" ? "Spent" : "Planned" }),
        el("span", { class: "text-base font-extrabold tabular-nums", text: formatMoney(total, home) }),
      ),
    ),
    total > 0
      ? el(
          "ul",
          { class: "grid gap-2 text-sm", attrs: { "aria-hidden": "true" } },
          ...rows.map((r) => {
            const dot = el("span", { class: "cat-dot" });
            dot.style.backgroundColor = CATEGORY_COLOR[r.c];
            return el(
              "li",
              { class: "flex items-center gap-2" },
              dot,
              el("span", { class: "flex-1 font-semibold", text: CATEGORY_LABEL[r.c] }),
              el("span", { class: "tabular-nums", text: formatMoney(r.value, home) }),
              el("span", { class: "w-10 text-right tabular-nums text-ink-2", text: pct(r.value) }),
            );
          }),
        )
      : el("p", { class: "text-center text-sm text-ink-2 sm:text-left", text: mode === "spent" ? "Nothing paid yet. Paid expenses will show up here." : "No planned expenses yet." }),
  );
}
