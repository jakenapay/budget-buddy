import { el, setError, setText } from "../../ui/dom";
import { formatLongDate } from "../model/dates";
import { formatMoney, formatRate, roundMoney } from "../model/money";
import { askDirection, findRate, naturalDirection, setOverride } from "../model/rates";
import { parseRateInput } from "../model/validate";
import * as state from "../state";

export interface RateField {
  node: HTMLElement;
  /** Updates for a new currency (looks up a fresh rate unless the user typed one). */
  setCurrency(code: string): void;
  /** Shows "≈ ₱1,234.00" under the amount. */
  preview(amount: number | null): void;
  /** The rate as "1 currency = ? home", or null with an error shown. */
  read(): number | null;
  /**
   * After saving: if there was no standing rate for this pair, keep the typed
   * one as the default (Settings shows it as "Your rate"), so the next
   * expense in this currency doesn't ask again. Returns true if it did.
   */
  remember(): boolean;
}

/**
 * Shows the rate that will be saved with an expense, in money-changer form
 * ("1 PHP = 440 VND"), and lets the user type their own. A typed rate
 * applies to this expense; it only becomes the standing rate when there
 * wasn't one yet (see remember()).
 */
export function rateField(id: string, home: string, initialCurrency: string, initialRate: number | null): RateField {
  let currency = initialCurrency;
  let rate: number | null = initialRate;
  let typed = false;
  // The direction is fixed while the user types, so the field doesn't flip under them.
  let dir = { one: currency, other: home, value: 1 };

  const summary = el("p", { class: "text-sm text-ink-2" });
  const editBtn = el("button", { class: "link text-sm", text: "Change rate", attrs: { type: "button", "aria-expanded": "false", "aria-controls": `${id}-box` } });
  const oneLabel = el("span", { class: "affix-text text-sm" });
  const otherLabel = el("span", { class: "affix-text text-sm" });
  const input = el("input", {
    attrs: { id, type: "text", inputmode: "decimal", autocomplete: "off", "aria-describedby": `${id}-error` },
  });
  const flip = el("button", { class: "btn btn-outline btn-sm shrink-0", text: "Swap", attrs: { type: "button", "aria-label": "Swap rate direction" } });
  const error = el("p", { class: "error", attrs: { id: `${id}-error`, hidden: true } });
  const inputLabel = el("label", { class: "sr-only", attrs: { for: id } });
  const box = el("div", { class: "flex items-center gap-2", attrs: { id: `${id}-box`, hidden: true } }, inputLabel, el("div", { class: "affix flex-1" }, oneLabel, input, otherLabel), flip);
  const result = el("p", { class: "text-sm font-semibold tabular-nums", attrs: { "aria-live": "polite" } });
  const node = el("div", { class: "grid gap-2 rounded-2xl bg-surface-2 p-3" }, el("div", { class: "flex flex-wrap items-center justify-between gap-x-3 gap-y-1" }, summary, editBtn), box, error, result);
  let lastAmount: number | null = null;

  function sourceText(): string {
    if (typed) return "your rate";
    const found = findRate(currency, home, state.get().settings, state.get().rateCache);
    if (!found || rate !== found.rate) return "saved with this expense";
    if (found.source === "manual") return "your rate from Settings";
    const fetched = state.get().rateCache?.fetchedAt;
    return fetched ? `fetched ${formatLongDate(fetched.slice(0, 10))}` : "fetched";
  }

  function render(): void {
    const same = currency === home;
    node.hidden = same;
    if (same) return;
    if (rate === null) {
      setText(summary, `No ${currency} → ${home} rate yet. Enter the rate you got, or fetch rates in Settings.`);
      openBox();
    } else {
      const d = naturalDirection(currency, home, rate);
      setText(summary, `1 ${d.one} = ${formatRate(d.value)} ${d.other} · ${sourceText()}`);
    }
    renderPreview();
  }

  function openBox(): void {
    if (!box.hidden) return;
    dir = rate !== null ? naturalDirection(currency, home, rate) : { ...askDirection(currency, home), value: 0 };
    syncBox();
    box.hidden = false;
    editBtn.hidden = true;
    editBtn.setAttribute("aria-expanded", "true");
  }

  function syncBox(): void {
    setText(oneLabel, `1 ${dir.one} =`);
    setText(otherLabel, dir.other);
    setText(inputLabel, `Rate: how many ${dir.other} for 1 ${dir.one}`);
    input.value = dir.value ? formatRate(dir.value) : "";
  }

  function renderPreview(): void {
    if (currency === home || rate === null || lastAmount === null) return void setText(result, "");
    setText(result, `≈ ${formatMoney(roundMoney(lastAmount * rate, home), home)}`);
  }

  editBtn.addEventListener("click", () => {
    openBox();
    input.focus();
  });
  flip.addEventListener("click", () => {
    const r = parseRateInput(input.value);
    dir = { one: dir.other, other: dir.one, value: r.ok && r.value > 0 ? 1 / r.value : 0 };
    syncBox();
    input.focus();
  });
  input.addEventListener("input", () => {
    const r = parseRateInput(input.value);
    setError(input, error, r.ok || input.value.trim() === "" ? "" : r.error);
    if (r.ok) {
      typed = true;
      // Stored as "1 currency = ? home", whichever way the user typed it.
      rate = dir.one === currency ? r.value : 1 / r.value;
      setText(summary, `1 ${dir.one} = ${formatRate(r.value)} ${dir.other} · your rate`);
      renderPreview();
    }
  });

  render();
  return {
    node,
    setCurrency(code) {
      currency = code;
      typed = false;
      box.hidden = true;
      editBtn.hidden = false;
      editBtn.setAttribute("aria-expanded", "false");
      setError(input, error, "");
      rate = findRate(code, home, state.get().settings, state.get().rateCache)?.rate ?? null;
      render();
    },
    preview(amount) {
      lastAmount = amount;
      renderPreview();
    },
    read() {
      if (currency === home) return 1;
      // An open rate box is the source of truth, even if it was cleared.
      if (!box.hidden) {
        const r = parseRateInput(input.value);
        if (!r.ok || r.value === 0) {
          setError(input, error, r.ok ? "Enter the exchange rate for this currency." : r.error);
          input.focus();
          return null;
        }
        return dir.one === currency ? r.value : 1 / r.value;
      }
      if (rate === null || rate <= 0 || !Number.isFinite(rate)) {
        openBox();
        setError(input, error, "Enter the exchange rate for this currency.");
        input.focus();
        return null;
      }
      return rate;
    },
    remember() {
      if (currency === home || box.hidden) return false;
      if (findRate(currency, home, state.get().settings, state.get().rateCache)) return false;
      const r = parseRateInput(input.value);
      if (!r.ok || r.value <= 0) return false;
      void state.saveSettings({ overrides: setOverride(state.get().settings.overrides, { from: dir.one, to: dir.other, rate: r.value }) });
      return true;
    },
  };
}
