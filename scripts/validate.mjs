import {readFile,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {CALCULATORS,SOURCE_LINKS} from '../dist/calculators.js';
const root=new URL('../',import.meta.url);
for(const file of ['dist/app-v27.js','dist/ai.js','dist/theme.js','dist/engine.js','dist/calculators.js','dist/coverage.js','dist/export.js','dist/service-worker.js','api/gemini.js','api/statement.js']){
 const proc=spawnSync(process.execPath,['--check',fileURLToPath(new URL(file,root))],{encoding:'utf8'});
 assert.equal(proc.status,0,file+': '+proc.stderr);
}
assert.equal(CALCULATORS.length,24);
for(const c of CALCULATORS){
 assert.equal(new Set(c.fields.filter(f=>f.key).map(f=>f.key)).size,c.fields.filter(f=>f.key).length,c.id+' duplicate fields');
 assert.ok(c.sources.length&&c.sources.every(id=>SOURCE_LINKS[id]?.url.startsWith('https://')),c.id+' invalid official sources');
}
const html=await readFile(new URL('dist/index.html',root),'utf8');
for(const [,asset] of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)){
 if(/^(?:https?:|#)/.test(asset))continue;
 const url=new URL('dist/'+asset.split('?')[0],root);
 assert.ok((await stat(url)).isFile(),'Missing asset '+asset);
}
const manifest=JSON.parse(await readFile(new URL('dist/law/manifest.json',root)));
assert.ok(manifest.documents.length>=22);
for(const doc of manifest.documents){
 for(const path of [doc.index,doc.text])assert.ok((await stat(new URL('dist'+path,root))).size>0,doc.id+' missing '+path);
}
const worker=await readFile(new URL('dist/service-worker.js',root),'utf8');
assert.match(worker,/manifest\.documents\.flatMap/);
const vercel=JSON.parse(await readFile(new URL('vercel.json',root)));
assert.equal(vercel.outputDirectory,'release');
console.log('Validated 24 UK workspaces, '+manifest.documents.length+' local law documents, offline assets and JavaScript syntax.');
