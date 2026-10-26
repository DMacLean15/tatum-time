/* Generates a real web page for every post - post/<slug>/index.html - plus category
   pages, Celtics player pages, sitemap.xml and the homepage's pre-filled post list.
   WHY: the homepage is one page, so before this, sharing a post on social media or
   texting a link showed the generic site preview. Each generated page carries its
   own title, description and photo, so link previews (and Google) see the real
   content. Post pages show the full post and link back to the main site for
   comments and reactions.

   Runs on every Cloudflare Pages deploy - build-rss.js requires this file, so the
   existing build command picks it up with no dashboard changes. A failure here
   FAILS the deploy (the live site keeps its last good version) - except the ESPN
   player data, which is skipped with a log line if ESPN is down.
   Reads content/posts.json (build-posts.js): slug, html, hero, excerpt, readMins.

   PLAYER PAGES: the current Celtics roster from ESPN's public API (1 roster
   request + 1 stats request per player, 4 at a time, 8s timeout) ->
   player/<slug>/index.html, player/index.html (roster grid) and
   content/players.json = [{id, name, slug, url, jersey, position}] for the
   homepage. The first mention of a player's full name in a post links to his page.
   Set TT_SKIP_PLAYERS=1 to build offline without them.

   CACHE BUSTING: every /js/<file>.js?v=... and /css/<file>.css?v=... URL in
   index.html and the generated pages is rewritten to ?v=<sha1 of the file, 10 hex>,
   so those files can be cached for a year and still update on the next deploy.
   Write ?v=dev in the repo; the build fills in the real version. No npm packages. */
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const TT = require('./js/shared.js');
const esc = TT.esc;

const SITE = 'https://tatumtime.net';
const DEFAULT_OG = SITE + '/og.jpg';
const SOCIALS = ['https://www.instagram.com/dmaclean15/', 'https://www.facebook.com/DMacLean15/', 'https://www.threads.com/@dmaclean15'];
const AUTHOR = { '@type':'Person', name:'Dan MacLean', url:SITE+'/#about', sameAs:SOCIALS };
const PUBLISHER = { '@type':'Organization', name:'Tatum Time', alternateName:'TatumTime', url:SITE+'/', logo:{'@type':'ImageObject',url:SITE+'/icon-512.png'}, sameAs:SOCIALS };
const TEAM = { '@type':'SportsTeam', name:'Boston Celtics', sport:'Basketball', url:'https://www.nba.com/celtics' };
const ROSTER_URL = process.env.TT_ROSTER_URL || 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/bos/roster';
const STATS_URL = id => 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/' + id + '/stats';
/* category pages (/category/<slug>/): friendlier headings for the CMS categories */
const CAT_INFO = {
  Recap:     { h1:'Celtics Game Recaps',  blurb:'Every Tatum Time game recap of the Boston Celtics, newest first.' },
  News:      { h1:'Celtics News',         blurb:'Boston Celtics news, birthdays, milestones off the court and more from Tatum Time.' },
  Milestone: { h1:'Celtics Milestones',   blurb:'Records, career marks and franchise milestones for the Boston Celtics.' },
  Draft:     { h1:'Celtics Draft Coverage', blurb:'Boston Celtics draft picks, grades and prospect breakdowns.' },
  Playoffs:  { h1:'Celtics Playoff Coverage', blurb:'Boston Celtics playoff previews, series breakdowns and postseason recaps.' },
  Roster:    { h1:'Celtics Roster Moves', blurb:'Boston Celtics trades, signings and roster moves, analyzed.' },
};
const catSlug = c => TT.slugify(c);
const catInfo = c => CAT_INFO[c] || { h1:'Celtics ' + c, blurb:'Every Tatum Time ' + String(c).toLowerCase() + ' post on the Boston Celtics, newest first.' };
/* JSON-LD inside <script>: '<' escaped so no field can close the tag */
const ld = o => '<script type="application/ld+json">\n' + JSON.stringify(o).replace(/</g, '\\u003c') + '\n</script>';

/* ---- the same body transforms the live site applies (see index.html) ---- */
const pill = html => html.replace(/==([^=]+)==/g, '<span class="stat-pill">$1</span>');
/* WebP copy from build-images.js, original photo as the fallback */
function imgAttrs(src, w){
  const v = TT.imgVariant(src, w);
  return v === src ? `src="${esc(src)}"` : `src="${esc(v)}" data-orig="${esc(src)}" onerror="this.onerror=null;this.src=this.dataset.orig"`;
}
function absUrl(u){
  u = String(u||'').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return SITE + (u[0] === '/' ? '' : '/') + u;
}
const isoOf = d => /^\d{4}-\d{2}-\d{2}/.test(String(d)) ? String(d).slice(0,10) : '';

