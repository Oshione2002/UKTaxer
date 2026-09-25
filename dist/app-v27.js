import {CALCULATORS,DEFAULTS,SOURCE_LINKS} from './calculators.js';
import {TAX_AREAS} from './tax-areas.js';
import {RULESET,REVIEWED,money} from './engine.js';
import {buildInputRows,downloadPdf,downloadExcel} from './export.js';

const $=s=>document.querySelector(s);
// Track the actual header height when navigation wraps or text size changes.
const header=$('.topbar');
if(header){
 const syncHeaderHeight=()=>document.documentElement.style.setProperty('--header-height',header.getBoundingClientRect().height+'px');
 syncHeaderHeight();
 new ResizeObserver(syncHeaderHeight).observe(header);
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=(n,currency='GBP')=>typeof n==='number'?new Intl.NumberFormat('en-GB',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100):escape(n);
const statusLabel=s=>({calculated:'Formula calculator',assisted:'Assisted estimate',scenario:'Planning scenario'}[s]);
const link=(href,label)=>`<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;
const state={inputs:structuredClone(DEFAULTS),current:'paye',tab:'calculation',result:null,error:null,law:null,coverage:'All',coverageQuery:'',lawQuery:'',lawChapter:'All',lawDocument:'All'};
const lawPromise=fetch('law/manifest.json').then(r=>{if(!r.ok)throw new Error('Law library unavailable');return r.json();}).then(data=>state.law=data).catch(()=>null);
const nationSelect=$('#nation-select');
try{nationSelect.value=localStorage.getItem('uktaxer-nation')||'';}catch{}
nationSelect.addEventListener('change',()=>{
 try{localStorage.setItem('uktaxer-nation',nationSelect.value);}catch{}
 if(location.hash.startsWith('#calculator/'))updateResult(CALCULATORS.find(c=>c.id===state.current));
});

function homeView(){
 const groups=new Map();
 for(const c of CALCULATORS){
  if(!groups.has(c.group))groups.set(c.group,[]);
  groups.get(c.group).push(c);
 }
 const homeCards=[...groups].map(([group,calculators],index)=>`<details class="home-group" style="--home-order:${index}"><summary><h2>${escape(group)}</h2><svg class="home-category-chevron" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="home-group-links">${calculators.map(c=>`<a class="home-calculator" href="#calculator/${c.id}"><span><strong>${escape(c.name)}</strong><small>${escape(c.description)}</small></span><span class="home-link-arrow" aria-hidden="true">→</span></a>`).join('')}</div></details>`);
 $('#main').innerHTML=`<div class="page-header sticky-page-heading"><p class="eyebrow">Welcome to UKTaxer</p><h1>What would you like to calculate?</h1></div><div class="intro page-subtext"><p class="lead">Choose a tax calculator to estimate an amount, review the breakdown and check the rules that apply.</p></div>
 <div class="home-calculators"><div class="home-calculator-column">${homeCards.filter((_,index)=>index%2===0).join('')}</div><div class="home-calculator-column">${homeCards.filter((_,index)=>index%2===1).join('')}</div></div>
 <div class="home-reference-links"><a href="#coverage"><strong>Browse UK tax areas</strong><span>Find tax heads, duties and levies, including those requiring individual review.</span></a><a href="#law"><strong>Read the tax law</strong><span>Search UK legislation by document, area or phrase.</span></a></div>
 <section class="home-how" aria-labelledby="home-how-title">
  <div class="home-section-heading"><p class="eyebrow">How it works</p><h2 id="home-how-title">A clearer estimate in three steps</h2></div>
  <ol class="home-steps">
   <li><span class="home-step-number">1</span><div><strong>Choose the right tax</strong><p>Select the tax head that matches what you want to estimate.</p></div></li>
   <li><span class="home-step-number">2</span><div><strong>Enter the relevant figures</strong><p>Complete the fields and adjust the available assumptions to reflect your situation.</p></div></li>
   <li><span class="home-step-number">3</span><div><strong>Review the complete result</strong><p>Check the breakdown, assumptions, scope and legal references shown with the estimate.</p></div></li>
  </ol>
 </section>
 <section class="home-planning-note" aria-labelledby="home-planning-title">
  <div><p class="eyebrow">Important to know</p><h2 id="home-planning-title">Use each result as a planning estimate</h2></div>
  <p>Tax treatment can depend on facts that a calculator cannot capture. Review the stated assumptions, scope and legal references before making a filing or financial decision.</p>
 </section>`;
}
function refsHtml(refs){return (refs||[]).map(id=>{const source=SOURCE_LINKS[id];return source?link(source.url,source.title):'';}).filter(Boolean).join(' · ');}
function sourceHtml(config){const sources=(config.sources||[]).map(id=>SOURCE_LINKS[id]).filter(Boolean);return '<h3>Legal basis</h3><p>'+refsHtml(config.sources)+'</p>'+sources.map(source=>'<div class="source-entry"><strong>'+link(source.url,source.title)+'</strong><p>'+escape(source.detail)+'</p></div>').join('')+'<p><a href="#law">Search the local UK law library</a></p><p class="mini-label">Ruleset '+RULESET+' · Reviewed '+REVIEWED+'</p>';}
function exportValue(value,currency){return typeof value==='number'?format(value,currency):String(value??'');}
function exportInputValue(field,value){if(field.type==='boolean')return value?'Yes':'No';if(field.type==='select')return field.options.find(([option])=>String(option)===String(value))?.[1]||String(value??'');if(field.type==='money')return format(money(value),'GBP');return String(value??'');}
function buildExportReport(c,r){
 const generatedAt=new Date(),currency='GBP',sources=(c.sources||[]).map(id=>SOURCE_LINKS[id]).filter(Boolean);
 const metric1=r.secondary||['Calculation base',r.base],metric2=r.tertiary||['Tax year','2026–27'];
 const tables=[{title:'Full calculation',headers:['Calculation item','Amount / treatment'],rows:r.rows.map(([label,value])=>[label,exportValue(value,currency)])}];
 if(r.bands)tables.unshift({title:'Progressive tax bands',headers:['Annual band','Rate','Income in band','Tax'],rows:r.bands.map(band=>[band.upper===Infinity?'Above '+format(band.lower):format(band.lower)+' - '+format(band.upper),String(band.rate/100)+'%',format(band.used),format(band.tax)])});
 return {title:c.name+' - UK tax estimate',subtitle:c.description,amountLabel:r.title||'Estimated amount',amount:format(r.amount),generatedAt:generatedAt.toISOString(),generatedDisplay:new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(generatedAt),ruleset:RULESET,reviewed:REVIEWED,sections:[
 {title:'Overview',tables:[{title:'Result summary',headers:['Item','Value'],rows:[['Calculator',c.name],['UK nation',localStorage.getItem('uktaxer-nation')||'Not selected'],['Tax year','2026–27'],['Result',r.title||'Estimated amount'],['Estimated amount',format(r.amount)],['Currency','GBP'],[metric1[0],exportValue(metric1[1],currency)],[metric2[0],exportValue(metric2[1],currency)],['Generated',generatedAt.toISOString()]]}]},
 {title:'Inputs',tables:[{title:'Information entered',headers:['Input','Entered value','Guidance / scope'],rows:buildInputRows(c.fields,state.inputs[c.id],exportInputValue)}]},
 {title:'Calculation breakdown',tables:tables},
 {title:'Assumptions & scope',tables:[{title:'Conditions used',headers:['No.','Assumption / scope'],rows:(r.notes||[]).map((note,index)=>[String(index+1),note])}]},
 {title:'Legal references',tables:[{title:'Official sources',headers:['Source','URL and description'],rows:sources.map(source=>[{text:source.title,url:source.url},{text:source.url+' '+source.detail,url:source.url}])},{title:'Ruleset',headers:['Item','Value'],rows:[['Version',RULESET],['Reviewed',REVIEWED],['Library','Complete local provision text in the law reader.']]}]}
 ]};
}

function calculatorGroupIcon(){
 return '<svg class="calculator-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/></svg>';
}
function nav(){
 const query=$('#calculator-search').value.toLowerCase().trim();
 const groups=new Map();
 for(const c of CALCULATORS){
  if(!`${c.name} ${c.group} ${c.description}`.toLowerCase().includes(query))continue;
  if(!groups.has(c.group))groups.set(c.group,[]);
  groups.get(c.group).push(c);
 }
 $('#calculator-nav').innerHTML=[...groups].map(([group,calculators])=>`<details class="calculator-nav-group" ${query||location.hash.startsWith('#calculator')&&calculators.some(c=>c.id===state.current)?'open':''}><summary class="nav-group"><span class="calculator-group-label">${calculatorGroupIcon(group)}<span>${escape(group)}</span></span><svg class="nav-group-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="calculator-nav-links">${calculators.map(c=>`<a href="#calculator/${c.id}" class="calc-link ${state.current===c.id&&location.hash.startsWith('#calculator')?'active':''}" ${state.current===c.id&&location.hash.startsWith('#calculator')?'aria-current="page"':''}><span class="nav-symbol" aria-hidden="true">${c.symbol}</span>${escape(c.short)}</a>`).join('')}</div></details>`).join('')||'<p class="empty">No matching calculators.</p>';
}
const fieldHelpPopover=document.createElement('div');
fieldHelpPopover.id='field-help-popover';
fieldHelpPopover.className='field-help-popover';
fieldHelpPopover.setAttribute('role','tooltip');
fieldHelpPopover.setAttribute('aria-hidden','true');
document.body.appendChild(fieldHelpPopover);

let activeFieldHelpTrigger=null;
let pinnedFieldHelpTrigger=null;

function fieldHelpDetails(f,calculator){return {meaning:f.hint||('This is the '+f.label.toLowerCase()+' used by '+calculator.name+'.'),enter:f.type==='money'?'Enter pounds sterling.':f.type==='number'?'Enter a valid number.':f.type==='boolean'?'Select when this applies.':'Choose the applicable option.',why:'The result updates as this field changes.',watch:'Check the assumptions and official sources before using the estimate.'};}

function fieldHelpButton(f,calculator,id){
 const help=fieldHelpDetails(f,calculator);
 return '<span class="field-help-wrap"><button class="field-help-trigger" type="button" data-help-title="'+escape(f.label)+'" data-help-meaning="'+escape(help.meaning)+'" data-help-enter="'+escape(help.enter)+'" data-help-why="'+escape(help.why)+'" data-help-watch="'+escape(help.watch)+'" aria-label="More information about '+escape(f.label)+'" aria-expanded="false" aria-controls="field-help-popover"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 10.8v5.4"></path><circle cx="12" cy="7.4" r=".9" fill="currentColor" stroke="none"></circle></svg></button></span>';
}

