/**
 * HONBIN CRM opt-in Google Calendar bridge. A dedicated named Google calendar
 * is the only target; the same Google account can appear inside iPhone's native
 * Calendar app. NEVER reads iCloud/EventKit, runs in background, or auto-writes.
 * Access token exists solely in module memory and only after explicit reauth.
 */
import {planCalendarSync,todoFingerprint,eventFingerprint,googleEventFromTodo,
 notesWithoutCrmCustomerFooter}
 from './calendar-sync-core.mjs?v=20261027b';
// Firebase's already existing public config is loaded only when the user taps Connect.
const $=id=>document.getElementById(id);
const CAL='鴻繽 CRM 待辦';
const CRM_KEY='hongbin_personal_crm_v3';
const MAP_KEY='honbin_calendar_google_links_v1';
const API='https://www.googleapis.com/calendar/v3';
const SCOPES=['https://www.googleapis.com/auth/calendar.events',
 'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
 // Least-privilege permission for creating app-owned secondary calendars only.
 'https://www.googleapis.com/auth/calendar.app.created'];
const state={token:'',expiresAt:0,user:null,calendarId:'',calendarSummary:'',
 events:[],preview:null,running:false,createAttempted:false,createdCalendarId:''};
let googleAuthReady=null; // SDK preloaded by the first explicit tap, no tokens retained
const safeMessage=message=>{
 const status=$('googleCalendarStatus');if(!status)return;
 status.hidden=false;status.textContent=message;
};
const buttonDisable=disabled=>{
 for(const id of ['googleCalendarConnect','googleCalendarCreate','googleCalendarPreview','googleCalendarConfirm','googleCalendarDisconnect'])
  if($(id))$(id).disabled=disabled;
};
function allTodos(){
 const data=JSON.parse(localStorage.getItem(CRM_KEY)||'{}');
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('CRM_TODOS_INVALID');
 if(data.todos===undefined)return {...data,todos:[]}; // fresh CRM has no saved tasks yet
 if(!Array.isArray(data.todos))throw Error('CRM_TODOS_INVALID');
 return data;
}
const linkKey=(uid,calendarId)=>MAP_KEY+':'+uid+':'+calendarId;
function savedLinks(){
 const key=linkKey(state.user.uid,state.calendarId);
 const value=JSON.parse(localStorage.getItem(key)||'{}');
 return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}
