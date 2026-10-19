'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createAccountScopedOutbox}=require('./account-scoped-outbox.cjs');
let onlineAccount='alice@example.test',online=true,seq=0,sendCount=0,passed=0;
const storage=new Map(),received=[];
const digest=a=>crypto.createHash('sha256').update(a,'utf8').digest('hex');
const verifiedAccount=async()=>{if(!online)throw Error('GOOGLE_OFFLINE');return onlineAccount};
function instance(){
 return createAccountScopedOutbox({
  readKey:key=>storage.get(key)||null,
  writeKey:(key,v)=>storage.set(key,v),
  verifiedAccount,
  send:async(action,args)=>{sendCount++;received.push({actor:onlineAccount,action,args});return {articleId:'remote-'+sendCount,version:1}},
  newId:()=>('operation-'+String(++seq).padStart(12,'0')),
  digest
 });
}
const err=(code,fn)=>assert.rejects(fn,e=>e.message===code,code);
const check=async(name,fn)=>{await fn();passed++;console.log('PASS: '+name)};
(async()=>{
 const session=instance();
 await check('Cannot queue without verified Google session',async()=>{
  assert.throws(()=>session.queue('CREATE_NOTE',{scope:'PRIVATE',content:'x'}),/GOOGLE_ACCOUNT_NOT_INITIALIZED/);
 });
 await check('First account verification assigns its own partition',async()=>{
  const ready=await session.open();assert.equal(ready.account,'alice@example.test');
  assert.equal(ready.queue.length,0);
  assert.match(ready.key,/^honbin_crm_sync_outbox_v1_[a-f0-9]{64}$/);
 });
 await check('Draft gets pinned to A without sending',async()=>{
  const p=session.queue('CREATE_NOTE',{scope:'PRIVATE',content:'A PRIVATE'});
  assert.equal(p.status,'PENDING');
  assert.equal(sendCount,0);
  assert.equal(session.getQueue()[0].args.content,'A PRIVATE');
 });
 await check('Changing Google login refuses to open A private drafts',async()=>{
  onlineAccount='bob@example.test';
  await err('GOOGLE_ACCOUNT_SWITCHED',()=>session.open());
 });
 await check('Different Google identity cannot upload prior account draft',async()=>{
  const r=await session.flush().catch(e=>e.message);
  assert.ok(r==='GOOGLE_ACCOUNT_SWITCHED'||Array.isArray(r));
  assert.equal(sendCount,0);
  assert.equal(session.getQueue().length,1);
 });
 await check('Logout/reset keeps A drafts; B gets empty separate store',async()=>{
  session.reset();const ready=await session.open();
  assert.equal(ready.account,'bob@example.test');assert.equal(ready.queue.length,0);
  assert.equal(storage.size,1);
 });
 await check('B cannot read A notes even with same browser',async()=>{
  const b=session.queue('CREATE_NOTE',{scope:'PRIVATE',content:'B PRIVATE'});
  assert.notEqual(session.getQueue()[0].args.content,'A PRIVATE');
  assert.equal(storage.size,2);
  assert.equal(b.status,'PENDING');
 });
 await check('B sync sends only B private article, never A data',async()=>{
  const status=await session.flush();assert.equal(status.length,1);
  assert.equal(sendCount,1);assert.equal(received[0].actor,'bob@example.test');
  assert.equal(received[0].args.content,'B PRIVATE');
 });
 await check('Switching back to A restores only A pending draft',async()=>{
  session.reset();onlineAccount='alice@example.test';
  const ready=await session.open();
  assert.equal(ready.queue.length,1);
  assert.equal(ready.queue[0].args.content,'A PRIVATE');
 });
 await check('A upload is allowed only after reauthentication as A',async()=>{
  const results=await session.flush();
  assert.equal(results[0].status,'SYNCED');
  assert.equal(sendCount,2);
  assert.equal(received.at(-1).args.content,'A PRIVATE');
 });
 await check('Offline revalidation forbids transmission, preserving pending',async()=>{
  const draft=session.queue('CREATE_NOTE',{scope:'PRIVATE',content:'A OFFLINE DRAFT'});
  online=false;const before=sendCount;
  await err('GOOGLE_OFFLINE',()=>session.flush());
  assert.equal(sendCount,before);
  assert.equal(session.getQueue().find(x=>x.operationId===draft.operationId).status,'PENDING');
  online=true;
 });
 await check('Malformed stored record with another account hash fails closed',async()=>{
  const key=(await session.open()).key,old=storage.get(key);
  const parsed=JSON.parse(old);parsed[0].accountHash='000wrong';
  storage.set(key,JSON.stringify(parsed));
  assert.throws(()=>session.getQueue(),/ACCOUNT_OUTBOX_CORRUPT/);
  storage.set(key,old);
 });
 console.log('ACCOUNT OUTBOX ISOLATION PASS',passed);
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
