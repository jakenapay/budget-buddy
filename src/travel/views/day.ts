import { el } from "../../ui/dom";
import { difference, totals } from "../model/calc";
import { dayNumber, formatDayDate, tripDates } from "../model/dates";
import { formatMoney, sumMoney } from "../model/money";
import type { Trip } from "../model/types";
import { MAX_ITINERARY, cleanItinerary } from "../model/validate";
import { href } from "../router";
import * as state from "../state";
import { openExpenseForm } from "../ui/expense-form";
import { expenseList } from "../ui/expense-list";
import { card, diffText, ico, meter, pageHead, stat } from "../ui/parts";

export function renderDay(trip: Trip, date: string): Node[] {
  const home = trip.homeCurrency;
  const money = (v: number): string => formatMoney(v, home);
  const dates = tripDates(trip.startDate, trip.endDate);
  const i = dates.indexOf(date);
  const n = dayNumber(trip.startDate, date);
  const expenses = state.tripExpenses(trip.id).filter((e) => e.date === date);
  const t = totals(expenses, home);
  const diff = difference(t, home);

  const step = (to: string | undefined, label: string, dir: "back" | "next"): HTMLElement =>
    to
      ? el("a", { class: "btn btn-outline btn-sm", attrs: { href: href.day(trip.id, to), "aria-label": `${label}: Day ${dayNumber(trip.startDate, to)}` } }, dir === "back" ? ico("back") : null, label, dir === "next" ? ico("next") : null)
      : el("span", { class: "btn btn-outline btn-sm pointer-events-none opacity-40", attrs: { "aria-hidden": "true" } }, label);

  const head = pageHead({
    back: { href: href.trip(trip.id), label: trip.name },
    title: `Day ${n}`,
    subtitle: `${formatDayDate(date)} · of ${dates.length}`,
    actions: [step(dates[i - 1], "Previous", "back"), step(dates[i + 1], "Next", "next")],
  });

  // Itinerary: saved as you type (debounced) and once more on leaving the field.
  const itinerary = el("textarea", {
    class: "input min-h-24 py-2 leading-relaxed",
    attrs: { id: "itinerary", maxlength: MAX_ITINERARY, rows: 3, placeholder: "Old Quarter → Hoan Kiem Lake → water puppet show", "aria-describedby": "itinerary-hint" },
  });
  itinerary.value = state.itinerary(trip.id, date);
  const saved = el("p", { class: "text-xs text-ink-2", attrs: { id: "itinerary-hint", "aria-live": "polite" }, text: "Saved on this device as you type." });
  let timer = 0;
  const saveNote = (): void => {
    window.clearTimeout(timer);
    const clean = cleanItinerary(itinerary.value);
    if (clean !== state.itinerary(trip.id, date)) void state.setItinerary(trip.id, date, clean);
  };
  itinerary.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(saveNote, 500);
  });
  itinerary.addEventListener("blur", saveNote);

  const summaryLine =
    t.planned === 0 && t.spent === 0
      ? "Nothing planned or spent yet."
      : `Planned ${money(t.planned)}, spent ${money(t.spent)}${t.planned > 0 && t.spent > 0 ? ` (${diffText(diff, home)})` : ""}.`;

  const budgetRow: Node | null = trip.dailyBudget
    ? (() => {
        const left = sumMoney([trip.dailyBudget, -t.spent], home);
        return el(
          "div",
          { class: "mt-4 grid gap-1.5" },
          el(
            "p",
            { class: "flex flex-wrap justify-between gap-x-3 text-sm" },
            el("span", { class: "font-semibold", text: `Daily budget ${money(trip.dailyBudget)}` }),
            el("span", { class: left < 0 ? "font-bold text-danger" : "font-semibold text-ok", text: left < 0 ? `${money(-left)} over` : `${money(left)} left` }),
          ),
          meter(t.spent, trip.dailyBudget, `Spent ${money(t.spent)} of ${money(trip.dailyBudget)} daily budget`),
        );
      })()
    : null;

  const addBtn = el("button", { class: "btn btn-primary fab", attrs: { type: "button", "data-key": "add" } }, ico("plus", "size-5"), "Add expense");
  addBtn.addEventListener("click", () => openExpenseForm(trip, { date }));

  return [
    head,
    el(
      "div",
      { class: "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start" },
      el(
        "div",
        { class: "grid min-w-0 grid-cols-1 gap-5" },
        card("Itinerary", el("label", { class: "sr-only", text: `Itinerary for day ${n}`, attrs: { for: "itinerary" } }), itinerary, el("div", { class: "mt-1.5" }, saved)),
        card(
          "This day",
          el(
            "dl",
            { class: "grid grid-cols-2 gap-2 sm:grid-cols-3" },
            stat("Planned", money(t.planned)),
            stat("Spent", money(t.spent)),
            el("div", { class: "col-span-2 sm:col-span-1" }, stat("Still to pay", money(t.toPay))),
          ),
          el("p", { class: `mt-3 text-sm ${diff > 0 && t.planned > 0 ? "font-semibold text-danger" : ""}`, text: summaryLine }),
          budgetRow,
        ),
      ),
      card(
        "Expenses",
        el("p", { class: "mb-3 text-sm text-ink-2", text: "Planned items show “Mark as paid”. Tap any item to edit it." }),
        expenseList(trip, expenses, { empty: "Nothing for this day yet. Add a planned cost (like a tour) or something you've paid." }),
      ),
    ),
    addBtn,
  ];
}
