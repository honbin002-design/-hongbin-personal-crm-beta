import assert from 'node:assert/strict';
import {notebookHardDeleteV4C} from './notebook-hard-delete-v4c-service.mjs';
let n=0;async function test(label,fn){await fn();n++;console.log('PASS V4C owner service '+n+': '+label)}
const epoch='delete_epoch_00000001';
function fake(){
 const store=new Map(),history=[];
 let active='owner_uid',offline=false,cached=false,failedOnce=false;
 const doc=(db,...paths)=>({path:paths.join('/')});
 const collection=doc;
 const snap=path=>{
  const present=store.has(path),data=store.get(path);
  return {id:path.split('/').at(-1),metadata:{fromCache:cached},exists:()=>present,data:()=>({...data})};
 };
 const sdk={doc,collection,Timestamp:{now:()=>({seconds:123})},
  getDocFromServer:async r=>{if(offline)throw Error('NETWORK_OFFLINE');return snap(r.path)},
  getDocsFromServer:async r=>{
   if(offline)throw Error('NETWORK_OFFLINE');
   const prefix=r.path+'/',docs=[];
   for(const [path] of store){
    if(!path.startsWith(prefix))continue;
    const suffix=path.slice(prefix.length);if(suffix.includes('/'))continue;
    docs.push(snap(path));
   }
   return {metadata:{fromCache:cached},docs};
  },
  writeBatch(){
   const paths=[];
   return {
    delete(r){paths.push(r.path)},
    async commit(){
     if(offline)throw Error('NETWORK_OFFLINE');
     if(failedOnce){failedOnce=false;throw Error('SIMULATED_BEFORE_COMMIT_FAILURE')}
     if(!paths.length||paths.length>10)throw Error('BATCH_BOUNDS');
     history.push([...paths]);
     for(const path of paths)store.delete(path);
    }
   };
  },
  async updateDoc(r,changes){if(offline)throw Error('NETWORK_OFFLINE');store.set(r.path,{...store.get(r.path),...changes})},
  async deleteDoc(){throw Error('NO_DIRECT_ROOT_DELETE')},
  async runTransaction(db,fn){
   const pending=[];
   const tx={get:async r=>snap(r.path),
    update:(r,changes)=>pending.push([r.path,changes])};
   await fn(tx);
   if(offline)throw Error('NETWORK_OFFLINE');
   for(const [path,changes] of pending)store.set(path,{...store.get(path),...changes});
  }
 };
 const gid='book_a',path='groups/'+gid;
 store.set(path,{id:gid,ownerUid:'owner_uid',name:'測試共用記事簿',createdAt:{seconds:100}});
 store.set('groups/other_a',{ownerUid:'owner_uid',name:'其他記事簿',createdAt:{seconds:101}});
 store.set(path+'/notes/n1',{groupId:gid,ownerUid:'editor_uid',deleted:false,title:'測試'});
 store.set(path+'/notes/n2',{groupId:gid,ownerUid:'editor_uid',deleted:true,title:'已軟刪除'});
 store.set(path+'/members/editor_uid',{uid:'editor_uid',role:'EDITOR',status:'ACTIVE'});
 store.set(path+'/members/revoked_uid',{uid:'revoked_uid',role:'VIEWER',status:'REVOKED'});
 store.set(path+'/sentInvites/invite_1',{groupId:gid,recipientEmail:'editor@example.test'});
 store.set('inboxes/editor@example.test/invites/invite_1',{groupId:gid,status:'ACCEPTED'});
 store.set(path+'/sentInvites/invite_2',{groupId:gid,recipientEmail:'viewer@example.test'});
 store.set('inboxes/viewer@example.test/invites/invite_2',{groupId:gid,status:'REVOKED'});
 for(const uid of ['owner_uid','editor_uid','revoked_uid'])
  store.set('users/'+uid+'/groupIndex/'+gid,{uid,groupId:gid});
 store.set('users/owner_uid/notes/private_a',{ownerUid:'owner_uid',title:'勿動'});
 store.set('approvedAccounts/other@example.test',{email:'other@example.test',status:'ACTIVE'});
 store.set('groups/other_a/notes/keep',{groupId:'other_a',title:'勿動'});
 const actor={uid:'owner_uid',providerId:'google.com',emailVerified:true,currentUid:()=>active};
 const service=notebookHardDeleteV4C({db:{},sdk,actor});
 return {store,sdk,history,service,actor,setActive:s=>active=s,
  setOffline:v=>offline=v,setCached:v=>cached=v,failNextBatch:()=>failedOnce=true};
}
const fails=async(fn,code)=>await assert.rejects(fn,e=>e.message===code);
await test('Reject non-Google identity',async()=>{
 const x=fake();assert.throws(()=>notebookHardDeleteV4C({db:{},sdk:x.sdk,
  actor:{...x.actor,providerId:'password'}}),/VERIFIED_GOOGLE_OWNER_REQUIRED/);
});
await test('Preview server inventory includes soft deleted notes',async()=>{
 const {service}=fake();const p=await service.preview('book_a');
 assert.equal(p.noteCount,2);assert.equal(p.memberCount,2);assert.equal(p.invitationCount,2);
});
await test('Preview enforces typed confirmation',async()=>{
 const {service}=fake();await fails(()=>service.lock('book_a',{typedName:'錯的名稱',deletionId:epoch}),'NOTEBOOK_NAME_CONFIRMATION_REQUIRED');
});
await test('Tiny deletion ID is rejected',async()=>{
 const {service}=fake();await fails(()=>service.lock('book_a',{typedName:'測試共用記事簿',deletionId:'tiny'}),'INVALID_DELETE_EPOCH');
});
await test('Different owner cannot preview',async()=>{
 const x=fake();x.store.get('groups/book_a').ownerUid='someone_else';
 await fails(()=>x.service.preview('book_a'),'NOTEBOOK_CREATOR_REQUIRED');
});
await test('Cannot plan from local stale cache',async()=>{
 const x=fake();x.setCached(true);await fails(()=>x.service.preview('book_a'),'CACHED_READBACK_NOT_ACCEPTABLE');
});
await test('Offline prevents start and no mutation',async()=>{
 const x=fake();x.setOffline(true);await fails(()=>x.service.preview('book_a'),'NETWORK_OFFLINE');
 assert.ok(!x.store.get('groups/book_a').deleteState);
});
await test('Owner lock is irreversible state with deletionId',async()=>{
 const x=fake();const ack=await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 assert.equal(ack.stage,'LOCKED');assert.equal(x.store.get('groups/book_a').deleteState,'DELETING');
 assert.equal(ack.rootPhysicalDeletion,false);
});
await test('Owner cannot lock same group twice',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 await fails(()=>x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch}),'NOTEBOOK_ALREADY_LOCKED');
});
await test('Resume with wrong deletion epoch rejected',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 await fails(()=>x.service.runCleanup('book_a','wrong_delete_epoch_002'),'DELETE_EPOCH_MISMATCH');
});
await test('No cleanup until notebook is locked',async()=>{
 const x=fake();await fails(()=>x.service.runCleanup('book_a',epoch),'DELETE_EPOCH_MISMATCH');
});
await test('Login changes prevent cleanup immediately',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 x.setActive('different_uid');await fails(()=>x.service.runCleanup('book_a',epoch),'DELETION_GOOGLE_ACCOUNT_CHANGED');
});
await test('First batch network failure leaves resumable DELETING root',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 x.failNextBatch();await fails(()=>x.service.runCleanup('book_a',epoch),'SIMULATED_BEFORE_COMMIT_FAILURE');
 assert.equal(x.store.get('groups/book_a').deleteState,'DELETING');
 assert.equal(x.store.has('groups/book_a/notes/n1'),true);
});
await test('Resume after failure permanently clears group descendants and refs',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 x.failNextBatch();await fails(()=>x.service.runCleanup('book_a',epoch),'SIMULATED_BEFORE_COMMIT_FAILURE');
 const result=await x.service.runCleanup('book_a',epoch);
 assert.equal(result.stage,'CONTENT_CLEANED_ROOT_LOCKED');
 const paths=[...x.store.keys()];
 assert.ok(paths.every(p=>!p.startsWith('groups/book_a/')));
 assert.ok(paths.every(p=>!p.includes('/groupIndex/book_a')));
 assert.ok(paths.every(p=>!p.startsWith('inboxes/')));
 assert.equal(x.store.get('groups/book_a').deleteState,'DELETING');
});
await test('Every invite is removed with its matching inbox in ONE atomic batch',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 await x.service.runCleanup('book_a',epoch);
 for(const id of ['invite_1','invite_2']){
  const batch=x.history.find(paths=>paths.some(p=>p.endsWith('/sentInvites/'+id)));
  assert.ok(batch);assert.equal(batch.length,2);
  assert.ok(batch.some(p=>p.endsWith('/invites/'+id)));
 }
});
await test('Every membership is removed with its index in ONE batch',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 await x.service.runCleanup('book_a',epoch);
 for(const uid of ['editor_uid','revoked_uid']){
  const batch=x.history.find(paths=>paths.some(p=>p.endsWith('/members/'+uid)));
  assert.ok(batch);assert.deepEqual(batch.sort(),[
   'groups/book_a/members/'+uid,'users/'+uid+'/groupIndex/book_a'].sort());
 }
});
await test('Owner index is removed only after member cleanup',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 await x.service.runCleanup('book_a',epoch);
 const last=x.history.at(-1);assert.deepEqual(last,['users/owner_uid/groupIndex/book_a']);
});
await test('Other notebook and private records remain untouched',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 await x.service.runCleanup('book_a',epoch);
 for(const p of ['groups/other_a/notes/keep','users/owner_uid/notes/private_a',
  'approvedAccounts/other@example.test'])assert.equal(x.store.has(p),true);
});
await test('Repeated cleanup is idempotent and reports still locked',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 await x.service.runCleanup('book_a',epoch);const count=x.history.length;
 const result=await x.service.runCleanup('book_a',epoch);
 assert.equal(x.history.length,count);assert.equal(result.rootDeletionAuthorized,false);
});
await test('No group root path ever appears in delete batches',async()=>{
 const x=fake();await x.service.lock('book_a',{typedName:'測試共用記事簿',deletionId:epoch});
 await x.service.runCleanup('book_a',epoch);
 assert.ok(x.history.every(paths=>!paths.includes('groups/book_a')));
});
console.log('NOTEBOOK_HARD_DELETE_V4C_CONTROLLER_MOCK_PASS',n);
