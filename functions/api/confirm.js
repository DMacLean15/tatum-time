// Cloudflare Pages Function - confirms a newsletter signup (double opt-in, step 2).
// Route: GET https://tatumtime.net/api/confirm?t=<token>   (the link in the confirmation email)
// Marks the subscriber confirmed (service key, server-side) and shows a friendly page.
// Needs env var SUPABASE_SERVICE_KEY (optional SUPABASE_URL). See SETUP-NEWSLETTER-EMAILS.txt.

const DEFAULT_SUPABASE = 'https://oeogaqrqwevjqpwvrxhq.supabase.co';
const TOKEN_RE = /^[A-Za-z0-9-]{20,80}$/;

function page(title, body, status = 200) {
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title} - Tatum Time</title>
<style>body{font-family:system-ui,sans-serif;background:#0c1410;color:#e8efe9;max-width:560px;margin:60px auto;padding:0 20px;line-height:1.6;text-align:center}
a{color:#16c45b}h1{color:#fff;font-size:1.6rem;margin:.2em 0}.logo{font-weight:800;letter-spacing:2px;color:#16c45b}
.card{background:#0f1d16;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:28px 22px;margin:22px 0}
.btn{display:inline-block;background:#16c45b;color:#062a14;font-weight:700;padding:12px 24px;border-radius:999px;text-decoration:none}
.muted{color:#9bb3a5;font-size:.9rem}</style></head><body><div class="logo">☘️ TATUM TIME</div><div class="card">${body}</div>
<p><a class="btn" href="/">Back to Tatum Time →</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' } });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const t = new URL(request.url).searchParams.get('t') || '';
  if (!env.SUPABASE_SERVICE_KEY) return page('Not set up yet', `<h1>Almost there</h1><p>The newsletter isn't fully set up yet - please try this link again later.</p>`, 503);
  if (!TOKEN_RE.test(t)) return page('Link not valid', `<h1>That link didn't work</h1><p class="muted">It may be incomplete - try copying the whole link from the email, or sign up again on the homepage.</p>`, 400);

  const supa = env.SUPABASE_URL || DEFAULT_SUPABASE;
  const r = await fetch(`${supa}/rest/v1/subscribers?token=eq.${encodeURIComponent(t)}&unsubscribed_at=is.null&select=id`, {
    method: 'PATCH',
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ confirmed: true })
  });
  if (!r.ok) return page('Something went wrong', `<h1>Something went wrong</h1><p class="muted">Please try the link again in a minute.</p>`, 502);
  if (!(await r.json()).length) return page('Link not valid', `<h1>That link has expired</h1><p class="muted">It may be from an old email, or you unsubscribed since. Sign up again on the homepage and we'll send a fresh one.</p>`, 404);

  return page('You\'re in', `<h1>You're in! 🎉</h1><p>Your subscription is confirmed. You'll get an email every time a new Tatum Time post goes up.</p>
    <p class="muted">Every email has an unsubscribe link at the bottom. Go Celtics. ☘️</p>`);
}
