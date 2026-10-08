import { el, setError } from "../../ui/dom";
import type { ThemeChoice } from "../../ui/theme";
import { formatLongDate, todayIso } from "../model/dates";
import { currencyName, formatRate } from "../model/money";
import { askDirection, clearOverride, fetchRates, findRate, naturalDirection, setOverride } from "../model/rates";
import { DEFAULT_SETTINGS, type TravelData } from "../model/types";
import { EXPORT_APP, EXPORT_VERSION, parseImport, parseRateInput } from "../model/validate";
import { href } from "../router";
import * as state from "../state";
import { card, currencyOptions, download, ico, pageHead, toast } from "../ui/parts";

let fetching = false;

export function renderSettings(applyTheme: (choice: ThemeChoice) => void): Node[] {
  const data = state.get();
  const settings = data.settings;

  // Home currency
  const homeSel = el("select", { class: "input", attrs: { id: "set-home" } });
  currencyOptions(homeSel, [], settings.homeCurrency);
  homeSel.addEventListener("change", () => void state.saveSettings({ homeCurrency: homeSel.value }));

  // Theme
  const theme = el(
    "fieldset",
    { class: "min-w-0" },
    el("legend", { class: "label mb-2", text: "Theme" }),
    el(
      "div",
      { class: "flex gap-1 rounded-full bg-surface-2 p-1" },
      ...(["system", "light", "dark"] as const).map((choice) => {
        const input = el("input", { class: "sr-only", attrs: { type: "radio", name: "theme", value: choice, id: `theme-${choice}` } });
        input.checked = settings.theme === choice;
        input.addEventListener("change", () => {
          applyTheme(choice);
          void state.saveSettings({ theme: choice });
        });
        return el("label", { class: "segment", attrs: { for: `theme-${choice}` } }, input, choice === "system" ? "Device" : choice === "light" ? "Light" : "Dark");
      }),
    ),
  );

  return [
    pageHead({ back: { href: href.trips(), label: "Trips" }, title: "Settings" }),
    el(
      "div",
      { class: "grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start" },
      el(
        "div",
        { class: "grid min-w-0 grid-cols-1 gap-5" },
        card(
          "General",
          el(
            "div",
            { class: "grid gap-5" },
            el(
              "div",
              { class: "grid gap-1.5" },
              el("label", { class: "label", text: "Home currency", attrs: { for: "set-home" } }),
              homeSel,
              el("p", { class: "text-xs text-ink-2", text: "The default for new trips, and the base for fetched rates. Existing trips keep their own home currency." }),
            ),
            theme,
            el(
              "div",
              { class: "flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3" },
              el("p", { class: "text-sm", text: "Want a refresher on how everything works?" }),
              el("button", { class: "btn btn-outline btn-sm", text: "Open the guide", attrs: { type: "button", "data-open-guide": true, "aria-haspopup": "dialog" } }),
            ),
          ),
        ),
        ratesCard(data),
      ),
      el("div", { class: "grid min-w-0 grid-cols-1 gap-5" }, backupCard(data), dangerCard()),
    ),
  ];
}

/** Every currency pair the trips need: each trip's currency and expense currencies against its home. */
function neededPairs(data: TravelData): [string, string][] {
  const seen = new Map<string, [string, string]>();
  const add = (from: string, to: string): void => {
    if (from !== to) seen.set(`${from}>${to}`, [from, to]);
  };
  for (const t of data.trips) add(t.tripCurrency, t.homeCurrency);
  for (const e of data.expenses) {
    const trip = data.trips.find((t) => t.id === e.tripId);
    if (trip) add(e.currency, trip.homeCurrency);
  }
  for (const o of data.settings.overrides) add(o.from, o.to);
  return [...seen.values()];
}

