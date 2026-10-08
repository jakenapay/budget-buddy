// styles.css is linked from index.html (not imported here) so it blocks the
// first paint in dev as well as in the build: no flash of unstyled page.
import { formatMoney } from "./model/money";
import { createPlan, summarize, type Plan, type Summary } from "./model/state";
import { mountCategories } from "./ui/categories";
import { byId, setText } from "./ui/dom";
import { mountInputs } from "./ui/inputs";
import type { Render, Store } from "./ui/store";
import { mountSummary } from "./ui/summary";
import { mountTheme } from "./ui/theme";
import { PAYSLIP_GUIDE } from "./guide-content";
import { mountGuideButtons, openGuide } from "./ui/guide";

// In-memory only. Nothing is written to storage, so a refresh starts over.
let plan: Plan = createPlan();
const renders: Render[] = [];

const store: Store = {
  get: () => plan,
  commit(next) {
    plan = next;
    const summary = summarize(plan);
    renders.forEach((r) => r(plan, summary));
  },
};

byId<HTMLFormElement>("plan-form").addEventListener("submit", (e) => e.preventDefault());

// Theme toggle. Nothing is stored on this page, so a refresh goes back to
// the device setting.
mountTheme();

// The guide never opens by itself here: this page stores nothing, so it
// couldn't remember that it had been seen and would pop up on every visit.
mountGuideButtons(() => openGuide(PAYSLIP_GUIDE));

const pdfButton = byId<HTMLButtonElement>("save-pdf");
const pdfStatus = byId<HTMLParagraphElement>("pdf-status");
const statusLive = byId<HTMLParagraphElement>("status-live");

// Screen readers hear the plan's state only when it changes (e.g. it becomes
// fully assigned), not on every keystroke that nudges an amount.
const STATUS_ANNOUNCEMENT: Record<Summary["status"], string> = {
  nopay: "",
  balanced: "Plan fully assigned.",
  under: "Part of your pay is unassigned.",
  over: "Plan is over-assigned.",
};
let lastStatus: Summary["status"] | null = null;

function renderPdfAction(p: Plan, s: Summary): void {
  if (lastStatus !== null && s.status !== lastStatus) setText(statusLive, STATUS_ANNOUNCEMENT[s.status]);
  lastStatus = s.status;

  const money = (minor: number): string => formatMoney(Math.abs(minor), p.currency);
  let message = "";
  let tone = "";
  if (s.status === "nopay") {
    message = "Enter your take-home pay to save a PDF.";
  } else if (p.categories.length === 0) {
    message = "Add at least one category to save a PDF.";
  } else if (s.status === "under") {
    message = `${money(s.unassignedMinor)} is unassigned. You can still save; the PDF will show it.`;
    tone = "warn";
  } else if (s.status === "over") {
    message = `Over-assigned by ${money(s.unassignedMinor)}. You can still save; the PDF will show it.`;
    tone = "warn";
  }
  pdfButton.disabled = generating || !canSave(p, s);
  pdfStatus.dataset["tone"] = tone;
  setText(pdfStatus, message);
}

const canSave = (p: Plan, s: Summary): boolean => s.status !== "nopay" && p.categories.length > 0;
let generating = false;

pdfButton.addEventListener("click", async () => {
  if (generating) return;
  generating = true;
  pdfButton.disabled = true;
  pdfButton.setAttribute("aria-busy", "true");
  pdfStatus.dataset["tone"] = "";
  setText(pdfStatus, "Preparing your PDF…");
  try {
    // Loaded on first use: jsPDF is by far the largest piece of the app.
    const { savePdf } = await import("./pdf/render");
    const name = savePdf(plan, summarize(plan));
    pdfStatus.dataset["tone"] = "ok";
    setText(pdfStatus, `Saved ${name}`);
    setText(statusLive, `PDF saved as ${name}.`);
  } catch (error) {
    console.error(error);
    pdfStatus.dataset["tone"] = "warn";
    setText(pdfStatus, "Sorry, the PDF couldn't be created. Please try again.");
    setText(statusLive, "The PDF couldn't be created.");
  } finally {
    generating = false;
    pdfButton.removeAttribute("aria-busy");
    pdfButton.disabled = !canSave(plan, summarize(plan));
  }
});

renders.push(mountInputs(store), mountCategories(store), mountSummary(), renderPdfAction);
// First render also overwrites anything the browser restored into the fields.
store.commit(plan);
