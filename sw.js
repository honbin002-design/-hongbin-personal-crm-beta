/* R73 simplified seven-module service worker. No legacy script injection. */
const CACHE='hongbin-crm-r73-iphone-subscription-staging-20261022';
const CORE=['./','./index.html','./simple-core.js','./quote-vector-pdf.js','./quote-letterhead.jpg','./crm-push-setup.mjs','./push-public-config.json','./manifest.webmanifest'];
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


/* iPhone Home Screen CRM Web Push receiver (no secrets or Firebase in SW).
   Actual subscription and server delivery stay gated until ACL readback. */
const pushId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(id);
const pushKinds=new Set(['TASK_ASSIGNED','TASK_COMPLETED','SHARED_NOTE_CREATED']);
function safePushEnvelope(payload){
 if(!payload||!pushKinds.has(payload.kind)||!pushId(payload.groupId))return null;
 const isNote=payload.kind==='SHARED_NOTE_CREATED';
 const item=isNote?payload.noteId:payload.taskId;
 if(!pushId(item))return null;
 const route=new URL('./',self.registration.scope);
 route.searchParams.set('pushTab',isNote?'Notes':'Tasks');
 route.searchParams.set('groupId',payload.groupId);
 route.searchParams.set(isNote?'noteId':'taskId',item);
 const heading=payload.kind==='TASK_ASSIGNED'?'有新任務指派':
   payload.kind==='TASK_COMPLETED'?'你發布的任務已完成':'共用記事有新內容';
 return {heading,url:route.href,tag:payload.kind+':'+payload.groupId+':'+item};
}
self.addEventListener('push',event=>{
 let payload=null;
 try{payload=event.data?.json()}catch{}
 const safe=safePushEnvelope(payload);
 event.waitUntil(self.registration.showNotification(safe?.heading||'鴻繽科技 CRM 有新通知',{
  body:'點一下即可開啟 CRM 查看資訊',
  tag:safe?.tag||'honbin-general-update',data:{url:safe?.url||new URL('./',self.registration.scope).href}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const base=new URL('./',self.registration.scope);
  const target=new URL(event.notification.data?.url||base.href,base);
  if(target.origin!==base.origin||target.pathname!==base.pathname||
     (target.search&&(!pushId(target.searchParams.get('groupId'))||
       !['Notes','Tasks'].includes(target.searchParams.get('pushTab'))||
       !pushId(target.searchParams.get(target.searchParams.get('pushTab')==='Notes'?'noteId':'taskId')))))
    target.href=base.href;
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients){
   const old=new URL(client.url);
   if(old.origin===base.origin&&old.pathname===base.pathname){
    if(typeof client.navigate==='function')await client.navigate(target.href);
    await client.focus();return;
   }
  }
  await self.clients.openWindow(target.href);
 })());
});
