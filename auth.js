// Cloudflare Pages Function — starts the GitHub login for the CMS.
// Route: https://tatumtime.net/auth
// Needs env vars (set in Cloudflare Pages → Settings → Environment variables):
//   GITHUB_CLIENT_ID     — from your GitHub OAuth App
//   GITHUB_CLIENT_SECRET — from your GitHub OAuth App (used in callback.js)

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) return new Response('Missing GITHUB_CLIENT_ID env var', { status: 500 });

  const redirectUri = url.origin + '/callback';
  const scope = url.searchParams.get('scope') || 'repo';
  const state = crypto.randomUUID();

  const authorize = 'https://github.com/login/oauth/authorize'
    + '?client_id=' + encodeURIComponent(clientId)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&scope=' + encodeURIComponent(scope)
    + '&state=' + encodeURIComponent(state);

  return Response.redirect(authorize, 302);
}
