import {cp,copyFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';

const source='dist',target='release';
const files=['index.html','app-v27.js','ai.js','theme.js','styles-v39.css','ai.css','manifest.webmanifest','calculators.js','tax-areas.js','engine.js','export.js','service-worker.js'];
await mkdir(target,{recursive:true});
await rm(join(target,'coverage.js'),{force:true});
for(const file of files)await copyFile(join(source,file),join(target,file));
await mkdir(join(target,'assets'),{recursive:true});
await copyFile(join(source,'assets','icon.svg'),join(target,'assets','icon.svg'));
await cp(join(source,'law'),join(target,'law'),{recursive:true});
console.log(`Prepared ${files.length} application files, the icon and the local law corpus in ${target}.`);
