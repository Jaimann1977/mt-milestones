# MT Milestones

**Musictoday's automated daily client milestones report.**

Every weekday at 12:01 AM ET, this system automatically:
1. Reads `data/milestones.csv` and finds all events matching today's date
2. Generates a beautiful interactive HTML report with artist images and history popups
3. Captures a pixel-perfect PDF via headless Chrome
4. Emails the PDF + interactive link to the team
5. Commits the new report to GitHub (so the hosted server always serves the latest)

---

## Project Structure

```
mt-milestones/
├── .github/workflows/
│   └── daily-report.yml      ← GitHub Actions cron
├── data/
│   ├── milestones.csv         ← your enriched CSV (all 6,147 rows)
│   ├── images-manifest.json  ← maps artist names → Google Drive file IDs
│   └── current-pdf.json      ← pointer to today's PDF (auto-generated)
├── pdfs/                      ← today's PDF lives here (auto-managed)
├── public/
│   └── report.html            ← today's generated report (auto-generated)
├── scripts/
│   ├── enrich-notes.js        ← ONE-TIME: add history blurbs to all CSV rows
│   ├── generate-report.js     ← builds HTML from CSV
│   ├── capture-pdf.js         ← Puppeteer → PDF
│   └── send-email.js          ← Nodemailer email dispatch
├── server.js                  ← Express: serves report + /download
├── package.json
└── README.md
```

---

## Initial Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_ORG/mt-milestones.git
cd mt-milestones
npm install
```

### 2. Run the one-time notes enrichment

This populates the empty `Notes` column in `milestones.csv` with historical blurbs for all 6,147 rows. **Only run this once.** It takes roughly 30–60 minutes depending on rate limits. It saves progress after every 20-row batch so you can safely stop and resume.

```bash
ANTHROPIC_API_KEY=sk-your-key node scripts/enrich-notes.js
```

Progress is saved to `data/enrich-progress.json`. If interrupted, just re-run the same command.

When complete, commit the updated CSV:
```bash
git add data/milestones.csv
git commit -m "chore: enrich all milestone notes"
git push
```

### 3. Add artist images from Google Drive

Images are stored locally in the repo — no external CDN, no Drive API at runtime.

**Step A — Copy images into the project:**
1. Open the shared Google Drive folder
2. Right-click the `artist_images` folder → **Download** (saves as a zip)
3. Extract the zip contents directly into `public/images/` in the project  
   *(so you end up with `public/images/Iron Maiden.jpg`, `public/images/U2.jpg`, etc.)*
4. Also download `mtlogo_long.png` from Drive and place it at `public/mtlogo_long.png`

**Step B — Build the manifest:**
```bash
npm run build-manifest
```

This scans `public/images/`, fuzzy-matches every filename to the CSV store names using `data/name-mapping.json`, and writes `data/images-manifest.json`. Takes about 5 seconds.

Run with `--verbose` to see every match:
```bash
npm run build-manifest-verbose
```

If any artists are unmatched, either rename their image file to match the store name exactly, or add manually:
```bash
npm run add-image "Artist Name" "images/filename.jpg"
```

**Step C — Commit everything:**
```bash
git add public/images/ public/mtlogo_long.png data/images-manifest.json
git commit -m "chore: add artist images and build manifest"
git push
```

> **Note on repo size:** ~1,028 images at ~80KB each ≈ ~80MB total. This is within GitHub's recommended repo size. If it grows too large later, Git LFS is an option.

### 4. Configure GitHub Secrets

In your GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `EMAIL_USER` | Your Gmail address (e.g. `jason.coyner@musictoday.com`) |
| `EMAIL_PASS` | A [Gmail App Password](https://support.google.com/accounts/answer/185833) — NOT your login password |
| `EMAIL_TO` | Comma-separated recipients (e.g. `jason@musictoday.com,team@musictoday.com`) |
| `REPORT_BASE_URL` | The public URL of your hosted server (e.g. `https://mt-milestones.onrender.com`) |

### 5. Set up Gmail App Password

1. Go to your Google Account → Security
2. Enable 2-Factor Authentication (required)
3. Search for "App passwords" → Create one for "Mail"
4. Use that 16-character password as `EMAIL_PASS`

### 6. Host the server (optional, for the interactive web view)

**Render.com (free tier, recommended for MVP):**
1. Create a new Web Service → connect your GitHub repo
2. Build command: `npm install`
3. Start command: `node server.js`
4. Add environment variable: `PORT=3000`

The GitHub Actions workflow commits `public/report.html` to the repo daily, so Render will auto-deploy the latest report after each run.

---

## Daily Workflow (Automatic)

```
12:01 AM ET
    │
    ▼
GitHub Actions wakes up
    │
    ▼
generate-report.js → reads milestones.csv → filters today's date → writes public/report.html
    │
    ▼
capture-pdf.js → Puppeteer loads report.html → saves pdfs/YYYY-MM-DD.pdf → deletes yesterday's
    │
    ▼
send-email.js → sends email with PDF attached + link to interactive report
    │
    ▼
git commit → pushes report.html to repo → Render auto-deploys → server serves fresh report
```

---

## Manual Usage

**Generate for a specific date:**
```bash
node scripts/generate-report.js 2026-03-15
```

**Trigger full daily run manually:**
- Go to GitHub → Actions → "Daily Milestones Report" → Run workflow

**Run the server locally:**
```bash
node server.js
# Open http://localhost:3000
```

---

## Adjusting the Schedule

Edit `.github/workflows/daily-report.yml`:

```yaml
- cron: "1 5 * * 1-5"   # Mon–Fri at 12:01 AM ET (UTC+5)
```

Summer (EDT, UTC-4): change to `1 4 * * 1-5`  
Every day: `1 5 * * *`

---

## Roadmap / Future Enhancements

- [ ] Google Service Account integration for automatic image manifest generation
- [ ] Render.com / internal server migration guide
- [ ] Employee login page with date picker (view historical reports)
- [ ] Slack notification as alternative/addition to email
- [ ] "Five or Ten" milestone highlighting with special visual treatment
- [ ] Automatic timezone detection (EDT vs EST)
