import {CALCULATORS,SOURCE_LINKS} from './calculators.js';

const escapeText=value=>String(value??'').replace(/\s+/g,' ').trim();
const aiState={mode:'route',history:[],law:null,open:false,busy:false};

document.body.insertAdjacentHTML('beforeend',
  '<button id="uktaxer-ai-launcher" class="uktaxer-ai-launcher" type="button" aria-controls="uktaxer-ai-panel" aria-expanded="false">'+
    '<span class="uktaxer-ai-spark" aria-hidden="true">✦</span><span>Ask UKTaxer AI</span>'+
  '</button>'+
  '<section id="uktaxer-ai-panel" class="uktaxer-ai-panel" role="dialog" aria-label="UKTaxer AI" aria-modal="false" hidden>'+
    '<header class="uktaxer-ai-header">'+
      '<div><span class="uktaxer-ai-kicker">UKTaxer AI</span><h2>UKTaxer AI <span aria-hidden="true">✦</span></h2></div>'+
      '<div class="uktaxer-ai-header-actions">'+
        '<button id="uktaxer-ai-clear" class="uktaxer-ai-header-button" type="button" aria-label="Clear chat" title="Clear chat"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></button>'+
        '<button id="uktaxer-ai-close" class="uktaxer-ai-close" type="button" aria-label="Close UKTaxer AI">×</button>'+
      '</div>'+
    '</header>'+
    '<div class="uktaxer-ai-modes" role="group" aria-label="AI task">'+
      '<button type="button" data-ai-mode="route">Find my calculator</button>'+
      '<button type="button" data-ai-mode="law">Ask the tax law</button>'+
      '<button type="button" data-ai-mode="explain">Explain my result</button>'+
    '</div>'+
    '<div id="uktaxer-ai-messages" class="uktaxer-ai-messages" aria-live="polite"></div>'+
    '<form id="uktaxer-ai-form" class="uktaxer-ai-form">'+
      '<label for="uktaxer-ai-input">Ask UKTaxer AI</label>'+
      '<div class="uktaxer-ai-input-row">'+
        '<textarea id="uktaxer-ai-input" rows="2" maxlength="2500" placeholder="Describe your tax situation…"></textarea>'+
        '<button id="uktaxer-ai-send" type="submit" aria-label="Send to UKTaxer AI">➜</button>'+
      '</div>'+
    '</form>'+
    '<p class="uktaxer-ai-privacy">Questions sent through UKTaxer AI are processed online. Core calculations stay local unless you choose <strong>Explain my result</strong>, which sends the displayed calculation context. Do not enter names, tax IDs, bank details or other unnecessary identifiers.</p>'+
  '</section>'
);

const launcher=document.querySelector('#uktaxer-ai-launcher');
const panel=document.querySelector('#uktaxer-ai-panel');
const clearButton=document.querySelector('#uktaxer-ai-clear');
const closeButton=document.querySelector('#uktaxer-ai-close');
const messages=document.querySelector('#uktaxer-ai-messages');
const form=document.querySelector('#uktaxer-ai-form');
const input=document.querySelector('#uktaxer-ai-input');
const sendButton=document.querySelector('#uktaxer-ai-send');
const modeButtons=[...document.querySelectorAll('[data-ai-mode]')];

function pageMode(){
  if(location.hash.startsWith('#calculator/'))return 'explain';
  if(location.hash.startsWith('#law'))return 'law';
  return 'route';
}

function modeCopy(mode){
  if(mode==='law')return {
    placeholder:'Ask about a section, tax rule or phrase…',
    greeting:'Ask a question about the UK legislation. I will answer from the law excerpts UKTaxer retrieves and link you back to the relevant sections.'
  };
  if(mode==='explain')return {
    placeholder:'Ask about the result shown on this calculator…',
    greeting:'I can explain the current UKTaxer result in plain language. I will use the displayed deterministic result rather than calculate a new amount.'
  };
  return {
    placeholder:'Describe your situation and I will point you to the relevant UKTaxer calculator…',
    greeting:'Not sure which calculator to use? Describe your income, business or transaction in ordinary language and I will point you to the relevant UKTaxer calculators.'
  };
}