function positionFieldHelp(trigger){
 const rect=trigger.getBoundingClientRect();
 const popRect=fieldHelpPopover.getBoundingClientRect();
 const gap=8;
 let left=rect.left+(rect.width/2)-(popRect.width/2);
 left=Math.max(12,Math.min(left,window.innerWidth-popRect.width-12));
 let top=rect.bottom+gap;
 if(top+popRect.height>window.innerHeight-12&&rect.top-popRect.height-gap>12)top=rect.top-popRect.height-gap;
 fieldHelpPopover.style.left=Math.round(left)+'px';
 fieldHelpPopover.style.top=Math.round(top)+'px';
}

function showFieldHelp(trigger,{pin=false}={}){
 if(!trigger)return;
 if(activeFieldHelpTrigger&&activeFieldHelpTrigger!==trigger)activeFieldHelpTrigger.setAttribute('aria-expanded','false');
 activeFieldHelpTrigger=trigger;
 if(pin)pinnedFieldHelpTrigger=trigger;
 const title=trigger.dataset.helpTitle||'Field help';
 const meaning=trigger.dataset.helpMeaning||'';
 const enter=trigger.dataset.helpEnter||'';
 const why=trigger.dataset.helpWhy||'';
 const watch=trigger.dataset.helpWatch||'';
 fieldHelpPopover.innerHTML='<div class="field-help-title">'+escape(title)+'</div>'
  +'<div class="field-help-section"><strong>What it means</strong><span>'+escape(meaning)+'</span></div>'
  +'<div class="field-help-section"><strong>What to enter</strong><span>'+escape(enter)+'</span></div>'
  +'<div class="field-help-section"><strong>Why it matters</strong><span>'+escape(why)+'</span></div>'
  +'<div class="field-help-section field-help-watch"><strong>Watch out</strong><span>'+escape(watch)+'</span></div>';
 fieldHelpPopover.classList.add('is-visible');
 fieldHelpPopover.setAttribute('aria-hidden','false');
 trigger.setAttribute('aria-expanded','true');
 requestAnimationFrame(()=>positionFieldHelp(trigger));
}

function hideFieldHelp({force=false}={}){
 if(pinnedFieldHelpTrigger&&!force)return;
 if(activeFieldHelpTrigger)activeFieldHelpTrigger.setAttribute('aria-expanded','false');
 activeFieldHelpTrigger=null;
 if(force)pinnedFieldHelpTrigger=null;
 fieldHelpPopover.classList.remove('is-visible');
 fieldHelpPopover.setAttribute('aria-hidden','true');
}

document.addEventListener('click',event=>{
 const trigger=event.target.closest('.field-help-trigger');
 if(trigger){
  event.preventDefault();
  event.stopPropagation();
  if(pinnedFieldHelpTrigger===trigger){
   hideFieldHelp({force:true});
  }else{
   if(pinnedFieldHelpTrigger&&pinnedFieldHelpTrigger!==trigger)hideFieldHelp({force:true});
   showFieldHelp(trigger,{pin:true});
  }
  return;
 }
 if(pinnedFieldHelpTrigger)hideFieldHelp({force:true});
});

document.addEventListener('mouseover',event=>{
 if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;
 const trigger=event.target.closest('.field-help-trigger');
 if(!trigger||pinnedFieldHelpTrigger)return;
 showFieldHelp(trigger);
});

document.addEventListener('mouseout',event=>{
 if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;
 const trigger=event.target.closest('.field-help-trigger');
 if(!trigger||pinnedFieldHelpTrigger)return;
 if(trigger.contains(event.relatedTarget))return;
 hideFieldHelp();
});

document.addEventListener('focusin',event=>{
 const trigger=event.target.closest('.field-help-trigger');
 if(trigger&&!pinnedFieldHelpTrigger)showFieldHelp(trigger);
});

document.addEventListener('focusout',event=>{
 const trigger=event.target.closest('.field-help-trigger');
 if(trigger&&!pinnedFieldHelpTrigger)hideFieldHelp();
});

document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&(activeFieldHelpTrigger||pinnedFieldHelpTrigger)){
  hideFieldHelp({force:true});
  activeFieldHelpTrigger?.focus?.();
 }
});

window.addEventListener('resize',()=>{if(activeFieldHelpTrigger&&fieldHelpPopover.classList.contains('is-visible'))positionFieldHelp(activeFieldHelpTrigger);});
window.addEventListener('scroll',()=>{if(activeFieldHelpTrigger&&fieldHelpPopover.classList.contains('is-visible'))positionFieldHelp(activeFieldHelpTrigger);},{passive:true});

function inputHtml(f,values,calculator){
 if(f.type==='divider')return `<div class="field-divider">${escape(f.label)}</div>`;
 const id='field-'+f.key,value=values[f.key],help=fieldHelpButton(f,calculator,id);
 if(f.type==='boolean')return `<div class="checkfield"><input id="${id}" name="${f.key}" type="checkbox" ${value===true?'checked':''}><div class="checkfield-copy"><div class="field-label-row"><label for="${id}">${escape(f.label)}</label>${help}</div>${f.hint?`<small>${escape(f.hint)}</small>`:''}</div></div>`;
 const common=`id="${id}" name="${f.key}" aria-describedby="${id}-hint ${id}-error"`;
 return `<div class="field"><div class="field-label-row"><label for="${id}">${escape(f.label)}</label>${help}</div>${f.type==='select'?`<select ${common}>${f.options.map(([v,label])=>`<option value="${escape(v)}" ${String(value)===String(v)?'selected':''}>${escape(label)}</option>`).join('')}</select>`:`<span class="input-wrap">${f.type==='money'?'<span class="prefix" aria-hidden="true">£</span>':''}<input ${common} type="text" inputmode="decimal" autocomplete="off" value="${escape(value)}" ${f.type==='number'?`data-min="${f.min}" data-max="${f.max}"`:''}></span>`}<span class="hint" id="${id}-hint">${escape(f.hint)}</span><span class="error" id="${id}-error"></span></div>`;
}

