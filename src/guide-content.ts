import type { Guide } from "./ui/guide";

// Icons: 24×24 stroked path data (fixed strings, never user input).
const I = {
  wave: ["M7 11V6a1.5 1.5 0 0 1 3 0v5", "M10 10V4.5a1.5 1.5 0 0 1 3 0V10", "M13 10V5.5a1.5 1.5 0 0 1 3 0V12", "M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3 14.6a1.5 1.5 0 0 1 2.3-1.9L7 14.5"],
  wallet: ["M3 7a2 2 0 0 1 2-2h13v4", "M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z", "M16 14.5h.01"],
  template: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  list: ["M8 6h12", "M8 12h12", "M8 18h12", "M4 6h.01", "M4 12h.01", "M4 18h.01"],
  layers: ["M12 3 2 8l10 5 10-5z", "M2 13l10 5 10-5"],
  chart: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
  pdf: ["M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z", "M14 3v6h6", "M12 12v6", "M9 15l3 3 3-3"],
  lock: ["M6 11h12v10H6z", "M8 11V7a4 4 0 0 1 8 0v4"],
  plane: ["M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"],
  calendar: ["M4 6h16v14H4z", "M4 10h16", "M8 3v4", "M16 3v4"],
  scale: ["M12 3v18", "M5 7h14", "M5 7l-3 7a3 3 0 0 0 6 0z", "M19 7l-3 7a3 3 0 0 0 6 0z", "M8 21h8"],
  plus: ["M12 5v14", "M5 12h14"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  day: ["M12 3v2", "M12 19v2", "M5 12H3", "M21 12h-2", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
  pie: ["M12 3v9h9", "M21 12a9 9 0 1 1-9-9"],
  swap: ["M7 7h13", "M16 3l4 4-4 4", "M17 17H4", "M8 13l-4 4 4 4"],
  save: ["M5 3h11l3 3v15H5z", "M8 3v5h7V3", "M8 21v-7h8v7"],
  wifi: ["M2 8.5a15 15 0 0 1 20 0", "M5 12a10 10 0 0 1 14 0", "M8.5 15.5a5 5 0 0 1 7 0", "M12 19h.01"],
} as const;

export const PAYSLIP_GUIDE: Guide = {
  title: "Payslip Pal",
  steps: [
    {
      icon: I.wave,
      title: "Welcome to Budget Buddy",
      intro: "Split your take-home pay into categories, see where every peso goes, and save the plan as a one-page PDF. No account, and nothing leaves your browser.",
      how: [
        "Enter your pay.",
        "Divide it into categories (or start from a template).",
        "Check the summary until **Unassigned** is zero.",
        "Tap **Save as PDF**.",
      ],
      tip: "Use **Next** and **Back**, the arrow keys, or swipe to move through this guide. Reopen it any time with the **Guide** button at the top.",
    },
    {
      icon: I.wallet,
      title: "Your pay",
      intro: "Everything is based on your **take-home pay**: the net amount that actually reaches your account.",
      how: [
        "Type it in **Take-home pay**. Commas are fine (45,000.50).",
        "Pick your **Currency**. PHP is the default.",
        "Optional: add a **Next payday** and a **Plan name**. Both are printed on the PDF.",
      ],
      tip: "Use the amount after tax, SSS, PhilHealth, Pag-IBIG and loan deductions, not your gross salary.",
    },
    {
      icon: I.template,
      title: "Start from a template",
      intro: "Templates fill in a ready-made set of categories so you don't start from a blank page.",
      how: [
        "**Balanced**: a bit of everything, 20% savings.",
        "**50/30/20**: 50% needs, 30% wants, 20% savings.",
        "**Saver first**: puts 35% into savings before anything else.",
        "Tap a chip to load it. You'll be asked first if it would replace your own changes.",
      ],
      tip: "Pick the closest template, then adjust the numbers to match your real bills.",
    },
    {
      icon: I.list,
      title: "Edit your categories",
      intro: "Each row is one job for your money: a name, a type, a percentage and an amount.",
      how: [
        "Rename a row by typing in its name field (up to 40 characters).",
        "Choose its type: **Save**, **Bill** or **Spend**.",
        "Type a **percent** and the amount updates, or type an **amount** and the percent updates.",
        "**Add category** adds a row (up to 20). The **×** button deletes one.",
      ],
      tip: "For fixed bills like rent, type the exact amount. For flexible things like food, a percentage is easier.",
    },
    {
      icon: I.layers,
      title: "Group by",
      intro: "The **Group by** switch only changes the names of the three groups. Your rows stay where they are.",
      how: [
        "**Save / Bill / Spend**: savings, fixed bills and everyday spending.",
        "**Needs / Wants / Savings**: the 50/30/20 way of looking at it.",
      ],
      tip: "Savings rate always counts the Save (or Savings) group, whichever names you use.",
    },
    {
      icon: I.chart,
      title: "Read your split",
      intro: "The summary panel updates as you type.",
      how: [
        "The colored bar shows every category's share of your pay.",
        "**Unassigned** is green at zero, amber when money is left over, and red when you've planned more than you earn. Read the hint under it for what to do.",
        "**By group** shows Save, Bill and Spend totals. **Savings rate** is the share you're saving.",
      ],
      tip: "Aim for Unassigned = ₱0.00. Leftover money with no job tends to disappear, so give it to savings.",
    },
    {
      icon: I.pdf,
      title: "Save as PDF",
      intro: "The **Save as PDF** button at the bottom makes a one-page A4 summary: your split bar, a bar per category, and a table with group totals.",
      how: [
        "Enter your pay first. The button is disabled until then.",
        "If the plan isn't fully assigned you'll see a warning, but you can still save.",
        "The file is named after your plan and today's date.",
      ],
      tip: "The PDF prints clearly in black and white, because every bar is also labeled with its percent.",
    },
    {
      icon: I.lock,
      title: "Private by design",
      intro: "This page stores nothing. There's no account, and your numbers are never sent anywhere.",
      how: [
        "Refreshing or closing the page clears the plan.",
        "To keep a plan, save the PDF.",
        "Planning a trip? Switch to **Travel** in the top bar. It has its own guide, the **Travel Teller**.",
      ],
    },
  ],
  tips: [
    "Make the plan on payday, before any money gets spent.",
    "Pay yourself first: put savings at the top, not whatever is left at the end.",
    "Keep an emergency fund category until it covers 3 to 6 months of expenses.",
    "Got a raise? Put part of it straight into Goals before your spending grows.",
    "Save a PDF each payday and compare them to see how your split changes over time.",
  ],
};

export const TRAVEL_GUIDE: Guide = {
  title: "Travel Teller",
  steps: [
    {
      icon: I.plane,
      title: "Welcome to Travel",
      intro: "Plan what a trip will cost, then log what you really spend, day by day, in any currency. Everything is saved on this device. No account needed.",
      how: [
        "Create a trip.",
        "Add **planned** costs before you go.",
        "Log **paid** costs as you spend.",
        "See planned vs. spent for each day and for the whole trip.",
      ],
      tip: "Use **Next** and **Back**, the arrow keys, or swipe. Reopen this any time with the **Guide** button at the top.",
    },
    {
      icon: I.calendar,
      title: "Create a trip",
      intro: "A trip has dates, so a 5-day trip automatically gets Day 1 to Day 5.",
      how: [
        "Tap **New trip** on the Trips screen.",
        "Enter a name, destination (optional), and start and end dates.",
        "Set your **Home currency** (what totals are shown in) and **Trip currency** (the default for new expenses).",
        "Optional: a **Trip budget** and a **Daily budget**.",
      ],
      tip: "Home currency locks once a trip has expenses, because they've already been converted to it. You can change everything else later with **Edit trip**.",
    },
    {
      icon: I.scale,
      title: "Planned vs. paid",
      intro: "Every expense is either **Planned** (an estimate) or **Paid** (money already spent).",
      how: [
        "**Planned**: something you expect to pay, like food on Day 2 or a tour.",
        "**Paid**: money already spent, like flights you booked or tonight's dinner.",
        "Trip totals show **Planned** (all estimates), **Spent** (paid so far) and **Still to pay** (estimates not paid yet).",
      ],
      tip: "Anything you mark as paid before the trip starts (flights, a hotel deposit) also counts as planned. Spending during the trip with no estimate is tagged **Unplanned**.",
    },
    {
      icon: I.plus,
      title: "Add an expense",
      intro: "The **Add expense** button floats at the bottom right. Most expenses take about 3 taps: amount, category, add.",
      how: [
        "Choose **Planned** or **Paid**. It's set for you: Planned before the trip, Paid during it.",
        "Type the amount. The **Currency** starts as the trip currency.",
        "Pick a **Category**: Food, Transport, Lodging, Activities, Shopping or Other.",
        "Pick the **Day**, or **Whole trip** for costs that cover every day.",
        "Optional: add a short **Note**, then tap **Add expense**.",
      ],
      tip: "Use **Whole trip** for flights, the hotel for all nights, SIM cards and insurance, so no single day looks expensive.",
    },
    {
      icon: I.check,
      title: "Mark as paid",
      intro: "When you actually pay for something you planned, don't add it again. Turn the plan into a payment.",
      how: [
        "Find the planned item (in its day, or under **Whole trip**).",
        "Tap **Mark as paid**.",
        "The estimate is filled in. Change it to the real amount if it was different, then confirm.",
      ],
      tip: "The estimate is kept, so the day shows how you did, for example: planned ₱1,500, spent ₱1,820 (₱320 over).",
    },
    {
      icon: I.day,
      title: "The day view",
      intro: "Tap any day on the trip page to open it.",
      how: [
        "Write that day's **Itinerary**, like “Old Quarter → Hoan Kiem → water puppet show”. It saves as you type.",
        "See the day's planned, spent and still-to-pay totals.",
        "If you set a daily budget, a bar shows how much is left.",
        "Use **Previous** and **Next** to move between days. **Add expense** here goes straight to this day.",
      ],
      tip: "Tap any expense to edit or delete it. Fixed a typo in an amount? Just edit it.",
    },
    {
      icon: I.pie,
      title: "The trip overview",
      intro: "The trip page brings it all together.",
      how: [
        "**Totals**: planned, spent and still to pay. Before the trip it reads like a pre-trip budget: already paid + estimated.",
        "**Budget**: what's left, and the average spent per day (per-day expenses only).",
        "**By category**: a donut of where the money went. Switch between **Spent** and **Planned**.",
        "**Days**: planned (dashed) vs. spent (solid) bars for each day. A red bar means over plan.",
        "**Whole trip**: flights, hotel and other trip-wide costs.",
      ],
      tip: "Tap **CSV** to export the trip for a spreadsheet or to share costs with travel companions.",
    },
    {
      icon: I.swap,
      title: "Currencies and rates",
      intro: "Log each expense in whatever currency you paid. It's converted to your home currency with an exchange rate, and that rate is saved with the expense, so old totals never change.",
      how: [
        "The rate shows under the amount, like “1 PHP = 440 VND”.",
        "Tap **Change rate** to type the rate you actually got. **Swap** flips the direction.",
        "The first rate you type for a currency is remembered for next time.",
        "In **Settings**, set your own rates or tap **Fetch latest rates**.",
      ],
      tip: "Use the rate from the money changer or your card statement. It's more accurate than the market rate.",
    },
    {
      icon: I.save,
      title: "Settings and backup",
      intro: "Open **Settings** from the Trips screen.",
      how: [
        "**Home currency** for new trips, and **Theme** (Device, Light or Dark).",
        "**Exchange rates**: every rate your trips use, with your own rates marked “Your rate”.",
        "**Export all (JSON)** saves a backup file. **Import JSON** restores it, even on another phone.",
        "**Delete all travel data** wipes this page's data from the device.",
      ],
      tip: "Your trips live only in this browser. Clearing browser data deletes them, so export a backup before a trip and after it.",
    },
    {
      icon: I.wifi,
      title: "Offline and privacy",
      intro: "Once you've opened the site, it works with no signal, which helps abroad. Add it to your home screen to open it like an app.",
      how: [
        "Nothing is sent anywhere. The only exception is **Fetch latest rates**, which sends just your home currency code to the rates service.",
        "No account, no tracking, no ads.",
        "Saved rates and your own rates still work offline.",
      ],
      tip: "Before you fly, open the Travel page once on your phone and fetch rates while you still have Wi-Fi.",
    },
  ],
  tips: [
    "Plan big-ticket items first (flights, hotel, tours). They decide most of the trip's cost.",
    "Add a small Other estimate each day for snacks and surprises, so you don't end up over every day.",
    "Log expenses right away. A coffee is easy to forget by dinner time.",
    "At the end of each day, mark that day's planned items as paid and fix the amounts.",
    "Check Still to pay before booking anything new, to see if it fits your budget.",
    "Export a JSON backup after the trip. It's your record if your phone gets reset.",
  ],
};
