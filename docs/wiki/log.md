# Project Log

<!-- Newest first. Log meaningful changes, not mechanical edits. Keep each entry to about 10 lines.
     Past ~50 entries or 64 KB, move older months to archive/log-YYYY-MM.md and link them below. -->

## 2026-11-24 — Phase 5 (part 2): Cloudflare Access

- Work: at the owner's request the agent created the Access app "ily-cave admin" in the dashboard (built-in browser, owner already signed in): destinations `cave.ilyastorun.site/admin` and `/api/admin`, existing "Admin owner" policy (include: owner's email only, checked), 24 h session. Set `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` in `wrangler.jsonc` and redeployed.
- Verification: curl against production: `/` 200; `/admin`, `/admin/x`, `/api/admin/upload` and `/admin` with a fake JWT header → 302 to the Access login.
- Observed signed in (owner's existing Access session in the built-in browser): `/admin` renders the editor; `PATCH /api/admin/items/<unknown id>` → app-level 404, i.e. the Worker accepted the real Access JWT.
- Not verified: an actual upload/write to production D1/R2 (no content was created).

## 2026-11-24 — Phase 5 (part 1): first production deploy

- Work: deployed to `cave.ilyastorun.site` (owner chose the `ilyastorun.site` zone and approved creating the Worker, D1 and R2). Disabled the adapter's SESSION KV and IMAGES bindings, turned off workers.dev and preview URLs, added meta description/og tags, pinned the D1 id, applied `0001_init.sql` remotely.
- Files: `astro.config.mjs`, `wrangler.jsonc`, `src/layouts/Base.astro`.
- Verification: `wrangler deploy` provisioned D1 `ily-cave` and R2 `ily-cave-files`; live checks with curl: `/` 200 with empty root canvas, `/yok` 404, `/admin` and `/api/admin/upload` 403 (Access vars still empty), `/favicon.svg` 200.
- Pending: Cloudflare Access application (owner, in the Zero Trust dashboard; the wrangler token has no Access scope), then set `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` and redeploy.

## 2026-11-24 — Phase 4: notes, links, embeds, files

- Work: note/link/embed/file items; shared HTML renderer for server and editor; embed allowlist (YouTube, Vimeo, Spotify, X, Loom, Figma); server-side unfurl with og:image copied to R2; any-file uploads served as sandboxed downloads (PDF inline); paste URL/text, drop links; N/L shortcuts; tap actions per type.
- Files: `src/lib/{types,embeds,render,unfurl}.ts`, `src/styles/items.css`, `src/components/Canvas.astro`, `src/scripts/editor.ts`, `src/pages/api/admin/{upload,items/index,items/[id]}.ts`, `src/pages/files/[...key].ts`, `src/lib/db.ts`; removed `src/components/items/FolderCard.astro`.
- Verification: `astro check` 0 errors, build ok. Observed: pasted YouTube URL → embed, pasted astro.build → link card with title/description/image, pasted text → note, dropped PDF → file card; note double-click edit persisted; view mode tap opens link/file, tap activates embed, outside press deactivates. curl: PDF inline without CSP, HTML upload attachment + sandbox CSP, localhost/127.0.0.1/192.168.x/`javascript:`/`ftp:` links → 400, `text` on an image → 404. `toEmbed` checked against 12 sample URLs.
- Found and fixed: native lazy iframes never loaded inside the transformed world → IntersectionObserver with `data-src`.
- Not verified: X/Spotify/Vimeo/Loom/Figma embeds actually rendering (only YouTube observed); real clicks inside an embed (the test tool cannot click transformed iframes); unfurl of sites that block bots.
- Follow-ups: phase 5 (Cloudflare Access, deploy).

## 2026-11-24 — Phase 3: admin editor, R2 image/GIF uploads

- Work: `/admin/<path>` editor (select, move, 4-corner resize with aspect lock, nudge, z-order, delete), image/GIF upload via toolbar/drop/paste to R2, folder create, public `/files/<key>` serving, owner guard middleware with Access JWT verification.
- Files: `src/middleware.ts`, `src/lib/{auth,http,page}.ts`, `src/lib/db.ts` (writes), `src/pages/api/admin/**`, `src/pages/files/[...key].ts`, `src/pages/admin/[...path].astro`, `src/components/FolderPage.astro`, `src/scripts/editor.ts`, `wrangler.jsonc` (R2 + vars); `jose` dependency.
- Decisions: see the three new entries in [decisions.md](decisions.md) (editor at /admin, fail-closed auth, folder-card delete = folder delete).
- Verification: `astro check` 0 errors. Observed locally: drop-upload of 2+2 PNGs with correct aspect, move, aspect-locked resize, `[`/`]`, persistence after reload, delete removes the R2 object (200→404), folder create (`Çalma listeleri & Notlar` → `calma-listeleri-notlar`) and sidebar update, folder-card delete cascades (subfolder 404, its R2 file 404). curl: foreign/missing Origin 403, `text/html` upload 415. Production build via `astro preview`: `/admin`, `/api/admin/upload`, fake JWT → 403; `/` 200.
- Found and fixed: concurrent uploads got the same z (read-then-insert race) → z computed inside the INSERT.
- Not verified: real Access JWT (phase 5), touch editing on a device, paste from the OS clipboard (only drop was exercised), very large GIFs.
- Follow-ups: phase 4 (URL cards, embeds, notes, files). No undo, no multi-select, no folder rename yet.

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
