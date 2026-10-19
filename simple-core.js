(()=>{'use strict';
const KEYS={master:'hongbin_crm_master_r70',crm:'hongbin_personal_crm_v3',quotes:'hongbin_crm_formal_quotes_r73',progress:'hongbin_crm_project_progress_r72',history:'hongbin_crm_simple_project_history_r74'};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm=v=>String(v??'').toLocaleLowerCase().trim().replace(/[\s　]+/g,'');
const uniqueId=()=>Date.now()+Math.floor(Math.random()*10000);
const localDate=d=>{const x=d||new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}};
const store=(key,data)=>{try{localStorage.setItem(key,JSON.stringify(data));return true}catch(e){alert('儲存失敗：可能是 Safari 儲存空間不足。請先備份，不要清除資料。\n'+e.message);return false}};
const getMaster=()=>{const m=read(KEYS.master,{});return {...m,customers:Array.isArray(m.customers)?m.customers:[],products:Array.isArray(m.products)?m.products:[],suppliers:Array.isArray(m.suppliers)?m.suppliers:[]}};
const getCRM=()=>{const d=read(KEYS.crm,{});return {...d,customers:Array.isArray(d.customers)?d.customers:[],projects:Array.isArray(d.projects)?d.projects:[],todos:Array.isArray(d.todos)?d.todos:[]}};
const getQuotes=()=>{const q=read(KEYS.quotes,[]);return Array.isArray(q)?q:[]};
const getProgress=()=>read(KEYS.progress,{});
const getHist=()=>read(KEYS.history,{});
const field=id=>$(id)?.value.trim()||'';
let currentTab='quotes',editCustomerName=null,editCustomerCrmId=null,editQuoteId=null,editTodoId=null,editProjectId=null,editSupplierIndex=null,editProductIndex=null,selectedDate=localDate(),monthDate=new Date(),lastPdfUrl=null,customer360Name=null;
const QUOTE_FIELDS=['qdCustomer','qdContact','qdTel','qdFax','qdNo','qdDate','qdDelivery','qdPayment','qdPlace','qdValid','qdSales','qdSalesTel','qdNotes'];
const defaults={qdDelivery:'有庫存 3 天內交貨，如無庫存需 30 天',qdPayment:'次月60天',qdPlace:'貴公司交貨處或指定交貨處',qdValid:'三十日',qdNotes:'1：以上價格為未稅價。\n2：實際價格以訂單確認為準。\n3：特殊規格或需求，請先行告知。'};
function toast(msg){const n=$('toast');n.textContent=msg;n.style.display='block';setTimeout(()=>{n.style.display='none'},2500)}
function openTab(tab){if(!['quotes','customers','calendar','projects','suppliers','products','backup'].includes(tab))tab='quotes';currentTab=tab;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab))});document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!=='panel-'+tab);if(tab==='quotes')renderQuotes();if(tab==='customers'){ $('customerListCard').hidden=false; $('customer360').hidden=true; customer360Name=null; renderCustomers() }if(tab==='calendar')renderCalendar();if(tab==='projects')renderProjects();if(tab==='suppliers')renderSuppliers();if(tab==='products')renderProducts();if(tab==='backup')renderStorage();window.scrollTo({top:0,behavior:'instant'})}
function customerEntries(){const m=getMaster().customers,c=getCRM().customers,map=new Map();m.forEach(x=>{const key=norm(x.name);if(key)map.set(key,{...x,legacyId:c.find(v=>norm(v.name)===key)?.id})});c.forEach(x=>{const key=norm(x.name);if(key&&!map.has(key))map.set(key,{name:x.name,legacyId:x.id})});return [...map.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),'zh-Hant'))}
function datalist(id,values){const n=$(id);if(!n)return;n.replaceChildren(...[...new Set(values.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-Hant')).map(s=>{const o=document.createElement('option');o.value=s;return o}))}
function fillCustomerNames(){
 datalist('customerNames',customerEntries().map(x=>x.name));
 datalist('supplierNames',supplierEntries().map(x=>supplierName(x)));
 datalist('productNames',productEntries().map(x=>productName(x)));
 datalist('productModels',productEntries().map(x=>productModel(x)));
}
function customerByName(name){return customerEntries().find(c=>norm(c.name)===norm(name))}
function customerId(name){return getCRM().customers.find(c=>norm(c.name)===norm(name))?.id??null}
function htmlListEmpty(label){return '<div class="muted">'+esc(label)+'</div>'}
function customerInfo(c){return [c.contact,c.mobile,c.tel,c.address].filter(Boolean).join(' ｜ ')}
// ── Customer ──
function renderCustomers(){fillCustomerNames();const q=norm(field('customerSearch'));const list=customerEntries().filter(c=>!q||norm([c.name,c.contact,c.tel,c.mobile,c.address,c.taxId].join(' ')).includes(q));$('customerList').innerHTML=list.length?list.map(c=>'<div class="listItem"><div class="listTitle">'+esc(c.name)+'</div><div class="sub">'+esc(customerInfo(c)||'尚未填寫聯絡資訊')+'</div><div class="actions"><button type="button" class="secondary" data-customer="'+esc(c.name)+'">客戶完整資料</button></div></div>').join(''):htmlListEmpty('目前沒有符合的客戶');}
function editCustomer(name){editCustomerName=name||null;const c=customerByName(name)||{};editCustomerCrmId=c.legacyId??null;const map={cuName:'name',cuTax:'taxId',cuContact:'contact',cuMobile:'mobile',cuTel:'tel',cuFax:'fax',cuAddress:'address',cuEmail:'email'};for(const [id,key] of Object.entries(map))$(id).value=c[key]||'';$('customerEditorTitle').textContent=name?'編輯客戶':'新增客戶';$('customerEditor').hidden=false;$('customerEditor').scrollIntoView({block:'start',behavior:'smooth'})}
function saveCustomer(){const name=field('cuName'),m=getMaster(),crm=getCRM();if(!name){alert('請填寫公司名稱');return}
 const collision=customerEntries().some(c=>norm(c.name)===norm(name)&&norm(c.name)!==norm(editCustomerName));if(collision){alert('此客戶已存在，請直接編輯原有資料');return}
 if(editCustomerName&&norm(editCustomerName)!==norm(name)&&!confirm('更改公司名稱不會修改歷史報價上的公司名稱。確定繼續？'))return;
 const values={name,taxId:field('cuTax'),contact:field('cuContact'),mobile:field('cuMobile'),tel:field('cuTel'),fax:field('cuFax'),address:field('cuAddress'),email:field('cuEmail')};
 const mi=m.customers.findIndex(c=>norm(c.name)===norm(editCustomerName||name));if(mi>=0)m.customers[mi]={...m.customers[mi],...values};else m.customers.push(values);
 const ci=crm.customers.findIndex(c=>(editCustomerCrmId!=null&&String(c.id)===String(editCustomerCrmId))||norm(c.name)===norm(editCustomerName||name));if(ci>=0)crm.customers[ci]={...crm.customers[ci],name};else crm.customers.push({id:uniqueId(),name});
 // Two different localStorage records; retain both originals if either write fails.
 const previousM=localStorage.getItem(KEYS.master),previousC=localStorage.getItem(KEYS.crm);
 if(!store(KEYS.master,m))return;
 if(!store(KEYS.crm,crm)){try{if(previousM===null)localStorage.removeItem(KEYS.master);else localStorage.setItem(KEYS.master,previousM)}catch{}return}
 const wasViewingDetail=!$('customer360').hidden;editCustomerName=null;editCustomerCrmId=null;$('customerEditor').hidden=true;renderCustomers();if(wasViewingDetail)showCustomer360(name);toast('客戶資料已儲存')}
// ── Formal quotations (compatible with R73 snapshots) ──
function nextQuoteNo(){const prefix='Q'+localDate().replaceAll('-','')+'-';const used=new Set(getQuotes().map(x=>norm(x.fields?.qdNo)));for(let i=1;i<=9999;i++){const v=prefix+String(i).padStart(3,'0');if(!used.has(norm(v)))return v}return prefix+String(uniqueId())}
function renderQuotes(){const q=norm(field('quoteSearch'));const rows=getQuotes().filter(x=>!q||norm([x.fields?.qdNo,x.fields?.qdCustomer,x.fields?.qdDate].join(' ')).includes(q)).slice().reverse();const counts=new Map();getQuotes().forEach(x=>{const n=norm(x.fields?.qdNo);if(n)counts.set(n,(counts.get(n)||0)+1)});
 $('quoteList').innerHTML=rows.length?rows.map(x=>{const f=x.fields||{};return '<div class="listItem"><div class="listTitle">'+esc(f.qdNo||'無編號')+'</div><div class="sub">'+esc(f.qdCustomer||'未指定客戶')+'　｜　'+esc(f.qdDate||'未設定日期')+'</div>'+(counts.get(norm(f.qdNo))>1?'<div class="warn">舊資料報價編號重複，保留原始紀錄 ID：'+esc(x.id)+'</div>':'')+'<div class="actions"><button type="button" data-quote="'+esc(x.id)+'" class="secondary">開啟／修改報價</button></div></div>'}).join(''):htmlListEmpty('尚無符合的正式報價');}
function addItem(x={}){const node=document.createElement('div');node.className='items';node.innerHTML='<div class="grid"><div><label>品名</label><input class="it-name"></div><div><label>型號</label><input class="it-model"></div><div><label>規格</label><input class="it-spec"></div><div><label>數量</label><input class="it-qty" type="number" min="0.01" step="any" value="1"></div><div><label>單價（未稅）</label><input class="it-price" type="number" min="0" step="any"></div><div><label>最低訂購量 MOQ</label><input class="it-moq"></div></div><div class="actions"><button type="button" class="weak removeItem">移除此品項</button></div>';const v={name:x.name||'',model:x.model||'',spec:x.spec||'',qty:x.qty??1,price:x.price??'',moq:x.moq||''};Object.entries(v).forEach(([key,val])=>node.querySelector('.it-'+key).value=val);node.querySelector('.removeItem').onclick=()=>{if($('quoteItems').children.length<=1){alert('至少保留一個品項');return}node.remove()};$('quoteItems').appendChild(node)}
function collectItems(){return [...$('quoteItems').children].map(el=>({name:el.querySelector('.it-name').value.trim(),model:el.querySelector('.it-model').value.trim(),spec:el.querySelector('.it-spec').value.trim(),qty:Number(el.querySelector('.it-qty').value||1),price:el.querySelector('.it-price').value.trim(),moq:el.querySelector('.it-moq').value.trim()}))}
function editQuote(id){const found=id==null?null:getQuotes().find(x=>String(x.id)===String(id));editQuoteId=found?.id??null;QUOTE_FIELDS.forEach(k=>$(k).value=found?.fields?.[k]??defaults[k]??'');if(!found){$('qdNo').value=nextQuoteNo();$('qdDate').value=localDate();$('qdCustomer').value='';}
 $('quoteItems').replaceChildren();(found?.items?.length?found.items:[{}]).forEach(addItem);$('quoteEditorTitle').textContent=found?'編輯正式報價':'新增正式報價';$('quoteEditor').hidden=false;$('quotePreview').hidden=true;$('quoteEditor').scrollIntoView({block:'start',behavior:'smooth'})}
function quoteData(){const fields={};QUOTE_FIELDS.forEach(k=>fields[k]=field(k));return {fields,items:collectItems()}}
function validateQuote(x){if(!x.fields.qdCustomer){alert('請輸入報價客戶');return false}if(!x.fields.qdNo){alert('請輸入報價編號');return false}if(!x.items.some(i=>i.name)){alert('請至少輸入一個品項');return false}if(x.items.some(i=>!Number.isFinite(i.qty)||i.qty<=0||!Number.isFinite(Number(i.price||0))||Number(i.price||0)<0)){alert('數量需大於 0，單價不可為負數');return false}return true}
function saveQuote(){const data=quoteData();if(!validateQuote(data))return;const list=getQuotes(),i=list.findIndex(x=>editQuoteId!=null&&String(x.id)===String(editQuoteId));const duplicate=list.some((x,j)=>j!==i&&norm(x.fields?.qdNo)===norm(data.fields.qdNo));if(duplicate&&(i<0||norm(list[i]?.fields?.qdNo)!==norm(data.fields.qdNo))){alert('報價編號已存在。為保護舊資料，請使用不同編號。');return}
 const existing=i>=0?list[i]:null;const next={...(existing||{}),id:existing?.id??uniqueId(),fields:data.fields,items:data.items};if(i>=0)list[i]=next;else list.unshift(next);if(!store(KEYS.quotes,list))return;editQuoteId=next.id;renderQuotes();toast('正式報價已儲存')}
/* R73 confirmed paper markup; originally in rollback branch (five columns, unchanged business wording). */
const LEGACY_QUOTE_PAPER="<div class=\"quote-paper\" >\n      <div class=\"q-letterhead\"><img class=\"q-letterhead-img\" src=\"quote-letterhead.jpg\" alt=\"鴻繽科技有限公司標準報價單抬頭\"></div>\n      <div class=\"q-title\">報價單</div>\n      <div class=\"q-party\">\n        <div><div class=\"q-party-row\"><span class=\"q-party-label\">Messers.</span><b id=\"qpCustomer\"></b></div><div class=\"q-party-row\"><span></span><span>TEL： <span id=\"qpTel\"></span></span></div><div class=\"q-party-row\"><span></span><span>FAX： <span id=\"qpFax\"></span></span></div></div>\n        <div><div>NO： <span id=\"qpNo\"></span></div><div>DATE： <span id=\"qpDate\"></span></div><div>聯絡人： <span id=\"qpContact\"></span></div></div>\n      </div>\n      <table class=\"q-table\"><thead><tr><th>品名</th><th>品號</th><th>規格</th><th>單價 (NT)</th><th>最低訂購量</th></tr></thead><tbody id=\"qpItems\"></tbody></table>\n      <div class=\"q-terms\">交貨日期：<span id=\"qpDelivery\"></span><br>付款條件：<span id=\"qpPayment\"></span><br>交貨地點：<span id=\"qpPlace\"></span><br>有效期限：<span id=\"qpValid\"></span><br>單筆交易未滿伍仟元整需自行負擔運費<br>報價單價格不含 5% 營業稅</div>\n      <div class=\"q-notes\">備　註：<br><span id=\"qpNotes\"></span></div>\n      <div class=\"q-sales\">業務代表：　<span id=\"qpSales\"></span> <span id=\"qpSalesTel\"></span></div><div class=\"q-page-no\"></div>\n    </div>";
function quoteSheets(data){
 const f=data.fields||{},raw=Array.isArray(data.items)?data.items:[],all=raw.length?raw:[{}],pages=[];
 for(let i=0;i<all.length;i+=4)pages.push(all.slice(i,i+4));
 const binding={qpCustomer:f.qdCustomer,qpContact:f.qdContact,qpTel:f.qdTel,qpFax:f.qdFax,qpNo:f.qdNo,qpDate:(f.qdDate||'').replaceAll('-','/'),qpDelivery:f.qdDelivery,qpPayment:f.qdPayment,qpPlace:f.qdPlace,qpValid:f.qdValid,qpSales:f.qdSales,qpSalesTel:f.qdSalesTel,qpNotes:f.qdNotes};
 return pages.map((subset,idx)=>{
   const rows=subset.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.model)+'</td><td>'+esc(x.spec)+'</td><td>'+esc(x.price)+'</td><td>'+esc(x.moq)+'</td></tr>');
   while(rows.length<4)rows.push('<tr><td>　</td><td></td><td></td><td></td><td></td></tr>');
   const page=LEGACY_QUOTE_PAPER.replace('class="quote-paper"','class="sheet quote-paper legacy-quote"')
     .replace('<tbody id="qpItems"></tbody>','<tbody>'+rows.join('')+'</tbody>')
     .replace(/<(b|span) id="([^"]+)"><\/\1>/g,(_,tag,id)=>'<'+tag+'>'+esc(binding[id]||'')+'</'+tag+'>')
     .replace('<div class="q-page-no"></div>','<div class="q-page-no">第 '+(idx+1)+'／'+pages.length+' 頁</div>');
   return '<div class="legacy-sheet-shell">'+page+'</div>';
 }).join('');
}
function fitLegacyQuotePreview(){
 document.querySelectorAll('#quotePreviewPages .legacy-sheet-shell').forEach(shell=>{
  const paper=shell.querySelector('.legacy-quote');if(!paper)return;
  const available=shell.clientWidth||300,scale=Math.min(1,available/794);
  paper.style.position='absolute';
  paper.style.top='0';
  paper.style.left=Math.max(0,(available-794*scale)/2)+'px';
  paper.style.transformOrigin='top left';
  paper.style.transform='scale('+scale+')';
  shell.style.height=Math.ceil(Math.max(paper.scrollHeight,1123)*scale)+'px';
 });
}
function previewQuote(){
 const data=quoteData();if(!validateQuote(data))return false;
 const pages=quoteSheets(data);
 $('quotePreviewPages').innerHTML=pages;
 $('printRoot').innerHTML=pages;
 $('quotePreview').hidden=false;
 requestAnimationFrame(fitLegacyQuotePreview);
 $('quotePreviewPages').querySelectorAll('img').forEach(img=>img.addEventListener('load',fitLegacyQuotePreview,{once:true}));
 $('quotePreview').scrollIntoView({block:'start',behavior:'smooth'});return true
}
function printQuote(){if(previewQuote())return pdfQuote('print')}
async function loadScript(url,isReady){if(isReady())return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(new Error('PDF 元件載入失敗，請使用列印／儲存 PDF'));document.head.appendChild(s)})}
async function pdfQuote(mode='download'){
 const data=quoteData();if(!validateQuote(data))return;
 const isPrint=mode==='print',btn=$(isPrint?'printQuote':'exportPdf'),otherBtn=$(isPrint?'exportPdf':'printQuote');if(btn.disabled||otherBtn.disabled)return;
 const msg=$(isPrint?'printNotice':'pdfNotice');btn.disabled=true;otherBtn.disabled=true;btn.textContent=isPrint?'正在準備列印…':'正在產生 PDF…';msg.textContent=isPrint?'正在準備無網頁頁尾的 PDF，請稍候……':'正在產生 PDF，請稍候……';
 try{
  // 下載不必先開啟預覽，也不會另開 PDF 視窗。
  $('printRoot').innerHTML=quoteSheets(data);
  await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',()=>!!window.html2canvas);
  await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',()=>!!window.jspdf);
  const pdf=new window.jspdf.jsPDF({format:'a4',unit:'mm',orientation:'portrait'});
  const pages=[...$('printRoot').querySelectorAll('.sheet')];
  for(let i=0;i<pages.length;i++){
   const clone=pages[i].cloneNode(true);
   clone.style.cssText='width:794px!important;max-width:794px!important;position:fixed;left:-10000px;top:0;margin:0;';
   document.body.appendChild(clone);
   let canvas;
   try{canvas=await window.html2canvas(clone,{scale:2,backgroundColor:'#fff',useCORS:true})}
   finally{clone.remove()}
   if(i)pdf.addPage();
   pdf.addImage(canvas.toDataURL('image/jpeg',.93),'JPEG',0,0,210,297);
  }
  const blob=pdf.output('blob');
  const safeNo=String(data.fields.qdNo||'未編號').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').trim();
  const filename='報價單_'+safeNo+'.pdf';
  // iPhone Safari：優先一次叫出原生分享選單，讓使用者選「儲存到檔案」。
  // 若瀏覽器因為 PDF 非同步生成而失去 user activation，會自動改用下載，
  // 不顯示第二個小字連結，也不使用 target=_blank。
  if(typeof navigator.share==='function'&&typeof File==='function'){
   const file=new File([blob],filename,{type:'application/pdf'});
   let canShare=true;
   try{if(typeof navigator.canShare==='function')canShare=navigator.canShare({files:[file]})}catch{canShare=false}
   if(canShare){
    try{
     await navigator.share({files:[file],title:filename});
     msg.textContent=isPrint?'已開啟 PDF 分享選單，請選「列印」；不會加入 Safari 網址及日期頁尾。':'已交給分享選單處理，若要儲存請選「儲存到檔案」。';
     return;
    }catch(e){
     if(e?.name==='AbortError'){msg.textContent='已取消 PDF 分享。';return}
     // iPhone 部分情況可能拒絕非同步完成後的 share，改用立即下載。
    }
   }
  }
  downloadBlob(blob,filename);
  msg.textContent=isPrint?'已下載不含 Safari 頁尾的 PDF，請從「檔案」App 開啟後選「列印」。':'已啟動 PDF 下載，請查看 Safari 的下載項目或「檔案」App。';
 }catch(e){
  msg.textContent='PDF 產生失敗：'+String(e.message||e)+'。請稍後重試。';
 }finally{btn.disabled=false;otherBtn.disabled=false;btn.textContent=isPrint?'列印／儲存 PDF':'下載 PDF'}
}
// ── Calendar ──
function todoItems(){return getCRM().todos}
function renderCalendar(){const year=monthDate.getFullYear(),month=monthDate.getMonth();$('calTitle').textContent=year+' 年 '+(month+1)+' 月';$('calendarYear').value=String(year);$('calendarMonth').value=String(month+1);const cal=$('calendarGrid');cal.replaceChildren();'日一二三四五六'.split('').forEach(d=>{const n=document.createElement('div');n.className='weekday';n.textContent=d;cal.appendChild(n)});const first=new Date(year,month,1).getDay(),count=new Date(year,month+1,0).getDate(),items=todoItems();
 for(let i=0;i<first;i++){const n=document.createElement('div');n.className='day empty';cal.appendChild(n)}
 for(let d=1;d<=count;d++){const date=localDate(new Date(year,month,d));const n=document.createElement('button');n.type='button';n.className='day'+(date===localDate()?' today':'')+(items.some(t=>t.date===date)?' dot':'')+(date===selectedDate?' chosen':'');n.textContent=String(d);n.setAttribute('aria-label',date+' 待辦事項');n.setAttribute('aria-pressed',String(date===selectedDate));n.onclick=()=>{selectedDate=date;renderCalendar()};cal.appendChild(n)}renderTodos()}
