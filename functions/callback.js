// Cloudflare Pages Function - finishes the GitHub login for the CMS.
// Route: https://tatumtime.net/callback  (this must be the OAuth App's callback URL)
// It checks the state cookie set by auth.js, swaps GitHub's code for an access token,
// then hands it back to the CMS window - but ONLY if that window is on this site's
// own origin (https://tatumtime.net, or the same preview host it was served from).

const STATE_COOKIE = 'tt_oauth_state';
const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  // clear the one-time state cookie whatever happens
  'Set-Cookie': `${STATE_COOKIE}=; Max-Age=0; Path=/callback; HttpOnly; Secure; SameSite=Lax`
};

function readCookie(request, name) {
  const all = request.headers.get('Cookie') || '';
  for (const part of all.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

function sameString(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;
  // windows allowed to receive the token: this host and its www / bare twin (the site
  // answers on both, and Dan may have /admin bookmarked on either)
  const host = url.hostname.replace(/^www\./, '');
  const allowed = [origin].concat(host === 'tatumtime.net' ? ['https://tatumtime.net', 'https://www.tatumtime.net'] : [])
    .filter((v, i, a) => a.indexOf(v) === i);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = readCookie(request, STATE_COOKIE);

  let result;
  if (!code) {
    result = { status: 'error', content: { error: 'Missing code' } };
  } else if (!state || !cookieState || !/^[0-9a-f]{64}$/.test(cookieState) || !sameString(state, cookieState)) {
    result = { status: 'error', content: { error: 'Login expired or did not start here - close this window and try again.' } };
  } else {
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
          code: code,
          redirect_uri: origin + '/callback'
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
  }

  // Decap/Netlify CMS postMessage handshake: say "authorizing:github" to the opener,
  // wait for it to answer, and reply with the result - only to our own origin.
  const message = 'authorization:github:' + result.status + ':' + JSON.stringify(result.content);
  const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16));
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"></head><body>'
    + '<script>(function(){'
    + 'var A=' + js(allowed) + ',M=' + js(message) + ';'
    + 'if(!window.opener)return;'
    + 'function receive(e){'
    + 'if(A.indexOf(e.origin)<0||e.source!==window.opener)return;'
    + 'window.removeEventListener("message",receive,false);'
    + 'window.opener.postMessage(M,e.origin);'
    + '}'
    + 'window.addEventListener("message",receive,false);'
    // the opener's origin isn't known yet: knock on each allowed one (others are dropped by the browser)
    + 'A.forEach(function(o){try{window.opener.postMessage("authorizing:github",o);}catch(x){}});'
    + '})();</script>'
    + '<p style="font-family:sans-serif">' + (result.status === 'success' ? 'Completing sign-in... you can close this window.' : 'Sign-in failed - close this window and try again.') + '</p>'
    + '</body></html>';

  return new Response(html, { status: result.status === 'success' ? 200 : 400, headers: HEADERS });
}
