# Apps Script deployment

This folder contains Google Apps Script source files you can paste into a bound project attached to your Google Sheet.

Files:
- Code.gs: Web App endpoint that ingests sessions, writes rows to `Sheet1`, `Problems`, `GameModes`, `Sitdowns`, and `DailyStats` (with headers). No formulas required.
- Analytics.gs: Optional menu command "Recompute All Analytics". Generates summary sheets (ByOperator, Heatmaps, Pacing, Trend, Consistency, Throughput, SessionAggregates, ByGameKey, WeeklyStats).
- DashboardWebApp.gs + Index.html: Web App dashboard UI (filters for standardization, duration, and game key) rendering charts from Sheets data.

Setup steps:
1. Create a Google Sheet and copy its ID (between /d/ and /edit in URL).
2. In the Apps Script editor (Extensions → Apps Script) for that sheet, create files matching these names and paste the contents.
3. In each `.gs` file, set `SPREADSHEET_ID` to your sheet ID.
4. Deploy the ingestion endpoint:
   - In Code.gs: Deploy → Manage deployments → New deployment → Web app
   - Execute as: Me; Who has access: Anyone with the link
   - Copy the Web App URL and set it in your extension storage: `chrome.storage.local.set({ apps_script_url: 'PASTE_URL' })`
5. (Optional) Deploy the dashboard UI:
   - In DashboardWebApp.gs / Index.html: Deploy as Web App (same settings) and open the URL.
6. (Optional) Analytics: In the spreadsheet, a new menu "Analytics" will appear; click "Recompute All Analytics" to refresh summary tables.

Notes:
- Tab names must match: `Sheet1`, `Problems`, `GameModes`, `Sitdowns`, `DailyStats`.
- If you rename tabs, update constants in the scripts accordingly.
- The ingestion endpoint writes headers automatically if a tab is empty.