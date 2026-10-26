/* Tatum Time homepage script (moved out of index.html so browsers cache it).
   Loaded with defer after js/shared.js; the build stamps ?v=<hash> on both URLs. */
/* smooth scrolling unless the visitor asked for reduced motion */
const SMOOTH=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)?'auto':'smooth';

/* ============ DATA ============ */
const grad = ['#0a8f3c','#066b2c','#0e7a3a','#0b5e28','#117a44','#0a6e30'];
function thumbStyle(i){return `background-image:linear-gradient(135deg, ${grad[i%grad.length]}, #04331a);`}

/* ──────────────────────────────────────────────────────────────────────
   FALLBACK POSTS
   Once the site is deployed, posts are managed in the CMS and live in
   content/posts.json — Dan never edits the code. This built-in copy is
   only a safety net, shown if posts.json can't be loaded (for example
   when opening index.html straight from disk, with no web server).
   Kept to ONE post on purpose so it doesn't bloat the page. ──────────── */
const fallbackPosts = [
  {
    cat:'Draft', date:'Jun 25, 2026', emoji:'🎓', tag:'analysis',
    title:'Celtics Draft Grades By Pick',
    excerpt:"Boston's 2026 draft haul graded — from Chris Cenac Jr. at 27 to the second-round swing on Dillon Mitchell.",
    body:`
      <p>The 2026 NBA Draft is in the books, and Boston walked away with a pair of intriguing combo forwards. Here's how each pick grades out.</p>
      <h4><span class="grade">B-</span>&nbsp; Round 1, Pick 27 — Chris Cenac Jr.</h4>
      <p>A 19-year-old forward out of Houston, Cenac Jr. averaged <span class="stat-pill">9.5 PPG</span> <span class="stat-pill">7.9 RPG</span> as a freshman. He profiles as a lanky three-point shooter and switchable defender with real upside — but taking him at 27 felt like a bit of a reach when better-fit options were on the board. The tools are there; the polish isn't yet.</p>
      <h4><span class="grade">B+</span>&nbsp; Round 2 — Dillon Mitchell</h4>
      <p>The 22-year-old out of Saint John's posted <span class="stat-pill">8.0 PPG</span> <span class="stat-pill">6.3 RPG</span>. He's a high-energy athlete who attacks the glass, though the jumper and free-throw stroke remain works in progress. Excellent value this late in the draft.</p>
      <h4>The Verdict</h4>
      <p>Boston came out of the weekend with <strong>two combo forwards</strong> — but arguably ignored their thinnest position. Center depth went unaddressed, and Henri Veesaar was still on the board when the C's made their calls. Solid swings on talent, a questionable read on team need.</p>
    `
  }
];

const legends = [
  {id:'78049', num:'#6', name:'Bill Russell', pos:'Center · 11× Champion', note:'The ultimate winner. Eleven titles in thirteen seasons — the most decorated player in major U.S. sports history.'},
  {id:'1449', num:'#33', name:'Larry Bird', pos:'Forward · 3× MVP', note:'Larry Legend. Three rings, three straight MVPs, and one of the greatest to ever lace them up.'},
  {id:'76970', num:'#17', name:'John Havlicek', pos:'Forward · 8× Champion', note:'"Havlicek stole the ball!" Eight titles and the franchise’s all-time leading scorer.'},
  {id:'600003', num:'#14', name:'Bob Cousy', pos:'Guard · 6× Champion', note:'"The Houdini of the Hardwood" — pro basketball’s original flashy playmaker.'},
  {id:'1450', num:'#32', name:'Kevin McHale', pos:'Forward · 3× Champion', note:'One of the greatest low-post scorers ever; half of the legendary 1980s frontcourt.'},
  {id:'305', num:'#00', name:'Robert Parish', pos:'Center · 3× Champion', note:'"The Chief" — the steady, durable anchor of the Bird-era frontline.'},
  {id:'1718', num:'#34', name:'Paul Pierce', pos:'Forward · 2008 Champ', note:'The Truth. Brought Banner 17 to Boston and authored countless clutch moments in green.'},
  {id:'708', num:'#5', name:'Kevin Garnett', pos:'Forward · DPOY', note:'Anything is possible! The defensive heartbeat of the 2008 championship team.'},
  {id:'77196', num:'#24', name:'Sam Jones', pos:'Guard · 10× Champion', note:'The bank-shot master and a clutch closer — ten rings, second only to Russell.'},
  {id:'76462', num:'#18', name:'Dave Cowens', pos:'Center · 2× Champion', note:'Undersized, relentless big man — the 1973 MVP who powered the ’74 and ’76 titles.'},
  {id:'78510', num:'#10', name:'Jo Jo White', pos:'Guard · 2× Champion', imgUrl:'https://upload.wikimedia.org/wikipedia/commons/8/88/Jojo_white_press_photo.jpg', note:'Iron-man guard and MVP of the triple-overtime 1976 Finals classic.'},
  {id:'77141', num:'#3', name:'Dennis Johnson', pos:'Guard · 2× Champion', imgUrl:'https://upload.wikimedia.org/wikipedia/commons/0/0d/Dennis_Johnson_Lipofsky.jpg', note:'Lockdown defender of the ’80s backcourt — on the end of Bird’s famous steal.'},
  {id:'2243', num:'#44', name:'Brian Scalabrine', pos:'Forward · 2008 Champion', imgUrl:'https://upload.wikimedia.org/wikipedia/commons/e/eb/Brian_Scalabrine_of_the_Boston_Celtics_at_NBA_Media_Day_2007.png', note:'The "White Mamba" — beloved cult hero of the 2008 champions, now a fan-favorite Celtics broadcaster.'},
];

/* ============ RENDER POSTS (READER) ============ */
/* Posts are loaded from the CMS file content/posts.json when the site is
   served over the web. If that can't be fetched (e.g. the file is opened
   directly from disk), we fall back to the built-in fallbackPosts above. */
let posts = fallbackPosts;
let current = 0;
let featuredIdx = 0;
/* '2026-01-01' is a calendar day - parse it as local midnight (new Date() would read
   UTC and file a Jan 1 post under the previous year in the Americas) */
function dateOf(d){ const m=String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m?new Date(+m[1],+m[2]-1,+m[3]):new Date(d); }
function dateNum(d){ const t=dateOf(d).getTime(); return isNaN(t)?0:t; }
/* day of the year from local midnights - stays right across daylight-saving changes */
function dayOfYear(now){ return Math.round((new Date(now.getFullYear(),now.getMonth(),now.getDate())-new Date(now.getFullYear(),0,0))/864e5); }
/* Scheduled posts: a post dated in the future stays hidden until that calendar day
   (checked per visit, in the visitor's local time, so it appears on its own). */
/* date + text helpers live in js/shared.js (TT), shared with the build scripts so the
   site and the build always agree (publish day is judged in Boston time) */
function isPublished(p){ return TT.isPublished(p.date); }
function fmtDisplayDate(s){ return TT.fmtDisplayDate(s); }
const listBox = document.getElementById('postList');

/* ==stat== shorthand -> green stat pill */
function pill(html){ return html.replace(/==([^=]+)==/g,'<span class="stat-pill">$1</span>'); }

/* turn a CMS post (markdown + fields) into the internal {emoji,cat,date,title,body} shape */
function focusPos(v){
  switch(String(v||'').toLowerCase()){
    case 'top': return '50% 0%';
    case 'bottom': return '50% 100%';
    case 'left': return '0% 50%';
    case 'right': return '100% 50%';
    default: return '50% 50%';   // Center
  }
}
function captionImages(html){ return TT.captionImages(html); }
/* Uploaded photos have small WebP copies made at deploy (build-images.js):
   -96 for list thumbnails, -480 for cards, -1200 for heroes and article photos. If a copy is
   missing, imgFallback() swaps back to the original; if that fails too, the
   image is hidden and its emoji placeholder shows instead. */
function imgVariant(src,w){ return TT.imgVariant(src,w); }
function imgFallback(el){
  const o=el.dataset.orig;
  if(o && el.getAttribute('src')!==o){ el.removeAttribute('srcset'); el.src=o; return; }
  el.onerror=null; el.classList.add('img-dead');
  const box=el.closest('.pi-photo,.pc-photo'); if(box) box.classList.add('noimg');
  if(el.id==='readerHero'||el.id==='feat-thumb') el.style.display='none';
}
function setImg(el,src,w){
  const v=imgVariant(src,w);
  el.classList.remove('img-dead');
  if(v!==src){ el.dataset.orig=src; el.srcset=imgVariant(src,480)+' 480w, '+v+' '+w+'w'; }
  else { delete el.dataset.orig; el.removeAttribute('srcset'); }
  el.onerror=function(){ imgFallback(el); };
  el.src=v;
}
function imgTag(src,w,extra){
  const v=imgVariant(src,w), orig=v!==src?' data-orig="'+src+'"':'';
  return '<img src="'+v+'"'+orig+' onerror="imgFallback(this)" '+(extra||'')+'>';
}
let markedPromise=null;
function loadMarked(){
  if(window.marked) return Promise.resolve();
  if(!markedPromise) markedPromise=new Promise(function(res){
    const s=document.createElement('script'); s.src='js/marked.min.js'; s.onload=res; s.onerror=res; document.head.appendChild(s);
  });
  return markedPromise;
}
function normalizePost(p){
  let body = p.html || (window.marked ? marked.parse(p.body||'') : (p.body||''));
  body = pill(body);
  body = embedYouTube(body);
  // Hero photo: the CMS "Featured Photo" field if set, otherwise the first photo in
  // the article (pulled out of the body so it isn't shown twice). Old posts get a
  // hero automatically from their first image.
  let hero = (p.image||'').trim();
  if(!hero){
    const m = body.match(/<p>\s*<img[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/p>/i);
    if(m){ hero = m[1]; body = body.replace(m[0], ''); }
    else { const m2 = body.match(/<img[^>]*\bsrc="([^"]+)"[^>]*>/i); if(m2) hero = m2[1]; }
  }
  body = captionImages(body);
  // photos inside articles load lazily so they never slow the first paint
  body = body.replace(/<img\b(?![^>]*\bloading=)/gi,'<img loading="lazy" decoding="async" ');
  body = body.replace(/<img\b([^>]*?)\bsrc="([^"]+)"/gi,function(m,pre,src){
    const v=imgVariant(src,1200); return v===src?m:'<img'+pre+'src="'+v+'" data-orig="'+src+'" onerror="imgFallback(this)"';
  });
  if(p.gameLink && /^https?:\/\//i.test(p.gameLink.trim())){
    body += `<a class="game-link" href="${escHtml(p.gameLink.trim())}" target="_blank" rel="noopener">📊 See full game stats here ↗</a>`;
  }
  return { emoji:p.emoji||'🏀', cat:p.category||p.cat||'Post', date:p.date||'', title:p.title||'', body, hero, heroFocus:focusPos(p.imageFocus), featured:!!p.featured, readMins:p.readMins||0, slug:p.slug||'', excerpt:p.excerpt||'' };
}

function excerptFrom(html){
  const d=document.createElement('div'); d.innerHTML=html;
  const t=(d.textContent||'').replace(/\s+/g,' ').trim();
  return t.length>140 ? t.slice(0,140).trim()+'…' : t;
}

function buildList(){
  listBox.innerHTML='';
  // year dividers, only once the archive spans more than one year
  const yearOf=p=>{ const y=dateOf(p.date).getFullYear(); return isNaN(y)?null:String(y); };
  const manyYears=new Set(posts.map(yearOf).filter(Boolean)).size>1;
  let lastYear=null;
  posts.forEach((p,i)=>{
    const y=yearOf(p);
    if(manyYears && y && y!==lastYear){
      const d=document.createElement('div'); d.className='list-year'; d.textContent=y;
      listBox.appendChild(d); lastYear=y;
    }
    const it=document.createElement('a');
    it.className='post-item'; it.dataset.i=i;
    const thumb = p.hero
      ? `<span class="pi-emoji pi-photo" style="${thumbStyle(i)}"><i>${p.emoji}</i>${imgTag(p.hero,96,'alt="" loading="lazy" decoding="async" width="42" height="42"')}</span>`
      : `<span class="pi-emoji" style="${thumbStyle(i)}">${p.emoji}</span>`;
    it.innerHTML=`${thumb}
      <span class="pi-text"><b>${escHtml(p.title)}</b><small>${p._new?'<span class="post-new">NEW</span>':''}${fmtDisplayDate(p.date)} · ${escHtml(p.cat)}</small></span>`;
    linkPost(it,i);
    listBox.appendChild(it);
  });
}

/* "Browse all": every post as a photo card. Built the first time it's opened. */
let gridBuilt=false;
function buildGrid(){
  const box=document.getElementById('postGrid'); if(!box) return;
  box.innerHTML='';
  posts.forEach((p,i)=>{
    const c=document.createElement('a'); c.className='pc-card'; c.dataset.i=i;
    const photo=p.hero?imgTag(p.hero,480,'alt="" loading="lazy" decoding="async" style="object-position:'+(p.heroFocus||'50% 50%')+'"'):'';
    c.innerHTML=`<span class="pc-photo" style="${thumbStyle(i)}">${p._new?'<span class="post-new">NEW</span>':''}<i>${p.emoji}</i>${photo}</span>
      <span class="pc-body"><span class="pc-cat">${escHtml(p.cat)}</span><b>${escHtml(p.title)}</b><small>${fmtDisplayDate(p.date)} · ${p.readMins} min read</small></span>`;
    linkPost(c,i,()=>setView('read'));
    box.appendChild(c);
  });
  gridBuilt=true;
}
function setView(v){
  const lay=document.getElementById('readerLayout'); if(!lay) return;
  if(v==='grid' && !gridBuilt){ buildGrid(); applyFilter(); }
  lay.classList.toggle('grid-mode',v==='grid');
  document.querySelectorAll('.view-toggle button').forEach(b=>{ const on=b.dataset.view===v; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); });
}
document.querySelectorAll('.view-toggle button').forEach(b=>{ b.onclick=()=>setView(b.dataset.view); });

/* "New since your last visit": this browser remembers which posts existed when it
   was last here (tt_known). Anything published since then gets a NEW badge until
   it's opened; the list for the current visit lives in sessionStorage so a refresh
   doesn't wipe it. A first-time visitor sees no badges. */
let newSlugs=new Set(), blogBooting=true;
function computeNewPosts(){
  const all=posts.map(p=>p.slug);
  let known=null, sess=null;
  try{ known=JSON.parse(localStorage.getItem('tt_known')||'null'); }catch(e){}
  try{ sess=JSON.parse(sessionStorage.getItem('tt_new')||'null'); }catch(e){}
  newSlugs=new Set(Array.isArray(sess)?sess.filter(s=>all.includes(s)):[]);
  if(Array.isArray(known)){ const k=new Set(known); all.forEach(s=>{ if(!k.has(s)) newSlugs.add(s); }); }
  try{ localStorage.setItem('tt_known',JSON.stringify(all)); }catch(e){}
  saveNew();
  posts.forEach(p=>{ p._new=newSlugs.has(p.slug); });
}
function saveNew(){
  try{ sessionStorage.setItem('tt_new',JSON.stringify([...newSlugs])); }catch(e){}
  const n=newSlugs.size, el=document.getElementById('newNote'); if(!el) return;
  el.hidden=!n;
  el.textContent=n?('\u2618\uFE0F '+n+' new post'+(n>1?'s':'')+' since your last visit'):'';
}
function markSeen(i){
  const p=posts[i]; if(!p||!p._new) return;
  p._new=false; newSlugs.delete(p.slug); saveNew();
  document.querySelectorAll('[data-i="'+i+'"] .post-new').forEach(b=>b.remove());
}

/* make el a real link to the post's own page; a plain click opens it in the
   reader instead (ctrl/cmd/shift/middle-click still open the page itself) */
function linkPost(el,i,before){
  el.href='/post/'+posts[i].slug+'/';
  el.addEventListener('click',function(e){
    if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    e.preventDefault(); if(before) before(); renderPost(i,true);
  });
}

function setFeatured(){
  const fi=posts.findIndex(p=>p.featured); featuredIdx = fi>=0 ? fi : 0;   // pinned post, else newest
  const f=posts[featuredIdx]; if(!f) return;
  const t=document.getElementById('feat-title'); if(t) t.textContent=f.title;
  const e=document.getElementById('feat-ex'); if(e) e.textContent=f.excerpt||excerptFrom(f.body);
  const m=document.getElementById('feat-meta'); if(m) m.textContent=fmtDisplayDate(f.date)+' · '+f.cat;
  const fl=document.getElementById('featLink'); if(fl && !fl.dataset.wired){ fl.dataset.wired='1'; linkPost(fl,featuredIdx); }
  const th=document.getElementById('feat-thumb');
  if(th){ if(f.hero){ setImg(th,f.hero,1200); th.alt=f.title; th.style.objectPosition=f.heroFocus||'50% 50%'; th.style.display='block'; } else { th.style.display='none'; th.removeAttribute('src'); } }
}

