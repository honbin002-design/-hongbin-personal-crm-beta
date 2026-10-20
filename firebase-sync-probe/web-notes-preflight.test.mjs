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
 /hongbin_crm_quick_notes_r73|localStorage|FileReader|importLegacy/));
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
check('VIEWER cannot edit or restore a former EDITOR offline draft',()=>{
 assert.match(script,/\$\('title'\)\.readOnly=!mayWrite/);
 assert.match(script,/\$\('content'\)\.readOnly=!mayWrite/);
 assert.match(script,/const v=canEdit\?drafts\.get\(key\(\)\):null/);
 assert.match(script,/if\(selectedGroup\.role==='VIEWER'\)/);
});
check('Shared empty group does not write to unknown group',()=>{
 assert.match(script,/if\(mode==='SHARED'&&!selectedGroup\)/);
});
check('Viewer cannot save or soft delete by UI',()=>{
 assert.match(script,/notebookCapabilities\(selectedGroup\?\.role\)\.canWrite/);
 assert.match(script,/\$\('delete'\)\.disabled=busy\|\|!mayDelete/);
 assert.match(script,/const mayDelete=mode==='PRIVATE'\|\|notebookCapabilities\(selectedGroup\?\.role\)\.canDeleteSharedNote/);
});
check('Notebook selector is per authorized group and enforces role policy',()=>{
 const policy=readFileSync('firebase-notebook-scope.mjs','utf8');parse(policy);
 assert.match(html,/每本成員獨立/);
 assert.match(script,/resolveNotebookSelection\(await groups\.listGroups\(\),selectedGroup\?\.id\)/);
 assert.match(script,/notebookCapabilities\(selectedGroup\?\.role\)\.canWrite/);
 assert.match(script,/notebookCapabilities\(selectedGroup\?\.role\)\.canDeleteSharedNote/);
 assert.match(policy,/canUploadAttachment:false/);
});
check('Cloud note calls include optimistic expectedVersion and fixed new ID',()=>{
 assert.match(script,/expectedVersion:active\.version/);
 assert.match(script,/if\(!active&&!pendingCreateId\)pendingCreateId=session\.service\.newId\(target\)/);
 assert.match(client,/runTransaction\(db,async tx=>/);
});
check('UI never interprets note text as HTML',()=>{
 assert.doesNotMatch(script,/innerHTML|document\.write|insertAdjacentHTML|eval\(/);
 assert.match(script,/textContent/);
});
check('Version conflict keeps draft and shows latest version number',()=>{
 assert.match(script,/NOTE_VERSION_CONFLICT/);
 assert.match(script,/review\.remote\.version/);
 assert.match(script,/remember\(\)/);
});
check('Conflict UI compares cloud and phone text without interpreting HTML',()=>{
 const review=readFileSync('firebase-conflict-review.mjs','utf8');
 parse(review);
 assert.match(html,/id="conflictPanel"/);
 assert.match(html,/id="cloudTitle"/);
 assert.match(html,/id="cloudContent"/);
 assert.match(html,/id="takeCloud"/);
 assert.match(html,/id="saveCopy"/);
 assert.match(script,/\$\('cloudContent'\)\.textContent=/);
 assert.match(script,/\$\('cloudTitle'\)\.textContent=/);
 assert.match(script,/showConflict\(e\)/);
});
check('Keep-draft choice leaves remote comparison visible for manual merge',()=>{
 assert.match(script,/\$\('keepDraft'\)\.addEventListener\('click'/);
 assert.match(script,/\$\('conflictPanel'\)\.hidden=false/);
 assert.match(script,/雲端比較內容仍可查看/);
});
check('Save-as-copy uses different ID and pre-saves nonce before cloud',()=>{
 assert.match(script,/buildSaveNewCopy\(latest,newId\)/);
 assert.match(script,/const newId=session\.service\.newId\(target\)/);
 assert.match(script,/await persistBeforeCloud\(\); \/\/ Save fixed copy ID/);
 assert.match(script,/await session\.service\.create\(\{\.\.\.target,\.\.\.plan\}\)/);
});
check('Remote restoration requires explicit confirmation and no write',()=>{
 assert.match(script,/buildRemoteRestore\(review\)/);
 assert.match(script,/window\.confirm\('確定放棄這支手機尚未上傳的草稿/);
 assert.match(script,/await dropDraft\(draftContext\(\)\)/);
});
check('Changing account or scope invalidates conflict review',()=>{
 assert.match(script,/state\.account!==account\|\|state\.mode!==mode/);
 assert.match(script,/state\.groupId!==\(selectedGroup\?\.id\|\|null\)/);
 assert.match(script,/function hideConflict\(\)/);
});
check('Cloud writes pin original UID and Firebase service after awaited local draft',()=>{
 assert.match(script,/function noteSession\(\)/);
 assert.match(script,/session\.service!==notes/);
 assert.match(script,/auth\?\.currentUser\?\.uid!==session\.uid/);
 assert.match(script,/verifyNoteSession\(session\)/);
 assert.match(script,/await session\.service\.create\(/);
 assert.match(script,/await session\.service\.softDelete\(/);
 assert.match(script,/await session\.service\.update\(/);
 assert.match(script,/verifyNoteSession\(session\);\n clearEditor\(\);await loadNotes\(\)/);
});
check('Membership revocation refresh hides formerly visible note editor',()=>{
 assert.match(script,/if\(selectedGroup&&!result\.some\(group=>group\.id===selectedGroup\.id\)\)/);
 assert.match(script,/\$\('title'\)\.value='';\$\('content'\)\.value=''/);
 assert.match(script,/\$\('list'\)\.replaceChildren\(\)/);
});
check('Deletion stays soft-delete, explicit confirmation',()=>{
 assert.match(script,/session\.service\.softDelete\(/);
 assert.match(script,/window\.confirm\('確定刪除/);
 assert.doesNotMatch(script,/deleteDoc\(/);
});
check('Persistent drafts are partitioned, manually saved to cloud and never use R73 storage',()=>{
 const local=readFileSync('firebase-offline-drafts.mjs','utf8');
 parse(local);
 assert.match(script,/makeDraftStore\(\{factory:window\.indexedDB\}\)/);
 assert.match(script,/await persistBeforeCloud\(\)/);
 assert.match(script,/await loadDraft\(\)/);
 assert.match(local,/honbin-crm-notes-local-drafts-v1/);
 assert.doesNotMatch(local,/hongbin_crm_quick_notes_r73|localStorage|fetch\(/);
 assert.match(html,/不會自動重送/);
 assert.match(html,/未經額外加密/);
});
check('Offline success never claimed and drafts stay on the device',()=>{
 assert.match(script,/網路或伺服器不可用/);
 assert.match(script,/沒有自動覆蓋編輯草稿/);
 assert.match(html,/清除網站資料/);
});
check('Revoked group triggers local draft removal',()=>{
 assert.match(script,/void dropDraft\(draftContext\(\)\)/);
});
check('Local create ID persisted BEFORE Firestore transaction',()=>{
 const idx=script.indexOf('await persistBeforeCloud();');
 const sent=script.indexOf('await session.service.create(');
 assert.ok(idx>=0&&sent>idx);
});
check('No forbidden billing or third-party endpoints',()=>{
 assert.doesNotMatch(script,/CloudFunctions|firebase\.deploy|firebaseapphosting|stripe|fetch\(/i);
});
console.log('HONBIN_FIREBASE_NOTES_WEB_STATIC_PASS',checks);
