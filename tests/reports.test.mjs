import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { exportPDF, exportExcel } from '../src/reports.js';

test('PDF and Excel reports contain inputs, breakdown, assumptions and sources', async () => {
  const estimate = { status: 'estimate', amount: 8240.40, breakdown: [{ label: 'Income Tax', amount: 5886 }, { label: 'Employee National Insurance', amount: 2354.40 }], assumptions: ['2026–27 tax year'], sources: ['https://www.gov.uk/income-tax-rates'] };
  const pdf = await exportPDF('Salary take-home', 'england', { gross: 42000 }, estimate);
  const parsed = await PDFDocument.load(await pdf.arrayBuffer());
  assert.ok(parsed.getPageCount() >= 1);
  const xlsx = await exportExcel('Salary take-home', 'england', { gross: 42000 }, estimate);
  const zip = await JSZip.loadAsync(await xlsx.arrayBuffer());
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  for (const expected of ['Salary take-home', 'Annual gross salary', 'Income Tax', 'Employee National Insurance', '2026–27 tax year', 'https://www.gov.uk/income-tax-rates']) assert.ok(sheet.includes(expected), expected);
});
