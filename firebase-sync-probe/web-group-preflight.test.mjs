// Static UI and service preflight; no browser, OAuth, or live Firestore.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('firebase-groups-test.html','utf8');
const service=readFileSync('firebase-group-service.mjs','utf8');
const config=readFileSync('firebase-web-config.mjs','utf8');
let count=0;function test(name,fn){fn();count++;console.log('PASS',name)}
test('Valid ES module service syntax',()=>{
 const c=spawnSync(process.execPath,['--check','--input-type=module'],{input:service,encoding:'utf8'});
 assert.equal(c.status,0,c.stderr);
});
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
test('Inline UI module exists and has valid JavaScript syntax',()=>{
 assert.ok(source);const c=spawnSync(process.execPath,['--check','--input-type=module'],
 {input:source,encoding:'utf8'});assert.equal(c.status,0,c.stderr);
});
test('Firestore activation flag remains false',()=>assert.match(config,/firestoreReadyForRealData\s*=\s*false/));
test('All backend connection initialization is behind positive gate',()=>{
 assert.match(source,/if\(firestoreReadyForRealData!==true\)[\s\S]*?return;[\s\S]*?getFirestore\(app\)/);
});
test('Isolated UI module never imported by CRM main',()=>{
 assert.doesNotMatch(html,/simple-core\.js|r73-fixes\.js/);
});
test('Never import or migrate R73 local notes',()=>{
 assert.doesNotMatch(source,/localStorage|hongbin_crm_quick_notes_r73|CRM_IMPORT|importLegacy/);
});
test('No non-Firebase paid API or hidden deployment operations',()=>{
 assert.doesNotMatch(source,/firebase\.deploy|CloudFunctions|cloudfunctions|stripe|fetch\(/i);
});
test('Group creation, owner-managed invitations and received inbox exist',()=>{
 assert.match(source,/createGroup\(/);assert.match(source,/sendInvite\(/);assert.match(source,/acceptInvite\(/);
 assert.match(source,/listInbox\(/);
});
test('Revocation and role-change controls exist',()=>{
 assert.match(source,/revokeInvite\(/);assert.match(source,/changeMember\(/);
 assert.match(html,/撤銷成員/);
});
test('Stale account results are invalidated',()=>{
 assert.match(source,/generation/);assert.match(source,/epoch!==generation/);assert.match(source,/wipe\(\)/);
});
test('No unsafe note HTML parsing',()=>assert.doesNotMatch(source,/innerHTML|insertAdjacentHTML|document\.write/));
test('iPhone labels and no automatic email claim',()=>{
 assert.match(html,/viewport-fit=cover/);
 assert.match(html,/目前不會自動寄送 Email/);
});
test('Safari Popup initiated inside direct click handler',()=>{
 assert.match(source,/\$\('login'\)\.addEventListener\('click',\(\)=>\{/);
 assert.match(source,/signInWithPopup\(auth/);
});
test('Permission error fails closed in UI',()=>{
 assert.match(source,/permission-denied/);
 assert.match(source,/for\(const id of \['groupList','inboxList','memberList','sentList'\]\)\$\(id\)\.replaceChildren\(\)/);
});
console.log('HONBIN_FIREBASE_GROUP_UI_STATIC_PASS',count);
