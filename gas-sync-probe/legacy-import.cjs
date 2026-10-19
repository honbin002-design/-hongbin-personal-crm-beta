'use strict';
/*
 * R73 legacy note transfer planning only. Offline preview never sends data.
 * The caller MUST obtain explicit confirmation after showing the preview.
 * Never reads/writes the old hongbin_crm_quick_notes_r73 storage key itself.
 * Import operation IDs are deterministic: backend enforces idempotency.
 * A production caller must provide a cryptographic SHA-256 digestId function.
 */
function planLegacyImport({notes,alreadyImportedIds=[],consent=false,digestId}={}){
 if(!Array.isArray(notes)||notes.length>10000)throw Error('LEGACY_FORMAT_UNEXPECTED');
 if(!Array.isArray(alreadyImportedIds))throw Error('LEGACY_RECEIPTS_INVALID');
 const receipts=new Set(alreadyImportedIds.map(String));
 const localIds=new Set(),preview=[],eligible=[];
 for(const n of notes){
  if(!n||!['string','number'].includes(typeof n.id)||
     !Number.isFinite(typeof n.id==='number'?n.id:0))throw Error('LEGACY_NOTE_INVALID');
  const localId=String(n.id).trim();
  if(!localId||localId.length>256||localIds.has(localId))throw Error('LEGACY_DUPLICATE_OR_INVALID_ID');
  localIds.add(localId);
  if(typeof n.content!=='string'||typeof n.title!=='string'&&n.title!==undefined)
   throw Error('LEGACY_NOTE_INVALID');
  const title=String(n.title||''),content=n.content;
  if(title.length>120||content.length>30000)throw Error('LEGACY_NOTE_TOO_LARGE');
  const already=receipts.has(localId);
  const skipped=!content.trim();
  preview.push({localId,title:title||content.slice(0,48),excerpt:content.slice(0,100),
   status:already?'ALREADY_IMPORTED':skipped?'EMPTY_SKIP':'READY'});
  if(!already&&!skipped)eligible.push({localId,title,content});
 }
 const counts={total:preview.length,alreadyImported:preview.filter(x=>x.status==='ALREADY_IMPORTED').length,
  emptySkipped:preview.filter(x=>x.status==='EMPTY_SKIP').length,
  pending:eligible.length};
 // Safe preview does not return content or mutate existing storage.
 if(consent!==true)return {counts,preview,operations:[],consentRequired:true};
 if(typeof digestId!=='function')throw Error('CRYPTO_DIGEST_REQUIRED');
 const operations=eligible.map(n=>{
  const hash=digestId('R73\x00'+n.localId);
  if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))throw Error('INVALID_CRYPTO_DIGEST');
  return {localId:n.localId,operationId:'legacy_'+hash,
    action:'CREATE_NOTE',args:{scope:'PRIVATE',title:n.title,content:n.content}};
 });
 return {counts,preview,operations,consentRequired:false};
}
if(typeof module!=='undefined')module.exports={planLegacyImport};
