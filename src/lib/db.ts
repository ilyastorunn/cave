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

export type ItemType = 'folder' | 'image' | 'link' | 'embed' | 'note' | 'file';

export interface Item {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  targetFolderId: string | null;
  data: Record<string, unknown>;
}

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
