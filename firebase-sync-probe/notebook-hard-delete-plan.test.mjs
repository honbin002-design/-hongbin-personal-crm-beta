import assert from 'node:assert/strict';
import {planNotebookHardDelete,qualifyFinalHardDelete,limitDeleteBatch} from './notebook-hard-delete-plan.mjs';
let n=0;const test=(name,fn)=>{fn();n++;console.log('PASS hard-delete dry-run '+n+': '+name)};
const base=()=>({actorUid:'owner_uid',group:{id:'book_a',ownerUid:'owner_uid',
 deleteState:'DELETING',deletionId:'delete_001'},deletionId:'delete_001',
 inventory:{notes:{complete:true,items:[{id:'n1',groupId:'book_a'},{id:'n2',groupId:'book_a'}]},
 members:{complete:true,items:[{uid:'editor_uid'},{uid:'revoked_uid'}]},
 sentInvites:{complete:true,items:[{id:'i1',groupId:'book_a',recipientEmail:'a@example.test'},
 {id:'i2',groupId:'book_a',recipientEmail:'b@example.test'}]}}});
const deny=(f,code)=>assert.throws(f,e=>e.message===code);
const manifest=()=>planNotebookHardDelete(base());
const paths=()=>manifest().operations.map(x=>x.path);
const finalProof=()=>({sameDeletionId:true,groupState:'DELETING',fromServer:true,
 notesComplete:true,membersComplete:true,sentInvitesComplete:true,externalReferencesChecked:true,
 notesRemaining:0,membersRemaining:0,sentInvitesRemaining:0,inboxInvitesRemaining:0,indexPointersRemaining:0});
test('Manifest includes all notes',()=>assert.deepEqual(manifest().counts.notes,2));
test('Manifest includes revoked membership record',()=>assert.ok(paths().includes('groups/book_a/members/revoked_uid')));
test('Manifest includes sent invitation directory',()=>assert.ok(paths().includes('groups/book_a/sentInvites/i1')));
test('Manifest includes exact recipient inbox invitation',()=>assert.ok(paths().includes('inboxes/a@example.test/invites/i1')));
test('Manifest includes owner index pointer',()=>assert.ok(paths().includes('users/owner_uid/groupIndex/book_a')));
test('Manifest includes revoked user index pointer',()=>assert.ok(paths().includes('users/revoked_uid/groupIndex/book_a')));
test('Private note path never in manifest',()=>assert.ok(paths().every(x=>!x.includes('/notes/')||x.startsWith('groups/'))));
test('Global approved account path never in manifest',()=>assert.ok(paths().every(x=>!x.startsWith('approvedAccounts/'))));
test('Operations never contain root group document',()=>assert.ok(!paths().includes('groups/book_a')));
test('Root deletion disabled in cleanup manifest',()=>assert.equal(manifest().rootDeletionAuthorized,false));
test('Deterministic order for safe resume',()=>assert.deepEqual(paths(),paths()));
test('Reordered server snapshot pages preserve every operation ID and order',()=>{
 const shuffled=base();
 shuffled.inventory.notes.items.reverse();
 shuffled.inventory.members.items.reverse();
 shuffled.inventory.sentInvites.items.reverse();
 assert.deepEqual(planNotebookHardDelete(shuffled).operations,manifest().operations);
});
test('Replaying same deletion manifest preserves operation identities',()=>{
 const a=manifest(),b=manifest();
 assert.deepEqual(a.operations.map(x=>x.id),b.operations.map(x=>x.id));
});

