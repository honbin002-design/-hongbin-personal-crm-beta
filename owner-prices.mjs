// Supplier purchase costs stay outside the shared CRM master and local backup.
// The server-side owner-only Firestore rule is authoritative; this UI merely hides
// the entry point from other signed-in accounts. No prices are cached in browser storage.
const ROOT_EMAIL='honbin002@gmail.com';
const ROOT_UID='Iy5BWeZ17KW3Ost0m38LEhcjO9F3';
const PROJECT='honbin-crm-notes-spark';
const SOURCE_ID='1UPTW2FbFBflVgAeQV1sVuYlL0yfOWOjr';
const $=id=>document.getElementById(id);
const clean=s=>String(s??'').trim();
const path=`ownerSupplierPrices/${ROOT_UID}/entries`;

export function validateOwnerPriceFile(file){
 if(!file||file.format!=='hongbin-crm-owner-supplier-prices'||file.schema!==1||
    file.source?.fileId!==SOURCE_ID||!Array.isArray(file.prices)||
    file.prices.length<1||file.prices.length>400)throw Error('進價檔格式、來源或筆數不正確');
 const seen=new Set();
 return file.prices.map(row=>{
  if(!row||!clean(row.supplierName)||!clean(row.partNo)||
     clean(row.supplierName).length>200||clean(row.partNo).length>120||
     clean(row.productName).length>200||clean(row.unit).length>30||
     !Number.isFinite(row.price)||row.price<=0||row.price>=1e9)
   throw Error('進價資料有空白、超長或無效價格');
  const key=clean(row.supplierName).toLocaleLowerCase()+'|'+clean(row.partNo).toLocaleLowerCase();
  if(seen.has(key))throw Error('進價檔有重複的供應商與品號');
  seen.add(key);
  return {supplierName:clean(row.supplierName),partNo:clean(row.partNo),
   productName:clean(row.productName),unit:clean(row.unit),price:row.price};
 });
}

