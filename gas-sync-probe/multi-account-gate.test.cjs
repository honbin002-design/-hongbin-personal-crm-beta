'use strict';
const assert=require('node:assert/strict');
const {assessMultiAccountRelease}=require('./multi-account-gate.cjs');
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS: '+name)};
const app=(access,executeAs)=>({entryPoints:[{entryPointType:'WEB_APP',
 webApp:{entryPointConfig:{access,executeAs}}}]});
const A=app('ANYONE','USER_ACCESSING'),B=app('MYSELF','USER_DEPLOYING');
const complete={
 googleOAuthDeploymentCompleted:true,actorAandBVerifiedOnGoogle:true,
 serverToServerGoogleAuthProven:true,twoAccountAccessIsolationVerified:true,
 revocationTestedLive:true,multiPhoneConfirmed:true,ownerSheetNotShared:true,
 productionBackupAndRollbackPassed:true
};
const codes=r=>r.blockers.map(x=>x.code);
check('Current project is HOLD with no deployed Apps Script',()=>{
 const r=assessMultiAccountRelease();
 assert.equal(r.status,'HOLD');assert.equal(r.deployProduction,false);
 assert.ok(codes(r).includes('GOOGLE_OAUTH_DEPLOYMENT_MISSING'));
});
check('A MYSELF owner-only manifest cannot support multiple Google accounts',()=>{
 const r=assessMultiAccountRelease({userDeployment:app('MYSELF','USER_ACCESSING'),dataDeployment:B,evidence:complete});
 assert.ok(codes(r).includes('USER_NOT_AVAILABLE_TO_TEAM'));
});
check('User A must execute as actual logged-in user',()=>{
 const r=assessMultiAccountRelease({userDeployment:app('ANYONE','USER_DEPLOYING'),dataDeployment:B,evidence:complete});
 assert.ok(codes(r).includes('USER_IDENTITY_NOT_AUTHENTICATED'));
});
check('Private B without server-to-server proof is blocked',()=>{
 const r=assessMultiAccountRelease({userDeployment:A,dataDeployment:B,evidence:{...complete,serverToServerGoogleAuthProven:false}});
 assert.ok(codes(r).includes('PRIVATE_BACKEND_TRANSPORT_UNPROVEN'));
});
check('Public anonymous B cannot silently pass release gate',()=>{
 const r=assessMultiAccountRelease({userDeployment:A,dataDeployment:app('ANYONE_ANONYMOUS','USER_DEPLOYING'),evidence:complete});
 assert.ok(codes(r).includes('ANONYMOUS_BACKEND_NOT_APPROVED'));
});
check('Backend with ordinary ANYONE access is not assumed safely callable',()=>{
 const r=assessMultiAccountRelease({userDeployment:A,dataDeployment:app('ANYONE','USER_DEPLOYING'),evidence:complete});
 assert.ok(codes(r).includes('DATA_BACKEND_ACCESS_UNAPPROVED'));
});
check('A green Node CI or Sheets read/write is not live Google OAuth',()=>{
 const r=assessMultiAccountRelease({userDeployment:A,dataDeployment:B,
 evidence:{...complete,googleOAuthDeploymentCompleted:false}});
 assert.ok(codes(r).includes('GOOGLE_OAUTH_DEPLOYMENT_MISSING'));
});
check('Actual Google two-user note ACL must be separately verified',()=>{
 const r=assessMultiAccountRelease({userDeployment:A,dataDeployment:B,
 evidence:{...complete,twoAccountAccessIsolationVerified:false}});
 assert.ok(codes(r).includes('ACTUAL_NOTE_ACL_UNTESTED'));
});
check('Google backend sheet owner-only ACL required',()=>{
 const r=assessMultiAccountRelease({userDeployment:A,dataDeployment:B,
 evidence:{...complete,ownerSheetNotShared:false}});
 assert.ok(codes(r).includes('SHEET_ACL_NOT_CONFIRMED'));
});
check('Member revocation in real Google deployment mandatory',()=>{
 const r=assessMultiAccountRelease({userDeployment:A,dataDeployment:B,
 evidence:{...complete,revocationTestedLive:false}});
 assert.ok(codes(r).includes('ACTUAL_REVOCATION_UNTESTED'));
});
check('Actual two-iPhone version handling must pass',()=>{
 const r=assessMultiAccountRelease({userDeployment:A,dataDeployment:B,
 evidence:{...complete,multiPhoneConfirmed:false}});
 assert.ok(codes(r).includes('IPHONE_SYNC_UNVERIFIED'));
});
check('Real production backup and rollback required',()=>{
 const r=assessMultiAccountRelease({userDeployment:A,dataDeployment:B,
 evidence:{...complete,productionBackupAndRollbackPassed:false}});
 assert.ok(codes(r).includes('PRODUCTION_BACKUP_NOT_RECHECKED'));
});
check('Even all technical flags true cannot auto-deploy CRM to production',()=>{
 const r=assessMultiAccountRelease({userDeployment:A,dataDeployment:B,evidence:complete});
 assert.equal(r.status,'READY_FOR_USER_ACCEPTANCE');
 assert.equal(r.deployProduction,false);
});
console.log('MULTI ACCOUNT RELEASE SAFETY GATE PASS',passed);
