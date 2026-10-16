const V='jizhang-v2';
const FILES=['./','index.html','guide.html','style.css','app.js','parsers.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
function save(req,res){if(res&&res.ok&&res.type==='basic'){const c=res.clone();const u=new URL(req.url);u.search='';u.hash='';caches.open(V).then(x=>x.put(u.href,c));}return res;}
self.addEventListener('fetch',e=>{const req=e.request,u=new URL(req.url);if(req.method!=='GET'||u.origin!==location.origin)return;
 if(req.mode==='navigate'){
  // Network-first: the page keeps its full URL (incl. ?add=1&amount=…); the cache is only an offline fallback.
  e.respondWith(fetch(req).then(r=>save(req,r)).catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('./',{ignoreSearch:true})||caches.match('index.html'))));return;}
 // assets: stale-while-revalidate so updates reach users
 e.respondWith(caches.match(req,{ignoreSearch:true}).then(c=>{const n=fetch(req).then(r=>save(req,r)).catch(()=>c);return c||n;}));});
