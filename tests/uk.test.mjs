import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CALCULATORS,DEFAULTS,SOURCE_LINKS} from '../dist/calculators.js';
import {TAX_AREAS} from '../dist/tax-areas.js';
import * as E from '../dist/engine.js';
import {buildPdfBytes,buildExcelBytes} from '../dist/export.js';

let selected='england';
globalThis.localStorage={getItem:key=>key==='uktaxer-nation'?selected:null};
const pounds=n=>Math.round(n*100);
const byId=id=>CALCULATORS.find(c=>c.id===id);
test('24 workspaces use UK tax heads and the directory includes further taxes',()=>{
 assert.equal(CALCULATORS.length,24);
 assert.ok(new Set(CALCULATORS.map(c=>c.group)).size>5);
 assert.ok(CALCULATORS.every(c=>!['Individuals','Businesses','Transactions','Reliefs & allowances','Specialist sectors'].includes(c.group)));
 assert.ok(TAX_AREAS.length>30);
 assert.equal(new Set(TAX_AREAS.map(area=>area.name)).size,TAX_AREAS.length);
 assert.deepEqual(new Set(TAX_AREAS.flatMap(area=>area.calculators)),new Set(CALCULATORS.map(c=>c.id)));
 assert.ok(TAX_AREAS.every(area=>area.url.startsWith('https://')&&area.name&&area.summary));
 for(const c of CALCULATORS){assert.ok(c.fields.length);assert.ok(c.sources.every(id=>SOURCE_LINKS[id]?.url.startsWith('https://')));}
});
test('PAYE threshold, live amount and nation selection',()=>{
 selected='england';
 assert.equal(E.income({income:'12570',benefits:'0',other:'0',period:'annual'}).amount,0);
 assert.equal(E.income({income:'50000',benefits:'0',other:'0',period:'annual'}).amount,pounds(10480.4));
 selected='scotland';
 assert.notEqual(E.income({income:'50000',benefits:'0',other:'0',period:'annual'}).amount,pounds(10480.4));
 selected='';
 assert.equal(E.income({income:'50000',benefits:'0',other:'0',period:'annual'}).amount,null);
 selected='england';
});
test('official dividend worked example and common boundaries',()=>{
 assert.equal(E.dividends({amount:'3000',otherIncome:'29570'}).amount,pounds(268.75));
 assert.equal(E.gains({proceeds:'13000',cost:'10000',expenses:'0',losses:'0',otherIncome:'0'}).amount,0);
 assert.equal(E.vat({rate:'0.2',amount:'100',input:'0'}).amount,pounds(20));
 assert.equal(E.stamp({value:'1000'}).amount,pounds(5));
 assert.equal(E.company({profit:'50000',associated:'0'}).amount,pounds(9500));
 assert.equal(E.company({profit:'250000',associated:'0'}).amount,pounds(62500));
});
test('four-nation residential transaction tax',()=>{
 const input={price:'300000',first:false,additional:false,nonresident:false,complex:false};
 const amounts={};
 for(const nation of Object.keys(E.NATIONS)){selected=nation;amounts[nation]=E.transfer(input).amount;assert.ok(Number.isInteger(amounts[nation]));}
 assert.equal(amounts.england,pounds(5000));
 assert.equal(amounts.northernIreland,amounts.england);
 assert.notEqual(amounts.scotland,amounts.wales);
 selected='england';
});
test('all 24 calculate or return review needed with complete inputs',()=>{
 selected='england';
 for(const c of CALCULATORS){
  const input=Object.fromEntries(c.fields.filter(f=>f.key).map(f=>[f.key,f.value]));
  const result=c.calculate(input);
  assert.ok(result&&('amount' in result),c.id);
  assert.ok(result.amount===null||Number.isFinite(result.amount),c.id);
  assert.ok(Array.isArray(result.rows)&&Array.isArray(result.notes),c.id);
 }
});
test('published rates give expected amounts across remaining UK workspaces',()=>{
 selected='england';
 const examples=[
  [E.selfEmployed,{income:'50000',costs:'0',other:'0'},9731.80],
  [E.gains,{proceeds:'10000',cost:'0',expenses:'0',losses:'0',otherIncome:'0'},1260],
  [E.digital,{proceeds:'10000',cost:'0',expenses:'0',losses:'0',otherIncome:'0'},1260],
  [E.propertyIncome,{rent:'10000',costs:'0',otherIncome:'12570'},2000],
  [E.compensation,{amount:'40000',prior:'0',otherIncome:'12570'},2000],
  [E.employerNI,{pay:'10000',allowance:false},750],
  [E.minimumTax,{confirmed:true,income:'1000000',covered:'100000'},50000],
  [E.businessRates,{confirmed:true,value:'50000',multiplier:'50',relief:'10000'},15000],
  [E.stamp,{value:'1000'},5],
  [E.capital,{cost:'1100000',used:'0'},1000000],
  [E.incentive,{confirmed:true,cost:'100000'},20000],
  [E.foreign,{confirmed:true,ukTax:'10000',foreignTax:'6000'},6000],
  [E.hydrocarbon,{confirmed:true,profit:'1000000'},380000],
  [E.petroleum,{confirmed:true,profit:'1000000',supplementary:'800000'},380000],
  [E.royalty,{band:'domestic',category:'0',passengers:'1'},8],
  [E.mineral,{tonnes:'100'},216],
  [E.nonresident,{confirmed:true,profit:'1000000'},250000],
  [E.surcharge,{category:'standard',tonnes:'100'},13075],
  [E.other,{confirmed:true,estate:'800000',charity:'0',nil:'325000',residence:'0',reduced:false},190000]
 ];
 for(const [calculate,input,expected] of examples)assert.equal(calculate(input).amount,pounds(expected),calculate.name);
 selected='';
 assert.equal(E.royalty({band:'domestic',category:'0',passengers:'1'}).amount,null);
 selected='england';
});
test('invalid money is rejected, including incomplete live input',()=>{
 for(const value of ['','1.234','-1','1x','1,00'])assert.throws(()=>E.money(value));
 assert.equal(E.money('1,234.50'),pounds(1234.5));
});
test('law manifest contains locally indexed official provisions',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../dist/law/manifest.json',import.meta.url)));
 assert.ok(manifest.documents.length>=22);
 for(const doc of manifest.documents){
  const entries=JSON.parse(await readFile(new URL('../dist'+doc.index,import.meta.url)));
  assert.equal(entries.length,doc.provisions,doc.id);
  assert.ok(entries.every(entry=>entry.heading&&entry.text&&entry.url.startsWith('https://www.legislation.gov.uk/')),doc.id);
 }
});
test('PDF and Excel exports carry result and official source',()=>{
 const report={title:'PAYE & NI',subtitle:'UK tax estimate',amountLabel:'Estimated deductions',amount:'£10,480.40',generatedAt:new Date().toISOString(),generatedDisplay:'25 September 2026',ruleset:E.RULESET,reviewed:E.REVIEWED,sections:[{title:'Legal references',tables:[{title:'Official sources',headers:['Source','URL'],rows:[['HMRC Income Tax','https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past']]}]}]};
 const pdf=buildPdfBytes(report),xlsx=buildExcelBytes(report);
 assert.equal(new TextDecoder().decode(pdf.slice(0,8)),'%PDF-1.4');
 assert.equal(new TextDecoder().decode(xlsx.slice(0,2)),'PK');
 assert.ok(pdf.length>1000&&xlsx.length>500);
});
