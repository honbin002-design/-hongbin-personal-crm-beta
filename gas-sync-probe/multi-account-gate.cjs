'use strict';
/*
 * Multi-account release gate. This gate has NO bypass flag.
 * Node tests, a green GitHub Action and a Sheets read/write roundtrip
 * cannot prove Apps Script's live identity or a private A->B invocation.
 * Must receive independently verified, real deployment and device evidence.
 * Never put OAuth access tokens, Script Properties or data in evidence.
 */
function assessMultiAccountRelease({userDeployment,dataDeployment,evidence={}}={}){
  const blockers=[];
  const add=(code,detail)=>blockers.push({code,detail});
  if(!userDeployment||!Array.isArray(userDeployment.entryPoints))
    add('USER_DEPLOYMENT_NOT_VERIFIED','Missing Google projects.deployments.get for A');
  else{
    const a=userDeployment.entryPoints.find(x=>x?.entryPointType==='WEB_APP')?.webApp?.entryPointConfig;
    if(!a)add('USER_WEB_APP_NOT_VERIFIED','No A web app readback');
    else{
      if(a.executeAs!=='USER_ACCESSING')add('USER_IDENTITY_NOT_AUTHENTICATED','A must execute as accessing user');
      if(a.access!=='ANYONE')add('USER_NOT_AVAILABLE_TO_TEAM','A must require signed-in Google accounts for cross-account testing');
    }
  }
  if(!dataDeployment||!Array.isArray(dataDeployment.entryPoints))
    add('DATA_DEPLOYMENT_NOT_VERIFIED','Missing Google projects.deployments.get for B');
  else{
    const b=dataDeployment.entryPoints.find(x=>x?.entryPointType==='WEB_APP')?.webApp?.entryPointConfig;
    if(!b)add('DATA_WEB_APP_NOT_VERIFIED','No B web app readback');
    else{
      if(b.executeAs!=='USER_DEPLOYING')add('DATA_OWNER_AUTHORITY_NOT_VERIFIED','B must execute with owner authority');
      if(b.access==='ANYONE_ANONYMOUS')add('ANONYMOUS_BACKEND_NOT_APPROVED','A public anonymous B endpoint requires independent signed-request penetration and abuse tests');
      else if(b.access==='MYSELF'&&!evidence.serverToServerGoogleAuthProven)
        add('PRIVATE_BACKEND_TRANSPORT_UNPROVEN','UrlFetchApp A->B to MYSELF is unproven without Google-authenticated server-to-server invocation');
      else if(b.access!=='MYSELF')
        add('DATA_BACKEND_ACCESS_UNAPPROVED','Unrecognized or unapproved data endpoint authorization');
    }
  }
  if(evidence.googleOAuthDeploymentCompleted!==true)
    add('GOOGLE_OAUTH_DEPLOYMENT_MISSING','OAuth-authorized real deployment has not been completed');
  if(evidence.actorAandBVerifiedOnGoogle!==true)
    add('ACTUAL_GOOGLE_IDENTITIES_UNTESTED','Different Google accounts not verified through Google Session');
  if(evidence.serverToServerGoogleAuthProven!==true)
    add('SIGNED_BACKEND_TRANSPORT_UNTESTED','A->B transport, signing, quotas and redirects need a real proof');
  if(evidence.twoAccountAccessIsolationVerified!==true)
    add('ACTUAL_NOTE_ACL_UNTESTED','Distinct users private/shared article ACL not tested through Apps Script');
  if(evidence.revocationTestedLive!==true)
    add('ACTUAL_REVOCATION_UNTESTED','Member revocation not tested through deployed server');
  if(evidence.multiPhoneConfirmed!==true)
    add('IPHONE_SYNC_UNVERIFIED','Two real iPhones have not passed version-conflict and offline recovery verification');
  if(evidence.ownerSheetNotShared!==true)
    add('SHEET_ACL_NOT_CONFIRMED','Backing Google Sheet must remain owner-only');
  if(evidence.productionBackupAndRollbackPassed!==true)
    add('PRODUCTION_BACKUP_NOT_RECHECKED','Production backup and rollback must pass immediately before release');
  // Technical evidence is never equivalent to approval to upload legacy private notes.
  const allowed=blockers.length===0;
  return {status:allowed?'READY_FOR_USER_ACCEPTANCE':'HOLD',
    deployProduction: false, // Never auto-deploy CRM. User approval is separately mandatory.
    allowedForUserAcceptance:allowed,blockers};
}
if(typeof module!=='undefined')module.exports={assessMultiAccountRelease};
