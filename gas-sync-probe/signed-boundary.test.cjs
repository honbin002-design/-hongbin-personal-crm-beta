'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createServerSideSigner,createServerSideVerifier,createAuthorizedDispatcher}=require('./signed-boundary.cjs');
const {createEventService}=require('./event-service.cjs');
let actor='alice@example.test',millis=Date.UTC(2026,9,19,1),serial=0,steps=0,passed=0,failLock=false;
const secret='NO_REAL_SECRET_TEST_ONLY_abcdefghijklmnopqrstuvwxyz0123456789';
const hmac=(s,data)=>crypto.createHmac('sha256',s).update(data,'utf8').digest('base64url');
const accepted=new Set();
const nonceRegistry={consumeOnce(key){
 if(failLock)throw Error('NONCE_REGISTRY_UNAVAILABLE');
 if(accepted.has(key))return false;
 accepted.add(key);return true;
}};
const signer=createServerSideSigner({identity:()=>actor,secret,hmac,clock:()=>millis,
 nonce:()=>('nonce-'+String(++serial).padStart(16,'0'))});
const verifier=createServerSideVerifier({secret,hmac,clock:()=>millis,nonceRegistry});
const data=[],storage={read:()=>JSON.parse(JSON.stringify(data)),append:x=>data.push(JSON.parse(JSON.stringify(x)))};
const endpoint=createAuthorizedDispatcher({verify:verifier,
 serviceForActor:identity=>createEventService({identity,storage,withLock:fn=>fn(),
 newId:()=>('new-uuid-'+String(++steps).padStart(8,'0')),clock:()=>new Date(millis).toISOString()})});
const test=(name,fn)=>{fn();passed++;console.log('PASS: '+name)};
const rejected=(code,fn)=>assert.throws(fn,e=>e.message===code,code);
let original,groupId;
test('Signer refuses missing Google identity',()=>{
 actor='';rejected('UNVERIFIED_IDENTITY',()=>signer('LIST_NOTES',{scope:'PRIVATE'}));actor='alice@example.test';
});
test('Backend refuses unconfigured secret',()=>{
 rejected('AUTH_BACKEND_NOT_CONFIGURED',()=>createServerSideVerifier({secret:'a',hmac,nonceRegistry}));
});
test('B validates legitimate A signature and derives verified actor',()=>{
 original=signer('CREATE_NOTE',{operationId:'firstPrivate01',scope:'PRIVATE',ownerId:'mallory@example.test',title:'測試',content:'私密'});
 const result=endpoint(original);assert.equal(result.ownerId,'alice@example.test');
 assert.equal(result.version,1);
});
test('Exact replay denied',()=>rejected('REPLAYED_REQUEST',()=>endpoint(original)));
test('Changing actor without resigning fails',()=>{
 const fake={...original,actor:'bob@example.test',nonce:'nonce-different000001'};
 rejected('INVALID_SIGNATURE',()=>endpoint(fake));
});
test('Changing data without resigning fails',()=>{
 const fake={...original,params:{...original.params,content:'歪曲內容'},nonce:'nonce-xyz12345678901234567890'};
 rejected('INVALID_SIGNATURE',()=>endpoint(fake));
});
test('Incorrect action signature rejected',()=>{
 const fake={...original,action:'DELETE_NOTE',nonce:'nonce-invalid00000001'};
 rejected('INVALID_SIGNATURE',()=>endpoint(fake));
});
test('A cannot forward unauthenticated action',()=>rejected('UNSUPPORTED_ACTION',()=>signer('ADMIN_ALL_DATA',{})));
test('Cross-account cannot list Alice private notes',()=>{
 actor='bob@example.test';const x=endpoint(signer('LIST_NOTES',{scope:'PRIVATE'}));assert.equal(x.length,0);
});
test('Cross-account cannot get directly by guessed ID',()=>{
 actor='bob@example.test';
 const id=data.find(e=>e.entity==='NOTE').id;
 rejected('FORBIDDEN_PRIVATE',()=>endpoint(signer('GET_NOTE',{articleId:id})));
});
test('Old envelope expires at backend',()=>{
 actor='alice@example.test';const x=signer('LIST_NOTES',{scope:'PRIVATE'});millis+=121000;
 rejected('EXPIRED_REQUEST',()=>endpoint(x));
});
test('Future-dated envelope rejected',()=>{
 const x=signer('LIST_NOTES',{scope:'PRIVATE'});millis-=31000;
 rejected('EXPIRED_REQUEST',()=>endpoint(x));
});
test('Nonce registry unavailable fails closed',()=>{
 actor='alice@example.test';millis+=31000;const x=signer('LIST_NOTES',{scope:'PRIVATE'});
 failLock=true;try{rejected('NONCE_REGISTRY_UNAVAILABLE',()=>endpoint(x))}finally{failLock=false}
});
test('Fresh nonce and same operation ID resolves idempotently',()=>{
 const before=data.length;
 const x=endpoint(signer('CREATE_NOTE',{operationId:'firstPrivate01',scope:'PRIVATE',title:'測試',content:'私密'}));
 assert.equal(x.version,1);assert.equal(data.length,before);
});
test('Group management requires server verified identity',()=>{
 groupId=endpoint(signer('CREATE_GROUP',{operationId:'createGroup0001',name:'共用群組'})).groupId;
 actor='bob@example.test';rejected('FORBIDDEN_ADMIN',()=>endpoint(signer('SET_MEMBER',{
  operationId:'nonAdminAdd0001',groupId,memberId:'bob@example.test',role:'EDITOR'})));
});
test('Only approved member can view group notes',()=>{
 actor='alice@example.test';endpoint(signer('SET_MEMBER',{operationId:'addMember00001',groupId,memberId:'bob@example.test',role:'VIEWER'}));
 const item=endpoint(signer('CREATE_NOTE',{operationId:'createShared001',scope:'SHARED',groupId,content:'共有'}));
 actor='bob@example.test';assert.equal(endpoint(signer('GET_NOTE',{articleId:item.articleId})).content,'共有');
 rejected('FORBIDDEN_WRITE',()=>endpoint(signer('UPDATE_NOTE',{operationId:'bobEditShared01',articleId:item.articleId,expectedVersion:1,title:'',content:'x'})));
});
console.log('SIGNED BOUNDARY OFFLINE TEST PASS',passed);
