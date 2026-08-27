const CACHE='hongbin-crm-r70-final-20260827';
const CORE=['./','./index.html','./manifest.webmanifest','./quote-letterhead.jpg','./r69-fix.js','./r70-masterdata.js','./r70-complete.js'];

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

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(event.request,{cache:'no-store'});
        if(fresh&&fresh.ok){
          const cache=await caches.open(CACHE);
          cache.put('./index.html',fresh.clone()).catch(()=>{});
          return fresh;
        }
      }catch(_){ }
      return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
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

  if(url.hostname==='cdn.jsdelivr.net'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const fresh=await fetch(event.request);
        if(fresh&&fresh.ok) cache.put(event.request,fresh.clone()).catch(()=>{});
        return fresh;
      }catch(_){
        return (await cache.match(event.request)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});