import assert from 'node:assert/strict';
import {checkOwnerDriveFile,checkNotebookDriveAcl,DRIVE_ATTACHMENT_STAGE} from './firebase-drive-attachment-policy.mjs';
let count=0;
const test=(name,fn)=>{fn();count++;console.log('PASS Drive gate '+count+': '+name)};
const owner='owner@example.com',folderId='ownerFolder_01';
const file=()=>({id:'driveFile_01',name:'測試附件.pdf',mimeType:'application/pdf',trashed:false,
 parents:[folderId],owners:[{emailAddress:owner}],permissions:[{type:'user',role:'owner',emailAddress:owner}]});
const ok=(f=file())=>checkOwnerDriveFile({file:f,ownerEmail:owner,folderId,aclComplete:true});
const denied=(result,code)=>{assert.equal(result.ok,false);assert.equal(result.code,code)};
test('verified owner file passes metadata preflight',()=>assert.equal(ok().ok,true));
test('owner email normalization',()=>assert.equal(checkOwnerDriveFile({file:file(),ownerEmail:' OWNER@example.com ',folderId,aclComplete:true}).ok,true));
test('missing file fails closed',()=>denied(checkOwnerDriveFile({ownerEmail:owner,folderId,aclComplete:true}),'DRIVE_FILE_MISSING'));
test('missing owner fails closed',()=>denied(checkOwnerDriveFile({file:file(),folderId,aclComplete:true}),'OWNER_EMAIL_MISSING'));
test('wrong folder rejected',()=>denied(checkOwnerDriveFile({file:file(),ownerEmail:owner,folderId:'other',aclComplete:true}),'NOT_IN_OWNER_FOLDER'));
test('uploader owned file rejected even if in owner folder',()=>{
 const f=file();f.owners=[{emailAddress:'member@example.com'}];
 denied(ok(f),'NOT_OWNED_BY_CONFIGURED_OWNER');
});
test('shared drive rejected for personal Drive quota',()=>{
 const f=file();f.driveId='sharedDrive';denied(ok(f),'SHARED_DRIVE_NOT_PERSONAL_STORAGE');
});
test('trashed file rejected',()=>{const f=file();f.trashed=true;denied(ok(f),'DRIVE_FILE_INVALID')});
test('missing full ACL audit rejected',()=>denied(checkOwnerDriveFile({file:file(),ownerEmail:owner,folderId}),'DRIVE_ACL_NOT_FULLY_AUDITED'));
test('public anyone link rejected',()=>{
 const f=file();f.permissions.push({type:'anyone',role:'reader'});denied(ok(f),'DRIVE_ACL_TOO_BROAD');
});
test('domain link rejected',()=>{
 const f=file();f.permissions.push({type:'domain',role:'reader'});denied(ok(f),'DRIVE_ACL_TOO_BROAD');
});
test('group link rejected',()=>{
 const f=file();f.permissions.push({type:'group',role:'reader'});denied(ok(f),'DRIVE_ACL_TOO_BROAD');
});
test('folder masquerading as attachment rejected',()=>{
 const f=file();f.mimeType='application/vnd.google-apps.folder';denied(ok(f),'FILETYPE_INVALID');
});
test('unsafe blank name rejected',()=>{
 const f=file();f.name=' ';denied(ok(f),'FILENAME_INVALID');
});
test('missing Drive ID rejected',()=>{
 const f=file();f.id='../file';denied(ok(f),'DRIVE_FILE_INVALID');
});
const members=[{email:'reader@example.com',role:'VIEWER'},{email:'editor@example.com',role:'EDITOR'}];
const acl=()=>[{type:'user',role:'owner',emailAddress:owner},
 {type:'user',role:'reader',emailAddress:'reader@example.com'},
 {type:'user',role:'reader',emailAddress:'editor@example.com'}];
const audit=(permissions=acl(),users=members,complete=true)=>checkNotebookDriveAcl({permissions,ownerEmail:owner,members:users,aclComplete:complete});
test('each notebook member read-only Drive ACL passes',()=>assert.equal(audit().ok,true));
test('missing audit rejected',()=>denied(audit(acl(),members,false),'DRIVE_ACL_NOT_FULLY_AUDITED'));
test('revoked old member Drive permission rejected',()=>{
 const x=acl();x.push({type:'user',role:'reader',emailAddress:'revoked@example.com'});
 denied(audit(x),'DRIVE_PERMISSION_NOT_AUTHORIZED');
});
test('editor Drive writer is rejected even though CRM editor',()=>{
 const x=acl();x[2].role='writer';denied(audit(x),'DRIVE_MEMBER_HAS_WRITE_ACCESS');
});
test('viewer Drive writer rejected',()=>{
 const x=acl();x[1].role='writer';denied(audit(x),'DRIVE_MEMBER_HAS_WRITE_ACCESS');
});
test('missing invited member Drive access rejected',()=>{
 const x=acl();x.pop();denied(audit(x),'DRIVE_MEMBER_PERMISSION_MISSING');
});
test('anyone link rejected at notebook audit',()=>{
 const x=acl();x.push({type:'anyone',role:'reader'});denied(audit(x),'DRIVE_ACL_TOO_BROAD');
});
test('unknown member role rejected',()=>{
 const x=[{email:'reader@example.com',role:'SUPERADMIN'}];denied(audit(acl(),x),'MEMBER_EMAIL_OR_ROLE_MISSING');
});
test('duplicate member emails rejected',()=>{
 const x=[...members,{email:'reader@example.com',role:'VIEWER'}];denied(audit(acl(),x),'DUPLICATE_MEMBER_EMAIL');
});
test('duplicate Drive ACL entries rejected',()=>{
 const x=[...acl(),{type:'user',role:'reader',emailAddress:'reader@example.com'}];denied(audit(x),'DUPLICATE_DRIVE_PERMISSION');
});
test('owner must have owner permission',()=>{
 const x=acl();x[0].role='reader';denied(audit(x),'OWNER_ROLE_MISMATCH');
});
test('different notebook member sets do not silently inherit permissions',()=>{
 const other=[{email:'reader@example.com',role:'VIEWER'}];
 denied(audit(acl(),other),'DRIVE_PERMISSION_NOT_AUTHORIZED');
});
test('no live Drive OAuth or upload flag enabled',()=>assert.equal(DRIVE_ATTACHMENT_STAGE,'HOLD_OWNER_OAUTH_AND_CROSS_ACCOUNT_ACL'));
console.log('DRIVE_OWNER_ATTACHMENT_POLICY_PASS',count);
