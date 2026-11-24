import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

/** Public file serving from R2. Keys are random UUIDs, so responses are immutable. */
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key ?? '';
  if (!/^[0-9a-f-]{36}\.[a-z]+$/.test(key)) return new Response('Not found', { status: 404 });

  const etag = request.headers.get('If-None-Match');
  const obj = await env.FILES.get(key, etag ? { onlyIf: { etagDoesNotMatch: etag.replace(/"/g, '') } } : undefined);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('ETag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  // SVG can carry scripts; never let it run as a document on our origin.
  if (key.endsWith('.svg')) headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");

  if (!('body' in obj)) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
};