let resultVisibilityObserver;
function calcView(id){
 const c=CALCULATORS.find(c=>c.id===id)||CALCULATORS[0];state.current=c.id;state.tab='calculation';
 $('#main').innerHTML=`<div class="page-header sticky-page-heading"><p class="eyebrow">${escape(c.group)} / 2026–27 tax year</p><div class="heading-row"><h1>${escape(c.name)}</h1><a class="calculator-import-button" href="#import/${c.id}" aria-label="Upload statement for ${escape(c.name)}" title="Upload statement"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg><span>Upload statement</span></a></div></div><div class="intro page-subtext"><p class="lead">${escape(c.description)}</p></div>
 <aside id="sticky-estimate" class="sticky-estimate" aria-live="polite" aria-atomic="true"></aside>
 <div class="workspace"><section class="panel"><div class="panel-head"><h2>Your details</h2></div><form id="tax-form" novalidate><div class="fields">${c.fields.map(f=>inputHtml(f,state.inputs[c.id],c)).join('')}</div><div class="form-actions"><span>Results update as you type</span><button type="button" id="reset" class="text-button">Clear values ↺</button></div></form></section><div class="result-column" tabindex="0" role="region" aria-label="Tax estimate and breakdown"><section id="result" aria-live="polite" aria-atomic="true"></section><div id="breakdown" class="panel breakdown"></div><p class="info-note">Calculated from your inputs. Check assumptions and legal scope before using an estimate.</p></div></div>
 <section class="detail-area" aria-label="Calculation details"><div class="tabbar" role="tablist" aria-label="Result information"><button id="tab-calculation" class="active" role="tab" aria-selected="true" aria-controls="detail-content" data-tab="calculation">Calculation breakdown</button><button id="tab-assumptions" role="tab" aria-selected="false" tabindex="-1" aria-controls="detail-content" data-tab="assumptions">Assumptions & scope</button><button id="tab-sources" role="tab" aria-selected="false" tabindex="-1" aria-controls="detail-content" data-tab="sources">Legal references</button></div><div id="detail-content" class="detail-card" role="tabpanel" aria-labelledby="tab-calculation"></div></section><div class="print-only"><p>UKTaxer estimate · Ruleset ${RULESET} · Review ${REVIEWED} · ${escape(c.name)}</p><p>Official sources are listed in Legal references.</p></div>`;
 $('#tax-form').addEventListener('submit',event=>event.preventDefault());
 $('#tax-form').addEventListener('input',event=>{const el=event.target;if(!el.name)return;state.inputs[c.id][el.name]=el.type==='checkbox'?el.checked:el.value;updateResult(c);});
 $('#tax-form').addEventListener('change',event=>{const el=event.target;if(!el.name)return;state.inputs[c.id][el.name]=el.type==='checkbox'?el.checked:el.value;updateResult(c);});
 $('#reset').addEventListener('click',()=>{state.inputs[c.id]=structuredClone(DEFAULTS[c.id]);calcView(c.id);});
 document.querySelectorAll('[data-tab]').forEach(button=>{button.addEventListener('click',()=>setTab(button.dataset.tab,c));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=['calculation','assumptions','sources'];let i=tabs.indexOf(state.tab);i=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;setTab(tabs[i],c);$(`[data-tab="${tabs[i]}"]`).focus();});});
 updateResult(c);nav();
 resultVisibilityObserver?.disconnect();
 resultVisibilityObserver=new IntersectionObserver(entries=>{$('#sticky-estimate').hidden=entries[0].isIntersecting;},{threshold:0.1});
 resultVisibilityObserver.observe($('#result'));
}
function setTab(tab,c){state.tab=tab;document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});$('#detail-content').setAttribute('aria-labelledby','tab-'+tab);renderDetail(c);}
function validate(c){let invalid=false;for(const f of c.fields){if(!f.key||['divider','boolean'].includes(f.type))continue;let error='';const value=state.inputs[c.id][f.key];try{if(f.type==='money')money(value);else if(f.type==='number'){if(!new RegExp('^\\d+(\\.\\d{1,'+(f.precision||2)+'})?$').test(String(value))||Number(value)<f.min||Number(value)>f.max)throw new Error(`Enter a number from ${f.min.toLocaleString()} to ${f.max.toLocaleString()}.`);}else if(!f.options.some(([v])=>String(v)===String(value)))throw new Error('Choose an available option.');}catch(e){error=e.message;}const el=$('#field-'+f.key);el.setAttribute('aria-invalid',String(Boolean(error)));el.closest('.input-wrap')?.classList.toggle('invalid',Boolean(error));$('#field-'+f.key+'-error').textContent=error;invalid||=Boolean(error);}return !invalid;}
function updateResult(c){
 state.error=null;state.result=null;
 if(validate(c)){try{state.result=c.calculate(state.inputs[c.id]);}catch(e){state.error=e.message;}}else state.error='Check the highlighted fields to calculate a new estimate.';
 const r=state.result;
 if(state.error){$('#sticky-estimate').innerHTML='<span>Your estimate</span><strong>Check your inputs</strong>';$('#result').innerHTML=`<div class="result-card"><div class="result-heading">Your estimate</div><div class="status-placeholder">Check your inputs</div><p>${escape(state.error)}</p></div>`;$('#breakdown').innerHTML='';renderDetail(c);return;}
 const currency=r.currency||'GBP',available=r.amount!==null;
 $('#sticky-estimate').innerHTML=`<span>${escape(r.title||'Estimated amount')}</span><strong>${available?format(r.amount,currency):'Review needed'}</strong>`;
 const metric1=r.secondary||['Calculation base',r.base],metric2=r.tertiary||['Tax year','2026–27'];
 $('#result').innerHTML=`<div class="result-card"><div class="result-heading">${escape(r.title||'Estimated amount')}</div><div class="${available?'result-total':'status-placeholder'}">${available?format(r.amount,currency):'Review needed'}</div><div class="result-sub">${available?(r.currency==='USD'?'All results below are in US dollars':'Pounds sterling · rounded to the nearest penny'):'Read the conditions below to continue.'}</div>${available?`<div class="result-metrics"><div><small>${escape(metric1[0])}</small><strong>${format(metric1[1],currency)}</strong></div><div><small>${escape(metric2[0])}</small><strong>${format(metric2[1],currency)}</strong></div></div>`:''}${r.bands&&available?`<div class="result-bar" role="img" aria-label="Income tax ${r.base?(r.amount/r.base*100).toFixed(2):0}% of total income"><progress class="tax-progress" value="${Math.min(1,r.base?r.amount/r.base:0)}" max="1"></progress></div><div class="bar-labels"><span>Income tax</span><span>Income before other deductions</span></div>`:''}<div class="result-actions"><button class="button primary export-button" id="download-pdf" ${!available?'disabled':''}><span>Download PDF</span></button><button class="button export-button" id="download-excel" ${!available?'disabled':''}><span>Download Excel</span></button></div></div>`;
 const runExport=(button,download)=>{
  const originalLabel=button.textContent;
  button.addEventListener('click',()=>{
   try{
    button.disabled=true;button.textContent='Preparing…';
    download(buildExportReport(c,r),`UKTaxer-${c.id}-${new Date().toISOString().slice(0,10)}`);
    button.textContent='Downloaded';
   }catch(error){
    console.error('Export failed',error);
    button.textContent='Try again';
    button.setAttribute('aria-label',`${originalLabel} failed. Try again.`);
   }finally{
    setTimeout(()=>{button.disabled=false;button.textContent=originalLabel;button.removeAttribute('aria-label');},1400);
   }
  });
 };
 runExport($('#download-pdf'),downloadPdf);
 runExport($('#download-excel'),downloadExcel);
 $('#breakdown').innerHTML=available?`<div class="panel-head"><h2>At a glance</h2><span class="mini-label">${r.currency||'GBP'}</span></div><div class="rows">${r.rows.slice(-6).map(([name,val])=>`<div class="result-row"><span>${escape(name)}</span><strong>${format(val,currency)}</strong></div>`).join('')}</div>`:`<div class="rows">${r.notes.map(n=>`<p class="notice">${escape(n)}</p>`).join('')}</div>`;
 renderDetail(c);
}
function renderDetail(c){
 const container=$('#detail-content');if(!container)return;
 const r=state.result,currency=r?.currency||'GBP';
 if(state.tab==='sources'){container.innerHTML=sourceHtml(c);return;}
 if(state.tab==='assumptions'){container.innerHTML=`<h3>What this estimate assumes</h3><ul>${(r?.notes||['Correct the highlighted inputs to see the assumptions for your result.']).map(n=>`<li>${escape(n)}</li>`).join('')}</ul><p><a href="#coverage">Browse UK tax areas</a> · <a href="#sources">Sources & methodology</a></p>`;return;}
 if(!r){container.innerHTML='<p>Enter valid details to view your calculation.</p>';return;}
 if(r.bands){const incomeTaxAmount=r.rows.find(([label])=>label==='Income Tax')?.[1]??r.amount;container.innerHTML=`<h3>Your progressive tax bands</h3><p>Each rate applies only to income inside that band. These are annual taxable-income bands.</p><div class="table-wrap"><table><thead><tr><th scope="col">Annual band</th><th scope="col">Rate</th><th scope="col">Your income in band</th><th scope="col">Tax</th></tr></thead><tbody>${r.bands.map(b=>`<tr><td>${b.upper===Infinity?'Above '+format(b.lower):format(b.lower)+' – '+format(b.upper)}</td><td>${b.rate/100}%</td><td>${format(b.used)}</td><td>${format(b.tax)}</td></tr>`).join('')}<tr class="table-total"><td colspan="3">Annual Income Tax</td><td>${format(incomeTaxAmount)}</td></tr></tbody></table></div><a class="inline-ref" href="#law">Read the UK tax law library ↗</a><h3 class="full-breakdown-title">Full calculation</h3>${rowsTable(r,currency)}`;}
 else container.innerHTML=`<h3>${r.amount===null?'Scope needs confirmation':'How the amount is calculated'}</h3>${r.rows.length?rowsTable(r,currency):`<ul>${r.notes.map(n=>`<li>${escape(n)}</li>`).join('')}</ul>`}<p class="mini-label">${refsHtml(c.sources)}</p>`;
}
function rowsTable(r,currency){return `<div class="table-wrap"><table><thead><tr><th scope="col">Calculation item</th><th scope="col">Amount / treatment</th></tr></thead><tbody>${r.rows.map(([name,val])=>`<tr><td>${escape(name)}</td><td>${format(val,currency)}</td></tr>`).join('')}</tbody></table></div>`;}

function coverageView(){
 $('#main').innerHTML=`<div class="coverage-heading-row"><div><p class="eyebrow">UK taxes, duties and levies</p><h1>UK tax areas</h1></div><div class="coverage-toolbar"><label class="search wide-search"><span aria-hidden="true">⌕</span><input id="coverage-search" type="search" aria-label="Search UK tax areas" placeholder="Search a tax or duty…" value="${escape(state.coverageQuery)}"></label><label class="coverage-filter-control"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 4h18l-7 8v7l-4 2v-9Z"/></svg><select id="coverage-filter" aria-label="Filter UK tax areas"><option value="All" ${state.coverage==='All'?'selected':''}>All tax areas</option><option value="calculator" ${state.coverage==='calculator'?'selected':''}>With calculator</option><option value="review" ${state.coverage==='review'?'selected':''}>Review needed</option></select></label></div></div><div class="intro coverage-intro"><p class="lead">Browse named UK and devolved tax heads. Calculator availability is shown separately from the existence of a tax or duty.</p></div><div class="notice neutral">${TAX_AREAS.length} tax areas · ${CALCULATORS.length} calculator workspaces. Areas without a calculator link to an official source and require individual review.</div><p class="law-count" id="coverage-count" aria-live="polite"></p><div class="grid-cards" id="coverage-cards"></div>`;
 const render=()=>{
  const query=state.coverageQuery.toLowerCase().trim();
  const areas=TAX_AREAS.filter(area=>{
   if(state.coverage==='calculator'&&!area.calculators.length)return false;
   if(state.coverage==='review'&&area.calculators.length)return false;
   const names=area.calculators.map(id=>CALCULATORS.find(c=>c.id===id)?.name||'').join(' ');
   return !query||`${area.name} ${area.summary} ${names}`.toLowerCase().includes(query);
  });
  $('#coverage-count').textContent=`${areas.length} ${areas.length===1?'tax area':'tax areas'}`;
  $('#coverage-cards').innerHTML=areas.map(area=>`<article class="coverage-card"><span class="badge ${area.calculators.length?'':'assisted'}">${area.calculators.length?'Calculator available':'Review needed'}</span><h2>${escape(area.name)}</h2><p>${escape(area.summary)}</p><p class="mini-label">${link(area.url,'Official source')}</p>${area.calculators.length?`<div class="tax-area-calculators">${area.calculators.map(id=>{const c=CALCULATORS.find(item=>item.id===id);return c?`<a href="#calculator/${c.id}">${escape(c.name)} →</a>`:'';}).join('')}</div>`:'<p class="tax-area-review">No reliable calculator is available for this tax area. Check the official source and seek case-specific review.</p>'}</article>`).join('')||'<p class="empty coverage-empty">No matching tax areas found.</p>';
 };
 const search=$('#coverage-search');
 const filter=$('#coverage-filter');
 search.addEventListener('input',()=>{state.coverageQuery=search.value;render();});
 filter.addEventListener('change',()=>{state.coverage=filter.value;render();});
 render();
}
let lawToolbarObserver;
let lawEntries=[];
async function lawView(target){
 $('#main').innerHTML='<p class="eyebrow">Legal reference</p><h1>UK tax law library</h1><p class="lead">Loading the indexed law…</p>';
 const data=await lawPromise;if(!location.hash.startsWith('#law'))return;
 if(!data){$('#main').innerHTML='<h1>UK tax law library</h1><p>The local law manifest could not load. Reload while online.</p>';return;}
 $('#main').innerHTML='<div class="law-toolbar"><div><p class="eyebrow">Official legislation · local provision text</p><h1>UK tax law library</h1></div><div class="law-search-controls"><label class="search wide-search"><span aria-hidden="true">⌕</span><input id="law-search" type="search" aria-label="Search the tax law" placeholder="Search provision text or title…"></label><label class="law-filter-control"><select id="law-area" aria-label="Filter by tax area"><option value="All">All tax areas</option>'+[...new Set(data.documents.map(doc=>doc.area))].map(area=>'<option value="'+escape(area)+'">'+escape(area)+'</option>').join('')+'</select></label><label class="law-filter-control"><select id="law-document" aria-label="Filter by document"><option value="All">All documents</option>'+data.documents.map(doc=>'<option value="'+escape(doc.id)+'">'+escape(doc.title)+'</option>').join('')+'</select></label></div></div><div class="intro"><p class="lead">Search the local provision text of '+data.documents.length+' in-scope Acts and regulations. Follow each provision to the official legislation page.</p></div><p class="law-count" id="law-count" aria-live="polite"></p><div id="law-results"></div>';
 const toolbar=$('.law-toolbar');const syncLawToolbar=()=>$('#main').style.setProperty('--law-toolbar-height',toolbar.getBoundingClientRect().height+'px');syncLawToolbar();lawToolbarObserver=new ResizeObserver(syncLawToolbar);lawToolbarObserver.observe(toolbar);
 $('#law-search').value=state.lawQuery;$('#law-area').value=state.lawChapter;$('#law-document').value=state.lawDocument;
 $('#law-search').addEventListener('input',()=>{state.lawQuery=$('#law-search').value;renderLaw();});
 $('#law-area').addEventListener('change',()=>{state.lawChapter=$('#law-area').value;renderLaw();});
 $('#law-document').addEventListener('change',()=>{state.lawDocument=$('#law-document').value;renderLaw();});
 if(!lawEntries.length){try{const batches=await Promise.all(data.documents.map(async doc=>{const response=await fetch(doc.index);if(!response.ok)throw new Error('Could not load '+doc.title);const entries=await response.json();return entries.map((entry,index)=>({...entry,doc,entryId:doc.id.replaceAll('/','-')+'-'+index}));}));lawEntries=batches.flat();}catch(error){$('#law-results').innerHTML='<p class="notice">'+escape(error.message)+'</p>';return;}}
 if(target){state.lawQuery='';$('#law-search').value='';state.lawDocument='All';$('#law-document').value='All';}renderLaw();
 if(target){const el=document.getElementById('law-'+target);if(el){el.open=true;el.scrollIntoView({block:'start',behavior:'instant'});}}
}
function lawTextHtml(value){return String(value??'').split(/\n\s*\n/).filter(Boolean).map(p=>'<p>'+escape(p)+'</p>').join('');}
function renderLaw(){
 const query=state.lawQuery.toLowerCase().trim(),area=state.lawChapter,document=state.lawDocument;
 const filtered=lawEntries.filter(entry=>(area==='All'||entry.doc.area===area)&&(document==='All'||entry.doc.id===document)&&(!query||entry.heading.toLowerCase().includes(query)||entry.text.toLowerCase().includes(query)||entry.doc.title.toLowerCase().includes(query)));
 const shown=filtered.slice(0,120);$('#law-count').textContent=filtered.length+' provisions found'+(filtered.length>shown.length?' · showing first '+shown.length:'');
 $('#law-results').innerHTML=shown.map(entry=>'<details class="law-item" id="law-'+entry.entryId+'"><summary><span class="section-no">'+escape(entry.doc.title)+'</span><span class="law-section-title">'+escape(entry.heading)+'</span><span class="law-chevron" aria-hidden="true">⌄</span></summary><p>'+link(entry.url,'Open official provision')+' · '+link(entry.doc.source,'Complete Act or regulation')+'</p><div class="law-body">'+lawTextHtml(entry.text)+'</div><p class="mini-label">Retrieved '+escape(entry.doc.retrieved)+' · '+escape(entry.doc.revision)+'</p></details>').join('')||'<div class="empty">No match. Try a shorter phrase or another filter.</div>';
}

