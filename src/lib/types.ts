// Shared by server and browser code (no runtime imports).

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

/** What each type keeps in `items.data`. */
export interface ImageData { key: string; mime?: string; name?: string; nw?: number; nh?: number }
export interface FileData { key: string; name: string; size: number; mime?: string }
export interface NoteData { text: string }
export interface LinkData { url: string; title?: string; description?: string; siteName?: string; image?: string }
export interface EmbedData { url: string }
