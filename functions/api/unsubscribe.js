// Cloudflare Pages Function - newsletter unsubscribe.
// Route: https://tatumtime.net/api/unsubscribe?t=<token>   (link + List-Unsubscribe header in every newsletter)
//   GET  -> shows a "Yes, unsubscribe me" button (so mail link scanners can't unsubscribe anyone)
//   POST -> marks the subscriber unsubscribed (unsubscribed_at = now). Works for the button
//           (token in the form) and for mail apps' one-click RFC 8058 POST (token in the URL).
// The row is kept, not deleted, so the address is never mailed again unless the person
// signs up and confirms again. Needs SUPABASE_SERVICE_KEY. See SETUP-NEWSLETTER-EMAILS.txt.

const DEFAULT_SUPABASE = 'https://oeogaqrqwevjqpwvrxhq.supabase.co';
const TOKEN_RE = /^[A-Za-z0-9-]{20,80}$/;
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(title, body, status = 200) {
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title} - Tatum Time</title>
<style>body{font-family:system-ui,sans-serif;background:#0c1410;color:#e8efe9;max-width:560px;margin:60px auto;padding:0 20px;line-height:1.6;text-align:center}
a{color:#16c45b}h1{color:#fff;font-size:1.6rem;margin:.2em 0}.logo{font-weight:800;letter-spacing:2px;color:#16c45b}
.card{background:#0f1d16;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:28px 22px;margin:22px 0}
.btn{display:inline-block;background:#16c45b;color:#062a14;font-weight:700;font-size:1rem;padding:12px 24px;border:0;border-radius:999px;text-decoration:none;cursor:pointer}
.muted{color:#9bb3a5;font-size:.9rem}</style></head><body><div class="logo">☘️ TATUM TIME</div><div class="card">${body}</div>
<p><a href="/">Back to Tatum Time</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' } });
}
const bad = () => page('Link not valid', `<h1>That link didn't work</h1><p class="muted">It may be incomplete - try copying the whole link from the email.</p>`, 400);

export async function onRequestGet(context) {
  const t = new URL(context.request.url).searchParams.get('t') || '';
  if (!TOKEN_RE.test(t)) return bad();
  return page('Unsubscribe', `<h1>Unsubscribe?</h1><p>You'll stop getting Tatum Time new-post emails.</p>
    <form method="post" action="/api/unsubscribe"><input type="hidden" name="t" value="${esc(t)}">
    <button class="btn" type="submit">Yes, unsubscribe me</button></form>`);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let t = new URL(request.url).searchParams.get('t') || '';
  if (!t) { try { t = String((await request.formData()).get('t') || ''); } catch (e) { t = ''; } }
  if (!TOKEN_RE.test(t)) return bad();
  if (!env.SUPABASE_SERVICE_KEY) return page('Not set up yet', `<h1>Hmm</h1><p>Unsubscribing isn't available right now - please try again later.</p>`, 503);

  const supa = env.SUPABASE_URL || DEFAULT_SUPABASE;
  const r = await fetch(`${supa}/rest/v1/subscribers?token=eq.${encodeURIComponent(t)}&unsubscribed_at=is.null`, {
    method: 'PATCH',
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ unsubscribed_at: new Date().toISOString() })
  });
  if (!r.ok) return page('Something went wrong', `<h1>Something went wrong</h1><p class="muted">Please try again in a minute.</p>`, 502);
  // same answer whether or not the token matched a row (already unsubscribed / unknown)
  return page('Unsubscribed', `<h1>You're unsubscribed</h1><p>You won't get any more Tatum Time emails. Sorry to see you go - the blog is always here. ☘️</p>
    <p class="muted">Changed your mind? Sign up again any time on the homepage.</p>`);
}