/* run one startup step; a failure is logged instead of taking the rest of the page down */
function safe(fn){ try{ const r=fn(); if(r&&r.catch) r.catch(e=>console.error(e)); }catch(e){ console.error(e); } }
async function initBlog(){
  let source = fallbackPosts;
  try{
    const res=await fetch('content/posts.json',{cache:'no-cache'});   // revalidates (cheap 304) instead of re-downloading
    if(res.ok){
      const data=await res.json();
      if(data && Array.isArray(data.posts) && data.posts.length){
        if(data.posts.some(function(p){ return !p.html; })) await loadMarked();   // older build without pre-rendered HTML
        source = data.posts.map(normalizePost);
      }
    }
  }catch(e){ /* offline / opened from disk — keep the built-in fallback */ }
  posts = source.map(ensureMeta).filter(isPublished).sort((a,b)=>dateNum(b.date)-dateNum(a.date));   // newest first; hide future-dated (scheduled) posts until their day
  if(source!==fallbackPosts) computeNewPosts();   // a failed posts.json load must not reset what this browser has seen
  safe(buildList); safe(buildTags); safe(setFeatured);
  const sp=document.getElementById('statPosts'); if(sp&&posts.length) sp.textContent=posts.length;   // live post count in the hero
  const searchEl=document.getElementById('postSearch');
  if(searchEl) searchEl.addEventListener('input', applyFilter);
  const startIdx=postIndexFromHash();
  safe(()=>renderPost(startIdx>=0?startIdx:0, false, startIdx>=0));
  blogBooting=false;
  if(startIdx>=0) markSeen(startIdx);   // opened straight from a shared link
  safe(loadSchedule);   // live scores + schedule list + courtside ticker (default tab)
  safe(renderThisDay);  // Quote of the Day + On This Day cards
  safe(renderTrivia);   // Question of the Day (fan trivia with shared results)
  safe(renderTimeline); // championship timeline (static, no network)
  safe(wireTabs);       // tabs - Standings/Players fetch only when first opened
  safe(wireNewsletter); // newsletter signup
  // Load the roster once the browser is idle (still early, not on-scroll) so it can't
  // grow the page mid-scroll and throw off anchor jumps like "About".
  (window.requestIdleCallback||function(f){ return setTimeout(f,900); })(function(){ loadRoster(); },{timeout:2500});
}

function renderPost(i, scroll, setHash=true){
  const p=posts[i]; if(!p) return;
  current=i;
  document.getElementById('readerCat').textContent=p.cat;
  const _tt=document.getElementById('readerTitle');
  _tt.textContent='';
  const _em=document.createElement('span'); _em.className='t-emoji'; _em.textContent=p.emoji;
  _tt.appendChild(_em); _tt.appendChild(document.createTextNode(' '+p.title));
  document.getElementById('readerMeta').textContent='Dan MacLean · '+fmtDisplayDate(p.date);
  const heroEl=document.getElementById('readerHero');
  if(heroEl){ if(p.hero){ setImg(heroEl,p.hero,1200); heroEl.alt=p.title; heroEl.style.objectPosition=p.heroFocus||'50% 50%'; heroEl.style.display='block'; } else { heroEl.style.display='none'; heroEl.removeAttribute('src'); } }
  document.getElementById('readerArticle').innerHTML=p.body;
  linkifyPlayers(document.getElementById('readerArticle'));
  document.getElementById('readTime').textContent='⏱ '+p.readMins+' min read';
  buildShare(p); renderRelated(p);
  if(!blogBooting) markSeen(i);   // the post shown automatically on load doesn't count as read
  // new post: drop the previous post's thread + reactions right away, then load this
  // post's once the reader gets near them (#clist is never display:none, so the
  // observer always fires - the reaction bar hides itself while loading)
  currentCommentSlug=p.slug;
  const _cl=document.getElementById('clist'), _rb=document.getElementById('reactBar');
  if(_cl) _cl.innerHTML=''; if(_rb){ _rb.innerHTML=''; _rb.style.display='none'; }
  whenNear(_cl,function(){ loadComments(p.slug); loadReactions(p.slug); });
  // a click adds a history entry (so Back returns to the previous post); arrow keys just replace it
  if(setHash && history.replaceState && location.hash!=='#/post/'+p.slug){
    if(scroll && history.pushState) history.pushState(null,'','#/post/'+p.slug); else history.replaceState(null,'','#/post/'+p.slug);
  }
  document.querySelectorAll('.post-item').forEach(el=>{
    const on=(+el.dataset.i===i); el.classList.toggle('active',on);
    if(on && setHash) el.scrollIntoView({block:'nearest'});
  });
  buildNav('readerNavTop'); buildNav('readerNavBottom');
  if(scroll){
    const rd=document.querySelector('.reader');
    const navH=(document.querySelector('header.nav')||{}).offsetHeight||60;
    const y=rd.getBoundingClientRect().top+window.pageYOffset-navH-8;
    window.scrollTo({top:Math.max(0,y),behavior:SMOOTH});
  }
}

/* "More from Tatum Time" — up to 3 related posts (same category first, then newest) */
function renderRelated(p){
  const row=document.getElementById('relatedRow'), grid=document.getElementById('relatedGrid');
  if(!row||!grid) return;
  const pool=posts.filter(x=>x!==p);
  const picks=pool.filter(x=>x.cat===p.cat).concat(pool.filter(x=>x.cat!==p.cat)).slice(0,3);
  if(!picks.length){ row.style.display='none'; return; }
  grid.innerHTML='';
  picks.forEach(function(x){
    const i=posts.indexOf(x);
    const b=document.createElement('a'); b.className='rel-card';
    const thumb=x.hero
      ? '<span class="rel-thumb pi-photo" style="'+thumbStyle(i)+'"><i>'+escHtml(x.emoji)+'</i>'+imgTag(x.hero,480,'alt="" loading="lazy" decoding="async"')+'</span>'
      : '<span class="rel-thumb" style="'+thumbStyle(i)+'">'+escHtml(x.emoji)+'</span>';
    b.innerHTML=thumb+'<span class="rel-body"><span class="rel-cat">'+escHtml(x.cat)+'</span><span class="rel-title">'+escHtml(x.title)+'</span><span class="rel-date">'+fmtDisplayDate(x.date)+'</span></span>';
    linkPost(b,i);
    grid.appendChild(b);
  });
  row.style.display='';
}

/* newer/older neighbours of the open post among the posts the search/category filter shows */
function neighbors(){
  const shown=[...document.querySelectorAll('.post-item')].filter(el=>el.style.display!=='none').map(el=>+el.dataset.i);
  const order=shown.length?shown:posts.map((_,i)=>i), at=order.indexOf(current);
  if(at<0) return {newer:current>0?current-1:-1, older:current<posts.length-1?current+1:-1};
  return {newer:at>0?order[at-1]:-1, older:at<order.length-1?order[at+1]:-1};
}
function buildNav(id){
  const nb=neighbors(), newer=nb.newer>=0?posts[nb.newer]:null, older=nb.older>=0?posts[nb.older]:null;   // newer = earlier in the list
  document.getElementById(id).innerHTML=`
    <button class="nav-btn ${newer?'':'disabled'}" ${newer?`onclick="renderPost(${nb.newer},true)"`:'disabled'}>
      <span class="dir">← Newer post</span><span class="t">${newer?escHtml(newer.title):"You're at the latest"}</span>
    </button>
    <button class="nav-btn right ${older?'':'disabled'}" ${older?`onclick="renderPost(${nb.older},true)"`:'disabled'}>
      <span class="dir">Older post →</span><span class="t">${older?escHtml(older.title):'End of the archive'}</span>
    </button>`;
}

/* ---------- extras: meta, search/tags, share, comments, live schedule ---------- */
let activeCat='All', countdownTimer=null;
/* ---- In-house comments (Supabase). Paste your two values below; see SETUP-COMMENTS.txt ---- */
const commentsConfig={
  url:"https://oeogaqrqwevjqpwvrxhq.supabase.co",   // Supabase Project URL
  anonKey:"sb_publishable_qHH5R2FwTF-zKs5zoVXZzA_f98jkW75",  // Supabase publishable (public) key
  moderated:false   // flip to true AFTER running SETUP-COMMENT-MODERATION.txt — comments then wait for Dan's approval
};
function commentsReady(){ return commentsConfig.url && commentsConfig.anonKey && !commentsConfig.url.includes('YOUR-PROJECT') && !commentsConfig.anonKey.includes('YOUR-ANON'); }

/* ---- EmailJS loads only when it's actually needed (a comment or signup happens) ---- */
let emailJsPromise=null;
function loadEmailJs(){
  if(window.emailjs) return Promise.resolve();
  if(!emailJsPromise){
    emailJsPromise=new Promise(function(res,rej){
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      s.onload=res; s.onerror=function(){ emailJsPromise=null; rej(); };
      document.head.appendChild(s);
    });
  }
  return emailJsPromise;
}

/* ---- Email Dan when a new comment is posted (EmailJS). Paste 3 values below; see SETUP-COMMENTS.txt ---- */
const notifyConfig={
  publicKey:"owpiI42bIc3Bik97Q",   // EmailJS Public Key
  serviceId:"service_hcsoh6g",     // EmailJS Email Service
  templateId:"template_57p8p2l",   // EmailJS template for NEW COMMENTS
  subTemplateId:"template_khcpqeh"   // EmailJS template for NEW SUBSCRIBERS (see SETUP-COMMENTS.txt)
};
function notifyReady(){ return notifyConfig.publicKey && notifyConfig.serviceId && notifyConfig.templateId && !notifyConfig.publicKey.includes('YOUR_') && !notifyConfig.serviceId.includes('YOUR_') && !notifyConfig.templateId.includes('YOUR_'); }
function notifyNewComment(name,body,slug){
  if(!notifyReady()) return;
  let title=slug;
  try{ if(typeof posts!=='undefined'){ const p=posts.find(x=>x.slug===slug); if(p&&p.title) title=p.title; } }catch(e){}
  const params={ commenter:name, comment:body, post_title:title, post_url:location.origin+'/#/post/'+slug };
  loadEmailJs().then(function(){ try{ emailjs.send(notifyConfig.serviceId,notifyConfig.templateId,params,{publicKey:notifyConfig.publicKey}); }catch(e){} }).catch(function(){});
}
function subNotifyReady(){ return notifyConfig.publicKey && notifyConfig.serviceId && notifyConfig.subTemplateId && !notifyConfig.publicKey.includes('YOUR_') && !notifyConfig.serviceId.includes('YOUR_') && !notifyConfig.subTemplateId.includes('YOUR_'); }
function notifyNewSubscriber(email){
  if(!subNotifyReady()) return;   // silently skip until the subscriber template is set up
  const params={ subscriber_email:email, site_url:location.origin };
  loadEmailJs().then(function(){ try{ emailjs.send(notifyConfig.serviceId,notifyConfig.subTemplateId,params,{publicKey:notifyConfig.publicKey}); }catch(e){} }).catch(function(){});
}

/* turn YouTube links in a post into an embedded player */
function embedYouTube(html){ return TT.embedYouTube(html); }

function slugify(s){ return TT.slugify(s); }
function readingTime(html){ return TT.readMins(html); }
function ensureMeta(p){ p.slug=p.slug||slugify(p.title); p.readMins=p.readMins||readingTime(p.body); return p; }

/* ---- Turn player/legend names in a post into links to their Franchise card ---- */
const playerLinkIndex={};   // normalized full name -> {slug, tab, name}
let PLAYER_RE=null;
function cardSlug(name){ return slugify(normName(name)); }   // accent-safe, matches the card's data-card
function addPlayerLink(name,tab){ const n=normName(name); if(!n||playerLinkIndex[n]) return; playerLinkIndex[n]={slug:cardSlug(name),tab:tab,name:name}; }
function buildPlayerRe(){
  const names=Object.values(playerLinkIndex).map(x=>x.name).sort((a,b)=>b.length-a.length);  // longest first so full names win
  if(!names.length){ PLAYER_RE=null; return; }
  const esc=names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  PLAYER_RE=new RegExp('\\b('+esc.join('|')+')','g');
}
function linkifyPlayers(container){
  if(!container||!PLAYER_RE) return;
  const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,null,false), targets=[]; let node;
  while((node=walker.nextNode())){
    const pn=node.parentNode; if(!pn) continue;
    const tag=pn.nodeName; if(tag==='A'||tag==='SCRIPT'||tag==='STYLE') continue;   // never link inside an existing link
    PLAYER_RE.lastIndex=0; if(PLAYER_RE.test(node.nodeValue)) targets.push(node);
  }
  targets.forEach(function(n){
    const text=n.nodeValue; PLAYER_RE.lastIndex=0;
    const frag=document.createDocumentFragment(); let last=0,m;
    while((m=PLAYER_RE.exec(text))){
      const name=m[1], idx=m.index, info=playerLinkIndex[normName(name)];
      if(idx>last) frag.appendChild(document.createTextNode(text.slice(last,idx)));
      if(info){
        const a=document.createElement('a');
        a.className='tt-plink'; a.href=playerPageUrl(name)||'#franchise';
        a.setAttribute('data-goto-player',info.slug);
        a.setAttribute('data-goto-tab',info.tab);
        a.textContent=name;
        frag.appendChild(a);
      } else { frag.appendChild(document.createTextNode(name)); }
      last=idx+name.length;
    }
    if(last<text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    n.parentNode.replaceChild(frag,n);
  });
}
function expandRoster(){
  const rg=document.getElementById('rosterGrid'); if(rg) rg.classList.remove('collapsed');
  const more=document.getElementById('rosterMore'); if(more) more.style.display='none';
}
function gotoPlayerCard(slug,tab){
  const section=document.getElementById('franchise'); if(!section) return;
  const btn=section.querySelector('.tab[data-tab="'+tab+'"]'); if(btn) btn.click();   // open the right tab (Roster/Legends)
  if(tab==='f-roster') expandRoster();   // the card might be behind "Show the full roster"
  function reveal(){
    const card=section.querySelector('[data-card="'+slug+'"]');
    if(!card) return false;
    card.scrollIntoView({behavior:SMOOTH,block:'center'});
    card.classList.add('card-flash'); setTimeout(function(){ card.classList.remove('card-flash'); },2000);
    return true;
  }
  if(reveal()) return;
  if(tab==='f-roster' && typeof loadRoster==='function'){ Promise.resolve(loadRoster()).then(function(){ setTimeout(reveal,140); }); }
  else setTimeout(reveal,220);
}

function buildTags(){
  const cats=['All',...Array.from(new Set(posts.map(p=>p.cat)))];
  const row=document.getElementById('tagRow'); row.innerHTML='';
  cats.forEach((c,i)=>{
    const b=document.createElement('button');
    b.className='tag-chip'+(i===0?' active':''); b.textContent=c;
    b.onclick=()=>{ document.querySelectorAll('.tag-chip').forEach(x=>x.classList.remove('active')); b.classList.add('active'); activeCat=c; applyFilter(); };
    row.appendChild(b);
  });
}
function applyFilter(){
  const q=(document.getElementById('postSearch').value||'').toLowerCase().trim();
  let shown=0;
  document.querySelectorAll('.post-item,.pc-card').forEach(el=>{
    const p=posts[+el.dataset.i];
    if(!p._hay){ const d=document.createElement('div'); d.innerHTML=p.body; p._hay=(p.title+' '+p.cat+' '+(d.textContent||'')).replace(/\s+/g,' ').toLowerCase(); }   // full-text, built once
    const ok=(activeCat==='All'||p.cat===activeCat) && (!q||p._hay.includes(q));
    el.style.display=ok?'':'none'; if(ok) shown++;
  });
  const nr=document.getElementById('noResults'); if(nr) nr.style.display=shown?'none':'block';   // (shown counts list + grid together; both hide/show as one)
  // year dividers only make sense on the unfiltered list
  document.querySelectorAll('.list-year').forEach(el=>{ el.style.display=(activeCat==='All'&&!q)?'':'none'; });
}

