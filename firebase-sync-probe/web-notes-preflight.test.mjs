// HONBIN isolated browser preflight: zero real Firebase traffic.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('firebase-notes-test.html','utf8');
const client=readFileSync('firebase-note-service.mjs','utf8');
const config=readFileSync('firebase-web-config.mjs','utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
let checks=0;function check(name,fn){fn();checks++;console.log('PASS',name)}
function parse(content){const p=spawnSync(process.execPath,['--check','--input-type=module'],{
 input:content,encoding:'utf8'});assert.equal(p.status,0,p.stderr)}
check('Browser page is standalone, iPhone friendly and non-indexable',()=>{
 assert.match(html,/lang="zh-Hant"/);assert.match(html,/viewport-fit=cover/);
 assert.match(html,/noindex,nofollow/);
});
check('Valid browser module',()=>{assert.ok(script);parse(script)});
check('Valid isolated note SDK transaction module',()=>parse(client));
check('No live Firestore flag enabled',()=>assert.match(config,/firestoreReadyForRealData\s*=\s*false/));
check('Firebase initialization behind explicit true gate',()=>assert.match(script,
 /if\(firestoreReadyForRealData!==true\)[\s\S]*?return;[\s\S]*?getFirestore\(app\)/));
check('Original R73 notes never read or uploaded',()=>assert.doesNotMatch(script,
 /hongbin_crm_quick_notes_r73|localStorage|indexedDB|FileReader|importLegacy/));
check('Original CRM scripts never imported',()=>assert.doesNotMatch(html,
 /simple-core\.js|r73-fixes\.js|r72-fixes\.js/));
check('Google provider and session identity checked',()=>{
 assert.match(script,/browserSessionPersistence/);
 assert.match(script,/emailVerified!==true/);
 assert.match(script,/sign_in_provider!=='google\.com'/);
});
check('Popup runs in direct user click handler',()=>{
 assert.match(script,/\$\('login'\)\.addEventListener\('click',\(\)=>\{/);
 assert.match(script,/signInWithPopup\(auth/);
 assert.doesNotMatch(script,/signInWithRedirect/);
});
check('UID account isolation and old request discard',()=>{
 assert.match(script,/currentUid:\(\)=>auth\.currentUser\?\.uid/);
 assert.match(script,/generation/);assert.match(script,/epoch!==generation/);
 assert.match(script,/clearSensitive\(\)/);
});
check('PRIVATE and SHARED modes are visibly distinct',()=>{
 assert.match(html,/id="privateMode"/);assert.match(html,/id="sharedMode"/);
 assert.match(script,/mode==='SHARED'/);
});
check('Shared empty group does not write to unknown group',()=>{
 assert.match(script,/if\(mode==='SHARED'&&!selectedGroup\)/);
});
check('Viewer cannot save or soft delete by UI',()=>{
 assert.match(script,/selectedGroup\.role!=='VIEWER'/);
 assert.match(script,/\$\('delete'\)\.disabled=busy\|\|!mayWrite/);
});
check('Cloud note calls include optimistic expectedVersion and fixed new ID',()=>{
 assert.match(script,/expectedVersion:active\.version/);
 assert.match(script,/pendingCreateId\|\|\(pendingCreateId=notes\.newId\(target\)\)/);
 assert.match(client,/runTransaction\(db,async tx=>/);
});
check('UI never interprets note text as HTML',()=>{
 assert.doesNotMatch(script,/innerHTML|document\.write|insertAdjacentHTML|eval\(/);
 assert.match(script,/textContent/);
});
check('Version conflict keeps draft and shows latest version number',()=>{
 assert.match(script,/NOTE_VERSION_CONFLICT/);
 assert.match(script,/e\.remote\?\.version/);
 assert.match(script,/remember\(\)/);
});
check('Membership revocation refresh hides formerly visible note editor',()=>{
 assert.match(script,/if\(selectedGroup&&!result\.some\(group=>group\.id===selectedGroup\.id\)\)/);
 assert.match(script,/\$\('title'\)\.value='';\$\('content'\)\.value=''/);
 assert.match(script,/\$\('list'\)\.replaceChildren\(\)/);
});
check('Deletion stays soft-delete, explicit confirmation',()=>{
 assert.match(script,/notes\.softDelete\(/);
 assert.match(script,/window\.confirm\('確定刪除/);
 assert.doesNotMatch(script,/deleteDoc\(/);
});
check('Offline success not claimed and no persistent draft yet',()=>{
 assert.match(html,/關閉 Safari 頁面可能遺失/);
 assert.match(script,/網路或伺服器不可用/);
 assert.match(script,/沒有自動覆蓋編輯草稿/);
});
check('No forbidden billing or third-party endpoints',()=>{
 assert.doesNotMatch(script,/CloudFunctions|firebase\.deploy|firebaseapphosting|stripe|fetch\(/i);
});
console.log('HONBIN_FIREBASE_NOTES_WEB_STATIC_PASS',checks);