function renderTodos(){
 const all=todoItems(),day=all.filter(t=>t.date===selectedDate).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')),undated=all.filter(t=>!String(t.date||'').trim());
 $('selectedDayTitle').textContent=selectedDate+' 的待辦（'+day.length+'）';
 const item=t=>'<div class="listItem task '+(t.done?'done':'')+'"><label class="taskCheck"><input type="checkbox" data-complete="'+esc(t.id)+'" '+(t.done?'checked':'')+'><span class="todo-task-main"><span class="todo-time'+(t.time?'':' unscheduled')+'">'+(t.time?'時間：'+esc(t.time):'未設定時間')+'</span><span class="listTitle">'+esc(t.text||'未命名待辦')+'</span></span></label>'+(linkedTodoCustomer(t)?'<div class="sub">客戶：'+esc(linkedTodoCustomer(t))+'</div>':'')+(t.notes?'<div class="sub">'+esc(t.notes)+'</div>':'')+'<button type="button" class="secondary" data-todo="'+esc(t.id)+'">修改</button></div>';
 $('todoList').innerHTML=(day.length?day.map(item).join(''):htmlListEmpty('當天沒有待辦'))+(undated.length?'<h3>尚未安排日期的待辦（'+undated.length+'）</h3><div class="muted">舊版未填日期的待辦仍保留，可按修改安排日期。</div>'+undated.map(item).join(''):'');
}
function editTodo(id){const t=id==null?null:todoItems().find(x=>String(x.id)===String(id));editTodoId=t?.id??null;$('tDate').value=t?.date||selectedDate;$('tTime').value=t?.time||'';$('tCustomer').value=t?linkedTodoCustomer(t):'';$('tText').value=t?.text||'';$('tNotes').value=t?.notes||'';$('todoEditor').hidden=false;$('todoEditor').scrollIntoView({behavior:'smooth',block:'start'})}
function saveTodo(){const text=field('tText'),date=field('tDate');if(!text||!date){alert('請輸入待辦日期與內容');return}const d=getCRM(),i=d.todos.findIndex(x=>editTodoId!=null&&String(x.id)===String(editTodoId)),old=i>=0?d.todos[i]:null,next={...(old||{}),id:old?.id??uniqueId(),text,date,time:field('tTime'),customerName:field('tCustomer'),customerId:field('tCustomer')?customerId(field('tCustomer')):null,notes:field('tNotes'),done:old?.done??false};if(i>=0)d.todos[i]=next;else d.todos.unshift(next);if(!store(KEYS.crm,d))return;selectedDate=date;monthDate=new Date(date+'T12:00:00');$('todoEditor').hidden=true;renderCalendar();toast('待辦已儲存')}
function toggleTodo(id,checked){const d=getCRM(),t=d.todos.find(x=>String(x.id)===String(id));if(!t)return;t.done=checked;if(store(KEYS.crm,d))renderCalendar()}
// ── Project ──
const STAGES=['進行中','已成交','暫停','結案','取消'],PROGRESS=['','初步接洽','需求確認','送樣中','客戶測試中','報價中','待客戶確認','待採購確認','成交準備'];
function projectProgress(p){const prog=getProgress();return prog[p.id]||prog[p.name]||{}}
function projectCustomerName(p){return p.customerName||getCRM().customers.find(c=>p.customerId!=null&&String(c.id)===String(p.customerId))?.name||''}
function renderProjects(){const q=norm(field('projectSearch'));const list=getCRM().projects.filter(p=>!q||norm([p.name,projectCustomerName(p),p.stage,p.owner].join(' ')).includes(q));$('projectList').innerHTML=list.length?list.map(p=>{const pr=projectProgress(p);return '<div class="listItem"><div class="listTitle">'+esc(p.name||'未命名專案')+'</div><div class="sub">'+esc(projectCustomerName(p)||'未指定客戶')+'　｜　'+esc(p.stage||'未設定')+'　｜　'+esc(pr.progress||p.progress||'未設定進度')+'</div><div class="sub">下次追蹤：'+esc(p.followDate||'未設定')+'</div><button class="secondary" data-project="'+esc(p.id)+'" type="button">查看／追蹤</button></div>'}).join(''):htmlListEmpty('尚無符合的專案')}
// 歷史原始時間保持不變；顯示時統一為台灣日期及 24 小時制。舊日期文字保留可讀性。
function readableHistoryTime(value){
 const raw=String(value??'').trim();if(!raw)return '未記錄時間';
 if(/^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.test(raw)&&!/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)){
  return raw.replaceAll('-','/').replace('T',' ');
 }
 let date;
 if(/^\d{10}$/.test(raw))date=new Date(Number(raw)*1000);
 else if(/^\d{13}$/.test(raw))date=new Date(Number(raw));
 else if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw))date=new Date(raw);
 else return raw;
 if(Number.isNaN(date.getTime()))return raw;
 try{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
   timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',
   hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(date).map(p=>[p.type,p.value]));
  return parts.year+'/'+parts.month+'/'+parts.day+' '+parts.hour+':'+parts.minute;
 }catch{return raw}
}
function renderHistory(id){const list=getHist()[id]||[];const original=getCRM().projects.find(p=>String(p.id)===String(id));const legacy=original?projectProgress(original):{};const oldNote=legacy?.note?'<div class="note"><strong>既有進度註記（舊版資料）</strong><div>'+esc(legacy.note)+'</div></div>':'';$('projectHistory').innerHTML=oldNote+(list.length?list.slice().reverse().map(h=>'<div class="note"><strong>'+esc(readableHistoryTime(h.date))+'</strong><div>'+esc(h.note)+'</div><div class="sub">階段：'+esc(h.stage)+'｜進度：'+esc(h.progress||'未設定')+'</div></div>').join(''):oldNote?'':htmlListEmpty('尚無追蹤紀錄'))}
function editProject(id){const p=id==null?null:getCRM().projects.find(x=>String(x.id)===String(id));editProjectId=p?.id??null;const pr=p?projectProgress(p):{};$('pName').value=p?.name||'';$('pCustomer').value=p?projectCustomerName(p):'';$('pOwner').value=p?.owner||'';$('pFollowDate').value=p?.followDate||'';for(const node of $('pStage').querySelectorAll('option[data-legacy]'))node.remove();for(const node of $('pProgress').querySelectorAll('option[data-legacy]'))node.remove();const stage=p?.stage||'進行中';if(!STAGES.includes(stage)){const old=document.createElement('option');old.dataset.legacy='1';old.value=stage;old.textContent='舊階段：'+stage;$('pStage').appendChild(old)}$('pStage').value=stage;const progress=pr.progress||p?.progress||'';if(!PROGRESS.includes(progress)){const opt=document.createElement('option');opt.dataset.legacy='1';opt.value=progress;opt.textContent='舊進度：'+progress;$('pProgress').appendChild(opt)}$('pProgress').value=progress;$('pNote').value='';$('projectEditorTitle').textContent=p?'專案追蹤':'新增專案';renderHistory(p?.id??'new');$('projectEditor').hidden=false;$('projectEditor').scrollIntoView({behavior:'smooth',block:'start'})}
function saveProject(){const name=field('pName');if(!name){alert('請輸入專案名稱');return}const crm=getCRM(),i=crm.projects.findIndex(p=>editProjectId!=null&&String(p.id)===String(editProjectId)),old=i>=0?crm.projects[i]:null;const nameOf=field('pCustomer'),pr=field('pProgress'),stage=field('pStage'),note=field('pNote'),id=old?.id??uniqueId();
 const next={...(old||{}),id,name,customerId:customerId(nameOf),customerName:nameOf,owner:field('pOwner'),followDate:field('pFollowDate'),stage};
 if(i>=0)crm.projects[i]=next;else crm.projects.unshift(next);
 const progress=getProgress(),hist=getHist();const existingProgress=progress[id]||progress[old?.name]||{};const hadChange=!old||note||old.name!==name||projectCustomerName(old)!==nameOf||old.owner!==next.owner||old.stage!==stage||(old.followDate||'')!==next.followDate||(existingProgress.progress||old.progress||'')!==pr;progress[id]={...existingProgress,progress:pr,note:existingProgress.note||''};if(hadChange){hist[id]=[...(hist[id]||[]),{id:uniqueId(),date:new Date().toISOString(),note:note||(!old?'建立專案':'更新專案資料、階段或追蹤日期'),stage,progress:pr,followDate:next.followDate}]}
 // If writing one of the related keys fails, restore all from snapshots.
 const changes=[[KEYS.crm,crm],[KEYS.progress,progress],[KEYS.history,hist]],snapshots=changes.map(([k])=>localStorage.getItem(k));try{for(const [k,v] of changes)localStorage.setItem(k,JSON.stringify(v))}catch(e){changes.forEach(([k],idx)=>{try{snapshots[idx]===null?localStorage.removeItem(k):localStorage.setItem(k,snapshots[idx])}catch{}});alert('專案儲存失敗，已嘗試回復先前資料。請備份後確認儲存空間。');return}
 editProjectId=id;$('projectEditor').hidden=true;renderProjects();toast('專案已儲存，追蹤紀錄已保留')}
