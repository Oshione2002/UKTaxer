/** UKTaxer 2026–27. Monetary inputs and outputs are integer pence. */
export const RULESET = 'UK-2026.1';
export const REVIEWED = '2026-09-25';
export const NATIONS = {england:'England',scotland:'Scotland',wales:'Wales',northernIreland:'Northern Ireland'};
const P = n => Math.round(n * 100);
const round = n => Math.round(n);
const pos = n => Math.max(0,n);
const row = (label,value) => [label,value];
const result = (amount,base,rows,extra={}) => ({amount,base,rows,notes:[],...extra});
const review = (title,notes) => result(null,0,[],{title,notes:Array.isArray(notes)?notes:[notes]});
const assert = (condition,message) => {if(condition) throw new Error(message);};
export function money(value) {
 const raw=String(value??'').trim();
 assert(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw),'Enter a non-negative pound amount with at most two decimal places.');
 const [whole,fraction='']=raw.replaceAll(',','').split('.');
 const p=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
 assert(p>100000000000000n,'Enter an amount no greater than £1 trillion.');
 return Number(p);
}
const M=(x,key)=>money(x[key]??0);
const pct=(value,rate)=>round(value*rate);
export function nation(){try{return localStorage.getItem('uktaxer-nation')||'';}catch{return '';}}
const locationNeeded=()=>review('Choose your UK nation',['Select England, Scotland, Wales or Northern Ireland in the header to see this location-sensitive estimate.']);
export function allowance(income){return pos(P(12570)-Math.floor(pos(income-P(100000))/2));}
function bandsTax(taxable,bands){
 let lower=0,tax=0;
 const out=[];
 for(const [upperPounds,rate] of bands){
  const upper=Number.isFinite(upperPounds)?P(upperPounds):Infinity;
  const used=pos(Math.min(taxable,upper)-lower),line=pct(used,rate);
  out.push({lower,upper,used,rate:round(rate*10000),tax:line});tax+=line;lower=upper;
  if(taxable<=upper)break;
 }
 return {tax,bands:out};
}
export function incomeTax(gross,ukNation=nation()){
 const a=allowance(gross),taxable=pos(gross-a);
 const bands=ukNation==='scotland'?[[3967,.19],[16956,.20],[31092,.21],[62430,.42],[125140,.45],[Infinity,.48]]:[[37700,.20],[125140,.40],[Infinity,.45]];
 return {...bandsTax(taxable,bands),allowance:a,taxable};
}
function incrementalIncomeTax(base,extra,ukNation){return incomeTax(base+extra,ukNation).tax-incomeTax(base,ukNation).tax;}
export function income(x){
 const ukNation=nation();if(!ukNation)return locationNeeded();
 const gross=M(x,'income')*(x.period==='monthly'?12:1)+M(x,'benefits')+M(x,'other');
 const tax=incomeTax(gross,ukNation),ni=bandsTax(gross,[[12570,0],[50270,.08],[Infinity,.02]]).tax;
 const total=tax.tax+ni;
 return result(total,gross,[row('Annual gross pay and taxable benefits',gross),row('Personal Allowance',tax.allowance),row('Income Tax',tax.tax),row('Employee Class 1 National Insurance',ni),row('Estimated annual deductions',total)],{title:'Estimated Income Tax and employee NI',secondary:row('Net annual pay',pos(gross-total)),tertiary:row('Monthly deductions',round(total/12)),bands:tax.bands,notes:['2026–27 tax year; one employment and standard NI category A.','The annual NI equivalent is illustrative. Payroll periods, tax codes, pensions, student loans and benefits may change the actual payslip.']});
}
export function selfEmployed(x){
 const ukNation=nation();if(!ukNation)return locationNeeded();
 const receipts=M(x,'income'),costs=M(x,'costs');
 assert(costs>receipts,'Expenses cannot exceed receipts in this simplified positive-profit calculation.');
 const profit=receipts-costs+M(x,'other');
 const tax=incomeTax(profit,ukNation),ni=bandsTax(profit,[[12570,0],[50270,.06],[Infinity,.02]]).tax;
 return result(tax.tax+ni,profit,[row('Business receipts',receipts),row('Allowable expenses',costs),row('Profit and other income',profit),row('Income Tax',tax.tax),row('Class 4 National Insurance',ni)],{title:'Estimated Income Tax and Class 4 NI',secondary:row('Profit after estimated tax',pos(profit-tax.tax-ni)),bands:tax.bands,notes:['Sole trader with verified allowable expenses; no losses, capital allowances or other reliefs.','Class 2 voluntary contributions and payments on account are outside this result.']});
}
function gainCore(x,label){
 const proceeds=M(x,'proceeds'),cost=M(x,'cost'),expenses=M(x,'expenses'),losses=M(x,'losses'),income=M(x,'otherIncome');
 const gain=pos(proceeds-cost-expenses-losses),taxable=pos(gain-P(3000)),capacity=pos(P(37700)-income);
 const basic=Math.min(taxable,capacity),higher=taxable-basic,tax=pct(basic,.18)+pct(higher,.24);
 return result(tax,gain,[row('Disposal proceeds',proceeds),row('Acquisition cost',cost),row('Allowable costs and losses',expenses+losses),row('Gain before annual exemption',gain),row('Annual Exempt Amount used',Math.min(gain,P(3000))),row('18% tax',pct(basic,.18)),row('24% tax',pct(higher,.24))],{title:label,secondary:row('Taxable gain',taxable),notes:['Individual general-rate CGT estimate for 2026–27. Other income must be taxable income after allowances.','Reliefs, previous disposals, residential property and company disposals need separate review.']});
}
export const gains=x=>gainCore(x,'Estimated Capital Gains Tax');
export const digital=x=>({...gainCore(x,'Estimated cryptoasset Capital Gains Tax'),notes:['Cryptoasset acquisition lots, fees and sterling values must be verified. This models one disposal only.','The annual exemption may already have been used by other gains.']});
export function propertyIncome(x){
 const ukNation=nation();if(!ukNation)return locationNeeded();
 const rent=M(x,'rent'),costs=M(x,'costs'),other=M(x,'otherIncome');
 assert(costs>rent,'Allowable expenses cannot exceed rent in this positive-profit worksheet.');
 const profit=rent-costs,tax=incrementalIncomeTax(other,profit,ukNation);
 return result(tax,profit,[row('Rental receipts',rent),row('Allowable expenses',costs),row('Property profit',profit),row('Incremental Income Tax',tax)],{title:'Estimated tax on property income',notes:['Other income sets the marginal band. Finance-cost restriction, property allowance, losses and joint ownership are excluded.','Only expenses permitted under the property income rules should be entered.']});
}
export function compensation(x){
 const ukNation=nation();if(!ukNation)return locationNeeded();
 const payment=M(x,'amount'),other=M(x,'otherIncome'),prior=M(x,'prior');
 const remaining=pos(P(30000)-prior),taxable=pos(payment-remaining),tax=incrementalIncomeTax(other,taxable,ukNation);
 return result(tax,payment,[row('Termination payment',payment),row('Remaining £30,000 exemption',Math.min(payment,remaining)),row('Taxable excess',taxable),row('Incremental Income Tax',tax)],{title:'Estimated tax on termination payment',notes:['Only qualifying termination awards use the £30,000 exemption. Salary, notice pay, holiday pay and other fully taxable amounts must be excluded.','Employer Class 1A NI on the taxable excess is a separate employer liability.']});
}
export function company(x){
 const profit=M(x,'profit'),associates=Number(x.associated||0);
 assert(!Number.isInteger(associates)||associates<0||associates>50,'Associated companies must be a whole number from 0 to 50.');
 if(x.shortPeriod)return review('Short accounting period needs review',['The £50,000 and £250,000 thresholds must be time-apportioned.']);
 const low=P(50000)/(associates+1),high=P(250000)/(associates+1);
 const tax=profit<=low?pct(profit,.19):profit>=high?pct(profit,.25):round(profit*.25-(high-profit)*3/200);
 return result(tax,profit,[row('Taxable company profit',profit),row('Corporation Tax',tax)],{title:'Estimated Corporation Tax',secondary:row('Profit after tax',pos(profit-tax)),notes:['12-month accounting period; taxable total profits equal augmented profits.','No ring-fence profits, distributions, losses or group relief are included.']});
}
export function employerNI(x){
 const payroll=M(x,'pay'),eligible=x.allowance===true;
 const before=pct(pos(payroll-P(5000)),.15),credit=eligible?Math.min(before,P(10500)):0;
 return result(before-credit,payroll,[row('Annual pay',payroll),row('Employer NI before allowance',before),row('Verified Employment Allowance',credit),row('Employer NI after allowance',before-credit)],{title:'Estimated employer Class 1 NI',notes:['One standard-category employee, 2026–27 annual equivalent.','Employment Allowance requires separate eligibility checks and may cover a wider payroll; select it only if eligibility is verified.']});
}
export function minimumTax(x){
 if(!x.confirmed)return review('Top-up scope needs review',['Confirm multinational group scope and calculate GloBE income, covered taxes and substance exclusion before entering amounts.']);
 const base=M(x,'income'),covered=M(x,'covered'),tax=pos(pct(base,.15)-covered);
 return result(tax,base,[row('Verified excess GloBE profit',base),row('15% minimum amount',pct(base,.15)),row('Adjusted covered taxes',covered),row('Indicative top-up',tax)],{title:'Indicative multinational top-up',notes:['Arithmetic on supplied verified statutory bases. Jurisdictional blending, safe harbours and QDMTT allocation require review.']});
}
export function businessRates(x){
 const ukNation=nation();if(!ukNation)return locationNeeded();
 if(!x.confirmed)return review('Local rate needs review',['Confirm the property rateable value, current local multiplier and relief with the relevant authority.']);
 const value=M(x,'value'),multiplier=Number(x.multiplier),relief=M(x,'relief');
 assert(!Number.isFinite(multiplier)||multiplier<0||multiplier>100,'Enter a verified multiplier between 0 and 100%.');
 const before=pct(value,multiplier/100),due=pos(before-relief);
 return result(due,value,[row('Rateable value',value),row('Tax at verified local multiplier',before),row('Verified relief',Math.min(before,relief)),row('Estimated business rates',due)],{title:'Estimated non-domestic rates',notes:['The multiplier and relief are supplied and verified by you; UKTaxer does not infer a council-specific bill.','Transitional arrangements, supplements and part-year occupation need review.']});
}
export function vat(x){
 const net=M(x,'amount'),input=M(x,'input'),rate=Number(x.rate);
 assert(![0,.05,.20].includes(rate),'Select a VAT rate.');
 const output=pct(net,rate),balance=output-input;
 return result(Math.abs(balance),net,[row('Taxable supply value',net),row('Output VAT',output),row('Eligible input VAT',input),row(balance<0?'Excess input VAT':'VAT due',Math.abs(balance))],{title:balance<0?'Excess input VAT':'Estimated VAT due',secondary:row('Invoice total',net+output),notes:['The selected rate and input VAT eligibility must be verified.','Partial exemption, imports and refund entitlement are outside this simple invoice worksheet.']});
}
export function dividends(x){
 const div=M(x,'amount'),other=M(x,'otherIncome'),a=allowance(div+other),unused=pos(a-other);
 const taxable=pos(div-unused),start=pos(other-a)+Math.min(P(500),taxable),end=pos(other-a)+taxable;
 const slice=(lo,hi)=>pos(Math.min(end,hi)-Math.max(start,lo));
 const basic=slice(0,P(37700)),higher=slice(P(37700),P(125140)),additional=slice(P(125140),Infinity);
 const tax=pct(basic,.1075)+pct(higher,.3575)+pct(additional,.3935);
 return result(tax,div,[row('Dividends received',div),row('Dividend allowance used',Math.min(P(500),taxable)),row('Basic rate dividend tax',pct(basic,.1075)),row('Higher rate dividend tax',pct(higher,.3575)),row('Additional rate dividend tax',pct(additional,.3935))],{title:'Estimated dividend tax',notes:['2026–27 UK dividend rates. Other income uses the band first.','This result is dividend tax only and assumes no other dividends or savings income.']});
}
export function stamp(x){
 const value=M(x,'value'),tax=pct(value,.005);
 return result(tax,value,[row('Electronic share purchase consideration',value),row('SDRT at 0.5%',tax)],{title:'Estimated Stamp Duty Reserve Tax',notes:['Standard electronic UK share purchase only. Paper transfers, exemptions and reliefs need separate review.']});
}
function propertyBands(price,bands){return bandsTax(price,bands);}
export function transfer(x){
 const ukNation=nation();if(!ukNation)return locationNeeded();
 const price=M(x,'price'),additional=x.additional===true,first=x.first===true;
 assert(additional&&first,'First-time buyer relief cannot be combined with an additional-property purchase.');
 if(x.complex)return review('Property transaction needs review',['Linked transactions, company purchases, leases and mixed-use property require a specialist calculation.']);
 let base,supplement=0,note;
 if(ukNation==='scotland'){
  base=propertyBands(price,first?[[175000,0],[250000,.02],[325000,.05],[750000,.10],[Infinity,.12]]:[[145000,0],[250000,.02],[325000,.05],[750000,.10],[Infinity,.12]]);
  supplement=additional?pct(price,.08):0;note='Scottish LBTT and any Additional Dwelling Supplement.';
 }else if(ukNation==='wales'){
  base=propertyBands(price,additional?[[180000,.05],[250000,.085],[400000,.10],[750000,.125],[1500000,.15],[Infinity,.17]]:[[225000,0],[400000,.06],[750000,.075],[1500000,.10],[Infinity,.12]]);
  note='Welsh LTT. Wales has no first-time buyer relief.';
 }else{
  base=propertyBands(price,first&&price<=P(500000)?[[300000,0],[500000,.05],[Infinity,.05]]:[[125000,0],[250000,.02],[925000,.05],[1500000,.10],[Infinity,.12]]);
  supplement=(additional?pct(price,.05):0)+(x.nonresident?pct(price,.02):0);
  note='England or Northern Ireland SDLT, with selected surcharges.';
 }
 return result(base.tax+supplement,price,[row('Purchase price',price),...base.bands.map(b=>row('Tax at '+b.rate/100+'% on band',b.tax)),row('Selected surcharges',supplement),row('Total property transaction tax',base.tax+supplement)],{title:'Estimated residential transaction tax',notes:[note,'Relief and surcharge eligibility must be checked against ownership and residence facts.']});
}
export function insurancePremium(x){
 const premium=M(x,'premium'),rate=x.rate==='higher'?.20:.12,tax=pct(premium,rate);
 return result(tax,premium,[row('Taxable premium',premium),row('Insurance Premium Tax',tax)],{title:'Estimated Insurance Premium Tax',notes:['Standard 12% or higher 20% rate as selected. Exempt insurance and specific higher-rate categories need classification.']});
}
export function capital(x){
 const cost=M(x,'cost'),used=M(x,'used');
 assert(used>P(1000000),'Previously claimed AIA cannot exceed £1 million in this worksheet.');
 const allowance=Math.min(cost,pos(P(1000000)-used));
 return result(allowance,cost,[row('Qualifying expenditure',cost),row('AIA already claimed',used),row('AIA available on this asset',allowance)],{title:'Indicative Annual Investment Allowance',notes:['The £1 million AIA limit is shared across qualifying expenditure and connected businesses.','Ownership, asset eligibility, timing and short-period limits must be verified.']});
}
export function incentive(x){
 if(!x.confirmed)return review('R&D eligibility needs review',['Confirm qualifying expenditure and the applicable merged R&D expenditure credit scheme.']);
 const cost=M(x,'cost'),credit=pct(cost,.20);
 return result(credit,cost,[row('Verified qualifying R&D expenditure',cost),row('Gross credit at 20%',credit)],{title:'Gross R&D expenditure credit',notes:['Gross credit is not the net cash benefit. Taxation, notional tax, PAYE cap and surrender rules require review.']});
}
export function foreign(x){
 if(!x.confirmed)return review('Foreign tax credit needs review',['Confirm treaty or unilateral relief, foreign tax paid and UK tax attributable to the same income.']);
 const uk=M(x,'ukTax'),paid=M(x,'foreignTax'),credit=Math.min(uk,paid);
 return result(credit,uk,[row('UK tax attributable',uk),row('Qualifying foreign tax',paid),row('Maximum illustrative credit',credit)],{title:'Indicative foreign tax credit',notes:['Credit is limited to UK tax on the same income. Treaty, source and timing rules need verification.']});
}
export function hydrocarbon(x){
 if(!x.confirmed)return review('Energy Profits Levy base needs review',['Enter levy profits only after the statutory adjustments and confirm the levy applies to the accounting period.']);
 const profit=M(x,'profit'),tax=pct(profit,.38);
 return result(tax,profit,[row('Verified levy profits',profit),row('Energy Profits Levy at 38%',tax)],{title:'Indicative Energy Profits Levy',notes:['Separate from ring-fence Corporation Tax and supplementary charge. Investment allowances and exceptional price mechanism may affect liability.']});
}
export function petroleum(x){
 if(!x.confirmed)return review('Ring-fence profit bases need review',['Confirm main-rate ring-fence taxable profit and the separate supplementary-charge base.']);
 const profit=M(x,'profit'),suppBase=M(x,'supplementary'),main=pct(profit,.30),supp=pct(suppBase,.10);
 return result(main+supp,profit,[row('Verified ring-fence taxable profit',profit),row('Ring-fence Corporation Tax at 30%',main),row('Verified supplementary-charge base',suppBase),row('Supplementary charge at 10%',supp)],{title:'Indicative ring-fence taxes',notes:['Main-rate company only. Small-profits marginal relief, financing exclusions and Energy Profits Levy are separate.']});
}
const APD={domestic:[8,16,142],a:[15,32,142],b:[102,244,1097],c:[106,253,1141]};
export function royalty(x){
 if(!nation())return locationNeeded();
 const band=x.band,category=Number(x.category),passengers=Number(x.passengers);
 if(nation()==='northernIreland'&&(band==='b'||band==='c'))return review('Northern Ireland long-haul APD needs review',['Direct long-haul departures may have a different rate. Confirm the itinerary and charge before using this workspace.']);
 assert(!APD[band]||!Number.isInteger(category)||category<0||category>2,'Select valid Air Passenger Duty classifications.');
 assert(!Number.isInteger(passengers)||passengers<0||passengers>1000000,'Passenger count must be a whole number.');
 const rate=P(APD[band][category]),tax=rate*passengers;
 return result(tax,tax,[row('Chargeable passengers',String(passengers)),row('Duty per passenger',rate),row('Total duty',tax)],{title:'Estimated Air Passenger Duty',notes:['Flights from 1 April 2026; destination band and travel class must be verified.','Northern Ireland long-haul and Highlands and Islands exemptions require separate review.']});
}
export function mineral(x){
 if(!nation())return locationNeeded();
 const tonnes=Number(x.tonnes);
 assert(!Number.isFinite(tonnes)||tonnes<0||tonnes>100000000,'Enter a valid taxable tonnage.');
 const tax=round(tonnes*P(2.16));
 return result(tax,tax,[row('Taxable tonnes',String(tonnes)),row('Rate per tonne',P(2.16)),row('Aggregates tax',tax)],{title:nation()==='scotland'?'Scottish Aggregates Tax':'Aggregates Levy',notes:['£2.16 per taxable tonne from 1 April 2026. Scotland uses Scottish Aggregates Tax.','Confirm commercial exploitation, exemptions and weight measurement.']});
}
export function nonresident(x){
 if(!x.confirmed)return review('UK taxing nexus needs review',['Confirm UK permanent establishment, attributable profit and treaty protection.']);
 const profit=M(x,'profit'),tax=pct(profit,.25);
 return result(tax,profit,[row('Verified UK-attributable taxable profit',profit),row('Illustrative Corporation Tax at 25%',tax)],{title:'Indicative non-resident company tax',notes:['Main-rate, no marginal relief or treaty adjustment. Do not infer UK taxable presence from revenue alone.']});
}
export function surcharge(x){
 if(!nation())return locationNeeded();
 const tonnes=Number(x.tonnes),rate=x.category==='lower'?8.65:130.75;
 assert(!Number.isFinite(tonnes)||tonnes<0||tonnes>100000000,'Enter a valid taxable tonnage.');
 const tax=round(tonnes*P(rate));
 return result(tax,tax,[row('Taxable tonnes',String(tonnes)),row('Selected rate per tonne',P(rate)),row('Landfill tax',tax)],{title:'Estimated landfill tax',notes:['2026–27 standard or lower rate. Scotland and Wales use devolved landfill taxes.','Waste classification, exemptions and operator obligations must be verified.']});
}
export function other(x){
 if(!x.confirmed)return review('Estate facts need review',['Confirm gifts, transferable bands, spouse and charity exemptions, residence eligibility and business or agricultural relief before entering a verified tax base.']);
 const estate=M(x,'estate'),charity=M(x,'charity'),nil=M(x,'nil'),residence=M(x,'residence');
 assert(charity>estate,'Charitable gifts cannot exceed the net estate.');
 const taxable=pos(estate-charity-nil-residence),rate=x.reduced ? .36 : .40,tax=pct(taxable,rate);
 return result(tax,estate,[row('Verified net estate',estate),row('Qualifying charitable gifts',charity),row('Available nil-rate band',nil),row('Available residence band',residence),row('Taxable estate',taxable),row('Inheritance Tax',tax)],{title:'Indicative Inheritance Tax',notes:['Uses verified allowances supplied by the estate representative.','The 36% rate applies only if the qualifying charitable legacy test is met. Gifts, exemptions and reliefs require specialist review.']});
}
