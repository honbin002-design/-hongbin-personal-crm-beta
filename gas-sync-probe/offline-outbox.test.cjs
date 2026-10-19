'use strict';
const assert=require('node:assert/strict');
const {createOfflineOutbox,previewLegacyNotes}=require('./offline-outbox.cjs');
let local=[],network=false,failAck=false,conflict=false,sends=[],serial=0,passed=0;
const server=new Map();
const send=async(action,args)=>{
 sends.push({action,operationId:args.operationId});
 if(!network)throw Error('NETWORK_OFFLINE');
 if(conflict)throw Error('VERSION_CONFLICT');
 if(!server.has(args.operationId))server.set(args.operationId,{articleId:'remote-'+String(server.size+1),version:1});
 if(failAck)throw Error('CONNECTION_LOST_AFTER_COMMIT');
 return server.get(args.operationId);
};
const make=()=>createOfflineOutbox({
 load:()=>JSON.parse(JSON.stringify(local)),
 save:items=>{local=JSON.parse(JSON.stringify(items))},
 send,newId:()=>('pending-op-'+String(++serial).padStart(8,'0')),
 clock:()=>new Date(Date.UTC(2026,9,19,12,0,serial)).toISOString()
});
let outbox=make();
const test=async(name,fn)=>{await fn();passed++;console.log('PASS: '+name)};
const throws=(code,fn)=>assert.throws(fn,e=>e.message===code);
(async()=>{
 await test('No legacy transfer without explicit preview',()=>{
  assert.equal(local.length,0);assert.equal(sends.length,0);
  const sample=[{id:12,title:'舊記事',content:'只有在本機',createdAt:'2026-10-19T01:00:00Z'}];
  const pv=previewLegacyNotes(sample);
  assert.equal(pv.count,1);assert.equal(pv.entries[0].excerpt,'只有在本機');
  assert.equal(sends.length,0);
 });
 await test('Creates local pending record before network attempt',()=>{
  const n=outbox.enqueue('CREATE_NOTE',{scope:'PRIVATE',title:'私密',content:'未上傳',ownerId:'spoofed'});
  assert.equal(n.status,'PENDING');assert.equal(n.args.ownerId,undefined);
  assert.equal(local.length,1);assert.equal(sends.length,0);
 });
 await test('No empty content allowed',()=>throws('INVALID_OUTBOX_CONTENT',
  ()=>outbox.enqueue('CREATE_NOTE',{scope:'PRIVATE',title:'bad',content:''})));
 await test('No private note may be preassigned a shared group',()=>throws('INVALID_OUTBOX_SCOPE',
  ()=>outbox.enqueue('CREATE_NOTE',{scope:'PRIVATE',groupId:'team',content:'bad'})));
 await test('Offline send does not report success or lose local draft',async()=>{
  const x=await outbox.retryOne(local[0].operationId);
  assert.equal(x.status,'FAILED');assert.equal(x.lastError,'NETWORK_OFFLINE');
  assert.equal(local[0].args.content,'未上傳');
 });
 await test('Success after reconnect stores remote confirmation',async()=>{
  network=true;const x=await outbox.retryOne(local[0].operationId);
  assert.equal(x.status,'SYNCED');assert.equal(x.result.version,1);
 });
 await test('Already synced does not send again',async()=>{
  const before=sends.length;await outbox.retryOne(local[0].operationId);
  assert.equal(sends.length,before);
 });
 await test('Server committed but response lost can safely retry same opId',async()=>{
  const q=outbox.enqueue('CREATE_NOTE',{scope:'PRIVATE',content:'第二筆'});
  failAck=true;const x=await outbox.retryOne(q.operationId);
  assert.equal(x.status,'FAILED');assert.equal(server.has(q.operationId),true);
  failAck=false;const again=await outbox.retryOne(q.operationId);
  assert.equal(again.status,'SYNCED');assert.equal(server.size,2);
 });
 await test('After browser restart, same pending ID is reused',async()=>{
  const q=outbox.enqueue('CREATE_NOTE',{scope:'PRIVATE',content:'第三筆'});
  network=false;await outbox.retryOne(q.operationId);
  outbox=make();network=true;await outbox.flush();
  assert.equal(outbox.getQueue().find(n=>n.operationId===q.operationId).status,'SYNCED');
 });
 await test('Concurrent version conflict retains exact draft and blocks automatic retry',async()=>{
  const q=outbox.enqueue('UPDATE_NOTE',{articleId:'remote-2',expectedVersion:1,title:'edit',content:'離線修改內容'});
  conflict=true;
  const x=await outbox.retryOne(q.operationId);assert.equal(x.status,'CONFLICT');
  assert.equal(x.args.content,'離線修改內容');
  await assert.rejects(async()=>outbox.retryOne(q.operationId),e=>e.message==='USER_RESOLUTION_REQUIRED');
 });
 await test('Conflict resolution requires explicit current version',()=>{
  const original=local.find(x=>x.status==='CONFLICT');
  throws('EXPLICIT_NEW_VERSION_REQUIRED',()=>outbox.resolveConflict(original.operationId,{}));
  const n=outbox.resolveConflict(original.operationId,{expectedVersion:3,content:'選擇後保留的修改'});
  assert.notEqual(n.operationId,original.operationId);
  assert.equal(n.args.expectedVersion,3);
  assert.equal(local.find(x=>x.operationId===original.operationId).status,'CONFLICT');
  conflict=false;
 });
 await test('Only authorized mutation names can enter outbox',()=>throws('INVALID_OUTBOX_ACTION',
  ()=>outbox.enqueue('ERASE_CRM',{content:'no'})));
 console.log('OFFLINE OUTBOX UNIT PASS',passed);
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
