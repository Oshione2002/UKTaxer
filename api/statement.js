const MODELS=[process.env.GEMINI_MODEL||'gemini-3.5-flash-lite'];
const RETRYABLE=new Set([429,500,502,503,504]);
const MAX_FILES=5;
const MAX_FILE_BYTES=5*1024*1024;

const STATEMENT_PROFILES=new Proxy({}, {get:()=>({
  purpose:'Populate only the selected UK tax calculator fields from clear documentary evidence.',
  keep:'Explicit income, sale proceeds, acquisition costs, deductible costs, VAT, verified tax amounts or other monetary facts matching a supplied field.',
  review:'Ambiguous transfers, expenses, capital movements, liabilities or tax status that the statement alone cannot establish.',
  ignore:'Own-account transfers, loans, gifts, refunds and unrelated personal spending.'
})});

const NORMALIZATION_RULES=[
  'BANK / STATEMENT NORMALIZATION:',
  '- Statements differ across banks, fintechs, wallets, cards and accounting exports. Never rely on one provider wording or column names.',
  '- First normalize each monetary line semantically into date, original description, absolute amount, direction (credit/debit/neutral), normalizedCategory, and a concise privacy-safe interpretation.',
  '- Recognize equivalent wording across providers. For example transfer in, credit transfer, received from and inflow can all be incoming transfers; card purchase and direct debit can both be outgoing payments; savings transfer can be internal savings movements.',
  '- Use direction, narration, merchant or counterparty clues, nearby matching rows and repeated patterns together. Do not classify from a keyword alone.',
  '- Internal savings movements and likely own-account transfers are not income or expenses merely because money moved.',
  '- Do not expose names, account numbers, phone numbers, National Insurance numbers, tax references, addresses or full transaction references unless absolutely necessary. Generalize counterparties when possible.'
].join('\n');

function send(res,status,payload){
  res.status(status);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.json(payload);
}
function sameOrigin(req){
  const origin=String(req.headers.origin||'');
  if(!origin)return true;
  const proto=String(req.headers['x-forwarded-proto']||'https');
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'');
  return origin===`${proto}://${host}`;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function candidateText(data){
  return data?.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('').trim()||'';
}

const schema={
  type:'object',
  properties:{
    documentType:{type:'string'},
    period:{type:'string'},
    truncated:{type:'boolean'},
    warnings:{type:'array',maxItems:6,items:{type:'string'}},
    rows:{
      type:'array',
      maxItems:200,
      items:{
        type:'object',
        properties:{
          date:{type:'string'},
          description:{type:'string'},
          amount:{type:'number'},
          direction:{type:'string',enum:['credit','debit','neutral']},
          normalizedCategory:{type:'string'},
          relevance:{type:'string',enum:['auto_map','review','ignore']},
          suggestedCalculatorId:{type:'string'},
          suggestedFieldKey:{type:'string'},
          confidence:{type:'string',enum:['high','medium','low']},
          reason:{type:'string'}
        },
        required:['date','description','amount','direction','normalizedCategory','relevance','suggestedCalculatorId','suggestedFieldKey','confidence','reason']
      }
    }
  },
  required:['documentType','period','truncated','warnings','rows']
};

function cleanRegistry(value){
  if(!Array.isArray(value))return [];
  return value.slice(0,40).map(calc=>({
    id:String(calc.id||'').slice(0,80),
    name:String(calc.name||'').slice(0,160),
    group:String(calc.group||'').slice(0,100),
    fields:(Array.isArray(calc.fields)?calc.fields:[]).slice(0,30).map(field=>({
      key:String(field.key||'').slice(0,80),
      label:String(field.label||'').slice(0,180)
    })).filter(field=>field.key&&field.label)
  })).filter(calc=>calc.id&&calc.name);
}

