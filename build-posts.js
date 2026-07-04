/* Combines content/posts/*.md (one file per post) into content/posts.json,
   which the website loads. Runs on every Cloudflare Pages build BEFORE build-rss.js.
   Build command:  node build-posts.js && node build-rss.js
   No npm packages needed. */
const fs = require('fs');
const path = require('path');

const DIR = path.join('content', 'posts');
const OUT = path.join('content', 'posts.json');

function parseFile(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fields = {};
  m[1].split(/\r?\n/).forEach(function (line) {
    const i = line.indexOf(':');
    if (i < 0) return;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (!key) return;
    if (val === 'true') { fields[key] = true; return; }
    if (val === 'false') { fields[key] = false; return; }
    if (val.length >= 2 && val[0] === '"' && val[val.length - 1] === '"') {
      val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    } else if (val.length >= 2 && val[0] === "'" && val[val.length - 1] === "'") {
      val = val.slice(1, -1).replace(/''/g, "'");
    }
    fields[key] = val;
  });
  fields.body = (m[2] || '').replace(/\s+$/, '');
  return fields;
}

let posts = [];
try {
  const files = fs.readdirSync(DIR).filter(function (f) { return /\.md$/i.test(f); });
  files.forEach(function (f) {
    const fm = parseFile(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if (fm && fm.title) {
      posts.push({
        title: fm.title || '',
        emoji: fm.emoji || '\u{1F3C0}',
        category: fm.category || 'Recap',
        featured: fm.featured === true,
        date: fm.date || '',
        gameLink: fm.gameLink || '',
        body: fm.body || ''
      });
    }
  });
} catch (e) {
  console.error('build-posts: content/posts folder not found — leaving posts.json unchanged.');
  process.exit(0);
}

// SAFETY: never wipe the site if no posts were found.
if (posts.length === 0) {
  console.error('build-posts: no post files found — leaving posts.json unchanged.');
  process.exit(0);
}

// newest first (matches the site's own sort)
posts.sort(function (a, b) {
  const ta = new Date(a.date).getTime() || 0, tb = new Date(b.date).getTime() || 0;
  return tb - ta;
});

fs.writeFileSync(OUT, JSON.stringify({ posts: posts }, null, 2));
console.log('build-posts: wrote ' + posts.length + ' posts to ' + OUT);
