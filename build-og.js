/* Makes a 1200x630 link-preview card for every post at deploy time - the picture
   Facebook, Threads, X and iMessage show when a post link is shared. Each card is
   the post's photo with a dark fade, the category, the title in Anton, the date
   and the Tatum Time name. Written to og/<slug>.jpg (deployed copies only).

   build-pages.js points each post page's og:image at its card, and falls back to
   the post photo if a card is missing. Like build-images.js, this never breaks the
   build: without sharp (or if anything fails) it logs and moves on.
   Uses each post's slug + hero from posts.json (build-posts.js).
   Fonts: build-assets/*.ttf (SIL Open Font License, see build-assets/OFL-*.txt). */
const fs = require('fs');
const path = require('path');

const W = 1200, H = 630, PAD = 64;
const OUT = 'og';
const ANTON = path.join('build-assets', 'Anton-Regular.ttf');
const INTER = path.join('build-assets', 'Inter.ttf');

const TT = require('./js/shared.js');
const xml = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function gravity(focus) {
  switch (String(focus||'').toLowerCase()) {
    case 'top': return 'north'; case 'bottom': return 'south';
    case 'left': return 'west'; case 'right': return 'east';
    default: return 'centre';
  }
}

async function run() {
  let sharp;
  try { sharp = require('sharp'); }
  catch (e) { console.log('build-og: sharp not installed - skipping preview cards.'); return; }
  let posts = [];
  try { posts = JSON.parse(fs.readFileSync(path.join('content','posts.json'),'utf8')).posts || []; }
  catch (e) { console.log('build-og: no posts.json - nothing to do.'); return; }
  if (!fs.existsSync(ANTON)) { console.log('build-og: fonts missing - skipping.'); return; }
  // fresh slate so deleted/renamed posts don't leave stale cards behind
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const text = (markup, font, file, opts) => sharp({ text: Object.assign({ text: markup, font, fontfile: file, rgba: true }, opts) })
    .png().toBuffer({ resolveWithObject: true });

  // the parts every card shares
  const shade = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#08100c" stop-opacity=".35"/>
        <stop offset=".38" stop-color="#08100c" stop-opacity=".18"/>
        <stop offset=".72" stop-color="#08100c" stop-opacity=".82"/>
        <stop offset="1" stop-color="#08100c" stop-opacity=".97"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#v)"/>
    <rect y="${H-10}" width="${W}" height="10" fill="#16c45b"/>
  </svg>`);
  const plain = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="g" cx=".75" cy=".2" r="1"><stop offset="0" stop-color="#0a8f3c"/><stop offset=".55" stop-color="#04531f"/><stop offset="1" stop-color="#0c1410"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
  </svg>`);
  const brand = await text('<span foreground="#ffffff">TATUM </span><span foreground="#16c45b">TIME</span>', 'Anton 40', ANTON, {});

  let made = 0;
  for (const p of posts) {
    if (!p.title || !p.slug || !TT.isPublished(p.date)) continue;   // posts.json has no scheduled posts; belt and braces
    const slug = p.slug;
    try {
      // background: the post photo, cropped to 1200x630 around its focus point
      let bg = null;
      const hero = p.hero || '';
      let local = hero && /^\/?images\/uploads\//.test(hero) ? hero.replace(/^\//,'').replace(/[?#].*$/,'') : '';
      try { local = decodeURIComponent(local); } catch (e) {}
      if (local && fs.existsSync(local)) {
        try {
          bg = await sharp(fs.readFileSync(local)).rotate()
            .resize(W, H, { fit: 'cover', position: gravity(p.imageFocus) }).toBuffer();
        } catch (e) { bg = null; }   // unreadable format (e.g. .jxl) - plain green card instead
      }
      if (!bg) bg = await sharp(plain).png().toBuffer();

      // title: shorter titles get bigger type; the box auto-fits the font size
      const len = p.title.length;
      const tH = len <= 32 ? 170 : len <= 64 ? 220 : 250;
      const title = await text('<span foreground="#ffffff">' + xml(p.title.toUpperCase()) + '</span>', 'Anton', ANTON,
        { width: W - PAD*2, height: tH, wrap: 'word', align: 'left' });
      const cat = await text('<span foreground="#16c45b" letter_spacing="2600"><b>' + xml(String(p.category||'Post').toUpperCase()) + '</b></span>', 'Inter Bold 22', INTER, {});
      const meta = await text('<span foreground="#c9d6ce">Dan MacLean  ·  ' + xml(TT.fmtDisplayDate(p.date)) + '</span>', 'Inter 24', INTER, {});

      const metaTop = H - PAD - meta.info.height + 6;
      const titleTop = metaTop - 18 - title.info.height;
      const catTop = titleTop - 14 - cat.info.height;
      const buf = await sharp(bg)
        .composite([
          { input: shade, top: 0, left: 0 },
          { input: brand.data, top: PAD - 14, left: PAD },
          { input: cat.data, top: Math.max(0, catTop), left: PAD },
          { input: title.data, top: Math.max(0, titleTop), left: PAD },
          { input: meta.data, top: metaTop, left: PAD },
        ])
        .jpeg({ quality: 84, mozjpeg: true }).toBuffer();
      fs.writeFileSync(path.join(OUT, slug + '.jpg'), buf);
      made++;
    } catch (e) {
      console.log('build-og: no card for "' + p.title + '" (' + e.message + ')');
    }
  }
  console.log('build-og: wrote ' + made + ' preview cards to ' + OUT + '/');
}

module.exports = run().catch(e => console.log('build-og: stopped early (' + e.message + ') - pages fall back to the post photo.'));