function promptFor(file,registry,sourceCalculator){
  const selectedProfile=sourceCalculator?STATEMENT_PROFILES[sourceCalculator]:null;
  const registryText=registry.map(calc=>'- '+calc.id+': '+calc.name+' ['+calc.group+']\n'+calc.fields.map(field=>'  - '+field.key+': '+field.label).join('\n')).join('\n');
  const profileList=registry.map(calc=>STATEMENT_PROFILES[calc.id]?'- '+calc.id+': '+STATEMENT_PROFILES[calc.id].purpose:'').filter(Boolean).join('\n');
  const calculatorPolicy=selectedProfile
    ?[
      'SELECTED CALCULATOR POLICY ('+sourceCalculator+'): ',
      'Purpose: '+selectedProfile.purpose,
      'Keep / auto-map candidates: '+selectedProfile.keep,
      'Needs-review candidates: '+selectedProfile.review,
      'Ignore for this calculator: '+selectedProfile.ignore,
      '',
      'Because a calculator is already selected, RETURN ONLY rows classified as auto_map or review for this calculator. Do not return ignore rows.'
     ].join('\n')
    :[
      'NO CALCULATOR IS PRESELECTED.',
      'Classify each row against the available calculator purposes below. Keep a row only if it is plausibly useful to at least one available UKTaxer calculator; otherwise omit it from rows.',
      profileList
     ].join('\n');

  return [
    'You are UKTaxer AI statement interpretation layer for a UK tax planning application.',
    '',
    'DOCUMENT NAME:',
    String(file.name||''),
    '',
    NORMALIZATION_RULES,
    '',
    'AVAILABLE UKTAXER CALCULATORS AND FIELDS:',
    registryText,
    '',
    calculatorPolicy,
    '',
    'CALCULATOR-AWARE CLASSIFICATION:',
    '1. Read and normalize the document regardless of the bank or provider format.',
    '2. Transaction relevance depends on the selected calculator. Personal spending is normally irrelevant to PAYE but can sometimes contain a business expense requiring review. Apply the selected calculator policy, not a universal blacklist.',
    '3. auto_map means the statement evidence is clear enough to suggest one exact field from the supplied registry. Use auto_map conservatively.',
    '4. review means the row could materially affect the selected calculator but the statement alone does not establish its tax character, business purpose, exemption, deductibility or exact field with high confidence.',
    '5. ignore means the row does not help populate the selected calculator. When a calculator is selected, OMIT ignore rows from the returned rows array entirely.',
    '6. Never force an incoming transfer into income or an outgoing transfer into an expense. Loans, gifts, refunds, reimbursements, savings movements and own-account transfers must not be treated as taxable or deductible without evidence.',
    '7. Map only to calculator IDs and field keys supplied above. If a relevant row cannot be safely mapped, leave suggestedCalculatorId and suggestedFieldKey empty and set relevance=review.',
    '8. Non-transactional or legal-status fields such as residency, exemptions, taxpayer type, recovery percentages, eligibility flags or asset classifications generally cannot be established from a bank statement. Do not infer them merely from account activity.',
    '9. Preserve document order for retained rows.',
    '10. If output limits prevent retaining every relevant row, set truncated=true and explain this in warnings.',
    '11. Do not return page headers, balances carried forward, totals that duplicate underlying rows, account-identification lines or other layout noise.',
    '',
    'Return structured JSON only.'
  ].join('\n');
}

function interactionText(data){
  const steps=Array.isArray(data?.steps)?data.steps:[];
  for(let i=steps.length-1;i>=0;i--){
    const step=steps[i];
    if(step?.type!=='model_output')continue;
    const content=Array.isArray(step.content)?step.content:[];
    const text=content.filter(item=>item?.type==='text').map(item=>item.text||'').join('').trim();
    if(text)return text;
  }
  return '';
}

function stripJsonFence(text){
  const value=String(text||'').trim();
  if(value.startsWith('~~~')||value.startsWith('```')){
    return value.replace(/^(?:~~~|```)(?:json)?\s*/i,'').replace(/(?:~~~|```)\s*$/,'').trim();
  }
  return value;
}

function generateContentText(data){
  return data?.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('').trim()||'';
}

async function callInteractions(model,input){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-goog-api-key':process.env.GEMINI_API_KEY
    },
    body:JSON.stringify({model,input,store:false})
  });
  const data=await response.json().catch(()=>({}));
  if(response.ok){
    const text=interactionText(data);
    if(text)return {text,model,transport:'interactions'};
    throw {status:502,data:{error:{message:'UKTaxer AI returned an empty statement response.'}}};
  }
  throw {status:response.status,data};
}

