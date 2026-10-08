// FAQ text. Answers are plain text with two light marks, rendered safely as
// text nodes (src/faq.ts): **bold** and [link text](/internal-path).
// Edit freely; ids for shareable links are made from the questions.

export interface FaqSection {
  title: string;
  items: readonly { q: string; a: readonly string[] }[];
}

export const FAQ: readonly FaqSection[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "What is Budget Buddy?",
        a: [
          "A free website with two tools. **Payslip** splits your take-home pay into categories and saves the plan as a one-page PDF. **Travel** plans what a trip will cost and tracks what you really spend, day by day, in any currency.",
        ],
      },
      { q: "Is it really free?", a: ["Yes. No subscription, no ads, no premium version, and nothing to sign up for."] },
      { q: "Do I need an account?", a: ["No. There is no sign-up or login. Just open the page and start."] },
      {
        q: "Where do I start?",
        a: [
          "For your salary, open [Payslip](/), type your take-home pay and pick a template. For a trip, open [Travel](/travel) and tap **New trip**.",
          "Each page has a step-by-step guide (**Payslip Pal** and **Travel Teller**). Open it with the **Guide** button at the top of the page.",
        ],
      },
      {
        q: "Can I use it on my phone?",
        a: [
          "Yes, it's built for phones first. You can also add it to your home screen so it opens like an app:",
          "**iPhone (Safari):** tap Share, then **Add to Home Screen**.",
          "**Android (Chrome):** tap the ⋮ menu, then **Install app** or **Add to Home screen**.",
        ],
      },
      {
        q: "Does it work without internet?",
        a: [
          "Yes, after you've opened it once with a connection. The app saves its own files so it opens offline, which helps abroad. Only **Fetch latest rates** needs internet; your saved rates and your own rates still work offline.",
        ],
      },
    ],
  },
  {
    title: "Privacy and your data",
    items: [
      {
        q: "Where is my data stored?",
        a: [
          "**Payslip:** nowhere. The plan exists only while the page is open, and refreshing clears it.",
          "**Travel:** in your browser's own storage, on this device only. There is no server and no cloud copy.",
        ],
      },
      {
        q: "Can you (or anyone else) see my numbers?",
        a: ["No. Nothing you type is uploaded, so there's nothing for us or anyone else to see. There are no analytics, trackers or cookies either."],
      },
      {
        q: "Does the app send anything over the internet?",
        a: [
          "Only one thing, and only when you ask: tapping **Fetch latest rates** in Travel → Settings asks open.er-api.com for exchange rates. That request contains just your home currency code (for example PHP). Nothing else ever leaves your device.",
        ],
      },
      {
        q: "What happens if I clear my browser data or uninstall the app?",
        a: [
          "Your Travel trips are deleted with it, because they live only in this browser. Export a backup first: Travel → Settings → **Export all (JSON)**. Payslip has nothing saved to lose.",
        ],
      },
      {
        q: "Can I use it in a private or incognito window?",
        a: [
          "Payslip works normally. Travel works too, but most browsers erase a private window's storage when you close it, so your trips would be lost. Some browsers block storage there completely, and you'll see a message saying so. Use a normal window for trips you want to keep.",
        ],
      },
      {
        q: "Does it sync between my phone and computer?",
        a: [
          "No. There's no account, so there's nothing to sync with. To move your trips, export a backup (**Export all (JSON)**) on one device and use **Import JSON** on the other. Importing replaces what's on that device.",
        ],
      },
      {
        q: "How do I delete my data?",
        a: [
          "**Travel:** Settings → **Delete all travel data**, or delete one trip from **Edit trip** → **Delete trip**.",
          "**Payslip:** just refresh or close the page.",
        ],
      },
    ],
  },
  {
    title: "Payslip",
    items: [
      {
        q: "Why did my plan disappear when I refreshed?",
        a: ["That's on purpose: the Payslip page saves nothing, for privacy. To keep a plan, tap **Save as PDF** before you close the page."],
      },
      {
        q: "Should I enter my gross or net pay?",
        a: ["Net, your **take-home pay**: what actually lands in your account after tax, SSS, PhilHealth, Pag-IBIG and any loan deductions."],
      },
      {
        q: "What do Save, Bill and Spend mean?",
        a: [
          "**Save:** money you keep (emergency fund, goals, investing). **Bill:** fixed costs (rent, utilities, debt). **Spend:** everyday and flexible costs (food, transport, fun).",
          "Prefer the 50/30/20 terms? Switch **Group by** to Needs / Wants / Savings. Only the names change.",
        ],
      },
      {
        q: "Should I type a percent or an amount?",
        a: ["Either one; the other updates by itself. Amounts are easier for fixed bills like rent, and percentages are easier for flexible things like food."],
      },
      {
        q: "What does the Unassigned color mean?",
        a: [
          "**Green:** every peso has a job. **Amber:** money is left over; add it to a category or to savings. **Red:** you've planned more than you earn; lower some categories until it's zero.",
        ],
      },
      {
        q: "Why is a category's amount off by a centavo?",
        a: [
          "Rounding. Each row is rounded so that the rows always add up exactly to the total you assigned. So one row can be a centavo above or below its exact share, but the total is never off.",
        ],
      },
      {
        q: "Can I save the PDF if the plan isn't at 100%?",
        a: ["Yes. You'll see a warning, and the PDF shows the unassigned or over-assigned amount, but it still saves. You do need to enter your pay first."],
      },
      {
        q: "Why does the PDF say “PHP” instead of “₱”?",
        a: ["The fonts built into PDF files don't include the ₱ (or ₹) symbol, so the PDF uses the currency code to make sure it prints correctly everywhere."],
      },
      {
        q: "How many categories can I have, and which currencies?",
        a: ["Up to 20 categories. Payslip supports PHP, USD, EUR, GBP, JPY, SGD, AUD, CAD and INR. Travel supports many more."],
      },
    ],
  },
  {
    title: "Travel",
    items: [
      {
        q: "What's the difference between Planned and Paid?",
        a: [
          "**Planned** is an estimate of something you expect to pay (food on Day 2, a tour). **Paid** is money already spent. Trip totals show **Planned** (all estimates), **Spent** (paid so far) and **Still to pay** (estimates you haven't paid yet).",
        ],
      },
      {
        q: "When should I use “Whole trip” instead of a day?",
        a: ["For costs that cover the whole trip: flights, the hotel for all nights, a SIM card, travel insurance. That keeps them from making one single day look expensive."],
      },
      {
        q: "I already paid for my flights. How do I log them?",
        a: [
          "Add them as **Paid**, under **Whole trip**. Anything paid before the trip starts also counts as planned, so the overview reads like a pre-trip budget: “Already paid ₱18,000 + ₱9,500 estimated”.",
        ],
      },
      {
        q: "What does “Unplanned” mean?",
        a: ["Something you paid during the trip without having an estimate for it, like a spontaneous coffee or souvenir. It counts toward Spent and shows up as being over plan for that day."],
      },
      {
        q: "How do I record that I paid for something I planned?",
        a: [
          "Tap **Mark as paid** on the planned item and confirm the amount, or change it to what you really paid. Don't add it a second time. The estimate is kept, so you can see “planned ₱1,500, spent ₱1,820 (₱320 over)”.",
        ],
      },
      {
        q: "Can I log expenses in a different currency?",
        a: ["Yes, any currency. Each expense is converted to your trip's home currency using an exchange rate, and that rate is saved with the expense."],
      },
      {
        q: "Why didn't my old expenses change when the exchange rate changed?",
        a: [
          "That's on purpose: each expense keeps the rate from when you added or paid it, so your past totals stay true to what you actually paid. To fix one, tap the expense, then **Change rate**.",
        ],
      },
      {
        q: "Where do exchange rates come from?",
        a: [
          "From you, or from **Fetch latest rates** in Travel → Settings (an optional request to open.er-api.com). A rate you type always wins over a fetched one, and the first rate you type for a currency is remembered for next time.",
        ],
      },
      {
        q: "How do I use the rate from the money changer?",
        a: [
          "When adding an expense, tap **Change rate** and type it, like “1 PHP = 440 VND”. **Swap** flips the direction if the changer quotes it the other way. To use it for every expense, set it in Travel → Settings → Exchange rates.",
        ],
      },
      {
        q: "Why can't I change a trip's home currency?",
        a: [
          "Once a trip has expenses, they've already been converted to that currency, so changing it would make every total wrong. You can still change the name, dates, trip currency and budgets. To use another home currency, create a new trip.",
        ],
      },
      {
        q: "What happens to expenses if I change the trip dates?",
        a: ["Expenses on days that are no longer in the trip become **Whole trip** expenses (you're asked first), so nothing disappears from your totals."],
      },
      {
        q: "How is “Average per day” calculated?",
        a: ["What you've paid for per-day expenses, divided by the days of the trip so far. Whole-trip costs like flights are left out, so the number reflects your daily spending."],
      },
      {
        q: "Can I open my trip in Excel or Google Sheets?",
        a: ["Yes. Open the trip and tap **CSV**. The file opens in Excel, Google Sheets or Numbers. It's handy for splitting costs with travel companions."],
      },
      {
        q: "Are there any limits?",
        a: ["Up to 100 trips, 90 days per trip and 2,000 expenses per trip, which is plenty for most travelers."],
      },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      {
        q: "Travel says “Storage isn't available”.",
        a: ["Your browser is blocking site storage, which usually happens in private windows or with strict privacy settings. Open the site in a normal window, or allow site data for it in your browser's settings."],
      },
      {
        q: "I see “Couldn't save that change on this device”.",
        a: ["Your device may be low on storage, or storage got blocked. Free up some space, then try again. To be safe, export a backup from Travel → Settings."],
      },
      {
        q: "Fetching rates doesn't work.",
        a: ["You may be offline, or the rates service may be down. Try again later, or type the rate yourself. Your own rates and previously fetched rates keep working without internet."],
      },
      {
        q: "My import failed or skipped some items.",
        a: [
          "Only backups made with **Export all (JSON)** can be imported. If the file was edited by hand, any entry that isn't valid is skipped for safety, and the message tells you how many.",
        ],
      },
      {
        q: "I think I'm seeing an old version of the app.",
        a: ["Updates download in the background and apply the next time you open the app. Close all of its tabs (or the installed app) and open it again."],
      },
      {
        q: "Why doesn't Payslip remember dark mode?",
        a: ["Payslip saves nothing at all, including your theme, so it follows your device's setting after a refresh. Travel remembers your choice; set it in Travel → Settings → Theme."],
      },
      {
        q: "The guide doesn't show up anymore.",
        a: ["It only opens by itself the first time. You can always reopen it with the **Guide** button at the top of the Payslip or Travel page."],
      },
    ],
  },
];