function storeLinks(links){
 const key=linkKey(state.user.uid,state.calendarId);
 localStorage.setItem(key,JSON.stringify(links));
}
// Convert Google's standard error reasons into safe, actionable codes.
// Never display provider raw bodies: they can include account/project metadata.
function googleCalendarErrorCode(status,payload){
 if(status===401)return 'GOOGLE_TOKEN_EXPIRED';
 if(status===403){
  const error=payload?.error||{};
  const reasons=[
   error.status,
   ...(Array.isArray(error.errors)?error.errors.map(x=>x?.reason):[]),
   ...(Array.isArray(error.details)?error.details.map(x=>x?.reason):[])
  ].filter(x=>typeof x==='string').join(' ').toUpperCase();
  const message=typeof error.message==='string'?error.message.slice(0,1000):'';
  if(/SERVICE_DISABLED|ACCESSNOTCONFIGURED|API_DISABLED|API_NOT_ENABLED/.test(reasons)||
     /API (?:HAS NOT BEEN USED|IS DISABLED)|API.+(?:NOT ENABLED|HAS NOT BEEN ENABLED)/i.test(message))
   return 'GOOGLE_CALENDAR_API_DISABLED';
  if(/ACCESS_TOKEN_SCOPE_INSUFFICIENT|INSUFFICIENTPERMISSIONS|INSUFFICIENT_AUTHENTICATION_SCOPES/.test(reasons)||
     /INSUFFICIENT (?:AUTHENTICATION )?SCOPES|INSUFFICIENT PERMISSIONS/i.test(message))
   return 'GOOGLE_CALENDAR_SCOPE_DENIED';
  return 'GOOGLE_CALENDAR_403_UNCLASSIFIED';
 }
 if(status===404)return 'GOOGLE_EVENT_OR_CALENDAR_NOT_FOUND';
 if(status===409||status===412)return 'GOOGLE_VERSION_CHANGED_PREVIEW_AGAIN';
 if(status===429)return 'GOOGLE_CALENDAR_QUOTA_LIMIT';
 return 'GOOGLE_CALENDAR_HTTP_'+status;
}
async function request(path,options={}){
 if(!state.token||Date.now()>=state.expiresAt)throw Error('GOOGLE_SESSION_EXPIRED_CONNECT_AGAIN');
 const reply=await fetch(API+path,{...options,headers:{
  Authorization:'Bearer '+state.token,
  Accept:'application/json',
  ...(options.body?{'Content-Type':'application/json'}:{}),
  ...(options.headers||{})
 },cache:'no-store'});
 if(!reply.ok){
  let payload=null;
  try{payload=await reply.json()}catch{}
  // The error is classified locally. Never log the token or provider body.
  throw Error(googleCalendarErrorCode(reply.status,payload));
 }
 return reply.status===204?null:reply.json();
}
const eventUrl=(calendarId,rest='')=>'/calendars/'+encodeURIComponent(calendarId)+'/events'+rest;
async function listCalendars(){
 let page='',n=0,found=[];
 do{
  const query=new URLSearchParams({maxResults:'250'});
  if(page)query.set('pageToken',page);
  const data=await request('/users/me/calendarList?'+query);
  found.push(...(data.items||[]));page=data.nextPageToken||'';
  if(++n>10)throw Error('TOO_MANY_CALENDARS_STOP');
 }while(page);
 // Shared writer calendars can disclose confidential CRM notes to other owners.
 return found.filter(x=>x.summary===CAL&&x.accessRole==='owner'&&!x.primary);
}
async function listEvents(){
 let page='',n=0,items=[];
 do{
  const query=new URLSearchParams({maxResults:'250',showDeleted:'false',singleEvents:'false',
   fields:'nextPageToken,items(id,summary,description,start,end,extendedProperties,etag,status,recurrence,recurringEventId,updated)'});
  if(page)query.set('pageToken',page);
  const data=await request(eventUrl(state.calendarId)+'?'+query);
  items.push(...(data.items||[]));page=data.nextPageToken||'';
  if(++n>4||items.length>1000)throw Error('CALENDAR_TOO_MANY_EVENTS_STOP');
 }while(page);
 // No recurrence changes: these require a dedicated expansion/conflict policy.
 const recurring=items.filter(x=>x.recurrence||x.recurringEventId);
 if(recurring.length)throw Error('RECURRING_EVENTS_NOT_SUPPORTED_USE_DEDICATED_CALENDAR');
 return items;
}
function detailTitle(operation,todos,events){
 const local=todos.find(t=>String(t.id)===String(operation.todoId));
 const remote=events.find(e=>String(e.id)===String(operation.eventId));
 const key={CREATE_GOOGLE:'CRM → Google 新增',UPDATE_GOOGLE:'CRM → Google 更新',
  UPDATE_CRM:'Google → CRM 更新',IMPORT_TO_CRM:'Google → CRM 新增'};
 return (key[operation.type]||operation.type)+'：'+
  String(local?.text||remote?.summary||operation.fields?.text||'未命名行程').slice(0,100);
}
function showPreview(plan,todos,events){
 const box=$('googleCalendarPlan');box.replaceChildren();
 const summary=document.createElement('p');
 summary.textContent='待同步 '+plan.operations.length+' 筆，需人工核對 '+plan.conflicts.length+
  ' 筆，略過 '+plan.skipped.length+' 筆。此時尚未修改 CRM 或 Google 行事曆。';
 box.append(summary);
 const ul=document.createElement('ul');
 for(const op of plan.operations){
  const li=document.createElement('li');li.textContent=detailTitle(op,todos,events);ul.append(li);
 }
 // Every proposed write must be visible before a person approves the batch.
 box.append(ul);
 if(plan.conflicts.length){
  const note=document.createElement('p');
  note.textContent='衝突資料一律不修改：'+plan.conflicts.map(x=>x.reason).slice(0,8).join('、');
  box.append(note);
 }
 $('googleCalendarConfirm').disabled=plan.operations.length===0||state.running;
}
function chooseDedicatedCalendar(available){
 const select=$('googleCalendarSelect');select.replaceChildren();
 for(const c of available){
  const option=document.createElement('option');option.value=c.id;
  option.textContent=c.summary+'（'+c.id+'）';select.append(option);
 }
 if(!available.length){
  state.calendarId='';state.calendarSummary='';state.preview=null;
  return false;
 }
 // An explicitly created calendar takes precedence over similar names.
 const selected=available.find(c=>c.id===state.createdCalendarId)||available[0];
 state.calendarId=selected.id;state.calendarSummary=CAL;select.value=state.calendarId;
 state.createAttempted=false;
 return true;
}
async function createDedicatedCalendar(){
 if(!state.user||!state.token||Date.now()>=state.expiresAt)throw Error('GOOGLE_SESSION_EXPIRED_CONNECT_AGAIN');
 if(state.calendarId)throw Error('DEDICATED_CALENDAR_ALREADY_SELECTED');
 // Read every calendar page again before creating to prevent double submission.
 const existing=await listCalendars();
 if(chooseDedicatedCalendar(existing)){
  safeMessage('重新查詢時已找到你擁有的專用日曆，沒有再建立第二本。現在可預覽同步。');
  return;
 }
 if(state.createAttempted)throw Error('CALENDAR_CREATION_UNCERTAIN_NO_RETRY');
 if(!confirm('確定要在目前授權的 Google 帳號新增一個名為「'+CAL+'」的私人次要日曆嗎？\\n'+
  '不會變更主要、家族或其他既有日曆，也不會立即同步任何 CRM 待辦。'))return;
 // A remote insert may succeed even if its network response is lost.
 // Never retry the insert automatically or twice in the same browser session.
 state.createAttempted=true;
 const created=await request('/calendars',{
  method:'POST',body:JSON.stringify({summary:CAL,timeZone:'Asia/Taipei',
   description:'鴻繽科技 CRM 專用待辦；由使用者手動確認同步'})});
 if(!created?.id)throw Error('GOOGLE_CALENDAR_CREATE_READBACK_UNCERTAIN');
 state.createdCalendarId=created.id;
 const verified=await listCalendars();
 if(!verified.some(c=>c.id===created.id))throw Error('GOOGLE_CALENDAR_CREATED_WAIT_FOR_LIST');
 chooseDedicatedCalendar(verified);
 safeMessage('已建立並確認本人擁有的「'+CAL+'」專用日曆。尚未建立或修改任何待辦行程；下一步可按「預覽雙向差異」。');
}
async function connectGoogle(){
 // Reauthorization always clears prior preview/token/calendar selection.
 // A failed or changed session must never confirm an old preview.
 state.preview=null;state.events=[];state.token='';state.expiresAt=0;
 state.calendarId='';state.calendarSummary='';state.user=null;
 $('googleCalendarPlan')?.replaceChildren();
 // iPhone WebKit may block popups if SDK downloads and awaits consume the
 // original user gesture. The first explicit tap loads and validates auth;
 // the second is a fresh direct tap that opens the Google OAuth popup before
 // any await. No silent authorization and no new sign-in.
 if(!googleAuthReady){
  const {firebaseConfig}=await import('/honbin-crm-auth-test/firebase-web-config.mjs');
  if(firebaseConfig.projectId!=='honbin-crm-notes-spark')throw Error('WRONG_FIREBASE_PROJECT');
  const appSdk=await import('https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js');
  const authSdk=await import('https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js');
  const app=appSdk.getApps().find(x=>x.name==='[DEFAULT]')||appSdk.initializeApp(firebaseConfig);
  if(app.options.projectId!==firebaseConfig.projectId)throw Error('FIREBASE_PROJECT_MISMATCH');
  const auth=authSdk.getAuth(app);
  await auth.authStateReady();
  const candidate=auth.currentUser;
  if(!candidate||!candidate.emailVerified||
     !candidate.providerData.some(p=>p.providerId==='google.com'))
   throw Error('請先到「雲端記事與任務」登入你自己的 Google 帳號，再連接日曆。');
  googleAuthReady={authSdk,auth};
  $('googleCalendarConnect').textContent='第二步：點此授權 Google 日曆';
  safeMessage('已確認目前登入的 Google 帳號。請再次點上方「第二步：點此授權 Google 日曆」，這次將由你本人開啟 Google 授權視窗。尚未取得任何日曆資料。');
  return;
 }
 const {authSdk,auth}=googleAuthReady;
 const user=auth.currentUser;
 if(!user||!user.emailVerified||!user.providerData.some(p=>p.providerId==='google.com'))
  throw Error('目前尚未登入已驗證的 Google 帳號，請先登入雲端記事與任務。');
 const provider=new authSdk.GoogleAuthProvider();
 for(const scope of SCOPES)provider.addScope(scope);
 // Intentionally executed before the first await on this second click.
 const popup=authSdk.reauthenticateWithPopup(user,provider);
 const result=await popup;
 if(!result.user||result.user.uid!==user.uid)throw Error('GOOGLE_ACCOUNT_CHANGED_STOP');
 const credential=authSdk.GoogleAuthProvider.credentialFromResult(result);
 if(!credential?.accessToken)throw Error('GOOGLE_CALENDAR_CONSENT_NOT_GRANTED');
 state.token=credential.accessToken;
 state.expiresAt=Date.now()+50*60*1000; // conservative; never persist token
 state.user={uid:user.uid,email:user.email};
 const available=await listCalendars();
 if(!chooseDedicatedCalendar(available)){
  state.events=[];state.preview=null;
  safeMessage(state.createAttempted?
   '先前建立專用日曆的結果尚待確認，為避免重複建立已鎖定建立按鈕。請先到 Google 日曆核對，勿反覆按建立。':
   'Google 已授權，目前沒有你擁有的「'+CAL+'」專用日曆。可按「建立我的專用 Google 日曆」，本人確認後才會新增；不會操作主要或家族日曆。');
  $('googleCalendarPreview').disabled=true;return;
 }
 $('googleCalendarPreview').disabled=false;
 safeMessage('已授權並找到本人擁有的專用 Google 日曆。點「預覽雙向差異」才會唯讀取得行程，尚未同步。');
}
async function preview(){
 // Any failed new preview must invalidate the previous confirmation.
 state.preview=null;
 $('googleCalendarConfirm').disabled=true;
 if(!state.calendarId)throw Error('SELECT_DEDICATED_GOOGLE_CALENDAR');
 const [local,events]=[allTodos().todos,await listEvents()];
 const links=savedLinks();
 // If we successfully imported an event in a prior interrupted session,
 // restore that local-only association instead of importing a duplicate.
 for(const todo of local){
  if(!todo?.honbinCalendarEventId||links[String(todo.id)])continue;
  const remote=events.find(x=>x.id===todo.honbinCalendarEventId);
  if(remote)links[String(todo.id)]={
   eventId:remote.id,localFingerprint:todoFingerprint(todo),
   remoteFingerprint:eventFingerprint(remote)};
 }
 const plan=planCalendarSync({todos:local,events,links});
 state.events=events;
 state.preview={plan,links,
  localFingerprint:JSON.stringify(local.map(x=>[x.id,todoFingerprint(x)])),
  remoteFingerprint:JSON.stringify(events.map(x=>[x.id,x.etag,x.updated]))};
 showPreview(plan,local,events);
 safeMessage('差異預覽完成；只有再次確認後才會修改資料。異常或兩邊都修改的項目不會覆蓋。');
}
function saveTodoWithId(fields,eventId){
 const crm=allTodos();
 if(crm.todos.some(x=>x.honbinCalendarEventId===eventId)){
  throw Error('GOOGLE_EVENT_ALREADY_IMPORTED_STOP');
 }
 let id=Date.now()+Math.floor(Math.random()*100000);
 while(crm.todos.some(x=>String(x.id)===String(id)))id++;
 crm.todos.unshift({...fields,id,done:false,honbinCalendarEventId:eventId});
 localStorage.setItem(CRM_KEY,JSON.stringify(crm));
 return crm.todos[0];
}
function patchTodoWithId(todoId,fields){
 const crm=allTodos(),item=crm.todos.find(x=>String(x.id)===String(todoId));
 if(!item)throw Error('CRM_TODO_REMOVED_REPREVIEW');
 // Never clear CRM's internal done or customer relationship fields.
 Object.assign(item,{text:fields.text,date:fields.date,time:fields.time,
  notes:notesWithoutCrmCustomerFooter(fields.notes,item.customerName)});
 localStorage.setItem(CRM_KEY,JSON.stringify(crm));
 return item;
}
async function apply(){
 if(!state.preview||!state.calendarId)throw Error('PREVIEW_REQUIRED');
 const {plan,links,localFingerprint,remoteFingerprint}=state.preview;
 if(!plan.operations.length)throw Error('NOTHING_TO_SYNC');
 const local=allTodos().todos,events=await listEvents();
 if(JSON.stringify(local.map(x=>[x.id,todoFingerprint(x)]))!==localFingerprint||
  JSON.stringify(events.map(x=>[x.id,x.etag,x.updated]))!==remoteFingerprint)
  throw Error('CALENDAR_CHANGED_SINCE_PREVIEW_REVIEW_AGAIN');
 if(!confirm('確定將 '+plan.operations.length+' 筆非衝突差異寫入選定的「'+CAL+'」專用 Google 日曆與 CRM？\n'+
    '雙方衝突 '+plan.conflicts.length+' 筆將保留，不刪除任何資料。'))return;
 $('googleCalendarConfirm').disabled=true;
 let completed=0;
 try{
  for(const op of plan.operations){
   if(op.type==='CREATE_GOOGLE'){
    const todo=local.find(x=>String(x.id)===String(op.todoId));
    if(!todo)throw Error('CRM_TODO_REMOVED_REPREVIEW');
    const remote=await request(eventUrl(state.calendarId),{
     method:'POST',body:JSON.stringify(googleEventFromTodo(todo))});
    if(!remote?.id)throw Error('GOOGLE_INSERT_READBACK_FAILED');
    links[String(todo.id)]={eventId:remote.id,localFingerprint:todoFingerprint(todo),
     remoteFingerprint:eventFingerprint(remote)};
    storeLinks(links);
   }else if(op.type==='IMPORT_TO_CRM'){
    const event=events.find(x=>x.id===op.eventId);
    if(!event)throw Error('GOOGLE_EVENT_REMOVED_REPREVIEW');
    const todo=saveTodoWithId(op.fields,event.id);
    links[String(todo.id)]={eventId:event.id,localFingerprint:todoFingerprint(todo),
     remoteFingerprint:eventFingerprint(event)};
    storeLinks(links);
   }else if(op.type==='UPDATE_GOOGLE'){
    const todo=local.find(x=>String(x.id)===String(op.todoId));
    const event=events.find(x=>x.id===op.eventId);
    if(!todo||!event?.etag)throw Error('EVENT_VERSION_MISSING_STOP');
    const change=googleEventFromTodo(todo);
    const remote=await request(eventUrl(state.calendarId,'/'+encodeURIComponent(op.eventId)),{
     method:'PATCH',headers:{'If-Match':event.etag},body:JSON.stringify(change)});
    links[String(todo.id)]={eventId:remote.id,localFingerprint:todoFingerprint(todo),
     remoteFingerprint:eventFingerprint(remote)};
    storeLinks(links);
   }else if(op.type==='UPDATE_CRM'){
    const event=events.find(x=>x.id===op.eventId);
    if(!event)throw Error('GOOGLE_EVENT_REMOVED_REPREVIEW');
    const todo=patchTodoWithId(op.todoId,op.fields);
    links[String(todo.id)]={eventId:event.id,localFingerprint:todoFingerprint(todo),
     remoteFingerprint:eventFingerprint(event)};
    storeLinks(links);
   }
   completed++;
   safeMessage('已完成 '+completed+'/'+plan.operations.length+' 筆，同步中…');
  }
  state.preview=null;$('googleCalendarPlan').replaceChildren();
  $('googleCalendarConfirm').disabled=true;
  safeMessage('已同步 '+completed+' 筆。請打開 iPhone 原生「行事曆」，確認 Google 帳號的「'+CAL+'」有顯示；目前是按鈕觸發的雙向同步，不會在背景自動同步。');
 }catch(error){
  state.preview=null;$('googleCalendarConfirm').disabled=true;
  throw Error('已完成 '+completed+' 筆後中止；對應記錄已保存，請先重新預覽，勿直接重試。原因：'+String(error.message||error));
 }
}
async function handleClick(action){
 if(state.running)return;
 state.running=true;buttonDisable(true);
 try{
  if(action==='connect')await connectGoogle();
  else if(action==='create')await createDedicatedCalendar();
  else if(action==='preview')await preview();
  else if(action==='apply')await apply();
  else if(action==='disconnect'){
   state.token='';state.expiresAt=0;state.user=null;state.calendarId='';
   state.events=[];state.preview=null;
   $('googleCalendarPlan').replaceChildren();
   safeMessage('已中斷此頁 Google Calendar 的存取權杖。CRM 待辦與 Google 日曆資料均保留。');
  }
 }catch(error){
  // Fail closed: a stale plan must never become confirmable after errors.
  state.preview=null;
  $('googleCalendarConfirm').disabled=true;
  const code=String(error?.message||error);
  const lookup={
   GOOGLE_CALENDAR_API_DISABLED:'Google 回覆：Calendar API 尚未對目前 OAuth 專案啟用（SERVICE_DISABLED）。請確認 Google Cloud 專案 honbin-crm-notes-spark 的 Google Calendar API 狀態；尚未建立日曆。',
   GOOGLE_CALENDAR_SCOPE_DENIED:'Google 回覆：這次授權缺少 Calendar API 必要範圍（INSUFFICIENT_SCOPE）。請檢查 OAuth 同意畫面的授權範圍後重新授權；尚未建立日曆。',
   GOOGLE_CALENDAR_403_UNCLASSIFIED:'Google Calendar API 回覆 HTTP 403，但無法從回應確認是 API 停用或權限問題。尚未建立日曆；請提供這個錯誤代碼，避免盲目更改 Firebase 設定。',
   GOOGLE_SESSION_EXPIRED_CONNECT_AGAIN:'授權已到期，請按「重新連線」後再預覽。',
   GOOGLE_TOKEN_EXPIRED:'Google 授權已失效，請重新連線。',
   GOOGLE_CALENDAR_QUOTA_LIMIT:'Google Calendar API 配額暫時達上限，沒有自動重試。',
   GOOGLE_VERSION_CHANGED_PREVIEW_AGAIN:'Google 行程已被修改，請重新預覽，不會覆寫。',
   CALENDAR_CHANGED_SINCE_PREVIEW_REVIEW_AGAIN:'CRM 或 Google 行事曆資料在預覽後變動，已安全停止，請重新預覽。',
   CALENDAR_CREATION_UNCERTAIN_NO_RETRY:'前一次建立請求可能已被 Google 接受，已禁止直接重試。請先開 Google 日曆核對是否已建立，再重新連線。',
   GOOGLE_CALENDAR_CREATE_READBACK_UNCERTAIN:'建立請求結果不明，請開 Google 日曆核對，不能直接重試以免建立兩本。',
   GOOGLE_CALENDAR_CREATED_WAIT_FOR_LIST:'Google 已回傳新日曆識別碼，但清單尚未更新。請重新連線讀回確認，不要再按建立。'
  };
  safeMessage(lookup[code]||'無法同步（未清除任何資料）：'+code);
 }finally{
  state.running=false;
  $('googleCalendarConnect').disabled=false;
  $('googleCalendarDisconnect').disabled=false;
  $('googleCalendarCreate').disabled=!state.user||!state.token||!!state.calendarId||state.createAttempted||Date.now()>=state.expiresAt;
  $('googleCalendarPreview').disabled=!state.calendarId;
  $('googleCalendarConfirm').disabled=!state.preview?.plan?.operations.length;
 }
}
for(const [id,kind] of [
 ['googleCalendarConnect','connect'],['googleCalendarCreate','create'],['googleCalendarPreview','preview'],
 ['googleCalendarConfirm','apply'],['googleCalendarDisconnect','disconnect']
]){
 const el=$(id);if(el)el.addEventListener('click',()=>void handleClick(kind));
}
$('googleCalendarSelect')?.addEventListener('change',event=>{
 state.calendarId=event.target.value;
 state.preview=null;state.events=[];$('googleCalendarPlan').replaceChildren();
 $('googleCalendarConfirm').disabled=true;
});


