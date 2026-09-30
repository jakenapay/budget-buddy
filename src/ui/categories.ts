import { SCHEMES, SLOTS, isScheme, isSlot, slotName, type Scheme } from "../model/groups";
import { currencySymbol, formatPercent, formatPlain, toMajor } from "../model/money";
import {
  addCategory,
  applyTemplate,
  removeCategory,
  setAmount,
  setCategoryName,
  setPercent,
  setScheme,
  setSlot,
  type Category,
  type Plan,
} from "../model/state";
import { TEMPLATES, isTemplateId } from "../model/templates";
import { MAX_CATEGORIES, MAX_CATEGORY_NAME, parseAmount, parsePercent } from "../model/validate";
import { slotVar } from "../model/palette";
import { byId, el, icon, setError, setText, setValue } from "./dom";
import type { Render, Store } from "./store";

interface Row {
  li: HTMLLIElement;
  num: HTMLSpanElement;
  name: HTMLInputElement;
  nameLabel: HTMLLabelElement;
  slot: HTMLSelectElement;
  slotLabel: HTMLLabelElement;
  pct: HTMLInputElement;
  pctLabel: HTMLLabelElement;
  amt: HTMLInputElement;
  amtLabel: HTMLLabelElement;
  symbol: HTMLSpanElement;
  del: HTMLButtonElement;
  error: HTMLParagraphElement;
}

