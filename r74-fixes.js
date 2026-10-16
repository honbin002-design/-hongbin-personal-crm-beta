(()=>{'use strict';
const $=id=>document.getElementById(id);
const norm=v=>String(v==null?'':v).trim().toLocaleLowerCase().replace(/[\s　]+/g,'');
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key,fallback)=>{try{const x=JSON.parse(localStorage.getItem(key)||'null');return x??fallback}catch(_){return fallback}};
const MASTER='hongbin_crm_master_r70',CRM='hongbin_personal_crm_v3',CARDS='hongbin_crm_cards_r70',PROGRESS='hongbin_crm_project_progress_r72';
function master(){return Object.assign({customers:[],products:[],suppliers:[]},read(MASTER,{}))}
function field(label,value){return '<div class="r74-field"><b>'+esc(label)+'</b><span>'+esc(value||'—')+'</span></div>'}
function installCss(){
 if($('r74Style'))return;
 const s=document.createElement('style');s.id='r74Style';s.textContent='.r74-field{display:grid;grid-template-columns:minmax(90px,33%) 1fr;gap:10px;padding:8px 0;border-bottom:1px solid #42484d;overflow-wrap:anywhere}.r74-field b{color:#d3bca0}.r74-panel{margin:12px 0}.r74-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:8px}.r74-grid a{display:block;padding:13px;background:#262c32;border:1px solid #8e734e;border-radius:8px;text-align:center;color:#fff;text-decoration:none}.r74-list{max-height:65vh;overflow:auto}.r74-item{padding:12px 4px;border-bottom:1px solid #454b50}.r74-item b{display:block;color:#f2e5d8}.r74-item small{display:block;font-size:14px;line-height:1.5;color:#d8cfc4}.r74-summary{color:#dbd0bf;padding:7px 0}.r74-customer-note{padding:9px;color:#e6d0b4}#quoteDocument .q-editor-grid{display:grid!important;visibility:visible!important}.nav{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:6px!important}.nav a,.nav #r74MoreNav{font-size:14px!important;min-height:46px!important;padding:7px 2px!important;line-height:1.2!important}.nav .r74-nav-secondary{display:none!important}.nav.r74-more-open .r74-nav-secondary{display:flex!important}.nav #r74MoreNav{width:100%!important;border:1px solid #8e734e!important;border-radius:10px!important}.r74-preview{padding:9px;margin-top:9px;border:1px solid #555;border-radius:6px;background:#1a2026}#r74OcrRaw{width:100%;height:130px;white-space:pre-wrap;resize:vertical}';
 document.head.appendChild(s)
}
function customerName(id){const crm=read(CRM,{});return (crm.customers||[]).find(x=>String(x.id)===String(id))?.name||''}
function installCustomer360(){
 if(window.__r74Customer360Wrapped||typeof window.openCustomer360!=='function')return;
 const original=window.openCustomer360;
 window.openCustomer360=function(id){const result=original.apply(this,arguments);showCustomerDetails(customerName(id),id);return result};
 window.__r74Customer360Wrapped=true;
}
function showCustomerDetails(name,id){
 const panel=$('customer360');if(!panel||!name)return;
 let box=$('r74CustomerDetails');
 if(!box){box=document.createElement('div');box.id='r74CustomerDetails';box.className='card r74-panel';const timeline=panel.querySelector('.card:nth-of-type(2)');if(timeline)panel.insertBefore(box,timeline);else panel.appendChild(box)}
 const m=master(),c=m.customers.find(x=>norm(x.name)===norm(name))||null;
 const cards=read(CARDS,[]).filter(x=>x.customerId!=null?String(x.customerId)===String(id):norm(x.customerName||x.company)===norm(name));
 const products=m.products.filter(x=>norm(x.customerName)===norm(name));
 let html='<h2 class="section-title">客戶基本資料</h2>';
 if(c)html+=field('公司',c.name)+field('統一編號',c.taxId)+field('公司地址',c.address)+field('送貨地址',c.deliveryAddress)+field('發票地址',c.invoiceAddress)+field('電話',c.tel)+field('傳真',c.fax)+field('聯繫人',c.contact)+field('手機',c.mobile);
 else html+='<div class="r74-customer-note">此客戶未找到完整主資料；仍可檢視 CRM 與名片關聯，請勿另建重複資料。</div>';
 html+='<h3>名片聯絡人（'+cards.length+'）</h3>';
 const seen=new Set();cards.forEach(x=>{const key=norm(x.name)+'|'+norm(x.mobile||x.tel);if(seen.has(key))return;seen.add(key);html+='<div class="r74-item">'+field('姓名',x.name)+field('職稱',x.title)+field('手機',x.mobile)+field('電話',x.tel)+field('Email',x.email)+field('公司',x.company)+'</div>'});
 if(!cards.length)html+='<div class="r74-summary">目前沒有與此公司對應的已儲存名片聯絡人。</div>';
 html+='<h3>此客戶使用產品（'+products.length+'）</h3>';
 html+=products.length?products.map(p=>'<div class="r74-item"><b>'+esc(p.name)+'</b><small>客戶品號：'+esc(p.customerPartNo||'—')+'｜供應商品號：'+esc(p.supplierPartNo||'—')+'</small><small>供應商：'+esc(p.supplierName||'—')+'｜單位：'+esc(p.unit||'—')+'｜售價：'+esc(p.price??'—')+'</small></div>').join(''):'<div class="r74-summary">尚無此客戶產品對照。</div>';
 box.innerHTML=html;
}
function installCustomerSearch(){
 const search=$('cuSearch'),box=$('customerGroupList');if(!search||!box)return;
 const filter=()=>{const q=norm(search.value);let count=0;box.querySelectorAll(':scope > .item').forEach(item=>{const matching=!q||norm(item.textContent).includes(q);item.hidden=!matching;item.style.display=matching?'':'none';if(matching)count++});let status=$('r74CustomerSearchCount');if(!status){status=document.createElement('div');status.id='r74CustomerSearchCount';status.className='r74-summary';box.before(status)}status.textContent=q?'目前清單符合 '+count+' 筆（搜尋：'+search.value+'）':''};
 if(!search.dataset.r74Bound){search.dataset.r74Bound='1';search.addEventListener('input',()=>setTimeout(filter,0));search.addEventListener('search',()=>setTimeout(filter,0));search.addEventListener('change',()=>setTimeout(filter,0))}
 if(!box.dataset.r74Watch){box.dataset.r74Watch='1';new MutationObserver(filter).observe(box,{childList:true})}
 filter();
}
function buildHub(id,title,placeholder,renderer){
 const main=document.querySelector('main');if(!main)return;
 let section=$(id);if(section)return;
 section=document.createElement('section');section.className='panel';section.id=id;
 section.innerHTML='<div class="card"><h2 class="section-title">'+esc(title)+'</h2><p class="r74-summary">直接查看既有主資料，不建立另一份資料。</p><input id="'+id+'Search" type="search" placeholder="'+esc(placeholder)+'"><div id="'+id+'Results" class="r74-list"></div></div>';
 main.appendChild(section);
 const input=$(id+'Search');const run=()=>renderer(norm(input.value),$(id+'Results'));section.r74Render=run;input.addEventListener('input',run);run();
}
function installHubs(){
 buildHub('r74Suppliers','供應商資料','搜尋供應商、供應商品號或品名',(q,box)=>{const a=master().suppliers.filter(x=>!q||norm([x.supplierName,x.name,x.partNo].join(' ')).includes(q));const groups=new Map();a.forEach(x=>{const k=x.supplierName||'未命名供應商';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)});box.innerHTML='<div class="r74-summary">共 '+groups.size+' 家供應商、'+a.length+' 筆供應商產品；顯示前 60 家</div>'+[...groups].slice(0,60).map(([name,items])=>'<details class="r74-item"><summary><b>'+esc(name)+'</b><small>產品 '+items.length+' 筆｜點選展開</small></summary>'+items.slice(0,100).map(x=>'<div class="r74-item"><small>品名：'+esc(x.name)+'｜品號：'+esc(x.partNo)+'</small><small>最小包裝單位：'+esc(x.unit||'—')+'｜包裝：'+esc(x.package||'—')+'</small></div>').join('')+'</details>').join('')});
 buildHub('r74Products','產品資料','搜尋產品、客戶品號、供應商品號',(q,box)=>{const a=master().products.filter(x=>!q||norm([x.name,x.customerName,x.customerPartNo,x.supplierPartNo,x.supplierName].join(' ')).includes(q));box.innerHTML='<div class="r74-summary">共 '+a.length+' 筆客戶產品對照，顯示前 60 筆</div>'+a.slice(0,60).map(x=>'<div class="r74-item"><b>'+esc(x.name)+'</b><small>客戶：'+esc(x.customerName)+'｜客戶品號：'+esc(x.customerPartNo)+'</small><small>供應商：'+esc(x.supplierName||'—')+'｜供應商品號：'+esc(x.supplierPartNo||'—')+'｜售價：'+esc(x.price??'—')+'</small></div>').join('')});
 buildHub('r74Visits','拜訪紀錄','搜尋拜訪內容或客戶',(q,box)=>{const d=read(CRM,{}),customers=d.customers||[],a=(d.visits||[]).filter(x=>!q||norm([x.note,x.next,x.customerName,customers.find(c=>String(c.id)===String(x.customerId))?.name].join(' ')).includes(q));box.innerHTML='<div class="r74-summary">共 '+a.length+' 筆拜訪紀錄；直接在本頁新增或編輯。</div>'+a.slice(0,60).map(x=>'<div class="r74-item"><b>'+esc(x.customerName||customers.find(c=>String(c.id)===String(x.customerId))?.name||'未關聯客戶')+'</b><small>'+esc(x.date||'未設定日期')+'｜'+esc(x.note)+'</small><small>後續：'+esc(x.next||'—')+'</small><button type="button" class="secondary r74-edit-visit" data-id="'+esc(x.id)+'">編輯這筆拜訪</button></div>').join('');box.querySelectorAll('button.r74-edit-visit').forEach(btn=>btn.addEventListener('click',()=>window.editVisit?.(btn.dataset.id)))});
 const nav=document.querySelector('nav.nav');if(nav&&!$('r74SupplierNav'))[['r74Suppliers','供應商','r74SupplierNav'],['r74Products','產品','r74ProductNav'],['r74Visits','拜訪','r74VisitNav'],['businessCardScan','名片','r74CardNav'],['settings','設定','r74SettingsNav']].forEach(([id,label,nid])=>{const a=document.createElement('a');a.id=nid;a.href='#'+id;a.textContent=label;nav.appendChild(a)});
}
function organizeExistingForms(){
 const customers=$('customers'),visits=$('r74Visits');
 if(customers&&visits&&!visits.querySelector('#vCustomer')){
   const cards=[...customers.querySelectorAll(':scope > .card')];
   const form=cards.find(card=>card.querySelector('#vCustomer')&&card.querySelector('#vNote'));
   if(form){const first=visits.querySelector('.card');first?.before(form)}
 }
 const nav=document.querySelector('nav.nav');
 if(nav){const follow=[...nav.querySelectorAll('a')].find(a=>a.getAttribute('href')==='#contacts');if(follow)follow.textContent='聯絡追蹤'}
 const masterTitle=$('r70MasterCard')?.querySelector('h2,.section-title');
 if(masterTitle&&/主資料管理/.test(masterTitle.textContent||''))masterTitle.textContent='Excel 主資料匯入／匯出（系統管理）';
}