function normalize(p){
  let body = TT.embedYouTube(pill(String(p.html || '')));
  // the hero photo is shown above the article, so a first photo used as the hero
  // comes out of the body (same rule as the homepage)
  if (!(p.image || '').trim() && p.hero) {
    const m = body.match(/<p>\s*<img[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/p>/i);
    if (m && m[1] === p.hero) body = body.replace(m[0], '');
  }
  body = TT.captionImages(body);
  body = body.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async" ');
  body = body.replace(/<img\b([^>]*?)\bsrc="([^"]+)"/gi, (m, pre, src) => TT.imgVariant(src.replace(/&amp;/g,'&'), 1200) === src.replace(/&amp;/g,'&') ? m : '<img' + pre + imgAttrs(src.replace(/&amp;/g,'&'), 1200));
  const gl = String(p.gameLink || '').trim();
  if (/^https?:\/\//i.test(gl)) body += `<a class="game-link" href="${esc(gl)}" target="_blank" rel="noopener">📊 See full game stats here ↗</a>`;
  return {
    slug: p.slug, title: p.title || '', cat: p.category || 'Post', date: p.date || '', emoji: p.emoji || '🏀',
    hero: p.hero || '', body, excerpt: p.excerpt || '', readMins: p.readMins || 1, featured: p.featured === true,
    text: (p.title || '') + ' ' + TT.plainText(p.html)
  };
}

/* ---------- ESPN roster + stats ---------- */
function getJson(url, ms){
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (tatumtime.net site build)', accept: 'application/json' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let d = ''; res.setEncoding('utf8');
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.setTimeout(ms || 8000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
async function pool(items, n, fn){
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
const SUFFIX = /,?\s+(jr\.?|sr\.?|ii|iii|iv)$/i;
/* season averages row for a season year, Celtics row first (traded players have several) */
function seasonRow(stats, year){
  const cat = (stats && stats.categories || []).find(c => c.name === 'averages');
  if (!cat) return null;
  const rows = (cat.statistics || []).filter(r => r.season && r.season.year === year);
  const r = rows.find(x => x.teamSlug === 'boston-celtics') || rows[rows.length - 1];
  if (!r) return null;
  const v = {}; cat.labels.forEach((l, i) => v[l] = r.stats[i]);
  const car = {}; if (cat.totals) cat.labels.forEach((l, i) => car[l] = cat.totals[i]);
  return { season: r.season.displayName, v, career: cat.totals ? car : null };
}
async function loadPlayers(){
  if (process.env.TT_SKIP_PLAYERS) { console.log('build-pages: TT_SKIP_PLAYERS set - no player pages.'); return null; }
  let roster;
  try { roster = await getJson(ROSTER_URL, 10000); }
  catch (e) { console.error('build-pages: WARNING - ESPN roster unavailable (' + e.message + ') - player pages skipped this deploy.'); return null; }
  const year = roster.season && roster.season.year, seasonName = roster.season && roster.season.displayName || '';
  const list = (roster.athletes || []).filter(a => a && a.id && a.fullName).map(a => ({
    id: String(a.id), name: a.fullName, first: a.firstName || '', lastName: String(a.lastName || '').replace(SUFFIX, ''),
    slug: TT.slugify(a.fullName), jersey: a.jersey || '', pos: a.position && a.position.abbreviation || '',
    posName: a.position && (a.position.displayName || a.position.name) || '', age: a.age || '',
    height: a.displayHeight || '', weight: a.displayWeight || '', college: a.college && a.college.name || '',
    exp: a.experience ? a.experience.years : null, dob: String(a.dateOfBirth || '').slice(0,10),
    born: [a.birthPlace && a.birthPlace.city, a.birthPlace && (a.birthPlace.state || a.birthPlace.country)].filter(Boolean).join(', '),
    injured: (a.injuries || []).length ? (a.injuries[0].status || 'Injured') : '',
    headshot: a.headshot && a.headshot.href ? 'https://a.espncdn.com/combiner/i?img=' + a.headshot.href.replace(/^https?:\/\/a\.espncdn\.com/, '') + '&w=350&h=254' : '',
    espn: (a.links || []).map(l => l.href).find(h => /^https:\/\/www\.espn\.com\/nba\/player\/_\/id\//.test(h)) || 'https://www.espn.com/nba/player/_/id/' + a.id,
    gamelog: (a.links || []).map(l => l.href).find(h => /\/gamelog\//.test(h)) || '',
    stats: null, last: null
  }));
  if (!list.length) { console.error('build-pages: WARNING - ESPN roster was empty - player pages skipped.'); return null; }
  let ok = 0;
  await pool(list, 4, async p => {
    try {
      const s = await getJson(STATS_URL(p.id), 8000);
      p.stats = seasonRow(s, year);
      p.last = p.stats ? null : seasonRow(s, year - 1);
      ok++;
    } catch (e) { console.log('build-pages: no ESPN stats for ' + p.name + ' (' + e.message + ')'); }
  });
  // slugs must be unique (two players with one name: add the jersey)
  const seen = new Set();
  list.forEach(p => { if (seen.has(p.slug)) p.slug = TT.slugify(p.name + ' ' + (p.jersey || p.id)); seen.add(p.slug); });
  console.log('build-pages: ESPN roster ' + list.length + ' players, stats for ' + ok);
  list.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.name.localeCompare(b.name));
  list.season = seasonName;
  return list;
}

/* name matching: accent-tolerant ("Gonzalez" = "González"), optional Jr./Sr. */
const ACC = { a:'aáàäâã', e:'eéèëê', i:'iíìïî', o:'oóòöôõ', u:'uúùüû', n:'nñ', c:'cç' };
const namePat = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').split('').map(ch => {
  const lo = ch.toLowerCase();
  if (ACC[lo]) return '[' + (ch === lo ? ACC[lo] : ACC[lo].toUpperCase()) + ']';
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}).join('');
const fullPat = p => namePat(p.name.replace(SUFFIX, '')) + '(?:,?\\s+(?:Jr|Sr)\\.?|\\s+(?:II|III|IV))?';
const B1 = '(?<![\\p{L}\\p{N}])', B2 = '(?![\\p{L}\\p{N}])';
/* last names too common (or too likely to mean someone else) to match on their own */
const COMMON_LAST = new Set(['White','Brown','Green','Black','Williams','Johnson','Smith','Jones','Davis','Young','King','Love','Holiday','Walker','Carter','Harper','Robinson','Mitchell','Rose','Allen','Thomas','George','Jackson','Moore','Hill','Bell','Price','Wells']);
function mentionRes(players){
  const firsts = new Set(players.map(p => p.first));
  const lastCount = {}; players.forEach(p => lastCount[p.lastName] = (lastCount[p.lastName] || 0) + 1);
  players.forEach(p => {
    p.fullRe = new RegExp(B1 + fullPat(p) + B2, 'iu');
    const L = p.lastName;
    p.lastRe = L.length >= 4 && lastCount[L] === 1 && !firsts.has(L) && !COMMON_LAST.has(L) ? new RegExp(B1 + namePat(L) + B2, 'u') : null;
  });
}
/* "posts about": full name anywhere, or the (unambiguous) last name. "Tatum Time" is the site, not the player. */
const mentions = (p, post) => { const t = post.text.replace(/Tatum\s+Time/gi, ' '); return p.fullRe.test(t) || (p.lastRe ? p.lastRe.test(t) : false); };
/* link the first mention of each player's full name in a post (never inside a link, heading, caption, embed or tag) */
function linkPlayers(html, players){
  if (!players || !players.length) return html;
  const re = new RegExp(B1 + '(?:' + players.map(fullPat).sort((a, b) => b.length - a.length).join('|') + ')' + B2, 'giu');
  const done = new Set(); let skip = 0;
  return html.split(/(<[^>]*>)/).map(part => {
    const t = part.match(/^<(\/?)(a|h[1-6]|figcaption|script|style|iframe|button|code|pre)\b/i);
    if (t) { skip += t[1] ? -1 : 1; if (skip < 0) skip = 0; return part; }
    if (part[0] === '<' || skip) return part;
    return part.replace(re, m => {
      const p = players.find(x => !done.has(x) && x.fullRe.test(m));
      if (!p) return m;
      done.add(p);
      return `<a class="pl-link" href="/player/${p.slug}/">${m}</a>`;
    });
  }).join('');
}

/* Shared page chrome - matches the live site's refreshed dark Celtics look. */
const CSS = `
:root{--green:#007a33;--green-deep:#04531f;--green-glow:#16c45b;--gold:#bfa15a;--ink:#0c1410;--card:#0f1d16;--line:rgba(255,255,255,.08);--txt:#e8efe9;--muted:#9bb3a5}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,sans-serif;background:radial-gradient(1200px 600px at 80% -10%,rgba(22,196,91,.10),transparent 60%),var(--ink);color:var(--txt);line-height:1.6}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}
.wrap{max-width:780px;margin:0 auto;padding:0 22px}
header{position:sticky;top:0;z-index:5;backdrop-filter:blur(14px);background:rgba(8,16,12,.82);border-bottom:1px solid var(--line)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:62px}
.brand{font-family:'Anton',sans-serif;font-size:1.3rem;letter-spacing:1px;text-transform:uppercase;color:#fff}
.brand span{color:var(--green-glow)}
.home-link{font-size:.85rem;font-weight:700;color:var(--muted);padding:8px 14px;border:1px solid var(--line);border-radius:999px;transition:.15s}
.home-link:hover{color:#fff;border-color:var(--green)}
main{padding:36px 0 60px}
.cat{font-size:.7rem;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--green-glow)}
h1{color:#fff;font-size:clamp(1.7rem,5vw,2.4rem);line-height:1.2;margin:10px 0 8px}
.meta{color:var(--muted);font-size:.88rem;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.meta b{color:var(--txt)}
.hero-img{width:100%;aspect-ratio:2.2/1;max-height:380px;object-fit:cover;border-radius:14px;border:1px solid var(--line);margin-bottom:26px;background:#0a140f}
.article{color:#d7e2db;font-size:1.05rem;line-height:1.72;overflow-wrap:break-word}
.article p{margin-bottom:15px}
.article ul{margin:0 0 16px 20px}
.article li{margin-bottom:6px;color:var(--muted)}
.article h2{color:#fff;font-weight:800;font-size:1.4rem;margin:34px 0 10px;padding-left:14px;border-left:3px solid var(--green-glow);line-height:1.25}
.article h3{color:#fff;font-weight:700;font-size:1.18rem;margin:26px 0 8px}
.article h4{color:#fff;font-size:1.15rem;margin:24px 0 6px}
.article img{max-width:100%;height:auto;max-height:540px;width:auto;border-radius:12px;border:1px solid var(--line);margin:18px auto;display:block}
.article figure{margin:20px 0}
.article figcaption{text-align:center;color:var(--muted);font-size:.82rem;font-style:italic;padding:0 12px}
.article hr{border:0;height:1px;background:var(--line);margin:38px 0;overflow:visible}
.article hr::before{content:"☘";position:relative;top:-.72em;display:block;width:38px;margin:0 auto;text-align:center;color:var(--green-glow);background:#0d1912;font-size:1.05rem}
.stat-pill{display:inline-block;background:rgba(22,196,91,.12);border:1px solid rgba(22,196,91,.25);color:var(--green-glow);padding:3px 10px;border-radius:8px;font-size:.82rem;font-weight:600;margin:2px 4px 2px 0}
.grade{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:12px;font-family:'Anton',sans-serif;font-size:1.4rem;background:rgba(22,196,91,.14);color:var(--green-glow);border:1px solid rgba(22,196,91,.3)}
.game-link{display:inline-flex;align-items:center;gap:9px;margin:8px 0 2px;padding:12px 18px;border-radius:12px;background:rgba(22,196,91,.10);border:1px solid rgba(22,196,91,.32);color:var(--green-glow);font-weight:700;font-size:.92rem}
.post-score{display:inline-flex;flex-direction:column;gap:2px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 22px;margin:18px 0}
.post-score .ps-row{display:flex;align-items:center;justify-content:space-between;gap:30px;padding:5px 0;color:var(--muted)}
.post-score .ps-team{font-weight:700;font-size:1.02rem}
.post-score .ps-score{font-family:'Anton',sans-serif;font-size:1.45rem;color:var(--muted);min-width:46px;text-align:right}
.post-score .ps-win .ps-team,.post-score .ps-win .ps-score{color:var(--green-glow)}
.pull-quote{margin:26px 0;padding:4px 0 4px 22px;border-left:4px solid var(--green-glow)}
.pull-quote p{font-size:1.3rem;line-height:1.42;color:#fff;font-weight:600;margin:0}
.pull-quote cite{display:block;margin-top:10px;color:var(--green-glow);font-style:normal;font-weight:700;font-size:.9rem}
.stat-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 18px;margin:18px 0}
.stat-line .sl-name{font-weight:800;color:#fff;font-size:1.05rem}
.stat-line .sl-stats{color:var(--green-glow);font-weight:700}
.callout{display:flex;gap:12px;align-items:flex-start;background:rgba(191,161,90,.08);border:1px solid rgba(191,161,90,.3);border-radius:12px;padding:14px 16px;margin:18px 0}
.callout .co-ico{font-size:1.3rem;flex:0 0 auto}
.grade-badge{display:flex;align-items:center;gap:16px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin:20px 0}
.grade-badge .gb-grade{font-family:'Anton',sans-serif;font-size:2.5rem;line-height:1;width:74px;height:74px;flex:0 0 auto;display:grid;place-items:center;border-radius:14px;color:#fff}
.grade-badge .gb-label{font-weight:800;color:#fff;font-size:1.06rem}
.grade-badge .gb-note{color:var(--muted);font-size:.9rem}
.gb-a{background:linear-gradient(145deg,#16c45b,#04531f)}.gb-b{background:linear-gradient(145deg,#39a86f,#0a3a24)}.gb-c{background:linear-gradient(145deg,#bfa15a,#6e5a25)}.gb-d{background:linear-gradient(145deg,#d98a3b,#7a4715)}.gb-f{background:linear-gradient(145deg,#d95b5b,#7a1f1f)}
.stat-hero{text-align:center;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:26px 20px;margin:22px 0}
.stat-hero .sh-num{display:block;font-family:'Anton',sans-serif;font-size:4rem;line-height:1;color:var(--green-glow)}
.stat-hero .sh-cap{display:block;margin-top:10px;font-weight:600}
.tale-tape{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 18px 8px;margin:22px 0}
.tale-tape .tt-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:12px;margin-bottom:8px;border-bottom:1px solid var(--line)}
.tale-tape .tt-a,.tale-tape .tt-b{font-weight:800;color:#fff;flex:1}
.tale-tape .tt-b{text-align:right}
.tale-tape .tt-vs{color:var(--green-glow);font-family:'Anton',sans-serif;font-size:.85rem;letter-spacing:1.5px}
.tale-tape .tt-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0}
.tale-tape .tt-va,.tale-tape .tt-vb{font-family:'Anton',sans-serif;font-size:1.2rem;color:#fff;flex:1}
.tale-tape .tt-vb{text-align:right}
.tale-tape .tt-stat{color:var(--muted);font-size:.68rem;font-weight:800;letter-spacing:1.2px;text-transform:uppercase}
.timeline{margin:22px 0}
.timeline .tl-title{font-family:'Anton',sans-serif;color:#fff;font-size:1.15rem;margin-bottom:14px}
.timeline .tl-item{position:relative;padding:0 0 16px 24px;border-left:2px solid rgba(22,196,91,.3)}
.timeline .tl-item:last-child{border-left-color:transparent}
.timeline .tl-item::before{content:"";position:absolute;left:-7px;top:3px;width:12px;height:12px;border-radius:50%;background:var(--green-glow)}
.timeline .tl-when{color:var(--green-glow);font-weight:800;font-size:.72rem;letter-spacing:1px;text-transform:uppercase;margin-right:9px}
.rating{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:22px 0}
.rating .rt-title{font-weight:800;color:#fff;margin-bottom:12px}
.rating .rt-row{display:flex;align-items:center;gap:12px;margin:9px 0}
.rating .rt-lbl{flex:0 0 100px;color:var(--muted);font-size:.85rem;font-weight:600}
.rating .rt-bar{flex:1;height:10px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}
.rating .rt-fill{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,var(--green),var(--green-glow))}
.rating .rt-val{flex:0 0 auto;font-family:'Anton',sans-serif;color:#fff;font-size:.95rem;min-width:44px;text-align:right}
.yt-embed{position:relative;width:100%;padding-top:56.25%;margin:20px 0;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:#000}
.yt-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.more{margin-top:34px;padding-top:20px;border-top:1px solid var(--line)}
.more-lbl{font-size:.7rem;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:var(--gold);margin-bottom:6px}
.more-link{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:11px 0;color:#fff;font-weight:600;font-size:.96rem;border-bottom:1px solid var(--line)}
.more-link:hover{color:var(--green-glow)}
.more-cat{color:var(--muted);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.8px;flex:0 0 auto}
.join{margin-top:36px;padding:22px;text-align:center;background:linear-gradient(140deg,rgba(22,196,91,.10),rgba(191,161,90,.05));border:1px solid rgba(22,196,91,.2);border-radius:16px}
.join p{color:var(--muted);font-size:.92rem;margin-bottom:12px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:999px;font-weight:700;font-size:.95rem;background:linear-gradient(145deg,var(--green-glow),var(--green));color:#062a14}
footer{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);font-size:.82rem;text-align:center}
`;
/* ---------- cache busting: ?v=<content hash> on /js and /css files ---------- */
const hashes = {};
function fileHash(url){
  if (!(url in hashes)) {
    try { hashes[url] = crypto.createHash('sha1').update(fs.readFileSync('.' + url)).digest('hex').slice(0, 10); }
    catch (e) { hashes[url] = null; console.error('build-pages: WARNING - ' + url + ' is referenced but missing - left unversioned.'); }
  }
  return hashes[url];
}
const versionAssets = html => html.replace(/(\/(?:js|css)\/[\w.\-\/]+?\.(?:js|css))\?v=[\w.\-]*/g, (m, url) => { const h = fileHash(url); return h ? url + '?v=' + h : m; });
function writePage(file, html){ fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, versionAssets(html)); }

/* <head> bits every generated page shares */
function headCommon(){
  return `<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#007a33" />`;
}
function headFonts(){
  return `<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin />
<style>
@font-face{font-family:'Anton';font-weight:400;font-display:swap;src:url(/fonts/anton-latin.woff2) format('woff2');unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
@font-face{font-family:'Inter';font-weight:400 800;font-display:swap;src:url(/fonts/inter-latin.woff2) format('woff2');unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
@font-face{font-family:'Inter';font-weight:400 800;font-display:swap;src:url(/fonts/inter-latin-ext.woff2) format('woff2')}
</style>
<link rel="alternate" type="application/rss+xml" title="Tatum Time - Celtics Blog" href="/feed.xml" />
<style>${CSS}${CAT_CSS}${PLAYER_CSS}</style>`;
}
function headerHtml(){
  return `<header><div class="wrap nav-inner">
  <a class="brand" href="/">☘️ Tatum<span>Time</span></a>
  <nav class="nav-links">${PLAYERS.length ? '<a class="home-link" href="/player/">Roster</a>' : ''}<a class="home-link" href="/#posts">All posts →</a></nav>
</div></header>`;
}

function heroImg(p){
  return `<img class="hero-img" ${imgAttrs(p.hero, 1200)} alt="${esc(p.title)}" fetchpriority="high" />`;
}

function pageHtml(p, related){
  const url = SITE + '/post/' + p.slug + '/';
  // link-preview card made by build-og.js; else the post photo; else the site card
  const card = fs.existsSync(path.join('og', p.slug + '.jpg'));
  const og = card ? SITE + '/og/' + p.slug + '.jpg' : p.hero ? absUrl(p.hero) : DEFAULT_OG;
  const isoDate = isoOf(p.date);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(p.title)} - Tatum Time</title>
<meta name="description" content="${esc(p.excerpt)}" />
<meta name="robots" content="max-image-preview:large" />
${headCommon()}
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:locale" content="en_US" />
<meta property="og:site_name" content="Tatum Time" />
<meta property="og:title" content="${esc(p.title)}" />
<meta property="og:description" content="${esc(p.excerpt)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${esc(og)}" />
${(card || og === DEFAULT_OG) ? '<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />' : ''}
${isoDate ? '<meta property="article:published_time" content="' + isoDate + '" />' : ''}
<meta property="article:section" content="${esc(p.cat)}" />
<meta property="article:author" content="Dan MacLean" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(p.title)}" />
<meta name="twitter:description" content="${esc(p.excerpt)}" />
<meta name="twitter:image" content="${esc(og)}" />
${ld({
  '@context':'https://schema.org','@type':'BlogPosting',
  headline:p.title, description:p.excerpt, url,
  image:og, datePublished:isoDate||undefined,
  articleSection:p.cat, inLanguage:'en-US',
  author:AUTHOR, publisher:PUBLISHER,
  mainEntityOfPage:url
})}
${ld({
  '@context':'https://schema.org','@type':'BreadcrumbList',
  itemListElement:[
    {'@type':'ListItem',position:1,name:'Tatum Time',item:SITE+'/'},
    {'@type':'ListItem',position:2,name:catInfo(p.cat).h1,item:SITE+'/category/'+catSlug(p.cat)+'/'},
    {'@type':'ListItem',position:3,name:p.title,item:url}
  ]
})}
${headFonts()}
</head>
<body>
${headerHtml()}
<main><div class="wrap">
  <a class="cat" href="/category/${catSlug(p.cat)}/">${esc(p.cat)}</a>
  <h1>${esc(p.emoji)} ${esc(p.title)}</h1>
  <div class="meta"><b>Dan MacLean</b> · ${esc(TT.fmtDisplayDate(p.date))} · ${p.readMins} min read</div>
  ${p.hero ? heroImg(p) : ''}
  <div class="article">${p.body}</div>
  ${related && related.length ? `<div class="more"><div class="more-lbl">More from Tatum Time</div>${related.map(r => `<a class="more-link" href="/post/${r.slug}/">${esc(r.emoji)} ${esc(r.title)}<span class="more-cat">${esc(r.cat)}</span></a>`).join('')}</div>` : ''}
  <div class="join">
    <p>Reactions and comments live on the main site - come join the conversation. ☘️</p>
    <a class="btn" href="/#/post/${p.slug}">Discuss on Tatum Time →</a>
  </div>
</div></main>
${footerHtml()}
<script src="/js/visits.js?v=dev" defer></script>
</body>
</html>
`;
}

/* footer shared by every generated page: category (+ roster) links give Google a crawl path */
let CATS = [], PLAYERS = [];
function catLinks(){
  return CATS.map(c => `<a href="/category/${catSlug(c)}/">${esc(catInfo(c).h1.replace(/^Celtics /,''))}</a>`).join('')
    + (PLAYERS.length ? '<a href="/player/">Celtics Roster</a>' : '');
}
function footerHtml(){
  return `<footer><div class="wrap">${CATS.length ? `<nav class="foot-cats" aria-label="Browse by category">${catLinks()}</nav>` : ''}© ${new Date().getFullYear()} Tatum Time · Not affiliated with the Boston Celtics or the NBA.</div></footer>`;
}

/* small WebP card photo (build-images.js naming), original as the fallback */
function cardImg(p){
  if (!p.hero) return `<span class="cc-photo cc-emoji">${esc(p.emoji)}</span>`;
  return `<span class="cc-photo"><img ${imgAttrs(p.hero, 480)} alt="" loading="lazy" decoding="async" width="480" height="270" /></span>`;
}
const postCard = p => `<a class="cat-card" href="/post/${p.slug}/">${cardImg(p)}<span class="cc-body"><b>${esc(p.title)}</b><small>${esc(TT.fmtDisplayDate(p.date))} · ${p.readMins} min read</small><span class="cc-ex">${esc(p.excerpt)}</span></span></a>`;

function categoryHtml(cat, list){
  const info = catInfo(cat), url = SITE + '/category/' + catSlug(cat) + '/';
  const title = info.h1 + ' - Tatum Time';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(info.blurb)}" />
<meta name="robots" content="max-image-preview:large" />
${headCommon()}
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Tatum Time" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(info.blurb)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${DEFAULT_OG}" />
<meta name="twitter:card" content="summary_large_image" />
${ld({
  '@context':'https://schema.org','@type':'CollectionPage',
  name:info.h1, description:info.blurb, url, inLanguage:'en-US', publisher:PUBLISHER,
  mainEntity:{'@type':'ItemList',itemListElement:list.map((p,i)=>({'@type':'ListItem',position:i+1,url:SITE+'/post/'+p.slug+'/',name:p.title}))}
})}
${headFonts()}
</head>
<body>
${headerHtml()}
<main><div class="wrap">
  <div class="cat">Tatum Time · ${list.length} post${list.length === 1 ? '' : 's'}</div>
  <h1>${esc(info.h1)}</h1>
  <p class="cat-blurb">${esc(info.blurb)}</p>
  <nav class="cat-tabs" aria-label="Categories">${CATS.map(c => `<a href="/category/${catSlug(c)}/"${c === cat ? ' class="on" aria-current="page"' : ''}>${esc(c)}</a>`).join('')}</nav>
  <div class="cat-grid">
    ${list.map(postCard).join('\n    ')}
  </div>
</div></main>
${footerHtml()}
<script src="/js/visits.js?v=dev" defer></script>
</body>
</html>
`;
}
const CAT_CSS = `
.cat-blurb{color:var(--muted);margin:-6px 0 18px}
.cat-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
.cat-tabs a{font-size:.78rem;font-weight:700;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:6px 13px}
.cat-tabs a:hover{color:#fff;border-color:var(--green)}
.cat-tabs a.on{background:var(--green);border-color:var(--green);color:#fff}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-bottom:40px}
.cat-card{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:transform .18s,border-color .18s}
.cat-card:hover{transform:translateY(-3px);border-color:rgba(22,196,91,.45)}
.cc-photo{display:block;aspect-ratio:16/9;background:linear-gradient(135deg,#0a8f3c,#04331a);overflow:hidden}
.cc-photo img{width:100%;height:100%;object-fit:cover}
.cc-emoji{display:grid;place-items:center;font-size:2.2rem}
.cc-body{display:flex;flex-direction:column;gap:5px;padding:12px 14px 15px}
.cc-body b{color:#fff;line-height:1.3}
.cc-body small{color:var(--muted);font-size:.74rem}
.cc-ex{color:var(--muted);font-size:.84rem;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.foot-cats{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 16px;margin-bottom:12px}
.foot-cats a{color:var(--muted);font-weight:600}
.foot-cats a:hover{color:var(--green-glow)}
a.cat:hover{text-decoration:underline}
`;
/* ---------- player pages ---------- */
const PLAYER_CSS = `
.nav-links{display:flex;gap:8px}
.article a.pl-link{color:var(--green-glow);border-bottom:1px dotted rgba(22,196,91,.6)}
.article a.pl-link:hover{border-bottom-style:solid}
.crumbs{font-size:.78rem;color:var(--muted);margin-bottom:16px}
.crumbs a{color:var(--muted);font-weight:600}.crumbs a:hover{color:var(--green-glow)}
.pl-hero{position:relative;display:grid;grid-template-columns:250px 1fr;gap:10px 26px;align-items:end;background:radial-gradient(420px 260px at 18% 100%,rgba(22,196,91,.28),transparent 70%),linear-gradient(140deg,#0f2a1b,#0b1711);border:1px solid var(--line);border-radius:18px;padding:22px 26px 0;overflow:hidden;margin-bottom:22px}
.pl-num{position:absolute;right:26px;top:14px;font-family:'Anton',sans-serif;font-size:8rem;line-height:1;color:rgba(255,255,255,.06);pointer-events:none}
.pl-shot{align-self:end;aspect-ratio:350/254;width:100%}
.pl-shot img{width:100%;height:100%;object-fit:contain;object-position:bottom}
.pl-shot.none{display:grid;place-items:center;font-size:4rem}
.pl-id{padding-bottom:22px;position:relative}
.pl-id h1{margin:4px 0 6px;font-family:'Anton',sans-serif;font-weight:400;letter-spacing:.5px;text-transform:uppercase;font-size:clamp(2rem,6vw,3rem);line-height:1.02}
.pl-tag{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}
.pl-tag span{font-size:.78rem;font-weight:700;color:#fff;background:rgba(255,255,255,.08);border:1px solid var(--line);border-radius:999px;padding:4px 11px}
.pl-tag span.inj{color:#ffb4a8;border-color:rgba(217,91,91,.45);background:rgba(217,91,91,.12)}
.pl-bio{display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:10px;margin-bottom:26px}
.pl-bio div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px}
.pl-bio dt{font-size:.66rem;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted)}
.pl-bio dd{color:#fff;font-weight:700;font-size:.98rem;margin-top:2px}
.sec-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:6px 0 12px}
.sec-h h2{color:#fff;font-size:1.25rem;font-weight:800}
.sec-h small{color:var(--muted);font-size:.8rem}
.stat-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:12px}
.stat-grid div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 10px;text-align:center}
.stat-grid b{display:block;font-family:'Anton',sans-serif;font-weight:400;font-size:1.75rem;line-height:1.1;color:var(--green-glow)}
.stat-grid span{display:block;margin-top:3px;font-size:.66rem;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:var(--muted)}
.stat-grid div.main{background:linear-gradient(145deg,rgba(22,196,91,.16),rgba(4,83,31,.22));border-color:rgba(22,196,91,.35)}
.stat-grid div.main b{color:#fff}
.career{color:var(--muted);font-size:.86rem;margin-bottom:30px}
.career b{color:var(--txt)}
.empty{color:var(--muted);background:var(--card);border:1px dashed var(--line);border-radius:12px;padding:16px 18px;margin-bottom:30px}
.ext{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}
.ext a{font-size:.84rem;font-weight:700;color:var(--txt);border:1px solid var(--line);border-radius:999px;padding:8px 15px}
.ext a:hover{border-color:var(--green);color:#fff}
.src-note{color:var(--muted);font-size:.74rem;margin-top:8px}
.roster-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:40px}
.ros-card{position:relative;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:transform .18s,border-color .18s}
.ros-card:hover{transform:translateY(-3px);border-color:rgba(22,196,91,.45)}
.ros-shot{display:block;aspect-ratio:350/254;background:radial-gradient(160px 110px at 50% 100%,rgba(22,196,91,.3),transparent 70%),linear-gradient(140deg,#0f2a1b,#0b1711)}
.ros-shot img{width:100%;height:100%;object-fit:contain;object-position:bottom}
.ros-num{position:absolute;top:8px;left:10px;font-family:'Anton',sans-serif;font-size:1.1rem;color:rgba(255,255,255,.55)}
.ros-body{padding:10px 12px 13px}
.ros-body b{display:block;color:#fff;line-height:1.25}
.ros-body small{color:var(--muted);font-size:.75rem}
@media (max-width:640px){
  .wrap{padding:0 16px}
  .pl-hero{grid-template-columns:1fr;padding:18px 18px 0;gap:0}
  .pl-shot{order:2;max-width:300px;margin:6px auto 0}
  .pl-id{padding-bottom:4px}
  .pl-num{font-size:5.5rem;top:12px;right:14px}
  .pl-bio{grid-template-columns:repeat(2,1fr)}
  .stat-grid{gap:6px}
  .stat-grid div{padding:10px 2px}
  .stat-grid b{font-size:1.25rem}
  .stat-grid span{font-size:.58rem;letter-spacing:.6px}
  .roster-grid{grid-template-columns:repeat(2,1fr)}
  .nav-links .home-link{padding:7px 11px;font-size:.8rem}
}
`;
const STAT_TILES = [['PTS','PTS'],['REB','REB'],['AST','AST'],['STL','STL'],['BLK','BLK'],['FG%','FG%'],['3P%','3P%'],['FT%','FT%'],['MIN','MIN']];
function statGrid(s){
  return `<div class="stat-grid">${STAT_TILES.map(([k, label], i) => `<div${i < 3 ? ' class="main"' : ''}><b>${esc(s.v[k] != null ? s.v[k] : '-')}</b><span>${label}</span></div>`).join('')}<div><b>${esc(s.v.GP || '0')}</b><span>Games</span></div></div>`;
}
const expText = y => y == null ? '' : y === 0 ? 'Rookie' : y + (y === 1 ? ' year' : ' years');
const posFull = p => p.posName || ({ G:'Guard', F:'Forward', C:'Center' })[p.pos] || p.pos;
function playerHtml(p, about, season){
  const url = SITE + '/player/' + p.slug + '/';
  const title = p.name + ' Stats, Bio and News - Boston Celtics | Tatum Time';
  const s = p.stats;
  const line = s ? `${s.v.PTS} points, ${s.v.REB} rebounds and ${s.v.AST} assists per game in ${s.season}` : '';
  const desc = `${p.name}${p.jersey ? ' (#' + p.jersey + ')' : ''}, Boston Celtics ${posFull(p).toLowerCase()}${line ? ': ' + line : ''}. Bio, season stats and every Tatum Time post about ${p.name}.`;
  const bio = [['Age', p.age], ['Height', p.height], ['Weight', p.weight], ['College', p.college], ['Experience', expText(p.exp)], ['Born', p.born]].filter(x => x[1] !== '' && x[1] != null);
  const careerLine = c => c && c.GP ? `<p class="career"><b>Career:</b> ${esc(c.PTS)} PPG, ${esc(c.REB)} RPG, ${esc(c.AST)} APG, ${esc(c['FG%'])} FG% in ${esc(c.GP)} games.</p>` : '';
  let stats;
  if (s) stats = `<div class="sec-h"><h2>${esc(s.season)} season averages</h2><small>Regular season</small></div>${statGrid(s)}${careerLine(s.career) || '<p class="career"></p>'}`;
  else if (p.last) stats = `<div class="empty">No ${esc(season || 'regular-season')} games for ${esc(p.name)} yet. Last season's numbers below.</div><div class="sec-h"><h2>${esc(p.last.season)} season averages</h2><small>Regular season</small></div>${statGrid(p.last)}${careerLine(p.last.career)}`;
  else stats = `<div class="empty">No NBA regular-season games for ${esc(p.name)} yet${season ? ' in ' + esc(season) : ''}. Check back once he gets on the floor.</div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="max-image-preview:large" />
${headCommon()}
<link rel="canonical" href="${url}" />
<meta property="og:type" content="profile" />
<meta property="og:locale" content="en_US" />
<meta property="og:site_name" content="Tatum Time" />
<meta property="og:title" content="${esc(p.name + ' - Boston Celtics')}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${esc(p.headshot || DEFAULT_OG)}" />
<meta property="profile:first_name" content="${esc(p.first)}" />
<meta property="profile:last_name" content="${esc(p.lastName)}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${esc(p.name + ' - Boston Celtics')}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${esc(p.headshot || DEFAULT_OG)}" />
${ld({
  '@context':'https://schema.org','@type':'ProfilePage', url, name:title, inLanguage:'en-US', publisher:PUBLISHER,
  mainEntity:{
    '@type':'Person', name:p.name, url, image:p.headshot || undefined, jobTitle:'Professional basketball player',
    birthDate:p.dob || undefined, height:p.height || undefined, weight:p.weight || undefined,
    alumniOf:p.college ? { '@type':'CollegeOrUniversity', name:p.college } : undefined,
    memberOf:TEAM, sameAs:[p.espn]
  }
})}
${ld({
  '@context':'https://schema.org','@type':'BreadcrumbList',
  itemListElement:[
    {'@type':'ListItem',position:1,name:'Tatum Time',item:SITE+'/'},
    {'@type':'ListItem',position:2,name:'Roster',item:SITE+'/player/'},
    {'@type':'ListItem',position:3,name:p.name,item:url}
  ]
})}
${headFonts()}
</head>
<body>
${headerHtml()}
<main><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Tatum Time</a> › <a href="/player/">Roster</a> › ${esc(p.name)}</nav>
  <section class="pl-hero">
    ${p.jersey ? `<div class="pl-num" aria-hidden="true">${esc(p.jersey)}</div>` : ''}
    ${p.headshot ? `<div class="pl-shot"><img src="${esc(p.headshot)}" alt="${esc(p.name)}" width="350" height="254" fetchpriority="high" /></div>` : '<div class="pl-shot none">☘️</div>'}
    <div class="pl-id">
      <div class="cat">Boston Celtics${season ? ' · ' + esc(season) : ''}</div>
      <h1>${esc(p.name)}</h1>
      <div class="pl-tag">${p.jersey ? `<span>#${esc(p.jersey)}</span>` : ''}${posFull(p) ? `<span>${esc(posFull(p))}</span>` : ''}${p.injured ? `<span class="inj">${esc(p.injured)}</span>` : ''}</div>
    </div>
  </section>
  <dl class="pl-bio">${bio.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  ${stats}
  <div class="sec-h"><h2>Tatum Time posts about ${esc(p.name)}</h2><small>${about.length} post${about.length === 1 ? '' : 's'}</small></div>
  ${about.length ? `<div class="cat-grid">\n    ${about.map(postCard).join('\n    ')}\n  </div>` : `<div class="empty">Dan hasn't written about ${esc(p.name)} yet. <a href="/#posts" style="color:var(--green-glow);font-weight:700">Read the latest posts →</a></div>`}
  <div class="sec-h"><h2>More on ${esc(p.name)}</h2></div>
  <div class="ext"><a href="${esc(p.espn)}" target="_blank" rel="noopener">ESPN profile ↗</a>${p.gamelog ? `<a href="${esc(p.gamelog)}" target="_blank" rel="noopener">Game log ↗</a>` : ''}<a href="https://www.nba.com/search?q=${encodeURIComponent(p.name)}" target="_blank" rel="noopener">NBA.com ↗</a><a href="/player/">Full Celtics roster</a></div>
  <p class="src-note">Bio, photo and stats from ESPN, updated ${esc(TT.fmtDisplayDate(TT.todayET()))}.</p>
</div></main>
${footerHtml()}
<script src="/js/visits.js?v=dev" defer></script>
</body>
</html>
`;
}
function rosterHtml(players, season){
  const url = SITE + '/player/';
  const title = 'Boston Celtics Roster' + (season ? ' ' + season : '') + ': Player Stats and Bios | Tatum Time';
  const desc = 'The ' + (season ? season + ' ' : '') + 'Boston Celtics roster: every player\'s season stats, bio and Tatum Time coverage.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="max-image-preview:large" />
${headCommon()}
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Tatum Time" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${DEFAULT_OG}" />
<meta name="twitter:card" content="summary_large_image" />
${ld({
  '@context':'https://schema.org','@type':'CollectionPage', name:'Boston Celtics Roster', description:desc, url, inLanguage:'en-US', publisher:PUBLISHER,
  about:TEAM,
  mainEntity:{'@type':'ItemList',itemListElement:players.map((p,i)=>({'@type':'ListItem',position:i+1,url:SITE+'/player/'+p.slug+'/',name:p.name}))}
})}
${ld({
  '@context':'https://schema.org','@type':'BreadcrumbList',
  itemListElement:[
    {'@type':'ListItem',position:1,name:'Tatum Time',item:SITE+'/'},
    {'@type':'ListItem',position:2,name:'Roster',item:url}
  ]
})}
${headFonts()}
</head>
<body>
${headerHtml()}
<main><div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Tatum Time</a> › Roster</nav>
  <div class="cat">Tatum Time · ${players.length} players</div>
  <h1>Boston Celtics Roster${season ? ' ' + esc(season) : ''}</h1>
  <p class="cat-blurb">Season stats, bios and every Tatum Time post for each Celtic.</p>
  <div class="roster-grid">
    ${players.map(p => `<a class="ros-card" href="/player/${p.slug}/">${p.jersey ? `<span class="ros-num">#${esc(p.jersey)}</span>` : ''}<span class="ros-shot">${p.headshot ? `<img src="${esc(p.headshot)}" alt="" loading="lazy" decoding="async" width="350" height="254" />` : ''}</span><span class="ros-body"><b>${esc(p.name)}</b><small>${esc(posFull(p))}${p.stats ? ' · ' + esc(p.stats.v.PTS) + ' PPG' : ''}</small></span></a>`).join('\n    ')}
  </div>
</div></main>
${footerHtml()}
<script src="/js/visits.js?v=dev" defer></script>
</body>
</html>
`;
}

/* ---------- generate ---------- */
async function run(){
  const allPosts = JSON.parse(fs.readFileSync('content/posts.json','utf8')).posts || [];   // missing/broken = build fails
  // posts.json holds only published posts; the filter is belt and braces
  const posts = allPosts.filter(p => p.slug && TT.isPublished(p.date)).map(normalize);
  if (!posts.length) throw new Error('no publishable posts in content/posts.json');
  const todayISO = TT.todayET();

  // categories in the order they first appear (newest posts first)
  CATS = [...new Set(posts.map(p => p.cat))];

  const players = await loadPlayers();
  PLAYERS = players || [];
  if (players) {
    mentionRes(players);
    posts.forEach(p => { p.body = linkPlayers(p.body, players); });
  }

  // fresh slate so renamed/deleted posts and departed players don't leave stale pages behind
  ['post', 'category', 'player'].forEach(d => fs.rmSync(d, { recursive: true, force: true }));
  posts.forEach(p => {
    // internal links: 3 related posts (same category first, then newest)
    const pool = posts.filter(x => x !== p);
    const related = pool.filter(x => x.cat === p.cat).concat(pool.filter(x => x.cat !== p.cat)).slice(0, 3);
    writePage(path.join('post', p.slug, 'index.html'), pageHtml(p, related));
  });

  /* ---------- category pages ---------- */
  const lastmodOf = p => isoOf(p.date) || todayISO;
  CATS.forEach(c => writePage(path.join('category', catSlug(c), 'index.html'), categoryHtml(c, posts.filter(p => p.cat === c))));

  /* ---------- player pages + content/players.json (homepage roster links) ---------- */
  if (players) {
    players.forEach(p => writePage(path.join('player', p.slug, 'index.html'), playerHtml(p, posts.filter(x => mentions(p, x)), players.season)));
    writePage(path.join('player', 'index.html'), rosterHtml(players, players.season));
  }
  fs.writeFileSync(path.join('content', 'players.json'), JSON.stringify(PLAYERS.map(p => ({ id: p.id, name: p.name, slug: p.slug, url: '/player/' + p.slug + '/', jersey: p.jersey, position: p.pos })), null, 1));

  /* ---------- homepage: write the post list + featured post into index.html ----------
     The repo copy has empty <!--build:...--> slots; filling them on deploy gives
     Google real links to every post without waiting for JavaScript. The live
     script rebuilds the same list on load, so visitors see no difference.
     Idempotent: slots are replaced, never appended to. */
  const grad = ['#0a8f3c','#066b2c','#0e7a3a','#0b5e28','#117a44','#0a6e30'];
  const fill = (html, name, inner) => html.replace(new RegExp('(<!--build:' + name + '-->)[\\s\\S]*?(<!--/build:' + name + '-->)'), (m, a, b) => a + inner + b);
  let home = fs.readFileSync('index.html', 'utf8');
  const list = posts.map((p, i) =>
    `<a class="post-item" href="/post/${p.slug}/"><span class="pi-emoji" style="background:linear-gradient(135deg, ${grad[i % grad.length]}, #04331a);">${esc(p.emoji)}</span>` +
    `<span class="pi-text"><b>${esc(p.title)}</b><small>${esc(TT.fmtDisplayDate(p.date))} · ${esc(p.cat)}</small></span></a>`).join('');
  const f = posts.find(p => p.featured) || posts[0];
  const featImg = !f.hero ? '' : (() => { const v = TT.imgVariant(f.hero, 1200); return `<img id="feat-thumb" class="feat-thumb" alt="${esc(f.title)}" src="${esc(v)}"${v !== f.hero ? ` data-orig="${esc(f.hero)}" onerror="this.onerror=null;this.src=this.dataset.orig"` : ''} fetchpriority="high">`; })();
  home = fill(home, 'posts', list);
  home = fill(home, 'feat-img', featImg);
  home = fill(home, 'feat-title', esc(f.title));
  home = fill(home, 'feat-ex', esc(f.excerpt));
  home = fill(home, 'feat-meta', esc(TT.fmtDisplayDate(f.date) + ' · ' + f.cat));
  home = fill(home, 'cats', catLinks());
  home = home.replace(/(<a class="btn btn-primary" id="featLink" href=")[^"]*(")/, '$1/post/' + f.slug + '/$2');
  writePage('index.html', home);

  /* ---------- sitemap.xml ---------- */
  const urls = [{ loc: SITE + '/', lastmod: todayISO }]
    .concat(CATS.map(c => ({ loc: SITE + '/category/' + catSlug(c) + '/', lastmod: lastmodOf(posts.find(p => p.cat === c)) })))
    .concat(posts.map(p => ({ loc: SITE + '/post/' + p.slug + '/', lastmod: lastmodOf(p) })))
    .concat(players ? [{ loc: SITE + '/player/', lastmod: todayISO }].concat(players.map(p => ({ loc: SITE + '/player/' + p.slug + '/', lastmod: todayISO }))) : []);
  fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`);

  console.log('build-pages: wrote ' + posts.length + ' post pages, ' + CATS.length + ' category pages, ' + (players ? players.length + 1 : 0) + ' player pages, homepage list + sitemap.xml (' + urls.length + ' URLs)');
  Object.keys(hashes).forEach(u => hashes[u] && console.log('build-pages: ' + u + '?v=' + hashes[u]));
}

module.exports = run();
if (require.main === module) module.exports.catch(e => { console.error('build-pages FAILED: ' + (e && e.stack || e)); process.exitCode = 1; });
