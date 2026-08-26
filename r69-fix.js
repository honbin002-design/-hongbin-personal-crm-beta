(()=>{
'use strict';

function fitOne(el){
  if(!el)return;
  el.style.maxWidth='100%';el.style.whiteSpace='nowrap';el.style.overflow='hidden';el.style.textOverflow='clip';el.style.display='block';
  el.style.fontSize='';
  const p=el.parentElement;if(!p)return;
  const max=Math.max(36,p.clientWidth-10);
  let size=parseFloat(getComputedStyle(el).fontSize)||38;
  while(el.scrollWidth>max&&size>13){size-=1;el.style.fontSize=size+'px'}
}
function fitNumbers(){
  document.querySelectorAll('#profit,#margin,#totalProfit,#quoteUnitProfit,#quoteMargin,#quoteTotalProfit,#qUnit,#qMargin,#qTotal,.mini-stat b,.stat b,.metric-value,.kpi-value,.quote-field b').forEach(fitOne);
}
window.addEventListener('load',()=>setTimeout(fitNumbers,120));
window.addEventListener('resize',()=>setTimeout(fitNumbers,60));
new MutationObserver(()=>requestAnimationFrame(fitNumbers)).observe(document.documentElement,{subtree:true,childList:true,characterData:true});

const css=document.createElement('style');
css.id='r69-runtime-style';
css.textContent=`
@media print{
  @page{size:A4 portrait;margin:0!important}
  html,body{width:210mm!important;height:auto!important;margin:0!important;padding:0!important;background:#fff!important}
  body.r69-print>*:not(#r69PrintRoot){display:none!important}
  #r69PrintRoot{display:block!important;width:210mm!important;margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
  #r69PrintRoot .quote-paper-shell{display:block!important;width:210mm!important;height:296.5mm!important;min-height:296.5mm!important;max-height:296.5mm!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#fff!important;break-after:page!important;page-break-after:always!important}
  #r69PrintRoot .quote-paper-shell:last-child{break-after:auto!important;page-break-after:auto!important}
  #r69PrintRoot .quote-paper{display:block!important;position:static!important;width:204mm!important;min-width:204mm!important;max-width:204mm!important;height:290mm!important;min-height:290mm!important;max-height:290mm!important;margin:2.5mm auto 0!important;padding:3.5mm 4mm 4mm!important;box-sizing:border-box!important;transform:none!important;box-shadow:none!important;border:0!important;overflow:hidden!important;background:#fff!important;color:#111!important}
  #r69PrintRoot .q-letterhead-img{display:block!important;width:100%!important;height:auto!important}
  #r69PrintRoot .q-party{font-size:14pt!important;line-height:1.22!important}
  #r69PrintRoot .q-table{font-size:14pt!important;width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;border-collapse:collapse!important}
  #r69PrintRoot .q-table th,#r69PrintRoot .q-table td{font-size:14pt!important;padding:1.1mm .7mm!important;box-sizing:border-box!important;min-width:0!important;overflow:hidden!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important}
  #r69PrintRoot .q-terms{font-size:14pt!important;line-height:1.22!important;margin:1.6mm 2mm!important}
  #r69PrintRoot .q-notes{font-size:14pt!important;line-height:1.28!important;margin:1.8mm 2mm!important}
  #r69PrintRoot .q-sales{font-size:15pt!important;line-height:1.25!important;margin-top:4mm!important}
  #r69PrintRoot .q-page-no{font-size:12pt!important}
}
`;
document.head.appendChild(css);

function removeRoot(){const old=document.getElementById('r69PrintRoot');if(old)old.remove();document.body.classList.remove('r69-print')}
window.printQuoteR68=function(){
  try{
    if(typeof renderQuoteDocument==='function')renderQuoteDocument();
    if(typeof paginateQuotePages==='function')paginateQuotePages();
    if(typeof r60SyncNotes==='function')r60SyncNotes();
    const source=document.getElementById('quotePages');if(!source)throw new Error('找不到報價單頁面');
    const shells=[...source.querySelectorAll('.quote-paper-shell')];if(!shells.length)throw new Error('報價單尚未產生');
    removeRoot();
    const root=document.createElement('div');root.id='r69PrintRoot';
    shells.forEach(shell=>{
      const clone=shell.cloneNode(true);clone.removeAttribute('style');
      const paper=clone.querySelector('.quote-paper');if(paper){paper.removeAttribute('id');paper.removeAttribute('style')}
      clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
      root.appendChild(clone);
    });
    document.body.appendChild(root);document.body.classList.add('r69-print');void root.offsetHeight;
    const cleanup=()=>removeRoot();window.addEventListener('afterprint',cleanup,{once:true});
    requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
    setTimeout(cleanup,7000);
  }catch(e){removeRoot();console.error(e);alert('列印準備失敗：'+(e.message||e))}
};
})();