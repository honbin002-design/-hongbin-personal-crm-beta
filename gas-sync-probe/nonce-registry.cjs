'use strict';
/*
 * GAS data-owner nonce registry. Must be used only within Script B and not exposed.
 * Stores only HMAC-authenticated actor+nonce and expiry, never OAuth credentials.
 * LockService serializes check-and-append. If Sheets fails: fail closed.
 * Retired nonces are deletable only after their expiration + 60 seconds.
 */
const HONBIN_NONCES_HEADER=['nonceKey','expiresAt'];
function createSheetsNonceRegistry({SpreadsheetApp,PropertiesService,LockService,clock=()=>Date.now()}){
 if(!SpreadsheetApp||!PropertiesService||!LockService)throw Error('GAS_SERVICES_REQUIRED');
 const id=String(PropertiesService.getScriptProperties().getProperty('HONBIN_NOTES_SPREADSHEET_ID')||'');
 if(!id)throw Error('BACKEND_SPREADSHEET_NOT_CONFIGURED');
 const worksheet=()=>{
  const ws=SpreadsheetApp.openById(id).getSheetByName('UsedNonces');
  if(!ws)throw Error('NONCE_WORKSHEET_MISSING');
  const head=ws.getRange(1,1,1,2).getValues()[0];
  if(head.join('\0')!==HONBIN_NONCES_HEADER.join('\0'))throw Error('NONCE_HEADER_MISMATCH');
  return ws;
 };
 return Object.freeze({consumeOnce(key,expiresAt){
  if(typeof key!=='string'||key.length<16||key.length>400||
     !Number.isSafeInteger(expiresAt))throw Error('INVALID_NONCE');
  const now=clock();
  if(expiresAt<=now||expiresAt>now+180000)throw Error('NONCE_EXPIRATION_INVALID');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))throw Error('NONCE_LOCK_BUSY');
  try{
   const ws=worksheet(),count=ws.getLastRow()-1;
   if(count>20000)throw Error('NONCE_LOG_REQUIRES_MAINTENANCE');
   if(count>0){
    const rows=ws.getRange(2,1,count,2).getValues();
    for(let i=0;i<rows.length;i++){
     if(rows[i][0]===key)return false;
     if(typeof rows[i][0]!=='string'||!Number.isFinite(Number(rows[i][1])))
       throw Error('NONCE_LOG_CORRUPT');
    }
    // Delete only safely expired nonces; reverse order preserves row numbers.
    // No bulk clear/rewrite: that could drop still-live nonces on partial failure.
    let removed=0;
    for(let i=rows.length-1;i>=0&&removed<100;i--){
      if(Number(rows[i][1])<now-60000){ws.deleteRow(i+2);removed++}
    }
   }
   ws.getRange(ws.getLastRow()+1,1,1,2).setValues([[key,expiresAt]]);
   return true;
  }finally{lock.releaseLock()}
 }});
}
if(typeof module!=='undefined')module.exports={createSheetsNonceRegistry,HONBIN_NONCES_HEADER};
