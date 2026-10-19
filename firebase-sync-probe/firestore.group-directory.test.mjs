import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {collection,deleteDoc,doc,getDoc,getDocs,setDoc,updateDoc,writeBatch,Timestamp} from 'firebase/firestore';

const env=await initializeTestEnvironment({
 projectId:'demo-honbin-crm-directory',
 firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}
});
const who=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).firestore();
const unauth=env.unauthenticatedContext().firestore();
const owner=who('group-owner'),member=who('group-member'),outsider=who('stranger');
const groupId='private-team',base='groups/'+groupId;
const ownerIndex='users/group-owner/groupIndex/'+groupId;
const memberIndex='users/group-member/groupIndex/'+groupId;
const t=Timestamp.fromDate(new Date('2026-10-19T12:00:00Z'));
const groupData={ownerUid:'group-owner',name:'Private undisclosed name',createdAt:t};
const pointer=uid=>({uid,groupId,createdAt:t});
let count=0;
async function test(name,fn){console.log('BEGIN',name);await fn();count++;console.log('PASS',name)}
try {
 await test('Owner creates group and discovery pointer in one atomic batch',async()=>{
  const b=writeBatch(owner);
  b.set(doc(owner,base),groupData);
  b.set(doc(owner,ownerIndex),pointer('group-owner'));
  await assertSucceeds(b.commit());
 });
 await test('Owner lists own index',()=>assertSucceeds(getDocs(collection(owner,'users/group-owner/groupIndex'))));
 await test('Owner resolves own group',()=>assertSucceeds(getDoc(doc(owner,base))));
 await test('Anonymous cannot list owner index',()=>assertFails(getDocs(collection(unauth,'users/group-owner/groupIndex'))));
 await test('Other Google user cannot list owner index',()=>assertFails(getDocs(collection(member,'users/group-owner/groupIndex'))));
 await test('Other Google user cannot read owner pointer',()=>assertFails(getDoc(doc(member,ownerIndex))));
 await test('Global groups list stays denied',()=>assertFails(getDocs(collection(owner,'groups'))));
 await test('Outsider cannot index existing private group',()=>assertFails(setDoc(doc(outsider,'users/stranger/groupIndex/'+groupId),pointer('stranger'))));
 await test('Owner cannot create foreign user index',()=>assertFails(setDoc(doc(owner,memberIndex),pointer('group-member'))));
 await test('Cannot forge index owner UID',()=>assertFails(setDoc(doc(owner,'users/group-owner/groupIndex/forged'),{
  uid:'stranger',groupId:'forged',createdAt:t
 })));
 await test('Cannot create dangling index for non-existent group',()=>assertFails(setDoc(doc(owner,'users/group-owner/groupIndex/does-not-exist'),{
  uid:'group-owner',groupId:'does-not-exist',createdAt:t
 })));
 await test('Cannot embed private group title or secrets in pointer',()=>assertFails(setDoc(doc(owner,'users/group-owner/groupIndex/extra'),{
  uid:'group-owner',groupId:'extra',createdAt:t,title:'must never be copied'
 })));
 await test('Pointers are immutable (update denied)',()=>assertFails(updateDoc(doc(owner,ownerIndex),{createdAt:Timestamp.now()})));
 await test('Owner grants viewer group membership',()=>assertSucceeds(setDoc(doc(owner,base+'/members/group-member'),{
  uid:'group-member',role:'VIEWER',status:'ACTIVE'
 })));
 await test('Viewer may register own discovery pointer',()=>assertSucceeds(setDoc(doc(member,memberIndex),pointer('group-member'))));
 await test('Viewer can list own index',()=>assertSucceeds(getDocs(collection(member,'users/group-member/groupIndex'))));
 await test('Viewer can resolve group',()=>assertSucceeds(getDoc(doc(member,base))));
 await test('Revoked viewer loses actual group access',async()=>{
  await assertSucceeds(updateDoc(doc(owner,base+'/members/group-member'),{status:'REVOKED'}));
  await assertFails(getDoc(doc(member,base)));
 });
 await test('Revoked viewer can read only their own stale pointer',()=>assertSucceeds(getDoc(doc(member,memberIndex))));
 await test('Revoked viewer can remove own pointer',()=>assertSucceeds(deleteDoc(doc(member,memberIndex))));
 await test('Revoked viewer cannot recreate pointer',()=>assertFails(setDoc(doc(member,memberIndex),pointer('group-member'))));
 await test('Outsider cannot remove owner pointer',()=>assertFails(deleteDoc(doc(outsider,ownerIndex))));
 console.log('FIREBASE_GROUP_DIRECTORY_RULES_PASS',count);
}finally{await env.cleanup()}
