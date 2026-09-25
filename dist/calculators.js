import * as E from './engine.js';
const m=(key,label,value=0,hint='')=>({key,label,value:String(value),hint,type:'money'});
const n=(key,label,value=0,min=0,max=1000000)=>({key,label,value:String(value),min,max,type:'number'});
const b=(key,label,value=false)=>({key,label,value,type:'boolean'});
const s=(key,label,options)=>({key,label,type:'select',options,value:options[0][0]});
const c=(id,name,short,symbol,group,status,description,sources,calculate,fields)=>({id,name,short,symbol,group,status,description,sources,calculate,fields});
export const CALCULATORS=[
c('paye','Income Tax (PAYE) and employee National Insurance','PAYE & NI','£','Income Tax','calculated','Estimate annual Income Tax and employee NI from one job.',['income','scottishIncome','ni'],E.income,[s('period','Salary period',[['annual','Annual'],['monthly','Monthly']]),m('income','Cash salary',50000),m('benefits','Annual taxable benefits'),m('other','Other taxable employment income')]),
c('business','Income Tax and Class 4 National Insurance','Self-employed','↗','Income Tax','assisted','Estimate Income Tax and Class 4 NI on sole-trade profit.',['income','scottishIncome','ni'],E.selfEmployed,[m('income','Annual business receipts',80000),m('costs','Allowable business expenses',20000),m('other','Other taxable income')]),
c('gains','Capital Gains Tax','Capital gains','◇','Capital Gains Tax','assisted','Estimate general-rate CGT on one disposal.',['cgt'],E.gains,[m('proceeds','Sale proceeds',50000),m('cost','Acquisition cost',20000),m('expenses','Allowable buying and selling costs'),m('losses','Allowable losses'),m('otherIncome','Other taxable income after allowances',30000)]),
c('digital','Capital Gains Tax on cryptoassets','Crypto gains','◇','Capital Gains Tax','assisted','Estimate CGT on one cryptoasset disposal.',['cgt','crypto'],E.digital,[m('proceeds','Sterling disposal proceeds',20000),m('cost','Allocated sterling acquisition cost',10000),m('expenses','Allowable fees'),m('losses','Allowable losses'),m('otherIncome','Other taxable income after allowances',30000)]),
c('presumptive-gains','Income Tax on property income','Rental income','⌂','Income Tax','assisted','Estimate Income Tax on annual UK property profit.',['property','income','scottishIncome'],E.propertyIncome,[m('rent','Annual rental receipts',24000),m('costs','Allowable property expenses',4000),m('otherIncome','Other taxable income',30000)]),
c('compensation','Income Tax on termination payments','Termination','≈','Income Tax','assisted','Estimate tax on a qualifying termination award.',['termination','scottishIncome'],E.compensation,[m('amount','Qualifying termination payment',45000),m('prior','Earlier use of the £30,000 exemption'),m('otherIncome','Other taxable income',40000)]),
c('company','Corporation Tax','Corporation Tax','▥','Corporation Tax','assisted','Estimate Corporation Tax with marginal relief.',['corporation'],E.company,[m('profit','Taxable total profits',100000),n('associated','Associated companies',0,0,50),b('shortPeriod','Accounting period shorter than 12 months')]),
c('levy','Employer Class 1 National Insurance','Employer NI','⊞','National Insurance contributions','calculated','Estimate employer NI for one employee.',['ni'],E.employerNI,[m('pay','Annual employee pay',50000),b('allowance','Employment Allowance eligibility verified')]),
c('minimum','Multinational Top-up Tax','Top-up tax','%','Multinational Top-up Tax','assisted','Illustrate the 15% minimum on verified GloBE amounts.',['topup'],E.minimumTax,[b('confirmed','Statutory scope and GloBE amounts verified'),m('income','Verified excess GloBE profit',1000000),m('covered','Adjusted covered taxes',100000)]),
c('presumptive','Non-domestic rates','Business rates','⌂','Non-domestic rates','assisted','Apply a verified local multiplier and relief.',['businessrates'],E.businessRates,[b('confirmed','Local multiplier and relief verified'),m('value','Rateable value',50000),n('multiplier','Local multiplier (%)',50,0,100),m('relief','Verified relief')]),
c('vat','Value Added Tax','VAT','%','Value Added Tax','calculated','Calculate output VAT less eligible input VAT.',['vat'],E.vat,[s('rate','Verified VAT rate',[['0.2','Standard · 20%'],['0.05','Reduced · 5%'],['0','Zero · 0%']]),m('amount','Net supply value',10000),m('input','Eligible input VAT')]),
c('withholding','Income Tax on dividends','Dividends','↓','Income Tax','assisted','Estimate tax on dividends for 2026–27.',['dividends'],E.dividends,[m('amount','Dividends received',10000),m('otherIncome','Other gross income',30000)]),
c('stamp','Stamp Duty Reserve Tax','Share SDRT','▤','Stamp Duty Reserve Tax','calculated','Estimate tax on an electronic UK share purchase.',['sdrt'],E.stamp,[m('value','Share purchase consideration',10000)]),
c('transfer','SDLT, LBTT or LTT on a residential purchase','Property purchase','⇄','Stamp Duty Land Tax / LBTT / LTT','assisted','Calculate SDLT, LBTT or LTT for a straightforward purchase.',['sdlt','lbtt','ltt'],E.transfer,[m('price','Purchase price',300000),b('first','Eligible first-time buyer'),b('additional','Additional residential property'),b('nonresident','Non-UK resident buyer for SDLT'),b('complex','Linked, mixed-use, company or lease transaction')]),
c('capital','Annual Investment Allowance','Capital allowances','▦','Capital allowances','assisted','Estimate AIA on qualifying expenditure.',['aia'],E.capital,[m('cost','Qualifying capital expenditure',100000),m('used','AIA already claimed')]),
c('incentive','Research and Development Expenditure Credit','R&D credit','+','Corporation Tax','assisted','Illustrate gross R&D credit after eligibility review.',['rnd'],E.incentive,[b('confirmed','Qualifying expenditure verified'),m('cost','Verified qualifying expenditure',100000)]),
c('foreign','Double Taxation Relief (foreign tax credit)','Foreign tax credit','◎','Income Tax','assisted','Limit credit to UK tax on the same income.',['foreign'],E.foreign,[b('confirmed','Credit eligibility verified'),m('ukTax','UK tax attributable',10000),m('foreignTax','Qualifying foreign tax paid',6000)]),
c('hydrocarbon','Energy Profits Levy','Energy profits','◈','Energy Profits Levy','assisted','Apply the levy to verified oil and gas profits.',['energy'],E.hydrocarbon,[b('confirmed','Levy scope and base verified'),m('profit','Verified levy profits',1000000)]),
c('petroleum','Ring fence Corporation Tax and supplementary charge','Ring-fence tax','◉','Ring fence Corporation Tax','assisted','Illustrate ring-fence CT and supplementary charge.',['ringfence'],E.petroleum,[b('confirmed','Both profit bases verified'),m('profit','Ring-fence taxable profit',1000000),m('supplementary','Supplementary-charge profit base',800000)]),
c('royalty','Air Passenger Duty','Air duty','✈','Air Passenger Duty','assisted','Estimate duty for UK-departing flights.',['apd'],E.royalty,[s('band','Destination band',[['domestic','Domestic'],['a','Band A'],['b','Band B'],['c','Band C']]),s('category','Travel rate',[['0','Reduced'],['1','Standard'],['2','Higher']]),n('passengers','Chargeable passengers',1,0,1000000)]),
c('mineral','Aggregates Levy / Scottish Aggregates Tax','Aggregates','△','Aggregates Levy / Scottish Aggregates Tax','calculated','Estimate levy or Scottish Aggregates Tax.',['aggregates','scottishAggregates'],E.mineral,[n('tonnes','Taxable tonnes',100,0,100000000)]),
c('nonresident','Corporation Tax for non-resident companies','Non-resident','↔','Corporation Tax','assisted','Illustrate tax on verified UK-attributable profit.',['corporation'],E.nonresident,[b('confirmed','UK nexus and attributable profit verified'),m('profit','Verified UK-attributable profit',1000000)]),
c('surcharge','Landfill Tax / Scottish Landfill Tax / Landfill Disposals Tax','Landfill tax','≋','Landfill taxes','assisted','Estimate tax on standard or lower-rated waste.',['landfill','scottishLandfill','welshLandfill'],E.surcharge,[s('category','Waste category',[['standard','Standard'],['lower','Lower']]),n('tonnes','Taxable tonnes',100,0,100000000)]),
c('other','Inheritance Tax','Inheritance tax','…','Inheritance Tax','assisted','Illustrate tax on a verified estate and bands.',['iht'],E.other,[b('confirmed','Estate facts and available bands verified'),m('estate','Net estate',800000),m('charity','Qualifying charitable gifts'),m('nil','Available nil-rate band',325000),m('residence','Available residence nil-rate band'),b('reduced','Qualifies for 36% charitable rate')])
];
export const DEFAULTS=Object.fromEntries(CALCULATORS.map(c=>[c.id,Object.fromEntries(c.fields.filter(f=>f.key).map(f=>[f.key,f.type==='money'?'0':f.type==='number'?String(f.min>0?f.min:0):f.value]))]));
const base='https://www.gov.uk/';
export const SOURCE_LINKS={
income:{title:'Income Tax rates and allowances',url:base+'government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past',detail:'HMRC 2026–27 rates and allowances.'},
scottishIncome:{title:'Scottish Income Tax rates',url:'https://www.gov.scot/publications/scottish-income-tax-rates-and-bands/pages/2026-to-2027/',detail:'Scottish non-savings income bands.'},
ni:{title:'National Insurance rates and thresholds',url:base+'guidance/rates-and-thresholds-for-employers-2026-to-2027',detail:'HMRC employee and employer Class 1 rates.'},
cgt:{title:'Capital Gains Tax rates',url:base+'capital-gains-tax/rates',detail:'General gains rates and exemption.'},
crypto:{title:'Cryptoasset tax guidance',url:base+'government/collections/cryptoassets',detail:'HMRC cryptoasset disposals.'},
property:{title:'Tax on rental income',url:base+'renting-out-a-property/paying-tax',detail:'UK property income.'},
termination:{title:'Termination payments',url:base+'employee-leaving/termination-payments',detail:'Qualifying exemption.'},
corporation:{title:'Corporation Tax rates',url:base+'government/publications/rates-and-allowances-corporation-tax/rates-and-allowances-corporation-tax',detail:'Corporation Tax rates and marginal relief.'},
topup:{title:'Multinational top-up tax',url:base+'government/collections/multinational-top-up-tax-and-domestic-top-up-tax',detail:'GloBE scope and bases.'},
businessrates:{title:'Business rates',url:base+'calculate-your-business-rates',detail:'Rateable value and multiplier.'},
vat:{title:'VAT rates',url:base+'vat-rates',detail:'VAT supply rates.'},
dividends:{title:'Tax on dividends',url:base+'tax-on-dividends',detail:'Allowance and rates.'},
sdrt:{title:'Tax on shares',url:base+'tax-buy-shares',detail:'SDRT on electronic purchases.'},
sdlt:{title:'SDLT residential rates',url:base+'stamp-duty-land-tax/residential-property-rates',detail:'England and Northern Ireland.'},
lbtt:{title:'Scottish LBTT residential rates',url:'https://revenue.scot/taxes/land-buildings-transaction-tax/residential-property',detail:'Scotland.'},
ltt:{title:'Welsh LTT rates',url:'https://www.gov.wales/land-transaction-tax-rates-and-bands',detail:'Wales.'},
aia:{title:'Annual Investment Allowance',url:base+'capital-allowances/annual-investment-allowance',detail:'AIA limit.'},
rnd:{title:'R&D relief',url:base+'guidance/corporation-tax-research-and-development-rd-relief',detail:'Merged expenditure credit.'},
foreign:{title:'Foreign tax relief',url:base+'tax-foreign-income/taxed-twice',detail:'Credit limitations.'},
energy:{title:'Energy Profits Levy',url:base+'government/publications/july-statement-2024-changes-to-the-energy-oil-and-gas-profits-levy/changes-to-the-energy-oil-and-gas-profits-levy',detail:'Oil and gas levy.'},
ringfence:{title:'Ring-fence CT',url:base+'government/publications/rates-and-allowances-corporation-tax/rates-and-allowances-corporation-tax',detail:'Oil and gas rates.'},
apd:{title:'Air Passenger Duty',url:base+'guidance/rates-and-allowances-for-air-passenger-duty',detail:'2026 rates.'},
aggregates:{title:'Aggregates Levy',url:base+'green-taxes-and-reliefs/aggregates-levy',detail:'Rate per tonne.'},
scottishAggregates:{title:'Scottish Aggregates Tax',url:'https://revenue.scot/news-publications/news/revenue-scotland-marks-introduction-scottish',detail:'Scottish rate from 1 April 2026.'},
landfill:{title:'Landfill Tax rates',url:base+'government/publications/rates-and-allowances-landfill-tax/landfill-tax-rates-from-1-april-2013',detail:'Waste rates.'},
scottishLandfill:{title:'Scottish Landfill Tax rates',url:'https://revenue.scot/taxes/scottish-landfill-tax/slft-rates-accounting-periods',detail:'Scottish 2026–27 standard and lower rates.'},
welshLandfill:{title:'Welsh Landfill Disposals Tax rates',url:'https://www.gov.wales/landfill-disposals-tax-rates',detail:'Welsh 2026–27 standard and lower rates.'},
iht:{title:'Inheritance Tax',url:base+'inheritance-tax',detail:'Bands and rates.'}
};
