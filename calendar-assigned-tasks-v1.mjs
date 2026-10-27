// Candidate only: safe projection of Firestore group tasks into each member's
// OWN dedicated Google Calendar. No network, OAuth, Firestore writes or side effects.
// Cloud tasks are never imported back into shared Firestore by calendar edits.
const date=/^\d{4}-\d{2}-\d{2}$/;
const safe=(v,max=1000)=>String(v??'').slice(0,max);
const dayAfter=value=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);
 return d.toISOString().slice(0,10)};
export function assignedTaskCalendarItems({uid,groups=[]}={}){
 if(typeof uid!=='string'||!uid)return [];
 const result=[],seen=new Set();
 for(const group of groups){
  const gid=String(group?.groupId||'');
  if(!gid||!Array.isArray(group.tasks))continue;
  for(const task of group.tasks){
   if(!task?.id||task.assignedUid!==uid||!['OPEN','DONE'].includes(task.status))continue;
   const dateValue=task.executeDate||task.dueDate;
   if(!date.test(dateValue||''))continue; // no fabricated dates
   const sourceKey=gid+':'+task.id;
   if(seen.has(sourceKey))continue;
   seen.add(sourceKey);
   result.push({sourceKey,groupId:gid,taskId:String(task.id),
    title:safe(task.title,120),description:safe(task.description,3000),
    status:task.status,executeDate:task.executeDate||'',dueDate:task.dueDate||'',
    startDate:dateValue,endDate:dayAfter(dateValue),
    updatedAt:task.completedAt||task.createdAt||null});
  }
 }
 return result;
}
export function taskGoogleEvent(item){
 if(!item||!date.test(item.startDate)||!date.test(item.endDate))throw Error('INVALID_TASK_DATE');
 return {summary:(item.status==='DONE'?'[已完成] ':'[共用任務] ')+item.title,
  description:item.description+(item.dueDate?'\n交期：'+item.dueDate:'')+
   '\n此為 CRM 共用任務；請在 CRM 修改或完成，Google 日曆修改不會回寫共用任務。',
  start:{date:item.startDate},end:{date:item.endDate},
  extendedProperties:{private:{
   honbinSource:'firestore-group-task',honbinGroupId:item.groupId,
   honbinTaskId:item.taskId}}};
}
export function planAssignedTaskCalendar({items=[],events=[]}={}){
 const byKey=new Map();
 for(const e of events){
  const p=e?.extendedProperties?.private;
  if(p?.honbinSource!=='firestore-group-task'||!p.honbinGroupId||!p.honbinTaskId)continue;
  const k=p.honbinGroupId+':'+p.honbinTaskId;
  const arr=byKey.get(k)||[];arr.push(e);byKey.set(k,arr);
 }
 const operations=[],conflicts=[];
 for(const item of items){
  const matches=byKey.get(item.sourceKey)||[];
  if(matches.length>1){conflicts.push({sourceKey:item.sourceKey,reason:'DUPLICATE_EVENTS'});continue}
  const wanted=taskGoogleEvent(item);
  if(!matches.length){operations.push({type:'CREATE',sourceKey:item.sourceKey,event:wanted});continue}
  const actual=matches[0];
  // Only CRM-controlled fields are compared. Never remove unrelated calendar events.
  const relevant=e=>JSON.stringify([e.summary,e.description,e.start?.date,e.end?.date]);
  if(relevant(actual)!==relevant(wanted))
   operations.push({type:'UPDATE',sourceKey:item.sourceKey,eventId:actual.id,
    expectedEtag:actual.etag,event:wanted});
 }
 return {operations,conflicts};
}
