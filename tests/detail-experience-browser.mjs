import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {cards} from '../public/cards.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:4173';
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),'Local test server only');
const output=path.resolve(process.env.DETAIL_QA_OUTPUT||'reports/qa/detail-experience-20261023');
await mkdir(output,{recursive:true});
const report={date:new Date().toISOString(),scope:'Isolated local Chrome. Desktop and emulated touch layouts; no real phone, camera, audio, or human participant.',checks:[],errors:[],screenshots:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.AUDIT_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
report.browser=browser.version();
const storageKey='flowers-speak:cloud-candidate:collection:v2';
function check(name,passed,detail){report.checks.push({name,pass:!!passed,...(detail===undefined?{}:{detail})});console.log(`${passed?'PASS':'FAIL'} ${name}`);}
async function setup(width,{fault,reducedMotion}={}){
 const context=await browser.newContext({viewport:{width,height:width>700?900:844},hasTouch:width<701,isMobile:width<701,timezoneId:'Asia/Shanghai',reducedMotion});
 await context.addInitScript(fault=>{
  window.detailAudioAttempts=0;window.detailCameraAttempts=0;
  window.Audio=class{constructor(){window.detailAudioAttempts++;throw Error('Audio not authorized');}};
  if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{window.detailCameraAttempts++;throw Error('No camera in detail test');};
  if(fault==='webgl'){
   const getContext=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...rest){return /webgl/i.test(type)?null:getContext.call(this,type,...rest);};
  }
 },fault);
 if(fault==='module')await context.route('**/model-viewer.mjs',route=>route.abort());
 if(fault==='asset')await context.route('**/lotus-relief.glb',route=>route.abort());
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push({width,fault,message:e.message}));
 return {context,page};
}
async function screenshot(page,name){
 await page.evaluate(()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');window.scrollTo({top:0,behavior:'instant'});});
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 await page.screenshot({path:path.join(output,`${name}.png`),fullPage:true});report.screenshots.push(`${name}.png`);
}
async function ready(page){await page.waitForFunction(()=>document.querySelector('#detail-model').classList.contains('model-ready')||document.querySelector('#detail-model').classList.contains('fallback-only'));}
async function canvasHash(page){return createHash('sha256').update(await page.locator('#detail-model canvas').screenshot()).digest('hex');}
try{
 for(const width of [1280,768,390,320]){
  const {context,page}=await setup(width);const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.goto(`${base}/flower-detail.html?key=lotus&view=original`);
  check(`${width}: original view does not load Three or model`,!requests.some(u=>/three\.module|model-viewer|\.glb/.test(u))&&await page.locator('#detail-original').isVisible());
  check(`${width}: title and view choices appear in first viewport`,await page.locator('.detail-title').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight)&&await page.locator('.exhibit-switch').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight));
  check(`${width}: model and story use responsive layout`,await page.evaluate(()=>{
   const a=document.querySelector('.flower-exhibit').getBoundingClientRect(),b=document.querySelector('.flower-info').getBoundingClientRect();
   return innerWidth<=700?b.top>=a.bottom:b.left>=a.right&&Math.abs(a.top-b.top)<2;
  }));
  check(`${width}: original, story and observation belong to same flower`,await page.locator('.flower-story p').textContent()===cards.find(c=>c.key==='lotus').story&&(await page.locator('.flower-observation p').textContent()).includes('两侧圆叶'));
  await screenshot(page,`${width}-original`);
  const initialHeight=await page.locator('.detail-stage').evaluate(e=>e.getBoundingClientRect().height);
  await page.getByRole('button',{name:'立体花朵',exact:true}).click();await ready(page);
  const interactive=await page.locator('#detail-model').evaluate(e=>e.classList.contains('model-ready')&&!e.classList.contains('fallback-only'));
  check(`${width}: actual interactive model loads`,interactive);
  if(!interactive)throw Error(`Unexpected model fallback at ${width}`);
  check(`${width}: story retained and stage height stable`,await page.locator('.flower-story p').textContent()===cards.find(c=>c.key==='lotus').story&&await page.locator('.detail-stage').evaluate(e=>e.getBoundingClientRect().height)===initialHeight);
  check(`${width}: device-specific guidance`,(await page.locator('#exhibit-status').textContent()).includes(width<701?'单指转动':'滚轮缩放'));
  const before=await canvasHash(page);await page.getByRole('button',{name:'向左转动模型',exact:true}).focus();await page.keyboard.press('Enter');
  check(`${width}: keyboard turn changes rendered model`,before!==await canvasHash(page));
  await page.getByRole('button',{name:'重置模型视角',exact:true}).click();
  check(`${width}: reset restores initial image`,before===await canvasHash(page));
  await page.getByRole('button',{name:'放大模型',exact:true}).click();
  check(`${width}: zoom changes rendered model`,before!==await canvasHash(page));await page.getByRole('button',{name:'重置模型视角',exact:true}).click();
  if(width>=701){
    const box=await page.locator('#detail-model canvas').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.wheel(0,3);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    check(`${width}: tiny trackpad wheel delta repaints immediately`,before!==await canvasHash(page));
    await page.getByRole('button',{name:'重置模型视角',exact:true}).click();
    check(`${width}: reset after wheel restores exact image`,before===await canvasHash(page));
  }
  if(width<701){
    await page.locator('#detail-model').scrollIntoViewIfNeeded();
    const bounds=await page.locator('#detail-model canvas').boundingBox(),cdp=await context.newCDPSession(page);
    const startX=bounds.x+bounds.width*.4,startY=bounds.y+bounds.height*.5;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:startX,y:startY}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX+45,y:startY}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    check(`${width}: touch drag changes model`,before!==await canvasHash(page));
    await page.getByRole('button',{name:'重置模型视角',exact:true}).click();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:startX-30,y:startY,id:1},{x:startX+30,y:startY,id:2}]});
    for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX-30-step*4,y:startY,id:1},{x:startX+30+step*4,y:startY,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    check(`${width}: two-finger pinch changes rendered model`,before!==await canvasHash(page));
    await page.getByRole('button',{name:'重置模型视角',exact:true}).click();
    check(`${width}: reset after pinch restores exact image`,before===await canvasHash(page));
    check(`${width}: touch guidance survives alternate input`,(await page.locator('#exhibit-status').textContent()).includes('单指转动'));
    await cdp.detach();
  }
  await screenshot(page,`${width}-bloom`);
  await page.getByRole('button',{name:'金属花卡',exact:true}).click();
  check(`${width}: metal view renders another model`,await page.locator('[data-exhibit-view=relief]').getAttribute('aria-pressed')==='true'&&before!==await canvasHash(page));
  if(width===1280||width===390)await screenshot(page,`${width}-relief`);
  await page.getByRole('button',{name:'实体花卡',exact:true}).click();
  check(`${width}: original return hides model tools`,await page.locator('#detail-original').isVisible()&&await page.locator('.view-tools').isHidden());
  let data=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),storageKey);
  check(`${width}: viewing and switching never collects`,data.collections.length===0&&data.recentViews[0].key==='lotus');
  await page.locator('#collect-btn').click();await page.reload();
  check(`${width}: explicit collection survives reload`,await page.locator('#collect-btn').textContent()==='已收藏');
  const nextHref=await page.locator('#meet-another').getAttribute('href'),nextKey=new URL(nextHref,base).searchParams.get('key');
  check(`${width}: next flower is a valid different card`,nextKey!=='lotus'&&cards.some(c=>c.key===nextKey));
  await page.locator('#meet-another').click();await page.waitForURL(`**/flower-detail.html?key=${nextKey}`);
  check(`${width}: next flower displays matching story`,await page.locator('h1').textContent()===cards.find(c=>c.key===nextKey).title&&await page.locator('.flower-story p').textContent()===cards.find(c=>c.key===nextKey).story);
  data=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),storageKey);
  check(`${width}: next flower only adds a view`,data.collections.length===1&&data.collections[0].key==='lotus'&&data.recentViews[0].key===nextKey);
  check(`${width}: no overflow and usable touch targets`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('.exhibit-switch button,.view-tools button,#collect-btn,#meet-another')].filter(e=>e.offsetParent!==null).every(e=>e.getBoundingClientRect().height>=44)));
  check(`${width}: no audio or camera requests`,await page.evaluate(()=>detailAudioAttempts===0&&detailCameraAttempts===0));
  await context.close();
 }
 const {context,page}=await setup(1280);
 for(const card of cards){
  await page.goto(`${base}/flower-detail.html?key=${card.key}&view=bloom`);await ready(page);
  check(`${card.key}: direct model link and observation work`,await page.locator('#detail-model').evaluate(e=>e.classList.contains('model-ready')&&!e.classList.contains('fallback-only'))&&await page.locator('h1').textContent()===card.title&&(await page.locator('.flower-observation p').textContent()).length>15&&await page.locator('.flower-story p').textContent()===card.story);
  const other=new URL(await page.locator('#meet-another').getAttribute('href'),base).searchParams.get('key');
  check(`${card.key}: discovery never points to itself`,other!==card.key&&cards.some(c=>c.key===other));
  await screenshot(page,`flower-${card.key}`);
 }
 // Context loss must replace rotation guidance with honest static-mode messaging.
 await page.evaluate(()=>document.querySelector('#detail-model canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await page.waitForFunction(()=>document.querySelector('#detail-model').classList.contains('fallback-only'));
 check('Context loss: fallback message and static image',await page.getByText('三维暂不可用，当前显示静态效果图。仍可切换实体花卡、阅读故事或收藏。',{exact:true}).count()===1&&await page.locator('.view-tools').isHidden()&&await page.locator('#detail-model img').isVisible());
 await context.close();
 for(const fault of ['webgl','module','asset']){
  const {context,page}=await setup(390,{fault});await page.goto(`${base}/flower-detail.html?key=lotus`);await page.getByRole('button',{name:'立体花朵',exact:true}).click();await ready(page);
  check(`${fault}: failure offers still image, original and story`,await page.locator('#detail-model').evaluate(e=>e.classList.contains('fallback-only'))&&await page.locator('.view-tools').isHidden()&&await page.locator('#exhibit-reload').isVisible()&&await page.locator('.flower-story p').textContent()===cards.find(c=>c.key==='lotus').story);
  await page.locator('#collect-btn').click();check(`${fault}: model failure does not block collection`,await page.locator('#collect-btn').textContent()==='已收藏');
  if(fault==='webgl')await screenshot(page,'390-model-unavailable');
  await page.getByRole('button',{name:'实体花卡',exact:true}).click();check(`${fault}: original remains available`,await page.locator('#detail-original').isVisible());await context.close();
 }
 const slow=await setup(390);let release;const gate=new Promise(resolve=>release=resolve);
 await slow.context.route('**/model-viewer.mjs',async route=>{await gate;await route.continue();});
 await slow.page.goto(`${base}/flower-detail.html?key=lotus`);await slow.page.getByRole('button',{name:'立体花朵',exact:true}).click();
 check('Slow load: story available while loading',await slow.page.getByText('正在加载三维画面，故事仍可阅读…',{exact:true}).count()===1&&await slow.page.locator('.flower-story').isVisible());
 await slow.page.getByRole('button',{name:'实体花卡',exact:true}).click();release();await ready(slow.page);
 check('Slow load: late result does not override original choice',await slow.page.locator('#detail-original').isVisible()&&await slow.page.locator('[data-exhibit-view=original]').getAttribute('aria-pressed')==='true');await slow.context.close();
 const reduced=await setup(390,{reducedMotion:'reduce'});await reduced.page.goto(`${base}/flower-detail.html?key=lotus`);
 check('Reduced motion: no required animation to reach story',await reduced.page.locator('#detail-pearl').isVisible()&&await reduced.page.locator('.flower-story').isVisible());await reduced.context.close();
 check('No uncaught page errors',report.errors.length===0,report.errors);
}catch(error){check('Detail workflow completed',false,{message:error.message,stack:error.stack});}
finally{await browser.close();report.summary={total:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};await writeFile(path.join(output,'detail-browser.json'),JSON.stringify(report,null,2));console.log('SUMMARY',report.summary);}
process.exitCode=report.summary.failed?1:0;