function keepVisitFlowConsistent(){
 if(window.__r74VisitFlowWrapped)return;
 if(typeof window.addVisit!=='function'||typeof window.editVisit!=='function')return;
 const originalAdd=window.addVisit,originalEdit=window.editVisit;
 window.addVisit=function(){const result=originalAdd.apply(this,arguments);$('r74Visits')?.r74Render?.();return result};
 window.editVisit=function(id){const numId=Number(id),resolved=Number.isSafeInteger(numId)&&String(numId)===String(id)?numId:id;const result=originalEdit.call(this,resolved);location.hash='r74Visits';setTimeout(()=>{const form=$('vCustomer');if(form)form.scrollIntoView({behavior:'smooth',block:'center'})},70);return result};
 window.__r74VisitFlowWrapped=true;
}
function organizeNavigation(){
 const nav=document.querySelector('nav.nav');if(!nav||nav.dataset.r74Nav==='1')return;
 const mappings=[
  ['customers','客戶'],['r74Suppliers','供應商'],['r74Products','產品'],['projects','專案'],
  ['r74Visits','拜訪'],['quotes','報價'],['businessCardScan','名片'],['contacts','聯絡追蹤'],
  ['commands','指令'],['todos','待辦'],['settings','設定']];
 const existing=[...nav.querySelectorAll('a[href^="#"]')];
 const ordered=mappings.map(([id,label])=>{
   const a=existing.find(x=>x.getAttribute('href')==='#'+id);
   if(!a)return null;
   a.textContent=label;
   a.classList.toggle('r74-nav-secondary',!['customers','r74Suppliers','r74Products','projects','r74Visits','quotes'].includes(id));
   return a;
 }).filter(Boolean);
 const more=document.createElement('button');more.type='button';more.id='r74MoreNav';more.className='secondary r74-more-btn';more.textContent='更多功能 ▼';more.setAttribute('aria-expanded','false');
 more.onclick=()=>{
  const expanded=nav.classList.toggle('r74-more-open');
  more.textContent=expanded?'收合 ▲':'更多功能 ▼';
  more.setAttribute('aria-expanded',String(expanded));
 };
 ordered.slice(0,6).forEach(a=>nav.appendChild(a));
 nav.appendChild(more);
 ordered.slice(6).forEach(a=>nav.appendChild(a));
 nav.querySelectorAll('a.r74-nav-secondary').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('r74-more-open');more.textContent='更多功能 ▼';more.setAttribute('aria-expanded','false')}));
 nav.dataset.r74Nav='1';
}
function installProjectPreviews(){
 const box=$('projectList');if(!box)return;
 const enhance=()=>{box.querySelectorAll('[id^="record-projects-"]').forEach(item=>{if(item.querySelector('.r74-project-toggle'))return;const id=item.id.slice('record-projects-'.length);const actions=item.querySelector('.record-actions');if(!actions)return;const b=document.createElement('button');b.type='button';b.className='secondary r74-project-toggle';b.textContent='查看詳情';b.addEventListener('click',()=>{let details=item.querySelector('.r74-preview');if(details){details.remove();return}const p=(read(CRM,{}).projects||[]).find(x=>String(x.id)===id);if(!p)return;const pr=read(PROGRESS,{}),r=pr[id]||pr[p.name]||{};details=document.createElement('div');details.className='r74-preview';details.innerHTML=field('專案',p.name)+field('客戶',p.customerName)+field('供應商',p.supplier)+field('負責人',p.owner)+field('階段',p.stage)+field('進度',r.progress||p.progress)+field('進度註記',r.note||p.progressNote)+field('追蹤日期',p.followDate);item.appendChild(details)});actions.prepend(b)})};
 if(!box.dataset.r74Watch){box.dataset.r74Watch='1';new MutationObserver(enhance).observe(box,{childList:true,subtree:true})}enhance();
}
function installOcrRaw(){
 const panel=$('businessCardScan')?.querySelector('.card');if(!panel||$('r74OcrBlock'))return;
 const box=document.createElement('details');box.id='r74OcrBlock';box.className='r74-panel';box.innerHTML='<summary>查看本次 OCR 辨識原始文字</summary><textarea readonly id="r74OcrRaw" placeholder="執行本機辨識後，原始文字會顯示在這裡。"></textarea>';
 panel.appendChild(box);
 if(window.R74_LAST_OCR_RAW)$('r74OcrRaw').value=window.R74_LAST_OCR_RAW;
}
function enforceProjectOptions(){
 const stageValues=['進行中','已成交','暫停','結案','取消'];
 const progressValues=['','初步接洽','需求確認','送樣中','客戶測試中','報價中','待客戶確認','待採購確認','成交準備'];
 let stage=$('pStage');if(!stage)return;
 if(stage.tagName!=='SELECT'){const previous=stage.value||'';const select=document.createElement('select');select.id='pStage';stage.replaceWith(select);stage=select;stage.dataset.r74Previous=previous}
 const repair=(el,values)=>{
  if(!el||el.tagName!=='SELECT')return;
  const present=[...el.options].map(o=>o.value);
  if(present.length===values.length&&present.every((v,i)=>v===values[i]))return;
  const old=el.value||el.dataset.r74Previous||'';
  el.replaceChildren(...values.map(value=>{const option=document.createElement('option');option.value=value;option.textContent=value||'未設定';return option}));
  if(values.includes(old))el.value=old;else el.value=values[0];
 };
 repair(stage,stageValues);
 let progress=$('pProgress');if(!progress){const row=document.createElement('div'),label=document.createElement('label');label.htmlFor='pProgress';label.textContent='進度（獨立選單）';progress=document.createElement('select');progress.id='pProgress';row.append(label,progress);stage.parentElement?.after(row)}
 repair(progress,progressValues);
 if(!$('pProgressNote')){const row=document.createElement('div'),label=document.createElement('label'),note=document.createElement('textarea');row.className='full';label.htmlFor='pProgressNote';label.textContent='進度註記';note.id='pProgressNote';row.append(label,note);progress.parentElement?.after(row)}
 let info=$('r74ProjectOptionStatus');if(!info){info=document.createElement('div');info.id='r74ProjectOptionStatus';info.className='r74-summary';progress.parentElement?.after(info)}
 if(info)info.textContent='固定選單已核對：階段 5 項｜進度 9 項（含未設定）｜進度註記可自由輸入';
}
function clarifyQuoteEntry(){
 const sec=$('quotes'),doc=$('quoteDocument');
 if(sec){const b=[...sec.querySelectorAll('button')].find(x=>x.textContent.includes('產生正式報價單'));if(b)b.textContent='新增正式報價（完整欄位）'}
 if(doc&&!$('r74QuoteGuide')){const guide=document.createElement('div');guide.id='r74QuoteGuide';guide.className='r74-summary';guide.textContent='新增時即可填寫下方全部明細及條件；完成後按「儲存正式報價」，不必先建立再編輯。';doc.querySelector('.q-editor-grid')?.before(guide)}
}
function boot(){installCss();installCustomer360();installCustomerSearch();installHubs();organizeNavigation();organizeExistingForms();keepVisitFlowConsistent();installProjectPreviews();installOcrRaw();enforceProjectOptions();clarifyQuoteEntry();window.addEventListener('hashchange',()=>{if(location.hash==='#customers')installCustomerSearch();if(location.hash==='#projects')installProjectPreviews();if(location.hash==='#projects')enforceProjectOptions();if(location.hash==='#quoteDocument'||location.hash==='#quotes')clarifyQuoteEntry()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,300));else setTimeout(boot,300);
})();