/* Combines content/posts/*.md (one file per post) into content/posts.json,
   which the website loads. Runs on every Cloudflare Pages build BEFORE build-rss.js.
   Build command:  node build-posts.js && node build-rss.js
   No npm packages needed.

   Each post in posts.json gets, besides its CMS fields:
     slug      permanent URL name: front matter `slug` if set, else the FILENAME
               (the CMS names the file from the headline when the post is created,
               so editing the headline later never breaks old links)
     html      the body rendered once here (any h1 becomes h2 - the page title is the h1)
     readMins, excerpt (clean text, 160 chars), hero (Featured Photo or first photo)
   Scheduled posts (dated after today, Boston time) are left OUT entirely - the
   publish-scheduled GitHub workflow triggers a rebuild on their day.
   FAILS THE BUILD (exit 1) if posts exist but none could be read, so a broken
   parser can never deploy an empty site. */
const fs = require('fs');
const path = require('path');
const TT = require('./js/shared.js');

const DIR = path.join('content', 'posts');
const OUT = path.join('content', 'posts.json');

function fail(msg) { console.error('build-posts: ERROR - ' + msg); process.exitCode = 1; }

/* marked.min.js is a UMD build - in Node it fills module.exports */
function loadMarked() {
  const lib = require('./js/marked.min.js');
  if (lib.marked && lib.marked.parse) return s => lib.marked.parse(s);
  if (lib.parse) return s => lib.parse(s);
  throw new Error('js/marked.min.js has no parse()');
}

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

/* Featured Photo, else the first photo in the article (a photo on its own line
   wins over one inside a paragraph) - the same rule the homepage uses */
function heroOf(image, html) {
  if (image && String(image).trim()) return String(image).trim();
  const m = html.match(/<p>\s*<img[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/p>/i) || html.match(/<img[^>]*\bsrc="([^"]+)"[^>]*>/i);
  return m ? m[1] : '';
}

const dateKey = d => { const iso = String(d || '').match(/^\d{4}-\d{2}-\d{2}/); if (iso) return iso[0]; const t = new Date(d); return isNaN(t) ? '' : t.toISOString().slice(0, 10); };

function run() {
  let files;
  try { files = fs.readdirSync(DIR).filter(f => /\.md$/i.test(f)).sort(); }
  catch (e) { return fail('content/posts folder not found (' + e.message + ')'); }

  let parseMd;
  try { parseMd = loadMarked(); }
  catch (e) { return fail('could not load js/marked.min.js (' + e.message + ')'); }

  const posts = [], scheduled = [], skipped = [];
  files.forEach(function (f) {
    let raw;
    try { raw = fs.readFileSync(path.join(DIR, f), 'utf8'); }
    catch (e) { skipped.push(f + ' (unreadable: ' + e.message + ')'); return; }
    if (raw.charCodeAt(0) === 0xFEFF) { raw = raw.slice(1); console.log('build-posts: note - stripped a byte-order mark from ' + f); }
    const fm = parseFile(raw);
    if (!fm) { skipped.push(f + ' (no front matter - the file must start with a --- block)'); return; }
    if (!fm.title) { skipped.push(f + ' (missing title)'); return; }
    if (!TT.isPublished(fm.date)) { scheduled.push(fm.date + '  ' + f); return; }
    let html;
    try { html = TT.shiftHeadings(parseMd(fm.body || '')); }
    catch (e) { skipped.push(f + ' (Markdown could not be rendered: ' + e.message + ')'); return; }
    posts.push({
      slug: fm.slug ? TT.slugify(fm.slug) : TT.slugify(f.replace(/\.md$/i, '')),
      title: fm.title,
      emoji: fm.emoji || '\u{1F3C0}',
      category: fm.category || 'Recap',
      featured: fm.featured === true,
      date: fm.date || '',
      image: fm.image || '',
      imageFocus: fm.imageFocus || 'Center',
      gameLink: fm.gameLink || '',
      hero: heroOf(fm.image, html),
      readMins: TT.readMins(html),
      excerpt: TT.excerpt(html, 160) || fm.title,
      file: f,
      body: fm.body || '',
      html: html
    });
  });

  skipped.forEach(s => console.error('build-posts: WARNING - skipped ' + s));
  scheduled.forEach(s => console.log('build-posts: scheduled (not live yet) ' + s));

  // SAFETY: posts exist but none parsed = something is broken. Fail the deploy
  // so the live site keeps its last good version.
  if (posts.length === 0) {
    if (files.length - scheduled.length > 0) return fail(files.length + ' post files found but none could be read - deploy stopped.');
    console.log('build-posts: no published posts yet.');
  }

  // Duplicate slugs: the oldest post keeps the plain URL, later ones get -2, -3...
  const seen = new Set();
  posts.slice().sort((a, b) => (dateKey(a.date) || '9').localeCompare(dateKey(b.date) || '9') || a.file.localeCompare(b.file)).forEach(function (p) {
    if (!seen.has(p.slug)) { seen.add(p.slug); return; }
    let n = 2; while (seen.has(p.slug + '-' + n)) n++;
    console.error('build-posts: WARNING !!! slug collision - ' + p.file + ' wanted /post/' + p.slug + '/ (already taken), using /post/' + p.slug + '-' + n + '/. Add a `slug:` line to its front matter to choose one.');
    p.slug += '-' + n; seen.add(p.slug);
  });

  // newest first (matches the site's own sort)
  posts.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));

  fs.writeFileSync(OUT, JSON.stringify({ posts: posts }, null, 2));
  console.log('build-posts: wrote ' + posts.length + ' posts to ' + OUT + ' (' + scheduled.length + ' scheduled, ' + skipped.length + ' skipped)');
}

// run when called as `node build-posts.js`; the publish-scheduled workflow requires it for parseFile()
if (require.main === module) run();
else module.exports = { parseFile };
