// Embeddable providers. The iframe src is always derived from the stored URL
// through this allowlist, never stored or taken from user input directly.

export interface Embed {
  provider: string;
  src: string;
  w: number; // default on-canvas size
  h: number;
}

const id = (s: string | null | undefined, re = /^[\w-]{1,64}$/) => (s && re.test(s) ? s : null);

export function toEmbed(raw: string): Embed | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    const v =
      host === 'youtu.be'
        ? id(parts[0])
        : parts[0] === 'watch'
          ? id(u.searchParams.get('v'))
          : ['shorts', 'embed', 'live'].includes(parts[0])
            ? id(parts[1])
            : null;
    if (!v) return null;
    const short = parts[0] === 'shorts';
    return { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${v}`, w: short ? 315 : 560, h: short ? 560 : 315 };
  }

  if (host === 'vimeo.com') {
    const v = id(parts.find((p) => /^\d+$/.test(p)), /^\d{1,15}$/);
    return v ? { provider: 'vimeo', src: `https://player.vimeo.com/video/${v}`, w: 560, h: 315 } : null;
  }

  if (host === 'open.spotify.com') {
    const i = parts.findIndex((p) => ['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(p));
    const kind = parts[i];
    const v = id(parts[i + 1], /^[A-Za-z0-9]{10,40}$/);
    if (i < 0 || !v) return null;
    const small = kind === 'track' || kind === 'episode';
    return { provider: 'spotify', src: `https://open.spotify.com/embed/${kind}/${v}`, w: 400, h: small ? 152 : 380 };
  }

  if (host === 'twitter.com' || host === 'x.com') {
    const i = parts.indexOf('status');
    const v = id(parts[i + 1], /^\d{1,25}$/);
    if (i < 0 || !v) return null;
    return { provider: 'x', src: `https://platform.twitter.com/embed/Tweet.html?id=${v}&dnt=true`, w: 400, h: 560 };
  }

  if (host === 'loom.com') {
    const v = parts[0] === 'share' || parts[0] === 'embed' ? id(parts[1]) : null;
    return v ? { provider: 'loom', src: `https://www.loom.com/embed/${v}`, w: 560, h: 315 } : null;
  }

  if (host === 'figma.com' && ['file', 'design', 'proto', 'board'].includes(parts[0])) {
    return {
      provider: 'figma',
      src: `https://www.figma.com/embed?embed_host=ily-cave&url=${encodeURIComponent(u.href)}`,
      w: 640,
      h: 420,
    };
  }

  return null;
}

/** Normalizes user input into an http(s) URL, or null. Accepts "example.com/x". */
export function parseUrl(input: string): URL | null {
  const s = input.trim();
  if (!s || /\s/.test(s)) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.')) return null;
    return u;
  } catch {
    return null;
  }
}