test('Member UID must be safe path segment',()=>{let b=base();b.inventory.members.items[0].uid='../leak';deny(()=>planNotebookHardDelete(b),'INVALID_MEMBER_UID')});
test('Note ID cannot escape notebook',()=>{let b=base();b.inventory.notes.items[0].id='../notes';deny(()=>planNotebookHardDelete(b),'INVALID_NOTE_SCOPE')});
test('Notes from other group fail-closed',()=>{let b=base();b.inventory.notes.items[1].groupId='book_b';deny(()=>planNotebookHardDelete(b),'INVALID_NOTE_SCOPE')});
test('Cross-group invite fails-closed',()=>{let b=base();b.inventory.sentInvites.items[0].groupId='book_b';deny(()=>planNotebookHardDelete(b),'INVALID_INVITE_SCOPE')});
test('Invalid recipient email fails-closed',()=>{let b=base();b.inventory.sentInvites.items[0].recipientEmail='../../secrets';deny(()=>planNotebookHardDelete(b),'INVALID_INVITE_SCOPE')});
test('Unexpected uppercase email fails-closed',()=>{let b=base();b.inventory.sentInvites.items[0].recipientEmail='A@example.test';deny(()=>planNotebookHardDelete(b),'INVALID_INVITE_SCOPE')});
test('Duplicate invitation records blocked',()=>{let b=base();b.inventory.sentInvites.items.push({...b.inventory.sentInvites.items[0]});deny(()=>planNotebookHardDelete(b),'DUPLICATE_DELETE_PATH')});
test('Duplicate note documents blocked',()=>{let b=base();b.inventory.notes.items.push({...b.inventory.notes.items[0]});deny(()=>planNotebookHardDelete(b),'DUPLICATE_DELETE_PATH')});
test('Duplicate member documents blocked',()=>{let b=base();b.inventory.members.items.push({...b.inventory.members.items[0]});deny(()=>planNotebookHardDelete(b),'DUPLICATE_DELETE_PATH')});
test('Group creator only can plan deletion',()=>{let b=base();b.actorUid='editor_uid';deny(()=>planNotebookHardDelete(b),'DELETE_OWNER_REQUIRED')});
test('Notebook ADMIN who is not creator cannot plan',()=>{let b=base();b.actorUid='admin_uid';deny(()=>planNotebookHardDelete(b),'DELETE_OWNER_REQUIRED')});
test('Unsealed active notebook rejected',()=>{let b=base();b.group.deleteState='ACTIVE';deny(()=>planNotebookHardDelete(b),'GROUP_NOT_LOCKED_FOR_THIS_DELETION')});
test('Archived is not equivalent to deletion lock',()=>{let b=base();b.group.deleteState='ARCHIVED';deny(()=>planNotebookHardDelete(b),'GROUP_NOT_LOCKED_FOR_THIS_DELETION')});
test('Other deletion epoch rejected',()=>{let b=base();b.group.deletionId='delete_002';deny(()=>planNotebookHardDelete(b),'GROUP_NOT_LOCKED_FOR_THIS_DELETION')});
test('Missing notes scan fails closed',()=>{let b=base();b.inventory.notes.complete=false;deny(()=>planNotebookHardDelete(b),'NOTES_SCAN_INCOMPLETE')});
test('Missing member scan fails closed',()=>{let b=base();b.inventory.members.complete=false;deny(()=>planNotebookHardDelete(b),'MEMBERS_SCAN_INCOMPLETE')});
test('Missing sent invites scan fails closed',()=>{let b=base();b.inventory.sentInvites.complete=false;deny(()=>planNotebookHardDelete(b),'SENT_INVITES_SCAN_INCOMPLETE')});
test('Empty group still includes owner pointer',()=>{let b=base();b.inventory.notes.items=[];b.inventory.members.items=[];b.inventory.sentInvites.items=[];assert.deepEqual(planNotebookHardDelete(b).counts,{notes:0,members:0,sentInvites:0,inboxInvites:0,indexPointers:1})});
test('Verified cleanup proof authorizes application root-finality proposal',()=>{
 const m=manifest(),r=qualifyFinalHardDelete({manifest:m,readback:finalProof(),actorUid:'owner_uid',deletionId:'delete_001'});
 assert.equal(r.eligible,true);assert.equal(r.rootPath,'groups/book_a');
});
test('Deletion proof does not assert server authority',()=>{
 const r=qualifyFinalHardDelete({manifest:manifest(),readback:finalProof(),actorUid:'owner_uid',deletionId:'delete_001'});
 assert.match(r.warning,/NOT_A_SERVER_ENFORCEABLE_PROOF/);
});
test('Missing server readback blocks finality',()=>{let r=finalProof();r.fromServer=false;deny(()=>qualifyFinalHardDelete({manifest:manifest(),readback:r,actorUid:'owner_uid',deletionId:'delete_001'}),'FINAL_DELETE_PROOF_INCOMPLETE')});
test('Unscanned external references blocks finality',()=>{let r=finalProof();r.externalReferencesChecked=false;deny(()=>qualifyFinalHardDelete({manifest:manifest(),readback:r,actorUid:'owner_uid',deletionId:'delete_001'}),'FINAL_DELETE_PROOF_INCOMPLETE')});
test('Note still present blocks root removal',()=>{let r=finalProof();r.notesRemaining=1;deny(()=>qualifyFinalHardDelete({manifest:manifest(),readback:r,actorUid:'owner_uid',deletionId:'delete_001'}),'ORPHAN_RECORDS_REMAIN')});
test('Member still present blocks root removal',()=>{let r=finalProof();r.membersRemaining=1;deny(()=>qualifyFinalHardDelete({manifest:manifest(),readback:r,actorUid:'owner_uid',deletionId:'delete_001'}),'ORPHAN_RECORDS_REMAIN')});
test('Invitation inbox still present blocks root removal',()=>{let r=finalProof();r.inboxInvitesRemaining=1;deny(()=>qualifyFinalHardDelete({manifest:manifest(),readback:r,actorUid:'owner_uid',deletionId:'delete_001'}),'ORPHAN_RECORDS_REMAIN')});
test('Other users group pointers still present blocks root removal',()=>{let r=finalProof();r.indexPointersRemaining=1;deny(()=>qualifyFinalHardDelete({manifest:manifest(),readback:r,actorUid:'owner_uid',deletionId:'delete_001'}),'ORPHAN_RECORDS_REMAIN')});
test('Owner mismatch blocks root removal',()=>deny(()=>qualifyFinalHardDelete({manifest:manifest(),readback:finalProof(),actorUid:'editor_uid',deletionId:'delete_001'}),'DELETE_RESUME_IDENTITY_MISMATCH'));
test('Deletion epoch mismatch blocks root removal',()=>deny(()=>qualifyFinalHardDelete({manifest:manifest(),readback:finalProof(),actorUid:'owner_uid',deletionId:'delete_999'}),'DELETE_RESUME_IDENTITY_MISMATCH'));
test('Batches max ten ops for rules access-call budget',()=>assert.ok(limitDeleteBatch(manifest().operations).every(b=>b.length<=10)));
test('Batch upper bound rejects 500-write bulk claim',()=>deny(()=>limitDeleteBatch(manifest().operations,500),'UNSAFE_DELETE_BATCH_SIZE'));
test('Operations do not perform network or SDK calls',()=>{
 const source=String(planNotebookHardDelete)+String(qualifyFinalHardDelete)+String(limitDeleteBatch);
 assert.doesNotMatch(source,/fetch\(|getFirestore\(|writeBatch\(|deleteDoc\(|\.commit\(/);
});
console.log('NOTEBOOK_HARD_DELETE_DRY_RUN_PASS',n);
