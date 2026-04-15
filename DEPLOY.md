# Deploying your own copy

Step-by-step instructions for setting up the PS40 City Policy Audit webapp from scratch. Assumes you have a Google account and a GitHub account. No build step, no framework, no server to pay for.

## 1. Create the Google Sheet (the database)

1. Go to https://sheets.new to create a new empty spreadsheet. Rename it something like `PS40 City Policy Data`.
2. **File → Import → Upload** and upload `cities_seed.csv` from this repo. Choose **Replace spreadsheet** as the import location and **Detect automatically** for the separator. Click **Import data**.
3. You should now see 485 rows plus a header. Confirm the header row is exactly:
   `fips, city, state, dvs_2024, mrp_bodycam_support, assigned_at, submitted_at, bodycam_answer, bodycam_notes, nondisc_answer, nondisc_notes, zeroemiss_answer, zeroemiss_notes, student_name, student_id`

## 2. Paste in the Apps Script backend

1. In the spreadsheet, open **Extensions → Apps Script**.
2. Delete the stub `function myFunction() {}`.
3. Open `apps_script.gs` in this repo and copy its entire contents into the Apps Script editor.
4. Save (floppy icon). Name the project anything (e.g., `PS40 backend`).

## 3. Deploy the script as a web app

1. **Deploy → New deployment**.
2. Gear icon → **Web app**.
3. Set:
   - **Description**: `PS40 backend v1`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. **Deploy**. Google will ask you to authorize — click through. (You'll likely see a "Google hasn't verified this app" screen: **Advanced → Go to [project] (unsafe)**. Normal for your own scripts.)
5. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AK.../exec`.

> ⚠️ This URL is public — anyone with it can read and write the sheet. That's fine for a class project, but don't reuse it for anything sensitive.

## 4. Wire the URL into the frontend

Open `app.js`, replace `PASTE_YOUR_APPS_SCRIPT_WEBAPP_URL_HERE` with the URL from step 3.5, and save.

## 5. Smoke-test the backend

```bash
URL="https://script.google.com/macros/s/AK.../exec"

# Should return {"ok":true,"rows":[...]} with 485 rows.
curl -sL "$URL" | head -c 300

# Should return {"ok":true,"row":{...}} with one city. The --post302 --post303
# flags are required: Apps Script POSTs go through a 302 redirect that curl
# would otherwise downgrade to GET.
curl -sL --post302 --post303 -d 'action=claim' "$URL"
```

If you re-run the GET, the claimed city's `assigned_at` should now be populated.

## 6. Publish to GitHub Pages

1. Create a new GitHub repository (public is simplest for Pages).
2. Push the contents of this folder to the repo root.
3. In **Settings → Pages → Build and deployment**, set **Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Wait ~1 minute, then visit `https://<user>.github.io/<repo>/`. You should see the landing card with **Get my city** and a **📊 Results** button top-right.

## 7. Share with students

Give students the Pages URL. They click **Get my city**, research the three policies, and submit. To watch class progress, click the **📊 Results** button in the top-right — that switches to the results view with live KPI counters and the four binscatter plots. The **🔄 Refresh** button there re-pulls the sheet on demand. You can also open the Google Sheet directly at any time.

## Releasing a city someone claimed by mistake

If a student clicks **Get my city**, sees a city they don't want to do, and walks away, that city is stuck in the "assigned but not submitted" state and won't be handed out to anyone else.

To release it, open the Google Sheet directly, find the row (easiest: sort or filter by the `assigned_at` column and look for the most recent timestamp with an empty `submitted_at`), and **delete the contents of the `assigned_at` cell**. That's it — the next student who clicks **Get my city** is eligible to get that row again.

Don't touch the other columns. In particular, don't clear `submitted_at` unless you also want to re-open a row that was fully completed.

## Resetting between terms

To reuse this setup for a new class:

1. Open the Google Sheet.
2. Select columns F through O (from `assigned_at` through `student_id`) and press Delete. The base city/votes/MRP columns (A–E) stay.

All new responses will then be collected into the cleared columns.

## Troubleshooting

- **"not enough data yet"** on a plot: fewer than 10 cities have a yes/no response for that policy. Plots render once you cross that threshold.
- **`all cities have been assigned`** error on claim: every row has a non-empty `assigned_at`. Clear `assigned_at` for any cities you want to re-open.
- **`curl` returns a "Page Not Found" HTML page on POST**: that's curl silently downgrading the 302 redirect. Use `curl -sL --post302 --post303 ...`. Browsers handle this correctly — the real webapp works fine.
- **CORS errors in the browser console**: make sure the deployment was set to `Anyone` (not `Anyone with a Google account`), and that you redeployed after any code edits. Apps Script is sticky to deployed versions — do **Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy** to pick up changes.
- **Washington DC** has no `mrp_bodycam_support` value — DC isn't a Census "place," so it's not in TrueViews' place-level file. The bodycam-support plot drops it; the Dem-vote-share plots include it.
