import { byId, el } from "../ui/dom";
import { mountTheme } from "../ui/theme";
import { TRAVEL_GUIDE } from "../guide-content";
import { mountGuideButtons, openGuide } from "../ui/guide";
import { parseRoute, href, type Route } from "./router";
import * as state from "./state";
import { toast } from "./ui/parts";
import { renderDay } from "./views/day";
import { renderOverview } from "./views/overview";
import { renderSettings } from "./views/settings";
import { renderTrips } from "./views/trips";

const view = byId<HTMLDivElement>("view");
const theme = mountTheme((choice) => void state.saveSettings({ theme: choice }));
state.setSaveErrorHandler(toast);

// Closing the guide (finished or skipped) counts as seen; the Guide button reopens it.
const showGuide = (): void =>
  openGuide(TRAVEL_GUIDE, { onClose: () => void (state.get().settings.guideSeen || state.saveSettings({ guideSeen: true })) });
mountGuideButtons(showGuide);

let lastHash: string | null = null;

function screen(route: Route): { title: string; nodes: Node[] } {
  if (route.name === "settings") return { title: "Settings", nodes: renderSettings(theme.set) };
  if (route.name === "trips") return { title: "Trips", nodes: renderTrips() };
  const trip = state.tripById(route.tripId);
  if (!trip) {
    return {
      title: "Trip not found",
      nodes: [
        el(
          "section",
          { class: "card grid justify-items-center gap-3 py-12 text-center" },
          el("h1", { class: "text-xl font-bold", text: "Trip not found", attrs: { tabindex: -1, "data-autofocus": true } }),
          el("p", { class: "text-ink-2", text: "It may have been deleted, or it was saved in another browser." }),
          el("a", { class: "btn btn-primary", text: "Back to trips", attrs: { href: href.trips() } }),
        ),
      ],
    };
  }
  if (route.name === "day" && route.date >= trip.startDate && route.date <= trip.endDate) {
    return { title: `${trip.name}: day`, nodes: renderDay(trip, route.date) };
  }
  return { title: trip.name, nodes: renderOverview(trip) };
}

/**
 * Draws the current screen. On navigation, focus moves to the new heading
 * so screen readers announce it and keyboard users start at the top. On a
 * data change (same screen), focus and scroll are left where they are.
 */
function render(): void {
  const navigated = location.hash !== lastHash;
  lastHash = location.hash;
  // Leaving a screen with a focused field (e.g. the itinerary) saves it first.
  if (navigated && document.activeElement instanceof HTMLElement && view.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  const { title, nodes } = screen(parseRoute(location.hash));
  view.replaceChildren(...nodes);
  document.title = `${title} · Budget Buddy travel`;
  if (navigated) {
    view.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
}

async function start(): Promise<void> {
  try {
    await state.load();
  } catch (error) {
    console.error(error);
    view.replaceChildren(
      el(
        "section",
        { class: "card grid gap-2 py-10 text-center" },
        el("h1", { class: "text-xl font-bold", text: "Storage isn't available" }),
        el("p", {
          class: "mx-auto max-w-md text-ink-2",
          text: "The Travel page saves trips in this browser, but storage is blocked here (some private windows do this). Try a normal window, or check your browser's site data settings.",
        }),
      ),
    );
    return;
  }
  theme.set(state.get().settings.theme);
  state.subscribe(render);
  window.addEventListener("hashchange", render);
  render();
  if (!state.get().settings.guideSeen) showGuide();
}

void start();
