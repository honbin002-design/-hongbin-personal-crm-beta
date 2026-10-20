import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync('firebase-notebook-hard-delete-v4c-test.html','utf8');
const service=readFileSync('notebook-hard-delete-v4c-service.mjs','utf8');
const config=readFileSync('firebase-web-config.mjs','utf8');
const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
let n=0;const check=(label,fn)=>{fn();n++;console.log('PASS V4C UI '+n+': '+label)};
check('iPhone-only Traditional Chinese engineering page',()=>{
 assert.match(html,/lang="zh-Hant"/);assert.match(html,/viewport-fit=cover/);
 assert.match(html,/noindex,nofollow/);
});
check('No cloud access when real data gate remains false',()=>{
 assert.match(config,/firestoreReadyForRealData\s*=\s*false/);
 assert.match(js,/if\(firestoreReadyForRealData!==true\)[\s\S]*?return\}/);
 assert.ok(js.indexOf("if(firestoreReadyForRealData!==true)")<js.indexOf("initializeApp(firebaseConfig)"));
});
check('Owner must verify Google identity and UID session',()=>{
 assert.match(js,/getIdTokenResult\(user\)/);
 assert.match(js,/user\.emailVerified!==true/);
 assert.match(js,/sign_in_provider!=='google\.com'/);
 assert.match(js,/currentUid:\(\)=>auth\.currentUser\?\.uid/);
});
check('Only owner index is enumerated and full group ownerUid checked',()=>{
 assert.match(js,/collection\(db,'users',uid,'groupIndex'\)/);
 assert.match(js,/snap\.data\(\)\.ownerUid!==uid/);
});
check('Server inventory preview before irreversible lock',()=>{
 assert.match(js,/service\.preview\(book\.id\)/);
 assert.match(js,/noteCount/);assert.match(js,/invitationCount/);
});
check('Typed notebook name plus phrase required',()=>{
 assert.match(html,/id="typedName"/);assert.match(html,/id="typedPhrase"/);
 assert.match(js,/name!==book\.name\|\|\$\('typedPhrase'\)\.value!=='永久刪除'/);
});
check('Two irreversible confirmations',()=>{
 assert.match(js,/window\.confirm\('確定要永久清除/);
 assert.match(js,/window\.confirm\('最後確認/);
});
check('Resume uses Firestore-verified stored deletion epoch',()=>{
 assert.match(js,/book\.deletionId/);
 assert.match(js,/service\.runCleanup\(book\.id,book\.deletionId\)/);
});
check('Root tombstone is explicitly not claimed physically deleted',()=>{
 assert.match(html,/主文件.*仍留/);
 assert.match(js,/主文件尚未實體刪除/);
 assert.match(service,/rootPhysicalDeletion:false/);
});
check('Synthetic TEST never loads original CRM scripts or localStorage',()=>{
 assert.doesNotMatch(html,/simple-core\.js|r73-fixes\.js|localStorage|serviceAccount|billingAccounts/);
});
check('Untrusted names use textContent rather than HTML insertion',()=>{
 assert.doesNotMatch(js,/innerHTML|document\.write|insertAdjacentHTML/);
 assert.match(js,/\.textContent/);
});
check('Browser module and service have valid JS syntax',()=>{
 for(const code of [js,service]){
  const x=spawnSync(process.execPath,['--check','--input-type=module'],{input:code,encoding:'utf8'});
  assert.equal(x.status,0,x.stderr);
 }
});
check('Shows per-stage progress without silently hiding incomplete cleanup',()=>{
 assert.match(js,/const cleanupProgress=/);
 assert.match(js,/INVITES:'清除邀請與收件匣'/);
 assert.match(js,/onProgress:cleanupProgress/);
 assert.match(js,/請保持頁面開啟；中斷可稍後接續/);
 assert.match(service,/report\('VERIFY',1,1\)/);
});
console.log('NOTEBOOK_HARD_DELETE_V4C_UI_HOLD_PASS',n);
