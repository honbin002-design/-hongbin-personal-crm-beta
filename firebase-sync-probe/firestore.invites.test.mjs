import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,getDocs,setDoc,updateDoc,collection,writeBatch,Timestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({
 projectId:'demo-honbin-crm-invites',
 firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}
});
const actor=(uid,email,verified=true)=>env.authenticatedContext(uid,{
 firebase:{sign_in_provider:'google.com'},email,email_verified:verified
}).firestore();
const alice=actor('alice-uid','alice@example.test');
const bob=actor('bob-uid','bob@example.test');
const stranger=actor('stranger-uid','stranger@example.test');
const notVerified=actor('unverified-uid','bob@example.test',false);
const gid='g-invites',group='groups/'+gid;
const invitation='inboxes/bob@example.test/invites/bob-first';
const membership=group+'/members/bob-uid';
const inviteData={groupId:gid,recipientEmail:'bob@example.test',
 role:'VIEWER',status:'PENDING',invitedBy:'alice-uid'};
let done=0;
async function check(name,fn){console.log('BEGIN',name);await fn();done++;console.log('PASS',name)}
try{
 await check('Group owner creates a group',()=>assertSucceeds(setDoc(doc(alice,group),{
  ownerUid:'alice-uid',name:'test only',createdAt:Timestamp.now()
 })));
 await check('Admin creates pending invitation to not-yet-registered email',
  ()=>assertSucceeds(setDoc(doc(alice,invitation),inviteData)));
 await check('Recipient with verified Google email sees invite',
  ()=>assertSucceeds(getDoc(doc(bob,invitation))));
 await check('Another Google email cannot read pending invitation',
  ()=>assertFails(getDoc(doc(stranger,invitation))));
 await check('Unverified Google email cannot read invitation',
  ()=>assertFails(getDoc(doc(notVerified,invitation))));
 await check('Another account cannot list recipient inbox',
  ()=>assertFails(getDocs(collection(stranger,'inboxes/bob@example.test/invites'))));
 await check('Stranger cannot create invite as fake group admin',
  ()=>assertFails(setDoc(doc(stranger,'inboxes/bob@example.test/invites/forged'),{
   ...inviteData,invitedBy:'stranger-uid'
  })));
 await check('Invitation alone cannot create membership',
  ()=>assertFails(setDoc(doc(bob,membership),{
   uid:'bob-uid',role:'VIEWER',status:'ACTIVE',invitationId:'bob-first'
  })));
 await check('Invitation acceptance alone without member fails',
  ()=>assertFails(updateDoc(doc(bob,invitation),{
   status:'ACCEPTED',acceptedUid:'bob-uid'
  })));
 await check('Role escalation during acceptance rejected',async()=>{
  const batch=writeBatch(bob);
  batch.update(doc(bob,invitation),{status:'ACCEPTED',acceptedUid:'bob-uid'});
  batch.set(doc(bob,membership),{
   uid:'bob-uid',role:'ADMIN',status:'ACTIVE',invitationId:'bob-first'
  });
  await assertFails(batch.commit());
 });
 await check('Atomic invitation acceptance plus exact UID membership succeeds',async()=>{
  const batch=writeBatch(bob);
  batch.update(doc(bob,invitation),{status:'ACCEPTED',acceptedUid:'bob-uid'});
  batch.set(doc(bob,membership),{
   uid:'bob-uid',role:'VIEWER',status:'ACTIVE',invitationId:'bob-first'
  });
  await assertSucceeds(batch.commit());
 });
 await check('Accepted recipient can see group',
  ()=>assertSucceeds(getDoc(doc(bob,group))));
 await check('Accepted VIEWER cannot write shared note',
  ()=>assertFails(setDoc(doc(bob,group+'/notes/forbidden'),{
   ownerUid:'bob-uid',groupId:gid,title:'x',content:'x',
   createdAt:Timestamp.now(),updatedAt:Timestamp.now(),version:1,deleted:false
  })));
 await check('Consumed invitation cannot be reused after revocation',async()=>{
  await assertSucceeds(updateDoc(doc(alice,membership),{status:'REVOKED'}));
  await assertFails(updateDoc(doc(bob,membership),{status:'ACTIVE'}));
  await assertFails(getDoc(doc(bob,group)));
 });
 await check('Owner may revoke pending invitation before acceptance',async()=>{
  const e=actor('erin-uid','erin@example.test');
  const invite='inboxes/erin@example.test/invites/erin-pending';
  await assertSucceeds(setDoc(doc(alice,invite),{
   ...inviteData,recipientEmail:'erin@example.test'
  }));
  await assertSucceeds(updateDoc(doc(alice,invite),{status:'REVOKED'}));
  const batch=writeBatch(e);
  batch.update(doc(e,invite),{status:'ACCEPTED',acceptedUid:'erin-uid'});
  batch.set(doc(e,group+'/members/erin-uid'),{
   uid:'erin-uid',role:'VIEWER',status:'ACTIVE',invitationId:'erin-pending'
  });
  await assertFails(batch.commit());
 });
 console.log('FIREBASE_VERIFIED_EMAIL_INVITES_PASS',done);
}finally{await env.cleanup()}