// ── Local backup and careful restore ──
function renderStorage(){try{const keys=Object.keys(localStorage).filter(k=>k.startsWith('hongbin_'));$('storageStatus').textContent='本機儲存狀態：可使用｜目前找到 '+keys.length+' 個 CRM 資料項目'}catch{$('storageStatus').textContent='無法讀取本機儲存，請勿繼續輸入資料'}}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function backup(){const data={};try{for(const k of Object.keys(localStorage))if(k.startsWith('hongbin_'))data[k]=localStorage.getItem(k);const archive={format:'hongbin-crm-simple-localstorage',schema:1,exportedAt:new Date().toISOString(),data};downloadBlob(new Blob([JSON.stringify(archive,null,2)],{type:'application/json;charset=utf-8'}),'鴻繽CRM備份_'+localDate()+'.json');toast('已建立備份檔，請確認存入 iPhone 檔案')}catch(e){alert('備份失敗：'+e.message)}}
function validShape(key,value){
 let obj;
 try{obj=JSON.parse(value)}catch(e){throw new Error('資料格式錯誤：'+key+' 不是有效 JSON')}
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const arrays=(x,names)=>names.every(k=>x[k]===undefined||Array.isArray(x[k]));
 if(key===KEYS.crm&&(!plain(obj)||!arrays(obj,['customers','projects','todos','contacts','quotes','visits','commands'])))throw new Error('CRM 客戶／專案／待辦格式錯誤');
 if(key===KEYS.master&&(!plain(obj)||!arrays(obj,['customers','products','suppliers'])))throw new Error('客戶主資料格式錯誤');
 if(key===KEYS.quotes&&!Array.isArray(obj))throw new Error('正式報價格式錯誤');
 if((key===KEYS.progress||key===KEYS.history)&&!plain(obj))throw new Error('追蹤紀錄格式錯誤');
 if(key==='hongbin_crm_cards_r70'&&!Array.isArray(obj))throw new Error('舊版名片資料格式錯誤');
}
function normalizeBackup(obj){
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 let entries,source;
 if(obj?.format==='hongbin-crm-simple-localstorage'&&obj.schema===1&&plain(obj.data)){
   source='簡易版完整備份';
   entries=Object.entries(obj.data);
   if(!entries.length||entries.some(([k,v])=>!k.startsWith('hongbin_')||typeof v!=='string'))throw new Error('備份內容缺少有效 CRM 資料');
 }else if(obj?.app==='鴻繽科技 CRM'&&['R50','R70'].includes(obj.schema)&&plain(obj.data)){
   source='舊版 '+obj.schema+' 備份';
   const d=obj.data;
   if(!['customers','projects','todos','contacts','quotes','visits','commands'].some(k=>Array.isArray(d[k])))throw new Error('舊版 CRM 資料陣列遺失');
   entries=[[KEYS.crm,JSON.stringify(d)]];
   if(obj.schema==='R70'){
     if(obj.masterData!==undefined){if(!plain(obj.masterData))throw new Error('舊版客戶主資料無效');entries.push([KEYS.master,JSON.stringify(obj.masterData)])}
     if(obj.cards!==undefined){if(!Array.isArray(obj.cards))throw new Error('舊版名片資料無效');entries.push(['hongbin_crm_cards_r70',JSON.stringify(obj.cards)])}
     if(obj.settings!==undefined){if(!plain(obj.settings))throw new Error('舊版設定資料無效');entries.push(['hongbin_personal_crm_settings_v1',JSON.stringify(obj.settings)])}
   }
 }else throw new Error('無法辨識此備份版本；不會覆蓋任何資料');
 for(const [key,value] of entries)if([KEYS.crm,KEYS.master,KEYS.quotes,KEYS.progress,KEYS.history,'hongbin_crm_cards_r70'].includes(key))validShape(key,value);
 return {source,entries};
}
async function restore(){
 const file=$('restoreFile').files?.[0];if(!file){alert('請先選擇 JSON 備份檔');return}
 if(file.size>25*1024*1024){alert('檔案過大，請先確認備份格式');return}
 let converted;
 try{converted=normalizeBackup(JSON.parse(await file.text()))}
 catch(e){alert('備份檔檢查未通過：'+String(e.message||e)+'。本次沒有覆蓋任何資料。');return}
 const {entries,source}=converted;
 if(!confirm('辨識到「'+source+'」，共 '+entries.length+' 個資料項目。\n還原將覆蓋相同項目的既有資料。請先確認現有資料已備份，確定繼續？'))return;
 const previous=entries.map(([key])=>localStorage.getItem(key));
 try{for(const [key,value] of entries)localStorage.setItem(key,value)}
 catch(e){
   entries.forEach(([key],i)=>{try{previous[i]===null?localStorage.removeItem(key):localStorage.setItem(key,previous[i])}catch{}});
   alert('還原失敗，已嘗試復原原有內容：'+e.message);return
 }
 alert(source+'已還原，即將重新載入');location.reload()
}


