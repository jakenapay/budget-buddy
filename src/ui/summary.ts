import { SCHEMES, slotName } from "../model/groups";
import { formatMoney, formatPercent } from "../model/money";
import { slotVar } from "../model/palette";
import type { Plan, Summary } from "../model/state";
import { byId, el, setText } from "./dom";
import type { Render } from "./store";

export function mountSummary(): Render {
  const bar = byId<HTMLDivElement>("split-bar");
  const legend = byId<HTMLUListElement>("legend");
  const totalPay = byId("total-pay");
  const assigned = byId("total-assigned");
  const unassigned = byId("total-unassigned");
  const unassignedRow = byId("unassigned-row");
  const statusIcons = [...unassignedRow.querySelectorAll<SVGElement>("svg[data-icon]")];
  const hint = byId("unassigned-hint");
  const groups = byId<HTMLUListElement>("groups");
  const savings = byId("savings-rate");

  return (plan, summary) => {
    renderBar(bar, legend, plan, summary);

    const money = (minor: number): string => formatMoney(minor, plan.currency);
    setText(totalPay, money(plan.payMinor));
    setText(assigned, `${money(summary.assignedMinor)} · ${formatPercent(summary.assignedPercent)}%`);
    setText(unassigned, money(summary.unassignedMinor));
    unassignedRow.dataset["status"] = summary.status;
    // Status is shown by icon and words as well as color.
    statusIcons.forEach((svg) => svg.toggleAttribute("hidden", svg.dataset["icon"] !== summary.status));
    setText(hint, hintText(plan, summary));

    groups.replaceChildren(
      ...SCHEMES[plan.scheme].order.map((slot) => {
        const g = summary.groups[slot];
        // One hue for all three meters: they show size, not identity.
        const fill = el("span", { class: "block h-full rounded-full bg-brand" });
        fill.style.width = `${Math.min(100, g.percent)}%`;
        return el(
          "li",
          {},
          el(
            "div",
            { class: "flex items-baseline justify-between gap-3 text-sm" },
            el("span", { class: "font-semibold", text: slotName(plan.scheme, slot) }),
            el(
              "span",
              { class: "tabular-nums text-ink-2" },
              el("span", { class: "font-semibold text-ink", text: money(g.minor) }),
              ` · ${formatPercent(g.percent)}%`,
            ),
          ),
          el("span", { class: "mt-1.5 block h-2 overflow-hidden rounded-full bg-brand-soft", attrs: { "aria-hidden": "true" } }, fill),
        );
      }),
    );
    setText(savings, `${formatPercent(summary.savingsRate)}%`);
  };
}

function hintText(plan: Plan, s: Summary): string {
  const money = (minor: number): string => formatMoney(Math.abs(minor), plan.currency);
  switch (s.status) {
    case "nopay":
      return `Enter your take-home pay to see amounts. Your categories add up to ${formatPercent(s.assignedPercent)}%.`;
    case "balanced":
      return "Every part of your pay has a job. You're ready to save the PDF.";
    case "under":
      return `${money(s.unassignedMinor)} has no job yet. Add it to a category, or put it into savings.`;
    case "over":
      return `You've planned ${money(s.unassignedMinor)} more than you earn. Lower some percentages until Unassigned is zero.`;
  }
}

/**
 * Segment widths come from percentages. When the plan is over 100% the bar is
 * scaled to the total so everything still fits, and a marker shows where
 * 100% falls. The legend below repeats each row's number and name.
 */
function renderBar(bar: HTMLElement, legend: HTMLElement, plan: Plan, s: Summary): void {
  // Percents set from typed amounts carry float tails (99.99999…); within
  // half a hundredth of 100 counts as exactly 100.
  const total = Math.abs(s.assignedPercent - 100) < 0.005 ? 100 : s.assignedPercent;
  const scale = Math.max(100, total);
  const parts: string[] = [];
  const segments: HTMLElement[] = [];
  const keys: HTMLElement[] = [];

  const swatch = (color: string | null): HTMLElement => {
    const dot = el("span", { class: color ? "size-2.5 shrink-0 rounded-full" : "seg-empty size-2.5 shrink-0 rounded-full border border-line-strong" });
    if (color) dot.style.backgroundColor = color;
    return dot;
  };

  plan.categories.forEach((c, i) => {
    if (c.percent <= 0) return;
    const name = c.name || `Category ${i + 1}`;
    const label = `${name} ${formatPercent(c.percent)}%`;
    parts.push(label);
    const seg = el("span", { class: "seg", attrs: { title: label } });
    seg.style.width = `${(c.percent / scale) * 100}%`;
    seg.style.backgroundColor = slotVar(c.colorSlot);
    segments.push(seg);
    keys.push(
      el(
        "li",
        { class: "flex max-w-full min-w-0 items-center gap-1.5" },
        swatch(slotVar(c.colorSlot)),
        el("span", { class: "truncate", text: name }),
      ),
    );
  });

  if (total < 100) {
    const left = 100 - total;
    parts.push(`Unassigned ${formatPercent(left)}%`);
    const seg = el("span", { class: "seg seg-empty", attrs: { title: `Unassigned ${formatPercent(left)}%` } });
    seg.style.width = `${left}%`;
    segments.push(seg);
    keys.push(el("li", { class: "flex items-center gap-1.5" }, swatch(null), el("span", { text: "Unassigned" })));
  } else if (total > 100) {
    parts.push(`Over by ${formatPercent(total - 100)}%`);
    const marker = el("span", { class: "over-marker", attrs: { "aria-hidden": "true" } });
    marker.style.left = `${(100 / scale) * 100}%`;
    segments.push(marker);
  }

  bar.classList.toggle("ring-2", total > 100);
  bar.classList.toggle("ring-danger", total > 100);
  bar.setAttribute("aria-label", `Split of your pay: ${parts.join(", ") || "no categories"}`);
  bar.replaceChildren(...segments);
  legend.replaceChildren(...keys);
}
