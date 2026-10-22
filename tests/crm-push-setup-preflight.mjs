import assert from 'node:assert/strict';
import {validPushPublicConfig,initCRMPush} from '../crm-push-setup.mjs';
const disabled={schemaVersion:1,publicVapidKey:'',subscriptionsEnabled:false,
 senderEnabled:false};
assert.equal(validPushPublicConfig(disabled),false);
const staged={...disabled,subscriptionsEnabled:true,
 senderEnabled:false,publicVapidKey:'A'.repeat(87)};
assert.equal(validPushPublicConfig(staged),true,'staged consent permitted while sender OFF');
assert.equal(validPushPublicConfig({...staged,senderEnabled:true}),true);
assert.equal(validPushPublicConfig({...staged,publicVapidKey:'A'.repeat(86)}),false);
assert.equal(validPushPublicConfig({...staged,senderEnabled:'false'}),false);
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
assert.match(status.textContent,/尚未開放/);
handler();await new Promise(r=>setTimeout(r,0));
assert.equal(requests,0,'no implicit Notification.requestPermission call');
assert.match(status.textContent,/尚未正式啟用/);
app.destroy();
const stageButton={disabled:true,textContent:'',addEventListener:()=>{}};
const stageStatus={textContent:''};
const stageApp=initCRMPush({button:stageButton,status:stageStatus,frame,
 fetchConfig:async()=>staged});
assert.equal(await stageApp.readConfig(),true);
assert.equal(stageButton.textContent,'登記這支 iPhone（測試）');
assert.match(stageStatus.textContent,/發送端仍關閉/);
stageApp.destroy();
console.log('CRM_PUSH_SAFE_HOLD_AND_STAGED_IPHONE_OPT_IN_NO_SEND_PASS');
