'use strict';
/*
 * iPhone outbox proof. Browser localStorage key is intentionally NOT hardcoded here.
 * Callers must keep this separate from legacy hongbin_crm_quick_notes_r73.
 * No item is "SYNCED" until remote writes acknowledge success.
 */
function createOfflineOutbox({load,save,send,newId,clock=()=>new Date().toISOString()}){
 if(typeof load!=='function'||typeof save!=='function'||typeof send!=='function'||
    typeof newId!=='function')throw Error('OUTBOX_DEPENDENCIES_REQUIRED');
 const clone=x=>JSON.parse(JSON.stringify(x));
 function all(){const v=load();if(!Array.isArray(v))throw Error('OUTBOX_CORRUPT');return clone(v)}
 function persist(v){save(clone(v))}
 const kindAllowed=['CREATE_NOTE','UPDATE_NOTE','DELETE_NOTE'];
 function validateAction(action,args){
  if(!kindAllowed.includes(action))throw Error('INVALID_OUTBOX_ACTION');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('INVALID_OUTBOX_ARGUMENTS');
  if(action!=='CREATE_NOTE'&&(!args.articleId||!Number.isSafeInteger(args.expectedVersion)||
    args.expectedVersion<=0))throw Error('INVALID_OUTBOX_VERSION');
  if(action!=='DELETE_NOTE'&&
    (typeof args.content!=='string'||!args.content.trim()||args.content.length>30000||
     typeof (args.title??'')!=='string'||(args.title||'').length>120))
     throw Error('INVALID_OUTBOX_CONTENT');
  if(action==='CREATE_NOTE'&&(!['PRIVATE','SHARED'].includes(args.scope)||
    args.scope==='PRIVATE'&&args.groupId!=null))throw Error('INVALID_OUTBOX_SCOPE');
 }
 function enqueue(action,args){
  validateAction(action,args);
  const id=newId();
  if(typeof id!=='string'||!/^[-a-zA-Z0-9_:]{8,128}$/.test(id))throw Error('INVALID_OUTBOX_ID');
  // Remove untrusted claims; the server must derive actor from verified Google session.
  const {actor,ownerId,updatedBy,memberId,role,...data}=args;
  const item={operationId:id,action,args:data,status:'PENDING',createdAt:clock(),
    attempts:0,lastError:null,result:null};
  const rows=all();
  if(rows.some(x=>x.operationId===id))throw Error('DUPLICATE_OUTBOX_ID');
  rows.push(item);persist(rows);return clone(item);
 }
 function getQueue(){return all()}
 async function retryOne(operationId){
  const list=all(),idx=list.findIndex(x=>x.operationId===operationId);
  if(idx<0)throw Error('UNKNOWN_OUTBOX_ID');
  const item=list[idx];
  if(item.status==='SYNCED')return clone(item);
  if(item.status==='CONFLICT')throw Error('USER_RESOLUTION_REQUIRED');
  if(!['PENDING','FAILED','SYNCING'].includes(item.status))throw Error('UNKNOWN_OUTBOX_STATUS');
  item.status='SYNCING';item.attempts=(item.attempts||0)+1;item.lastError=null;persist(list);
  try{
   const result=await send(item.action,{...clone(item.args),operationId:item.operationId});
   if(!result||typeof result!=='object')throw Error('REMOTE_ACK_MISSING');
   item.result=clone(result);item.status='SYNCED';item.lastError=null;
  }catch(e){
   item.status=e?.message==='VERSION_CONFLICT'?'CONFLICT':'FAILED';
   item.lastError=String(e?.message||'SYNC_FAILED').slice(0,200);
  }
  persist(list);return clone(item);
 }
 async function flush(){
  const ids=all().filter(x=>['PENDING','FAILED','SYNCING'].includes(x.status))
    .map(x=>x.operationId);
  for(const id of ids)await retryOne(id);
  return all().map(x=>({operationId:x.operationId,status:x.status,lastError:x.lastError}));
 }
 function resolveConflict(originalId,changes){
  const list=all(),old=list.find(x=>x.operationId===originalId);
  if(!old||old.status!=='CONFLICT')throw Error('NO_CONFLICT_TO_RESOLVE');
  if(old.action==='DELETE_NOTE')throw Error('DELETE_CONFLICT_REQUIRES_REVIEW');
  if(!Number.isSafeInteger(changes?.expectedVersion)||changes.expectedVersion<=0)
    throw Error('EXPLICIT_NEW_VERSION_REQUIRED');
  // Preserve the conflicting draft and use a DIFFERENT operation ID.
  return enqueue(old.action,{...old.args,...changes});
 }
 return Object.freeze({enqueue,getQueue,retryOne,flush,resolveConflict});
}
function previewLegacyNotes(value){
 if(!Array.isArray(value))throw Error('LEGACY_NOTES_FORMAT_UNEXPECTED');
 return {count:value.length,entries:value.map((n,i)=>{
  if(!n||typeof n.content!=='string'||typeof(n.id)!=='number'&&typeof(n.id)!=='string')
   throw Error('LEGACY_NOTE_INVALID_'+i);
  const title=String(n.title||'').trim();
  return {localId:String(n.id),title:title||n.content.trim().slice(0,42),
   excerpt:n.content.trim().slice(0,100),createdAt:n.createdAt||null};
 })};
}
if(typeof module!=='undefined')module.exports={createOfflineOutbox,previewLegacyNotes};
