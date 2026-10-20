import assert from 'node:assert/strict';
import {conflictReview,buildSaveNewCopy,buildRemoteRestore} from './firebase-conflict-review.mjs';
let passed=0;async function test(name,fn){console.log('BEGIN '+name);await fn();passed++;console.log('PASS '+name)}
const local={title:'我在 iPhone 寫的標題',content:'手機草稿 - 絕不能被覆蓋'};
const remote={title:'另一支手機更新',content:'雲端最新版',version:8,deleted:false};
let r;
await test('Conflict review exposes both text versions without auto merge',()=>{
 r=conflictReview({sourceNoteId:'original-note',local,remote});
 assert.equal(r.local.content,local.content);
 assert.equal(r.remote.content,remote.content);
 assert.equal(r.remote.version,8);
});
await test('Default action keeps local draft, cannot auto overwrite remote',()=>{
 assert.equal(r.availableChoices[0],'KEEP_DRAFT');
 assert.deepEqual(r.availableChoices,['KEEP_DRAFT','LOAD_REMOTE','SAVE_NEW_COPY']);
});
await test('Source note ID never changed by pure reviewer',()=>{
 assert.equal(r.sourceNoteId,'original-note');
});
await test('Saving a copy requires a different document ID',()=>{
 assert.throws(()=>buildSaveNewCopy(r,'original-note'),/COPY_REQUIRES_DISTINCT_NOTE_ID/);
});
await test('Saving a copy includes only original local content',()=>{
 assert.deepEqual(buildSaveNewCopy(r,'brand-new-note'),{
   noteId:'brand-new-note',title:local.title,content:local.content
 });
});
await test('Copy does not leak remote text into local copy',()=>{
 const plan=buildSaveNewCopy(r,'copy-2');
 assert.equal(plan.content,local.content);
 assert.notEqual(plan.content,remote.content);
});
await test('Explicit remote restore uses exact new version, no silent write',()=>{
 assert.deepEqual(buildRemoteRestore(r),{
  id:'original-note',version:8,title:remote.title,content:remote.content
 });
});
await test('Deleted remote hides load-remote choice',()=>{
 const conflict=conflictReview({sourceNoteId:'original-note',local,
  remote:{...remote,deleted:true}});
 assert.deepEqual(conflict.availableChoices,['KEEP_DRAFT','SAVE_NEW_COPY']);
 assert.throws(()=>buildRemoteRestore(conflict),/REMOTE_NOT_AVAILABLE/);
});
await test('Missing remote hides load-remote choice but preserves draft',()=>{
 const conflict=conflictReview({sourceNoteId:'original-note',local,remote:null});
 assert.equal(conflict.remote,null);
 assert.equal(conflict.cloudAvailable,false);
 assert.equal(buildSaveNewCopy(conflict,'new-unique').content,local.content);
});
await test('Malformed or untrusted source ID rejected',()=>{
 assert.throws(()=>conflictReview({sourceNoteId:'bad/../path',local,remote}),/INVALID_SOURCE_NOTE_ID/);
});
await test('Invalid remote version rejected before rendering',()=>{
 assert.throws(()=>conflictReview({sourceNoteId:'valid-id',local,
 remote:{...remote,version:0}}),/INVALID_REMOTE_VERSION/);
});
await test('Invalid or oversized local title and content rejected',()=>{
 assert.throws(()=>conflictReview({sourceNoteId:'valid-id',
 local:{...local,title:'x'.repeat(121)},remote}),/INVALID_LOCAL_DRAFT/);
 assert.throws(()=>conflictReview({sourceNoteId:'valid-id',
 local:{...local,content:'y'.repeat(30001)},remote}),/INVALID_LOCAL_DRAFT/);
});
await test('Remote never mutates the local text snapshot',()=>{
 const local2={...local};
 const z=conflictReview({sourceNoteId:'source-3',local:local2,remote});
 local2.content='mutated by caller';
 assert.equal(z.local.content,local.content);
});
await test('Review output is frozen (not a cloud transaction object)',()=>{
 assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.remote));
 assert.ok(Object.isFrozen(r.local));assert.ok(Object.isFrozen(r.availableChoices));
});
await test('New-copy ID rejects slashes and path traversal',()=>{
 assert.throws(()=>buildSaveNewCopy(r,'../invalid'),/COPY_REQUIRES_DISTINCT_NOTE_ID/);
});
await test('Invalid review cannot be promoted to a cloud write',()=>{
 assert.throws(()=>buildSaveNewCopy(null,'new'),/INVALID_REVIEW/);
});
console.log('HONBIN_CONFLICT_REVIEW_LOCAL_PASS',passed);
