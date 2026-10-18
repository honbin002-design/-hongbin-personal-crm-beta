/* R73 simplified seven-module service worker. No legacy script injection. */
const CACHE='hongbin-crm-r73-clean-pdf-print-20261018';
const CORE=['./','./index.html','./simple-core.js','./manifest.webmanifest','./quote-letterhead.jpg'];
self.addEventListener('install',event=>{event.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(CORE.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())
)});
self.addEventListener('activate',event=>{event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hongbin-crm-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
)});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy)).catch(()=>{})}
      return response;
    }).catch(async()=>await caches.match('./index.html')||Response.error()));
    return;
  }
  if(CORE.some(path=>url.pathname.endsWith('/'+path.replace('./','')))){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{})}
      return response;
    }).catch(async()=>await caches.match(event.request,{ignoreSearch:true})||Response.error()));
    return;
  }
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
