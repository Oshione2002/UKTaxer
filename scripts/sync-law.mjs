import { DOMParser } from '@xmldom/xmldom';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

// A release is built from pinned official snapshots. Review changes before rerunning.
const documents = [
  ['ukpga/2007/3', 'Income Tax Act 2007', 'personal'],
  ['ukpga/2003/1', 'Income Tax (Earnings and Pensions) Act 2003', 'personal'],
  ['ukpga/2005/5', 'Income Tax (Trading and Other Income) Act 2005', 'personal'],
  ['ukpga/1992/12', 'Taxation of Chargeable Gains Act 1992', 'personal'],
  ['ukpga/1992/4', 'Social Security Contributions and Benefits Act 1992', 'personal'],
  ['ukpga/1992/7', 'Social Security Contributions and Benefits (Northern Ireland) Act 1992', 'personal'],
  ['uksi/2001/1004', 'Social Security (Contributions) Regulations 2001', 'personal'],
  ['uksi/2026/231', 'National Insurance Rates and Thresholds Regulations 2026', 'personal'],
  ['ukpga/1984/51', 'Inheritance Tax Act 1984', 'specialist'],
  ['ukpga/2009/4', 'Corporation Tax Act 2009', 'business'],
  ['ukpga/2010/4', 'Corporation Tax Act 2010', 'business'],
  ['ukpga/1994/23', 'Value Added Tax Act 1994', 'business'],
  ['ukpga/2001/2', 'Capital Allowances Act 2001', 'business'],
  ['ukpga/2003/14', 'Finance Act 2003', 'property'],
  ['asp/2013/11', 'Land and Buildings Transaction Tax (Scotland) Act 2013', 'property'],
  ['anaw/2017/1', 'Land Transaction Tax and Anti-avoidance of Devolved Taxes (Wales) Act 2017', 'property'],
  ['ssi/2015/126', 'LBTT (Tax Rates and Tax Bands) (Scotland) Order 2015', 'property'],
  ['ssi/2024/367', 'LBTT Additional Dwelling Supplement Amendment Order 2024', 'property'],
  ['wsi/2018/128', 'LTT (Tax Bands and Tax Rates) (Wales) Regulations 2018', 'property'],
  ['wsi/2022/1027', 'LTT Rates Amendment Regulations 2022', 'property'],
  ['wsi/2024/1311', 'LTT Rates Amendment Regulations 2024', 'property'],
  ['ukpga/2026/11', 'Finance Act 2026', 'cross-cutting'],
];

const out = new URL('../public/law/', import.meta.url);
const cache = new URL('../.law-cache/', import.meta.url);
await mkdir(out, { recursive: true });
await mkdir(cache, { recursive: true });
function readable(node) {
  if (node.nodeType === 3) return node.nodeValue;
  const content = Array.from(node.childNodes || []).map(readable).join('');
  const name = node.localName;
  if (name === 'Pnumber') return ` ${content} `;
  if (name === 'Text' || name === 'Title') return `${content} `;
  if (/^P[1-9]$/.test(name) || ['Table', 'Tabular', 'Row', 'ListItem'].includes(name)) return `\n${content}`;
  return content;
}
const manifest = [];
for (const [id, title, area] of documents) {
  const slug = id.replaceAll('/', '-');
  const source = `https://www.legislation.gov.uk/${id}`;
  let xml;
  try { xml = await readFile(new URL(`${slug}.xml`, cache), 'utf8'); }
  catch {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetch(`${source}/data.xml`, { headers: { 'User-Agent': 'UKTaxer/1.0 (public legal reference)' }, signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        xml = await response.text(); break;
      } catch (error) { if (attempt === 3) throw new Error(`${id}: ${error.message}`); await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000)); }
    }
  }
  if (!xml.startsWith('<Legislation')) throw new Error(`${id}: unexpected document`);
  const sha256 = createHash('sha256').update(xml).digest('hex');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const sections = [];
  const nodes = document.getElementsByTagName('P1');
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes.item(i);
    const uri = node.getAttribute('DocumentURI');
    if (!uri) continue;
    const heading = node.parentNode?.getElementsByTagName?.('Title')?.item(0)?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const text = readable(node).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) continue;
    sections.push({ heading: heading || node.getAttribute('id') || `Provision ${i + 1}`, text, url: uri.replace('http://', 'https://') });
  }
  const meta = { id, title, area, source, revision: 'latest available revised text at ingestion', retrieved: new Date().toISOString(), sha256, bytes: Buffer.byteLength(xml), provisions: sections.length, text: `/law/${slug}.txt`, index: `/law/${slug}.json` };
  await writeFile(new URL(`${slug}.xml`, cache), xml);
  await writeFile(new URL(`${slug}.json`, out), JSON.stringify(sections));
  await writeFile(new URL(`${slug}.txt`, out), `${title}\nOfficial source: ${source}\nRevision: ${meta.revision}\nRetrieved: ${meta.retrieved}\nOfficial XML SHA-256: ${sha256}\n\n${sections.map((s, i) => `${i + 1}. ${s.heading}\n${s.text}\nOfficial provision: ${s.url}`).join('\n\n')}\n`);
  manifest.push(meta);
  process.stdout.write(`${title}: ${sections.length} provisions, ${(meta.bytes / 1048576).toFixed(1)} MB\n`);
}
await writeFile(new URL('manifest.json', out), JSON.stringify({ ruleset: '2026.1', retrieved: new Date().toISOString(), licence: 'Open Government Licence v3.0', attribution: 'Contains public sector information licensed under the Open Government Licence v3.0.', documents: manifest }, null, 2));
