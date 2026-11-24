import { env } from 'cloudflare:workers';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Owner check for /admin and /api/admin.
 *
 * Production: Cloudflare Access sits in front of those paths and adds a signed
 * JWT in `Cf-Access-Jwt-Assertion`. We verify it against the team's JWKS and the
 * application AUD, so a misconfigured Access app or a request that bypasses
 * Access (e.g. *.workers.dev) is still refused. Missing config = refuse.
 *
 * Dev (`npm run dev`): always allowed, so the editor works locally.
 */

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksTeam = '';

export async function isOwner(request: Request): Promise<boolean> {
  if (import.meta.env.DEV) return true;

  const team = env.ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.ACCESS_AUD?.trim();
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!team || !aud || !token) return false;

  if (!jwks || jwksTeam !== team) {
    jwks = createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`));
    jwksTeam = team;
  }

  try {
    await jwtVerify(token, jwks, { issuer: `https://${team}`, audience: aud });
    return true;
  } catch {
    return false;
  }
}
