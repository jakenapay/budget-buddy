# Budget Buddy: project overview

Budget Buddy is a free, private website with two tools and an FAQ page:

- **Payslip**: split your take-home pay into categories, see the split as a chart, and save it as a one-page PDF.
- **Travel**: plan a trip's costs, log what you actually spend (by day or for the whole trip, in any currency), and compare planned against spent.

There are no accounts, no server and no database on a server. It is a static site: everything runs in the visitor's browser.

Developer: [Jake Napay](https://jakenapay.vercel.app/), linked in the footer of every page.

---

## 1. Features

### Payslip (`/`)
- Take-home pay, currency (PHP default; USD, EUR, GBP, JPY, SGD, AUD, CAD, INR), optional plan name and next payday.
- Up to 20 categories. Each one has a name, a type (Save / Bill / Spend) and a percent or amount. Editing either one updates the other.
- Templates: **Balanced**, **50/30/20** and **Saver first**.
- "Group by" switch: Save / Bill / Spend or Needs / Wants / Savings.
- Live summary: a split bar, the **Unassigned** amount (green / amber / red, with a hint), group totals and savings rate.
- **Save as PDF**: one A4 page drawn as vector shapes (no screenshot), readable in black and white.

### Travel (`/travel`)
- Multiple trips. Each has dates, a home currency, a trip currency, and optional trip and daily budgets.
- Every expense is either **per-day** or **whole-trip** (flights, hotel, SIM card), and either **planned** (an estimate) or **paid**.
- **Mark as paid** turns a plan into a payment and keeps the estimate, so the app can show "planned ₱1,500, spent ₱1,820 (₱320 over)".
- Day view: itinerary note, that day's expenses, and daily budget progress.
- Trip overview: Planned / Spent / Still to pay, budget left, average per day, planned-vs-spent bars per day, and a donut chart by category.
- Multi-currency: each expense saves the exchange rate used, so past totals never change.
- Backup: export everything as JSON, import it again, and export a single trip as CSV.
- Works offline and can be installed to the home screen (PWA).

### FAQ (`/faq`)
- Answers to the most common user questions in five groups: getting started, privacy and data, Payslip, Travel, and troubleshooting.
- Search box (every word must match), jump links to each group, and shareable links to a single answer (`/faq#where-is-my-data-stored`).
- Built from native `<details>` elements; stores nothing. Edit the text in `src/faq-content.ts`.

### Guides
- **Payslip Pal** and **Travel Teller**: step-by-step tutorials with tips, opened from the **Guide** button in the navbar.
- Travel Teller opens by itself on the first visit only. Payslip Pal never opens by itself (see section 3).

---

## 2. Tech stack

| Area | Choice |
|---|---|
| Build | Vite 8, three HTML entry points (`index.html`, `travel.html`, `faq.html`) |
| Language | TypeScript (strict), vanilla DOM, no UI framework |
| Styling | Tailwind CSS v4, theme tokens in `src/styles.css`, light and dark mode |
| Font | Bricolage Grotesque, bundled from `@fontsource-variable` and served from the site itself |
| PDF | jsPDF, bundled and loaded only when **Save as PDF** is first tapped |
| Charts | Hand-written HTML and SVG (no chart library) |
| Travel storage | IndexedDB through a small wrapper (`src/travel/db.ts`), no library |
| Offline | `vite-plugin-pwa` (Workbox service worker), production builds only |
| Tests | Vitest (unit), plus manual browser checks |
| Lint | ESLint with `typescript-eslint` (strict) |

Runtime dependencies: `jspdf` and the font package. Everything else is a dev dependency. Versions are pinned exactly (`.npmrc` has `save-exact=true`) and locked in `package-lock.json`.

---

## 3. How data is stored

This is the most important part of the design. The two pages handle data differently, on purpose.

### Payslip: stored nowhere

- The plan lives only in a JavaScript variable in memory (`src/main.ts`).
- Nothing is written to localStorage, sessionStorage, IndexedDB or cookies. **Refreshing or closing the tab erases the plan.**
- Form fields use `autocomplete="off"`, so the browser doesn't restore typed values after a refresh.
- The theme toggle and the guide aren't remembered either. That's why Payslip Pal can't auto-open on a first visit: it would have no way to know it had already been seen.
- The only way to keep a plan is the PDF, which is created in the browser and downloaded directly. It is never uploaded.
- Money is held as integers in the smallest unit (centavos) so totals add up exactly. Each category stores its **percent**, and amounts are derived from it with a rounding method that always sums to the assigned total.

### Travel: stored on this device, in IndexedDB

All Travel data is saved in the browser's built-in database (**IndexedDB**) on the visitor's device. It is never sent to a server, because there isn't one.

**Database:** `budget-buddy-travel`, version `1`

| Object store | Key | What it holds |
|---|---|---|
| `trips` | `id` | One record per trip (name, destination, dates, currencies, budgets) |
| `days` | `[tripId, date]` | The itinerary note for a day (only days that have a note) |
| `expenses` | `id` (index on `tripId`) | Every planned or paid expense |
| `meta` | `key` | `"settings"` (home currency, your own rates, theme, guide seen) and `"rates"` (the last fetched exchange rates) |

**How it works at runtime**
1. When `/travel` opens, everything is loaded from IndexedDB into memory once (`state.load()`).
2. Every change updates memory first, so the screen responds instantly, and is then written to IndexedDB in a transaction.
3. If a write fails (storage full or blocked), a message says so. The data on disk is whatever was last saved successfully.
4. Deleting a trip removes its days and expenses in a single transaction.
5. When the first trip is created, the app asks the browser to keep the data persistently (`navigator.storage.persist()`), so it isn't cleared when the device is low on space. Browsers may refuse; the JSON export is the real backup.

**Only one file may touch storage.** ESLint blocks `localStorage`, `sessionStorage` and `indexedDB` everywhere except `src/travel/db.ts`.

**What a stored expense looks like**

```ts
{
  id: "3f2c…",              // random UUID
  tripId: "a91e…",
  date: "2026-11-11",        // or null for a whole-trip expense
  status: "actual",          // "planned" | "actual"
  category: "food",          // food | transport | lodging | activities | shopping | other
  note: "Pho in the Old Quarter",
  plannedAmount: 500000,     // the estimate, in the original currency (kept after paying)
  plannedAmountHome: 1136.36,
  amount: 600000,            // what was paid, in the original currency
  amountHome: 1363.64,       // amount × rateToHome, rounded to the home currency
  currency: "VND",
  rateToHome: 0.0022727,     // 1 VND = this many PHP, saved when added or paid
  paidAt: "2026-11-11T12:30:00.000Z",
  createdAt: "2026-10-20T09:00:00.000Z"
}
```

Amounts are stored in major units (e.g. `1136.36`) already rounded to the currency's own decimals (2 for PHP, 0 for VND and JPY). Totals are added up as whole minor units, so they never drift.

**How the totals are defined**
- **Planned** = the sum of estimates. A paid item keeps its estimate for comparison.
- **Spent** = the sum of paid amounts.
- **Still to pay** = estimates of items not paid yet.
- Something paid **before** the trip starts also counts as planned. Something paid **during** the trip with no estimate is marked **Unplanned**.

**Exchange rates**
- Each expense stores the rate it was converted with, so later rate changes never rewrite history.
- Where a rate comes from, in order of priority:
  1. A rate you typed (Settings, or the first time you use a currency).
  2. The last fetched rates.
  3. If neither exists, the app asks you to enter one.
- Fetched rates are stored once (in the `meta` store, key `"rates"`) against one base currency, and any pair is calculated from them, so conversion keeps working offline.

**Backup, restore and deletion**
- **Export all (JSON)** downloads a file containing `app`, `version`, `exportedAt`, `trips`, `days`, `expenses`, `settings` and `rateCache`.
- **Import JSON** treats the file as untrusted: every record is rebuilt field by field. Bad records are skipped, text is cleaned and length-limited, and numbers must be finite and in range. It then **replaces** all data on the device, after asking first.
- **CSV** (per trip) is for spreadsheets. Cells that start with `= + - @` are prefixed with `'` so spreadsheets don't run them as formulas.
- **Delete all travel data** (Settings) wipes the database. Clearing the browser's site data does the same.

**The tradeoff:** data on one device stays on that device. It doesn't sync, and clearing browser data deletes it. Regular JSON exports are the backup and the way to move to another phone.

### FAQ page: stored nowhere
Like Payslip, the FAQ page saves nothing. Opening an answer only changes the URL fragment (`#question-id`) so the link can be shared.

### Service worker cache (all pages)
- In production, the service worker stores the app's own files (HTML, JS, CSS, font, icons) so the site opens offline.
- It caches **app files only, never user data**. Exchange-rate responses are not cached by the service worker; the app keeps its own copy in IndexedDB.
- The service worker is disabled in `npm run dev`, so development never serves stale files.

---

## 4. Privacy and network

- **No** analytics, trackers, cookies, ads or external fonts.
- **One** external request in the whole app: the opt-in **Fetch latest rates** button (Travel → Settings). It sends a GET request to `https://open.er-api.com/v6/latest/<HOME_CURRENCY>` with no cookies and no referrer. Only the home currency code leaves the device. Nothing is fetched automatically.
- The Content-Security-Policy enforces this: `connect-src` allows only `'self'` and `https://open.er-api.com`.
- User text is never inserted as HTML: only `textContent` and safe DOM creation (`src/ui/dom.ts`), enforced by ESLint.
- All inputs are validated. For example, pay is limited to 0 to 1,000,000,000 and travel amounts to 1 trillion; NaN and negative numbers are rejected; names are length-limited.

### Security headers
They are defined once in `security-headers.ts` and must match `vercel.json` (a unit test checks this). `vite preview` serves the same headers, so local production tests run under the real policy.

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self';
  img-src 'self'; font-src 'self'; connect-src 'self' https://open.er-api.com;
  object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
```

---

## 5. Project structure

```
index.html              Payslip page (navbar + form + summary)
travel.html             Travel page shell (screens render into #view)
faq.html                FAQ page (questions render into #faq-list)
security-headers.ts     Single source of truth for response headers
vercel.json             Hosting config: build, headers
vite.config.ts          Two entry points, PWA, jsPDF trims
public/                 Favicon and app icons

src/
  main.ts               Payslip entry: in-memory store, PDF button
  styles.css            Tailwind theme tokens and shared components
  guide-content.ts      Text for Payslip Pal and Travel Teller (edit here)
  faq.ts                FAQ page: renders questions, search, shareable links
  faq-content.ts        FAQ questions and answers (edit here)
  model/                Payslip logic: money, state, groups, templates, validation, palette
  pdf/                  One-page PDF layout and rendering (jsPDF, lazy-loaded)
  ui/                   Payslip UI pieces + shared: dom helpers, theme, guide modal

  travel/
    main.ts             Travel entry: load data, hash router, render screens
    db.ts               The ONLY storage code (IndexedDB)
    state.ts            In-memory copy + write-through mutations
    router.ts           #/  #/trip/<id>  #/trip/<id>/day/<date>  #/settings
    model/              types, money, dates, calc (totals), rates, validate (import), csv
    ui/                 sheets (dialogs), forms, rate field, charts, expense list, shared parts
    views/              trips, overview, day, settings screens

tests/                  Vitest: money, state, validation, PDF, headers, travel
```

---

## 6. Running it

Requires Node.js (developed on Node 24).

```bash
npm install         # install exact locked versions
npm run dev         # dev server at http://localhost:5173 (/, /travel, /faq)
npm run check       # typecheck + lint + unit tests + production build
npm run build       # production build into dist/
npx vite preview    # serve dist/ with the real security headers (port 4173)
npm audit           # dependency vulnerability check
```

Test offline behavior and the CSP with `vite preview`, because the service worker is off in dev.

---

## 7. Deploying

The output is a static `dist/` folder.

- **Vercel**: `vercel.json` is ready (build command, output directory, clean URLs, headers).
- **Netlify**: add a `_headers` file with the same headers as `security-headers.ts` (not included yet).
- **GitHub Pages**: it can't set custom headers. Use a host that can if you want the CSP and HSTS.

**Manual steps for whoever deploys**
- Connect the repository to the host and set the domain, which must be HTTPS.
- Make sure the headers are served, including `connect-src … https://open.er-api.com`.
- The free open.er-api.com endpoint asks for attribution. A "Rates By Exchange Rate API" link is in Travel → Settings. Review their terms before launch.

---

## 8. Quality standards

- Mobile-first: no horizontal scrolling, 44px tap targets on touch screens, number keyboards on numeric fields.
- Accessible:
  - Labeled inputs and visible focus.
  - Native `<dialog>` for every modal, so focus is trapped and Esc closes it.
  - Focus returns to the right place after a dialog closes.
  - Status is never shown by color alone.
  - `prefers-reduced-motion` is respected.
- Money is formatted with the right symbol and decimals for each currency; totals always add up.
- Before each phase ships: typecheck, lint, unit tests, production build, and a browser test of the built site.

---

## 9. Limits

| What | Limit |
|---|---|
| Payslip categories | 20 |
| Category name / plan name | 40 / 60 characters |
| Pay | 0 to 1,000,000,000 |
| Trips | 100 |
| Trip length | 90 days |
| Expenses per trip | 2,000 |
| Trip name / destination / expense note / itinerary | 60 / 60 / 80 / 300 characters |
| Import file size | 20 MB |

---

## 10. Ideas for later

- An opt-in "remember on this device" toggle for the Payslip page.
- Splitting travel costs with companions.
- Receipt photos on expenses.
- Custom travel categories.
- Sharing a trip summary as an image or PDF.
- A Netlify `_headers` file.
