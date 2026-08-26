const CACHE='hongbin-crm-r69';
const CORE=['./','./index.html','./manifest.webmanifest','./quote-letterhead.jpg','./r69-fix.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function injectR69(resp){
  try{
    const text=await resp.clone().text();
    if(text.includes('r69-fix.js'))return resp;
    const patched=text.replace('</body>','<script src="./r69-fix.js?v=69"></script></body>');
    const headers=new Headers(resp.headers);headers.set('content-type','text/html; charset=utf-8');
    headers.delete('content-length');
    return new Response(patched,{status:resp.status,statusText:resp.statusText,headers});
  }catch(_){return resp}
}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(e.request.mode==='navigate'){
    e.respondWith((async()=>{
      try{
        const resp=await fetch(e.request,{cache:'no-store'});
        const copy=resp.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));
        return injectR69(resp);
      }catch(_){
        const cached=await caches.match('./index.html')||await caches.match('./');
        return cached?injectR69(cached):Response.error();
      }
    })());return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp})));
});