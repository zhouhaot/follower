import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.AUDIT_URL||'http://127.0.0.1:4173';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const output='reports/qa/home-glass-20261023/final';await mkdir(output,{recursive:true});
const report={date:new Date().toISOString(),scope:'Local Chrome, desktop and mobile viewport/touch simulation. No real device or production data.',checks:[],errors:[],motionTiming:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.AUDIT_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
function check(name,pass,detail){report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});console.log(`${pass?'PASS':'FAIL'} ${name}`);}
async function settled(page){await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));}
async function ready(page){await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('.home-featured img')].every(i=>i.complete&&i.naturalWidth>0));await page.waitForFunction(()=>!document.querySelector('.home-replay').disabled);await settled(page);}
async function setup(width,options={}){
 const context=await browser.newContext({viewport:{width,height:width>700?900:844},hasTouch:width<701,isMobile:width<701,...options});
 await context.addInitScript(()=>{
  const raf=requestAnimationFrame.bind(window);window.__homeRafRequests=0;
  window.requestAnimationFrame=callback=>{window.__homeRafRequests++;return raf(callback);};
  window.__testFrame=()=>new Promise(raf);
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push({width,error:e.message}));
 return {context,page};
}
try{
 for(const width of [1440,1280,768,390,320]){
  const {context,page}=await setup(width);const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.goto(base);await ready(page);
  check(`${width}: glass surfaces visible`,await page.evaluate(()=>getComputedStyle(document.querySelector('.glass-nav')).backdropFilter!=='none'&&getComputedStyle(document.querySelector('.home-featured figcaption')).backdropFilter!=='none'));
  check(`${width}: original cards stay within viewport`,await page.locator('.home-card-fan img').evaluateAll(images=>images.every(image=>{const r=image.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));
  check(`${width}: main artwork stays above caption`,await page.evaluate(()=>document.querySelector('.home-main-card').getBoundingClientRect().bottom<=document.querySelector('.home-featured figcaption').getBoundingClientRect().top));
  check(`${width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check(`${width}: primary story entry is in first screen`,await page.locator('.home-start .pill-link').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight));
  check(`${width}: no WebGL or hand sequence loads`,await page.locator('canvas').count()===0&&!requests.some(u=>/three\.module|model-viewer|hand-sequence/.test(u)));
  await page.screenshot({path:`${output}/${width}-home.png`,fullPage:true});
  await page.locator('.home-replay').scrollIntoViewIfNeeded();
  await page.locator('.home-replay').focus();await page.keyboard.press('Enter');
  const started=await page.evaluate(()=>[...document.querySelector('.home-card-fan').children].map(e=>e.getAnimations()).flat().filter(a=>a.playState==='running').length);
  check(`${width}: keyboard replay opens three cards`,started===3);
  const timing=await page.evaluate(async()=>{
   const gaps=[];let previous=await window.__testFrame();
   for(let i=0;i<55;i++){const now=await window.__testFrame();gaps.push(now-previous);previous=now;}
   gaps.sort((a,b)=>a-b);return {median:gaps[Math.floor(gaps.length*.5)],p95:gaps[Math.floor(gaps.length*.95)]};
  });report.motionTiming.push({width,...timing});
  check(`${width}: opening finishes without an idle loop`,await page.evaluate(()=>document.querySelector('.home-card-fan').getAnimations({subtree:true}).filter(a=>a.playState==='running').length===0));
  if(width>700){
   const box=await page.locator('.home-display').boundingBox();
   await page.mouse.move(box.x+box.width*.75,box.y+box.height*.4);await page.evaluate(()=>window.__testFrame());
   check(`${width}: pointer changes card angle`,await page.locator('.home-card-fan').evaluate(e=>parseFloat(e.style.getPropertyValue('--tilt-y'))>0));
   await page.mouse.move(0,0);await settled(page);
   check(`${width}: pointer leave restores angle`,await page.locator('.home-card-fan').evaluate(e=>!e.style.getPropertyValue('--tilt-y')));
  }else{
   check(`${width}: touch has no hover tilt`,await page.locator('.home-card-fan').evaluate(e=>!e.style.getPropertyValue('--tilt-y')));
  }
  const before=await page.evaluate(()=>window.__homeRafRequests);await page.evaluate(async()=>{for(let i=0;i<12;i++)await window.__testFrame();});
  check(`${width}: no scheduled frames while idle`,before===await page.evaluate(()=>window.__homeRafRequests));
  await page.locator('.home-replay').evaluate(button=>{button.click();button.click();button.click();});
  check(`${width}: repeated replay replaces prior sequence`,await page.locator('.home-card-fan').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length<=3));
  await page.evaluate(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelector('.home-card-fan').getAnimations({subtree:true}).every(a=>a.playState!=='running'));
  check(`${width}: offscreen sequence stops`,await page.locator('.home-card-fan').evaluate(e=>e.getAnimations({subtree:true}).length===0));
  await context.close();
 }
 for(const width of [1280,390]){
  const {context,page}=await setup(width,{reducedMotion:'reduce'});await page.goto(base);await ready(page);
  check(`${width}: reduced motion shows complete static fan`,await page.locator('.home-replay').isHidden()&&await page.locator('.home-card-fan').evaluate(e=>e.getAnimations({subtree:true}).length===0));
  await page.screenshot({path:`${output}/${width}-reduced.png`,fullPage:true});
  await page.locator('.home-start .pill-link').focus();await page.keyboard.press('Enter');await page.waitForURL('**/flower-detail.html?key=lotus');
  check(`${width}: reduced motion keeps story entry usable`,await page.locator('h1').textContent()==='清荷入梦');await context.close();
 }
 const {context,page}=await setup(1280);await context.route('**/home-motion.mjs',route=>route.abort());await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 check('Motion module failure leaves artwork and navigation visible',await page.locator('.home-main-card img').isVisible()&&await page.locator('.home-start .pill-link').isVisible()&&await page.locator('.home-replay').isHidden());
 await context.close();check('No uncaught page errors',report.errors.length===0,report.errors);
}finally{await browser.close();report.summary={total:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};await writeFile(`${output}/home-glass.json`,JSON.stringify(report,null,2)+'\n');}
console.log('SUMMARY',report.summary);if(report.summary.failed||report.errors.length)process.exitCode=1;
