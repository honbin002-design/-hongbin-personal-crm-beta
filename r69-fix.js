(()=>{
'use strict';
function fitOne(el){if(!el)return;el.style.maxWidth='100%';el.style.whiteSpace='nowrap';el.style.overflow='hidden';el.style.textOverflow='clip';el.style.display='block';el.style.fontSize='';const p=el.parentElement;if(!p)return;const max=Math.max(36,p.clientWidth-10);let size=parseFloat(getComputedStyle(el).fontSize)||38;while(el.scrollWidth>max&&size>13){size-=1;el.style.fontSize=size+'px'}}
function fitNumbers(){document.querySelectorAll('#profit,#margin,#totalProfit,#quoteUnitProfit,#quoteMargin,#quoteTotalProfit,#qUnit,#qMargin,#qTotal,.mini-stat b,.stat b,.metric-value,.kpi-value,.quote-field b').forEach(fitOne)}
window.addEventListener('load',()=>setTimeout(fitNumbers,120));window.addEventListener('resize',()=>setTimeout(fitNumbers,60));new MutationObserver(()=>requestAnimationFrame(fitNumbers)).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
const css=document.createElement('style');css.id='r69-runtime-style';css.textContent=`
@media print{
 @page{size:A4 portrait;margin:0!important}
 html,body{width:210mm!important;margin:0!important;padding:0!important;background:#fff!important}
 body.r69-print>*:not(#r69PrintRoot){display:none!important}
 #r69PrintRoot{display:block!important;width:210mm!important;margin:0!important;padding:0!important;background:#fff!important}
 #r69PrintRoot .quote-paper-shell{display:block!important;width:210mm!important;height:296mm!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#fff!important;break-after:auto!important;page-break-after:auto!important}
 #r69PrintRoot .quote-paper{display:block!important;position:static!important;width:204mm!important;height:289mm!important;margin:2mm auto 0!important;padding:3mm 4mm!important;box-sizing:border-box!important;transform:none!important;box-shadow:none!important;border:0!important;overflow:hidden!important;background:#fff!important;color:#111!important}
 #r69PrintRoot .q-letterhead-img{display:block!important;width:100%!important;height:auto!important}
 #r69PrintRoot .q-party,#r69PrintRoot .q-table,#r69PrintRoot .q-table th,#r69PrintRoot .q-table td,#r69PrintRoot .q-terms,#r69PrintRoot .q-notes{font-size:14pt!important}
 #r69PrintRoot .q-table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important}
 #r69PrintRoot .q-table th,#r69PrintRoot .q-table td{padding:1.1mm .7mm!important;box-sizing:border-box!important;overflow:hidden!important;overflow-wrap:anywhere!important;word-break:break-word!important}
 #r69PrintRoot .q-terms{line-height:1.22!important;margin:1.6mm 2mm!important}.q-notes{line-height:1.28!important;margin:1.8mm 2mm!important}
 #r69PrintRoot .q-sales{font-size:15pt!important;line-height:1.25!important;margin-top:4mm!important}
 #r69PrintRoot .q-page-no{font-size:12pt!important}
}
`;document.head.appendChild(css);
function removeRoot(){const old=document.getElementById('r69PrintRoot');if(old)old.remove();document.body.classList.remove('r69-print')}
function normalizeFourRows(shell){const table=shell.querySelector('.q-table');if(!table)return;const body=table.tBodies&&table.tBodies[0];if(!body)return;let rows=[...body.rows];while(rows.length<4){const r=body.insertRow();const cols=(table.tHead&&table.tHead.rows[0])?table.tHead.rows[0].cells.length:5;for(let i=0;i<cols;i++){const c=r.insertCell();c.innerHTML='&nbsp;'}rows=[...body.rows]}while(rows.length>4){body.deleteRow(body.rows.length-1);rows=[...body.rows]}}
window.printQuoteR68=function(){try{if(typeof renderQuoteDocument==='function')renderQuoteDocument();if(typeof paginateQuotePages==='function')paginateQuotePages();if(typeof r60SyncNotes==='function')r60SyncNotes();const source=document.getElementById('quotePages');if(!source)throw new Error('找不到報價單頁面');const shells=[...source.querySelectorAll('.quote-paper-shell')];if(!shells.length)throw new Error('報價單尚未產生');removeRoot();const root=document.createElement('div');root.id='r69PrintRoot';/* Only print the first logical page here. More than four items are already paginated by source renderer. */const clone=shells[0].cloneNode(true);clone.removeAttribute('style');const paper=clone.querySelector('.quote-paper');if(paper){paper.removeAttribute('id');paper.removeAttribute('style')}clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));normalizeFourRows(clone);root.appendChild(clone);document.body.appendChild(root);document.body.classList.add('r69-print');void root.offsetHeight;const cleanup=()=>removeRoot();window.addEventListener('afterprint',cleanup,{once:true});requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));setTimeout(cleanup,7000)}catch(e){removeRoot();console.error(e);alert('列印準備失敗：'+(e.message||e))}}
})();