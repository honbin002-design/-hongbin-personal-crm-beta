'use strict';
const assert=require('node:assert/strict');
const {createEventService}=require('./event-service.cjs');
const rows=[];let principal='alice@example.test',seq=0,busy=false,failAppend=false,passed=0;
const options={
 identity:()=>principal,
 storage:{read:()=>JSON.parse(JSON.stringify(rows)),append:v=>{
  if(!busy)throw Error('WRITE_WITHOUT_LOCK');
  if(failAppend)throw Error('SIMULATED_APPEND_FAIL');
  rows.push(JSON.parse(JSON.stringify(v)));
 }},
 withLock:fn=>{if(busy)throw Error('LOCK_BUSY');busy=true;try{return fn()}finally{busy=false}},
 newId:()=>('uuid-'+String(++seq).padStart(12,'0')),
 clock:()=>new Date(Date.UTC(2026,9,19,12,0,seq)).toISOString()
};
let svc=createEventService(options);
function as(who,fn){principal=who;return fn()}
function test(name,fn){fn();passed++;console.log('PASS: '+name)}
function denied(code,fn){assert.throws(fn,e=>e?.message===code,code)}
const alice='alice@example.test',bob='bob@example.test',carol='carol@example.test';
let privateNote,sharedNote,group;
test('Missing account rejected',()=>as('',()=>denied('UNVERIFIED_IDENTITY',()=>svc.listNotes())));
test('Private article persisted as own data',()=>{
 privateNote=as(alice,()=>svc.createNote({operationId:'createPrivate01',scope:'PRIVATE',ownerId:bob,content:'private-data'}));
 assert.equal(privateNote.ownerId,alice);
});
test('Guessed private ID and list never leak',()=>as(bob,()=>{
 assert.equal(svc.listNotes().length,0);
 denied('FORBIDDEN_PRIVATE',()=>svc.getNote(privateNote.articleId));
}));
test('Duplicate create is idempotent even after reload',()=>{
 svc=createEventService(options);
 const start=rows.length;
 const same=as(alice,()=>svc.createNote({operationId:'createPrivate01',scope:'PRIVATE',content:'private-data'}));
 assert.equal(same.articleId,privateNote.articleId);assert.equal(rows.length,start);
});
test('Reused operation ID with changed content rejected',()=>as(alice,()=>denied('OPERATION_ID_REUSED',
 ()=>svc.createNote({operationId:'createPrivate01',content:'tamper'}))));
test('Group seeds creator as sole ADMIN',()=>{
 group=as(alice,()=>svc.createGroup({operationId:'createGroup001',name:'group'}));
 assert.equal(as(alice,()=>svc.listMembers(group.groupId))[0].role,'ADMIN');
});
test('Invalid Google account cannot be granted group access',()=>as(alice,()=>{
 const before=rows.length;
 denied('INVALID_MEMBER',()=>svc.setMember({
  operationId:'invalidMember1',groupId:group.groupId,memberId:'not-an-email',role:'EDITOR'}));
 assert.equal(rows.length,before);
}));
test('Server accepts Google accounts with plus and custom domain',()=>as(alice,()=>{
 const item=svc.setMember({operationId:'validAlias0001',groupId:group.groupId,
  memberId:'User+work@Example.ORG',role:'VIEWER'});
 assert.equal(item.memberId,'user+work@example.org');
}));
test('Unknown person cannot grant access',()=>as(bob,()=>denied('FORBIDDEN_ADMIN',
 ()=>svc.setMember({operationId:'badAddMember01',groupId:group.groupId,memberId:carol,role:'EDITOR'}))));
test('Sole administrator cannot be revoked',()=>as(alice,()=>denied('LAST_ADMIN',
 ()=>svc.setMember({operationId:'removeSoleAdm1',groupId:group.groupId,memberId:alice,status:'REVOKED'}))));