function onPostHash(){
  if(blogBooting||!posts.length) return;
  const i=postIndexFromHash(), want=i>=0?i:0;
  if(want!==current) renderPost(want,false,false);
}
window.addEventListener('popstate',onPostHash);
window.addEventListener('hashchange',onPostHash);
function postIndexFromHash(){
  const m=(location.hash||'').match(/#\/post\/(.+)$/); if(!m) return -1;
  const s=decodeURIComponent(m[1]); return posts.findIndex(p=>p.slug===s);
}
function shareUrl(p){
  // Prefer the post's own page (generated at deploy time by build-pages.js) — it
  // carries a real title/photo link preview. Hash URL is the from-disk fallback.
  if(/^https?:$/.test(location.protocol)) return location.origin+'/post/'+p.slug+'/';
  return location.origin+location.pathname+'#/post/'+p.slug;
}
function buildShare(p){
  const url=encodeURIComponent(shareUrl(p)), text=encodeURIComponent(p.title+' — Tatum Time');
  // native share sheet where the browser has one (phones, mostly)
  const native=navigator.share?`<button class="share-btn" id="shareNative" aria-label="Share" title="Share"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg></button>`:'';
  document.getElementById('shareRow').innerHTML=`
    <span class="share-lbl">Share</span>${native}
    <a class="share-btn" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${text}&url=${url}" aria-label="Share on X" title="Share on X">𝕏</a>
    <a class="share-btn" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${url}" aria-label="Share on Facebook" title="Share on Facebook">f</a>
    <a class="share-btn" target="_blank" rel="noopener" href="https://www.threads.net/intent/post?text=${text}%20${url}" aria-label="Share on Threads" title="Share on Threads"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/></svg></a>
    <button class="share-btn" id="copyBtn" aria-label="Copy link" title="Copy link">🔗</button>`;
  const cb=document.getElementById('copyBtn');
  cb.onclick=()=>{ const t=shareUrl(p); const done=()=>{cb.textContent='✓';setTimeout(()=>cb.textContent='🔗',1500);};
    if(navigator.clipboard){ navigator.clipboard.writeText(t).then(done).catch(done); } else { done(); } };
  const ns=document.getElementById('shareNative');
  if(ns) ns.onclick=()=>{ navigator.share({title:p.title,text:p.title+' — Tatum Time',url:shareUrl(p)}).catch(()=>{}); };
}

let currentCommentSlug=null;
function chead(){ return { apikey:commentsConfig.anonKey, Authorization:'Bearer '+commentsConfig.anonKey }; }
function commentWhen(iso){
  const d=new Date(iso); if(isNaN(d)) return '';
  const mins=Math.round((Date.now()-d.getTime())/60000);
  if(mins<1) return 'just now';
  if(mins<60) return mins+' min ago';
  const hrs=Math.round(mins/60); if(hrs<24) return hrs+' hr'+(hrs>1?'s':'')+' ago';
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}
function escHtml(s){ return TT.esc(s); }
/* run fn once el is within ~900px of the screen (comments + reactions sit far
   below the fold - no reason to hit Supabase until a reader heads that way) */
let nearIO=null;
function whenNear(el,fn){
  if(nearIO){ nearIO.disconnect(); nearIO=null; }
  if(!el||!('IntersectionObserver' in window)){ fn(); return; }
  nearIO=new IntersectionObserver(function(es){
    if(es.some(function(e){ return e.isIntersecting; })){ nearIO.disconnect(); nearIO=null; fn(); }
  },{rootMargin:'900px 0px'});
  nearIO.observe(el);
}
function loadComments(slug){
  currentCommentSlug=slug;
  const note=document.getElementById('commentsNote'), form=document.getElementById('cform'), list=document.getElementById('clist');
  list.innerHTML='';
  if(!commentsReady()){
    form.style.display='none';
    note.style.display='block';
    note.innerHTML='💬 Comments aren’t switched on yet. Follow <strong>SETUP-COMMENTS.txt</strong> to connect the free comment database — fans will then be able to reply right here under each post, no account needed.';
    return;
  }
  note.style.display='none'; form.style.display='grid';
  list.innerHTML='<div class="cempty">Loading comments…</div>';
  const q=commentsConfig.url+'/rest/v1/comments?select=name,body,created_at&post_slug=eq.'+encodeURIComponent(slug)+(commentsConfig.moderated?'&approved=eq.true':'')+'&order=created_at.asc';
  fetch(q,{headers:chead()}).then(r=>r.ok?r.json():Promise.reject(r.status)).then(rows=>{
    if(slug!==currentCommentSlug) return; // user navigated away
    renderComments(rows);
  }).catch(()=>{ if(slug===currentCommentSlug) list.innerHTML='<div class="cempty">Couldn’t load comments right now.</div>'; });
}
function renderComments(rows){
  const list=document.getElementById('clist');
  if(!rows||!rows.length){ list.innerHTML='<div class="cempty">No comments yet — be the first to weigh in. 🍀</div>'; return; }
  list.innerHTML=rows.map(c=>'<div class="citem"><div class="chead"><span class="cwho">'+escHtml(c.name||'Anonymous')+'</span><span class="cwhen">'+commentWhen(c.created_at)+'</span></div><div class="cbody">'+escHtml(c.body)+'</div></div>').join('');
}
function postComment(ev){
  ev.preventDefault();
  if(!commentsReady()) return false;
  const nameEl=document.getElementById('cname'), bodyEl=document.getElementById('cbody');
  const btn=document.getElementById('cbtn'), status=document.getElementById('cstatus');
  const name=(nameEl.value||'').trim().slice(0,40)||'Anonymous';
  const body=(bodyEl.value||'').trim();
  if(!body){ status.textContent='Write something first.'; return false; }
  const slug=currentCommentSlug;
  btn.disabled=true; status.textContent='Posting…';
  fetch(commentsConfig.url+'/rest/v1/comments',{
    method:'POST',
    headers:Object.assign({'Content-Type':'application/json',Prefer:'return=minimal'},chead()),
    body:JSON.stringify({post_slug:slug,name:name,body:body})
  }).then(r=>{
    if(!r.ok) return Promise.reject(r.status);
    bodyEl.value='';
    status.textContent=commentsConfig.moderated?'Thanks! Your comment will appear once Dan approves it. 💚':'Thanks! 💚';
    setTimeout(()=>{ if(currentCommentSlug===slug) status.textContent=''; },commentsConfig.moderated?6000:3000);
    loadComments(slug);
    notifyNewComment(name,body,slug);   // email Dan about the new comment
  }).catch(()=>{ status.textContent='Couldn’t post — try again.'; })
   .finally(()=>{ btn.disabled=false; });
  return false;
}

/* ---- emoji reactions on posts (Supabase, no login) ---- */
const REACTIONS=['🍀','🔥','💚','🙌','😤'];
function reactKey(slug){ return 'tt_react_'+slug; }
function myReactions(slug){ try{ return JSON.parse(localStorage.getItem(reactKey(slug))||'[]'); }catch(e){ return []; } }
function renderReactions(slug,counts){
  const bar=document.getElementById('reactBar'); if(!bar) return;
  const mine=myReactions(slug);
  bar.innerHTML='<span class="react-lbl">React</span>'+REACTIONS.map(function(e){
    const active=mine.indexOf(e)>-1?' active':'';
    return '<button class="react-btn'+active+'" type="button" onclick="react(event,\''+escHtml(slug)+'\',\''+e+'\')"><span class="re">'+e+'</span><span class="rc">'+(counts[e]||0)+'</span></button>';
  }).join('');
}
function loadReactions(slug){
  const bar=document.getElementById('reactBar'); if(!bar) return;
  bar.style.display='none';   // stay hidden until the reactions table confirms it's set up
  if(!commentsReady()) return;
  fetch(commentsConfig.url+'/rest/v1/reactions?select=emoji&post_slug=eq.'+encodeURIComponent(slug),{headers:chead()})
    .then(function(r){ return r.ok?r.json():Promise.reject(); })
    .then(function(rows){
      if(slug!==currentCommentSlug) return;   // navigated away
      const c={}; REACTIONS.forEach(function(e){ c[e]=0; });
      rows.forEach(function(r){ if(c[r.emoji]!=null) c[r.emoji]++; });
      bar.style.display='';
      renderReactions(slug,c);
    }).catch(function(){ bar.style.display='none'; });
}
function react(ev,slug,emoji){
  if(!commentsReady()) return;
  const mine=myReactions(slug);
  if(mine.indexOf(emoji)>-1) return;   // one of each per person (per browser)
  const btn=ev&&ev.currentTarget, rc=btn&&btn.querySelector('.rc');   // optimistic bump, undone if the save fails
  const bump=d=>{ if(rc) rc.textContent=String(Math.max(0,parseInt(rc.textContent||'0',10)+d)); };
  if(btn){ if(btn.disabled) return; btn.disabled=true; btn.classList.add('active'); bump(1); }
  fetch(commentsConfig.url+'/rest/v1/reactions',{
    method:'POST',
    headers:Object.assign({'Content-Type':'application/json',Prefer:'return=minimal'},chead()),
    body:JSON.stringify({post_slug:slug,emoji:emoji})
  }).then(function(r){
    if(!r.ok) return Promise.reject();
    const m=myReactions(slug); if(m.indexOf(emoji)<0){ m.push(emoji); try{ localStorage.setItem(reactKey(slug),JSON.stringify(m)); }catch(e){} }
  }).catch(function(){ if(btn){ btn.classList.remove('active'); bump(-1); } })
    .finally(function(){ if(btn) btn.disabled=false; });
}

/* ----- live schedule via ESPN public feed ----- */
/* ESPN's resizer: an 80px logo is ~4KB vs ~50KB for the 500px original */
function teamLogo(abbr){ return 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/'+(abbr||'').toLowerCase()+'.png&w=80&h=80'; }
function gamePageUrl(ev){
  const links=(ev&&ev.links)||[];
  const pick=r=>{ const l=links.find(x=>x.rel&&x.rel.includes(r)&&/^https?:/.test(x.href||'')); return l&&l.href; };
  return pick('summary')||pick('boxscore')||pick('gamecast')||(links.find(x=>/^https?:/.test(x.href||''))||{}).href||null;
}
function parseGame(ev){
  const comp=ev.competitions[0], cs=comp.competitors;
  const bos=cs.find(c=>c.team.abbreviation==='BOS')||cs[0];
  const opp=cs.find(c=>c!==bos)||cs[1];
  return { comp, bos, opp, home:bos.homeAway==='home', status:comp.status };
}
function scoreOf(t){ const v=t.score; if(v==null) return null; return typeof v==='object'?+(v.displayValue??v.value):+v; }
function fmtDate(iso){ const d=new Date(iso); return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
function fmtDateTime(iso){ const d=new Date(iso); return d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+' · '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}); }

/* ---- cached fetch (sessionStorage; avoids re-hitting ESPN on every navigation) ---- */
const inflight={};   // url -> pending promise, so parallel callers share one request
function cachedFetch(url, ttlMin){
  if(inflight[url]) return inflight[url];
  return (inflight[url]=cachedFetchNow(url,ttlMin).finally(()=>{ delete inflight[url]; }));
}
async function cachedFetchNow(url, ttlMin){
  const key='tt:'+url;
  try{ const raw=sessionStorage.getItem(key); if(raw){ const o=JSON.parse(raw); if(Date.now()-o.t < (ttlMin||10)*60000) return o.d; } }catch(e){}
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok) throw new Error('http '+res.status);
  const d=await res.json();
  try{ sessionStorage.setItem(key, JSON.stringify({t:Date.now(), d})); }catch(e){}
  return d;
}
const SKEL_CARD='<div class="skel" style="height:96px"></div>';
const SKEL_ROWS='<div class="skel" style="height:46px;margin-bottom:8px"></div>'.repeat(5);

async function loadSchedule(){
  const _lc=document.getElementById('lastCard'), _nc=document.getElementById('nextCard'), _sl=document.getElementById('schedList');
  if(_lc) _lc.innerHTML=SKEL_CARD; if(_nc) _nc.innerHTML=SKEL_CARD; if(_sl) _sl.innerHTML=SKEL_ROWS;
  try{
    /* ESPN's default schedule call only returns the "current" slate - in the
       offseason that's a few preseason games. Explicitly ask for the right
       regular season too (Jul-Sep: the season ahead; otherwise: the season in
       progress) and merge everything, de-duped by game id. */
    const base='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/bos/schedule';
    const mo=new Date().getMonth();   // 0-based
    const regSeason=(mo>=6&&mo<=8)?(seasonYear()+1):seasonYear();
    const urls=[base, base+'?season='+regSeason+'&seasontype=2'];
    const results=await Promise.all(urls.map(u=>cachedFetch(u,10).catch(()=>null)));
    if(results.every(r=>!r)) throw new Error('schedule unavailable');
    const seen={}, events=[];
    results.filter(Boolean).forEach(d=>(d.events||[]).forEach(ev=>{
      if(ev&&ev.id&&!seen[ev.id]){ seen[ev.id]=1; events.push(ev); }
    }));
    events.sort((a,b)=>new Date(a.date)-new Date(b.date));
    const now=Date.now(); let last=null,next=null;
    events.forEach(ev=>{
      const t=new Date(ev.date).getTime();
      const comp=ev.competitions&&ev.competitions[0];
      const st=(comp&&comp.status&&comp.status.type)||{};
      if(st.completed) last=ev;                                              // only finished games get a W/L
      else if(/postpon|cancel|suspend/i.test(st.name||st.description||'')) return;
      else if(!next && (t>=now || st.state==='in' || t>now-4*36e5)) next=ev;  // upcoming or still being played
    });
    /* offseason previews: ?fandemo=1 fakes a finished win + a game tomorrow
       (pick'em/POTG); ?fandemo=2 additionally simulates GAME DAY - the green
       banner, its countdown, and the theme-song play button. */
    const fd=(location.search.match(/[?&]fandemo=(\d)/)||[])[1];
    if(fd){
      const d=demoEvents(); last=d.last; next=d.next;
      if(fd==='2'){ next.date=new Date(Date.now()+3*36e5).toISOString(); showGameDay(next); }
      if(fd==='3'){ last.date=new Date(Date.now()-2*36e5).toISOString(); showGameDay(last); }
    }
    checkGameDay(events); renderLast(last); renderNext(next); startCountdown(next); renderSchedList(events); fillTicker(last);
  }catch(e){
    const lbl=document.getElementById('scLabel'), tm=document.getElementById('scTime'), mt=document.getElementById('scMatch');
    if(lbl) lbl.textContent='SCHEDULE'; if(tm) tm.textContent='—'; if(mt) mt.textContent='Live data unavailable';
    const sl=document.getElementById('schedList'); if(sl) sl.innerHTML='<div class="no-results">Live schedule is unavailable right now.</div>';
  }
}

/* ----- GAME DAY: banner + NBA theme when the Celtics play today ----- */
let gamedayShown=false;   // the NBA theme only plays when a visitor presses play
function themeEl(){ return document.getElementById('nbaTheme'); }
function checkGameDay(events){
  if(gamedayShown||!events||!events.length) return;
  const now=new Date(), y=now.getFullYear(), m=now.getMonth(), d=now.getDate();
  const game=events.find(ev=>{ const t=new Date(ev.date); return t.getFullYear()===y&&t.getMonth()===m&&t.getDate()===d; });
  if(game) showGameDay(game);
}
function showGameDay(ev){
  const bar=document.getElementById('gamedayBar'); if(!bar) return;
  gamedayShown=true;
  // build "[logo] Celtics vs Opponent · 7:30 PM · 📺 NBC · 📍 TD Garden"
  let html='';
  try{
    const g=parseGame(ev), comp=g.comp||{};
    const oppName=g.opp.team.shortDisplayName||g.opp.team.displayName||'';
    const abbr=g.opp.team.abbreviation||'';
    const time=new Date(ev.date).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
    const bc=((comp.broadcasts||[]).map(x=>x.media&&x.media.shortName).filter(Boolean))[0]||((comp.geoBroadcasts||[]).map(x=>x.media&&x.media.shortName).filter(Boolean))[0]||'';
    const venue=(comp.venue&&comp.venue.fullName)||'';
    const tm=document.getElementById('gdTeams');
    if(tm) tm.innerHTML='<img class="gd-logo" src="'+teamLogo(abbr)+'" alt="" onerror="this.style.display=\'none\'">Celtics '+(g.home?'vs':'@')+' '+escHtml(oppName);
    gdTint(abbr);
    const parts=[];
    if(time) parts.push('<span class="gd-i">'+time+'</span>');
    if(bc) parts.push('<span class="gd-i">📺 '+bc+'</span>');
    if(venue) parts.push('<span class="gd-i">📍 '+venue+'</span>');
    html=parts.join('<span class="gd-sep">·</span>');
  }catch(e){ html=''; }
  const mt=document.getElementById('gdMatch'); if(mt) mt.innerHTML=html;
  bar.style.display='';
  // it's game day → the countdown lives in this banner, so hide the standalone shot-clock bar
  const sb=document.querySelector('.shotclock-bar'); if(sb) sb.style.display='none';
  const done=(function(){ try{ const c=ev.competitions&&ev.competitions[0]; return !!(c&&c.status&&c.status.type&&c.status.type.completed); }catch(e){ return false; } })();
  setGameLink(ev, done?'final':(new Date(ev.date).getTime()<=Date.now()?'live':'pre'));
  startGameDayCountdown(ev.date, done);
  // live score: from the schedule data if it's already final, otherwise poll ESPN
  // from tip-off (see pollGame) - nothing is fetched before the game starts
  if(done) gdApply(ev);
  else {
    const wait=new Date(ev.date).getTime()-6e4-Date.now();
    if(wait<=0) pollGame(); else gdPollT=setTimeout(pollGame,Math.min(wait,2147483000));
  }
  const a=themeEl();
  if(a){
    a.addEventListener('play',()=>setThemeUI(true));
    a.addEventListener('pause',()=>setThemeUI(false));
  }
}
function startTheme(){
  const a=themeEl(); if(!a) return;
  a.volume=0.55;
  const p=a.play();
  if(p&&p.catch) p.catch(()=>{ setThemeUI(false); });
}
function toggleTheme(){
  const a=themeEl(); if(!a) return;
  if(a.paused){ startTheme(); }
  else a.pause();
}
const ICON_PLAY='<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE='<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
function setThemeUI(playing){
  const btn=document.getElementById('gdPlay');
  if(!btn) return;
  btn.innerHTML=playing?ICON_PAUSE:ICON_PLAY;
  btn.setAttribute('aria-label',playing?'Pause NBA theme':'Play NBA theme');
}
/* banner pill -> ESPN's page for this game: Preview before tip, live Gamecast during, Box Score after */
let gdEvent=null;
function setGameLink(ev,state){
  if(ev) gdEvent=ev; ev=gdEvent;
  const a=document.getElementById('gdLink'); if(!a||!ev) return;
  const id=/^\d+$/.test(String(ev.id||''))?ev.id:'';
  const web=(ev.links||[]).find(l=>(l.rel||[]).indexOf('preview')>=0&&/^https:/.test(l.href||''));
  const href=!id?'https://www.espn.com/nba/team/schedule/_/name/bos'
    :state==='final'?'https://www.espn.com/nba/boxscore/_/gameId/'+id
    :state==='pre'&&web?web.href
    :'https://www.espn.com/nba/game/_/gameId/'+id;
  a.href=href;
  a.innerHTML=(state==='final'?'Box Score':state==='live'?'● Gamecast':'<span class="gl-long">Game </span>Preview')+' ›';
  a.title='Open this game on ESPN';
  a.hidden=false;
}
/* ----- live score in the banner -----
   One small request (ESPN's per-game scoreboard, ~3.5KB, CDN-cached) every 30s,
   only between tip-off and the final buzzer, and only while the tab is visible. */
