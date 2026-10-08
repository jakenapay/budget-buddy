import { FAQ } from "./faq-content";
import { PAYSLIP_GUIDE, TRAVEL_GUIDE } from "./guide-content";
import { byId, el, icon } from "./ui/dom";
import { openGuide, type Guide } from "./ui/guide";
import { mountTheme } from "./ui/theme";

// The FAQ page stores nothing, like Payslip. Questions are native
// <details> elements: keyboard and screen-reader friendly with no script,
// and the browser's find-in-page can open them.

mountTheme();

const slug = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/**
 * "**bold**" → <strong>, "[text](/path)" → <a>. Only same-site paths
 * starting with "/" become links; everything else stays as text.
 */
function rich(text: string): Node[] {
  return text.split(/(\*\*.+?\*\*|\[[^\]]+\]\(\/[^)\s]*\))/g).map((part) => {
    const bold = /^\*\*(.+)\*\*$/.exec(part);
    if (bold) return el("strong", { class: "font-semibold", text: bold[1] ?? "" });
    const link = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/.exec(part);
    if (link) return el("a", { class: "link", text: link[1] ?? "", attrs: { href: link[2] ?? "/" } });
    return document.createTextNode(part);
  });
}

const list = byId<HTMLDivElement>("faq-list");
const jump = byId<HTMLElement>("faq-jump");
const search = byId<HTMLInputElement>("faq-search");
const status = byId<HTMLParagraphElement>("faq-status");
const empty = byId<HTMLParagraphElement>("faq-empty");

interface Item {
  details: HTMLDetailsElement;
  text: string;
}
const items: Item[] = [];
const sections: { node: HTMLElement; items: Item[] }[] = [];

FAQ.forEach((section, index) => {
  const sid = `s-${slug(section.title)}`;
  const own: Item[] = section.items.map(({ q, a }) => {
    const details = el(
      "details",
      { class: "faq-item", attrs: { id: slug(q) } },
      el("summary", { class: "faq-q" }, el("span", { class: "flex-1", text: q }), el("span", { class: "faq-chevron", attrs: { "aria-hidden": "true" } })),
      el("div", { class: "faq-a" }, ...a.map((p) => el("p", {}, ...rich(p)))),
    );
    // Opening an answer puts its address in the URL, so it can be shared.
    details.addEventListener("toggle", () => {
      if (details.open) history.replaceState(null, "", `#${details.id}`);
    });
    return { details, text: `${q} ${a.join(" ")}`.toLowerCase() };
  });
  items.push(...own);
  const node = el(
    "section",
    { class: "grid gap-2 scroll-mt-6", attrs: { id: sid, "aria-labelledby": `${sid}-h` } },
    el("h2", { class: `${index === 0 ? "mt-4 lg:mt-0" : "mt-4"} mb-1 text-lg font-bold`, text: section.title, attrs: { id: `${sid}-h` } }),
    ...own.map((i) => i.details),
  );
  sections.push({ node, items: own });
  jump.append(el("a", { class: "faq-jump-link", text: section.title, attrs: { href: `#${sid}` } }));
});
list.replaceChildren(...sections.map((s) => s.node));

// Search: every word must appear in the question or its answer.
search.addEventListener("input", () => {
  const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const i of items) {
    const hit = words.every((w) => i.text.includes(w));
    i.details.hidden = !hit;
    if (hit) shown++;
  }
  for (const s of sections) s.node.hidden = s.items.every((i) => i.details.hidden);
  empty.hidden = shown > 0;
  status.textContent = words.length ? `${shown} question${shown === 1 ? "" : "s"} found` : "";
});

// A shared link (faq#question-id) opens that answer and scrolls to it.
function openFromHash(url: string = location.href): void {
  const id = decodeURIComponent(new URL(url).hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
    target.scrollIntoView({ block: "start" });
    target.querySelector("summary")?.focus({ preventScroll: true });
  }
}
// Read the hash from the event, not location: an answer's toggle handler
// may have replaced the URL again before this event runs.
window.addEventListener("hashchange", (e) => openFromHash(e.newURL));
openFromHash();

/**
 * The FAQ covers both tools, so the navbar Guide button asks which guide
 * first. Same native <dialog> pattern as the guide itself.
 */
function chooseGuide(): void {
  const option = (name: string, blurb: string, guide: Guide): HTMLButtonElement => {
    const b = el(
      "button",
      { class: "chip w-full !items-start !px-4 text-left", attrs: { type: "button" } },
      el("span", { class: "font-semibold", text: name }),
      el("span", { class: "text-sm text-ink-2", text: blurb }),
    );
    b.addEventListener("click", () => {
      dialog.close();
      openGuide(guide);
    });
    return b;
  };
  const close = el("button", { class: "icon-btn hover:bg-surface-2 hover:text-ink", attrs: { type: "button", "aria-label": "Close" } }, icon(["M6 6l12 12", "M18 6 6 18"], "size-5"));
  const dialog = el(
    "dialog",
    { class: "sheet sm:max-w-md", attrs: { "aria-labelledby": "choose-title" } },
    el("div", { class: "sheet-head" }, el("h2", { class: "text-lg font-bold", text: "Which guide?", attrs: { id: "choose-title" } }), close),
    el(
      "div",
      { class: "sheet-body pb-[calc(1rem+env(safe-area-inset-bottom))]" },
      option("Payslip Pal", "Plan your pay: categories, the summary, and saving a PDF.", PAYSLIP_GUIDE),
      option("Travel Teller", "Track a trip: planned vs. paid, days, currencies and backups.", TRAVEL_GUIDE),
    ),
  );
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

const GUIDES: Record<string, () => void> = {
  choose: chooseGuide,
  payslip: () => openGuide(PAYSLIP_GUIDE),
  travel: () => openGuide(TRAVEL_GUIDE),
};
document.addEventListener("click", (e) => {
  const button = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-guide]") : null;
  if (button) GUIDES[button.dataset["guide"] ?? ""]?.();
});
