import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, allowance, incomeTax, InputError } from '../src/tax.js';

test('personal allowance tapers at £1 per £2 over £100,000', () => {
  assert.equal(allowance(100000), 12570);
  assert.equal(allowance(110000), 7570);
  assert.equal(allowance(125140), 0);
});
test('salary includes income tax and employee NI at boundaries', () => {
  assert.equal(calculate('salary', { gross: 12570 }, 'england').amount, 0);
  assert.equal(calculate('salary', { gross: 50270 }, 'england').amount, 10556);
  assert.equal(calculate('salary', { gross: 42000 }, 'wales').net, 33759.6);
  assert.equal(calculate('salary', { gross: 42000 }, 'northernIreland').amount, calculate('salary', { gross: 42000 }, 'england').amount);
});
test('Scottish starter and higher bands differ from England', () => {
  assert.equal(incomeTax(16537, 'scotland').total, 753.73);
  assert.equal(incomeTax(75000, 'scotland').total, 19482.05);
  assert.ok(calculate('salary', { gross: 75000 }, 'scotland').amount > calculate('salary', { gross: 75000 }, 'england').amount);
});
test('self-employed Class 4 NIC thresholds', () => {
  assert.equal(calculate('self-employed', { profit: 12570 }, 'england').amount, 0);
  assert.equal(calculate('self-employed', { profit: 50270 }, 'england').amount, 9802);
});
test('VAT rates, CGT allowance, and corporation marginal relief', () => {
  assert.equal(calculate('vat', { net: 100, rate: .2 }, 'england').amount, 20);
  assert.equal(calculate('vat', { net: 100, rate: .05 }, 'england').gross, 105);
  assert.equal(calculate('cgt', { gain: 3000, income: 0 }, 'wales').amount, 0);
  assert.equal(calculate('corporation', { profit: 50000, associated: 0 }, 'england').amount, 9500);
  assert.equal(calculate('corporation', { profit: 100000, associated: 0 }, 'england').amount, 22750);
  assert.equal(calculate('corporation', { profit: 250000, associated: 0 }, 'england').amount, 62500);
});
test('residential property bands in all four nations', () => {
  assert.equal(calculate('property', { price: 250000 }, 'england').amount, 2500);
  assert.equal(calculate('property', { price: 250000 }, 'northernIreland').amount, 2500);
  assert.equal(calculate('property', { price: 250000 }, 'scotland').amount, 2100);
  assert.equal(calculate('property', { price: 250000 }, 'wales').amount, 1500);
  assert.equal(calculate('property', { price: 400000, additional: true }, 'wales').amount, 29950);
  assert.equal(calculate('property', { price: 350000, firstBuyer: true }, 'england').amount, 2500);
});
test('dividend allowance occupies the tax band', () => {
  assert.equal(calculate('dividends', { otherIncome: 12570, dividends: 500 }, 'england').amount, 0);
  assert.equal(calculate('dividends', { otherIncome: 12570, dividends: 1500 }, 'england').amount, 107.5);
});
test('simple inheritance tax uses the residence nil-rate band and flags complex estates', () => {
  assert.equal(calculate('iht', { estate: 600000, home: 250000, descendants: true }, 'england').amount, 40000);
  assert.equal(calculate('iht', { estate: 2350000, home: 250000, descendants: true }, 'scotland').amount, 810000);
  assert.equal(calculate('iht', { estate: 600000, home: 250000, complex: true }, 'wales').status, 'review');
});
test('bad inputs do not leave a stale number', () => {
  assert.throws(() => calculate('salary', { gross: '-1' }, 'england'), InputError);
  assert.throws(() => calculate('salary', { gross: '' }, 'england'), InputError);
  assert.throws(() => calculate('salary', { gross: 'x' }, 'england'), InputError);
  assert.throws(() => calculate('salary', { gross: 5 }, ''), InputError);
  assert.equal(calculate('corporation', { profit: 100000, shortPeriod: true }, 'england').status, 'review');
});
