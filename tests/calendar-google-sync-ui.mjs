import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync('calendar-google-sync-ui.mjs','utf8');
const html=readFileSync('index.html','utf8');
const plan=readFileSync('calendar-sync-core.mjs','utf8');
const simple=readFileSync('simple-core.js','utf8');
assert.match(simple,/calendarBackupKey=k=>k==='honbin_calendar_local_todos_account_owner_v1'\|\|k\.startsWith\('honbin_calendar_google_links_v1:'\)/);
assert.match(simple,/k\.startsWith\('hongbin_'\)\|\|calendarBackupKey\(k\)/,'full backup includes calendar mappings');
assert.match(simple,/if\(calendarBackupKey\(key\)\|\|/,'restore validates calendar mappings');
assert.match(simple,/honbin_calendar_auto_foreground_v1:.*localStorage\.removeItem\(key\)/,'restored backup requires a new review before automatic writes');
const backupMatch=simple.match(/const calendarBackupKey=[\s\S]*?\nfunction validShape\(/);
assert.ok(backupMatch);
const backupFactory=new Function('env',`const {localStorage,downloadBlob,Blob,localDate,toast,alert}=env;
 ${backupMatch[0].replace(/\nfunction validShape\($/,'')}
 return backup;`);
const saved={hongbin_personal_crm_v3:'{"todos":[]}',
 'honbin_calendar_local_todos_account_owner_v1':'u',
 'honbin_calendar_google_links_v1:u:owned':'{"t":{"eventId":"e","localFingerprint":"a","remoteFingerprint":"b"}}',
 'honbin_calendar_auto_foreground_v1:u:owned':'enabled'};
let archive;
backupFactory({localStorage:{...saved,getItem(k){return this[k]}},Blob,
 downloadBlob(blob){archive=blob},localDate:()=>'',toast(){},alert(msg){throw Error(msg)}})();
const backupData=JSON.parse(await archive.text()).data;
assert.equal(backupData['honbin_calendar_google_links_v1:u:owned'],saved['honbin_calendar_google_links_v1:u:owned']);
assert.equal(backupData.honbin_calendar_local_todos_account_owner_v1,'u');
assert.equal(backupData['honbin_calendar_auto_foreground_v1:u:owned'],undefined,'restored backup is never automatically armed');
assert.match(code,/reauthenticateWithPopup\(user,provider\)/,'reuse already signed-in user');
assert.match(code,/let googleAuthReady=null/,'explicit first-tap initialization');
assert.match(code,/pauseAuto\('同步設定與既有資料已保留；Google 授權到期或帳號變更，請重新連線。',[\s\S]*?\{keepPreference:true\}\)/,'expiring token does not erase saved sync preference');
assert.match(code,/await auth\.authStateReady\(\);\s*googleAuthReady=\{authSdk,auth\};\s*const candidate=await waitForLogin\(authSdk,auth\)/,'wait for propagated iframe login');
assert.match(code,/getElementById\('logout'\)\?\.disabled!==false/,'visible signed-in workspace returns to setup');
assert.match(code,/calendarLoginGuide[\s\S]*?data-tab="cloud"/,'missing login routes to cloud tab');
assert.match(html,/id="calendarLoginReturn"/,'clear return path after sign-in');
assert.match(code,/const popup=authSdk\.reauthenticateWithPopup\(user,provider\);\s*const result=await popup/,'popup opens immediately on second user gesture');
assert.match(code,/for\(const op of plan\.operations\)/,'all planned writes are visibly listed');
assert.match(code,/async function preview\(\)\{[\s\S]*?state\.preview=null;[\s\S]*?googleCalendarConfirm'\)\.disabled=true/,'failed previews may never confirm old writes');
assert.match(code,/result\.user\.uid!==user\.uid/,'reject swapped Google account');
assert.match(code,/credentialFromResult\(result\)/);
assert.match(code,/scope\b/);
assert.match(code,/https:\/\/www\.googleapis\.com\/auth\/calendar\.events/);
assert.match(code,/https:\/\/www\.googleapis\.com\/auth\/calendar\.app\.created/,'only limited new-calendar creation scope');
assert.doesNotMatch(code,/https:\/\/www\.googleapis\.com\/auth\/calendar['"]/,'no all-calendar management OAuth scope');
assert.match(code,/if\(!confirm\('確定要在目前授權的 Google 帳號新增一個/,'explicit dedicated calendar creation consent');
assert.match(code,/state\.createAttempted=true;[\s\S]*?await request\('\/calendars'/,'one-shot attempt flag before API insert');
assert.match(code,/if\(state\.createAttempted\)throw Error\('CALENDAR_CREATION_UNCERTAIN_NO_RETRY'\)/);
assert.match(code,/const existing=await listCalendars\(\)/,'read live calendar inventory before create');
assert.match(code,/verified\.some\(c=>c\.id===created\.id\)/,'new calendar must readback exact id');
assert.match(code,/state\.createAttempted=false/,'only reset after owned calendar is confirmed');
assert.match(code,/CAL='鴻繽 CRM 待辦'/);
assert.match(code,/x\.summary===CAL/,'only exact dedicated calendar');
assert.match(code,/x\.accessRole==='owner'&&\!x\.primary/,'reject writable shared and primary calendars');
assert.match(code,/confirmed|confirm\(/i,'explicit write authorization');
assert.match(code,/planCalendarSync/);
assert.match(code,/CALENDAR_CHANGED_SINCE_PREVIEW_REVIEW_AGAIN/);
// Test exact Google API errors without real OAuth tokens or cloud writes.
const classifierSource=code.match(/function googleCalendarErrorCode\(status,payload\)\{[\s\S]*?\n\}\nasync function request\(/);
assert.ok(classifierSource,'Google API error classifier exists');
const googleCalendarErrorCode=new Function(
 classifierSource[0].replace(/\nasync function request\($/,'')+
 '\nreturn googleCalendarErrorCode;')();
assert.equal(googleCalendarErrorCode(403,{error:{details:[{reason:'SERVICE_DISABLED'}]}}),
 'GOOGLE_CALENDAR_API_DISABLED');
assert.equal(googleCalendarErrorCode(403,{error:{message:'Google Calendar API has not been used in project 123 or it is disabled'}}),
 'GOOGLE_CALENDAR_API_DISABLED');
assert.equal(googleCalendarErrorCode(403,{error:{details:[{reason:'ACCESS_TOKEN_SCOPE_INSUFFICIENT'}]}}),
 'GOOGLE_CALENDAR_SCOPE_DENIED');
assert.equal(googleCalendarErrorCode(403,{error:{errors:[{reason:'insufficientPermissions'}]}}),
 'GOOGLE_CALENDAR_SCOPE_DENIED');
assert.equal(googleCalendarErrorCode(403,{error:{message:'Forbidden'}}),
 'GOOGLE_CALENDAR_403_UNCLASSIFIED');
assert.equal(googleCalendarErrorCode(401,{}),'GOOGLE_TOKEN_EXPIRED');
assert.equal(googleCalendarErrorCode(429,{}),'GOOGLE_CALENDAR_QUOTA_LIMIT');
assert.match(code,/payload=await reply\.json\(\)/,'classify Calendar API response');
assert.doesNotMatch(code,/console\.log\(.*?payload|console\.log\(.*?token/,'never log private API results');
assert.match(code,/If-Match/);
assert.match(code,/GOOGLE_VERSION_CHANGED_PREVIEW_AGAIN/);
assert.match(code,/state\.token=''/);
assert.match(code,/storeLinks\(links\)/);
assert.match(code,/localStorage\.setItem\(CRM_KEY/,'CRM only after confirmation');
assert.match(code,/localStorage\.setItem\(key,JSON\.stringify\(links\)\)/);
assert.doesNotMatch(code,/localStorage\.setItem\([^\n]*token/,'never persist Google OAuth token');
assert.doesNotMatch(code,/method:'DELETE'/,'no Google Calendar deletion');
assert.doesNotMatch(code,/signInWithPopup\(/,'no account replacement');
assert.match(code,/saveTodoWithId\(/);
assert.match(code,/data\.todos===undefined/,'empty CRM should be safe to import');
assert.match(code,/notesWithoutCrmCustomerFooter\(fields\.notes,item\.customerName\)/,'keep customer footer from accumulating');
assert.match(code,/state\.preview=null;state\.events=\[\];state\.token=''/,'new authorization invalidates any prior preview');
assert.match(code,/patchTodoWithId\(/);
assert.match(code,/PREVIEW_REQUIRED/);
assert.match(code,/googleCalendarConfirm'\)\.disabled=true/);
for(const id of ['googleCalendarConnect','googleCalendarPreview','googleCalendarConfirm',
 'googleCalendarSelect','googleCalendarStatus','googleCalendarDisconnect','googleCalendarCreate']){
 assert(html.includes('id="'+id+'"'));
}
assert.match(plan,/reason:'BOTH_CHANGED'/,'simultaneous edits never overwrite');
assert.match(plan,/UNLINKED_EXISTING_CRM_EVENT/,'lost map fails closed');
assert.match(html,/首次同步需預覽及確認/);
for(const id of ['googleCalendarAutoEnable','googleCalendarAutoPause','googleCalendarAutoStatus'])
 assert(html.includes('id="'+id+'"'));
assert.match(code,/document\.visibilityState!=='visible'/,'only sync while app is visible');
assert.match(code,/setInterval\(\(\)=>void runAutoSync\(\),AUTO_INTERVAL\)/);
assert.match(code,/plan\.conflicts\.length\|\|plan\.operations\.length>AUTO_MAX_WRITES/);
assert.match(code,/automatic&&!autoSessionReady\(\)/);
assert.match(code,/if\(automatic\)payload\.id=await automaticEventId\(todo\.id\)/);
assert.match(code,/localStorage\.getItem\(LOCAL_OWNER_KEY\)===state\.user\.uid/);
assert.match(code,/pauseAuto\('已關閉自動同步/);
assert.match(html,/id="googleCalendarBackupNow"/,'backup is reachable from sync setup');
assert.match(code,/googleCalendarBackupNow'\)\?\.addEventListener/);
const listMatch=code.match(/async function listEvents\(\)\{[\s\S]*?\n\}\nfunction detailTitle\(/);
assert.ok(listMatch,'incremental event read exists');
const listImplementation=listMatch[0].replace(/\nfunction detailTitle\($/,'');
const createList=new Function('env',`const {state,request,eventUrl}=env;
 let eventSnapshot={owner:'',token:'',items:new Map()};
 ${listImplementation}
 return listEvents;`);
const calls=[];
let responses=[
 {items:[{id:'a',summary:'初始'}],nextSyncToken:'token1'},
 {items:[{id:'a',summary:'更新'},{id:'b',summary:'新增'}],nextSyncToken:'token2'},
 {items:[{id:'a',status:'cancelled'}],nextSyncToken:'token3'}
];
const listEvents=createList({state:{user:{uid:'u'},calendarId:'owned'},eventUrl:(c)=>'/'+c+'/events',
 async request(path){calls.push(new URL(path,'https://calendar.test').searchParams);return responses.shift()}});
assert.deepEqual((await listEvents()).map(x=>x.summary),['初始']);
assert.equal(calls[0].get('syncToken'),null);
assert.equal(calls[0].get('showDeleted'),'true');
assert.deepEqual((await listEvents()).map(x=>x.summary),['更新','新增']);
assert.equal(calls[1].get('syncToken'),'token1');
assert.deepEqual((await listEvents()).map(x=>x.id),['b']);
assert.equal(calls[2].get('syncToken'),'token2');
responses=[{items:[{id:'c',summary:'舊基準'}],nextSyncToken:'token4'},
 {items:[{id:'d',summary:'新基準'}],nextSyncToken:'token5'}];
// An expired token must trigger a full read and discard its stale snapshot.
const expiredCalls=[];
let expired=true;
const expiredList=createList({state:{user:{uid:'u'},calendarId:'owned'},eventUrl:c=>'/'+c+'/events',
 async request(path){const q=new URL(path,'https://calendar.test').searchParams;expiredCalls.push(q);
  if(expired&&q.has('syncToken')){expired=false;throw Error('GOOGLE_CALENDAR_HTTP_410')}
  return responses.shift();}});
await expiredList();
assert.deepEqual((await expiredList()).map(x=>x.id),['d']);
assert.equal(expiredCalls.at(-1).get('syncToken'),null);
// Execute the actual dedicated-calendar creation function against synthetic
// Google API results. Never request real OAuth credentials or modify calendars.
const createMatch=code.match(/async function createDedicatedCalendar\(\)\{[\s\S]*?\n\}\nasync function connectGoogle\(\)/);
assert.ok(createMatch,'production creation function exists');
const createImplementation=createMatch[0].replace(/\nasync function connectGoogle\(\)$/,'');
const execute=new Function('env',`
 const {state,listCalendars,chooseDedicatedCalendar,request,confirm,safeMessage,CAL}=env;
 ${createImplementation}
 return createDedicatedCalendar();
`);
const fresh=()=>({token:'fake-token-in-memory',expiresAt:Date.now()+60000,
 user:{uid:'synthetic'},calendarId:'',preview:null,createAttempted:false,createdCalendarId:''});
function environment({calendars=[[],[{id:'new-owned'}]],accept=true,response={id:'new-owned'}}={}){
 const state=fresh(),notes=[],writes=[];
 let reads=0;
 const env={
  state,CAL:'鴻繽 CRM 待辦',
  listCalendars:async()=>calendars[Math.min(reads++,calendars.length-1)],
  chooseDedicatedCalendar(list){
   if(!list.length)return false;
   state.calendarId=list[0].id;state.createAttempted=false;return true;
  },
  async request(path,options){
   writes.push({path,options});
   assert.equal(path,'/calendars');
   assert.equal(options.method,'POST');
   assert.deepEqual(JSON.parse(options.body),{summary:'鴻繽 CRM 待辦',
    timeZone:'Asia/Taipei',description:'鴻繽科技 CRM 專用待辦；由使用者手動確認同步'});
   return response;
  },
  confirm:()=>accept,safeMessage:v=>notes.push(v)
 };
 return {env,state,writes,notes};
}
{
 const t=environment({calendars:[[{id:'owned-existing'}]]});
 await execute(t.env);
 assert.equal(t.writes.length,0,'existing owner calendar must never be duplicated');
 assert.equal(t.state.calendarId,'owned-existing');
}
{
 const t=environment({accept:false});
 await execute(t.env);
 assert.equal(t.writes.length,0,'canceled consent must cause zero remote writes');
 assert.equal(t.state.createAttempted,false);
}
{
 const t=environment();
 await execute(t.env);
 assert.equal(t.writes.length,1,'approved creation must issue exactly one insert');
 assert.equal(t.state.calendarId,'new-owned');
 assert.equal(t.state.createAttempted,false,'clear hold only after exact calendar readback');
}
{
 const t=environment({calendars:[[],[]],response:{}});
 await assert.rejects(execute(t.env),/GOOGLE_CALENDAR_CREATE_READBACK_UNCERTAIN/);
 assert.equal(t.state.createAttempted,true,'unknown insert response must hold next retry');
 await assert.rejects(execute(t.env),/CALENDAR_CREATION_UNCERTAIN_NO_RETRY/);
 assert.equal(t.writes.length,1,'uncertain creation must never send a second insert');
}
{
 const t=environment({calendars:[[],[]]});
 await assert.rejects(execute(t.env),/GOOGLE_CALENDAR_CREATED_WAIT_FOR_LIST/);
 assert.equal(t.writes.length,1);
 assert.equal(t.state.createdCalendarId,'new-owned');
 assert.equal(t.state.createAttempted,true,'missing post-insert readback must fail closed');
}
{
 const t=environment();t.state.expiresAt=Date.now()-1000;
 await assert.rejects(execute(t.env),/GOOGLE_SESSION_EXPIRED_CONNECT_AGAIN/);
 assert.equal(t.writes.length,0,'expired token cannot create calendars');
}
// Exercise the foreground scheduler without network, OAuth, or real CRM data.
const autoMatch=code.match(/async function runAutoSync\(\)\{[\s\S]*?\n\}\nasync function handleClick\(action\)/);
assert.ok(autoMatch,'foreground loop exists');
const autoSource=autoMatch[0].replace(/\nasync function handleClick\(action\)$/,'');
const makeAuto=new Function('env',`
 const {state,document,preview,apply,pauseAuto,autoSessionReady,buttonDisable,autoControls,$}=env;
 const AUTO_INTERVAL=300000,AUTO_MAX_WRITES=10;let memberBusy=false;
 ${autoSource}
 return runAutoSync;
`);
for(const mode of ['hidden','conflict','ready']){
 const calls=[],state={autoActive:true,running:false,lastAutoAt:0,preview:null,
  calendarId:'owned',user:{uid:'same'},expiresAt:Date.now()+600000,token:'synthetic',
  createAttempted:false};
 const env={state,document:{visibilityState:mode==='hidden'?'hidden':'visible'},
  autoSessionReady:()=>true,buttonDisable:()=>{},autoControls:()=>{},
  $:()=>({disabled:false,textContent:''}),pauseAuto:()=>calls.push('pause'),
  preview:async()=>{calls.push('preview');state.preview={plan:{conflicts:mode==='conflict'?[{}]:[],
   operations:[{type:'CREATE_GOOGLE'}]}}},apply:async({automatic})=>calls.push(automatic?'auto-apply':'manual')};
 await makeAuto(env)();
 assert.deepEqual(calls,mode==='hidden'?[]:mode==='conflict'?['preview','pause']:['preview','auto-apply']);
}
console.log('IPHONE_GOOGLE_CALENDAR_CONSENT_PREVIEW_CONFLICT_NO_DELETE_GATES_PASS');

