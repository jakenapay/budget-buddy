import { el } from "../../ui/dom";
import { expected, summarizeTrip, type TripSummary } from "../model/calc";
import { tripCsv } from "../model/csv";
import { dayCount, formatRange, todayIso } from "../model/dates";
import { formatMoney, sumMoney } from "../model/money";
import type { Trip } from "../model/types";
import { href } from "../router";
import * as state from "../state";
import { categoryDonut, dayBars, wholeTripBars } from "../ui/charts";
import { openExpenseForm } from "../ui/expense-form";
import { expenseList } from "../ui/expense-list";
import { card, download, ico, meter, pageHead, slug, stat, toast } from "../ui/parts";
import { openTripForm } from "../ui/trip-form";

// Remembered for this visit only, so switching trips keeps the same donut view.
let donutMode: "spent" | "planned" = "spent";

export function renderOverview(trip: Trip): Node[] {
  const home = trip.homeCurrency;
  const expenses = state.tripExpenses(trip.id);
  const s = summarizeTrip(trip, expenses);
  const money = (v: number): string => formatMoney(v, home);
  const days = dayCount(trip.startDate, trip.endDate);

  const editBtn = el("button", { class: "btn btn-outline btn-sm", attrs: { type: "button", "data-key": "edit-trip" } }, ico("edit"), "Edit trip");
  editBtn.addEventListener("click", () => openTripForm(trip));
  const csvBtn = el("button", { class: "btn btn-outline btn-sm", attrs: { type: "button" } }, ico("download"), "CSV");
  csvBtn.setAttribute("aria-label", "Export this trip as CSV");
  csvBtn.addEventListener("click", () => {
    download(`${slug(trip.name, "trip")}-${todayIso()}.csv`, "text/csv;charset=utf-8", tripCsv(trip, expenses));
    toast("CSV saved.");
  });

  const head = pageHead({
    back: { href: href.trips(), label: "Trips" },
    title: trip.name,
    subtitle: [trip.destination, `${formatRange(trip.startDate, trip.endDate)} · ${days} day${days === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
    actions: [editBtn, csvBtn],
  });

  const addBtn = el("button", { class: "btn btn-primary fab", attrs: { type: "button", "data-key": "add" } }, ico("plus", "size-5"), "Add expense");
  addBtn.addEventListener("click", () => openExpenseForm(trip));

  const whole = expenses.filter((e) => e.date === null);
  const addWhole = el("button", { class: "btn btn-soft btn-sm mt-3", attrs: { type: "button", "data-key": "add-whole" } }, ico("plus"), "Add whole-trip expense");
  addWhole.addEventListener("click", () => openExpenseForm(trip, { date: null }));

  return [
    head,
    el(
      "div",
      { class: "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start" },
      el("div", { class: "grid min-w-0 grid-cols-1 gap-5" }, totalsCard(trip, s), budgetCard(trip, s), donutCard(trip, s)),
      el(
        "div",
        { class: "grid min-w-0 grid-cols-1 gap-5" },
        card(
          "Days",
          el("p", { class: "mb-3 text-sm text-ink-2", text: "Planned vs. spent for each day. Tap a day for its itinerary and expenses." }),
          dayBars(trip, s),
        ),
        card(
          "Whole trip",
          el("p", { class: "mb-3 text-sm text-ink-2", text: "Costs for the whole trip, like flights, hotel and SIM card. Kept out of the daily numbers." }),
          whole.length ? el("div", { class: "mb-4" }, wholeTripBars(trip, s.wholeTrip)) : null,
          expenseList(trip, whole, { empty: "No whole-trip expenses yet." }),
          addWhole,
        ),
      ),
    ),
    addBtn,
  ];

  function totalsCard(t: Trip, sum: TripSummary): HTMLElement {
    const total = expected(sum.all, home);
    // Before the trip the overview doubles as a pre-trip budget: what's
    // already paid plus what's still estimated.
    const line =
      sum.phase === "before" && (sum.all.spent > 0 || sum.all.toPay > 0)
        ? `Already paid ${money(sum.all.spent)} + ${money(sum.all.toPay)} estimated = ${money(total)} expected.`
        : sum.all.toPay > 0
          ? `Expected total: ${money(total)} (spent so far + still to pay).`
          : "";
    return card(
      "Totals",
      el(
        "dl",
        { class: "grid grid-cols-2 gap-2 sm:grid-cols-3" },
        stat("Planned", money(sum.all.planned), "Estimated cost"),
        stat("Spent", money(sum.all.spent), "Paid so far"),
        el("div", { class: "col-span-2 sm:col-span-1" }, stat("Still to pay", money(sum.all.toPay), "Planned, not paid")),
      ),
      line ? el("p", { class: "mt-3 text-sm", text: line }) : null,
      t.homeCurrency !== t.tripCurrency
        ? el("p", { class: "mt-2 text-xs text-ink-2", text: `All totals in ${home}, converted at the rate saved with each expense.` })
        : null,
    );
  }

  function budgetCard(t: Trip, sum: TripSummary): HTMLElement {
    const rows: Node[] = [];
    if (t.budget) {
      const left = sumMoney([t.budget, -sum.all.spent], home);
      const afterPlans = sumMoney([left, -sum.all.toPay], home);
      rows.push(
        el(
          "div",
          { class: "grid gap-1.5" },
          el(
            "p",
            { class: "flex flex-wrap justify-between gap-x-3 text-sm" },
            el("span", { class: "font-semibold", text: `Budget ${money(t.budget)}` }),
            el("span", { class: left < 0 ? "font-bold text-danger" : "font-semibold text-ok", text: left < 0 ? `${money(-left)} overspent` : `${money(left)} left` }),
          ),
          meter(sum.all.spent, t.budget, `Spent ${money(sum.all.spent)} of ${money(t.budget)} budget`),
          sum.all.toPay > 0
            ? el("p", { class: `text-xs ${afterPlans < 0 ? "font-semibold text-danger" : "text-ink-2"}`, text: afterPlans < 0 ? `After planned items: ${money(-afterPlans)} over budget.` : `After planned items: ${money(afterPlans)} left.` })
            : null,
        ),
      );
    }
    const avg = sum.averagePerDay;
    rows.push(
      el(
        "dl",
        { class: "grid grid-cols-2 gap-2" },
        stat(
          "Average per day",
          avg === null ? "–" : money(Math.round(avg * 100) / 100),
          avg === null ? "Starts on day 1" : `Over ${sum.daysElapsed} day${sum.daysElapsed === 1 ? "" : "s"}, excl. whole-trip`,
        ),
        stat("Daily budget", t.dailyBudget ? money(t.dailyBudget) : "None", t.dailyBudget && avg !== null ? (avg > t.dailyBudget ? "Average is over" : "Average is within") : "Set it in Edit trip"),
      ),
    );
    return card("Budget", el("div", { class: "grid gap-4" }, ...rows));
  }

  function donutCard(t: Trip, sum: TripSummary): HTMLElement {
    const box = el("div", {}, categoryDonut(t, sum, donutMode));
    const toggle = el(
      "div",
      { class: "mb-4 flex gap-1 rounded-full bg-surface-2 p-1", attrs: { role: "group", "aria-label": "Show" } },
      ...(["spent", "planned"] as const).map((mode) => {
        const b = el("button", { class: "segment aria-pressed:bg-brand-soft aria-pressed:text-brand-text aria-pressed:shadow-sm", text: mode === "spent" ? "Spent" : "Planned", attrs: { type: "button", "aria-pressed": String(mode === donutMode) } });
        b.addEventListener("click", () => {
          donutMode = mode;
          toggle.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          box.replaceChildren(categoryDonut(t, sum, mode));
        });
        return b;
      }),
    );
    return card("By category", toggle, box);
  }
}
