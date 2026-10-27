import assert from 'node:assert/strict';
import {makeIcsCalendar,normalizeCalendarTodo,escapeIcs,foldIcsLine} from '../calendar-ics-export.mjs';
const stamp=new Date('2026-10-27T00:01:00.000Z');
assert.equal(normalizeCalendarTodo({id:1,date:'2026-02-30',text:'bad'}),null);
assert.equal(normalizeCalendarTodo({id:1,date:'2026-10-27',time:'25:60'}),null);
assert.equal(normalizeCalendarTodo({id:1,date:'2024-02-29',text:'leap'})?.date,'2024-02-29');
assert.equal(escapeIcs('甲,乙;丙\\丁\r\n換行'),'甲\\,乙\\;丙\\\\丁\\n換行');
const sample=[
 {id:12001,text:'客戶會議，測試;摘要',date:'2026-10-27',time:'09:30',
  notes:'第一行\n第二行',customerName:'台南公司',done:false},
 {id:12002,text:'整日提醒',date:'2026-12-31',notes:'\r\n多行',done:true},
 {id:12003,text:'錯誤舊資料',date:'2026-13-01'}
];
const x=makeIcsCalendar(sample,{stamp});
assert.equal(x.count,2);
assert.equal(x.skipped.length,1);
assert.match(x.content,/BEGIN:VCALENDAR\r\nVERSION:2\.0/);
assert.match(x.content,/DTSTART:20261027T013000Z/,'09:30 Taipei = 01:30 UTC');
assert.match(x.content,/DTEND:20261027T023000Z/);
assert.match(x.content,/TRIGGER:-PT15M/);
assert.match(x.content,/DTSTART;VALUE=DATE:20261231/);
assert.match(x.content,/DTEND;VALUE=DATE:20270101/);
assert.match(x.content,/SUMMARY:\[已完成\] 整日提醒/);
assert.match(x.content,/DESCRIPTION:第一行\\n第二行\\n客戶：台南公司/);
assert.equal(makeIcsCalendar(sample,{stamp}).content,x.content,'stable UID + deterministic output');
const idMatches=x.content.match(/UID:hbcrm-[0-9a-f]{16}@calendar\.honbin\.local/g)||[];
assert.equal(new Set(idMatches).size,2);
assert.throws(()=>makeIcsCalendar([{id:9,date:'nonsense'}]),/CALENDAR_EXPORT_NO_VALID_EVENTS/);
assert.throws(()=>makeIcsCalendar(new Array(5001).fill({id:1,date:'2026-10-27'})),/CALENDAR_EXPORT_TOO_MANY_RECORDS/);
const huge='SUMMARY:'+('繁體中文📅，'.repeat(80));
for(const line of foldIcsLine(huge).split('\r\n')){
 assert(new TextEncoder().encode(line).length<=75,'RFC5545 max 75-octet physical lines');
}
console.log('IPHONE_ICS_EXPORT_OFFLINE_NO_WRITES_PASS');
