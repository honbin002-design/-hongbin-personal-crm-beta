'use strict';
/*
 * HONBIN event-log service, isolated proof of persistence and concurrency logic.
 * NOT deployed. Every write is ONE append-only event under the provided lock.
 * The caller MUST inject Google-verified identity(), never client-supplied IDs.
 * In production the Sheets adapter's lock must cover read / version check / append.
 * A single Sheets append is NOT a fully transactional database.
 */
function createEventService({identity,storage,withLock,clock=()=>new Date().toISOString(),newId}) {
  if(typeof identity!=='function'||!storage||typeof storage.read!=='function'||
     typeof storage.append!=='function'||typeof withLock!=='function'||typeof newId!=='function')
     throw Error('TRUSTED_DEPENDENCIES_REQUIRED');
  const copy=v=>JSON.parse(JSON.stringify(v)),fail=code=>{throw Error(code)};
  const actor=()=>{const v=identity();if(typeof v!=='string'||!v.trim())fail('UNVERIFIED_IDENTITY');return v.trim().toLowerCase()};
  const id=()=>{const v=newId();if(typeof v!=='string'||v.length<8)fail('INVALID_GENERATED_ID');return v};
  const opId=v=>{if(typeof v!=='string'||!/^[-a-zA-Z0-9_:]{8,128}$/.test(v))fail('INVALID_OPERATION_ID');return v};
  const now=()=>clock();
  const read=()=>{
    const e=storage.read();
    if(!Array.isArray(e))fail('EVENT_STORE_UNAVAILABLE');
    const notes=new Map(),groups=new Map(),members=new Map(),operation=new Map(),history=new Map();
    for(const item of e){
      if(!item||!['NOTE','GROUP','MEMBER'].includes(item.entity)||typeof item.id!=='string'||!item.payload)
        fail('EVENT_LOG_CORRUPT');
      const k=item.actor+'|'+item.operationId;
      if(operation.has(k))fail('DUPLICATE_EVENT_LOG_OPERATION');
      operation.set(k,item);
      if(item.entity==='NOTE'){
        const n=item.payload;
        if(n.articleId!==item.id||n.version!==item.version)fail('EVENT_LOG_CORRUPT');
        const prior=notes.get(item.id);
        if(prior&&prior.version+1!==n.version)fail('EVENT_LOG_VERSION_GAP');
        if(!prior&&n.version!==1)fail('EVENT_LOG_VERSION_GAP');
        notes.set(item.id,n);
        if(!history.has(item.id))history.set(item.id,[]);
        history.get(item.id).push({operation:item.action,actor:item.actor,at:item.at,version:n.version,note:copy(n)});
      }else if(item.entity==='GROUP'){
        if(groups.has(item.id))fail('EVENT_LOG_DUPLICATE_GROUP');
        groups.set(item.id,item.payload);
        const bootstrap=item.payload.members||{};
        for(const [memberId,m] of Object.entries(bootstrap))
          members.set(item.id+'|'+memberId,{groupId:item.id,memberId,...m});
      }else{
        const g=item.payload;
        members.set(item.id+'|'+g.memberId,g);
      }
    }
    return {notes,groups,members,operation,history};
  };
  const groupRole=(s,g,a)=>{const m=s.members.get(g+'|'+a);return m?.status==='ACTIVE'?m.role:null};
  const requireAdmin=(s,g,a)=>{if(!s.groups.has(g))fail('GROUP_NOT_FOUND');if(groupRole(s,g,a)!=='ADMIN')fail('FORBIDDEN_ADMIN')};
  const authNote=(s,n,a,mode)=>{
    if(!n||n.deletedAt)fail('NOT_FOUND');
    if(n.scope==='PRIVATE'){if(n.ownerId!==a)fail('FORBIDDEN_PRIVATE');return}
    const r=groupRole(s,n.groupId,a);
    if(!r)fail('FORBIDDEN_SHARED');
    if(mode==='edit'&&!['ADMIN','EDITOR'].includes(r))fail('FORBIDDEN_WRITE');
    if(mode==='delete'&&r!=='ADMIN')fail('FORBIDDEN_DELETE');
  };
  function commit(action,entity,target,operationId,request,execute) {
    const a=actor(),op=opId(operationId),fingerprint=JSON.stringify([action,entity,target,request]);
    return withLock(()=>{
      const s=read(),prior=s.operation.get(a+'|'+op);
      if(prior){
        if(prior.fingerprint!==fingerprint)fail('OPERATION_ID_REUSED');
        if(prior.entity==='NOTE'&&prior.action!=='DELETE')authNote(s,s.notes.get(prior.id),a,'view');
        else if(prior.entity==='NOTE'){
          const n=s.notes.get(prior.id);
          if(n?.scope==='PRIVATE'&&n.ownerId!==a)fail('FORBIDDEN_PRIVATE');
          if(n?.scope==='SHARED'&&!groupRole(s,n.groupId,a))fail('FORBIDDEN_SHARED');
        }else if(prior.entity==='MEMBER')requireAdmin(s,prior.id,a);
        else if(prior.entity==='GROUP'&&!groupRole(s,prior.id,a))fail('FORBIDDEN_SHARED');
        return copy(prior.result);
      }
      const {id:entityId,payload,result,version}=execute(s,a);
      const event={eventId:id(),operationId:op,entity,id:entityId,action,
        actor:a,at:now(),version:version||0,fingerprint,payload:copy(payload),result:copy(result)};
      // Exactly one authoritative append. Errors surface, not marked synced.
      storage.append(event);
      return copy(result);
    });
  }
  const noteInput=(title,content)=>{
    if(typeof title!=='string'||typeof content!=='string'||!content.trim())fail('INVALID_NOTE');
    if(title.length>120||content.length>30000)fail('NOTE_TOO_LARGE');
  };
  function createGroup({operationId,name='共用記事'}={}){
    return commit('CREATE','GROUP','',operationId,[name],(s,a)=>{
      if(typeof name!=='string'||!name.trim()||name.length>120)fail('INVALID_GROUP_NAME');
      const gid=id(),date=now();
      const g={groupId:gid,name,ownerId:a,createdAt:date,members:{[a]:{role:'ADMIN',status:'ACTIVE',joinedAt:date,revokedAt:null}}};
      // GROUP event includes its first ADMIN member in same append.
      return {id:gid,payload:g,result:{groupId:gid,role:'ADMIN'},version:1};
    });
  }
  function setMember({operationId,groupId,memberId,role,status='ACTIVE'}={}){
    return commit('SET_MEMBER','MEMBER',String(groupId),operationId,[String(groupId),memberId,role,status],(s,a)=>{
      const gid=String(groupId);requireAdmin(s,gid,a);
      if(typeof memberId!=='string'||!memberId.trim())fail('INVALID_MEMBER');
      const m=memberId.trim().toLowerCase();
      if(status!=='ACTIVE'&&status!=='REVOKED')fail('INVALID_STATUS');
      if(status==='ACTIVE'&&!['ADMIN','EDITOR','VIEWER'].includes(role))fail('INVALID_ROLE');
      const old=s.members.get(gid+'|'+m);
      // The group creator stays an ADMIN unless a second administrator is appointed.
      const admins=[...s.members.values()].filter(x=>x.groupId===gid&&x.status==='ACTIVE'&&x.role==='ADMIN');
      if(old?.role==='ADMIN'&&old.status==='ACTIVE'&&
          (status==='REVOKED'||role!=='ADMIN')&&admins.length<=1)fail('LAST_ADMIN');
      const date=now();
      const next={groupId:gid,memberId:m,role:status==='ACTIVE'?role:old?.role||'VIEWER',
        status,joinedAt:old?.joinedAt||date,revokedAt:status==='REVOKED'?date:null};
      return {id:gid,payload:next,result:next,version:0};
    });
  }
  function createNote({operationId,scope='PRIVATE',groupId=null,title='',content=''}={}){
    return commit('CREATE','NOTE','',operationId,[scope,groupId,title,content],(s,a)=>{
      noteInput(title,content);
      if(!['PRIVATE','SHARED'].includes(scope))fail('INVALID_SCOPE');
      if(scope==='PRIVATE'&&groupId!=null)fail('PRIVATE_GROUP_NOT_ALLOWED');
      const gid=scope==='SHARED'?String(groupId):null;
      if(scope==='SHARED'&&!['ADMIN','EDITOR'].includes(groupRole(s,gid,a)))fail('FORBIDDEN_WRITE');
      const t=now(),nid=id();
      const note={articleId:nid,scope,ownerId:a,groupId:gid,title,content,createdAt:t,updatedAt:t,updatedBy:a,version:1,deletedAt:null};
      return {id:nid,payload:note,result:note,version:1};
    });
  }
  function updateNote({operationId,articleId,expectedVersion,title,content}={}){
    return commit('UPDATE','NOTE',String(articleId),operationId,[String(articleId),expectedVersion,title,content],(s,a)=>{
      const old=s.notes.get(String(articleId));authNote(s,old,a,'edit');
      if(!Number.isSafeInteger(expectedVersion)||expectedVersion!==old.version)fail('VERSION_CONFLICT');
      noteInput(title,content);
      const next={...old,title,content,updatedAt:now(),updatedBy:a,version:old.version+1};
      return {id:next.articleId,payload:next,result:next,version:next.version};
    });
  }
  function deleteNote({operationId,articleId,expectedVersion}={}){
    return commit('DELETE','NOTE',String(articleId),operationId,[String(articleId),expectedVersion],(s,a)=>{
      const old=s.notes.get(String(articleId));authNote(s,old,a,'delete');
      if(!Number.isSafeInteger(expectedVersion)||expectedVersion!==old.version)fail('VERSION_CONFLICT');
      const stamp=now(),next={...old,updatedAt:stamp,updatedBy:a,deletedAt:stamp,version:old.version+1};
      return {id:next.articleId,payload:next,result:{articleId:next.articleId,deleted:true,version:next.version},version:next.version};
    });
  }
  function listNotes({scope='PRIVATE',groupId=null,query=''}={}){
    const a=actor(),s=read(),q=String(query).toLocaleLowerCase();
    if(!['PRIVATE','SHARED'].includes(scope))fail('INVALID_SCOPE');
    return [...s.notes.values()].filter(n=>{
      if(n.deletedAt||n.scope!==scope)return false;
      if(scope==='PRIVATE'&&n.ownerId!==a)return false;
      if(scope==='SHARED'&&(groupId!=null&&n.groupId!==String(groupId)||!groupRole(s,n.groupId,a)))return false;
      return (n.title+'\n'+n.content).toLocaleLowerCase().includes(q);
    }).sort((x,y)=>y.updatedAt.localeCompare(x.updatedAt)).map(copy);
  }
  function getNote(articleId){const a=actor(),s=read(),n=s.notes.get(String(articleId));authNote(s,n,a,'view');return copy(n)}
  function getHistory(articleId){const a=actor(),s=read(),n=s.notes.get(String(articleId));authNote(s,n,a,'view');return copy(s.history.get(n.articleId)||[])}
  function listMembers(groupId){const a=actor(),s=read(),g=String(groupId);requireAdmin(s,g,a);
    return [...s.members.values()].filter(m=>m.groupId===g).map(copy)}
  function listGroups(){
    const a=actor(),s=read(),visible=[];
    for(const [groupId,g] of s.groups){
      const r=groupRole(s,groupId,a);
      if(r)visible.push({groupId,name:g.name,role:r,createdAt:g.createdAt});
    }
    return visible.map(copy).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
  }
  return Object.freeze({createGroup,setMember,createNote,updateNote,deleteNote,listNotes,getNote,getHistory,listMembers,listGroups});
}
if(typeof module!=='undefined')module.exports={createEventService};
