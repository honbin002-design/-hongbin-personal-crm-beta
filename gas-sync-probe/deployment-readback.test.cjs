'use strict';
const assert=require('node:assert/strict');
const {verifyIsolatedDeployment,verifyIsolatedPair}=require('./deployment-readback.cjs');
let pass=0;
const good=(who,id)=>({
 deploymentId:id,entryPoints:[{entryPointType:'WEB_APP',webApp:{
 url:'https://script.google.com/macros/s/SYNTHETIC_DEPLOYMENT_ID_1234/exec',
 entryPointConfig:{access:'MYSELF',executeAs:who}
 }}]});
const user=good('USER_ACCESSING','synthetic-user-deployment');
const data=good('USER_DEPLOYING','synthetic-data-deployment');
function check(name,fn){fn();pass++;console.log('PASS: '+name)}
function reject(code,value,expected='USER_ACCESSING'){
 assert.throws(()=>verifyIsolatedDeployment(value,{expectedExecuteAs:expected}),e=>e.message===code,code)
}
check('A returned actual isolated user deployment passes only private access',()=>{
 const x=verifyIsolatedDeployment(user,{expectedExecuteAs:'USER_ACCESSING'});
 assert.equal(x.crossAccountEnabled,false);
});
check('B returned actual isolated owner deployment passes only private access',()=>{
 const x=verifyIsolatedDeployment(data,{expectedExecuteAs:'USER_DEPLOYING'});
 assert.equal(x.actualGoogleSessionVerified,false);
});
check('Both private deployments never authorize go-live',()=>{
 const x=verifyIsolatedPair({userDeployment:user,dataDeployment:data});
 assert.equal(x.goLiveAllowed,false);
});
check('Missing deployment response fails closed',()=>reject('DEPLOYMENT_READBACK_MISSING',null));
check('Missing deployment ID fails closed',()=>reject('DEPLOYMENT_ID_MISSING',{...user,deploymentId:''}));
check('Missing entrypoint list fails closed',()=>reject('DEPLOYMENT_ENTRYPOINTS_MISSING',{...user,entryPoints:null}));
check('Missing WebApp config fails closed',()=>reject('WEB_APP_CONFIG_MISSING',{
 ...user,entryPoints:[{entryPointType:'WEB_APP'}]}));
check('ANYONE access is explicitly blocked for isolated proof',()=>reject('DEPLOYMENT_NOT_PRIVATE',{
 ...user,entryPoints:[{entryPointType:'WEB_APP',webApp:{
 ...user.entryPoints[0].webApp,entryPointConfig:{access:'ANYONE',executeAs:'USER_ACCESSING'}}}]}));
check('ANYONE_ANONYMOUS remains forbidden regardless of HMAC',()=>reject('DEPLOYMENT_NOT_PRIVATE',{
 ...data,entryPoints:[{entryPointType:'WEB_APP',webApp:{
 ...data.entryPoints[0].webApp,entryPointConfig:{access:'ANYONE_ANONYMOUS',executeAs:'USER_DEPLOYING'}}}]},'USER_DEPLOYING'));
check('Unexpected executeAs rejected',()=>reject('DEPLOYMENT_ACTOR_MISMATCH',{
 ...user,entryPoints:[{entryPointType:'WEB_APP',webApp:{
 ...user.entryPoints[0].webApp,entryPointConfig:{access:'MYSELF',executeAs:'USER_DEPLOYING'}}}]}));
check('Fake URL is refused',()=>reject('DEPLOYMENT_URL_INVALID',{
 ...user,entryPoints:[{entryPointType:'WEB_APP',webApp:{
 url:'http://phishing.invalid/exec',entryPointConfig:{access:'MYSELF',executeAs:'USER_ACCESSING'}}}]}));
check('Both web apps cannot be the same deployment',()=>assert.throws(
 ()=>verifyIsolatedPair({userDeployment:user,dataDeployment:{...data,deploymentId:user.deploymentId}}),
 /NOT_SEPARATE_GOOGLE_SCRIPTS/));
console.log('APPS SCRIPT DEPLOYMENT READBACK GATE PASS',pass);