function sourcesView(){
 $('#main').innerHTML='<div class="page-header sticky-page-heading"><p class="eyebrow">Understanding your estimate</p><h1>Sources & methodology</h1></div><div class="intro page-subtext"><p class="lead">UKTaxer uses a fixed 2026–27 ruleset reviewed on '+REVIEWED+'. Results update as you type; complex cases show Review needed.</p></div><section class="detail-card"><h2>Official rate sources</h2>'+Object.values(SOURCE_LINKS).map(source=>'<article class="source-entry"><h3>'+link(source.url,source.title)+'</h3><p>'+escape(source.detail)+'</p></article>').join('')+'</section><section class="detail-card detail-area"><h2>Complete law text</h2><p>The law reader contains local provision text from official legislation.gov.uk records with document and tax-area filters. Rates are verified separately against current authority guidance. Reports include inputs, breakdown, assumptions and source links.</p><p><a href="#law">Open the law library</a></p></section><section class="detail-card detail-area"><h2>Using this estimate</h2><p>Check eligibility, reliefs and dates before filing. UKTaxer does not file returns or issue a tax assessment.</p><p>'+link('https://github.com/Oshione2002/UKTaxer','View the calculation code')+'</p></section>';
}

function importView(sourceCalculator=''){
 const source=CALCULATORS.find(c=>c.id===sourceCalculator);
 $('#main').innerHTML=`<div class="page-header sticky-page-heading"><p class="eyebrow">Statement import</p><h1>Import Statement</h1></div>
 <div class="intro page-subtext"><p class="lead">Bring a bank statement, financial statement, Excel file or CSV into UKTaxer, review the extracted rows and decide exactly which calculator fields they should populate.</p></div>

 <section class="statement-upload-card" aria-labelledby="statement-upload-title">
  <div class="statement-upload-heading">
   <div><p class="eyebrow">Start here</p><h2 id="statement-upload-title">Upload your statements</h2></div>
   ${source?`<span class="statement-source-calculator">For: ${escape(source.name)}</span>`:''}
  </div>
  <p class="statement-upload-copy">Choose one or more supported files. Nothing is added to a calculator until you review and confirm the extracted information.</p>
  <div id="statement-dropzone" class="statement-dropzone">
   <input id="statement-file" class="statement-file-input" type="file" multiple accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
   <svg class="statement-upload-icon" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg>
   <strong>Drop your statements here</strong>
   <span>or</span>
   <button id="statement-browse" class="button primary" type="button">Choose statements</button>
   <small>PDF, Excel (.xlsx) or CSV</small>
  </div>
  <div id="statement-file-status" class="statement-file-status" aria-live="polite" hidden></div>
 </section>

 <section id="statement-next-step" class="statement-next-step" hidden aria-labelledby="statement-next-title">
  <div class="statement-next-heading">
   <div><p class="eyebrow">Next step</p><h2 id="statement-next-title">Ready to analyse</h2></div>
   <button id="statement-back-to-files" class="text-button" type="button">← Back to files</button>
  </div>
  <p>Your selected statements are ready for the extraction and mapping stage.</p>
  <div id="statement-next-summary" class="statement-next-summary"></div>
  <p class="notice neutral">UKTaxer will use this next stage to extract the rows, suggest relevant calculators and let you review every mapping before anything reaches a calculator.</p>
  <div class="statement-analysis-actions">
   <button id="statement-analyse" class="button primary" type="button">Analyse statements</button>
  </div>
  <div id="statement-analysis-progress" class="statement-analysis-progress" aria-live="polite" hidden></div>
 </section>

 <section id="statement-review" class="statement-review" hidden aria-labelledby="statement-review-title">
  <div class="statement-review-heading">
   <div><p class="eyebrow">Review extraction</p><h2 id="statement-review-title">Review and map statement rows</h2></div>
   <button id="statement-review-back" class="text-button" type="button">← Back</button>
  </div>
  <p class="statement-review-copy">UKTaxer AI suggestions are only starting points. Change any mapping, or use × to exclude a row from calculation. Excluded rows stay visible and can be restored with +.${source?` Because this import started from ${escape(source.name)}, the mapping dropdown is limited to that calculator’s amount fields.`:'' }</p>
  <div id="statement-document-summary" class="statement-document-summary"></div>
  <div class="statement-review-table-wrap">
   <table class="statement-review-table">
    <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Type</th><th>Map to UKTaxer field</th><th>Use</th></tr></thead>
    <tbody id="statement-review-body"></tbody>
   </table>
  </div>
  <div class="statement-review-actions">
   <button id="statement-review-continue" class="button primary" type="button">Continue</button>
  </div>
 </section>

 <section id="statement-calculator-step" class="statement-review" hidden aria-labelledby="statement-calculator-title">
  <div class="statement-review-heading">
   <div><p class="eyebrow">Calculator selection</p><h2 id="statement-calculator-title">Choose calculators</h2></div>
   <button id="statement-calculator-back" class="text-button" type="button">← Back</button>
  </div>
  <p class="statement-review-copy">Start with calculators suggested by the reviewed mappings, or choose from all UKTaxer calculators.</p>
  <div id="statement-suggested-calculators"></div>
  <details class="statement-all-calculators">
   <summary>All calculators</summary>
   <div id="statement-all-calculator-list"></div>
  </details>
  <div class="statement-review-actions">
   <button id="statement-calculator-continue" class="button primary" type="button">Continue to mapped totals</button>
  </div>
 </section>

 <section id="statement-totals-step" class="statement-review" hidden aria-labelledby="statement-totals-title">
  <div class="statement-review-heading">
   <div><p class="eyebrow">Final review</p><h2 id="statement-totals-title">Mapped totals</h2></div>
   <button id="statement-totals-back" class="text-button" type="button">← Back</button>
  </div>
  <p class="statement-review-copy">Check exactly what UKTaxer will put into each selected calculator field.</p>
  <div id="statement-mapped-totals" class="statement-mapped-totals"></div>
  <div class="statement-review-actions">
   <button id="statement-apply" class="button primary" type="button">Apply to calculators</button>
  </div>
 </section>

 <section class="detail-card detail-area">
  <h2>How statement import will work</h2>
  <ol>
   <li><strong>Upload a supported statement.</strong> UKTaxer will read PDF, Excel and CSV files.</li>
   <li><strong>Review the relevant extracted rows.</strong> Suggested rows can be excluded and restored before any value is applied.</li>
   <li><strong>Choose calculators and fields.</strong> Use UKTaxer AI suggestions or browse every calculator and field yourself.</li>
   <li><strong>Confirm mapped totals.</strong> See exactly what will be added to each calculator before applying anything.</li>
   <li><strong>Calculate with UKTaxer.</strong> Confirmed values feed the existing deterministic calculator engine.</li>
  </ol>
 </section>
 <section class="detail-card detail-area">
  <h2>Supported statement types</h2>
  <p>Bank statements, financial statements, transaction exports and similar records in PDF, Excel or CSV format will use this workspace.</p>
  <p class="notice neutral">The import workflow will keep extracted information reviewable before any amount is applied to a tax calculation.</p>
 </section>`;

 const fileInput=$('#statement-file');
 const browseButton=$('#statement-browse');
 const dropzone=$('#statement-dropzone');
 const status=$('#statement-file-status');
 const supportedExtensions=['pdf','csv','xlsx'];
 let selectedFiles=[];
 const preparation=new Map();
 let unsupportedCount=0;

 const formatBytes=bytes=>{
  if(bytes<1024)return bytes+' B';
  if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB';
  return (bytes/(1024*1024)).toFixed(1)+' MB';
 };
 const fileKey=file=>[file.name,file.size,file.lastModified].join('::');
 const fileExtension=file=>(file.name.split('.').pop()||'').toLowerCase();

 const overallPreparation=()=>{
  if(!selectedFiles.length)return {percent:0,ready:false,error:false};
  let loaded=0,total=0,error=false;
  for(const file of selectedFiles){
   const state=preparation.get(fileKey(file))||{loaded:0,total:file.size||1,status:'pending'};
   const size=file.size||1;
   total+=size;
   loaded+=Math.min(state.loaded||0,size);
   if(state.status==='error')error=true;
  }
  const percent=total?Math.round((loaded/total)*100):100;
  return {percent:Math.min(100,percent),ready:percent>=100&&!error,error};
 };

 const renderSelectedFiles=()=>{
  dropzone.classList.toggle('has-file',selectedFiles.length>0);
  if(!selectedFiles.length){
   status.hidden=true;
   status.className='statement-file-status';
   status.innerHTML='';
   return;
  }
  const totalSize=selectedFiles.reduce((sum,file)=>sum+file.size,0);
  const progress=overallPreparation();
  status.hidden=false;
  status.className='statement-file-status selected multiple';
  status.innerHTML=`
   ${unsupportedCount?'<div class="statement-file-warning">'+unsupportedCount+' unsupported '+(unsupportedCount===1?'file was':'files were')+' skipped. Use PDF, Excel or CSV.</div>':''}
   <div class="statement-file-summary">
    <div><strong>${selectedFiles.length} ${selectedFiles.length===1?'statement':'statements'} selected</strong><small>${formatBytes(totalSize)} total</small></div>
    <button id="statement-clear-all" class="text-button" type="button">Clear all</button>
   </div>
   <div class="statement-upload-progress" aria-live="polite">
    <div class="statement-progress-copy">
     <span>${progress.error?'A file could not be prepared':progress.ready?'Files ready':'Preparing files'}</span>
     <strong>${progress.percent}%</strong>
    </div>
    <div class="statement-progress-track" role="progressbar" aria-label="Statement preparation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}">
     <span style="width:${progress.percent}%"></span>
    </div>
   </div>
   <div class="statement-file-list">
    ${selectedFiles.map((file,index)=>{
      const extension=fileExtension(file);
      const state=preparation.get(fileKey(file))||{loaded:0,total:file.size||1,status:'pending'};
      const filePercent=Math.min(100,Math.round(((state.loaded||0)/(file.size||1))*100));
      const stateLabel=state.status==='error'?'Error':state.status==='ready'?'Ready':filePercent+'%';
      return `<div class="statement-file-row">
       <div class="statement-file-info">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
        <span><strong>${escape(file.name)}</strong><small>${escape(extension.toUpperCase())} · ${formatBytes(file.size)} · ${stateLabel}</small></span>
       </div>
       <button class="statement-remove-file" type="button" data-file-index="${index}" aria-label="Remove ${escape(file.name)}" title="Remove file">×</button>
      </div>`;
    }).join('')}
   </div>
   <div class="statement-file-actions">
    <button id="statement-continue" class="button primary statement-continue" type="button" ${progress.ready?'':'disabled'}>${progress.ready?'Continue':'Preparing…'}</button>
   </div>`;
 };

 const prepareFile=file=>{
  const key=fileKey(file);
  preparation.set(key,{loaded:0,total:file.size||1,status:'preparing'});
  const reader=new FileReader();
  reader.onprogress=event=>{
   const state=preparation.get(key);
   if(!state)return;
   state.loaded=event.lengthComputable?event.loaded:Math.min(file.size||1,(state.loaded||0)+Math.max(1,Math.round((file.size||1)*0.08)));
   state.total=event.lengthComputable?event.total:(file.size||1);
   renderSelectedFiles();
  };
  reader.onload=()=>{
   preparation.set(key,{loaded:file.size||1,total:file.size||1,status:'ready'});
   renderSelectedFiles();
  };
  reader.onerror=()=>{
   preparation.set(key,{loaded:0,total:file.size||1,status:'error'});
   renderSelectedFiles();
  };
  reader.onabort=()=>{
   preparation.set(key,{loaded:0,total:file.size||1,status:'error'});
   renderSelectedFiles();
  };
  reader.readAsArrayBuffer(file);
 };

 const addFiles=files=>{
  const incoming=[...files];
  if(!incoming.length)return;
  const invalid=incoming.filter(file=>!supportedExtensions.includes(fileExtension(file)));
  const valid=incoming.filter(file=>supportedExtensions.includes(fileExtension(file)));
  unsupportedCount=invalid.length;
  const existingKeys=new Set(selectedFiles.map(fileKey));
  const added=[];
  for(const file of valid){
   const key=fileKey(file);
   if(!existingKeys.has(key)){
    selectedFiles.push(file);
    existingKeys.add(key);
    added.push(file);
   }
  }
  renderSelectedFiles();
  for(const file of added)prepareFile(file);
 };

 status.addEventListener('click',event=>{
  const remove=event.target.closest('.statement-remove-file');
  if(remove){
   const index=Number(remove.dataset.fileIndex);
   const file=selectedFiles[index];
   if(file)preparation.delete(fileKey(file));
   selectedFiles.splice(index,1);
   renderSelectedFiles();
   return;
  }
  if(event.target.closest('#statement-clear-all')){
   selectedFiles=[];
   preparation.clear();
   unsupportedCount=0;
   renderSelectedFiles();
   return;
  }
  if(event.target.closest('#statement-continue')){
   const progress=overallPreparation();
   if(!progress.ready)return;
   const uploadCard=document.querySelector('.statement-upload-card');
   const nextStep=$('#statement-next-step');
   const summary=$('#statement-next-summary');
   summary.innerHTML=`<strong>${selectedFiles.length} ${selectedFiles.length===1?'statement':'statements'} ready</strong><span>${selectedFiles.map(file=>escape(file.name)).join(' · ')}</span>${source?`<small>Starting calculator: ${escape(source.name)}</small>`:''}`;
   uploadCard.hidden=true;
   nextStep.hidden=false;
   nextStep.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
 });

 $('#statement-back-to-files').addEventListener('click',()=>{
  const uploadCard=document.querySelector('.statement-upload-card');
  const nextStep=$('#statement-next-step');
  nextStep.hidden=true;
  uploadCard.hidden=false;
  uploadCard.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });

 const analysisButton=$('#statement-analyse');
 const analysisProgress=$('#statement-analysis-progress');
 const reviewSection=$('#statement-review');
 const reviewBody=$('#statement-review-body');
 const reviewSummary=$('#statement-document-summary');
 let analysedRows=[];
 const statementCalculators=source?[source]:CALCULATORS;
 const registryForStatement=statementCalculators.map(calc=>({
  id:calc.id,
  name:calc.name,
  group:calc.group,
  fields:calc.fields.filter(field=>field.key&&field.type==='money').map(field=>({key:field.key,label:field.label}))
 }));

 const fileToBase64=file=>new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>{
   const value=String(reader.result||'');
   resolve(value.includes(',')?value.split(',')[1]:value);
  };
  reader.onerror=()=>reject(reader.error||new Error('Could not read file'));
  reader.readAsDataURL(file);
 });

 const mappingOptions=(calculatorId='',fieldKey='')=>{
  const allowedCalculators=source?[source]:CALCULATORS;
  const availableValues=new Set();
  for(const calc of allowedCalculators){
   for(const field of calc.fields.filter(field=>field.key&&field.type==='money')){
    availableValues.add(calc.id+'::'+field.key);
   }
  }
  const requestedValue=calculatorId&&fieldKey?calculatorId+'::'+fieldKey:'';
  const selectedValue=availableValues.has(requestedValue)?requestedValue:'';
  let html='<option value=""'+(!selectedValue?' selected':'')+'>Unmapped / review</option><option value="__exclude__">Ignore / Exclude</option>';
  for(const calc of allowedCalculators){
   const fields=calc.fields.filter(field=>field.key&&field.type==='money');
   if(!fields.length)continue;
   html+='<optgroup label="'+escape(calc.name)+'">';
   for(const field of fields){
    const value=calc.id+'::'+field.key;
    html+='<option value="'+escape(value)+'"'+(value===selectedValue?' selected':'')+'>'+escape(field.label)+'</option>';
   }
   html+='</optgroup>';
  }
  return html;
 };

 const formatStatementAmount=(amount,direction)=>{
  const number=Math.abs(Number(amount)||0);
  const sign=direction==='credit'?'+':direction==='debit'?'−':'';
  return sign+'£'+new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(number);
 };

 const renderStatementReview=data=>{
  const documents=Array.isArray(data.documents)?data.documents:[];
  const allRows=[];
  reviewSummary.innerHTML=documents.map(doc=>{
   const rowCount=Array.isArray(doc.rows)?doc.rows.length:0;
   const warning=(Array.isArray(doc.warnings)&&doc.warnings.length)?'<small>'+doc.warnings.map(item=>escape(item)).join(' · ')+'</small>':'';
   return '<div class="statement-document-card '+(doc.ok?'':'error')+'"><strong>'+escape(doc.name||'Statement')+'</strong><span>'+(doc.ok?(rowCount+' extracted rows'+(doc.documentType?' · '+escape(doc.documentType):'')):'Could not analyse')+'</span>'+warning+'</div>';
  }).join('');
  for(const doc of documents){
   for(const row of (Array.isArray(doc.rows)?doc.rows:[]))allRows.push({...row,source:doc.name||'Statement'});
  }
  analysedRows=allRows;
  reviewBody.innerHTML=allRows.map((row,index)=>`
   <tr data-statement-row data-row-index="${index}" data-excluded="false">
    <td>${escape(row.date||'—')}</td>
    <td><strong>${escape(row.description||'Untitled row')}</strong><small>${escape(row.source||'')}</small>${row.normalizedCategory?'<small class="statement-row-classification">'+escape(row.relevance==='auto_map'?'Relevant · '+row.normalizedCategory:'Needs review · '+row.normalizedCategory)+'</small>':''}${row.reason?'<em>'+escape(row.reason)+'</em>':''}</td>
    <td class="statement-amount">${formatStatementAmount(row.amount,row.direction)}</td>
    <td><span class="statement-type-badge">${escape(row.direction||'neutral')}</span></td>
    <td><select class="statement-map-select" aria-label="Map ${escape(row.description||'statement row')} to UKTaxer field">${mappingOptions(row.suggestedCalculatorId,row.suggestedFieldKey)}</select><small class="statement-confidence">${escape(row.relevance==='auto_map'?'Relevant · '+(row.confidence||'low')+' confidence':'Needs review · '+(row.confidence||'low')+' confidence')}</small></td>
    <td><button class="statement-row-toggle" type="button" aria-label="Exclude ${escape(row.description||'row')}" title="Exclude from calculation">×</button></td>
   </tr>`).join('');
  if(!allRows.length){
   reviewBody.innerHTML='<tr><td colspan="6" class="statement-empty-review">No statement rows were extracted. Check the document summary above.</td></tr>';
  }
  $('#statement-next-step').hidden=true;
  reviewSection.hidden=false;
  reviewSection.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };

 reviewBody.addEventListener('click',event=>{
  const button=event.target.closest('.statement-row-toggle');
  if(!button)return;
  const row=button.closest('[data-statement-row]');
  const excluded=row.dataset.excluded==='true';
  row.dataset.excluded=String(!excluded);
  row.classList.toggle('excluded',!excluded);
  button.textContent=!excluded?'+':'×';
  button.title=!excluded?'Add back to calculation':'Exclude from calculation';
  button.setAttribute('aria-label',!excluded?'Add row back to calculation':'Exclude row from calculation');
  const select=row.querySelector('.statement-map-select');
  if(select)select.disabled=!excluded;
 });

 reviewBody.addEventListener('change',event=>{
  const select=event.target.closest('.statement-map-select');
  if(!select)return;
  const row=select.closest('[data-statement-row]');
  if(select.value==='__exclude__'){
   row.dataset.excluded='true';
   row.classList.add('excluded');
   row.querySelector('.statement-row-toggle').textContent='+';
   select.disabled=true;
  }
 });

 $('#statement-review-back').addEventListener('click',()=>{
  reviewSection.hidden=true;
  $('#statement-next-step').hidden=false;
  $('#statement-next-step').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });

 const calculatorStep=$('#statement-calculator-step');
 const totalsStep=$('#statement-totals-step');
 const suggestedCalculatorBox=$('#statement-suggested-calculators');
 const allCalculatorBox=$('#statement-all-calculator-list');
 const totalsBox=$('#statement-mapped-totals');

 const activeStatementMappings=()=>{
  const mappings=[];
  reviewBody.querySelectorAll('[data-statement-row]').forEach(rowEl=>{
   if(rowEl.dataset.excluded==='true')return;
   const select=rowEl.querySelector('.statement-map-select');
   const value=select?.value||'';
   if(!value||value==='__exclude__'||!value.includes('::'))return;
   const [calculatorId,fieldKey]=value.split('::');
   const sourceRow=analysedRows[Number(rowEl.dataset.rowIndex)];
   if(!sourceRow)return;
   mappings.push({calculatorId,fieldKey,row:sourceRow});
  });
  return mappings;
 };

 const selectedCalculatorIds=()=>new Set(
  [...calculatorStep.querySelectorAll('input[data-statement-calculator]:checked')].map(input=>input.value)
 );

 const calculatorChoice=(calc,checked=false,suggested=false)=>`
  <label class="statement-calculator-choice">
   <input type="checkbox" data-statement-calculator value="${escape(calc.id)}" ${checked?'checked':''}>
   <span><strong>${escape(calc.name)}</strong><small>${escape(calc.group)}${suggested?' · Suggested':''}</small></span>
  </label>`;

 const renderCalculatorStep=()=>{
  const mappedIds=new Set(activeStatementMappings().map(item=>item.calculatorId));
  if(source?.id)mappedIds.add(source.id);
  const suggested=CALCULATORS.filter(calc=>mappedIds.has(calc.id));
  suggestedCalculatorBox.innerHTML=`<h3>Suggested for this statement</h3><div class="statement-calculator-grid">${suggested.length?suggested.map(calc=>calculatorChoice(calc,true,true)).join(''):'<p class="statement-empty-choice">No calculator could be suggested confidently. Choose from all calculators below.</p>'}</div>`;

  const groups=new Map();
  for(const calc of CALCULATORS){
   if(!groups.has(calc.group))groups.set(calc.group,[]);
   groups.get(calc.group).push(calc);
  }
  allCalculatorBox.innerHTML=[...groups].map(([group,calcs])=>`<div class="statement-calculator-group"><h4>${escape(group)}</h4><div class="statement-calculator-grid">${calcs.map(calc=>calculatorChoice(calc,mappedIds.has(calc.id),false)).join('')}</div></div>`).join('');

  calculatorStep.querySelectorAll('input[data-statement-calculator]').forEach(input=>{
   input.addEventListener('change',()=>{
    calculatorStep.querySelectorAll('input[data-statement-calculator]').forEach(other=>{
     if(other!==input&&other.value===input.value)other.checked=input.checked;
    });
   });
  });

  reviewSection.hidden=true;
  calculatorStep.hidden=false;
  calculatorStep.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };

 const buildMappedTotals=()=>{
  const selected=selectedCalculatorIds();
  const totals=new Map();
  let unmapped=0,excluded=0;
  reviewBody.querySelectorAll('[data-statement-row]').forEach(rowEl=>{
   if(rowEl.dataset.excluded==='true'){excluded+=1;return;}
   const select=rowEl.querySelector('.statement-map-select');
   const value=select?.value||'';
   if(!value||value==='__exclude__'||!value.includes('::')){unmapped+=1;return;}
   const [calculatorId,fieldKey]=value.split('::');
   if(!selected.has(calculatorId))return;
   const sourceRow=analysedRows[Number(rowEl.dataset.rowIndex)];
   if(!sourceRow)return;
   const key=calculatorId+'::'+fieldKey;
   const current=totals.get(key)||{calculatorId,fieldKey,total:0,count:0};
   current.total+=Math.abs(Number(sourceRow.amount)||0);
   current.count+=1;
   totals.set(key,current);
  });
  return {totals:[...totals.values()],unmapped,excluded,selected};
 };

 const renderTotalsStep=()=>{
  const result=buildMappedTotals();
  if(!result.selected.size){
   totalsBox.innerHTML='<p class="notice">Choose at least one calculator before continuing.</p>';
   return false;
  }
  const groups=new Map();
  for(const item of result.totals){
   if(!groups.has(item.calculatorId))groups.set(item.calculatorId,[]);
   groups.get(item.calculatorId).push(item);
  }
  const cards=[...groups].map(([calculatorId,items])=>{
   const calc=CALCULATORS.find(item=>item.id===calculatorId);
   return `<section class="statement-total-card"><h3>${escape(calc?.name||calculatorId)}</h3><div class="statement-total-rows">${items.map(item=>{
    const field=calc?.fields.find(field=>field.key===item.fieldKey);
    const compatible=field&&['money','number'].includes(field.type);
    return `<div class="statement-total-row"><span><strong>${escape(field?.label||item.fieldKey)}</strong><small>${item.count} mapped ${item.count===1?'row':'rows'}${compatible?'':' · manual review required'}</small></span><b>£${new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(item.total)}</b></div>`;
   }).join('')}</div></section>`;
  }).join('');
  totalsBox.innerHTML=(cards||'<p class="notice">No active statement rows are mapped to the selected calculators yet.</p>')+`<div class="statement-total-meta"><span>${result.unmapped} unmapped</span><span>${result.excluded} excluded</span></div>`;
  calculatorStep.hidden=true;
  totalsStep.hidden=false;
  totalsStep.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  $('#statement-apply').disabled=false;
  return true;
 };

 $('#statement-review-continue').addEventListener('click',renderCalculatorStep);

 $('#statement-calculator-back').addEventListener('click',()=>{
  calculatorStep.hidden=true;
  reviewSection.hidden=false;
  reviewSection.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });

 $('#statement-calculator-continue').addEventListener('click',()=>{
  if(!selectedCalculatorIds().size){
   calculatorStep.querySelector('.statement-empty-choice')?.remove();
   suggestedCalculatorBox.insertAdjacentHTML('beforeend','<p class="notice">Select at least one calculator to continue.</p>');
   return;
  }
  renderTotalsStep();
 });

 $('#statement-totals-back').addEventListener('click',()=>{
  totalsStep.hidden=true;
  calculatorStep.hidden=false;
  calculatorStep.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });

 $('#statement-apply').addEventListener('click',()=>{
  const result=buildMappedTotals();
  const selectedCalculators=[...result.selected]
   .map(id=>CALCULATORS.find(calc=>calc.id===id))
   .filter(Boolean);

  if(!selectedCalculators.length){
   totalsBox.insertAdjacentHTML('afterbegin','<p class="notice">Select at least one calculator before applying the statement.</p>');
   return;
  }

  // A statement import should never leave example/default monetary values behind.
  // Start each selected calculator from zero, then layer confirmed mapped totals on top.
  for(const calc of selectedCalculators){
   state.inputs[calc.id]=structuredClone(DEFAULTS[calc.id]);
   for(const field of calc.fields){
    if(!field.key)continue;
    if(field.type==='money'){
     state.inputs[calc.id][field.key]='0';
    }else if(field.type==='number'&&Number(field.min??0)<=0){
     state.inputs[calc.id][field.key]='0';
    }else if(field.type==='boolean'){
     state.inputs[calc.id][field.key]=false;
    }
   }
  }

  for(const item of result.totals){
   const calc=CALCULATORS.find(calc=>calc.id===item.calculatorId);
   const field=calc?.fields.find(field=>field.key===item.fieldKey);
   if(!calc||!field||!['money','number'].includes(field.type))continue;
   state.inputs[calc.id][field.key]=String(item.total);
  }

  location.hash='#calculator/'+selectedCalculators[0].id;
 });

 analysisButton.addEventListener('click',async()=>{
  if(!selectedFiles.length)return;
  analysisButton.disabled=true;
  analysisButton.textContent='Analysing…';
  analysisProgress.hidden=false;
  analysisProgress.innerHTML='<div class="statement-analysis-spinner" aria-hidden="true"></div><div><strong>Analysing statements</strong><span>UKTaxer AI is extracting rows and preparing suggested calculator-field mappings.</span></div>';
  try{
   const files=[];
   for(let index=0;index<selectedFiles.length;index++){
    const file=selectedFiles[index];
    analysisProgress.querySelector('span').textContent='Preparing '+(index+1)+' of '+selectedFiles.length+': '+file.name;
    files.push({name:file.name,mimeType:file.type||'',data:await fileToBase64(file)});
   }
   analysisProgress.querySelector('span').textContent='Sending prepared statements to UKTaxer AI…';
   const response=await fetch('/api/statement',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     files,
     sourceCalculator:source?.id||'',
     calculators:registryForStatement
    })
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data.ok)throw new Error(data.error||'Statement analysis failed.');
   renderStatementReview(data);
   analysisProgress.hidden=true;
  }catch(error){
   analysisProgress.hidden=false;
   analysisProgress.classList.add('error');
   analysisProgress.innerHTML='<div><strong>Could not analyse the statements</strong><span>'+escape(error?.message||'Please try again.')+'</span></div>';
  }finally{
   analysisButton.disabled=false;
   analysisButton.textContent='Analyse statements';
  }
 });

 browseButton.addEventListener('click',()=>fileInput.click());
 fileInput.addEventListener('change',()=>{
  addFiles(fileInput.files||[]);
  fileInput.value='';
 });
 dropzone.addEventListener('dragover',event=>{event.preventDefault();dropzone.classList.add('dragging');});
 dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('dragging'));
 dropzone.addEventListener('drop',event=>{
  event.preventDefault();
  dropzone.classList.remove('dragging');
  addFiles(event.dataTransfer?.files||[]);
 });
}

