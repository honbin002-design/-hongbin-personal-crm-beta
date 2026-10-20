import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,writeBatch,deleteField,Timestamp} from 'firebase/firestore';
// Firestore Java emulator. All accounts, group names and notes are synthetic.
const rules=readFileSync('firestore.notebook-archive-v3.rules','utf8').replaceAll('__OWNER_UID__','owner-uid');
const env=await initializeTestEnvironment({
 projectId:'demo-honbin-crm-notebook-archive',
 firestore:{host:'127.0.0.1',port:8080,rules}
});
const as=(uid,email)=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'},email,email_verified:true}).firestore();
const owner=as('owner-uid','owner@example.test'),editor=as('editor-uid','editor@example.test');
const admin=as('admin-uid','admin@example.test'),viewer=as('viewer-uid','viewer@example.test');
const outsider=as('outsider-uid','outsider@example.test'),newMember=as('new-uid','new@example.test');
const group='groups/notebook-a',other='groups/notebook-b',notes=group+'/notes/note-a';
const stamp=()=>Timestamp.now();
const basic=(uid,id)=>({ownerUid:uid,groupId:id,title:'模擬共用測試',content:'沒有真實客戶資料',
 createdAt:stamp(),updatedAt:stamp(),version:1,deleted:false});
let passed=0;
const test=async(name,fn)=>{console.log('BEGIN archive '+name);await fn();passed++;console.log('PASS archive '+passed+': '+name)};
try{
 await test('Owner can approve global Google emails',async()=>{
  for(const mail of ['editor@example.test','admin@example.test','viewer@example.test','outsider@example.test','new@example.test']){
   await assertSucceeds(setDoc(doc(owner,'approvedAccounts/'+mail),{
    email:mail,status:'ACTIVE',createdAt:stamp()
   }));
  }
 });
 await test('Legacy notebook without archivedAt can be created',()=>assertSucceeds(setDoc(doc(owner,group),{
  ownerUid:'owner-uid',name:'共用測試01',createdAt:stamp()
 })));
 await test('Independent second notebook can be created',()=>assertSucceeds(setDoc(doc(owner,other),{
  ownerUid:'owner-uid',name:'共用測試02',createdAt:stamp()
 })));
 await test('Fixture roles seeded only inside emulator',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   for(const [uid,role] of [['editor-uid','EDITOR'],['admin-uid','ADMIN'],['viewer-uid','VIEWER']]){
    await setDoc(doc(db,group+'/members/'+uid),{uid,role,status:'ACTIVE',invitationId:'fixture'});
   }
  });
 });
 await test('Editor can create shared note before archive',()=>assertSucceeds(setDoc(doc(editor,notes),basic('editor-uid','notebook-a'))));
 await test('Viewer can read shared note before archive',()=>assertSucceeds(getDoc(doc(viewer,notes))));
 await test('Notebook ADMIN cannot archive a notebook it does not own',()=>assertFails(updateDoc(doc(admin,group),{archivedAt:stamp()})));
 await test('Editor cannot archive notebook',()=>assertFails(updateDoc(doc(editor,group),{archivedAt:stamp()})));
 await test('Global allowlisted outsider cannot archive notebook',()=>assertFails(updateDoc(doc(outsider,group),{archivedAt:stamp()})));
 await test('Owner cannot change ownerUid while archiving',()=>assertFails(updateDoc(doc(owner,group),{archivedAt:stamp(),ownerUid:'attacker'})));
 await test('Owner cannot edit title while archiving',()=>assertFails(updateDoc(doc(owner,group),{archivedAt:stamp(),name:'forged'})));
 await test('Owner can archive via timestamp without deleting data',()=>assertSucceeds(updateDoc(doc(owner,group),{archivedAt:stamp()})));
 await test('Owner can read archived group metadata to restore',()=>assertSucceeds(getDoc(doc(owner,group))));
 await test('Member cannot read archived notebook metadata',()=>assertFails(getDoc(doc(editor,group))));
 await test('Admin cannot read archived notebook metadata',()=>assertFails(getDoc(doc(admin,group))));
 await test('Owner cannot read archived shared notes',()=>assertFails(getDoc(doc(owner,notes))));
 await test('Editor cannot read archived shared notes',()=>assertFails(getDoc(doc(editor,notes))));
 await test('Viewer cannot list archived shared notes',()=>assertFails(getDocs(collection(viewer,group+'/notes'))));
 await test('Owner cannot list archived shared notes',()=>assertFails(getDocs(collection(owner,group+'/notes'))));
 await test('Editor cannot write into archived shared notebook',()=>assertFails(setDoc(doc(editor,group+'/notes/other-note'),basic('editor-uid','notebook-a'))));
 await test('Owner cannot delete archived shared notes',()=>assertFails(deleteDoc(doc(owner,notes))));
 await test('Member cannot read own membership metadata after archive',()=>assertFails(getDoc(doc(editor,group+'/members/editor-uid'))));
 await test('Owner cannot rename archived notebook',()=>assertFails(updateDoc(doc(owner,group),{name:'should fail'})));
 await test('Owner cannot rearchive with arbitrary timestamp rewrite',()=>assertFails(updateDoc(doc(owner,group),{archivedAt:stamp()})));
 await test('Independent notebook remains accessible to owner',()=>assertSucceeds(getDoc(doc(owner,other))));
 await test('Owner private note remains functional',()=>assertSucceeds(setDoc(doc(owner,'users/owner-uid/notes/standalone'),basic('owner-uid',null))));
 await test('Hard delete of notebook remains forbidden even for owner',()=>assertFails(deleteDoc(doc(owner,group))));
 await test('Member cannot restore archived notebook',()=>assertFails(updateDoc(doc(admin,group),{archivedAt:deleteField()})));
 await test('Owner restores notebook by removing archivedAt',()=>assertSucceeds(updateDoc(doc(owner,group),{archivedAt:deleteField()})));
 await test('Editor regains note read after restore',()=>assertSucceeds(getDoc(doc(editor,notes))));
 await test('Viewer regains note read after restore',()=>assertSucceeds(getDoc(doc(viewer,notes))));
 await test('Owner may rename active notebook after restore',()=>assertSucceeds(updateDoc(doc(owner,group),{name:'共用測試01 已恢復'})));
 await test('Hard delete remains forbidden after restore',()=>assertFails(deleteDoc(doc(owner,group))));
 console.log('FIREBASE_NOTEBOOK_ARCHIVE_V3_EMULATOR_PASS',passed);
}finally{await env.cleanup()}