let gdPollT=null, gdLastPoll=0, gdOver=false;
function gdScoreHTML(g,state,detail){
  const b=scoreOf(g.bos), o=scoreOf(g.opp), oa=g.opp.team.abbreviation||'OPP';
  const up=x=>x?' class="up"':'';
  return '<span class="gd-score"><span class="gd-tm">BOS</span><b'+up(b>o)+'>'+(b==null?0:b)+'</b><span class="gd-dash">-</span><b'+up(o>b)+'>'+(o==null?0:o)+'</b><span class="gd-tm">'+escHtml(oa)+'</span></span>'+
         '<span class="gd-period">'+(state==='in'?'<i class="gd-dot"></i>':'')+escHtml(detail)+'</span>';
}
function gdApply(ev){
  let g; try{ g=parseGame(ev); }catch(e){ return 'pre'; }
  const st=(g.status&&g.status.type)||{}, el=document.getElementById('gdClock');
  if(g.opp&&g.opp.team&&g.opp.team.color) gdTint(g.opp.team.abbreviation,g.opp.team.color,g.opp.team.alternateColor);
  const state=(st.completed||st.state==='post')?'post':st.state==='in'?'in':'pre';
  if(state==='pre'||!el) return state;
  if(gdTimer){ clearInterval(gdTimer); gdTimer=null; }
  el.classList.add('is-score');
  el.innerHTML=gdScoreHTML(g,state,state==='post'?(st.shortDetail||'Final'):(st.shortDetail||st.detail||'Live'));
  setGameLink(null,state==='post'?'final':'live');
  if(state==='post'){ gdOver=true; if(scoreOf(g.bos)>scoreOf(g.opp)) celticsWin(ev.id); }
  return state;
}
function pollGame(){
  clearTimeout(gdPollT); gdPollT=null;
  if(gdOver||!gdEvent||!/^\d+$/.test(String(gdEvent.id||''))) return;
  if(document.hidden) return;   // picks back up on visibilitychange
  gdLastPoll=Date.now();
  fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard/'+gdEvent.id)
    .then(function(r){ return r.ok?r.json():Promise.reject(); })
    .then(function(j){ const st=gdApply(j); if(st!=='post') gdPollT=setTimeout(pollGame,st==='in'?30000:60000); })
    .catch(function(){ gdPollT=setTimeout(pollGame,60000); });
}
document.addEventListener('visibilitychange',function(){
  if(!document.hidden && gdEvent && !gdOver && gdLastPoll && !gdPollT) pollGame();
});

/* opponent tint - ESPN team colors (the schedule feed doesn't carry them) */
const TEAM_COLORS={ATL:'c8102e',BKN:'000000',CHA:'1d1160',CHI:'ce1141',CLE:'860038',DAL:'0064b1',DEN:'0e2240',DET:'c8102e',GS:'1d428a',HOU:'ce1141',IND:'002d62',LAC:'c8102e',LAL:'552583',MEM:'5d76a9',MIA:'98002e',MIL:'00471b',MIN:'0c2340',NO:'0c2340',NY:'006bb6',OKC:'007ac1',ORL:'0077c0',PHI:'006bb6',PHX:'1d1160',POR:'e03a3e',SAC:'5a2d81',SA:'000000',TOR:'ce1141',UTAH:'002b5c',WSH:'002b5c'};
function gdTint(abbr,color,alt){
  const lum=h=>{ const n=parseInt(h,16); return ((n>>16&255)*.299+(n>>8&255)*.587+(n&255)*.114)/255; };
  let c=String(color||TEAM_COLORS[String(abbr||'').toUpperCase()]||'').replace('#','');
  if(/^[0-9a-f]{6}$/i.test(c) && lum(c)>.7) c=String(alt||'').replace('#','');   // too light to read white text over
  const bar=document.getElementById('gamedayBar');
  if(bar && /^[0-9a-f]{6}$/i.test(c) && lum(c)<=.7) bar.style.setProperty('--opp','#'+c);
}

/* Celtics win: gold "CELTICS WIN!" plus a one-time shamrock burst per game per browser */
function celticsWin(id){
  const t=document.getElementById('gdTitle');
  if(t){ t.textContent='☘️ CELTICS WIN!'; t.classList.add('gd-win'); }
  let seen=null; try{ seen=localStorage.getItem('tt_burst_'+id); localStorage.setItem('tt_burst_'+id,'1'); }catch(e){}
  if(seen && !/[?&]fandemo=3/.test(location.search)) return;
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  setTimeout(function(){ shamrockBurst(document.getElementById('gdClock')); },350);
}
function shamrockBurst(from){
  if(!from) return;
  const r=from.getBoundingClientRect(), small=window.innerWidth<640, n=small?18:30;
  const box=document.createElement('div'); box.className='shamrock-burst';
  box.style.left=(r.left+r.width/2)+'px'; box.style.top=(r.top+r.height/2)+'px';
  for(let i=0;i<n;i++){
    const sp=document.createElement('span'), rnd=Math.random;
    sp.textContent=i%6===0?'🏀':'☘️';
    sp.style.setProperty('--dx',((rnd()*2-1)*(small?170:400)).toFixed(0)+'px');
    sp.style.setProperty('--up',(-(15+rnd()*(small?55:75))).toFixed(0)+'px');
    sp.style.setProperty('--dy',(200+rnd()*(small?300:380)).toFixed(0)+'px');
    sp.style.setProperty('--r',((rnd()*2-1)*540).toFixed(0)+'deg');
    sp.style.setProperty('--s',((small?15:19)+rnd()*(small?9:13)).toFixed(0)+'px');
    sp.style.setProperty('--d',(rnd()*.3).toFixed(2)+'s');
    box.appendChild(sp);
  }
  document.body.appendChild(box);
  setTimeout(function(){ box.remove(); },2700);
}
let gdTimer=null;
function startGameDayCountdown(iso,done){
  const el=document.getElementById('gdClock'); if(!el) return;
  if(gdTimer) clearInterval(gdTimer);
  if(done){ el.innerHTML='<span class="gd-clocklabel">FINAL</span>'; return; }
  const target=new Date(iso).getTime(), pad=n=>String(n).padStart(2,'0');
  function tick(){
    if(document.hidden) return;   // background tab: nothing to draw
    let diff=target-Date.now();
    if(diff<=0){ el.innerHTML='<span class="gd-live">● LIVE</span>'; setGameLink(null,'live'); if(gdTimer) clearInterval(gdTimer); if(Date.now()-gdLastPoll>20000) pollGame(); return; }
    const h=Math.floor(diff/36e5); diff-=h*36e5;
    const m=Math.floor(diff/6e4); diff-=m*6e4;
    const s=Math.floor(diff/1e3);
    el.innerHTML='<span class="gd-clocklabel">TIP-OFF IN</span> <span class="gd-clocktime">'+pad(h)+':'+pad(m)+':'+pad(s)+'</span>';
  }
  tick(); gdTimer=setInterval(tick,1000);
}

/* ----- courtside ticker: last result + live record/seed/streak ----- */
async function fillTicker(last){
  if(gamedayShown) return;   // game-day banner already carries the story
  const bar=document.querySelector('.shotclock-bar'); if(!bar) return;
  const lastEl=document.getElementById('tkLast');
  if(lastEl&&last){
    try{
      const g=parseGame(last), bs=scoreOf(g.bos), os=scoreOf(g.opp), win=bs>os;
      const abbr=g.opp.team.abbreviation||'';
      lastEl.innerHTML='<span class="tk-lbl">Last</span>'+
        '<span class="'+(win?'tk-w':'tk-l')+'">'+(win?'W':'L')+' '+bs+'-'+os+'</span>'+
        '<img src="'+teamLogo(abbr)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">'+
        '<span>'+(g.home?'vs':'@')+' '+abbr+'</span>';
      lastEl.style.display='';
    }catch(e){}
  }
  const recEl=document.getElementById('tkRec');
  if(recEl){
    try{
      const t=(await cachedFetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/bos',10)).team;
      const overall=((t.record&&t.record.items)||[]).find(x=>x.type==='total')||{};
      const S=n=>{ const s=(overall.stats||[]).find(x=>x.name===n); return s?s.value:null; };
      const w=S('wins'), l=S('losses'), seed=S('playoffSeed'), st=S('streak');
      const bits=[];
      if(w!=null&&l!=null) bits.push('<span>'+Math.round(w)+'-'+Math.round(l)+'</span>');
      if(seed!=null) bits.push('<span>#'+Math.round(seed)+' East</span>');
      if(st) bits.push('<span class="'+(st>0?'tk-w':'tk-l')+'">'+(st>0?'W':'L')+Math.abs(Math.round(st))+'</span>');
      if(bits.length){
        recEl.innerHTML='<span class="tk-lbl">Celtics</span>'+bits.join('<span class="tk-dot">·</span>');
        recEl.style.display='';
      }
    }catch(e){}
  }
  /* must be an explicit 'block': the stylesheet default is display:none, and
     setting '' just clears the inline style, letting that default win again -
     which is why the original shot-clock bar never actually appeared. */
  bar.style.display='block';
}

function renderSchedList(events){
  const box=document.getElementById('schedList'); if(!box) return;
  if(!events||!events.length){ box.className=''; box.innerHTML='<div class="no-results">No games to show yet — the 2026–27 schedule is on the way. ☘️</div>'; return; }
  const isDone=ev=>{ const c=ev.competitions&&ev.competitions[0]; return !!(c&&c.status&&c.status.type&&c.status.type.completed); };
  function gameCard(ev){
    const g=parseGame(ev), comp=g.comp||{};
    const d=new Date(ev.date);
    const done=g.status&&g.status.type&&g.status.type.completed;
    const abbr=g.opp.team.abbreviation||'';
    const opp=abbr||g.opp.team.shortDisplayName||'';
    const url=gamePageUrl(ev);
    const bcast=((comp.broadcasts||[]).map(x=>x.media&&x.media.shortName).filter(Boolean))[0]||((comp.geoBroadcasts||[]).map(x=>x.media&&x.media.shortName).filter(Boolean))[0]||'';
    const note=(comp.notes&&comp.notes[0]&&comp.notes[0].headline)||'';
    const venue=(comp.venue&&comp.venue.fullName)||'';
    let res;
    if(done){ const bs=scoreOf(g.bos),os=scoreOf(g.opp),win=bs>os; res='<div class="cal-res '+(win?'ww':'ll')+'">'+(win?'W':'L')+' '+bs+'-'+os+'</div>'; }
    else { res='<div class="cal-res up">'+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})+'</div>'; }
    const foot=(bcast||note)?('<div class="cal-foot">'+(note?'<span class="cal-note">'+shortNote(note)+'</span>':'')+(bcast?'<span class="cal-tv">📺 '+escHtml(bcast)+'</span>':'')+'</div>'):'';
    const card=document.createElement(url?'a':'div'); card.className='cal-card';
    if(url){ card.href=url; card.target='_blank'; card.rel='noopener'; }
    card.title=[venue,note].filter(Boolean).join(' · ');
    card.innerHTML=
      '<div class="cal-top">'+d.toLocaleDateString(undefined,{month:'short'})+'</div>'+
      '<div class="cal-day">'+d.getDate()+'</div>'+
      '<div class="cal-dow">'+d.toLocaleDateString(undefined,{weekday:'short'})+'</div>'+
      '<div class="cal-match"><span class="cal-vs">'+(g.home?'vs':'@')+'</span><img src="'+teamLogo(abbr)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'"><b>'+escHtml(opp)+'</b></div>'+
      res+foot;
    return card;
  }
  // one month at a time with ‹ › arrows, instead of the whole season at once
  const groups=[]; const gIdx={};
  events.forEach(ev=>{
    const d=new Date(ev.date); const k=d.getFullYear()*12+d.getMonth();
    if(gIdx[k]==null){ gIdx[k]=groups.length; groups.push({label:d.toLocaleDateString(undefined,{month:'long',year:'numeric'}),events:[]}); }
    groups[gIdx[k]].events.push(ev);
  });
  // open on the month holding the next game still to play (or the final month)
  let page=groups.findIndex(g=>g.events.some(ev=>!isDone(ev)));
  if(page<0) page=groups.length-1;
  box.className='';
  function draw(){
    box.innerHTML='';
    if(groups.length>1){
      const nav=document.createElement('div'); nav.className='cal-nav';
      const mk=(d,dis,lbl,txt)=>{ const b=document.createElement('button'); b.className='cal-arrow'; b.type='button'; b.disabled=dis; b.setAttribute('aria-label',lbl); b.textContent=txt; b.onclick=function(){ page+=d; draw(); }; return b; };
      nav.appendChild(mk(-1,page<=0,'Earlier month','‹'));
      const lab=document.createElement('span'); lab.className='cal-month'; lab.textContent=groups[page].label; nav.appendChild(lab);
      nav.appendChild(mk(1,page>=groups.length-1,'Later month','›'));
      box.appendChild(nav);
    }
    const grid=document.createElement('div'); grid.className='cal-grid';
    groups[page].events.forEach(ev=>grid.appendChild(gameCard(ev)));
    box.appendChild(grid);
  }
  draw();
}
function shortNote(n){ return escHtml(n||'').replace(/Eastern Conference|Western Conference/gi,'').replace(/\bEast\b|\bWest\b/g,'').replace(/\s*-\s*/g,' · ').replace(/Game (\d)/gi,'G$1').replace(/\s+/g,' ').trim(); }

