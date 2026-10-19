import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {makeDraftStore,scopeKey} from './firebase-offline-drafts.mjs';

const dbName='honbin-notes-draft-emulator-test-v1';
const store=makeDraftStore({factory:indexedDB,dbName});
const again=makeDraftStore({factory:indexedDB,dbName});
const alice={uid:'firebase-alice',mode:'PRIVATE'};
const bob={uid:'firebase-bob',mode:'PRIVATE'};
const teamA={uid:'firebase-alice',mode:'SHARED',groupId:'team-a'};
const teamB={uid:'firebase-alice',mode:'SHARED',groupId:'team-b'};
const bobA={uid:'firebase-bob',mode:'SHARED',groupId:'team-a'};
const edit={title:'草稿',content:'關閉 Safari 前的內容',
 active:{id:'note-one',version:4},pendingCreateId:null};
let count=0;async function test(name,action){console.log('BEGIN '+name);await action();count++;console.log('PASS '+name)}
await test('Only valid Firebase UID scope accepted',()=>{
 assert.throws(()=>scopeKey({uid:'',mode:'PRIVATE'}),/INVALID_UID/);
 assert.throws(()=>scopeKey({uid:'../../',mode:'PRIVATE'}),/INVALID_UID/);
});
await test('PRIVATE cannot forge group selection',()=>{
 assert.throws(()=>scopeKey({uid:'firebase-alice',mode:'PRIVATE',groupId:'team-a'}),/INVALID_PRIVATE_SCOPE/);
});
await test('SHARED requires valid group ID',()=>{
 assert.throws(()=>scopeKey({uid:'firebase-alice',mode:'SHARED'}),/INVALID_GROUP_ID/);
});
await test('Reject unknown scopes',()=>{
 assert.throws(()=>scopeKey({uid:'firebase-alice',mode:'ALL'}),/INVALID_SCOPE/);
});
await test('No draft exists before editing',async()=>assert.equal(await store.read(alice),null));
await test('Alice private draft saves locally and can reload from new adapter',async()=>{
 await store.save(alice,edit);
 assert.deepEqual(await again.read(alice),edit);
});
await test('Bob cannot retrieve Alice private draft by his own scope',async()=>{
 assert.equal(await store.read(bob),null);
});
await test('Shared group A and B have separate stored drafts',async()=>{
 await store.save(teamA,{title:'A',content:'A text'});
 await store.save(teamB,{title:'B',content:'B text'});
 assert.equal((await again.read(teamA)).content,'A text');
 assert.equal((await again.read(teamB)).content,'B text');
 assert.equal((await store.read(alice)).content,edit.content);
});
await test('Other UID cannot retrieve group A draft in his own scope',async()=>{
 assert.equal(await store.read(bobA),null);
});
await test('Drafts never include arbitrary email or credential keys',async()=>{
 await store.save(teamA,{title:'whitelist',content:'text',email:'sensitive@example.test',
  idToken:'never write',password:'never write'});
 const raw=await again.read(teamA);
 assert.deepEqual(Object.keys(raw).sort(),['active','content','pendingCreateId','title'].sort());
 assert.equal(raw.email,undefined);
});
await test('Store will not accept new/edit mixed identity',async()=>{
 await assert.rejects(store.save(alice,{title:'bad',content:'x',
  active:{id:'note-one',version:1},pendingCreateId:'new-note'}),/AMBIGUOUS_DRAFT/);
});
await test('Store rejects invalid version and IDs',async()=>{
 await assert.rejects(store.save(alice,{title:'x',content:'text',
   active:{id:'broken/id',version:1}}),/INVALID_DRAFT_VERSION/);
 await assert.rejects(store.save(alice,{title:'x',content:'text',
   active:{id:'note-one',version:0}}),/INVALID_DRAFT_VERSION/);
});
await test('Local content length is bounded independently of backend',async()=>{
 await assert.rejects(store.save(alice,{title:'x',content:'x'.repeat(30001)}),
   /INVALID_DRAFT_TEXT/);
});
await test('Pending create ID survives reload, no automatic new ID',async()=>{
 await store.save(bob,{title:'new',content:'unsynced',
  pendingCreateId:'stable-create-nonce'});
 assert.equal((await again.read(bob)).pendingCreateId,'stable-create-nonce');
});
await test('Same scope overlapping saves are last-write-wins deterministically',async()=>{
 const writes=Array.from({length:12},(_,n)=>store.save(alice,{
  title:'revision-'+n,content:'draft '+n,
  active:{id:'note-one',version:4}
 }));
 await Promise.all(writes);
 assert.equal((await again.read(alice)).content,'draft 11');
});
await test('Remove after pending save never resurrects local draft',async()=>{
 const pending=store.save(teamA,{title:'pending',content:'not uploaded'});
 const deleted=store.remove(teamA);
 await Promise.all([pending,deleted]);
 assert.equal(await again.read(teamA),null);
});
await test('One group deletion cannot remove other group draft',async()=>{
 assert.equal((await store.read(teamB)).content,'B text');
});
await test('Removing user private draft does not affect other user private',async()=>{
 await store.remove(alice);
 assert.equal(await again.read(alice),null);
 assert.equal((await store.read(bob)).content,'unsynced');
});
await test('Invalid factory fails closed, never silently assumes persistence',()=>{
 assert.throws(()=>makeDraftStore({factory:null}),/INDEXEDDB_UNAVAILABLE/);
});
console.log('HONBIN_OFFLINE_DRAFT_INDEXEDDB_PASS',count);
