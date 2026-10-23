// The top-level, installed CRM must own iPhone's Web Push subscription.
// The embedded, authenticated Firebase notes app alone may save it.
// This contains no Firebase admin credential, VAPID private key, or auto-prompt.
const APP_SCOPE='/-hongbin-personal-crm-beta/';
const API_CONFIG='./push-public-config.json';
const KEY=/^[A-Za-z0-9_-]{80,120}$/;
const ID=/^[A-Za-z0-9_-]{1,120}$/;
export function validPushPublicConfig(config){
 // Consent-based enrollment is independent of sender activation.
 // A verified subscriber may opt in whether safe staging or free live mode.
 return !!config&&config.schemaVersion===1&&
 config.subscriptionsEnabled===true&&typeof config.senderEnabled==='boolean'&&
 typeof config.publicVapidKey==='string'&&/^[A-Za-z0-9_-]{87}$/.test(config.publicVapidKey);
}
function decodeKey(key){
 const data=atob(key.replace(/-/g,'+').replace(/_/g,'/')+
   '='.repeat((4-key.length%4)%4));
 return Uint8Array.from(data,x=>x.charCodeAt(0));
}
function installed(){
 return !!(window.navigator.standalone||
  window.matchMedia?.('(display-mode: standalone)').matches);
}
function validAppleSubscription(value){
 try{
  const u=new URL(value?.endpoint||'');
  return u.protocol==='https:'&&u.hostname==='web.push.apple.com'&&
   !u.username&&!u.password&&!u.port&&
   typeof value.keys?.p256dh==='string'&&value.keys.p256dh.length>25&&
   typeof value.keys?.auth==='string'&&value.keys.auth.length>8;
 }catch{return false}
}
export function initCRMPush({button,status,frame,fetchConfig=async()=>(
 await (await fetch(API_CONFIG,{cache:'no-store'})).json())}){
 if(!button||!status||!frame)throw Error('MISSING_PUSH_CONTROLS');
 let config=null,requestId=null,resolvePending=null;
 function say(message){status.textContent=message}
 function closePending(ok){
  const resolve=resolvePending;resolvePending=null;requestId=null;
  if(resolve)resolve(ok);
 }
 const response=event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||
   event.data?.type!=='HONBIN_PUSH_SUBSCRIPTION_RESULT'||
   event.data?.requestId!==requestId)return;
  closePending(event.data?.success===true);
 };
 window.addEventListener('message',response);
 async function readConfig(){
  try{config=await fetchConfig()}catch{config=null}
  const enabled=validPushPublicConfig(config);
  button.disabled=false;
  button.textContent=enabled?(config.senderEnabled?'開啟這支 iPhone 通知':'登記這支 iPhone（測試）'):'檢查手機通知';
  say(enabled?(config.senderEnabled?
   '系統背景通知已開通；每支手機由本人同意授權並與自己的 Google 帳號綁定。':
   '可先由本人授權並登記這支 iPhone；發送端仍關閉，現在不會收到系統通知。'):
   '手機推播訂閱尚未開放，現有 CRM 內通知仍可使用。');
  return enabled;
 }
 async function activate(gesturePermission){
  button.disabled=true;
  try{
   if(!validPushPublicConfig(config)){
    if(await readConfig())say('推播已就緒，請再次按啟用以授權。');
    return false;
   }
   if(!installed()){
    say('必須從 iPhone 主畫面獨立開啟 CRM，Safari 分頁不能啟用 iPhone Web Push。');
    return false;
   }
   if(!('PushManager' in window)||!('Notification' in window)||
      !('serviceWorker' in navigator)){
    say('目前環境不支援 Web Push，請使用支援的 iPhone 主畫面網頁 App。');
    return false;
   }
   const permission=await gesturePermission;
   if(permission!=='granted'){say('尚未取得手機通知授權。');return false}
   // Registration must belong to the CRM's installed Home Screen scope, not
   // the separate /honbin-crm-auth-test service worker scope.
   const registration=await navigator.serviceWorker.ready;
   if(!registration.scope.endsWith(APP_SCOPE))throw Error('CRM_WORKER_SCOPE_MISMATCH');
   const old=await registration.pushManager.getSubscription();
   const sub=old||await registration.pushManager.subscribe({
    userVisibleOnly:true,applicationServerKey:decodeKey(config.publicVapidKey)
   });
   const json=sub?.toJSON();
   if(!validAppleSubscription(json))throw Error('NOT_AN_APPLE_PUSH_SUBSCRIPTION');
   if(!frame.contentWindow)throw Error('CLOUD_LOGIN_REQUIRED');
   const nonce='push_'+crypto.randomUUID().replace(/-/g,'');
   requestId=nonce;
   const answered=new Promise(resolve=>{resolvePending=resolve});
   frame.contentWindow.postMessage({
    type:'HONBIN_HOST_PUSH_SUBSCRIPTION',requestId:nonce,subscription:json
   },location.origin);
   const confirmed=await Promise.race([
    answered,new Promise(resolve=>setTimeout(()=>resolve(false),15000))
   ]);
   closePending(false);
   if(!confirmed)throw Error('FIRESTORE_SUBSCRIPTION_READBACK_NOT_CONFIRMED');
   say(config.senderEnabled?'這支 iPhone 已完成通知訂閱並經 Firebase 核對；符合權限的任務與記事將自動發送背景通知，實際送達可能因排程延遲。':
    '這支 iPhone 的訂閱已由 Firebase 伺服器核對成功（測試 PASS）；背景發送仍關閉，尚不會收到通知。');
   return true;
  }catch(error){
   say('通知訂閱尚未完成：'+String(error?.message||error));
   return false;
  }finally{button.disabled=false}
 }
 button.addEventListener('click',()=>{
  // Call requestPermission synchronously from the tap. Apple requires a
  // direct user gesture; fetching settings first can lose that activation.
  const promise=validPushPublicConfig(config)&&installed()&&
    'Notification' in window?
    Notification.requestPermission():Promise.resolve(null);
  void activate(promise);
 });
 void readConfig();
 return Object.freeze({readConfig,destroy:()=>{
  window.removeEventListener('message',response);
  closePending(false);
 }});
}
