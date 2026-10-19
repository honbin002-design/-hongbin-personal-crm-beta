// End-to-end client-service calls through REAL Firebase Firestore Emulator.
// All accounts, groups and invites are synthetic; zero live network access.
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import * as sdk from 'firebase/firestore';
import {groupService,normalizedEmail} from './firebase-group-service.mjs';

const env=await initializeTestEnvironment({
  projectId:'demo-honbin-group-flow',
  firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}
});
const user=(uid,email)=>({
 db:env.authenticatedContext(uid,{email,email_verified:true,
   firebase:{sign_in_provider:'google.com'}}).firestore(),
 identity:{uid,email,emailVerified:true}
});
const a=user('alice-flow','alice@example.test');
const b=user('bob-flow','bob@example.test');
const c=user('carol-flow','carol@example.test');
const outsider=user('mallory-flow','mallory@example.test');
const alice=groupService({...a,sdk}),bob=groupService({...b,sdk});
const carol=groupService({...c,sdk});
const stranger=groupService({...outsider,sdk});
let n=0;
async function check(name,fn){console.log('BEGIN',name);await fn();n++;console.log('PASS',name)}
try{
 await check('Email normalized; malformed paths rejected',async()=>{
  if(normalizedEmail(' BOB@EXAMPLE.TEST ')!=='bob@example.test')throw Error('NORMALIZE');
  await assertFails(Promise.resolve().then(()=>normalizedEmail('../bad')));
 });
 await check('Group creator and index commit as one batch',async()=>{
  const g=await alice.createGroup('合作群組');
  if(!g.id||g.role!=='ADMIN')throw Error('BAD_GROUP');
  globalThis.groupId=g.id;
 });
 const gid=globalThis.groupId;
 await check('Owner group list resolves actual authorized title',async()=>{
  const groups=await alice.listGroups();
  if(groups.length!==1||groups[0].name!=='合作群組'||groups[0].role!=='ADMIN')throw Error('NOT_FOUND');
 });
 await check('Outsider cannot discover group',async()=>{
  if((await stranger.listGroups()).length!==0)throw Error('GROUP_LEAK');
  await assertFails(sdk.getDoc(sdk.doc(outsider.db,'groups',gid)));
 });
 let bobInvite,carolInvite;
 await check('Owner issues verified-email invitation',async()=>{
  bobInvite=await alice.sendInvite(gid,'BOB@example.test','VIEWER');
  if(bobInvite.recipientEmail!=='bob@example.test')throw Error('WRONG_EMAIL');
 });
 await check('Only recipient inbox discovers invitation',async()=>{
  const invites=await bob.listInbox();
  if(invites.length!==1||invites[0].status!=='PENDING')throw Error('MISSING_INVITE');
  await assertFails(sdk.getDocs(sdk.collection(outsider.db,'inboxes','bob@example.test','invites')));
 });
 await check('VIEWER joins atomically and receives personal index',async()=>{
  const result=await bob.acceptInvite({id:bobInvite.id});
  if(!result.indexed||result.alreadyAccepted)throw Error('NOT_INDEXED');
 });
 await check('Recipient lists joined group with VIEWER role',async()=>{
  const groups=await bob.listGroups();
  if(groups.length!==1||groups[0].id!==gid||groups[0].role!=='VIEWER')throw Error('MEMBER_LIST');
 });
 await check('Accepted invite retry is safe and finds existing index',async()=>{
  const again=await bob.acceptInvite({id:bobInvite.id});
  if(!again.alreadyAccepted||!again.indexed)throw Error('NOT_IDEMPOTENT');
 });
 await check('VIEWER cannot invite another user',()=>assertFails(
  bob.sendInvite(gid,'someone@example.test','EDITOR')));
 await check('Owner sees and promotes member',async()=>{
  if(!(await alice.listMembers(gid)).some(m=>m.uid==='bob-flow'))throw Error('MEMBERS');
  await alice.changeMember(gid,'bob-flow','EDITOR');
  if((await bob.listGroups())[0].role!=='EDITOR')throw Error('ROLE_NOT_UPDATED');
 });
 await check('Owner revokes member',async()=>{
  await alice.changeMember(gid,'bob-flow','REVOKED');
  if((await bob.listGroups()).length!==0)throw Error('REVOKED_TITLE_LEAK');
 });
 await check('Consumed invite never renews revoked access',async()=>{
  await assertFails(bob.acceptInvite({id:bobInvite.id}));
  await assertFails(bob.ensureIndex(gid));
 });
 await check('Owner sends second pending invite',async()=>{
  carolInvite=await alice.sendInvite(gid,'carol@example.test','EDITOR');
  if(!carolInvite.id)throw Error('NO_INVITE_ID');
 });
 await check('Admin revokes pending email invite by receipt',async()=>{
  await alice.revokeInvite('carol@example.test',carolInvite.id);
  await assertFails(carol.acceptInvite({id:carolInvite.id}));
 });
 await check('Non-admin cannot revoke admin invitation',async()=>{
  await assertFails(stranger.revokeInvite('carol@example.test',carolInvite.id));
 });
 await check('Service blocks unsupported role and malformed invite',async()=>{
  await assertFails(alice.sendInvite(gid,'x@example.test','SUPER_ADMIN'));
  await assertFails(carol.acceptInvite({id:'bad/invite'}));
 });
 console.log('FIREBASE_GROUP_WORKFLOW_EMULATOR_PASS',n);
}finally{await env.cleanup()}