/* R73 one-time private import. Do NOT bundle customer/price data in the public source. */
let erpPending=null;
function validateErpData(x){
 if(!x||x.format!=='hongbin-crm-erp-master-import'||x.schema!==1||x.source?.fileId!=='13dQzpVerN4XhCiYItoQWZU7GDFO6AVhI')
  throw Error('檔案不是本次指定的 ERP 主資料匯入格式');
 for(const [k,max] of [['customers',10000],['suppliers',1000],['products',20000],['customerPrices',30000]]){
  if(!Array.isArray(x[k])||!x[k].length||x[k].length>max)throw Error(k+' 筆數不合理');
 }
 const customers=new Set(),suppliers=new Set(),products=new Set(),prices=new Set();
 for(const v of x.customers){
  if(!v||typeof v.name!=='string'||!v.name.trim()||customers.has(norm(v.name)))throw Error('客戶名稱重複或空白');
  customers.add(norm(v.name));
 }
 for(const v of x.suppliers){
  if(!v||typeof v.name!=='string'||!v.name.trim()||!v.shortName||suppliers.has(norm(v.shortName)))throw Error('供應商名稱或簡稱重複');
  suppliers.add(norm(v.shortName));
 }
 for(const v of x.products){
  if(!v||!v.model||!v.supplierShortName||!suppliers.has(norm(v.supplierShortName)))throw Error('產品供應商關聯不完整');
  const key=norm(v.supplierShortName)+'|'+norm(v.model);
  if(products.has(key))throw Error('供應商品號重複');
  products.add(key);
 }
 for(const v of x.customerPrices){
  if(!v||!customers.has(norm(v.customerName))||!products.has(norm(v.supplierShortName)+'|'+norm(v.supplierPartNo))||
   !Number.isFinite(Number(v.price))||Number(v.price)<=0)throw Error('客戶售價關聯或價格不正確');
  const key=[v.customerName,v.supplierShortName,v.supplierPartNo,v.customerPartNo].map(norm).join('|');
  if(prices.has(key))throw Error('客戶售價資料重複');
  prices.add(key);
 }
 return {customers:x.customers.length,suppliers:x.suppliers.length,products:x.products.length,prices:x.customerPrices.length};
}
async function previewErpData(){
 const chosen=$('erpImportFile').files[0],status=$('erpImportStatus');erpPending=null;$('erpApplyImport').disabled=true;
 if(!chosen){status.textContent='請選擇匯入 JSON 檔';return}
 if(chosen.size>10000000){status.textContent='檔案超過安全匯入大小（10MB）';return}
 try{
  const x=JSON.parse(await chosen.text()),counts=validateErpData(x),current=getMaster();
  erpPending=x;$('erpApplyImport').disabled=false;
  status.textContent='尚未修改任何資料｜預覽\n客戶：'+counts.customers+' 筆\n供應商：'+counts.suppliers+
   ' 筆\n供應商產品：'+counts.products+' 款\n客戶售價：'+counts.prices+
   ' 筆\n來源待核對衝突：'+(x.report?.sourceConflicts?.length||0)+' 項；其中 '+(x.report?.ambiguousPriceGroupsExcluded||0)+' 組衝突售價已排除\n現有客戶：'+current.customers.length+
   ' 筆（來源外客戶保留）\n現有產品：'+current.products.length+
   ' 款（來源外舊產品會標示待核對）\n「需確認供應商」的紀錄不會匯入。\n請先下載並保存 CRM 備份，再勾選確認。';
 }catch(e){status.textContent='驗證失敗：'+String(e.message||e)}
}
function applyErpData(){
 if(!erpPending){alert('請先預覽有效的匯入資料');return}
 if(!$('erpBackupConfirmed').checked){alert('請先下載保存 CRM 備份，再勾選確認');return}
 let counts;try{counts=validateErpData(erpPending)}catch(e){alert(e.message);return}
 if(!confirm('確定更新這台 iPhone 的 ERP 供應商、產品、客戶及價格？\n其他客戶、報價、專案及待辦會保留；請確認備份已保存。'))return;
 const current=getMaster(),old=localStorage.getItem(KEYS.master);
 const customers=current.customers.map(c=>({...c}));
 const positions=new Map(customers.map((c,i)=>[norm(c.name),i]).filter(x=>x[0]));
 for(const c of erpPending.customers){
  const key=norm(c.name),index=positions.get(key);
  if(index===undefined){positions.set(key,customers.length);customers.push({...c,source:'ERP_R2_R23'})}
  else customers[index]={...customers[index],...c,source:'ERP_R2_R23'};
 }
 const keys=new Set(erpPending.products.map(p=>norm(p.supplierShortName)+'|'+norm(p.model)));
 const legacy=current.products.filter(p=>p.source!=='ERP_R2_R23'&&!keys.has(norm(p.supplierShortName||productSupplier(p))+'|'+norm(productModel(p))))
  .map(p=>({...p,source:'legacy-not-verified'}));
 const next={...current,customers,suppliers:erpPending.suppliers.map(x=>({...x})),
  products:[...erpPending.products.map(x=>({...x})),...legacy],
  customerPrices:erpPending.customerPrices.map(x=>({...x})),
  erpMasterImport:{fileId:erpPending.source.fileId,fileName:erpPending.source.fileName,counts,importedAt:new Date().toISOString(),unverifiedLegacyProducts:legacy.length}};
 const snapshot='hongbin_crm_erp_master_before_import_v1';
 try{
  if(localStorage.getItem(snapshot)===null)localStorage.setItem(snapshot,old||JSON.stringify(current));
  localStorage.setItem(KEYS.master,JSON.stringify(next));
 }catch(e){
  try{old===null?localStorage.removeItem(KEYS.master):localStorage.setItem(KEYS.master,old)}catch{}
  $('erpImportStatus').textContent='匯入失敗，原始主資料保持不變：'+String(e.message||e);return;
 }
 $('erpImportStatus').textContent='本機匯入完成：'+counts.suppliers+' 間供應商、'+counts.products+
  ' 款產品、'+counts.customers+' 筆來源客戶、'+counts.prices+' 筆客戶售價；保留 '+legacy.length+
  ' 款待核對舊產品。原報價、專案和待辦未修改。';
 erpPending=null;$('erpApplyImport').disabled=true;fillCustomerNames();toast('ERP 主資料已匯入這台 iPhone');
}