async function callGenerateContent(model,file,prompt){
  const ext=String(file.name||'').split('.').pop()?.toLowerCase();
  const mime=String(file.mimeType||'');
  let parts;
  if(ext==='pdf'||mime==='application/pdf'){
    parts=[
      {inline_data:{mime_type:'application/pdf',data:String(file.data||'')}},
      {text:prompt}
    ];
  }else{
    let text='';
    try{text=Buffer.from(String(file.data||''),'base64').toString('utf8');}catch{}
    parts=[{text:`${prompt}\n\nCSV CONTENT:\n${text.slice(0,900000)}`}];
  }

  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-goog-api-key':process.env.GEMINI_API_KEY
    },
    body:JSON.stringify({
      contents:[{role:'user',parts}],
      generationConfig:{temperature:0.05,maxOutputTokens:8192},
      store:false
    })
  });
  const data=await response.json().catch(()=>({}));
  if(response.ok){
    const text=generateContentText(data);
    if(text)return {text,model,transport:'generateContent'};
    throw {status:502,data:{error:{message:'UKTaxer AI returned an empty statement response.'}}};
  }
  throw {status:response.status,data};
}

async function callModel(file,registry,sourceCalculator){
  const prompt=promptFor(file,registry,sourceCalculator)+`
10. Return ONLY valid JSON matching this exact top-level shape:
{"documentType":"string","period":"string","truncated":false,"warnings":["string"],"rows":[{"date":"string","description":"string","amount":0,"direction":"credit|debit|neutral","normalizedCategory":"string","relevance":"auto_map|review|ignore","suggestedCalculatorId":"string","suggestedFieldKey":"string","confidence":"high|medium|low","reason":"string"}]}`;
  const ext=String(file.name||'').split('.').pop()?.toLowerCase();
  const mime=String(file.mimeType||'');

  if(!['pdf','csv','xlsx'].includes(ext)&&mime!=='application/pdf'&&mime!=='text/csv'){
    return {unsupported:true,error:'Use PDF, CSV or XLSX for statement analysis.'};
  }
  let prepared=file;
  if(ext==='xlsx'){
    try{
      const {default:readXlsxFile,readSheetNames}=await import('read-excel-file/node');
      const bytes=Buffer.from(String(file.data||''),'base64');
      const lines=[];let totalCharacters=0;
      for(const name of (await readSheetNames(bytes)).slice(0,10)){
        lines.push('WORKSHEET: '+name);
        const rows=await readXlsxFile(bytes,{sheet:name});
        for(const row of rows.slice(0,5000)){
          if(totalCharacters>850000)break;
          const line=row.map(value=>{
            const text=String(value??'');
            return '"'+text.replaceAll('"','""')+'"';
          }).join(',');
          lines.push(line);totalCharacters+=line.length;
        }
      }
      prepared={...file,name:String(file.name||'statement')+'.csv',mimeType:'text/csv',data:Buffer.from(lines.join('\n')).toString('base64')};
    }catch{return {unsupported:true,error:'The XLSX workbook could not be read. Export it as CSV and try again.'};}
  }

  let interactionInput;
  if(ext==='pdf'||mime==='application/pdf'){
    interactionInput=[
      {type:'document',data:String(file.data||''),mime_type:'application/pdf'},
      {type:'text',text:prompt}
    ];
  }else{
    let text='';
    try{text=Buffer.from(String(prepared.data||''),'base64').toString('utf8');}catch{}
    interactionInput=[{type:'text',text:`${prompt}\n\nCSV CONTENT:\n${text.slice(0,900000)}`}];
  }

  let lastError;
  for(const model of MODELS){
    for(let attempt=0;attempt<2;attempt++){
      if(attempt)await sleep(400);
      try{
        const result=await callInteractions(model,interactionInput);
        return {...result,text:stripJsonFence(result.text)};
      }catch(error){
        lastError=error;
        if(!RETRYABLE.has(Number(error?.status))&&Number(error?.status)!==400)break;
      }
    }

    // Compatibility fallback: use the legacy generateContent endpoint with the
    // documented REST inline_data / mime_type field names for PDF input.
    try{
      const result=await callGenerateContent(model,prepared,prompt);
      return {...result,text:stripJsonFence(result.text)};
    }catch(error){
      lastError=error;
      if(!RETRYABLE.has(Number(error?.status))&&Number(error?.status)!==400)continue;
    }
  }
  throw lastError||{status:502,data:{}};
}

