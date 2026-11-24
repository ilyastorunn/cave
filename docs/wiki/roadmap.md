# Roadmap

Agreed with the owner on 2026-11-24. Phases run in order.

## Done

1. Astro + Cloudflare skeleton: left panel, empty canvas with working pan/zoom. No data yet. (2026-11-24, see [log.md](log.md))
2. D1 schema and folder structure: panel tree, folder cards, double-click to enter, per-folder URLs. (2026-11-24)
3. Admin mode: image/GIF upload to R2, move and resize items, folder create/delete. (2026-11-24)
4. URL cards, embeds, text notes, files. (2026-11-24)

## Now

5. Cloudflare Access on `/admin*` and `/api/admin/*` (set `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`), deploy, polish. Deploy and Access done 2026-11-24 (signed-in editor verified).

## Later

- Optional owner-added features such as connector lines or drawing (explicitly not default; see [decisions.md](decisions.md)).

## Unresolved

- Editor gaps not yet requested or scheduled: undo, multi-select, folder rename/move, an entry point from the public site to `/admin`.
- Mobile editing UX (touch drag/resize, pinch zoom for visitors): expected but not specified.
- Item metadata (captions, tags, filtering): not requested for v1; not decided.

## Evidence

- Owner chat, 2026-11-24.
