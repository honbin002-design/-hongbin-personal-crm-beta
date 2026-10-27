import assert from 'node:assert/strict';
import {assignedTaskCalendarItems,taskGoogleEvent,planAssignedTaskCalendar,personalCalendarEvents} from '../calendar-assigned-tasks-v1.mjs';
const groups=[{groupId:'g1',tasks:[
 {id:'a',assignedUid:'u1',title:'拜訪客戶',status:'OPEN',executeDate:'2026-11-05',dueDate:'2026-11-06'},
 {id:'b',assignedUid:'u2',title:'別人的任務',status:'OPEN',dueDate:'2026-11-05'},
 {id:'c',assignedUid:null,title:'開放任務',status:'OPEN',dueDate:'2026-11-05'},
 {id:'d',assignedUid:'u1',title:'未定日期',status:'OPEN'},
 {id:'e',assignedUid:'u1',title:'已完成任務',status:'DONE',dueDate:'2026-11-01'}]}];
const items=assignedTaskCalendarItems({uid:'u1',groups});
assert.deepEqual(items.map(x=>x.taskId),['a','e']);
assert.equal(items[0].startDate,'2026-11-05');
assert.equal(items[0].endDate,'2026-11-06');
assert.equal(taskGoogleEvent(items[1]).summary,'[已完成] 已完成任務');
const plan=planAssignedTaskCalendar({items,events:[]});
assert.equal(plan.operations.length,2);
assert(plan.operations.every(x=>x.type==='CREATE'));
const event={id:'event1',etag:'abc',summary:'old',description:'old',
 start:{date:'2026-11-04'},end:{date:'2026-11-05'},
 extendedProperties:{private:{honbinSource:'firestore-group-task',honbinGroupId:'g1',honbinTaskId:'a'}}};
const updated=planAssignedTaskCalendar({items,events:[event]});
assert.equal(updated.operations.find(x=>x.sourceKey==='g1:a').type,'UPDATE');
const conflict=planAssignedTaskCalendar({items,events:[event,event]});
assert.equal(conflict.conflicts.length,1);
assert(!conflict.operations.some(x=>x.sourceKey==='g1:a'));
console.log('ASSIGNED_CALENDAR_ISOLATION_AND_DIFF_PASS');

const tagged=taskGoogleEvent(items[0]);
const shared={id:'shared1',...tagged};
const personal={id:'personal1',summary:'私人行程',start:{date:'2026-11-05'},end:{date:'2026-11-06'}};
assert.deepEqual(personalCalendarEvents([shared,personal]).map(e=>e.id),['personal1']);
assert.deepEqual(personalCalendarEvents([shared]).map(e=>e.id),[]);
console.log('PERSONAL_CALENDAR_NEVER_IMPORTS_ASSIGNED_TASKS_PASS');
