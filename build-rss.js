/* Regenerates feed.xml from content/posts.json.
   Cloudflare Pages runs this on every deploy (including when Dan publishes a post)
   because the build command is set to:  node build-rss.js
   No npm packages needed. */
const fs = require('fs');

const SITE = 'https://tatumtime.net';   // live domain
const allPosts = JSON.parse(fs.readFileSync('content/posts.json', 'utf8')).posts || [];
// Keep scheduled (future-dated) posts out of the feed until their day.
const todayISO = new Date().toISOString().slice(0, 10);
const posts = allPosts.filter(function (p) {
  const pd = String(p.date || '').slice(0, 10);
  return !/^\d{4}-\d{2}-\d{2}$/.test(pd) || pd <= todayISO;
});

const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const slugify = s => (String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'post');
const stripMd = b => String(b||'').replace(/==([^=]+)==/g,'$1').replace(/[#*`>]/g,'').replace(/\n/g,' ').replace(/\s+/g,' ').trim();
const excerpt = b => { const t = stripMd(b); return t.length > 220 ? t.slice(0,220)+'…' : t; };

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function pubDate(dateStr, i){
  let d = new Date(dateStr);
  if (isNaN(d)) d = new Date('2026-01-01T12:00:00Z');
  d = new Date(d.getTime() - i*60000 + 12*3600000); // noon, newest-first ordering
  const p = n => String(n).padStart(2,'0');
  return `${DAY[d.getUTCDay()]}, ${p(d.getUTCDate())} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00 +0000`;
}

const items = posts.map((p,i) => {
  const slug = slugify(p.title);
  return `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}/#/post/${slug}</link>
      <guid isPermaLink="false">${slug}</guid>
      <pubDate>${pubDate(p.date, i)}</pubDate>
      <category>${esc(p.category)}</category>
      <description><![CDATA[${excerpt(p.body)}]]></description>
    </item>`;
}).join('\n');

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tatum Time — A Celtics Blog For Serious Fans</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Boston Celtics analysis, recaps and deep dives by Dan MacLean.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`;

fs.writeFileSync('feed.xml', feed);
console.log(`feed.xml regenerated with ${posts.length} posts`);
