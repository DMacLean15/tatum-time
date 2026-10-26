// Cloudflare Pages Function - starts the GitHub login for the CMS.
// Route: https://tatumtime.net/auth
// Needs env vars (set in Cloudflare Pages -> Settings -> Environment variables):
//   GITHUB_CLIENT_ID     - from your GitHub OAuth App
//   GITHUB_CLIENT_SECRET - from your GitHub OAuth App (used in callback.js)
// Security: the scope is fixed to "repo" (a ?scope= from the link is ignored), and a
// random state is kept in a short-lived HttpOnly cookie that callback.js must match.

const STATE_COOKIE = 'tt_oauth_state';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) return new Response('Missing GITHUB_CLIENT_ID env var', { status: 500, headers: { 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' } });

  const redirectUri = url.origin + '/callback';
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

  const authorize = 'https://github.com/login/oauth/authorize'
    + '?client_id=' + encodeURIComponent(clientId)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&scope=repo'
    + '&state=' + state;

  return new Response(null, {
    status: 302,
    headers: {
      'Location': authorize,
      'Set-Cookie': `${STATE_COOKIE}=${state}; Max-Age=600; Path=/callback; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer'
    }
  });
}
