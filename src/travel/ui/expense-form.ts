import { el, setError, setText } from "../../ui/dom";
import { cleanText } from "../../model/validate";
import { paidCountsAsPlanned, summarizeTrip } from "../model/calc";
import { dayNumber, formatDayDate, todayIso, tripDates } from "../model/dates";
import { currencySymbol, formatMoney, formatPlain } from "../model/money";
import { findRate } from "../model/rates";
import { CATEGORY_IDS, CATEGORY_LABEL, type CategoryId, type Expense, type ExpenseStatus, type Trip } from "../model/types";
import { MAX_EXPENSES_PER_TRIP, MAX_NOTE, parseMoneyInput } from "../model/validate";
import * as state from "../state";
import { categoryDot, currencyOptions, field, toast } from "./parts";
import { rateField } from "./rate-field";
import { openSheet } from "./sheet";

/** A segmented two-way switch made of radio buttons. */
function segmented<T extends string>(name: string, legend: string, options: [T, string][], selected: T): {
  node: HTMLElement;
  value(): T;
  onChange(fn: (v: T) => void): void;
} {
  const inputs = options.map(([value, label]) => {
    const input = el("input", { class: "sr-only", attrs: { type: "radio", name, value, id: `${name}-${value}` } });
    input.checked = value === selected;
    return { input, label: el("label", { class: "segment", attrs: { for: `${name}-${value}` } }, input, label) };
  });
  return {
    node: el(
      "fieldset",
      { class: "min-w-0" },
      el("legend", { class: "sr-only", text: legend }),
      el("div", { class: "flex gap-1 rounded-full bg-surface-2 p-1" }, ...inputs.map((i) => i.label)),
    ),
    value: () => (inputs.find((i) => i.input.checked)?.input.value ?? selected) as T,
    onChange: (fn) => inputs.forEach((i) => i.input.addEventListener("change", () => i.input.checked && fn(i.input.value as T))),
  };
}

function amountInput(id: string, currency: string, value: number | undefined, describedBy: string): {
  wrap: HTMLElement;
  input: HTMLInputElement;
  symbol: HTMLSpanElement;
} {
  const symbol = el("span", { class: "affix-text text-lg font-semibold", text: currencySymbol(currency), attrs: { "aria-hidden": "true" } });
  const input = el("input", {
    class: "pr-4 text-2xl font-extrabold tracking-tight",
    attrs: { id, type: "text", inputmode: "decimal", autocomplete: "off", placeholder: "0", "aria-describedby": describedBy },
  });
  if (value !== undefined) input.value = formatPlain(value, currency);
  return { wrap: el("div", { class: "affix min-h-14 rounded-2xl" }, symbol, input), input, symbol };
}

/**
 * Quick add (and edit). Built for about three taps: type the amount, pick a
 * category, Save. Status, currency and day are already filled in from
 * context: today's day during the trip, Planned before it.
 */
