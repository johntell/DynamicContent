# Dynamic Content

Generate on-brand banners across social formats from a single image asset. Configure text layers, focal points, and export as PNG or ZIP — all in the browser.

## Prerequisites

You only need one thing installed on your computer: **Node.js** (version 18 or newer).

### Installing Node.js

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** (Long Term Support) version for your operating system
3. Run the installer — accept the defaults, no custom options needed
4. When it finishes, open a terminal to verify it worked:

**Windows:** press `Win + R`, type `cmd`, press Enter
**Mac:** open **Terminal** from Applications → Utilities

```bash
node --version
npm --version
```

Both commands should print a version number (e.g. `v20.11.0` and `10.2.0`). If they do, you're ready.

> **Note:** `npm` (Node Package Manager) is included automatically when you install Node.js — no separate install needed.

## Quick start

1. **Download the project** — click the green **Code** button on GitHub, then **Download ZIP**. Extract it somewhere on your computer. Alternatively, if you have Git installed:
   ```bash
   git clone https://github.com/johntell/DynamicContent.git
   ```

2. **Open a terminal in the project folder:**
   - **Windows:** open the extracted folder in File Explorer, click the address bar, type `cmd`, press Enter
   - **Mac:** right-click the folder → **Open in Terminal**

3. **Install dependencies** (first time only):
   ```bash
   npm install
   ```
   This downloads all the libraries the project needs. It may take a minute.

4. **Start the app:**
   ```bash
   npm run dev
   ```

5. **Open your browser** and go to `http://localhost:5174`

You should see the demo project with sample formats and assets loaded. To stop the app, press `Ctrl + C` in the terminal.

## What it does

Paste an image URL, add text layers (headline, body, CTA), and the app renders your content across multiple format cards (e.g. 1080x1080, 1200x628, 9:16 stories). Each format can be individually tuned for anchor position, visibility, sizing, and more.

### Key features

- **Multi-format canvas** — add as many formats as you need, arrange them freely on an infinite pan/zoom canvas
- **Multi-asset support** — add multiple image URLs per project, switch between them; each asset gets independent focal point settings
- **Per-asset anchor overrides** — different images can have different content anchors per format
- **Focal point control** — drag a focal area on the source image; choose between manual, smart crop, and content-aware modes
- **Text layers** — headline, body text, and CTA button with full typography controls (Google Fonts, weight, size, colour)
- **Logo overlay** — add a logo image with per-format sizing and anchor
- **Global styles** — background (solid, linear, radial gradients), overlay colour/opacity, CTA button styling
- **Multi-project** — create, rename, duplicate, and switch between independent projects
- **Project import/export** — share project defaults with colleagues as `.json` files
- **Bulk data (CSV/XLSX)** — import a spreadsheet, map columns to layers, preview each row across all formats, and bulk export as a ZIP
- **Export** — download individual PNGs, all formats as a ZIP, or bulk export rows × formats
- **Context menu** — right-click formats to copy, paste, or duplicate with all settings
- **Interference detection** — warns when text overlaps the focal area and suggests anchor fixes

## Bulk data workflow

1. Create your template with layers (headline, text, CTA) and formats
2. Open the **Bulk Data** section in the left panel
3. Drop a CSV or XLSX file — columns auto-map to matching layers
4. Adjust mappings if needed; optionally map source image and logo columns
5. Step through rows to preview each variation across all formats
6. Click **Export All** to generate a ZIP with per-row folders containing PNGs for every format

## Project sharing

Export any project as a `.json` file from the project switcher dropdown, then share it with colleagues who can import it into their own instance.

## Project structure

```
src/
  views/            TemplatesView.vue — main orchestrator
  components/
    templates/      UI panels (controls, canvas, bulk data, format properties, styles)
  composables/      Rendering engine, canvas interaction, font loading, export, spreadsheet parsing
  stores/           Pinia stores (template state, project manager, bulk data)
  css/              Global variables and reset
```

## Tech stack

- **Vue 3** (Composition API)
- **Pinia** for state management
- **Vite** for dev server and build
- **Canvas API** for rendering (no external drawing libs)
- **JSZip** for multi-format ZIP export
- **SheetJS (xlsx)** for CSV/XLSX spreadsheet parsing
- **Google Fonts** loaded on demand

## How data is stored

Everything lives in `localStorage` under the key `tpl_builder_v8`. No backend, no accounts, no network calls required — the app is fully self-contained.

## Build for production

If you want to deploy the app to a web server (so others can use it without installing anything):

```bash
npm run build
```

This creates a `dist/` folder with static HTML, CSS, and JS files. Upload that folder to any web host (Netlify, Vercel, GitHub Pages, or any static file server).

## Troubleshooting

| Problem | Solution |
|---|---|
| `node` or `npm` not recognised | Node.js isn't installed or wasn't added to your PATH — reinstall from [nodejs.org](https://nodejs.org) |
| `npm install` fails with permission errors | **Windows:** run the terminal as Administrator. **Mac:** prefix with `sudo npm install` |
| Port 5174 already in use | Another app is using that port. Stop it, or run `npx vite --port 3000` to use a different port |
| Blank page in browser | Make sure you're visiting `http://localhost:5174`, not `https://` |

## License

MIT
