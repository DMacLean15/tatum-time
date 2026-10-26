/* Tatum Time visitor counter. Logs one anonymous visit per page per browser
   session to Supabase (site_visits table) and fills any #visitCount on the page
   with the running totals. No names, emails or IP addresses are stored - just a
   random id per browser. See SETUP-VISITOR-COUNTER.txt.
   The visit goes through /api/visit (a Cloudflare function that adds the
   country/state/city) and falls back to a direct Supabase insert if that is
   missing. When the reader leaves, one more beacon records seconds on page
   (visible time only) and how far they scrolled.
   Dan: open any page with ?notme once and your own browser stops being counted
   (?countme undoes it). Opening /stats/ does the same automatically. */
(function(){
  var SB='https://oeogaqrqwevjqpwvrxhq.supabase.co';
  var KEY='sb_publishable_qHH5R2FwTF-zKs5zoVXZzA_f98jkW75';
  var H={apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json'};
  var BASE=['visitor','session','path','referrer','device'];

  function store(name){ try{ return window[name]; }catch(e){ return null; } }
  function get(s,k){ try{ return s?s.getItem(k):null; }catch(e){ return null; } }
  function put(s,k,v){ try{ if(s) s.setItem(k,v); }catch(e){} }
  function del(s,k){ try{ if(s) s.removeItem(k); }catch(e){} }
  function rid(){
    try{ if(window.crypto&&crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
    return Date.now().toString(36)+Math.random().toString(36).slice(2,12);
  }
  function fmt(n){ return Number(n||0).toLocaleString('en-US'); }
  function pick(o,keys){ var r={}; keys.forEach(function(k){ if(k in o) r[k]=o[k]; }); return r; }

  var ls=store('localStorage'), ss=store('sessionStorage');
  if(/[?&]notme\b/.test(location.search)) put(ls,'tt_notme','1');
  if(/[?&]countme\b/.test(location.search)) del(ls,'tt_notme');

  var ua=navigator.userAgent||'';
  var skip = get(ls,'tt_notme')==='1' || navigator.webdriver ||
             /bot|crawl|spider|slurp|preview|lighthouse|headless/i.test(ua);

  function showCounter(){
    var el=document.getElementById('visitCount');
    if(!el) return;
    fetch(SB+'/rest/v1/rpc/visit_counter',{method:'POST',headers:H,body:'{}'})
      .then(function(r){ return r.ok?r.json():Promise.reject(); })
      .then(function(c){
        if(!c||!c.visits) return;
        el.textContent='\u{1F440} '+fmt(c.visits)+' visits · '+fmt(c.fans)+' fans · '+fmt(c.today)+' today';
        el.hidden=false;
      })
      .catch(function(){});   // table not set up yet: counter just stays hidden
  }

  function curPath(){
    var p=location.pathname;
    if(/^#\/post\//.test(location.hash)) p+=location.hash;
    return p.slice(0,200);
  }

  if(skip){ showCounter(); return; }

  /* ---- what we know about this browser (no personal info) ---- */
  var visitor=get(ls,'tt_visitor'); if(!visitor){ visitor=rid(); put(ls,'tt_visitor',visitor); }
  var session=get(ss,'tt_session'); if(!session){ session=rid(); put(ss,'tt_session',session); }
  var referrer=null;
  try{
    var host=new URL(document.referrer).hostname.replace(/^www\./,'');
    if(host && host!==location.hostname.replace(/^www\./,'')) referrer=host.slice(0,100);
  }catch(e){}
  var device=/iPad|Tablet/i.test(ua)?'tablet':(/Mobi|Android|iPhone/i.test(ua)?'phone':'desktop');
  var browser=/SamsungBrowser/.test(ua)?'Samsung':/Edg(e|A|iOS)?\//.test(ua)?'Edge':/Firefox|FxiOS/.test(ua)?'Firefox':
              /Chrome|CriOS/.test(ua)?'Chrome':/Safari/.test(ua)?'Safari':'Other';
  var os=/iPhone|iPad|iPod/.test(ua)?'iOS':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':
         /Mac OS X|Macintosh/.test(ua)?(navigator.maxTouchPoints>1?'iOS':'macOS'):/Linux|CrOS/.test(ua)?'Linux':'Other';
  var lang=((navigator.language||'').slice(0,2).toLowerCase().match(/^[a-z]{2}$/)||[null])[0];
  var tz=null; try{ tz=(Intl.DateTimeFormat().resolvedOptions().timeZone||'').slice(0,50)||null; }catch(e){}
  var sw=(window.screen&&screen.width)||window.innerWidth||0;
  var scr=!sw?null:sw<400?'<400':sw<768?'400-767':sw<1280?'768-1279':sw<1920?'1280-1919':'1920+';
  var source=null;
  try{
    var q=new URLSearchParams(location.search);
    source=q.get('utm_source')||(q.get('fbclid')?'facebook':q.get('gclid')?'google':q.get('ttclid')?'tiktok':null);
    if(source) source=source.toLowerCase().replace(/[^a-z0-9._ -]/g,'').trim().slice(0,40)||null;
  }catch(e){}

  /* ---- logging: /api/visit first, straight to Supabase if that fails ---- */
  var direct=false;
  function sbInsert(table,row,retry){
    return fetch(SB+'/rest/v1/'+table,{method:'POST', keepalive:true,
      headers:Object.assign({Prefer:'return=minimal'},H), body:JSON.stringify(row)})
      .then(function(r){ if(!r.ok && retry) return sbInsert(table,pick(row,retry)); });  // upgrade SQL not run yet
  }
  function logVisit(path){
    var row={visitor:visitor.slice(0,40),session:session.slice(0,40),path:path,referrer:referrer,device:device,
             browser:browser,os:os,lang:lang,tz:tz,screen:scr,source:source};
    var send=direct?Promise.reject():fetch('/api/visit',{method:'POST',keepalive:true,
      headers:{'Content-Type':'application/json'},body:JSON.stringify(row)})
      .then(function(r){ if(!r.ok) return Promise.reject(); });
    return send.catch(function(){ direct=true; return sbInsert('site_visits',row,BASE); }).catch(function(){});
  }

  /* ---- engagement: visible seconds + max scroll %, one beacon per page view ---- */
  var view=null;
  function scrollPct(){
    var d=document.documentElement, h=Math.max(d.scrollHeight,document.body?document.body.scrollHeight:0);
    var y=(window.pageYOffset||d.scrollTop||0)+window.innerHeight;
    return h>0?Math.min(100,Math.round(y/h*100)):100;
  }
  function startView(path){
    view={path:path, ms:0, since:document.visibilityState==='visible'?Date.now():0, scroll:scrollPct(), sent:false};
  }
  function tick(){ if(view&&view.since){ view.ms+=Date.now()-view.since; view.since=0; } }
  function endView(){
    if(!view||view.sent) return;
    tick(); view.sent=true;
    var row={session:session.slice(0,40),path:view.path,seconds:Math.min(3600,Math.round(view.ms/1000)),scroll:view.scroll};
    try{
      if(!direct && navigator.sendBeacon &&
         navigator.sendBeacon('/api/engage',new Blob([JSON.stringify(row)],{type:'text/plain'}))) return;
    }catch(e){}
    sbInsert('site_engagement',row).catch(function(){});
  }
  window.addEventListener('scroll',function(){ if(view&&!view.sent){ var p=scrollPct(); if(p>view.scroll) view.scroll=p; } },{passive:true});
  document.addEventListener('visibilitychange',function(){
    if(!view) return;
    if(document.visibilityState==='hidden') endView();
    else if(!view.since) view.since=Date.now();
  });
  window.addEventListener('pagehide',endView);

  function track(){
    var path=curPath(), seenKey='tt_seen_'+path;
    if(view&&view.path===path) return;
    endView(); view=null;
    if(get(ss,seenKey)) return;          // already counted this page this session
    put(ss,seenKey,'1');
    startView(path);
    return logVisit(path);
  }

  /* posts opened inside the homepage change the URL to /#/post/<slug> without
     a reload - count those as page views too */
  function onNav(){ setTimeout(track,0); }
  try{
    ['pushState','replaceState'].forEach(function(fn){
      var orig=history[fn]; if(!orig) return;
      history[fn]=function(){ var r=orig.apply(this,arguments); onNav(); return r; };
    });
  }catch(e){}
  window.addEventListener('hashchange',onNav);
  window.addEventListener('popstate',onNav);

  (track()||Promise.resolve()).then(showCounter);
})();
