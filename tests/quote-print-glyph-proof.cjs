'use strict';
// Print-path validation: use the exact production vector-PDF generator without
// WebKit. Independent Poppler checks text extraction and actual glyph pixels.
// No business data, cloud access or real font assets are committed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const PDFLib=require('pdf-lib');
const fontkitModule=require('@pdf-lib/fontkit');
const fontkit=fontkitModule.default||fontkitModule;
const dir=fs.mkdtempSync('/tmp/honbin-pdf-proof-');
function asBuffer(array){return array.buffer.slice(array.byteOffset,array.byteOffset+array.byteLength)}
(async()=>{
 const fontPath=process.env.CRM_PRINT_TEST_FONT;
 if(!fontPath||!fs.existsSync(fontPath))throw Error('STATIC_FONT_REQUIRED');
 const font=fs.readFileSync(fontPath);
 assert(font.length>1000000);
 assert.equal(font.subarray(0,4).toString('latin1'),'OTTO','static OTF font required');
 const jpeg=fs.readFileSync('quote-letterhead.jpg');
 global.window={PDFLib,fontkit};
 global.document={baseURI:'https://print-test.invalid/'};
 global.fetch=async url=>{
  const link=String(url);
  const data=link.includes('quote-letterhead.jpg')?jpeg:
   link.includes('NotoSansTC-Regular.otf')?font:null;
  if(!data)throw Error('UNEXPECTED_EXTERNAL_FONT_OR_URL');
  return {ok:true,arrayBuffer:async()=>asBuffer(data)};
 };
 vm.runInThisContext(fs.readFileSync('quote-vector-pdf.js','utf8'),
  {filename:'quote-vector-pdf.js'});
 const data={fields:{
  qdNo:'Q20261022-001',qdCustomer:'測試客戶股份有限公司',
  qdDate:'2026-10-22',qdTel:'0987451236',qdFax:'1234567',
  qdContact:'測試者',qdDelivery:'有庫存 3 天內交貨，如無庫存需 30 天',
  qdPayment:'次月60天',qdPlace:'貴公司交貨處或指定交貨處',
  qdValid:'三十日',qdNotes:'以上價格為未稅價。實際價格以訂單確認為準。',
  qdSales:'測試2',qdSalesTel:'0987123456'
 },items:[{name:'測試品項',model:'Hb-23457',spec:'150米/捲',price:100,moq:1000}]};
 const pdf=await window.honbinVectorQuotePdf(data);
 assert.equal(pdf.type,'application/pdf');
 const bytes=Buffer.from(await pdf.arrayBuffer());
 const pdfFile=path.join(dir,'quote.pdf');fs.writeFileSync(pdfFile,bytes);
 assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert(bytes.length>150000,'complete font embedding required');
 const txt=execFileSync('pdftotext',['-layout','-enc','UTF-8',pdfFile,'-'],{
  encoding:'utf8',timeout:35000
 });
 const expected=['報價單','Messers.','測試客戶股份有限公司','測試品項',
  '交貨日期','付款條件','交貨地點','備','業務代表'];
 for(const value of expected)
  assert(txt.includes(value),'Invisible or unmapped PDF text: '+value+' / '+txt.slice(0,400));
 const renderRoot=path.join(dir,'render');
 execFileSync('pdftoppm',['-f','1','-l','1','-r','72','-gray',
  '-singlefile',pdfFile,renderRoot],{timeout:35000});
 const pix=fs.readFileSync(renderRoot+'.pgm');
 const head=pix.subarray(0,140).toString('latin1');
 const info=/^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(head);
 assert(info&&Number(info[3])===255,'Invalid gray raster');
 const [w,h]=[Number(info[1]),Number(info[2])],offset=Buffer.byteLength(info[0],'latin1');
 let dark=0;
 for(let y=199;y<257&&y<h;y++)for(let x=60;x<535&&x<w;x++)
  if(pix[offset+y*w+x]<145)dark++;
 assert(dark>110,'Customer/text pixels missing from print raster: '+dark);
 const pages=execFileSync('pdfinfo',[pdfFile],{encoding:'utf8'});
 assert(/Pages:\s+1\b/.test(pages),'PDF page count changed');
 const imageCount=(bytes.toString('latin1').match(/\/Subtype \/Image/g)||[]).length;
 assert.equal(imageCount,1,'Only original company JPEG embedded');
 assert(!txt.includes('第 1 / 1 頁'),'Page index reintroduced');
 console.log('ACTUAL_VECTOR_PDF_TEXT_PRINT_RASTER_PASS',JSON.stringify({
  bytes:bytes.length,renderedTextPixels:dark,
  requiredFields:expected.length,embeddedOriginalImages:imageCount
 }));
})().catch(err=>{console.error(err);process.exitCode=1})
 .finally(()=>fs.rmSync(dir,{recursive:true,force:true}));
