'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {build}=require('./build-bundles.cjs');
let count=0;
const check=(msg,fn)=>{fn();count++;console.log('PASS: '+msg)};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hb-gas-package-'));
try{
 const result=build(tmp);
 const sourceA=fs.readFileSync(path.join(tmp,'user','Code.gs'),'utf8');
 const sourceB=fs.readFileSync(path.join(tmp,'data','Code.gs'),'utf8');
 const manifestA=JSON.parse(fs.readFileSync(path.join(tmp,'user','appsscript.json')));
 const manifestB=JSON.parse(fs.readFileSync(path.join(tmp,'data','appsscript.json')));
 const html=fs.readFileSync(path.join(tmp,'user','Index.html'),'utf8');
 check('User GAS bundle compiles with real JavaScript parser',()=>assert.doesNotThrow(()=>new Function(sourceA)));
 check('Data-owner GAS bundle compiles with real JavaScript parser',()=>assert.doesNotThrow(()=>new Function(sourceB)));
 check('A user deployment defaults to owner-only test scope',()=>{
  assert.equal(manifestA.webapp.access,'MYSELF');
  assert.equal(manifestA.webapp.executeAs,'USER_ACCESSING');
 });
 check('B data-owner deployment defaults to owner-only test scope',()=>{
  assert.equal(manifestB.webapp.access,'MYSELF');
  assert.equal(manifestB.webapp.executeAs,'USER_DEPLOYING');
 });
 check('A uses verified Google session and does not trust client userID',()=>{
  assert.match(sourceA,/Session\.getActiveUser\(\)\.getEmail\(\)/);
  assert.match(sourceA,/GOOGLE_IDENTITY_UNAVAILABLE/);
  assert.doesNotMatch(sourceA,/params\.ownerId\s*\|\|/);
 });
 check('Backend owns no unguarded HTML client endpoint',()=>{
  assert.match(sourceB,/function doPost\(e\)/);
  assert.match(sourceB,/createServerSideVerifier/);
  assert.match(sourceB,/createAuthorizedDispatcher/);
  assert.match(sourceB,/consumeOnce/);
 });
 check('Both templates are free of real user tokens',()=>{
  for(const text of [sourceA,sourceB,html]){
   assert.doesNotMatch(text,/ya29\.[a-z0-9_-]+/i);
   assert.doesNotMatch(text,/sk-proj-[a-z0-9_-]+/i);
   assert.doesNotMatch(text,/honbin002@gmail\.com/i);
  }
 });
 check('iPhone UI uses escaped DOM text not innerHTML',()=>{
  assert.match(html,/replaceChildren\(\)/);
  assert.match(html,/textContent/);
  assert.doesNotMatch(html,/innerHTML\s*=/);
 });
 check('Legacy localStorage key is not referenced by cloud bundles',()=>{
  assert.doesNotMatch(sourceA,/hongbin_crm_quick_notes_r73/);
  assert.doesNotMatch(sourceB,/hongbin_crm_quick_notes_r73/);
 });
 check('Build does not include any automatic deploy or secret upload',()=>{
  assert.doesNotMatch(sourceA,/clasp deploy|gh secret set/);
  assert.doesNotMatch(sourceB,/clasp deploy|gh secret set/);
 });
 check('Output bundle imports correct namespaces',()=>{
  assert.match(sourceA,/var GASBoundary_=/);
  for(const name of ['GASBoundary_','GASEventService_','GASSheetsAdapter_','GASNonceRegistry_'])
   assert.ok(sourceB.includes('var '+name+'='));
 });
 check('No bundle enables anonymous web-app access by default',()=>{
  assert.notEqual(manifestA.webapp.access,'ANYONE_ANONYMOUS');
  assert.notEqual(manifestB.webapp.access,'ANYONE_ANONYMOUS');
 });
 console.log('GAS SAFE PACKAGE CHECK PASS',count);
}finally{
 fs.rmSync(tmp,{recursive:true,force:true});
}
