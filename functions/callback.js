// Cloudflare Pages Function — finishes the GitHub login for the CMS.
// Route: https://tatumtime.net/callback  (this must be the OAuth App's callback URL)
// It swaps GitHub's code for an access token, then hands it back to the CMS window.

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response('Missing code', { status: 400 });

  let result;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'tatum-time-cms'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code
      })
    });
    const data = await tokenRes.json();
    if (data.access_token) {
      result = { status: 'success', content: { token: data.access_token, provider: 'github' } };
    } else {
      result = { status: 'error', content: { error: data.error_description || data.error || 'No token returned' } };
    }
  } catch (e) {
    result = { status: 'error', content: { error: 'Token exchange failed' } };
  }

  // Hand the result back to the CMS window using the Netlify/Decap postMessage handshake.
  const payload = JSON.stringify(result.content).replace(/</g, '\\u003c');
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>'
    + '<script>(function(){'
    + 'function receive(e){'
    + 'window.opener.postMessage("authorization:github:' + result.status + ':" + ' + JSON.stringify(payload) + ', e.origin);'
    + 'window.removeEventListener("message", receive, false);'
    + '}'
    + 'window.addEventListener("message", receive, false);'
    + 'window.opener.postMessage("authorizing:github", "*");'
    + '})();</script>'
    + '<p style="font-family:sans-serif">Completing sign-in… you can close this window.</p>'
    + '</body></html>';

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
