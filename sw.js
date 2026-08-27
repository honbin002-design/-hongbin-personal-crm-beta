const CACHE='hongbin-crm-r71-integrated-20260827';
const CORE=['./','./index.html','./manifest.webmanifest','./quote-letterhead.jpg','./r69-fix.js','./r70-masterdata.js','./r70-complete.js','./r71-fixes.js'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE.map(url=>new Request(url,{cache:'reload'}))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function withR71(response){
  if(!response||!response.ok) return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html')) return response;
  let html=await response.text();
  if(!html.includes('r71-fixes.js')) html=html.replace('</body>','<script src="./r71-fixes.js?v=71-integrated"></script></body>');
  html=html.replace(/鴻繽科技 CRM｜R70 Integrated Beta/g,'鴻繽科技 CRM｜R71 Integrated Beta');
  return new Response(html,{status:response.status,statusText:response.statusText,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(event.request,{cache:'no-store'});
        if(fresh&&fresh.ok){
          const raw=fresh.clone();
          const cache=await caches.open(CACHE);
          cache.put('./index.html',raw).catch(()=>{});
          return withR71(fresh);
        }
      }catch(_){ }
      const cached=(await caches.match('./index.html')) || (await caches.match('./'));
      return cached?withR71(cached):Response.error();
    })());
    return;
  }

  if(CORE.some(path=>url.pathname.endsWith(path.replace('./','/')))){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(event.request,{cache:'no-store'});
        if(fresh&&fresh.ok){
          const cache=await caches.open(CACHE);
          cache.put(event.request,fresh.clone()).catch(()=>{});
          return fresh;
        }
      }catch(_){ }
      return (await caches.match(event.request,{ignoreSearch:true})) || Response.error();
    })());
    return;
  }

  const externalCacheHosts=new Set(['cdn.jsdelivr.net','tessdata.projectnaptha.com']);
  if(externalCacheHosts.has(url.hostname)){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const fresh=await fetch(event.request);
        if(fresh&&(fresh.ok||fresh.type==='opaque')) cache.put(event.request,fresh.clone()).catch(()=>{});
        return fresh;
      }catch(_){
        return (await cache.match(event.request)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});