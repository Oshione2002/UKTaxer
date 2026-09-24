import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
const root = new URL('../dist/', import.meta.url).pathname.replace(/^\/(?=[A-Z]:\/)/, '');
async function list(dir) { const items = []; for (const name of await readdir(dir)) { const path = join(dir, name); if ((await stat(path)).isDirectory()) items.push(...await list(path)); else items.push('/' + relative(root, path).split(sep).join('/')); } return items; }
const assets = (await list(root)).filter(path => path !== '/precache.json').map(path => path === '/index.html' ? '/' : path);
assets.push('/precache.json');
await writeFile(join(root, 'precache.json'), JSON.stringify({ version: '2026.1', assets }, null, 2));
console.log(`Offline manifest: ${assets.length} files`);
