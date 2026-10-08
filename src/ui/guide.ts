import { el, icon } from "./dom";

// A step-by-step tutorial in a native <dialog> (focus trap, Esc to close,
// focus returns to the opener). Content is plain data per page; text is
// only ever inserted as text nodes. "**word**" marks a bold UI label.

export interface GuideStep {
  icon: readonly string[]; // stroked 24×24 path data
  title: string;
  intro: string;
  /** What to do, in order. */
  how?: readonly string[];
  tip?: string;
}

export interface Guide {
  title: string;
  steps: readonly GuideStep[];
  /** Shown as the last step. */
  tips: readonly string[];
}

const ICON_BULB = ["M9 18h6", "M10 21h4", "M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"];
const ICON_STAR = ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"];
const ICON_CLOSE = ["M6 6l12 12", "M18 6 6 18"];

/** "Tap **Save**" → text nodes with <strong> around the marked part. */
function rich(text: string): Node[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? el("strong", { class: "font-semibold text-ink", text: part }) : document.createTextNode(part)));
}

export function openGuide(guide: Guide, opts: { onClose?: (finished: boolean) => void } = {}): void {
  const steps: GuideStep[] = [
    ...guide.steps,
    { icon: ICON_STAR, title: "Tips", intro: "A few habits that make it work better:", how: guide.tips },
  ];
  let at = 0;
  let finished = false;

  const counter = el("p", { class: "text-xs font-semibold tracking-wide text-ink-2 uppercase" });
  const closeBtn = el("button", { class: "icon-btn hover:bg-surface-2 hover:text-ink", attrs: { type: "button", "aria-label": "Close guide" } }, icon(ICON_CLOSE, "size-5"));
  const dots = steps.map((s, i) => {
    const b = el("button", { class: "guide-dot", attrs: { type: "button", "aria-label": `Step ${i + 1}: ${s.title}` } });
    b.addEventListener("click", () => show(i));
    return b;
  });
  const body = el("div", { class: "sheet-body guide-body" });
  const back = el("button", { class: "btn btn-outline btn-sm", text: "Back", attrs: { type: "button" } });
  const next = el("button", { class: "btn btn-primary", attrs: { type: "button" } });
  const skip = el("button", { class: "link mr-auto text-sm", text: "Skip guide", attrs: { type: "button" } });

  const dialog = el(
    "dialog",
    { class: "sheet sm:max-w-xl", attrs: { "aria-labelledby": "guide-title" } },
    el(
      "div",
      { class: "sheet-head" },
      el("div", { class: "min-w-0" }, el("h2", { class: "text-lg font-bold", text: guide.title, attrs: { id: "guide-title" } }), counter),
      closeBtn,
    ),
    el("div", { class: "flex flex-wrap justify-center gap-0.5 px-4 pt-4 sm:gap-1.5 sm:px-6" }, ...dots),
    body,
    el("div", { class: "sheet-foot" }, skip, back, next),
  );

  function show(i: number, focus = true): void {
    at = Math.max(0, Math.min(steps.length - 1, i));
    const s = steps[at];
    if (!s) return;
    const last = at === steps.length - 1;
    counter.textContent = `Step ${at + 1} of ${steps.length}`;
    dots.forEach((d, j) => (j === at ? d.setAttribute("aria-current", "step") : d.removeAttribute("aria-current")));
    back.disabled = at === 0;
    next.textContent = last ? "Done" : at === 0 ? "Start" : "Next";
    skip.hidden = last;

    const heading = el("h3", { class: "text-xl font-extrabold tracking-tight", text: s.title, attrs: { tabindex: -1 } });
    const parts: (Node | null)[] = [
      el("div", { class: "grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-text", attrs: { "aria-hidden": "true" } }, icon(s.icon, "size-6")),
      heading,
      el("p", { class: "text-ink-2" }, ...rich(s.intro)),
      s.how?.length
        ? el(
            last ? "ul" : "ol",
            { class: "grid gap-2.5", attrs: { "aria-label": last ? "Tips" : "What to do" } },
            ...s.how.map((line, j) =>
              el(
                "li",
                { class: "flex gap-3" },
                last
                  ? el("span", { class: "mt-2 ml-2 size-2 shrink-0 rounded-full bg-brand", attrs: { "aria-hidden": "true" } })
                  : el("span", { class: "guide-num", text: String(j + 1), attrs: { "aria-hidden": "true" } }),
                el("span", { class: "min-w-0 pt-0.5" }, ...rich(line)),
              ),
            ),
          )
        : null,
      s.tip
        ? el(
            "aside",
            { class: "flex gap-3 rounded-2xl bg-warn-soft p-3 text-sm text-ink", attrs: { "aria-label": "Tip" } },
            el("span", { class: "shrink-0 text-warn", attrs: { "aria-hidden": "true" } }, icon(ICON_BULB, "size-5")),
            el("p", {}, el("strong", { class: "font-semibold text-warn", text: "Tip: " }), ...rich(s.tip)),
          )
        : null,
    ];
    body.replaceChildren(...parts.filter((n): n is Node => n !== null));
    body.scrollTop = 0;
    dialog.scrollTop = 0;
    // Moving focus to the heading makes screen readers read the new step.
    if (focus) heading.focus({ preventScroll: true });
  }

  back.addEventListener("click", () => show(at - 1));
  next.addEventListener("click", () => {
    if (at < steps.length - 1) return show(at + 1);
    finished = true;
    dialog.close();
  });
  skip.addEventListener("click", () => dialog.close());
  closeBtn.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  // Arrow keys page through the steps (nothing in the guide takes text input).
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(at + 1);
    else if (e.key === "ArrowLeft") show(at - 1);
    else return;
    e.preventDefault();
  });
  // Swipe left/right on phones. Mostly-horizontal swipes only, so scrolling a long step still works.
  let x0 = 0;
  let y0 = 0;
  body.addEventListener("touchstart", (e) => {
    x0 = e.touches[0]?.clientX ?? 0;
    y0 = e.touches[0]?.clientY ?? 0;
  }, { passive: true });
  body.addEventListener("touchend", (e) => {
    const dx = (e.changedTouches[0]?.clientX ?? 0) - x0;
    const dy = (e.changedTouches[0]?.clientY ?? 0) - y0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) show(at + (dx < 0 ? 1 : -1));
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    opts.onClose?.(finished);
  });

  document.body.append(dialog);
  dialog.showModal();
  show(0);
}

/**
 * Any [data-open-guide] button opens the guide, including ones a screen
 * renders later (delegated, so re-rendered views need no extra wiring).
 */
export function mountGuideButtons(open: () => void): void {
  document.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("[data-open-guide]")) open();
  });
}
