import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,deleteDoc,getDoc,Timestamp} from 'firebase/firestore';
// Simulates the Firebase Console privileged root delete as RulesDisabled,
// NEVER against a real project. Demonstrates post-delete verification only.
const rules=readFileSync('firestore.notebook-hard-delete-v4d.rules','utf8')
 .replaceAll('__OWNER_UID__','real-owner');
const env=await initializeTestEnvironment({projectId:'demo-honbin-v4d-root-finalizer',
 firestore:{host:'127.0.0.1',port:8080,rules}});
const who=(uid,email)=>env.authenticatedContext(uid,{
 email,email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
const owner=who('real-owner','owner@example.test'),
 member=who('member-uid','member@example.test'),
 outsider=who('outsider-uid','outsider@example.test');
let count=0;const test=async(label,fn)=>{console.log('BEGIN V4D final '+label);await fn();
 count++;console.log('PASS V4D final '+count+': '+label)};
try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  const data={name:'已鎖定記事簿',ownerUid:'real-owner',createdAt:Timestamp.now(),
   deleteState:'DELETING',deletionId:'manual_delete_epoch_001',deletingAt:Timestamp.now()};
  await setDoc(doc(db,'groups/manual'),data);
  await setDoc(doc(db,'groups/still-exists'),{...data,ownerUid:'other-owner'});
  for(const [uid,groupId] of [
   ['real-owner','manual'],['member-uid','manual'],['member-uid','still-exists']]){
   await setDoc(doc(db,'users/'+uid+'/groupIndex/'+groupId),{
    uid,groupId,createdAt:Timestamp.now()
   });
  }
  for(const e of ['member@example.test','outsider@example.test'])
   await setDoc(doc(db,'approvedAccounts/'+e),{
    email:e,status:'ACTIVE',createdAt:Timestamp.now()
   });
 });
 await test('Owner can read exact locked notebook before root purge',()=>assertSucceeds(getDoc(doc(owner,'groups/manual'))));
 await test('Stale member pointer never unlocks existing group',()=>assertFails(getDoc(doc(member,'groups/still-exists'))));
 await test('Stranger without pointer cannot see existing locked group',()=>assertFails(getDoc(doc(outsider,'groups/manual'))));
 await test('Owner still cannot root-delete using browser Firebase SDK',()=>assertFails(deleteDoc(doc(owner,'groups/manual'))));
 await test('Synthetic privileged console can physically delete already-cleaned root',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>deleteDoc(doc(ctx.firestore(),'groups/manual')));
 });
 await test('Owner with own pointer can prove root is physically absent',async()=>{
  const result=await assertSucceeds(getDoc(doc(owner,'groups/manual')));
  assert.equal(result.exists(),false);
 });
 await test('Member with stale own pointer sees ONLY root absence',async()=>{
  const result=await assertSucceeds(getDoc(doc(member,'groups/manual')));
  assert.equal(result.exists(),false);
 });
 await test('Stranger without any pointer cannot probe missing group',()=>assertFails(getDoc(doc(outsider,'groups/manual'))));
 await test('Member cannot use stale pointer to read another existing group',()=>assertFails(getDoc(doc(member,'groups/still-exists'))));
 await test('Owner can delete own stale index after missing-root proof',()=>assertSucceeds(deleteDoc(doc(owner,'users/real-owner/groupIndex/manual'))));
 await test('Owner can verify own index now missing',async()=>{
  const result=await assertSucceeds(getDoc(doc(owner,'users/real-owner/groupIndex/manual')));
  assert.equal(result.exists(),false);
 });
 await test('Owner cannot probe group once own pointer removed',()=>assertFails(getDoc(doc(owner,'groups/manual'))));
 await test('Member can delete their own stale group pointer without other access',()=>assertSucceeds(deleteDoc(doc(member,'users/member-uid/groupIndex/manual'))));
 await test('Other still-existing group remains physically intact',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
   const result=await getDoc(doc(ctx.firestore(),'groups/still-exists'));
   assert.equal(result.exists(),true);
  });
 });
 console.log('FIREBASE_NOTEBOOK_V4D_TRUSTED_CONSOLE_FINALIZER_PASS',count);
}finally{await env.cleanup()}
