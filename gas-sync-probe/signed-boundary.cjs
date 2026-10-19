'use strict';
/*
 * Script A (execute as user) -> Script B (data owner) signed request boundary.
 * OFFLINE PROTOTYPE. NEVER expose secret or hmacSign() through a client API.
 * A MUST obtain actor from Google Session on the server, and fail closed if blank.
 * B MUST hold its own same shared secret in private Script Properties.
 * B MUST use a durable, atomic nonce registry; CacheService alone is inadequate.
 * Only whitelisted operations may cross the boundary.
 */
const HONBIN_NOTE_ACTIONS=Object.freeze([
 'CREATE_GROUP','SET_MEMBER','LIST_MEMBERS','CREATE_NOTE','UPDATE_NOTE',
 'DELETE_NOTE','LIST_NOTES','GET_NOTE','GET_HISTORY'
]);
function safeEqual(x,y){
 if(typeof x!=='string'||typeof y!=='string')return false;
 let difference=x.length^y.length;
 const n=Math.max(x.length,y.length);
 for(let i=0;i<n;i++)difference|=(x.charCodeAt(i)||0)^(y.charCodeAt(i)||0);
 return difference===0;
}
function buildSignatureBase(request){
 return JSON.stringify([1,request.actor,request.action,request.issuedAt,request.nonce,request.params]);
}
function validateRequestShape(r){
 if(!r||typeof r!=='object'||Array.isArray(r))throw Error('INVALID_AUTH_ENVELOPE');
 if(typeof r.actor!=='string'||!r.actor.trim()||r.actor!==r.actor.trim().toLowerCase()||
    r.actor.length>256)throw Error('UNVERIFIED_IDENTITY');
 if(!HONBIN_NOTE_ACTIONS.includes(r.action))throw Error('UNSUPPORTED_ACTION');
 if(!Number.isSafeInteger(r.issuedAt)||r.issuedAt<=0)throw Error('INVALID_AUTH_TIME');
 if(typeof r.nonce!=='string'||!/^[-a-zA-Z0-9_:]{16,128}$/.test(r.nonce))
   throw Error('INVALID_AUTH_NONCE');
 if(!r.params||typeof r.params!=='object'||Array.isArray(r.params))throw Error('INVALID_AUTH_PARAMS');
 if(JSON.stringify(r.params).length>40000)throw Error('AUTH_PAYLOAD_TOO_LARGE');
}
function validateConfig({secret,hmac}={}){
 if(typeof secret!=='string'||secret.length<32||typeof hmac!=='function')throw Error('AUTH_BACKEND_NOT_CONFIGURED');
}
function createServerSideSigner({identity,secret,hmac,clock=()=>Date.now(),nonce}){
 validateConfig({secret,hmac});
 if(typeof identity!=='function'||typeof nonce!=='function')throw Error('TRUSTED_SIGNER_REQUIRED');
 return function signRequest(action,params={}){
   const current=identity(); // Google Session.getActiveUser().getEmail(), NEVER from params
   if(typeof current!=='string'||!current.trim())throw Error('UNVERIFIED_IDENTITY');
   const request={actor:current.trim().toLowerCase(),action,issuedAt:clock(),nonce:nonce(),params};
   validateRequestShape(request);
   const signature=hmac(secret,buildSignatureBase(request));
   if(typeof signature!=='string'||!signature)throw Error('SIGNATURE_FAILED');
   return {...request,signature};
 };
}
function createServerSideVerifier({secret,hmac,clock=()=>Date.now(),nonceRegistry}){
 validateConfig({secret,hmac});
 if(!nonceRegistry||typeof nonceRegistry.consumeOnce!=='function')throw Error('DURABLE_NONCE_STORE_REQUIRED');
 return function verify(envelope){
   validateRequestShape(envelope);
   if(typeof envelope.signature!=='string')throw Error('INVALID_SIGNATURE');
   const elapsed=clock()-envelope.issuedAt;
   if(!Number.isFinite(elapsed)||elapsed< -30000||elapsed>120000)throw Error('EXPIRED_REQUEST');
   const expected=hmac(secret,buildSignatureBase(envelope));
   if(!safeEqual(expected,envelope.signature))throw Error('INVALID_SIGNATURE');
   // B records the nonce before executing a request. A retry signs a new nonce
   // while retaining the original operationId for idempotent mutation replay.
   if(!nonceRegistry.consumeOnce(envelope.actor+'|'+envelope.nonce,envelope.issuedAt+150000))
      throw Error('REPLAYED_REQUEST');
   return Object.freeze({actor:envelope.actor,action:envelope.action,params:JSON.parse(JSON.stringify(envelope.params))});
 };
}
function createAuthorizedDispatcher({verify,serviceForActor}){
 if(typeof verify!=='function'||typeof serviceForActor!=='function')throw Error('VERIFIED_DISPATCH_REQUIRED');
 const endpoints={
  CREATE_GROUP:(s,p)=>s.createGroup(p),
  SET_MEMBER:(s,p)=>s.setMember(p),
  LIST_MEMBERS:(s,p)=>s.listMembers(p.groupId),
  CREATE_NOTE:(s,p)=>s.createNote(p),
  UPDATE_NOTE:(s,p)=>s.updateNote(p),
  DELETE_NOTE:(s,p)=>s.deleteNote(p),
  LIST_NOTES:(s,p)=>s.listNotes(p),
  GET_NOTE:(s,p)=>s.getNote(p.articleId),
  GET_HISTORY:(s,p)=>s.getHistory(p.articleId)
 };
 return function dispatch(envelope){
   const v=verify(envelope);const handler=endpoints[v.action];
   if(!handler)throw Error('UNSUPPORTED_ACTION');
   const service=serviceForActor(()=>v.actor); // only after HMAC + freshness + nonce verification
   return handler(service,v.params);
 };
}
if(typeof module!=='undefined')module.exports={
 HONBIN_NOTE_ACTIONS,buildSignatureBase,createServerSideSigner,createServerSideVerifier,createAuthorizedDispatcher
};
