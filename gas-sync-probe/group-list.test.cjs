'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createEventService}=require('./event-service.cjs');
const {createServerSideSigner,createServerSideVerifier,createAuthorizedDispatcher}=require('./signed-boundary.cjs');
const events=[];let actor='alice@example.test',serial=0,passed=0;
const serviceFor=identity=>createEventService({identity,
 storage:{read:()=>JSON.parse(JSON.stringify(events)),append:x=>events.push(JSON.parse(JSON.stringify(x)))},
 withLock:fn=>fn(),
 newId:()=>('uid-'+String(++serial).padStart(12,'0'))});
const secret='SYNTHETIC_SHARED_GROUP_TEST_SECRET_IS_NOT_PRODUCTION_0123456789';
const hmac=(s,v)=>crypto.createHmac('sha256',s).update(v).digest('base64url');
let nonce=0;
const signer=createServerSideSigner({identity:()=>actor,secret,hmac,nonce:()=>('unique-nonce-'+String(++nonce).padStart(16,'0'))});
const used=new Set();
const verifier=createServerSideVerifier({secret,hmac,nonceRegistry:{
 consumeOnce:key=>{if(used.has(key))return false;used.add(key);return true}
}});
const call=createAuthorizedDispatcher({verify:verifier,serviceForActor:serviceFor});
const as=(id,action,params)=>{actor=id;return call(signer(action,params||{}))};
const check=(name,fn)=>{fn();passed++;console.log('PASS: '+name)};
let g1,g2;
check('Unrelated account cannot list any group',()=>assert.equal(as('stranger@example.test','LIST_GROUPS').length,0));
check('Creator sees their own group in selector list',()=>{
 g1=as('alice@example.test','CREATE_GROUP',{operationId:'createGroup001',name:'台南採購專案'}).groupId;
 const list=as('alice@example.test','LIST_GROUPS');
 assert.equal(list.length,1);assert.equal(list[0].role,'ADMIN');assert.equal(list[0].name,'台南採購專案');
});
check('Other user does not learn hidden group names',()=>{
 assert.deepEqual(as('bob@example.test','LIST_GROUPS'),[]);
});
check('Invited VIEWER sees authorized group with role',()=>{
 as('alice@example.test','SET_MEMBER',{operationId:'inviteBob0001',groupId:g1,
  memberId:'bob@example.test',role:'VIEWER'});
 const list=as('bob@example.test','LIST_GROUPS');
 assert.equal(list.length,1);assert.equal(list[0].role,'VIEWER');
});
check('Separate new group remains hidden from VIEWER',()=>{
 g2=as('alice@example.test','CREATE_GROUP',{operationId:'createGroup002',name:'主管內部群組'}).groupId;
 assert.equal(as('bob@example.test','LIST_GROUPS').length,1);
 assert.ok(!as('bob@example.test','LIST_GROUPS').some(x=>x.groupId===g2));
});
check('Revoked member no longer sees group in selector',()=>{
 as('alice@example.test','SET_MEMBER',{operationId:'revokeBob0001',groupId:g1,memberId:'bob@example.test',status:'REVOKED'});
 assert.equal(as('bob@example.test','LIST_GROUPS').length,0);
});
check('Owner still sees two groups and cannot reveal their member data through listGroups',()=>{
 const list=as('alice@example.test','LIST_GROUPS');
 assert.equal(list.length,2);
 assert.ok(list.every(x=>!Object.hasOwn(x,'members')&&!Object.hasOwn(x,'ownerId')));
});
check('Action still validated on backend, not by UI selector',()=>{
 assert.throws(()=>as('bob@example.test','GET_NOTE',{articleId:'not-found'}),
 e=>e.message==='NOT_FOUND');
});
console.log('AUTHORIZED GROUP PICKER PASS',passed);
