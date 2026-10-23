import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={scope:'Local Chrome, 45 frames x 4 synthetic pointer events, DPR2 desktop/DPR3 emulated mobile. Submission/copy CPU time excludes GPU completion.',results:[]};
try{
 for(const [width,dpr] of [[1280,2],[390,3]]){
  const context=await browser.newContext({viewport:{width,height:width===1280?900:844},deviceScaleFactor:dpr,isMobile:width===390,hasTouch:width===390});
  await context.addInitScript(()=>{
   const raf=requestAnimationFrame.bind(window);window.__frame=()=>new Promise(raf);window.__draws=0;window.__cost=[];
   for(const C of [WebGLRenderingContext,WebGL2RenderingContext]){const draw=C.prototype.drawElements;C.prototype.drawElements=function(...args){window.__draws++;return draw.apply(this,args);};}
  });
  await context.route('**/pearl-renderer.mjs',async route=>{
   const response=await route.fetch();const source=(await response.text()).replace('if(disposed||failed)return false;','const start=performance.now();if(disposed||failed)return false;').replace('context.drawImage(renderer.domElement,0,0,w,h);return true;','context.drawImage(renderer.domElement,0,0,w,h);window.__cost.push(performance.now()-start);return true;');
   await route.fulfill({response,body:source});
  });
  const page=await context.newPage();
  for(const [surface,path,selector] of [['home','/','.home-main-card [data-pearl]'],['detail','/flower-detail.html?key=lotus','#detail-pearl [data-pearl]']]){
   await page.goto(`http://127.0.0.1:4173${path}`);const card=page.locator(selector);await card.scrollIntoViewIfNeeded();await page.waitForFunction(el=>el.dataset.pearlState==='ready',await card.elementHandle());
   const result=await card.evaluate(async el=>{
    for(let i=0;i<20;i++)await window.__frame();
    const r=el.getBoundingClientRect(),start=window.__draws,gaps=[];let before=performance.now();window.__cost=[];
    for(let i=0;i<45;i++){await window.__frame();const now=performance.now();gaps.push(now-before);before=now;for(let j=0;j<4;j++)el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:r.left+r.width*(.25+.5*Math.sin(i/10+j/50)**2),clientY:r.top+r.height*.4}));}
    await window.__frame();await window.__frame();const end=window.__draws;for(let i=0;i<20;i++)await window.__frame();gaps.sort((a,b)=>a-b);const costs=window.__cost.sort((a,b)=>a-b);
    return {draws:end-start,idleDraws:window.__draws-end,median:gaps[22],p95:gaps[42],submissionAndCopyP95:costs[Math.floor(costs.length*.95)],canvasWidth:el.querySelector('canvas').width,canvasHeight:el.querySelector('canvas').height};
   });report.results.push({surface,width,dpr,...result});
  }
  await context.close();
 }
}finally{await browser.close();}
report.pass=report.results.length===4&&report.results.every(r=>r.draws>=40&&r.draws<=46&&r.idleDraws===0);
await writeFile('reports/qa/pearl-integration-20261023/performance-after.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
