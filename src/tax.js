export const RULESET = '2026.1';
export const TAX_YEAR = '2026–27';
export const NATIONS = { england: 'England', scotland: 'Scotland', wales: 'Wales', northernIreland: 'Northern Ireland' };

export class InputError extends Error { constructor(message) { super(message); this.name = 'InputError'; } }
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
export function money(value, label = 'Amount') {
  if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) < 0) throw new InputError(`${label} must be a valid amount of £0 or more.`);
  return Number(value);
}
export function bandTax(amount, bands) {
  let total = 0, lower = 0;
  const lines = [];
  for (const [upper, rate] of bands) {
    const taxable = Math.max(0, Math.min(amount, upper) - lower);
    if (taxable) { const tax = round(taxable * rate); lines.push({ label: `${Math.round(rate * 10000) / 100}% on £${taxable.toLocaleString('en-GB')}`, amount: tax }); total += tax; }
    lower = upper;
    if (amount <= upper) break;
  }
  return { total: round(total), lines };
}
export function allowance(income) { return Math.max(0, 12570 - Math.max(0, income - 100000) / 2); }
const scottishBands = [[3967, .19], [16956, .20], [31092, .21], [62430, .42], [125140, .45], [Infinity, .48]];
const restBands = [[37700, .20], [125140, .40], [Infinity, .45]];
export function incomeTax(gross, nation = 'england') {
  const a = allowance(gross), taxable = Math.max(0, gross - a);
  // Scottish thresholds are expressed as total income; convert to taxable slices at the full allowance.
  const bands = nation === 'scotland' ? scottishBands : restBands;
  const result = bandTax(taxable, bands);
  return { ...result, allowance: a, taxable };
}
const result = (amount, breakdown, assumptions, sources, extra = {}) => ({ status: 'estimate', amount: round(amount), breakdown, assumptions, sources, ...extra });
const review = (reason, sources = []) => ({ status: 'review', reason, sources });
export const SOURCES = {
  income: 'https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past',
  nic: 'https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027',
  selfNic: 'https://www.gov.uk/self-employed-national-insurance-rates',
  dividends: 'https://www.gov.uk/tax-on-dividends',
  vat: 'https://www.gov.uk/vat-rates',
  cgt: 'https://www.gov.uk/capital-gains-tax/rates',
  corporation: 'https://www.gov.uk/corporation-tax-rates',
  sdlt: 'https://www.gov.uk/stamp-duty-land-tax/residential-property-rates',
  lbtt: 'https://revenue.scot/taxes/land-buildings-transaction-tax/residential-property',
  ads: 'https://revenue.scot/taxes/land-buildings-transaction-tax/additional-dwelling-supplement-ads',
  ltt: 'https://www.gov.wales/land-transaction-tax-rates-and-bands',
  iht: 'https://www.gov.uk/inheritance-tax',
};
export function calculate(id, input, nation) {
  if (!NATIONS[nation]) throw new InputError('Choose a UK nation to see an estimate.');
  switch (id) {
    case 'salary': {
      const gross = money(input.gross, 'Annual salary');
      const tax = incomeTax(gross, nation);
      const ni = bandTax(gross, [[12570, 0], [50270, .08], [Infinity, .02]]);
      return result(tax.total + ni.total, [{ label: 'Income Tax', amount: tax.total }, { label: 'Employee National Insurance', amount: ni.total }], ['2026–27 tax year', 'One employment; standard Personal Allowance', 'No pension contributions, student loan, benefits or other income'], [SOURCES.income, SOURCES.nic], { net: round(gross - tax.total - ni.total) });
    }
    case 'self-employed': {
      const profit = money(input.profit, 'Annual profit');
      const tax = incomeTax(profit, nation);
      const ni = bandTax(profit, [[12570, 0], [50270, .06], [Infinity, .02]]);
      return result(tax.total + ni.total, [{ label: 'Income Tax', amount: tax.total }, { label: 'Class 4 National Insurance', amount: ni.total }], ['2026–27 tax year', 'Sole trader with trading profit only', 'No other income, losses, pension relief or student loan'], [SOURCES.income, SOURCES.selfNic], { net: round(profit - tax.total - ni.total) });
    }
    case 'dividends': {
      const other = money(input.otherIncome, 'Other income'), dividends = money(input.dividends, 'Dividends');
      const pa = allowance(other + dividends);
      const taxableOther = Math.max(0, other - pa);
      const remainingAllowance = Math.max(0, pa - other);
      const taxableDiv = Math.max(0, dividends - remainingAllowance);
      // UK dividend bands apply throughout the UK. Other income uses up the bands first.
      const lowerEdge = taxableOther + Math.min(500, taxableDiv), upperEdge = taxableOther + taxableDiv;
      const inBand = (low, high) => Math.max(0, Math.min(upperEdge, high) - Math.max(lowerEdge, low));
      const basic = inBand(0, 37700), higher = inBand(37700, 125140), additional = inBand(125140, Infinity);
      const amount = round(basic * .1075 + higher * .3575 + additional * .3935);
      return result(amount, [{ label: 'Basic rate dividends', amount: round(basic * .1075) }, { label: 'Higher rate dividends', amount: round(higher * .3575) }, { label: 'Additional rate dividends', amount: round(additional * .3935) }], ['2026–27 tax year', '£500 dividend allowance', 'Other income is non-savings income; result is dividend tax only'], [SOURCES.income, SOURCES.dividends]);
    }
    case 'vat': {
      const net = money(input.net, 'Net price');
      const rate = Number(input.rate);
      if (![0, .05, .2].includes(rate)) throw new InputError('Select a VAT rate.');
      const amount = round(net * rate);
      return result(amount, [{ label: 'VAT', amount }], [`${rate * 100}% rate selected`, 'Item eligibility for the selected rate must be checked'], [SOURCES.vat], { gross: round(net + amount) });
    }
    case 'corporation': {
      const profit = money(input.profit, 'Taxable profit');
      const companies = Number(input.associated ?? 0);
      if (!Number.isInteger(companies) || companies < 0 || companies > 50) throw new InputError('Associated companies must be a whole number from 0 to 50.');
      if (input.shortPeriod) return review('Short accounting periods change the thresholds. A review is needed.', [SOURCES.corporation]);
      const divisor = companies + 1, lower = 50000 / divisor, upper = 250000 / divisor;
      let tax;
      if (profit <= lower) tax = profit * .19;
      else if (profit >= upper) tax = profit * .25;
      else tax = profit * .25 - (upper - profit) * 3 / 200;
      return result(tax, [{ label: 'Corporation Tax', amount: round(tax) }], ['12-month accounting period', `${companies} other associated companies`, 'Taxable total profits equal augmented profits; no reliefs or ring-fence profits'], [SOURCES.corporation]);
    }
    case 'property': {
      const price = money(input.price, 'Purchase price');
      const additional = !!input.additional, first = !!input.firstBuyer;
      if (additional && first) throw new InputError('First-time buyer relief cannot apply to an additional property.');
      if (input.complex) return review('Company purchases, linked transactions, leases and mixed-use property need a specialist review.', [SOURCES.sdlt, SOURCES.lbtt, SOURCES.ltt]);
      if (nation === 'scotland') {
        const bands = first ? [[175000, 0], [250000, .02], [325000, .05], [750000, .10], [Infinity, .12]] : [[145000, 0], [250000, .02], [325000, .05], [750000, .10], [Infinity, .12]];
        const base = bandTax(price, bands), supplement = additional ? round(price * .08) : 0;
        return result(base.total + supplement, [...base.lines, ...(supplement ? [{ label: 'Additional Dwelling Supplement', amount: supplement }] : [])], ['Scottish residential purchase', 'First-time buyer relief requires eligibility', 'ADS may be reclaimable in some circumstances'], [SOURCES.lbtt, SOURCES.ads]);
      }
      if (nation === 'wales') {
        const base = additional ? bandTax(price, [[180000, .05], [250000, .085], [400000, .10], [750000, .125], [1500000, .15], [Infinity, .17]]) : bandTax(price, [[225000, 0], [400000, .06], [750000, .075], [1500000, .10], [Infinity, .12]]);
        return result(base.total, base.lines, [`Welsh ${additional ? 'higher' : 'main'} residential rates`, 'Higher rates depend on ownership and replacement of a main residence', 'No first-time buyer relief in Wales'], [SOURCES.ltt]);
      }
      const bands = first && price <= 500000 ? [[300000, 0], [500000, .05], [Infinity, .05]] : [[125000, 0], [250000, .02], [925000, .05], [1500000, .10], [Infinity, .12]];
      const base = bandTax(price, bands), surcharge = additional ? round(price * .05) : 0;
      const nonresident = input.nonresident ? round(price * .02) : 0;
      return result(base.total + surcharge + nonresident, [...base.lines, ...(surcharge ? [{ label: 'Additional property surcharge', amount: surcharge }] : []), ...(nonresident ? [{ label: 'Non-UK resident surcharge', amount: nonresident }] : [])], ['England or Northern Ireland residential purchase', 'First-time buyer relief requires eligibility and price at most £500,000', 'No lease, company, linked transaction or mixed-use property'], [SOURCES.sdlt]);
    }
    case 'cgt': {
      const gain = money(input.gain, 'Gain'), income = money(input.income, 'Taxable income');
      const taxable = Math.max(0, gain - 3000);
      const basicCapacity = Math.max(0, 37700 - income);
      const lower = Math.min(taxable, basicCapacity), upper = taxable - lower;
      return result(lower * .18 + upper * .24, [{ label: '18% band', amount: round(lower * .18) }, { label: '24% band', amount: round(upper * .24) }], ['2026–27 tax year', '£3,000 Annual Exempt Amount', 'Individual, general CGT rates; no losses, reliefs or special assets', 'Income entered is taxable income after allowances'], [SOURCES.cgt]);
    }
    case 'iht': {
      const estate = money(input.estate, 'Net estate'), home = money(input.home, 'Qualifying home value');
      if (home > estate) throw new InputError('Qualifying home value cannot exceed the net estate.');
      if (input.complex) return review('Gifts, spouse or charity exemptions, transferable bands and business or agricultural relief require a reviewed calculation.', [SOURCES.iht]);
      const residence = input.descendants ? Math.max(0, Math.min(175000, home) - Math.max(0, estate - 2000000) / 2) : 0;
      const taxable = Math.max(0, estate - 325000 - residence), amount = round(taxable * .4);
      return result(amount, [{ label: 'Inheritance Tax at 40%', amount }], ['2026–27 thresholds', 'One individual, no gifts in seven years', 'No spouse or charity exemption, transferable bands or reliefs', `Taxable estate after nil-rate bands: £${round(taxable).toLocaleString('en-GB')}`, `Residence nil-rate band applied: £${round(residence).toLocaleString('en-GB')}`], [SOURCES.iht]);
    }
    default: throw new InputError('This calculator is not available.');
  }
}