async function loadStandings(){
  const box=document.getElementById('standCard');
  const tbox=document.getElementById('standTables');
  if(box) box.innerHTML='<div class="skel" style="height:150px"></div>';
  if(tbox) tbox.innerHTML='<div class="skel" style="height:220px;margin-top:18px"></div>';
  if(box){
    try{
      const t=(await cachedFetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/bos',10)).team;
      const overall=((t.record&&t.record.items)||[]).find(x=>x.type==='total')||{};
      const S=n=>{ const s=(overall.stats||[]).find(x=>x.name===n); return s?s.value:null; };
      const wins=S('wins'),losses=S('losses'),seed=S('playoffSeed'),wp=S('winPercent'),gb=S('gamesBehind'),diff=S('differential'),pf=S('avgPointsFor'),pa=S('avgPointsAgainst');
      const f=(v,d)=>v==null?'—':(+v).toFixed(d==null?1:d), r=v=>v==null?'—':Math.round(v);
      const items=(t.record&&t.record.items)||[];
      const home=(items.find(x=>x.type==='home')||{}).summary||'', road=(items.find(x=>x.type==='road')||{}).summary||'', streakV=S('streak');
      const splits='<div class="stand-splits">'+(streakV?'<span><b>'+(streakV>0?'W':'L')+Math.abs(Math.round(streakV))+'</b> Streak</span>':'')+(home?'<span><b>'+escHtml(home)+'</b> Home</span>':'')+(road?'<span><b>'+escHtml(road)+'</b> Road</span>':'')+'</div>';
      box.innerHTML='<div class="stand-card">'+
        '<div class="stand-rank"><div class="seed">#'+r(seed)+'<small>East Seed</small></div><div class="rec">'+r(wins)+'-'+r(losses)+'</div></div>'+
        '<div class="stand-meta">'+
          '<div class="m"><b>'+(wp!=null?('.'+Math.round(wp*1000)):'—')+'</b><span>Win %</span></div>'+
          '<div class="m"><b>'+((gb==null||gb<=0)?'—':f(gb))+'</b><span>Games Back</span></div>'+
          '<div class="m"><b>'+f(pf)+'</b><span>PPG</span></div>'+
          '<div class="m"><b>'+f(pa)+'</b><span>Opp PPG</span></div>'+
        '</div>'+
        splits+
        '<div class="stand-summary">'+(t.standingSummary||'')+(diff!=null?(' · '+(diff>0?'+':'')+f(diff)+' avg margin'):'')+'</div>'+
      '</div>';
    }catch(e){ box.innerHTML='<div class="no-results">Standings will appear here during the season.</div>'; }
  }
  if(tbox){
    try{
      const groups=await fetchStandingsGroups();
      tbox.innerHTML = groups.length ? ('<div class="stand-sub">Full League</div><div class="stand-tables">'+groups.map(renderConf).join('')+'</div>')
        : '<div class="no-results" style="margin-top:18px">Full league standings will appear during the season.</div>';
    }catch(e){ tbox.innerHTML='<div class="no-results" style="margin-top:18px">Full league standings are unavailable right now.</div>'; }
  }
}
async function fetchStandingsGroups(){
  try{   // lighter feed, populated during the season
    const d=await cachedFetch('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3',30);
    const g=(d.children||[]).map(c=>({name:c.name,entries:(c.standings&&c.standings.entries)||[]}));
    if(g.some(x=>x.entries.length)) return g;
  }catch(e){}
  // offseason fallback — full final standings
  const d2=await cachedFetch('https://cdn.espn.com/core/nba/standings?xhr=1',30);
  return ((d2.content&&d2.content.standings&&d2.content.standings.groups)||[]).map(c=>({name:c.name,entries:(c.standings&&c.standings.entries)||[]}));
}
function renderConf(g){
  const rows=(g.entries||[]).map((e,i)=>{
    const S=n=>{ const s=(e.stats||[]).find(x=>x.name===n); return s?s.displayValue:''; };
    const w=S('wins'),l=S('losses'); let gb=S('gamesBehind');
    if(gb==='-'||gb==='0'||gb==='0.0'||gb==='') gb='—';
    const abbr=(e.team&&e.team.abbreviation)||'';
    const name=(e.team&&(e.team.shortDisplayName||e.team.displayName))||abbr;
    const rank=i+1, zone=rank<=6?'pk':(rank<=10?'pi':'out'), isBos=abbr==='BOS';
    return '<a class="st-row'+(isBos?' bos':'')+'" href="https://www.espn.com/nba/team/_/name/'+abbr.toLowerCase()+'" target="_blank" rel="noopener">'+
      '<span class="rk '+zone+'">'+rank+'</span>'+
      '<span class="tm"><img src="'+teamLogo(abbr)+'" alt="" onerror="this.style.display=\'none\'"><b>'+escHtml(name)+'</b></span>'+
      '<span class="wl">'+w+'-'+l+'</span>'+
      '<span class="gb">'+gb+'</span></a>';
  }).join('');
  return '<div class="conf-table"><div class="conf-head">'+(g.name||'Conference')+'</div>'+
    '<div class="st-head"><span></span><span>Team</span><span>W-L</span><span>GB</span></div>'+rows+'</div>';
}

const onThisDay=[
  {md:'06-17', text:'<b>June 17</b> is golden in Boston — the Celtics clinched Banner 17 in 2008 (over the Lakers) and, 16 years to the day, Banner 18 in 2024 (over the Mavericks).'},
  {md:'06-12', text:'On <b>June 12, 1984</b>, Boston beat the Lakers in a Game 7 at the Garden to win the NBA Finals — a defining chapter of the rivalry.'},
  {md:'04-13', text:'On <b>April 13, 1957</b>, the Celtics won their first-ever championship, edging the St. Louis Hawks in a double-overtime Game 7.'},
  {md:'07-31', text:'On <b>July 31, 2007</b>, Boston acquired Kevin Garnett from Minnesota, completing the "Big Three" that would deliver Banner 17.'},
  {md:'06-28', text:'On <b>June 28, 2007</b>, the Celtics traded for Ray Allen on draft night — the first move toward the 2008 title.'},
  {md:'06-09', text:'On <b>June 9, 1978</b>, the Celtics drafted <b>Larry Bird</b> sixth overall — one of the greatest picks in NBA history.'},
  {md:'04-15', text:'On <b>April 15, 1965</b>, John Havlicek made his legendary steal — "Havlicek stole the ball!" — to seal a Game 7 win over the 76ers.'},
  {md:'08-11', text:'On <b>August 11, 2022</b>, the NBA retired <b>Bill Russell’s No. 6</b> across the entire league — the first leaguewide retirement in NBA history.'},
  {md:'12-07', text:'Celtics legend <b>Larry Bird</b> was born on <b>December 7, 1956</b>, in West Baden Springs, Indiana.'},
  {md:'02-12', text:'The greatest winner in team sports, <b>Bill Russell</b>, was born on <b>February 12, 1934</b>.'},
  {md:'10-13', text:'Celtics great <b>Paul Pierce</b> — "The Truth" — was born on <b>October 13, 1977</b>.'}
];
const celticsQuotes=[
  {q:'The only important statistic is the final score.', who:'Bill Russell'},
  {q:'The idea is not to block every shot. The idea is to make your opponent believe that you might block every one.', who:'Bill Russell'},
  {q:'Concentration and mental toughness are the margins of victory.', who:'Bill Russell'},
  {q:'Winning is a habit. Unfortunately, so is losing.', who:'Red Auerbach'},
  {q:'It’s not what you tell your players that counts. It’s what they hear.', who:'Red Auerbach'},
  {q:'Push yourself again and again. Don’t give an inch until the final buzzer sounds.', who:'Larry Bird'},
  {q:'Leadership is getting players to believe in you.', who:'Larry Bird'},
  {q:'A winner is someone who recognizes his talents, works his tail off to develop them, and uses them to reach his goals.', who:'Larry Bird'},
  {q:'Anything is possible!', who:'Kevin Garnett'},
  {q:'I am The Truth.', who:'Paul Pierce'}
];
/* ---- Question of the Day: Celtics trivia; guesses stored in Supabase so fans
        see how everyone did. Rotates daily through the bank below (same question
        for every visitor). One guess per browser, like reactions. ---- */
const TRIVIA=[
  {id:'russell-rings',q:'How many NBA championships did Bill Russell win as a player?',c:['9','10','11','13'],a:2,fun:'Eleven titles in thirteen seasons (1957-1969), the last two as player-coach - the most championships of any player in NBA history.'},
  {id:'bird-number',q:'What jersey number did Larry Bird wear in Boston?',c:['7','32','33','35'],a:2,fun:'No. 33 was raised to the rafters in 1993. No. 32 belongs to Kevin McHale.'},
  {id:'top-scorer',q:"Who is the Celtics' all-time leading scorer?",c:['Larry Bird','John Havlicek','Paul Pierce','Jayson Tatum'],a:1,fun:'Hondo racked up 26,395 points - with Pierce (24,021) second and Bird third.'},
  {id:'founded',q:'In what year were the Boston Celtics founded?',c:['1936','1946','1950','1957'],a:1,fun:'A charter member of the BAA in 1946, which became the NBA in 1949.'},
  {id:'fmvp-2024',q:'Who won Finals MVP when the Celtics raised Banner 18 in 2024?',c:['Jayson Tatum','Jaylen Brown','Derrick White','Kristaps Porzingis'],a:1,fun:'Jaylen Brown took home both the Conference Finals MVP and the Finals MVP that run.'},
  {id:'stole-ball',q:'"Havlicek stole the ball!" - against which team did that famous play happen?',c:['Lakers','Knicks','76ers','Hawks'],a:2,fun:"Game 7 of the 1965 East finals vs Philadelphia - Johnny Most's call became the most famous line in Boston sports radio."},
  {id:'eight-straight',q:'Which coach led the Celtics to eight straight championships?',c:['Red Auerbach','Bill Russell','Tommy Heinsohn','Doc Rivers'],a:0,fun:'1959 through 1966 - a streak no team in any major American sport has matched.'},
  {id:'first-black-coach',q:'Who became the first Black head coach in major American pro sports - as a Celtic?',c:['K.C. Jones','Bill Russell','Sam Jones','Satch Sanders'],a:1,fun:'Russell took over as player-coach in 1966 and won two titles wearing both hats.'},
  {id:'tatum-pick',q:'What pick was Jayson Tatum in the 2017 NBA Draft?',c:['1st overall','3rd overall','5th overall','13th overall'],a:1,fun:'Boston traded down from No. 1, let Philly take Markelle Fultz, and still got their guy at three.'},
  {id:'bird-college',q:'Where did Larry Bird play college basketball?',c:['Indiana','Indiana State','Purdue','Kansas'],a:1,fun:"He carried Indiana State to the 1979 title game against Magic Johnson's Michigan State - still the highest-rated college hoops broadcast ever."},
  {id:'third-big3',q:'Pierce, Garnett, and who completed the 2008 "Big Three"?',c:['Rajon Rondo','Ray Allen','Rasheed Wallace','James Posey'],a:1,fun:'Allen arrived in a draft-night trade with Seattle in 2007 - Banner 17 followed one year later.'},
  {id:'sixty-points',q:'Who was the FIRST Celtic to score 60 points in a game?',c:['Larry Bird','Isaiah Thomas','Jayson Tatum','Paul Pierce'],a:0,fun:"Bird dropped 60 on Atlanta in March 1985 - nine days after Kevin McHale set the record with 56. Jayson Tatum tied the mark with his own 60-point night in 2021."},
  {id:'the-truth',q:'Which NBA legend gave Paul Pierce the nickname "The Truth"?',c:['Michael Jordan','Kobe Bryant',"Shaquille O'Neal",'Charles Barkley'],a:2,fun:'After a 42-point Pierce night against the Lakers in 2001, Shaq told reporters: "Paul Pierce is the truth."'},
  {id:'banner18-opp',q:'Which team did Boston beat in the 2024 Finals for Banner 18?',c:['Nuggets','Mavericks','Timberwolves','Thunder'],a:1,fun:'A 4-1 series win over Dallas made the Celtics the winningest franchise in NBA history.'},
  {id:'kg-trade',q:'Which team traded Kevin Garnett to the Celtics in 2007?',c:['Timberwolves','Nets','Bucks','Warriors'],a:0,fun:'July 31, 2007 - the biggest trade in franchise history sent seven players and picks to Minnesota for the Big Ticket.'},
  {id:'leprechaun',q:"What is the name of the leprechaun on the Celtics' logo?",c:['Shamus','Lucky','Paddy','Clover'],a:1,fun:"Lucky was drawn by Zang Auerbach - Red Auerbach's brother."},
  {id:'cowens-mvp',q:'Which undersized Celtics center won the 1973 NBA MVP award?',c:['Dave Cowens','Robert Parish','Bill Russell','Kendrick Perkins'],a:0,fun:"At 6'9\" Cowens gave up inches to every rival center - and outworked all of them, averaging 20 and 16 that season."},
  {id:'double-zero',q:'Which Celtics legend wore No. 00?',c:['Dennis Johnson','Robert Parish','Jo Jo White','Cedric Maxwell'],a:1,fun:'The Chief - who also played more games than anyone in NBA history (1,611).'},
  {id:'cousy-nickname',q:'What was Bob Cousy\'s nickname?',c:['The Truth','The Houdini of the Hardwood','The Hick from French Lick','Mr. Clutch'],a:1,fun:'Cousy led the NBA in assists eight straight seasons and won the 1957 MVP.'},
  {id:'triple-ot',q:'The legendary triple-overtime Game 5 of the 1976 Finals came against which team?',c:['Suns','Lakers','Bucks','Warriors'],a:0,fun:'Many still call it the greatest game ever played. Jo Jo White logged 60 minutes and won Finals MVP.'},
  {id:'tommy-points',q:'Which Celtics legend handed out "Tommy Points" as a beloved broadcaster?',c:['Bob Cousy','Tommy Heinsohn','Cedric Maxwell','Brian Scalabrine'],a:1,fun:'Heinsohn is in the Hall of Fame twice - as a player AND as a coach - and was part of all 17 pre-2024 banners as player, coach, or broadcaster.'},
  {id:'tatum-college',q:'Where did Jayson Tatum play his one college season?',c:['Kentucky','North Carolina','Duke','Kansas'],a:2,fun:'One year in Durham under Coach K, then straight to the Garden.'},
  {id:'russell-trade',q:'Boston landed the draft rights to Bill Russell in a 1956 trade with which team?',c:['St. Louis Hawks','Rochester Royals','Syracuse Nationals','Fort Wayne Pistons'],a:0,fun:'Red Auerbach sent Ed Macauley and Cliff Hagan to St. Louis for the pick - arguably the greatest trade ever made.'},
  {id:'pierce-number',q:'What jersey number did Paul Pierce wear for the Celtics?',c:['3','24','34','44'],a:2,fun:'No. 34 went to the rafters in 2018 after fifteen seasons of The Truth in green.'},
  {id:'kg-number',q:'What number did Kevin Garnett wear in Boston?',c:['5','7','20','21'],a:0,fun:'KG\'s No. 5 was retired in March 2022 at TD Garden.'},
  {id:'victory-cigar',q:'What did Red Auerbach famously light up on the bench once a win was locked in?',c:['A cigar','A pipe','A cigarette','A candle'],a:0,fun:'The victory cigar drove opponents crazy - which was exactly the point.'},
  {id:'walton-6moy',q:"Which big man came off the bench for the legendary '86 champs and won Sixth Man of the Year?",c:['Bill Walton','Kevin McHale','Jerry Sichting','Scott Wedman'],a:0,fun:'Walton played all but two regular-season games that year - his healthiest season in a decade - behind Parish and McHale.'},
  {id:'clincher-39',q:'By how many points did Boston win the 2008 title-clinching Game 6 over the Lakers?',c:['12','24','39','50'],a:2,fun:'131-92. The 39-point margin is still the largest ever in an NBA championship clincher.'},
  {id:'cousy-28',q:'Who holds the Celtics record with 28 assists in a single game?',c:['Bob Cousy','Rajon Rondo','Derrick White','Sherman Douglas'],a:0,fun:'Cousy dished 28 against Minneapolis in 1959 - before the three-point line even existed.'},
  {id:'king-fourth',q:'Which 5-foot-9 Celtic was nicknamed "The King in the Fourth"?',c:['Nate Robinson','Isaiah Thomas','Kemba Walker','Payton Pritchard'],a:1,fun:'IT averaged 28.9 a game in 2016-17 and led the league in fourth-quarter scoring.'},
  {id:'founder',q:'Who founded the Boston Celtics in 1946?',c:['Red Auerbach','Walter Brown','Abe Saperstein','Eddie Gottlieb'],a:1,fun:'Brown ran the Boston Garden and bet on pro basketball when few believed in it. The old championship trophy carried his name.'},
  {id:'chuck-cooper',q:'In 1950, the Celtics made history by drafting the first Black player ever taken by an NBA team. Who?',c:['Chuck Cooper','Earl Lloyd','Nat Clifton','Don Barksdale'],a:0,fun:'When warned other owners might object, Walter Brown replied: "I don\'t care if he\'s striped, plaid or polka dot."'},
  {id:'bird-3pt',q:'How many of the NBA\'s first three 3-point contests did Larry Bird win?',c:['One','Two','All three','None'],a:2,fun:'1986, 1987, 1988. He once walked into the locker room and asked the field: "Who\'s playing for second?"'},
  {id:'maxwell-81',q:'Who was Finals MVP when Boston won the 1981 championship?',c:['Larry Bird','Cedric Maxwell','Robert Parish','Tiny Archibald'],a:1,fun:'Cornbread carried the Finals against Houston - and told everyone to hop on his back in the \'84 series too.'},
  {id:'french-lick',q:'Larry Bird grew up in which Indiana town?',c:['Terre Haute','Bloomington','French Lick','Muncie'],a:2,fun:'Hence the nickname: The Hick from French Lick.'},
  {id:'russell-six',q:'In 2022, the NBA retired a Celtics number across the ENTIRE league. Whose?',c:['Larry Bird\'s 33','Bill Russell\'s 6','Bob Cousy\'s 14','John Havlicek\'s 17'],a:1,fun:'The first leaguewide number retirement in NBA history - every team, forever.'},
  {id:'stevens-butler',q:'Before Boston, Brad Stevens coached which college to back-to-back national title games?',c:['Butler','Gonzaga','Villanova','Xavier'],a:0,fun:'Butler in 2010 and 2011 - then 8 seasons on the Celtics bench before moving up to run the front office.'},
  {id:'horford-country',q:'Al Horford was the first player from which country to win an NBA title with the 2024 Celtics roster?',c:['Puerto Rico','Dominican Republic','Venezuela','Panama'],a:1,fun:'Big Al finally got his ring in 2024 after 186 career playoff games - the most ever before a first championship.'},
  {id:'smart-dpoy',q:'Which Celtic won the 2022 Defensive Player of the Year award?',c:['Marcus Smart','Robert Williams III','Derrick White','Jrue Holiday'],a:0,fun:'The first guard to win it since Gary Payton in 1996.'},
  {id:'parquet-wwii',q:'Why was the original parquet floor made of short criss-crossed wood pieces?',c:['It looked stylish','A post-WWII lumber shortage','It bounced better','League rules required it'],a:1,fun:'Built in 1946 from red-oak scraps because long boards were scarce after the war. The style became the most famous floor in basketball.'},
  {id:'sam-jones-10',q:'Which Celtic won 10 championships - second only to Bill Russell?',c:['Bob Cousy','K.C. Jones','Sam Jones','Tommy Heinsohn'],a:2,fun:'The bank-shot master went 10-for-11 in Finals appearances.'},
  {id:'ainge-jays',q:'Before his NBA career, Danny Ainge played pro baseball for which team?',c:['Red Sox','Toronto Blue Jays','Yankees','Cubs'],a:1,fun:'Three MLB seasons as a Blue Jays infielder before choosing basketball - then two rings as a Celtics guard and one more as the GM who built the 2008 champs.'},
  {id:'dee-brown-dunk',q:'Which Celtic won the 1991 Dunk Contest with a no-look dunk - after pumping up his sneakers?',c:['Dee Brown','Gerald Green','Antoine Walker','Dana Barros'],a:0,fun:'He pumped his Reebok Pumps at the free-throw line, covered his eyes, and threw it down. Instant legend.'}
];
function triviaToday(){ return dayOfYear(new Date())%TRIVIA.length; }
function triviaKey(id){ return 'tt_trivia_'+id; }
function renderTrivia(){
  const box=document.getElementById('triviaCard'); if(!box) return;
  const i=triviaToday(), t=TRIVIA[i];
  box.style.display='';
  let mine=null; try{ const v=localStorage.getItem(triviaKey(t.id)); if(v!=null&&v!=='') mine=+v; }catch(e){}
  if(mine==null||isNaN(mine)){
    box.innerHTML='<div class="tr-label">🏀 Question of the Day</div><div class="tr-q">'+t.q+'</div>'+
      '<div class="tr-choices">'+t.c.map(function(c,ci){ return '<button class="tr-btn" type="button" data-c="'+ci+'">'+escHtml(c)+'</button>'; }).join('')+'</div>';
    box.querySelectorAll('.tr-btn').forEach(function(b){ b.onclick=function(){ answerTrivia(i,+b.dataset.c); }; });
  } else {
    renderTriviaResults(i,mine);
  }
}
function answerTrivia(i,choice){
  const t=TRIVIA[i];
  try{ localStorage.setItem(triviaKey(t.id),String(choice)); }catch(e){}
  if(commentsReady()){
    fetch(commentsConfig.url+'/rest/v1/trivia_votes',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json',Prefer:'return=minimal'},chead()),
      body:JSON.stringify({question_id:t.id,choice:choice})
    }).catch(function(){});
  }
  renderTriviaResults(i,choice);
}
function renderTriviaResults(i,mine){
  const box=document.getElementById('triviaCard'); if(!box) return;
  const t=TRIVIA[i], good=(mine===t.a);
  box.innerHTML='<div class="tr-label">🏀 Question of the Day</div><div class="tr-q">'+t.q+'</div>'+
    '<div class="tr-verdict '+(good?'good':'bad')+'">'+(good?'☘️ You got it!':'Not this one - the answer is '+escHtml(t.c[t.a])+'.')+'</div>'+
    '<div id="triviaBars"></div>'+
    (t.fun?'<div class="tr-fun">'+t.fun+'</div>':'')+
    '<div class="tr-meta" id="triviaMeta"></div>';
  const bars=document.getElementById('triviaBars'), meta=document.getElementById('triviaMeta');
  function paint(counts,total){
    bars.innerHTML=t.c.map(function(c,ci){
      const n=counts[ci]||0, pct=total?Math.round(n*100/total):0;
      return '<div class="tr-row'+(ci===t.a?' correct':'')+'">'+
        '<span class="tr-name'+(ci===t.a?' correct':'')+'"><b>'+escHtml(c)+'</b>'+(ci===mine?'<span class="tr-you">← you</span>':'')+'</span>'+
        '<span class="tr-bar"><span class="tr-fill" style="width:'+pct+'%"></span></span>'+
        '<span class="tr-pct">'+pct+'%</span></div>';
    }).join('');
    if(total>1){
      const rightPct=Math.round((counts[t.a]||0)*100/total);
      meta.textContent=rightPct+'% of fans got it right · '+total+' guesses';
    } else {
      meta.textContent='You’re the first to guess today - check back later to see how other fans did.';
    }
  }
  const seed={}; seed[mine]=1; paint(seed,1);   // instant feedback; live totals replace it below
  if(!commentsReady()) return;
  fetch(commentsConfig.url+'/rest/v1/trivia_votes?select=choice&question_id=eq.'+encodeURIComponent(t.id),{headers:chead()})
    .then(function(r){ return r.ok?r.json():Promise.reject(); })
    .then(function(rows){
      const c={}; rows.forEach(function(r){ c[r.choice]=(c[r.choice]||0)+1; });
      if(rows.length) paint(c,rows.length);
    })
    .catch(function(){ /* table not set up yet - the local reveal above still works */ });
}

