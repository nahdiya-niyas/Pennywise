# PennyWise 💰

**Take Control of Your Money.**

PennyWise is a personal finance and budget management web application that helps you track income, manage expenses, monitor savings, and plan monthly budgets — all without an account, server, or database. Everything runs in your browser using LocalStorage.

---

## Features

| Module | What it does |
|---|---|
| **Dashboard** | Monthly snapshot: income, expenses, balance, savings, budget progress, charts, recent transactions |
| **Income** | Add / edit / delete income records with source, amount, date, and optional description |
| **Expenses** | Add / edit / delete expenses with title, category, amount, date, and optional description |
| **Budget** | Set a monthly budget and track usage with a live progress bar and warning thresholds |
| **Savings** | Auto-calculated savings (income − expenses), savings rate, and personalised insight |
| **Transactions** | Full transaction list with search, type/category filter, date sort, edit, and delete |
| **Reports** | Month-by-month summary, expense category chart, 6-month spending trend, category breakdown table |
| **Settings** | Export data as JSON, import a backup JSON file, or clear all data with confirmation |

---

## Tech Stack

- **HTML5** – semantic markup
- **CSS3** – custom properties, flexbox, CSS Grid, responsive design
- **Vanilla JavaScript (ES6+)** – no frameworks
- **Chart.js 4** – loaded via CDN for financial charts
- **Browser LocalStorage** – persistent data storage

---

## Project Structure

```
PennyWise/
├── index.html   ← Application shell and all page sections
├── style.css    ← All styles (layout, components, responsive)
├── script.js    ← Full application logic
└── README.md    ← This file
```

---

## Running Locally

No build step or server required.

### Option 1 – Open directly in a browser

1. Clone or download this repository.
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari).

> **Note:** Opening via `file://` works fine for all features because the app uses no server-side code.

### Option 2 – Using VS Code Live Server

1. Install the **Live Server** extension in VS Code.
2. Right-click `index.html` → **Open with Live Server**.

### Option 3 – Using Python's built-in HTTP server

```bash
# Python 3
cd PennyWise
python -m http.server 8080
# Then open http://localhost:8080
```

---

## Deploying to Amazon S3

This application is ready for static website hosting on S3.

### Manual deployment

1. Create an S3 bucket and enable **Static Website Hosting**.
2. Set the index document to `index.html`.
3. Upload `index.html`, `style.css`, and `script.js`.
4. Apply a bucket policy allowing public `GetObject`.

### CI/CD via AWS CodePipeline + CodeBuild

Add a `buildspec.yml` in the project root:

```yaml
version: 0.2

phases:
  build:
    commands:
      - echo "No build step required for static site"

artifacts:
  files:
    - index.html
    - style.css
    - script.js
  discard-paths: yes
```

**Pipeline architecture:**

```
GitHub → AWS CodePipeline → AWS CodeBuild → Amazon S3
```

All asset paths are relative, so the app works correctly from any S3 path or custom domain.

---

## Data & Privacy

- All data is stored **only in your browser's LocalStorage**.
- No data is sent to any server.
- No login or registration required.
- To back up your data, use **Settings → Export JSON**.
- To move data to another browser or device, export then import the JSON file.

---

## Browser Support

| Browser | Version |
|---|---|
| Chrome | 90+ |
| Firefox | 88+ |
| Edge | 90+ |
| Safari | 14+ |

---

## Testing Checklist

- [ ] Add an income record and verify it appears in Income and Dashboard
- [ ] Add an expense record and verify it appears in Expenses and Dashboard
- [ ] Edit an income record and confirm changes are saved
- [ ] Edit an expense record and confirm changes are saved
- [ ] Delete a transaction and confirm it is removed everywhere
- [ ] Set a monthly budget and verify the progress bar updates
- [ ] Verify budget warnings at <75%, 75–89%, 90–100%, >100%
- [ ] Check Savings page calculations (income − expenses)
- [ ] Navigate to Transactions and test search, filter by type, filter by category, sort
- [ ] Navigate to Reports, switch months with Prev/Next buttons
- [ ] Verify charts render correctly on Dashboard and Reports pages
- [ ] Export data as JSON and confirm file downloads
- [ ] Import the exported JSON and confirm data is restored
- [ ] Attempt to import an invalid JSON file and confirm the error message appears
- [ ] Clear all data and confirm everything resets
- [ ] Refresh the browser and confirm all data persists via LocalStorage
- [ ] Verify empty states appear when there are no transactions
- [ ] Test on mobile viewport (hamburger menu, responsive cards)
- [ ] Try submitting a form with empty required fields and confirm validation messages

---

## Known Limitations

- Data is stored per browser and device — there is no cloud sync.
- Clearing browser data (cookies/site data) will erase all PennyWise records; always export backups.
- Currency is fixed to USD by default. To change it, update the `currency` constant in `script.js`.

---

## License

MIT — free to use and modify for personal or commercial projects.
