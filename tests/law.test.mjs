import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => readFile(new URL(path, import.meta.url), 'utf8');
test('every registered law document has complete local text, searchable provisions, and official links', async () => {
  const manifest = JSON.parse(await read('../public/law/manifest.json'));
  assert.equal(manifest.ruleset, '2026.1');
  assert.ok(manifest.documents.length >= 20);
  for (const document of manifest.documents) {
    assert.match(document.source, /^https:\/\/www\.legislation\.gov\.uk\//);
    assert.match(document.sha256, /^[a-f0-9]{64}$/);
    const sections = JSON.parse(await read(`../public${document.index}`));
    const fullText = await read(`../public${document.text}`);
    assert.equal(sections.length, document.provisions, document.title);
    assert.ok(fullText.length > 300, document.title);
    assert.ok(sections.every(section => section.text && section.url.startsWith(document.source + '/')), document.title);
    assert.ok(fullText.includes(sections.at(-1).text.slice(0, 60)), document.title);
  }
});

test('reviewed ruleset maps each supported calculator area to dated official sources', async () => {
  const register = JSON.parse(await read('../rules/ruleset-2026.1.json'));
  assert.equal(register.version, '2026.1');
  for (const area of ['personal', 'business', 'property', 'specialist']) assert.ok(register.rules.some(rule => rule.area === area));
  for (const rule of register.rules) {
    assert.match(rule.effectiveFrom, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(rule.source, /^https:\/\//);
    assert.ok(rule.jurisdictions.length > 0);
  }
});
