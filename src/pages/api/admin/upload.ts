import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { bad, json } from '../../../lib/http';

export const prerender = false;

const MAX_BYTES = 50 * 1024 * 1024;
const IMAGE_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

/**
 * Raw-body upload: Content-Type is the file's type, X-Filename its URI-encoded
 * name. Images keep their type; any other file is accepted too and is later
 * served as a sandboxed download (see /files/[...key]).
 */
export const POST: APIRoute = async ({ request }) => {
  const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase() || 'application/octet-stream';
  const name = decodeURIComponent(request.headers.get('X-Filename') ?? '').slice(0, 200);

  const nameExt = (name.split('.').pop() ?? '').toLowerCase();
  const ext = IMAGE_EXT[type] ?? (/^[a-z0-9]{1,10}$/.test(nameExt) && name.includes('.') ? nameExt : 'bin');
  if (type.startsWith('image/') && !IMAGE_EXT[type]) return bad(`unsupported image type: ${type}`, 415);

  const size = Number(request.headers.get('Content-Length') ?? 0);
  if (size > MAX_BYTES) return bad('file too large', 413);
  if (!request.body) return bad('empty body');

  const key = `${crypto.randomUUID()}.${ext}`;
  const obj = await env.FILES.put(key, request.body, {
    httpMetadata: { contentType: type },
    customMetadata: name ? { name } : undefined,
  });
  if (obj.size > MAX_BYTES) {
    await env.FILES.delete(key);
    return bad('file too large', 413);
  }
  return json({ key, size: obj.size, mime: type }, 201);
};
