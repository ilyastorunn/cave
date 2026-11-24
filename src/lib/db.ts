import { env } from 'cloudflare:workers';

export const ROOT_ID = 'root';

export interface Folder {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
}

export interface FolderNode extends Folder {
  path: string; // URL path, '/' for root, '/a/b' otherwise
  children: FolderNode[];
}

import type { Item, ItemType } from './types';
export type { Item, ItemType } from './types';

interface FolderRow {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
}

interface ItemRow {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  target_folder_id: string | null;
  data: string;
}

export interface FolderTree {
  root: FolderNode;
  byId: Map<string, FolderNode>;
}

/** Loads every folder and builds the tree. The archive is small enough that one query beats walking paths. */
export async function loadTree(): Promise<FolderTree> {
  const { results } = await env.DB.prepare('SELECT id, parent_id, slug, name FROM folders ORDER BY name COLLATE NOCASE').all<FolderRow>();

  const byId = new Map<string, FolderNode>();
  for (const r of results) {
    byId.set(r.id, { id: r.id, parentId: r.parent_id, slug: r.slug, name: r.name, path: '/', children: [] });
  }

  const root = byId.get(ROOT_ID);
  if (!root) throw new Error("Root folder missing: run the D1 migrations (npm run db:migrate).");

  for (const node of byId.values()) {
    if (node.parentId) byId.get(node.parentId)?.children.push(node);
  }

  const setPaths = (node: FolderNode, base: string) => {
    for (const child of node.children) {
      child.path = `${base}/${child.slug}`;
      setPaths(child, child.path);
    }
  };
  setPaths(root, '');

  return { root, byId };
}

/** Resolves URL segments to a folder, or null when any segment is unknown. */
export function resolvePath(tree: FolderTree, segments: string[]): FolderNode | null {
  let node = tree.root;
  for (const seg of segments) {
    const next = node.children.find((c) => c.slug === seg);
    if (!next) return null;
    node = next;
  }
  return node;
}

/** Root → folder chain, for breadcrumbs. */
export function ancestors(tree: FolderTree, folder: FolderNode): FolderNode[] {
  const chain: FolderNode[] = [];
  let cur: FolderNode | undefined = folder;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? tree.byId.get(cur.parentId) : undefined;
  }
  return chain;
}

export async function loadItems(folderId: string): Promise<Item[]> {
  const { results } = await env.DB.prepare(
    'SELECT id, type, x, y, w, h, z, target_folder_id, data FROM items WHERE folder_id = ? ORDER BY z, created_at',
  )
    .bind(folderId)
    .all<ItemRow>();

  return results.map((r) => ({
    id: r.id,
    type: r.type,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    z: r.z,
    targetFolderId: r.target_folder_id,
    data: safeJson(r.data),
  }));
}

