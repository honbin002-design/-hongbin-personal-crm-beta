'use strict';
/*
 * Script A: Google-signed-in-user entry. OFFLINE TEMPLATE — NOT DEPLOYED.
 * Deploy "execute as user accessing the web app" and reject empty Session email.
 * ONLY gasNoteCall() is reachable from google.script.run; NEVER return internal secret.
 * Google Apps Script API access, live identity availability and OAuth still BLOCKED.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('鴻繽科技 CRM｜獨立同步記事測試');
}
function gasNoteCall(action,params) {
  var account=Session.getActiveUser().getEmail();
  if(typeof account!=='string'||!account.trim())throw Error('GOOGLE_IDENTITY_UNAVAILABLE');
  if(!HONBIN_NOTE_ACTIONS.includes(action))throw Error('UNSUPPORTED_ACTION');
  var props=PropertiesService.getScriptProperties();
  var endpoint=props.getProperty('HONBIN_NOTES_BACKEND_URL');
  var secret=props.getProperty('HONBIN_NOTES_INTERNAL_SECRET');
  if(!endpoint||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint))
    throw Error('BACKEND_URL_NOT_CONFIGURED');
  var signer=createServerSideSigner({
    identity:function(){return account;},
    secret:secret,
    hmac:gasHmacSha256Base64Url_,
    clock:function(){return Date.now();},
    nonce:function(){return Utilities.getUuid();}
  });
  var request=signer(action,params||{});
  var response=UrlFetchApp.fetch(endpoint,{
    method:'post',contentType:'application/json',payload:JSON.stringify(request),
    muteHttpExceptions:true,followRedirects:true
  });
  if(response.getResponseCode()!==200)throw Error('REMOTE_SERVICE_UNAVAILABLE');
  var raw=response.getContentText();
  if(typeof raw!=='string'||raw.length>150000)throw Error('INVALID_BACKEND_RESPONSE');
  var parsed;
  try{parsed=JSON.parse(raw);}catch(err){throw Error('INVALID_BACKEND_RESPONSE');}
  if(!parsed||parsed.ok!==true){
    var code=parsed&&typeof parsed.error==='string'?parsed.error:'REMOTE_REQUEST_FAILED';
    var allow=['UNVERIFIED_IDENTITY','FORBIDDEN_PRIVATE','FORBIDDEN_SHARED',
      'FORBIDDEN_ADMIN','FORBIDDEN_WRITE','FORBIDDEN_DELETE','VERSION_CONFLICT',
      'INVALID_NOTE','INVALID_SCOPE','NOT_FOUND','SYNC_LOCK_BUSY',
      'BACKEND_SPREADSHEET_NOT_CONFIGURED','REMOTE_REQUEST_FAILED'];
    throw Error(allow.includes(code)?code:'REMOTE_REQUEST_FAILED');
  }
  return parsed.data;
}
function gasHmacSha256Base64Url_(secret,base) {
  var bytes=Utilities.computeHmacSha256Signature(base,secret,Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}
