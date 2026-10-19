'use strict';
/* Synthetic DOM + fake Google service smoke tests. No deployment, no real data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Index.html','utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'embedded UI program exists');
let pass=0,serial=0,randomSerial=0,remoteAccount='alice@example.test',forcedConflict=false,lostAckOnce=false,lostDeleteAckOnce=false;
const committedOps=new Map();
let notes=[],calls=[],groups=[],members=[];
class Element{
 constructor(id=''){this.id=id;this.textContent='';this.children=[];this.value='';
  this.hidden=false;this.disabled=false;this.className='';this.onclick=null;this.onchange=null;}
 appendChild(e){this.children.push(e);if(this.id==='groupId')this.value=e.value}
 append(...elements){for(const e of elements)this.appendChild(e)}
 replaceChildren(){this.children=[];this.value=''}
 focus(){}
}
const ids=['identity','groupId','groupSection','items','personal','team','status','refresh',
 'newNote','editor','editorTitle','noteTitle','noteContent','deleteNote','saveNote','cancelNote',
 'newGroup','manageGroup','groupCreate','newGroupName','saveGroup','cancelGroup',
 'groupMembers','memberEmail','memberRole','addMember','closeMembers','memberList'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
// Mirror initial HTML attributes; this fake DOM is not a real HTML parser.
elements.personal.className='active';
elements.team.className='secondary';
const document={
 getElementById:id=>{if(!elements[id])throw Error('Unknown element: '+id);return elements[id]},
 createElement:tag=>new Element(tag)
};
const succeed=(name,fn)=>{fn();pass++;console.log('PASS: '+name)};
const fakeService={onSuccess:null,onFailure:null,
 withSuccessHandler(fn){this.onSuccess=fn;return this},
 withFailureHandler(fn){this.onFailure=fn;return this},
 gasWhoAmI(){this.onSuccess({account:remoteAccount})},
 gasNoteCall(action,args){
  calls.push({action,args:JSON.parse(JSON.stringify(args))});
  let result;
  try{
   // Backend checks all read/write actions against current Google Session.
   if(args.__expectedGoogleAccount!==remoteAccount)throw Error('GOOGLE_ACCOUNT_SWITCHED');
   if(action==='LIST_GROUPS')result=groups;
   else if(action==='CREATE_GROUP'){
    result={groupId:'test-group-'+(++serial),role:'ADMIN'};
    groups.push({groupId:result.groupId,name:args.name,role:'ADMIN'});
    members.push({groupId:result.groupId,memberId:remoteAccount,role:'ADMIN',status:'ACTIVE'});
   }else if(action==='LIST_MEMBERS'){
    if(!groups.some(g=>g.groupId===args.groupId&&g.role==='ADMIN'))throw Error('FORBIDDEN_ADMIN');
    result=members.filter(m=>m.groupId===args.groupId);
   }else if(action==='SET_MEMBER'){
    if(!groups.some(g=>g.groupId===args.groupId&&g.role==='ADMIN'))throw Error('FORBIDDEN_ADMIN');
    const existing=members.find(m=>m.groupId===args.groupId&&m.memberId===args.memberId);
    if(existing){existing.role=args.role;existing.status=args.status}
    else members.push({groupId:args.groupId,memberId:args.memberId,role:args.role,status:args.status});
    result={groupId:args.groupId,memberId:args.memberId,role:args.role,status:args.status};
   }else if(action==='LIST_NOTES'){
    result=notes.filter(n=>n.scope===args.scope&&
     (args.scope==='PRIVATE'?n.ownerId===remoteAccount:n.groupId===args.groupId));
   }else if(action==='CREATE_NOTE'){
    // Simulated authoritative server: same operation ID must not append twice.
    if(committedOps.has(args.operationId))result=committedOps.get(args.operationId);
    else{
     result={articleId:'test-id-'+(++serial),title:args.title,content:args.content,
      groupId:args.groupId||null,scope:args.scope,ownerId:remoteAccount,
     version:1,updatedAt:'2026-10-19T01:00:00Z'};
     notes.push(result);committedOps.set(args.operationId,result);
    }
    if(lostAckOnce){
     lostAckOnce=false;
     this.onFailure(new Error('SIMULATED_ACK_LOSS_AFTER_COMMIT'));
     return;
    }
   }else if(action==='UPDATE_NOTE'){
    const n=notes.find(n=>n.articleId===args.articleId);
    if(forcedConflict||n.version!==args.expectedVersion)throw Error('VERSION_CONFLICT');
    n.title=args.title;n.content=args.content;n.version++;result=n;
   }else if(action==='DELETE_NOTE'){
    if(committedOps.has(args.operationId))result=committedOps.get(args.operationId);
    else{
     const n=notes.find(n=>n.articleId===args.articleId);
     if(!n||n.version!==args.expectedVersion)throw Error('VERSION_CONFLICT');
     notes=notes.filter(x=>x!==n);result={deleted:true};
     committedOps.set(args.operationId,result);
    }
    if(lostDeleteAckOnce){
     lostDeleteAckOnce=false;
     this.onFailure(new Error('SIMULATED_DELETE_ACK_LOSS_AFTER_COMMIT'));
     return;
    }
   }else throw Error('UNSUPPORTED_ACTION');
   this.onSuccess(result);
  }catch(e){this.onFailure(e)}
 }
};
const crypto={getRandomValues:arr=>{const seed=++randomSerial;for(let i=0;i<arr.length;i++)arr[i]=(seed+i*13)&255;return arr}};
const window={google:{script:{run:fakeService}},crypto,confirm:()=>true};
vm.runInNewContext(match[1],{window,document,google:window.google,Date,Uint8Array},{timeout:4000});
succeed('Verified Google session appears',()=>assert.match(elements.identity.textContent,/alice@example\.test/));
succeed('Initial private empty list accessible',()=>assert.match(elements.status.textContent,/0 則/));
succeed('Create note action opens editor',()=>{
 assert.equal(elements.newNote.disabled,false);
 elements.newNote.onclick();assert.equal(elements.editor.hidden,false);
});
succeed('New note sends expected account and creates on remote',()=>{
 elements.noteTitle.value='hello';elements.noteContent.value='私人測試';
 elements.saveNote.onclick();assert.equal(notes.length,1);
 const p=calls.filter(x=>x.action==='CREATE_NOTE').at(-1);
 assert.equal(p.args.__expectedGoogleAccount,'alice@example.test');
 assert.equal(p.args.scope,'PRIVATE');assert.equal(elements.editor.hidden,true);
});
succeed('Rendered user text is not executed as HTML',()=>{
 notes[0].content='<img src=x onerror=alert(1)>';
 elements.refresh.onclick();
 const art=elements.items.children[0];
 assert.equal(art.children[2].textContent,'<img src=x onerror=alert(1)>');
 assert.doesNotMatch(html,/innerHTML\s*=/);
});
succeed('Edit uses saved expectedVersion',()=>{
 const art=elements.items.children[0];art.children[3].onclick();
 assert.equal(elements.noteContent.value,notes[0].content);
 elements.noteContent.value='第二版';elements.saveNote.onclick();
 assert.equal(notes[0].version,2);
 assert.equal(calls.filter(x=>x.action==='UPDATE_NOTE').at(-1).args.expectedVersion,1);
});
succeed('Version conflict retains unsaved draft',()=>{
 const article=elements.items.children[0];article.children[3].onclick();
 elements.noteContent.value='不准被清掉的草稿';forcedConflict=true;
 elements.saveNote.onclick();forcedConflict=false;
 assert.equal(elements.editor.hidden,false);
 assert.equal(elements.noteContent.value,'不准被清掉的草稿');
 assert.match(elements.status.textContent,/另一支手機已修改/);
});
succeed('Account switch hides all old private notes and editor contents immediately',()=>{
 remoteAccount='bob@example.test';
 elements.saveNote.onclick();
 assert.equal(elements.items.children.length,0);
 assert.equal(elements.editor.hidden,true);
 assert.equal(elements.noteContent.value,'');
 assert.match(elements.identity.textContent,/先前的私人內容已隱藏/);
 assert.equal(elements.newNote.disabled,true);
});
succeed('A new Google account cannot see another users cached or pending private notes',()=>{
 elements.refresh.onclick(); // Google rechecks, logs in B
 assert.match(elements.identity.textContent,/bob@example.test/);
 assert.equal(elements.items.children.length,1);
 assert.match(elements.items.children[0].textContent,/目前沒有授權可查看的記事/);
 assert.equal(elements.editor.hidden,true);
});
succeed('Original Google account re-verification restores only its own in-page draft',()=>{
 remoteAccount='alice@example.test';
 elements.refresh.onclick(); // B assertion fails; hides B view
 assert.equal(elements.items.children.length,0);
 elements.refresh.onclick(); // Google session A verified
 assert.match(elements.identity.textContent,/alice@example.test/);
 assert.equal(elements.editor.hidden,false);
 assert.equal(elements.noteContent.value,'不准被清掉的草稿');
 assert.match(elements.status.textContent,/恢復此頁暫存草稿/);
 elements.cancelNote.onclick();
});
succeed('Unsaved private draft blocks tab switch when user cancels',()=>{
 elements.newNote.onclick();
 elements.noteContent.value='我還沒存檔';
 window.confirm=()=>false;
 elements.team.onclick();
 assert.equal(elements.editor.hidden,false);
 assert.equal(elements.noteContent.value,'我還沒存檔');
 assert.equal(elements.personal.className,'active');
 window.confirm=()=>true;
 elements.cancelNote.onclick();
});
succeed('Lost ACK after Google commit retries same operation ID without duplicate create',()=>{
 elements.newNote.onclick();
 elements.noteTitle.value='雲端已寫入，但回覆中斷';
 elements.noteContent.value='不能重複建立';
 const originalCount=notes.length;lostAckOnce=true;
 elements.saveNote.onclick();
 assert.equal(notes.length,originalCount+1);
 assert.equal(elements.editor.hidden,false);
 const initial=calls.filter(x=>x.action==='CREATE_NOTE').at(-1).args.operationId;
 elements.saveNote.onclick();
 const retry=calls.filter(x=>x.action==='CREATE_NOTE').at(-1).args.operationId;
 assert.equal(initial,retry);
 assert.equal(notes.length,originalCount+1);
 assert.equal(elements.editor.hidden,true);
});
succeed('Changed draft after ambiguous ACK refuses unsafe new operation',()=>{
 elements.newNote.onclick();
 elements.noteTitle.value='待核對';
 elements.noteContent.value='原本送出內容';
 lostAckOnce=true;elements.saveNote.onclick();
 const count=calls.filter(x=>x.action==='CREATE_NOTE').length;
 const storedCount=notes.length;
 elements.noteContent.value='再次編輯的新內容';
 elements.saveNote.onclick();
 assert.equal(calls.filter(x=>x.action==='CREATE_NOTE').length,count);
 assert.equal(notes.length,storedCount);
 assert.equal(elements.noteContent.value,'再次編輯的新內容');
 assert.match(elements.status.textContent,/上一次儲存結果尚未確認/);
 elements.cancelNote.onclick();
});
succeed('Switching Google account during a READ clears previously displayed notes',()=>{
 assert.ok(elements.items.children.length>0);
 remoteAccount='bob@example.test';
 elements.refresh.onclick();
 assert.equal(elements.items.children.length,0);
 assert.equal(elements.newNote.disabled,true);
 assert.equal(elements.editor.hidden,true);
 remoteAccount='alice@example.test';
 elements.refresh.onclick();
 assert.match(elements.identity.textContent,/alice@example.test/);
 assert.match(elements.status.textContent,/同步讀取成功/);
});
succeed('Late old-account success callback cannot re-display cached private notes',()=>{
 assert.ok(elements.items.children.length>0);
 // Simulate response arriving late from a request issued while Alice was logged in.
 const staleReadSuccess=fakeService.onSuccess;
 remoteAccount='bob@example.test';
 elements.refresh.onclick(); // explicit Google mismatch hides Alice's cached notes
 assert.equal(elements.items.children.length,0);
 staleReadSuccess(notes.filter(x=>x.scope==='PRIVATE'&&x.ownerId==='alice@example.test'));
 assert.equal(elements.items.children.length,0);
 assert.equal(elements.editor.hidden,true);
 remoteAccount='alice@example.test';
 elements.refresh.onclick(); // verify Alice, not Bob
 assert.match(elements.identity.textContent,/alice@example.test/);
});
succeed('Shared VIEWER cannot create or edit notes',()=>{
 groups=[{groupId:'group-001',name:'共同記事',role:'VIEWER'}];
 notes.push({articleId:'sh-1',scope:'SHARED',groupId:'group-001',title:'Group',content:'公告',
  version:1,updatedAt:'2026-10-19T02:00:00Z'});
 elements.team.onclick();
 assert.equal(elements.newNote.disabled,true);
 assert.equal(elements.items.children[0].children.length,3);
});
succeed('Shared EDITOR can edit but not delete',()=>{
 groups=[{groupId:'group-001',name:'共同記事',role:'EDITOR'}];
 elements.team.onclick();assert.equal(elements.newNote.disabled,false);
 const art=elements.items.children[0];art.children[3].onclick();
 assert.equal(elements.deleteNote.hidden,true);
 elements.cancelNote.onclick();
});
succeed('Shared ADMIN can delete after explicit confirmation',()=>{
 groups=[{groupId:'group-001',name:'共同記事',role:'ADMIN'}];
 elements.team.onclick();
 elements.items.children[0].children[3].onclick();
 assert.equal(elements.deleteNote.hidden,false);
 elements.deleteNote.onclick();
 assert.ok(!notes.some(x=>x.articleId==='sh-1'));
});
succeed('Lost delete ACK reuses original operation ID and does not re-delete record',()=>{
 elements.personal.onclick();
 assert.ok(elements.items.children.length>0);
 const firstNote=notes.find(n=>n.scope==='PRIVATE');
 const index=elements.items.children.findIndex(x=>x.children[0].textContent===firstNote.title);
 assert.ok(index>=0);
 elements.items.children[index].children[3].onclick();
 assert.equal(elements.deleteNote.hidden,false);
 lostDeleteAckOnce=true;
 elements.deleteNote.onclick();
 assert.equal(notes.some(n=>n.articleId===firstNote.articleId),false);
 assert.equal(elements.editor.hidden,false);
 const id1=calls.filter(x=>x.action==='DELETE_NOTE').at(-1).args.operationId;
 elements.deleteNote.onclick();
 const id2=calls.filter(x=>x.action==='DELETE_NOTE').at(-1).args.operationId;
 assert.equal(id1,id2);
 assert.equal(notes.some(n=>n.articleId===firstNote.articleId),false);
 assert.equal(elements.editor.hidden,true);
});

succeed('Shared group can be created from iPhone without manual group ID',()=>{
 elements.team.onclick();
 elements.newGroup.onclick();
 assert.equal(elements.groupCreate.hidden,false);
 elements.newGroupName.value='客戶合作群';
 elements.saveGroup.onclick();
 assert.equal(elements.groupCreate.hidden,true);
 assert.equal(elements.groupId.value.startsWith('test-group-'),true);
 assert.equal(elements.manageGroup.hidden,false);
 const request=calls.filter(x=>x.action==='CREATE_GROUP').at(-1).args;
 assert.equal(request.__expectedGoogleAccount,'alice@example.test');
 assert.match(request.operationId,/^operation_[a-f0-9]{32}$/);
});
succeed('Only ADMIN may open member management and see group members',()=>{
 elements.manageGroup.onclick();
 assert.equal(elements.groupMembers.hidden,false);
 assert.ok(elements.memberList.children.some(x=>x.children[0].textContent==='alice@example.test'));
});
succeed('Member email must be valid before network request',()=>{
 const before=calls.filter(x=>x.action==='SET_MEMBER').length;
 elements.memberEmail.value='not-email';
 elements.memberRole.value='EDITOR';
 elements.addMember.onclick();
 assert.equal(calls.filter(x=>x.action==='SET_MEMBER').length,before);
});
succeed('ADMIN can add a VIEWER without sending an invitation email',()=>{
 elements.memberEmail.value='member@example.test';
 elements.memberRole.value='VIEWER';
 elements.addMember.onclick();
 const request=calls.filter(x=>x.action==='SET_MEMBER').at(-1).args;
 assert.equal(request.memberId,'member@example.test');
 assert.equal(request.role,'VIEWER');
 assert.equal(members.find(x=>x.memberId==='member@example.test').status,'ACTIVE');
});
succeed('ADMIN can revoke shared membership from phone',()=>{
 const row=elements.memberList.children.find(x=>x.children[0].textContent==='member@example.test');
 assert.ok(row);
 row.children[2].onclick();
 const request=calls.filter(x=>x.action==='SET_MEMBER').at(-1).args;
 assert.equal(request.status,'REVOKED');
 assert.equal(members.find(x=>x.memberId==='member@example.test').status,'REVOKED');
});

console.log('IPHONE SYNC NOTE UI MOCK PASS',pass);
