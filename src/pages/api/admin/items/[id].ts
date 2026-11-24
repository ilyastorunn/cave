import type { APIRoute } from 'astro';
import { deleteItem, updateGeometry, type Geometry } from '../../../../lib/db';
import { bad, body, isNum, json } from '../../../../lib/http';

export const prerender = false;

/** Updates position / size / stacking. */
export const PATCH: APIRoute = async ({ params, request }) => {
  const b = await body(request);
  if (!b) return bad('invalid json');
  const g: Geometry = {};
  for (const k of ['x', 'y', 'w', 'h', 'z'] as const) {
    if (b[k] === undefined) continue;
    if (!isNum(b[k])) return bad(`invalid ${k}`);
    g[k] = k === 'z' ? Math.round(b[k]) : b[k];
  }
  if ((g.w !== undefined && g.w <= 0) || (g.h !== undefined && g.h <= 0)) return bad('invalid size');
  return (await updateGeometry(params.id!, g)) ? json({ ok: true }) : bad('not found', 404);
};

/** Deletes an item; a folder card deletes its folder subtree. */
export const DELETE: APIRoute = async ({ params }) => {
  return (await deleteItem(params.id!)) ? json({ ok: true }) : bad('not found', 404);
};