/* ---- Game-Day Pick'em + Player of the Game (shared fan_picks table in
        Supabase; see SETUP-FAN-PICKS.txt). Pick'em: call the next game before
        tip-off, get graded automatically from the final score, build a streak
        (stored per browser). POTG: vote the best player after each game.
        Everything hides itself in the offseason. Test with ?fandemo=1. ---- */
const PICK_OPTS=[
  {id:'w-big',label:'Celtics by 10+'},
  {id:'w-close',label:'Celtics by 1-9'},
  {id:'l',label:'Opponent wins'}
];
function pickLabel(id){ const o=PICK_OPTS.find(function(x){ return x.id===id; }); return o?o.label:id; }
function fanPost(kind,key,choice){
  if(!commentsReady()) return;
  fetch(commentsConfig.url+'/rest/v1/fan_picks',{
    method:'POST',
    headers:Object.assign({'Content-Type':'application/json',Prefer:'return=minimal'},chead()),
    body:JSON.stringify({kind:kind,key:String(key),choice:choice})
  }).catch(function(){});
}
function fanCounts(kind,key){
  if(!commentsReady()) return Promise.reject();
  return fetch(commentsConfig.url+'/rest/v1/fan_picks?select=choice&kind=eq.'+kind+'&key=eq.'+encodeURIComponent(key),{headers:chead()})
    .then(function(r){ return r.ok?r.json():Promise.reject(); })
    .then(function(rows){ const c={}; rows.forEach(function(r){ c[r.choice]=(c[r.choice]||0)+1; }); return {counts:c,total:rows.length}; });
}
function fanBars(host,options,counts,total,winnerId,youId){
  if(!host||!total) return;
  host.innerHTML=options.map(function(o){
    const n=counts[o.id]||0, pct=Math.round(n*100/total);
    return '<div class="tr-row'+(o.id===winnerId?' correct':'')+'">'+
      '<span class="tr-name'+(o.id===winnerId?' correct':'')+'"><b>'+escHtml(o.label)+'</b>'+(o.id===youId?'<span class="tr-you">← you</span>':'')+'</span>'+
      '<span class="tr-bar"><span class="tr-fill" style="width:'+pct+'%"></span></span>'+
      '<span class="tr-pct">'+pct+'%</span></div>';
  }).join('');
}
/* pick'em on the NEXT game card */
function renderPickem(ev){
  const card=document.getElementById('nextCard'); if(!card||!ev||!ev.id) return;
  const key='tt_pick_'+ev.id;
  let mine=null; try{ mine=localStorage.getItem(key); }catch(e){}
  const div=document.createElement('div'); div.className='fan-block'; card.appendChild(div);
  function locked(choice){
    div.innerHTML='<div class="fan-lbl">🎯 Fan Pick\'em</div>'+
      '<div class="fan-note">Locked in: <b style="color:#fff">'+escHtml(pickLabel(choice))+'</b> - graded automatically after the final buzzer.</div>'+
      '<div class="fan-bars" id="pkBars"></div>';
    fanCounts('pickem',ev.id).then(function(res){ fanBars(document.getElementById('pkBars'),PICK_OPTS,res.counts,res.total,null,choice); }).catch(function(){});
  }
  if(mine){ locked(mine); return; }
  div.innerHTML='<div class="fan-lbl">🎯 Fan Pick\'em - your call?</div>'+
    '<div class="fan-btns">'+PICK_OPTS.map(function(o){ return '<button class="fan-btn" type="button" data-p="'+o.id+'">'+o.label+'</button>'; }).join('')+'</div>';
  div.querySelectorAll('.fan-btn').forEach(function(b){
    b.onclick=function(){ try{ localStorage.setItem(key,b.dataset.p); }catch(e){} fanPost('pickem',ev.id,b.dataset.p); locked(b.dataset.p); };
  });
}
/* pick result + POTG on the LAST game card */
function addLastFan(ev,g){
  const card=document.getElementById('lastCard'); if(!card||!ev||!ev.id) return;
  const done=g.status&&g.status.type&&g.status.type.completed; if(!done) return;   // never grade a live game
  const bs=scoreOf(g.bos), os=scoreOf(g.opp); if(bs==null||os==null) return;
  const margin=bs-os, actual=margin>=10?'w-big':(margin>0?'w-close':'l');
  const fresh=(Date.now()-new Date(ev.date).getTime())<7*864e5;   // POTG only while the game is recent
  let mine=null; try{ mine=localStorage.getItem('tt_pick_'+ev.id); }catch(e){}
  if(!mine&&!fresh) return;
  const div=document.createElement('div'); div.className='fan-block';
  let inner='';
  if(mine){
    const hit=(mine===actual);
    let st=0,w=0,tot=0;
    try{
      if(!localStorage.getItem('tt_pickdone_'+ev.id)){   // grade once, then remember
        localStorage.setItem('tt_pickdone_'+ev.id,'1');
        localStorage.setItem('tt_pick_streak',String(hit?(+(localStorage.getItem('tt_pick_streak')||0)+1):0));
        if(hit) localStorage.setItem('tt_pick_wins',String(+(localStorage.getItem('tt_pick_wins')||0)+1));
        localStorage.setItem('tt_pick_total',String(+(localStorage.getItem('tt_pick_total')||0)+1));
      }
      st=+(localStorage.getItem('tt_pick_streak')||0); w=+(localStorage.getItem('tt_pick_wins')||0); tot=+(localStorage.getItem('tt_pick_total')||0);
    }catch(e){}
    inner+='<div class="fan-lbl">🎯 Fan Pick\'em result</div>'+
      '<div class="fan-note">Your call: <b style="color:#fff">'+escHtml(pickLabel(mine))+'</b> '+
      (hit?'<span class="fan-good">✅ Nailed it!</span>':'<span class="fan-bad">❌ Not this time</span>')+
      (st>1?' <span class="fan-streak">🔥 '+st+' straight</span>':'')+
      (tot?' <span>· season '+w+'/'+tot+'</span>':'')+'</div>'+
      '<div class="fan-note" id="pkAcc"></div>';
  }
  if(fresh) inner+='<div class="fan-lbl"'+(mine?' style="margin-top:12px"':'')+'>🏅 Player of the Game - fan vote</div><div id="potgBox" class="fan-note">Loading roster…</div>';
  div.innerHTML=inner; card.appendChild(div);
  if(mine){
    fanCounts('pickem',ev.id).then(function(res){
      const el=document.getElementById('pkAcc');
      if(el&&res.total) el.textContent=Math.round((res.counts[actual]||0)*100/res.total)+'% of fans called it · '+res.total+' pick'+(res.total===1?'':'s');
    }).catch(function(){});
  }
  if(fresh) initPotg(ev);
}
function initPotg(ev){
  const box=document.getElementById('potgBox'); if(!box) return;
  let mine=null; try{ mine=localStorage.getItem('tt_potg_'+ev.id); }catch(e){}
  function results(v){
    box.innerHTML='<div class="fan-note" style="margin-top:0">Your vote: <b style="color:#fff">'+escHtml(v)+'</b></div><div class="fan-bars" id="potgBars"></div>';
    fanCounts('potg',ev.id).then(function(res){
      const names=Object.keys(res.counts).sort(function(a,b){ return res.counts[b]-res.counts[a]; }).slice(0,5);
      fanBars(document.getElementById('potgBars'), names.map(function(n){ return {id:n,label:n}; }), res.counts, res.total, names[0], v);
    }).catch(function(){});
  }
  if(mine){ results(mine); return; }
  cachedFetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/bos/roster',30).then(function(data){
    const players=(data.athletes||[]).map(function(a){ return {name:a.displayName,salary:(a.contracts&&a.contracts[0]&&a.contracts[0].salary)||0}; })
      .sort(function(a,b){ return b.salary-a.salary; }).slice(0,10);
    if(!players.length){ box.textContent='Roster unavailable right now.'; return; }
    box.innerHTML='<div class="fan-btns">'+players.map(function(p){ return '<button class="fan-btn" type="button" data-n="'+escHtml(p.name)+'">'+escHtml(p.name)+'</button>'; }).join('')+'</div>';
    box.querySelectorAll('.fan-btn').forEach(function(b){
      b.onclick=function(){ const n=b.dataset.n; try{ localStorage.setItem('tt_potg_'+ev.id,n); }catch(e){} fanPost('potg',ev.id,n); results(n); };
    });
  }).catch(function(){ box.textContent='Roster unavailable right now.'; });
}
/* offseason preview: ?fandemo=1 fakes a finished win + a game tomorrow */
function demoEvents(){
  function team(abbr,name){ return {abbreviation:abbr,shortDisplayName:name,displayName:name}; }
  function comp(bos,opp,completed,home,abbr,name){
    return {competitors:[
      {team:team('BOS','Celtics'),homeAway:home?'home':'away',score:bos},
      {team:team(abbr,name),homeAway:home?'away':'home',score:opp}
    ],status:{type:{completed:completed}}};
  }
  return {
    last:{id:'demo-last',date:new Date(Date.now()-864e5).toISOString(),links:[],competitions:[comp('112','104',true,true,'MIA','Heat')]},
    next:{id:'demo-next',date:new Date(Date.now()+864e5).toISOString(),links:[],competitions:[comp(null,null,false,false,'NY','Knicks')]}
  };
}

/* ---- Latest Celtics news (ESPN) + "Hear Dan's Take" when a post matches ---- */
const NEWS_STOP=new Set('the and for with from over into onto after before amid among sources source report reports says said will could would that this these those their they them his her but are was were has have had who what why how new off out top get gets going per via agree agrees agreed deal deals sign signs signed trade trades traded celtics boston nba wnba season seasons game games team teams star update updates latest full former next year years night day days more back grade grades grading preview recap analysis takeaways ranking rankings winners losers buzz tracker roundup breakdown primer offseason agency signing signings extension extensions insider mock reaction reactions takes free questions question'.split(' '));
function sigWords(s){
  return Array.from(new Set((s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>=4&&!/^\d+$/.test(w)&&!NEWS_STOP.has(w))));
}
function matchPost(headline){
  if(!Array.isArray(posts)||!posts.length) return null;
  const hw=sigWords(headline);
  if(hw.length<2) return null;
  const bodies=posts.map(postNorm);
  // document frequency of each headline word across Dan's posts
  const df={}; hw.forEach(function(w){ let d=0; bodies.forEach(function(b){ if(b.indexOf(w)>-1) d++; }); df[w]=d; });
  const half=posts.length*0.5;
  // score each post: rarer shared words weigh more (1/df); ignore words that are common across posts
  let best=null,bestW=0,bestN=0;
  bodies.forEach(function(b,i){
    let w=0,n=0;
    hw.forEach(function(word){ const d=df[word]; if(d>0&&d<=half&&b.indexOf(word)>-1){ w+=1/d; n++; } });
    if(w>bestW){ bestW=w; bestN=n; best=posts[i]; }
  });
  if(best && bestN>=2 && bestW>=1.2) return best;   // broad overlap: two+ distinctive shared words
  // strong single signal: a rare term unique to ONE post that also appears in that post's title
  for(let k=0;k<hw.length;k++){ const word=hw[k];
    if(df[word]===1 && word.length>=5){
      const idx=bodies.findIndex(function(b){ return b.indexOf(word)>-1; });
      if(idx>-1){ const t=(posts[idx].title||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); if(t.indexOf(word)>-1) return posts[idx]; }
    }
  }
  return null;
}
async function loadNews(){
  const box=document.getElementById('newsList'); if(!box) return;
  box.innerHTML='<div class="skel" style="height:72px"></div>'.repeat(3);
  try{
    const data=await cachedFetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?team=2&limit=8',30);
    const arts=(data.articles||[]).slice(0,3);
    if(!arts.length){ box.innerHTML='<div class="no-results">No Celtics headlines right now — check back soon.</div>'; return; }
    box.innerHTML=arts.map(function(a){
      const head=a.headline||a.title||'';
      const raw=(a.links&&a.links.web&&a.links.web.href)||(a.links&&a.links.mobile&&a.links.mobile.href)||'';
      const link=/^https?:\/\//i.test(raw)?escHtml(raw):'#';   // never a javascript: link from the feed
      const when=a.published?fmtDate(a.published):'';
      const post=matchPost(head);
      const take=post?('<a class="news-take" href="/post/'+encodeURIComponent(post.slug)+'/" data-post="'+escHtml(post.slug)+'"><span class="tk-ico">🎙️</span> Hear Dan’s Take</a>'):'';
      return '<div class="news-item"><div class="news-main"><a class="news-head" href="'+link+'" target="_blank" rel="noopener">'+escHtml(head)+'</a>'+
        '<div class="news-meta"><span class="news-src">ESPN</span>'+(when?'<span>· '+when+'</span>':'')+'</div></div>'+take+'</div>';
    }).join('');
  }catch(e){ box.innerHTML='<div class="no-results">Celtics headlines are unavailable right now.</div>'; }
}
function fillDayCard(id,ico,label,text){
  const el=document.getElementById(id); if(!el) return;
  el.innerHTML='<div class="td-ico">'+ico+'</div><div class="td-body"><div class="td-label">'+label+'</div><div class="td-text">'+text+'</div></div>';
}
function renderThisDay(){
  const now=new Date();
  const doy=dayOfYear(now);
  // Legend Quote of the Day (rotates daily)
  const qt=celticsQuotes[doy%celticsQuotes.length];
  fillDayCard('factDay','❝','Quote of the Day','<span class="td-quote">“'+qt.q+'”</span><span class="td-cite">— '+qt.who+'</span>');
  // On This Day — exact date match if we have one, else a rotating moment from Celtics history
  const md=String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const hit=onThisDay.find(x=>x.md===md);
  if(hit) fillDayCard('onThisDay','📅','On This Day',hit.text);
  else fillDayCard('onThisDay','📜','A Moment in Celtics History',onThisDay[doy%onThisDay.length].text);
}

/* left/right/home/end move between tabs in a tab bar (standard tablist keys) */
document.addEventListener('keydown',function(e){
  const t=e.target; if(!t||!t.getAttribute||t.getAttribute('role')!=='tab') return;
  const tabs=[...t.parentNode.querySelectorAll('[role=tab]')], i=tabs.indexOf(t);
  const j={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:tabs.length-1}[e.key];
  if(j==null) return;
  e.preventDefault(); const n=tabs[(j+tabs.length)%tabs.length]; n.focus(); n.click();
});
function wireTabs(){
  const loaders={'g-stand':loadStandings,'g-players':loadPlayers,'g-news':loadNews}, done={};
  document.querySelectorAll('.tabs').forEach(group=>{
    const section=group.closest('section');
    group.querySelectorAll('.tab').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.tab;
        group.querySelectorAll('.tab').forEach(b=>{ const on=b===btn; b.classList.toggle('active',on); b.setAttribute('aria-selected',on?'true':'false'); b.tabIndex=on?0:-1; });
        section.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===id));
        if(loaders[id] && !done[id]){ done[id]=true; loaders[id](); }  // lazy-load on first open
      });
    });
  });
}

/* ---- season-ending year ESPN uses (Oct+ counts toward next year) ---- */
function seasonYear(){ const d=new Date(); return d.getMonth()>=9 ? d.getFullYear()+1 : d.getFullYear(); }