function route(){
 lawToolbarObserver?.disconnect();
 resultVisibilityObserver?.disconnect();
 const hash=location.hash||'#home';
 const [page,target]=hash.slice(1).split('/');
 document.querySelectorAll('[data-nav]').forEach(a=>{
  const active=a.dataset.nav===page;
  a.classList.toggle('active',active);
  if(a.tagName==='A'){if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
 });
 if(page==='import')importView(target);
 else if(page==='coverage')coverageView();
 else if(page==='law')lawView(target);
 else if(page==='sources')sourcesView();
 else if(page==='calculator')calcView(target||'paye');
 else homeView();
 if(page!=='calculator')setSidebarView('main',{focus:false});
 else if(sidebarToggle?.getAttribute('aria-expanded')==='true')setSidebarView('calculators',{focus:false});
 nav();
 if(page!=='law')window.scrollTo({top:0,behavior:'instant'});
}
const sidebarToggle=$('#sidebar-toggle');
const sidebarMainView=$('#sidebar-main-view');
const sidebarCalculatorView=$('#sidebar-calculator-view');
const openCalculatorsButton=$('#open-calculators');
const calculatorSidebarBack=$('#calculator-sidebar-back');
const smallSidebar=window.matchMedia('(max-width:940px)');
const sidebarStorageKey='uktaxer-sidebar-expanded';

function savedDesktopSidebarState(){
 try{return localStorage.getItem(sidebarStorageKey);}catch{return null;}
}
function setSidebarView(view,{focus=false}={}){
 const showCalculators=view==='calculators';
 sidebarMainView.hidden=showCalculators;
 sidebarMainView.inert=showCalculators;
 sidebarMainView.setAttribute('aria-hidden',String(showCalculators));
 sidebarCalculatorView.hidden=!showCalculators;
 sidebarCalculatorView.inert=!showCalculators;
 sidebarCalculatorView.setAttribute('aria-hidden',String(!showCalculators));
 openCalculatorsButton.setAttribute('aria-expanded',String(showCalculators));
 $('#tax-sidebar').classList.toggle('calculator-view-active',showCalculators);
 if(showCalculators){
  nav();
  if(focus)requestAnimationFrame(()=>$('#calculator-search').focus({preventScroll:true}));
 }else if(focus){
  requestAnimationFrame(()=>openCalculatorsButton.focus({preventScroll:true}));
 }
}
function sidebarViewForCurrentRoute(){
 const page=(location.hash||'#home').slice(1).split('/')[0];
 return page==='calculator'?'calculators':'main';
}
function setSidebarExpanded(expanded,{persist=true}={}){
 const sidebar=$('#tax-sidebar');
 // Collapsing must not forget the calculator context. When the sidebar is
 // opened again, derive the appropriate view from the active route.
 if(expanded)setSidebarView(sidebarViewForCurrentRoute(),{focus:false});
 sidebar.hidden=!expanded;
 sidebar.inert=!expanded;
 sidebar.setAttribute('aria-hidden',String(!expanded));
 $('.shell').classList.toggle('sidebar-collapsed',!expanded);
 sidebarToggle.setAttribute('aria-expanded',String(expanded));
 const label=expanded?'Collapse sidebar':'Open sidebar';
 sidebarToggle.setAttribute('aria-label',label);
 sidebarToggle.title=label;
 if(persist&&!smallSidebar.matches){
  try{localStorage.setItem(sidebarStorageKey,String(expanded));}catch{}
 }
}
openCalculatorsButton.addEventListener('click',()=>setSidebarView('calculators',{focus:true}));
calculatorSidebarBack.addEventListener('click',()=>setSidebarView('main',{focus:true}));
sidebarToggle.addEventListener('click',()=>setSidebarExpanded(sidebarToggle.getAttribute('aria-expanded')!=='true'));

setSidebarView('main',{focus:false});
const savedSidebarState=savedDesktopSidebarState();
setSidebarExpanded(smallSidebar.matches?false:savedSidebarState===null||savedSidebarState==='true',{persist:false});
requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add('sidebar-motion-ready')));

