/**
 * HONBIN CRM calendar sync: pure, side-effect-free reconciliation.
 * Never accesses iOS calendars, Google tokens, localStorage or Firestore.
 * The caller must explicitly authorize every proposed operation.
 * No deletes are ever proposed. Dedicated Google calendar only.
 */
export const CALENDAR_TIME_ZONE='Asia/Taipei';
const text=v=>String(v??'').trim();
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const timePattern=/^([01]\d|2[0-3]):[0-5]\d$/;
const safeDate=v=>datePattern.test(text(v))&&Number.isFinite(Date.parse(text(v)+'T12:00:00Z'));
const addDay=d=>{const v=new Date(d+'T12:00:00Z');v.setUTCDate(v.getUTCDate()+1);return v.toISOString().slice(0,10)};
export function normalizeTodo(todo){
 if(!todo||todo.id==null||!safeDate(todo.date))return null;
 return {id:String(todo.id),text:text(todo.text),date:text(todo.date),
  time:timePattern.test(text(todo.time))?text(todo.time):'',
  notes:text(todo.notes),done:!!todo.done,
  customerName:text(todo.customerName)};
}
export function todoFingerprint(todo){
 const t=normalizeTodo(todo);
 return t?JSON.stringify([t.text,t.date,t.time,t.notes,t.done,t.customerName]):null;
}
export function googleEventFromTodo(todo){
 const t=normalizeTodo(todo);if(!t)throw Error('Invalid dated CRM todo');
 const start=t.time?{dateTime:t.date+'T'+t.time+':00+08:00',timeZone:CALENDAR_TIME_ZONE}:{date:t.date};
 const end=t.time?{dateTime:new Date(Date.parse(t.date+'T'+t.time+':00+08:00')+3600000).toISOString(),timeZone:CALENDAR_TIME_ZONE}:{date:addDay(t.date)};
 return {summary:t.text||'未命名待辦',description:[t.notes,t.customerName?'客戶：'+t.customerName:''].filter(Boolean).join('\n'),
  start,end,extendedProperties:{private:{honbinCrmTodoId:t.id,honbinCrmSource:'crm'}}};
}
function eventFields(event){
 if(!event||event.status==='cancelled')return null;
 const start=event.start||{},value=text(start.date||start.dateTime).slice(0,10);
 if(!safeDate(value))return null;
 // Only a time in the explicit Taipei offset can be imported without
 // ambiguity. All-day Google events are safe.
 let time='';
 if(start.dateTime){
  const m=text(start.dateTime).match(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d):\d\d\+08:00$/);
  if(!m)return null;
  time=m[1]+':'+m[2];
 }
 const description=text(event.description);
 return {text:text(event.summary)||'未命名待辦',date:value,time,
  notes:description,done:false,customerName:''};
}
export function eventFingerprint(event){
 const t=eventFields(event);
 return t?JSON.stringify([t.text,t.date,t.time,t.notes]):null;
}
export function planCalendarSync({todos=[],events=[],links={}}={}){
 const local=new Map(todos.map(t=>[String(t?.id),t]).filter(([id,t])=>t&&id!=='undefined'));
 const remote=new Map(events.filter(e=>e?.id).map(e=>[String(e.id),e]));
 const operations=[],conflicts=[],skipped=[],linkedEvents=new Set();
 for(const [id,link] of Object.entries(links||{})){
  if(!link?.eventId)continue;
  const eventId=String(link.eventId),todo=local.get(id),event=remote.get(eventId);
  linkedEvents.add(eventId);
  if(!todo||!event||event.status==='cancelled'){
   conflicts.push({todoId:id,eventId,reason:!todo?'CRM_RECORD_MISSING':'GOOGLE_EVENT_MISSING_OR_CANCELLED'});
   continue;
  }
  const localNow=todoFingerprint(todo),remoteNow=eventFingerprint(event);
  if(!localNow||!remoteNow){conflicts.push({todoId:id,eventId,reason:'UNSUPPORTED_DATE_OR_TIME'});continue}
  const localChanged=localNow!==link.localFingerprint;
  const remoteChanged=remoteNow!==link.remoteFingerprint;
  if(localChanged&&remoteChanged){conflicts.push({todoId:id,eventId,reason:'BOTH_CHANGED'});continue}
  if(localChanged)operations.push({type:'UPDATE_GOOGLE',todoId:id,eventId});
  else if(remoteChanged)operations.push({type:'UPDATE_CRM',todoId:id,eventId,fields:eventFields(event)});
 }
 for(const [id,todo] of local){
  if(Object.hasOwn(links,id))continue;
  if(todoFingerprint(todo))operations.push({type:'CREATE_GOOGLE',todoId:id});
  else skipped.push({todoId:id,reason:'NO_VALID_DATE'});
 }
 for(const [eventId,event] of remote){
  if(linkedEvents.has(eventId)||event.status==='cancelled')continue;
  const ownerId=text(event.extendedProperties?.private?.honbinCrmTodoId);
  if(ownerId&&local.has(ownerId)){
   // A mapping might have been lost on another device: never create duplicate.
   conflicts.push({todoId:ownerId,eventId,reason:'UNLINKED_EXISTING_CRM_EVENT'});
   continue;
  }
  const fields=eventFields(event);
  if(fields)operations.push({type:'IMPORT_TO_CRM',eventId,fields});
  else skipped.push({eventId,reason:'UNSUPPORTED_DATE_OR_TIME'});
 }
 return {operations,conflicts,skipped};
}