function ratesCard(data: TravelData): HTMLElement {
  const { settings, rateCache } = data;
  const status = el("p", { class: "text-sm text-ink-2", attrs: { "aria-live": "polite" } });
  status.textContent = rateCache
    ? `Last fetched ${formatLongDate(rateCache.fetchedAt.slice(0, 10))} (base ${rateCache.base}). Saved for offline use.`
    : "No rates fetched yet. Enter your own below, or fetch them.";

  const fetchBtn = el("button", { class: "btn btn-outline btn-sm", attrs: { type: "button" } }, ico("refresh"), "Fetch latest rates");
  fetchBtn.addEventListener("click", async () => {
    if (fetching) return;
    fetching = true;
    fetchBtn.disabled = true;
    fetchBtn.setAttribute("aria-busy", "true");
    status.textContent = "Fetching…";
    try {
      const cache = await fetchRates(state.get().settings.homeCurrency);
      await state.saveRates(cache); // re-renders this screen with the new rates
      toast("Exchange rates updated.");
    } catch (error) {
      console.error(error);
      status.textContent = navigator.onLine ? "Couldn't fetch rates. Try again later, or enter your own." : "You're offline. Your saved and manual rates still work.";
    } finally {
      fetching = false;
      fetchBtn.disabled = false;
      fetchBtn.removeAttribute("aria-busy");
    }
  });

  const pairs = neededPairs(data);
  const list = pairs.length
    ? el("ul", { class: "grid grid-cols-1 gap-2" }, ...pairs.map(([from, to]) => rateRow(from, to)))
    : el("p", { class: "text-sm text-ink-2", text: "Rates you need will show here once a trip uses another currency." });

  return card(
    "Exchange rates",
    el(
      "div",
      { class: "grid gap-4" },
      el(
        "p",
        { class: "text-sm" },
        "Each expense saves the rate used when you add or pay it, so old totals never change. A rate you enter here wins over a fetched one. ",
        "Fetching sends only your home currency code to ",
        el("a", { class: "link", text: "open.er-api.com", attrs: { href: "https://www.exchangerate-api.com", rel: "noopener noreferrer", target: "_blank" } }),
        ". Nothing else leaves this device.",
      ),
      el("div", { class: "flex flex-wrap items-center gap-3" }, fetchBtn, status),
      list,
      el("p", { class: "text-xs text-ink-2" }, el("a", { class: "underline", text: "Rates By Exchange Rate API", attrs: { href: "https://www.exchangerate-api.com", rel: "noopener noreferrer", target: "_blank" } })),
    ),
  );

  function rateRow(from: string, to: string): HTMLElement {
    const found = findRate(from, to, settings, rateCache);
    const d = found ? naturalDirection(from, to, found.rate) : { ...askDirection(from, to), value: 0 };
    const id = `rate-${from}-${to}`;
    const input = el("input", { attrs: { id, type: "text", inputmode: "decimal", autocomplete: "off", "aria-describedby": `${id}-error`, placeholder: "Rate" } });
    if (found) input.value = formatRate(d.value);
    const error = el("p", { class: "error", attrs: { id: `${id}-error`, hidden: true } });
    const source = el("span", {
      class: `tag ${found?.source === "manual" ? "bg-brand-soft text-brand-text" : found ? "bg-surface text-ink-2" : "tag-unplanned"}`,
      text: found?.source === "manual" ? "Your rate" : found ? "Fetched" : "Missing",
    });

    const save = (): void => {
      const r = parseRateInput(input.value);
      if (input.value.trim() === "") return void setError(input, error, "");
      setError(input, error, r.ok && r.value > 0 ? "" : r.ok ? "Enter a rate above 0." : r.error);
      if (!r.ok || r.value === 0) return;
      // Saved in the direction shown ("1 USD = 58.2 PHP"), exactly as typed.
      const current = findRate(from, to, state.get().settings, state.get().rateCache);
      const typed = d.one === from ? r.value : 1 / r.value;
      if (current && Math.abs(current.rate - typed) / typed < 1e-9) return;
      void state.saveSettings({ overrides: setOverride(state.get().settings.overrides, { from: d.one, to: d.other, rate: r.value }) });
      toast(`Saved: 1 ${d.one} = ${formatRate(r.value)} ${d.other}`);
    };
    input.addEventListener("change", save);

    const reset = found?.source === "manual" ? el("button", { class: "link text-xs", text: "Use fetched rate", attrs: { type: "button" } }) : null;
    reset?.addEventListener("click", () => void state.saveSettings({ overrides: clearOverride(state.get().settings.overrides, from, to) }));

    return el(
      "li",
      { class: "grid gap-2 rounded-2xl bg-surface-2 p-3" },
      el(
        "div",
        { class: "flex flex-wrap items-center justify-between gap-2" },
        el("span", { class: "text-sm font-semibold", text: `${currencyName(from)} → ${currencyName(to)}` }),
        source,
      ),
      el("label", { class: "sr-only", text: `How many ${d.other} for 1 ${d.one}`, attrs: { for: id } }),
      el(
        "div",
        { class: "affix bg-surface" },
        el("span", { class: "affix-text text-sm", text: `1 ${d.one} =` }),
        input,
        el("span", { class: "affix-text text-sm", text: d.other }),
      ),
      error,
      reset,
    );
  }
}

