/** Independent background Chrome checks. Never connects to the user's Edge profile.
 * Camera calls are replaced before application code runs; no hardware is opened.
 */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'reports/qa/local-lifecycle');
await mkdir(output,{recursive:true});
const base=process.env.AUDIT_URL||'http://127.0.0.1:4173';
const report={date:new Date().toISOString(),base,scope:'Isolated headless desktop Chrome; simulated camera requests only. No Edge interaction, permission prompt, physical device or recognition test.',checks:[],events:[]};
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name}`)};
const browser=await chromium.launch({headless:true,executablePath:process.env.AUDIT_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
report.browser=browser.version();
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(()=>{
 window.__lifecycleQA={cameraRequests:0,stoppedTracks:0,pending:[],pageShows:[],pageHides:[],workers:0};
 const qa=window.__lifecycleQA;
 if(navigator.mediaDevices)Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:()=>{qa.cameraRequests++;return new Promise(resolve=>qa.pending.push(()=>resolve({getTracks:()=>[{stop(){qa.stoppedTracks++}}]})))}});
 addEventListener('pageshow',event=>qa.pageShows.push({persisted:event.persisted}));
 addEventListener('pagehide',event=>qa.pageHides.push({persisted:event.persisted}));
 const OriginalWorker=window.Worker;
 window.Worker=class extends OriginalWorker{constructor(...args){super(...args);qa.workers++;const terminate=this.terminate.bind(this);let active=true;this.terminate=()=>{if(active){active=false;qa.workers--}return terminate()}}};
});
const page=await context.newPage();
page.on('pageerror',error=>report.events.push({type:'pageerror',message:error.message}));
async function homeReady(){await page.waitForFunction(()=>document.querySelector('#hero-model')?.dataset.handSequence==='ready'&&document.querySelector('#hero-model')?.classList.contains('model-ready'))}
async function setProgress(p){await page.evaluate(progress=>{const s=document.querySelector('.exhibition-scroll');scrollTo({top:s.offsetTop+progress*(s.offsetHeight-innerHeight),behavior:'instant'})},p);await settle()}
async function settle(){await page.waitForFunction(()=>{const s=document.querySelector('.exhibition-scroll');if(!s)return false;const expected=matchMedia('(prefers-reduced-motion:reduce)').matches?0:Math.max(0,Math.min(1,-s.getBoundingClientRect().top/Math.max(1,s.offsetHeight-innerHeight)));if(Math.abs(Number(s.style.getPropertyValue('--progress'))-expected)>1e-6)return false;const open=Number(s.style.getPropertyValue('--hand-open'));return [...document.querySelectorAll('.handheld-hand')].every(i=>i.complete&&Number(i.dataset.handFrame)===Math.round(open*31))});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}
async function state(){return page.evaluate(()=>{const s=document.querySelector('.exhibition-scroll'),st=s.style,hero=document.querySelector('#hero-model'),canvas=hero.querySelector('canvas');return {width:innerWidth,height:innerHeight,y:scrollY,progress:Number(st.getPropertyValue('--progress')),open:Number(st.getPropertyValue('--hand-open')),frame:Number(hero.querySelector('.handheld-hand').dataset.handFrame),turn:Number(st.getPropertyValue('--card-turn')),reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,overflow:document.documentElement.scrollWidth-innerWidth,canvas:canvas?{width:canvas.width,height:canvas.height,cssWidth:canvas.getBoundingClientRect().width,cssHeight:canvas.getBoundingClientRect().height}:null,cameraRequests:window.__lifecycleQA.cameraRequests}})}
async function scanReady(){await page.waitForFunction(()=>document.querySelector('#scan-stage')?.dataset.scanState==='idle')}
async function resources(){return page.evaluate(()=>({state:document.querySelector('#scan-stage')?.dataset.scanState,status:document.querySelector('#scan-status')?.textContent,cameraRequests:window.__lifecycleQA.cameraRequests,stoppedTracks:window.__lifecycleQA.stoppedTracks,workers:window.__lifecycleQA.workers,videos:document.querySelectorAll('video').length,scanCanvases:document.querySelectorAll('#scan-stage canvas').length,collection:localStorage.getItem('flowers-speak:cloud-candidate:collection:v1')}))}
try{
 await page.goto(base,{waitUntil:'networkidle'});await homeReady();
 for(const progress of [.18,.42,.60,.86]){
  await setProgress(progress);
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:844},{width:1440,height:900}]){
   await page.setViewportSize(viewport);await settle();const s=await state();
   check(`Mid-scroll resize ${progress} to ${viewport.width}x${viewport.height}`,s.overflow<=1&&Number.isFinite(s.progress)&&s.frame===Math.round(s.open*31)&&s.canvas?.cssWidth>0&&s.canvas?.width>0,s);
  }
 }
 await setProgress(.22);const before=await state();
 await page.getByRole('link',{name:'浏览图录',exact:true}).click();
 await page.waitForURL('**/catalogue.html');await page.goBack({waitUntil:'networkidle'});await homeReady();await settle();const back=await state();
 check('Back restores the visible hand to the actual restored scroll position',back.frame===Math.round(back.open*31)&&Number.isFinite(back.progress),{before,back});
 await page.goForward({waitUntil:'networkidle'});check('Forward restores the catalogue',new URL(page.url()).pathname==='/catalogue.html');
 await page.goBack({waitUntil:'networkidle'});await homeReady();await setProgress(.42);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.handheld-hand').dataset.handFrame==='0');
 const reduce=await page.evaluate(()=>({matches:matchMedia('(prefers-reduced-motion:reduce)').matches,pin:getComputedStyle(document.querySelector('.exhibition-sticky')).position,fan:getComputedStyle(document.querySelector('.fan')).display,animations:document.getAnimations().filter(a=>a.playState==='running').length,progress:Number(document.querySelector('.exhibition-scroll').style.getPropertyValue('--progress'))}));
 check('Changing reduced-motion preference during the sequence releases the pinned scene',reduce.matches&&reduce.pin==='relative'&&reduce.fan==='none'&&reduce.animations===0&&reduce.progress===0,reduce);
 await page.emulateMedia({reducedMotion:'no-preference'});await settle();check('Restoring motion leaves a finite reversible scene',Number.isFinite((await state()).progress));
 await page.goto(base,{waitUntil:'networkidle'});await homeReady();await page.keyboard.press('Tab');
 check('Keyboard reaches the visible skip link',await page.evaluate(()=>document.activeElement.matches('.skip:focus-visible')));
 await page.keyboard.press('Enter');check('Skip link moves to the main content',new URL(page.url()).hash==='#main');
 await page.goto(base,{waitUntil:'networkidle'});await homeReady();
 let foundScan=false;
 for(let i=0;i<10;i++){await page.keyboard.press('Tab');if(await page.evaluate(()=>document.activeElement.matches('.scan-nav'))){foundScan=true;break}}
 check('Keyboard reaches the scan entry',foundScan);
 await page.keyboard.press('Enter');await scanReady();
 const idle=await resources();check('Keyboard scan entry opens only the preparation state',idle.state==='idle'&&idle.cameraRequests===0&&idle.videos===0&&idle.scanCanvases===0,idle);
 await page.locator('#scan-back').click();await page.waitForURL('**/index.html');await homeReady();check('Cancel scan entry returns home without a camera call',(await state()).cameraRequests===0);
 for(let cycle=0;cycle<3;cycle++){
  await page.goto(`${base}/scan.html?card=lotus&from=home`,{waitUntil:'networkidle'});await scanReady();
  await page.locator('#start-scan').click();await page.waitForFunction(()=>document.querySelector('#scan-stage').dataset.scanState==='requesting');
  await page.locator('#stop-scan').click();
  await page.evaluate(()=>window.__lifecycleQA.pending.splice(0).forEach(resolve=>resolve()));
  await page.waitForFunction(()=>window.__lifecycleQA.stoppedTracks===1);const r=await resources();
  check(`Cancel pending simulated request ${cycle+1}: late tracks close and resources stay released`,r.state==='stopped'&&r.stoppedTracks===1&&r.videos===0&&r.scanCanvases===0&&r.workers===0&&r.collection===null,r);
  await page.locator('#retry-scan').click();await page.waitForFunction(()=>document.querySelector('#scan-stage').dataset.scanState==='requesting');
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await page.evaluate(()=>window.__lifecycleQA.pending.splice(0).forEach(resolve=>resolve()));
  await page.waitForFunction(()=>window.__lifecycleQA.stoppedTracks===2);const h=await resources();
  check(`Page-hide cancellation ${cycle+1}: stale request cannot restart`,h.state==='stopped'&&h.stoppedTracks===2&&h.workers===0&&h.videos===0&&h.scanCanvases===0&&h.collection===null,h);
 }
 await page.locator('#scan-preview').click();await page.waitForURL('**/preview.html?card=lotus');
 await page.goBack({waitUntil:'networkidle'});await page.waitForFunction(()=>['idle','stopped'].includes(document.querySelector('#scan-stage')?.dataset.scanState));
 const returned=await resources();check('History return to scan never restarts a camera automatically',returned.workers===0&&returned.videos===0&&returned.scanCanvases===0&&returned.collection===null,returned);
 check('No uncaught browser errors during lifecycle checks',!report.events.some(event=>event.type==='pageerror'),report.events);
 report.safari={tested:false,reason:'This installed background harness uses Chrome. Safari was not launched: no existing approved background Safari automation was established, and visible UI or Remote Automation settings were not changed.'};
}catch(error){check('Lifecycle audit completed',false,{error:String(error),stack:error.stack})}
finally{
 await context.close();await browser.close();report.summary={total:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};
 await writeFile(path.join(output,'lifecycle-audit.json'),JSON.stringify(report,null,2));console.log('SUMMARY',JSON.stringify(report.summary));
}
process.exitCode=report.summary.failed?1:0;