/** Item counts per folder, shown on folder cards. */
export async function countItems(folderIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!folderIds.length) return counts;
  const marks = folderIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT folder_id, COUNT(*) AS n FROM items WHERE folder_id IN (${marks}) GROUP BY folder_id`,
  )
    .bind(...folderIds)
    .all<{ folder_id: string; n: number }>();
  for (const r of results) counts.set(r.folder_id, r.n);
  return counts;
}

function safeJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Writes (admin only; callers are behind src/middleware.ts)
// ---------------------------------------------------------------------------

/** Top-level slugs that would shadow app routes. */
const RESERVED = new Set(['admin', 'api', 'files', '_astro', 'favicon.svg']);

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u' };

export function slugify(name: string): string {
  const s = name
    .trim()
    .replace(/[çğıİöşü]/gi, (c) => TR[c] ?? TR[c.toLowerCase()] ?? c)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'klasor';
}

async function uniqueSlug(parentId: string, base: string): Promise<string> {
  const { results } = await env.DB.prepare('SELECT slug FROM folders WHERE parent_id = ?').bind(parentId).all<{ slug: string }>();
  const taken = new Set(results.map((r) => r.slug));
  if (parentId === ROOT_ID) for (const r of RESERVED) taken.add(r);
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** SQL for "one above the top item" of a folder, evaluated inside the INSERT so concurrent creates don't collide. */
const NEXT_Z = '(SELECT COALESCE(MAX(z), 0) + 1 FROM items WHERE folder_id = ?)';

export async function folderExists(id: string): Promise<boolean> {
  return !!(await env.DB.prepare('SELECT 1 FROM folders WHERE id = ?').bind(id).first());
}

/** Creates a folder under `parentId` plus the card that opens it on the parent's canvas. */
export async function createFolder(parentId: string, name: string, pos: { x: number; y: number }) {
  const folderId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const slug = await uniqueSlug(parentId, slugify(name));
  const [, card] = await env.DB.batch<{ z: number }>([
    env.DB.prepare('INSERT INTO folders (id, parent_id, slug, name) VALUES (?, ?, ?, ?)').bind(folderId, parentId, slug, name),
    env.DB.prepare(
      `INSERT INTO items (id, folder_id, type, x, y, w, h, z, target_folder_id)
       VALUES (?, ?, 'folder', ?, ?, 200, 140, ${NEXT_Z}, ?) RETURNING z`,
    ).bind(itemId, parentId, pos.x, pos.y, parentId, folderId),
  ]);
  return { folderId, itemId, slug, z: card.results[0]?.z ?? 1 };
}

export interface NewItem {
  folderId: string;
  type: Exclude<ItemType, 'folder'>;
  x: number;
  y: number;
  w: number;
  h: number;
  data: Record<string, unknown>;
}

/** Inserts an item on top of its folder's stack and returns it as stored. */
export async function createItem(it: NewItem): Promise<Item> {
  const id = crypto.randomUUID();
  const row = await env.DB.prepare(
    `INSERT INTO items (id, folder_id, type, x, y, w, h, z, data) VALUES (?, ?, ?, ?, ?, ?, ?, ${NEXT_Z}, ?) RETURNING z`,
  )
    .bind(id, it.folderId, it.type, it.x, it.y, it.w, it.h, it.folderId, JSON.stringify(it.data))
    .first<{ z: number }>();
  return { id, type: it.type, x: it.x, y: it.y, w: it.w, h: it.h, z: row?.z ?? 1, targetFolderId: null, data: it.data };
}

/** Replaces a note's text. Only notes have owner-editable data for now. */
export async function updateNoteText(id: string, text: string): Promise<boolean> {
  const res = await env.DB.prepare("UPDATE items SET data = ?, updated_at = unixepoch() WHERE id = ? AND type = 'note'")
    .bind(JSON.stringify({ text }), id)
    .run();
  return res.meta.changes > 0;
}

export type Geometry = Partial<Pick<Item, 'x' | 'y' | 'w' | 'h' | 'z'>>;

export async function updateGeometry(id: string, g: Geometry): Promise<boolean> {
  const cols = (['x', 'y', 'w', 'h', 'z'] as const).filter((k) => g[k] !== undefined);
  if (!cols.length) return true;
  const sql = `UPDATE items SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = unixepoch() WHERE id = ?`;
  const res = await env.DB.prepare(sql)
    .bind(...cols.map((c) => g[c]!), id)
    .run();
  return res.meta.changes > 0;
}

/**
 * Deletes an item. Deleting a folder card deletes the folder and its whole
 * subtree (FK cascade). R2 objects referenced by removed items are deleted too.
 */
export async function deleteItem(id: string): Promise<boolean> {
  const item = await env.DB.prepare('SELECT type, target_folder_id, data FROM items WHERE id = ?')
    .bind(id)
    .first<{ type: ItemType; target_folder_id: string | null; data: string }>();
  if (!item) return false;

  let keys: string[] = [];
  if (item.type === 'folder' && item.target_folder_id) {
    const { results } = await env.DB.prepare(
      `WITH RECURSIVE sub(id) AS (SELECT ? UNION ALL SELECT f.id FROM folders f JOIN sub ON f.parent_id = sub.id)
       SELECT data FROM items WHERE folder_id IN (SELECT id FROM sub)`,
    )
      .bind(item.target_folder_id)
      .all<{ data: string }>();
    keys = results.flatMap((r) => fileKeys(r.data));
    await env.DB.batch([
      env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id),
      env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(item.target_folder_id),
    ]);
  } else {
    keys = fileKeys(item.data);
    await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run();
  }

  if (keys.length) await env.FILES.delete(keys);
  return true;
}

/** R2 keys an item owns: `key` (image, file) and `image` (link preview). */
function fileKeys(data: string): string[] {
  const d = safeJson(data);
  return [d.key, d.image].filter((k): k is string => typeof k === 'string' && /^[0-9a-f-]{36}\.[a-z0-9]{1,10}$/.test(k));
}
