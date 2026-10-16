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
let currentTab='quotes',editCustomerName=null,editCustomerCrmId=null,editQuoteId=null,editTodoId=null,editProjectId=null,selectedDate=localDate(),monthDate=new Date(),lastPdfUrl=null;
const QUOTE_FIELDS=['qdCustomer','qdContact','qdTel','qdFax','qdNo','qdDate','qdDelivery','qdPayment','qdPlace','qdValid','qdSales','qdSalesTel','qdNotes'];
const defaults={qdDelivery:'有庫存 3 天內交貨，如無庫存需 30 天',qdPayment:'次月60天',qdPlace:'貴公司交貨處或指定交貨處',qdValid:'三十日',qdNotes:'1：以上價格為未稅價。\n2：實際價格以訂單確認為準。\n3：特殊規格或需求，請先行告知。'};
function toast(msg){const n=$('toast');n.textContent=msg;n.style.display='block';setTimeout(()=>{n.style.display='none'},2500)}
function openTab(tab){if(!['quotes','customers','calendar','projects','backup'].includes(tab))tab='quotes';currentTab=tab;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab))});document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!=='panel-'+tab);if(tab==='quotes')renderQuotes();if(tab==='customers')renderCustomers();if(tab==='calendar')renderCalendar();if(tab==='projects')renderProjects();if(tab==='backup')renderStorage();window.scrollTo({top:0,behavior:'instant'})}
function customerEntries(){const m=getMaster().customers,c=getCRM().customers,map=new Map();m.forEach(x=>{const key=norm(x.name);if(key)map.set(key,{...x,legacyId:c.find(v=>norm(v.name)===key)?.id})});c.forEach(x=>{const key=norm(x.name);if(key&&!map.has(key))map.set(key,{name:x.name,legacyId:x.id})});return [...map.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),'zh-Hant'))}
function fillCustomerNames(){const node=$('customerNames');node.replaceChildren(...customerEntries().map(x=>{const o=document.createElement('option');o.value=x.name;return o}))}
function customerByName(name){return customerEntries().find(c=>norm(c.name)===norm(name))}
function customerId(name){return getCRM().customers.find(c=>norm(c.name)===norm(name))?.id??null}
function htmlListEmpty(label){return '<div class="muted">'+esc(label)+'</div>'}
function customerInfo(c){return [c.contact,c.mobile,c.tel,c.address].filter(Boolean).join(' ｜ ')}
// ── Customer ──
function renderCustomers(){fillCustomerNames();const q=norm(field('customerSearch'));const list=customerEntries().filter(c=>!q||norm([c.name,c.contact,c.tel,c.mobile,c.address,c.taxId].join(' ')).includes(q));$('customerList').innerHTML=list.length?list.map(c=>'<div class="listItem"><div class="listTitle">'+esc(c.name)+'</div><div class="sub">'+esc(customerInfo(c)||'尚未填寫聯絡資訊')+'</div><div class="actions"><button type="button" class="secondary" data-customer="'+esc(c.name)+'">查看／編輯</button></div></div>').join(''):htmlListEmpty('目前沒有符合的客戶');}
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
 editCustomerName=null;editCustomerCrmId=null;$('customerEditor').hidden=true;renderCustomers();toast('客戶資料已儲存')}
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
function quoteSheets(data){const fields=data.fields||{},items=data.items?.length?data.items:[{}],pageItems=[];for(let i=0;i<items.length;i+=4)pageItems.push(items.slice(i,i+4));
 return pageItems.map((subset,p)=>{const sum=items.reduce((a,i)=>a+(Number(i.price)||0)*(Number(i.qty)||1),0);const last=p===pageItems.length-1;
 return '<article class="sheet"><img class="letterhead" src="./quote-letterhead.jpg" alt="鴻繽科技有限公司報價單抬頭"><h2>報　價　單</h2><div class="paperMeta"><div>客戶：'+esc(fields.qdCustomer)+'</div><div>編號：'+esc(fields.qdNo)+'</div><div>聯絡人：'+esc(fields.qdContact)+'</div><div>日期：'+esc(fields.qdDate)+'</div><div>電話：'+esc(fields.qdTel)+'</div><div>傳真：'+esc(fields.qdFax)+'</div></div><table class="paperTbl"><thead><tr><th>品名／規格</th><th>型號</th><th>數量</th><th>單價</th><th>小計</th></tr></thead><tbody>'+subset.map(it=>'<tr><td>'+esc(it.name)+'<div>'+esc(it.spec)+'</div><div>'+esc(it.moq?'MOQ：'+it.moq:'')+'</div></td><td>'+esc(it.model)+'</td><td>'+esc(it.qty||1)+'</td><td>'+esc(it.price||0)+'</td><td>'+esc((((Number(it.price)||0)*(Number(it.qty)||1))).toLocaleString('zh-TW'))+'</td></tr>').join('')+'</tbody></table>'+(last?'<div class="paperTotal">未稅總額：NT$ '+sum.toLocaleString('zh-TW')+'</div><div class="labelLine">交貨時間：'+esc(fields.qdDelivery)+'</div><div class="labelLine">付款條件：'+esc(fields.qdPayment)+'</div><div class="labelLine">交貨地點：'+esc(fields.qdPlace)+'</div><div class="labelLine">有效期限：'+esc(fields.qdValid)+'</div><p class="paperFoot">備註：\n'+esc(fields.qdNotes)+'</p><div class="paperFoot">業務代表：'+esc(fields.qdSales)+'　'+esc(fields.qdSalesTel)+'</div>':'<div class="muted">接續第 '+(p+2)+' 頁</div>')+'<div class="muted" style="text-align:right">第 '+(p+1)+'／'+pageItems.length+' 頁</div></article>'}).join('')}