smallSidebar.addEventListener('change',event=>{
 const saved=savedDesktopSidebarState();
 setSidebarExpanded(event.matches?false:saved===null||saved==='true',{persist:false});
});
$('#tax-sidebar').addEventListener('click',event=>{
 if(smallSidebar.matches&&event.target.closest('a[href]')){
  setSidebarExpanded(false);
  $('#main').focus({preventScroll:true});
 }
});
document.addEventListener('pointerdown',event=>{
 const sidebar=$('#tax-sidebar');
 if(smallSidebar.matches&&!sidebar.hidden&&!sidebar.contains(event.target)&&!sidebarToggle.contains(event.target)){
  const focusWasInside=sidebar.contains(document.activeElement);
  setSidebarExpanded(false);
  if(focusWasInside)sidebarToggle.focus({preventScroll:true});
 }
});
document.addEventListener('keydown',event=>{
 const sidebar=$('#tax-sidebar');
 if(event.key!=='Escape'||sidebar.hidden)return;
 if(!sidebarCalculatorView.hidden){
  setSidebarView('main',{focus:true});
 }else if(smallSidebar.matches){
  setSidebarExpanded(false);
  sidebarToggle.focus({preventScroll:true});
 }
});

// Keep wheel scrolling inside whichever sidebar view is active.
$('#tax-sidebar').addEventListener('wheel',event=>{
 if(event.ctrlKey||!event.deltaY)return;
 const scroller=sidebarCalculatorView.hidden?$('.sidebar-primary'):$('#calculator-nav');
 if(!scroller)return;
 const unit=event.deltaMode===1?16:event.deltaMode===2?scroller.clientHeight:1;
 scroller.scrollTop+=event.deltaY*unit;
 event.preventDefault();
},{passive:false});

