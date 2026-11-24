import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { bad, json } from '../../../lib/http';

export const prerender = false;

const MAX_BYTES = 50 * 1024 * 1024;
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

/** Raw-body upload: Content-Type is the file's type, X-Filename its (URI-encoded) name. */
export const POST: APIRoute = async ({ request }) => {
  const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) return bad(`unsupported type: ${type || 'none'}`, 415);

  const size = Number(request.headers.get('Content-Length') ?? 0);
  if (size > MAX_BYTES) return bad('file too large', 413);
  if (!request.body) return bad('empty body');

  const name = decodeURIComponent(request.headers.get('X-Filename') ?? '').slice(0, 200);
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
