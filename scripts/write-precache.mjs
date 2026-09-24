import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
const root = new URL('../dist/', import.meta.url).pathname.replace(/^\/(?=[A-Z]:\/)/, '');
async function list(dir) { const items = []; for (const name of await readdir(dir)) { const path = join(dir, name); if ((await stat(path)).isDirectory()) items.push(...await list(path)); else items.push('/' + relative(root, path).split(sep).join('/')); } return items; }
const files = (await list(root)).filter(path => path !== '/precache.json').sort();
const hash = createHash('sha256');
for (const path of files.filter(path => path !== '/sw.js')) {
  hash.update(path);
  hash.update(await readFile(join(root, path.slice(1))));
}
const version = hash.digest('hex').slice(0, 16);
const workerPath = join(root, 'sw.js');
const worker = await readFile(workerPath, 'utf8');
await writeFile(workerPath, worker.replace('__UKTAXER_CACHE_VERSION__', version));
const assets = files.map(path => path === '/index.html' ? '/' : path);
assets.push('/precache.json');
await writeFile(join(root, 'precache.json'), JSON.stringify({ version, assets }, null, 2));
console.log(`Offline manifest: ${assets.length} files`);
