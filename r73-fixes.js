(()=>{'use strict';
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const MASTER='hongbin_crm_master_r70', CRM='hongbin_personal_crm_v3', CARDS='hongbin_crm_cards_r70';
const PROGRESS='hongbin_crm_project_progress_r72', FORMAL='hongbin_crm_formal_quotes_r73';
const STAGES=['進行中','已成交','暫停','結案','取消'];
const PROGRESS_VALUES=['','初步接洽','需求確認','送樣中','客戶測試中','報價中','待客戶確認','待採購確認','成交準備'];
const norm=v=>String(v??'').trim().toLowerCase().replace(/[\s　]+/g,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch(_){return fallback}};
const put=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
function master(){return Object.assign({customers:[],products:[],suppliers:[]},json(MASTER,{}))}
function setVersion(){
  window.CRM_VERSION='R73';
  document.title='鴻繽科技 CRM｜R73 Integrated Beta';
  document.querySelectorAll('.content,.status,.sub').forEach(el=>{
    if(/目前版本：R\d+/.test(el.textContent||'')){const next=el.innerHTML.replace(/目前版本：R\d+(?: Integrated Beta)?/g,'目前版本：R73 Integrated Beta');if(next!==el.innerHTML)el.innerHTML=next}
  });
}
function installCss(){
  if($('r73Style'))return;
  const style=document.createElement('style');style.id='r73Style';style.textContent=`
  .r72-top{display:none!important}.r73-top{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(18px,calc(env(safe-area-inset-bottom) + 14px));z-index:9999;width:44px!important;height:44px!important;min-height:44px!important;padding:0!important;border-radius:50%!important;background:#20272d!important;color:#fff!important;border:1px solid #727a80!important;box-shadow:0 3px 13px #0008;font-size:22px!important;line-height:1!important;opacity:0;visibility:hidden;transform:translateY(8px);transition:.18s}.r73-top.show{opacity:1;visibility:visible;transform:none}
  .r73-candidate-host{position:relative}.r73-candidate{display:none;position:absolute;left:0;right:0;top:calc(100% + 3px);z-index:10020;max-height:280px;overflow:auto;background:#151b20;border:1px solid #606970;border-radius:7px;box-shadow:0 8px 24px #000b}.r73-candidate.show{display:block}.r73-candidate button{display:block;width:100%;min-height:44px;margin:0!important;padding:9px 11px!important;border:0!important;border-bottom:1px solid #343b41!important;border-radius:0!important;background:#151b20!important;color:#f3eee8!important;text-align:left!important}.r73-candidate-empty{padding:11px;color:#b9afa5}.r73-product-info{font-size:14px;color:#c9b99f;margin:6px 0 9px}
  .r73-card-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.r73-card-tip{font-size:13px;color:#b9afa5;margin-top:7px}.r73-formal-list{margin-top:12px}.r73-formal-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 0;border-top:1px solid #3d444a}.r73-formal-row button{width:auto!important;min-height:38px!important}
  @media(max-width:420px){.r73-card-actions{grid-template-columns:1fr}.r73-top{right:max(10px,env(safe-area-inset-right));bottom:max(12px,calc(env(safe-area-inset-bottom) + 10px))}}
  `;document.head.appendChild(style);
}

function progressMap(){const x=json(PROGRESS,{});return x&&typeof x==='object'?x:{}}
function saveProgressMap(x){put(PROGRESS,x)}
function recordProgress(x,map){return map[String(x.id)]||map[x.name]||{progress:x.progress||'',note:x.progressNote||''}}
function normalizeProjects(){
  const data=json(CRM,{});if(!Array.isArray(data.projects))return false;
  const map=progressMap();let changed=false;
  const oldToProgress={'待評估':'初步接洽','送樣':'送樣中','測試中':'客戶測試中','報價中':'報價中','議價中':'待客戶確認'};
  data.projects.forEach(x=>{
    const old=String(x.stage||'').trim();if(STAGES.includes(old))return;
    const r=recordProgress(x,map),tag=old&&old!=='未指定'?`原階段：${old}`:'';
    if(!r.progress&&oldToProgress[old])r.progress=oldToProgress[old];
    if(tag&&!String(r.note||'').includes(tag))r.note=[r.note,tag].filter(Boolean).join('｜');
    map[String(x.id)]=r;x.stage='進行中';changed=true;
  });
  if(changed){saveProgressMap(map);put(CRM,data)}return changed;
}
let editingProjectId=null;
function installProjectFields(){
  const input=$('pStage');if(!input)return;
  let stage=input;
  if(input.tagName!=='SELECT'){
    stage=document.createElement('select');stage.id='pStage';stage.innerHTML=STAGES.map(v=>`<option value="${v}">${v}</option>`).join('');input.replaceWith(stage);$('stageList')?.remove();
  }else if(stage.dataset.r73!=='1')stage.innerHTML=STAGES.map(v=>`<option value="${v}">${v}</option>`).join('');
  stage.dataset.r73='1';
  const stageWrap=stage.parentElement;
  if(!$('pProgress')){const w=document.createElement('div');w.innerHTML='<label for="pProgress">進度</label><select id="pProgress"><option value="">未設定</option>'+PROGRESS_VALUES.slice(1).map(v=>`<option value="${v}">${v}</option>`).join('')+'</select>';stageWrap.after(w)}
  if(!$('pProgressNote')){const w=document.createElement('div');w.className='full';w.innerHTML='<label for="pProgressNote">進度註記</label><textarea id="pProgressNote" placeholder="例如：等 RD 測試結果"></textarea>';($('pProgress')?.parentElement||stageWrap).after(w)}
  if(normalizeProjects()&&!sessionStorage.getItem('r73-project-migrated')){sessionStorage.setItem('r73-project-migrated','1');location.reload();return}
  if(window.__r73ProjectHooks)return;window.__r73ProjectHooks=true;
  const oldAdd=window.addProject,oldEdit=window.editProject;
  window.addProject=function(){
    const name=$('pName').value.trim(),progress=$('pProgress').value,note=$('pProgressNote').value.trim();if(!name)return oldAdd?.apply(this,arguments);
    if(!STAGES.includes(stage.value))stage.value='進行中';const out=oldAdd?.apply(this,arguments),data=json(CRM,{}),projects=Array.isArray(data.projects)?data.projects:[],item=editingProjectId?projects.find(v=>String(v.id)===String(editingProjectId)):projects.filter(v=>v.name===name).sort((a,b)=>Number(b.id)-Number(a.id))[0];
    if(item){const map=progressMap();map[String(item.id)]={progress:PROGRESS_VALUES.includes(progress)?progress:'',note};saveProgressMap(map)}editingProjectId=null;return out;
  };
  window.editProject=function(id){
    editingProjectId=id;const out=oldEdit?.apply(this,arguments),x=(json(CRM,{}).projects||[]).find(v=>String(v.id)===String(id));if(!x)return out;const r=recordProgress(x,progressMap());$('pStage').value=STAGES.includes(x.stage)?x.stage:'進行中';$('pProgress').value=PROGRESS_VALUES.includes(r.progress)?r.progress:'';$('pProgressNote').value=r.note||'';return out;
  };
  if(!window.__r73CancelWrapped){const old=window.cancelEdit;window.cancelEdit=function(type){const out=old?.apply(this,arguments);if(type==='projects'){editingProjectId=null;if($('pStage'))$('pStage').value='進行中';if($('pProgress'))$('pProgress').value='';if($('pProgressNote'))$('pProgressNote').value=''}return out};window.__r73CancelWrapped=true}
}

function installBackTop(){
  $$('.r72-top').forEach(x=>x.remove());let b=$('r73BackTop');
  if(!b){b=document.createElement('button');b.id='r73BackTop';b.className='r73-top';b.type='button';b.setAttribute('aria-label','返回頂部');b.textContent='↑';b.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});document.body.appendChild(b)}
  const update=()=>b.classList.toggle('show',window.scrollY>320);update();
  if(!window.__r73ScrollBound){window.addEventListener('scroll',update,{passive:true});window.__r73ScrollBound=true}
}

