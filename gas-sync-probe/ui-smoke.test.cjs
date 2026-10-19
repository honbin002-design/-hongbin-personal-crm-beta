'use strict';
/* Synthetic DOM + fake Google service smoke tests. No deployment, no real data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Index.html','utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'embedded UI program exists');
let pass=0,serial=0,remoteAccount='alice@example.test',forcedConflict=false;
let notes=[],calls=[],groups=[];
class Element{
 constructor(id=''){this.id=id;this.textContent='';this.children=[];this.value='';
  this.hidden=false;this.disabled=false;this.className='';this.onclick=null;this.onchange=null;}
 appendChild(e){this.children.push(e);if(this.id==='groupId')this.value=e.value}
 append(...elements){for(const e of elements)this.appendChild(e)}
 replaceChildren(){this.children=[];this.value=''}
 focus(){}
}
const ids=['identity','groupId','groupSection','items','personal','team','status','refresh',
 'newNote','editor','editorTitle','noteTitle','noteContent','deleteNote','saveNote','cancelNote'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
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
   const mutations=['CREATE_NOTE','UPDATE_NOTE','DELETE_NOTE','CREATE_GROUP','SET_MEMBER'];
   if(mutations.includes(action)&&args.__expectedGoogleAccount!==remoteAccount)throw Error('GOOGLE_ACCOUNT_SWITCHED');
   if(action==='LIST_GROUPS')result=groups;
   else if(action==='LIST_NOTES'){
    result=notes.filter(n=>n.scope===args.scope&&(args.scope==='PRIVATE'||n.groupId===args.groupId));
   }else if(action==='CREATE_NOTE'){
    result={articleId:'test-id-'+(++serial),title:args.title,content:args.content,
     groupId:args.groupId||null,scope:args.scope,version:1,updatedAt:'2026-10-19T01:00:00Z'};
    notes.push(result);
   }else if(action==='UPDATE_NOTE'){
    const n=notes.find(n=>n.articleId===args.articleId);
    if(forcedConflict||n.version!==args.expectedVersion)throw Error('VERSION_CONFLICT');
    n.title=args.title;n.content=args.content;n.version++;result=n;
   }else if(action==='DELETE_NOTE'){
    const n=notes.find(n=>n.articleId===args.articleId);
    if(n.version!==args.expectedVersion)throw Error('VERSION_CONFLICT');
    notes=notes.filter(x=>x!==n);result={deleted:true};
   }else throw Error('UNSUPPORTED_ACTION');
   this.onSuccess(result);
  }catch(e){this.onFailure(e)}
 }
};
const crypto={getRandomValues:arr=>{for(let i=0;i<arr.length;i++)arr[i]=(serial+i*13)&255;return arr}};
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
succeed('Account switch fails server assertion and keeps entered text',()=>{
 remoteAccount='bob@example.test';
 elements.saveNote.onclick();
 assert.equal(elements.noteContent.value,'不准被清掉的草稿');
 assert.match(elements.status.textContent,/GOOGLE_ACCOUNT_SWITCHED/);
 remoteAccount='alice@example.test';elements.cancelNote.onclick();
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
console.log('IPHONE SYNC NOTE UI MOCK PASS',pass);
