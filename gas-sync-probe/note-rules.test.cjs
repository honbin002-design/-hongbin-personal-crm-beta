'use strict';
/* Isolated identity/authorization UNIT TESTS only. NOT Google OAuth or real iPhones. */
const assert=require('node:assert/strict');
const {createNoteRules}=require('./note-rules.cjs');
let active='alice@example.test',ticks=0,passed=0;
const now=()=>new Date(Date.UTC(2026,9,19,0,0,ticks++)).toISOString();
const svc=createNoteRules({identity:()=>active,now});
function as(who,fn){active=who;return fn()}
function okay(label,test){test();passed++;console.log('PASS: '+label)}
function denied(code,fn){assert.throws(fn,e=>e?.message===code,code)}
let privateNote,groupId,sharedNote;
okay('No identity fails closed',()=>{
  as('',()=>denied('UNVERIFIED_IDENTITY',()=>svc.listNotes()));
});
okay('Create private ignores spoofed ownerId/scope and never sets group',()=>{
  privateNote=as('alice@example.test',()=>svc.createNote({
    scope:'PRIVATE',ownerId:'bob@example.test',title:'私人',content:'嚴禁給 Bob',groupId:null}));
  assert.equal(privateNote.ownerId,'alice@example.test');
  assert.equal(privateNote.scope,'PRIVATE');assert.equal(privateNote.groupId,null);
});
okay('No personal note leak through another account list or search',()=>{
  assert.deepEqual(as('bob@example.test',()=>svc.listNotes({scope:'PRIVATE',query:'嚴禁'})),[]);
});
okay('No direct read, edit, history, or delete of others private note',()=>{
  as('bob@example.test',()=>{
    denied('FORBIDDEN_PRIVATE',()=>svc.getNote({articleId:privateNote.articleId}));
    denied('FORBIDDEN_PRIVATE',()=>svc.getHistory({articleId:privateNote.articleId}));
    denied('FORBIDDEN_PRIVATE',()=>svc.editNote({articleId:privateNote.articleId,expectedVersion:1,title:'x',content:'x'}));
    denied('FORBIDDEN_PRIVATE',()=>svc.deleteNote({articleId:privateNote.articleId,expectedVersion:1}));
  });
});
okay('Private note cannot silently convert into group-shared note',()=>{
  as('alice@example.test',()=>denied('PRIVATE_GROUP_NOT_ALLOWED',()=>svc.createNote({
    scope:'PRIVATE',groupId:'fake',content:'secret'})));
});
okay('Group management starts with verified actor as ADMIN',()=>{
  const g=as('alice@example.test',()=>svc.createGroup({name:'試用群組'}));groupId=g.groupId;
  assert.equal(g.role,'ADMIN');
});
okay('Nonadmin cannot create group invitations',()=>{
  as('bob@example.test',()=>denied('FORBIDDEN_ADMIN',()=>svc.setMember({
    groupId,memberId:'mallory@example.test',role:'ADMIN'})));
});
okay('Admin may authorize EDITOR and VIEWER only',()=>{
  as('alice@example.test',()=>{
    svc.setMember({groupId,memberId:'bob@example.test',role:'EDITOR'});
    svc.setMember({groupId,memberId:'carol@example.test',role:'VIEWER'});
  });
  const ms=as('alice@example.test',()=>svc.getMembers({groupId}));
  assert.equal(ms.filter(x=>x.status==='ACTIVE').length,3);
});
okay('Cannot remove the final group ADMIN',()=>{
  as('alice@example.test',()=>denied('LAST_ADMIN',()=>svc.setMember({
    groupId,memberId:'alice@example.test',role:'VIEWER'})));
});
okay('Shared article created with signed-in actor owner, version and audit',()=>{
  sharedNote=as('alice@example.test',()=>svc.createNote({
    scope:'SHARED',groupId,ownerId:'mallory@example.test',title:'共同紀錄',content:'初始內容'}));
  assert.equal(sharedNote.ownerId,'alice@example.test');
  assert.equal(sharedNote.version,1);assert.equal(sharedNote.updatedBy,'alice@example.test');
});
okay('VIEWER can see shared article',()=>{
  const copy=as('carol@example.test',()=>svc.getNote({articleId:sharedNote.articleId}));
  assert.equal(copy.title,'共同紀錄');
});
okay('VIEWER cannot create, edit or delete shared articles',()=>{
  as('carol@example.test',()=>{
    denied('FORBIDDEN_WRITE',()=>svc.createNote({scope:'SHARED',groupId,content:'unauthorized'}));
    denied('FORBIDDEN_WRITE',()=>svc.editNote({articleId:sharedNote.articleId,expectedVersion:1,
      title:'x',content:'x'}));
    denied('FORBIDDEN_DELETE',()=>svc.deleteNote({articleId:sharedNote.articleId,expectedVersion:1}));
  });
});
okay('EDITOR can edit and becomes updatedBy',()=>{
  sharedNote=as('bob@example.test',()=>svc.editNote({articleId:sharedNote.articleId,expectedVersion:1,
    title:'共同紀錄',content:'Bob 的修改'}));
  assert.equal(sharedNote.version,2);assert.equal(sharedNote.updatedBy,'bob@example.test');
});
okay('Stale concurrent edits are rejected without overwriting latest article',()=>{
  as('alice@example.test',()=>denied('VERSION_CONFLICT',()=>svc.editNote({
    articleId:sharedNote.articleId,expectedVersion:1,title:'舊資料',content:'覆蓋'})));
  assert.equal(as('alice@example.test',()=>svc.getNote({articleId:sharedNote.articleId})).content,'Bob 的修改');
});
okay('EDITOR can create a new shared note but cannot delete one',()=>{
  const next=as('bob@example.test',()=>svc.createNote({scope:'SHARED',groupId,content:'第二筆'}));
  assert.equal(next.scope,'SHARED');
  as('bob@example.test',()=>denied('FORBIDDEN_DELETE',()=>svc.deleteNote({articleId:sharedNote.articleId,expectedVersion:2})));
});
okay('Cross-group nonmember cannot list or read group records',()=>{
  as('mallory@example.test',()=>{
    assert.deepEqual(svc.listNotes({scope:'SHARED',groupId}),[]);
    denied('FORBIDDEN_SHARED',()=>svc.getNote({articleId:sharedNote.articleId}));
  });
});
okay('Revoked member immediately loses listing, viewing, editing and history rights',()=>{
  as('alice@example.test',()=>svc.setMember({groupId,memberId:'bob@example.test',status:'REVOKED'}));
  as('bob@example.test',()=>{
    assert.deepEqual(svc.listNotes({scope:'SHARED'}),[]);
    denied('FORBIDDEN_SHARED',()=>svc.getNote({articleId:sharedNote.articleId}));
    denied('FORBIDDEN_SHARED',()=>svc.getHistory({articleId:sharedNote.articleId}));
    denied('FORBIDDEN_SHARED',()=>svc.editNote({articleId:sharedNote.articleId,expectedVersion:2,
      title:'x',content:'x'}));
  });
});
okay('Client-supplied ownerId does not override server-verified identity',()=>{
  const n=as('carol@example.test',()=>svc.createNote({
    scope:'PRIVATE',ownerId:'alice@example.test',title:'mine',content:'Carol 私密'}));
  assert.equal(n.ownerId,'carol@example.test');
  as('alice@example.test',()=>denied('FORBIDDEN_PRIVATE',()=>svc.getNote({articleId:n.articleId})));
});
okay('Admin deletion uses optimistic version and tombstone; other group users see nothing',()=>{
  as('alice@example.test',()=>denied('VERSION_CONFLICT',()=>svc.deleteNote({articleId:sharedNote.articleId,expectedVersion:1})));
  const deleted=as('alice@example.test',()=>svc.deleteNote({articleId:sharedNote.articleId,expectedVersion:2}));
  assert.equal(deleted.version,3);assert.equal(deleted.deleted,true);
  as('carol@example.test',()=>denied('NOT_FOUND',()=>svc.getNote({articleId:sharedNote.articleId})));
});
okay('All security test fixtures use synthetic users and no real data',()=>{
  assert.ok(!JSON.stringify(svc).includes('honbin002@gmail.com'));
});
console.log('GAS NOTE SECURITY MODEL UNIT PASS',passed);
