/* Shrinks the photos Dan uploads through the CMS, automatically, at deploy time.
   Phone photos arrive at 3-5 MB; the site only needs ~1600px wide. This re-encodes
   any big upload IN PLACE (same filename, same format - so the links inside posts
   never change) before Cloudflare publishes the files. The repo keeps Dan's
   originals; only the deployed copies are shrunk.

   Rules:
   - only touches images/uploads (jpg / jpeg / png / webp)
   - skips files already under 250 KB
   - resizes anything wider than 1600px, re-encodes at quality 80
   - respects EXIF rotation (phone photos stay right-side up)
   - keeps the original if compression doesn't save at least 10%
   - best-effort: if sharp isn't installed or anything fails, it logs and the
     site still deploys.
   Also writes small WebP copies the site prefers (pages fall back to the original
   if one is missing), named by TT.imgVariant() in js/shared.js:
     images/uploads/_v/<name>-<ext>-<96|480|1200>.webp  - only for photos a
       published post actually uses (its hero or a photo in the article)
     _v/dan-jpg-96.webp, _v/dan-jpg-192.webp           - Dan's avatar (/dan.jpg)
   Photos in formats browsers or sharp can't handle well (heic, jxl, gif, bmp,
   tiff) are logged as WARNINGs naming the post. Deployed copies only.          */
const fs = require('fs');
const path = require('path');
const TT = require('./js/shared.js');

const DIR = path.join('images', 'uploads');
const MIN_BYTES = 250 * 1024;   // leave small files alone
const MAX_WIDTH = 1600;
const QUALITY = 80;
const ROOT_IMAGES = { 'dan.jpg': [96, 192] };   // must match ROOT_VARIANTS in js/shared.js

/* every local photo a published post uses -> the posts using it */
function referencedImages() {
  const refs = new Map();
  let posts = [];
  try { posts = JSON.parse(fs.readFileSync(path.join('content', 'posts.json'), 'utf8')).posts || []; }
  catch (e) { console.log('build-images: no posts.json - no WebP copies.'); return refs; }
  posts.forEach(p => {
    const srcs = [p.hero];
    String(p.html || '').replace(/<img[^>]*\bsrc="([^"]+)"/gi, (m, s) => srcs.push(s));
    srcs.forEach(s => {
      s = String(s || '').trim().replace(/&amp;/g, '&');
      if (!s || /^(https?:)?\/\//i.test(s) || /^data:/i.test(s)) return;
      if (!refs.has(s)) refs.set(s, new Set());
      refs.get(s).add(p.title);
    });
  });
  return refs;
}
const localPath = src => { let f = String(src).replace(/^\//, '').replace(/[?#].*$/, ''); try { f = decodeURIComponent(f); } catch (e) {} return f; };

async function run() {
  let sharp;
  try { sharp = require('sharp'); }
  catch (e) { console.log('build-images: sharp not installed - skipping photo compression.'); return; }

  let files = [];
  try { files = fs.readdirSync(DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f)); }
  catch (e) { console.log('build-images: no uploads folder.'); }

  let done = 0, saved = 0;
  for (const f of files) {
    const p = path.join(DIR, f);
    try {
      const before = fs.statSync(p).size;
      if (before < MIN_BYTES) continue;

      // Read into memory and hand sharp the buffer - if sharp opened the path
      // itself, libvips would still hold the file and Windows would refuse the
      // in-place overwrite below.
      const input = fs.readFileSync(p);
      let img = sharp(input).rotate();   // .rotate() bakes in EXIF orientation
      const meta = await img.metadata();
      if (meta.width > MAX_WIDTH) img = img.resize({ width: MAX_WIDTH });

      const ext = f.toLowerCase().split('.').pop();
      let buf;
      if (ext === 'png') buf = await img.png({ compressionLevel: 9 }).toBuffer();
      else if (ext === 'webp') buf = await img.webp({ quality: QUALITY }).toBuffer();
      else buf = await img.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();

      if (buf.length < before * 0.9) {   // only keep a real win
        fs.writeFileSync(p, buf);
        done++; saved += before - buf.length;
        console.log('build-images: ' + f + '  ' + Math.round(before / 1024) + 'KB -> ' + Math.round(buf.length / 1024) + 'KB');
      }
    } catch (e) {
      console.log('build-images: skipped ' + f + ' (' + e.message + ')');
    }
  }
  console.log('build-images: compressed ' + done + ' of ' + files.length + ' photos, saved ' + (saved / 1048576).toFixed(1) + ' MB');

  // WebP copies (from the already-shrunk files). Fresh slate each build.
  fs.rmSync(path.join(DIR, '_v'), { recursive: true, force: true });
  fs.rmSync('_v', { recursive: true, force: true });
  const jobs = [];   // [source file, [[width, out file, quality]]]
  for (const [src, titles] of referencedImages()) {
    const who = [...titles].map(t => '"' + t + '"').join(', ');
    const file = localPath(src);
    if (/\.(heic|heif|jxl|gif|bmp|tiff?)$/i.test(file)) { console.log('build-images: WARNING - ' + src + ' (used by ' + who + ') is a ' + file.split('.').pop().toUpperCase() + ' - no small WebP copies are made for it' + (/\.(heic|heif|jxl|tiff?)$/i.test(file) ? ' and most browsers cannot show it' : '') + '. Re-upload it as JPG/PNG/WebP.'); continue; }
    if (TT.imgVariant(src, TT.VARIANT_WIDTHS[0]) === src) continue;   // not an upload we make copies for
    if (!fs.existsSync(file)) { console.log('build-images: WARNING - ' + src + ' (used by ' + who + ') is missing from the repo.'); continue; }
    jobs.push([file, TT.VARIANT_WIDTHS.map(w => [w, localPath(TT.imgVariant(src, w)), w <= 192 ? 72 : 74])]);
  }
  Object.keys(ROOT_IMAGES).forEach(f => {
    if (fs.existsSync(f)) jobs.push([f, ROOT_IMAGES[f].map(w => [w, localPath(TT.imgVariant('/' + f, w)), 72])]);
  });

  let made = 0;
  for (const [file, outs] of jobs) {
    try {
      const input = fs.readFileSync(file);
      for (const [w, out, q] of outs) {
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: q }).toBuffer());
        made++;
      }
    } catch (e) {
      console.log('build-images: no WebP for ' + file + ' (' + e.message + ')');
    }
  }
  console.log('build-images: wrote ' + made + ' WebP copies for ' + jobs.length + ' photos');
}

module.exports = run().catch(e => console.log('build-images: stopped early (' + e.message + ') - pages fall back to the original photos.'));
