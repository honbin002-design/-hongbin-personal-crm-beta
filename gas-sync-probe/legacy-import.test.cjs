'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {planLegacyImport}=require('./legacy-import.cjs');
const digestId=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const notes=[
 {id:123456,title:'客戶電話',content:'只在舊版手機內的私人記事'},
 {id:345678,title:'提醒',content:'報價追蹤'},
 {id:998877,title:'空白',content:'   '}
];
let passed=0;
const run=(name,fn)=>{fn();passed++;console.log('PASS: '+name)};
const denied=(code,fn)=>assert.throws(fn,e=>e.message===code,code);
run('Legacy preview does not return upload operations without consent',()=>{
 const res=planLegacyImport({notes});
 assert.equal(res.operations.length,0);assert.equal(res.consentRequired,true);
 assert.equal(res.counts.total,3);assert.equal(res.counts.pending,2);
});
run('Preview cannot change legacy source data',()=>{
 const before=JSON.stringify(notes);planLegacyImport({notes});
 assert.equal(JSON.stringify(notes),before);
});
run('Only exact confirmed true enables import plan',()=>{
 assert.equal(planLegacyImport({notes,consent:'yes'}).operations.length,0);
 assert.equal(planLegacyImport({notes,consent:1}).operations.length,0);
});
run('After consent, cryptographic digest implementation is mandatory',()=>{
 denied('CRYPTO_DIGEST_REQUIRED',()=>planLegacyImport({notes,consent:true}));
});
run('After consent, operations contain only PRIVATE records',()=>{
 const res=planLegacyImport({notes,consent:true,digestId});
 assert.equal(res.operations.length,2);
 assert.ok(res.operations.every(x=>x.action==='CREATE_NOTE'&&x.args.scope==='PRIVATE'));
 assert.ok(res.operations.every(x=>!Object.hasOwn(x.args,'groupId')&&!Object.hasOwn(x.args,'ownerId')));
});
run('Same legacy ID generates stable operationId despite content edit',()=>{
 const first=planLegacyImport({notes,consent:true,digestId}).operations[0];
 const second=planLegacyImport({notes:[{...notes[0],content:'later revised'}],consent:true,digestId}).operations[0];
 assert.equal(first.operationId,second.operationId);
});
run('Already imported ID is excluded from retry plan',()=>{
 const res=planLegacyImport({notes,alreadyImportedIds:['123456'],consent:true,digestId});
 assert.equal(res.operations.length,1);assert.equal(res.counts.alreadyImported,1);
});
run('Duplicate legacy IDs fail closed and do not merge silent changes',()=>{
 denied('LEGACY_DUPLICATE_OR_INVALID_ID',()=>planLegacyImport({notes:[notes[0],{...notes[0],content:'changed'}]}));
});
run('Empty legacy notes are previewed but never uploaded',()=>{
 const res=planLegacyImport({notes,consent:true,digestId});
 assert.equal(res.counts.emptySkipped,1);
 assert.ok(!res.operations.some(x=>x.localId==='998877'));
});
run('Invalid cryptographic hash cannot become an operation ID',()=>{
 denied('INVALID_CRYPTO_DIGEST',()=>planLegacyImport({notes,consent:true,digestId:()=>''}));
});
run('Bigger than supported content is not silently truncated',()=>{
 denied('LEGACY_NOTE_TOO_LARGE',()=>planLegacyImport({notes:[{id:1,content:'a'.repeat(30001)}]}));
});
run('Unknown legacy storage format must be rejected',()=>{
 denied('LEGACY_FORMAT_UNEXPECTED',()=>planLegacyImport({notes:{entries:notes}}));
});
console.log('LEGACY IMPORT SAFETY PASS',passed);
