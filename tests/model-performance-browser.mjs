import {chromium} from 'playwright';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.env.AUDIT_URL||'http://127.0.0.1:4173';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const label=process.env.PERF_LABEL||'after';
const output=`reports/qa/model-performance-20261023/${label}`;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.AUDIT_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={date:new Date().toISOString(),browser:browser.version(),scope:'Local Chrome; synthetic dense input (4 moves per animation frame), mobile viewport emulation. Renderer CPU submission time, not GPU timing or real-device FPS.',sourceSHA256:createHash('sha256').update(await readFile('public/model-viewer.mjs')).digest('hex'),results:[],errors:[]};
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:width===390?3:2,hasTouch:width===390,isMobile:width===390});
  await context.route('**/model-viewer.mjs',async route=>{
   const response=await route.fetch();let source=await response.text();
   const anchor='container.append(renderer.domElement);';assert.ok(source.includes(anchor));
   source=source.replace(anchor,`${anchor}
    window.__modelPerf={renders:[],events:0};
    const measuredRender=renderer.render.bind(renderer);
    renderer.render=(...args)=>{const start=performance.now();measuredRender(...args);window.__modelPerf.renders.push({at:start,ms:performance.now()-start,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});};
    renderer.domElement.addEventListener('pointermove',()=>window.__modelPerf.events++);
   `);
   await route.fulfill({response,body:source});
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  for(const key of ['lotus','peony','chrysanthemum','flowers','leaves']){
   await page.goto(`${base}/flower-detail.html?key=${key}&view=bloom`);
   await page.waitForSelector('#detail-model.model-ready canvas',{timeout:20000});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await page.locator('#detail-model canvas').screenshot({path:`${output}/${width}-${key}.png`});
   const result=await page.evaluate(async()=>{
    const canvas=document.querySelector('#detail-model canvas');
    const rect=canvas.getBoundingClientRect(),x=rect.x+rect.width*.5,y=rect.y+rect.height*.5;
    // Synthetic pointer IDs have no native capture; only this isolated fixture overrides capture.
    canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};
    const send=(type,px)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:71,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:px,clientY:y}));
    const frame=()=>new Promise(r=>requestAnimationFrame(r));
    const q=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)]||0;
    const summary=r=>({renders:r.length,cpuTotalMs:r.reduce((n,v)=>n+v.ms,0),cpuP50Ms:q(r.map(v=>v.ms),.5),cpuP95Ms:q(r.map(v=>v.ms),.95),drawCalls:r.at(-1)?.calls,triangles:r.at(-1)?.triangles});
    const initial=window.__modelPerf.renders.at(-1);
    window.__modelPerf.renders=[];window.__modelPerf.events=0;
    send('pointerdown',x);let last=await frame();const intervals=[];
    for(let i=0;i<45;i++){
     for(let j=0;j<4;j++)send('pointermove',x+Math.sin((i*4+j)*.025)*65);
     const now=await frame();intervals.push(now-last);last=now;
    }
    send('pointerup',x);await frame();await frame();
    const drag=summary(window.__modelPerf.renders);drag.events=window.__modelPerf.events;drag.frameP50Ms=q(intervals,.5);drag.frameP95Ms=q(intervals,.95);
    window.__modelPerf.renders=[];
    for(let i=0;i<20;i++){
     for(let j=0;j<4;j++)canvas.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:(i%2?1:-1)*3,clientX:x,clientY:y}));
     await frame();
    }
    await frame();await frame();const wheel=summary(window.__modelPerf.renders);
    window.__modelPerf.renders=[];for(let i=0;i<12;i++)await frame();const idleRenders=window.__modelPerf.renders.length;
    return {initial,drag,wheel,idleRenders};
   });
   report.results.push({width,key,...result});
   console.log(JSON.stringify({width,key,drawCalls:result.initial.calls,drag:result.drag,wheelRenders:result.wheel.renders,idleRenders:result.idleRenders}));
  }
  await context.close();
 }
 assert.equal(report.errors.length,0);
}finally{await browser.close();await writeFile(`${output}/performance.json`,JSON.stringify(report,null,2)+'\n');}
