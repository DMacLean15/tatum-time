/* Tatum Time shared helpers - ONE copy used by the build scripts (Node:
   require('./js/shared.js')) and the browser (<script src="/js/shared.js"> ->
   window.TT). Keep it plain ES2017, no module syntax, no dependencies.
   Changing slugify() or imgVariant() changes live URLs - don't, unless every
   old URL is redirected. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  /* HTML-escape for text and attribute values */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /* post/category/player URL slugs. slice() runs AFTER the trim on purpose: a
     long title can end in '-' and live URLs already depend on that. */
  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'post';
  }

  /* 'Oct 24, 2026' from ISO (2026-10-24) or a legacy string (Oct 24, 2026) */
  function fmtDisplayDate(s) {
    s = String(s || ''); const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const d = iso ? new Date(+iso[1], +iso[2]-1, +iso[3]) : new Date(s);
    if (isNaN(d)) return s;
    return MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  /* today's date in Boston, 'YYYY-MM-DD' (the build server runs on UTC) */
  function todayET(now) {
    const parts = {};
    new Intl.DateTimeFormat('en-US', { timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' })
      .formatToParts(now || new Date()).forEach(function (x) { parts[x.type] = x.value; });
    return parts.year + '-' + parts.month + '-' + parts.day;
  }

  /* scheduled posts: a post dated after today (Boston time) is not live yet.
     No date / a legacy date string = always live. */
  function isPublished(dateStr, now) {
    const pd = String(dateStr || '').slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pd)) return true;
    return pd <= todayET(now);
  }

  /* WebP copies made at deploy by build-images.js:
     /images/uploads/<name>.<ext>  ->  /images/uploads/_v/<name>-<ext>-<w>.webp
     (ext lowercased as written, so photo.jpg and photo.png never collide).
     96 = avatars/tiny thumbs, 480 = cards and lists, 1200 = heroes and article photos.
     Root files: only /dan.jpg, at 96 and 192 -> /_v/dan-jpg-96.webp, /_v/dan-jpg-192.webp.
     Anything else comes back unchanged. Copies exist only for photos used by a
     published post, so always keep the original as an onerror fallback. */
  const VARIANT_WIDTHS = [96, 480, 1200];
  const ROOT_VARIANTS = { 'dan.jpg': [96, 192] };
  function imgVariant(src, w) {
    src = String(src == null ? '' : src);
    const m = src.match(/^\/?images\/uploads\/([^\/?#]+)\.(jpe?g|png|webp|avif)$/i);
    if (m) return VARIANT_WIDTHS.indexOf(+w) >= 0 ? '/images/uploads/_v/' + m[1] + '-' + m[2].toLowerCase() + '-' + w + '.webp' : src;
    const r = src.match(/^\/?([^\/?#]+)\.(jpe?g|png)$/i);
    if (r && ROOT_VARIANTS[(r[1] + '.' + r[2]).toLowerCase()] && ROOT_VARIANTS[(r[1] + '.' + r[2]).toLowerCase()].indexOf(+w) >= 0)
      return '/_v/' + r[1].toLowerCase() + '-' + r[2].toLowerCase() + '-' + w + '.webp';
    return src;
  }

  /* YouTube links (and bare YouTube URLs) in a post -> embedded player */
  function youtubeId(url) { const m = (url||'').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : null; }
  function ytEmbed(id) { return '<div class="yt-embed"><iframe src="https://www.youtube.com/embed/' + id + '" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>'; }
  function embedYouTube(html) {
    html = String(html || '');
    html = html.replace(/<a[^>]*href="([^"]*(?:youtube\.com|youtu\.be)[^"]*)"[^>]*>.*?<\/a>/gi, function (full, href) { const id = youtubeId(href.replace(/&amp;/g,'&')); return id ? ytEmbed(id) : full; });
    html = html.replace(/(^|[\s>])((?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[A-Za-z0-9_\-?=&;%.]+)/gi, function (full, pre, url) { const id = youtubeId(url.replace(/&amp;/g,'&')); return id ? pre + ytEmbed(id) : full; });
    return html.replace(/<p>\s*(<div class="yt-embed">[\s\S]*?<\/div>)\s*<\/p>/gi, '$1');
  }

  /* standalone photos -> <figure>, alt text as the caption (not auto-filled filenames) */
  function captionImages(html) {
    return String(html || '').replace(/<p>\s*(<img[^>]*>)\s*<\/p>/gi, function (_, img) {
      const am = img.match(/\balt="([^"]*)"/i);
      let cap = am ? am[1].trim() : '';
      if (cap && /\.(jpe?g|png|gif|webp|avif)$/i.test(cap)) cap = '';
      return cap ? '<figure>' + img + '<figcaption>' + cap + '</figcaption></figure>' : '<figure>' + img + '</figure>';
    });
  }

  /* plain text of rendered HTML: no tags, entities decoded, ==stat== markers unwrapped */
  const ENT = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', rsquo:"'", lsquo:"'", ldquo:'"', rdquo:'"', hellip:'...', mdash:'-', ndash:'-', middot:'·' };
  function plainText(html) {
    return String(html || '')
      .replace(/<(script|style|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/?(?:strong|em|b|i|u|s|a|mark|code|small|sup|sub|abbr)\b[^>]*>/gi, '')   // inline tags: no gap ("<b>Name</b>." -> "Name.")
      .replace(/<[^>]+>/g, ' ')
      .replace(/==([^=]+)==/g, '$1')
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (m, e) {
        if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1); try { return String.fromCodePoint(n); } catch (x) { return ' '; } }
        return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : ' ';
      })
      .replace(/\s+/g, ' ').trim();
  }

  /* minutes to read at ~200 words a minute (never 0) */
  function readMins(html) {
    return Math.max(1, Math.round(plainText(html).split(' ').filter(Boolean).length / 200));
  }

  /* first ~n characters as clean text, cut at a word boundary, '...' if cut.
     Prose only: paragraphs and list items (not score boxes, grade badges or
     headings), bare URLs dropped. Returns PLAIN text - escape it before use. */
  function excerpt(html, n) {
    n = n || 160;
    html = String(html || '');
    const prose = (html.match(/<(p|li)\b[^>]*>[\s\S]*?<\/\1>/gi) || []).join(' ');
    const clean = s => plainText(s).replace(/(?:https?:\/\/|www\.)\S+/gi, ' ').replace(/\s+/g, ' ').trim();
    const t = clean(prose) || clean(html);
    if (t.length <= n) return t;
    let cut = t.slice(0, n);
    const sp = cut.lastIndexOf(' ');
    if (t[n] !== ' ' && sp > n * 0.6) cut = cut.slice(0, sp);
    return cut.replace(/[\s,;:.\-]+$/, '') + '...';
  }

  /* the page title is the only h1: an h1 in a post body becomes h2 (attributes
     kept). h2-h6 are left alone - Dan's ## subheadings are styled as h2. */
  function shiftHeadings(html) {
    return String(html || '').replace(/<(\/?)h1(?=[\s>\/])/gi, '<$1h2');
  }

  return { esc, slugify, fmtDisplayDate, todayET, isPublished, VARIANT_WIDTHS, imgVariant,
           embedYouTube, captionImages, readMins, excerpt, shiftHeadings, plainText };
});
