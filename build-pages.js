/* Generates a real web page for every post - post/<slug>/index.html - plus sitemap.xml.
   WHY: the homepage is one page, so before this, sharing a post on social media or
   texting a link showed the generic site preview. Each generated page carries the
   post's own title, description and photo, so link previews (and Google) see the
   actual article. The page shows the full post and links back to the main site
   for comments and reactions.

   Runs on every Cloudflare Pages deploy - build-rss.js requires this file at the
   end, so the existing build command picks it up with no dashboard changes.
   Uses the same self-hosted js/marked.min.js the site itself uses. No npm packages. */
const fs = require('fs');
const path = require('path');

const SITE = 'https://tatumtime.net';
const DEFAULT_OG = SITE + '/og.jpg';

/* marked.min.js is a UMD build - in Node it fills module.exports */
const markedLib = require('./js/marked.min.js');
const parseMd = (markedLib.marked && markedLib.marked.parse) ? s => markedLib.marked.parse(s)
              : markedLib.parse ? s => markedLib.parse(s)
              : s => s;

const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const slugify = s => (String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'post');

/* ---- the same body transforms the live site applies (see index.html) ---- */
const pill = html => html.replace(/==([^=]+)==/g, '<span class="stat-pill">$1</span>');
function youtubeId(url){ const m=(url||'').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/); return m?m[1]:null; }
function ytEmbed(id){ return `<div class="yt-embed"><iframe src="https://www.youtube.com/embed/${id}" title="YouTube video player" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`; }
function embedYouTube(html){
  html = html.replace(/<a[^>]*href="([^"]*(?:youtube\.com|youtu\.be)[^"]*)"[^>]*>.*?<\/a>/gi, (full, href) => { const id=youtubeId(href.replace(/&amp;/g,'&')); return id?ytEmbed(id):full; });
  html = html.replace(/(^|[\s>])((?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[A-Za-z0-9_\-?=&;%.]+)/gi, (full, pre, url) => { const id=youtubeId(url.replace(/&amp;/g,'&')); return id?pre+ytEmbed(id):full; });
  html = html.replace(/<p>\s*(<div class="yt-embed">[\s\S]*?<\/div>)\s*<\/p>/gi, '$1');
  return html;
}
function captionImages(html){
  return html.replace(/<p>\s*(<img[^>]*>)\s*<\/p>/gi, function(_, img){
    const am = img.match(/\balt="([^"]*)"/i);
    let cap = am ? am[1].trim() : '';
    if (cap && /\.(jpe?g|png|gif|webp|avif)$/i.test(cap)) cap = '';
    return cap ? '<figure>'+img+'<figcaption>'+cap+'</figcaption></figure>' : '<figure>'+img+'</figure>';
  });
}
function absUrl(u){
  u = String(u||'').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return SITE + (u[0] === '/' ? '' : '/') + u;
}
function stripText(html){
  return html.replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/gi,' ').replace(/\s+/g,' ').trim();
}
function fmtDisplayDate(s){
  s = String(s||''); const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = iso ? new Date(+iso[1], +iso[2]-1, +iso[3]) : new Date(s);
  if (isNaN(d)) return s;
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return M[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function normalize(p){
  let body = parseMd(p.body || '');
  body = pill(body);
  body = embedYouTube(body);
  let hero = (p.image || '').trim();
  if (!hero) {
    const m = body.match(/<p>\s*<img[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/p>/i);
    if (m) { hero = m[1]; body = body.replace(m[0], ''); }
    else { const m2 = body.match(/<img[^>]*\bsrc="([^"]+)"[^>]*>/i); if (m2) hero = m2[1]; }
  }
  body = captionImages(body);
  body = body.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async" ');
  if (p.gameLink && p.gameLink.trim()) {
    body += `<a class="game-link" href="${esc(p.gameLink.trim())}" target="_blank" rel="noopener">📊 See full game stats here ↗</a>`;
  }
  const text = stripText(body);
  const readMins = Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200));
  const excerpt = text.length > 160 ? text.slice(0, 160).trim() + '…' : text;
  return {
    slug: slugify(p.title), title: p.title || '', cat: p.category || 'Post',
    date: p.date || '', emoji: p.emoji || '🏀', hero, body, excerpt, readMins
  };
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
.join{margin-top:36px;padding:22px;text-align:center;background:linear-gradient(140deg,rgba(22,196,91,.10),rgba(191,161,90,.05));border:1px solid rgba(22,196,91,.2);border-radius:16px}
.join p{color:var(--muted);font-size:.92rem;margin-bottom:12px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:999px;font-weight:700;font-size:.95rem;background:linear-gradient(145deg,var(--green-glow),var(--green));color:#062a14}
footer{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);font-size:.82rem;text-align:center}
`;

function pageHtml(p){
  const url = SITE + '/post/' + p.slug + '/';
  const og = p.hero ? absUrl(p.hero) : DEFAULT_OG;
  const isoDate = /^\d{4}-\d{2}-\d{2}/.test(String(p.date)) ? String(p.date).slice(0,10) : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(p.title)} - Tatum Time</title>
<meta name="description" content="${esc(p.excerpt)}" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23007a33'/><text x='50' y='75' font-size='62' text-anchor='middle'>%E2%98%98%EF%B8%8F</text></svg>" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Tatum Time" />
<meta property="og:title" content="${esc(p.title)}" />
<meta property="og:description" content="${esc(p.excerpt)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${esc(og)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(p.title)}" />
<meta name="twitter:description" content="${esc(p.excerpt)}" />
<meta name="twitter:image" content="${esc(og)}" />
<script type="application/ld+json">
${JSON.stringify({
  '@context':'https://schema.org','@type':'BlogPosting',
  headline:p.title, description:p.excerpt, url,
  image:og, datePublished:isoDate||undefined,
  author:{'@type':'Person',name:'Dan MacLean'},
  publisher:{'@type':'Organization',name:'Tatum Time',logo:{'@type':'ImageObject',url:DEFAULT_OG}},
  mainEntityOfPage:url
}, null, 0)}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
<link rel="alternate" type="application/rss+xml" title="Tatum Time - Celtics Blog" href="/feed.xml" />
<style>${CSS}</style>
</head>
<body>
<header><div class="wrap nav-inner">
  <a class="brand" href="/">☘️ Tatum<span>Time</span></a>
  <a class="home-link" href="/#posts">All posts →</a>
</div></header>
<main><div class="wrap">
  <div class="cat">${esc(p.cat)}</div>
  <h1>${p.emoji} ${esc(p.title)}</h1>
  <div class="meta"><b>Dan MacLean</b> · ${esc(fmtDisplayDate(p.date))} · ${p.readMins} min read</div>
  ${p.hero ? `<img class="hero-img" src="${esc(p.hero)}" alt="${esc(p.title)}" />` : ''}
  <div class="article">${p.body}</div>
  <div class="join">
    <p>Reactions and comments live on the main site - come join the conversation. ☘️</p>
    <a class="btn" href="/#/post/${p.slug}">Discuss on Tatum Time →</a>
  </div>
</div></main>
<footer><div class="wrap">© ${new Date().getFullYear()} Tatum Time · Not affiliated with the Boston Celtics or the NBA.</div></footer>
</body>
</html>
`;
}

/* ---------- generate ---------- */
let allPosts = [];
try {
  allPosts = JSON.parse(fs.readFileSync('content/posts.json','utf8')).posts || [];
} catch (e) {
  console.error('build-pages: content/posts.json not found - skipping page generation.');
  process.exit(0);
}

// scheduled (future-dated) posts don't get a public page until their day
const todayISO = new Date().toISOString().slice(0,10);
const posts = allPosts.filter(p => {
  const pd = String(p.date||'').slice(0,10);
  return !/^\d{4}-\d{2}-\d{2}$/.test(pd) || pd <= todayISO;
}).map(normalize);

if (!posts.length) {
  console.error('build-pages: no publishable posts - skipping.');
  process.exit(0);
}

// fresh slate so renamed/deleted posts don't leave stale pages behind
fs.rmSync('post', { recursive: true, force: true });
posts.forEach(p => {
  const dir = path.join('post', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(p));
});

/* ---------- sitemap.xml ---------- */
const urls = [{ loc: SITE + '/', lastmod: todayISO }]
  .concat(posts.map(p => ({
    loc: SITE + '/post/' + p.slug + '/',
    lastmod: /^\d{4}-\d{2}-\d{2}/.test(String(p.date)) ? String(p.date).slice(0,10) : todayISO
  })));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync('sitemap.xml', sitemap);

console.log('build-pages: wrote ' + posts.length + ' post pages + sitemap.xml');
