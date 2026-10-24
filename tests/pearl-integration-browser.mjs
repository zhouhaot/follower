import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {cards} from '../public/cards.mjs';
const base=process.env.AUDIT_URL||'http://127.0.0.1:4173';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output=process.env.PEARL_QA_OUTPUT||'reports/qa/pearl-integration-20261023/first';await mkdir(output,{recursive:true});
const report={checks:[],errors:[],performance:[],scope:'Local Chrome, desktop and emulated touch. No physical phone/GPU guarantee.'};
const browser=await chromium.launch({headless:true,executablePath:process.env.AUDIT_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});console.log(`${pass?'PASS':'FAIL'} ${name}`);};
const hash=b=>createHash('sha256').update(b).digest('hex');
async function frames(page,n=8){await page.evaluate(async n=>{for(let i=0;i<n;i++)await window.__frame();},n);}
async function setup(width,options={}){
 const context=await browser.newContext({viewport:{width,height:width>700?900:844},deviceScaleFactor:1,hasTouch:width<701,isMobile:width<701,...options});
 await context.addInitScript(()=>{
  const raf=requestAnimationFrame.bind(window);window.__frame=()=>new Promise(raf);window.__gls=[];window.__draws=0;window.__cost=[];
  const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){const c=get.call(this,type,...args);if(c&&/webgl/.test(type)&&!window.__gls.includes(c))window.__gls.push(c);return c;};
  for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(C){const draw=C.prototype.drawElements;C.prototype.drawElements=function(...args){window.__draws++;return draw.apply(this,args);};}
 });
 await context.route('**/pearl-renderer.mjs',async route=>{
  const response=await route.fetch();let source=await response.text();
  source=source.replace("if(disposed||failed)return false;", "const measuredStart=performance.now();if(disposed||failed)return false;");
  source=source.replace('context.drawImage(renderer.domElement,0,0,w,h);return true;', 'context.drawImage(renderer.domElement,0,0,w,h);window.__cost.push(performance.now()-measuredStart);return true;');
  await route.fulfill({response,body:source});
 });
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(/GL_INVALID|VALIDATE_STATUS|Shader Error/.test(m.text()))report.errors.push(m.text());});
 return {context,page};
}
async function ready(locator){await locator.waitFor({state:'visible'});await locator.scrollIntoViewIfNeeded();await locator.page().waitForFunction(el=>el.dataset.pearlState==='ready',await locator.elementHandle());await frames(locator.page());}
async function shot(page,name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${output}/${name}.png`,fullPage:true});}
async function pixels(locator){return locator.locator('canvas').evaluate(c=>{const ctx=c.getContext('2d');let lit=0;for(let x=1;x<=5;x++)for(let y=1;y<=7;y++){const p=ctx.getImageData(Math.floor(c.width*x/6),Math.floor(c.height*y/8),1,1).data;if(Math.max(...p.slice(0,3))>80&&p[3]===255)lit++;}return lit>=5;});}
async function idle(page,name){await frames(page);const n=await page.evaluate(()=>window.__draws);await frames(page,15);check(name,n===await page.evaluate(()=>window.__draws));}
async function performanceSample(page,locator,width,surface){
 await locator.scrollIntoViewIfNeeded();await ready(locator);
 const metrics=await locator.evaluate(async element=>{
  const r=element.getBoundingClientRect(),start=window.__draws;window.__cost=[];const gaps=[];let before=performance.now();
  for(let i=0;i<45;i++){await window.__frame();const now=performance.now();gaps.push(now-before);before=now;for(let j=0;j<4;j++)element.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:r.left+r.width*(.25+.5*Math.sin(i/10+j/50)**2),clientY:r.top+r.height*.4}));}
  await window.__frame();await window.__frame();gaps.sort((a,b)=>a-b);const costs=window.__cost.sort((a,b)=>a-b);
  return {draws:window.__draws-start,median:gaps[22],p95:gaps[42],submissionAndCopyP95:costs[Math.floor(costs.length*.95)]||0};
 });report.performance.push({surface,width,dpr:await page.evaluate(()=>devicePixelRatio),...metrics});check(`${surface} ${width}: 180 input events coalesce to at most 46 draws`,metrics.draws<=46&&metrics.draws>=40,metrics);await idle(page,`${surface} ${width}: no draws after dense input`);
}
try{
 for(const width of [1280,768,390,320]){
  const {context,page}=await setup(width);const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base);
  const main=page.locator('.home-main-card [data-pearl]');await ready(main);
  check(`Home ${width}: actual pearl pixels`,await pixels(main));
  check(`Home ${width}: no 3D flower or hand assets`,!requests.some(u=>/model-viewer|\.glb|hand-sequence|handheld/.test(u)));
  check(`Home ${width}: story action visible in first viewport`,await page.getByRole('link',{name:'从清荷入梦开始',exact:true}).evaluate(e=>e.getBoundingClientRect().bottom<innerHeight));
  check(`Home ${width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await idle(page,`Home ${width}: idle has no rendering loop`);
  const items=page.locator('.home-cards [data-pearl]');
  for(let i=0;i<5;i++){const item=items.nth(i);await item.scrollIntoViewIfNeeded();await ready(item);check(`Home ${width}: ${cards[i].key} artwork and pearl ready`,await pixels(item)&&await item.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0));}
  check(`Home ${width}: six cards share one WebGL context`,await page.evaluate(()=>window.__gls.length===1));
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await ready(main);await shot(page,`${width}-home`);check(`Home ${width}: settled fonts and navigation fit`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('.glass-nav a')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));
  const link=page.locator('.home-main-card');await link.focus();await page.keyboard.press('ArrowRight');await frames(page);
  check(`Home ${width}: focused link supports pearl keyboard control`,await main.evaluate(e=>parseFloat(e.style.getPropertyValue('--pearl-y'))>0));
  await page.keyboard.press('Home');await frames(page);
  if(width===1280||width===390)await performanceSample(page,main,width,'home');
  if(width===390){
    await main.scrollIntoViewIfNeeded();const box=await main.boundingBox(),cdp=await context.newCDPSession(page),x=box.x+box.width*.4,y=box.y+box.height*.5;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+60,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(page);
    check('Home touch drag adjusts light without opening story',new URL(page.url()).pathname==='/'&&await main.evaluate(e=>parseFloat(e.style.getPropertyValue('--pearl-y'))>0));
    const before=await page.evaluate(()=>scrollY);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-130}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(page,20);
    check('Home card permits vertical touch scrolling',await page.evaluate(()=>scrollY)>before);
  }
  await page.locator('#home-pearl-demo').click();await frames(page,25);if(width===1280)await shot(page,'1280-home-light');await frames(page,100);await idle(page,`Home ${width}: finite light sweep stops`);
  await page.getByRole('link',{name:'从清荷入梦开始',exact:true}).click();await page.waitForURL('**/flower-detail.html?key=lotus');
  const card=page.locator('#detail-pearl [data-pearl]');await ready(card);
  check(`Detail ${width}: pearl is default and retains full story`,await page.locator('[data-exhibit-view=pearl]').getAttribute('aria-pressed')==='true'&&await pixels(card)&&await page.locator('.flower-story p').textContent()===cards.find(c=>c.key==='lotus').story);
  check(`Detail ${width}: layout fits and keeps touch controls`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('.exhibit-switch button,.pearl-detail-tools button')].every(e=>e.getBoundingClientRect().height>=44)));
  await shot(page,`${width}-detail`);await idle(page,`Detail ${width}: pearl idle has no rendering loop`);
  await card.focus();await page.keyboard.press('Home');await frames(page);const before=hash(await card.locator('canvas').screenshot());await page.keyboard.press('ArrowLeft');await frames(page);
  check(`Detail ${width}: keyboard changes material pixels`,before!==hash(await card.locator('canvas').screenshot()));await page.keyboard.press('Home');await frames(page);check(`Detail ${width}: reset restores exact pearl pixels`,before===hash(await card.locator('canvas').screenshot()));
  if(width===1280||width===390)await performanceSample(page,card,width,'detail');
  await page.getByRole('button',{name:'实体花卡',exact:true}).click();check(`Detail ${width}: complete original remains accessible`,await page.locator('#detail-original').isVisible()&&await page.locator('#detail-original img').getAttribute('src')===cards.find(c=>c.key==='lotus').image);await idle(page,`Detail ${width}: original view stops pearl drawing`);
  await page.getByRole('button',{name:'立体花朵',exact:true}).click();await page.waitForSelector('#detail-model.model-ready');
  check(`Detail ${width}: explicit model loads beside same story`,await page.locator('#detail-model').isVisible()&&await page.locator('#detail-pearl').isHidden()&&await page.locator('.flower-story').isVisible());await idle(page,`Detail ${width}: model and hidden pearl remain idle`);
  await page.getByRole('button',{name:'作品',exact:true}).click();await ready(card);check(`Detail ${width}: return to pearl preserves content`,await pixels(card)&&await page.locator('#detail-model').isHidden());
  await page.locator('#collect-btn').click();await page.reload();await ready(page.locator('#detail-pearl [data-pearl]'));check(`Detail ${width}: collection still persists`,await page.locator('#collect-btn').textContent()==='已收藏');
  await context.close();
 }
 {
  const {context,page}=await setup(1280);
  for(const card of cards){await page.goto(`${base}/flower-detail.html?key=${card.key}`);const material=page.locator('#detail-pearl [data-pearl]');await ready(material);check(`${card.key}: full matching artwork and story`,await pixels(material)&&await material.locator('img').getAttribute('src')===card.target&&await page.locator('.flower-story p').textContent()===card.story);await shot(page,`detail-${card.key}`);}
  await context.close();
 }
 {
  const {context,page}=await setup(390,{reducedMotion:'reduce'});await page.goto(base);await ready(page.locator('.home-main-card [data-pearl]'));check('Reduced motion: home static pearl and no sweep button',await page.locator('#home-pearl-demo').isHidden());await page.goto(`${base}/flower-detail.html?key=lotus`);const card=page.locator('#detail-pearl [data-pearl]');await ready(card);await card.focus();await page.keyboard.press('ArrowRight');await frames(page);check('Reduced motion: detail static pearl remains readable',await card.evaluate(e=>getComputedStyle(e).transform==='none')&&await page.locator('#detail-pearl-demo').isHidden());await idle(page,'Reduced motion: no continuous redraw');await context.close();
 }
 for(const fault of ['renderer','gallery','webgl','image','context']){
  const {context,page}=await setup(390);
  if(fault==='renderer')await page.route('**/pearl-renderer.mjs',route=>route.abort());
  if(fault==='gallery')await page.route('**/pearl-gallery.mjs',route=>route.abort());
  if(fault==='image')await page.route('**/assets/originals/lotus/target.png',route=>route.abort());
  if(fault==='webgl')await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
  await page.goto(`${base}/flower-detail.html?key=lotus`);
  if(fault==='context'){await ready(page.locator('#detail-pearl [data-pearl]'));await page.evaluate(()=>window.__gls[0].getExtension('WEBGL_lose_context').loseContext());}
  await page.waitForFunction(()=>document.querySelector('#detail-pearl [data-pearl]').dataset.pearlState==='fallback');
  check(`${fault}: failure is explicit and story still available`,(await page.locator('#exhibit-status').textContent()).includes('暂不可用')&&await page.locator('.flower-story p').textContent()===cards.find(c=>c.key==='lotus').story);
  await page.locator('#collect-btn').click();check(`${fault}: failure does not block collection`,await page.locator('#collect-btn').textContent()==='已收藏');await page.getByRole('button',{name:'实体花卡',exact:true}).click();check(`${fault}: complete original still available`,await page.locator('#detail-original img').isVisible());
  if(fault==='renderer')await shot(page,'390-fallback');await context.close();
 }
 {
  const {context,page}=await setup(1280);let release;const gate=new Promise(r=>release=r);await page.route('**/pearl-renderer.mjs',async route=>{await gate;await route.continue();});await page.goto(`${base}/flower-detail.html?key=lotus`);await page.getByRole('button',{name:'实体花卡',exact:true}).click();release();await frames(page,30);check('Late pearl load never overrides original selection',await page.locator('#detail-original').isVisible()&&await page.locator('#detail-pearl').isHidden());await page.getByRole('button',{name:'作品',exact:true}).click();await ready(page.locator('#detail-pearl [data-pearl]'));
  await page.locator('#detail-pearl-demo').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await idle(page,'Hidden document cancels pearl drawing');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await frames(page);await page.evaluate(()=>{document.querySelector('main').style.paddingBottom='1200px';scrollTo(0,document.body.scrollHeight);});await frames(page);await idle(page,'Offscreen pearl stops drawing');await context.close();
 }
 const baseline=JSON.parse(await readFile('reports/qa/pearl-integration-20261023/baseline.json','utf8'));
 for(const file of ['public/model-viewer.mjs','public/cards.mjs','public/frame-renderer.mjs',...Object.keys(baseline).filter(n=>n.startsWith('public/assets/originals/'))])assert.equal(hash(await readFile(file)),baseline[file],file);
 check('Original source images, stories and model optimization unchanged',true);check('No uncaught page or GPU errors',report.errors.length===0,report.errors);
}catch(error){check('Integration workflow completed',false,{message:error.message,stack:error.stack});}
finally{await browser.close();report.summary={total:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};await writeFile(`${output}/checks.json`,JSON.stringify(report,null,2)+'\n');console.log(report.summary);}
if(report.summary.failed)process.exitCode=1;