export default async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return send(res,405,{ok:false,error:'Method not allowed'});
  }
  if(!sameOrigin(req))return send(res,403,{ok:false,error:'Cross-origin requests are not allowed.'});
  if(!process.env.GEMINI_API_KEY)return send(res,503,{ok:false,error:'UKTaxer AI is not configured.'});

  const body=req.body&&typeof req.body==='object'?req.body:{};
  const files=Array.isArray(body.files)?body.files.slice(0,MAX_FILES):[];
  const registry=cleanRegistry(body.calculators);
  const sourceCalculator=String(body.sourceCalculator||'').slice(0,80);
  if(!files.length)return send(res,400,{ok:false,error:'Choose at least one statement.'});
  if(!registry.length)return send(res,400,{ok:false,error:'Calculator registry is missing.'});

  for(const file of files){
    const bytes=Math.floor(String(file.data||'').length*0.75);
    if(bytes>MAX_FILE_BYTES)return send(res,413,{ok:false,error:`${String(file.name||'A file')} is too large for this import step. Keep each file at 5 MB or less.`});
  }

  try{
    const documents=[];
    for(const file of files){
      const result=await callModel(file,registry,sourceCalculator);
      if(result.unsupported){
        documents.push({name:String(file.name||'Statement'),ok:false,error:result.error,rows:[],warnings:[result.error]});
        continue;
      }
      let parsed;
      try{parsed=JSON.parse(result.text);}catch{
        documents.push({name:String(file.name||'Statement'),ok:false,error:'UKTaxer AI returned an invalid extraction response.',rows:[],warnings:[]});
        continue;
      }
      const allowed=new Map(registry.map(calc=>[calc.id,new Set(calc.fields.map(field=>field.key))]));
      const rows=(Array.isArray(parsed.rows)?parsed.rows:[])
        .slice(0,200)
        .map((row,index)=>{
          let calculatorId=String(row.suggestedCalculatorId||'');
          let fieldKey=String(row.suggestedFieldKey||'');
          if(!allowed.has(calculatorId)||!allowed.get(calculatorId).has(fieldKey)){calculatorId='';fieldKey='';}
          const relevance=['auto_map','review','ignore'].includes(row.relevance)?row.relevance:(calculatorId&&fieldKey?'auto_map':'review');
          return {
            id:`${String(file.name||'doc').slice(0,40)}-${index+1}`,
            date:String(row.date||'').slice(0,80),
            description:String(row.description||'').slice(0,500),
            amount:Number(row.amount)||0,
            direction:['credit','debit','neutral'].includes(row.direction)?row.direction:'neutral',
            normalizedCategory:String(row.normalizedCategory||'uncategorized').slice(0,120),
            relevance,
            suggestedCalculatorId:calculatorId,
            suggestedFieldKey:fieldKey,
            confidence:['high','medium','low'].includes(row.confidence)?row.confidence:'low',
            reason:String(row.reason||'').slice(0,500)
          };
        })
        .filter(row=>!sourceCalculator||row.relevance!=='ignore');
      documents.push({
        name:String(file.name||'Statement').slice(0,240),
        ok:true,
        model:result.model,
        documentType:String(parsed.documentType||'').slice(0,120),
        period:String(parsed.period||'').slice(0,160),
        truncated:Boolean(parsed.truncated),
        warnings:(Array.isArray(parsed.warnings)?parsed.warnings:[]).slice(0,6).map(String),
        rows
      });
    }
    return send(res,200,{ok:true,documents});
  }catch(error){
    const status=Number(error?.status)||502;
    const apiMessage=error?.data?.error?.message;
    const friendly=RETRYABLE.has(status)
      ?'UKTaxer AI is temporarily busy. Please try analysing the statements again shortly.'
      :apiMessage||'UKTaxer AI could not analyse the statements.';
    return send(res,status,{ok:false,error:friendly});
  }
}
