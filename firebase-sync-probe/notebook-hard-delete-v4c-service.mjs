// V4C ISOLATED TEST client. Requires owner-approved Firestore Rules V4C
// (NOT deployed), explicit per-notebook owner confirmation and synthetic data.
// This module intentionally never deletes /groups/{id} itself. Firestore
// Security Rules cannot verify dynamically that every descendant is absent.
import {planNotebookHardDelete} from './notebook-hard-delete-plan.mjs';
const ID=/^[A-Za-z0-9_-]{1,180}$/;
const validId=s=>typeof s==='string'&&ID.test(s);
const error=code=>{throw Error(code)};
const ensureServer=snapshot=>{
 if(!snapshot||snapshot.metadata?.fromCache===true)error('CACHED_READBACK_NOT_ACCEPTABLE');
 return snapshot;
};
export function notebookHardDeleteV4C({db,sdk,actor}={}){
 if(!db||!sdk||!actor||!validId(actor.uid)||typeof actor.currentUid!=='function'
   ||actor.emailVerified!==true||actor.providerId!=='google.com')
   error('VERIFIED_GOOGLE_OWNER_REQUIRED');
 const required=['doc','collection','getDocFromServer','getDocsFromServer',
  'updateDoc','deleteDoc','writeBatch','runTransaction','Timestamp'];
 for(const key of required)if(!sdk[key])error('SDK_MISSING_'+key);
 const uid=actor.uid;
 const guard=()=>{if(actor.currentUid()!==uid)error('DELETION_GOOGLE_ACCOUNT_CHANGED')};
 const ref=gid=>{if(!validId(gid))error('INVALID_NOTEBOOK_ID');return sdk.doc(db,'groups',gid)};
 const pathRef=p=>sdk.doc(db,p);
 const groupChildren=(gid,child)=>sdk.collection(db,'groups',gid,child);
 const readGroup=async gid=>{
  guard();const snap=ensureServer(await sdk.getDocFromServer(ref(gid)));guard();
  if(!snap.exists())error('NOTEBOOK_NOT_FOUND');
  if(snap.data().ownerUid!==uid)error('NOTEBOOK_CREATOR_REQUIRED');
  return {id:gid,...snap.data()};
 };
 const serverList=async(groupId,kind)=>{
  guard();const snap=ensureServer(await sdk.getDocsFromServer(groupChildren(groupId,kind)));
  guard();return snap.docs.map(d=>({id:d.id,...d.data()}));
 };
 async function preview(groupId){
  const group=await readGroup(groupId);
  if(group.deleteState)error('NOTEBOOK_ALREADY_LOCKED');
  const [notes,members,sentInvites]=await Promise.all([
   serverList(groupId,'notes'),serverList(groupId,'members'),serverList(groupId,'sentInvites')]);
  guard();
  return Object.freeze({groupId,name:group.name,
   noteCount:notes.length,memberCount:members.length,invitationCount:sentInvites.length,
   requiresTypedName:true,irreversible:true});
 }
 async function lock(groupId,{typedName,deletionId}={}){
  if(!validId(deletionId)||deletionId.length<16)error('INVALID_DELETE_EPOCH');
  const group=await readGroup(groupId);
  if(!typedName||typedName!==group.name)error('NOTEBOOK_NAME_CONFIRMATION_REQUIRED');
  guard();
  await sdk.runTransaction(db,async tx=>{
   guard();const snap=await tx.get(ref(groupId));guard();
   if(!snap.exists()||snap.data().ownerUid!==uid)error('NOTEBOOK_CREATOR_REQUIRED');
   if(snap.data().deleteState)error('NOTEBOOK_ALREADY_LOCKED');
   if(snap.data().name!==typedName)error('NOTEBOOK_NAME_CHANGED');
   tx.update(ref(groupId),{deleteState:'DELETING',deletionId,
    deletingAt:sdk.Timestamp.now()});
  });
  const fresh=await readGroup(groupId);
  if(fresh.deleteState!=='DELETING'||fresh.deletionId!==deletionId)
   error('DELETION_LOCK_READBACK_FAILED');
  return Object.freeze({groupId,deletionId,stage:'LOCKED',rootPhysicalDeletion:false});
 }
 async function inventory(groupId,deletionId){
  const group=await readGroup(groupId);
  if(group.deleteState!=='DELETING'||group.deletionId!==deletionId)
   error('DELETE_EPOCH_MISMATCH');
  const [notes,members,sentInvites]=await Promise.all([
   serverList(groupId,'notes'),serverList(groupId,'members'),serverList(groupId,'sentInvites')]);
  guard();
  const manifest=planNotebookHardDelete({
   actorUid:uid,group:{...group,deleteState:'DELETING'},deletionId,
   inventory:{
    notes:{complete:true,items:notes.map(x=>({id:x.id,groupId:x.groupId}))},
    members:{complete:true,items:members.map(x=>({uid:x.uid}))},
    sentInvites:{complete:true,items:sentInvites.map(x=>({
     id:x.id,groupId:x.groupId,recipientEmail:x.recipientEmail}))}
   }
  });
  return Object.freeze({group,notes,members,sentInvites,manifest});
 }
 async function batchDelete(paths){
  guard();
  if(paths.length<1||paths.length>10)error('UNSAFE_BATCH_LENGTH');
  const batch=sdk.writeBatch(db);
  for(const p of paths)batch.delete(pathRef(p));
  await batch.commit();guard();
 }
 async function runCleanup(groupId,deletionId){
  // Explicit caller action only; never run automatically on page load.
  // Fresh server inventory on every retry. V4C Rules enforce atomic pairs.
  if(!validId(deletionId)||deletionId.length<16)error('INVALID_DELETE_EPOCH');
  let state=await inventory(groupId,deletionId);
  for(let i=0;i<state.notes.length;i+=10){
   await batchDelete(state.notes.slice(i,i+10).map(n=>'groups/'+groupId+'/notes/'+n.id));
  }
  // Each pair is one Firestore atomic batch: ACK loss cannot separate them.
  for(const inv of state.sentInvites){
   await batchDelete([
    'inboxes/'+inv.recipientEmail+'/invites/'+inv.id,
    'groups/'+groupId+'/sentInvites/'+inv.id
   ]);
  }
  for(const m of state.members){
   // Some members may never have completed ensureIndex. Their member
   // document still must be deleted, without fabricating pointer evidence.
   guard();
   const pointer='users/'+m.uid+'/groupIndex/'+groupId;
   const exact=ensureServer(await sdk.getDocFromServer(pathRef(pointer)));
   guard();
   const paths=exact.exists()?[pointer,'groups/'+groupId+'/members/'+m.uid]:
    ['groups/'+groupId+'/members/'+m.uid];
   await batchDelete(paths);
  }
  // Owner is an implicit ADMIN, not listed in /members.
  const own='users/'+uid+'/groupIndex/'+groupId;
  const ownSnap=ensureServer(await sdk.getDocFromServer(pathRef(own)));
  if(ownSnap.exists())await batchDelete([own]);
  state=await inventory(groupId,deletionId);
  const pointer=ensureServer(await sdk.getDocFromServer(pathRef(own)));
  guard();
  if(state.notes.length||state.members.length||state.sentInvites.length||pointer.exists())
   error('DELETE_CLEANUP_NOT_YET_COMPLETE');
  // The root stays permanently locked: ordinary members have zero access
  // and cannot resurrect notes. Final root removal requires a trusted,
  // separately approved server-side verification protocol.
  return Object.freeze({groupId,deletionId,stage:'CONTENT_CLEANED_ROOT_LOCKED',
   notesRemaining:0,membersRemaining:0,sentInvitesRemaining:0,ownerPointerRemaining:0,
   rootPhysicalDeletion:false,rootDeletionAuthorized:false});
 }
 return Object.freeze({preview,lock,inventory,runCleanup});
}