async function start(){
 if(typeof window==='undefined'||location.hostname!=='honbin002-design.github.io')return;
 const panel=$('ownerPricePanel');if(!panel)return;
 const [{firebaseConfig},appSdk,authSdk,fs]=await Promise.all([
  import('/honbin-crm-auth-test/firebase-web-config.mjs'),
  import('https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js'),
  import('https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js')
 ]);
 if(firebaseConfig.projectId!==PROJECT)throw Error('資料庫專案不符');
 // Use the same default Firebase app name as the embedded notes workspace so
 // its existing browserLocalPersistence session is reused on this origin.
 const app=appSdk.getApps()[0]||appSdk.initializeApp(firebaseConfig);
 const auth=authSdk.getAuth(app),db=fs.getFirestore(app);
 let allowed=false,pending=null,rows=[],visibleCount=20;
 const status=msg=>{$('ownerPriceStatus').textContent=msg};
 const guard=()=>{
  const u=auth.currentUser;
  if(!allowed||!u||u.uid!==ROOT_UID||u.email?.toLowerCase()!==ROOT_EMAIL||!u.emailVerified)
   throw Error('僅最高權限帳號可讀取進價');
 };
 const show=()=>{
  const q=clean($('ownerPriceSearch').value).toLocaleLowerCase(),target=$('ownerPriceList');
  target.replaceChildren();
  const matching=rows.filter(v=>(v.supplierName+' '+v.partNo+' '+v.productName).toLocaleLowerCase().includes(q));
  if(!matching.length){target.textContent='沒有符合的供應商進價。';$('ownerPriceMore').hidden=true;return}
  for(const v of matching.slice(0,visibleCount)){
   const item=document.createElement('div');item.className='listItem';
   const title=document.createElement('div');title.className='listTitle';title.textContent=v.supplierName+'｜'+v.partNo;
   const detail=document.createElement('div');detail.className='sub';
   detail.textContent=(v.productName||'未命名產品')+'　'+v.price.toLocaleString('zh-TW')+'／'+(v.unit||'單位');
   item.append(title,detail);target.append(item);
  }
  const more=$('ownerPriceMore');more.hidden=matching.length<=visibleCount;
  more.textContent='再顯示 20 筆（共 '+matching.length+' 筆）';
 };
 const refresh=async()=>{
  guard();
  const snap=await fs.getDocsFromServer(fs.query(fs.collection(db,path),fs.limit(401)));
  guard();
  if(snap.size>400)throw Error('進價筆數超過讀取上限，已停止顯示');
  rows=snap.docs.map(d=>d.data()).filter(x=>typeof x.price==='number');visibleCount=20;
  rows.sort((a,b)=>(a.supplierName+'|'+a.partNo).localeCompare(b.supplierName+'|'+b.partNo,'zh-Hant'));
  show();status('伺服器已讀取 '+rows.length+' 筆，僅最高權限帳號可見。');
 };
 authSdk.onAuthStateChanged(auth,async user=>{
  allowed=false;panel.hidden=true;pending=null;rows=[];$('ownerPriceList').replaceChildren();
  if(!user||user.uid!==ROOT_UID||user.email?.toLowerCase()!==ROOT_EMAIL||!user.emailVerified)return;
  try{
   const token=await authSdk.getIdTokenResult(user);
   if(token.claims.firebase?.sign_in_provider!=='google.com'||auth.currentUser?.uid!==ROOT_UID)return;
   allowed=true;panel.hidden=false;await refresh();
  }catch{panel.hidden=true;allowed=false}
 });
 $('ownerPriceSearch').addEventListener('input',()=>{visibleCount=20;show()});
 $('ownerPriceMore').addEventListener('click',()=>{visibleCount+=20;show()});
 $('ownerPriceFile').addEventListener('change',()=>{pending=null;$('ownerPriceImport').disabled=true;status('請先預覽進價檔。')});
 $('ownerPricePreview').addEventListener('click',async()=>{
  pending=null;$('ownerPriceImport').disabled=true;
  try{
   guard();const file=$('ownerPriceFile').files?.[0];
   if(!file||file.size>500000)throw Error('請選取不超過 500KB 的進價 JSON 檔');
   const data=JSON.parse(await file.text());const prices=validateOwnerPriceFile(data);guard();
   pending={prices,sourceFileId:data.source.fileId};
   status('尚未寫入｜來源：'+clean(data.source.fileName)+'｜目前進價：'+prices.length+' 筆。未核定候選價格不得放入此檔。');
   $('ownerPriceImport').disabled=false;
  }catch(e){status('預覽失敗：'+String(e.message||e))}
 });
 $('ownerPriceImport').addEventListener('click',async()=>{
  const button=$('ownerPriceImport');
  try{
   guard();if(!pending)throw Error('請重新預覽進價檔');
   const input=pending;
   if(!confirm('確定將 '+input.prices.length+' 筆供應商目前進價傳送到 Firebase 專案 '+PROJECT+' 的本人專屬資料區？其他群組成員無權讀取。'))return;
   button.disabled=true;status('正在寫入本人專屬進價，請保持頁面開啟。');
   const batch=fs.writeBatch(db);
   for(const row of input.prices){
    const bytes=new TextEncoder().encode(row.supplierName.toLocaleLowerCase()+'|'+row.partNo.toLocaleLowerCase());
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const id=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    batch.set(fs.doc(db,path,id),{...row,sourceFileId:input.sourceFileId,updatedAt:fs.serverTimestamp()});
   }
   guard();await batch.commit();pending=null;await refresh();
   status('伺服器寫入並讀回完成：'+input.prices.length+' 筆。');
  }catch(e){status('匯入失敗或讀回未確認：'+String(e.code||e.message||e))}
  finally{button.disabled=!pending}
 });
}
start().catch(()=>{});
