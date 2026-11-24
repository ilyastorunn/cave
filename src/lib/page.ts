import { ancestors, countItems, loadItems, loadTree, resolvePath, type FolderNode, type FolderTree, type Item } from './db';

export interface FolderPageData {
  tree: FolderTree;
  folder: FolderNode | null; // null → 404
  chain: FolderNode[];
  items: Item[];
  counts: Map<string, number>;
}

/** Everything a folder page needs, for both the public site and /admin. */
export async function loadFolderPage(rawPath: string | undefined): Promise<FolderPageData> {
  const segments = (rawPath ?? '').split('/').filter(Boolean).map(decodeURIComponent);
  const tree = await loadTree();
  const folder = resolvePath(tree, segments);
  if (!folder) return { tree, folder: null, chain: [], items: [], counts: new Map() };

  const items = await loadItems(folder.id);
  const targets = items.flatMap((i) => (i.type === 'folder' && i.targetFolderId ? [i.targetFolderId] : []));
  const counts = await countItems(targets);
  return { tree, folder, chain: ancestors(tree, folder), items, counts };
}

/** Prefixes a folder path ('/' or '/a/b') with the site section ('' or '/admin'). */
export function href(base: string, path: string): string {
  if (!base) return path;
  return path === '/' ? base : base + path;
}
