import type { APIRoute } from 'astro';
import { createItem, folderExists, type NewItem } from '../../../../lib/db';
import { toEmbed, parseUrl } from '../../../../lib/embeds';
import { bad, body, isNum, json } from '../../../../lib/http';
import { isPublicUrl, unfurl } from '../../../../lib/unfurl';

export const prerender = false;

const KEY = /^[0-9a-f-]{36}\.[a-z0-9]{1,10}$/;
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);

/**
 * Creates a non-folder item and returns it (the editor renders it with the
 * shared renderer). Geometry: x/y is the top-left, or the center when
 * `center: true`; w/h are optional for link and embed (server picks defaults).
 *
 *  image: data { key, mime?, name?, nw?, nh? }   (upload first)
 *  file:  data { key, name, size, mime? }        (upload first)
 *  note:  data { text }
 *  link:  data { url }  → embed if the URL is an allowlisted provider, else an unfurled link card
 */
export const POST: APIRoute = async ({ request }) => {
  const b = await body(request);
  if (!b) return bad('invalid json');
  const { folderId, type, x, y } = b;
  const d = (b.data ?? {}) as Record<string, unknown>;

  if (typeof folderId !== 'string' || !(await folderExists(folderId))) return bad('unknown folder', 404);
  if (!isNum(x) || !isNum(y)) return bad('invalid position');
  const given = isNum(b.w) && isNum(b.h) && b.w > 0 && b.h > 0 ? { w: b.w, h: b.h } : null;

  let item: Omit<NewItem, 'folderId' | 'x' | 'y'>;
  switch (type) {
    case 'image': {
      if (typeof d.key !== 'string' || !KEY.test(d.key)) return bad('invalid file key');
      if (!given) return bad('size required');
      item = { type, ...given, data: { key: d.key, mime: s(d.mime, 100), name: s(d.name, 200), nw: isNum(d.nw) ? d.nw : undefined, nh: isNum(d.nh) ? d.nh : undefined } };
      break;
    }
    case 'file': {
      if (typeof d.key !== 'string' || !KEY.test(d.key)) return bad('invalid file key');
      item = { type, ...(given ?? { w: 260, h: 76 }), data: { key: d.key, name: s(d.name, 200) ?? d.key, size: isNum(d.size) ? d.size : 0, mime: s(d.mime, 100) } };
      break;
    }
    case 'note': {
      item = { type, ...(given ?? { w: 240, h: 160 }), data: { text: s(d.text, 10000) ?? '' } };
      break;
    }
    case 'link':
    case 'embed': {
      const u = parseUrl(typeof d.url === 'string' ? d.url : '');
      if (!u || !isPublicUrl(u)) return bad('invalid url');
      const embed = toEmbed(u.href);
      if (embed) {
        item = { type: 'embed', ...(given ?? { w: embed.w, h: embed.h }), data: { url: u.href } };
      } else {
        const meta = await unfurl(u);
        item = { type: 'link', ...(given ?? (meta.image ? { w: 320, h: 300 } : { w: 320, h: 112 })), data: { ...meta } };
      }
      break;
    }
    default:
      return bad('unsupported type');
  }

  const pos = b.center === true ? { x: Math.round(x - item.w / 2), y: Math.round(y - item.h / 2) } : { x, y };
  return json(await createItem({ folderId, ...pos, ...item }), 201);
};
