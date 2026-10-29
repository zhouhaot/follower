import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.AUDIT_URL||'http://127.0.0.1:4173';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const out=process.env.TRANSITION_QA_OUTPUT||'reports/transition-20261029';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const checks=[],errors=[];const check=(name,pass)=>{checks.push({name,pass:!!pass});console.log(`${pass?'PASS':'FAIL'} ${name}`)};
try{
 for(const width of [1033,390,320]){
  const context=await browser.newContext({viewport:{width,height:870}});
  await context.addInitScript(()=>{
   window.fieldCleared=false;
   for(const name of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,name);Object.defineProperty(HTMLCanvasElement.prototype,name,{...d,set(value){d.set.call(this,value);if(this.id==='portal-field')window.fieldCleared=true}})}
   const draw=WebGLRenderingContext.prototype.drawArrays;WebGLRenderingContext.prototype.drawArrays=function(...args){const result=draw.apply(this,args);if(this.canvas.id==='portal-field')window.fieldCleared=false;return result};
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  let release;const gate=new Promise(r=>release=r);await page.route('**/peony/target.png',async r=>{await gate;await r.continue()});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.home-main-card [data-pearl]')?.dataset.pearlState==='ready');
  await page.evaluate(()=>{
   window.artSamples=[];window.sampleArt=true;
   function sample(){
    const main=document.querySelector('.home-main-card');
    const visible=[...main.children].some(e=>{
     if(getComputedStyle(e).opacity<.99)return false;
     const img=e.querySelector('img');if(!img?.complete||!img.naturalWidth)return false;
     if(!e.classList.contains('pearl-ready'))return true;
     const canvas=e.querySelector('canvas'),ctx=canvas.getContext('2d');let lit=0;
     for(let x=1;x<6;x++)for(let y=1;y<8;y++){const p=ctx.getImageData(Math.floor(canvas.width*x/6),Math.floor(canvas.height*y/8),1,1).data;if(Math.max(...p.slice(0,3))>80&&p[3]===255)lit++;}
     return lit>=5;
    });
    artSamples.push(visible&&getComputedStyle(main).opacity==='1'&&!fieldCleared);if(sampleArt)requestAnimationFrame(sample);
   }sample();
  });
  await page.locator('[data-portal-card=peony]').click();await page.waitForTimeout(200);
  check(`${width}: delayed image retains complete current artwork and matching link`,await page.locator('.home-main-card [data-pearl]').getAttribute('data-pearl')==='lotus'&&(await page.locator('#portal-enter').getAttribute('href')).includes('lotus'));
  // A later request must win even if the slower image completes last.
  await page.locator('[data-portal-card=leaves]').click();await page.waitForFunction(()=>document.querySelector('#portal-title').textContent==='花叶生辉');release();await page.waitForTimeout(400);
  check(`${width}: fast repeated selection ignores stale completion`,await page.locator('#portal-title').textContent()==='花叶生辉'&&new URL(page.url()).hash==='#leaves');
  await page.locator('[data-portal-card=peony]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#portal-title').textContent==='牡丹承瑞');await page.waitForTimeout(400);
  check(`${width}: keyboard switch completes without blank frames`,await page.evaluate(()=>{sampleArt=false;return artSamples.length>10&&artSamples.every(Boolean)}));
  check(`${width}: outgoing artwork is cleaned up`,await page.locator('.portal-outgoing').count()===0&&await page.locator('.home-main-card>[data-pearl]').count()===1);
  check(`${width}: no toolbar buttons and no horizontal overflow`,await page.locator('#home-pearl-demo,#portal-motion').count()===0&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-portal-card=lotus]').click();await page.waitForFunction(()=>document.querySelector('#portal-title').textContent==='清荷入梦');
  check(`${width}: reduced motion switches directly to decoded image`,await page.locator('.portal-outgoing').count()===0&&await page.locator('.home-main-card [data-pearl] img').evaluate(e=>e.complete&&e.naturalWidth>0));
  await page.waitForFunction(()=>document.querySelector('.home-main-card [data-pearl]').dataset.pearlState==='ready');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/home-${width}.png`,fullPage:true});await context.close();
 }
 const context=await browser.newContext({viewport:{width:1033,height:870}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/peony/target.png',r=>r.abort());await page.goto(base);await page.waitForFunction(()=>document.querySelector('.home-main-card img')?.complete);await page.locator('[data-portal-card=peony]').click();await page.waitForFunction(()=>document.querySelector('#home-pearl-status').textContent.includes('再次选择重试'));
 check('failed image keeps current artwork and story entry',await page.locator('.home-main-card [data-pearl]').getAttribute('data-pearl')==='lotus'&&(await page.locator('#portal-enter').getAttribute('href')).includes('lotus'));
 await page.unroute('**/peony/target.png');await page.locator('[data-portal-card=peony]').click();await page.waitForFunction(()=>document.querySelector('#portal-title').textContent==='牡丹承瑞');check('same choice retries successfully after network recovery',await page.locator('.home-main-card [data-pearl] img').evaluate(e=>e.complete&&e.naturalWidth>0));await context.close();
 check('No uncaught browser errors',errors.length===0);
} catch(error){checks.push({name:'Transition workflow completed',pass:false,error:error.stack});console.error(error)}finally{await browser.close();await writeFile(`${out}/checks.json`,JSON.stringify({checks,errors,summary:{total:checks.length,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length}},null,2));}
console.log({total:checks.length,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length});if(checks.some(c=>!c.pass))process.exitCode=1;
