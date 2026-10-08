// Screens inside the Travel page live in the URL hash (#/trip/<id>/day/<date>)
// so the static host serves one file, the back button works, and a screen
// can be bookmarked or reloaded.

export type Route =
  | { name: "trips" }
  | { name: "trip"; tripId: string }
  | { name: "day"; tripId: string; date: string }
  | { name: "settings" };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const [a, id, b, date] = parts;
  if (a === "settings") return { name: "settings" };
  if (a === "trip" && id) {
    if (b === "day" && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return { name: "day", tripId: id, date };
    return { name: "trip", tripId: id };
  }
  return { name: "trips" };
}

export const href = {
  trips: (): string => "#/",
  trip: (tripId: string): string => `#/trip/${encodeURIComponent(tripId)}`,
  day: (tripId: string, date: string): string => `#/trip/${encodeURIComponent(tripId)}/day/${date}`,
  settings: (): string => "#/settings",
};

export const go = (to: string): void => {
  location.hash = to;
};
