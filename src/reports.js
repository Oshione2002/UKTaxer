import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { RULESET, TAX_YEAR, NATIONS } from './tax.js';
import { calculators } from './catalog.js';

const currency = value => `£${Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const rows = (title, nation, input, output) => [
  ['UKTaxer estimate', title], ['Ruleset', RULESET], ['Tax year', TAX_YEAR], ['Nation', NATIONS[nation] || 'UK-wide'], ['Created', new Date().toISOString()],
  ['Result', output.status === 'estimate' ? currency(output.amount) : `Review needed: ${output.reason}`],
  ['Inputs', ''], ...Object.entries(input).map(([key, value]) => [calculators.find(c => c.title === title)?.fields.find(f => f.id === key)?.label || key, String(value)]),
  ['Breakdown', ''], ...(output.breakdown || []).map(item => [item.label, currency(item.amount)]),
  ['Assumptions', ''], ...(output.assumptions || []).map(item => [item, '']),
  ['Sources', ''], ...(output.sources || []).map(item => [item, item]),
  ['Notice', 'Illustrative estimate. Check eligibility and source rules before relying on it.'],
];
export async function exportPDF(title, nation, input, output) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]), y = 790;
  const line = (left, right, heading = false) => {
    const text = right ? `${left}: ${right}` : left;
    const chunks = text.match(/.{1,90}/g) || [text];
    for (const chunk of chunks) {
      if (y < 55) { page = pdf.addPage([595, 842]); y = 790; }
      page.drawText(chunk.trim(), { x: 45, y, font: heading ? bold : font, size: heading ? 12 : 9, color: rgb(.06, .14, .36) });
      y -= heading ? 23 : 15;
    }
  };
  for (const [left, right] of rows(title, nation, input, output)) line(left, right, ['UKTaxer estimate', 'Inputs', 'Breakdown', 'Assumptions', 'Sources'].includes(left));
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}
export async function exportExcel(title, nation, input, output) {
  const zip = new JSZip();
  const cells = rows(title, nation, input, output).map((row, i) => `<row r="${i + 1}">${row.map((value, j) => `<c r="${j ? 'B' : 'A'}${i + 1}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join('')}</row>`).join('');
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Estimate" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="48" customWidth="1"/><col min="2" max="2" width="80" customWidth="1"/></cols><sheetData>${cells}</sheetData></worksheet>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
