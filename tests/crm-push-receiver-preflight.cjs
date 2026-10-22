// No Firebase connection, no browser API calls and no live subscriptions.
// Execute the production CRM service worker in a synthetic Node sandbox.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('sw.js','utf8');
const events=new Map(),messages=[],opened=[];
const scope='https://honbin002-design.github.io/-hongbin-personal-crm-beta/';
const self={
 registration:{
  scope,showNotification:async(title,options)=>messages.push({title,options})
 },
 location:{origin:new URL(scope).origin},
 addEventListener:(name,handler)=>events.set(name,handler)
};
vm.runInNewContext(src,{self,URL,URLSearchParams,caches:{},fetch(){}},{timeout:1500});
assert.ok(events.has('push'),'main CRM worker must accept background push');
assert.ok(events.has('notificationclick'),'tapping notification must open CRM');
async function send(data){
 let work;
 events.get('push')({data:data===null?null:{json:()=>data},
  waitUntil:promise=>{work=promise}});
 await work;return messages.at(-1);
}
const sample=await send({kind:'TASK_ASSIGNED',groupId:'group_123',taskId:'task_456',
 email:'hidden@example.test',taskTitle:'Confidential client'});
assert.equal(sample.title,'有新任務指派');
assert.equal(sample.options.data.url,scope+'?pushTab=Tasks&groupId=group_123&taskId=task_456');
assert.doesNotMatch(JSON.stringify(sample),/Confidential client|hidden@example.test/);
const completed=await send({kind:'TASK_COMPLETED',groupId:'group_123',taskId:'task_456'});
assert.equal(completed.title,'你發布的任務已完成');
const note=await send({kind:'SHARED_NOTE_CREATED',groupId:'group_123',noteId:'note_8'});
assert.equal(note.options.data.url,scope+'?pushTab=Notes&groupId=group_123&noteId=note_8');
const invalid=await send({kind:'TASK_ASSIGNED',groupId:'../../attack',taskId:'x'});
assert.equal(invalid.options.data.url,scope);
const empty=await send(null);
assert.equal(empty.options.data.url,scope);
self.clients={matchAll:async()=>[],openWindow:async url=>opened.push(url)};
async function click(url){
 let work;
 events.get('notificationclick')({
  notification:{data:{url},close(){}},waitUntil:p=>{work=p}});
 await work;return opened.at(-1);
}
assert.equal(await click('https://malicious.example/steal'),scope);
assert.equal(await click(sample.options.data.url),sample.options.data.url);
assert.equal(await click(scope+'?pushTab=Notes&groupId=group_123&noteId=../../etc'),scope);
assert.match(src,/self.addEventListener\('push'/);
assert.match(src,/self.addEventListener\('notificationclick'/);
assert.doesNotMatch(src,/service[_-]?account|VAPID_PRIVATE|customerTitle|customerData/);
console.log('CRM_MAIN_PWA_PUSH_RECEIVER_SAFE_ROUTING_PASS');
