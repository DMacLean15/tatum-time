// Cloudflare Pages Function - newsletter signup with double opt-in.
// Route: POST https://tatumtime.net/api/subscribe   body: {"email":"fan@example.com"}
// Saves the email as UNCONFIRMED (service key, server-side only) and emails a
// confirmation link to /api/confirm?t=<token>. Only confirmed rows get the newsletter.
// Replies (JSON):
//   200 {ok:true, status:'check-email'}  - confirmation mail sent (or one went out < 10 min ago)
//   200 {ok:true, status:'already'}      - this email is already confirmed
//   400 {ok:false, error}                - bad JSON / invalid email
//   403 {ok:false, error}                - posted from another website
//   503 {ok:false, error}                - newsletter env vars not set up yet
//   502 {ok:false, error}                - Supabase or Resend failed
// Needs env vars: SUPABASE_SERVICE_KEY, RESEND_API_KEY, NEWSLETTER_FROM (optional SUPABASE_URL).
// See SETUP-NEWSLETTER-EMAILS.txt.

const DEFAULT_SUPABASE = 'https://oeogaqrqwevjqpwvrxhq.supabase.co';
const RESEND_EVERY_MS = 10 * 60 * 1000;   // at most one confirmation mail per address per 10 min

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EMAIL_RE = /^[^\s@"<>(),;:\\[\]]+@[^\s@"<>(),;:\\[\]]+\.[a-z]{2,}$/i;

function confirmHtml(link) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#007a33;border-radius:14px 14px 0 0;padding:18px 24px">
    <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:1px">☘️ TATUM TIME</span>
  </div>
  <div style="background:#ffffff;border:1px solid #e2e2de;border-top:0;border-radius:0 0 14px 14px;padding:26px 24px">
    <h1 style="color:#111;font-size:22px;line-height:1.3;margin:0 0 12px">One click and you're in</h1>
    <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 22px">Confirm your email to get an alert every time a new Tatum Time post goes up.</p>
    <a href="${esc(link)}" style="display:inline-block;background:#007a33;color:#ffffff;font-weight:700;font-size:15px;padding:12px 26px;border-radius:999px;text-decoration:none">Confirm my subscription →</a>
    <p style="color:#999;font-size:12px;margin:28px 0 0">Didn't sign up? Just ignore this email - you won't hear from us again.</p>
  </div>
</div></body></html>`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // only our own pages may trigger confirmation mails
  const from = request.headers.get('Origin');
  if (from && from !== url.origin) return json({ ok: false, error: 'Not allowed.' }, 403);

  if (!env.SUPABASE_SERVICE_KEY || !env.RESEND_API_KEY || !env.NEWSLETTER_FROM) {
    return json({ ok: false, error: 'The newsletter isn\'t set up yet - please try again later.' }, 503);
  }

  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'Bad request.' }, 400); }
  const email = (b && typeof b.email === 'string') ? b.email.trim().toLowerCase() : '';
  if (email.length < 6 || email.length > 200 || !EMAIL_RE.test(email)) return json({ ok: false, error: 'Please enter a valid email address.' }, 400);

  const supa = env.SUPABASE_URL || DEFAULT_SUPABASE;
  const sb = (path, init = {}) => fetch(`${supa}/rest/v1/${path}`, Object.assign({}, init, {
    headers: Object.assign({ apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' }, init.headers || {})
  }));
  const fail = () => json({ ok: false, error: 'Hmm, that didn\'t go through - please try again.' }, 502);

  const look = await sb(`subscribers?select=id,confirmed,token,confirm_sent_at,unsubscribed_at&email=eq.${encodeURIComponent(email)}&limit=1`);
  if (!look.ok) return fail();
  const row = (await look.json())[0];

  if (row && row.confirmed && !row.unsubscribed_at) return json({ ok: true, status: 'already' });
  if (row && row.confirm_sent_at && Date.now() - new Date(row.confirm_sent_at).getTime() < RESEND_EVERY_MS) return json({ ok: true, status: 'check-email' });

  const now = new Date().toISOString();
  const token = (row && row.token) || crypto.randomUUID();
  let save;
  if (row) {
    // returning (unconfirmed or previously unsubscribed) - must confirm again
    save = await sb(`subscribers?id=eq.${row.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ token, confirmed: false, unsubscribed_at: null, confirm_sent_at: now }) });
  } else {
    save = await sb('subscribers', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ email, token, confirmed: false, confirm_sent_at: now }) });
    if (save.status === 409) return json({ ok: true, status: 'check-email' });   // a parallel request just added it
  }
  if (!save.ok) return fail();

  const link = `${url.origin}/api/confirm?t=${encodeURIComponent(token)}`;
  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.NEWSLETTER_FROM, to: [email],
      subject: '☘️ Confirm your Tatum Time subscription',
      html: confirmHtml(link),
      text: `Confirm your email to get an alert every time a new Tatum Time post goes up:\n\n${link}\n\nDidn't sign up? Just ignore this email.`
    })
  });
  if (!mail.ok) {
    // let them retry right away instead of waiting out the 10 minutes
    await sb(`subscribers?email=eq.${encodeURIComponent(email)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ confirm_sent_at: null }) });
    return json({ ok: false, error: 'Couldn\'t send the confirmation email - please try again in a minute.' }, 502);
  }
  return json({ ok: true, status: 'check-email' });
}
