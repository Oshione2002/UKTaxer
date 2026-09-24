import { readFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const manifest = JSON.parse(await readFile(new URL('../dist/precache.json', import.meta.url)));
let total = 0;
for (let i = 0; i < manifest.assets.length; i += 4) {
  await Promise.all(manifest.assets.slice(i, i + 4).map(async path => {
    const response = await fetch(new URL(path, base));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const bytes = (await response.arrayBuffer()).byteLength;
    if (!bytes) throw new Error(`${path}: empty response`);
    total += bytes;
  }));
}
console.log(`${manifest.assets.length} offline assets fetched successfully (${(total / 1048576).toFixed(1)} MB)`);
