'use strict';
const {webkit,devices}=require('playwright'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8765/index.html';
const fixtures={
'hongbin_crm_master_r70':{customers:[{name:'測試甲公司',contact:'林小姐',tel:'06-0000000',address:'虛構地址'}],products:[{name:'既有產品',customerName:'測試甲公司'}],suppliers:[]},
'hongbin_personal_crm_v3':{customers:[{id:101,name:'測試甲公司'}],projects:[],todos:[],contacts:[{id:33,who:'舊聯絡記錄'}],commands:[{id:34,task:'舊指令'}],visits:[],quotes:[]},
'hongbin_crm_formal_quotes_r73':[{id:77,fields:{qdNo:'QTEST-001',qdCustomer:'測試甲公司',qdDate:'2026-10-16',qdNotes:'歷史備註'},items:[{name:'舊報價品項',price:100,qty:2}]}],
'hongbin_crm_project_progress_r72':{}
};
let browser,passed=0;
function check(c,m){assert(c,m);passed++;console.log('PASS: '+m)}
(async()=>{
 browser=await webkit.launch({headless:true});
 const ctx=await browser.newContext({...devices['iPhone 13'],acceptDownloads:true,serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept()});
 await page.addInitScript(data=>{for(const [k,v] of Object.entries(data))localStorage.setItem(k,JSON.stringify(v))},fixtures);
 await page.goto(base,{waitUntil:'load'});await page.waitForSelector('#quoteList [data-quote]');
 check(await page.locator('.nav button').count()===5,'僅保留五個主選單');
 check(!await page.locator('button[data-tab="commands"],button[data-tab="suppliers"]').count(),'不存在獨立指令或供應商管理');
 check((await page.locator('#quoteList').innerText()).includes('QTEST-001'),'讀取既有正式報價');
 await page.locator('[data-quote="77"]').click();
 check(await page.locator('#qdCustomer').inputValue()==='測試甲公司','既有報價可開啟編輯');
 await page.locator('#qdNotes').fill('僅修改目前這張');
 await page.locator('#saveQuote').click();
 check((await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_crm_formal_quotes_r73'))[0].fields.qdNotes))==='僅修改目前這張','正式報價可儲存修改');
 await page.locator('#previewQuote').click();
 check((await page.locator('#quotePreviewPages').innerText()).includes('舊報價品項'),'報價預覽與金額呈現');
 await page.addScriptTag({path:require.resolve('html2canvas/dist/html2canvas.min.js')});
 await page.addScriptTag({path:require.resolve('jspdf/dist/jspdf.umd.min.js')});
 await page.locator('#exportPdf').click();
 await page.locator('#pdfNotice a').waitFor({timeout:20000});
 const pdfBits=await page.evaluate(async()=>{const b=await (await fetch(document.querySelector('#pdfNotice a').href)).arrayBuffer();const bytes=new Uint8Array(b),head=String.fromCharCode(...bytes.slice(0,5)),tail=String.fromCharCode(...bytes.slice(-30));return {head,tail,size:bytes.length}});
 check(pdfBits.head==='%PDF-'&&pdfBits.tail.includes('%%EOF')&&pdfBits.size>10000,'新簡易報價單可產生真實 PDF 檔案');

 await page.locator('button[data-tab="customers"]').click();
 check((await page.locator('#customerList').innerText()).includes('測試甲公司'),'舊客戶可讀取');
 await page.locator('#newCustomer').click();await page.locator('#cuName').fill('R74虛構新客戶');await page.locator('#cuContact').fill('陳測試');await page.locator('#saveCustomer').click();
 check(await page.locator('#customerList').innerText().then(t=>t.includes('R74虛構新客戶')),'新增客戶成功');
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_crm_master_r70')).customers.some(x=>x.name==='R74虛構新客戶')),'主資料沿用原本儲存位置');
 await page.locator('button[data-tab="calendar"]').click();
 check(await page.locator('#calendarGrid button.day').count()>=28,'月曆模式具有日期格');
 const originalSelected=(await page.locator('#selectedDayTitle').innerText()).slice(0,7);
 await page.locator('#nextMonth').click();
 const nextMonthTitle=await page.locator('#calTitle').innerText();
 const selectedMonth=(await page.locator('#selectedDayTitle').innerText()).slice(0,7);
 check(nextMonthTitle.includes(String(Number(selectedMonth.slice(5,7)))+' 月')&&selectedMonth!==originalSelected,'切換月份時，選取日期與顯示月曆一致');
 await page.locator('#prevMonth').click();
 check((await page.locator('#selectedDayTitle').innerText()).startsWith(originalSelected),'回到上月可恢復該月待辦');

 await page.locator('#newTodo').click();await page.locator('#tText').fill('R74行事曆事項');await page.locator('#saveTodo').click();
 check((await page.locator('#todoList').innerText()).includes('R74行事曆事項'),'待辦儲存並顯示在選定日期');
 await page.locator('#todoList input[type="checkbox"]').first().check();
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')).todos.some(x=>x.text==='R74行事曆事項'&&x.done)),'待辦完成狀態持久保存');
 await page.locator('button[data-tab="projects"]').click();
 await page.locator('#newProject').click();await page.locator('#pName').fill('R74測試專案');await page.locator('#pCustomer').fill('測試甲公司');await page.locator('#pProgress').selectOption('送樣中');await page.locator('#pNote').fill('第一筆追蹤紀錄');await page.locator('#saveProject').click();
 check((await page.locator('#projectList').innerText()).includes('R74測試專案'),'新專案儲存成功');
 await page.locator('#projectList [data-project]').first().click();
 check((await page.locator('#projectHistory').innerText()).includes('第一筆追蹤紀錄'),'歷史追蹤紀錄保留');
 await page.locator('#pStage').selectOption('暫停');
 await page.locator('#pNote').fill('');
 await page.locator('#saveProject').click();
 await page.locator('#projectList [data-project]').first().click();
 const histItems=await page.locator('#projectHistory .note').count();
 check(histItems>=2&&(await page.locator('#projectHistory').innerText()).includes('暫停'),'專案階段異動即使沒有輸入備註，仍追加歷史');

 await page.locator('button[data-tab="backup"]').click();
 const dlPromise=page.waitForEvent('download');await page.locator('#downloadBackup').click();const download=await dlPromise;
 check(download.suggestedFilename().endsWith('.json'),'可從 iPhone 下載 JSON 備份');
 const jsonBackupPath=await download.path();
 await page.evaluate(()=>{const x=JSON.parse(localStorage.getItem('hongbin_personal_crm_v3'));x.todos=[];localStorage.setItem('hongbin_personal_crm_v3',JSON.stringify(x))});
 await page.locator('#restoreFile').setInputFiles(jsonBackupPath);
 await page.locator('#restoreBackup').click();
 await page.waitForLoadState('load');
 await page.locator('button[data-tab="backup"]').click();
 const restoredTodos=await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')||'{}').todos||[]);
 check(restoredTodos.some(x=>x.text==='R74行事曆事項'),'還原備份可恢復待辦資料；訊息：'+dialogs.slice(-3).join('｜'));


 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')).commands[0].task==='舊指令'),'未顯示的舊資料仍保留');
 // Import older R50 backup without deleting the separate modern master-data key.
 const oldMaster=await page.evaluate(()=>localStorage.getItem('hongbin_crm_master_r70'));
 const r50={version:3,app:'鴻繽科技 CRM',schema:'R50',data:{customers:[{id:501,name:'舊版R50客戶'}],projects:[],todos:[],contacts:[],commands:[],quotes:[],visits:[]}};
 await page.locator('#restoreFile').setInputFiles({name:'legacy-R50.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(r50))});
 await page.locator('#restoreBackup').click();
 await page.waitForLoadState('load');
 await page.locator('button[data-tab="backup"]').click();
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')).customers.some(x=>x.name==='舊版R50客戶')),'R50 舊備份可還原原始 CRM');
 check(await page.evaluate(()=>localStorage.getItem('hongbin_crm_master_r70'))===oldMaster,'R50 還原不覆蓋較新客戶主資料');
 const r70={version:4,app:'鴻繽科技 CRM',schema:'R70',data:{customers:[{id:701,name:'舊版R70客戶'}],projects:[],todos:[],contacts:[],commands:[],quotes:[],visits:[]},masterData:{customers:[{name:'舊版R70客戶',contact:'測試'}],products:[],suppliers:[]},cards:[],settings:{test:true}};
 await page.locator('#restoreFile').setInputFiles({name:'legacy-R70.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(r70))});
 await page.locator('#restoreBackup').click();
 await page.waitForLoadState('load');
 await page.locator('button[data-tab="backup"]').click();
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_crm_master_r70')).customers.some(x=>x.name==='舊版R70客戶')),'R70 舊完整備份可還原客戶主資料');
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')).customers.some(x=>x.name==='舊版R70客戶')),'R70 舊完整備份可還原 CRM');
 const intact=await page.evaluate(()=>localStorage.getItem('hongbin_personal_crm_v3'));
 const broken={version:4,app:'鴻繽科技 CRM',schema:'R70',data:{customers:'無效陣列'},masterData:{customers:[],products:[],suppliers:[]}};
 await page.locator('#restoreFile').setInputFiles({name:'invalid-R70.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(broken))});
 await page.locator('#restoreBackup').click();
 check(await page.evaluate(()=>localStorage.getItem('hongbin_personal_crm_v3'))===intact,'拒絕資料結構錯誤的備份，不覆蓋現有資料');

 check(errors.length===0,'無 JavaScript 執行錯誤：'+errors.join(','));
 console.log('R74 SIMPLE WEBKIT PASS',JSON.stringify({checks:passed,pageErrors:errors}));await browser.close();
})().catch(async e=>{console.error('R74 SIMPLE WEBKIT FAIL',e.stack||String(e));try{await browser?.close()}catch{}process.exitCode=1});