/* Supplier and product master records stay in existing hongbin_crm_master_r70. */
function supplierName(x){return String(x.name||x.supplierName||x.company||'').trim()}
function supplierEntries(){return getMaster().suppliers.filter(x=>supplierName(x))}
function productName(x){return String(x.name||x.productName||x.materialName||'').trim()}
function productModel(x){return String(x.model||x.productNo||x.partNo||x.code||'').trim()}
function productSupplier(x){return String(x.supplierName||x.supplier||'').trim()}
function productCustomer(x){
 return String(x.customerName||x.customer||customerEntries().find(t=>x.customerId!=null&&String(t.legacyId)===String(x.customerId))?.name||'').trim();
}
function productEntries(){return getMaster().products.filter(x=>productName(x))}
function renderSuppliers(){
 fillCustomerNames();const q=norm(field('supplierSearch')),m=getMaster();
 const list=m.suppliers.map((s,i)=>({...s,__index:i})).filter(s=>supplierName(s)&&(!q||norm([supplierName(s),s.shortName,s.contact,s.tel,s.email].join(' ')).includes(q)));
 $('supplierList').innerHTML=list.length?list.map(s=>{
  const count=m.products.filter(p=>norm(productSupplier(p))===norm(supplierName(s))).length;
  return '<div class="listItem"><div class="listTitle">'+esc(supplierName(s))+'</div>'+
   (s.shortName?'<div class="sub">簡稱：'+esc(s.shortName)+'</div>':'')+
   '<div class="sub">'+esc([s.contact,s.tel,s.email].filter(Boolean).join(' ｜ ')||'來源檔未提供聯絡資訊')+'</div>'+
    '<div class="sub">旗下產品：'+count+' 款</div>'+
   (s.needsSupplierNameReview?'<div class="warn">供應商全名待核對（由已確認客戶對照補全）</div>':'')+
   '<button type="button" class="secondary" data-supplier="'+s.__index+'">查看／編輯</button> '+
   '<button type="button" class="secondary supplier-products-link" data-supplier-browse="'+s.__index+'">查看旗下產品</button></div>';
 }).join(''):htmlListEmpty('尚無供應商，按新增供應商建立');
}
function editSupplier(index){
 editSupplierIndex=index==null?null:Number(index);
 const s=editSupplierIndex==null?{}:getMaster().suppliers[editSupplierIndex]||{};
 for(const [fieldName,key] of Object.entries({suName:'name',suContact:'contact',suTel:'tel',suEmail:'email',suAddress:'address',suNote:'note'}))$(fieldName).value=key==='name'?supplierName(s):s[key]||'';
 $('supplierEditorTitle').textContent=editSupplierIndex==null?'新增供應商':'編輯供應商';
 $('supplierEditor').hidden=false;$('supplierEditor').scrollIntoView({block:'start'});
}
function saveSupplier(){
 const name=field('suName');if(!name){alert('請填寫供應商名稱');return}
 const m=getMaster(),idx=editSupplierIndex,duplicate=m.suppliers.some((s,i)=>i!==idx&&norm(supplierName(s))===norm(name));
 if(duplicate){alert('供應商已存在，請直接修改原資料');return}
 const old=idx==null?{}:m.suppliers[idx]||{},next={...old,name,contact:field('suContact'),tel:field('suTel'),email:field('suEmail'),address:field('suAddress'),note:field('suNote')};
 if(idx==null)m.suppliers.push(next);else m.suppliers[idx]=next;
 if(idx!=null&&norm(supplierName(old))!==norm(name)){
  m.products.forEach(p=>{if(norm(productSupplier(p))===norm(supplierName(old)))p.supplierName=name});
  if(Array.isArray(m.customerPrices))m.customerPrices.forEach(p=>{if(norm(p.supplierName)===norm(supplierName(old)))p.supplierName=name});
 }
 if(!store(KEYS.master,m))return;
 $('supplierEditor').hidden=true;renderSuppliers();fillCustomerNames();toast('供應商已儲存');
}
function formatErpPrice(v){return Number(v).toLocaleString('zh-TW',{maximumFractionDigits:2})}
function renderProducts(){
 fillCustomerNames();const q=norm(field('productSearch')),m=getMaster(),prices=Array.isArray(m.customerPrices)?m.customerPrices:[];
 const priceLookup=new Map(),supplierNames=new Set(m.suppliers.map(s=>norm(supplierName(s))));
 for(const price of prices){const key=norm(price.supplierShortName)+'|'+norm(price.supplierPartNo);
  if(!priceLookup.has(key))priceLookup.set(key,[]);priceLookup.get(key).push(price)}
 const groups=new Map();
 m.products.forEach((p,i)=>{
  const supplier=productSupplier(p),pricing=priceLookup.get(norm(p.supplierShortName||supplier)+'|'+norm(productModel(p)))||[];
  if(!productName(p)||q&&!norm([productName(p),productModel(p),p.spec,supplier,p.supplierShortName,productCustomer(p),...pricing.map(x=>x.customerName)].join(' ')).includes(q))return;
  const group=supplierNames.has(norm(supplier))?supplier:'待核對（舊產品）';
  if(!groups.has(group))groups.set(group,[]);groups.get(group).push({p,i,pricing});
 });
 const sorted=[...groups.entries()].sort((a,b)=>a[0]==='待核對（舊產品）'?1:b[0]==='待核對（舊產品）'?-1:a[0].localeCompare(b[0],'zh-Hant'));
 $('productList').innerHTML=sorted.length?sorted.map(([supplier,items])=>
  '<details class="supplierGroup" '+(q||sorted.length<=2?'open':'')+'><summary>'+esc(supplier)+'（'+items.length+' 款產品）</summary>'+
  items.map(({p,i,pricing})=>'<div class="listItem"><div class="listTitle">'+esc(productName(p))+
   ' <span class="pill">'+esc(productModel(p)||'無型號')+'</span></div>'+
   '<div class="sub">單位：'+esc(p.unit||'—')+'　｜　包裝／規格：'+esc(p.spec||'—')+'</div>'+
   (p.fromConfirmedCustomerMapping?'<div class="sub">由已確認客戶品項對照補全</div>':'')+
   (p.source==='legacy-not-verified'?'<div class="warn">舊產品，資料待核對</div>':'')+
   (Array.isArray(p.variants)&&p.variants.length?'<details class="priceList"><summary>同品號其他規格（'+p.variants.length+'）</summary>'+
    p.variants.map(v=>'<div class="priceLine">品項：'+esc(v.name||'—')+'　｜　包裝：'+esc(v.spec||'—')+'　｜　單位：'+esc(v.unit||'—')+'</div>').join('')+'</details>':'')+
   (pricing.length?'<details class="priceList"><summary>客戶售價（'+pricing.length+' 筆）</summary>'+
    pricing.map(x=>'<div class="priceLine">'+esc(x.customerName)+'　｜　客戶品號：'+esc(x.customerPartNo||'—')+
     '　｜　售價：NT$ '+esc(formatErpPrice(x.price))+'／'+esc(x.unit||'單位')+'</div>').join('')+'</details>':
     productCustomer(p)?'<div class="sub">使用客戶：'+esc(productCustomer(p))+'</div>':'')+
   '<button type="button" class="secondary" data-product="'+i+'">查看／編輯</button></div>').join('')+
  '</details>').join(''):htmlListEmpty('尚無符合的產品');
}
function editProduct(index,customer){
 editProductIndex=index==null?null:Number(index);
 const p=editProductIndex==null?{}:getMaster().products[editProductIndex]||{};
 const map={pdName:productName(p),pdModel:productModel(p),pdSpec:p.spec||'',pdSupplier:productSupplier(p),pdCustomer:customer||productCustomer(p),pdNotes:p.notes||p.note||''};
 for(const [id,val] of Object.entries(map))$(id).value=val;
 $('productEditorTitle').textContent=editProductIndex==null?'新增產品':'編輯產品';
 openTab('products');$('productEditor').hidden=false;$('productEditor').scrollIntoView({block:'start'});
}
function saveProduct(){
 const name=field('pdName');if(!name){alert('請輸入產品名稱');return}
 const m=getMaster(),idx=editProductIndex,customer=field('pdCustomer'),model=field('pdModel');
 const supplier=field('pdSupplier');
 const match=m.products.some((p,i)=>i!==idx&&(
  (model&&supplier&&norm(productModel(p))===norm(model)&&norm(productSupplier(p))===norm(supplier))||
  (norm(productName(p))===norm(name)&&norm(productModel(p))===norm(model)&&norm(productCustomer(p))===norm(customer))));
 if(match){alert('相同名稱、型號與使用客戶的產品已存在，請編輯原項目');return}
 const old=idx==null?{}:m.products[idx]||{};
 const next={...old,name,model,spec:field('pdSpec'),supplierName:field('pdSupplier'),customerName:customer,customerId:customer?customerId(customer):null,notes:field('pdNotes')};
 if(idx==null)m.products.push(next);else m.products[idx]=next;
 if(!store(KEYS.master,m))return;
 $('productEditor').hidden=true;renderProducts();fillCustomerNames();toast('產品資料已儲存');
}
function linkedTodoCustomer(t){
 return String(t.customerName||t.customer||getCRM().customers.find(x=>t.customerId!=null&&String(x.id)===String(t.customerId))?.name||'').trim();
}
function relatedCustomer(name){
 const key=norm(name);
 const quotes=getQuotes().filter(q=>norm(q.fields?.qdCustomer||q.customerName||q.customer)===key);
 const projects=getCRM().projects.filter(p=>norm(projectCustomerName(p))===key);
 const todos=getCRM().todos.filter(t=>norm(linkedTodoCustomer(t))===key);
 const products=getMaster().products.map((p,i)=>({...p,__index:i})).filter(p=>norm(productCustomer(p))===key);
 const customerPrices=(Array.isArray(getMaster().customerPrices)?getMaster().customerPrices:[]).filter(p=>norm(p.customerName)===key);
 return {quotes,projects,todos,products,customerPrices};
}
function showCustomer360(name){
 const customer=customerByName(name);if(!customer)return;
 customer360Name=customer.name;
 const related=relatedCustomer(name);
 const metrics=[['報價單',related.quotes.length],['專案',related.projects.length],['待辦',related.todos.length],['使用產品',related.products.length+related.customerPrices.length]];
 $('customer360Title').textContent=customer.name;
 const block=(title,items,render,empty,footer='')=>
  '<section class="customer360-block'+(items.length?'':' is-empty')+'"><h3>'+esc(title)+'（'+items.length+'）</h3>'+
  (items.length?items.map(render).join(''):'<div class="customer360-empty">'+esc(empty)+'</div>')+footer+'</section>';
 const facts=[
  ['聯絡人',customer.contact],
  ['手機',customer.mobile],
  ['公司電話',customer.tel],
  ['傳真',customer.fax],
  ['Email',customer.email],
  ['統一編號',customer.taxId],
  ['地址',customer.address]
 ].filter(([,value])=>String(value||'').trim());
 const factsHtml=facts.length?'<div class="customer-info-list">'+facts.map(([key,value])=>
  '<div class="customer-info-row"><span class="customer-info-key">'+esc(key)+'</span><span class="customer-info-value">'+esc(value)+'</span></div>').join('')+'</div>':
  '<div class="customer360-empty">尚未填寫聯絡資料</div>';
 const customerInfoHtml='<section class="customer360-block"><h3>客戶基本資料</h3>'+factsHtml+
  '<button type="button" class="secondary" data-customer-edit="'+esc(name)+'">修改客戶資料</button></section>';
 const products=block('使用產品',related.products,p=>
  '<div class="customer360-entry"><strong>'+esc(productName(p))+'</strong><div class="sub">型號：'+esc(productModel(p)||'—')+'　規格：'+esc(p.spec||'—')+'</div><div class="sub">供應商：'+esc(productSupplier(p)||'—')+'</div><button type="button" class="secondary" data-customer-product="'+p.__index+'">編輯產品</button></div>',
  '尚未建立使用產品','<button id="addCustomerProduct" class="customer-product-action" type="button">＋ 新增該客戶使用產品</button>');
 const customerPriceList=block('ERP 客戶使用產品及售價',related.customerPrices,x=>
  '<div class="customer360-entry"><strong>'+esc(x.productName||x.supplierPartNo)+'</strong>'+
  '<div class="sub">供應商：'+esc(x.supplierName||x.supplierShortName)+'　｜　供應商品號：'+esc(x.supplierPartNo)+'</div>'+
  '<div class="sub">客戶品號：'+esc(x.customerPartNo||'—')+'　｜　售價：NT$ '+esc(formatErpPrice(x.price))+'／'+esc(x.unit||'單位')+'</div></div>',
  '此客戶沒有已確認售價');
 const quotes=block('報價單',related.quotes,q=>
  '<div class="customer360-entry"><strong>'+esc(q.fields?.qdNo||'未編號')+'</strong><div class="sub">'+esc(q.fields?.qdDate||'未設定日期')+'</div><button type="button" class="secondary" data-customer-quote="'+esc(q.id)+'">開啟報價</button></div>','尚無報價單');
 const projects=block('專案追蹤',related.projects,p=>
  '<div class="customer360-entry"><strong>'+esc(p.name||'未命名專案')+'</strong><div class="sub">階段：'+esc(p.stage||'—')+'　進度：'+esc(projectProgress(p).progress||p.progress||'—')+'</div><div class="sub">下次追蹤：'+esc(p.followDate||'未設定')+'</div><button type="button" class="secondary" data-customer-project="'+esc(p.id)+'">查看追蹤</button></div>','尚無專案');
 const todos=block('待辦行事曆',related.todos.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))),t=>
  '<div class="customer360-entry"><strong>'+esc(t.text||'未命名待辦')+'</strong><div class="sub">'+esc(t.date||'未指定日期')+'　'+esc(t.time||'')+'　'+(t.done?'已完成':'待處理')+'</div><button type="button" class="secondary" data-customer-todo="'+esc(t.id)+'">查看待辦</button></div>','尚無客戶相關待辦');
 $('customer360Content').innerHTML='<div class="customer360-badges">'+metrics.map(x=>'<span class="pill">'+esc(x[0])+' '+x[1]+' 筆</span>').join('')+'</div>'+customerInfoHtml+products+customerPriceList+quotes+projects+todos;
 $('customerListCard').hidden=true;
 $('customer360').hidden=false;
 $('customer360').scrollIntoView({block:'start'});
}
/* Input assistance: touch-friendly candidate list; users may still enter a new value. */
function candidateValues(el){
 const id=el.id||'',cls=el.classList,m=getMaster(),qs=getQuotes();
 if(['qdCustomer','pCustomer','tCustomer','pdCustomer'].includes(id))return customerEntries().map(x=>x.name);
 if(id==='pdSupplier')return supplierEntries().map(supplierName);
 if(id==='pdName'||cls.contains('it-name'))return productEntries().map(productName).concat(qs.flatMap(q=>(q.items||[]).map(i=>i.name)));
 if(id==='pdModel'||cls.contains('it-model'))return productEntries().map(productModel);
 if(id==='qdDelivery')return qs.map(q=>q.fields?.qdDelivery);
 if(id==='qdPayment')return qs.map(q=>q.fields?.qdPayment);
 if(id==='pName')return getCRM().projects.map(p=>p.name);
 if(id==='tText')return getCRM().todos.map(t=>t.text);
 if(id==='cuContact')return customerEntries().map(c=>c.contact);
 if(id==='suContact')return supplierEntries().map(s=>s.contact);
 if(cls.contains('it-spec')||id==='pdSpec')return productEntries().map(p=>p.spec);
 return [];
}
let suggestionTarget=null;
function hideCandidates(){$('smartSuggestions').hidden=true;$('smartSuggestions').replaceChildren();suggestionTarget=null}
function showCandidates(el){
 const values=[...new Set(candidateValues(el).filter(Boolean).map(x=>String(x).trim()))];
 if(!values.length){hideCandidates();return}
 const typed=norm(el.value);
 const results=values.filter(v=>!typed||norm(v).includes(typed)).sort((a,b)=>(norm(a).startsWith(typed)?0:1)-(norm(b).startsWith(typed)?0:1)||a.localeCompare(b,'zh-Hant')).slice(0,8);
 if(!results.length){hideCandidates();return}
 const rect=el.getBoundingClientRect(),box=$('smartSuggestions'),spaceBelow=innerHeight-rect.bottom;
 box.style.left=Math.max(6,Math.min(rect.left,innerWidth-Math.max(rect.width,190)-6))+'px';
 box.style.width=Math.min(innerWidth-12,Math.max(rect.width,210))+'px';
 box.style.top=(spaceBelow>180?Math.min(innerHeight-240,rect.bottom+3):Math.max(4,rect.top-Math.min(240,results.length*47+8)))+'px';
 box.replaceChildren(...results.map(v=>{const b=document.createElement('button');b.type='button';b.role='option';b.textContent=v;b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=()=>{
    el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
    if(el.classList.contains('it-name')){const product=productEntries().find(p=>norm(productName(p))===norm(v));const card=el.closest('.items');if(card&&product){const model=card.querySelector('.it-model'),spec=card.querySelector('.it-spec');if(model&&!model.value)model.value=productModel(product);if(spec&&!spec.value)spec.value=product.spec||''}}
    hideCandidates();el.focus()
  };return b}));
 box.hidden=false;suggestionTarget=el;
}
document.addEventListener('focusin',e=>{if(e.target.matches('input')&&!e.target.matches('[type=date],[type=time],[type=number],[type=file]'))showCandidates(e.target)});
document.addEventListener('input',e=>{if(e.target===suggestionTarget||candidateValues(e.target).length)showCandidates(e.target)});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#smartSuggestions')&&!e.target.closest('input'))hideCandidates()});
document.addEventListener('focusout',e=>{if(e.target===suggestionTarget)setTimeout(()=>{if(document.activeElement!==suggestionTarget)hideCandidates()},160)});

