'use strict';
const {webkit,chromium,devices}=require('playwright'),assert=require('node:assert/strict');
const {PDFDocument}=require('pdf-lib');
const base='http://127.0.0.1:8765/index.html';
const fixtures={
'hongbin_crm_master_r70':{customers:[{name:'測試甲公司',contact:'林小姐',tel:'06-0000000',address:'虛構地址'}],products:[{name:'既有產品',customerName:'測試甲公司'}],suppliers:[]},
'hongbin_personal_crm_v3':{customers:[{id:101,name:'測試甲公司'}],projects:[{id:810,name:'舊ID專案',customerId:101,stage:'進行中',owner:'林測試'}],todos:[{id:809,text:'舊版未排日期事項',date:'',done:false}],contacts:[{id:33,who:'舊聯絡記錄'}],commands:[{id:34,task:'舊指令'}],visits:[],quotes:[]},
'hongbin_crm_formal_quotes_r73':[{id:77,fields:{qdNo:'QTEST-001',qdCustomer:'測試甲公司',qdDate:'2026-10-16',qdNotes:'歷史備註'},items:[{name:'舊報價品項',price:100,qty:2}]}],
'hongbin_crm_project_progress_r72':{}
};
let browser,passed=0;
function check(c,m){assert(c,m);passed++;console.log('PASS: '+m)}
(async()=>{
 browser=await webkit.launch({headless:true});
 const ctx=await browser.newContext({...devices['iPhone 13'],acceptDownloads:true,serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept()});
 await page.addInitScript(data=>{for(const [k,v] of Object.entries(data))if(localStorage.getItem(k)===null)localStorage.setItem(k,JSON.stringify(v))},fixtures);
 await page.goto(base,{waitUntil:'load'});await page.waitForSelector('#quoteList [data-quote]');
 check(await page.locator('.nav button').count()===7,'包含供應商與產品資料在內的七個功能主選單');
 check(!await page.locator('button[data-tab="commands"],button[data-tab="ocr"]').count(),'沒有恢復已退出的指令、OCR 複雜模組');

 check(await page.locator('#backToTop').isHidden(),'頁面最上方時回頂端按鈕不遮擋操作');
 for(const tab of ['quotes','customers','calendar','projects','suppliers','products','backup']){
   await page.locator('[data-tab="'+tab+'"]').click();
   await page.evaluate(tab=>{const spacer=document.createElement('div');spacer.dataset.scrollTest='1';spacer.style.height='1700px';document.getElementById('panel-'+tab).appendChild(spacer)},tab);
   await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
   await page.waitForFunction(()=>!document.getElementById('backToTop').hidden,{timeout:5000});
   check(await page.locator('#backToTop').isVisible(),'「'+tab+'」頁面向下滾動可見回頂端按鈕');
   await page.locator('#backToTop').click();
   await page.waitForFunction(()=>window.scrollY<10,{timeout:5000});
   check(await page.evaluate(()=>scrollY<10),'「'+tab+'」頁面點擊回頂端可返回最上方');
   await page.locator('#panel-'+tab+' [data-scroll-test]').evaluate(el=>el.remove());
 }
 await page.locator('[data-tab="quotes"]').click();

 check((await page.locator('#quoteList').innerText()).includes('QTEST-001'),'讀取既有正式報價');
 await page.locator('[data-quote="77"]').click();
 check(await page.locator('#qdCustomer').inputValue()==='測試甲公司','既有報價可開啟編輯');

 await page.locator('#qdNo').focus();
 await page.locator('#qdNo').press('Enter');
 check(await page.evaluate(()=>document.activeElement.id==='qdDate'),'報價單按 Enter 跳下一欄');

 await page.locator('#qdNotes').fill('僅修改目前這張');
 await page.locator('#saveQuote').click();
 check((await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_crm_formal_quotes_r73'))[0].fields.qdNotes))==='僅修改目前這張','正式報價可儲存修改');
 await page.locator('#previewQuote').click();
 check((await page.locator('#quotePreviewPages').innerText()).includes('舊報價品項'),'報價預覽與金額呈現');

 const oldPaper=page.locator('#quotePreviewPages .legacy-quote').first();
 check(await oldPaper.count()===1,'報價單已使用原版紙張樣式，不是新版重製格式');
 const headers=await oldPaper.locator('.q-table th').allTextContents();
 check(headers.join('|')==='品名|品號|規格|單價 (NT)|最低訂購量','原本報價單五欄標題與順序完全相同');
 check((await oldPaper.innerText()).includes('Messers.')&&(await oldPaper.innerText()).includes('單筆交易未滿伍仟元整需自行負擔運費'),'原版報價表頭和交易條款保留');
 check(await oldPaper.locator('.q-letterhead-img').evaluate(img=>img.complete&&img.naturalWidth>0),'原版鴻繽公司抬頭圖片正常載入');
 check(await oldPaper.locator('.q-title').innerText()==='報價單','原版報價單標題保留');
 check(await oldPaper.locator('.q-table tbody td').first().evaluate(el=>{const s=getComputedStyle(el);return s.textAlign==='center'&&s.verticalAlign==='middle'}),'報價五欄明細在預覽中水平及垂直置中');

 const expectedFont=(pt,px)=>Math.abs(px-pt*96/72)<0.25;
 const quoteTypography=await oldPaper.evaluate(el=>{
   const names=['.q-party','.q-party-row','.q-table th','.q-table td','.q-terms','.q-notes','.q-notes span','.q-sales','.q-page-no'];
   const sizes=names.map(s=>({selector:s,px:parseFloat(getComputedStyle(el.querySelector(s)).fontSize)}));
   const title=el.querySelector('.q-title'),ts=getComputedStyle(title),under=getComputedStyle(title,'::after');
   return {titlePx:parseFloat(ts.fontSize),decoration:ts.textDecorationLine,
     underlineContent:under.content,underlineDistance:parseFloat(under.marginTop),sizes};
 });
 check(expectedFont(20,quoteTypography.titlePx)&&quoteTypography.decoration==='none'&&
  quoteTypography.underlineContent!=='none'&&quoteTypography.underlineDistance>=7,
  '標題字體為 20pt，底線分離且不與文字重疊');
 check(quoteTypography.sizes.every(x=>expectedFont(16,x.px)),
  '報價預覽中除標題及公司抬頭圖片外，資料、表格、條款、備註、業務代表、頁碼全為 16pt');


 // iOS Safari/WebKit 使用 print media 時，首張報價必須留 25mm 安全高度，
 // 並且絕不能對最後一張設定強制換頁。
 await page.emulateMedia({media:'print'});
 const webkitPrint=await page.evaluate(()=>{
   const shell=document.querySelector('#printRoot .legacy-sheet-shell');
   const paper=document.querySelector('#printRoot .legacy-quote');
   const shellCss=getComputedStyle(shell),paperCss=getComputedStyle(paper);
   return {shellHeight:shell.getBoundingClientRect().height,paperHeight:paper.getBoundingClientRect().height,
     breakAfter:shellCss.breakAfter,paperBreakAfter:paperCss.breakAfter,
     shellCount:document.querySelectorAll('#printRoot .legacy-sheet-shell').length,
     printRootVisible:getComputedStyle(document.getElementById('printRoot')).display!=='none',
     appHidden:getComputedStyle(document.querySelector('.app')).display==='none'};
 });
 check(webkitPrint.printRootVisible&&webkitPrint.appHidden,'Safari 列印時只保留報價單，隱藏非列印介面');
 check(await page.locator('#printRoot .q-table tbody td').first().evaluate(el=>{const s=getComputedStyle(el);return s.textAlign==='center'&&s.verticalAlign==='middle'}),'Safari 列印版報價五欄明細同樣維持置中');

 const printFonts=await page.locator('#printRoot .legacy-quote').first().evaluate(el=>{
  const names=['.q-party','.q-table th','.q-table td','.q-terms','.q-notes','.q-sales','.q-page-no'];
  return {title:parseFloat(getComputedStyle(el.querySelector('.q-title')).fontSize),
   sizes:names.map(s=>parseFloat(getComputedStyle(el.querySelector(s)).fontSize))};
 });
 check(expectedFont(20,printFonts.title)&&printFonts.sizes.every(x=>expectedFont(16,x)),
  'Safari 列印版標題 20pt，其餘文字（包括頁碼）統一為 16pt');

 check(webkitPrint.shellCount===1&&webkitPrint.shellHeight<1040&&webkitPrint.paperHeight<1030,
  'Safari A4 報價紙張預留足夠列印安全高度');
 check(webkitPrint.breakAfter==='auto'&&webkitPrint.paperBreakAfter==='auto',
  'Safari 第一頁與最後一頁都沒有多餘的強制分頁');
 await page.emulateMedia({media:'screen'});


 // 使用真正 Chromium PDF 列印引擎計數，避免「預覽一頁、實際列印第二頁空白」。
 const printBrowser=await chromium.launch({headless:true});
 try{
  const printCtx=await printBrowser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const printPage=await printCtx.newPage();
  await printPage.addInitScript(data=>{for(const [k,v] of Object.entries(data))if(localStorage.getItem(k)===null)localStorage.setItem(k,JSON.stringify(v))},fixtures);
  await printPage.goto(base,{waitUntil:'load'});
  await printPage.locator('[data-quote="77"]').click();
  await printPage.locator('#previewQuote').click();
  await printPage.locator('#quotePreviewPages .q-letterhead-img').first().evaluate(img=>img.decode());
  const paperPrintStyles=await printPage.evaluate(()=>{
   const shell=document.querySelector('#printRoot .legacy-sheet-shell');return {previewPages:document.querySelectorAll('#printRoot .legacy-sheet-shell').length,shellExists:!!shell}
  });
  check(paperPrintStyles.previewPages===1,'只有一個報價頁面 DOM，不是重複產生頁面');
  await printPage.emulateMedia({media:'print'});
  const printLayout=await printPage.evaluate(()=>{
   const app=getComputedStyle(document.querySelector('.app'));
   const shell=document.querySelector('#printRoot .legacy-sheet-shell').getBoundingClientRect();
   return {appHidden:app.display==='none',shellWidth:shell.width,shellHeight:shell.height};
  });
  check(printLayout.appHidden,'列印時隱藏整個非列印介面，沒有多餘頁首與留白');
  check(printLayout.shellHeight<1040&&printLayout.shellWidth<794,'A4 列印容器有足夠 Safari 安全高度，不推擠第二頁');
  const printed=await printPage.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
  const parsed=await PDFDocument.load(printed);
  check(parsed.getPageCount()===1,'實際儲存／列印單筆報價只產生一頁 A4，沒有空白第二頁');
  check(printed.length>10000,'實際列印 PDF 有有效內容');
  await printPage.evaluate(()=>{
   const arr=JSON.parse(localStorage.getItem('hongbin_crm_formal_quotes_r73'));
   arr[0].items=[...arr[0].items,...Array.from({length:4},(_,i)=>({name:'額外品項'+i,model:'TEST',spec:'1kg',qty:1,price:99,moq:'1'}))];
   localStorage.setItem('hongbin_crm_formal_quotes_r73',JSON.stringify(arr));
  });
  await printPage.emulateMedia({media:'screen'});
  await printPage.reload();
  await printPage.locator('[data-quote="77"]').click();
  await printPage.locator('#previewQuote').click();
  check(await printPage.locator('#printRoot .legacy-sheet-shell').count()===2,'五筆品項按既有四項一頁規則拆成兩張紙');
  await printPage.emulateMedia({media:'print'});
  const printed2=await printPage.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
  check((await PDFDocument.load(printed2)).getPageCount()===2,'真正雙頁報價只列印兩頁，不額外產生第三張空白紙');
 }finally{await printBrowser.close()}


 await page.addScriptTag({path:require.resolve('html2canvas/dist/html2canvas.min.js')});
 await page.addScriptTag({path:require.resolve('jspdf/dist/jspdf.umd.min.js')});
 // 模擬 iPhone 支援 Web Share Files 時，按一下下載就直接送出 PDF。
 await page.evaluate(()=>{
   window.__sharePdf=null;
   Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files?.[0]?.type==='application/pdf'});
   Object.defineProperty(navigator,'share',{configurable:true,value:async({files,title})=>{
     const file=files[0],buf=new Uint8Array(await file.arrayBuffer());
     window.__sharePdfRaw=buf;
     window.__sharePdf={name:file.name,title,type:file.type,size:buf.length,
       header:String.fromCharCode(...buf.slice(0,5)),tail:String.fromCharCode(...buf.slice(-30))};
   }});
 });
 const pdfPopups=[];page.on('popup',popup=>pdfPopups.push(popup));
 await page.locator('#exportPdf').click();
 await page.waitForFunction(()=>window.__sharePdf!==null,{timeout:20000});
 const sharedPdf=await page.evaluate(()=>window.__sharePdf);
 check(sharedPdf.header==='%PDF-'&&sharedPdf.tail.includes('%%EOF')&&sharedPdf.size>10000,'分享選單收到真正 PDF 二進位檔');
 check(sharedPdf.name==='報價單_QTEST-001.pdf'&&sharedPdf.type==='application/pdf','PDF 以原報價編號命名並傳遞正確檔案類型');
 check(await page.locator('#pdfNotice a').count()===0,'按下載 PDF 不再顯示小字開啟／下載連結');
 check(pdfPopups.length===0,'按下載 PDF 不會開啟新分頁或新視窗');
 check((await page.locator('#pdfNotice').innerText()).includes('分享選單'),'支援分享選單時顯示正確狀態');

 // 預覽的「列印」必須提供原生 PDF 檔，不得呼叫 Safari 網頁 window.print 產生網址／日期頁尾。
 await page.evaluate(()=>{window.__sharePdfRaw=null;window.__printCallCount=0;window.print=()=>{window.__printCallCount++}});
 await page.locator('#printQuote').click();
 await page.waitForFunction(()=>!!window.__sharePdfRaw,{timeout:20000});
 const cleanOne=await page.evaluate(()=>Array.from(window.__sharePdfRaw));
 check((await PDFDocument.load(Uint8Array.from(cleanOne))).getPageCount()===1,'按預覽中的列印鍵，實際分享的 PDF 只有一頁');
 check(await page.evaluate(()=>window.__printCallCount===0),'列印鍵不再呼叫 Safari 網頁列印，避免網址與日期頁尾');
 check((await page.locator('#printNotice').innerText()).includes('「列印」'),'列印流程清楚提示從 PDF 分享選單選擇列印');
 await page.evaluate(()=>{
  for(let i=0;i<4;i++){
   document.getElementById('addQuoteItem').click();
   const items=document.querySelectorAll('#quoteItems .items');
   items[items.length-1].querySelector('.it-name').value='第二頁測試品項'+i;
  }
  window.__sharePdfRaw=null;
 });
 await page.locator('#printQuote').click();
 await page.waitForFunction(()=>!!window.__sharePdfRaw,{timeout:20000});
 const cleanTwo=await page.evaluate(()=>Array.from(window.__sharePdfRaw));
 check((await PDFDocument.load(Uint8Array.from(cleanTwo))).getPageCount()===2,'列印鍵對五筆品項輸出正確兩頁 PDF，沒有多出空白頁');
 check(await page.evaluate(()=>window.__printCallCount===0),'雙頁列印也不會觸發 Safari 網頁列印頁尾');
 await page.evaluate(()=>{for(let i=0;i<4;i++)document.querySelector('#quoteItems .items:last-child .removeItem').click()});

 // 不支援原生 Web Share 的瀏覽器直接下載；同樣不需要第二次點擊連結。
 await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined})});
 const directDownloadPromise=page.waitForEvent('download',{timeout:20000});
 await page.locator('#exportPdf').click();
 const directDownload=await directDownloadPromise;
 check(directDownload.suggestedFilename()==='報價單_QTEST-001.pdf','不支援 Web Share 時直接觸發 PDF 下載');
 check((await page.locator('#pdfNotice').innerText()).includes('已啟動 PDF 下載'),'自動下載顯示下載狀態');
 check(await page.locator('#pdfNotice a').count()===0&&pdfPopups.length===0,'兩種下載方式都沒有第二個連結或新視窗');

 await page.locator('button[data-tab="customers"]').click();
 check((await page.locator('#customerList').innerText()).includes('測試甲公司'),'舊客戶可讀取');
 await page.locator('#newCustomer').click();await page.locator('#cuName').fill('R74虛構新客戶');await page.locator('#cuContact').fill('陳測試');await page.locator('#saveCustomer').click();
 check(await page.locator('#customerList').innerText().then(t=>t.includes('R74虛構新客戶')),'新增客戶成功');
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_crm_master_r70')).customers.some(x=>x.name==='R74虛構新客戶')),'主資料沿用原本儲存位置');

 await page.locator('[data-customer="測試甲公司"]').click();
 check((await page.locator('#customer360Content').innerText()).includes('QTEST-001'),'既有報價自動彙整到客戶完整資料');
 check((await page.locator('#customer360Content').innerText()).includes('既有產品'),'已儲存客戶使用產品自動顯示');
 check((await page.locator('#customer360Content').innerText()).includes('舊ID專案'),'使用客戶 ID 的舊專案也能顯示在客戶資料');

 check(await page.locator('#customerListCard').isHidden(),'查看完整資料時，其他客戶清單不再留在上方');
 check(await page.locator('#customer360').isVisible(),'選定客戶的完整資料單獨顯示');
 check((await page.locator('#customer360Title').innerText())==='測試甲公司','客戶標題只顯示公司名稱，不會與頁面名稱擠在一起');
 check(await page.locator('#closeCustomer360').evaluate(el=>getComputedStyle(el).whiteSpace==='nowrap'&&el.getBoundingClientRect().width>=70),'iPhone 關閉按鈕維持橫向完整文字');
 const infoKeys=await page.locator('#customer360Content .customer-info-key').allTextContents();
 check(infoKeys.includes('聯絡人')&&infoKeys.includes('公司電話'),'聯絡人和公司電話分列顯示，避免擠成單行');
 check(await page.locator('#customer360Content .customer-info-row').count()>=2,'客戶聯絡資訊每項各自呈現');
 check(await page.locator('#customer360Content .customer360-block.is-empty').count()>=1,'沒有紀錄的區塊使用精簡版面');
 check(await page.locator('#customer360Content .customer360-block').first().count()===1,'客戶完整資料保留分區');

 await page.locator('#closeCustomer360').click();
 check(await page.locator('#customer360').isHidden(),'按關閉後客戶詳細資料收起');
 check(await page.locator('#customerListCard').isVisible(),'按關閉後可回到客戶清單');


 await page.locator('button[data-tab="calendar"]').click();
 check(await page.locator('#calendarGrid button.day').count()>=28,'月曆模式具有日期格');
 check((await page.locator('#todoList').innerText()).includes('舊版未排日期事項'),'舊版未指定日期待辦仍可看到');
 check(await page.evaluate(()=>{
  const btn=document.getElementById('newTodo'),grid=document.getElementById('calendarGrid');
  return !!btn&&document.querySelectorAll('#newTodo').length===1&&
    !!(btn.compareDocumentPosition(grid)&Node.DOCUMENT_POSITION_FOLLOWING)&&
    btn.closest('.calendarQuickAdd')!==null;
 }),'新增當日待辦按鈕位於月曆上方，不再落在清單最底部');
 check((await page.locator('#todoList .todo-time.unscheduled').first().innerText())==='未設定時間',
  '舊版未排日期待辦仍保留且清楚顯示未設定時間');

 const originalSelected=(await page.locator('#selectedDayTitle').innerText()).slice(0,7);
 await page.locator('#nextMonth').click();
 const nextMonthTitle=await page.locator('#calTitle').innerText();
 const selectedMonth=(await page.locator('#selectedDayTitle').innerText()).slice(0,7);
 check(nextMonthTitle.includes(String(Number(selectedMonth.slice(5,7)))+' 月')&&selectedMonth!==originalSelected,'切換月份時，選取日期與顯示月曆一致');
 await page.locator('#prevMonth').click();
 check((await page.locator('#selectedDayTitle').innerText()).startsWith(originalSelected),'回到上月可恢復該月待辦');

 await page.locator('#calendarYear').selectOption('2028');
 check((await page.locator('#calTitle').innerText()).includes('2028 年'),'可用年份選單快速跳到指定年');
 await page.locator('#calendarMonth').selectOption('5');
 check((await page.locator('#calTitle').innerText()).includes('5 月'),'可快速選擇指定月份');
 const beforeSwipe=await page.locator('#calTitle').innerText();
 await page.evaluate(()=>{
   const el=document.getElementById('calendarSwipeArea'),mk=(type,changed)=>{const e=new Event(type,{bubbles:true});Object.defineProperty(e,type==='touchstart'?'touches':'changedTouches',{value:[{clientX:changed,clientY:180}]});return e};
   el.dispatchEvent(mk('touchstart',240));el.dispatchEvent(mk('touchend',95));
 });
 check((await page.locator('#calTitle').innerText())!==beforeSwipe,'在月曆向左滑動會進入下個月');
 await page.locator('#calendarToday').click();
 check((await page.locator('#selectedDayTitle').innerText()).startsWith(originalSelected),'點回今天能回到目前月曆');


 await page.locator('#newTodo').click();
 await page.locator('#tDate').focus();await page.locator('#tDate').press('Enter');
 check(await page.evaluate(()=>document.activeElement.id==='tTime'),'待辦日期按 Enter 跳到時間欄');
 await page.locator('#tTime').fill('14:30');
 await page.locator('#tTime').press('Enter');
 check(await page.evaluate(()=>document.activeElement.id==='tCustomer'),'待辦時間按 Enter 跳到關聯客戶欄');
 await page.locator('#tCustomer').press('Enter');
 check(await page.evaluate(()=>document.activeElement.id==='tText'),'關聯客戶按 Enter 跳到待辦事項欄');
 await page.locator('#tText').fill('R74行事曆事項');
 await page.locator('#tCustomer').fill('測試甲公司');
 await page.locator('#saveTodo').click();
 check((await page.locator('#todoList').innerText()).includes('14:30'),'行事曆正確顯示時間');
 check(await page.locator('#todoList .task .todo-time').filter({hasText:'14:30'}).first().evaluate(el=>{
   const cs=getComputedStyle(el),name=el.closest('.todo-task-main').querySelector('.listTitle');
   return el.textContent==='時間：14:30'&&parseFloat(cs.fontSize)>=17&&
     Number(cs.fontWeight)>=700&&el.getBoundingClientRect().bottom<name.getBoundingClientRect().top;
 }),'待辦時間獨立顯示且文字較大、加粗，與事項分行排列');
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')).todos.some(x=>x.text==='R74行事曆事項'&&x.time==='14:30')),'待辦時間持久保存');
 check((await page.locator('#todoList').innerText()).includes('R74行事曆事項'),'待辦儲存並顯示在選定日期');
 check((await page.locator('#todoList').innerText()).includes('14:30'),'待辦時間頁面不需要備份即可查看');
 await page.locator('#todoList input[type="checkbox"]').first().check();
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')).todos.some(x=>x.text==='R74行事曆事項'&&x.done)),'待辦完成狀態持久保存');
 await page.locator('button[data-tab="projects"]').click();
 await page.locator('#projectSearch').fill('舊ID專案');
 check((await page.locator('#projectList').innerText()).includes('測試甲公司'),'舊版只有 customerId 的專案正確顯示客戶');
 await page.locator('#projectList [data-project]').first().click();
 check((await page.locator('#pCustomer').inputValue())==='測試甲公司','舊版只有 customerId 的專案可打開編輯且不遺失客戶');
 await page.locator('#cancelProject').click();
 await page.locator('#projectSearch').fill('');

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

 // 日期顯示要以台灣時間呈現，不改既有 ISO 追蹤記錄的儲存值。
 check(await page.evaluate(()=>
  readableHistoryTime('2026-10-19T01:15:23.123Z')==='2026/10/19 09:15'&&
  readableHistoryTime('2026-10-19 08:30')==='2026/10/19 08:30'&&
  readableHistoryTime('舊版未記錄日期')==='舊版未記錄日期'&&
  readableHistoryTime('')==='未記錄時間'
 ),'歷史 ISO 時間換算台灣時間，舊版日期可閱讀，未記錄者不顯示無效時間');
 await page.evaluate(()=>{
  const key='hongbin_crm_simple_project_history_r74',hist=JSON.parse(localStorage.getItem(key));
  const entries=Object.values(hist).find(a=>Array.isArray(a)&&a.some(x=>x.note==='第一筆追蹤紀錄'));
  if(!entries)throw new Error('歷史測試紀錄不存在');
  entries.find(x=>x.note==='第一筆追蹤紀錄').date='2026-10-19T01:15:23.123Z';
  localStorage.setItem(key,JSON.stringify(hist));
 });
 await page.locator('#projectList [data-project]').first().click();
 check((await page.locator('#projectHistory').innerText()).includes('2026/10/19 09:15')&&
  !(await page.locator('#projectHistory').innerText()).includes('2026-10-19T01:15:23.123Z'),
  '歷史追蹤紀錄顯示為清楚的台灣本地日期時間，不直接露出 ISO UTC 字串');
 check(await page.evaluate(()=>{
  const hist=JSON.parse(localStorage.getItem('hongbin_crm_simple_project_history_r74'));
  return Object.values(hist).some(a=>Array.isArray(a)&&a.some(x=>x.date==='2026-10-19T01:15:23.123Z'));
 }),'只格式化顯示，原始追蹤時間與歷史紀錄內容不被修改');


 await page.locator('button[data-tab="suppliers"]').click();
 await page.locator('#newSupplier').click();
 await page.locator('#suName').fill('R73測試供應商');
 await page.locator('#suContact').fill('陳測試');
 await page.locator('#saveSupplier').click();
 check((await page.locator('#supplierList').innerText()).includes('R73測試供應商'),'新增供應商成功');
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_crm_master_r70')).suppliers.some(x=>x.name==='R73測試供應商')),'供應商存進既有主資料且不覆蓋客戶');
 await page.locator('button[data-tab="products"]').click();
 await page.locator('#newProduct').click();
 await page.locator('#pdSupplier').fill('R73');
 await page.locator('#pdSupplier').focus();
 check((await page.locator('#smartSuggestions').innerText()).includes('R73測試供應商'),'供應商輸入欄會顯示可點選候選清單');
 await page.locator('#smartSuggestions button').filter({hasText:'R73測試供應商'}).first().click();
 check(await page.locator('#pdSupplier').inputValue()==='R73測試供應商','候選選項點選後自動帶入');
 await page.locator('#pdName').fill('R73客戶使用產品');
 await page.locator('#pdModel').fill('PU-T73');
 await page.locator('#pdCustomer').fill('測試甲公司');
 await page.locator('#pdSpec').fill('1kg');
 await page.locator('#saveProduct').click();
 check((await page.locator('#productList').innerText()).includes('R73客戶使用產品'),'新產品可以新增並在產品資料查詢');
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_crm_master_r70')).products.some(x=>x.name==='R73客戶使用產品'&&x.customerName==='測試甲公司')),'客戶使用產品關聯儲存成功');
 await page.locator('button[data-tab="customers"]').click();
 await page.locator('[data-customer="測試甲公司"]').click();
 const overview=await page.locator('#customer360Content').innerText();
 check(['R73客戶使用產品','QTEST-001','R74測試專案','R74行事曆事項'].every(t=>overview.includes(t)),'客戶完整資料同時彙整產品、報價、專案、待辦');
 check(overview.includes('14:30'),'客戶待辦紀錄含設定的時間');
 await page.locator('#addCustomerProduct').click();
 check(await page.locator('#pdCustomer').inputValue()==='測試甲公司','從客戶頁新增使用產品自動帶入該客戶');
 await page.locator('#cancelProduct').click();


 await page.locator('button[data-tab="backup"]').click();
 const dlPromise=page.waitForEvent('download');await page.locator('#downloadBackup').click();const download=await dlPromise;
 check(download.suggestedFilename().endsWith('.json'),'可從 iPhone 下載 JSON 備份');
 const jsonBackupPath=await download.path();
 await page.evaluate(()=>{const x=JSON.parse(localStorage.getItem('hongbin_personal_crm_v3'));x.todos=[];localStorage.setItem('hongbin_personal_crm_v3',JSON.stringify(x))});
 await page.locator('#restoreFile').setInputFiles(jsonBackupPath);
 await Promise.all([page.waitForEvent('load',{timeout:15000}),page.locator('#restoreBackup').click()]);
 await page.locator('button[data-tab="backup"]').click();
 const restoredTodos=await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')||'{}').todos||[]);
 check(restoredTodos.some(x=>x.text==='R74行事曆事項'),'還原備份可恢復待辦資料；訊息：'+dialogs.slice(-3).join('｜'));


 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')).commands[0].task==='舊指令'),'未顯示的舊資料仍保留');
 // Import older R50 backup without deleting the separate modern master-data key.
 const oldMaster=await page.evaluate(()=>localStorage.getItem('hongbin_crm_master_r70'));
 const r50={version:3,app:'鴻繽科技 CRM',schema:'R50',data:{customers:[{id:501,name:'舊版R50客戶'}],projects:[],todos:[],contacts:[],commands:[],quotes:[],visits:[]}};
 await page.locator('#restoreFile').setInputFiles({name:'legacy-R50.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(r50))});
 await Promise.all([page.waitForEvent('load',{timeout:15000}),page.locator('#restoreBackup').click()]);
 await page.locator('button[data-tab="backup"]').click();
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')).customers.some(x=>x.name==='舊版R50客戶')),'R50 舊備份可還原原始 CRM');
 check(await page.evaluate(()=>localStorage.getItem('hongbin_crm_master_r70'))===oldMaster,'R50 還原不覆蓋較新客戶主資料');
 const r70={version:4,app:'鴻繽科技 CRM',schema:'R70',data:{customers:[{id:701,name:'舊版R70客戶'}],projects:[],todos:[],contacts:[],commands:[],quotes:[],visits:[]},masterData:{customers:[{name:'舊版R70客戶',contact:'測試'}],products:[],suppliers:[]},cards:[],settings:{test:true}};
 await page.locator('#restoreFile').setInputFiles({name:'legacy-R70.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(r70))});
 await Promise.all([page.waitForEvent('load',{timeout:15000}),page.locator('#restoreBackup').click()]);
 await page.locator('button[data-tab="backup"]').click();
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_crm_master_r70')).customers.some(x=>x.name==='舊版R70客戶')),'R70 舊完整備份可還原客戶主資料');
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')).customers.some(x=>x.name==='舊版R70客戶')),'R70 舊完整備份可還原 CRM');
 const intact=await page.evaluate(()=>localStorage.getItem('hongbin_personal_crm_v3'));
 const broken={version:4,app:'鴻繽科技 CRM',schema:'R70',data:{customers:'無效陣列'},masterData:{customers:[],products:[],suppliers:[]}};
 await page.locator('#restoreFile').setInputFiles({name:'invalid-R70.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(broken))});
 await page.locator('#restoreBackup').click();
 check(await page.evaluate(()=>localStorage.getItem('hongbin_personal_crm_v3'))===intact,'拒絕資料結構錯誤的備份，不覆蓋現有資料');

 check(errors.length===0,'無 JavaScript 執行錯誤：'+errors.join(','));
 console.log('R73 SIMPLE ACCEPTANCE WEBKIT PASS',JSON.stringify({checks:passed,pageErrors:errors}));await browser.close();
})().catch(async e=>{console.error('R73 SIMPLE ACCEPTANCE WEBKIT FAIL',e.stack||String(e));try{await browser?.close()}catch{}process.exitCode=1});
