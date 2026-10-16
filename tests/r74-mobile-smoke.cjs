'use strict';
const {webkit,devices}=require('playwright');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:8765';
const master={customers:[{name:'R74測試客戶甲',address:'台南測試路',tel:'06-0000000',contact:'林測試',taxId:'12345678'},{name:'R74測試客戶乙',contact:'王測試'}],products:[{customerName:'R74測試客戶甲',name:'R74測試產品',customerPartNo:'C-PART-1',supplierPartNo:'S-PART-1',supplierName:'R74測試供應商',unit:'kg',price:150}],suppliers:[{supplierName:'R74測試供應商',name:'R74測試產品',partNo:'S-PART-1',package:'20kg',unit:'kg'}]};
const crm={customers:[{id:101,name:'R74測試客戶甲'},{id:102,name:'R74測試客戶乙'}],projects:[{id:201,name:'R74專案測試',customerId:101,customerName:'R74測試客戶甲',stage:'進行中',progress:'送樣中',owner:'測試'}],visits:[{id:501,customerId:101,customerName:'R74測試客戶甲',date:'2026-10-16',note:'R74拜訪測試',next:'一週後追蹤'}],contacts:[{id:401,who:'已存在的追蹤',customerId:101,customerName:'R74測試客戶甲',note:'正常追蹤'}],quotes:[],todos:[],commands:[]};
const cards=[{id:301,name:'測試聯絡人',company:'R74測試客戶甲',mobile:'0900000000',title:'測試職稱'}];
const localFields={'hongbin_crm_master_r70':master,'hongbin_personal_crm_v3':crm,'hongbin_crm_cards_r70':cards,'hongbin_crm_project_progress_r72':{'201':{progress:'送樣中',note:'等待回覆'}}};
let checkCount=0;
function check(condition,message){assert(condition,message);checkCount++;console.log('PASS: '+message)}
let browser;
(async()=>{
 browser=await webkit.launch({headless:true});
 const context=await browser.newContext({...devices['iPhone 13'],serviceWorkers:'block'});
 const page=await context.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://honbin002-design.github.io/**',route=>route.abort());
 await page.addInitScript(entries=>{for(const [key,value] of Object.entries(entries))localStorage.setItem(key,JSON.stringify(value))},localFields);
 await page.goto(base+'/index.html#customers',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!document.getElementById('r74SupplierNav'),null,{timeout:15000});
 check(!!await page.locator('#r74Suppliers').count()&&!!await page.locator('#r74Products').count(),'獨立供應商與產品入口');
 check(!!await page.locator('#r74MoreNav').count(),'行動版更多功能入口');
 await page.locator('#cuSearch').fill('R74測試客戶甲');
 await page.waitForTimeout(300);
 check(await page.locator('#record-customers-101').isVisible(),'客戶搜尋命中正確客戶');
 check(!(await page.locator('#record-customers-102').isVisible()),'客戶搜尋不顯示其他客戶');
 await page.locator('#record-customers-101 button.customer-link').click();
 await page.waitForFunction(()=>!!document.getElementById('r74CustomerDetails'),null,{timeout:5000});
 const details=await page.locator('#r74CustomerDetails').innerText();
 check(details.includes('12345678')&&details.includes('測試聯絡人')&&details.includes('R74測試產品'),'客戶360°具備公司主資料、名片及產品');
 check(!details.includes('王測試'),'不混入其他客戶的主資料');
 await page.goto(base+'/index.html#projects',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#pProgressNote')&&document.querySelector('#r74ProjectOptionStatus'),null,{timeout:15000});
 const stage=await page.locator('#pStage option').evaluateAll(xs=>xs.map(x=>x.value));
 const progress=await page.locator('#pProgress option').evaluateAll(xs=>xs.map(x=>x.value));
 check(JSON.stringify(stage)===JSON.stringify(['進行中','已成交','暫停','結案','取消']),'階段固定5選項');
 check(JSON.stringify(progress)===JSON.stringify(['','初步接洽','需求確認','送樣中','客戶測試中','報價中','待客戶確認','待採購確認','成交準備']),'進度9選項與階段獨立');
 await page.locator('.r74-project-toggle').first().click();
 check((await page.locator('.r74-preview').innerText()).includes('等待回覆'),'專案免編輯查看進度註記');
 await page.goto(base+'/index.html#r74Visits',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!document.querySelector('#r74Visits #vCustomer'),null,{timeout:15000});
 check(!!await page.locator('#r74Visits #vNote').count(),'原拜訪表單位於拜訪入口');
 check(await page.locator('#r74Visits .r74-edit-visit').count()===1,'拜訪清單提供編輯入口');
 await page.locator('#r74Visits .r74-edit-visit').click();
 check((await page.locator('#vNote').inputValue())==='R74拜訪測試','拜訪編輯載入正確紀錄且不跨頁');
 await page.locator('#vCancelEdit').click();

 await page.goto(base+'/index.html#quotes',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(450);
 const trigger=page.locator('#quotes button').filter({hasText:'新增正式報價（完整欄位）'}).first();
 check(await trigger.count()===1,'新增正式報價入口清楚標示');
 await trigger.click();
 await page.waitForTimeout(250);
 check(await page.locator('#qdNotes').isVisible()&&await page.locator('#qdItemsEditor').isVisible(),'首次新增即顯示報價備註與品項');
 await page.locator('#qdCustomer').fill('R74測試客戶甲');
 await page.locator('#qdNotes').fill('R74不對外交易測試');
 await page.locator('#qdItemsEditor input').first().fill('R74測試產品');
 await page.evaluate(()=>{
  window.html2canvas=async()=>({toDataURL:()=> 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'});
  window.jspdf={jsPDF:class{addPage(){}addImage(){}output(){return new Blob(['%PDF-1.4\\n%%EOF'],{type:'application/pdf'})}}};
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
  Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{const e=new Error('iPhone platform denied share');e.name='NotAllowedError';throw e}});
 });
 await page.locator('#quoteDocument .btnrow button').filter({hasText:'產生 PDF／列印'}).click();
 await page.locator('#r74PdfDownload a').waitFor({timeout:8000});
 const fallback=await page.locator('#r74PdfDownload a').getAttribute('href');
 check(!!fallback&&fallback.startsWith('blob:'),'iOS 分享拒絕時可取得 PDF 下載連結');
 await page.locator('#r73SaveFormal').click();
 await page.waitForTimeout(180);
 const count=await page.evaluate(()=>JSON.parse(localStorage.getItem('hongbin_crm_formal_quotes_r73')||'[]').length);
 check(count===1,'正式報價保存一筆');
 const quoteNo=await page.locator('#qdNo').inputValue();
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!document.querySelector('#r73FormalList'),null,{timeout:15000});
 check((await page.locator('#r73FormalList').innerText()).includes(quoteNo),'重新載入後報價仍在');
 // A completely fresh, isolated origin must seed synthetic TEST records without a real customer's data.
 const demoContext=await browser.newContext({...devices['iPhone 13'],serviceWorkers:'block'});
 const demo=await demoContext.newPage();demo.on('pageerror',e=>errors.push('TEST launcher: '+e.message));
 await demo.goto(base+'/',{waitUntil:'domcontentloaded'});
 await demo.waitForURL('**/index.html#home',{timeout:15000});
 await demo.waitForFunction(()=>!!document.getElementById('r74TestBanner'),null,{timeout:15000});
 const demoState=await demo.evaluate(()=>({
   master:JSON.parse(localStorage.getItem('hongbin_crm_master_r70')||'{}'),
   crm:JSON.parse(localStorage.getItem('hongbin_personal_crm_v3')||'{}'),
   banner:document.getElementById('r74TestBanner')?.textContent||''
 }));
 check(demoState.master.customers?.length===2&&demoState.crm.customers?.length===2,'Codespaces TEST 啟動器自動填入兩筆合成示範客戶');
 check(demoState.master.customers[0].name.startsWith('R74測試')&&demoState.banner.includes('R74 TEST'),'測試資料及候選版標示均清晰，無正式客戶');
 await demoContext.close();
 assert.deepEqual(errors,[],'Browser JavaScript errors must be zero');
 const results={checks:checkCount,pageErrors:errors};
 console.log('R74 WEBKIT MOBILE SMOKE PASS '+JSON.stringify(results));
 await browser.close();
})().catch(async e=>{console.error('R74 WEBKIT MOBILE SMOKE FAIL',e.stack||String(e));try{await browser?.close()}catch(_){}process.exitCode=1});
