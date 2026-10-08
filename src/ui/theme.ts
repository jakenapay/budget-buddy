import { byId } from "./dom";

export type ThemeChoice = "system" | "light" | "dark";

// The theme follows the device until the user picks one. The choice lives
// on <html data-theme>. The Payslip page never stores it; the Travel page
// saves it with its settings and passes it back in on load.

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

const isDark = (): boolean => {
  const forced = document.documentElement.dataset["theme"];
  return forced ? forced === "dark" : systemDark.matches;
};

export interface ThemeControl {
  set(choice: ThemeChoice): void;
}

/** Wires the header toggle (#theme-toggle). `onPick` hears the user's choice. */
export function mountTheme(onPick?: (choice: ThemeChoice) => void): ThemeControl {
  const toggle = byId<HTMLButtonElement>("theme-toggle");

  function render(): void {
    const dark = isDark();
    byId("icon-moon").toggleAttribute("hidden", dark);
    byId("icon-sun").toggleAttribute("hidden", !dark);
    toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  function set(choice: ThemeChoice): void {
    if (choice === "system") delete document.documentElement.dataset["theme"];
    else document.documentElement.dataset["theme"] = choice;
    render();
  }

  toggle.addEventListener("click", () => {
    const choice = isDark() ? "light" : "dark";
    set(choice);
    onPick?.(choice);
  });
  systemDark.addEventListener("change", render);
  render();
  return { set };
}
