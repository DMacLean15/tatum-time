/* Emails the newsletter subscribers about the latest post.
   Dormant until the env vars below are set - see SETUP-NEWSLETTER-EMAILS.txt.

   HOW DAN USES IT:
     1. Publish a post like normal, wait for the deploy to finish.
     2. Visit  https://tatumtime.net/send-newsletter?key=YOUR-SECRET
        -> shows a preview of the email + how many subscribers will get it.
        (Opening or refreshing this page never sends anything.)
     3. Click "Send now" -> one email per CONFIRMED subscriber (nobody sees
        anyone else's address). Each post can only ever be sent once - it's
        recorded in the newsletter_sends table before anything goes out.

   Cloudflare Pages env vars this needs (Settings -> Environment variables):
     NEWSLETTER_KEY        - a long random secret; the ?key= in the URL
     SUPABASE_SERVICE_KEY  - Supabase "service_role" key (reads the subscriber list)
     RESEND_API_KEY        - API key from resend.com (free tier is plenty)
     NEWSLETTER_FROM       - e.g.  Tatum Time <posts@tatumtime.net>
   Optional:
     SUPABASE_URL          - defaults to the project used by the site           */

const DEFAULT_SUPABASE = 'https://oeogaqrqwevjqpwvrxhq.supabase.co';
const SITE = 'https://tatumtime.net';

const slugify = s => (String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'post');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(title, body, status = 200) {
  return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#0c1410;color:#e8efe9;max-width:640px;margin:40px auto;padding:0 20px;line-height:1.6}
a{color:#16c45b}h1{color:#fff;font-size:1.4rem}.card{background:#0f1d16;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:22px;margin:18px 0}
.btn{display:inline-block;background:#16c45b;color:#062a14;font-weight:700;font-size:1rem;padding:12px 24px;border:0;border-radius:999px;text-decoration:none;cursor:pointer}
.muted{color:#9bb3a5;font-size:.9rem}</style></head><body><h1>☘️ Tatum Time - Newsletter</h1>${body}</body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex' } });
}

// constant-time key check (hash both sides so length doesn't leak either)
async function sameKey(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s || '')))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0 && !!a;
}

function emailHtml(post, postUrl, unsubUrl) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#007a33;border-radius:14px 14px 0 0;padding:18px 24px">
    <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:1px">☘️ TATUM TIME</span>
  </div>
  <div style="background:#ffffff;border:1px solid #e2e2de;border-top:0;border-radius:0 0 14px 14px;padding:26px 24px">
    <p style="color:#007a33;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px">New post · ${esc(post.category || 'Post')}</p>
    <h1 style="color:#111;font-size:22px;line-height:1.3;margin:0 0 12px">${post.emoji ? esc(post.emoji) + ' ' : ''}${esc(post.title)}</h1>
    <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 22px">${esc(post.excerpt)}</p>
    <a href="${esc(postUrl)}" style="display:inline-block;background:#007a33;color:#ffffff;font-weight:700;font-size:15px;padding:12px 26px;border-radius:999px;text-decoration:none">Read the full post →</a>
    <p style="color:#999;font-size:12px;margin:28px 0 0">You're getting this because you subscribed at <a href="${SITE}" style="color:#007a33">tatumtime.net</a>. Go Celtics. ☘️<br>
    <a href="${esc(unsubUrl)}" style="color:#999">Unsubscribe</a></p>
  </div>
