# ily-cave Wiki

## Start here

Read this page, then the newest entries at the top of [log.md](log.md) (stop once you have recent context), then only the pages relevant to the task.

## Current status

- 2026-11-24: Product direction decided by the owner in chat (see [decisions.md](decisions.md)).
- 2026-11-24: Roadmap phases 1–2 built locally: pan/zoom canvas, D1 folder tree, folder cards, per-folder URLs. Nothing is deployed; no editing UI yet (phase 3). Run `npm run db:migrate && npm run db:seed && npm run dev`.

## Pages

- [architecture.md](architecture.md) — runtime, D1 data model, routing, canvas engine, dev commands.
- [product.md](product.md) — what ily-cave is, scope, non-goals, product language.
- [decisions.md](decisions.md) — dated owner decisions on stack, editing, storage, canvas, auth, look.
- [roadmap.md](roadmap.md) — the five agreed build phases and what is open.
- [log.md](log.md) — newest-first work log.

## Evidence rules

- Owner decisions in chat outrank everything else; they are recorded with dates in [decisions.md](decisions.md). A decision is not an implementation fact until code exists.
- Current user decisions, implementation, tests, and maintained specifications may disagree; record conflicts instead of hiding them.
- Follow page-level Sources or Evidence sections to primary artifacts.