function setMode(mode,{resetGreeting=false}={}){
  aiState.mode=mode;
  for(const button of modeButtons){
    const active=button.dataset.aiMode===mode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  input.placeholder=modeCopy(mode).placeholder;
  if(resetGreeting||!messages.children.length)showGreeting();
}

function showGreeting(){
  messages.innerHTML='';
  addAssistant({answer:modeCopy(aiState.mode).greeting,calculators:[],sources:[],cautions:[]});
}

function openPanel(mode){
  if(mode)setMode(mode);
  panel.hidden=false;
  aiState.open=true;
  launcher.setAttribute('aria-expanded','true');
  document.body.classList.add('uktaxer-ai-open');
  if(!messages.children.length)showGreeting();
  setTimeout(()=>input.focus(),0);
}

function closePanel(){
  panel.hidden=true;
  aiState.open=false;
  launcher.setAttribute('aria-expanded','false');
  document.body.classList.remove('uktaxer-ai-open');
  launcher.focus({preventScroll:true});
}

function addUser(text){
  const article=document.createElement('article');
  article.className='uktaxer-ai-message user';
  const p=document.createElement('p');
  p.textContent=text;
  article.append(p);
  messages.append(article);
  messages.scrollTop=messages.scrollHeight;
}

function sourceHref(item){return item.url||'#law/'+String(item.id||'');}
function legalReferencePillLabel(item){return String(item.label||item.id||'Official source');}

function addAssistant(payload,{loading=false,error=false,showReferences=false}={}){
  const article=document.createElement('article');
  article.className='uktaxer-ai-message assistant'+(loading?' loading':'')+(error?' error':'');
  if(loading){
    article.innerHTML='<div class="uktaxer-ai-thinking"><span></span><span></span><span></span></div><p>UKTaxer AI is working…</p>';
    messages.append(article);
    messages.scrollTop=messages.scrollHeight;
    return article;
  }

  const p=document.createElement('p');
  p.textContent=payload.answer||'I could not produce a useful answer.';
  article.append(p);

  if(Array.isArray(payload.calculators)&&payload.calculators.length){
    const group=document.createElement('div');
    group.className='uktaxer-ai-links';
    for(const item of payload.calculators){
      const calc=CALCULATORS.find(entry=>entry.id===item.id);
      if(!calc)continue;
      const link=document.createElement('a');
      link.href='#calculator/'+calc.id;
      const strong=document.createElement('strong');
      strong.textContent=calc.name+' →';
      const small=document.createElement('small');
      small.textContent=item.reason||calc.description;
      link.append(strong,small);
      group.append(link);
    }
    if(group.children.length)article.append(group);
  }

  if(showReferences){
    const fallback=Array.isArray(payload.sources)?payload.sources:[];
    const sectionItems=fallback;
    const scheduleItems=[];
    const references=[...sectionItems,...scheduleItems];
    const unique=[];
    const seen=new Set();
    for(const item of references){
      const id=String(item?.id||'');
      if(!id||seen.has(id))continue;
      seen.add(id);
      unique.push(item);
    }
    if(unique.length){
      const sources=document.createElement('div');
      sources.className='uktaxer-ai-sources uktaxer-ai-legal-pills';
      const label=document.createElement('strong');
      label.textContent='Legal references';
      sources.append(label);
      for(const item of unique){
        const link=document.createElement('a');
        link.href=sourceHref(item);
        link.textContent=legalReferencePillLabel(item);
        sources.append(link);
      }
      article.append(sources);
    }
  }

  if(Array.isArray(payload.cautions)&&payload.cautions.length){
    const list=document.createElement('ul');
    list.className='uktaxer-ai-cautions';
    for(const caution of payload.cautions){
      const li=document.createElement('li');
      li.textContent=caution;
      list.append(li);
    }
    article.append(list);
  }

  messages.append(article);
  messages.scrollTop=messages.scrollHeight;
  return article;
}

function currentCalculator(){
  const match=location.hash.match(/^#calculator\/([^/]+)/);
  return match?CALCULATORS.find(item=>item.id===match[1])||null:null;
}

function readableInputValue(field,control){
  if(control.type==='checkbox')return control.checked?'Yes':'';
  if(control.tagName==='SELECT')return escapeText(control.selectedOptions[0]?.textContent||control.value);
  const raw=escapeText(control.value);
  if(!raw)return '';
  if(field.type==='money'){
    const numeric=Number(raw.replace(/,/g,''));
    if(Number.isFinite(numeric))return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:2,maximumFractionDigits:2}).format(numeric);
  }
  return raw;
}

function extractInputs(calc){
  const formElement=document.querySelector('#tax-form');
  if(!formElement||!calc)return {text:'',items:[]};
  const items=[];
  for(const field of calc.fields){
    if(!field.key||field.type==='divider')continue;
    const control=formElement.elements.namedItem(field.key);
    if(!control)continue;
    const value=readableInputValue(field,control);
    if(!value)continue;
    if((field.type==='money'||field.type==='number')&&Number(String(control.value).replace(/,/g,''))===0)continue;
    items.push({key:field.key,label:field.label,value});
  }
  const selected=items.slice(0,14);
  return {
    items:selected,
    text:selected.map(item=>item.label+': '+item.value).join('\n').slice(0,5000)
  };
}

