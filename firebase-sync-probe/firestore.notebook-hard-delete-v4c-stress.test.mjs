import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,collection,deleteDoc,getDocs,writeBatch,setDoc,Timestamp} from 'firebase/firestore';
// Official Firestore emulator only. No live calls or real users.
const rules=readFileSync('firestore.notebook-hard-delete-v4c.rules','utf8')
 .replaceAll('__OWNER_UID__','stress-owner');
const env=await initializeTestEnvironment({projectId:'demo-honbin-v4c-stress-only',
 firestore:{host:'127.0.0.1',port:8080,rules}});
const who=(uid,email)=>env.authenticatedContext(uid,{
 email,email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
const owner=who('stress-owner','stress@example.test');
const editor=who('stress-editor','editor@example.test');
let cases=0;
async function verify(name,fn){console.log('BEGIN V4C stress '+name);await fn();cases++;console.log('PASS V4C stress '+cases+' '+name)}
try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'groups/stressbook'),{
   name:'isolated-test',ownerUid:'stress-owner',createdAt:Timestamp.now(),
   deleteState:'DELETING',deletionId:'locked_epoch_12345678',deletingAt:Timestamp.now()
  });
  await setDoc(doc(db,'approvedAccounts/editor@example.test'),{
   email:'editor@example.test',status:'ACTIVE',createdAt:Timestamp.now()
  });
  const batch=writeBatch(db);
  for(let i=0;i<26;i++)batch.set(doc(db,'groups/stressbook/notes/n'+i),{
   groupId:'stressbook',ownerUid:'stress-editor',title:'x',content:'test only',
   createdAt:Timestamp.now(),updatedAt:Timestamp.now(),version:1,deleted:false
  });
  await batch.commit();
 });
 await verify('Owner can read locked 26-note batch inventory',async()=>{
  const snap=await assertSucceeds(getDocs(collection(owner,'groups/stressbook/notes')));
  assert.equal(snap.size,26);
 });
 await verify('Nonowner cannot list locked notes',()=>assertFails(getDocs(collection(editor,'groups/stressbook/notes'))));
 await verify('Owner can delete ten notes in single Firestore atomic batch',async()=>{
  const batch=writeBatch(owner);
  for(let i=0;i<10;i++)batch.delete(doc(owner,'groups/stressbook/notes/n'+i));
  await assertSucceeds(batch.commit());
 });
 await verify('Next ten-note atomic deletion succeeds within rule budget',async()=>{
  const batch=writeBatch(owner);
  for(let i=10;i<20;i++)batch.delete(doc(owner,'groups/stressbook/notes/n'+i));
  await assertSucceeds(batch.commit());
 });
 await verify('Last six notes can be deleted safely',async()=>{
  const batch=writeBatch(owner);
  for(let i=20;i<26;i++)batch.delete(doc(owner,'groups/stressbook/notes/n'+i));
  await assertSucceeds(batch.commit());
 });
 await verify('Fresh Firestore query proves notes count zero',async()=>{
  const snap=await assertSucceeds(getDocs(collection(owner,'groups/stressbook/notes')));
  assert.equal(snap.size,0);
 });
 await verify('Notebook root hard delete remains forbidden',()=>assertFails(deleteDoc(doc(owner,'groups/stressbook'))));
 console.log('FIREBASE_NOTEBOOK_V4C_STRESS_BATCH_PASS',cases);
}finally{await env.cleanup()}
