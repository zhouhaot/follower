import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.AUDIT_URL || 'http://127.0.0.1:4173';
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname), 'Local server only');
const output = path.resolve(process.env.PHASE2_QA_OUTPUT || 'reports/qa/phase2');
await mkdir(output,{recursive:true});
const report={date:new Date().toISOString(),scope:'Scripted simulated first-visit walkthrough; no human participants; isolated synthetic local storage; no camera access.',checks:[],errors:[],screenshots:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.AUDIT_CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
report.browser=browser.version();
function check(name,pass,detail){report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});console.log(`${pass?'PASS':'FAIL'} ${name}`);}
async function snapshot(page,name,fullPage=true){
 await page.evaluate(()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');window.scrollTo({top:0,behavior:'instant'});});
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 await page.screenshot({path:path.join(output,`${name}.png`),fullPage});report.screenshots.push(`${name}.png`);
 check(`${name}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
}
const key='flowers-speak:cloud-candidate:collection:v2';
try{
 for(const width of [1280,768,390,320]){
  const context=await browser.newContext({viewport:{width,height:width>700?900:844},timezoneId:'Asia/Shanghai'});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const requests=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>report.errors.push({width,message:e.message}));
  page.on('response',r=>{if(r.status()>=400)report.errors.push({width,status:r.status(),url:r.url()});});
  await context.addInitScript(()=>{
   window.phase2AudioAttempts=0;window.Audio=class {constructor(){window.phase2AudioAttempts++;throw Error('Audio not authorized');}};
   if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{throw Error('Camera excluded');};
  });
  await page.goto(base);
  await snapshot(page,`${width}-home`,true);
  const primary=page.getByRole('link',{name:'从清荷入梦开始',exact:true});
  check(`${width}: story entry visible in first viewport`,await primary.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
  check(`${width}: static home makes no hand or Three requests`,requests.every(u=>!/(hand-sequence|handheld|three\.module|model-viewer)/.test(u))&&await page.locator('canvas').count()===0);
  check(`${width}: all home card links point at current detail`,await page.locator('.home-cards .card-image').evaluateAll(a=>a.length===5&&a.every(x=>x.getAttribute('href').startsWith('flower-detail.html?key='))));
  await primary.focus();await page.keyboard.press('Enter');await page.waitForURL('**/flower-detail.html?key=lotus');
  check(`${width}: keyboard entry opens story`,await page.locator('h1').textContent()==='清荷入梦');
  check(`${width}: silent story complete and honest`,await page.locator('#audio-btn').isDisabled()&&await page.getByText('当前暂无配音，完整故事已在上方呈现。',{exact:true}).count()===1&&await page.evaluate(()=>phase2AudioAttempts)===0);
  let stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  check(`${width}: reading does not auto-collect`,stored.collections.length===0&&stored.recentViews[0].key==='lotus');
  await page.locator('#collect-btn').click();
  check(`${width}: save confirmation names recovery destination`,(await page.locator('#collection-status').textContent()).includes('我的花册')&&await page.locator('#collect-btn').getAttribute('aria-pressed')==='true');
  await snapshot(page,`${width}-detail`);
  await page.getByRole('link',{name:'到我的花册查看',exact:false}).click();
  check(`${width}: collection retrievable through visible link`,await page.locator('.collection-card h3').textContent()==='清荷入梦');
  await snapshot(page,`${width}-collection`);
  const reopened=await context.newPage();await reopened.goto(`${base}/`);await reopened.getByRole('link',{name:'我的花册',exact:true}).click();
  check(`${width}: later visit from home finds saved flower`,await reopened.locator('.collection-card').count()===1&&await reopened.locator('.collection-card h3').textContent()==='清荷入梦');
  await reopened.close();
  await page.getByRole('link',{name:'花卡图录',exact:true}).click();await snapshot(page,`${width}-catalogue`);
  const collect=page.locator('.collect-btn[data-key=leaves]');await collect.focus();await page.keyboard.press('Space');
  check(`${width}: collection toggle retains keyboard focus`,await collect.evaluate(e=>e===document.activeElement)&&await collect.getAttribute('aria-pressed')==='true');
  await page.keyboard.press('Space');
  check(`${width}: second keyboard toggle cancels same collection`,await collect.getAttribute('aria-pressed')==='false');
  const story=page.locator('.flower-card[data-key=peony]').getByRole('link',{name:'牡丹承瑞',exact:true});await story.focus();await page.keyboard.press('Enter');await page.waitForURL('**/flower-detail.html?key=peony');
  check(`${width}: catalogue supports keyboard story entry`,await page.locator('h1').textContent()==='牡丹承瑞');
  await page.getByRole('button',{name:'立体花朵',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#detail-model').classList.contains('model-ready')||document.querySelector('#detail-model').classList.contains('fallback-only'));
  check(`${width}: model remains beside the same story`,page.url().endsWith('/flower-detail.html?key=peony')&&await page.locator('h1').textContent()==='牡丹承瑞'&&await page.locator('.flower-story').isVisible());
  await page.getByRole('button',{name:'原作花卡',exact:true}).click();
  await page.getByText('有实体花卡？',{exact:true}).click();await page.getByRole('link',{name:'进入扫描准备页',exact:false}).click();
  check(`${width}: optional scanner receives peony instead of default lotus`,new URL(page.url()).searchParams.get('card')==='peony'&&await page.locator('h1').textContent()==='牡丹承瑞');
  await page.locator('#scan-back').click();await page.waitForURL('**/flower-detail.html?key=peony');
  check(`${width}: scanner return retains flower`,await page.locator('h1').textContent()==='牡丹承瑞');
  await context.close();
 }
 const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const p=await reduced.newPage();await p.goto(base);await p.getByRole('link',{name:'从清荷入梦开始',exact:true}).click();await p.waitForURL('**/flower-detail.html?key=lotus');
 check('Reduced motion: story entry remains available',await p.locator('h1').textContent()==='清荷入梦');await reduced.close();
 check('No page errors or HTTP failures',report.errors.length===0,report.errors);
}catch(e){check('Walkthrough completed',false,{message:e.message,stack:e.stack});}
finally{await browser.close();report.summary={total:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};await writeFile(path.join(output,'phase2-browser.json'),JSON.stringify(report,null,2));console.log('SUMMARY',report.summary);}
process.exitCode=report.summary.failed?1:0;
