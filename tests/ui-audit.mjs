import { createRequire } from 'node:module';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tipsByFrame=JSON.parse(await readFile(path.join(root,'reports/hand-rig/clearance-32-poses.json'),'utf8')).frames.map(frame=>Object.values(frame.tipScreenCoordinates));
const output=path.resolve(process.env.AUDIT_OUTPUT||path.join(root,'reports/qa/local-public'));
await mkdir(output,{recursive:true});
const base=process.env.AUDIT_URL||'http://127.0.0.1:4173';
const report={date:new Date().toISOString(),base,checks:[],routes:[],screenshots:[],motion:[],scope:'Local macOS browser automation with simulated portrait viewports and camera calls blocked. No production, physical phone, or actual target-tracking verification.',host:{platform:os.platform(),release:os.release(),architecture:os.arch()}};
function check(name,pass,detail){const row={name,pass:!!pass,detail};report.checks.push(row);console.log(`${row.pass?'PASS':'FAIL'} ${name}${detail?' '+JSON.stringify(detail):''}`);return row.pass;}
const cards=['flowers','peony','chrysanthemum','lotus','leaves'];
const routes=['index.html','catalogue.html','collection.html','guide.html',...cards.flatMap(card=>['work','preview','scan'].map(page=>`${page}.html?card=${card}`))];
const browser=await chromium.launch({headless:true,...(process.env.AUDIT_CHROMIUM?{executablePath:process.env.AUDIT_CHROMIUM}:{})});
report.browserVersion=browser.version();
async function auditHomeMotion(page,viewport){
 const samples=[0,.12,.22,.30,.42,.56,.70,.84,.96];
 const metrics=()=>page.evaluate(tips=>{
  const s=document.querySelector('.exhibition-scroll'),style=getComputedStyle(s),hero=document.querySelector('#hero-model');
  const foreground=document.querySelector('.handheld-hand-foreground'),hand=foreground.querySelector('img');
  const rect=hand.getBoundingClientRect(),cw=Math.min(rect.width,rect.height*.75),ch=cw/.75,ox=rect.left+(rect.width-cw)/2,oy=rect.top+(rect.height-ch)/2;
  const cardRect=hero.querySelector('.handheld-card-media').getBoundingClientRect(),cardWidth=Math.min(cardRect.width,cardRect.height*.75),supportX=cardRect.left+(cardRect.width-cardWidth)/2+cardWidth*.59;
  const fingertipPixels=(tips[Number(hand.dataset.handFrame)]||[]).map(([x,y])=>({x:ox+x*cw,y:oy+y*ch}));
  return {progress:Number(style.getPropertyValue('--progress')),handOpen:Number(style.getPropertyValue('--hand-open')),handFrame:Number(hand.dataset.handFrame),handSequence:hero.dataset.handSequence,handOpacity:Number(getComputedStyle(foreground).opacity),handTransform:getComputedStyle(foreground).transform,cardTurn:Number(style.getPropertyValue('--card-turn')),fanOpacity:Number(style.getPropertyValue('--fan-opacity')),modelReady:hero.classList.contains('model-ready'),fallbackOnly:hero.classList.contains('fallback-only'),handDecoded:hand.complete&&hand.naturalWidth===720,fanCards:document.querySelectorAll('.fan-card').length,cameraCalls:window.__qaCameraCalls,composition:{sharedTransform:getComputedStyle(hero.querySelector('.handheld-frame')).transform,handLocalTransform:getComputedStyle(hand).transform,supportErrorX:supportX-(ox+.5*cw),fingertipPixels}};
 },tipsByFrame);
 async function at(progress){
  await page.evaluate(p=>{const s=document.querySelector('.exhibition-scroll');scrollTo({top:s.offsetTop+p*(s.offsetHeight-innerHeight),behavior:'instant'})},progress);
  await page.waitForFunction(()=>{const s=document.querySelector('.exhibition-scroll'),open=Number(s.style.getPropertyValue('--hand-open'));return [...document.querySelectorAll('.handheld-hand')].every(i=>Number(i.dataset.handFrame)===Math.round(open*31)&&i.complete&&i.naturalWidth===720)},{},{timeout:10000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.waitForTimeout(80);
  return metrics();
 }
 const rows=[],frames=new Map();
 for(const p of samples){
  const state=await at(p);rows.push({requested:p,...state});
  check(`${viewport.width}px home ${p}: decoded hand follows native progress`,state.handDecoded&&state.handFrame===Math.round(state.handOpen*31)&&state.handSequence==='ready',state);
  if(viewport.width!==320){const filename=`${viewport.width}-home-phase-${String(Math.round(p*100)).padStart(2,'0')}.png`;const bytes=await page.screenshot({path:path.join(output,filename)});report.screenshots.push(filename);frames.set(p,{hash:createHash('sha256').update(bytes).digest('hex'),uri:`data:image/png;base64,${bytes.toString('base64')}`});}
 }
 check(`${viewport.width}px home: fully open before withdrawal`,rows[3].handFrame===31&&rows[3].handOpacity===1&&rows[3].cardTurn===0,rows[3]);
 check(`${viewport.width}px composition: card support reference and palm anchor agree`,Math.abs(rows[0].composition.supportErrorX)<1&&rows[0].composition.handLocalTransform==='none',rows[0].composition);
 check(`${viewport.width}px composition: all five fingertips remain inside the viewport before release`,rows.slice(0,4).every(row=>row.composition.fingertipPixels.length===5&&row.composition.fingertipPixels.every(p=>p.x>0&&p.x<viewport.width&&p.y>0&&p.y<viewport.height)),rows.slice(0,4).map(row=>row.composition.fingertipPixels));
 check(`${viewport.width}px home: card turns and five originals appear`,rows.at(-1).cardTurn===180&&rows.at(-1).fanOpacity===1&&rows.at(-1).fanCards===5,rows.at(-1));
 const bounds=await page.locator('.fan-card').evaluateAll(items=>items.map(item=>{const r=item.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}));
 check(`${viewport.width}px home: all five fan cards fit the screen`,bounds.every(r=>r.left>=0&&r.right<=viewport.width&&r.top>=0&&r.bottom<=viewport.height),bounds);
 for(const p of [...samples].reverse()){
  const state=await at(p),prior=rows.find(row=>row.requested===p);
  check(`${viewport.width}px reverse ${p}: identical hand and card state`,['progress','handOpen','handFrame','handOpacity','handTransform','cardTurn','fanOpacity'].every(key=>state[key]===prior[key]));
  if(frames.has(p)&&[0,.22,.56,.96].includes(p)){
   const filename=`${viewport.width}-home-reverse-${Math.round(p*100)}.png`,bytes=await page.screenshot({path:path.join(output,filename)});report.screenshots.push(filename);
   const reference=frames.get(p),identical=createHash('sha256').update(bytes).digest('hex')===reference.hash;
   const difference=identical?{exact:true,meanChannelDelta:0,maxChannelDelta:0}:await page.evaluate(async([a,b])=>{
    async function pixels(src){const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);return context.getImageData(0,0,image.width,image.height).data}
    const first=await pixels(a),second=await pixels(b);let sum=0,max=0,changed=0;for(let i=0;i<first.length;i++){const d=Math.abs(first[i]-second[i]);sum+=d;max=Math.max(max,d);if(d)changed++}return {exact:false,meanChannelDelta:sum/first.length,maxChannelDelta:max,changedChannelFraction:changed/first.length};
   },[reference.uri,`data:image/png;base64,${bytes.toString('base64')}`]);
   check(`${viewport.width}px reverse ${p}: rendered pixels match within raster tolerance`,difference.meanChannelDelta<=.10&&difference.maxChannelDelta<=16,difference);
  }
 }
 const cycles=await page.evaluate(async()=>{
  const section=document.querySelector('.exhibition-scroll'),range=section.offsetHeight-innerHeight,cycles=[];
  for(const duration of [2400,800,800]){
   const gaps=[];let start,last;await new Promise(resolve=>{function step(t){if(start===undefined)start=t;if(last!==undefined)gaps.push(t-last);last=t;const p=Math.min(1,(t-start)/duration);scrollTo({top:section.offsetTop+(duration===2400?p*.96:(cycles.length===1?1-p:p)*.96)*range,behavior:'instant'});if(p<1)requestAnimationFrame(step);else resolve()}requestAnimationFrame(step)});
   const sorted=[...gaps].sort((a,b)=>a-b);cycles.push({durationMs:duration,samples:gaps.length,p95RafGapMs:sorted[Math.floor(sorted.length*.95)],maxRafGapMs:Math.max(...gaps)});
  }return cycles;
 });
 await at(0);
 await page.mouse.wheel(0,180);await page.waitForTimeout(200);const nativeDown=await metrics();
 await page.mouse.wheel(0,-180);await page.waitForTimeout(200);const nativeUp=await metrics();
 check(`${viewport.width}px home: native wheel works in both directions`,nativeDown.progress>nativeUp.progress,{down:nativeDown.progress,up:nativeUp.progress});
 report.motion.push({viewport,samples:rows,cycles,scope:'Desktop automated scroll and rAF scheduling measurements; not physical-device FPS.'});
 await at(0);
}
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844}]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});
  await context.addInitScript(()=>{
   window.__qaCameraCalls=0;window.__qaStorageWrites=[];
   if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{window.__qaCameraCalls++;throw new DOMException('QA camera blocked','NotAllowedError')};
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){window.__qaStorageWrites.push({key,value});return original.call(this,key,value)};
  });
  const page=await context.newPage();
  for(const route of routes){
   const failed=[],errors=[],consoleErrors=[];
   const responseHandler=r=>{if(r.status()>=400&&r.url().startsWith(base))failed.push({status:r.status(),url:r.url()})};
   const failedHandler=r=>{if(r.url().startsWith(base))failed.push({url:r.url(),error:r.failure()?.errorText})};
   const errorHandler=e=>errors.push(e.message);
   const consoleHandler=m=>{if(m.type()==='error')consoleErrors.push(m.text())};
   page.on('response',responseHandler);page.on('requestfailed',failedHandler);page.on('pageerror',errorHandler);page.on('console',consoleHandler);
   let result={route,viewport,failed,errors,consoleErrors};
   try{
    const response=await page.goto(`${base}/${route}`,{waitUntil:'networkidle',timeout:45000});
    await page.evaluate(async()=>{for(const img of document.images){img.loading='eager'}await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));await document.fonts.ready});
    await page.waitForTimeout(180);
    const metrics=await page.evaluate(()=>({
     status:document.querySelector('#scan-status')?.textContent,
     h1:[...document.querySelectorAll('h1')].map(x=>x.innerText),
     horizontalOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
     overflowElements:[...document.querySelectorAll('body *')].filter(x=>{const r=x.getBoundingClientRect();const s=getComputedStyle(x);return r.width>0&&s.position!=='absolute'&&s.position!=='fixed'&&(r.right>innerWidth+1||r.left< -1)}).slice(0,12).map(x=>({tag:x.tagName,class:x.className,left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right})),
     brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),
     cameraCalls:window.__qaCameraCalls,
     storageWrites:window.__qaStorageWrites,
     modelReady:document.querySelector('.model-ready')!==null,
     fallbackOnly:document.querySelector('.fallback-only')!==null,
     collection:localStorage.getItem('flowers-speak:cloud-candidate:collection:v1')
    }));
    result={...result,httpStatus:response.status(),...metrics};
    const name=`${viewport.width}px ${route}`;
    check(`${name}: renders`,response.status()===200&&metrics.h1.length===1,{h1:metrics.h1});
    check(`${name}: no overflow`,metrics.horizontalOverflow<=1,{pixels:metrics.horizontalOverflow});
    check(`${name}: local assets`,failed.length===0&&metrics.brokenImages.length===0,{failed,brokenImages:metrics.brokenImages});
    check(`${name}: no JS errors`,errors.length===0,{errors});
    check(`${name}: no camera autoplay`,metrics.cameraCalls===0);
    if(route.startsWith('preview'))check(`${name}: preview does not collect`,metrics.storageWrites.length===0&&metrics.collection===null,{writes:metrics.storageWrites,collection:metrics.collection});
    const wanted=viewport.width!==320&&['index.html','catalogue.html','collection.html','guide.html','work.html?card=lotus','preview.html?card=lotus','scan.html?card=lotus'].includes(route);
    if(wanted){const screenshot=`${viewport.width}-${route.replace(/[?.=]/g,'-')}.png`;await page.screenshot({path:path.join(output,screenshot),fullPage:route!=='index.html'});report.screenshots.push(screenshot);}
    if(route==='index.html'){
     await auditHomeMotion(page,viewport);
     const initial=await page.evaluate(()=>document.querySelector('.exhibition-scroll').style.getPropertyValue('--progress'));
     await page.evaluate(()=>{const s=document.querySelector('.exhibition-scroll');scrollTo({top:s.offsetTop+.94*(s.offsetHeight-innerHeight),behavior:'instant'})});await page.waitForTimeout(150);
     const scrolled=await page.evaluate(()=>({y:scrollY,progress:Number(document.querySelector('.exhibition-scroll').style.getPropertyValue('--progress')),fanOpacity:Number(getComputedStyle(document.querySelector('.fan')).opacity)}));
     check(`${name}: native scroll unfolds fan`,scrolled.y>0&&scrolled.progress>Number(initial)&&scrolled.fanOpacity>0,scrolled);
     if(viewport.width!==320){const screenshot=`${viewport.width}-home-scrolled.png`;await page.screenshot({path:path.join(output,screenshot)});report.screenshots.push(screenshot);}
    }
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    await page.keyboard.press('Tab');
    const focused=await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return {tag:e.tagName,text:e.textContent,visible:!!e.getBoundingClientRect().width,focusVisible:e.matches(':focus-visible'),outline:s.outlineStyle,outlineWidth:s.outlineWidth}});
    check(`${name}: keyboard focus visible`,focused.visible&&focused.focusVisible&&focused.outline!=='none'&&focused.outlineWidth!=='0px',focused);
   }catch(error){result.error=String(error);check(`${viewport.width}px ${route}: browser audit`,false,{error:String(error)})}
   report.routes.push(result);
   page.off('response',responseHandler);page.off('requestfailed',failedHandler);page.off('pageerror',errorHandler);page.off('console',consoleHandler);
  }
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
 for(const card of cards){
  await page.goto(`${base}/catalogue.html`,{waitUntil:'networkidle'});
  await page.locator(`.card-image[href="work.html?card=${card}"]`).click();
  check(`${card}: catalogue detail link`,page.url().endsWith(`work.html?card=${card}`));
  await page.locator('.work-actions .pill-link').click();
  check(`${card}: detail preview link`,page.url().endsWith(`preview.html?card=${card}`));
  await page.locator('.preview-bottom .text-link').click();
  const scanUrl=new URL(page.url());
  check(`${card}: preview scan link`,scanUrl.pathname==='/scan.html'&&scanUrl.searchParams.get('card')===card&&scanUrl.searchParams.get('from')==='preview');
  await page.locator('#scan-back').click();
  const back=new URL(page.url());
  check(`${card}: scan back preserves preview card`,back.pathname==='/preview.html'&&(back.searchParams.get('card')||'lotus')===card,{url:page.url()});
  await page.goto(`${base}/work.html?card=${card}`,{waitUntil:'networkidle'});
  await page.locator('.work-actions .text-link').click();
  check(`${card}: detail scan link`,new URL(page.url()).searchParams.get('card')===card);
  await page.locator('#scan-back').click();
  check(`${card}: scan back preserves detail card`,page.url().endsWith(`work.html?card=${card}`));
 }
 for(const type of ['work','preview','scan']){
  const response=await page.goto(`${base}/${type}.html?card=not-a-real-card`,{waitUntil:'networkidle'});
  check(`${type}: unknown card shows 404 content`,await page.locator('.error-page').count()===1&&await page.locator('#start-scan').count()===0,{httpStatus:response.status(),title:await page.title()});
 }
 await context.close();
 const reduced=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),rp=await reduced.newPage();
 await rp.goto(`${base}/index.html`,{waitUntil:'networkidle'});await rp.waitForTimeout(400);
 const reducedMetrics=await rp.evaluate(()=>({matches:matchMedia('(prefers-reduced-motion: reduce)').matches,scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior,sticky:getComputedStyle(document.querySelector('.exhibition-sticky')).position,fanDisplay:getComputedStyle(document.querySelector('.fan')).display,modelReady:!!document.querySelector('.model-ready'),progress:document.querySelector('.exhibition-scroll').style.getPropertyValue('--progress'),heroTransform:getComputedStyle(document.querySelector('.hero-copy')).transform,animations:document.getAnimations().filter(x=>x.playState==='running').length}));
 check('Reduced motion: no animated or pinned exhibition',reducedMetrics.matches&&reducedMetrics.scrollBehavior==='auto'&&reducedMetrics.sticky==='relative'&&reducedMetrics.fanDisplay==='none'&&reducedMetrics.animations===0,reducedMetrics);
 check('Reduced motion: finite scene progress',Number.isFinite(Number(reducedMetrics.progress)),reducedMetrics);
 await rp.screenshot({path:path.join(output,'1440-home-reduced-motion.png')});report.screenshots.push('1440-home-reduced-motion.png');await reduced.close();
 const fallback=await browser.newContext({viewport:{width:390,height:844}}),fp=await fallback.newPage();
 await fp.route('**/model-viewer.mjs',route=>route.abort());
 await fp.goto(`${base}/index.html`,{waitUntil:'networkidle'});
 await fp.waitForFunction(()=>document.querySelector('#hero-model').classList.contains('fallback-only'));
 check('Unavailable 3D module: original card fallback is visible',await fp.locator('.handheld-relief').isVisible());
 await fp.evaluate(()=>{const s=document.querySelector('.exhibition-scroll');scrollTo({top:.56*(s.offsetHeight-innerHeight),behavior:'instant'})});await fp.waitForTimeout(250);
 check('Fallback: card rotates with native scroll',await fp.evaluate(()=>Number(document.querySelector('.exhibition-scroll').style.getPropertyValue('--card-turn'))>0));
 await fp.screenshot({path:path.join(output,'390-home-fallback.png')});report.screenshots.push('390-home-fallback.png');await fallback.close();
 const failedHand=await browser.newContext({viewport:{width:390,height:844}}),hp=await failedHand.newPage();
 await hp.route('**/assets/hand-sequence/manifest.json',route=>route.fulfill({status:503,body:'Unavailable'}));
 await hp.goto(`${base}/index.html`,{waitUntil:'networkidle'});
 await hp.waitForFunction(()=>document.querySelector('#hero-model').dataset.handSequence==='static');
 check('Unavailable hand manifest: initial decoded palm remains',await hp.evaluate(()=>[...document.querySelectorAll('.handheld-hand')].every(i=>i.complete&&i.naturalWidth===720)));
 check('Unavailable hand manifest: five-card catalogue remains usable',await hp.locator('.home-cards .card-image').count()===5);
 await failedHand.close();
 const decodeFailure=await browser.newContext({viewport:{width:390,height:844}}),dp=await decodeFailure.newPage();
 await dp.route('**/assets/hand-sequence/hand-016.webp',route=>route.fulfill({status:200,contentType:'image/webp',body:'invalid image bytes'}));
 await dp.goto(`${base}/index.html`,{waitUntil:'networkidle'});
 await dp.waitForFunction(()=>document.querySelector('#hero-model').dataset.handSequence==='ready');
 await dp.evaluate(()=>{const section=document.querySelector('.exhibition-scroll');scrollTo({top:.16*(section.offsetHeight-innerHeight),behavior:'instant'})});await dp.waitForTimeout(250);
 check('Image decode failure: last complete hand layers survive',await dp.evaluate(()=>[...document.querySelectorAll('.handheld-hand')].every(i=>i.complete&&i.naturalWidth===720)));
 check('Image decode failure: no false collection',await dp.evaluate(()=>localStorage.getItem('flowers-speak:cloud-candidate:collection:v1')===null));
 await decodeFailure.close();
}finally{
 await browser.close();
 report.summary={total:report.checks.length,passed:report.checks.filter(x=>x.pass).length,failed:report.checks.filter(x=>!x.pass).length};
 await writeFile(path.join(output,'ui-audit.json'),JSON.stringify(report,null,2));
 await writeFile(path.join(output,'ui-audit.md'),`# Candidate UI audit\n\n${report.date}\n\n${report.scope}\n\n${report.summary.passed}/${report.summary.total} checks passed; ${report.summary.failed} failed.\n\n## Failed checks\n\n${report.checks.filter(x=>!x.pass).map(x=>`- ${x.name}: ${JSON.stringify(x.detail)}`).join('\n')||'None.'}\n\n## Screenshots\n\n${report.screenshots.map(x=>`- ${x}`).join('\n')}\n`);
 console.log('SUMMARY',JSON.stringify(report.summary));
}
process.exitCode=report.summary.failed?1:0;
