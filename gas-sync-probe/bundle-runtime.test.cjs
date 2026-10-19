'use strict';
/* Full user Script A -> data Script B -> mock Sheets integration. SYNTHETIC ONLY. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {build}=require('./build-bundles.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'honbin-gas-integration-'));
let passed=0,principal='alice@example.test',failSheets=false,nonceLockBusy=false;
const secret='SYNTHETIC_TEST_ONLY_Sha256_Hmac_Key_0123456789abcdef_1234567890';
function check(name,fn){fn();passed++;console.log('PASS: '+name)}
function fail(code,fn){assert.throws(fn,e=>e.message===code,code)}
function mockSheet(header){
 const rows=[header.slice()];
 return {
  rows,getLastRow:()=>rows.length,
  getRange(row,col,count,width){
   assert.equal(col,1);assert.equal(width,header.length);
   return {
    getValues:()=>rows.slice(row-1,row-1+count).map(x=>x.slice(0,width)),
    setValues:v=>{
     if(failSheets)throw Error('SIMULATED_SHEETS_OUTAGE');
     assert.equal(v.length,1);assert.equal(row,rows.length+1);
     rows.push(v[0].slice());
    }
   };
  },
  deleteRow(row){rows.splice(row-1,1)}
 };
}
function loadScript(source,extras){
 const ctx=vm.createContext({...extras});
 vm.runInContext(source,ctx,{timeout:2500});
 return ctx;
}
function helperCrypto(){
 return {
  Charset:{UTF_8:'UTF_8'},
  computeHmacSha256Signature:(msg,key)=>[...crypto.createHmac('sha256',key).update(msg,'utf8').digest()].map(x=>x>127?x-256:x),
  base64EncodeWebSafe:values=>Buffer.from(values.map(x=>x<0?x+256:x)).toString('base64url'),
  getUuid:()=>crypto.randomUUID()
 };
}
try{
 build(tmp);
 const A=fs.readFileSync(path.join(tmp,'user','Code.gs'),'utf8');
 const B=fs.readFileSync(path.join(tmp,'data','Code.gs'),'utf8');
 const userManifest=JSON.parse(fs.readFileSync(path.join(tmp,'user','appsscript.json')));
 const dataManifest=JSON.parse(fs.readFileSync(path.join(tmp,'data','appsscript.json')));
 let count=0;
 const book={getSheetByName:k=>sheets[k]},sheets={};
 let locked=false;
 const lock={tryLock:()=>{if(locked||nonceLockBusy)return false;locked=true;return true},
  releaseLock:()=>{locked=false}};
 const dataProps={
  HONBIN_NOTES_TEST_GATE:'ISOLATED_TEST_APPROVED',
  HONBIN_NOTES_INTERNAL_SECRET:secret,
  HONBIN_NOTES_SPREADSHEET_ID:'synthetic-sheet-id'
 };
 const userProps={
  HONBIN_NOTES_TEST_GATE:'ISOLATED_TEST_APPROVED',
  HONBIN_NOTES_INTERNAL_SECRET:secret,
  HONBIN_NOTES_BACKEND_URL:'https://script.google.com/macros/s/TEST_SCRIPT_ID_EXAMPLE12345/exec'
 };
 const contentService={
  MimeType:{JSON:'application/json'},
  createTextOutput:str=>{
   const response={text:str,setMimeType(){return this},getContentText(){return this.text}};
   return response;
  }
 };
 const coreB=loadScript(B,{
  ContentService:contentService,PropertiesService:{getScriptProperties:()=>({
   getProperty:name=>dataProps[name]||null
  })},
  SpreadsheetApp:{openById:id=>{assert.equal(id,'synthetic-sheet-id');return book}},
  LockService:{getScriptLock:()=>lock},
  Utilities:helperCrypto(),
 });
 sheets.Events=mockSheet(coreB.GASSheetsAdapter_.HONBIN_EVENTS_HEADER);
 sheets.UsedNonces=mockSheet(coreB.GASNonceRegistry_.HONBIN_NONCES_HEADER);
 const apiA=loadScript(A,{
  Session:{getActiveUser:()=>({getEmail:()=>principal})},
  PropertiesService:{getScriptProperties:()=>({getProperty:name=>userProps[name]||null})},
  HtmlService:{createHtmlOutputFromFile:()=>({setTitle(){return this}})},
  Utilities:helperCrypto(),
  UrlFetchApp:{fetch:(url,request)=>{
   assert.equal(url,userProps.HONBIN_NOTES_BACKEND_URL);
   const serverResponse=coreB.doPost({postData:{contents:request.payload}});
   return {getResponseCode:()=>200,getContentText:()=>serverResponse.getContentText()};
  }},
 });
 const mutableActions=['CREATE_GROUP','SET_MEMBER','CREATE_NOTE','UPDATE_NOTE','DELETE_NOTE'];
 const call=(kind,payload)=>{
   var params=Object.assign({},payload||{});
   if(mutableActions.includes(kind))params.__expectedGoogleAccount=principal;
   return apiA.gasNoteCall(kind,params);
 };
 const who=(name,fn)=>{principal=name;return fn()};
 check('A/B compile and both default owner-only until verified release',()=>{
  assert.equal(userManifest.webapp.access,'MYSELF');
  assert.equal(dataManifest.webapp.access,'MYSELF');
  assert.equal(typeof apiA.gasNoteCall,'function');
  assert.equal(typeof coreB.doPost,'function');
 });
 check('A rejects a stale different-account mutation before backend signing',()=>{
  who('bob@example.test',()=>fail('GOOGLE_ACCOUNT_SWITCHED',()=>apiA.gasNoteCall(
   'CREATE_NOTE',{operationId:'staleAcc000001',scope:'PRIVATE',content:'ALICE_NOTE',
    __expectedGoogleAccount:'alice@example.test'})));
 });
 check('A rejects missing expectedAccount on writes',()=>{
  who('alice@example.test',()=>fail('EXPECTED_ACCOUNT_REQUIRED',()=>apiA.gasNoteCall(
   'CREATE_NOTE',{operationId:'noAccount00123',scope:'PRIVATE',content:'draft'})));
 });
 check('Blank Google identity rejected before data service call',()=>{
  const before=sheets.UsedNonces.rows.length;
  who('',()=>fail('GOOGLE_IDENTITY_UNAVAILABLE',()=>call('LIST_NOTES',{scope:'PRIVATE'})));
  assert.equal(sheets.UsedNonces.rows.length,before);
 });
 check('A refuses all note calls when isolated-test gate is not enabled',()=>{
  const saved=userProps.HONBIN_NOTES_TEST_GATE;
  delete userProps.HONBIN_NOTES_TEST_GATE;
  try{who('alice@example.test',()=>fail('SYNC_TEST_NOT_ENABLED',()=>call('LIST_NOTES',{scope:'PRIVATE'})))}
  finally{userProps.HONBIN_NOTES_TEST_GATE=saved}
 });
 check('B refuses requests without explicit isolated-test approval',()=>{
  const saved=dataProps.HONBIN_NOTES_TEST_GATE;
  delete dataProps.HONBIN_NOTES_TEST_GATE;
  try{
   const response=coreB.doPost({postData:{contents:JSON.stringify({action:'LIST_NOTES'})}});
   assert.equal(JSON.parse(response.getContentText()).error,'SYNC_TEST_NOT_ENABLED');
  }finally{dataProps.HONBIN_NOTES_TEST_GATE=saved}
 });
 let privateNote;
 check('Signed A creates private note in B with true actor, ignores forged owner',()=>{
  privateNote=who('alice@example.test',()=>call('CREATE_NOTE',{
   operationId:'privateCreate01',scope:'PRIVATE',title:'本人',content:'不得外流',
   ownerId:'mallory@example.test'
  }));
  assert.equal(privateNote.ownerId,'alice@example.test');
  assert.equal(sheets.Events.rows.length,2);
 });
 check('Bob account cannot search or directly read Alice note',()=>{
  who('bob@example.test',()=>{
   const records=call('LIST_NOTES',{scope:'PRIVATE'});assert.equal(records.length,0);
   fail('FORBIDDEN_PRIVATE',()=>call('GET_NOTE',{articleId:privateNote.articleId}));
  });
 });
 check('Tampering signed actor is rejected by Script B',()=>{
  const forged={actor:'bob@example.test',action:'LIST_NOTES',issuedAt:Date.now(),
   nonce:'nonce-fake-1234567890',params:{scope:'PRIVATE'},signature:'invalid-signature'};
  const response=coreB.doPost({postData:{contents:JSON.stringify(forged)}});
  assert.equal(JSON.parse(response.getContentText()).error,'INVALID_SIGNATURE');
 });
 let groupId,shared;
 check('Group owner can create and grant viewer membership through signed request',()=>{
  groupId=who('alice@example.test',()=>call('CREATE_GROUP',{operationId:'groupCreate0001',name:'測試群組'})).groupId;
  who('alice@example.test',()=>call('SET_MEMBER',{operationId:'addBobViewer001',groupId,
   memberId:'bob@example.test',role:'VIEWER'}));
  shared=who('alice@example.test',()=>call('CREATE_NOTE',{
   operationId:'sharedCreate01',scope:'SHARED',groupId,title:'共用',content:'第一版'
  }));
  assert.equal(shared.scope,'SHARED');
 });
 check('VIEWER can read but cannot edit a signed group note',()=>{
  who('bob@example.test',()=>{
   assert.equal(call('GET_NOTE',{articleId:shared.articleId}).content,'第一版');
   fail('FORBIDDEN_WRITE',()=>call('UPDATE_NOTE',{
    operationId:'badViewerEdit1',articleId:shared.articleId,
    expectedVersion:1,title:'新版',content:'非法修改'
   }));
  });
 });
 check('Old version cannot silently overwrite even through signed A/B',()=>{
  const newer=who('alice@example.test',()=>call('UPDATE_NOTE',{
   operationId:'aliceUpdate0001',articleId:shared.articleId,
   expectedVersion:1,title:'更新',content:'第二版'
  }));
  assert.equal(newer.version,2);
  who('alice@example.test',()=>fail('VERSION_CONFLICT',()=>call('UPDATE_NOTE',{
   operationId:'aliceStale00001',articleId:shared.articleId,
   expectedVersion:1,title:'舊版',content:'覆蓋'
  })));
 });
 check('Repeat same operation ID does not create second event',()=>{
  const before=sheets.Events.rows.length;
  const result=who('alice@example.test',()=>call('UPDATE_NOTE',{
   operationId:'aliceUpdate0001',articleId:shared.articleId,
   expectedVersion:1,title:'更新',content:'第二版'
  }));
  assert.equal(result.version,2);assert.equal(sheets.Events.rows.length,before);
 });
 check('Revoked viewer cannot read the group note again',()=>{
  who('alice@example.test',()=>call('SET_MEMBER',{
   operationId:'revokeBob00001',groupId,memberId:'bob@example.test',status:'REVOKED'
  }));
  who('bob@example.test',()=>fail('FORBIDDEN_SHARED',()=>call('GET_NOTE',{articleId:shared.articleId})));
 });
 check('Sheets outage fails closed, latest note remains',()=>{
  const before=sheets.Events.rows.length;failSheets=true;
  who('alice@example.test',()=>fail('REMOTE_REQUEST_FAILED',()=>call('UPDATE_NOTE',{
   operationId:'duringOutage0001',articleId:shared.articleId,
   expectedVersion:2,title:'修改',content:'不能儲存'
  })));
  failSheets=false;
  assert.equal(sheets.Events.rows.length,before);
 });
 check('All simulated cross-service operations created no CRM localStorage or ERP records',()=>{
  assert.equal(sheets.Events.rows.some(x=>String(x).includes('hongbin_crm_master_r70')),false);
 });
 console.log('BUNDLED GAS END-TO-END MOCK PASS',passed);
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
