# Roadmap

Agreed with the owner on 2026-11-24. Phases run in order.

## Done

1. Astro + Cloudflare skeleton: left panel, empty canvas with working pan/zoom. No data yet. (2026-11-24, see [log.md](log.md))
2. D1 schema and folder structure: panel tree, folder cards, double-click to enter, per-folder URLs. (2026-11-24)

## Now

3. Admin mode: image/GIF upload to R2, move and resize items.
4. URL cards, embeds, text notes, files.
5. Cloudflare Access on write paths, deploy, polish.

## Later

- Optional owner-added features such as connector lines or drawing (explicitly not default; see [decisions.md](decisions.md)).

## Unresolved

- Custom domain: not decided.
- Mobile editing UX (touch drag/resize, pinch zoom for visitors): expected but not specified.
- Item metadata (captions, tags, filtering): not requested for v1; not decided.
- How URL-card previews are fetched (server-side unfurl in a Worker is the likely approach — inferred, not decided).

## Evidence

- Owner chat, 2026-11-24.