// Candidate B: member-owned Google calendar, CRM-assigned shared tasks only.
// No Firestore writes; Google-side edits never mutate shared tasks or bypass approval.
import {assignedTaskCalendarItems,planAssignedTaskCalendar} from './calendar-assigned-tasks-v1.mjs';
let memberPreview=null,memberBusy=false;
const memberBox=document.createElement('div');
memberBox.className='card';
memberBox.style.cssText='margin-top:12px;padding:12px;background:#fff';
memberBox.innerHTML='<h4>指派給我的共用任務 → 我的 Google 日曆（TEST）</h4>'+
 '<p class="muted">只同步指派給目前登入者的任務；共用任務的修改與完成仍須回 CRM 操作。請先預覽再確認。</p>'+
 '<div class="actions"><button type="button" class="secondary" id="memberCalendarPreview">預覽我的指派任務</button>'+
 '<button type="button" id="memberCalendarApply" disabled>確認同步指派任務</button></div>'+
 '<p class="muted" id="memberCalendarStatus" role="status">尚未預覽。</p><div id="memberCalendarChanges"></div>';
$('googleCalendarSync')?.append(memberBox);
const memberStatus=m=>$('memberCalendarStatus').textContent=m;
async function readAssignedMemberTasks(){
 if(!state.user?.uid||!state.calendarId||!state.token||Date.now()>=state.expiresAt)
  throw Error('請先登入並連線自己擁有的專用 Google 日曆');
 const {auth}=googleAuthReady||{};
 if(!auth?.currentUser||auth.currentUser.uid!==state.user.uid)throw Error('ACCOUNT_CHANGED_STOP');
 const sdk=await import('https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js');
 const {groupService}=await import('/honbin-crm-auth-test/firebase-group-service.mjs');
 const db=sdk.getFirestore(auth.app),uid=state.user.uid;
 const groups=groupService({db,sdk,identity:{
  uid,email:auth.currentUser.email,emailVerified:auth.currentUser.emailVerified}});
 const accessible=await groups.listGroupsFromServer();
 if(accessible.length>12)throw Error('群組超過 12 個，為控制免費讀取額度，請分批設計後再啟用');
 const result=[];
 for(const group of accessible){
  const col=sdk.collection(db,'groups',group.id,'tasks');
  const snap=await sdk.getDocsFromServer(sdk.query(col,
   sdk.where('assignedUid','==',uid),sdk.limit(200)));
  if(snap.size===200)throw Error('單一群組指派任務達 200 筆，為避免漏同步已停止');
  if(auth.currentUser?.uid!==uid)throw Error('ACCOUNT_CHANGED_STOP');
  result.push({groupId:group.id,tasks:snap.docs.map(d=>({id:d.id,...d.data()}))});
 }
 return assignedTaskCalendarItems({uid,groups:result})
  .sort((a,b)=>a.sourceKey.localeCompare(b.sourceKey));
}
const memberHash=items=>JSON.stringify(items.map(x=>[
 x.sourceKey,x.title,x.description,x.status,x.executeDate,x.dueDate]));
