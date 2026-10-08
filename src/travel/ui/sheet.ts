import { el } from "../../ui/dom";
import { ico } from "./parts";

export interface Sheet {
  dialog: HTMLDialogElement;
  form: HTMLFormElement;
  close(): void;
}

let counter = 0;

/**
 * A modal built on native <dialog>: the browser traps focus, closes on Esc,
 * and returns focus to the button that opened it. Each sheet is created
 * fresh and removed when closed, so no stale form state carries over.
 */
export function openSheet(opts: {
  title: string;
  body: Node[];
  actions: Node[];
  onSubmit: () => void;
}): Sheet {
  const titleId = `sheet-title-${++counter}`;
  const closeBtn = el("button", { class: "icon-btn hover:bg-surface-2 hover:text-ink", attrs: { type: "button", "aria-label": "Close" } }, ico("close", "size-5"));
  const form = el(
    "form",
    { attrs: { novalidate: true, autocomplete: "off" } },
    el("div", { class: "sheet-head" }, el("h2", { class: "text-lg font-bold", text: opts.title, attrs: { id: titleId } }), closeBtn),
    el("div", { class: "sheet-body" }, ...opts.body),
    el("div", { class: "sheet-foot" }, ...opts.actions),
  );
  const dialog = el("dialog", { class: "sheet", attrs: { "aria-labelledby": titleId } }, form);

  const close = (): void => dialog.close();
  closeBtn.addEventListener("click", close);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    opts.onSubmit();
  });
  // Tap on the backdrop (outside the sheet) closes it, like most mobile sheets.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
  // Saving re-renders the screen behind the sheet, so the button that opened
  // it may be gone by the time it closes. Find its replacement by data-key
  // (or data-key-fallback, e.g. "Mark as paid" → that expense's row), and
  // fall back to the screen heading, so focus never drops to <body>.
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const keys = [opener?.dataset["key"], opener?.dataset["keyFallback"]].filter((k): k is string => !!k);
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (opener?.isConnected && document.activeElement === opener) return;
    const target =
      keys.map((k) => document.querySelector<HTMLElement>(`[data-key="${CSS.escape(k)}"]`)).find(Boolean) ??
      document.querySelector<HTMLElement>("#view [data-autofocus]");
    target?.focus();
  });

  document.body.append(dialog);
  dialog.showModal();
  return { dialog, form, close };
}
