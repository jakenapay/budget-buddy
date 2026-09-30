import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";
import { slotRgbLight } from "../src/model/palette";
import {
  addCategory,
  applyTemplate,
  createPlan,
  setCategoryName,
  setPay,
  setPayday,
  setPercent,
  setPlanName,
  setScheme,
  summarize,
  type Plan,
} from "../src/model/state";
import { pdfFileName } from "../src/pdf/filename";
import { FOOTER_TOP, MARGIN, PAGE_H, PAGE_W, layoutPdf, type Box, type TextOp } from "../src/pdf/layout";
import { buildPdf, measureWith } from "../src/pdf/render";
import { fitText, toPdfText } from "../src/pdf/text";

// Real Helvetica metrics from jsPDF, same as in the browser.
const measure = measureWith(new jsPDF({ unit: "mm", format: "a4" }));
const DATE = new Date(2026, 8, 30);

describe("toPdfText", () => {
  it.each([
    ["Café ñ ü", "Café ñ ü"],
    ["Rent – “home”", 'Rent - "home"'],
    ["It’s fine…", "It's fine..."],
    ["🏠 Rent", "Rent"],
    ["Pay ₱ ₹", "Pay ? ?"],
    ["Łódź ő", "Lódz o"],
    ["家", "?"],
  ])("%j → %j", (raw, clean) => {
    expect(toPdfText(raw)).toBe(clean);
  });
});

describe("fitText", () => {
  it("leaves short text alone and shortens long text with ...", () => {
    expect(fitText("Rent", 50, 9, false, measure)).toBe("Rent");
    const cut = fitText("W".repeat(40), 30, 9, false, measure);
    expect(cut.endsWith("...")).toBe(true);
    expect(measure(cut, 9, false)).toBeLessThanOrEqual(30);
    expect(measure(`W${cut}`, 9, false)).toBeGreaterThan(30 - 0.01);
  });
});

describe("pdfFileName", () => {
  it.each([
    ["October plan!", "october-plan-2026-09-30.pdf"],
    ["", "budget-plan-2026-09-30.pdf"],
    ["Café  / Budget", "cafe-budget-2026-09-30.pdf"],
    ["🏠🏠", "budget-plan-2026-09-30.pdf"],
    ["../../etc/passwd", "etc-passwd-2026-09-30.pdf"],
  ])("%j → %j", (name, file) => {
    expect(pdfFileName(name, DATE)).toBe(file);
  });

  it("uses only letters, numbers and dashes", () => {
    expect(pdfFileName("A".repeat(200) + "!@#$%^&*()", DATE)).toMatch(/^[a-z0-9-]+\.pdf$/);
  });
});

describe("slot colors", () => {
  it("matches the CSS color-mix values", () => {
    expect(slotRgbLight(0)).toEqual([0x2a, 0x78, 0xd6]);
    // color-mix(in srgb, #2a78d6 55%, white)
    expect(slotRgbLight(8)).toEqual([138, 181, 232]);
    // color-mix(in srgb, #2a78d6 65%, black)
    expect(slotRgbLight(16)).toEqual([27, 78, 139]);
  });
});

/** Worst-case plans: widest names, largest pay, every status. */
function worstPlan(n: number, variant: "balanced" | "under" | "over"): Plan {
  let plan = setPay(applyTemplate(createPlan(), "balanced"), 1_000_000_000);
  plan = setPlanName(plan, "W".repeat(60));
  plan = setPayday(plan, "2026-10-15");
  plan = { ...plan, categories: [] };
  for (let i = 0; i < n; i++) plan = addCategory(plan);
  plan.categories.forEach((c, i) => {
    plan = setCategoryName(plan, c.id, `${"W".repeat(38)}${i}`);
    const even = 100 / n;
    const pct = variant === "balanced" ? even : variant === "under" ? even * 0.5 : Math.min(100, even * 2.5);
    plan = setPercent(plan, c.id, pct);
  });
  return plan;
}

const overlaps = (a: Box, b: Box, eps = 0.05): boolean =>
  a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;

describe("one-page layout", () => {
  const cases: [number, "balanced" | "under" | "over", "sbs" | "nws"][] = [];
  for (let n = 1; n <= 20; n++) cases.push([n, "balanced", "sbs"]);
  for (const n of [1, 5, 12, 20]) cases.push([n, "under", "nws"], [n, "over", "sbs"]);

  it.each(cases)("%i categories, %s, %s", (n, variant, scheme) => {
    const plan = setScheme(worstPlan(n, variant), scheme);
    const summary = summarize(plan);
    const { ops, rowHeight, fontSize } = layoutPdf({ plan, summary, generated: DATE }, measure);
    const texts = ops.filter((o): o is TextOp => o.kind === "text");

    expect(rowHeight).toBeGreaterThanOrEqual(4.5);
    expect(fontSize).toBeGreaterThanOrEqual(7);

    // Everything stays inside the margins. The footer sits in the bottom
    // margin, like any page footer, but at least 8 mm from the edge.
    const footerText = "© 2026 Budget Buddy";
    for (const o of ops) {
      const box = o.kind === "line" ? { x: Math.min(o.x1, o.x2), y: Math.min(o.y1, o.y2), w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) } : o.kind === "text" ? o.box : o;
      const bottomLimit = o.kind === "text" && o.text === footerText ? PAGE_H - 8 : PAGE_H - MARGIN;
      expect(box.x).toBeGreaterThanOrEqual(MARGIN - 0.01);
      expect(box.x + box.w).toBeLessThanOrEqual(PAGE_W - MARGIN + 0.01);
      expect(box.y).toBeGreaterThanOrEqual(MARGIN - 0.01);
      expect(box.y + box.h).toBeLessThanOrEqual(bottomLimit + 0.01);
    }

    // Body content ends above the footer.
    for (const t of texts) {
      if (t.text !== footerText) expect(t.box.y + t.box.h).toBeLessThanOrEqual(FOOTER_TOP);
    }

    // No two pieces of text overlap.
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i] as TextOp;
        const b = texts[j] as TextOp;
        if (overlaps(a.box, b.box)) throw new Error(`"${a.text}" overlaps "${b.text}"`);
      }
    }

    // Numbers are never shortened; only names may be.
    for (const t of texts) {
      if (t.truncated) expect(t.text).toMatch(/^W+\.\.\.$/);
    }
    expect(texts.some((t) => t.text === footerText)).toBe(true);
  });
});

describe("buildPdf", () => {
  it("produces exactly one page, even with 20 categories", () => {
    const plan = worstPlan(20, "over");
    const doc = buildPdf(plan, summarize(plan), DATE);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("produces a valid PDF file", () => {
    let plan = setPay(createPlan(), 45000);
    plan = setPlanName(plan, "October plan");
    const raw = buildPdf(plan, summarize(plan), DATE).output();
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw.trimEnd().endsWith("%%EOF")).toBe(true);
  });
});