/* ---- team leaders + injury report (roster call powers both) ---- */
async function loadPlayers(){
  const lg=document.getElementById('leadersGrid'), il=document.getElementById('injList'), tn=document.getElementById('teamNumbers');
  if(lg) lg.innerHTML='<div class="skel" style="height:80px"></div>'.repeat(6);
  if(il) il.innerHTML='<div class="skel" style="height:46px"></div>';
  if(tn) tn.innerHTML='<div class="skel" style="height:74px"></div>';
  let byId={};
  try{
    const roster=await cachedFetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/bos/roster',30);
    const athletes=roster.athletes||[];
    athletes.forEach(a=>{ byId[a.id]={name:a.displayName, img:(a.headshot&&a.headshot.href)||''}; });
    if(il){
      const hurt=athletes.filter(a=>a.injuries&&a.injuries.length);
      if(!hurt.length){ il.innerHTML='<div class="inj-none">✅ No injuries reported — the C’s are at full strength.</div>'; }
      else{
        il.innerHTML=hurt.map(a=>{
          const inj=a.injuries[0], st=(inj.status||'Questionable');
          const cls=/out/i.test(st)?'inj-out':'inj-dtd';
          const detail=(inj.details&&(inj.details.type||inj.details.detail))||inj.shortComment||'';
          return '<div class="inj-row"><div class="who">'+escHtml(a.displayName)+(detail?'<small>'+escHtml(detail)+'</small>':'')+'</div><div class="stat '+cls+'">'+escHtml(st)+'</div></div>';
        }).join('');
      }
    }
    if(tn) renderTeamNumbers(tn, athletes);
  }catch(e){ if(il) il.innerHTML='<div class="no-results">Injury data is unavailable right now.</div>'; if(tn) tn.innerHTML=''; }
  if(lg){
    try{
      const data=await cachedFetch('https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/'+seasonYear()+'/types/2/teams/2/leaders',60);
      const cats=[
        {k:'pointsPerGame',l:'PPG'},{k:'reboundsPerGame',l:'RPG'},{k:'assistsPerGame',l:'APG'},
        {k:'stealsPerGame',l:'SPG'},{k:'blocksPerGame',l:'BPG'},{k:'3PointMadePerGame',l:'3PM'},
        {k:'fieldGoalPercentage',l:'FG%',pct:true}
      ];
      const html=cats.map(function(c){
        const cat=(data.categories||[]).find(x=>x.name===c.k); if(!cat||!cat.leaders||!cat.leaders.length) return '';
        // pick the top leader still on the current roster — skips traded/departed players (leaders is ranked desc)
        let top=null,id=null;
        for(let i=0;i<cat.leaders.length;i++){
          const r=(cat.leaders[i].athlete&&cat.leaders[i].athlete['$ref'])||'', mm=r.match(/athletes\/(\d+)/), cand=mm?mm[1]:null;
          if(cand&&byId[cand]){ top=cat.leaders[i]; id=cand; break; }
        }
        if(!top) return '';
        const p=byId[id]||{}, img=p.img||(id?('https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/'+id+'.png&w=350&h=254'):'');
        const val=top.displayValue+(c.pct?'%':'');
        return '<div class="leader">'+(img?'<img src="'+img+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'')+
          '<div style="min-width:0"><div class="l-cat">'+c.l+' Leader</div><div class="l-val">'+escHtml(val)+'</div><div class="l-name">'+escHtml(p.name||'-')+'</div></div></div>';
      }).join('');
      lg.innerHTML=html||'<div class="no-results">Stat leaders will appear during the season.</div>';
    }catch(e){ lg.innerHTML='<div class="no-results">Stat leaders will appear during the season.</div>'; }
  }
}
const FLAGS={USA:'🇺🇸',Canada:'🇨🇦',Portugal:'🇵🇹',Ukraine:'🇺🇦',England:'🏴󠁧󠁢󠁥󠁮󠁧󠁿','United Kingdom':'🇬🇧',France:'🇫🇷',Germany:'🇩🇪',Spain:'🇪🇸',Australia:'🇦🇺',Serbia:'🇷🇸',Slovenia:'🇸🇮',Greece:'🇬🇷',Cameroon:'🇨🇲',Nigeria:'🇳🇬',Lithuania:'🇱🇹',Latvia:'🇱🇻',Croatia:'🇭🇷',Turkey:'🇹🇷',Brazil:'🇧🇷',Argentina:'🇦🇷','Dominican Republic':'🇩🇴',Bahamas:'🇧🇸',Japan:'🇯🇵',Italy:'🇮🇹',Finland:'🇫🇮',Israel:'🇮🇱',Georgia:'🇬🇪',Montenegro:'🇲🇪','New Zealand':'🇳🇿',Senegal:'🇸🇳'};
function flag(c){ return FLAGS[c]||'🌍'; }
function renderTeamNumbers(el, athletes){
  const num=f=>athletes.map(f).filter(x=>x>0);
  const avg=arr=>arr.length?arr.reduce((s,x)=>s+x,0)/arr.length:0;
  const inFt=inch=>{ const ft=Math.floor(inch/12); return ft+'\''+Math.round(inch-ft*12)+'"'; };
  const sn=n=>{ const p=(n||'').split(' '); return p.length>1?(p[0][0]+'. '+p.slice(1).join(' ')):n; };
  const ages=num(a=>+a.age), heights=num(a=>+a.height), weights=num(a=>+a.weight);
  const tall=athletes.filter(a=>+a.height>0).sort((a,b)=>b.height-a.height)[0];
  const young=athletes.filter(a=>+a.age>0).sort((a,b)=>a.age-b.age)[0];
  const heavy=athletes.filter(a=>+a.weight>0).sort((a,b)=>b.weight-a.weight)[0];
  const colleges=Array.from(new Set(athletes.map(a=>a.college&&a.college.name).filter(Boolean)));
  const countries=Array.from(new Set(athletes.map(a=>a.birthPlace&&a.birthPlace.country).filter(Boolean)));
  const b=['<div class="tn-box"><b>'+athletes.length+'</b><span>On Roster</span></div>'];
  if(ages.length) b.push('<div class="tn-box"><b>'+avg(ages).toFixed(1)+'</b><span>Avg Age</span></div>');
  if(heights.length) b.push('<div class="tn-box"><b>'+inFt(Math.round(avg(heights)))+'</b><span>Avg Height</span></div>');
  if(weights.length) b.push('<div class="tn-box"><b>'+Math.round(avg(weights))+'</b><span>Avg Wt (lbs)</span></div>');
  if(tall) b.push('<div class="tn-box"><b>'+(tall.displayHeight||inFt(tall.height))+'</b><span>Tallest · '+sn(tall.displayName)+'</span></div>');
  if(young) b.push('<div class="tn-box"><b>'+young.age+'</b><span>Youngest · '+sn(young.displayName)+'</span></div>');
  if(heavy) b.push('<div class="tn-box"><b>'+(heavy.displayWeight||'').replace(' lbs','')+'</b><span>Heaviest · '+sn(heavy.displayName)+'</span></div>');
  if(colleges.length) b.push('<div class="tn-box"><b>'+colleges.length+'</b><span>Colleges</span></div>');
  let html='<div class="tn-grid">'+b.join('')+'</div>';
  if(countries.length) html+='<div class="tn-flags"><span class="tn-flags-lbl">🌍 Around the World · '+countries.length+' countries</span>'+countries.map(c=>'<span class="tn-flag" title="'+c+'">'+flag(c)+'</span>').join('')+'</div>';
  el.innerHTML=html;
}

/* ---- championship timeline (all 18 banners) ---- */
const titles=[
  {yr:1957,opp:'St. Louis Hawks',res:'4–3',note:'The first banner — Bill Russell’s rookie year, led by Cousy & Sharman.'},
  {yr:1959,opp:'Minneapolis Lakers',res:'4–0',note:'The franchise’s first Finals sweep.'},
  {yr:1960,opp:'St. Louis Hawks',res:'4–3',note:'The dynasty rolls on.'},
  {yr:1961,opp:'St. Louis Hawks',res:'4–1',note:'Third straight title.'},
  {yr:1962,opp:'Los Angeles Lakers',res:'4–3',note:'Survive a Game 7 overtime over West & Baylor.'},
  {yr:1963,opp:'Los Angeles Lakers',res:'4–2',note:'Bob Cousy’s farewell championship.'},
  {yr:1964,opp:'San Francisco Warriors',res:'4–1',note:'Russell outduels Wilt Chamberlain.'},
  {yr:1965,opp:'Los Angeles Lakers',res:'4–1',note:'Seventh title in nine years.'},
  {yr:1966,opp:'Los Angeles Lakers',res:'4–3',note:'Red Auerbach’s last game coaching — eight in a row.'},
  {yr:1968,opp:'Los Angeles Lakers',res:'4–2',note:'Russell, now player-coach, leads the way.'},
  {yr:1969,opp:'Los Angeles Lakers',res:'4–3',note:'Bill Russell’s 11th and final championship.'},
  {yr:1974,opp:'Milwaukee Bucks',res:'4–3',note:'John Havlicek wins Finals MVP over Kareem.'},
  {yr:1976,opp:'Phoenix Suns',res:'4–2',note:'The triple-overtime Game 5 classic; Jo Jo White MVP.'},
  {yr:1981,opp:'Houston Rockets',res:'4–2',note:'Larry Bird’s first ring; Cedric Maxwell Finals MVP.'},
  {yr:1984,opp:'Los Angeles Lakers',res:'4–3',note:'Bird MVP in a Game 7 thriller over Magic.'},
  {yr:1986,opp:'Houston Rockets',res:'4–2',note:'The legendary ’86 team; Bird’s second straight Finals MVP.'},
  {yr:2008,opp:'Los Angeles Lakers',res:'4–2',note:'The Big Three — Garnett, Pierce (MVP) & Allen — bring home Banner 17.'},
  {yr:2024,opp:'Dallas Mavericks',res:'4–1',note:'Tatum & Brown (Finals MVP) deliver Banner 18.'},
  {yr:1958,opp:'St. Louis Hawks',res:'2–4',won:false,note:'A Bill Russell ankle injury proved costly in a Finals rematch with the Hawks.'},
  {yr:1985,opp:'Los Angeles Lakers',res:'2–4',won:false,note:'The Lakers got their revenge for 1984 — the only Finals loss of Bird’s prime.'},
  {yr:1987,opp:'Los Angeles Lakers',res:'2–4',won:false,note:'Magic Johnson’s baby skyhook sealed it for the Lakers.'},
  {yr:2010,opp:'Los Angeles Lakers',res:'3–4',won:false,note:'A heartbreaking Game 7 loss to the Lakers in Los Angeles.'},
  {yr:2022,opp:'Golden State Warriors',res:'2–4',won:false,note:'Tatum & Brown’s first Finals run fell to the Warriors.'}
];
function renderTimeline(){
  const el=document.getElementById('timeline'); if(!el) return;
  el.innerHTML=titles.slice().sort(function(a,b){return b.yr-a.yr;}).map(function(t){
    const won=t.won!==false;
    const label=won?'NBA Champions':'Finals Runner-Up';
    const verb=won?'def.':'lost to';
    return '<a class="tl-card'+(won?'':' loss')+'" href="https://en.wikipedia.org/wiki/'+t.yr+'_NBA_Finals" target="_blank" rel="noopener" title="'+t.yr+' NBA Finals on Wikipedia">'+
      '<span class="tl-go">↗</span>'+
      '<div class="tl-head"><span class="tl-yr">'+t.yr+'</span><span class="tl-champ">'+label+'</span></div>'+
      '<div class="tl-opp">'+verb+' '+t.opp+' <span class="tl-res">('+t.res+')</span></div>'+
      '<div class="tl-note">'+t.note+'</div></a>';
  }).join('');
}

/* ---- newsletter signup ----
   Goes through /api/subscribe (double opt-in: the function emails a confirm link).
   Until the newsletter keys are set in Cloudflare that function answers 503 "not set
   up", and the form falls back to the old direct Supabase insert, so signups keep
   working either way. See SETUP-NEWSLETTER-EMAILS.txt. */
function wireNewsletter(){
  const form=document.getElementById('newsForm'); if(!form) return;
  form.addEventListener('submit',function(e){
    e.preventDefault();
    const msg=document.getElementById('newsMsg');
    const hp=document.getElementById('newsHp'); if(hp&&hp.value) return;   // honeypot - silently drop bots
    const emailEl=document.getElementById('newsEmail'); const email=(emailEl.value||'').trim();
    if(!email) return;
    msg.textContent='Subscribing…';
    const done=function(text,notify){ emailEl.value=''; msg.textContent=text; if(notify) notifyNewSubscriber(email); };
    const direct=function(){   // pre-upgrade path
      if(!commentsReady()) return Promise.reject();
      return fetch(commentsConfig.url+'/rest/v1/subscribers',{
        method:'POST',
        headers:Object.assign({'Content-Type':'application/json',Prefer:'return=minimal'},chead()),
        body:JSON.stringify({email:email})
      }).then(function(r){
        if(!r.ok && r.status!==409) return Promise.reject();   // 409 = already subscribed
        done('🎉 You’re in! Thanks for subscribing.', r.ok);
      });
    };
    fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})})
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return {r:r,j:j}; }); })
      .then(function(x){
        if(x.j.ok && x.j.status==='check-email') return done('📬 Almost there - check your inbox and tap the link to confirm.', true);
        if(x.j.ok && x.j.status==='already') return done('💚 You’re already subscribed - thanks!', false);
        if([404,405,501,503].indexOf(x.r.status)>-1) return direct();   // function not set up (or not deployed)
        msg.textContent=x.j.error||'Hmm, that didn’t go through - please try again.';
      })
      .catch(function(){ return direct(); })
      .catch(function(){ msg.textContent='Hmm, that didn’t go through - please try again.'; });
  });
}

function gameMeta(g){
  const comp=g.comp||{};
  const bc=((comp.broadcasts||[]).map(x=>x.media&&x.media.shortName).filter(Boolean))[0]||((comp.geoBroadcasts||[]).map(x=>x.media&&x.media.shortName).filter(Boolean))[0]||'';
  const venue=(comp.venue&&comp.venue.fullName)||'';
  const note=(comp.notes&&comp.notes[0]&&comp.notes[0].headline)||'';
  const p=[];
  if(bc) p.push('<span>📺 '+escHtml(bc)+'</span>');
  if(venue) p.push('<span>📍 '+escHtml(venue)+'</span>');
  if(note) p.push('<span class="g-ctx">'+shortNote(note)+'</span>');
  return p.length?('<div class="g-meta">'+p.join('')+'</div>'):'';
}
function renderLast(ev){
  const card=document.getElementById('lastCard');
  if(!ev){ card.innerHTML='<div class="sc-card-top"><span class="sc-card-label">Last Result</span></div><div class="match"><div class="match-txt"><div class="score-line">No recent games</div></div></div>'; return; }
  const g=parseGame(ev), bs=scoreOf(g.bos), os=scoreOf(g.opp), win=bs>os;
  if(bs==null||os==null||isNaN(bs)||isNaN(os)){ renderLast(null); return; }
  const opp=g.opp.team.shortDisplayName||g.opp.team.displayName;
  const url=gamePageUrl(ev);
  card.innerHTML=`
    <div class="sc-card-top"><span class="sc-card-label">Last Result</span><span class="wl ${win?'w':'l'}">${win?'W':'L'}</span></div>
    <div class="match">
      <img src="${teamLogo(g.opp.team.abbreviation)}" alt="" class="opp-logo" onerror="this.style.visibility='hidden'">
      <div class="match-txt">
        <div class="score-line">Celtics <b>${bs}</b> ${g.home?'vs':'@'} ${escHtml(opp)} <b>${os}</b></div>
        <div class="g-date">${fmtDate(ev.date)}</div>
      </div>
    </div>
    ${gameMeta(g)}
    ${url?`<a class="score-link" href="${escHtml(url)}" target="_blank" rel="noopener">View full game page ↗</a>`:''}`;
  addLastFan(ev,g);   // pick'em result + Player of the Game vote
}
function renderNext(ev){
  const card=document.getElementById('nextCard');
  if(!ev){ card.innerHTML='<div class="sc-card-top"><span class="sc-card-label">Next Game</span></div><div class="match offseason"><div class="match-txt"><div class="score-line">Offseason ☘️</div><div class="g-date">2026–27 schedule coming soon</div></div></div>'; return; }
  const g=parseGame(ev), opp=g.opp.team.shortDisplayName||g.opp.team.displayName;
  card.innerHTML=`
    <div class="sc-card-top"><span class="sc-card-label">Next Game</span></div>
    <div class="match">
      <img src="${teamLogo(g.opp.team.abbreviation)}" alt="" class="opp-logo" onerror="this.style.visibility='hidden'">
      <div class="match-txt">
        <div class="score-line">${g.home?'vs':'@'} ${escHtml(opp)}</div>
        <div class="g-date">${fmtDateTime(ev.date)}</div>
      </div>
    </div>
    ${gameMeta(g)}`;
  renderPickem(ev);   // fan pick'em on the upcoming game
}
function startCountdown(next){
  const tm=document.getElementById('scTime'), lbl=document.getElementById('scLabel'), mt=document.getElementById('scMatch');
  const seg=document.querySelector('.tk-next');
  if(countdownTimer) clearInterval(countdownTimer);
  // game day → the countdown lives in the green banner; offseason → no next game.
  // Either way only THIS segment hides; the rest of the ticker stays useful.
  if(gamedayShown||!next){ if(seg) seg.style.display='none'; return; }
  if(seg) seg.style.display='';
  const g=parseGame(next), opp=g.opp.team.shortDisplayName||g.opp.team.abbreviation;
  const abbr=g.opp.team.abbreviation||'';
  mt.innerHTML='<span>'+(g.home?'vs':'@')+'</span>'+
    (abbr?'<img src="'+teamLogo(abbr)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'')+
    '<span>'+escHtml(opp)+'</span>';
  const target=new Date(next.date).getTime(), pad=n=>String(n).padStart(2,'0');
  function tick(){
    if(document.hidden) return;   // background tab: nothing to draw
    let diff=target-Date.now();
    if(diff<=0){ lbl.textContent='TIP-OFF'; tm.textContent='LIVE'; clearInterval(countdownTimer); return; }
    const d=Math.floor(diff/864e5); diff-=d*864e5;
    const h=Math.floor(diff/36e5); diff-=h*36e5;
    const m=Math.floor(diff/6e4); diff-=m*6e4;
    const s=Math.floor(diff/1e3);
    lbl.textContent='NEXT TIP-OFF';
    tm.textContent=(d>0?d+'d ':'')+pad(h)+':'+pad(m)+':'+pad(s);
  }
  tick(); countdownTimer=setInterval(tick,1000);
}

/* marked.min.js loads with `defer`, so wait for DOMContentLoaded (deferred scripts
   are guaranteed to have run by then) before parsing posts. */
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',initBlog); }
else{ initBlog(); }

/* banners — each one links to that championship team's Wikipedia page */
const bbox=document.getElementById('banners');
const years=[1957,1959,1960,1961,1962,1963,1964,1965,1966,1968,1969,1974,1976,1981,1984,1986,2008,2024];
years.forEach(y=>{
  const season=`${y-1}–${String(y).slice(2)}`;              // e.g. 1985–86
  const a=document.createElement('a'); a.className='banner';
  a.href=`https://en.wikipedia.org/wiki/${season}_Boston_Celtics_season`;
  a.target='_blank'; a.rel='noopener';
  a.title=`${y} NBA Champions — view the ${season} Celtics on Wikipedia`;
  a.innerHTML=`<div class="banner-inner"><span class="b-label">WORLD<br>CHAMPS</span><span class="b-year">${y}</span><span class="b-clover">☘</span></div>`;
  bbox.appendChild(a);
});