</div></body></html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });

  if (!env.NEWSLETTER_KEY || !env.SUPABASE_SERVICE_KEY || !env.RESEND_API_KEY || !env.NEWSLETTER_FROM) {
    return page('Not set up yet', `<div class="card"><p>The newsletter sender isn't configured yet.</p>
      <p class="muted">Follow <b>SETUP-NEWSLETTER-EMAILS.txt</b> in the repo to add the four environment variables, then this page comes to life.</p></div>`, 503);
  }

  // GET carries the key in the bookmark (?key=); POST carries it as a hidden form field
  const isPost = request.method === 'POST';
  let form = null;
  if (isPost) { try { form = await request.formData(); } catch (e) { form = new FormData(); } }
  const key = isPost ? form.get('key') : url.searchParams.get('key');
  if (!(await sameKey(key, env.NEWSLETTER_KEY))) return new Response('Not authorized.', { status: 403, headers: { 'cache-control': 'no-store' } });

  // latest published post from the deployed posts.json
  const assetRes = await env.ASSETS.fetch(new URL('/content/posts.json', request.url));
  if (!assetRes.ok) return page('Error', `<div class="card">Couldn't read posts.json from the deployed site.</div>`, 500);
  const allPosts = ((await assetRes.json()).posts) || [];
  const todayISO = new Date().toISOString().slice(0, 10);
  const posts = allPosts.filter(p => {
    const pd = String(p.date || '').slice(0, 10);
    return !/^\d{4}-\d{2}-\d{2}$/.test(pd) || pd <= todayISO;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
  const post = posts[0];
  if (!post) return page('No posts', `<div class="card">There are no published posts to send.</div>`);

  const text = String(post.body || '').replace(/==([^=]+)==/g, '$1').replace(/<[^>]+>/g, ' ').replace(/[#*`>\[\]()!]/g, '').replace(/\s+/g, ' ').trim();
  post.excerpt = text.length > 220 ? text.slice(0, 220).trim() + '…' : text;
  const slug = post.slug ? String(post.slug) : slugify(post.title);
  const postUrl = `${SITE}/post/${encodeURIComponent(slug)}/`;

  // Supabase (service key - never exposed to the browser)
  const supa = env.SUPABASE_URL || DEFAULT_SUPABASE;
  const sbHeaders = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY };
  const sb = (path, init = {}) => fetch(`${supa}/rest/v1/${path}`, Object.assign({}, init, { headers: Object.assign({}, sbHeaders, init.headers || {}) }));

  // already sent? (needs the newsletter_sends table from the UPGRADE SQL)
  const sentRes = await sb(`newsletter_sends?select=post_slug,sent_at,recipients&post_slug=eq.${encodeURIComponent(slug)}`);
  if (!sentRes.ok) return page('Error', `<div class="card"><p>Couldn't check the send log (HTTP ${sentRes.status}).</p>
    <p class="muted">Run the "UPGRADE - run once" SQL in SETUP-NEWSLETTER-EMAILS.txt, then reload.</p></div>`, 500);
  const already = (await sentRes.json())[0];
  const alreadyPage = (row) => page('Already sent', `<div class="card"><p>✅ <b>${esc(post.title)}</b> was already sent on
    <b>${esc(new Date(row.sent_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }))}</b> (Eastern)${row.recipients != null ? ` to ${esc(row.recipients)} subscriber${row.recipients == 1 ? '' : 's'}` : ''}.</p>
    <p class="muted">Each post is only sent once. Publish a new post and come back to send that one.</p></div>`);
  if (already) return alreadyPage(already);

  // confirmed, still-subscribed list (pages of 1000 - Supabase's default row cap)
  const subs = [];
  for (let from = 0; ; from += 1000) {
    const r = await sb(`subscribers?select=email,token&confirmed=eq.true&unsubscribed_at=is.null&token=not.is.null&order=id.asc`, { headers: { Range: `${from}-${from + 999}` } });
    if (!r.ok) return page('Error', `<div class="card">Couldn't load the subscriber list (HTTP ${r.status}). Check SUPABASE_SERVICE_KEY and that the UPGRADE SQL has been run.</div>`, 500);
    const rows = await r.json();
    subs.push(...rows);
    if (rows.length < 1000) break;
  }
  const seen = new Set();
  const list = subs.filter(s => s.email && !seen.has(s.email.toLowerCase()) && seen.add(s.email.toLowerCase()));
  if (!list.length) return page('No subscribers', `<div class="card">Nobody has confirmed a subscription yet - nothing to send.</div>`);

  // preview step - GET never sends; the button POSTs the key + slug in the body
  if (!isPost) {
    return page('Ready to send', `
      <div class="card"><p><b>Latest post:</b> ${esc(post.emoji || '')} ${esc(post.title)}</p>
      <p class="muted">${esc(post.excerpt)}</p>
      <p><b>${list.length}</b> confirmed subscriber${list.length === 1 ? '' : 's'} will get this email.</p></div>
      <form method="post" action="${esc(url.pathname)}" onsubmit="this.querySelector('button').disabled=true">
        <input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="slug" value="${esc(slug)}">
        <button class="btn" type="submit">Send now →</button></form>
      <p class="muted">Each subscriber gets their own individual email with their own unsubscribe link - addresses are never shared. Each post can only be sent once, so refreshing is safe.</p>`);
  }

  // the post Dan previewed must still be the latest one
  if (form.get('slug') !== slug) return page('Post changed', `<div class="card"><p>A newer post went live since you opened the preview.</p>
    <p class="muted">Nothing was sent. <a href="${esc(url.pathname)}?key=${esc(encodeURIComponent(key))}">Reload the preview</a> and check it before sending.</p></div>`, 409);

  // record the send FIRST - the primary key on post_slug makes a second send impossible
  const rec = await sb('newsletter_sends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ post_slug: slug, recipients: list.length })
  });
  if (rec.status === 409) {
    const again = (await (await sb(`newsletter_sends?select=post_slug,sent_at,recipients&post_slug=eq.${encodeURIComponent(slug)}`)).json())[0];
    return alreadyPage(again || { sent_at: new Date().toISOString(), recipients: null });
  }
  if (!rec.ok) return page('Error', `<div class="card">Couldn't record the send (HTTP ${rec.status}) - nothing was sent.</div>`, 500);

  // send - Resend batch endpoint takes up to 100 emails per call
  const subject = `☘️ New on Tatum Time: ${post.title}`;
  let sent = 0; const errors = [];
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100).map(s => {
      const unsubUrl = `${SITE}/api/unsubscribe?t=${encodeURIComponent(s.token)}`;
      return {
        from: env.NEWSLETTER_FROM, to: [s.email], subject,
        html: emailHtml(post, postUrl, unsubUrl),
        text: `New on Tatum Time: ${post.title}\n\n${post.excerpt}\n\nRead it: ${postUrl}\n\nUnsubscribe: ${unsubUrl}`,
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
      };
    });
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch)
    });
    if (r.ok) sent += batch.length;
    else errors.push(`batch ${i / 100 + 1}: HTTP ${r.status} ${await r.text()}`);
  }

  // nothing went out at all -> free the slug so Dan can retry; otherwise store the real count
  if (!sent) await sb(`newsletter_sends?post_slug=eq.${encodeURIComponent(slug)}`, { method: 'DELETE' });
  else if (sent !== list.length) await sb(`newsletter_sends?post_slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ recipients: sent })
  });

  return page(sent ? 'Sent' : 'Send failed', `<div class="card"><p>${sent ? '✅' : '⚠️'} Sent to <b>${sent}</b> of ${list.length} subscribers.</p>
    ${errors.length ? `<p class="muted">Problems: ${esc(errors.join(' · '))}</p>` : ''}
    ${sent ? '' : '<p class="muted">Nothing went out, so this post was NOT marked as sent - you can try again.</p>'}
    <p class="muted">Post: <a href="${esc(postUrl)}">${esc(post.title)}</a></p></div>`, sent ? 200 : 502);
}
