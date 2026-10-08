# Asset Tagger (v1.2.0)

Offline-first, mobile-first web app for tagging HVAC / mechanical equipment on job sites
(AHUs, RTUs, chillers, boilers, pumps, VAVs, FCUs, exhaust fans, cooling towers, heat exchangers, VRF units…).

Plain static files. No build step, no server code, no account. All data stays in the phone's browser (IndexedDB).

## Features
- **Projects / job sites** with client, address and notes. Home screen shows progress (commissioned %) and open issues.
- **Asset records**: tag, equipment type, manufacturer, model, serial, capacity/size, building, floor, room/location,
  area served, install/mfr year, install date, **age** (auto), **life expectancy** (type defaults), **remaining life** (auto),
  status (Not started / Installed / Started up / Commissioned / Issue), notes, nameplate photos
  taken with the phone camera (resized to about 1600 px JPEG to save space).
- **Fast field entry**: equipment type is guessed from the tag prefix (AHU-, RTU-, CH-, B-, P-/CHWP-, VAV-, FCU-, EF-, CT-, HX-, VRF-),
  "Save & next" opens a new asset with the next tag number (VAV-2-01 → VAV-2-02) and the same type, manufacturer, model, building and floor.
  Autocomplete suggests manufacturer, building, floor, room and area-served values already used. One-tap status change on the asset page.
- **Scan QR codes and barcodes** (QR, Data Matrix, Code 128/39/93, EAN/UPC, ITF, PDF417…) with html5-qrcode.
  If the tag is found, the asset opens. If not, a new asset form opens with the tag filled in. You can also scan from a photo
  or type the tag. The scan button next to the Tag field scans a code straight into it.
- **Printable QR labels** in 2×1", 3×1.5" and 4×2" sizes, showing tag, type, location and project. Print or save as PDF.
  The QR holds the plain tag (works with any scanner). When the app is hosted on https there is also a "link" option,
  so the phone's normal camera opens the asset in the app (`#/find?tag=…`).
- **Search and filter** by status (chips with counts), type, building and floor, plus free-text search (tag, model, serial, room, notes…).
  Sort by tag (natural order), type, location, status or recently updated.
- **Export** to Excel (.xlsx with an Assets sheet, a Parts sheet (one row per filter/belt with next due date) and a Summary sheet of counts by status and type, with auto-filter) or CSV.
  On phones that support it, a Share… button sends the file to email, Teams, Drive and other apps.
- **Import** an equipment schedule from .xlsx or .csv. Headers are matched loosely (Tag/Mark, Mfr/Make, S/N, Bldg, Level, Serves, Cx Status…).
  A row with an existing tag updates that asset, and blank cells don't overwrite existing values. A blank template is included.
- **Filters & belts**: each asset can list the filters, belts and other wear parts it takes (size / part #, qty, replacement
  frequency: monthly, every 2 months, quarterly, every 4 months, semi-annual, annual or custom months), last replaced date and
  next due date (last replaced + frequency, or entered by hand when the last date is unknown). "Mark replaced today" rolls it forward.
- **Parts due list** per project (and across all projects): pick a service month (defaults to next month) to see every filter/belt
  due that month grouped by equipment, overdue items highlighted, plus consolidated **order totals** (e.g. 10 × 20x25x2 MERV 13, 2 × BX55).
  **Email this list** opens the phone's mail app with the To (project "Parts order email(s)"), subject and a plain-text body
  (totals first, then per-equipment breakdown) filled in. Also: Share text, Copy, Download Excel, Share Excel (to attach the file).
  The home screen shows a reminder banner the month before parts are due.
- **Backup / restore** of all projects, assets and photos as a single .json file.
- **Installable PWA**: a service worker caches everything, so the app opens and works with no signal after the first visit.

## Files
```
index.html             app shell
app.js                 all app logic (vanilla JS)
styles.css             styles (large touch targets, dark-mode aware, print styles for labels)
sw.js                  service worker (offline cache)
manifest.webmanifest   PWA manifest
icons/                 app icons
vendor/                html5-qrcode 2.3.8, qrcode-generator 1.4.4, SheetJS xlsx 0.20.3 (bundled locally, so no CDN is needed offline)
samples/               sample import CSV, sample export xlsx, sample label PDFs, headless end-to-end test script
screenshots/           mobile screenshots (390×844)
```

## Run locally
```
cd asset-tagger && python3 -m http.server 8080
# open http://localhost:8080
```
Camera live-scanning and offline install need **https** (or localhost). On plain http over a LAN IP, the app still works
but uses "Scan from photo" or typed tags instead of the live camera.

## Hosting (free, static, https)
Any static host works. Upload the folder contents as-is.
1. **GitHub Pages** (recommended): create a repo, upload these files, then Settings → Pages → deploy from branch `main` / root.
   You get `https://<user>.github.io/<repo>/`. A repo named `<user>.github.io` is served at the root automatically.
2. **Cloudflare Pages**: Workers & Pages → Create → Pages → "Upload assets" → drag the folder or zip. Free account needed.
3. **Netlify Drop**: drag the folder onto app.netlify.com/drop. Without an account the site is temporary
   (password-protected and deleted after 1 hour unless claimed), so sign in or claim it to keep it.

## Data notes / limitations
- "Email this list" uses a `mailto:` link (there is no server), so the app can't send email by itself or attach files:
  it opens your mail app ready to send. Very long lists are shortened in the email (totals first) – attach the Excel instead.
- Data lives only in that phone's browser. Clearing site data, uninstalling, or (on iPhone) not using a non-installed
  site for weeks can erase it. Install the app to the home screen, allow "storage protection", and **back up regularly**.
- There's no multi-user sync between devices yet. Use backup/restore or export/import to move data.
- Spreadsheet exports don't include photos (they show a photo count). The JSON backup does include them.
- When the app is updated, the new version loads on the second launch (stale-while-revalidate cache).
  Bump `CACHE` in sw.js with each release.