async function previewMember(){
 memberPreview=null;$('memberCalendarApply').disabled=true;
 const items=await readAssignedMemberTasks();
 const events=await listEvents();
 const plan=planAssignedTaskCalendar({items,events});
 memberPreview={uid:state.user.uid,calendarId:state.calendarId,plan,
  taskHash:memberHash(items),
  remoteHash:JSON.stringify(events.map(x=>[x.id,x.etag,x.updated]))};
 $('memberCalendarChanges').textContent='待新增 '+plan.operations.filter(x=>x.type==='CREATE').length+
  ' 筆、待更新 '+plan.operations.filter(x=>x.type==='UPDATE').length+
  ' 筆、重複衝突 '+plan.conflicts.length+' 筆。';
 $('memberCalendarApply').disabled=plan.operations.length===0;
 memberStatus('唯讀預覽完成；尚未寫入。請確認後再同步。');
}
async function applyMember(){
 if(!memberPreview)throw Error('請先預覽');
 const p=memberPreview;
 memberPreview=null;$('memberCalendarApply').disabled=true;
 if(p.uid!==state.user?.uid||p.calendarId!==state.calendarId)throw Error('ACCOUNT_CHANGED_STOP');
 const items=await readAssignedMemberTasks(),events=await listEvents();
 if(memberHash(items)!==p.taskHash||
  JSON.stringify(events.map(x=>[x.id,x.etag,x.updated]))!==p.remoteHash)
  throw Error('資料已變動，請重新預覽');
 if(!confirm('確定同步 '+p.plan.operations.length+' 筆指派給自己的共用任務到專用 Google 日曆？不會修改 Firestore 任務。'))return;
 let count=0;
 try{
  for(const op of p.plan.operations){
   if(state.user?.uid!==p.uid||state.calendarId!==p.calendarId)
    throw Error('ACCOUNT_CHANGED_STOP');
   if(op.type==='CREATE'){
    await request(eventUrl(state.calendarId),{
     method:'POST',body:JSON.stringify(op.event)});
   }else if(op.type==='UPDATE'){
    if(!op.expectedEtag)throw Error('GOOGLE_EVENT_ETAG_MISSING');
    await request(eventUrl(state.calendarId,'/'+encodeURIComponent(op.eventId)),{
     method:'PATCH',headers:{'If-Match':op.expectedEtag},body:JSON.stringify(op.event)});
   }
   count++;memberStatus('已同步 '+count+'/'+p.plan.operations.length+' 筆。');
  }
  memberStatus('指派任務同步完成 '+count+' 筆。若同事修改 Google 日曆，仍以 CRM 任務為準。');
 }catch(e){throw Error('已完成 '+count+' 筆後停止；請重新預覽，避免重複。'+e.message)}
}
for(const [id,fn] of [['memberCalendarPreview',previewMember],['memberCalendarApply',applyMember]]){
 $(id)?.addEventListener('click',async()=>{
  if(memberBusy||state.running)return;memberBusy=true;
  $('memberCalendarPreview').disabled=true;$('memberCalendarApply').disabled=true;
  try{await fn()}catch(e){memberPreview=null;memberStatus('安全停止：'+e.message)}
  finally{memberBusy=false;$('memberCalendarPreview').disabled=false;
   $('memberCalendarApply').disabled=!memberPreview?.plan?.operations.length}
 });
}
