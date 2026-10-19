import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,mkdirSync,copyFileSync,
 writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildAuthPackage} from './firebase-hosting-auth-package.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'honbin-spark-auth-'));
let passed=0;function test(name,fn){fn();passed++;console.log('PASS',name)}
try{
 const dest=join(temp,'output');
 let built;
 test('Google Auth package builds without any cloud deployment',()=>{
   built=buildAuthPackage({targetRoot:dest});
   assert.equal(built.projectTarget,'NOT_SET_REQUIRES_EXPLICIT_OWNER_AUTHORIZATION');
 });
 test('Website bundle contains exactly auth index and Firebase public web config',()=>{
   assert.deepEqual(readdirSync(join(dest,'public')).sort(),
     ['firebase-web-config.mjs','index.html']);
 });
 test('No group, note, membership or Firestore modules included',()=>{
   const files=readdirSync(join(dest,'public')).join(' ');
   assert.doesNotMatch(files,/firestore|note-service|group-service|notes-test|r73|indexdb/i);
 });
 test('No Firebase project alias or admin credential in bundle root',()=>{
   assert.deepEqual(readdirSync(dest).sort(),['firebase.json','public']);
 });
 test('Auth page calls only Firebase Google popup, never reads notes',()=>{
   const html=readFileSync(join(dest,'public','index.html'),'utf8');
   assert.match(html,/signInWithPopup\(auth,provider\)/);
   assert.doesNotMatch(html,/firebase-firestore|setDoc\(|getDocs\(|localStorage|indexedDB/);
 });
 test('Auth page keeps consent-gated false switch',()=>{
   const src=readFileSync(join(dest,'public','firebase-web-config.mjs'),'utf8');
   assert.match(src,/firestoreReadyForRealData = false/);
   assert.match(src,/honbin-crm-notes-spark/);
 });
 test('Hosting config uses only explicit public folder',()=>{
   const c=JSON.parse(readFileSync(join(dest,'firebase.json'),'utf8'));
   assert.equal(c.hosting.public,'public');
   assert.ok(!('rewrites' in c.hosting)&&!('functions' in c.hosting));
 });
 test('Static hosting headers discourage caching and iframe clickjacking',()=>{
   const c=JSON.parse(readFileSync(join(dest,'firebase.json'),'utf8'));
   const headers=c.hosting.headers[0].headers;
   assert.ok(headers.some(h=>h.key==='Cache-Control'&&h.value==='no-store'));
   assert.ok(headers.some(h=>h.key==='X-Frame-Options'&&h.value==='DENY'));
 });
 const stub=join(temp,'invalid');mkdirSync(stub);
 copyFileSync(join(root,'firebase-auth-smoke.html'),join(stub,'firebase-auth-smoke.html'));
 copyFileSync(join(root,'firebase-web-config.mjs'),join(stub,'firebase-web-config.mjs'));
 test('Tampered gate flag fails package build before publishing',()=>{
   const path=join(stub,'firebase-web-config.mjs');
   writeFileSync(path,readFileSync(path,'utf8').replace(
     'firestoreReadyForRealData = false','firestoreReadyForRealData = true'));
   assert.throws(()=>buildAuthPackage({sourceRoot:stub,targetRoot:join(temp,'blocked-gate')}),
     /FIREBASE_DENY_ALL_PRECONDITION/);
 });
 test('Even with restored flag, accidental note SDK import blocks packaging',()=>{
   const path=join(stub,'firebase-web-config.mjs');
   writeFileSync(path,readFileSync(path,'utf8').replace(
     'firestoreReadyForRealData = true','firestoreReadyForRealData = false'));
   const page=join(stub,'firebase-auth-smoke.html');
   writeFileSync(page,readFileSync(page,'utf8')+'\nimport {getFirestore} from "./firebase-firestore.js";');
   assert.throws(()=>buildAuthPackage({sourceRoot:stub,targetRoot:join(temp,'blocked-sdk')}),
     /AUTH_PACKAGE_CONTAINS_DATA_ACCESS/);
 });
 console.log('HONBIN_SPARK_AUTH_HOSTING_PACKAGE_PASS',passed);
}finally{rmSync(temp,{recursive:true,force:true});}
