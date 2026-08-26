const CACHE='hongbin-crm-r69-force2';
const CORE=['./','./index.html','./manifest.webmanifest','./quote-letterhead.jpg','./r69-fix.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(x=>new Request(x,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function patchHtml(resp){
 try{
  let text=await resp.clone().text();
  text=text.replace(/R68 Beta/g,'R69 Beta');
  if(!text.includes('r69-fix.js')) text=text.replace('</body>','<script src="./r69-fix.js?v=69-force2"></script></body>');
  const headers=new Headers(resp.headers);headers.set('content-type','text/html; charset=utf-8');headers.set('cache-control','no-store, max-age=0');headers.delete('content-length');
  return new Response(text,{status:resp.status,statusText:resp.statusText,headers});
 }catch(_){return resp}
}
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(e.request.mode==='navigate'){
  e.respondWith((async()=>{
   try{
    const resp=await fetch(e.request,{cache:'reload'});
    const patched=await patchHtml(resp);
    return patched;
   }catch(_){
    const cached=await caches.match('./index.html')||await caches.match('./');
    return cached?patchHtml(cached):Response.error();
   }
  })());return;
 }
 if(u.pathname.endsWith('/r69-fix.js')){e.respondWith(fetch(e.request,{cache:'reload'}));return;}
 e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});