export function mountCategories(store: Store): Render {
  const list = byId<HTMLOListElement>("categories");
  const empty = byId<HTMLParagraphElement>("cat-empty");
  const addBtn = byId<HTMLButtonElement>("add-cat");
  const addHint = byId<HTMLParagraphElement>("add-hint");
  const chipsBox = byId<HTMLDivElement>("templates");
  const schemeBox = byId<HTMLDivElement>("scheme");
  const rows = new Map<number, Row>();

  // Template chips
  const chips = Object.entries(TEMPLATES).map(([id, t]) => {
    const chip = el(
      "button",
      { class: "chip", attrs: { type: "button", "data-id": id } },
      el("span", { class: "font-semibold", text: t.label }),
      el("span", { class: "hidden text-xs text-ink-2 sm:block", text: t.blurb }),
    );
    chip.addEventListener("click", () => {
      const plan = store.get();
      if (!isTemplateId(id)) return;
      if (plan.dirty && !window.confirm(`Replace your categories with the ${t.label} template? Your pay stays the same.`)) {
        return;
      }
      store.commit(applyTemplate(plan, id));
    });
    return chip;
  });
  chipsBox.replaceChildren(...chips);

  // Group-by switch (radio buttons styled as a segmented control)
  const radios = (Object.keys(SCHEMES) as Scheme[]).map((key) => {
    const input = el("input", { class: "sr-only", attrs: { type: "radio", name: "scheme", value: key, id: `scheme-${key}` } });
    input.addEventListener("change", () => {
      if (input.checked && isScheme(key)) store.commit(setScheme(store.get(), key));
    });
    schemeBox.append(el("label", { class: "segment", attrs: { for: `scheme-${key}` } }, input, SCHEMES[key].label));
    return input;
  });

  addBtn.addEventListener("click", () => {
    store.commit(addCategory(store.get()));
    const last = store.get().categories.at(-1);
    if (last) rows.get(last.id)?.name.focus();
  });

  function createRow(c: Category): Row {
    const id = c.id;
    const fid = (part: string): string => `cat-${id}-${part}`;
    const hidden = (forId: string): HTMLLabelElement => el("label", { class: "sr-only", attrs: { for: forId } });

    // Color dot matching the row's segment in the split bar and legend.
    const num = el("span", { class: "cat-num size-3 rounded-full", attrs: { "aria-hidden": "true" } });
    const nameLabel = hidden(fid("name"));
    const name = el("input", {
      class: "input cat-name font-medium",
      attrs: { id: fid("name"), type: "text", maxlength: MAX_CATEGORY_NAME, autocomplete: "off", placeholder: "Category name" },
    });
    const slotLabel = hidden(fid("slot"));
    const slot = el("select", { class: "input cat-slot pr-0.5 pl-2", attrs: { id: fid("slot") } });
    slot.append(...SLOTS.map((s) => el("option", { attrs: { value: s } })));
    const pctLabel = hidden(fid("pct"));
    const pct = el("input", {
      attrs: { id: fid("pct"), type: "text", inputmode: "decimal", autocomplete: "off", "aria-describedby": fid("err") },
    });
    const amtLabel = hidden(fid("amt"));
    const amt = el("input", {
      attrs: { id: fid("amt"), type: "text", inputmode: "decimal", autocomplete: "off", "aria-describedby": fid("err") },
    });
    const symbol = el("span", { class: "affix-text", attrs: { "aria-hidden": "true" } });
    const del = el("button", { class: "icon-btn", attrs: { type: "button" } }, icon(["M6 6l12 12", "M18 6 6 18"], "size-5"));
    const error = el("p", { class: "error", attrs: { id: fid("err"), hidden: true } });

    const li = el(
      "li",
      { class: "cat" },
      num,
      el("div", { class: "cat-cell cat-name-cell" }, nameLabel, name),
      el("div", { class: "cat-cell cat-slot-cell" }, slotLabel, slot),
      el("div", { class: "cat-cell cat-pct-cell" }, pctLabel, el("div", { class: "affix" }, pct, el("span", { class: "affix-text", text: "%", attrs: { "aria-hidden": "true" } }))),
      el("div", { class: "cat-cell cat-amt-cell" }, amtLabel, el("div", { class: "affix" }, symbol, amt)),
      del,
      error,
    );

    name.addEventListener("input", () => store.commit(setCategoryName(store.get(), id, name.value)));
    name.addEventListener("blur", () => (name.value = store.get().categories.find((x) => x.id === id)?.name ?? ""));

    slot.addEventListener("change", () => {
      if (isSlot(slot.value)) store.commit(setSlot(store.get(), id, slot.value));
    });

    // Percent and amount are two views of one number (the percent). Each
    // field writes the percent; the other field is refreshed by render().
    // Only one error can be showing per row, so editing either field clears it.
    const clearErrors = (): void => {
      pct.removeAttribute("aria-invalid");
      amt.removeAttribute("aria-invalid");
    };
    pct.addEventListener("input", () => {
      const r = parsePercent(pct.value);
      clearErrors();
      setError(pct, error, r.ok ? "" : r.error);
      if (r.ok) store.commit(setPercent(store.get(), id, r.value));
    });
    amt.addEventListener("input", () => {
      const plan = store.get();
      const r = parseAmount(amt.value, toMajor(plan.payMinor, plan.currency));
      clearErrors();
      setError(amt, error, r.ok ? "" : r.error);
      if (r.ok) store.commit(setAmount(plan, id, r.value));
    });
    // Leaving a valid field shows the tidy form of the stored value.
    const tidy = (): void => {
      if (!pct.hasAttribute("aria-invalid") && !amt.hasAttribute("aria-invalid")) store.commit(store.get());
    };
    pct.addEventListener("blur", tidy);
    amt.addEventListener("blur", tidy);

    del.addEventListener("click", () => {
      const before = store.get().categories;
      const index = before.findIndex((x) => x.id === id);
      store.commit(removeCategory(store.get(), id));
      // Keep keyboard focus in the list: next row, else previous, else Add.
      const after = store.get().categories;
      const target = after[index] ?? after[index - 1];
      (target ? rows.get(target.id)?.del : addBtn)?.focus();
    });

    return { li, num, name, nameLabel, slot, slotLabel, pct, pctLabel, amt, amtLabel, symbol, del, error };
  }

  function updateRow(row: Row, c: Category, index: number, amount: number, plan: Plan): void {
    const label = c.name || `Category ${index + 1}`;
    row.num.style.backgroundColor = slotVar(c.colorSlot);
    setValue(row.name, c.name);
    setText(row.nameLabel, `Category ${index + 1} name`);
    setText(row.slotLabel, `${label}: type`);
    setText(row.pctLabel, `${label}: percent`);
    setText(row.amtLabel, `${label}: amount`);
    row.del.setAttribute("aria-label", `Delete ${label}`);

    [...row.slot.options].forEach((o) => {
      if (isSlot(o.value)) setText(o, slotName(plan.scheme, o.value));
    });
    setValue(row.slot, c.slot);

    setValue(row.pct, formatPercent(c.percent));
    setText(row.symbol, currencySymbol(plan.currency));
    // With no pay there is nothing to split, so amounts can't be edited.
    row.amt.disabled = plan.payMinor === 0;
    setValue(row.amt, formatPlain(amount, plan.currency));
  }

  // Blurring a field commits the plan unchanged just to re-render; skip the
  // DOM rebuild unless the list of rows actually changed.
  let lastOrder = "";

  return (plan, summary) => {
    const order = plan.categories.map((c) => c.id).join(",");
    if (order !== lastOrder) {
      lastOrder = order;
      const keep = new Set(plan.categories.map((c) => c.id));
      for (const id of rows.keys()) if (!keep.has(id)) rows.delete(id);
      const lis = plan.categories.map((c) => {
        let row = rows.get(c.id);
        if (!row) rows.set(c.id, (row = createRow(c)));
        return row.li;
      });
      list.replaceChildren(...lis);
    }

    plan.categories.forEach((c, i) => {
      const row = rows.get(c.id);
      if (row) updateRow(row, c, i, summary.amounts[i] ?? 0, plan);
    });

    // Measure rather than guess: whether an amount fits depends on the screen
    // width, the font and the currency. Test the compact layout first, and
    // switch every row to the stacked one if any amount would be clipped.
    list.classList.remove("stack-amounts");
    const clipped = [...rows.values()].some((r) => r.amt.scrollWidth > r.amt.clientWidth + 1);
    list.classList.toggle("stack-amounts", clipped);

    empty.hidden = plan.categories.length > 0;
    const full = plan.categories.length >= MAX_CATEGORIES;
    addBtn.disabled = full;
    setText(
      addHint,
      full ? `You've reached the maximum of ${MAX_CATEGORIES} categories.` : `${plan.categories.length} of ${MAX_CATEGORIES} categories`,
    );

    chips.forEach((chip) => {
      const active = !plan.dirty && chip.dataset["id"] === plan.template;
      chip.setAttribute("aria-pressed", String(active));
    });
    radios.forEach((r) => (r.checked = r.value === plan.scheme));
  };
}
