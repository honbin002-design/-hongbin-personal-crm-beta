import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {
 collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,writeBatch,Timestamp,deleteField
} from 'firebase/firestore';
// All identities/data are synthetic, isolated from the live Spark database.
const rules=readFileSync('firestore.notebook-hard-delete-v4.rules','utf8')
 .replaceAll('__OWNER_UID__','global-owner');
const env=await initializeTestEnvironment({
 projectId:'demo-honbin-crm-hard-delete-v4',
 firestore:{host:'127.0.0.1',port:8080,rules}
});
const identity=(uid,email)=>env.authenticatedContext(uid,{
 firebase:{sign_in_provider:'google.com'},email,email_verified:true}).firestore();
const owner=identity('global-owner','owner@example.test');
const admin=identity('admin-uid','admin@example.test');
const editor=identity('editor-uid','editor@example.test');
const viewer=identity('viewer-uid','viewer@example.test');
const revoked=identity('revoked-uid','revoked@example.test');
const outsider=identity('outsider-uid','outsider@example.test');
const second=identity('second-owner','second@example.test');
const stamp=()=>Timestamp.now();
const group='groups/alpha',other='groups/beta';
const note=(uid,groupId='alpha',deleted=false)=>({
 ownerUid:uid,groupId,title:'純測試',content:'不含真實資料',createdAt:stamp(),
 updatedAt:stamp(),version:deleted?2:1,deleted
});
const invite=(id,mail,groupId='alpha',status='PENDING')=>({
 groupId,recipientEmail:mail,role:'VIEWER',status,invitedBy:'global-owner',
 ...(status==='ACCEPTED'?{acceptedUid:'viewer-uid'}:{})
});
const inbox=(mail,id)=>'inboxes/'+mail+'/invites/'+id;
const index=(uid,id='alpha')=>'users/'+uid+'/groupIndex/'+id;
let count=0;
async function test(name,fn){console.log('BEGIN hard-delete-v4 '+name);await fn();
 count++;console.log('PASS hard-delete-v4 '+count+': '+name)}
