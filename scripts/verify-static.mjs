import {readFile,readdir,access} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'public'),failures=[],queue=[],visited=new Set();
const map={'three':'./vendor/three.module.js','three/addons/':'./vendor/three/'};
async function exists(file,source){try{await access(file);return true}catch{failures.push(source+': '+path.relative(root,file));return false}}
for(const name of (await readdir(root)).filter(n=>n.endsWith('.html'))){
 const file=path.join(root,name),text=await readFile(file,'utf8');
 for(const match of text.matchAll(/(?:href|src)="(\.\/[^"?#]+)"/g)){
  const target=path.resolve(root,match[1]);if(await exists(target,name)&&/\.(?:mjs|js)$/.test(target))queue.push(target);
 }
}
while(queue.length){
 const file=queue.pop();if(visited.has(file))continue;visited.add(file);
 const text=await readFile(file,'utf8');
 for(const match of text.matchAll(/(?:from\s*|import\s*\(?)["']([^"']+)["']/g)){
  const ref=match[1];let target;
  if(ref.startsWith('.'))target=path.resolve(path.dirname(file),ref);
  else if(ref==='three')target=path.resolve(root,map.three);
  else if(ref.startsWith('three/addons/'))target=path.resolve(root,map['three/addons/']+ref.slice(13));
  else if(/^https?:/.test(ref))continue;
  else continue;
  if(await exists(target,path.relative(root,file))&&/\.(?:mjs|js)$/.test(target))queue.push(target);
 }
 // Literal static image paths embedded in page templates; dynamic cards are browser-tested.
 for(const match of text.matchAll(/(?:src|href)=["'](\.\/assets\/[^"'${}]+)["']/g))await exists(path.resolve(path.dirname(file),match[1]),path.relative(root,file));
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}else console.log(`Static HTML and ${visited.size} reachable module references resolve.`);
