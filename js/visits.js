/* Tatum Time visitor counter. Logs one anonymous visit per page per browser
   session to Supabase (site_visits table) and fills any #visitCount on the page
   with the running totals. No names, emails or IP addresses are stored - just a
   random id per browser. See SETUP-VISITOR-COUNTER.txt.
   Dan: open any page with ?notme once and your own browser stops being counted
   (?countme undoes it). Opening /stats/ does the same automatically. */
(function(){
  var SB='https://oeogaqrqwevjqpwvrxhq.supabase.co';
  var KEY='sb_publishable_qHH5R2FwTF-zKs5zoVXZzA_f98jkW75';
  var H={apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json'};

  function store(name){ try{ return window[name]; }catch(e){ return null; } }
  function get(s,k){ try{ return s?s.getItem(k):null; }catch(e){ return null; } }
  function put(s,k,v){ try{ if(s) s.setItem(k,v); }catch(e){} }
  function del(s,k){ try{ if(s) s.removeItem(k); }catch(e){} }
  function rid(){
    try{ if(window.crypto&&crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
    return Date.now().toString(36)+Math.random().toString(36).slice(2,12);
  }
  function fmt(n){ return Number(n||0).toLocaleString('en-US'); }

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

  var path=location.pathname;
  if(/^#\/post\//.test(location.hash)) path+=location.hash;
  path=path.slice(0,200);
  var seenKey='tt_seen_'+path;

  if(skip || get(ss,seenKey)){ showCounter(); return; }

  var visitor=get(ls,'tt_visitor'); if(!visitor){ visitor=rid(); put(ls,'tt_visitor',visitor); }
  var session=get(ss,'tt_session'); if(!session){ session=rid(); put(ss,'tt_session',session); }
  var referrer=null;
  try{
    var host=new URL(document.referrer).hostname.replace(/^www\./,'');
    if(host && host!==location.hostname.replace(/^www\./,'')) referrer=host.slice(0,100);
  }catch(e){}
  var device=/iPad|Tablet/i.test(ua)?'tablet':(/Mobi|Android|iPhone/i.test(ua)?'phone':'desktop');

  put(ss,seenKey,'1');
  fetch(SB+'/rest/v1/site_visits',{
    method:'POST', keepalive:true,
    headers:Object.assign({Prefer:'return=minimal'},H),
    body:JSON.stringify({visitor:visitor.slice(0,40),session:session.slice(0,40),path:path,referrer:referrer,device:device})
  }).catch(function(){}).then(showCounter);
})();
