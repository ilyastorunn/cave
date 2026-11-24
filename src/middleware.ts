import { defineMiddleware } from 'astro:middleware';
import { isOwner } from './lib/auth';

const isAdminPath = (p: string) => p === '/admin' || p.startsWith('/admin/') || p.startsWith('/api/admin/');

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = ctx.url;
  if (!isAdminPath(pathname)) return next();

  if (!(await isOwner(ctx.request))) {
    return pathname.startsWith('/api/')
      ? Response.json({ error: 'forbidden' }, { status: 403 })
      : new Response('Forbidden', { status: 403 });
  }

  // Write APIs only accept same-origin requests (Access auth is cookie-based).
  if (pathname.startsWith('/api/') && ctx.request.method !== 'GET') {
    const origin = ctx.request.headers.get('Origin');
    if (origin !== ctx.url.origin) {
      return Response.json({ error: 'bad origin' }, { status: 403 });
    }
  }

  const res = await next();
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
});
