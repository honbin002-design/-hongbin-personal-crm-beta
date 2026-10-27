/**
 * Private iPhone Calendar event export (RFC 5545).
 * Runs entirely in this device; no server, no account, no automatic import.
 * Recurring import is NOT bidirectional sync. Stable UID aids recipient dedupe
 * but Apple Calendar import behavior is controlled by iOS.
 */
const validDate=(value)=>{
 const t=String(value??'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(t))return false;
 const v=new Date(t+'T12:00:00Z');
 return !Number.isNaN(v.getTime())&&v.toISOString().slice(0,10)===t;
};
const validTime=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value??''));
const dateCompact=s=>s.replaceAll('-','');
const utcStamp=date=>date.toISOString().replaceAll('-','').replaceAll(':','').replace(/\.\d{3}Z$/,'Z');
function addOneDay(day){
 const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);
 return d.toISOString().slice(0,10);
}
function utcForTaipei(date,time){
 const value=new Date(date+'T'+time+':00+08:00');
 if(Number.isNaN(value.getTime()))throw Error('CALENDAR_INVALID_TIME');
 return value;
}
export function escapeIcs(value){
 return String(value??'').replace(/\r\n?/g,'\n').replace(/\\/g,'\\\\')
  .replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
}
const encoder=new TextEncoder();
/** RFC 5545 content lines <=75 UTF-8 octets incl continuation prefix. */
export function foldIcsLine(line){
 const chunks=[];let piece='',octets=0;
 for(const ch of String(line)){
  const length=encoder.encode(ch).length;
  if(octets+length>75&&piece){chunks.push(piece);piece=' ';octets=1}
  piece+=ch;octets+=length;
 }
 if(piece)chunks.push(piece);
 return chunks.join('\r\n');
}
function stableUid(value){
 const raw=String(value),bytes=encoder.encode(raw);
 let hash=0xcbf29ce484222325n;
 for(const b of bytes)hash=BigInt.asUintN(64,(hash^BigInt(b))*0x100000001b3n);
 return 'hbcrm-'+hash.toString(16).padStart(16,'0')+'@calendar.honbin.local';
}
export function normalizeCalendarTodo(todo){
 if(!todo||todo.id==null||!validDate(todo.date))return null;
 const time=String(todo.time||'').trim();
 if(time&&!validTime(time))return null; // do not silently alter timestamps
 return {
  id:String(todo.id),date:String(todo.date),time,
  text:String(todo.text||'未命名待辦'),
  notes:String(todo.notes||''),
  customerName:String(todo.customerName||''),
  done:!!todo.done
 };
}
export function makeIcsCalendar(todos,{stamp=new Date()}={}){
 const input=Array.isArray(todos)?todos:[];
 if(input.length>5000)throw Error('CALENDAR_EXPORT_TOO_MANY_RECORDS');
 if(Number.isNaN(stamp.getTime()))throw Error('CALENDAR_EXPORT_BAD_TIMESTAMP');
 const entries=[],skipped=[];
 for(const raw of input){
  const item=normalizeCalendarTodo(raw);
  if(!item){skipped.push({id:raw?.id??null,reason:'INVALID_DATE_OR_TIME'});continue}
  const summary=item.done?'[已完成] '+item.text:item.text;
  const description=[item.notes,item.customerName?'客戶：'+item.customerName:''].filter(Boolean).join('\n');
  const lines=['BEGIN:VEVENT','UID:'+stableUid(item.id),'DTSTAMP:'+utcStamp(stamp),
   'SUMMARY:'+escapeIcs(summary),'DESCRIPTION:'+escapeIcs(description)];
  if(item.time){
   const start=utcForTaipei(item.date,item.time),end=new Date(start.getTime()+3600000);
   lines.push('DTSTART:'+utcStamp(start),'DTEND:'+utcStamp(end));
   if(!item.done)lines.push('BEGIN:VALARM','ACTION:DISPLAY',
    'DESCRIPTION:'+escapeIcs(item.text),'TRIGGER:-PT15M','END:VALARM');
  }else{
   lines.push('DTSTART;VALUE=DATE:'+dateCompact(item.date),
    'DTEND;VALUE=DATE:'+dateCompact(addOneDay(item.date)));
  }
  lines.push('END:VEVENT');
  entries.push({id:item.id,lines});
 }
 if(!entries.length)throw Error('CALENDAR_EXPORT_NO_VALID_EVENTS');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0',
  'PRODID:-//HONBIN TECHNOLOGY//CRM iPhone Calendar Export//ZH-TW',
  'CALSCALE:GREGORIAN','METHOD:PUBLISH',
  'X-WR-CALNAME:'+escapeIcs('鴻繽 CRM 待辦'),
  ...entries.flatMap(e=>e.lines),'END:VCALENDAR'];
 return {content:lines.map(foldIcsLine).join('\r\n')+'\r\n',
  count:entries.length,skipped,ids:entries.map(e=>e.id)};
}
