import { el, setError } from "../../ui/dom";
import { cleanDate, cleanText } from "../../model/validate";
import { currencySymbol, formatPlain, roundMoney } from "../model/money";
import type { Trip } from "../model/types";
import { MAX_DESTINATION, MAX_TRIPS, MAX_TRIP_NAME, parseMoneyInput, tripDatesError } from "../model/validate";
import { go, href } from "../router";
import * as state from "../state";
import { currencyOptions, field, toast } from "./parts";
import { openSheet } from "./sheet";

export function openTripForm(existing?: Trip): void {
  if (!existing && state.get().trips.length >= MAX_TRIPS) {
    toast(`You can keep up to ${MAX_TRIPS} trips. Delete an old one first.`);
    return;
  }
  const settings = state.get().settings;
  const hasExpenses = existing ? state.tripExpenses(existing.id).length > 0 : false;

  const text = (id: string, max: number, value = "", placeholder = ""): HTMLInputElement => {
    const input = el("input", { class: "input", attrs: { id, type: "text", maxlength: max, autocomplete: "off", placeholder } });
    input.value = value;
    return input;
  };
  const dateInput = (id: string, value = ""): HTMLInputElement => {
    const input = el("input", { class: "input", attrs: { id, type: "date", autocomplete: "off" } });
    input.value = value;
    return input;
  };

  const name = text("trip-name", MAX_TRIP_NAME, existing?.name, "Vietnam 2026");
  const nameField = field({ id: "trip-name", label: "Trip name", control: name });
  const destination = text("trip-dest", MAX_DESTINATION, existing?.destination, "Hanoi and Ha Long Bay");
  const destField = field({ id: "trip-dest", label: "Destination", optional: true, control: destination });
  const start = dateInput("trip-start", existing?.startDate);
  const startField = field({ id: "trip-start", label: "Start date", control: start });
  const end = dateInput("trip-end", existing?.endDate);
  const endField = field({ id: "trip-end", label: "End date", control: end });
  // Picking a start date moves the end picker to the same month.
  start.addEventListener("change", () => {
    end.min = start.value;
    if (!end.value || end.value < start.value) end.value = start.value;
  });

  const homeSel = el("select", { class: "input", attrs: { id: "trip-home" } });
  currencyOptions(homeSel, [settings.homeCurrency], existing?.homeCurrency ?? settings.homeCurrency);
  homeSel.disabled = hasExpenses;
  const homeField = field({
    id: "trip-home",
    label: "Home currency",
    hint: hasExpenses ? "Locked: expenses were already converted to it." : "Totals and budgets use this.",
    control: homeSel,
  });
  const tripSel = el("select", { class: "input", attrs: { id: "trip-cur" } });
  currencyOptions(tripSel, [], existing?.tripCurrency ?? "VND");
  const tripField = field({ id: "trip-cur", label: "Trip currency", hint: "Default for new expenses.", control: tripSel });

  const money = (id: string, value?: number): { wrap: HTMLElement; input: HTMLInputElement; symbol: HTMLSpanElement } => {
    const home = existing?.homeCurrency ?? settings.homeCurrency;
    const symbol = el("span", { class: "affix-text", text: currencySymbol(home), attrs: { "aria-hidden": "true" } });
    const input = el("input", { attrs: { id, type: "text", inputmode: "decimal", autocomplete: "off", placeholder: "0", "aria-describedby": `${id}-error` } });
    if (value) input.value = formatPlain(value, home);
    return { wrap: el("div", { class: "affix" }, symbol, input), input, symbol };
  };
  const budget = money("trip-budget", existing?.budget);
  const budgetField = field({ id: "trip-budget", label: "Trip budget", optional: true, control: budget.wrap });
  const daily = money("trip-daily", existing?.dailyBudget);
  const dailyField = field({ id: "trip-daily", label: "Daily budget", optional: true, hint: "For per-day spending only.", control: daily.wrap });
  homeSel.addEventListener("change", () => {
    budget.symbol.textContent = currencySymbol(homeSel.value);
    daily.symbol.textContent = currencySymbol(homeSel.value);
  });

  const remove = existing ? el("button", { class: "btn btn-danger btn-sm mr-auto", text: "Delete trip", attrs: { type: "button" } }) : null;
  remove?.addEventListener("click", () => {
    if (!existing) return;
    const n = state.tripExpenses(existing.id).length;
    if (!window.confirm(`Delete “${existing.name}” and its ${n} expense${n === 1 ? "" : "s"}? This can't be undone.`)) return;
    void state.removeTrip(existing.id);
    sheet.close();
    toast("Trip deleted.");
    go(href.trips());
  });
  const cancel = el("button", { class: "btn btn-outline btn-sm", text: "Cancel", attrs: { type: "button" } });

  const sheet = openSheet({
    title: existing ? "Edit trip" : "New trip",
    body: [
      nameField.node,
      destField.node,
      el("div", { class: "grid grid-cols-2 gap-3" }, startField.node, endField.node),
      el("div", { class: "grid gap-4 sm:grid-cols-2" }, homeField.node, tripField.node),
      el("div", { class: "grid gap-4 sm:grid-cols-2" }, budgetField.node, dailyField.node),
    ],
    actions: [remove, cancel, el("button", { class: "btn btn-primary", text: existing ? "Save trip" : "Create trip", attrs: { type: "submit" } })].filter(
      (n): n is HTMLButtonElement => n !== null,
    ),
    onSubmit: save,
  });
  cancel.addEventListener("click", sheet.close);
  name.focus();

  function save(): void {
    const tripName = cleanText(name.value, MAX_TRIP_NAME);
    setError(name, nameField.error, tripName ? "" : "Give the trip a name.");
    const s = cleanDate(start.value);
    const e = cleanDate(end.value);
    const dateErr = tripDatesError(s, e);
    // A missing start is flagged on the start field; every other date problem on the end field.
    setError(start, startField.error, s ? "" : dateErr);
    setError(end, endField.error, s ? dateErr : "");
    const home = homeSel.value;
    const b = parseMoneyInput(budget.input.value);
    setError(budget.input, budgetField.error, b.ok ? "" : b.error);
    const d = parseMoneyInput(daily.input.value);
    setError(daily.input, dailyField.error, d.ok ? "" : d.error);

    const firstInvalid = sheet.form.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (firstInvalid || !tripName || dateErr || !b.ok || !d.ok) return void firstInvalid?.focus();

    if (existing) {
      const moved = state.expensesOutside(existing.id, s, e);
      if (moved > 0 && !window.confirm(`${moved} expense${moved === 1 ? " is" : "s are"} on days outside the new dates. ${moved === 1 ? "It" : "They"} will become whole-trip expenses. Continue?`)) {
        return;
      }
    }

    const trip: Trip = {
      id: existing?.id ?? state.newId(),
      name: tripName,
      startDate: s,
      endDate: e,
      homeCurrency: home,
      tripCurrency: tripSel.value,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const dest = cleanText(destination.value, MAX_DESTINATION);
    if (dest) trip.destination = dest;
    if (b.value > 0) trip.budget = roundMoney(b.value, home);
    if (d.value > 0) trip.dailyBudget = roundMoney(d.value, home);

    void state.saveTrip(trip);
    sheet.close();
    if (!existing) go(href.trip(trip.id));
    else toast("Trip saved.");
  }
}
