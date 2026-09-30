import { describe, expect, it } from "vitest";
import { SCHEMES, slotName } from "../src/model/groups";
import {
  addCategory,
  applyTemplate,
  createPlan,
  removeCategory,
  setAmount,
  setCurrency,
  setPay,
  setPercent,
  setScheme,
  summarize,
  type Plan,
} from "../src/model/state";
import { TEMPLATES } from "../src/model/templates";

const withPay = (major: number, plan: Plan = createPlan()): Plan => setPay(plan, major);

describe("templates", () => {
  it.each(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[])("%s adds up to 100%%", (id) => {
    const plan = applyTemplate(withPay(45000), id);
    const s = summarize(plan);
    expect(s.assignedPercent).toBe(100);
    expect(s.assignedMinor).toBe(plan.payMinor);
    expect(s.status).toBe("balanced");
  });

  it("50/30/20 switches to Needs/Wants/Savings with a 50/30/20 split", () => {
    const plan = applyTemplate(withPay(10000), "50-30-20");
    const s = summarize(plan);
    expect(plan.scheme).toBe("nws");
    expect(s.groups.fixed.percent).toBe(50);
    expect(s.groups.flexible.percent).toBe(30);
    expect(s.groups.saving.percent).toBe(20);
    expect(s.savingsRate).toBe(20);
  });

  it("Balanced switches back to Save/Bill/Spend", () => {
    const plan = applyTemplate(applyTemplate(createPlan(), "50-30-20"), "balanced");
    expect(plan.scheme).toBe("sbs");
  });
});

describe("group-by switch", () => {
  it("renames groups without changing any row", () => {
    const plan = applyTemplate(withPay(45000), "balanced");
    const switched = setScheme(plan, "nws");
    expect(switched.categories).toBe(plan.categories);
    expect(summarize(switched).groups).toEqual(summarize(plan).groups);
    expect(slotName("nws", "fixed")).toBe("Needs");
    expect(SCHEMES.nws.order).toEqual(["fixed", "flexible", "saving"]);
  });
});

describe("percent and amount sync", () => {
  it("typing an amount sets the percent and shows the amount back exactly", () => {
    const plan = withPay(45000.5);
    const id = plan.categories[2]?.id ?? -1;
    const next = setAmount(plan, id, 7777.77);
    const i = next.categories.findIndex((c) => c.id === id);
    expect(summarize(next).amounts[i]).toBe(777777);
    expect(next.categories[i]?.percent).toBeCloseTo((777777 / 4500050) * 100, 10);
  });

  it("changing pay keeps percents and rescales amounts", () => {
    const plan = setPercent(withPay(10000), createPlan().categories[0]?.id ?? -1, 10);
    const bigger = setPay(plan, 20000);
    expect(bigger.categories.map((c) => c.percent)).toEqual(plan.categories.map((c) => c.percent));
    expect(summarize(bigger).assignedMinor).toBe(2_000_000);
  });

  it("ignores amount edits when pay is zero", () => {
    const plan = createPlan();
    expect(setAmount(plan, plan.categories[0]?.id ?? -1, 100)).toBe(plan);
  });

  it("clamps percent to 0–100", () => {
    const plan = createPlan();
    const id = plan.categories[0]?.id ?? -1;
    expect(setPercent(plan, id, 250).categories[0]?.percent).toBe(100);
    expect(setPercent(plan, id, Number.NaN).categories[0]?.percent).toBe(0);
  });
});

describe("status", () => {
  it("reports under, over and no pay", () => {
    const plan = withPay(1000);
    const id = plan.categories[0]?.id ?? -1;
    expect(summarize(setPercent(plan, id, 0)).status).toBe("under");
    expect(summarize(setPercent(plan, id, 50)).status).toBe("over");
    expect(summarize(createPlan()).status).toBe("nopay");
  });
});

describe("categories", () => {
  it("caps at 20 and keeps color slots unique", () => {
    let plan = createPlan();
    for (let i = 0; i < 30; i++) plan = addCategory(plan);
    expect(plan.categories).toHaveLength(20);
    expect(new Set(plan.categories.map((c) => c.colorSlot)).size).toBe(20);
  });

  it("does not recolor others on delete", () => {
    const plan = createPlan();
    const [first, second, third] = plan.categories;
    const next = removeCategory(plan, second?.id ?? -1);
    expect(next.categories[0]?.colorSlot).toBe(first?.colorSlot);
    expect(next.categories[1]?.colorSlot).toBe(third?.colorSlot);
    expect(next.dirty).toBe(true);
  });
});

describe("currency", () => {
  it("re-rounds pay when switching to yen", () => {
    const plan = setCurrency(withPay(45000.6), "JPY");
    expect(plan.payMinor).toBe(45001);
  });
});
