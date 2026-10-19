'use strict';
/*
 * Script B: data-owner ONLY. OFFLINE TEMPLATE — NOT DEPLOYED.
 * doPost is the sole public entry. Anonymous incoming calls are ONLY processed
 * after HMAC verification, time bounds and a durable replay check.
 * Before live use: prove Apps Script A's Google identity in real account,
 * restrict project editor access, protect both Script Properties stores.
 */
function doGet() {
 return ContentService.createTextOutput('HONBIN NOTES DATA API — REQUEST DENIED');
}
function doPost(e) {
 var safeErrors=['SYNC_TEST_NOT_ENABLED','INVALID_AUTH_ENVELOPE','UNVERIFIED_IDENTITY','UNSUPPORTED_ACTION',
   'INVALID_AUTH_TIME','INVALID_AUTH_NONCE','INVALID_AUTH_PARAMS','AUTH_PAYLOAD_TOO_LARGE',
   'AUTH_BACKEND_NOT_CONFIGURED','INVALID_SIGNATURE','EXPIRED_REQUEST','REPLAYED_REQUEST',
   'NONCE_LOCK_BUSY','NONCE_REGISTRY_UNAVAILABLE','NONCE_LOG_REQUIRES_MAINTENANCE',
   'BACKEND_SPREADSHEET_NOT_CONFIGURED','FORBIDDEN_PRIVATE','FORBIDDEN_SHARED',
   'FORBIDDEN_WRITE','FORBIDDEN_DELETE','FORBIDDEN_ADMIN','GROUP_NOT_FOUND',
   'LAST_ADMIN','NOT_FOUND','VERSION_CONFLICT','OPERATION_ID_REUSED',
   'INVALID_NOTE','NOTE_TOO_LARGE','SYNC_LOCK_BUSY','EVENTS_HEADER_MISMATCH'];
 try{
  if(!e||!e.postData||typeof e.postData.contents!=='string'||
    e.postData.contents.length>45000)throw Error('INVALID_AUTH_ENVELOPE');
  var envelope;
  try{envelope=JSON.parse(e.postData.contents);}catch(err){throw Error('INVALID_AUTH_ENVELOPE');}
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('HONBIN_NOTES_TEST_GATE')!=='ISOLATED_TEST_APPROVED')
    throw Error('SYNC_TEST_NOT_ENABLED');
  var secret=props.getProperty('HONBIN_NOTES_INTERNAL_SECRET');
  var verifier=GASBoundary_.createServerSideVerifier({
    secret:secret,hmac:gasHmacSha256Base64Url_,
    clock:function(){return Date.now();},
    nonceRegistry:GASNonceRegistry_.createSheetsNonceRegistry({
      SpreadsheetApp:SpreadsheetApp,PropertiesService:PropertiesService,
      LockService:LockService,clock:function(){return Date.now();}
    })
  });
  var handler=GASBoundary_.createAuthorizedDispatcher({
    verify:verifier,
    serviceForActor:function(identity){
      var adapter=GASSheetsAdapter_.createSheetsEventAdapter({
        SpreadsheetApp:SpreadsheetApp,LockService:LockService,
        PropertiesService:PropertiesService
      });
      return GASEventService_.createEventService({
        identity:identity,storage:adapter.storage,withLock:adapter.withLock,
        clock:function(){return new Date().toISOString();},
        newId:function(){return Utilities.getUuid();}
      });
    }
  });
  var result=handler(envelope);
  return gasReplyJson_({ok:true,data:result});
 }catch(error){
  var code=error&&typeof error.message==='string'?error.message:'REMOTE_REQUEST_FAILED';
  if(!safeErrors.includes(code))code='REMOTE_REQUEST_FAILED';
  return gasReplyJson_({ok:false,error:code});
 }
}
function gasHmacSha256Base64Url_(secret,base) {
 var bytes=Utilities.computeHmacSha256Signature(base,secret,Utilities.Charset.UTF_8);
 return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}
function gasReplyJson_(payload){
 return ContentService.createTextOutput(JSON.stringify(payload))
   .setMimeType(ContentService.MimeType.JSON);
}