function exactCustomer(name){return master().customers.find(c=>norm(c.name)===norm(name))||null}
function customerProducts(name){const c=exactCustomer(name);return c?master().products.filter(p=>norm(p.customerName)===norm(c.name)):[]}
function productLabel(p){return [p.name,p.customerPartNo||p.supplierPartNo,p.package||p.unit].filter(Boolean).join('｜')}
function closeCandidates(){document.querySelectorAll('.r73-candidate').forEach(x=>x.classList.remove('show'))}
function bindCandidate(input,provider,onPick,{openEmpty=false}={}){
  if(!input)return;input.removeAttribute('list');if(input.dataset.r73Candidate==='1')return;input.dataset.r73Candidate='1';input.parentElement?.querySelectorAll('.r70-candidate-box,.r71-box,.r72-box').forEach(x=>x.remove());
  const host=input.parentElement;if(!host)return;host.classList.add('r73-candidate-host');const box=document.createElement('div');box.className='r73-candidate';host.appendChild(box);
  const render=()=>{const q=norm(input.value),all=provider();if(!q&&!openEmpty){box.classList.remove('show');return}const hits=all.filter(x=>!q||norm(x.search||x.label).includes(q)).slice(0,40);box.innerHTML=hits.length?hits.map((x,i)=>`<button type="button" data-i="${i}">${esc(x.label)}</button>`).join(''):'<div class="r73-candidate-empty">沒有符合資料</div>';box.classList.add('show');box.onpointerdown=e=>{const btn=e.target.closest('button');if(!btn)return;e.preventDefault();const x=hits[Number(btn.dataset.i)];input.value=x.value??x.label;box.classList.remove('show');onPick?.(x);input.dispatchEvent(new Event('change',{bubbles:true}))}};
  input.addEventListener('input',render);input.addEventListener('focus',render);input.addEventListener('blur',()=>setTimeout(()=>box.classList.remove('show'),150));
}
function productInfo(customerId,anchorId){
  const customer=$(customerId),anchor=$(anchorId);if(!customer||!anchor)return;let info=document.querySelector(`[data-r73-info="${customerId}"]`);
  if(!info){info=document.createElement('div');info.className='r73-product-info';info.dataset.r73Info=customerId;(anchor.parentElement||anchor).before(info)}
  const n=customerProducts(customer.value).length;info.textContent=customer.value.trim()?(n?`此客戶已有 ${n} 項產品；點品名或品號即可瀏覽。`:'此客戶目前沒有已匯入產品。'):'';
}
function applyEstimate(p){if(!p)return;const set=(id,v)=>{if($(id))$(id).value=v??''};set('qProductName',p.name);set('qModel',p.customerPartNo||p.supplierPartNo);set('qSpec',p.package||p.unit);set('qMoq',p.moq||p.supplierUnit||p.unit);set('qPrice',p.price);$('qPrice')?.dispatchEvent(new Event('input',{bubbles:true}))}
function installQuoteCandidates(){
  for(const id of ['qCustomer','qdCustomer']){const input=$(id);bindCandidate(input,()=>master().customers.map(c=>({label:c.name,value:c.name})),()=>{closeCandidates();productInfo(id,id==='qCustomer'?'qProductName':'qdItemsEditor');setTimeout(installProductCandidates,0)},{openEmpty:true});if(input&&!input.dataset.r73InfoEvents){input.dataset.r73InfoEvents='1';input.addEventListener('input',()=>productInfo(id,id==='qCustomer'?'qProductName':'qdItemsEditor'));input.addEventListener('change',()=>productInfo(id,id==='qCustomer'?'qProductName':'qdItemsEditor'))}}
  productInfo('qCustomer','qProductName');productInfo('qdCustomer','qdItemsEditor');installProductCandidates();
}
function installProductCandidates(){
  const qc=$('qCustomer'),provider=c=>customerProducts(c.value).map(p=>({label:productLabel(p),value:p.name,search:[p.name,p.customerPartNo,p.supplierPartNo].join(' '),product:p}));
  if(qc){bindCandidate($('qProductName'),()=>provider(qc),x=>applyEstimate(x.product),{openEmpty:true});bindCandidate($('qModel'),()=>provider(qc),x=>applyEstimate(x.product),{openEmpty:true})}
  const dc=$('qdCustomer');if(dc)$$('#qdItemsEditor .q-item-card').forEach((card,i)=>{const inputs=card.querySelectorAll('input');const pick=x=>{const p=x.product;if(!p||!window.quoteDocItems?.[i])return;Object.assign(window.quoteDocItems[i],{name:p.name||'',model:p.customerPartNo||p.supplierPartNo||'',spec:p.package||p.unit||'',price:p.price??'',moq:p.moq||p.supplierUnit||p.unit||''});renderQuoteDocEditor();renderQuoteDocument()};if(inputs[0])bindCandidate(inputs[0],()=>provider(dc),pick,{openEmpty:true});if(inputs[1])bindCandidate(inputs[1],()=>provider(dc),pick,{openEmpty:true})})
}

