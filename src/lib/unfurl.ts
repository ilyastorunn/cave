import { env } from 'cloudflare:workers';
import type { LinkData } from './types';

/**
 * Server-side link preview: reads <title> and og:/twitter: meta tags with
 * HTMLRewriter, then copies the preview image into R2 so the archive does not
 * depend on the original site staying up. Best effort: any failure falls back
 * to a card with just the URL.
 */

const UA = 'Mozilla/5.0 (compatible; ily-cave/1.0; link preview)';
const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** Rejects non-http(s) URLs and obvious local/private hosts (SSRF guard, mostly for `npm run dev`). */
export function isPublicUrl(u: URL): boolean {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
  }
  if (h.includes(':')) return false; // IPv6 literals: not worth the risk
  return true;
}

const clean = (s: string | undefined, max: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
};

export async function unfurl(url: URL): Promise<LinkData> {
  const data: LinkData = { url: url.href };
  try {
    const res = await fetch(url.href, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok || !(res.headers.get('Content-Type') ?? '').includes('html')) {
      await res.body?.cancel();
      return data;
    }

    const meta: Record<string, string> = {};
    let title = '';
    let inTitle = false;
    await new HTMLRewriter()
      .on('meta', {
        element(el) {
          const k = (el.getAttribute('property') ?? el.getAttribute('name') ?? '').toLowerCase();
          const v = el.getAttribute('content');
          if (k && v && !(k in meta)) meta[k] = v;
        },
      })
      .on('title', {
        element() {
          inTitle = !title;
        },
        text(t) {
          if (inTitle) title += t.text;
          if (t.lastInTextNode) inTitle = false;
        },
      })
      .transform(res)
      .arrayBuffer();

    data.title = clean(meta['og:title'] ?? meta['twitter:title'] ?? title, 300);
    data.description = clean(meta['og:description'] ?? meta['twitter:description'] ?? meta['description'], 500);
    data.siteName = clean(meta['og:site_name'], 100);

    const img = meta['og:image:secure_url'] ?? meta['og:image'] ?? meta['twitter:image'] ?? meta['twitter:image:src'];
    if (img) {
      const imgUrl = new URL(img, res.url || url.href);
      if (isPublicUrl(imgUrl)) data.image = (await copyImage(imgUrl)) ?? undefined;
    }
  } catch {
    // Timeout, DNS, TLS, parse errors: keep the bare URL card.
  }
  return data;
}

async function copyImage(u: URL): Promise<string | null> {
  try {
    const res = await fetch(u.href, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    const type = (res.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    const ext = IMAGE_EXT[type];
    const len = Number(res.headers.get('Content-Length') ?? 0);
    if (!res.ok || !ext || len > MAX_IMAGE) {
      await res.body?.cancel();
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE) return null;
    const key = `${crypto.randomUUID()}.${ext}`;
    await env.FILES.put(key, buf, { httpMetadata: { contentType: type }, customMetadata: { source: u.href.slice(0, 500) } });
    return key;
  } catch {
    return null;
  }
}