export function openExpenseForm(trip: Trip, opts: { expense?: Expense; date?: string | null } = {}): void {
  const existing = opts.expense;
  const home = trip.homeCurrency;
  const today = todayIso();
  const phase = summarizeTrip(trip, []).phase;

  if (!existing && state.tripExpenses(trip.id).length >= MAX_EXPENSES_PER_TRIP) {
    toast(`A trip can have at most ${MAX_EXPENSES_PER_TRIP} expenses.`);
    return;
  }

  const status = segmented<ExpenseStatus>("status", "Status", [["planned", "Planned"], ["actual", "Paid"]], existing?.status ?? (phase === "before" ? "planned" : "actual"));

  const currency0 = existing?.currency ?? trip.tripCurrency;
  const amountValue = existing ? (existing.status === "actual" ? existing.amount : existing.plannedAmount) : undefined;
  const amount = amountInput("exp-amount", currency0, amountValue, "exp-amount-error");
  const amountField = field({ id: "exp-amount", label: "Amount", control: amount.wrap });

  // Only when editing a paid item that had an estimate: let the estimate be fixed too.
  const hasPlan = existing?.status === "actual" && existing.plannedAmount !== undefined;
  const planned = amountInput("exp-planned", currency0, existing?.plannedAmount, "exp-planned-error");
  planned.input.classList.replace("text-2xl", "text-lg");
  const plannedField = field({ id: "exp-planned", label: "Planned amount", hint: "Your estimate before paying.", control: planned.wrap });
  plannedField.node.hidden = !hasPlan;

  const currency = el("select", { class: "input", attrs: { id: "exp-currency" } });
  currencyOptions(currency, [trip.tripCurrency, home], currency0);
  const currencyField = field({ id: "exp-currency", label: "Currency", control: currency });

  const rate = rateField("exp-rate", home, currency0, existing ? existing.rateToHome : (findRate(currency0, home, state.get().settings, state.get().rateCache)?.rate ?? null));

  const cat0: CategoryId = existing?.category ?? "food";
  const cats = el(
    "fieldset",
    { class: "min-w-0" },
    el("legend", { class: "label mb-2", text: "Category" }),
    el(
      "div",
      { class: "grid grid-cols-2 gap-2 sm:grid-cols-3" },
      ...CATEGORY_IDS.map((c) => {
        const input = el("input", { class: "sr-only", attrs: { type: "radio", name: "category", value: c } });
        input.checked = c === cat0;
        return el("label", { class: "pick" }, input, categoryDot(c), CATEGORY_LABEL[c]);
      }),
    ),
  );

  const dates = tripDates(trip.startDate, trip.endDate);
  const defaultDate = existing ? existing.date : opts.date !== undefined ? opts.date : dates.includes(today) ? today : null;
  const day = el("select", { class: "input", attrs: { id: "exp-day" } });
  day.append(
    el("option", { text: "Whole trip (flights, hotel, SIM…)", attrs: { value: "" } }),
    ...dates.map((d) => el("option", { text: `Day ${dayNumber(trip.startDate, d)} · ${formatDayDate(d)}`, attrs: { value: d } })),
  );
  day.value = defaultDate ?? "";
  const dayField = field({ id: "exp-day", label: "Day", control: day });

  const note = el("input", { class: "input", attrs: { id: "exp-note", type: "text", maxlength: MAX_NOTE, placeholder: "e.g. Pho in the Old Quarter", autocomplete: "off" } });
  note.value = existing?.note ?? "";
  const noteField = field({ id: "exp-note", label: "Note", optional: true, control: note });

  const prePaid = el("p", { class: "text-xs text-ink-2", text: "Paid before the trip, so it also counts toward Planned." });

  function sync(): void {
    const paid = status.value() === "actual";
    setText(amountField.node.querySelector("label") ?? amountField.node, paid ? "Amount paid" : "Estimated amount");
    prePaid.hidden = !(paid && !existing && paidCountsAsPlanned(trip, today));
    const r = parseMoneyInput(amount.input.value);
    rate.preview(r.ok && amount.input.value.trim() ? r.value : null);
  }
  status.onChange(sync);
  amount.input.addEventListener("input", () => {
    const r = parseMoneyInput(amount.input.value);
    setError(amount.input, amountField.error, r.ok ? "" : r.error);
    sync();
  });
  currency.addEventListener("change", () => {
    const sym = currencySymbol(currency.value);
    setText(amount.symbol, sym);
    setText(planned.symbol, sym);
    rate.setCurrency(currency.value);
    sync();
  });

  const remove = existing
    ? el("button", { class: "btn btn-danger btn-sm mr-auto", text: "Delete", attrs: { type: "button" } })
    : null;
  remove?.addEventListener("click", () => {
    if (!existing || !window.confirm("Delete this expense?")) return;
    void state.removeExpense(existing.id);
    sheet.close();
    toast("Expense deleted.");
  });

  const sheet = openSheet({
    title: existing ? "Edit expense" : "Add expense",
    body: [status.node, prePaid, amountField.node, plannedField.node, el("div", { class: "grid gap-4 sm:grid-cols-2" }, currencyField.node, dayField.node), rate.node, cats, noteField.node],
    actions: [
      remove,
      el("button", { class: "btn btn-outline btn-sm", text: "Cancel", attrs: { type: "button", value: "cancel" } }),
      el("button", { class: "btn btn-primary", text: existing ? "Save changes" : "Add expense", attrs: { type: "submit" } }),
    ].filter((n): n is HTMLButtonElement => n !== null),
    onSubmit: save,
  });
  sheet.form.querySelector('button[value="cancel"]')?.addEventListener("click", sheet.close);
  sync();
  amount.input.focus();

  function save(): void {
    const a = parseMoneyInput(amount.input.value, { required: true });
    setError(amount.input, amountField.error, a.ok ? "" : a.error);
    const p = hasPlan ? parseMoneyInput(planned.input.value, { required: true }) : null;
    if (p) setError(planned.input, plannedField.error, p.ok ? "" : p.error);
    if (!a.ok) return amount.input.focus();
    if (p && !p.ok) return planned.input.focus();
    const r = rate.read();
    if (r === null) return;

    const category = (sheet.form.querySelector<HTMLInputElement>('input[name="category"]:checked')?.value ?? "other") as CategoryId;
    const e = state.buildExpense(
      {
        ...(existing ? { id: existing.id } : {}),
        tripId: trip.id,
        date: day.value || null,
        status: status.value(),
        category,
        note: cleanText(note.value, MAX_NOTE),
        amount: a.value,
        plannedAmount: p?.ok ? p.value : undefined,
        currency: currency.value,
        rateToHome: r,
      },
      existing,
      trip,
    );
    const remembered = rate.remember();
    void state.saveExpense(e);
    sheet.close();
    const shown = e.status === "actual" ? e.amountHome : e.plannedAmountHome;
    toast(`${existing ? "Saved" : "Added"}: ${CATEGORY_LABEL[e.category]} ${formatMoney(shown ?? 0, home)}${e.status === "planned" ? " (planned)" : ""}${remembered ? `. Your ${e.currency} rate is saved for next time.` : ""}`);
  }
}

