# PS40 · City Policy Audit

A tiny classroom webapp for **PS40 (UCLA, Prof. Dan Thompson)** where students crowdsource data on three local policies — police body-camera mandates, LGBTQ+ non-discrimination ordinances, and zero-emission fleet plans — across 485 U.S. cities. Each student is assigned an unclaimed city, does ~15 minutes of research, and submits Yes/No/Unsure with an evidence URL. Class results are visualized in real time as decile binscatters against 2024 Democratic vote share and public opinion (MRP) from [TrueViews](https://trueviews.org).

> 🌐 **Live site**: `https://<user>.github.io/<repo>/` *(fill in after deploying)*

## What's in this repo

A single-page static site plus a Google Apps Script backend. No build step, no framework, no database server.

```
index.html        — landing + survey + results views
style.css         — cream/serif design system
app.js            — vanilla JS: view switching, claim/submit, Chart.js binscatters
apps_script.gs    — doGet + doPost for the Google Sheet backend
cities_seed.csv   — 485-row seed: FIPS, city, state, Dem vote share, MRP bodycam support
DEPLOY.md         — step-by-step instructions for deploying your own copy
README.md         — this file
```

## How it works

```
      GitHub Pages (static)              Google Apps Script          Google Sheet
┌────────────────────────────────┐   ┌──────────────────────┐    ┌──────────────┐
│  Landing → Get my city         │──►│  doPost action=claim │───►│  atomically  │
│                                │   │  (LockService)       │    │  mark row    │
│  Form → Submit                 │──►│  doPost action=submit│───►│  write row   │
│                                │   │                      │    │              │
│  Results view (KPIs + plots)   │◄──│  doGet returns JSON  │◄───│  read all    │
└────────────────────────────────┘   └──────────────────────┘    └──────────────┘
```

- The Google Sheet is the single source of truth: seeded once with 485 rows (one per city), and each student's submission fills in the response columns of their assigned row.
- Assignment is **atomic**: `doPost(action=claim)` wraps its row-pick in `LockService.getScriptLock()`, so no two students are ever given the same city.
- The four binscatter plots are rendered client-side from the JSON returned by `doGet`, using Chart.js. Decile bins with `share(yes)` on the y-axis.
- Deployment cost: $0. Scales fine for a class of 500.

## Data sources

- **Dem vote share (`dvs_2024`)**: 2024 U.S. presidential results at the city level, provided in the PS40 course materials.
- **MRP bodycam support (`mrp_bodycam_support`)**: public-opinion estimates for the CCES 2016 item *"Do you support or oppose requiring police officers to wear body cameras that record all of their activities while on duty?"*, extracted from [TrueViews'](https://trueviews.org) `nationwide-place.pmtiles` archive.
- **Policy rubrics**: simplified for undergraduate use; full text is embedded in `index.html`.

Washington DC is the only city in the seed with an empty `mrp_bodycam_support` value — DC isn't a Census "place," so it's not in TrueViews' place-level file. The bodycam-support plot drops it; the Dem-vote-share plots still include it.

## Running it locally

If you already have a deployed Apps Script URL wired into `app.js`, you can test the frontend locally:

```bash
cd webapp
python3 -m http.server 8765
# open http://localhost:8765/
```

## Deploying your own copy

See **[DEPLOY.md](DEPLOY.md)** for the step-by-step walkthrough: creating the Google Sheet, pasting the Apps Script, deploying it, wiring the URL into `app.js`, and publishing to GitHub Pages.

## Credits

- **Instructor**: [Dan Thompson](https://danmckinleythompson.com/), UCLA Political Science (PS40)
- **MRP data**: [TrueViews](https://trueviews.org)
- **Design**: inspired by the companion [ps40-survey-orr-huber](https://github.com/danmckinleythompson/ps40-survey-orr-huber) class survey app
- **Charts**: [Chart.js](https://www.chartjs.org/)
- **Fonts**: [Newsreader](https://fonts.google.com/specimen/Newsreader) and [DM Sans](https://fonts.google.com/specimen/DM+Sans) via Google Fonts

## License

Course materials — use freely for teaching.
