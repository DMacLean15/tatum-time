/* Emails the newsletter subscribers about the latest post.
   Dormant until the env vars below are set - see SETUP-NEWSLETTER-EMAILS.txt.

   HOW DAN USES IT:
     1. Publish a post like normal, wait for the deploy to finish.
     2. Visit  https://tatumtime.net/send-newsletter?key=YOUR-SECRET
        → shows a preview of the email + how many subscribers will get it.
     3. Click "Send now" → one email per subscriber (nobody sees anyone
        else's address). That's it.

   Cloudflare Pages env vars this needs (Settings → Environment variables):
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

function page(title, body) {
  return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#0c1410;color:#e8efe9;max-width:640px;margin:40px auto;padding:0 20px;line-height:1.6}
a{color:#16c45b}h1{color:#fff;font-size:1.4rem}.card{background:#0f1d16;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:22px;margin:18px 0}
.btn{display:inline-block;background:#16c45b;color:#062a14;font-weight:700;padding:12px 24px;border-radius:999px;text-decoration:none}
.muted{color:#9bb3a5;font-size:.9rem}</style></head><body><h1>☘️ Tatum Time - Newsletter</h1>${body}</body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function emailHtml(post, postUrl) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#007a33;border-radius:14px 14px 0 0;padding:18px 24px">
    <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:1px">☘️ TATUM TIME</span>
  </div>
  <div style="background:#ffffff;border:1px solid #e2e2de;border-top:0;border-radius:0 0 14px 14px;padding:26px 24px">
    <p style="color:#007a33;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px">New post · ${esc(post.category || 'Post')}</p>
    <h1 style="color:#111;font-size:22px;line-height:1.3;margin:0 0 12px">${post.emoji ? esc(post.emoji) + ' ' : ''}${esc(post.title)}</h1>
    <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 22px">${esc(post.excerpt)}</p>
    <a href="${postUrl}" style="display:inline-block;background:#007a33;color:#ffffff;font-weight:700;font-size:15px;padding:12px 26px;border-radius:999px;text-decoration:none">Read the full post →</a>
    <p style="color:#999;font-size:12px;margin:28px 0 0">You're getting this because you subscribed at <a href="${SITE}" style="color:#007a33">tatumtime.net</a>. Go Celtics. ☘️</p>
  </div>
</div></body></html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.NEWSLETTER_KEY || !env.SUPABASE_SERVICE_KEY || !env.RESEND_API_KEY || !env.NEWSLETTER_FROM) {
    return page('Not set up yet', `<div class="card"><p>The newsletter sender isn't configured yet.</p>
      <p class="muted">Follow <b>SETUP-NEWSLETTER-EMAILS.txt</b> in the repo to add the four environment variables, then this page comes to life.</p></div>`);
  }
  if (url.searchParams.get('key') !== env.NEWSLETTER_KEY) {
    return new Response('Not authorized.', { status: 403 });
  }

  // latest published post from the deployed posts.json
  const assetRes = await env.ASSETS.fetch(new URL('/content/posts.json', request.url));
  if (!assetRes.ok) return page('Error', `<div class="card">Couldn't read posts.json from the deployed site.</div>`);
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
  const slug = slugify(post.title);
  const postUrl = `${SITE}/post/${slug}/`;

  // subscriber list (service key - never exposed to the browser)
  const supa = env.SUPABASE_URL || DEFAULT_SUPABASE;
  const subRes = await fetch(`${supa}/rest/v1/subscribers?select=email&order=created_at.asc`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY }
  });
  if (!subRes.ok) return page('Error', `<div class="card">Couldn't load the subscriber list (HTTP ${subRes.status}). Check SUPABASE_SERVICE_KEY.</div>`);
  const emails = (await subRes.json()).map(r => r.email).filter(Boolean);
  if (!emails.length) return page('No subscribers', `<div class="card">Nobody has subscribed yet - nothing to send.</div>`);

  // preview step - nothing sends until "Send now" is clicked
  if (url.searchParams.get('send') !== '1') {
    const sendUrl = `${url.pathname}?key=${encodeURIComponent(env.NEWSLETTER_KEY)}&send=1`;
    return page('Ready to send', `
      <div class="card"><p><b>Latest post:</b> ${esc(post.emoji || '')} ${esc(post.title)}</p>
      <p class="muted">${esc(post.excerpt)}</p>
      <p><b>${emails.length}</b> subscriber${emails.length === 1 ? '' : 's'} will get this email.</p></div>
      <p><a class="btn" href="${sendUrl}">Send now →</a></p>
      <p class="muted">Each subscriber gets their own individual email - addresses are never shared. Careful: clicking send twice emails everyone twice.</p>`);
  }

  // send - Resend batch endpoint takes up to 100 emails per call
  const html = emailHtml(post, postUrl);
  let sent = 0; const errors = [];
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100).map(to => ({
      from: env.NEWSLETTER_FROM, to: [to],
      subject: `☘️ New on Tatum Time: ${post.title}`, html
    }));
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch)
    });
    if (r.ok) sent += batch.length;
    else errors.push(`batch ${i / 100 + 1}: HTTP ${r.status} ${await r.text()}`);
  }

  return page('Sent', `<div class="card"><p>✅ Sent to <b>${sent}</b> of ${emails.length} subscribers.</p>
    ${errors.length ? `<p class="muted">Problems: ${esc(errors.join(' · '))}</p>` : ''}
    <p class="muted">Post: <a href="${postUrl}">${esc(post.title)}</a></p></div>`);
}
