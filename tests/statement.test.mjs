import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/statement.js';
import {buildExcelBytes} from '../dist/export.js';

test('XLSX statement reaches Gemini as readable rows and keeps mapping review',async()=>{
 const workbook=buildExcelBytes({title:'Bank statement',subtitle:'',amountLabel:'',amount:'',generatedAt:new Date().toISOString(),generatedDisplay:'',ruleset:'UK-2026.1',reviewed:'2026-09-25',sections:[{title:'Transactions',tables:[{headers:['Date','Description','Amount'],rows:[['2026-04-08','Salary',2500]]}]}]});
 let request;
 const previousFetch=globalThis.fetch,previousKey=process.env.GEMINI_API_KEY;
 process.env.GEMINI_API_KEY='test-only';
 globalThis.fetch=async(_url,options)=>{
  request=JSON.parse(options.body);
  return {ok:true,json:async()=>({steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify({documentType:'spreadsheet',period:'April 2026',truncated:false,warnings:[],rows:[{date:'2026-04-08',description:'Salary',amount:2500,direction:'credit',normalizedCategory:'salary',relevance:'review',suggestedCalculatorId:'paye',suggestedFieldKey:'income',confidence:'medium',reason:'Confirm gross salary.'}]})}]}]})};
 };
 let status,payload;
 const res={status(code){status=code;return this;},setHeader(){return this;},json(value){payload=value;return this;}};
 try{
  await handler({method:'POST',headers:{},body:{files:[{name:'statement.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',data:Buffer.from(workbook).toString('base64')}],calculators:[{id:'paye',name:'PAYE',group:'Individuals',fields:[{key:'income',label:'Annual gross pay'}]}],sourceCalculator:'paye'}},res);
  assert.equal(status,200,JSON.stringify(payload));
  const sent=request.input?.[0]?.text||'';
  assert.match(sent,/Salary/);
  assert.match(sent,/2500/);
  assert.equal(payload.documents[0].rows[0].relevance,'review');
 }finally{
  globalThis.fetch=previousFetch;
  if(previousKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previousKey;
 }
});
