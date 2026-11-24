# Project Log

<!-- Newest first. Log meaningful changes, not mechanical edits. Keep each entry to about 10 lines.
     Past ~50 entries or 64 KB, move older months to archive/log-YYYY-MM.md and link them below. -->

## 2026-11-24 — Phase 2: D1 folders, tree, folder cards

- Work: D1 schema (`folders`, `items`; a folder card is an item); sidebar tree from D1; folder cards on canvas; double-click/double-tap to enter; breadcrumbs; real 404 for unknown paths; per-folder view memory; fit-to-content on first visit.
- Files: `migrations/0001_init.sql`, `scripts/seed-local.sql`, `src/lib/db.ts`, `src/components/{Sidebar,TreeNode,Canvas}.astro`, `src/components/items/FolderCard.astro`, `src/scripts/viewport.ts`, `wrangler.jsonc`.
- Decisions: in view mode dragging on cards pans (only edit mode makes items draggable); `wrangler.jsonc` has no `database_id` yet, relying on provisioning at first deploy (not verified). See [architecture.md](architecture.md).
- Verification: `astro check` 0 errors. Observed with seed data: tree and cards render, single click does not navigate, double-click enters `/tasarim`, tree expands and breadcrumb shows, dragging over a card pans, view restores after reload, `/yok/boyle-bir-sey` returns 404, light and dark themes. Found and fixed: initial view waited for rAF (flash / stuck in hidden tabs) → `flush()`.
- Not verified: double-tap on a real iOS/Android device; remote D1.
- Follow-ups: Phase 3 (admin edit mode, R2 image/GIF upload, move/resize). Folders can only be created via SQL until then.

## 2026-11-24 — Phase 1: skeleton + pan/zoom canvas

- Work: Astro 7.4 + `@astrojs/cloudflare` 14 (output `server`), left sidebar (static root only, mobile overlay), custom viewport engine with dot grid.
- Files: `astro.config.mjs`, `wrangler.jsonc`, `src/pages/[...path].astro`, `src/components/Sidebar.astro`, `src/components/Canvas.astro`, `src/scripts/viewport.ts`.
- Decisions: catch-all route gives every folder its own URL; items will carry `data-item` so drags on them are not pans. Adapter fills `main`/`assets`/`compatibility_date` itself, so `wrangler.jsonc` stays minimal. TypeScript pinned to 6 because `astro check` rejects TS 7.
- Verification: `npm run build` and `astro check` pass (0 errors). Observed in browser: root and `/tasarim/referanslar` render; synthetic drag pans, ctrl+wheel zooms at cursor, zoom label updates. Touch pinch and Safari gesture events not verified on a device.
- Follow-ups: Phase 2 (D1 schema, folder tree, folder cards, 404 for unknown paths). Adapter auto-adds a `SESSION` KV binding on deploy; unused so far.

## 2026-11-24 — Wiki setup and product direction

- Work: Gathered requirements from the owner in two question rounds; created the project wiki before any code.
- Files/docs: `docs/wiki/` (index, product, decisions, roadmap, log).
- Decisions: Astro; edit on the live site; Cloudflare R2 + D1; Cloudflare Access; custom DOM canvas; folder cards with own canvas and URL; no default lines; minimal look. See [decisions.md](decisions.md).
- Verification: Inspected the project folder; it was empty. No implementation exists yet.
- Follow-ups: Roadmap phase 1 (skeleton + pan/zoom canvas).

## Earlier history

<!-- Add links to archive/log-YYYY-MM.md files here once the log is rotated. -->