/* legends + roster (with official NBA headshots) */
function initials(name){return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();}
function personCard(p){
  const hasLinks=p.links&&p.links.length;
  const d=document.createElement(hasLinks?'div':'a'); d.className='person'+(p.isNew?' is-new':'');
  if(p.name) d.dataset.card=cardSlug(p.name);
  const href = p.href || (p.id ? 'https://www.nba.com/stats/player/'+p.id : '');
  if(!hasLinks && href){ d.href=href; d.target='_blank'; d.rel='noopener'; }
  const src = p.imgUrl || (p.id ? 'https://cdn.nba.com/headshots/nba/latest/260x190/'+p.id+'.png' : '');
  const img = src ? '<img src="'+escHtml(src)+'" alt="'+escHtml(p.name)+'" loading="lazy" onerror="this.closest(\'.person\').classList.add(\'noimg\')">' : '';
  const linksRow = hasLinks ? ('<div class="p-links">'+p.links.filter(l=>l.own||/^https?:\/\//i.test(l.href||'')).map(l=>l.own?('<a class="p-own" href="'+escHtml(l.href)+'">'+escHtml(l.label)+'</a>'):('<a href="'+escHtml(l.href)+'" target="_blank" rel="noopener">'+escHtml(l.label)+'</a>')).join('')+'</div>') : '';
  const postsRow = (p.posts&&p.posts.length) ? ('<div class="p-posts"><span class="pp-lbl">📝 In the Blog</span>'+p.posts.map(x=>'<a href="/post/'+encodeURIComponent(x.slug)+'/" data-post="'+escHtml(x.slug)+'">'+escHtml(x.title)+'</a>').join('')+'</div>') : '';
  d.innerHTML=`
    <div class="headshot">
      <span class="jersey">${p.num||''}</span>
      ${p.isNew?'<span class="new-badge">★ New</span>':''}
      ${(!hasLinks&&href)?'<span class="stats-hint">Stats ↗</span>':''}
      ${img}
      <span class="fallback">${initials(p.name)}</span>
    </div>
    <div class="p-info">
      <h3 class="p-name">${escHtml(p.name)}${p.country?(' <span class="p-flag" title="'+escHtml(p.country)+'">'+flag(p.country)+'</span>'):''}</h3>
      <div class="pos">${escHtml(p.pos||'')}</div>
      ${p.note?('<p>'+escHtml(p.note)+'</p>'):''}
      ${metaHtml(p.meta)}
      ${linksRow}
      ${postsRow}
    </div>`;
  return d;
}
function metaHtml(m){
  if(!m) return '';
  const p=[];
  if(m.size) p.push('<span>📏 '+escHtml(m.size)+'</span>');
  if(m.college) p.push('<span>🎓 '+escHtml(m.college)+'</span>');
  if(m.hometown) p.push('<span>📍 '+escHtml(m.hometown)+'</span>');
  if(m.exp) p.push('<span>📅 '+escHtml(m.exp)+'</span>');
  if(m.status) p.push('<span class="p-status">🔔 '+escHtml(m.status)+'</span>');
  return p.length?('<div class="p-meta">'+p.join('')+'</div>'):'';
}
const lg=document.getElementById('legendsGrid');
legends.forEach(p=>lg.appendChild(personCard({...p, country:p.country||'USA'})));

/* full active roster — pulled live from ESPN, ordered by salary (salary not shown) */
const rosterNotes={
  'Jayson Tatum':'The face of the franchise. Triple-double threat rounding into MVP-level form.',
  'Paul George':'Nine-time All-Star wing acquired from the 76ers in the blockbuster Jaylen Brown trade — a proven two-way scorer bringing veteran star power to Boston in his fifth NBA stop.',
  'Jaylen Brown':'Career year — 28.8 PPG, 4th in the NBA. The other half of The Jays.',
  'Derrick White':'Two-way connector and one of the league’s most reliable role players.',
  'Nikola Vucevic':'Veteran frontcourt scoring and a steadying interior presence.',
  'Sam Hauser':'Elite floor-spacer — drilled eight threes in the 29-triple blowout.',
  'Payton Pritchard':'Instant offense and playoff heroics off the bench.',
  'Hugo Gonzalez':'Promising 20-year-old Spanish wing; two-time ACB champ with Real Madrid.',
  'Luka Garza':'Per-40 monster: a projected 25/10 if the minutes were there.',
  'Baylor Scheierman':'Former Creighton standout providing balanced second-unit production.',
  'Neemias Queta':'Interior defense and energy — and now the owner of a career three.',
  'Jordan Walsh':'Breakout role player with a much-improved three-point stroke.',
  'Ron Harper Jr.':'Undrafted sharpshooter who torched the G League; brother of Dylan Harper.',
  'Chris Cenac Jr.':'2026 first-round pick — a lanky, switchable forward out of Houston.',
  'Dillon Mitchell':'2026 second-round pick — a high-energy, athletic forward.',
  'Dalano Banton':'A 6-foot-8 Canadian point guard with rare size — a long, creative ball-handler off the bench.',
  'Amari Williams':'A 7-foot rookie center out of Kentucky with a 7-foot-6 wingspan; a rim protector on a two-way deal.',
  'Max Shulga':'A 6-foot-5 sharpshooting rookie guard — the reigning Atlantic-10 Player of the Year out of VCU.',
  'John Tonje':'A big-bodied scoring guard out of Wisconsin, acquired in a trade with the Jazz.',
  'Mike Conley':'Savvy veteran point guard signed in free agency — a steady, playoff-tested floor general.',
  'Mitchell Robinson':'Rim-protecting, offensive-rebounding center signed in free agency to anchor the paint.'
};
/* Veteran trade/free-agent pickups from the last year. Rookies & just-drafted
   players get the "New" badge automatically (first NBA season); ESPN doesn't
   expose trade dates for veterans, so add any recently-acquired vets here. */
const newcomers = new Set(['Mike Conley','Mitchell Robinson']);
/* Country fallback for players whose ESPN birthplace record has no country.
   Only used when ESPN doesn't supply one; accent-insensitive on the name. */
const PLAYER_COUNTRY={
  'Hugo Gonzalez':'Spain','Neemias Queta':'Portugal','Dalano Banton':'Canada',
  'Amari Williams':'England','Max Shulga':'Ukraine'
};
function normName(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim(); }
function overrideCountry(name){ const n=normName(name); for(const k in PLAYER_COUNTRY){ if(normName(k)===n) return PLAYER_COUNTRY[k]; } return ''; }
/* Seed the player-link index with legends. Current players are added ONLY from
   the live ESPN roster (in loadRoster) — so traded-away players never get a
   dead link, and it self-corrects on every roster move. */
legends.forEach(function(p){ addPlayerLink(p.name,'f-legends'); });
buildPlayerRe();
const COACH_PHOTOS={'2232684':'https://upload.wikimedia.org/wikipedia/commons/9/99/Celtics_at_Wizards_2024-12-046_%28cropped%29_%28cropped%29.jpg'};
function renderCoach(co){
  const cc=document.getElementById('coachCard'); if(!cc) return;
  if(Array.isArray(co)) co=co[0];
  if(!co){ cc.innerHTML=''; return; }
  const cid=co.id, ini=((co.firstName||' ')[0]+(co.lastName||' ')[0]).toUpperCase();
  const exp=co.experience?(co.experience+(co.experience==1?' season':' seasons')+' at the helm'):'';
  const src=COACH_PHOTOS[cid]||('https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/'+cid+'.png&w=350&h=254');
  const link='https://en.wikipedia.org/wiki/'+encodeURIComponent(((co.firstName||'')+' '+(co.lastName||'')).trim().replace(/ /g,'_'));
  cc.innerHTML='<a class="coach-card" href="'+link+'" target="_blank" rel="noopener">'+
    '<div class="coach-pic"><img src="'+src+'" alt="" onerror="this.closest(\'.coach-pic\').classList.add(\'noimg\')"><span class="coach-fallback">'+ini+'</span></div>'+
    '<div class="coach-info"><div class="coach-label">Head Coach</div><div class="coach-name">'+escHtml((co.firstName||'')+' '+(co.lastName||''))+'</div>'+(exp?'<div class="coach-sub">'+escHtml(exp)+'</div>':'')+'</div>'+
    '<span class="coach-go">Profile ↗</span></a>';
}
/* Auto-flag roster additions: remembers which players we've seen (per browser) and
   marks anyone new as "New" for ~30 days — so trades badge themselves, no code change. */
function markRosterSeen(currentIds){
  const recent=new Set();
  try{
    const KEY='tt:rosterSeen', WIN=30*864e5, now=Date.now();
    let store={};
    try{ store=JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){}
    const firstRun=!Object.keys(store).length;
    currentIds.forEach(id=>{ if(store[id]==null) store[id]= firstRun ? (now-WIN-864e5) : now; }); // backdate everyone on first ever visit
    localStorage.setItem(KEY, JSON.stringify(store));
    currentIds.forEach(id=>{ if((now-store[id])<WIN) recent.add(id); });
  }catch(e){}
  return recent;
}
/* lower-case, accent-free title+text of a post - built once, reused by every name/headline match */
function postNorm(p){
  if(p._norm==null) p._norm=((p.title||'')+' '+(p.body||'').replace(/<[^>]+>/g,' ')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  return p._norm;
}
/* posts (by Dan) that mention this player's name */
function postsMentioning(name){
  if(!name || !Array.isArray(posts) || !posts.length) return [];
  const n=normName(name);
  if(!n) return [];
  return posts.filter(p=>postNorm(p).indexOf(n)>-1)
    .sort((a,b)=>dateNum(b.date)-dateNum(a.date))   // most recent first
    .slice(0,2)                                        // max 2
    .map(p=>({slug:p.slug,title:p.title}));
}
/* open a post in the reader (player-card blog links, "Hear Dan's Take") - they are real
   /post/ links, so ctrl/cmd-click still opens the page itself */
function goToPost(slug){ const i=posts.findIndex(p=>p.slug===slug); if(i>=0) renderPost(i,true); return i>=0; }
document.addEventListener('click',function(e){
  const a=e.target.closest&&e.target.closest('a[data-post]'); if(!a) return;
  if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
  if(goToPost(a.dataset.post)) e.preventDefault();
});
/* Accurate auto-bio for any player without a hand-written note.
   Built only from live ESPN fields — never asserts how the player was acquired. */
function autoBio(pos,exp,college){
  const P=pos||'Player';
  const school=college?(' out of '+college):'';
  if(exp==null||exp===0) return 'Rookie '+P.toLowerCase()+school+'.';
  return P+school+' with '+exp+' year'+(exp>1?'s':'')+' of NBA experience.';
}
/* /player/<slug>/ pages are generated at deploy (build-pages.js) and listed in
   content/players.json; anything not listed simply gets no player-page link */
let playerPages={};
function loadPlayerPages(){
  return cachedFetch('/content/players.json',30).then(function(list){
    playerPages={}; (Array.isArray(list)?list:[]).forEach(function(x){ if(x&&x.name&&x.url) playerPages[normName(x.name)]=x.url; });
  }).catch(function(){});
}
function playerPageUrl(name){ return playerPages[normName(name)]||''; }
async function loadRoster(){
  const rg=document.getElementById('rosterGrid'); if(!rg) return;
  await loadPlayerPages();
  rg.innerHTML='<div class="skel" style="height:250px"></div>'.repeat(4);
  try{
    const data=await cachedFetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/bos/roster',30);
    renderCoach(data.coach);
    const recentIds=markRosterSeen((data.athletes||[]).map(a=>String(a.id)));
    const players=(data.athletes||[]).map(a=>{
      const known=rosterNotes[a.displayName];
      const exp=a.experience?a.experience.years:null;
      const isNew=newcomers.has(a.displayName)||exp===0||exp==null||recentIds.has(String(a.id));   // rookie, listed newcomer, or a fresh roster addition
      const bp=a.birthPlace||{};
      const hometown=bp.city?(bp.city+(bp.state?(', '+bp.state):(bp.country?(', '+bp.country):''))):'';
      const college=(a.college&&a.college.name)||'';
      const pos=(a.position&&(a.position.displayName||a.position.abbreviation))||'';
      const expTxt=(exp==null||exp===0)?'Rookie':(exp+' yr'+(exp>1?'s':'')+' in NBA');
      const stName=(a.status&&a.status.name)||'';
      const status=(stName&&stName.toLowerCase()!=='active')?((a.status.abbreviation||stName)):'';
      const size=[a.displayHeight,a.displayWeight].filter(Boolean).join(' · ');
      const L=a.links||[];
      const lk=rel=>{ const x=L.find(y=>y.rel&&y.rel.indexOf(rel)>-1&&y.rel.indexOf('desktop')>-1&&/^https?:/.test(y.href||'')); return x&&x.href; };
      const plinks=[['Profile','playercard'],['Stats','stats'],['Game Log','gamelog']].map(z=>{const h=lk(z[1]);return h?{label:z[0],href:h}:null;}).filter(Boolean);
      const pp=playerPageUrl(a.displayName); if(pp) plinks.unshift({label:'Player page',href:pp,own:true});
      return {
        name:a.displayName,
        country:bp.country||overrideCountry(a.displayName),
        num:a.jersey?('#'+a.jersey):'',
        pos:pos,
        imgUrl:(a.headshot&&a.headshot.href)||'',
        salary:(a.contracts&&a.contracts[0]&&a.contracts[0].salary)||0,
        isNew:isNew,
        note: known || autoBio(pos, exp, college),
        meta:{size:size, college:college, hometown:hometown, exp:expTxt, status:status},
        links:plinks,
        posts: postsMentioning(a.displayName)
      };
    });
    players.sort((a,b)=>b.salary-a.salary);   // ordered by salary; salary itself is not displayed
    players.forEach(p=>addPlayerLink(p.name,'f-roster')); buildPlayerRe();   // links come only from the live roster (no dead links for traded players)
    const _art=document.getElementById('readerArticle');   // re-link the open post now that the roster is loaded
    if(_art && posts[current]) linkifyPlayers(_art);   // in place - rebuilding would restart a playing video
    rg.innerHTML='';
    players.forEach(p=>rg.appendChild(personCard(p)));
    // keep the homepage short: show the top 8, tuck the rest behind a button
    if(players.length>8){
      rg.classList.add('collapsed');
      const more=document.getElementById('rosterMore');
      if(more){ more.style.display=''; more.querySelector('button').textContent='Show the full roster ('+players.length+' players) ▾'; }
    }
  }catch(e){ rg.innerHTML='<div class="no-results">Roster is unavailable right now.</div>'; }
}

/* ============ KEYBOARD ARROW NAVIGATION ============ */
document.addEventListener('keydown',e=>{
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight') return;
  if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey) return;   // leave browser shortcuts (Alt+Left = Back) alone
  const ae=document.activeElement||{};
  if(['INPUT','TEXTAREA','SELECT'].includes(ae.tagName)||ae.isContentEditable||(ae.getAttribute&&ae.getAttribute('role')==='tab')) return;
  const r=document.getElementById('posts').getBoundingClientRect();
  const visible = r.top < window.innerHeight*0.65 && r.bottom > 0;   // only when the blog is on screen
  if(!visible) return;
  const nb=neighbors();
  if(e.key==='ArrowLeft'  && nb.newer>=0) { e.preventDefault(); renderPost(nb.newer,false); }
  if(e.key==='ArrowRight' && nb.older>=0) { e.preventDefault(); renderPost(nb.older,false); }
});
function setNav(open){
  const n=document.getElementById('navlinks'), b=document.querySelector('.nav-toggle');
  n.classList.toggle('open',open); if(b) b.setAttribute('aria-expanded',open?'true':'false');
}
function toggleNav(){ setNav(!document.getElementById('navlinks').classList.contains('open')); }
function closeNav(){ setNav(false); }

/* ============ "Read the latest" opens the newest post ============ */
/* Everything else uses the browser's native anchor scroll + scroll-padding-top (in CSS),
   which is smooth and offsets for the sticky nav without any fighting/jumping. */
document.addEventListener('click',function(e){
  const a=e.target.closest('a[data-open-latest]'); if(!a) return;
  e.preventDefault(); closeNav(); renderPost(0,true);
});

/* ============ player-name links in posts → jump to their Franchise card ============ */
document.addEventListener('click',function(e){
  const a=e.target.closest('a[data-goto-player]'); if(!a) return;
  e.preventDefault();
  gotoPlayerCard(a.getAttribute('data-goto-player'), a.getAttribute('data-goto-tab')||'f-roster');
});

/* ============ READING PROGRESS + BACK-TO-TOP (one rAF-throttled handler) ============ */
const progEl=document.getElementById('readProgress'), topBtn=document.getElementById('toTop');
let scrollTick=false;
function updateScrollUi(){
  const art=document.querySelector('.reader-article');
  if(progEl&&art){
    const r=art.getBoundingClientRect();
    const inView=r.top<window.innerHeight&&r.bottom>0;
    const total=r.height-window.innerHeight;
    const p=total>0?Math.min(1,Math.max(0,-r.top/total)):0;
    progEl.style.transform='scaleX('+p+')';
    progEl.style.opacity=(inView&&p>0)?'1':'0';
  }
  if(topBtn) topBtn.classList.toggle('show',window.scrollY>900);
}
window.addEventListener('scroll',function(){
  if(scrollTick) return; scrollTick=true;
  requestAnimationFrame(function(){ scrollTick=false; updateScrollUi(); });
},{passive:true});

/* ============ SCROLL REVEAL ============ */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
