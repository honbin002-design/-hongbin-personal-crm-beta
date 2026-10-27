import {makeIcsCalendar} from './calendar-ics-export.mjs?v=20261027a';
// Opt-in, local-only ICS. No calendar permissions, Firebase reads or mutations.
const todoKey='hongbin_personal_crm_v3';
const banner=document.getElementById('iphoneCalendarExportStatus');
const say=(text)=>{
 if(!banner)return;
 banner.textContent=text;
 banner.hidden=false;
};
function ownTodos(){
 const data=JSON.parse(localStorage.getItem(todoKey)||'{}');
 if(!Array.isArray(data?.todos))return [];
 return data.todos;
}
let handling=false;
async function exportIcs(kind,id){
 const records=ownTodos();
 const choice=kind==='all'?records:
  kind==='date'?records.filter(x=>x?.date===document.getElementById('tDate')?.value):
  kind==='day'?records.filter(x=>x?.date===window.HonbinSelectedCalendarDate?.()):
  records.filter(x=>String(x?.id)===String(id));
 let items=choice;
 if(kind==='day'){
  const chosen=document.getElementById('selectedDayTitle')?.textContent.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  items=records.filter(x=>x?.date===chosen);
 }
 if(!items.length){say('目前選擇的範圍沒有待辦，不會產生行事曆檔案。');return}
 const {content,count,skipped}=makeIcsCalendar(items);
 const fileName='鴻繽CRM-待辦行事曆-'+
  (kind==='one'?'單筆':kind==='day'?'當日':'全部')+'-'+new Date().toISOString().slice(0,10)+'.ics';
 const file=new File([content],fileName,{type:'text/calendar;charset=utf-8'});
 let shared=false;
 if(typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&
    navigator.canShare({files:[file]})){
  try{
   await navigator.share({files:[file],title:'鴻繽 CRM 待辦行事曆'});
   shared=true;
  }catch(error){
   if(error?.name==='AbortError'){say('已取消分享，CRM 待辦資料未更動。');return}
  }
 }
 if(!shared){
  const url=URL.createObjectURL(file),a=document.createElement('a');
  a.href=url;a.download=fileName;a.hidden=true;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 say('已產生 '+count+' 筆 .ics 行程'+
  (skipped.length?'，略過 '+skipped.length+' 筆日期或時間異常的舊資料':'')+
  '。請於 iPhone 的「檔案」或「郵件」中開啟並匯入行事曆；這不是自動雙向同步，CRM 原始待辦沒有變更。');
}
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('[data-calendar-ics]');
 if(!button||button.disabled||handling)return;
 event.preventDefault();
 handling=true;button.disabled=true;
 try{
  await exportIcs(button.dataset.calendarIcs,button.dataset.calendarTodoId);
 }catch(error){
  say(error?.message==='CALENDAR_EXPORT_NO_VALID_EVENTS'?
   '目前沒有可匯出的有效日期待辦，原始資料保留未變更。':
   '產生行事曆檔失敗，請不要刪除或重設原有待辦。'+String(error?.message||''));
 }finally{handling=false;button.disabled=false}
});