test('Admin grants EDITOR and VIEWER',()=>{
 as(alice,()=>{
  svc.setMember({operationId:'addBobEditor01',groupId:group.groupId,memberId:bob,role:'EDITOR'});
  svc.setMember({operationId:'addCarolView01',groupId:group.groupId,memberId:carol,role:'VIEWER'});
 });
 assert.equal(as(alice,()=>svc.listMembers(group.groupId)).length,3);
});
test('Viewer reads shared but not private',()=>{
 sharedNote=as(alice,()=>svc.createNote({operationId:'createShared01',scope:'SHARED',groupId:group.groupId,content:'shared v1'}));
 assert.equal(as(carol,()=>svc.getNote(sharedNote.articleId)).content,'shared v1');
 assert.equal(as(carol,()=>svc.listNotes({scope:'PRIVATE'})).length,0);
});
test('Viewer edits and deletes both denied',()=>as(carol,()=>{
 denied('FORBIDDEN_WRITE',()=>svc.updateNote({operationId:'noViewerEdit01',articleId:sharedNote.articleId,
  expectedVersion:1,title:'t',content:'tamper'}));
 denied('FORBIDDEN_DELETE',()=>svc.deleteNote({operationId:'noViewerDel001',articleId:sharedNote.articleId,expectedVersion:1}));
}));
test('EDITOR update version and audit actor',()=>{
 sharedNote=as(bob,()=>svc.updateNote({operationId:'bobEditVersion1',articleId:sharedNote.articleId,
  expectedVersion:1,title:'v2',content:'shared v2'}));
 assert.equal(sharedNote.version,2);assert.equal(sharedNote.updatedBy,bob);
});
test('Stale concurrent write cannot overwrite newer version',()=>as(alice,()=>{
 denied('VERSION_CONFLICT',()=>svc.updateNote({operationId:'staleEdit00001',articleId:sharedNote.articleId,
  expectedVersion:1,title:'old',content:'lost'}));
 assert.equal(svc.getNote(sharedNote.articleId).content,'shared v2');
}));
test('Append failure changes no canonical event row',()=>{
 failAppend=true;const count=rows.length;
 try{as(alice,()=>assert.throws(()=>svc.updateNote({operationId:'retryLater0001',
  articleId:sharedNote.articleId,expectedVersion:2,title:'test',content:'try'}),/SIMULATED_APPEND_FAIL/))}
 finally{failAppend=false}
 assert.equal(rows.length,count);
});
test('Retry after simulated outage writes once',()=>{
 const v=as(alice,()=>svc.updateNote({operationId:'retryLater0001',articleId:sharedNote.articleId,
  expectedVersion:2,title:'test',content:'try'}));
 assert.equal(v.version,3);
 const before=rows.length;
 const x=as(alice,()=>svc.updateNote({operationId:'retryLater0001',articleId:sharedNote.articleId,
  expectedVersion:2,title:'test',content:'try'}));
 assert.equal(x.version,3);assert.equal(rows.length,before);
});
test('Revoked member loses even saved idempotent response',()=>{
 as(alice,()=>svc.setMember({operationId:'revokeEditor01',groupId:group.groupId,memberId:bob,status:'REVOKED'}));
 as(bob,()=>{
  assert.equal(svc.listNotes({scope:'SHARED'}).length,0);
  denied('FORBIDDEN_SHARED',()=>svc.getNote(sharedNote.articleId));
  denied('FORBIDDEN_SHARED',()=>svc.updateNote({operationId:'bobEditVersion1',articleId:sharedNote.articleId,
   expectedVersion:1,title:'v2',content:'shared v2'}));
 });
});
test('Delete is a versioned tombstone, not destructive row removal',()=>{
 const count=rows.length;
 const d=as(alice,()=>svc.deleteNote({operationId:'deleteShared001',articleId:sharedNote.articleId,expectedVersion:3}));
 assert.equal(d.deleted,true);assert.equal(d.version,4);assert.equal(rows.length,count+1);
 as(carol,()=>denied('NOT_FOUND',()=>svc.getNote(sharedNote.articleId)));
});
test('Historical event trail remains in canonical storage',()=>{
 assert.ok(rows.some(x=>x.entity==='NOTE'&&x.version===1&&x.id===sharedNote.articleId));
 assert.ok(rows.some(x=>x.entity==='NOTE'&&x.version===4&&x.id===sharedNote.articleId));
 assert.equal(busy,false);
});
console.log('EVENT SERVICE OFFLINE PASS',passed);
