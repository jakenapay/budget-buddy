# Budget Buddy: static payslip planner

## Goal
A free, private, no-login website where someone enters their take-home
pay, divides it into categories, sees the split as a chart, and saves
the result as a one-page PDF. There are NO accounts, NO database, NO
server code, and NO saved records. Nothing the user types ever leaves
their device.

## Stack
- Vite + TypeScript, vanilla (no UI framework). Plain CSS, mobile-first,
  light and dark mode via prefers-color-scheme.
- PDF made in the browser with jsPDF, installed through npm and BUNDLED
  into the site. Do not load any library from a third-party CDN.
- Output is a static build (dist/) deployable to Netlify, GitHub Pages
  or Vercel.
- No analytics, trackers, cookies, ads, external fonts or external
  requests of any kind. Use a system font stack.

## The one page: Plan
1. Inputs
   - Take-home pay (net, from the payslip), currency selector
     (PHP default; USD, EUR, GBP, JPY, SGD, AUD, CAD, INR), optional
     plan name, optional next payday date.
2. Category rows
   - Each row: color dot, name, type (Save / Bill / Spend), percentage,
     and peso amount. Editing the percentage updates the amount and
     editing the amount updates the percentage.
   - Add and delete categories. Maximum 20 categories.
3. Templates (chips): Balanced, 50/30/20, Saver first.
   - Balanced = Emergency fund 10 (save), Goals & investing 10 (save),
     Rent 25 (bill), Utilities & internet 10 (bill), Debt 5 (bill),
     Health & insurance 5 (bill), Family support 5 (bill),
     Food & groceries 15 (spend), Transport 8 (spend),
     Fun & personal 7 (spend).
   - 50/30/20 = Rent 25, Utilities 10, Food 10, Transport 5 (needs);
     Fun & dining 15, Shopping & personal 15 (wants);
     Savings 10, Goals 10 (savings).
   - Saver first = Emergency fund 25, Goals 10, Rent 25, Utilities 8,
     Health 4, Family 4, Food 12, Transport 6, Fun 6.
4. Live feedback
   - A colored segmented bar showing the whole split.
   - Totals: Assigned, and an "Unassigned" line that turns green at
     zero, amber when money is left over, red when over-assigned, with a
     plain-language hint on what to do.
   - Group totals for Save, Bill and Spend (amount and percent), and the
     savings rate.
5. "Save as PDF" button (primary action, always visible).
   - Disabled with a clear message if pay is zero.
   - Warn (but allow) if the plan is not fully assigned.

## The PDF (exactly ONE page, A4 portrait)
- Header: plan name (default "Budget plan"), date generated, take-home
  pay with currency, next payday if entered.
- A stacked horizontal bar showing the split by category, plus a small
  legend.
- A bar chart with one horizontal bar per category, labeled with percent.
- A table: category, type, percent, amount. Then group totals
  (Save / Bill / Spend), savings rate, and Assigned vs Unassigned.
- Draw the charts with vector shapes inside the PDF itself (rectangles
  and text). Do NOT screenshot the page or rasterize it.
- Must stay on one page for up to 20 categories: scale row height if
  needed and never let text overlap or overflow. Long category names are
  truncated with an ellipsis.
- Colors must remain readable when printed in black and white (also
  show percentages as text, never rely on color alone).
- File name from the plan name plus the date, sanitized (letters,
  numbers, dashes only).
- Footer: "Made in your browser. Nothing was uploaded." Do not add any
  other branding or tracking.

## Privacy and security (keep it small but correct)
- No data persistence by default: no localStorage, cookies or
  IndexedDB. Refreshing the page resets the plan. (Tell me the tradeoff
  and offer an opt-in "remember on this device" toggle as a later
  idea; do not build it now.)
- Validate all inputs: pay between 0 and 1,000,000,000; percentages 0
  to 100; category names max 40 characters; plan name max 60. Reject
  NaN and negative numbers. Never insert user text with innerHTML; use
  textContent or safe DOM creation only.
- Ship strict security headers through the host's config file
  (_headers for Netlify, or vercel.json), including a
  Content-Security-Policy of default-src 'self' with no external
  sources, frame-ancestors 'none', object-src 'none', base-uri 'self',
  form-action 'none', plus X-Content-Type-Options nosniff,
  Referrer-Policy no-referrer, and a Permissions-Policy disabling
  camera, microphone and geolocation. If jsPDF or the build needs
  anything looser (for example blob: for downloads), allow only that
  and tell me why.
- HTTPS only (HSTS on the host). Run npm audit and pin dependency
  versions with a lockfile. Minimal dependencies: jsPDF only, plus dev
  tools.
- A privacy note at the bottom of the page in plain words: "Your
  numbers stay in your browser. There are no accounts and nothing is
  stored or sent."

## Second page: Travel (travel.html, src/travel/)
A navbar (same markup in index.html, travel.html and faq.html) switches
between Payslip (/), Travel (/travel) and FAQ (/faq; text in
src/faq-content.ts, stores nothing). Travel tracks trip spending: trips with
date ranges, per-day vs whole-trip expenses, planned vs paid ("Mark as
paid"), multi-currency with the rate saved per expense, SVG charts,
JSON backup/import and per-trip CSV. Approved exceptions to the rules
above, Travel page ONLY:
- Persistence: IndexedDB via src/travel/db.ts (the only file ESLint lets
  touch storage). Payslip stays memory-only.
- Network: one opt-in request, the "Fetch latest rates" button in
  Settings → open.er-api.com. CSP connect-src allows exactly that host.
  Rates are otherwise manual; nothing is fetched automatically.
- Offline: vite-plugin-pwa (dev dependency) precaches both pages;
  service worker is disabled in `npm run dev`.
- Stack stays vanilla TS + Tailwind, no chart/DB libraries.
- Planned = sum of estimates (kept after paying); Spent = paid amounts;
  Still to pay = estimates of unpaid items. Something paid before the
  trip starts also counts as planned; paid during the trip with no
  estimate is "Unplanned".

## Quality bar
- Fully usable on a phone: large tap targets, number keyboards for
  numeric fields, no horizontal scrolling.
- Keyboard accessible, visible focus, labeled inputs, sufficient color
  contrast, respects prefers-reduced-motion.
- Money formatting with the chosen currency symbol; round to 2 decimals
  and make sure amounts add up (handle rounding so the table total
  matches the assigned total).
- Small, readable files. Comment WHY on the trickier logic (percent and
  amount syncing, rounding, fitting one page).
- Before finishing each phase: run typecheck, lint and a production
  build, and open the built site to test.

## Working agreement 
- Work in phases and stop for my review after each one.
- List anything I must do by hand (hosting setup, domain, headers).
- If something here conflicts with how a library actually behaves, tell
  me instead of silently changing the requirement.