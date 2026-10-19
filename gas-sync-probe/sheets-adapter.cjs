'use strict';
/*
 * Google Apps Script Sheets EVENT adapter for isolated prototype ONLY.
 * Uses ONE authoritative append-only row per mutation under ScriptLock.
 * External backend must verify user identity BEFORE calling the event service.
 * No spreadsheet sharing, publishing or creation is performed here.
 * IMPORTANT: SpreadsheetApp append is not an ACID transaction guarantee.
 */
const HONBIN_EVENTS_HEADER=[
  'eventId','operationId','actor','entity','id','action','at','version','fingerprint','payload','result'
];
function createSheetsEventAdapter({SpreadsheetApp,LockService,PropertiesService}) {
  if(!SpreadsheetApp||!LockService||!PropertiesService)throw Error('GAS_SERVICES_REQUIRED');
  const prop=PropertiesService.getScriptProperties();
  const id=String(prop.getProperty('HONBIN_NOTES_SPREADSHEET_ID')||'').trim();
  if(!id)throw Error('BACKEND_SPREADSHEET_NOT_CONFIGURED');
  const sheet=()=>{
    const book=SpreadsheetApp.openById(id);
    const ws=book.getSheetByName('Events');
    if(!ws)throw Error('EVENTS_WORKSHEET_MISSING');
    const values=ws.getRange(1,1,1,HONBIN_EVENTS_HEADER.length).getValues()[0];
    if(values.join('\x1f')!==HONBIN_EVENTS_HEADER.join('\x1f'))
      throw Error('EVENTS_HEADER_MISMATCH');
    return ws;
  };
  function read() {
    const ws=sheet(),count=ws.getLastRow()-1;
    if(count<=0)return [];
    if(count>15000)throw Error('EVENT_LOG_REQUIRES_ARCHIVE');
    const rows=ws.getRange(2,1,count,HONBIN_EVENTS_HEADER.length).getValues();
    return rows.map((r,index)=>{
      try{
        if(!r[0]||!r[1]||!r[2]||!r[3]||!r[4])throw Error('incomplete row');
        const [eventId,operationId,actor,entity,id,action,at,version,fingerprint,payload,result]=r;
        const v={eventId:String(eventId),operationId:String(operationId),actor:String(actor),
          entity:String(entity),id:String(id),action:String(action),at:String(at),
          version:Number(version),fingerprint:String(fingerprint),
          payload:JSON.parse(String(payload)),result:JSON.parse(String(result))};
        if(!Number.isSafeInteger(v.version)||v.version<0)throw Error('bad version');
        return v;
      }catch{throw Error('EVENT_ROW_INVALID_'+(index+2))}
    });
  }
  function append(e) {
    if(!e||!['NOTE','GROUP','MEMBER'].includes(e.entity))throw Error('INVALID_EVENT');
    const ws=sheet(),last=ws.getLastRow();
    if(last>15000)throw Error('EVENT_LOG_REQUIRES_ARCHIVE');
    const r=[e.eventId,e.operationId,e.actor,e.entity,e.id,e.action,e.at,
      e.version,e.fingerprint,JSON.stringify(e.payload),JSON.stringify(e.result)];
    if(r.some(v=>v===undefined))throw Error('INVALID_EVENT');
    // Single setValues call, no multi-table partial commit by this adapter.
    ws.getRange(last+1,1,1,r.length).setValues([r]);
  }
  function withLock(fn) {
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(20000))throw Error('SYNC_LOCK_BUSY');
    try{return fn()}finally{lock.releaseLock()}
  }
  return Object.freeze({storage:{read,append},withLock});
}
if(typeof module!=='undefined')module.exports={createSheetsEventAdapter,HONBIN_EVENTS_HEADER};
