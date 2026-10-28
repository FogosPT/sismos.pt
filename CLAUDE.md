# CLAUDE.md

sismos.pt — Astro 7 SSR on Cloudflare Workers (`@astrojs/cloudflare`), VOST Portugal. See README for commands and deploy.

- **api.fogos.pt needs a token**: secret `FOGOS_API_KEY`, sent as `X-API-Key` (override header name with `FOGOS_API_HEADER`). Without it production silently falls back to IPMA; `/api/status.json` shows why.
- **Data**: always through `getCachedCatalogue()` (`src/lib/catalogue.ts`). fogosapi (`v2/seismic/events`) is primary; IPMA → EMSC → USGS are fallbacks and the layout shows a notice when one is used. Never call upstreams per request without the edge cache.
- **Types** mirror fogosapi's `EarthquakeResource` (`src/lib/types.ts`); region polygons and `magType` normalisation must stay identical to fogosapi (`SeismicRegion`, `SeismicSource::magType`).
- **Realtime** (`src/scripts/live.ts`, pure parts in `src/lib/live.ts`): polls `/api/latest.json` every 60 s and, on a new earthquake, re-fetches the page and swaps every `[data-live]` fragment + `#quakes-data` (server markup stays the source of truth). The EMSC WebSocket adds "preliminar (EMSC)" rows (same-event rule ±15 s / 50 km) until fogosapi has them. Drawings subscribe to `src/scripts/store.ts` (`onRows`). Mark new server-rendered relative times with `data-rel` (+ `data-cap`) so they stay fresh. Dev only: `?live-test=1` injects a fake preliminary event.
- **Earthquake pages**: `/sismo/<24-hex id>-<slug>`; only fogosapi ids have pages (`hasPage`), fallback rows never link. Wrong/missing slug → 301 to the canonical one (slugs change with revisions). M < 2 or unknown magnitude → `noindex`, and the sitemap only lists M ≥ 2 (`SITEMAP_MIN_MAGNITUDE`).
- **OG images**: `/og/<id>.png` and `/og/sismos.png` via `@cf-wasm/og` (satori + resvg WASM, ~1.4 MB of the ~0.9 MB gzip bundle); plain `{type, props}` nodes in `src/lib/og.ts`, no React. Fonts come from Google Fonts at render time (cached).
- **Depth 0** means undetermined (fixed depth) — show "não determinada", never "0 km".
- **Times** are UTC in data; display in the region's timezone (`TIMEZONE` in `src/lib/region.ts`).
- **SEO**: content that matters (headline sentence, lists) is server-rendered; client scripts only draw (seismogram, maps) from the `#quakes-data` JSON embedded by `QuakeData.astro`.
- **Design** ("instrumento, não dashboard"): no card grids, KPI tiles, gradients, emojis; one signal colour (`--signal`); Fraunces / Hanken Grotesk / Geist Mono (self-hosted via fontsource). Light "papel" and dark "noite" themes via CSS tokens in `src/styles/global.css`.
- **Deploy**: Workers Builds on push to `main` (production) and on branches (preview). `wrangler deploy` from a laptop overwrites production — confirm first.
- Workflow: issue + branch + PR (`Closes #n`), commits `feat(scope): … (#n)`, labels `status::in-progress` / `status::done`.
