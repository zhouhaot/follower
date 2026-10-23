import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getHandheldState} from '../public/handheld-state.mjs';
const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
test('separate handheld hero uses registered immutable card faces',()=>{
 assert.match(app,/class="handheld-frame"/);
 assert.match(app,/handheld-relief\.webp/);
 assert.match(app,/handheld-front\.webp/);
 assert.doesNotMatch(app,/class="exhibit-photo"/);
 assert.doesNotMatch(app,/class="fallback-(?:case|plinth)"/);
 assert.match(css,/\.hero-model\.model-ready \.handheld-card-flip\{display:none/);
});
test('handheld movement stays finite, native-scroll-driven and exactly reversible',()=>{
 assert.match(app,/getHandheldState\(p\)/);
 assert.match(app,/addEventListener\('scroll',schedule,\{passive:true\}\)/);
 assert.doesNotMatch(app,/addEventListener\(['"](?:wheel|touchmove)['"]/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.handheld-hand-layer,\.handheld-card-media,\.handheld-card-flip/);
 const positions=[0,.1,.3,.42,.55,1,.55,.42,.3,.1,0];
 const seen=new Map();
 for(const p of positions){
  const state=getHandheldState(p);
  for(const value of Object.values(state))assert(Number.isFinite(value)&&value>=0&&value<=1);
  if(seen.has(p))assert.deepEqual(state,seen.get(p));
  seen.set(p,state);
 }
});
test('initial card load keeps geometry and high priority without requesting camera',()=>{
 assert.match(app,/class="model-fallback handheld-relief"[^>]*width="1200" height="1600" fetchpriority="high"/);
 assert.match(app,/class="handheld-front"[^>]*aria-hidden="true"/);
 assert.doesNotMatch(app,/getUserMedia\(/);
 assert.match(css,/合成场景 · 预渲染画面/);
});
