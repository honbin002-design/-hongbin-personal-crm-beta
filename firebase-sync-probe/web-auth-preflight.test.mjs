import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {firebaseConfig,firestoreReadyForRealData} from './firebase-web-config.mjs';

const html=readFileSync(join(dirname(fileURLToPath(import.meta.url)),'firebase-auth-smoke.html'),'utf8');
const cases=[];
const check=(name,fn)=>{fn();cases.push(name);console.log('PASS:',name)};
check('Full registered web Firebase project ID matches owner-provided project',()=>assert.equal(firebaseConfig.projectId,'honbin-crm-notes-spark'));
check('Web app ID matches Firebase console',()=>assert.equal(firebaseConfig.appId,'1:692331475098:web:4c13d24c1f1d54f6922f23'));
check('Firebase authDomain matches approved project and does not switch to GitHub domain',()=>assert.equal(firebaseConfig.authDomain,'honbin-crm-notes-spark.firebaseapp.com'));
check('Messaging sender ID is owner-provided project number',()=>assert.equal(firebaseConfig.messagingSenderId,'692331475098'));
check('Only HTTPS Firebase gstatic modules are loaded',()=>{
 assert.ok(html.includes('https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js'));
 assert.ok(html.includes('https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js'));
 assert.doesNotMatch(html,/<script(?![^>]*type="module")[^>]*src=/);
});
check('No live Firestore data access exists in smoke test',()=>{
 assert.equal(firestoreReadyForRealData,false);
 assert.doesNotMatch(html,/getFirestore|firebase-firestore|\/firestore(\.js)?|collection\(|addDoc\(|setDoc\(|deleteDoc\(|getDocs\(/);
});
check('Google popup is directly invoked from the user tap',()=>{
 assert.match(html,/login\.addEventListener\("click",\(\)=>\{/);
 assert.match(html,/signInWithPopup\(auth,provider\)/);
 assert.doesNotMatch(html,/signInWithRedirect\(/);
});
check('Google user must be logged in using google.com provider with verified email',()=>{
 assert.match(html,/sign_in_provider!=="google\.com"/);
 assert.match(html,/user\.emailVerified!==true/);
});
check('Old-account async callback is ignored after account switch',()=>{
 assert.match(html,/auth\.currentUser\?\.uid!==user\.uid/);
});
check('Failed iPhone Safari session setup never enables login button',()=>{
 assert.match(html,/let actionBusy=false,persistenceReady=false/);
 assert.match(html,/login\.disabled=!persistenceReady/);
 assert.match(html,/persistenceReady=false;say\(/);
});
check('Unauthorized web domain gives clear instructions, not insecure fallback',()=>{
 assert.match(html,/auth\/unauthorized-domain/);
 assert.match(html,/已授權網域/);
});
check('No token or OAuth secret is rendered or stored by smoke test',()=>{
 assert.doesNotMatch(html,/credentialFromResult|accessToken|refreshToken|localStorage|sessionStorage|console\.log|idToken\.substring/);
});
check('No real customer or legacy-note upload',()=>{
 assert.doesNotMatch(html,/hongbin_crm_quick_notes_r73|\/customers\/|\/orders\/|\/products\//);
});
console.log('HONBIN_FIREBASE_WEB_SMOKE_STATIC_PASS',cases.length);
