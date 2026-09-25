export const SECTORS=[
 {name:'Employees and pensioners',status:'Calculation with payroll assumptions',text:'PAYE, benefits and standard Class 1 NI. Tax codes, pensions, loans and payroll timing need review.',sources:['income','ni'],calc:'paye'},
 {name:'Sole traders and landlords',status:'Assisted calculation',text:'Tax-adjusted profit and Class 4 NI or rental income. Relief and finance costs need separate review.',sources:['income','property'],calc:'business'},
 {name:'Investors and cryptoasset holders',status:'Disposal-level estimate',text:'Check sterling values, annual exemption, losses and reliefs before using a gains estimate.',sources:['cgt','crypto'],calc:'gains'},
 {name:'Companies and groups',status:'Assisted calculation',text:'Corporation Tax and marginal relief use a twelve-month simple profit base. Group top-up tax requires verified GloBE figures.',sources:['corporation','topup'],calc:'company'},
 {name:'Retailers and service suppliers',status:'Supply-level calculation',text:'VAT rate selection and input tax eligibility require classification of each supply.',sources:['vat'],calc:'vat'},
 {name:'Property buyers',status:'Nation-sensitive calculation',text:'SDLT, LBTT and LTT depend on the property location and buyer circumstances.',sources:['sdlt','lbtt','ltt'],calc:'transfer'},
 {name:'Oil, gas and energy operators',status:'Specialist review',text:'Ring-fence Corporation Tax and Energy Profits Levy need verified statutory profit bases.',sources:['energy','ringfence'],calc:'hydrocarbon'},
 {name:'Airlines, aggregates and landfill operators',status:'Specialist calculations',text:'APD, aggregates tax and landfill tax use activity-specific rates and classifications.',sources:['apd','aggregates','landfill'],calc:'royalty'},
 {name:'Estate representatives',status:'Assisted calculation',text:'Inheritance Tax depends on nil-rate bands, gifts, residence conditions and estate facts.',sources:['iht'],calc:'other'}
];
