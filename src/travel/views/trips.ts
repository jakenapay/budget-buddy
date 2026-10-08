import { el } from "../../ui/dom";
import { expected, summarizeTrip, type Phase } from "../model/calc";
import { dayCount, formatRange } from "../model/dates";
import { formatMoney } from "../model/money";
import type { Trip } from "../model/types";
import { href } from "../router";
import * as state from "../state";
import { ico, meter, pageHead } from "../ui/parts";
import { openTripForm } from "../ui/trip-form";

const PHASE_LABEL: Record<Phase, string> = { before: "Upcoming", during: "On the trip", after: "Done" };

export function renderTrips(): Node[] {
  const trips = [...state.get().trips].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const newBtn = el("button", { class: "btn btn-primary", attrs: { type: "button", "data-key": "new-trip" } }, ico("plus"), "New trip");
  newBtn.addEventListener("click", () => openTripForm());

  const head = pageHead({
    title: "Trips",
    subtitle: "Plan what a trip will cost, then log what you really spend.",
    actions: [el("a", { class: "btn btn-outline", attrs: { href: href.settings() } }, ico("gear"), "Settings"), newBtn],
  });

  if (trips.length === 0) {
    const start = el("button", { class: "btn btn-primary mt-2", attrs: { type: "button" } }, ico("plus"), "Plan your first trip");
    start.addEventListener("click", () => openTripForm());
    return [
      head,
      el(
        "section",
        { class: "card grid justify-items-center gap-3 py-12 text-center" },
        el("h2", { class: "text-xl font-bold", text: "No trips yet" }),
        el("p", {
          class: "max-w-md text-ink-2",
          text: "Add a trip with its dates and each day gets its own page. Log flights and hotels for the whole trip, and food and tours for the day they happen. Estimates first, real costs as you pay.",
        }),
        el("div", { class: "flex flex-wrap justify-center gap-2" }, start, el("button", { class: "btn btn-outline mt-2", text: "How it works", attrs: { type: "button", "data-open-guide": true, "aria-haspopup": "dialog" } })),
      ),
    ];
  }
  return [head, el("ul", { class: "grid grid-cols-1 gap-4 md:grid-cols-2" }, ...trips.map(tripCard))];
}

function tripCard(trip: Trip): HTMLElement {
  const home = trip.homeCurrency;
  const s = summarizeTrip(trip, state.tripExpenses(trip.id));
  const total = expected(s.all, home);
  const money = (v: number): string => formatMoney(v, home);
  // The bar measures spending against the budget, or against the plan when there's no budget.
  const target = trip.budget ?? s.all.planned;
  const over = target > 0 && s.all.spent > target;
  const days = dayCount(trip.startDate, trip.endDate);

  const figure = (label: string, value: string): HTMLElement =>
    el("div", { class: "min-w-0" }, el("dt", { class: "text-xs text-ink-2", text: label }), el("dd", { class: "font-bold whitespace-nowrap tabular-nums", text: value }));

  return el(
    "li",
    { class: "min-w-0" },
    el(
      "a",
      { class: "card grid h-full grid-cols-1 gap-4 transition hover:border-brand/50", attrs: { href: href.trip(trip.id) } },
      el(
        "div",
        { class: "flex items-start justify-between gap-3" },
        el(
          "div",
          { class: "min-w-0" },
          el("h2", { class: "truncate text-lg font-bold", text: trip.name }),
          el("p", { class: "text-sm text-ink-2", text: [trip.destination, `${formatRange(trip.startDate, trip.endDate)} · ${days} day${days === 1 ? "" : "s"}`].filter(Boolean).join(" · ") }),
        ),
        el("span", { class: `tag shrink-0 ${s.phase === "during" ? "bg-brand-soft text-brand-text" : "bg-surface-2 text-ink-2"}`, text: PHASE_LABEL[s.phase] }),
      ),
      el(
        "dl",
        // Three across when they fit; on narrow cards Budget moves to a second row
        // instead of numbers breaking mid-digit.
        { class: "grid grid-cols-[repeat(auto-fit,minmax(6.75rem,1fr))] gap-3" },
        figure("Spent", money(s.all.spent)),
        figure("Planned", money(s.all.planned)),
        figure("Budget", trip.budget ? money(trip.budget) : "None"),
      ),
      target > 0
        ? el(
            "div",
            { class: "grid gap-1.5" },
            meter(s.all.spent, target, `Spent ${money(s.all.spent)} of ${trip.budget ? "budget" : "planned"} ${money(target)}`),
            el("p", {
              class: `text-xs ${over ? "font-semibold text-danger" : "text-ink-2"}`,
              text: over
                ? `${money(s.all.spent - target)} over ${trip.budget ? "budget" : "plan"}`
                : `${Math.round((s.all.spent / target) * 100)}% of ${trip.budget ? "budget" : "plan"} spent · expected total ${money(total)}`,
            }),
          )
        : el("p", { class: "text-xs text-ink-2", text: "No expenses yet. Open the trip to add some." }),
    ),
  );
}
