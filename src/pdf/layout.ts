import { SCHEMES, slotName } from "../model/groups";
import { formatPercent, formatPlain, formatWithCode } from "../model/money";
import { slotRgbLight, type RGB } from "../model/palette";
import type { Plan, Summary } from "../model/state";
import { fitText, toPdfText, type Measure } from "./text";

/*
 * One A4 portrait page, in millimetres, laid out top to bottom:
 *
 *   header (plan name, date, pay, payday)            fixed height
 *   split bar + legend (4 columns)                   grows with legend rows
 *   category table | bar chart, sharing each row     rows scale to fit
 *   group totals | assigned / unassigned             fixed height
 *   footer                                           pinned to the bottom
 *
 * Fitting one page: everything except the category rows has a known
 * height, so the rows get whatever is left, divided by the number of
 * categories (capped at 8 mm, never below 4.5 mm). With 20 categories they
 * still get about 7 mm. Putting the table and the bar chart side by side
 * in the same row is what makes that possible: each category costs one
 * row, not two. Every piece of text is measured with the real font metrics
 * and shortened with "..." if it would overflow its column. The tests
 * check the result for 1–20 categories: nothing leaves the page and no two
 * pieces of text overlap.
 */

export const PAGE_W = 210;
export const PAGE_H = 297;
export const MARGIN = 14;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const RIGHT = PAGE_W - MARGIN;
/** mm per typographic point */
const PT = 25.4 / 72;
export const FOOTER_TOP = PAGE_H - 16;
const SUMMARY_H = 36;
const MAX_ROW = 8;
const MIN_ROW = 4.5;

const INK: RGB = [33, 37, 41];
const MUTED: RGB = [92, 97, 105];
const RULE: RGB = [210, 212, 216];
const ZEBRA: RGB = [244, 245, 247];
const WHITE: RGB = [255, 255, 255];
const EMPTY_FILL: RGB = [238, 238, 238];
const EMPTY_STROKE: RGB = [130, 130, 130];
const STATUS_FILL: Record<Summary["status"], RGB> = {
  balanced: [224, 244, 230],
  under: [253, 240, 212],
  over: [252, 226, 232],
  nopay: [238, 238, 238],
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RectOp {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: RGB;
  stroke?: RGB;
  lineWidth?: number;
  radius?: number;
}
export interface LineOp {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: RGB;
  width: number;
}
export interface TextOp {
  kind: "text";
  /** Anchor point: jsPDF draws text on its baseline at (x, y). */
  x: number;
  y: number;
  text: string;
  size: number;
  bold: boolean;
  color: RGB;
  align: "left" | "right" | "center";
  /** The area the text actually covers, for the overlap tests. */
  box: Box;
  /** True if the text was shortened with "...". */
  truncated: boolean;
}
export type Op = RectOp | LineOp | TextOp;

export interface PdfLayout {
  ops: Op[];
  rowHeight: number;
  fontSize: number;
}

export interface PdfInput {
  plan: Plan;
  summary: Summary;
  generated: Date;
}

interface TextOpts {
  bold?: boolean;
  color?: RGB;
  align?: TextOp["align"];
  maxWidth?: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Ink or white, whichever reads better on a filled color. */
function inkOn([r, g, b]: RGB): RGB {
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.4 ? INK : WHITE;
}

const LONG_DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });
const LONG_DATE_UTC = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });

