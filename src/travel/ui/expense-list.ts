import { el } from "../../ui/dom";
import { dayNumber, formatShortDate } from "../model/dates";
import { formatMoney } from "../model/money";
import { CATEGORY_LABEL, type Expense, type Trip } from "../model/types";
import { categoryDot, ico } from "./parts";
import { openExpenseForm, openMarkPaid } from "./expense-form";

/** Unpaid plans first (they need action), then paid; each by date and time added. */
export function sortExpenses(list: readonly Expense[]): Expense[] {
  return [...list].sort(
    (a, b) =>
      (a.status === b.status ? 0 : a.status === "planned" ? -1 : 1) ||
      (a.date ?? "").localeCompare(b.date ?? "") ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export function expenseList(trip: Trip, list: readonly Expense[], opts: { showDay?: boolean; empty: string }): HTMLElement {
  if (list.length === 0) return el("p", { class: "rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-ink-2", text: opts.empty });
  return el("ul", { class: "grid grid-cols-1 gap-2" }, ...sortExpenses(list).map((e) => expenseRow(trip, e, opts.showDay ?? false)));
}

function expenseRow(trip: Trip, e: Expense, showDay: boolean): HTMLLIElement {
  const home = trip.homeCurrency;
  const paid = e.status === "actual";
  const homeValue = (paid ? e.amountHome : e.plannedAmountHome) ?? 0;
  const original = paid ? e.amount : e.plannedAmount;
  const foreign = e.currency !== home && original !== undefined;
  const title = e.note || CATEGORY_LABEL[e.category];

  const tags: (HTMLElement | null)[] = [
    paid
      ? e.plannedAmountHome === undefined
        ? el("span", { class: "tag tag-unplanned", text: "Unplanned" })
        : el("span", { class: "tag tag-paid" }, ico("check", "size-3"), "Paid")
      : el("span", { class: "tag tag-planned", text: "Planned" }),
    e.note ? el("span", { class: "text-xs text-ink-2", text: CATEGORY_LABEL[e.category] }) : null,
    showDay
      ? el("span", { class: "text-xs text-ink-2", text: e.date ? `Day ${dayNumber(trip.startDate, e.date)} · ${formatShortDate(e.date)}` : "Whole trip" })
      : null,
  ];

  const edit = el(
    "button",
    { class: "expense-main", attrs: { type: "button", "aria-label": `Edit ${title}`, "data-key": `edit-${e.id}` } },
    categoryDot(e.category),
    el(
      "span",
      { class: "grid min-w-0 flex-1 gap-0.5" },
      el("span", { class: "truncate font-semibold", text: title }),
      el("span", { class: "flex flex-wrap items-center gap-x-2 gap-y-0.5" }, ...tags),
    ),
    el(
      "span",
      { class: "grid shrink-0 justify-items-end gap-0.5 text-right" },
      el("span", { class: `font-semibold tabular-nums ${paid ? "" : "text-ink-2"}`, text: formatMoney(homeValue, home) }),
      foreign ? el("span", { class: "text-xs tabular-nums text-ink-2", text: formatMoney(original, e.currency) }) : null,
      paid && e.plannedAmountHome !== undefined && e.plannedAmountHome !== e.amountHome
        ? el("span", { class: "text-xs tabular-nums text-ink-2", text: `planned ${formatMoney(e.plannedAmountHome, home)}` })
        : null,
    ),
  );
  edit.addEventListener("click", () => openExpenseForm(trip, { expense: e }));

  let markPaid: HTMLButtonElement | null = null;
  if (!paid) {
    markPaid = el("button", { class: "btn btn-outline btn-sm shrink-0", attrs: { type: "button", "aria-label": `Mark ${title} as paid`, "data-key": `paid-${e.id}`, "data-key-fallback": `edit-${e.id}` } }, ico("check"), el("span", { class: "hidden sm:inline", text: "Mark as paid" }), el("span", { class: "max-[379px]:sr-only sm:hidden", text: "Paid" }));
    markPaid.addEventListener("click", () => openMarkPaid(trip, e));
  }
  return el("li", { class: "expense" }, edit, markPaid);
}
