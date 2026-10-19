// Real official Firestore emulator: durable outgoing email invitation index.
// No live Firebase project, no private real accounts or production data.
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,updateDoc,deleteDoc,writeBatch,Timestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({
 projectId:'demo-honbin-outbox',
 firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}
});
const actor=(uid,email)=>env.authenticatedContext(uid,{email,email_verified:true,
 firebase:{sign_in_provider:'google.com'}}).firestore();
const alice=actor('admin-one','alice@example.test');
const bob=actor('recipient','bob@example.test');
const charlie=actor('other-owner','charlie@example.test');
const editor=actor('editor','editor@example.test');
const gid='outbox-team',sent='groups/'+gid+'/sentInvites/invite-1';
const recv='inboxes/bob@example.test/invites/invite-1';
const invite={groupId:gid,recipientEmail:'bob@example.test',
 role:'VIEWER',status:'PENDING',invitedBy:'admin-one'};
const entry={groupId:gid,recipientEmail:'bob@example.test',role:'VIEWER',
 invitedBy:'admin-one',createdAt:Timestamp.now()};
let n=0;async function test(name,fn){console.log('BEGIN',name);await fn();n++;console.log('PASS',name)}
try{
 await test('Group owner creates group',()=>assertSucceeds(setDoc(doc(alice,'groups/'+gid),{
   ownerUid:'admin-one',name:'Test only',createdAt:Timestamp.now()
 })));
 await test('Unpaired outbound directory entry denied',()=>assertFails(setDoc(doc(alice,sent),entry)));
 await test('Atomic invite and outbound directory succeeds',async()=>{
   const b=writeBatch(alice);b.set(doc(alice,recv),invite);b.set(doc(alice,sent),entry);
   await assertSucceeds(b.commit());
 });
 await test('Admin may list own group outgoing invitations',
   ()=>assertSucceeds(getDocs(collection(alice,'groups/'+gid+'/sentInvites'))));
 await test('Admin may inspect status by exact invitation ID',
   ()=>assertSucceeds(getDoc(doc(alice,recv))));
 await test('Recipient reads own invite',()=>assertSucceeds(getDoc(doc(bob,recv))));
 await test('Recipient cannot read admin outbox',()=>assertFails(getDoc(doc(bob,sent))));
 await test('Unrelated account cannot list admin outbox',()=>assertFails(
   getDocs(collection(charlie,'groups/'+gid+'/sentInvites'))));
 await test('Unrelated account cannot read recipient inbox',()=>assertFails(getDoc(doc(charlie,recv))));
 await test('Editor cannot read admin outbox',async()=>{
   await assertSucceeds(setDoc(doc(alice,'groups/'+gid+'/members/editor'),{
     uid:'editor',status:'ACTIVE',role:'EDITOR'
   }));
   await assertFails(getDocs(collection(editor,'groups/'+gid+'/sentInvites')));
 });
 await test('Admin cannot mutate permanent index',()=>assertFails(updateDoc(doc(alice,sent),{role:'ADMIN'})));
 await test('Admin cannot delete permanent index',()=>assertFails(deleteDoc(doc(alice,sent))));
 await test('Admin may revoke original unused invitation',async()=>{
   await assertSucceeds(updateDoc(doc(alice,recv),{status:'REVOKED'}));
   const changed=await getDoc(doc(alice,recv));if(changed.data().status!=='REVOKED')throw Error('NOT_REVOKED');
 });
 await test('Forged mismatch index cannot point at a different recipient',()=>assertFails(
   setDoc(doc(alice,'groups/'+gid+'/sentInvites/invite-2'),{...entry,recipientEmail:'mallory@example.test'})));
 console.log('FIREBASE_OUTBOUND_SECURITY_EMULATOR_PASS',n);
}finally{await env.cleanup()}
