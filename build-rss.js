/* Regenerates feed.xml from content/posts.json, then runs the rest of the build.
   Cloudflare Pages build command:  node build-posts.js && node build-rss.js
   posts.json already holds only published posts, with each post's permanent
   slug and a clean text excerpt (see build-posts.js). No npm packages needed. */
const fs = require('fs');
const TT = require('./js/shared.js');

const SITE = 'https://tatumtime.net';   // live domain
const xml = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function pubDate(dateStr, i){
  let d = new Date(dateStr);
  if (isNaN(d)) d = new Date('2026-01-01T12:00:00Z');
  d = new Date(d.getTime() - i*60000 + 12*3600000); // noon, newest-first ordering
  const p = n => String(n).padStart(2,'0');
  return `${DAY[d.getUTCDay()]}, ${p(d.getUTCDate())} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00 +0000`;
}

function writeFeed() {
  const posts = (JSON.parse(fs.readFileSync('content/posts.json', 'utf8')).posts || []).filter(p => TT.isPublished(p.date));
  const items = posts.map((p,i) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${SITE}/post/${p.slug}/</link>
      <guid isPermaLink="false">${xml(p.slug)}</guid>
      <pubDate>${pubDate(p.date, i)}</pubDate>
      <category>${xml(p.category)}</category>
      <description>${xml(p.excerpt)}</description>
    </item>`).join('\n');

  fs.writeFileSync('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tatum Time - A Celtics Blog For Serious Fans</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Boston Celtics analysis, recaps and deep dives by Dan MacLean.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`);
  console.log(`feed.xml regenerated with ${posts.length} posts`);
}

// Then, in order: link-preview cards (build-og.js), the post/category/player pages
// + sitemap (which point at those cards), and photo shrinking. Run from here so the
// existing Cloudflare build command picks them up without dashboard changes.
// build-og and build-images are best-effort (logged, site still deploys);
// a build-pages failure FAILS the deploy - the live site keeps its last good version.
const optional = (file, label) => () => Promise.resolve().then(() => require(file))
  .catch(e => console.error(label + ' failed (site still deploys): ' + (e && e.stack || e)));
const required = (file, label) => () => Promise.resolve().then(() => require(file))
  .catch(e => { console.error(label + ' FAILED - deploy stopped: ' + (e && e.stack || e)); throw { logged: true }; });

Promise.resolve()
  .then(writeFeed)
  .then(optional('./build-og.js', 'build-og'))
  .then(required('./build-pages.js', 'build-pages'))
  .then(optional('./build-images.js', 'build-images'))
  .then(() => console.log('build: done'), e => { process.exitCode = 1; if (!(e && e.logged)) console.error('build FAILED: ' + (e && e.stack || e)); });
