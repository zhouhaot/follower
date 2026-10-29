import './check-assets.mjs';
import {cp,mkdir,rm,readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
const files={};
for(const file of (await readdir('dist',{recursive:true})).sort()) {
  if((await stat(`dist/${file}`)).isFile()) files[file]=createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex');
}
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
await writeFile('dist/version.json',JSON.stringify({
  commit:git('rev-parse','HEAD'),
  sourceDirty:Boolean(git('status','--porcelain','--','public','scripts','package.json','package-lock.json')),
  builtAt:new Date().toISOString(),
  payloadSha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),
  files
},null,2)+'\n');
console.log('Static build ready in dist/.');
