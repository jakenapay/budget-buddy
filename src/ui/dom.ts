// Safe DOM building: user text only ever goes in through textContent or
// text nodes (append(string)), never through HTML parsing.

type Child = Node | string | null | undefined | false;

interface Props {
  class?: string;
  text?: string;
  attrs?: Record<string, string | number | boolean | undefined>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  for (const [key, value] of Object.entries(props.attrs ?? {})) {
    if (value === undefined || value === false) continue;
    node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

/** A small stroked icon from fixed path data (never user input). */
export function icon(paths: readonly string[], className: string): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.25");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className);
  for (const d of paths) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node as T;
}

export function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/**
 * Updates a field from state, but never the one the user is typing in:
 * rewriting it mid-typing would move the caret and swallow input like "12.".
 * A field showing an error keeps the user's text so they can fix it.
 */
export function setValue(input: HTMLInputElement | HTMLSelectElement, value: string): void {
  if (document.activeElement === input || input.hasAttribute("aria-invalid")) return;
  if (input.value !== value) input.value = value;
}

/** Shows or clears a field's error and keeps aria-invalid in step. */
export function setError(input: HTMLElement, errorNode: HTMLElement, message: string): void {
  setText(errorNode, message);
  errorNode.hidden = message === "";
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}