$('#calculator-search').addEventListener('input',nav);
window.addEventListener('hashchange',route);
if(!location.hash)history.replaceState(null,'','#home');
route();

const scrollTopButton=$('#scroll-to-top');
const updateScrollTopButton=()=>{
 const visible=window.scrollY>=300;
 scrollTopButton.hidden=!visible;
 document.body.classList.toggle('scroll-top-visible',visible);
};
window.addEventListener('scroll',updateScrollTopButton,{passive:true});
scrollTopButton.addEventListener('click',()=>{
 $('#main').focus({preventScroll:true});
 window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
});
updateScrollTopButton();

// Recalculate result offsets whenever the active page heading changes or wraps.
let currentPageHeader;
const pageHeaderObserver=new ResizeObserver(()=>{
 if(currentPageHeader)$('#main').style.setProperty('--page-header-height',currentPageHeader.getBoundingClientRect().height+'px');
});
function observePageHeader(){
 pageHeaderObserver.disconnect();
 currentPageHeader=$('#main > .page-header');
 $('#main').style.setProperty('--page-header-height',currentPageHeader?currentPageHeader.getBoundingClientRect().height+'px':'0px');
 if(currentPageHeader)pageHeaderObserver.observe(currentPageHeader);
}
const pageContentObserver=new MutationObserver(observePageHeader);
pageContentObserver.observe($('#main'),{childList:true});
observePageHeader();