try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  for(const [email] of [
   ['admin@example.test'],['editor@example.test'],['viewer@example.test'],
   ['revoked@example.test'],['outsider@example.test'],['second@example.test']
  ])await setDoc(doc(db,'approvedAccounts/'+email),{email,status:'ACTIVE',createdAt:stamp()});
  for(const [path,ownerUid,name] of [[group,'global-owner','共用測試01'],
    [other,'global-owner','其他記事簿'],['groups/foreign','second-owner','其他人群組']])
   await setDoc(doc(db,path),{ownerUid,name,createdAt:stamp()});
  for(const [uid,role,status] of [
   ['admin-uid','ADMIN','ACTIVE'],['editor-uid','EDITOR','ACTIVE'],
   ['viewer-uid','VIEWER','ACTIVE'],['revoked-uid','VIEWER','REVOKED']])
   await setDoc(doc(db,group+'/members/'+uid),{uid,role,status,invitationId:'fixture'});
  await setDoc(doc(db,group+'/notes/n1'),note('editor-uid'));
  await setDoc(doc(db,group+'/notes/n2'),note('admin-uid','alpha',true));
  await setDoc(doc(db,other+'/notes/keep'),note('global-owner','beta'));
  await setDoc(doc(db,'groups/foreign/notes/keep'),note('second-owner','foreign'));
  for(const [id,mail,status] of [
   ['pending','viewer@example.test','PENDING'],
   ['accepted','admin@example.test','ACCEPTED'],
   ['revoked','revoked@example.test','REVOKED']]){
    await setDoc(doc(db,group+'/sentInvites/'+id),{
     groupId:'alpha',recipientEmail:mail,role:'VIEWER',
     invitedBy:'global-owner',createdAt:stamp()});
    await setDoc(doc(db,inbox(mail,id)),invite(id,mail,'alpha',status));
   }
  await setDoc(doc(db,other+'/sentInvites/keep'),{
   groupId:'beta',recipientEmail:'viewer@example.test',role:'VIEWER',
   invitedBy:'global-owner',createdAt:stamp()});
  await setDoc(doc(db,inbox('viewer@example.test','keep')),invite('keep','viewer@example.test','beta'));
  for(const uid of ['global-owner','admin-uid','editor-uid','viewer-uid','revoked-uid'])
   await setDoc(doc(db,index(uid)),{uid,groupId:'alpha',createdAt:stamp()});
  await setDoc(doc(db,index('viewer-uid','beta')),{uid:'viewer-uid',groupId:'beta',createdAt:stamp()});
 });
 await test('Active notebook can be read by member',()=>assertSucceeds(getDoc(doc(editor,group))));
 await test('Active notebook notes readable by viewer',()=>assertSucceeds(getDocs(collection(viewer,group+'/notes'))));
 await test('Owner can edit active name',()=>assertSucceeds(updateDoc(doc(owner,group),{name:'共用測試01'})));
 await test('Owner may still create private note',()=>assertSucceeds(setDoc(doc(owner,'users/global-owner/notes/private'),note('global-owner',null))));
 await test('Member can read own group index before lock',()=>assertSucceeds(getDoc(doc(viewer,index('viewer-uid')))));
 await test('Group ADMIN cannot lock notebook it does not own',()=>assertFails(updateDoc(doc(admin,group),{deleteState:'DELETING',deletionId:'valid_deletion_id_001',deletingAt:stamp()})));
 await test('Editor cannot lock notebook',()=>assertFails(updateDoc(doc(editor,group),{deleteState:'DELETING',deletionId:'valid_deletion_id_001',deletingAt:stamp()})));
 await test('Viewer cannot lock notebook',()=>assertFails(updateDoc(doc(viewer,group),{deleteState:'DELETING',deletionId:'valid_deletion_id_001',deletingAt:stamp()})));
 await test('Global approved outsider cannot lock notebook',()=>assertFails(updateDoc(doc(outsider,group),{deleteState:'DELETING',deletionId:'valid_deletion_id_001',deletingAt:stamp()})));
 await test('Owner cannot lock with tiny deletion identifier',()=>assertFails(updateDoc(doc(owner,group),{deleteState:'DELETING',deletionId:'x',deletingAt:stamp()})));
 await test('Owner cannot lock while rewriting immutable owner',()=>assertFails(updateDoc(doc(owner,group),{deleteState:'DELETING',deletionId:'valid_deletion_id_001',deletingAt:stamp(),ownerUid:'admin-uid'})));
 await test('Owner cannot lock while changing notebook title',()=>assertFails(updateDoc(doc(owner,group),{deleteState:'DELETING',deletionId:'valid_deletion_id_001',deletingAt:stamp(),name:'危險改名'})));
 await test('Owner can set one-way DELETING lock',()=>assertSucceeds(updateDoc(doc(owner,group),{
  deleteState:'DELETING',deletionId:'valid_deletion_id_001',deletingAt:stamp()
 })));
 await test('Owner may read exact locked group for progress',()=>assertSucceeds(getDoc(doc(owner,group))));
 await test('Admin cannot read locked group',()=>assertFails(getDoc(doc(admin,group))));
 await test('Editor cannot read locked group',()=>assertFails(getDoc(doc(editor,group))));
 await test('Viewer cannot read locked group',()=>assertFails(getDoc(doc(viewer,group))));
 await test('Admin cannot read locked shared notes',()=>assertFails(getDoc(doc(admin,group+'/notes/n1'))));
 await test('Editor cannot query locked shared notes',()=>assertFails(getDocs(collection(editor,group+'/notes'))));
 await test('Viewer cannot query locked shared notes',()=>assertFails(getDocs(collection(viewer,group+'/notes'))));
 await test('Owner can list locked notes only to clean them',()=>assertSucceeds(getDocs(collection(owner,group+'/notes'))));
 await test('Admin cannot hard delete locked note',()=>assertFails(deleteDoc(doc(admin,group+'/notes/n1'))));
 await test('Editor cannot create new note after lock',()=>assertFails(setDoc(doc(editor,group+'/notes/new'),note('editor-uid'))));
 await test('Owner cannot create new note after lock',()=>assertFails(setDoc(doc(owner,group+'/notes/new'),note('global-owner'))));
 await test('Owner cannot edit group title after lock',()=>assertFails(updateDoc(doc(owner,group),{name:'try rewrite'})));
 await test('Owner cannot roll back DELETING to ACTIVE',()=>assertFails(updateDoc(doc(owner,group),{deleteState:deleteField(),deletionId:deleteField(),deletingAt:deleteField()})));
 await test('Owner cannot rotate deletion epoch',()=>assertFails(updateDoc(doc(owner,group),{deletionId:'valid_deletion_id_002'})));
 await test('Owner cannot delete root before cleaning',()=>assertFails(deleteDoc(doc(owner,group))));
 await test('Admin cannot delete root',()=>assertFails(deleteDoc(doc(admin,group))));
 await test('Member cannot read own group membership after lock',()=>assertFails(getDoc(doc(editor,group+'/members/editor-uid'))));
 await test('Owner can enumerate membership records while locked',()=>assertSucceeds(getDocs(collection(owner,group+'/members'))));
 await test('Admin cannot enumerate membership records while locked',()=>assertFails(getDocs(collection(admin,group+'/members'))));
 await test('Owner can enumerate sent invitations while locked',()=>assertSucceeds(getDocs(collection(owner,group+'/sentInvites'))));
 await test('Admin cannot enumerate sent invitations while locked',()=>assertFails(getDocs(collection(admin,group+'/sentInvites'))));
 await test('No member may accept a locked notebook invite',async()=>{
  const b=writeBatch(viewer);
  b.update(doc(viewer,inbox('viewer@example.test','pending')),{status:'ACCEPTED',acceptedUid:'viewer-uid'});
  b.set(doc(viewer,group+'/members/viewer-uid'),{uid:'viewer-uid',role:'VIEWER',status:'ACTIVE',invitationId:'pending'});
  return assertFails(b.commit());
 });
 await test('No member may mint a new index for locked group',()=>assertFails(setDoc(doc(viewer,index('viewer-uid')),{uid:'viewer-uid',groupId:'alpha',createdAt:stamp()})));
 await test('Owner cannot mint new pointer while locked',()=>assertFails(setDoc(doc(owner,index('global-owner')),{uid:'global-owner',groupId:'alpha',createdAt:stamp()})));
 await test('Owner cannot list other user groupIndex directory',()=>assertFails(getDocs(collection(owner,'users/viewer-uid/groupIndex'))));
 await test('Owner can read exact cross-user pointer only for locked notebook',()=>assertSucceeds(getDoc(doc(owner,index('viewer-uid')))));
 await test('Owner cannot read exact pointer for still-active second notebook',()=>assertFails(getDoc(doc(owner,index('viewer-uid','beta')))));
 await test('Owner cannot delete pointer for other still-active notebook',()=>assertFails(deleteDoc(doc(owner,index('viewer-uid','beta')))));
 await test('Owner can still read another notebook notes',()=>assertSucceeds(getDoc(doc(owner,other+'/notes/keep'))));
 await test('Owner cannot delete another active notebook by cleanup privilege',()=>{
  // Owner is ADMIN in other notebook and can normally delete shared notes.
  // This test instead checks it does not gain cross-owner privileges.
  return assertFails(deleteDoc(doc(owner,'groups/foreign/notes/keep')));
 });
 await test('Owner cannot delete another owner group root',()=>assertFails(deleteDoc(doc(owner,'groups/foreign'))));
 await test('Owner cannot list a recipient email inbox',()=>assertFails(getDocs(collection(owner,'inboxes/viewer@example.test/invites'))));
 await test('Owner can get exact invitation belonging to locked group',()=>assertSucceeds(getDoc(doc(owner,inbox('viewer@example.test','pending')))));
 await test('Owner cannot delete exact invite belonging to other active notebook',()=>assertFails(deleteDoc(doc(owner,inbox('viewer@example.test','keep')))));
 await test('Member cannot delete invitation from locked group',()=>assertFails(deleteDoc(doc(viewer,inbox('viewer@example.test','pending')))));
 await test('Owner can physically delete PENDING invitation',()=>assertSucceeds(deleteDoc(doc(owner,inbox('viewer@example.test','pending')))));
 await test('Owner can physically delete ACCEPTED invitation',()=>assertSucceeds(deleteDoc(doc(owner,inbox('admin@example.test','accepted')))));
 await test('Owner can physically delete REVOKED invitation',()=>assertSucceeds(deleteDoc(doc(owner,inbox('revoked@example.test','revoked')))));
 await test('Owner can delete sent invite directory item after inbox',()=>assertSucceeds(deleteDoc(doc(owner,group+'/sentInvites/pending'))));
 await test('Owner can delete other sent invite directory item',()=>assertSucceeds(deleteDoc(doc(owner,group+'/sentInvites/accepted'))));
 await test('Owner can delete revoked invite directory item',()=>assertSucceeds(deleteDoc(doc(owner,group+'/sentInvites/revoked'))));
 await test('Owner can remove formerly soft-deleted shared note',()=>assertSucceeds(deleteDoc(doc(owner,group+'/notes/n2'))));
 await test('Owner can remove active shared note',()=>assertSucceeds(deleteDoc(doc(owner,group+'/notes/n1'))));
 await test('Owner can remove revoked member record',()=>assertSucceeds(deleteDoc(doc(owner,group+'/members/revoked-uid'))));
 await test('Owner can remove other member record',()=>assertSucceeds(deleteDoc(doc(owner,group+'/members/editor-uid'))));
 await test('Owner can remove admin member record',()=>assertSucceeds(deleteDoc(doc(owner,group+'/members/admin-uid'))));
 await test('Owner can remove viewer member record',()=>assertSucceeds(deleteDoc(doc(owner,group+'/members/viewer-uid'))));
 await test('Owner can remove revoked member cross-user pointer',()=>assertSucceeds(deleteDoc(doc(owner,index('revoked-uid')))));
 await test('Owner can remove editor cross-user pointer',()=>assertSucceeds(deleteDoc(doc(owner,index('editor-uid')))));
 await test('Owner can remove admin cross-user pointer',()=>assertSucceeds(deleteDoc(doc(owner,index('admin-uid')))));
 await test('Owner can remove viewer cross-user pointer',()=>assertSucceeds(deleteDoc(doc(owner,index('viewer-uid')))));
 await test('Owner can remove owner pointer',()=>assertSucceeds(deleteDoc(doc(owner,index('global-owner')))));
 await test('Owner notebook root remains locked when cleaned',async()=>{
  const snap=await assertSucceeds(getDoc(doc(owner,group)));
  assert.equal(snap.data().deleteState,'DELETING');
 });
 await test('Locked note directory now has zero docs',async()=>{const snap=await assertSucceeds(getDocs(collection(owner,group+'/notes')));assert.equal(snap.size,0)});
 await test('Locked member directory now has zero docs',async()=>{const snap=await assertSucceeds(getDocs(collection(owner,group+'/members')));assert.equal(snap.size,0)});
 await test('Locked sent invites directory now has zero docs',async()=>{const snap=await assertSucceeds(getDocs(collection(owner,group+'/sentInvites')));assert.equal(snap.size,0)});
 await test('Recipient inbox record from locked notebook absent',async()=>{const snap=await assertSucceeds(getDoc(doc(owner,inbox('viewer@example.test','pending'))));assert.equal(snap.exists(),false)});
 await test('Owner cross-user pointer from locked notebook absent',async()=>{const snap=await assertSucceeds(getDoc(doc(owner,index('viewer-uid'))));assert.equal(snap.exists(),false)});
 await test('Other notebook invitation still exists',async()=>{const snap=await assertSucceeds(getDoc(doc(owner,inbox('viewer@example.test','keep'))));assert.ok(snap.exists())});
 await test('Other notebook shared note still exists',async()=>{const snap=await assertSucceeds(getDoc(doc(owner,other+'/notes/keep')));assert.ok(snap.exists())});
 await test('Private note remains intact',async()=>{const snap=await assertSucceeds(getDoc(doc(owner,'users/global-owner/notes/private')));assert.ok(snap.exists())});
 await test('Account whitelist still present',async()=>{const snap=await assertSucceeds(getDoc(doc(owner,'approvedAccounts/viewer@example.test')));assert.ok(snap.exists())});
 await test('Group root still cannot be deleted even after zero documents',()=>assertFails(deleteDoc(doc(owner,group))));
 await test('No new notebook can reuse locked group id',()=>assertFails(setDoc(doc(owner,group),{ownerUid:'global-owner',name:'resurrect',createdAt:stamp()})));
 console.log('FIREBASE_NOTEBOOK_HARD_DELETE_V4_EMULATOR_PASS',count);
}finally{await env.cleanup()}
