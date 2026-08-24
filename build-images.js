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
   - if sharp isn't installed (e.g. a local run without npm install), it just
     logs and moves on - the build never breaks because of this step.        */
const fs = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); }
catch (e) { console.log('build-images: sharp not installed - skipping photo compression.'); process.exit(0); }

const DIR = path.join('images', 'uploads');
const MIN_BYTES = 250 * 1024;   // leave small files alone
const MAX_WIDTH = 1600;
const QUALITY = 80;

async function run() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f)); }
  catch (e) { console.log('build-images: no uploads folder - nothing to do.'); return; }

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
}

module.exports = run();
