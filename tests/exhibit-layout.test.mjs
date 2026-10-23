import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pearlCard} from '../public/pearl-card.mjs';
import {cardByKey} from '../public/cards.mjs';
import {getHandheldState} from '../public/handheld-state.mjs';
const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
test('homepage presents the original card without loading the retired hand scene',()=>{
 assert.match(app,/class="home-featured"/);
 assert.match(app,/阅读清荷入梦的故事/);
 assert.doesNotMatch(app,/import .*hand-sequence/);
 assert.doesNotMatch(app,/id="hero-model"/);
 assert.doesNotMatch(app,/class="exhibition-scroll"/);
});
test('handheld movement stays finite, native-scroll-driven and exactly reversible',()=>{
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
 const card=cardByKey('lotus');
 const markup=pearlCard(card,{priority:true});
 assert.match(markup,/width="884" height="1255"/);
 assert.match(markup,/fetchpriority="high"/);
 assert.match(markup,/aspect-ratio:884\/1255/);
 assert.ok(markup.includes(card.target));
 assert.match(app,/pearlCard\(featured,\{priority:true\}\)/);
 assert.doesNotMatch(app,/getUserMedia\(/);
 assert.match(css,/合成场景 · 预渲染画面/);
});