/** "Mark as paid": the estimate is prefilled; usually you just confirm or fix the amount. */
export function openMarkPaid(trip: Trip, e: Expense): void {
  const home = trip.homeCurrency;
  const amount = amountInput("paid-amount", e.currency, e.plannedAmount, "paid-amount-error");
  const amountField = field({
    id: "paid-amount",
    label: "Amount paid",
    hint: e.plannedAmount !== undefined ? `Planned: ${formatMoney(e.plannedAmount, e.currency)}` : "",
    control: amount.wrap,
  });
  const current = findRate(e.currency, home, state.get().settings, state.get().rateCache)?.rate ?? e.rateToHome;
  const rate = rateField("paid-rate", home, e.currency, current);
  const preview = (): void => {
    const r = parseMoneyInput(amount.input.value);
    rate.preview(r.ok ? r.value : null);
  };
  amount.input.addEventListener("input", () => {
    const r = parseMoneyInput(amount.input.value);
    setError(amount.input, amountField.error, r.ok ? "" : r.error);
    preview();
  });

  const what = [CATEGORY_LABEL[e.category], e.note].filter(Boolean).join(" · ");
  const sheet = openSheet({
    title: "Mark as paid",
    body: [el("p", { class: "font-semibold", text: what }), amountField.node, rate.node],
    actions: [
      el("button", { class: "btn btn-outline btn-sm", text: "Cancel", attrs: { type: "button", value: "cancel" } }),
      el("button", { class: "btn btn-primary", text: "Mark as paid", attrs: { type: "submit" } }),
    ],
    onSubmit() {
      const a = parseMoneyInput(amount.input.value, { required: true });
      setError(amount.input, amountField.error, a.ok ? "" : a.error);
      if (!a.ok) return amount.input.focus();
      const r = rate.read();
      if (r === null) return;
      rate.remember();
      void state.markPaid(e, a.value, r, home);
      sheet.close();
      toast(`Marked as paid: ${formatMoney(a.value, e.currency)}`);
    },
  });
  sheet.form.querySelector('button[value="cancel"]')?.addEventListener("click", sheet.close);
  preview();
  amount.input.focus();
  amount.input.select();
}