function calculatorContext(){
  const calc=currentCalculator();
  const inputContext=extractInputs(calc);
  const result=escapeText(document.querySelector('#result')?.innerText||'');
  const breakdown=escapeText(document.querySelector('#breakdown')?.innerText||'');
  const details=escapeText(document.querySelector('#detail-content')?.innerText||'').slice(0,4000);
  const sectionIds=calc?.sources?.map(id=>SOURCE_LINKS[id]?.url).filter(Boolean)||[];
  const scheduleIds=[];
  const sourceIds=[...sectionIds,...scheduleIds];
  return {
    calculator:calc?calc.name+' — '+calc.description:'',
    inputs:inputContext.text,
    inputItems:inputContext.items,
    result,
    breakdown,
    details,
    sources:(calc?.sources||[]).map(id=>SOURCE_LINKS[id]?.url).filter(Boolean),
    sourceIds
  };
}

function currentLawContext(){
  const rawTarget=(location.hash.match(/^#law\/(.+)$/)||[])[1]||'';
  const item=(rawTarget&&document.getElementById('law-'+rawTarget))||document.querySelector('.law-item[open]');
  const target=rawTarget?(rawTarget.startsWith('schedule-')?rawTarget:'section-'+rawTarget):'';
  if(!item)return {target,title:'',excerpt:''};
  const number=escapeText(item.querySelector('.section-no')?.textContent||'');
  const title=escapeText(item.querySelector('.law-section-title')?.textContent||'');
  const excerpt=escapeText(item.querySelector('.law-body,pre')?.innerText||'').slice(0,3000);
  return {target,title:[number,title].filter(Boolean).join(' — '),excerpt};
}

function currentPageContext(){
  const main=document.querySelector('#main');
  const hash=location.hash||'#home';
  const page=hash.slice(1).split('/')[0]||'home';
  const calculator=currentCalculator();
  const law=currentLawContext();
  return {
    page,
    hash,
    heading:escapeText(main?.querySelector('h1')?.textContent||''),
    eyebrow:escapeText(main?.querySelector('.eyebrow')?.textContent||''),
    summary:escapeText(main?.querySelector('.lead')?.textContent||'').slice(0,1200),
    activeTab:escapeText(main?.querySelector('[data-tab].active')?.textContent||''),
    calculator:calculator?calculator.name:'',
    lawTarget:law.target,
    lawTitle:law.title,
    lawExcerpt:law.excerpt
  };
}

const STOP_WORDS=new Set(['the','and','for','with','that','this','from','what','when','where','which','will','would','your','about','into','does','are','was','were','how','can','tax','taxes','uk','british','under','have','has']);

function queryTokens(question){
  return [...new Set(
    String(question).toLowerCase()
      .replace(/[^a-z0-9]+/g,' ')
      .split(/\s+/)
      .filter(token=>token.length>2&&!STOP_WORDS.has(token))
  )].slice(0,12);
}

async function loadLaw(){
 if(aiState.law)return aiState.law;
 const response=await fetch('law/manifest.json');if(!response.ok)throw new Error('The UKTaxer law library could not load.');
 const manifest=await response.json();
 const batches=await Promise.all(manifest.documents.map(async doc=>{const result=await fetch(doc.index);if(!result.ok)throw new Error('Could not load '+doc.title);const entries=await result.json();return entries.map((entry,index)=>({id:doc.id.replaceAll('/','-')+'-'+index,label:doc.title+' — '+entry.heading,title:entry.heading,text:entry.text,url:entry.url}));}));
 aiState.law=batches.flat();return aiState.law;
}
function countHits(text,token){let count=0,index=0;while((index=text.indexOf(token,index))!==-1&&count<8){count++;index+=token.length;}return count;}
async function retrieveLaw(question){
 const entries=await loadLaw(),tokens=queryTokens(question);
 return entries.map(entry=>({...entry,score:tokens.reduce((sum,token)=>sum+countHits(entry.title.toLowerCase(),token)*8+countHits(entry.text.toLowerCase(),token),0)})).filter(entry=>entry.score>0).sort((a,b)=>b.score-a.score).slice(0,5).map(entry=>({id:entry.id,label:entry.label,text:entry.text.slice(0,4500),url:entry.url}));
}

function registry(){
  return CALCULATORS.map(item=>({
    id:item.id,
    name:item.name,
    group:item.group,
    description:item.description,
    sources:[...(item.sources||[])],
    schedules:[]
  }));
}

function historyForRequest(){
  return aiState.history.slice(-4).map(item=>({role:item.role,text:item.text.slice(0,900)}));
}

async function buildRequest(question){
  const pageContext=currentPageContext();
  const base={mode:aiState.mode,question,history:historyForRequest(),pageContext};
  if(aiState.mode==='route')return {...base,calculators:registry()};
  if(aiState.mode==='explain')return {...base,context:calculatorContext()};
  return {...base,sources:await retrieveLaw(question,pageContext)};
}

async function ask(question,{silentUser=false,displayText=''}={}){
  if(aiState.busy)return;
  if(!navigator.onLine){
    addAssistant({answer:'UKTaxer AI needs an internet connection. The calculators and tax-law reference remain available offline.'},{error:true});
    return;
  }

  const clean=String(question||'').trim();
  if(aiState.mode!=='explain'&&!clean)return;
  const actual=clean||(aiState.mode==='explain'?'Explain this result in plain language.':'');
  if(!silentUser)addUser(displayText||actual);
  aiState.history.push({role:'user',text:actual});
  const loading=addAssistant({}, {loading:true});
  aiState.busy=true;
  sendButton.disabled=true;

  try{
    const body=await buildRequest(actual);
    const response=await fetch('/api/gemini',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>({}));
    loading.remove();
    if(!response.ok||!data.ok)throw new Error(data.error||'UKTaxer AI could not complete this request.');
    addAssistant(data,{showReferences:true});
    aiState.history.push({role:'assistant',text:data.answer||''});
  }catch(error){
    loading.remove();
    addAssistant({answer:error.message||'UKTaxer AI could not complete this request.'},{error:true});
  }finally{
    aiState.busy=false;
    sendButton.disabled=false;
    input.focus();
  }
}

function explainCurrentResult(){
  const calc=currentCalculator();
  if(!calc){
    openPanel('route');
    addAssistant({answer:'Open a calculator first, enter your figures and then choose Explain my result.'});
    return;
  }
  openPanel('explain');
  ask(
    'Explain this result using the values currently filled in this calculator. Mention the main entries that drove the result and how they affected the calculation, without recalculating a different amount.',
    {silentUser:false,displayText:'Explain this result'}
  );
}

function enhancePage(){
  const calc=currentCalculator();
  const resultCard=document.querySelector('.result-card');
  if(calc&&resultCard&&resultCard.querySelector('.result-total')&&!resultCard.querySelector('.uktaxer-ai-inline')){
    const button=document.createElement('button');
    button.type='button';
    button.className='uktaxer-ai-inline';
    button.innerHTML='<span aria-hidden="true">✦</span> Explain this result with UKTaxer AI';
    button.addEventListener('click',explainCurrentResult);
    resultCard.append(button);
  }

  if((location.hash==='#home'||!location.hash)&&!document.querySelector('.uktaxer-ai-home-card')){
    const anchor=document.querySelector('.home-reference-links');
    if(anchor){
      const card=document.createElement('button');
      card.type='button';
      card.className='uktaxer-ai-home-card';
      card.innerHTML='<span class="uktaxer-ai-home-icon" aria-hidden="true">✦</span><span><strong>Not sure which calculator you need?</strong><small>Describe your situation to UKTaxer AI and it will guide you to the relevant calculator.</small></span><span aria-hidden="true">→</span>';
      card.addEventListener('click',()=>openPanel('route'));
      anchor.insertAdjacentElement('afterend',card);
    }
  }
}

launcher.addEventListener('click',()=>aiState.open?closePanel():openPanel(pageMode()));
clearButton.addEventListener('click',()=>{
  aiState.history=[];
  input.value='';
  showGreeting();
  input.focus();
});
closeButton.addEventListener('click',closePanel);
modeButtons.forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.aiMode,{resetGreeting:true})));

form.addEventListener('submit',event=>{
  event.preventDefault();
  const question=input.value.trim();
  if(!question&&aiState.mode!=='explain')return;
  input.value='';
  ask(question);
});

input.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey){
    event.preventDefault();
    form.requestSubmit();
  }
});

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&aiState.open)closePanel();
});

window.addEventListener('hashchange',()=>{
  if(!aiState.open)setMode(pageMode(),{resetGreeting:true});
  setTimeout(enhancePage,0);
});

const observer=new MutationObserver(enhancePage);
observer.observe(document.querySelector('#main'),{childList:true,subtree:true});
setMode(pageMode(),{resetGreeting:true});
enhancePage();