// Install UKTaxer as an app and keep the complete calculator available offline.
const installButton=$('#install-app');
const installLabel=installButton?.querySelector('strong');
const installDetail=installButton?.querySelector('small');
const installStatus=$('#install-app-status');
navigator.serviceWorker?.addEventListener('message',event=>{
 const data=event.data||{};
 if(data.type==='CACHE_PROGRESS')setInstallCopy('Install UKTaxer','Downloading offline library '+data.done+'/'+data.total+'…');
 if(data.type==='CACHE_READY'){offlineReady=true;setInstallCopy('Install UKTaxer','Complete offline library ready');}
 if(data.type==='CACHE_ERROR')setInstallCopy('Install UKTaxer','Offline download failed',{status:data.error||'Browser storage could not hold the law library.'});
});
let deferredInstallPrompt=null;
let offlineReady=false;
const updateButton=$('#update-app');
const updateLabel=updateButton?.querySelector('strong');
const updateDetail=updateButton?.querySelector('small');
const updateStatus=$('#update-app-status');
let swRegistration=null;
let updateCheckBusy=false;
let updateReloadPending=false;
const installedMode=()=>{
 const modes=['standalone','fullscreen','minimal-ui','window-controls-overlay'];
 return modes.some(mode=>window.matchMedia('(display-mode: '+mode+')').matches)
  ||navigator.standalone===true
  ||document.referrer.startsWith('android-app://');
};
function syncAppManagementVisibility(){
 const installed=installedMode();
 document.documentElement.classList.toggle('uktaxer-installed-app',installed);
 if(installButton)installButton.hidden=installed;
 if(installStatus&&installed)installStatus.hidden=true;
 if(updateButton)updateButton.hidden=!installed;
 if(updateStatus&&!installed)updateStatus.hidden=true;
 return installed;
}
function setInstallCopy(label,detail,{disabled=false,status=''}={}){
 if(!installButton)return;
 if(label==='UKTaxer installed'){
  installButton.hidden=true;
  if(installStatus)installStatus.hidden=true;
  if(updateButton)updateButton.hidden=false;
  refreshUpdateButton();
  return;
 }
 installButton.hidden=false;
 installLabel.textContent=label;
 installDetail.textContent=detail;
 installButton.disabled=disabled;
 if(status){installStatus.textContent=status;installStatus.hidden=false;}
 else{installStatus.textContent='';installStatus.hidden=true;}
}
function updateInstallButton(){
 if(syncAppManagementVisibility())return;
 setInstallCopy('Install UKTaxer',offlineReady?'Available offline after installation':'Preparing offline access…');
}
function setUpdateCopy(label,detail,{disabled=false,status=''}={}){
 if(!updateButton)return;
 updateLabel.textContent=label;
 updateDetail.textContent=detail;
 updateButton.disabled=disabled;
 if(status){updateStatus.textContent=status;updateStatus.hidden=false;}
 else{updateStatus.textContent='';updateStatus.hidden=true;}
}
function refreshUpdateButton(){
 if(!syncAppManagementVisibility())return;
 if(!('serviceWorker' in navigator)){
  setUpdateCopy('Updates unavailable','This browser does not support app updates',{disabled:true});
  return;
 }
 if(!navigator.onLine){
  setUpdateCopy('Check for updates','Connect to the internet to update');
  return;
 }
 setUpdateCopy('Check for updates',swRegistration?'You are ready to check for a newer version':'Preparing update service…',{disabled:!swRegistration});
}
function watchInstallingWorker(worker){
 if(!worker)return;
 setUpdateCopy('Updating UKTaxer','Downloading the latest version…',{disabled:true});
 worker.addEventListener('statechange',()=>{
  if(worker.state==='installed'&&navigator.serviceWorker.controller){
   updateReloadPending=true;
   setUpdateCopy('Update ready','Applying the latest version…',{disabled:true});
   if(swRegistration?.waiting)swRegistration.waiting.postMessage({type:'SKIP_WAITING'});
  }else if(worker.state==='redundant'){
   setUpdateCopy('Check for updates','Update could not be installed',{status:'Please try again while connected to the internet.'});
  }
 });
}
async function checkForAppUpdate({manual=false}={}){
 if(!installedMode())return;
 if(!('serviceWorker' in navigator))return;
 if(!navigator.onLine){
  setUpdateCopy('Check for updates','Connect to the internet to update',{status:manual?'UKTaxer cannot download an update while you are offline.':''});
  return;
 }
 if(updateCheckBusy)return;
 try{
  updateCheckBusy=true;
  if(!swRegistration)swRegistration=await navigator.serviceWorker.ready;
  let updateFound=false;
  const onUpdateFound=()=>{
   updateFound=true;
   watchInstallingWorker(swRegistration.installing);
  };
  swRegistration.addEventListener('updatefound',onUpdateFound,{once:true});
  setUpdateCopy('Checking for updates','Looking for a newer version…',{disabled:true});
  await swRegistration.update();
  if(swRegistration.waiting){
   updateFound=true;
   updateReloadPending=true;
   setUpdateCopy('Update ready','Applying the latest version…',{disabled:true});
   swRegistration.waiting.postMessage({type:'SKIP_WAITING'});
  }
  await new Promise(resolve=>setTimeout(resolve,700));
  if(!updateFound&&!swRegistration.installing&&!swRegistration.waiting){
   swRegistration.removeEventListener('updatefound',onUpdateFound);
   setUpdateCopy('Check for updates','UKTaxer is up to date',{status:manual?'You already have the latest available version.':''});
  }
 }catch(error){
  console.error('UKTaxer update check failed',error);
  setUpdateCopy('Check for updates','Could not check for updates',{status:'Check your internet connection and try again.'});
 }finally{
  updateCheckBusy=false;
  if(updateButton&&updateButton.disabled&&!updateReloadPending)updateButton.disabled=false;
 }
}
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();
 deferredInstallPrompt=event;
 updateInstallButton();
});
window.addEventListener('appinstalled',()=>{
 deferredInstallPrompt=null;
 syncAppManagementVisibility();
 setInstallCopy('UKTaxer installed','Ready to use offline',{disabled:true,status:'Installation complete. Launch UKTaxer from your device to manage updates.'});
});
const installGuide=document.createElement('div');
installGuide.id='install-guide';
installGuide.className='install-guide';
installGuide.hidden=true;
installGuide.innerHTML='<div class="install-guide-backdrop" data-install-guide-close></div><section class="install-guide-card" role="dialog" aria-modal="true" aria-labelledby="install-guide-title"><button class="install-guide-close" type="button" aria-label="Close install instructions" data-install-guide-close>×</button><div class="install-guide-icon" aria-hidden="true">↓</div><h2 id="install-guide-title">Install UKTaxer</h2><p id="install-guide-copy"></p><ol id="install-guide-steps"></ol><button id="install-guide-done" class="button primary" type="button" data-install-guide-close>Got it</button></section>';
document.body.append(installGuide);
const installGuideCopy=installGuide.querySelector('#install-guide-copy');
const installGuideSteps=installGuide.querySelector('#install-guide-steps');

function installInstructions(){
 const ua=navigator.userAgent;
 const isiOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const isAndroid=/Android/i.test(ua);
 const isMac=/Macintosh|Mac OS X/i.test(ua);
 if(isiOS)return {
  copy:'Your browser does not allow a website to open the iPhone or iPad install sheet directly. Use the browser share menu to install UKTaxer.',
  steps:['Tap the Share button in your browser.','Choose Add to Home Screen.','Tap Add to install UKTaxer.']
 };
 if(isAndroid)return {
  copy:'Your browser has not exposed its native install prompt yet. You can still install UKTaxer from the browser menu.',
  steps:['Open the browser menu (usually ⋮).','Choose Install app or Add to Home screen.','Confirm the installation.']
 };
 if(isMac)return {
  copy:'Your browser has not exposed a native install prompt. Use its app-install option if available.',
  steps:['Open the browser menu or File menu.','Choose Install UKTaxer, Install app, or Add to Dock.','Confirm the installation.']
 };
 return {
  copy:'Your browser has not exposed a native install prompt. Use its browser menu to install UKTaxer if PWA installation is supported.',
  steps:['Open the browser menu.','Choose Install app, Install page as app, or Add to Home screen.','Confirm the installation.']
 };
}

function showInstallGuide(){
 const info=installInstructions();
 installGuideCopy.textContent=info.copy;
 installGuideSteps.innerHTML='';
 for(const step of info.steps){
  const li=document.createElement('li');
  li.textContent=step;
  installGuideSteps.append(li);
 }
 installGuide.hidden=false;
 document.body.classList.add('install-guide-open');
 installGuide.querySelector('.install-guide-close')?.focus();
}
function hideInstallGuide(){
 installGuide.hidden=true;
 document.body.classList.remove('install-guide-open');
 installButton?.focus({preventScroll:true});
}
installGuide.addEventListener('click',event=>{
 if(event.target.closest('[data-install-guide-close]'))hideInstallGuide();
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!installGuide.hidden)hideInstallGuide();
});

installButton?.addEventListener('click',async()=>{
 if(deferredInstallPrompt){
  const prompt=deferredInstallPrompt;
  deferredInstallPrompt=null;
  await prompt.prompt();
  const choice=await prompt.userChoice;
  if(choice.outcome==='dismissed')setInstallCopy('Install UKTaxer',offlineReady?'Available offline after installation':'Preparing offline access…',{status:'Installation was cancelled. You can try again.'});
  return;
 }
 showInstallGuide();
});
updateInstallButton();
syncAppManagementVisibility();

updateButton?.addEventListener('click',()=>checkForAppUpdate({manual:true}));
window.addEventListener('online',()=>{
 refreshUpdateButton();
 if(swRegistration&&installedMode())setTimeout(()=>checkForAppUpdate(),500);
});
window.addEventListener('offline',refreshUpdateButton);
window.addEventListener('pageshow',()=>{
 syncAppManagementVisibility();
 refreshUpdateButton();
});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'){
  syncAppManagementVisibility();
  refreshUpdateButton();
 }
});
for(const mode of ['standalone','fullscreen','minimal-ui','window-controls-overlay']){
 const query=window.matchMedia('(display-mode: '+mode+')');
 query.addEventListener?.('change',()=>{
  syncAppManagementVisibility();
  refreshUpdateButton();
 });
}

if('serviceWorker' in navigator){
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!updateReloadPending)return;
  updateReloadPending=false;
  setUpdateCopy('Updated','Reloading UKTaxer…',{disabled:true});
  setTimeout(()=>location.reload(),350);
 });
 window.addEventListener('load',async()=>{
  try{
   swRegistration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
   swRegistration.addEventListener('updatefound',()=>watchInstallingWorker(swRegistration.installing));
   await navigator.serviceWorker.ready;
   offlineReady=true;
   updateInstallButton();
   refreshUpdateButton();
   if(navigator.onLine&&installedMode())setTimeout(()=>checkForAppUpdate(),1200);
  }catch(error){
   console.error('Offline setup failed',error);
   setInstallCopy('Install UKTaxer','Offline setup needs an online reload',{status:'Reconnect to the internet and reload once to finish offline setup.'});
   setUpdateCopy('Check for updates','Update service needs an online reload',{status:'Reconnect to the internet and reload once to enable app updates.'});
  }
 },{once:true});
}else{
 setInstallCopy('Install UKTaxer','Use your browser installation menu',{status:'This browser does not provide offline web-app installation.'});
 refreshUpdateButton();
}
