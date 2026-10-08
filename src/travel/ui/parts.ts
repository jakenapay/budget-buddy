import { el, icon } from "../../ui/dom";
import { formatMoney, currencyName, TRAVEL_CURRENCIES } from "../model/money";
import type { CategoryId } from "../model/types";

export const CATEGORY_COLOR: Record<CategoryId, string> = {
  food: "var(--series-2)",
  transport: "var(--series-1)",
  lodging: "var(--series-7)",
  activities: "var(--series-3)",
  shopping: "var(--series-5)",
  other: "var(--series-4)",
};

export const ICONS = {
  plus: ["M12 5v14", "M5 12h14"],
  back: ["M15 18l-6-6 6-6"],
  next: ["M9 18l6-6-6-6"],
  gear: [
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  ],
  edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  download: ["M12 4v11", "M7 10l5 5 5-5", "M5 20h14"],
  upload: ["M12 20V9", "M7 14l5-5 5 5", "M5 4h14"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  refresh: ["M21 12a9 9 0 1 1-2.6-6.4", "M21 4v5h-5"],
} as const;

export const ico = (name: keyof typeof ICONS, cls = "size-4"): SVGSVGElement => icon(ICONS[name], cls);

/** Top of every screen: optional back link, the title (focused on navigation), and actions. */
export function pageHead(opts: {
  back?: { href: string; label: string };
  title: string;
  subtitle?: string;
  actions?: Node[];
}): HTMLElement {
  return el(
    "div",
    { class: "mb-5" },
    opts.back ? el("a", { class: "back-link -ml-1 mb-1", attrs: { href: opts.back.href } }, ico("back"), opts.back.label) : null,
    el(
      "div",
      { class: "flex flex-wrap items-end justify-between gap-3" },
      el(
        "div",
        { class: "min-w-0" },
        el("h1", { class: "text-2xl font-extrabold tracking-tight wrap-anywhere sm:text-3xl", text: opts.title, attrs: { tabindex: -1, "data-autofocus": true } }),
        opts.subtitle ? el("p", { class: "mt-0.5 text-sm text-ink-2", text: opts.subtitle }) : null,
      ),
      opts.actions?.length ? el("div", { class: "flex flex-wrap gap-2" }, ...opts.actions) : null,
    ),
  );
}

export function card(title: string, ...children: (Node | null)[]): HTMLElement {
  const id = `h-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return el(
    "section",
    { class: "card min-w-0", attrs: { "aria-labelledby": id } },
    el("h2", { class: "mb-4 text-lg font-bold", text: title, attrs: { id } }),
    ...children,
  );
}

export function stat(label: string, value: string, note?: string): HTMLElement {
  return el(
    "div",
    { class: "stat" },
    el("dt", { text: label }),
    el("dd", { text: value }),
    note ? el("p", { class: "mt-0.5 text-xs text-ink-2", text: note }) : null,
  );
}

/** A progress meter. Over 100% fills red and says so in text nearby. */
export function meter(value: number, max: number, label: string): HTMLElement {
  const fill = el("span");
  const ratio = max > 0 ? value / max : 0;
  fill.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  return el(
    "span",
    {
      class: "meter",
      attrs: {
        role: "meter",
        "aria-label": label,
        "aria-valuemin": 0,
        "aria-valuemax": Math.round(max * 100) / 100,
        "aria-valuenow": Math.round(Math.min(value, max) * 100) / 100,
        "data-over": ratio > 1,
      },
    },
    fill,
  );
}

export function categoryDot(cat: CategoryId): HTMLElement {
  const dot = el("span", { class: "cat-dot", attrs: { "aria-hidden": "true" } });
  dot.style.backgroundColor = CATEGORY_COLOR[cat];
  return dot;
}

/** "₱320 over" / "₱180 under" / "on plan". Never relies on color alone. */
export function diffText(diff: number, home: string): string {
  if (diff === 0) return "on plan";
  return `${formatMoney(Math.abs(diff), home)} ${diff > 0 ? "over" : "under"}`;
}

/** Currency <option>s: the given codes first, then the common travel list. */
export function currencyOptions(select: HTMLSelectElement, first: readonly string[], selected: string): void {
  const codes = [...new Set([...first, selected, ...TRAVEL_CURRENCIES])];
  select.replaceChildren(
    ...codes.map((code) => el("option", { text: `${code}: ${currencyName(code)}`, attrs: { value: code } })),
  );
  select.value = selected;
}

let toastTimer = 0;
export function toast(message: string): void {
  const node = document.getElementById("toast");
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (node.hidden = true), 4500);
}

export function download(fileName: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = el("a", { attrs: { href: url, download: fileName } });
  document.body.append(a);
  a.click();
  a.remove();
  // Revoke on the next turn: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Vietnam 2026!" → "vietnam-2026". Letters, numbers and dashes only. */
export function slug(text: string, fallback: string): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return s || fallback;
}

/** A labeled form field with an optional hint and an error line. */
export function field(opts: { id: string; label: string; optional?: boolean; hint?: string; control: Node }): {
  node: HTMLElement;
  error: HTMLParagraphElement;
} {
  const error = el("p", { class: "error", attrs: { id: `${opts.id}-error`, hidden: true } });
  const node = el(
    "div",
    { class: "grid min-w-0 content-start gap-1.5" },
    el(
      "label",
      { class: "label", attrs: { for: opts.id } },
      opts.label,
      opts.optional ? el("span", { class: "font-normal text-ink-2", text: " (optional)" }) : null,
    ),
    opts.control,
    opts.hint ? el("p", { class: "text-xs text-ink-2", text: opts.hint, attrs: { id: `${opts.id}-hint` } }) : null,
    error,
  );
  return { node, error };
}
