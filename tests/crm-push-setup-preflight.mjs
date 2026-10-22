import assert from 'node:assert/strict';
import {validPushPublicConfig,initCRMPush} from '../crm-push-setup.mjs';
const disabled={schemaVersion:1,publicVapidKey:'',subscriptionsEnabled:false,
 senderEnabled:false};
assert.equal(validPushPublicConfig(disabled),false);
assert.equal(validPushPublicConfig({...disabled,subscriptionsEnabled:true,
 senderEnabled:true,publicVapidKey:'A'.repeat(88)}),true);
let handler=null,requests=0;
globalThis.window={addEventListener:()=>{},removeEventListener:()=>{},
 navigator:{standalone:false},matchMedia:()=>({matches:false})};
// Node 22 exposes a readonly built-in navigator; no mutation is needed.
const button={disabled:true,textContent:'',
 addEventListener:(_name,fn)=>{handler=fn}};
const status={textContent:''};
const frame={contentWindow:null};
const app=initCRMPush({button,status,frame,fetchConfig:async()=>disabled});
await app.readConfig();
assert.equal(button.disabled,false,'readiness button available');
assert.match(status.textContent,/尚未正式啟用/);
handler();await new Promise(r=>setTimeout(r,0));
assert.equal(requests,0,'no implicit Notification.requestPermission call');
assert.match(status.textContent,/尚未正式啟用/);
app.destroy();
console.log('CRM_PUSH_OPT_IN_SAFE_HOLD_NO_PERMISSIONS_PASS');
