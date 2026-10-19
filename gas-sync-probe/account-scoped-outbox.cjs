'use strict';
/*
 * Offline drafts are separated by the Google identity verified by Script A.
 * This is a client DATA-SAFETY guard, NOT a security boundary. The backend
 * still authorizes all requests against Google-verifiable identity.
 * NEVER initialize from a username supplied by a text field or localStorage.
 * To write while offline, retain a previously verified account within the
 * current app session; re-verify before ANY queued network send.
 * Legacy R73 note storage is never accessed here.
 */
function createAccountScopedOutbox({readKey,writeKey,verifiedAccount,send,newId,digest,
 clock=()=>new Date().toISOString()}={}){
 if([readKey,writeKey,verifiedAccount,send,newId,digest].some(f=>typeof f!=='function'))
  throw Error('ACCOUNT_OUTBOX_DEPENDENCIES_REQUIRED');
 const PREFIX='honbin_crm_sync_outbox_v1_';
 const validate=a=>{
  if(typeof a!=='string'||!a.trim()||!a.includes('@')||a.length>256)throw Error('ACCOUNT_NOT_VERIFIED');
  return a.trim().toLowerCase();
 };
 const keyFor=a=>{
  const hash=digest(validate(a));
  if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))throw Error('ACCOUNT_HASH_INVALID');
  return PREFIX+hash;
 };
 const keyText=a=>readKey(keyFor(a));
 const decode=a=>{
  const raw=keyText(a);
  if(raw==null||raw==='')return [];
  try{
   const data=JSON.parse(raw);
   if(!Array.isArray(data))throw Error();
   if(data.some(n=>n.accountHash!==digest(a)))throw Error();
   return data;
  }catch{throw Error('ACCOUNT_OUTBOX_CORRUPT')}
 };
 let pinned=null,rawOutbox=null,busy=false;
 async function authenticate(){
  const email=validate(await verifiedAccount()); // Script A must get Session.getActiveUser().getEmail()
  if(pinned&&email!==pinned)throw Error('GOOGLE_ACCOUNT_SWITCHED');
  if(!pinned)pinned=email;
  return email;
 }
 function start(account){
  const {createOfflineOutbox}=typeof module!=='undefined'
   ?require('./offline-outbox.cjs') : GASOfflineOutbox_;
  return createOfflineOutbox({
   load:()=>decode(account),
   save:rows=>{
    if(pinned!==account)throw Error('GOOGLE_ACCOUNT_SWITCHED');
    const safe=rows.map(n=>({...n,accountHash:digest(account)}));
    writeKey(keyFor(account),JSON.stringify(safe));
   },
   send:async(action,args)=>{
    // Revalidate Google session before EACH network mutation, not merely when queued.
    const active=validate(await verifiedAccount());
    if(active!==account)throw Error('GOOGLE_ACCOUNT_SWITCHED');
    return send(action,args);
   },
   newId,clock
  });
 }
 async function open(){
  const account=await authenticate();
  if(!rawOutbox)rawOutbox=start(account);
  return {
   account,
   key:keyFor(account), // local storage partition identifier, NOT secret
   queue:rawOutbox.getQueue()
  };
 }
 function queue(action,args){
  if(!pinned||!rawOutbox)throw Error('GOOGLE_ACCOUNT_NOT_INITIALIZED');
  if(busy)throw Error('ACCOUNT_REVALIDATION_IN_PROGRESS');
  return rawOutbox.enqueue(action,args);
 }
 async function flush(){
  if(!pinned||!rawOutbox)throw Error('GOOGLE_ACCOUNT_NOT_INITIALIZED');
  if(busy)throw Error('ACCOUNT_REVALIDATION_IN_PROGRESS');
  busy=true;
  try{
   const active=validate(await verifiedAccount());
   if(active!==pinned)throw Error('GOOGLE_ACCOUNT_SWITCHED');
   return await rawOutbox.flush();
  }finally{busy=false}
 }
 function getQueue(){
  if(!pinned||!rawOutbox)throw Error('GOOGLE_ACCOUNT_NOT_INITIALIZED');
  return rawOutbox.getQueue();
 }
 function reset(){
  if(busy)throw Error('ACCOUNT_REVALIDATION_IN_PROGRESS');
  pinned=null;rawOutbox=null;
  // Never delete existing account's drafts. User may log back in.
 }
 return Object.freeze({open,queue,flush,getQueue,reset});
}
if(typeof module!=='undefined')module.exports={createAccountScopedOutbox};
