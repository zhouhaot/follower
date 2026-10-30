import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {cards} from '../public/cards.mjs';

const root = path.resolve(import.meta.dirname,'..');
const publicDir = path.join(root,'public');
const tracked = new Set(execFileSync('git',['ls-files','-z','public'],{cwd:root,encoding:'utf8'}).split('\0'));
const files = await readdir(publicDir,{recursive:true});
let count = 0;
const references = new Set();
for (const file of files) {
  if (!(await stat(path.join(publicDir,file))).isFile()) continue;
  assert.ok(tracked.has(`public/${file}`),`Untracked runtime resource: ${file}`);
  count++;
  if (file.startsWith('assets/originals/_source/')) continue; // Preserved upstream source, not application entrypoints.
  if (!/\.(html|css|mjs)$/.test(file)) continue;
  const source = await readFile(path.join(publicDir,file),'utf8');
  // Literal local resources; computed card/model paths are covered explicitly below.
  const patterns = [/\b(?:src|href)=["']([^"'<>]+)["']/g, /\b(?:from\s*|import\s*\(|new URL\s*\()\s*["'](\.\.?\/[^"']+)["']/g, /url\(["']?([^)'"\s]+)["']?\)/g, /["']((?:\.\/)?(?:assets|audio|vendor)\/[^"']+)["']/g];
  for (const pattern of patterns) for (const [,ref] of source.matchAll(pattern)) {
    if (/^(?:https?:|data:|#|\$)/.test(ref) || /[${}<>]/.test(ref)) continue;
    const target = ref.split(/[?#]/)[0];
    if (!target) continue;
    references.add(path.resolve(path.dirname(path.join(publicDir,file)),target));
  }
}
assert.equal(cards.length,5);
assert.equal(new Set(cards.map(c=>c.key)).size,5);
assert.equal(new Set(cards.map(c=>c.targetIndex)).size,5);
for (const card of cards) {
  assert.equal(Boolean(card.audioUrl),card.audioAvailable,`${card.key}: audio state mismatch`);
  for (const resource of [card.image,card.artworkImage,card.target,card.audioUrl,`assets/renders/${card.key}-bloom.png`].filter(Boolean)) references.add(path.resolve(publicDir,resource));
}
for (const file of references) {
  assert.ok(file.startsWith(publicDir+path.sep),`Resource outside public: ${file}`);
  await stat(file); // Import-map prefixes may intentionally refer to a directory.
}
console.log(JSON.stringify({runtimeFiles:count,localReferences:references.size,cards:cards.length,audioCards:cards.filter(c=>c.audioAvailable).map(c=>c.key),scope:'Tracked public files, literal local references and card/model paths; browser tests cover runtime loading.'}));
