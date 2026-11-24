/**
 * Owner editor, loaded only on /admin pages.
 *
 *  - click an item: select (Esc or click empty space: deselect)
 *  - drag an item: move; drag a corner handle: resize (images keep aspect ratio, Shift frees it)
 *  - arrows: nudge 1px (Shift 10px); ] / [ : bring to front / send to back
 *  - Delete / Backspace: delete (folders ask first: the whole subtree goes)
 *  - files (images/GIFs become image items, anything else a file card):
 *    toolbar "Yükle", drag-and-drop onto the canvas, or paste
 *  - links: toolbar "Link" (L), paste a URL, or drop a link; allowlisted
 *    providers become embeds, everything else an unfurled link card
 *  - notes: toolbar "Not" (N) or paste plain text; double-click a note to edit
 *  - folder: toolbar button
 */
import type { Viewport } from './viewport';
import { renderItem } from '../lib/render';
import { parseUrl } from '../lib/embeds';
import type { Item } from '../lib/types';

type Geom = { x: number; y: number; w: number; h: number };
type Dir = 'nw' | 'ne' | 'sw' | 'se';

const MIN = 32;
const MAX_INITIAL = 480; // initial on-canvas size of a new image's longer side

export function initEditor(vp: Viewport, stage: HTMLElement, world: HTMLElement) {
  vp.editable = true;
  const folderId = stage.dataset.folderId!;
  const hint = world.querySelector<HTMLElement>('.hint');
  const toastEl = document.getElementById('toast')!;

  // ------------------------------------------------------------------ helpers

  const geomOf = (el: HTMLElement): Geom => ({
    x: Number(el.dataset.x),
    y: Number(el.dataset.y),
    w: Number(el.dataset.w),
    h: Number(el.dataset.h),
  });

  const place = (el: HTMLElement, g: Geom) => {
    Object.assign(el.dataset, { x: g.x, y: g.y, w: g.w, h: g.h });
    el.style.left = `${g.x}px`;
    el.style.top = `${g.y}px`;
    el.style.width = `${g.w}px`;
    el.style.height = `${g.h}px`;
  };

  const setZ = (el: HTMLElement, z: number) => {
    el.dataset.z = String(z);
    el.style.zIndex = String(z);
  };

  const items = () => [...world.querySelectorAll<HTMLElement>('.item[data-item]')];
  const updateHint = () => hint && (hint.hidden = items().length > 0);

  let toastTimer = 0;
  const toast = (msg: string) => {
    toastEl.textContent = msg;
    toastEl.dataset.show = '';
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => delete toastEl.dataset.show, 2600);
  };

  // Note: Workers runtime types are global in this project and type Response.json() as unknown.
  async function api<T = { ok: true }>(method: string, url: string, payload?: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: payload !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  const save = (el: HTMLElement, patch: Record<string, number>) =>
    api('PATCH', `/api/admin/items/${el.dataset.item}`, patch).catch((e) => toast(`Kaydedilemedi: ${e.message}`));

  // Coalesce rapid changes (arrow-key nudges) into one request per item.
  const pending = new Map<HTMLElement, number>();
  const saveSoon = (el: HTMLElement) => {
    clearTimeout(pending.get(el));
    pending.set(
      el,
      window.setTimeout(() => {
        pending.delete(el);
        save(el, geomOf(el));
      }, 400),
    );
  };

  // ---------------------------------------------------------------- selection

  let selected: HTMLElement | null = null;

  const select = (el: HTMLElement | null) => {
    if (selected === el) return;
    if (selected) {
      delete selected.dataset.selected;
      selected.querySelectorAll('.handle').forEach((h) => h.remove());
    }
    selected = el;
    if (!el) return;
    el.dataset.selected = '';
    for (const d of ['nw', 'ne', 'sw', 'se'] as Dir[]) {
      const h = document.createElement('div');
      h.className = 'handle';
      h.dataset.handle = d;
      el.appendChild(h);
    }
  };

  // ------------------------------------------------------------ move / resize

  let drag: {
    el: HTMLElement;
    mode: 'move' | Dir;
    sx: number;
    sy: number;
    start: Geom;
    moved: boolean;
    id: number;
  } | null = null;

  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || vp.spaceDown) return;
    const target = e.target as Element;
    if (target.closest('[data-ui]')) return;
    if ((target as HTMLElement).isContentEditable) return; // caret placement in a note being edited
    const el = target.closest<HTMLElement>('.item[data-item]');
    if (!el) return select(null); // background press: viewport pans
    if (el.hasAttribute('data-uploading')) return;

    e.preventDefault();
    select(el);
    const handle = target.closest<HTMLElement>('.handle');
    drag = {
      el,
      mode: (handle?.dataset.handle as Dir) ?? 'move',
      sx: e.clientX,
      sy: e.clientY,
      start: geomOf(el),
      moved: false,
      id: e.pointerId,
    };
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const s = vp.state.scale;
    const dx = (e.clientX - drag.sx) / s;
    const dy = (e.clientY - drag.sy) / s;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
    drag.moved = true;

    const g = drag.start;
    if (drag.mode === 'move') {
      place(drag.el, { ...g, x: Math.round(g.x + dx), y: Math.round(g.y + dy) });
      return;
    }

    const west = drag.mode.includes('w');
    const north = drag.mode.includes('n');
    let w = Math.max(MIN, g.w + (west ? -dx : dx));
    let h = Math.max(MIN, g.h + (north ? -dy : dy));
    if (drag.el.dataset.type === 'image' && !e.shiftKey) {
      const ratio = g.w / g.h;
      // Follow whichever axis moved proportionally more.
      if (w / g.w > h / g.h) h = Math.max(MIN, w / ratio);
      else w = Math.max(MIN, h * ratio);
    }
    w = Math.round(w);
    h = Math.round(h);
    place(drag.el, {
      w,
      h,
      x: west ? g.x + g.w - w : g.x,
      y: north ? g.y + g.h - h : g.y,
    });
  });

  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { el, moved } = drag;
    drag = null;
    if (moved) save(el, geomOf(el));
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // ---------------------------------------------------------------- keyboard

  const zs = () => items().map((i) => Number(i.dataset.z) || 0);

  async function remove(el: HTMLElement) {
    if (el.dataset.type === 'folder') {
      const name = el.dataset.name ?? 'Bu klasör';
      if (!confirm(`“${name}” klasörü ve içindeki her şey kalıcı olarak silinecek. Emin misin?`)) return;
    }
    select(null);
    el.style.visibility = 'hidden';
    try {
      await api('DELETE', `/api/admin/items/${el.dataset.item}`);
      el.remove();
      updateHint();
      if (el.dataset.type === 'folder') location.reload(); // sidebar tree changed
    } catch (err) {
      el.style.visibility = '';
      toast(`Silinemedi: ${(err as Error).message}`);
    }
  }

  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === 'Escape') return select(null);
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === 'n' || e.key === 'N') return (e.preventDefault(), void addNote(''));
      if (e.key === 'l' || e.key === 'L') return (e.preventDefault(), promptLink());
    }
    if (!selected) return;
    const el = selected;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(el);
    } else if (e.key === ']' || e.key === '[') {
      e.preventDefault();
      const z = e.key === ']' ? Math.max(...zs()) + 1 : Math.min(...zs()) - 1;
      setZ(el, z);
      save(el, { z });
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const g = geomOf(el);
      if (e.key === 'ArrowLeft') g.x -= step;
      if (e.key === 'ArrowRight') g.x += step;
      if (e.key === 'ArrowUp') g.y -= step;
      if (e.key === 'ArrowDown') g.y += step;
      place(el, g);
      saveSoon(el);
    }
  });

  // ------------------------------------------------------------------ images

  const center = () => {
    const r = stage.getBoundingClientRect();
    return vp.toWorld(r.width / 2, r.height / 2);
  };

  const naturalSize = (url: string) =>
    new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 300, h: img.naturalHeight || 300 });
      img.onerror = () => resolve({ w: 300, h: 300 });
      img.src = url;
    });

  async function addImage(file: File, at: { x: number; y: number }) {
    const local = URL.createObjectURL(file);
    const n = await naturalSize(local);
    const k = Math.min(1, MAX_INITIAL / Math.max(n.w, n.h));
    const w = Math.round(n.w * k);
    const h = Math.round(n.h * k);
    const g = { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h };

    // Optimistic placeholder while uploading.
    const el = document.createElement('div');
    el.className = 'item';
    el.dataset.type = 'image';
    el.dataset.uploading = '';
    const img = document.createElement('img');
    img.alt = file.name;
    img.draggable = false;
    img.src = local;
    el.appendChild(img);
    place(el, g);
    setZ(el, Math.max(0, ...zs()) + 1);
    world.appendChild(el);
    updateHint();

    try {
      const up = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name) },
        body: file,
      });
      if (!up.ok) throw new Error(((await up.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${up.status}`);
      const { key, mime } = (await up.json()) as { key: string; mime: string };
      const created = await api<{ id: string; z: number }>('POST', '/api/admin/items', {
        folderId,
        type: 'image',
        ...g,
        data: { key, mime, name: file.name, nw: n.w, nh: n.h },
      });
      el.dataset.item = created.id;
      setZ(el, created.z);
      img.src = `/files/${key}`;
      img.addEventListener('load', () => URL.revokeObjectURL(local), { once: true });
      delete el.dataset.uploading;
    } catch (err) {
      el.remove();
      URL.revokeObjectURL(local);
      updateHint();
      toast(`${file.name} yüklenemedi: ${(err as Error).message}`);
    }
  }

  /** Inserts a server-rendered item (from the create API) and selects it. */
  function insert(item: Item): HTMLElement | null {
    const tpl = document.createElement('template');
    tpl.innerHTML = renderItem(item);
    const el = tpl.content.firstElementChild as HTMLElement | null;
    if (!el) return null;
    world.appendChild(el);
    updateHint();
    select(el);
    return el;
  }

  /** Temporary card shown while a slow create (upload, link preview) runs. */
  function placeholder(at: { x: number; y: number }, label: string, w = 260, h = 76) {
    const el = document.createElement('div');
    el.className = 'item';
    el.dataset.uploading = '';
    el.innerHTML = '<div class="file"><div class="file-badge">…</div><div class="file-body"><div class="file-name"></div><div class="file-meta">Yükleniyor…</div></div></div>';
    el.querySelector('.file-name')!.textContent = label;
    place(el, { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h });
    setZ(el, Math.max(0, ...zs()) + 1);
    world.appendChild(el);
    updateHint();
    return el;
  }

  async function upload(file: File): Promise<{ key: string; mime: string; size: number }> {
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) },
      body: file,
    });
    if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
    return (await res.json()) as { key: string; mime: string; size: number };
  }

  async function addFile(file: File, at: { x: number; y: number }) {
    const ph = placeholder(at, file.name);
    try {
      const { key, mime, size } = await upload(file);
      const item = await api<Item>('POST', '/api/admin/items', {
        folderId,
        type: 'file',
        x: at.x,
        y: at.y,
        center: true,
        data: { key, name: file.name, size, mime },
      });
      ph.remove();
      insert(item);
    } catch (err) {
      ph.remove();
      updateHint();
      toast(`${file.name} yüklenemedi: ${(err as Error).message}`);
    }
  }

  function addFiles(files: Iterable<File>, at = center()) {
    const list = [...files];
    list.forEach((f, i) => {
      const p = { x: at.x + i * 24, y: at.y + i * 24 };
      // SVG/AVIF etc. are images too; anything the browser can't size still works (300x300 default).
      if (f.type.startsWith('image/')) addImage(f, p);
      else addFile(f, p);
    });
  }

  // ------------------------------------------------------------------- notes

  async function addNote(text: string, at = center()) {
    try {
      const item = await api<Item>('POST', '/api/admin/items', { folderId, type: 'note', x: at.x, y: at.y, center: true, data: { text } });
      const el = insert(item);
      if (el && !text) editNote(el);
    } catch (err) {
      toast(`Not eklenemedi: ${(err as Error).message}`);
    }
  }

  function editNote(el: HTMLElement) {
    const box = el.querySelector<HTMLElement>('.note-text');
    if (!box || box.isContentEditable) return;
    const before = box.innerText;
    try {
      box.contentEditable = 'plaintext-only';
    } catch {
      box.contentEditable = 'true'; // browsers without plaintext-only
    }
    box.focus();
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);

    const done = () => {
      box.contentEditable = 'false';
      box.removeEventListener('keydown', onKey);
      const text = box.innerText.replace(/\n$/, '');
      box.textContent = text; // drop any markup a 'true' contenteditable may have added
      if (text !== before) api('PATCH', `/api/admin/items/${el.dataset.item}`, { text }).catch((e) => toast(`Kaydedilemedi: ${e.message}`));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        box.blur();
      }
    };
    box.addEventListener('keydown', onKey);
    box.addEventListener('blur', done, { once: true });
  }

  stage.addEventListener('note-edit', (e) => editNote((e as CustomEvent<HTMLElement>).detail));

  // ------------------------------------------------------------ links/embeds

  async function addLink(url: URL, at = center()) {
    const ph = placeholder(at, url.hostname.replace(/^www\./, ''), 320, 112);
    try {
      const item = await api<Item>('POST', '/api/admin/items', { folderId, type: 'link', x: at.x, y: at.y, center: true, data: { url: url.href } });
      ph.remove();
      insert(item);
    } catch (err) {
      ph.remove();
      updateHint();
      toast(`Link eklenemedi: ${(err as Error).message}`);
    }
  }

  function promptLink() {
    const raw = prompt('Link (YouTube, Vimeo, Spotify, X, Loom, Figma embed olur)');
    if (!raw) return;
    const u = parseUrl(raw);
    if (!u) return toast('Geçerli bir link değil');
    addLink(u);
  }

  // ----------------------------------------------------------------- toolbar

  const input = document.getElementById('file-input') as HTMLInputElement;
  document.getElementById('add-upload')!.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files?.length) addFiles(input.files);
    input.value = '';
  });
  document.getElementById('add-note')!.addEventListener('click', () => addNote(''));
  document.getElementById('add-link')!.addEventListener('click', promptLink);

  // ------------------------------------------------------------ drop / paste

  let dragDepth = 0;
  const droppable = (e: DragEvent) => {
    const t = e.dataTransfer?.types ?? [];
    return t.includes('Files') || t.includes('text/uri-list');
  };
  stage.addEventListener('dragenter', (e) => {
    if (!droppable(e)) return;
    dragDepth++;
    stage.dataset.dragover = '';
  });
  stage.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) {
      dragDepth = 0;
      delete stage.dataset.dragover;
    }
  });
  stage.addEventListener('dragover', (e) => {
    if (!droppable(e)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  });
  stage.addEventListener('drop', (e) => {
    if (!droppable(e)) return;
    e.preventDefault();
    dragDepth = 0;
    delete stage.dataset.dragover;
    const r = stage.getBoundingClientRect();
    const at = vp.toWorld(e.clientX - r.left, e.clientY - r.top);
    const dt = e.dataTransfer!;
    if (dt.files.length) return addFiles(dt.files, at);
    const url = parseUrl(dt.getData('text/uri-list').split('\n').find((l) => l && !l.startsWith('#')) ?? '');
    if (url) addLink(url, at);
  });

  // Paste: files (screenshots, copied images), a URL → link/embed, other text → note.
  window.addEventListener('paste', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName))) return;
    const cd = e.clipboardData;
    if (!cd) return;
    const files = [...cd.files];
    if (files.length) {
      e.preventDefault();
      return addFiles(files);
    }
    const text = cd.getData('text/plain').trim();
    if (!text) return;
    e.preventDefault();
    const url = parseUrl(text);
    if (url && /^https?:\/\//i.test(text)) addLink(url);
    else addNote(text.slice(0, 10000));
  });

  // ----------------------------------------------------------------- folders

  document.getElementById('add-folder')!.addEventListener('click', async () => {
    const name = prompt('Klasör adı')?.trim();
    if (!name) return;
    const c = center();
    try {
      await api('POST', '/api/admin/folders', { parentId: folderId, name, x: Math.round(c.x - 100), y: Math.round(c.y - 70) });
      location.reload(); // re-renders the card and the sidebar tree
    } catch (err) {
      toast(`Klasör oluşturulamadı: ${(err as Error).message}`);
    }
  });
}
