# Decisions

All entries below come from the owner's answers in chat on 2026-11-24. Status `accepted` means decided, not implemented.

## 2026-11-24 — Framework: Astro

- Status: accepted
- Decision: Build the site with Astro.
- Rationale: Owner's starting requirement.
- Source: owner, chat 2026-11-24.

## 2026-11-24 — Editing happens on the live site, behind sign-in

- Status: accepted
- Decision: The owner edits on the same public site after signing in (an `/admin` area or edit mode). Visitors are read-only. Local-only editing + redeploy was rejected.
- Rationale: Lets the owner add content from anywhere, including a phone.
- Source: owner, chat 2026-11-24.

## 2026-11-24 — Hosting and storage: Cloudflare (R2 + D1)

- Status: accepted
- Decision: Deploy on Cloudflare. Uploaded files (images, GIFs, PDFs) go to R2; canvas layout, items, and folders go to D1 (KV only if a clear need appears).
- Rationale: Astro runs well on Cloudflare; generous free tier; one platform for files, data, and auth.
- Source: owner, chat 2026-11-24.

## 2026-11-24 — Auth: Cloudflare Access

- Status: accepted
- Decision: Protect write paths (admin pages and write APIs) with Cloudflare Access (email one-time code). The app does not implement its own password login.
- Rationale: No credential handling in app code.
- Source: owner, chat 2026-11-24.
- Note (inferred): the server should still verify the Access JWT (`Cf-Access-Jwt-Assertion`) on write APIs rather than trusting the route alone.

## 2026-11-24 — Canvas engine: custom, lightweight, DOM-based

- Status: accepted
- Decision: Write our own pan/zoom/drag/resize engine instead of using tldraw or a similar library.
- Rationale: Full control over item types and look, small bundle, easy image/GIF/embed rendering.
- Source: owner, chat 2026-11-24.

## 2026-11-24 — Folders are cards you enter

- Status: accepted
- Decision: A folder is a card on the canvas; double-click enters it and shows that folder's own canvas. The left panel mirrors the folder tree; each folder has its own URL path. The "folder = frame region with zoom" alternative was rejected.
- Source: owner, chat 2026-11-24.

## 2026-11-24 — No default lines or drawing tools

- Status: accepted
- Decision: v1 ships without connectors, arrows, or freehand drawing. The owner said they will add such features from admin if needed later.
- Source: owner, chat 2026-11-24 ("gerekirse kendim eklerim admin'den, ama default çizgiler olmayacak").

## 2026-11-24 — Visual style: minimal and calm

- Status: accepted
- Decision: Light background with faint dot grid, minimal chrome, content first; dark theme supported. The colorful FigJam-like style was rejected.
- Source: owner, chat 2026-11-24.

## 2026-11-24 — Build slowly, in phases

- Status: accepted
- Decision: Work proceeds step by step in the order in [roadmap.md](roadmap.md). Project name stays `ily-cave`.
- Source: owner, chat 2026-11-24 ("yavaştan", "başlayalım").

## 2026-11-24 — Editor lives at /admin, mirroring public URLs

- Status: accepted (implementation choice within the owner's "edit on the live site" decision)
- Decision: The editor is the same folder page served at `/admin/<path>`. Write APIs live under `/api/admin/*`. Both are guarded in app code; the Cloudflare Access policy will cover exactly these prefixes.
- Rationale: one Access rule protects everything writable, public pages stay cacheable and free of editor code, and "Görüntüle" maps 1:1 to the public URL.
- Source: implementation, 2026-11-24 (`src/middleware.ts`).

## 2026-11-24 — Owner check fails closed

- Status: accepted (implementation choice)
- Decision: In production, `/admin` and `/api/admin` verify the Access JWT themselves and refuse when `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` is unset, instead of trusting that Access is in front.
- Rationale: a deploy before phase 5, a `*.workers.dev` URL, or a mis-scoped Access app must not expose write access.
- Source: implementation, 2026-11-24 (`src/lib/auth.ts`); verified with a production build (403 without a valid JWT).

## 2026-11-24 — Deleting a folder card deletes the folder

- Status: accepted (implementation choice; owner may revisit)
- Decision: A folder card is the folder's only handle on a canvas, so deleting the card deletes the folder subtree and its R2 files, after a confirm dialog.
- Source: implementation, 2026-11-24 (`deleteItem()` in `src/lib/db.ts`).

## 2026-11-24 — Production address: cave.ilyastorun.site

- Status: accepted
- Decision: Serve the site on a subdomain of the owner's `ilyastorun.site` zone, so Access can protect only `/admin` and `/api/admin`. The owner asked for "a subdomain"; `cave` was chosen by the agent and can be changed (one `routes` entry in `wrangler.jsonc`).
- Source: owner, chat 2026-11-24 ("ilyastorun.site domainine sub-domain bağla, admin de çalışsın").
