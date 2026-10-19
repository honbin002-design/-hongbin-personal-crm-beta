'use strict';
/*
 * Checks REAL Apps Script projects.deployments.get() response JSON.
 * No CLI/script deployment. Must run after Google OAuth when authorized tooling exists.
 * Do not infer permissions from appsscript.json or a green clasp exit code.
 * Multi-account release remains forbidden until A->B auth and identity proven.
 */
function verifyIsolatedDeployment(deployment,{expectedExecuteAs}={}){
 const fail=code=>{throw Error(code)};
 if(!deployment||typeof deployment!=='object'||Array.isArray(deployment))
   fail('DEPLOYMENT_READBACK_MISSING');
 if(typeof deployment.deploymentId!=='string'||!deployment.deploymentId.trim())
   fail('DEPLOYMENT_ID_MISSING');
 if(!Array.isArray(deployment.entryPoints))fail('DEPLOYMENT_ENTRYPOINTS_MISSING');
 if(typeof expectedExecuteAs!=='string'||!['USER_ACCESSING','USER_DEPLOYING'].includes(expectedExecuteAs))
   fail('INVALID_EXPECTED_EXECUTE_AS');
 const webApps=deployment.entryPoints.filter(x=>x?.entryPointType==='WEB_APP');
 if(webApps.length!==1)fail('WEB_APP_ENTRYPOINT_COUNT_INVALID');
 const app=webApps[0].webApp;
 if(!app||!app.entryPointConfig)fail('WEB_APP_CONFIG_MISSING');
 const cfg=app.entryPointConfig;
 if(cfg.access!=='MYSELF')fail('DEPLOYMENT_NOT_PRIVATE');
 if(cfg.executeAs!==expectedExecuteAs)fail('DEPLOYMENT_ACTOR_MISMATCH');
 if(typeof app.url!=='string'||!/^https:\/\/script\.google\.com\/macros\/s\/[-A-Za-z0-9_]+\/exec$/.test(app.url))
   fail('DEPLOYMENT_URL_INVALID');
 return Object.freeze({status:'PRIVATE_DEPLOYMENT_CONFIG_VERIFIED',deploymentId:deployment.deploymentId,
  access:cfg.access,executeAs:cfg.executeAs,webAppUrl:app.url,
  crossAccountEnabled:false,actualGoogleSessionVerified:false});
}
function verifyIsolatedPair({userDeployment,dataDeployment}={}){
 const user=verifyIsolatedDeployment(userDeployment,{expectedExecuteAs:'USER_ACCESSING'});
 const backend=verifyIsolatedDeployment(dataDeployment,{expectedExecuteAs:'USER_DEPLOYING'});
 if(user.deploymentId===backend.deploymentId)throw Error('NOT_SEPARATE_GOOGLE_SCRIPTS');
 return Object.freeze({user,backend,goLiveAllowed:false,
  reason:'Google authenticated multi-account A->B and deployment OAuth are not verified'});
}
if(typeof module!=='undefined')module.exports={verifyIsolatedDeployment,verifyIsolatedPair};
