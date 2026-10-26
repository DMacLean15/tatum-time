/* Combines content/posts/*.md (one file per post) into content/posts.json,
   which the website loads. Runs on every Cloudflare Pages build BEFORE build-rss.js.
   Build command:  node build-posts.js && node build-rss.js
   No npm packages needed. */
const fs = require('fs');
const path = require('path');

const DIR = path.join('content', 'posts');
const OUT = path.join('content', 'posts.json');

/* marked.min.js is a UMD build - in Node it fills module.exports. Posts are
   converted to HTML here, once, so visitors' browsers never download or run the
   Markdown parser (the site falls back to it only if `html` is missing). */
let parseMd = null;
try {
  const markedLib = require('./js/marked.min.js');
  parseMd = (markedLib.marked && markedLib.marked.parse) ? s => markedLib.marked.parse(s)
          : markedLib.parse ? s => markedLib.parse(s) : null;
} catch (e) { console.error('build-posts: marked not found - posts will be parsed in the browser.'); }

function unquote(val) {
  if (val.length >= 2 && val[0] === '"' && val[val.length - 1] === '"') {
    return val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (val.length >= 2 && val[0] === "'" && val[val.length - 1] === "'") {
    return val.slice(1, -1).replace(/''/g, "'");
  }
  return val;
}

function parseFile(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  // Collect "key: value" pairs. The CMS wraps long values (titles!) onto indented
  // continuation lines - YAML folds those back into one line with a space, and so
  // do we. Block scalars (key: >- / key: |) are joined the same way.
  const raws = {}, order = [];
  let last = null;
  m[1].split(/\r?\n/).forEach(function (line) {
    if (last && /^\s+\S/.test(line)) { raws[last].push(line.trim()); return; }
    const i = line.indexOf(':');
    if (i < 0) return;
    const key = line.slice(0, i).trim();
    if (!key) return;
    raws[key] = [line.slice(i + 1).trim()]; order.push(key); last = key;
  });
  const fields = {};
  order.forEach(function (key) {
    const parts = raws[key];
    let val;
    if (/^[>|][+-]?$/.test(parts[0])) {
      val = parts.slice(1).join(parts[0][0] === '|' ? '\n' : ' ');
    } else {
      val = unquote(parts.join(' ').trim());
    }
    if (val === 'true') { fields[key] = true; return; }
    if (val === 'false') { fields[key] = false; return; }
    fields[key] = typeof val === 'string' ? val.trim() : val;
  });
  fields.body = (m[2] || '').replace(/\s+$/, '');
  return fields;
}

function readMins(html) {
  const words = String(html).replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
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
        image: fm.image || '',
        imageFocus: fm.imageFocus || 'Center',
        gameLink: fm.gameLink || '',
        body: fm.body || ''
      });
      if (parseMd) {
        const last = posts[posts.length - 1];
        try { last.html = parseMd(last.body); last.readMins = readMins(last.html); }
        catch (e) { console.error('build-posts: could not pre-render ' + f + ' (' + e.message + ')'); }
      }
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
