import { CURRENCIES, currencySymbol, formatPlain, isCurrency } from "../model/money";
import { setCurrency, setPay, setPayday, setPlanName } from "../model/state";
import { parsePay } from "../model/validate";
import { byId, el, setError, setText, setValue } from "./dom";
import type { Render, Store } from "./store";

export function mountInputs(store: Store): Render {
  const pay = byId<HTMLInputElement>("pay");
  const payError = byId<HTMLParagraphElement>("pay-error");
  const paySymbol = byId<HTMLSpanElement>("pay-symbol");
  const currency = byId<HTMLSelectElement>("currency");
  const planName = byId<HTMLInputElement>("plan-name");
  const payday = byId<HTMLInputElement>("payday");

  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  currency.replaceChildren(
    ...CURRENCIES.map((code) =>
      el("option", { text: `${code}: ${names.of(code) ?? code}`, attrs: { value: code } }),
    ),
  );

  const payText = (): string => {
    const plan = store.get();
    return plan.payMinor === 0 ? "" : formatPlain(plan.payMinor, plan.currency);
  };

  pay.addEventListener("input", () => {
    const r = parsePay(pay.value);
    setError(pay, payError, r.ok ? "" : r.error);
    if (r.ok) store.commit(setPay(store.get(), r.value));
  });
  // Tidy the number once the user leaves the field ("45000" → "45,000.00").
  pay.addEventListener("blur", () => {
    if (!pay.hasAttribute("aria-invalid")) pay.value = payText();
  });

  currency.addEventListener("change", () => {
    if (isCurrency(currency.value)) store.commit(setCurrency(store.get(), currency.value));
  });

  planName.addEventListener("input", () => store.commit(setPlanName(store.get(), planName.value)));
  planName.addEventListener("blur", () => (planName.value = store.get().name));

  payday.addEventListener("change", () => store.commit(setPayday(store.get(), payday.value)));

  return (plan) => {
    setValue(pay, payText());
    setText(paySymbol, currencySymbol(plan.currency));
    setValue(currency, plan.currency);
    setValue(planName, plan.name);
    setValue(payday, plan.payday);
  };
}
