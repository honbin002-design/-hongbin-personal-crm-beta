// Reconcile notebook members to Google emails using only server-accepted
// invitation records. No UID guessing, no caller-entered email authority.
// For OWNER-DRIVE attachment preflight; does not grant access by itself.
const email=v=>typeof v==='string'?v.trim().toLowerCase():'';
const id=v=>typeof v==='string'&&v.length>0&&v.length<=180&&!/[\\/]/.test(v);
const roles=new Set(['ADMIN','EDITOR','VIEWER']);
export function acceptedMemberEmails({groupId,members,invites}={}){
 if(!id(groupId)||!Array.isArray(members)||!Array.isArray(invites))throw Error('MEMBER_DIRECTORY_INCOMPLETE');
 const accepted=new Map();
 for(const invitation of invites){
  if(!invitation||invitation.groupId!==groupId||invitation.status!=='ACCEPTED'||
     !id(invitation.id)||!id(invitation.acceptedUid)||!roles.has(invitation.role)||
     !email(invitation.recipientEmail).includes('@'))continue;
  const key=invitation.id;
  if(accepted.has(key))throw Error('DUPLICATE_ACCEPTED_INVITATION');
  accepted.set(key,invitation);
 }
 const output=[],used=new Set(),seen=new Set();
 for(const member of members){
  if(!member||!id(member.uid)||seen.has(member.uid))throw Error('INVALID_MEMBER_DIRECTORY');
  seen.add(member.uid);
  if(member.status==='REVOKED')continue;
  if(member.status!=='ACTIVE'||!roles.has(member.role))throw Error('INVALID_ACTIVE_MEMBER');
  const invitation=accepted.get(member.invitationId);
  if(!invitation||invitation.acceptedUid!==member.uid||
     invitation.role!==member.role) {
   // An admin may later change a member role. The invitation's original
   // role is not authoritative for the CURRENT role, but identity is.
   if(!invitation||invitation.acceptedUid!==member.uid)throw Error('MEMBER_EMAIL_UNVERIFIED');
  }
  const address=email(invitation.recipientEmail);
  if(used.has(address))throw Error('DUPLICATE_VERIFIED_EMAIL');
  used.add(address);output.push({uid:member.uid,email:address,role:member.role});
 }
 return output;
}
