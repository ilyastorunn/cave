import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const SAFE_INLINE = /^(image\/(png|jpeg|gif|webp|avif|svg\+xml)|application\/pdf)$/;

/**
 * Public file serving from R2. Keys are random UUIDs, so responses are immutable.
 * Only images and PDFs display inline; everything else downloads. Non-raster
 * types get a sandboxing CSP so nothing uploaded can run script on this origin.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key ?? '';
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{1,10}$/.test(key)) return new Response('Not found', { status: 404 });

  const etag = request.headers.get('If-None-Match');
  const obj = await env.FILES.get(key, etag ? { onlyIf: { etagDoesNotMatch: etag.replace(/"/g, '') } } : undefined);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  const type = (obj.httpMetadata?.contentType ?? 'application/octet-stream').toLowerCase();
  const name = obj.customMetadata?.name ?? key;

  headers.set('ETag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set(
    'Content-Disposition',
    `${SAFE_INLINE.test(type) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
  );
  // PDFs are exempt: Chrome's viewer refuses to render under a sandbox CSP. Only the owner uploads files.
  if (!/^(image\/(png|jpeg|gif|webp|avif)|application\/pdf)$/.test(type)) {
    headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
  }

  if (!('body' in obj)) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
};
