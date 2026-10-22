// Document-native quotation PDF. Text is embedded as fonts, tables and logo are
// vector paths. No canvas, page screenshots, JPEG embedding or HTML rasterization.
// Fontsource Noto Sans TC is licensed under SIL OFL 1.1 (pinned free public font).
(function(){
'use strict';
const FONT_URLS=[
 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-tc@5.3.0/files/noto-sans-tc-chinese-traditional-400-normal.woff2',
 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/TraditionalChinese/NotoSansTC-Regular.otf'
];
let fontBytesPromise=null;
async function fontBytes(){
 if(fontBytesPromise)return fontBytesPromise;
 fontBytesPromise=(async()=>{
  for(const url of FONT_URLS){
   try{
    const response=await fetch(url,{mode:'cors',cache:'force-cache'});
    if(!response.ok)continue;
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length>10000)return bytes;
   }catch{/* Try public open-source fallback. */}
  }
  throw Error('無法取得免費中文字型，請確認網路連線後重試；未產生圖片式 PDF');
 })().catch(err=>{fontBytesPromise=null;throw err});
 return fontBytesPromise;
}
function txt(value){return String(value??'').replace(/[\u0000-\u001f]/g,' ').trim()}
function lines(value){return String(value??'').replace(/\r\n?/g,'\n').split('\n')}
function splitToWidth(input,font,size,maxWidth,maxLines=99){
 const result=[];
 for(const paragraph of lines(input)){
  if(!paragraph){result.push('');continue}
  let run='';
  for(const char of Array.from(paragraph)){
   const test=run+char;
   if(run&&font.widthOfTextAtSize(test,size)>maxWidth){result.push(run);run=char}
   else run=test;
  }
  if(run)result.push(run);
 }
 return result.slice(0,maxLines);
}
async function makePdf(data){
 if(!window.PDFLib||!window.fontkit)throw Error('免費 PDF 元件尚未載入');
 const {PDFDocument,rgb}=window.PDFLib;
 const pdf=await PDFDocument.create();pdf.registerFontkit(window.fontkit);
 const bytes=await fontBytes();
 let font;
 try{font=await pdf.embedFont(bytes,{subset:true})}
 catch(primary){
  // Some fontkit versions cannot read WOFF2. Fall back to the OpenType edition.
  const resp=await fetch(FONT_URLS[1],{mode:'cors',cache:'force-cache'});
  if(!resp.ok)throw Error('向量中文字型載入失敗，無法安全輸出文件 PDF');
  font=await pdf.embedFont(new Uint8Array(await resp.arrayBuffer()),{subset:true});
 }
 const black=rgb(.12,.12,.12),red=rgb(.60,.16,.19),gray=rgb(.33,.33,.33),white=rgb(1,1,1);
 const W=595.276,H=841.890,left=47,right=W-47,tableWidth=right-left;
 const fields=data?.fields||{},items=Array.isArray(data?.items)?data.items:[],records=items.length?items:[{}];
 const pages=[];for(let i=0;i<records.length;i+=4)pages.push(records.slice(i,i+4));
 function text(page,value,x,y,size=14,opts={}){
  const t=txt(value);if(!t)return;
  page.drawText(t,{x,y,size,font,color:opts.color||black});
 }
 function fitText(page,value,x,y,size,width,options={}){
  const t=txt(value);if(!t)return;
  let s=size;while(font.widthOfTextAtSize(t,s)>width&&s>8)s-=.5;
  text(page,t,x,y,s,options);
 }
 function center(page,value,cx,y,size=14,options={}){
  const t=txt(value);const w=font.widthOfTextAtSize(t,size);text(page,t,cx-w/2,y,size,options);
 }
 function rule(page,x1,y1,x2,y2,width=.6,color=gray){
  page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness:width,color});
 }
 function drawBrand(page){
  // High-resolution vector H emblem, drawn directly as PDF paths.
  page.drawRectangle({x:47,y:735,width:18,height:63,color:red});
  page.drawRectangle({x:89,y:735,width:18,height:63,color:red});
  page.drawRectangle({x:65,y:758,width:25,height:16,color:red});
  page.drawEllipse({x:84,y:766,xScale:20,yScale:6,color:white});
  page.drawEllipse({x:65,y:766,xScale:10,yScale:4,color:red});
  fitText(page,'HON BOND',47,721,9,68,{color:red});
  fitText(page,'鴻繽科技有限公司',123,781,27,430);
  fitText(page,'HONBIN TECHNOLOGY CO., LTD.',124,759,15,427,{color:red});
  fitText(page,'台南市安南區安西二街108號',124,742,11.5,427,{color:red});
  fitText(page,'No.108, Anxi 2nd St., Annan Dist., Tainan City 70958, Taiwan (R.O.C.)',124,729,9,427,{color:gray});
  fitText(page,'TEL: +886-6-2453737   FAX: +886-6-2463328',124,714,10.5,427,{color:gray});
  center(page,'報價單',W/2,683,20);
  // The title-to-line visual gap is 0.5 mm (1.42 pt), without overlap.
  rule(page,W/2-43,679.5,W/2+43,679.5,.75,black);
 }
 function drawRow(page,content,x,y,size,width,height,align='center'){
  const rows=splitToWidth(txt(content),font,size,width-9,3);
  let step=Math.min(16,height/Math.max(rows.length,1));
  let start=y-height/2+(rows.length-1)*step/2-5;
  for(const line of rows){
   if(line){
    const rendered=font.widthOfTextAtSize(line,size);
    text(page,line,align==='center'?x+(width-rendered)/2:x+4,start,size);
   }
   start-=step;
  }
 }
 pages.forEach((subset,pageIndex)=>{
  const page=pdf.addPage([W,H]);drawBrand(page);
  fitText(page,'Messers.',left,652,15,83);
  fitText(page,fields.qdCustomer,left+100,652,16,215);
  fitText(page,'TEL： '+txt(fields.qdTel),left+100,628,16,215);
  fitText(page,'FAX： '+txt(fields.qdFax),left+100,604,16,215);
  fitText(page,'NO： '+txt(fields.qdNo),335,652,15,214);
  fitText(page,'DATE： '+txt(fields.qdDate).replace(/-/g,'/'),335,628,15,214);
  fitText(page,'聯絡人： '+txt(fields.qdContact),335,604,15,214);
  const columns=[.25,.20,.16,.19,.20].map(x=>x*tableWidth);
  const starts=[left];for(const width of columns)starts.push(starts.at(-1)+width);
  const top=587,headH=34,rowH=36,bottom=top-headH-rowH*4;
  for(let i=0;i<=5;i++)rule(page,starts[i],top,starts[i],bottom,.7);
  for(let i=0;i<=5;i++)rule(page,left,top-(i===0?0:headH+rowH*(i-1)),right,top-(i===0?0:headH+rowH*(i-1)),.7);
  const headers=['品名','品號','規格','單價 (NT)','最低訂購量'];
  for(let j=0;j<5;j++)drawRow(page,headers[j],starts[j],top,15,columns[j],headH);
  for(let k=0;k<4;k++){
   const row=subset[k]||{};
   const fields=[row.name,row.model,row.spec,row.price,row.moq];
   for(let j=0;j<5;j++)drawRow(page,fields[j],starts[j],top-headH-k*rowH,14.8,columns[j],rowH);
  }
  let y=bottom-21;
  const details=[
   ['交貨日期',fields.qdDelivery],
   ['付款條件',fields.qdPayment],
   ['交貨地點',fields.qdPlace],
   ['有效期限',fields.qdValid]
  ];
  for(const [label,value] of details){
   const s=label+'：'+txt(value);
   const wraps=splitToWidth(s,font,14,tableWidth-25,2);
   for(const line of wraps){text(page,line,left+12,y,14);y-=21}
  }
  text(page,'單筆交易未滿伍仟元整需自行負擔運費',left+12,y,14);y-=21;
  text(page,'報價單價格不含 5% 營業稅',left+12,y,14);y-=21;
  text(page,'備　註：',left+12,y-3,14);y-=24;
  const notes=lines(fields.qdNotes||'').slice(0,8);
  for(const note of notes){
   const wrap=splitToWidth(note,font,14,tableWidth-32,2);
   for(const line of wrap){
    if(y<97)break;
    text(page,line,left+12,y,14);y-=20;
   }
  }
  fitText(page,'業務代表： '+txt(fields.qdSales)+'  '+txt(fields.qdSalesTel),302,76,14,244);
  // Deliberately no lower-right page index in customer quotation PDF.
 });
 const result=await pdf.save({useObjectStreams:true});
 return new Blob([result],{type:'application/pdf'});
}
window.honbinVectorQuotePdf=makePdf;
})();
