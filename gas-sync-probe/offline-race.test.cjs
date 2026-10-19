'use strict';
const assert=require('node:assert/strict');
const {createOfflineOutbox}=require('./offline-outbox.cjs');
let rows=[],calls=0,resolveFirst,serial=0;
const api=createOfflineOutbox({
 load:()=>JSON.parse(JSON.stringify(rows)),
 save:value=>{rows=JSON.parse(JSON.stringify(value))},
 send:()=>{calls++;return new Promise(resolve=>{resolveFirst=resolve})},
 newId:()=>('pending-unique-'+String(++serial).padStart(8,'0'))
});
(async function(){
 const first=api.enqueue('CREATE_NOTE',{scope:'PRIVATE',content:'draft1'});
 const one=api.retryOne(first.operationId);
 const two=api.retryOne(first.operationId);
 assert.equal(one,two,'Same operation must share one in-flight Promise');
 assert.equal(calls,1);
 const addedDuringFetch=api.enqueue('CREATE_NOTE',{scope:'PRIVATE',content:'draft2'});
 resolveFirst({articleId:'cloud-1',version:1});
 const confirmed=await one;
 assert.equal(confirmed.status,'SYNCED');
 assert.equal(rows.length,2,'Must not lose the newly added draft');
 assert.equal(rows[1].operationId,addedDuringFetch.operationId);
 assert.equal(rows[1].status,'PENDING');
 console.log('PASS: Concurrent retry deduplicated; late ACK keeps new draft');
 const after=await api.retryOne(first.operationId);
 assert.equal(after.status,'SYNCED');
 assert.equal(calls,1);
 console.log('PASS: Synced operation stays idempotent');
 console.log('OUTBOX IN-FLIGHT REGRESSION PASS 2');
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
