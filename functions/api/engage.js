// Cloudflare Pages Function - records how long a page was read and how far it was scrolled.
// Route: POST https://tatumtime.net/api/engage   (sent by js/visits.js with navigator.sendBeacon)
// One row per page view in Supabase (site_engagement). No ids beyond the random session.

const SB = 'https://oeogaqrqwevjqpwvrxhq.supabase.co';
const KEY = 'sb_publishable_qHH5R2FwTF-zKs5zoVXZzA_f98jkW75';

export async function onRequestPost(context) {
  const { request } = context;
  let b;
  try { b = JSON.parse(await request.text()); } catch (e) { return new Response('bad json', { status: 400 }); }
  if (!b || typeof b !== 'object') return new Response('bad json', { status: 400 });

  const session = typeof b.session === 'string' ? b.session.slice(0, 40) : '';
  const path = typeof b.path === 'string' ? b.path.slice(0, 200) : '';
  const seconds = Math.min(3600, Math.max(0, Math.round(Number(b.seconds) || 0)));
  const scroll = Math.min(100, Math.max(0, Math.round(Number(b.scroll) || 0)));
  if (session.length < 8 || !path) return new Response('bad row', { status: 400 });

  try {
    const r = await fetch(SB + '/rest/v1/site_engagement', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ session, path, seconds, scroll }),
    });
    return new Response(null, { status: r.ok ? 204 : 502 });
  } catch (e) {
    return new Response(null, { status: 502 });
  }
}
