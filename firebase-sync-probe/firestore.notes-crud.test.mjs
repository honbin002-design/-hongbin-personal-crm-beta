// Google OFFICIAL Firestore emulator integration tests (no live project).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import * as sdk from 'firebase/firestore';
import {noteService} from './firebase-note-service.mjs';
const env=await initializeTestEnvironment({
 projectId:'demo-honbin-notes-crud',firestore:{
  host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')
 }
});
const actor=(uid)=>env.authenticatedContext(uid,{
 firebase:{sign_in_provider:'google.com'},email:uid+'@example.test',email_verified:true
}).firestore();
const a=actor('alice-n'),b=actor('bob-n'),c=actor('carol-n'),d=actor('outsider-n');
let current='alice-n';
const service=(db,uid,fn=()=>uid)=>noteService({
 db,sdk,identity:{uid,emailVerified:true,providerId:'google.com'},currentUid:fn
});
const alice=service(a,'alice-n',()=>current),phone2=service(actor('alice-n'),'alice-n',()=>current);
const bob=service(b,'bob-n'),carol=service(c,'carol-n'),outsider=service(d,'outsider-n');
const G='g-notes',P={mode:'PRIVATE'},S={mode:'SHARED',groupId:G};
let checks=0;async function check(name,fn){console.log('BEGIN',name);await fn();checks++;console.log('PASS',name)}
let personal,shared;
try{
 await check('Reject non-Google provider/verified identity',()=>{
  assert.throws(()=>noteService({db:a,sdk,identity:{uid:'alice-n',emailVerified:true,
   providerId:'password'},currentUid:()=>current}),/VERIFIED_GOOGLE_IDENTITY_REQUIRED/);
 });
 await check('Reject missing live account guard',()=>{
  assert.throws(()=>noteService({db:a,sdk,identity:{uid:'alice-n',
   emailVerified:true,providerId:'google.com'}}),/LIVE_IDENTITY_CHECK_REQUIRED/);
 });
 await check('Reject invalid note scope',()=>assert.throws(
  ()=>alice.newId({mode:'PUBLIC'}),/INVALID_NOTE_SCOPE/));
 await check('Private stable-id create V1 succeeds',async()=>{
  personal=alice.newId(P);const result=await alice.create({...P,noteId:personal,
   title:'測試標題',content:'手機 A 的記事內容'});
  assert.equal(result.version,1);assert.equal(result.alreadyCreated,false);
 });
 await check('Same content retry after ACK loss never duplicates',async()=>{
  const result=await phone2.create({...P,noteId:personal,
   title:'測試標題',content:'手機 A 的記事內容'});
  assert.equal(result.alreadyCreated,true);
 });
 await check('Own list and title/content filter work',async()=>{
  assert.equal((await alice.list({...P,search:'測試標題'})).length,1);
  assert.equal((await alice.list({...P,search:'記事內容'})).length,1);
  assert.equal((await alice.list({...P,search:'未有文字'})).length,0);
 });
 await check('Other UID cannot read private document',()=>assertFails(
  sdk.getDoc(sdk.doc(b,'users','alice-n','notes',personal))));
 await check('Other UID cannot list someone private notes',()=>assertFails(
  sdk.getDocs(sdk.collection(b,'users','alice-n','notes'))));
 await check('Other UID has empty independent private list',async()=>{
  assert.equal((await bob.list(P)).length,0);
 });
 await check('Phone A updates existing private V1 to V2',async()=>{
  const result=await alice.update({...P,noteId:personal,
   expectedVersion:1,title:'新標題',content:'新內容'});
  assert.equal(result.version,2);
 });
 await check('Phone B stale private edit reports conflict and preserves remote',async()=>{
  await assert.rejects(phone2.update({...P,noteId:personal,
   expectedVersion:1,title:'舊機標題',content:'舊機草稿'}),error=>{
   assert.equal(error.code,'NOTE_VERSION_CONFLICT');
   assert.equal(error.remote.version,2);
   assert.equal(error.remote.content,'新內容');
   return true;
  });
 });
 await check('Create replay after subsequent edit fails safely',()=>assert.rejects(
  phone2.create({...P,noteId:personal,title:'測試標題',content:'手機 A 的記事內容'}),
  /NOTE_VERSION_CONFLICT/));
 await check('Invalid version and note body cannot be written',async()=>{
  await assert.rejects(alice.update({...P,noteId:personal,
    expectedVersion:0,title:'no',content:'no'}),/INVALID_EXPECTED_VERSION/);
  await assert.rejects(alice.update({...P,noteId:personal,
    expectedVersion:2,title:'no',content:''}),/INVALID_NOTE_LENGTH/);
 });
 await check('Version-aware soft delete marks private note V3',async()=>{
  const result=await alice.softDelete({...P,noteId:personal,expectedVersion:2});
  assert.equal(result.version,3);assert.equal(result.deleted,true);
  assert.equal((await alice.list(P)).length,0);
  const snap=await sdk.getDoc(sdk.doc(a,'users','alice-n','notes',personal));
  assert.equal(snap.data().deleted,true);
 });
 await check('Deleted private note cannot be accidentally re-edited',()=>assert.rejects(
  alice.update({...P,noteId:personal,expectedVersion:3,title:'復活',content:'否'}),
  /NOTE_VERSION_CONFLICT/));
 await check('Firestore rules forbid forging private tombstone resurrection',()=>assertFails(
  sdk.updateDoc(sdk.doc(a,'users','alice-n','notes',personal),{
   deleted:false,version:4,title:'規則拒絕復原'
  })
 ));
 await check('Firestore rules forbid rewriting deleted private note with next version',()=>assertFails(
  sdk.updateDoc(sdk.doc(a,'users','alice-n','notes',personal),{
   content:'不允許改寫墓碑',version:4
  })
 ));
 await check('Owner creates group for synthetic shared note',()=>assertSucceeds(
  sdk.setDoc(sdk.doc(a,'groups',G),{
   ownerUid:'alice-n',name:'共同測試',createdAt:sdk.Timestamp.now()
  })));
 await check('Direct owner grants forbidden; fixture members remain isolated to emulator',async()=>{
  const ep='groups/'+G+'/members/bob-n',vp='groups/'+G+'/members/carol-n';
  const e={uid:'bob-n',status:'ACTIVE',role:'EDITOR'},v={uid:'carol-n',status:'ACTIVE',role:'VIEWER'};
  await assertFails(sdk.setDoc(sdk.doc(a,ep),e));
  await assertFails(sdk.setDoc(sdk.doc(a,vp),v));
  await env.withSecurityRulesDisabled(async ctx=>{
    await sdk.setDoc(sdk.doc(ctx.firestore(),ep),e);
    await sdk.setDoc(sdk.doc(ctx.firestore(),vp),v);
  });
 });
 await check('EDITOR creates shared note',async()=>{
  shared=bob.newId(S);
  const result=await bob.create({...S,noteId:shared,title:'共同記事',
   content:'共享測試文字'});
  assert.equal(result.version,1);
 });
 await check('VIEWER can read shared note but outsider cannot',async()=>{
  assert.equal((await carol.list(S)).length,1);
  await assertFails(sdk.getDoc(sdk.doc(d,'groups',G,'notes',shared)));
 });
 await check('VIEWER cannot create a shared note',()=>assertFails(carol.create({
  ...S,noteId:carol.newId(S),title:'寫入拒絕',content:'禁止'
 })));
 await check('OWNER can edit other member shared article',async()=>{
  const result=await alice.update({...S,noteId:shared,expectedVersion:1,
   title:'管理者已更新',content:'第二版'});
  assert.equal(result.version,2);
 });
 await check('EDITOR stale update conflicts without overwriting owner change',()=>assert.rejects(
  bob.update({...S,noteId:shared,expectedVersion:1,title:'過期版',content:'不能覆蓋'}),
  /NOTE_VERSION_CONFLICT/));
 await check('EDITOR cannot soft-delete shared article through version+1',()=>assertFails(
  bob.softDelete({...S,noteId:shared,expectedVersion:2})
 ));
 await check('EDITOR cannot forge the deleted field directly',()=>assertFails(
  sdk.updateDoc(sdk.doc(b,'groups',G,'notes',shared),{
   deleted:true,version:3
  })
 ));
 await check('VIEWER cannot modify valid newer shared note',()=>assertFails(
  carol.update({...S,noteId:shared,expectedVersion:2,
   title:'檢視者不許編輯',content:'禁止'})
 ));
 await check('Downgraded EDITOR can still read but not update',async()=>{
  await assertSucceeds(sdk.updateDoc(sdk.doc(a,'groups',G,'members','bob-n'),{role:'VIEWER'}));
  assert.equal((await bob.list(S)).length,1);
  await assertFails(bob.update({...S,noteId:shared,expectedVersion:2,
   title:'已降權',content:'禁止'}));
 });
 await check('Revoked viewer loses shared list access',async()=>{
  await assertSucceeds(sdk.updateDoc(sdk.doc(a,'groups',G,'members','carol-n'),{status:'REVOKED'}));
  await assertFails(carol.list(S));
 });
 await check('Shared owner soft deletes and all authorized lists omit note',async()=>{
  const result=await alice.softDelete({...S,noteId:shared,expectedVersion:2});
  assert.equal(result.version,3);
  assert.equal((await alice.list(S)).length,0);
 });
 await check('Firestore rules prohibit EDITOR reviving deleted shared note',()=>assertFails(
  sdk.updateDoc(sdk.doc(b,'groups',G,'notes',shared),{
   deleted:false,version:4
  })
 ));
 await check('Firestore rules prohibit group ADMIN reviving deleted note',()=>assertFails(
  sdk.updateDoc(sdk.doc(a,'groups',G,'notes',shared),{
   deleted:false,version:4
  })
 ));
 await check('Switching Google account invalidates stale private service',async()=>{
  current='bob-n';
  await assert.rejects(alice.list(P),/GOOGLE_ACCOUNT_CHANGED/);
  await assert.rejects(alice.create({...P,noteId:'another-safe-id',
   title:'A',content:'B'}),/GOOGLE_ACCOUNT_CHANGED/);
  await assert.rejects(alice.update({...S,noteId:shared,expectedVersion:3,
   title:'old session',content:'must fail'}),/GOOGLE_ACCOUNT_CHANGED/);
 });
 await check('Original private data still belongs to Alice',async()=>{
  const snap=await sdk.getDoc(sdk.doc(a,'users','alice-n','notes',personal));
  assert.equal(snap.data().ownerUid,'alice-n');
 });
 console.log('HONBIN_FIRESTORE_NOTE_CRUD_EMULATOR_PASS',checks);
}finally{await env.cleanup()}
