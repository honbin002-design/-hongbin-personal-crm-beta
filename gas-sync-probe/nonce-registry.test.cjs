'use strict';
const assert=require('node:assert/strict');
const {createSheetsNonceRegistry,HONBIN_NONCES_HEADER}=require('./nonce-registry.cjs');
let now=1000000,blocked=false,locked=false,failWrite=false,corruptHeader=false,passed=0;
const rows=[HONBIN_NONCES_HEADER.slice()];
const tab={
 getLastRow:()=>rows.length,
 getRange(row,col,count,width){
  assert.equal(col,1);assert.equal(width,2);
  return {
   getValues:()=>rows.slice(row-1,row-1+count).map((x,i)=>{
    const out=x.slice();if(corruptHeader&&row===1&&i===0)out[0]='broken';
    return out;
   }),
   setValues:items=>{
    if(failWrite)throw Error('SHEETS_OUTAGE');
    assert.equal(row,rows.length+1);
    rows.push(...items.map(x=>x.slice()));
   }
  };
 },
 deleteRow(row){rows.splice(row-1,1)}
};
const env={
 SpreadsheetApp:{openById:id=>{assert.equal(id,'synthetic-id');return{getSheetByName:n=>n==='UsedNonces'?tab:null}}},
 PropertiesService:{getScriptProperties:()=>({getProperty:n=>n==='HONBIN_NOTES_SPREADSHEET_ID'?'synthetic-id':''})},
 LockService:{getScriptLock:()=>({tryLock(){if(blocked||locked)return false;locked=true;return true},releaseLock(){locked=false}})},
 clock:()=>now
};
const db=createSheetsNonceRegistry(env);
const check=(label,fn)=>{fn();passed++;console.log('PASS: '+label)};
const fails=(code,fn)=>assert.throws(fn,e=>e.message===code);
check('No spreadsheet ID refuses startup',()=>{
 fails('BACKEND_SPREADSHEET_NOT_CONFIGURED',()=>createSheetsNonceRegistry({...env,
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})}}));
});
check('Initial signed nonce accepted and recorded',()=>{
 assert.equal(db.consumeOnce('alice@example.test|nonce-1234567890',now+150000),true);
 assert.equal(rows.length,2);
});
check('Exact nonce replay refused',()=>{
 assert.equal(db.consumeOnce('alice@example.test|nonce-1234567890',now+150000),false);
 assert.equal(rows.length,2);
});
check('Same nonce string another actor uses different complete key',()=>{
 assert.equal(db.consumeOnce('bob@example.test|nonce-1234567890',now+150000),true);
 assert.equal(rows.length,3);
});
check('Expiration cannot be in past',()=>fails('NONCE_EXPIRATION_INVALID',()=>db.consumeOnce('alice|nonce-9876543210',now-1)));
check('Expiration cannot be excessively far future',()=>fails('NONCE_EXPIRATION_INVALID',()=>db.consumeOnce('alice|nonce-9876543210',now+999999)));
check('Lock busy fails without appending',()=>{
 blocked=true;const before=rows.length;
 try{fails('NONCE_LOCK_BUSY',()=>db.consumeOnce('alice|nonce-9876543210',now+150000))}
 finally{blocked=false}
 assert.equal(rows.length,before);
});
check('Write failure rejects and releases lock',()=>{
 failWrite=true;const before=rows.length;
 try{fails('SHEETS_OUTAGE',()=>db.consumeOnce('alice|nonce-9876543210',now+150000))}
 finally{failWrite=false}
 assert.equal(rows.length,before);assert.equal(locked,false);
});
check('Retry after failed write commits one nonce',()=>{
 assert.equal(db.consumeOnce('alice|nonce-9876543210',now+150000),true);
 assert.equal(db.consumeOnce('alice|nonce-9876543210',now+150000),false);
});
check('Malformed header fails closed',()=>{
 corruptHeader=true;try{fails('NONCE_HEADER_MISMATCH',()=>db.consumeOnce('alice|nonce-9999999999',now+150000))}
 finally{corruptHeader=false}
});
check('Expired nonce rows may be pruned after replay window',()=>{
 const old=rows.length;now+=300000;
 assert.equal(db.consumeOnce('alice|fresh-9876543210',now+150000),true);
 assert.ok(rows.length<old+1);assert.equal(rows.at(-1)[0],'alice|fresh-9876543210');
});
check('Active nonce is not pruned while valid',()=>{
 assert.equal(db.consumeOnce('alice|another-new-98765',now+150000),true);
 assert.ok(rows.some(r=>r[0]==='alice|fresh-9876543210'));
});
console.log('GAS NONCE STORE OFFLINE PASS',passed);
