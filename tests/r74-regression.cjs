'use strict';
// R74 offline, non-destructive regression checks: node tests/r74-regression.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const files=['r69-fix.js','r73-fixes.js','r74-fixes.js'];
files.forEach(path=>new vm.Script(fs.readFileSync(path,'utf8'),{filename:path}));
const markup=fs.readFileSync('index.html','utf8');
assert(markup.includes('<script src="./r74-fixes.js?v=74-candidate-1"></script>'));
const pdfSource=fs.readFileSync('r69-fix.js','utf8');
assert(pdfSource.includes('showPdfDownload(blob,name)'));
assert(pdfSource.includes("shareError?.name==='AbortError'"));
const overlay=fs.readFileSync('r74-fixes.js','utf8');
assert(!overlay.includes('localStorage.setItem('),'New read-only hubs must never write to official master data');
assert(!overlay.includes('localStorage.removeItem('),'Read-only hubs must never delete official master data');

function fixture(){
 const data=new Map(),elements=new Map(),alerts=[];
 const values={qdNo:'',qdCustomer:'',qdContact:'',qdTel:'',qdFax:'',qdDate:'',qdDelivery:'',qdPayment:'',qdPlace:'',qdValid:'',qdSales:'',qdSalesTel:'',qdNotes:'',bcCompany:'',bcName:'',bcTitle:'',bcMobile:'',bcTel:'',bcFax:'',bcEmail:'',bcAddress:'',bcWebsite:''};
 for(const [id,value] of Object.entries(values))elements.set(id,{value});
 const window={quoteDocItems:[],renderQuoteDocument(){}};
 let reloadCount=0;
 const context={
  window,
  document:{readyState:'loading',addEventListener(){},getElementById:id=>elements.get(id),querySelectorAll:()=>[],querySelector:()=>null},
  localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},
  sessionStorage:{getItem(){return null},setItem(){}},
  location:{reload(){reloadCount++}},
  alert:msg=>alerts.push(String(msg)),
  setTimeout(){},
  console:{warn(){},error(){},log(){}},
  MutationObserver:class{}
 };
 const source=fs.readFileSync('r73-fixes.js','utf8').replace(/\}\)\(\);\s*$/, "window.__tests={nextUnusedQuoteNo,saveFormal,formalQuotes,saveCard,parseCardText,setFormalId(id){currentFormalId=id}};})();");
 assert(source.includes('window.__tests='));
 vm.runInNewContext(source,context,{filename:'r73-fixes.js'});
 return {data,elements,alerts,h:window.__tests,get reloadCount(){return reloadCount}};
}
const ocr=fixture();
const cardSample='公司: R74測試股份有限公司\n姓名: 陳小明\n職稱: 經理\n手機: 0912-345-678\n電話: 06-1234567\n傳真: 06-7654321\n地址: 台南市測試路3號\nEmail: test@example.com';
const parsed=ocr.h.parseCardText(cardSample);
assert.equal(parsed.company,'R74測試股份有限公司');
assert.equal(parsed.name,'陳小明');
assert.equal(parsed.mobile,'0912-345-678');
assert.equal(parsed.tel,'06-1234567');
assert.equal(parsed.fax,'06-7654321');
assert.equal(parsed.address,'台南市測試路3號');
const quote=fixture();
const prefix=(()=>{const d=new Date(),pad=n=>String(n).padStart(2,'0');return 'Q'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'})();
const existing=[
 {id:7,fields:{qdNo:prefix+'001',qdNotes:'one'}},
 {id:11,fields:{qdNo:prefix+'002',qdNotes:'original A'}},
 {id:12,fields:{qdNo:prefix+'002',qdNotes:'original B'}}
];
quote.data.set('hongbin_crm_formal_quotes_r73',JSON.stringify(existing));
assert.equal(quote.h.nextUnusedQuoteNo(),prefix+'003');
quote.elements.get('qdNo').value=prefix+'003';
quote.h.saveFormal();
assert.equal(quote.h.formalQuotes().length,4);
assert.equal(quote.h.formalQuotes()[0].fields.qdNo,prefix+'003');
quote.h.setFormalId(null);
quote.elements.get('qdNo').value=prefix+'002';
const before=quote.data.get('hongbin_crm_formal_quotes_r73');
quote.h.saveFormal();
assert.equal(quote.data.get('hongbin_crm_formal_quotes_r73'),before,'Duplicate create must be blocked');
assert(quote.alerts.some(msg=>msg.includes('報價編號已存在')));
quote.h.setFormalId(11);
quote.elements.get('qdNotes').value='updated only A';
quote.h.saveFormal();
assert.equal(quote.h.formalQuotes().length,4);
assert.equal(quote.h.formalQuotes().find(x=>x.id===11).fields.qdNotes,'updated only A');
assert.equal(quote.h.formalQuotes().find(x=>x.id===12).fields.qdNotes,'original B');

async function cardTest(){
 const ctx=fixture(),M='hongbin_crm_master_r70',C='hongbin_personal_crm_v3',CARDS='hongbin_crm_cards_r70';
 ctx.data.set(M,JSON.stringify({customers:[{name:'敏翔',contact:'',tel:''}],products:[],suppliers:[]}));
 ctx.data.set(C,JSON.stringify({projects:[],contacts:[{id:1,who:'既有聯絡追蹤',customerId:88,note:'保留'}],customers:[{id:88,name:'敏翔'}],visits:[],quotes:[],todos:[],commands:[]}));
 const vals={bcCompany:'敏翔',bcName:'王小華',bcTitle:'採購',bcMobile:'0912000000',bcEmail:'test@example.com'};
 for(const [id,value] of Object.entries(vals))ctx.elements.get(id).value=value;
 await ctx.h.saveCard('link');
 const master=JSON.parse(ctx.data.get(M)),crm=JSON.parse(ctx.data.get(C)),cards=JSON.parse(ctx.data.get(CARDS));
 assert.equal(master.customers.length,1);
 assert.equal(crm.contacts.length,1,'Linking a business card must not create a fake contact tracking event');
 assert.equal(crm.contacts[0].who,'既有聯絡追蹤');
 assert.equal(cards.length,1);
 assert.equal(String(cards[0].customerId),'88');
 assert.equal(cards[0].name,'王小華');
 assert.equal(ctx.reloadCount,1);
}
function customer360Test(){
 const data=new Map(),els=new Map(),writes=[];
 data.set('hongbin_crm_master_r70',JSON.stringify({customers:[{name:'敏翔',taxId:'12345678',contact:'林小姐',tel:'06-1234567'}],products:[{customerName:'敏翔',name:'測試產品',customerPartNo:'C-01'}],suppliers:[]}));
 data.set('hongbin_crm_cards_r70',JSON.stringify([{company:'敏翔',name:'名片聯絡人甲'},{company:'其他',name:'不該顯示'}]));
 const panel={appendChild(el){els.set(el.id,el)},querySelector(){return null}};
 els.set('customer360',panel);
 const makeElement=()=>({id:'',innerHTML:'',className:'',style:{},children:[],appendChild(child){this.children.push(child)}});
 const context={
  window:{},document:{readyState:'loading',addEventListener(){},getElementById:id=>els.get(id),createElement:makeElement},
  localStorage:{getItem:k=>data.get(k)||null,setItem:(...args)=>writes.push(args)},
  setTimeout(){},console:{},MutationObserver:class{}
 };
 const src=fs.readFileSync('r74-fixes.js','utf8').replace(/\}\)\(\);\s*$/, 'window.__tests={showCustomerDetails};})();');
 vm.runInNewContext(src,context,{filename:'r74-fixes.js'});
 context.window.__tests.showCustomerDetails('敏翔',88);
 const html=els.get('r74CustomerDetails').innerHTML;
 for(const expected of ['12345678','名片聯絡人甲','測試產品','C-01'])assert(html.includes(expected),'Customer 360 must show '+expected);
 assert(!html.includes('不該顯示'),'Customer 360 must not cross-link unrelated company cards');
 assert.equal(writes.length,0);
}
cardTest().then(()=>{customer360Test();console.log('R74 regression PASS: syntax, branch loader, PDF fallback, quote uniqueness, legacy edits, card links, customer 360 and read-only views')}).catch(e=>{console.error(e);process.exitCode=1});
