import type { APIRoute } from 'astro';
import { createItem, folderExists } from '../../../../lib/db';
import { bad, body, isNum, json } from '../../../../lib/http';

export const prerender = false;

/** Creates a non-folder item. Phase 3 supports images (uploaded first via /api/admin/upload). */
export const POST: APIRoute = async ({ request }) => {
  const b = await body(request);
  if (!b) return bad('invalid json');
  const { folderId, type, x, y, w, h, data } = b;

  if (typeof folderId !== 'string' || !(await folderExists(folderId))) return bad('unknown folder', 404);
  if (type !== 'image') return bad('unsupported type');
  if (![x, y, w, h].every(isNum) || (w as number) <= 0 || (h as number) <= 0) return bad('invalid geometry');
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.key !== 'string' || !/^[0-9a-f-]{36}\.[a-z]+$/.test(d.key)) return bad('invalid file key');

  const clean = {
    key: d.key,
    mime: typeof d.mime === 'string' ? d.mime : undefined,
    name: typeof d.name === 'string' ? d.name.slice(0, 200) : undefined,
    nw: isNum(d.nw) ? d.nw : undefined,
    nh: isNum(d.nh) ? d.nh : undefined,
  };
  const res = await createItem({ folderId, type, x: x as number, y: y as number, w: w as number, h: h as number, data: clean });
  return json(res, 201);
};
