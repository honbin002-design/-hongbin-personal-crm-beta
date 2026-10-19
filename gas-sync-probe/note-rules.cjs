'use strict';
/*
 * HONBIN GAS note authorization rules — isolated local test module, NOT DEPLOYED.
 * This module is not a web endpoint; never expose a function accepting an actor ID
 * directly to untrusted browser callers. identity() MUST be a verified server-side
 * Google session identity. If Google returns empty identity, fail closed.
 * Persistence and atomic locking are NOT covered by this prototype.
 */
function createNoteRules({identity,now=()=>new Date().toISOString()}) {
  if(typeof identity!=='function') throw Error('TRUSTED_IDENTITY_REQUIRED');
  const groups=new Map(), notes=new Map(),history=new Map();
  let sequence=0;
  const fail=code=>{throw Error(code)};
  const actor=()=>{const x=identity();if(typeof x!=='string'||!x.trim())fail('UNVERIFIED_IDENTITY');return x.trim().toLowerCase()};
  const stamp=()=>now();
  const uid=()=>String(++sequence);
  const member=(g,a)=>g?.members.get(a);
  const role=(g,a)=>{const m=member(g,a);return m?.status==='ACTIVE'?m.role:null};
  const requireAdmin=(g,a)=>{if(role(g,a)!=='ADMIN')fail('FORBIDDEN_ADMIN')};
  const authorized=(n,a,action)=>{
    if(!n||n.deletedAt)fail('NOT_FOUND');
    if(n.scope==='PRIVATE'){
      if(n.ownerId!==a)fail('FORBIDDEN_PRIVATE');
      return;
    }
    const r=role(groups.get(n.groupId),a);
    if(!r)fail('FORBIDDEN_SHARED');
    if(action==='edit'&&r!=='ADMIN'&&r!=='EDITOR')fail('FORBIDDEN_WRITE');
    if(action==='delete'&&r!=='ADMIN')fail('FORBIDDEN_DELETE');
  };
  const copy=o=>JSON.parse(JSON.stringify(o));
  function createGroup({name}={}){
    const a=actor(),id=uid(),date=stamp();
    const g={id,name:String(name||'共用群組').slice(0,120),createdAt:date,
      members:new Map([[a,{memberId:a,role:'ADMIN',status:'ACTIVE',joinedAt:date,revokedAt:null}]])};
    groups.set(id,g);
    return {groupId:id,role:'ADMIN'};
  }
  function setMember({groupId,memberId,role:nextRole,status='ACTIVE'}){
    const a=actor(),g=groups.get(String(groupId));if(!g)fail('GROUP_NOT_FOUND');
    requireAdmin(g,a);
    if(typeof memberId!=='string'||!memberId.trim())fail('INVALID_MEMBER');
    const target=memberId.trim().toLowerCase(),prev=member(g,target),current=stamp();
    if(status!=='ACTIVE'&&status!=='REVOKED')fail('INVALID_STATUS');
    if(status==='ACTIVE'&&!['ADMIN','EDITOR','VIEWER'].includes(nextRole))fail('INVALID_ROLE');
    const newRole=status==='ACTIVE'?nextRole:(prev?.role||'VIEWER');
    const activeAdmins=[...g.members.values()].filter(x=>x.status==='ACTIVE'&&x.role==='ADMIN');
    if(prev?.role==='ADMIN'&&prev.status==='ACTIVE'&&
       (status==='REVOKED'||newRole!=='ADMIN')&&activeAdmins.length<=1)fail('LAST_ADMIN');
    g.members.set(target,{memberId:target,role:newRole,status,
      joinedAt:prev?.joinedAt||current,revokedAt:status==='REVOKED'?current:null});
    return {groupId:g.id,memberId:target,role:newRole,status};
  }
  function getMembers({groupId}){
    const a=actor(),g=groups.get(String(groupId));if(!g)fail('GROUP_NOT_FOUND');
    requireAdmin(g,a);return [...g.members.values()].map(copy);
  }
  function createNote({scope='PRIVATE',groupId=null,title='',content=''}={}){
    const a=actor(),date=stamp();
    if(!['PRIVATE','SHARED'].includes(scope))fail('INVALID_SCOPE');
    if(scope==='PRIVATE'&&groupId)fail('PRIVATE_GROUP_NOT_ALLOWED');
    if(scope==='SHARED'){
      const r=role(groups.get(String(groupId)),a);
      if(r!=='ADMIN'&&r!=='EDITOR')fail('FORBIDDEN_WRITE');
    }
    if(typeof title!=='string'||typeof content!=='string'||!content.trim())fail('INVALID_NOTE');
    if(title.length>120||content.length>30000)fail('NOTE_TOO_LARGE');
    const id=uid(),n={articleId:id,scope,ownerId:a,groupId:scope==='SHARED'?String(groupId):null,
      title,content,createdAt:date,updatedAt:date,updatedBy:a,version:1,deletedAt:null};
    notes.set(id,n);history.set(id,[{version:1,actor:a,at:date,type:'CREATED'}]);
    return copy(n);
  }
  function listNotes({scope='PRIVATE',groupId=null,query=''}={}){
    const a=actor();
    if(!['PRIVATE','SHARED'].includes(scope))fail('INVALID_SCOPE');
    const q=String(query||'').toLocaleLowerCase();
    return [...notes.values()].filter(n=>{
      if(n.deletedAt||n.scope!==scope)return false;
      if(scope==='PRIVATE'&&n.ownerId!==a)return false;
      if(scope==='SHARED'&&(groupId&&String(groupId)!==n.groupId||
        !role(groups.get(n.groupId),a)))return false;
      return (n.title+'\n'+n.content).toLocaleLowerCase().includes(q);
    }).sort((x,y)=>y.updatedAt.localeCompare(x.updatedAt)).map(copy);
  }
  function getNote({articleId}){
    const a=actor(),n=notes.get(String(articleId));authorized(n,a,'view');return copy(n);
  }
  function getHistory({articleId}){
    const a=actor(),n=notes.get(String(articleId));authorized(n,a,'view');
    return copy(history.get(n.articleId)||[]);
  }
  function editNote({articleId,expectedVersion,title,content}){
    const a=actor(),n=notes.get(String(articleId));authorized(n,a,'edit');
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion!==n.version)fail('VERSION_CONFLICT');
    if(typeof title!=='string'||typeof content!=='string'||!content.trim())fail('INVALID_NOTE');
    if(title.length>120||content.length>30000)fail('NOTE_TOO_LARGE');
    n.title=title;n.content=content;n.updatedAt=stamp();n.updatedBy=a;n.version++;
    history.get(n.articleId).push({version:n.version,actor:a,at:n.updatedAt,type:'EDITED'});
    return copy(n);
  }
  function deleteNote({articleId,expectedVersion}){
    const a=actor(),n=notes.get(String(articleId));authorized(n,a,'delete');
    if(!Number.isSafeInteger(expectedVersion)||expectedVersion!==n.version)fail('VERSION_CONFLICT');
    n.deletedAt=stamp();n.updatedAt=n.deletedAt;n.updatedBy=a;n.version++;
    history.get(n.articleId).push({version:n.version,actor:a,at:n.updatedAt,type:'DELETED'});
    return {articleId:n.articleId,deleted:true,version:n.version};
  }
  return Object.freeze({createGroup,setMember,getMembers,createNote,listNotes,
    getNote,getHistory,editNote,deleteNote});
}
if(typeof module!=='undefined')module.exports={createNoteRules};