export function layoutPdf({ plan, summary, generated }: PdfInput, measure: Measure): PdfLayout {
  const ops: Op[] = [];
  const currency = plan.currency;
  const nameOf = (i: number): string => plan.categories[i]?.name || `Category ${i + 1}`;

  /** Adds a text op and returns its width. */
  const text = (raw: string, x: number, y: number, size: number, o: TextOpts = {}): number => {
    const bold = o.bold ?? false;
    const align = o.align ?? "left";
    const clean = toPdfText(raw);
    const shown = o.maxWidth === undefined ? clean : fitText(clean, o.maxWidth, size, bold, measure);
    const w = measure(shown, size, bold);
    const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
    const em = size * PT;
    // Helvetica's ascenders reach ~0.75 em above the baseline and its
    // descenders ~0.22 em below it.
    ops.push({
      kind: "text", x, y, text: shown, size, bold, color: o.color ?? INK, align,
      box: { x: left, y: y - 0.78 * em, w, h: em }, truncated: shown !== clean,
    });
    return w;
  };
  const rect = (r: Omit<RectOp, "kind">): void => void ops.push({ kind: "rect", ...r });
  const line = (x1: number, y1: number, x2: number, y2: number, color: RGB = RULE, width = 0.3): void =>
    void ops.push({ kind: "line", x1, y1, x2, y2, color, width });
  /** Baseline that centres text of `size` vertically in a band. */
  const middle = (top: number, height: number, size: number): number => top + height / 2 + size * PT * 0.35;

  // ---------------------------------------------------------------- header
  let y = MARGIN + 7;
  const dateText = `Generated ${LONG_DATE.format(generated)}`;
  const dateW = measure(toPdfText(dateText), 9, false);
  text(plan.name || "Budget plan", MARGIN, y, 20, { bold: true, maxWidth: CONTENT_W - dateW - 8 });
  text(dateText, RIGHT, y, 9, { color: MUTED, align: "right" });

  y += 8;
  const payLabelW = text("Take-home pay", MARGIN, y, 9, { color: MUTED });
  text(formatWithCode(plan.payMinor, currency), MARGIN + payLabelW + 2.5, y, 11, { bold: true });
  if (plan.payday) {
    const payday = LONG_DATE_UTC.format(new Date(`${plan.payday}T00:00:00Z`));
    text(`Next payday: ${payday}`, RIGHT, y, 9, { color: MUTED, align: "right" });
  }
  y += 5.5;
  text(`Grouped as ${SCHEMES[plan.scheme].label}`, MARGIN, y, 8.5, { color: MUTED });
  y += 4;
  line(MARGIN, y, RIGHT, y);

  // ------------------------------------------------------ split bar + legend
  y += 7;
  text("Split of your pay", MARGIN, y, 11, { bold: true });
  const barY = y + 3;
  const barH = 9;
  // Percents set from typed amounts carry float tails; ±0.005 counts as 100.
  const total = Math.abs(summary.assignedPercent - 100) < 0.005 ? 100 : summary.assignedPercent;
  const scale = Math.max(100, total);
  const GAP = 0.6; // white gap between segments (paper shows through)
  let x = MARGIN;
  plan.categories.forEach((c) => {
    if (c.percent <= 0) return;
    const w = (c.percent / scale) * CONTENT_W;
    const fill = slotRgbLight(c.colorSlot);
    const segW = Math.max(0.3, w - GAP);
    rect({ x, y: barY, w: segW, h: barH, fill });
    // The percent rides inside the segment when it fits, so the bar still
    // reads in black and white; the legend (same order) carries the rest.
    const label = `${formatPercent(c.percent)}%`;
    if (measure(label, 7.5, true) + 2 <= segW) {
      text(label, x + segW / 2, middle(barY, barH, 7.5), 7.5, { bold: true, color: inkOn(fill), align: "center" });
    }
    x += w;
  });
  if (total < 100) {
    const w = ((100 - total) / scale) * CONTENT_W;
    rect({ x, y: barY, w, h: barH, fill: EMPTY_FILL, stroke: EMPTY_STROKE, lineWidth: 0.3 });
    if (measure("Unassigned", 7, false) + 3 <= w) {
      text("Unassigned", x + w / 2, middle(barY, barH, 7), 7, { color: MUTED, align: "center" });
    }
  } else if (total > 100) {
    // Over-assigned: the bar is scaled to the total; a marker shows 100%.
    const mx = MARGIN + (100 / scale) * CONTENT_W;
    line(mx, barY - 1.2, mx, barY + barH + 1.2, INK, 0.6);
    const w = measure("100%", 7, true);
    text("100%", clamp(mx, MARGIN + w / 2, RIGHT - w / 2), barY + barH + 4, 7, { bold: true, align: "center" });
  }

  const legend: { swatch: RGB | "empty" | "over"; label: string; pct: string }[] = [];
  plan.categories.forEach((c, i) => {
    if (c.percent > 0) legend.push({ swatch: slotRgbLight(c.colorSlot), label: nameOf(i), pct: `${formatPercent(c.percent)}%` });
  });
  if (total < 100) legend.push({ swatch: "empty", label: "Unassigned", pct: `${formatPercent(100 - total)}%` });
  if (total > 100) legend.push({ swatch: "over", label: "Over 100% by", pct: `${formatPercent(total - 100)}%` });

  const LEGEND_COLS = 4;
  const colW = CONTENT_W / LEGEND_COLS;
  const legendRowH = 4.6;
  const legendTop = barY + barH + 6; // leaves room for the "100%" label
  legend.forEach((item, k) => {
    const ix = MARGIN + (k % LEGEND_COLS) * colW;
    const top = legendTop + Math.floor(k / LEGEND_COLS) * legendRowH;
    const base = middle(top, legendRowH, 7.5);
    if (item.swatch === "empty") rect({ x: ix, y: top + 0.9, w: 2.8, h: 2.8, fill: EMPTY_FILL, stroke: EMPTY_STROKE, lineWidth: 0.3 });
    else if (item.swatch === "over") rect({ x: ix + 1, y: top + 0.6, w: 0.8, h: 3.4, fill: INK });
    else rect({ x: ix, y: top + 0.9, w: 2.8, h: 2.8, fill: item.swatch });
    const pctW = text(item.pct, ix + colW - 3, base, 7.5, { color: MUTED, align: "right" });
    text(item.label, ix + 4, base, 7.5, { maxWidth: colW - 4 - 3 - pctW - 2 });
  });
  y = legendTop + Math.ceil(legend.length / LEGEND_COLS) * legendRowH;

  // ------------------------------------------------ category table + chart
  y += 6;
  text("Categories", MARGIN, y, 11, { bold: true });
  const headTop = y + 2.5;
  const headH = 6;
  const rowsTop = headTop + headH;
  const n = plan.categories.length;
  const summaryTop = (rows: number): number => rowsTop + rows + 8;
  const available = FOOTER_TOP - 4 - SUMMARY_H - 8 - rowsTop;
  const rowH = Math.min(MAX_ROW, available / Math.max(1, n));
  if (rowH < MIN_ROW) throw new Error("Too many categories to fit on one page.");
  const size = clamp(rowH * 1.2, 7, 9.5);
  const headSize = 7.5;

  // Columns, right to left: chart, amount, percent, type; the name gets
  // what's left. Amount width comes from the widest real amount.
  const amountHead = `Amount (${currency})`;
  const amountTexts = summary.amounts.map((a) => formatPlain(a, currency));
  const amountW = Math.max(measure(amountHead, headSize, true), ...amountTexts.map((a) => measure(a, size, false)));
  const pctW = Math.max(measure("Percent", headSize, true), measure("100%", size, false));
  const typeNames = Object.values(SCHEMES[plan.scheme].names);
  const typeW = Math.max(measure("Type", headSize, true), ...typeNames.map((t) => measure(t, size, false)));
  const chartW = 52;
  const chartX = RIGHT - chartW;
  const amountRight = chartX - 6;
  const pctRight = amountRight - amountW - 4;
  const typeX = pctRight - pctW - 4 - typeW;
  const swatchX = MARGIN;
  const nameX = MARGIN + 5;
  const nameW = typeX - 4 - nameX;

  const headBase = middle(headTop, headH, headSize);
  const head = { bold: true, color: MUTED } as const;
  text("Category", nameX, headBase, headSize, head);
  text("Type", typeX, headBase, headSize, head);
  text("Percent", pctRight, headBase, headSize, { ...head, align: "right" });
  text(amountHead, amountRight, headBase, headSize, { ...head, align: "right" });
  text("Share of pay", chartX, headBase, headSize, head);
  line(MARGIN, rowsTop, RIGHT, rowsTop);

  // Bars are scaled to the largest category so small ones stay visible;
  // every bar is labeled with its percent, so the scale is never guessed.
  const maxPct = Math.max(1, ...plan.categories.map((c) => c.percent));
  const pctLabels = plan.categories.map((c) => `${formatPercent(c.percent)}%`);
  // Leave room after the longest bar for the widest label ("33.33%").
  const barRoom = chartW - Math.max(...pctLabels.map((l) => measure(l, size, false)), 0) - 3;
  const bh = Math.min(rowH * 0.55, 4.2);
  plan.categories.forEach((c, i) => {
    const top = rowsTop + i * rowH;
    if (i % 2 === 0) rect({ x: MARGIN, y: top, w: CONTENT_W, h: rowH, fill: ZEBRA });
    const base = middle(top, rowH, size);
    const fill = slotRgbLight(c.colorSlot);
    rect({ x: swatchX + 0.5, y: top + rowH / 2 - 1.4, w: 2.8, h: 2.8, fill });
    text(nameOf(i), nameX, base, size, { maxWidth: nameW });
    text(slotName(plan.scheme, c.slot), typeX, base, size, { maxWidth: typeW });
    const pctLabel = pctLabels[i] ?? "";
    text(pctLabel, pctRight, base, size, { align: "right" });
    text(amountTexts[i] ?? "", amountRight, base, size, { align: "right" });
    const bw = (c.percent / maxPct) * barRoom;
    if (bw > 0.2) rect({ x: chartX, y: top + (rowH - bh) / 2, w: bw, h: bh, fill });
    text(pctLabel, chartX + bw + 1.5, base, size);
  });
  const rowsBottom = rowsTop + n * rowH;
  line(chartX, rowsTop, chartX, rowsBottom, EMPTY_STROKE, 0.3); // chart baseline
  line(MARGIN, rowsBottom, RIGHT, rowsBottom);

  // ------------------------------------------------------------- summary
  y = summaryTop(n * rowH);
  const S = 9;
  const ROW = 5.5;
  const half = (CONTENT_W - 10) / 2;
  const lx = MARGIN;
  const rx = MARGIN + half + 10;
  const money = (minor: number): string => formatWithCode(minor, currency);

  text("By group", lx, y, 10, { bold: true });
  let ly = y + 6.5;
  for (const slot of SCHEMES[plan.scheme].order) {
    const g = summary.groups[slot];
    text(slotName(plan.scheme, slot), lx, ly, S, { bold: true });
    text(money(g.minor), lx + half - 17, ly, S, { align: "right" });
    text(`${formatPercent(g.percent)}%`, lx + half, ly, S, { align: "right", color: MUTED });
    ly += ROW;
  }
  line(lx, ly - ROW + 2, lx + half, ly - ROW + 2);
  text("Savings rate", lx, ly + 0.5, S, { bold: true });
  text(`${formatPercent(summary.savingsRate)}%`, lx + half, ly + 0.5, S, { bold: true, align: "right" });

  text("Totals", rx, y, 10, { bold: true });
  let ry = y + 6.5;
  const unassignedValue =
    summary.status === "under" ? `${money(summary.unassignedMinor)} left over`
    : summary.status === "over" ? `${money(-summary.unassignedMinor)} over`
    : money(0);
  const totals: [string, string][] = [
    ["Take-home pay", money(plan.payMinor)],
    ["Assigned", `${money(summary.assignedMinor)} (${formatPercent(summary.assignedPercent)}%)`],
    ["Unassigned", unassignedValue],
  ];
  for (const [label, value] of totals) {
    const lw = text(label, rx, ry, S, { color: MUTED });
    text(value, rx + half, ry, S, { bold: true, align: "right", maxWidth: half - lw - 3 });
    ry += ROW;
  }
  // Status in words, never color alone.
  const statusText: Record<Summary["status"], string> = {
    balanced: "Fully assigned: every part of your pay has a job.",
    under: "Not fully assigned: add the rest to a category or savings.",
    over: "Over-assigned: lower some percentages to fix it.",
    nopay: "No take-home pay entered.",
  };
  const boxTop = ry - 3.6;
  rect({ x: rx, y: boxTop, w: half, h: 7.5, fill: STATUS_FILL[summary.status], radius: 1.5 });
  text(statusText[summary.status], rx + 2.5, middle(boxTop, 7.5, 8.5), 8.5, { bold: true, maxWidth: half - 5 });

  // -------------------------------------------------------------- footer
  line(MARGIN, PAGE_H - 15, RIGHT, PAGE_H - 15);
  text(`© ${generated.getFullYear()} Budget Buddy`, PAGE_W / 2, PAGE_H - 9.5, 8, { color: MUTED, align: "center" });

  return { ops, rowHeight: rowH, fontSize: size };
}
