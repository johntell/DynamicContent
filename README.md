# Dynamic Content

Generate on-brand banners across social formats from a single image asset. Configure text layers, focal points, and export as PNG or ZIP — all in the browser.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5174` in your browser.

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
- **Export** — download individual PNGs or all formats as a ZIP
- **Context menu** — right-click formats to copy, paste, or duplicate with all settings
- **Interference detection** — warns when text overlaps the focal area and suggests anchor fixes

## Project structure

```
src/
  views/            TemplatesView.vue — main orchestrator
  components/
    templates/      UI panels (controls, canvas, format properties, styles)
  composables/      Rendering engine, canvas interaction, font loading, export
  stores/           Pinia stores (template state, project manager)
  css/              Global variables and reset
```

## Tech stack

- **Vue 3** (Composition API)
- **Pinia** for state management
- **Vite** for dev server and build
- **Canvas API** for rendering (no external drawing libs)
- **JSZip** for multi-format ZIP export
- **Google Fonts** loaded on demand

## How data is stored

Everything lives in `localStorage` under the key `tpl_builder_v8`. No backend, no accounts, no network calls required — the app is fully self-contained.

## Build for production

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static file server.

## License

MIT
