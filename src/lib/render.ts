// Item markup, shared by the server (page render) and the editor (items created
// at runtime). Returns HTML strings; every dynamic value goes through esc().
// Styles: src/styles/items.css.

import { toEmbed } from './embeds';
import type { FileData, ImageData, Item, LinkData, NoteData } from './types';

export interface FolderInfo {
  name: string;
  href: string;
  count: number;
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < u.length - 1) (n /= 1024), i++;
  return `${n < 10 && i ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const ICON_FOLDER = `<svg class="folder-icon" width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden="true"><path d="M1 4a3 3 0 0 1 3-3h6.2a3 3 0 0 1 2.1.9L14 3.5h10a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V4z" fill="currentColor" opacity=".14" stroke="currentColor" stroke-opacity=".5" stroke-width="1.2"/></svg>`;

function inner(item: Item, folder?: FolderInfo): { html: string; attrs?: string } | null {
  const d = item.data;
  switch (item.type) {
    case 'folder': {
      if (!folder) return null;
      return {
        attrs: `data-name="${esc(folder.name)}"`,
        html: `<a class="folder" href="${esc(folder.href)}" data-folder-href="${esc(folder.href)}" draggable="false">${ICON_FOLDER}<span class="folder-name">${esc(folder.name)}</span><span class="folder-meta">${folder.count === 0 ? 'Boş' : `${folder.count} öğe`}</span></a>`,
      };
    }
    case 'image': {
      const { key, name } = d as unknown as ImageData;
      if (!str(key)) return null;
      return { html: `<img src="/files/${esc(key)}" alt="${esc(name)}" draggable="false" decoding="async" loading="lazy">` };
    }
    case 'note': {
      const { text } = d as unknown as NoteData;
      return { html: `<div class="note"><div class="note-text">${esc(text)}</div></div>` };
    }
    case 'link': {
      const { url, title, description, siteName, image } = d as unknown as LinkData;
      if (!str(url)) return null;
      const host = hostOf(url);
      return {
        attrs: `data-href="${esc(url)}"`,
        html:
          `<div class="link${image ? ' has-image' : ''}">` +
          (image ? `<div class="link-image"><img src="/files/${esc(image)}" alt="" draggable="false" loading="lazy" decoding="async"></div>` : '') +
          `<div class="link-body"><div class="link-title">${esc(title || host || url)}</div>` +
          (description ? `<div class="link-desc">${esc(description)}</div>` : '') +
          `<div class="link-host">${esc(siteName || host)}</div></div></div>`,
      };
    }
    case 'embed': {
      const e = toEmbed(str(d.url));
      if (!e) return null;
      return {
        attrs: `data-href="${esc(d.url)}" data-provider="${e.provider}"`,
        // data-src: the canvas loads it when it scrolls into view (native lazy loading misses transformed iframes).
        html: `<div class="embed"><iframe data-src="${esc(e.src)}" title="${esc(e.provider)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`,
      };
    }
    case 'file': {
      const { key, name, size } = d as unknown as FileData;
      if (!str(key)) return null;
      const ext = (str(name).split('.').pop() ?? '').slice(0, 5).toUpperCase() || 'DOSYA';
      return {
        attrs: `data-href="/files/${esc(key)}"`,
        html: `<div class="file"><div class="file-badge">${esc(ext)}</div><div class="file-body"><div class="file-name">${esc(name || key)}</div><div class="file-meta">${esc(formatSize(size))}</div></div></div>`,
      };
    }
  }
  return null;
}

/** Outer `.item` element with geometry and data-* attributes the canvas/editor read. */
export function renderItem(item: Item, folder?: FolderInfo): string {
  const r = inner(item, folder);
  if (!r) return '';
  const style = `left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px;z-index:${item.z}`;
  return (
    `<div class="item" style="${style}" data-item="${esc(item.id)}" data-type="${item.type}"` +
    ` data-x="${item.x}" data-y="${item.y}" data-w="${item.w}" data-h="${item.h}" data-z="${item.z}"` +
    `${r.attrs ? ` ${r.attrs}` : ''}>${r.html}</div>`
  );
}
