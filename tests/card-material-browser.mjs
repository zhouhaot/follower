import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=process.env.AUDIT_URL||'http://127.0.0.1:4173';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const output=process.env.MATERIAL_QA_OUTPUT||'reports/qa/card-material-20261023/first';
await mkdir(output,{recursive:true});
const report={checks:[],errors:[],scope:'Local Chrome. Mobile is viewport and touch emulation, not real hardware.'};
const browser=await chromium.launch({headless:true,executablePath:process.env.AUDIT_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});console.log(`${pass?'PASS':'FAIL'} ${name}`);};
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
async function frames(page,count=6){await page.evaluate(async count=>{for(let i=0;i<count;i++)await window.__frame();},count);}
async function ready(page){await page.waitForSelector('.material-ready');await page.waitForFunction(()=>document.querySelectorAll('.material-ready').length===2);await page.evaluate(()=>document.fonts.ready);await frames(page);}
async function setup(width,options={}){
 const context=await browser.newContext({viewport:{width,height:width>700?980:844},deviceScaleFactor:1,hasTouch:width<701,isMobile:width<701,...options});
 await context.addInitScript(()=>{
   const raf=requestAnimationFrame.bind(window);window.__frame=()=>new Promise(raf);window.__raf=0;window.__draw=0;window.__samples=[];
   window.requestAnimationFrame=fn=>{window.__raf++;return raf(fn);};
   for(const Context of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(Context)for(const name of ['drawElements','drawArrays']){
     const draw=Context.prototype[name];Context.prototype[name]=function(...args){window.__draw++;const result=draw.apply(this,args);if(window.__samples.length<2){const pixel=new Uint8Array(4);this.readPixels(Math.floor(this.drawingBufferWidth/2),Math.floor(this.drawingBufferHeight/2),1,1,this.RGBA,this.UNSIGNED_BYTE,pixel);window.__samples.push([...pixel]);}return result;};
   }
 });
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(16000);
 return {context,page};
}
try{
 for(const width of [1280,768,390,320]){
  const {context,page}=await setup(width);const shaderErrors=[];page.on('console',msg=>{if(['error','warning'].includes(msg.type())&&/shader|VALIDATE_STATUS|GL_INVALID/.test(msg.text()))shaderErrors.push(msg.text());});
  await page.goto(`${base}/card-material.html`);await ready(page);
  check(`${width}: both actual WebGL materials render`,await page.locator('.material-ready canvas').count()===2&&await page.evaluate(()=>window.__draw>0)&&shaderErrors.length===0,shaderErrors);
  check(`${width}: center artwork is colored, not a blank texture`,await page.evaluate(()=>window.__samples.length===2&&window.__samples.every(p=>Math.max(...p.slice(0,3))>60)),await page.evaluate(()=>window.__samples));
  check(`${width}: no horizontal page overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check(`${width}: complete cards fit screen width`,await page.locator('.specimen').evaluateAll(cards=>cards.every(c=>{const r=c.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));
  check(`${width}: both original artworks decoded`,await page.locator('.card-art img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth===884&&i.naturalHeight===1255)));
  await page.screenshot({path:`${output}/${width}-comparison.png`,fullPage:true});
  let before=await page.evaluate(()=>({draw:window.__draw,raf:window.__raf}));await frames(page,15);
  check(`${width}: idle does not draw or schedule frames`,JSON.stringify(before)===JSON.stringify(await page.evaluate(()=>({draw:window.__draw,raf:window.__raf}))));
  const card=page.locator('[data-material=pearl] .specimen');await card.scrollIntoViewIfNeeded();await frames(page);await card.focus();
  await page.keyboard.press('Home');await frames(page);const initial=await card.locator('canvas').screenshot();
  await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await frames(page);
  check(`${width}: keyboard changes angle`,await card.evaluate(e=>parseFloat(e.style.getPropertyValue('--ry'))>0));
  const turned=await card.locator('canvas').screenshot();
  check(`${width}: turning changes rendered material pixels`,hash(initial)!==hash(turned));
  await page.keyboard.press('Home');await frames(page);
  check(`${width}: Home restores the exact material image`,hash(initial)===hash(await card.locator('canvas').screenshot()));
  if(width===1280){
    const paper=page.locator('[data-material=paper] canvas');await paper.scrollIntoViewIfNeeded();await frames(page);
    await paper.screenshot({path:`${output}/paper-detail.png`});await card.locator('canvas').screenshot({path:`${output}/pearl-detail.png`});
    const box=await card.boundingBox();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.4);await frames(page);
    check('Desktop pointer directs material light',await card.evaluate(e=>parseFloat(e.style.getPropertyValue('--ry'))>0));
    await page.mouse.move(0,0);await frames(page);
    await page.locator('#demo-light').click();await frames(page,24);await page.screenshot({path:`${output}/1280-light-sweep.png`,fullPage:true});
    check('Light sweep changes both card angles',await page.locator('.specimen').evaluateAll(cards=>cards.every(c=>Math.abs(parseFloat(c.style.getPropertyValue('--ry')))>0)));
    await page.waitForFunction(()=>document.querySelector('#demo-light').textContent==='演示光影');await frames(page);
    before=await page.evaluate(()=>window.__draw);await frames(page,15);
    check('Light sweep stops drawing after completing',before===await page.evaluate(()=>window.__draw));
    await page.locator('#demo-light').click();await page.locator('#demo-light').click();await page.locator('#original-toggle').click();await frames(page);
    check('Original cancels sweep and straightens cards',await page.locator('.specimen').evaluateAll(cards=>cards.every(c=>!c.style.getPropertyValue('--ry'))));
  }else if(width===390){
    const cdp=await context.newCDPSession(page);const box=await card.boundingBox();
    const x=box.x+box.width*.4,y=box.y+box.height*.5;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+55,y}]});await frames(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames(page);
    check('Touch horizontal drag turns the pearl card',await card.evaluate(e=>parseFloat(e.style.getPropertyValue('--ry'))>0));
  }
  if(await page.locator('#original-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#original-toggle').click();await frames(page);
  check(`${width}: original toggle shows unfiltered image`,await page.locator('.card-art canvas').evaluateAll(cs=>cs.every(c=>getComputedStyle(c).opacity==='0'))&&await page.locator('#original-toggle').getAttribute('aria-pressed')==='true');
  before=await page.evaluate(()=>window.__draw);await frames(page,12);check(`${width}: original mode has no render loop`,before===await page.evaluate(()=>window.__draw));
  await page.locator('#original-toggle').click();await frames(page);check(`${width}: return to material remains usable`,await page.locator('#demo-light').isEnabled());
  await context.close();
 }
 {
  const {context,page}=await setup(390,{reducedMotion:'reduce'});await page.goto(`${base}/card-material.html`);await ready(page);
  check('Reduced motion hides sweep and keeps original comparison',await page.locator('#demo-light').isHidden()&&await page.locator('#original-toggle').isEnabled());
  const card=page.locator('.specimen').first();await card.focus();await page.keyboard.press('ArrowRight');await frames(page);
  check('Reduced motion never tilts the card',await card.evaluate(e=>getComputedStyle(e).transform==='none'));
  await page.screenshot({path:`${output}/390-reduced.png`,fullPage:true});await context.close();
 }
 for(const failure of ['module','webgl','image','context']){
  const {context,page}=await setup(1280);
  if(failure==='module')await page.route('**/card-material-renderer.mjs',route=>route.abort());
  if(failure==='webgl')await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
  if(failure==='image')await page.route('**/assets/originals/lotus/target.png',route=>route.abort());
  await page.goto(`${base}/card-material.html`);
  if(failure==='context'){await ready(page);await page.locator('canvas').evaluateAll(cs=>cs.forEach(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()));}
  await page.waitForFunction(()=>[...document.querySelectorAll('.material-status')].every(e=>/暂不可用|加载失败/.test(e.textContent)));
  check(`${failure}: explicit fallback message`,await page.locator('.material-ready').count()===0);
  check(`${failure}: unavailable controls disabled`,await page.locator('#demo-light').isDisabled()&&await page.locator('#original-toggle').isDisabled());
  if(failure!=='image')check(`${failure}: original image still decoded`,await page.locator('.card-art img').evaluateAll(images=>images.every(i=>i.naturalWidth>0)));
  await page.screenshot({path:`${output}/fallback-${failure}.png`,fullPage:true});await context.close();
 }
 {
  const {context,page}=await setup(1280);await page.goto(`${base}/card-material.html`);await ready(page);
  await page.locator('#demo-light').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await frames(page);const before=await page.evaluate(()=>window.__draw);await frames(page,15);
  check('Hidden document cancels animation and pending draws',before===await page.evaluate(()=>window.__draw));
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await frames(page);
  await page.evaluate(()=>{document.querySelector('main').style.paddingBottom='1400px';scrollTo(0,document.body.scrollHeight);});await frames(page);
  const idle=await page.evaluate(()=>window.__draw);await page.locator('#demo-light').evaluate(e=>e.click());await frames(page,15);
  check('Offscreen cards do not draw',idle===await page.evaluate(()=>window.__draw));await context.close();
 }
 const baseline=JSON.parse(await readFile('reports/qa/card-material-20261023/baseline.json','utf8'));
 // Homepage/index intentionally adopted pearl material after this sample baseline.
 check('Existing model optimization, original assets and retained motion modules unchanged',(await Promise.all(Object.entries(baseline).filter(([file])=>!['public/app.mjs','public/index.html'].includes(file)).map(async([file,expected])=>hash(await readFile(file))===expected))).every(Boolean));
 check('No uncaught page errors',report.errors.length===0,report.errors);
}finally{
 await browser.close();report.summary={total:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};
 await writeFile(`${output}/checks.json`,JSON.stringify(report,null,2)+'\n');
}
console.log(report.summary);if(report.summary.failed)process.exitCode=1;
