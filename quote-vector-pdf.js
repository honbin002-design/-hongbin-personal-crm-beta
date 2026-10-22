// Document-native quotation PDF. Text is embedded as fonts, tables and logo are
// vector paths. No canvas, page screenshots, JPEG embedding or HTML rasterization.
// Fontsource Noto Sans TC is licensed under SIL OFL 1.1 (pinned free public font).
(function(){
'use strict';
// Apple AirPrint may silently omit glyphs from the old WOFF2/subset-embedded
// PDF even though Safari's HTML quotation preview is fully readable.
// Use a static desktop/print-compatible OpenType font, never WOFF2 or a
// variable font; keep the user's original logo JPEG unchanged.
const FONT_URLS=[
 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/TC/NotoSansTC-Regular.otf',
 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Regular.otf'
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
 const {PDFDocument,rgb,StandardFonts}=window.PDFLib;
 const pdf=await PDFDocument.create();pdf.registerFontkit(window.fontkit);
 const bytes=await fontBytes();
 let font;
 try{
  // Embed the complete, static CFF/OpenType font and Unicode cmap. Avoid
  // fontkit subsetting, whose CID resource can disappear on some printers.
  font=await pdf.embedFont(bytes,{subset:false});
 }catch(primary){
  const resp=await fetch(FONT_URLS[1],{mode:'cors',cache:'force-cache'});
  if(!resp.ok)throw Error('完整中文字型載入失敗，已中止列印避免空白報價');
  font=await pdf.embedFont(new Uint8Array(await resp.arrayBuffer()),{subset:false});
 }
 const latinFont=await pdf.embedFont(StandardFonts.TimesRoman);
 const black=rgb(.12,.12,.12),gray=rgb(.33,.33,.33);
 // Print ASCII letters and digits with normal Latin glyph advances instead of
 // the CJK font's wide proportional metrics (iOS AirPrint and PDF viewers).
 const runs=value=>{
  const groups=[];
  for(const character of Array.from(txt(value))){
   const fontForCharacter=/^[\x20-\x7e]$/.test(character)?latinFont:font;
   const last=groups[groups.length-1];
   if(last?.font===fontForCharacter)last.value+=character;
   else groups.push({font:fontForCharacter,value:character});
  }
  return groups;
 };
 const measure=(value,size)=>runs(value).reduce((sum,run)=>sum+run.font.widthOfTextAtSize(run.value,size),0);
 const W=595.276,H=841.890,left=47,right=W-47,tableWidth=right-left;
 const fields=data?.fields||{},items=Array.isArray(data?.items)?data.items:[],records=items.length?items:[{}];
 const pages=[];for(let i=0;i<records.length;i+=4)pages.push(records.slice(i,i+4));
 function text(page,value,x,y,size=14,opts={}){
  const t=txt(value);if(!t)return;
  let position=x;
  for(const run of runs(t)){
   page.drawText(run.value,{x:position,y,size,font:run.font,color:opts.color||black});
   position+=run.font.widthOfTextAtSize(run.value,size);
  }
 }
 function fitText(page,value,x,y,size,width,options={}){
  const t=txt(value);if(!t)return;
  let s=size;while(measure(t,s)>width&&s>8)s-=.5;
  text(page,t,x,y,s,options);
 }
 function center(page,value,cx,y,size=14,options={}){
  const t=txt(value);const w=measure(t,size);text(page,t,cx-w/2,y,size,options);
 }
 function rule(page,x1,y1,x2,y2,width=.6,color=gray){
  page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},thickness:width,color});
 }
 // Embed the existing source asset byte-for-byte, without recoloring,
 // cropping, tracing or rebuilding the client's exact company letterhead.
 const sourceResponse=await fetch(new URL('quote-letterhead.jpg',document.baseURI),{cache:'no-store'});
 if(!sourceResponse.ok)throw Error('原始公司抬頭圖載入失敗，已取消 PDF 輸出');
 const originalJpeg=new Uint8Array(await sourceResponse.arrayBuffer());
 const banner=await pdf.embedJpg(originalJpeg);
 const bannerWidth=tableWidth;
 const bannerHeight=bannerWidth*banner.height/banner.width;
 if(bannerWidth<=0||bannerHeight>150)throw Error('原始公司抬頭尺寸異常，未產生 PDF');
 function drawBrand(page){
  page.drawImage(banner,{x:left,y:824-bannerHeight,width:bannerWidth,height:bannerHeight});
  center(page,'報價單',W/2,662,20);
  // Short rule below quotation title, without crossing the glyphs.
  rule(page,W/2-43,658.5,W/2+43,658.5,.75,black);
 }
 function drawRow(page,content,x,y,size,width,height,align='center'){
  const rows=splitToWidth(txt(content),font,size,width-9,3);
  let step=Math.min(16,height/Math.max(rows.length,1));
  let start=y-height/2+(rows.length-1)*step/2-5;
  for(const line of rows){
   if(line){
    const rendered=measure(line,size);
    text(page,line,align==='center'?x+(width-rendered)/2:x+4,start,size);
   }
   start-=step;
  }
 }
 pages.forEach((subset,pageIndex)=>{
  const page=pdf.addPage([W,H]);drawBrand(page);
  fitText(page,'Messers.',left,631,15,83);
  fitText(page,fields.qdCustomer,left+100,631,16,215);
  fitText(page,'TEL： '+txt(fields.qdTel),left+100,607,16,215);
  fitText(page,'FAX： '+txt(fields.qdFax),left+100,583,16,215);
  fitText(page,'NO： '+txt(fields.qdNo),335,631,15,214);
  fitText(page,'DATE： '+txt(fields.qdDate).replace(/-/g,'/'),335,607,15,214);
  fitText(page,'聯絡人： '+txt(fields.qdContact),335,583,15,214);
  // Exact four-column appearance of the approved original printed template.
  // MOQ is preserved in CRM records/editor, never erased from saved quotations.
  const columns=[.18,.28,.18,.36].map(x=>x*tableWidth);
  const starts=[left];for(const width of columns)starts.push(starts.at(-1)+width);
  const top=565,headH=34,rowH=36,bottom=top-headH-rowH*4;
  for(let i=0;i<=4;i++)rule(page,starts[i],top,starts[i],bottom,.7);
  // One outer box and one header separator; do not draw lines between items.
  for(const y of [top,top-headH,bottom])rule(page,left,y,right,y,.7);
  const headers=['品名','品號','規格','單價 (NT)'];
  for(let j=0;j<4;j++)drawRow(page,headers[j],starts[j],top,15,columns[j],headH);
  for(let k=0;k<4;k++){
   const row=subset[k]||{};
   const cells=[row.name,row.model,row.spec,row.price];
   for(let j=0;j<4;j++)drawRow(page,cells[j],starts[j],top-headH-k*rowH,14.8,columns[j],rowH);
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
   for(const line of wraps){text(page,line,left,y,14);y-=21}
  }
  text(page,'單筆交易未滿伍仟元整需自行負擔運費',left,y,14);y-=21;
  text(page,'報價單價格不含 5% 營業稅',left,y,14);y-=21;
  text(page,'備　註：',left,y-3,14);y-=24;
  const notes=lines(fields.qdNotes||'').slice(0,8);
  for(const note of notes){
   const wrap=splitToWidth(note,font,14,tableWidth-32,2);
   for(const line of wrap){
    if(y<97)break;
    text(page,line,left,y,14);y-=20;
   }
  }
  // Align the last printed glyph to the same right x as the table's right border.
  const representative='業務代表： '+txt(fields.qdSales)+'  '+txt(fields.qdSalesTel);
  let repSize=14;while(measure(representative,repSize)>tableWidth&&repSize>8)repSize-=.5;
  text(page,representative,right-measure(representative,repSize),76,repSize);
  // Deliberately no lower-right page index in customer quotation PDF.
 });
 const result=await pdf.save({useObjectStreams:false});
 return new Blob([result],{type:'application/pdf'});
}
window.honbinVectorQuotePdf=makePdf;
})();