function previewQuote(){const data=quoteData();if(!validateQuote(data))return false;const pages=quoteSheets(data);$('quotePreviewPages').innerHTML=pages;$('printRoot').innerHTML=pages;$('quotePreview').hidden=false;$('quotePreview').scrollIntoView({block:'start',behavior:'smooth'});return true}
function printQuote(){if(previewQuote())window.print()}
async function loadScript(url,isReady){if(isReady())return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(new Error('PDF 元件載入失敗，請使用列印／儲存 PDF'));document.head.appendChild(s)})}
async function pdfQuote(){if(!previewQuote())return;const msg=$('pdfNotice');msg.textContent='正在產生 PDF，請稍候……';try{
 await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',()=>!!window.html2canvas);
 await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',()=>!!window.jspdf);
 const pdf=new window.jspdf.jsPDF({format:'a4',unit:'mm',orientation:'portrait'}),pages=[...$('printRoot').querySelectorAll('.sheet')];for(let i=0;i<pages.length;i++){const clone=pages[i].cloneNode(true);clone.style.cssText='width:794px!important;max-width:794px!important;position:fixed;left:-10000px;top:0;margin:0;';document.body.appendChild(clone);let canvas;try{canvas=await window.html2canvas(clone,{scale:2,backgroundColor:'#fff',useCORS:true})}finally{clone.remove()}if(i)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',.93),'JPEG',0,0,210,297)}
 const blob=pdf.output('blob');if(lastPdfUrl)URL.revokeObjectURL(lastPdfUrl);lastPdfUrl=URL.createObjectURL(blob);msg.replaceChildren();msg.append('PDF 已產生，請點此連結： ');const link=document.createElement('a');link.href=lastPdfUrl;link.download='報價單_'+field('qdNo')+'.pdf';link.target='_blank';link.rel='noopener';link.textContent='開啟／下載 PDF';msg.appendChild(link)
}catch(e){msg.textContent='PDF 產生失敗：'+String(e.message||e)+'。可改按「預覽／列印」使用 Safari 列印功能。'}}
// ── Calendar ──
function todoItems(){return getCRM().todos}
function renderCalendar(){const year=monthDate.getFullYear(),month=monthDate.getMonth();$('calTitle').textContent=year+' 年 '+(month+1)+' 月';const cal=$('calendarGrid');cal.replaceChildren();'日一二三四五六'.split('').forEach(d=>{const n=document.createElement('div');n.className='weekday';n.textContent=d;cal.appendChild(n)});const first=new Date(year,month,1).getDay(),count=new Date(year,month+1,0).getDate(),items=todoItems();
 for(let i=0;i<first;i++){const n=document.createElement('div');n.className='day empty';cal.appendChild(n)}
 for(let d=1;d<=count;d++){const date=localDate(new Date(year,month,d));const n=document.createElement('button');n.type='button';n.className='day'+(date===localDate()?' today':'')+(items.some(t=>t.date===date)?' dot':'')+(date===selectedDate?' chosen':'');n.textContent=String(d);n.setAttribute('aria-label',date+' 待辦事項');n.setAttribute('aria-pressed',String(date===selectedDate));n.onclick=()=>{selectedDate=date;renderCalendar()};cal.appendChild(n)}renderTodos()}
function renderTodos(){const day=todoItems().filter(t=>t.date===selectedDate);$('selectedDayTitle').textContent=selectedDate+' 的待辦（'+day.length+'）';$('todoList').innerHTML=day.length?day.map(t=>'<div class="listItem task '+(t.done?'done':'')+'"><label class="taskCheck"><input type="checkbox" data-complete="'+esc(t.id)+'" '+(t.done?'checked':'')+'><span class="listTitle">'+esc(t.text)+'</span></label>'+(t.notes?'<div class="sub">'+esc(t.notes)+'</div>':'')+'<button type="button" class="secondary" data-todo="'+esc(t.id)+'">修改</button></div>').join(''):htmlListEmpty('當天沒有待辦')}
function editTodo(id){const t=id==null?null:todoItems().find(x=>String(x.id)===String(id));editTodoId=t?.id??null;$('tDate').value=t?.date||selectedDate;$('tText').value=t?.text||'';$('tNotes').value=t?.notes||'';$('todoEditor').hidden=false;$('todoEditor').scrollIntoView({behavior:'smooth',block:'start'})}
function saveTodo(){const text=field('tText'),date=field('tDate');if(!text||!date){alert('請輸入待辦日期與內容');return}const d=getCRM(),i=d.todos.findIndex(x=>editTodoId!=null&&String(x.id)===String(editTodoId)),old=i>=0?d.todos[i]:null,next={...(old||{}),id:old?.id??uniqueId(),text,date,notes:field('tNotes'),done:old?.done??false};if(i>=0)d.todos[i]=next;else d.todos.unshift(next);if(!store(KEYS.crm,d))return;selectedDate=date;monthDate=new Date(date+'T12:00:00');$('todoEditor').hidden=true;renderCalendar();toast('待辦已儲存')}
function toggleTodo(id,checked){const d=getCRM(),t=d.todos.find(x=>String(x.id)===String(id));if(!t)return;t.done=checked;if(store(KEYS.crm,d))renderCalendar()}
// ── Project ──
const STAGES=['進行中','已成交','暫停','結案','取消'],PROGRESS=['','初步接洽','需求確認','送樣中','客戶測試中','報價中','待客戶確認','待採購確認','成交準備'];
function projectProgress(p){const prog=getProgress();return prog[p.id]||prog[p.name]||{}}
function renderProjects(){const q=norm(field('projectSearch'));const list=getCRM().projects.filter(p=>!q||norm([p.name,p.customerName,p.stage,p.owner].join(' ')).includes(q));$('projectList').innerHTML=list.length?list.map(p=>{const pr=projectProgress(p);return '<div class="listItem"><div class="listTitle">'+esc(p.name||'未命名專案')+'</div><div class="sub">'+esc(p.customerName||'未指定客戶')+'　｜　'+esc(p.stage||'未設定')+'　｜　'+esc(pr.progress||p.progress||'未設定進度')+'</div><div class="sub">下次追蹤：'+esc(p.followDate||'未設定')+'</div><button class="secondary" data-project="'+esc(p.id)+'" type="button">查看／追蹤</button></div>'}).join(''):htmlListEmpty('尚無符合的專案')}
function renderHistory(id){const list=getHist()[id]||[];const original=getCRM().projects.find(p=>String(p.id)===String(id));const legacy=original?projectProgress(original):{};const oldNote=legacy?.note?'<div class="note"><strong>既有進度註記（舊版資料）</strong><div>'+esc(legacy.note)+'</div></div>':'';$('projectHistory').innerHTML=oldNote+(list.length?list.slice().reverse().map(h=>'<div class="note"><strong>'+esc(h.date)+'</strong><div>'+esc(h.note)+'</div><div class="sub">階段：'+esc(h.stage)+'｜進度：'+esc(h.progress||'未設定')+'</div></div>').join(''):oldNote?'':htmlListEmpty('尚無追蹤紀錄'))}
function editProject(id){const p=id==null?null:getCRM().projects.find(x=>String(x.id)===String(id));editProjectId=p?.id??null;const pr=p?projectProgress(p):{};$('pName').value=p?.name||'';$('pCustomer').value=p?.customerName||'';$('pOwner').value=p?.owner||'';$('pFollowDate').value=p?.followDate||'';for(const node of $('pStage').querySelectorAll('option[data-legacy]'))node.remove();for(const node of $('pProgress').querySelectorAll('option[data-legacy]'))node.remove();const stage=p?.stage||'進行中';if(!STAGES.includes(stage)){const old=document.createElement('option');old.dataset.legacy='1';old.value=stage;old.textContent='舊階段：'+stage;$('pStage').appendChild(old)}$('pStage').value=stage;const progress=pr.progress||p?.progress||'';if(!PROGRESS.includes(progress)){const opt=document.createElement('option');opt.dataset.legacy='1';opt.value=progress;opt.textContent='舊進度：'+progress;$('pProgress').appendChild(opt)}$('pProgress').value=progress;$('pNote').value='';$('projectEditorTitle').textContent=p?'專案追蹤':'新增專案';renderHistory(p?.id??'new');$('projectEditor').hidden=false;$('projectEditor').scrollIntoView({behavior:'smooth',block:'start'})}
function saveProject(){const name=field('pName');if(!name){alert('請輸入專案名稱');return}const crm=getCRM(),i=crm.projects.findIndex(p=>editProjectId!=null&&String(p.id)===String(editProjectId)),old=i>=0?crm.projects[i]:null;const nameOf=field('pCustomer'),pr=field('pProgress'),stage=field('pStage'),note=field('pNote'),id=old?.id??uniqueId();
 const next={...(old||{}),id,name,customerId:customerId(nameOf),customerName:nameOf,owner:field('pOwner'),followDate:field('pFollowDate'),stage};
 if(i>=0)crm.projects[i]=next;else crm.projects.unshift(next);
 const progress=getProgress(),hist=getHist();const existingProgress=progress[id]||progress[old?.name]||{};const hadChange=!old||note||old.name!==name||old.customerName!==nameOf||old.owner!==next.owner||old.stage!==stage||(old.followDate||'')!==next.followDate||(existingProgress.progress||old.progress||'')!==pr;progress[id]={...existingProgress,progress:pr,note:existingProgress.note||''};if(hadChange){hist[id]=[...(hist[id]||[]),{id:uniqueId(),date:new Date().toISOString(),note:note||(!old?'建立專案':'更新專案資料、階段或追蹤日期'),stage,progress:pr,followDate:next.followDate}]}
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
// ── Events ──
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tab)));
$('quoteSearch').addEventListener('input',renderQuotes);$('newQuote').onclick=()=>editQuote(null);$('quoteList').onclick=e=>{const b=e.target.closest('[data-quote]');if(b)editQuote(b.dataset.quote)};
$('qdCustomer').addEventListener('change',()=>{const c=customerByName(field('qdCustomer'));if(c){if(!field('qdContact'))$('qdContact').value=c.contact||'';if(!field('qdTel'))$('qdTel').value=c.tel||'';if(!field('qdFax'))$('qdFax').value=c.fax||''}});
$('addQuoteItem').onclick=()=>addItem();$('saveQuote').onclick=saveQuote;$('previewQuote').onclick=previewQuote;$('printQuote').onclick=printQuote;$('exportPdf').onclick=pdfQuote;$('hideQuotePreview').onclick=()=>$('quotePreview').hidden=true;$('cancelQuote').onclick=()=>$('quoteEditor').hidden=true;
$('customerSearch').addEventListener('input',renderCustomers);$('newCustomer').onclick=()=>editCustomer(null);$('customerList').onclick=e=>{const b=e.target.closest('[data-customer]');if(b)editCustomer(b.dataset.customer)};$('saveCustomer').onclick=saveCustomer;$('cancelCustomer').onclick=()=>$('customerEditor').hidden=true;
function shiftMonth(delta){const d=Math.max(1,Number(selectedDate.slice(-2))||1);monthDate=new Date(monthDate.getFullYear(),monthDate.getMonth()+delta,1);const max=new Date(monthDate.getFullYear(),monthDate.getMonth()+1,0).getDate();selectedDate=localDate(new Date(monthDate.getFullYear(),monthDate.getMonth(),Math.min(d,max)));renderCalendar()}
$('prevMonth').onclick=()=>shiftMonth(-1);$('nextMonth').onclick=()=>shiftMonth(1);$('newTodo').onclick=()=>editTodo(null);$('todoList').onchange=e=>{if(e.target.matches('[data-complete]'))toggleTodo(e.target.dataset.complete,e.target.checked)};$('todoList').onclick=e=>{const b=e.target.closest('[data-todo]');if(b)editTodo(b.dataset.todo)};$('saveTodo').onclick=saveTodo;$('cancelTodo').onclick=()=>$('todoEditor').hidden=true;
$('projectSearch').addEventListener('input',renderProjects);$('newProject').onclick=()=>editProject(null);$('projectList').onclick=e=>{const b=e.target.closest('[data-project]');if(b)editProject(b.dataset.project)};$('saveProject').onclick=saveProject;$('cancelProject').onclick=()=>$('projectEditor').hidden=true;
$('downloadBackup').onclick=backup;$('restoreBackup').onclick=restore;
window.addEventListener('beforeunload',()=>{if(lastPdfUrl)URL.revokeObjectURL(lastPdfUrl)});
fillCustomerNames();renderQuotes();openTab('quotes');
})();
