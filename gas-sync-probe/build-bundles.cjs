'use strict';
/*
 * Build an isolated GAS source package. Never deploy or embed credentials here.
 * Run: node gas-sync-probe/build-bundles.cjs [destination]
 * No network, no clasp invocation, no modifications to CRM.
 */
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
function wrap(name,relative){
 const code=read(relative);
 return 'var '+name+'=(function(){\nvar module={exports:{}};\n'+code+
   '\nreturn module.exports;\n})();\n';
}
const userBundle=[
 "'use strict';\n",
 wrap('GASBoundary_','signed-boundary.cjs'),
 read('entry-user.gs.js')
].join('\n');
const dataBundle=[
 "'use strict';\n",
 wrap('GASBoundary_','signed-boundary.cjs'),
 wrap('GASEventService_','event-service.cjs'),
 wrap('GASSheetsAdapter_','sheets-adapter.cjs'),
 wrap('GASNonceRegistry_','nonce-registry.cjs'),
 read('entry-data.gs.js')
].join('\n');
const userManifest={
 timeZone:'Asia/Taipei',exceptionLogging:'STACKDRIVER',runtimeVersion:'V8',
 webapp:{access:'MYSELF',executeAs:'USER_ACCESSING'},
 oauthScopes:[
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/script.storage'
 ]
};
const dataManifest={
 timeZone:'Asia/Taipei',exceptionLogging:'STACKDRIVER',runtimeVersion:'V8',
 webapp:{access:'MYSELF',executeAs:'USER_DEPLOYING'},
 oauthScopes:[
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.storage'
 ]
};
function build(dest){
 new Function(userBundle);new Function(dataBundle);
 const out=path.resolve(dest||path.join(root,'dist'));
 for(const [sub,bundle,manifest] of [
  ['user',userBundle,userManifest],['data',dataBundle,dataManifest]
 ]){
  const dir=path.join(out,sub);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'Code.gs'),bundle);
  fs.writeFileSync(path.join(dir,'appsscript.json'),JSON.stringify(manifest,null,2)+'\n');
 }
 fs.copyFileSync(path.join(root,'Index.html'),path.join(out,'user','Index.html'));
 return {out,userBytes:userBundle.length,dataBytes:dataBundle.length,manifests:[userManifest,dataManifest]};
}
if(require.main===module){
 const result=build(process.argv[2]);
 console.log(JSON.stringify({bundleBuilt:true,userBytes:result.userBytes,
  dataBytes:result.dataBytes,liveDeployment:'NOT_ATTEMPTED',
  access:'MYSELF',oauthTokensIncluded:false}));
}
module.exports={build,userBundle,dataBundle,userManifest,dataManifest};