// ── Events ──
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tab)));
$('quoteSearch').addEventListener('input',renderQuotes);$('newQuote').onclick=()=>editQuote(null);$('quoteList').onclick=e=>{const b=e.target.closest('[data-quote]');if(b)editQuote(b.dataset.quote)};
$('qdCustomer').addEventListener('change',()=>{const c=customerByName(field('qdCustomer'));if(c){if(!field('qdContact'))$('qdContact').value=c.contact||'';if(!field('qdTel'))$('qdTel').value=c.tel||'';if(!field('qdFax'))$('qdFax').value=c.fax||''}});
$('addQuoteItem').onclick=()=>addItem();$('saveQuote').onclick=saveQuote;$('previewQuote').onclick=previewQuote;$('printQuote').onclick=printQuote;$('exportPdf').onclick=pdfQuote;$('hideQuotePreview').onclick=()=>$('quotePreview').hidden=true;$('cancelQuote').onclick=()=>$('quoteEditor').hidden=true;
$('customerSearch').addEventListener('input',renderCustomers);$('newCustomer').onclick=()=>editCustomer(null);$('customerList').onclick=e=>{const b=e.target.closest('[data-customer]');if(b)showCustomer360(b.dataset.customer)};$('closeCustomer360').onclick=()=>{$('customer360').hidden=true;$('customerListCard').hidden=false;customer360Name=null;$('customerEditor').hidden=true;$('customerListCard').scrollIntoView({block:'start'})};$('customer360Content').onclick=e=>{const t=e.target;if(t.closest('[data-customer-edit]')){editCustomer(t.closest('[data-customer-edit]').dataset.customerEdit);return}if(t.id==='addCustomerProduct'){editProduct(null,customer360Name);return}let b=t.closest('[data-customer-product]');if(b){editProduct(b.dataset.customerProduct);return}b=t.closest('[data-customer-quote]');if(b){openTab('quotes');editQuote(b.dataset.customerQuote);return}b=t.closest('[data-customer-project]');if(b){openTab('projects');editProject(b.dataset.customerProject);return}b=t.closest('[data-customer-todo]');if(b){const rec=todoItems().find(x=>String(x.id)===String(b.dataset.customerTodo));if(rec?.date){selectedDate=rec.date;monthDate=new Date(rec.date+'T12:00:00')}openTab('calendar');editTodo(b.dataset.customerTodo)}};$('saveCustomer').onclick=saveCustomer;$('cancelCustomer').onclick=()=>$('customerEditor').hidden=true;
function shiftMonth(delta){const d=Math.max(1,Number(selectedDate.slice(-2))||1);monthDate=new Date(monthDate.getFullYear(),monthDate.getMonth()+delta,1);const max=new Date(monthDate.getFullYear(),monthDate.getMonth()+1,0).getDate();selectedDate=localDate(new Date(monthDate.getFullYear(),monthDate.getMonth(),Math.min(d,max)));renderCalendar()}
function selectMonth(y,m){const day=Math.min(Number(selectedDate.slice(-2))||1,new Date(y,m+1,0).getDate());monthDate=new Date(y,m,1);selectedDate=localDate(new Date(y,m,day));renderCalendar()}
const yr=$('calendarYear'),mo=$('calendarMonth');for(let y=1980;y<=2100;y++){const o=document.createElement('option');o.value=String(y);o.textContent=y+' 年';yr.appendChild(o)}
for(let m=1;m<=12;m++){const o=document.createElement('option');o.value=String(m);o.textContent=m+' 月';mo.appendChild(o)}
yr.onchange=()=>selectMonth(Number(yr.value),monthDate.getMonth());mo.onchange=()=>selectMonth(monthDate.getFullYear(),Number(mo.value)-1);
$('calendarToday').onclick=()=>{selectedDate=localDate();monthDate=new Date();renderCalendar()};
let swipeStart=null;
$('calendarSwipeArea').addEventListener('touchstart',e=>{if(e.touches.length===1)swipeStart={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
$('calendarSwipeArea').addEventListener('touchend',e=>{if(!swipeStart||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-swipeStart.x,dy=e.changedTouches[0].clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>=55&&Math.abs(dx)>Math.abs(dy)*1.3)shiftMonth(dx<0?1:-1)},{passive:true});
$('prevMonth').onclick=()=>shiftMonth(-1);$('nextMonth').onclick=()=>shiftMonth(1);$('newTodo').onclick=()=>editTodo(null);$('todoList').onchange=e=>{if(e.target.matches('[data-complete]'))toggleTodo(e.target.dataset.complete,e.target.checked)};$('todoList').onclick=e=>{const b=e.target.closest('[data-todo]');if(b)editTodo(b.dataset.todo)};$('saveTodo').onclick=saveTodo;$('cancelTodo').onclick=()=>$('todoEditor').hidden=true;
$('projectSearch').addEventListener('input',renderProjects);$('newProject').onclick=()=>editProject(null);$('projectList').onclick=e=>{const b=e.target.closest('[data-project]');if(b)editProject(b.dataset.project)};$('saveProject').onclick=saveProject;$('cancelProject').onclick=()=>$('projectEditor').hidden=true;
$('supplierSearch').oninput=renderSuppliers;$('newSupplier').onclick=()=>editSupplier(null);$('supplierList').onclick=e=>{const b=e.target.closest('[data-supplier-browse]');if(b){
 const item=getMaster().suppliers[Number(b.dataset.supplierBrowse)];if(item){$('productSearch').value=supplierName(item);openTab('products')}return}
 const edit=e.target.closest('[data-supplier]');if(edit)editSupplier(edit.dataset.supplier)};$('saveSupplier').onclick=saveSupplier;$('cancelSupplier').onclick=()=>$('supplierEditor').hidden=true;
$('productSearch').oninput=renderProducts;$('newProduct').onclick=()=>editProduct(null);$('productList').onclick=e=>{const b=e.target.closest('[data-product]');if(b)editProduct(b.dataset.product)};$('saveProduct').onclick=saveProduct;$('cancelProduct').onclick=()=>$('productEditor').hidden=true;
$('downloadBackup').onclick=backup;$('restoreBackup').onclick=restore;
$('erpImportFile').onchange=()=>{erpPending=null;$('erpApplyImport').disabled=true;$('erpBackupConfirmed').checked=false;$('erpImportStatus').textContent='已選擇匯入檔，請按預覽';};
$('erpPreviewImport').onclick=previewErpData;$('erpApplyImport').onclick=applyErpData;
window.addEventListener('beforeunload',()=>{if(lastPdfUrl)URL.revokeObjectURL(lastPdfUrl)});

window.addEventListener('resize',fitLegacyQuotePreview);
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.altKey||e.metaKey||e.isComposing||e.keyCode===229)return;
  const el=e.target;
  if(!(el instanceof HTMLElement)||!el.matches('input:not([type="submit"]):not([type="button"]),select'))return;
  const form=el.closest('.editor');
  if(!form||form.hidden||form.closest('[hidden]'))return;
  const nodes=[...form.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="file"]),select,textarea')].filter(n=>!n.disabled&&n.getClientRects().length);
  const i=nodes.indexOf(el);if(i<0)return;
  const next=nodes[i+1]||form.querySelector('.actions button:not([disabled])');
  if(!next)return;
  e.preventDefault();next.focus();
  if(next.matches('input[type="text"],input:not([type])')&&typeof next.select==='function')next.select();
},true);

/* 全頁共用「回頂端」按鈕，滾動才顯示；避免覆蓋 iPhone Safari 工具列。 */
const backToTop=$('backToTop');
function updateBackToTop(){backToTop.hidden=(window.scrollY||document.documentElement.scrollTop||0)<180}
backToTop.onclick=()=>{
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 window.scrollTo({top:0,behavior:reduced?'instant':'smooth'});
};
window.addEventListener('scroll',updateBackToTop,{passive:true});
window.addEventListener('pageshow',updateBackToTop);

fillCustomerNames();renderQuotes();openTab('quotes');
updateBackToTop();
})();
