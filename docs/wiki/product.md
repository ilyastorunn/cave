# Product

## Target user and promise

A personal, public archive shaped like a FigJam board. One owner adds and removes content; everyone else can only look. It should feel like "an app people can only view".

## Current scope

- An empty, infinite canvas: visitors pan and zoom, nothing else.
- The owner signs in on the same site and gets an edit mode on the same canvas.
- Content types: image, GIF, URL card (title + preview fetched from the link), video and embeds (YouTube, X/Twitter, etc.), text note, file (PDF and similar).
- Edit actions in v1: place, move, resize, change stacking order, delete.
- Folders: a folder is a card on the canvas; double-click opens that folder's own empty canvas. A left-side panel shows the same folders as a tree. Every folder has its own URL (`/folder/sub-folder`).
- Look: minimal and calm — light background, faint dot grid, very little UI, content first; dark theme supported.

## Non-goals (v1)

- No connector lines or arrows between cards by default. The owner may add drawing/line features later from admin if needed.
- No freehand drawing or shapes in v1.
- No multi-user editing, comments, or visitor accounts.

## Product language

- **Canvas**: the infinite board of one folder.
- **Item / card**: anything placed on a canvas (image, GIF, link, embed, note, file, folder).
- **Folder**: a card that opens its own canvas; nests arbitrarily.
- **Admin / edit mode**: the owner's signed-in state.

## Evidence

- Owner answers in chat, 2026-11-24 (two question rounds). See [decisions.md](decisions.md).