function cleanPhone(v){const s=String(v||'').trim().replace(/[。．]/g,'.').replace(/\s+/g,' ');const digits=s.replace(/\D/g,'');return digits.length>=7&&digits.length<=16?s:''}
function parseCardText(raw){
  const text=String(raw||'').replace(/\r/g,'\n'),lines=text.split(/\n+/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean);
  const out={company:'',name:'',title:'',mobile:'',tel:'',fax:'',email:'',address:'',website:''};
  out.email=(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0]||'';out.website=(text.match(/(?:https?:\/\/|www\.)[^\s,;]+/i)||[])[0]||'';
  const label=/(TEL|PHONE|FAX|FACSIMILE|MOBILE|CELL|手機|電話|傳真)\s*[:：]?\s*([+0-9()#xXextEXT分機.\-\s]{7,}?)(?=\s*(?:TEL|PHONE|FAX|FACSIMILE|MOBILE|CELL|手機|電話|傳真)\s*[:：]?|$)/gi;
  lines.forEach(line=>{let m;while((m=label.exec(line))){const kind=m[1].toUpperCase(),phone=cleanPhone(m[2]);if(!phone)continue;if(/FAX|FACSIMILE|傳真/.test(kind))out.fax=phone;else if(/MOBILE|CELL|手機/.test(kind))out.mobile=phone;else out.tel=phone}label.lastIndex=0});
  if(!out.mobile){const m=text.match(/(?:\+?886[- ]?9|09)\d(?:[- ]?\d){7}/);if(m)out.mobile=cleanPhone(m[0])}
  out.company=lines.find(x=>/(股份有限公司|有限公司|公司|企業|科技|實業|工業|CO\.?\s*,?\s*LTD|CORPORATION|INC\.?)/i.test(x)&&!/@|TEL|FAX|PHONE/i.test(x))||'';
  out.address=lines.find(x=>/(縣|市).*(區|鄉|鎮|市|路|街|大道).*(號|樓)|\d+\s*(?:F|樓).*(?:ROAD|RD\.|STREET|ST\.)/i.test(x))||'';
  const titleWords=/(董事長|副總經理|總經理|業務經理|業務副理|業務主任|業務專員|副總|協理|經理|副理|主任|專員|業務|工程師|採購|MANAGING DIRECTOR|SALES MANAGER|PURCHASING MANAGER|DIRECTOR|MANAGER|ENGINEER|SALES|PURCHASING)/i;
  const titleLine=lines.find(x=>titleWords.test(x));if(titleLine)out.title=(titleLine.match(titleWords)||[])[0]||'';
  const excluded=x=>x===out.company||x===out.address||/@|www\.|https?:|TEL|FAX|PHONE|MOBILE|CELL|電話|手機|傳真/i.test(x);
  const candidates=lines.filter(x=>!excluded(x)).map(x=>x.replace(new RegExp(titleWords.source,'ig'),'').trim()).filter(Boolean);
  out.name=candidates.find(x=>/^[\u3400-\u9fff·]{2,4}$/.test(x))||candidates.find(x=>/^[A-Za-z]+(?:[ .'-][A-Za-z]+){1,3}$/.test(x)&&x.length>=5)||'';
  if(!/^[\u3400-\u9fff·]{2,4}$|^[A-Za-z]+(?:[ .'-][A-Za-z]+){1,3}$/.test(out.name))out.name='';
  if(out.company&&!/(股份有限公司|有限公司|公司|企業|科技|實業|工業|CO\.?\s*,?\s*LTD|CORPORATION|INC\.?)/i.test(out.company))out.company='';
  const set=(id,v)=>{if($(id))$(id).value=v||''};Object.entries({bcCompany:out.company,bcName:out.name,bcTitle:out.title,bcMobile:out.mobile,bcTel:out.tel,bcFax:out.fax,bcEmail:out.email,bcAddress:out.address,bcWebsite:out.website}).forEach(([id,v])=>set(id,v));return out;
}
async function ensureOcr(){if(window.Tesseract)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('OCR 引擎下載失敗'));document.head.appendChild(s)})}
function installOcr(){window.scanBusinessCardLocal=async function(){const file=$('bcImage')?.files?.[0],status=$('bcStatus');if(!file){if(status)status.textContent='請先拍攝或選擇名片';return}try{await ensureOcr();if(status)status.textContent='本機辨識中…';const r=await Tesseract.recognize(file,'chi_tra+eng',{langPath:'https://tessdata.projectnaptha.com/4.0.0',logger:m=>{if(status&&typeof m.progress==='number')status.textContent=`本機辨識中 ${Math.round(m.progress*100)}%`}});window.R74_LAST_OCR_RAW=String(r?.data?.text||'');const rawBox=$('r74OcrRaw');if(rawBox)rawBox.value=window.R74_LAST_OCR_RAW;parseCardText(window.R74_LAST_OCR_RAW);if(status)status.textContent='辨識完成，請確認欄位。不確定的欄位會留白。'}catch(e){if(status)status.textContent='辨識失敗：'+(e?.message||e)}};window.R73_PARSE_CARD=parseCardText}
function openImageDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('hongbin_crm_images_r73',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('cards'))r.result.createObjectStore('cards')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function compressCard(file){if(!file)return null;const url=URL.createObjectURL(file);try{const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=reject;x.src=url}),max=1200,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.68))}finally{URL.revokeObjectURL(url)}}
async function storePhoto(id,file){const blob=await compressCard(file);if(!blob)return;const dbi=await openImageDb();await new Promise((resolve,reject)=>{const tx=dbi.transaction('cards','readwrite');tx.objectStore('cards').put(blob,String(id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});dbi.close()}
function cardData(){return {company:$('bcCompany')?.value.trim()||'',name:$('bcName')?.value.trim()||'',title:$('bcTitle')?.value.trim()||'',mobile:$('bcMobile')?.value.trim()||'',tel:$('bcTel')?.value.trim()||'',fax:$('bcFax')?.value.trim()||'',email:$('bcEmail')?.value.trim()||'',address:$('bcAddress')?.value.trim()||'',website:$('bcWebsite')?.value.trim()||''}}
async function saveCard(mode){
  const x=cardData();if(!x.company)return alert('請先確認公司名稱');let m=master(),customer=m.customers.find(c=>norm(c.name)===norm(x.company));
  if(mode==='link'&&!customer)return alert('找不到既有客戶，請改用「建立新客戶」');if(mode==='create'&&customer){alert('此公司已存在，將改為連結既有客戶');mode='link'}
  if(!customer){customer={name:x.company,contact:x.name,title:x.title,tel:x.tel,mobile:x.mobile,fax:x.fax,email:x.email,address:x.address,website:x.website,source:'business-card'};m.customers.push(customer)}else{for(const k of ['contact','title','tel','mobile','fax','email','address','website'])customer[k]=customer[k]||x[k==='contact'?'name':k]||''}
  m.updatedAt=new Date().toISOString();put(MASTER,m);
  const crm=json(CRM,{projects:[],contacts:[],commands:[],quotes:[],todos:[],customers:[],visits:[]});crm.customers=Array.isArray(crm.customers)?crm.customers:[];crm.contacts=Array.isArray(crm.contacts)?crm.contacts:[];let cc=crm.customers.find(c=>norm(c.name)===norm(x.company));if(!cc){cc={id:Date.now(),name:x.company};crm.customers.push(cc)}
  /* 名片聯絡人是客戶主資料，不再將新名片偽裝成一筆聯絡追蹤；保留原有追蹤紀錄。 */put(CRM,crm);
  const cards=json(CARDS,[]),old=cards.find(c=>norm(c.company)===norm(x.company)&&norm(c.name)===norm(x.name)),id=old?.id||Date.now(),saved=Object.assign({},x,{id,photoId:String(id),customerId:cc.id,customerName:cc.name,source:'business-card'});if(old)Object.assign(old,saved);else cards.unshift(saved);put(CARDS,cards);
  try{await storePhoto(id,$('bcImage')?.files?.[0])}catch(e){console.warn('名片照片儲存失敗',e)}
  window.R70_COMPLETE?.syncLists?.();window.R70_COMPLETE?.renderCards?.();if($('bcStatus'))$('bcStatus').textContent=mode==='create'?'已建立新客戶與聯絡人，名片照片已壓縮保存。':'已連結既有客戶與聯絡人，名片照片已壓縮保存。';alert(mode==='create'?'新客戶已建立並連結名片':'名片已連結既有客戶');location.reload();
}
function installCardActions(){const card=$('businessCardScan')?.querySelector('.card');if(!card)return;$('r70CardSave')?.remove();if($('r73CardActions'))return;const box=document.createElement('div');box.id='r73CardActions';box.className='r73-card-actions';box.innerHTML='<button type="button" class="secondary" id="r73LinkCustomer">連結既有客戶</button><button type="button" class="primary" id="r73CreateCustomer">建立新客戶</button>';card.appendChild(box);const tip=document.createElement('div');tip.className='r73-card-tip';tip.textContent='會使用上方已確認欄位；同名公司存在時不會重複建立。';box.after(tip);$('r73LinkCustomer').onclick=()=>saveCard('link');$('r73CreateCustomer').onclick=()=>saveCard('create')}

function formalQuotes(){const a=json(FORMAL,[]);return Array.isArray(a)?a:[]}
let currentFormalId=null;
function formalSnapshot(){const ids=['qdCustomer','qdContact','qdTel','qdFax','qdNo','qdDate','qdDelivery','qdPayment','qdPlace','qdValid','qdSales','qdSalesTel','qdNotes'],fields={};ids.forEach(id=>fields[id]=$(id)?.value||'');return {id:currentFormalId||Date.now(),updatedAt:new Date().toISOString(),fields,items:(window.quoteDocItems||[]).map(x=>({...x}))}}
function renderFormalList(){const box=$('r73FormalList');if(!box)return;const list=formalQuotes(),counts=new Map();list.forEach(x=>{const k=norm(x.fields?.qdNo);if(k)counts.set(k,(counts.get(k)||0)+1)});const html=list.length?'<h3>已儲存正式報價</h3>'+list.map(x=>`<div class="r73-formal-row"><div><b>${esc(x.fields?.qdNo||'未編號')}</b>${counts.get(norm(x.fields?.qdNo))>1?'<div class="meta" style="color:#f2b18b">注意：此報價編號重複，紀錄 ID：'+esc(x.id)+'</div>':''}<div class="meta">${esc(x.fields?.qdCustomer||'未指定客戶')}｜${esc(x.fields?.qdDate||'')}</div></div><button type="button" class="secondary" data-id="${x.id}">再次編輯</button></div>`).join(''):'<div class="meta">尚無已儲存正式報價</div>';if(box.innerHTML!==html)box.innerHTML=html;box.querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>openFormal(b.dataset.id))}
function saveFormal(){window.renderQuoteDocument?.();const x=formalSnapshot(),list=formalQuotes(),i=list.findIndex(v=>String(v.id)===String(x.id));const quoteNo=norm(x.fields?.qdNo);if(quoteNo&&list.some((v,j)=>j!==i&&norm(v.fields?.qdNo)===quoteNo)&&(i<0||norm(list[i]?.fields?.qdNo)!==quoteNo)){alert('報價編號已存在於其他紀錄，為避免重複或覆蓋，已停止儲存。請先核對編號與原報價。');return}if(i>=0)list[i]=x;else list.unshift(x);put(FORMAL,list);currentFormalId=x.id;renderFormalList();alert('正式報價已儲存')}
function openFormal(id){const x=formalQuotes().find(v=>String(v.id)===String(id));if(!x)return;currentFormalId=x.id;Object.entries(x.fields||{}).forEach(([k,v])=>{if($(k))$(k).value=v});window.quoteDocItems=(x.items||[]).map(v=>({...v}));renderQuoteDocEditor();renderQuoteDocument();location.hash='quoteDocument'}
function nextUnusedQuoteNo(){
  const d=new Date(),prefix='Q'+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-';
  const used=new Set(formalQuotes().map(q=>norm(q.fields?.qdNo)).filter(Boolean));
  let n=1;while(used.has(norm(prefix+String(n).padStart(3,'0'))) && n<9999)n++;
  return prefix+String(n).padStart(3,'0');
}
function resetFreshQuoteDefaults(){
 const values={
  qdDelivery:'有庫存 3 天內交貨，如無庫存需 30 天',
  qdPayment:'次月60天',
  qdPlace:'貴公司交貨處或指定交貨處',
  qdValid:'三十日',
  qdSales:'',qdSalesTel:'',
  qdNotes:'1：　以上價格為未稅價。\n2：　本報價僅供參考，實際價格以訂單確認為準。\n3：　特殊規格或需求，請先行告知。\n4：　如有任何問題，歡迎隨時與我們聯繫。'
 };
 Object.entries(values).forEach(([id,v])=>{if($(id))$(id).value=v});
 const company=$('qdCustomer')?.value;
 const customer=master().customers.find(x=>norm(x.name)===norm(company));
 if(customer){for(const [id,key] of [['qdContact','contact'],['qdTel','tel'],['qdFax','fax']])if($(id)&&customer[key])$(id).value=customer[key]}
}
function installFormalSave(){const panel=$('quoteDocument');if(!panel)return;let row=panel.querySelector('.btnrow');if(row&&!$('r73SaveFormal')){const b=document.createElement('button');b.id='r73SaveFormal';b.type='button';b.className='primary';b.textContent='儲存正式報價';b.onclick=saveFormal;row.prepend(b)}if(!$('r73FormalList')){const box=document.createElement('div');box.id='r73FormalList';box.className='r73-formal-list';panel.querySelector('.card')?.appendChild(box)}renderFormalList();if(!window.__r73OpenQuoteWrapped&&typeof window.openQuoteDocument==='function'){const old=window.openQuoteDocument;window.openQuoteDocument=function(){currentFormalId=null;const result=old.apply(this,arguments);resetFreshQuoteDefaults();if($('qdNo'))$('qdNo').value=nextUnusedQuoteNo();window.renderQuoteDocument?.();return result};window.__r73OpenQuoteWrapped=true}}

function boot(){installCss();setVersion();installProjectFields();installBackTop();installQuoteCandidates();installOcr();installCardActions();installFormalSave();let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;setVersion();$$('.r72-top').forEach(x=>x.remove());installProductCandidates();productInfo('qCustomer','qProductName');productInfo('qdCustomer','qdItemsEditor');installCardActions();renderFormalList()})}).observe(document.body,{childList:true,subtree:true});window.addEventListener('hashchange',()=>setTimeout(()=>{installProjectFields();installQuoteCandidates();installBackTop();installCardActions();installFormalSave()},80))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,160));else setTimeout(boot,160);
})();
