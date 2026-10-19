'use strict';
const assert=require('node:assert/strict');
const {createSheetsEventAdapter,HONBIN_EVENTS_HEADER}=require('./sheets-adapter.cjs');
const {createEventService}=require('./event-service.cjs');
let passed=0,locked=false,denyLock=false,brokenHeader=false,writeError=false,failExpand=false,maxRows=2,uid=0,actor='alice@example.test';
const rows=[HONBIN_EVENTS_HEADER.slice()];
const tab={
 getLastRow(){return rows.length},
 getMaxRows(){return maxRows},
 insertRowsAfter(index,howMany){
  if(failExpand)throw Error('SIMULATED_EXPANSION_FAILURE');
  assert.equal(index,maxRows);
  assert.ok(howMany>=1);
  maxRows+=howMany;
 },
 getRange(row,col,height,width){
   assert.equal(col,1);assert.equal(width,HONBIN_EVENTS_HEADER.length);
   return {
    getValues(){
      const part=rows.slice(row-1,row-1+height).map(r=>r.slice(0,width));
      if(brokenHeader&&row===1)part[0][0]='corrupt';
      return part;
    },
    setValues(values){
      if(writeError)throw Error('SIMULATED_SHEETS_OUTAGE');
      assert.equal(values.length,1);assert.equal(values[0].length,width);
      if(row!==rows.length+1)throw Error('BAD_APPEND_ROW');
      if(row>maxRows)throw Error('SHEETS_GRID_OUT_OF_RANGE');
      rows.push(JSON.parse(JSON.stringify(values[0])));
    }
   };
 }
};
const deps={
 SpreadsheetApp:{openById:id=>{assert.equal(id,'synthetic-spreadsheet-id');return {getSheetByName:name=>name==='Events'?tab:null}}},
 LockService:{getScriptLock:()=>({tryLock(){if(denyLock||locked)return false;locked=true;return true},releaseLock(){locked=false}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='HONBIN_NOTES_SPREADSHEET_ID'?'synthetic-spreadsheet-id':null})}
};
const adapters=()=>createSheetsEventAdapter(deps);
const opts=()=>{const a=adapters();return {identity:()=>actor,storage:a.storage,withLock:a.withLock,
 newId:()=>('uuid-test-'+(++uid).toString(36).padStart(8,'0')),
 clock:()=>new Date(Date.UTC(2026,9,19,12,0,uid)).toISOString()}};
let a=createEventService(opts()),b=createEventService(opts());
function as(email,fn){actor=email;return fn()}
function test(name,fn){fn();passed++;console.log('PASS: '+name)}
function throws(message,fn){assert.throws(fn,e=>e.message===message,message)}
const A='alice@example.test',B='bob@example.test';
test('Unset Sheets ID refuses initialization',()=>{
 throws('BACKEND_SPREADSHEET_NOT_CONFIGURED',()=>createSheetsEventAdapter({
  ...deps,PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})}}));
});
test('A single authorized append creates exact one event row',()=>{
 const note=as(A,()=>a.createNote({operationId:'createAlpha0001',title:'重要',content:'記住客戶'}));
 assert.equal(note.ownerId,A);assert.equal(rows.length,2);
 assert.equal(rows[1][3],'NOTE');assert.equal(rows[1][9].includes('客戶'),true);
});
test('Second service reads persisted event without cached state',()=>{
 const out=as(A,()=>b.listNotes());
 assert.equal(out.length,1);assert.equal(out[0].title,'重要');
});
test('Non-owner cannot access data even with correct articleId',()=>{
 const note=as(A,()=>a.listNotes())[0];
 throws('FORBIDDEN_PRIVATE',()=>as(B,()=>b.getNote(note.articleId)));
});
test('Lock prevents writes before version check',()=>{
 denyLock=true;const note=as(A,()=>a.listNotes())[0];const before=rows.length;
 try{throws('SYNC_LOCK_BUSY',()=>as(A,()=>a.updateNote({operationId:'lockedEdit0001',articleId:note.articleId,
  expectedVersion:1,title:'x',content:'blocked'})))}finally{denyLock=false}
 assert.equal(rows.length,before);
});
test('Sheet write errors do not commit partial data',()=>{
 writeError=true;const note=as(A,()=>a.listNotes())[0],before=rows.length;
 try{throws('SIMULATED_SHEETS_OUTAGE',()=>as(A,()=>a.updateNote({operationId:'outageEdit0001',
  articleId:note.articleId,expectedVersion:1,title:'x',content:'blocked'})))}finally{writeError=false}
 assert.equal(rows.length,before);assert.equal(locked,false);
});
test('Retry after outage succeeds once',()=>{
 const note=as(A,()=>a.listNotes())[0];
 const done=as(A,()=>b.updateNote({operationId:'outageEdit0001',
  articleId:note.articleId,expectedVersion:1,title:'x',content:'saved'}));
 assert.equal(done.version,2);assert.equal(rows.length,3);
});
test('A stale second phone is rejected',()=>{
 const note=as(A,()=>a.listNotes())[0];
 throws('VERSION_CONFLICT',()=>as(A,()=>a.updateNote({operationId:'staleEdit00001',
 articleId:note.articleId,expectedVersion:1,title:'x',content:'overwrite'})));
 assert.equal(rows.length,3);
});
test('Retry same request cannot double-write',()=>{
 const note=as(A,()=>a.listNotes())[0],before=rows.length;
 const done=as(A,()=>a.updateNote({operationId:'outageEdit0001',articleId:note.articleId,expectedVersion:1,
  title:'x',content:'saved'}));
 assert.equal(done.version,2);assert.equal(rows.length,before);
});
test('Unexpected spreadsheet header fails closed',()=>{
 brokenHeader=true;
 try{throws('EVENTS_HEADER_MISMATCH',()=>as(A,()=>a.listNotes()))}finally{brokenHeader=false}
});
test('Corrupted JSON row fails closed without private leak',()=>{
 const old=rows[1][9];rows[1][9]='not-json';
 try{throws('EVENT_ROW_INVALID_2',()=>as(A,()=>a.listNotes()))}finally{rows[1][9]=old}
});
test('Read replay survives new instance',()=>{
 b=createEventService(opts());assert.equal(as(A,()=>b.getHistory(as(A,()=>a.listNotes())[0].articleId)).length,2);
});
test('Events tab automatically expands beyond initial grid size',()=>{
 assert.ok(maxRows>2);
 assert.equal(rows.length,3);
});
test('Expansion failure does not create a partial note or acknowledge success',()=>{
 const before=rows.length,old=maxRows;maxRows=rows.length;failExpand=true;
 const note=as(A,()=>a.listNotes())[0];
 try{throws('SIMULATED_EXPANSION_FAILURE',()=>as(A,()=>a.updateNote({
  operationId:'expansionFail01',articleId:note.articleId,
  expectedVersion:2,title:'blocked',content:'not saved'
 })))}finally{failExpand=false;maxRows=old}
 assert.equal(rows.length,before);
 assert.equal(as(A,()=>a.getNote(note.articleId)).version,2);
});
test('Expansion failure retry safely commits one new event',()=>{
 const note=as(A,()=>a.listNotes())[0],before=rows.length;
 const updated=as(A,()=>a.updateNote({operationId:'expansionFail01',
  articleId:note.articleId,expectedVersion:2,title:'saved',content:'after expansion'}));
 assert.equal(updated.version,3);assert.equal(rows.length,before+1);
});
console.log('GAS SHEETS ADAPTER UNIT PASS',passed);
