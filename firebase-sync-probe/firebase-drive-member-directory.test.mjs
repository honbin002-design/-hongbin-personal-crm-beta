import assert from 'node:assert/strict';
import {acceptedMemberEmails} from './firebase-drive-member-directory.mjs';
let n=0;const test=(label,fn)=>{fn();n++;console.log('PASS verified member email '+n+': '+label)};
const gid='bookA';
const members=()=>[{uid:'userA',role:'VIEWER',status:'ACTIVE',invitationId:'inviteA'},
 {uid:'userB',role:'EDITOR',status:'ACTIVE',invitationId:'inviteB'}];
const invites=()=>[{id:'inviteA',groupId:gid,recipientEmail:'A@EXAMPLE.COM',role:'VIEWER',status:'ACCEPTED',acceptedUid:'userA'},
 {id:'inviteB',groupId:gid,recipientEmail:'b@example.com',role:'EDITOR',status:'ACCEPTED',acceptedUid:'userB'}];
const derive=(m=members(),i=invites(),groupId=gid)=>acceptedMemberEmails({groupId,members:m,invites:i});
test('two verified member emails mapped to distinct UID',()=>assert.deepEqual(derive().map(x=>x.email),['a@example.com','b@example.com']));
test('role is current membership role, not old invitation role',()=>{const m=members();m[0].role='EDITOR';assert.equal(derive(m)[0].role,'EDITOR')});
test('revoked member not returned',()=>{const m=members();m[0].status='REVOKED';assert.deepEqual(derive(m).map(x=>x.uid),['userB'])});
test('cross-notebook invitation cannot map a member',()=>{const i=invites();i[0].groupId='bookB';assert.throws(()=>derive(members(),i),/MEMBER_EMAIL_UNVERIFIED/)});
test('pending invite not treated as accepted',()=>{const i=invites();i[0].status='PENDING';assert.throws(()=>derive(members(),i),/MEMBER_EMAIL_UNVERIFIED/)});
test('revoked invite not treated as accepted',()=>{const i=invites();i[0].status='REVOKED';assert.throws(()=>derive(members(),i),/MEMBER_EMAIL_UNVERIFIED/)});
test('accepted UID must match member UID',()=>{const i=invites();i[0].acceptedUid='imposter';assert.throws(()=>derive(members(),i),/MEMBER_EMAIL_UNVERIFIED/)});
test('member invitation ID must match',()=>{const m=members();m[0].invitationId='other';assert.throws(()=>derive(m),/MEMBER_EMAIL_UNVERIFIED/)});
test('duplicate accepted invitation ID rejected',()=>assert.throws(()=>derive(members(),[...invites(),invites()[0]]),/DUPLICATE_ACCEPTED_INVITATION/));
test('duplicate active UID rejected',()=>assert.throws(()=>derive([...members(),members()[0]]),/INVALID_MEMBER_DIRECTORY/));
test('two UID sharing one email rejected',()=>{const i=invites();i[1].recipientEmail='A@example.com';assert.throws(()=>derive(members(),i),/DUPLICATE_VERIFIED_EMAIL/)});
test('unverified malformed email rejected',()=>{const i=invites();i[0].recipientEmail='invalid';assert.throws(()=>derive(members(),i),/MEMBER_EMAIL_UNVERIFIED/)});
test('empty member list is allowed',()=>assert.deepEqual(derive([]),[]));
test('missing invitations rejected',()=>assert.throws(()=>acceptedMemberEmails({groupId:gid,members:members()}),/MEMBER_DIRECTORY_INCOMPLETE/));
test('missing group ID rejected',()=>assert.throws(()=>derive(members(),invites(),''),/MEMBER_DIRECTORY_INCOMPLETE/));
test('unknown active role rejected',()=>{const m=members();m[0].role='ROOT';assert.throws(()=>derive(m),/INVALID_ACTIVE_MEMBER/)});
test('stale member status rejected',()=>{const m=members();m[0].status='UNKNOWN';assert.throws(()=>derive(m),/INVALID_ACTIVE_MEMBER/)});
console.log('DRIVE_VERIFIED_MEMBER_DIRECTORY_PASS',n);
