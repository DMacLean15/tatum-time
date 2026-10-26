// Cloudflare Pages Function - logs one anonymous page visit for the stats page.
// Route: POST https://tatumtime.net/api/visit   (called by js/visits.js)
// Adds the visitor's country / state / city from Cloudflare's own lookup, then
// saves the row in Supabase (site_visits) with the public key. The IP address
// itself is never stored. See SETUP-VISITOR-COUNTER.txt.

const SB = 'https://oeogaqrqwevjqpwvrxhq.supabase.co';
const KEY = 'sb_publishable_qHH5R2FwTF-zKs5zoVXZzA_f98jkW75';
const BASE = ['visitor', 'session', 'path', 'referrer', 'device'];
const ONE_OF = {
  device: ['phone', 'tablet', 'desktop'],
  browser: ['Chrome', 'Safari', 'Edge', 'Firefox', 'Samsung', 'Other'],
  os: ['iOS', 'Android', 'Windows', 'macOS', 'Linux', 'Other'],
  screen: ['<400', '400-767', '768-1279', '1280-1919', '1920+'],
};

const str = (v, max) => (typeof v === 'string' && v.trim()) ? v.trim().slice(0, max) : null;
const one = (v, list) => list.includes(v) ? v : null;

function insert(row) {
  return fetch(SB + '/rest/v1/site_visits', {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
}

export async function onRequestPost(context) {
  const { request } = context;
  const ua = request.headers.get('user-agent') || '';
  if (/bot|crawl|spider|slurp|preview|lighthouse|headless/i.test(ua)) return new Response(null, { status: 204 });

  let b;
  try { b = await request.json(); } catch (e) { return new Response('bad json', { status: 400 }); }
  if (!b || typeof b !== 'object') return new Response('bad json', { status: 400 });

  const visitor = str(b.visitor, 40), session = str(b.session, 40), path = str(b.path, 200);
  if (!visitor || visitor.length < 8 || !session || session.length < 8 || !path) return new Response('bad visit', { status: 400 });

  const cf = request.cf || {};
  const country = /^[A-Z0-9]{2}$/.test(cf.country || '') ? cf.country : null;
  const lang = /^[a-z]{2}$/.test(b.lang || '') ? b.lang : null;
  const source = str(typeof b.source === 'string' ? b.source.toLowerCase() : null, 40);
  const row = {
    visitor, session, path,
    referrer: str(b.referrer, 100),
    device: one(b.device, ONE_OF.device),
    country,
    region: str(cf.region, 60),
    city: str(cf.city, 60),
    browser: one(b.browser, ONE_OF.browser),
    os: one(b.os, ONE_OF.os),
    lang,
    tz: str(b.tz, 50),
    screen: one(b.screen, ONE_OF.screen),
    source,
  };

  try {
    let r = await insert(row);
    if (!r.ok) {
      // Upgrade SQL not run yet (new columns missing) - keep counting with the basics.
      const basic = {}; BASE.forEach(k => { basic[k] = row[k]; });
      r = await insert(basic);
    }
    return new Response(null, { status: r.ok ? 204 : 502 });
  } catch (e) {
    return new Response(null, { status: 502 });
  }
}
