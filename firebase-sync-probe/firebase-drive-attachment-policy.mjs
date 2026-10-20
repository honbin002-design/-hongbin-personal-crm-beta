// Google Drive attachment PRE-FLIGHT ONLY. No Drive OAuth, uploads, ACL
// changes or Firestore writes. Client checks are NOT a security boundary:
// the Drive API must enforce actual access; never trust Firestore metadata.
const normalize=email=>typeof email==='string'?email.trim().toLowerCase():'';
const safeId=id=>typeof id==='string'&&id.length>0&&id.length<=180&&
  !/[\\/\s]/.test(id);
const reject=(code)=>Object.freeze({ok:false,code});
const accept=(value)=>Object.freeze({ok:true,...value});
export function checkOwnerDriveFile({file,ownerEmail,folderId,aclComplete=false}={}){
  if(!file||typeof file!=='object')return reject('DRIVE_FILE_MISSING');
  if(!normalize(ownerEmail)||!normalize(ownerEmail).includes('@'))return reject('OWNER_EMAIL_MISSING');
  if(!safeId(folderId))return reject('OWNER_FOLDER_MISSING');
  if(!safeId(file.id)||file.trashed!==false)return reject('DRIVE_FILE_INVALID');
  if(file.driveId)return reject('SHARED_DRIVE_NOT_PERSONAL_STORAGE');
  if(!Array.isArray(file.parents)||!file.parents.includes(folderId))return reject('NOT_IN_OWNER_FOLDER');
  if(!Array.isArray(file.owners)||!file.owners.some(o=>
    normalize(o?.emailAddress)===normalize(ownerEmail)))return reject('NOT_OWNED_BY_CONFIGURED_OWNER');
  if(!aclComplete||!Array.isArray(file.permissions))return reject('DRIVE_ACL_NOT_FULLY_AUDITED');
  if(file.permissions.some(p=>!p||p.type==='anyone'||p.type==='domain'||p.type==='group'||
    !['user'].includes(p.type)))return reject('DRIVE_ACL_TOO_BROAD');
  if(typeof file.name!=='string'||!file.name.trim()||file.name.length>255)return reject('FILENAME_INVALID');
  if(typeof file.mimeType!=='string'||!file.mimeType||file.mimeType==='application/vnd.google-apps.folder')return reject('FILETYPE_INVALID');
  // Do not claim server ACL enforcement from a browser-side snapshot.
  return accept({fileId:file.id,name:file.name,mimeType:file.mimeType,ownerEmail:normalize(ownerEmail)});
}
export function checkNotebookDriveAcl({permissions,ownerEmail,members,aclComplete=false}={}){
  if(!aclComplete||!Array.isArray(permissions)||!Array.isArray(members))return reject('DRIVE_ACL_NOT_FULLY_AUDITED');
  const owner=normalize(ownerEmail);
  if(!owner||!owner.includes('@'))return reject('OWNER_EMAIL_MISSING');
  const wanted=new Map([[owner,'OWNER']]);
  for(const m of members){
    const email=normalize(m?.email),role=m?.role;
    if(!email||!email.includes('@')||!['ADMIN','EDITOR','VIEWER'].includes(role))return reject('MEMBER_EMAIL_OR_ROLE_MISSING');
    if(email===owner)continue;
    if(wanted.has(email))return reject('DUPLICATE_MEMBER_EMAIL');
    wanted.set(email,role);
  }
  const actual=new Map();
  for(const p of permissions){
    if(p?.type!=='user')return reject('DRIVE_ACL_TOO_BROAD');
    const email=normalize(p.emailAddress);
    if(!email||!wanted.has(email))return reject('DRIVE_PERMISSION_NOT_AUTHORIZED');
    if(actual.has(email))return reject('DUPLICATE_DRIVE_PERMISSION');
    if(!['owner','reader','writer'].includes(p.role))return reject('DRIVE_ROLE_UNSUPPORTED');
    if(email===owner){
      if(p.role!=='owner')return reject('OWNER_ROLE_MISMATCH');
    }else if(p.role!=='reader'){
      // CRM editors can edit note text; this does not imply they may edit,
      // delete, move, reshare or replace a Drive file.
      return reject('DRIVE_MEMBER_HAS_WRITE_ACCESS');
    }
    actual.set(email,p.role);
  }
  for(const email of wanted.keys())if(!actual.has(email))return reject('DRIVE_MEMBER_PERMISSION_MISSING');
  return accept({ownerEmail:owner,memberCount:wanted.size-1});
}
export const DRIVE_ATTACHMENT_STAGE='HOLD_OWNER_OAUTH_AND_CROSS_ACCOUNT_ACL';