function backupCard(data: TravelData): HTMLElement {
  const exportBtn = el("button", { class: "btn btn-primary btn-sm", attrs: { type: "button" } }, ico("download"), "Export all (JSON)");
  exportBtn.addEventListener("click", () => {
    const d = state.get();
    const payload = { app: EXPORT_APP, version: EXPORT_VERSION, exportedAt: new Date().toISOString(), ...d };
    download(`budget-buddy-travel-${todayIso()}.json`, "application/json", JSON.stringify(payload, null, 2));
    toast("Backup saved.");
  });

  // The file input stays hidden; a real button opens it so focus and keyboard work like any button.
  const file = el("input", { attrs: { type: "file", accept: "application/json,.json", hidden: true, "aria-hidden": "true", tabindex: -1 } });
  const importBtn = el("button", { class: "btn btn-outline btn-sm", attrs: { type: "button" } }, ico("upload"), "Import JSON");
  importBtn.addEventListener("click", () => file.click());
  const result = el("p", { class: "text-sm", attrs: { "aria-live": "polite" } });
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    file.value = "";
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return void (result.textContent = "That file is too large to be a backup.");
    const parsed = parseImport(await f.text());
    if (!parsed.ok) return void (result.textContent = parsed.error);
    const n = parsed.data.trips.length;
    const msg = `Replace everything on this device with the backup (${n} trip${n === 1 ? "" : "s"}, ${parsed.data.expenses.length} expenses)? Your current trips will be removed.`;
    if (!window.confirm(msg)) return;
    // Someone restoring a backup has used the app already: don't pop the guide.
    await state.replaceAll({ ...parsed.data, settings: { ...parsed.data.settings, guideSeen: true } });
    toast(`Imported ${n} trip${n === 1 ? "" : "s"}${parsed.skipped ? `. ${parsed.skipped} invalid item${parsed.skipped === 1 ? " was" : "s were"} skipped` : ""}.`);
  });

  return card(
    "Backup",
    el(
      "div",
      { class: "grid gap-4" },
      el("p", {
        class: "text-sm",
        text: `Your ${data.trips.length} trip${data.trips.length === 1 ? " is" : "s are"} saved in this browser only. Clearing browser data deletes them, so export a backup now and then. You can also import it on another phone.`,
      }),
      el("div", { class: "flex flex-wrap gap-2" }, exportBtn, file, importBtn),
      result,
      el("p", { class: "text-xs text-ink-2", text: "For a spreadsheet, open a trip and use its CSV button." }),
    ),
  );
}

function dangerCard(): HTMLElement {
  const btn = el("button", { class: "btn btn-danger btn-sm", text: "Delete all travel data", attrs: { type: "button" } });
  btn.addEventListener("click", async () => {
    if (!window.confirm("Delete all trips, expenses, rates and settings from this device? This can't be undone.")) return;
    await state.replaceAll({ trips: [], days: [], expenses: [], settings: { ...DEFAULT_SETTINGS, theme: state.get().settings.theme, guideSeen: true }, rateCache: null });
    toast("All travel data deleted.");
  });
  return card("Delete data", el("p", { class: "mb-3 text-sm text-ink-2", text: "Removes everything the Travel page has saved on this device." }), btn);
}
