# Smart Scraper (MV3)

One‑button, privacy‑friendly web scraper for Chrome. Click “Smart Scrape” to auto‑detect tables and repeating lists on the current page, preview results, refine columns, optionally split exports, and download CSV/JSON — no server required.

## Why

Existing scrapers can feel complex. Smart Scraper aims for the 80/20: a single click that “just works” on most pages, with a small set of friendly refinements.

## Features

- Smart Scrape: auto‑detects visible tables and repeating lists/grids
- Multi‑section: captures multiple datasets (e.g., several tables/lists) with names
- Preview & Refine: toggle/reorder columns, live preview
- Split exports: single file, by column, or batched by size
- Clean (Beta): local heuristic to structure people/bio sections into name/title/description
- Export: CSV, JSON, Copy to clipboard
- Privacy‑friendly: runs fully client‑side; no external requests

## Install (Developer Mode)

1. Clone or download this repo
2. Open `chrome://extensions`
3. Enable “Developer mode” (top right)
4. Click “Load unpacked” and select this folder
5. Pin “Smart Scraper” and click it on any page

## Usage

1. Navigate to a page with a table or list
2. Click the extension → “Smart Scrape”
3. Use the dataset dropdown if multiple sections are detected
4. (Optional) Click “Refine” to toggle/reorder columns or configure split export
5. Export CSV/JSON or Copy
6. (Optional) “Clean (Beta)” for people‑style sections; “Revert” to undo

## Permissions

- `activeTab`, `scripting`, `tabs`, `storage`: required to inject the content script and save UI state
- `optional_host_permissions`: prompts on first scrape per site; you stay in control

## Development

- Popup UI: `scraper_popup.html/css/js`
- Content script (injected on demand): `smart_scrape_content.js`
- Manifest V3: `manifest.json`

### Scripts

None required; it’s a pure MV3 extension. Reload in `chrome://extensions` after changes.

## Roadmap

- Element picker fallback when auto‑detection is insufficient
- Pagination/“Load more” clicker
- Type normalization (numbers/currency/dates)
- AI‑assisted cleaning (opt‑in, local or cloud)
- Google Sheets export (OAuth)

## License

MIT — see `LICENSE`.
