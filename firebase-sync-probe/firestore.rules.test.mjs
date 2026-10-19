import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {collection,deleteDoc,doc,getDoc,getDocs,setDoc,updateDoc,Timestamp} from 'firebase/firestore';

// TRUE Firebase Security Rules emulator (Java), NOT a handwritten JS ACL mock.
// No Google project credentials, real accounts, live URLs or production data.
const here=dirname(fileURLToPath(import.meta.url));
let passed=0;
const env=await initializeTestEnvironment({
 projectId:'demo-honbin-crm-rules-isolated',
 firestore:{host:'127.0.0.1',port:8080,
   rules:readFileSync(join(here,'firestore.rules'),'utf8')}
});
const asGoogle=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).firestore();
const asOther=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'password'}}).firestore();
const guest=env.unauthenticatedContext().firestore();
const alice=asGoogle('alice-uid'),bob=asGoogle('bob-uid');
const carol=asGoogle('carol-uid'),mallory=asGoogle('mallory-uid');
const wrongProvider=asOther('other-provider-uid');
const when=Timestamp.fromDate(new Date('2026-10-19T10:00:00Z'));
const privateDoc=doc(alice,'users/alice-uid/notes/first-note');
const privateData={
 ownerUid:'alice-uid',groupId:null,title:'自己的記事',
 content:'隔離測試文字，不包含真實 CRM 資料',
 version:1,createdAt:when,updatedAt:when,deleted:false
};
const groupId='test-group',groupPath='groups/'+groupId;
const sharedId='shared-note',sharedPath=groupPath+'/notes/'+sharedId;
async function run(name,fn){
 console.log('BEGIN',name);await fn();passed++;console.log('PASS',name);
}
try{
 await run('Anonymous Google note read denied',()=>assertFails(getDoc(doc(guest,'users/alice-uid/notes/first-note'))));
 await run('Firebase Auth non-Google provider cannot create private notes',
  ()=>assertFails(setDoc(doc(wrongProvider,'users/other-provider-uid/notes/one'),{
    ...privateData,ownerUid:'other-provider-uid'})));
 await run('Alice can create her own private note',
  ()=>assertSucceeds(setDoc(privateDoc,privateData)));
 await run('Bob cannot open Alice private note',
  ()=>assertFails(getDoc(doc(bob,'users/alice-uid/notes/first-note'))));
 await run('Bob cannot list Alice private notes',
  ()=>assertFails(getDocs(collection(bob,'users/alice-uid/notes'))));
 await run('Bob cannot overwrite Alice private note',
  ()=>assertFails(setDoc(doc(bob,'users/alice-uid/notes/first-note'),{...privateData,ownerUid:'bob-uid'})));
 await run('Alice can list own notes',
  ()=>assertSucceeds(getDocs(collection(alice,'users/alice-uid/notes'))));
 await run('Private article update with nonsequential version rejected',
  ()=>assertFails(updateDoc(privateDoc,{title:'stale overwrite',version:3})));
 await run('Private article correct next version allowed',
  ()=>assertSucceeds(updateDoc(privateDoc,{title:'第二版',version:2})));
 await run('Private note ownerUid cannot be switched',
  ()=>assertFails(updateDoc(privateDoc,{ownerUid:'bob-uid',version:3})));
 await run('A Google user can create a new group with their own UID',
  ()=>assertSucceeds(setDoc(doc(alice,groupPath),{
    ownerUid:'alice-uid',name:'合作專案',createdAt:when})));
 await run('Stranger cannot read unjoined group',
  ()=>assertFails(getDoc(doc(mallory,groupPath))));
 await run('Unrestricted group enumeration is forbidden',
  ()=>assertFails(getDocs(collection(alice,'groups'))));
 await run('Even group owner cannot bypass verified invitation for editor Bob',async()=>{
  const target=groupPath+'/members/bob-uid';
  const member={uid:'bob-uid',role:'EDITOR',status:'ACTIVE'};
  await assertFails(setDoc(doc(alice,target),member));
  // Seed a fixture ONLY in isolated emulator; real joining is tested
  // separately with verified email and a single atomic invitation batch.
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),target),member);
  });
 });
 await run('Even group owner cannot bypass verified invitation for viewer Carol',async()=>{
  const target=groupPath+'/members/carol-uid';
  const member={uid:'carol-uid',role:'VIEWER',status:'ACTIVE'};
  await assertFails(setDoc(doc(alice,target),member));
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),target),member);
  });
 });
 await run('Outsider cannot self-promote to group ADMIN',
  ()=>assertFails(setDoc(doc(mallory,groupPath+'/members/mallory-uid'),{
    uid:'mallory-uid',role:'ADMIN',status:'ACTIVE'})));
 await run('Group creator cannot be replaced by fake membership',
  ()=>assertFails(setDoc(doc(alice,groupPath+'/members/alice-uid'),{
    uid:'alice-uid',role:'VIEWER',status:'REVOKED'})));
 await run('Active editor Bob can read the authorized group',
  ()=>assertSucceeds(getDoc(doc(bob,groupPath))));
 const sharedData={...privateData,ownerUid:'bob-uid',groupId,title:'共用記事'};
 await run('EDITOR can create shared note',
  ()=>assertSucceeds(setDoc(doc(bob,sharedPath),sharedData)));
 await run('VIEWER can read shared note',
  ()=>assertSucceeds(getDoc(doc(carol,sharedPath))));
 await run('Outsider cannot read shared note',
  ()=>assertFails(getDoc(doc(mallory,sharedPath))));
 await run('VIEWER cannot create shared note',
  ()=>assertFails(setDoc(doc(carol,groupPath+'/notes/viewer-write'),{
    ...sharedData,ownerUid:'carol-uid'})));
 await run('VIEWER cannot edit shared note',
  ()=>assertFails(updateDoc(doc(carol,sharedPath),{content:'unauthorized',version:2})));
 await run('EDITOR can modify shared note only with next version',
  ()=>assertSucceeds(updateDoc(doc(bob,sharedPath),{content:'授權更新',version:2})));
 await run('Stale phone cannot overwrite newer shared note',
  ()=>assertFails(updateDoc(doc(bob,sharedPath),{content:'舊版',version:2})));
 await run('EDITOR cannot hard-delete shared note',
  ()=>assertFails(deleteDoc(doc(bob,sharedPath))));
 await run('Owner can revoke viewer Carol',
  ()=>assertSucceeds(updateDoc(doc(alice,groupPath+'/members/carol-uid'),{status:'REVOKED'})));
 await run('Revoked viewer cannot reopen shared article',
  ()=>assertFails(getDoc(doc(carol,sharedPath))));
 await run('Group owner can downgrade Bob to VIEWER',
  ()=>assertSucceeds(updateDoc(doc(alice,groupPath+'/members/bob-uid'),{role:'VIEWER'})));
 await run('Downgraded Bob can view but cannot modify shared note',
  async()=>{await assertSucceeds(getDoc(doc(bob,sharedPath)));
    await assertFails(updateDoc(doc(bob,sharedPath),{content:'after revoke',version:3}));});
 await run('Non-admin Bob cannot grant himself ADMIN',
  ()=>assertFails(updateDoc(doc(bob,groupPath+'/members/bob-uid'),{role:'ADMIN'})));
 await run('Owner may delete a shared note',
  ()=>assertSucceeds(deleteDoc(doc(alice,sharedPath))));
 console.log('FIREBASE_SECURITY_RULES_EMULATOR_PASS',passed);
}finally{await env.cleanup();}
