// The only file allowed to touch device storage (see eslint.config.js). The
// Travel page saves trips in IndexedDB on this device; the Payslip page stores
// nothing. The data set is small (a few thousand rows at most), so the app
// loads everything into memory on start and writes each change through.

import { DEFAULT_SETTINGS, type Expense, type RateCache, type Settings, type TravelData, type Trip, type TripDay } from "./model/types";

const DB_NAME = "budget-buddy-travel";
const DB_VERSION = 1;

type StoreName = "trips" | "days" | "expenses" | "meta";
type Meta = { key: "settings"; value: Settings } | { key: "rates"; value: RateCache };

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("trips", { keyPath: "id" });
      db.createObjectStore("days", { keyPath: ["tripId", "date"] });
      db.createObjectStore("expenses", { keyPath: "id" }).createIndex("tripId", "tripId");
      db.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => {
      // Another tab upgrading the schema: step aside instead of blocking it.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error ?? new Error("Could not open storage"));
    req.onblocked = () => reject(new Error("Storage is busy in another tab"));
  });
  return dbPromise;
}

/** Runs `work` in one transaction and resolves once it has committed. */
async function tx(stores: StoreName[], mode: IDBTransactionMode, work: (t: IDBTransaction) => void): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error ?? new Error("Storage error"));
    t.onabort = () => reject(t.error ?? new Error("Storage write was cancelled"));
    work(t);
  });
}

function getAll<T>(t: IDBTransaction, store: StoreName, out: T[]): void {
  const req = t.objectStore(store).getAll();
  req.onsuccess = () => out.push(...(req.result as T[]));
}

export async function loadAll(): Promise<TravelData> {
  const trips: Trip[] = [];
  const days: TripDay[] = [];
  const expenses: Expense[] = [];
  const meta: Meta[] = [];
  await tx(["trips", "days", "expenses", "meta"], "readonly", (t) => {
    getAll(t, "trips", trips);
    getAll(t, "days", days);
    getAll(t, "expenses", expenses);
    getAll(t, "meta", meta);
  });
  const settings = meta.find((m) => m.key === "settings")?.value;
  const rates = meta.find((m) => m.key === "rates")?.value;
  return {
    trips,
    days,
    expenses,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    rateCache: rates ?? null,
  };
}

export const putTrip = (trip: Trip): Promise<void> => tx(["trips"], "readwrite", (t) => t.objectStore("trips").put(trip));

export const putDay = (day: TripDay): Promise<void> => tx(["days"], "readwrite", (t) => t.objectStore("days").put(day));

export const putExpense = (e: Expense): Promise<void> => tx(["expenses"], "readwrite", (t) => t.objectStore("expenses").put(e));

export const deleteExpense = (id: string): Promise<void> => tx(["expenses"], "readwrite", (t) => t.objectStore("expenses").delete(id));

export const putSettings = (value: Settings): Promise<void> =>
  tx(["meta"], "readwrite", (t) => t.objectStore("meta").put({ key: "settings", value } satisfies Meta));

export const putRates = (value: RateCache): Promise<void> =>
  tx(["meta"], "readwrite", (t) => t.objectStore("meta").put({ key: "rates", value } satisfies Meta));

/** Deletes a trip with its days and expenses, all or nothing. */
export function deleteTrip(tripId: string): Promise<void> {
  return tx(["trips", "days", "expenses"], "readwrite", (t) => {
    t.objectStore("trips").delete(tripId);
    t.objectStore("days").delete(IDBKeyRange.bound([tripId, ""], [tripId, "￿"]));
    const cursor = t.objectStore("expenses").index("tripId").openKeyCursor(IDBKeyRange.only(tripId));
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c) return;
      t.objectStore("expenses").delete(c.primaryKey);
      c.continue();
    };
  });
}

/** Replaces everything (import, or "delete all data" with an empty set) in one transaction. */
export function replaceAll(data: TravelData): Promise<void> {
  return tx(["trips", "days", "expenses", "meta"], "readwrite", (t) => {
    for (const name of ["trips", "days", "expenses", "meta"] as const) t.objectStore(name).clear();
    data.trips.forEach((v) => t.objectStore("trips").put(v));
    data.days.forEach((v) => t.objectStore("days").put(v));
    data.expenses.forEach((v) => t.objectStore("expenses").put(v));
    t.objectStore("meta").put({ key: "settings", value: data.settings } satisfies Meta);
    if (data.rateCache) t.objectStore("meta").put({ key: "rates", value: data.rateCache } satisfies Meta);
  });
}

/**
 * Asks the browser not to clear this site's storage when the device runs low
 * on space. Browsers may say no; the export is the real backup either way.
 */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // Not supported or refused: nothing to do.
  }
}
