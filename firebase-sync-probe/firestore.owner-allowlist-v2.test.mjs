import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,Timestamp} from 'firebase/firestore';
const template=readFileSync('firestore.owner-allowlist-v2.rules','utf8');
if(!template.includes('__OWNER_UID__'))throw Error('OWNER_PLACEHOLDER_MISSING');
const rules=template.replaceAll('__OWNER_UID__','owner-uid');
const env=await initializeTestEnvironment({projectId:'demo-honbin-crm-owner-allowlist',
 firestore:{host:'127.0.0.1',port:8080,rules}});
const who=(uid,email,verified=true,provider='google.com')=>env.authenticatedContext(uid,{
 email,email_verified:verified,firebase:{sign_in_provider:provider}}).firestore();
const owner=who('owner-uid','owner@example.test');
const alice=who('alice-uid','alice@example.test');
const bob=who('bob-uid','bob@example.test');
const stranger=who('stranger-uid','stranger@example.test');
const spoof=who('owner-uid','owner@example.test',true,'password');
const notVerified=who('owner-uid','owner@example.test',false);
const anon=env.unauthenticatedContext().firestore();
const approved=email=>doc(owner,'approvedAccounts/'+email);
const note=(uid)=>({ownerUid:uid,groupId:null,title:'合成資料',content:'僅用於安全測試',
 createdAt:Timestamp.now(),updatedAt:Timestamp.now(),version:1,deleted:false});
let count=0;
async function test(label,fn){console.log('BEGIN allowlist '+label);await fn();count++;console.log('PASS allowlist '+count+': '+label)}
try{
 await test('Owner with verified Google provider may create own note',()=>assertSucceeds(setDoc(doc(owner,'users/owner-uid/notes/one'),note('owner-uid'))));
 await test('Owner may create global approved email',()=>assertSucceeds(setDoc(approved('alice@example.test'),{email:'alice@example.test',status:'ACTIVE',createdAt:Timestamp.now()})));
 await test('Approved Alice may create private note',()=>assertSucceeds(setDoc(doc(alice,'users/alice-uid/notes/one'),note('alice-uid'))));
 await test('Approved Alice may read own note',()=>assertSucceeds(getDoc(doc(alice,'users/alice-uid/notes/one'))));
 await test('Unapproved Bob cannot create private note',()=>assertFails(setDoc(doc(bob,'users/bob-uid/notes/one'),note('bob-uid'))));
 await test('Unapproved Bob cannot create group',()=>assertFails(setDoc(doc(bob,'groups/bob-group'),{ownerUid:'bob-uid',name:'No',createdAt:Timestamp.now()})));
 await test('Unapproved Bob cannot list private index',()=>assertFails(getDocs(collection(bob,'users/bob-uid/groupIndex'))));
 await test('Unapproved Bob cannot read Alice private note',()=>assertFails(getDoc(doc(bob,'users/alice-uid/notes/one'))));
 await test('Approved Alice cannot read owner private note',()=>assertFails(getDoc(doc(alice,'users/owner-uid/notes/one'))));
 await test('Approved Alice cannot create approvals',()=>assertFails(setDoc(doc(alice,'approvedAccounts/bob@example.test'),{email:'bob@example.test',status:'ACTIVE',createdAt:Timestamp.now()})));
 await test('Approved Alice cannot list approved accounts',()=>assertFails(getDocs(collection(alice,'approvedAccounts'))));
 await test('Owner can list approved accounts',()=>assertSucceeds(getDocs(collection(owner,'approvedAccounts'))));
 await test('Owner can approve Bob before Bob has ever logged in',()=>assertSucceeds(setDoc(approved('bob@example.test'),{email:'bob@example.test',status:'ACTIVE',createdAt:Timestamp.now()})));
 await test('Bob now can create private note',()=>assertSucceeds(setDoc(doc(bob,'users/bob-uid/notes/one'),note('bob-uid'))));
 await test('Owner can revoke Bob',()=>assertSucceeds(updateDoc(approved('bob@example.test'),{status:'REVOKED'})));
 await test('Revoked Bob cannot read existing private note',()=>assertFails(getDoc(doc(bob,'users/bob-uid/notes/one'))));
 await test('Revoked Bob cannot update own private note',()=>assertFails(updateDoc(doc(bob,'users/bob-uid/notes/one'),{content:'revoked',version:2})));
 await test('Owner can reactivate Bob',()=>assertSucceeds(updateDoc(approved('bob@example.test'),{status:'ACTIVE'})));
 await test('Reapproved Bob can read own note',()=>assertSucceeds(getDoc(doc(bob,'users/bob-uid/notes/one'))));
 await test('Owner cannot approve malformed email',()=>assertFails(setDoc(approved('not-an-email'),{email:'not-an-email',status:'ACTIVE',createdAt:Timestamp.now()})));
 await test('Owner cannot approve uppercase path',()=>assertFails(setDoc(approved('A@EXAMPLE.TEST'),{email:'A@EXAMPLE.TEST',status:'ACTIVE',createdAt:Timestamp.now()})));
 await test('Owner cannot approve mismatched document email',()=>assertFails(setDoc(approved('carol@example.test'),{email:'mallory@example.test',status:'ACTIVE',createdAt:Timestamp.now()})));
 await test('Owner cannot approve with extra fields',()=>assertFails(setDoc(approved('carol@example.test'),{email:'carol@example.test',status:'ACTIVE',createdAt:Timestamp.now(),isAdmin:true})));
 await test('Unverified Google identity cannot bootstrap owner',()=>assertFails(getDocs(collection(notVerified,'approvedAccounts'))));
 await test('Non-Google identity with matching UID cannot bootstrap owner',()=>assertFails(getDocs(collection(spoof,'approvedAccounts'))));
 await test('Anonymous cannot list approvals',()=>assertFails(getDocs(collection(anon,'approvedAccounts'))));
 await test('Unknown stranger cannot list approvals',()=>assertFails(getDocs(collection(stranger,'approvedAccounts'))));
 await test('Approved Alice cannot change own approval',()=>assertFails(updateDoc(doc(alice,'approvedAccounts/alice@example.test'),{status:'REVOKED'})));
 await test('Approved Alice cannot delete owner-created approval',()=>assertFails(deleteDoc(doc(alice,'approvedAccounts/alice@example.test'))));
 await test('Owner can revoke Alice',()=>assertSucceeds(updateDoc(approved('alice@example.test'),{status:'REVOKED'})));
 await test('Revoked Alice cannot read existing private note',()=>assertFails(getDoc(doc(alice,'users/alice-uid/notes/one'))));
 await test('Revoked Alice cannot read own group index',()=>assertFails(getDocs(collection(alice,'users/alice-uid/groupIndex'))));
 await test('Owner cannot alter immutable approved email field',()=>assertFails(updateDoc(approved('alice@example.test'),{email:'changed@example.test'})));
 await test('Owner cannot alter immutable approval timestamp',()=>assertFails(updateDoc(approved('alice@example.test'),{createdAt:Timestamp.now()})));
 await test('Owner can delete revoked approval',()=>assertSucceeds(deleteDoc(approved('alice@example.test'))));
 await test('Removed Alice still cannot read old note',()=>assertFails(getDoc(doc(alice,'users/alice-uid/notes/one'))));
 console.log('FIREBASE_OWNER_ALLOWLIST_EMULATOR_PASS',count);
}finally{await env.cleanup()}
