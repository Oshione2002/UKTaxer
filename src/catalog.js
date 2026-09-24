export const categories = [
  { id: 'personal', title: 'Personal tax', subtitle: 'Pay, dividends and gains', icon: '◉' },
  { id: 'business', title: 'Business tax', subtitle: 'Sole traders, companies and VAT', icon: '▦' },
  { id: 'property', title: 'Property & transactions', subtitle: 'Buying property across the UK', icon: '⌂' },
  { id: 'specialist', title: 'Specialist tax', subtitle: 'Inheritance and complex cases', icon: '◇' },
];
export const calculators = [
  { id: 'salary', title: 'Salary take-home', category: 'personal', description: 'Income Tax and employee National Insurance on one salary.', nationSensitive: true, fields: [{ id: 'gross', label: 'Annual gross salary', type: 'money', value: '42000' }] },
  { id: 'self-employed', title: 'Self-employed profit', category: 'business', description: 'Income Tax and Class 4 National Insurance for a sole trader.', nationSensitive: true, fields: [{ id: 'profit', label: 'Annual taxable profit', type: 'money', value: '42000' }] },
  { id: 'dividends', title: 'Dividend tax', category: 'personal', description: 'Tax on dividends alongside other income.', nationSensitive: false, fields: [{ id: 'otherIncome', label: 'Other annual income', type: 'money', value: '30000' }, { id: 'dividends', label: 'Annual dividends', type: 'money', value: '10000' }] },
  { id: 'cgt', title: 'Capital Gains Tax', category: 'personal', description: 'General individual CGT rates after the annual exempt amount.', nationSensitive: false, fields: [{ id: 'gain', label: 'Total taxable gain before annual exemption', type: 'money', value: '20000' }, { id: 'income', label: 'Taxable income after allowances', type: 'money', value: '30000' }] },
  { id: 'vat', title: 'VAT on a sale', category: 'business', description: 'Add standard, reduced or zero-rated VAT to a net price.', nationSensitive: false, fields: [{ id: 'net', label: 'Price before VAT', type: 'money', value: '1000' }, { id: 'rate', label: 'VAT rate', type: 'select', value: '.2', options: [['.2', 'Standard · 20%'], ['.05', 'Reduced · 5%'], ['0', 'Zero · 0%']] }] },
  { id: 'corporation', title: 'Corporation Tax', category: 'business', description: 'Small profits, main rate and marginal relief.', nationSensitive: false, fields: [{ id: 'profit', label: 'Taxable total profits', type: 'money', value: '100000' }, { id: 'associated', label: 'Other associated companies', type: 'number', value: '0' }, { id: 'shortPeriod', label: 'Accounting period shorter than 12 months', type: 'checkbox', value: false }] },
  { id: 'property', title: 'Property purchase tax', category: 'property', description: 'SDLT, LBTT or LTT for a residential purchase.', nationSensitive: true, fields: [{ id: 'price', label: 'Purchase price', type: 'money', value: '350000' }, { id: 'firstBuyer', label: 'Eligible first-time buyer', type: 'checkbox', value: false }, { id: 'additional', label: 'Additional property', type: 'checkbox', value: false }, { id: 'nonresident', label: 'Non-UK resident (England & Northern Ireland)', type: 'checkbox', value: false }, { id: 'complex', label: 'Company, lease, linked or mixed-use transaction', type: 'checkbox', value: false }] },
  { id: 'iht', title: 'Inheritance Tax', category: 'specialist', description: 'A simple estate estimate using the nil-rate bands and 40% rate.', nationSensitive: false, fields: [{ id: 'estate', label: 'Net estate value', type: 'money', value: '600000' }, { id: 'home', label: 'Qualifying home value', type: 'money', value: '250000' }, { id: 'descendants', label: 'Home passes to direct descendants', type: 'checkbox', value: true }, { id: 'complex', label: 'Gifts, spouse, charity, transferred bands or other reliefs', type: 'checkbox', value: false }] },
];
export const referenceAreas = [
  { title: 'PAYE & employment benefits', category: 'personal', note: 'Tax codes, benefits and student loans need payroll facts and timing.' },
  { title: 'Pensions & savings', category: 'personal', note: 'Reliefs and allowances depend on the wider income position.' },
  { title: 'Business reliefs & capital allowances', category: 'business', note: 'Eligibility depends on asset, trade and accounting facts.' },
  { title: 'Trusts & estates', category: 'specialist', note: 'Beneficiaries, reliefs and earlier transfers require review.' },
  { title: 'Non-residence & cross-border tax', category: 'specialist', note: 'Residence tests and treaty terms require verified facts.' },
];
export const getCalculator = id => calculators.find(c => c.id === id);
