import type { APIRoute } from 'astro';
import { createFolder, folderExists } from '../../../lib/db';
import { bad, body, isNum, json } from '../../../lib/http';

export const prerender = false;

/** Creates a folder and its card at (x, y) on the parent's canvas. */
export const POST: APIRoute = async ({ request }) => {
  const b = await body(request);
  if (!b) return bad('invalid json');
  const { parentId, name, x, y } = b;
  if (typeof parentId !== 'string' || !(await folderExists(parentId))) return bad('unknown parent', 404);
  const clean = typeof name === 'string' ? name.trim().slice(0, 80) : '';
  if (!clean) return bad('name required');
  if (!isNum(x) || !isNum(y)) return bad('invalid position');
  return json(await createFolder(parentId, clean, { x, y }), 201);
};
