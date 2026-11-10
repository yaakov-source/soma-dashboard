/* =====================================================================
   SOMA KPI dashboard — data file (the only file you edit to update numbers)
   Prepared by Hai Creative. Loaded by index.html as a plain <script>.

   RULES
   - null  = "Awaiting data". The page shows a muted "Awaiting data" state.
             Never put a guess in here; leave it null until the export lands.
   - Numbers are plain numbers: 48210 not "$48,210". Rates are 0–1 (0.33).
   - Money is USD. Dates are ISO (YYYY-MM-DD).
   - Totals, cost per lead, qualified rate and channel split are COMPUTED by
     the page from the fields below. You never type a total.

   SCHEMA
   SOMA_DATA
   ├─ meta
   │  ├─ client            string
   │  ├─ headline          [line1, line2]   two-line hero headline
   │  ├─ periodStart       "YYYY-MM-DD"
   │  ├─ periodEnd         "YYYY-MM-DD"
   │  ├─ periodLabel       string           shown in the hero
   │  ├─ preparedBy        string
   │  └─ preparedOn        "YYYY-MM-DD"
   ├─ months[]             one entry per month, oldest first
   │  ├─ key               "YYYY-MM"
   │  ├─ label             "Aug" | "Sep" | "Oct" | "Nov"
   │  ├─ partial           true for month-to-date (Nov)
   │  ├─ meta              { spend, leads, impressions, clicks }   numbers or null
   │  └─ google            { spend, leads, impressions, clicks }   numbers or null
   ├─ ghl                  GoHighLevel, whole period
   │  ├─ funnel            { leads, contacted, qualified, booked, closed }
   │  ├─ revenue           closed revenue, USD, confirmed only
   │  └─ openPipeline      { value, approx?, period, status, note }
   │                       status: "unconfirmed" | "confirmed"
   ├─ ga4                  Google Analytics 4, whole period
   │  └─ { sessions, users, conversions, conversionRate }
   ├─ topAds               null, or [{ name, channel: "meta"|"google", spend, leads }]
   ├─ topCampaigns         null, or [{ name, channel: "meta"|"google", spend, leads }]
   ├─ thisWeek[]           call notes strip
   │  └─ { id, label, value, approx?, from?, to?, of?, unit?, status?, note, asOf }
   │     id is one of: volume | qualified | google | pipeline | doctors (picks the mini chart)
   └─ gamePlan[]           { text, when }
   ===================================================================== */

window.SOMA_DATA = {
  meta: {
    client: "SOMA Regenerative",
    headline: ["SOMA, in numbers.", "Aug 1 \u2013 Nov 9."],
    periodStart: "2026-08-01",
    periodEnd: "2026-11-09",
    periodLabel: "Aug 1 \u2013 Nov 9, 2026",
    preparedBy: "Hai Creative",
    preparedOn: "2026-11-10"
  },

  /* Platform exports pending (Meta Ads Manager, Google Ads). */
  months: [
    { key: "2026-08", label: "Aug", partial: false,
      meta:   { spend: null, leads: null, impressions: null, clicks: null },
      google: { spend: null, leads: null, impressions: null, clicks: null } },
    { key: "2026-09", label: "Sep", partial: false,
      meta:   { spend: null, leads: null, impressions: null, clicks: null },
      google: { spend: null, leads: null, impressions: null, clicks: null } },
    { key: "2026-10", label: "Oct", partial: false,
      meta:   { spend: null, leads: null, impressions: null, clicks: null },
      google: { spend: null, leads: null, impressions: null, clicks: null } },
    { key: "2026-11", label: "Nov", partial: true,
      meta:   { spend: null, leads: null, impressions: null, clicks: null },
      google: { spend: null, leads: null, impressions: null, clicks: null } }
  ],

  ghl: {
    funnel: { leads: null, contacted: null, qualified: null, booked: null, closed: null },
    revenue: null,
    openPipeline: {
      value: 113000,
      approx: true,
      period: "Nov 2026",
      status: "unconfirmed",
      note: "Open deals in GoHighLevel for the month. Not confirmed revenue."
    }
  },

  ga4: { sessions: null, users: null, conversions: null, conversionRate: null },

  topAds: null,
  topCampaigns: null,

  /* From the Nov 10, 2026 call. */
  thisWeek: [
    { id: "volume",    label: "Lead volume",        value: 100, approx: true, from: 10, to: 100, unit: "leads",
      note: "Overnight jump, from about 10 to about 100", asOf: "2026-11-10" },
    { id: "qualified", label: "Calls qualified",    value: 15, of: 45, unit: "calls",
      note: "Last week, 15 of 45", asOf: "2026-11-10" },
    { id: "google",    label: "Google leads / day", value: 4, approx: true, unit: "per day",
      note: "After Google changes, about 4 a day", asOf: "2026-11-09" },
    { id: "pipeline",  label: "Open pipeline",      value: 113000, approx: true, unit: "USD", status: "unconfirmed",
      note: "GoHighLevel open deals, Nov. Not revenue.", asOf: "2026-11-10" },
    { id: "doctors",   label: "Doctor photos",      value: 6, of: 12, unit: "doctors",
      note: "6 of 12 listed doctors have photos", asOf: "2026-11-10" }
  ],

  gamePlan: [
    { text: "Keep spend steady. Filter and nurture leads, don\u2019t cut.", when: "Ongoing" },
    { text: "Automate 45%+ of straightforward leads.", when: "This week \u2013 Nov 16" },
    { text: "Doctor profiles and photos up top on the site and landing pages.", when: "Fri Nov 13" },
    { text: "Clear the dev bottleneck so landing pages ship.", when: "This week" },
    { text: "Firm content calendar, release dates aligned to Chad\u2019s social and ads.", when: "This week" },
    { text: "Run self-sufficient. Don\u2019t wait on investment capital.", when: "Ongoing" },
    { text: "Bennett call-transcript workflow set up.", when: "Wed Nov 11" }
  ]
};
