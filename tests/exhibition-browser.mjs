import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const base=process.env.AUDIT_URL||'http://127.0.0.1:4173';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output=process.env.EXHIBITION_QA_OUTPUT||'reports/design-20261029/exhibition',shots=process.env.EXHIBITION_SHOTS||'.impeccable/review';
await mkdir(output,{recursive:true});await mkdir(shots,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const checks=[],errors=[],check=(name,pass)=>{checks.push({name,pass:!!pass});console.log(`${pass?'PASS':'FAIL'} ${name}`)};
const key='flowers-speak:cloud-candidate:collection:v2';
try {
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:width>700?1000:844},acceptDownloads:true});
  await context.addInitScript(()=>{window.fieldDraws=0;const fn=WebGLRenderingContext.prototype.drawArrays;WebGLRenderingContext.prototype.drawArrays=function(...args){window.fieldDraws++;return fn.apply(this,args)}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForSelector('#portal-field[data-field-state=ready]');
  await page.locator('[data-portal-card=peony]').click();await page.waitForFunction(()=>document.querySelector('#portal-title').textContent==='牡丹承瑞');
  check(`${width}: select work updates artwork, name, link and URL`,await page.locator('#portal-title').textContent()==='牡丹承瑞'&&(await page.locator('.home-main-card').getAttribute('href')).includes('key=peony')&&(await page.locator('.home-main-card [data-pearl]').getAttribute('data-pearl'))==='peony'&&new URL(page.url()).hash==='#peony');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#portal-title').textContent==='牡丹承瑞');
  check(`${width}: refresh restores selected work`,await page.locator('[data-portal-card=peony]').getAttribute('aria-pressed')==='true');
  await page.getByRole('button',{name:'下一张作品',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#portal-title').textContent==='菊影流金');check(`${width}: next button advances to matching work`,await page.locator('#portal-title').textContent()==='菊影流金');
  await page.getByRole('button',{name:'上一张作品',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#portal-title').textContent==='牡丹承瑞');check(`${width}: previous button restores work`,await page.locator('#portal-title').textContent()==='牡丹承瑞');
  check(`${width}: effects need no buttons`,await page.locator('#portal-motion,#home-pearl-demo').count()===0);
  const active=await page.evaluate(()=>fieldDraws);await page.mouse.move(230,400);await page.waitForTimeout(100);check(`${width}: field responds by default`,await page.evaluate(()=>fieldDraws)>active);
  await page.waitForTimeout(1100);const settled=await page.evaluate(()=>fieldDraws);await page.waitForTimeout(250);check(`${width}: field stops drawing when idle`,await page.evaluate(()=>fieldDraws)===settled);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);const reduced=await page.evaluate(()=>fieldDraws);await page.mouse.move(180,300);await page.waitForTimeout(200);check(`${width}: reduced motion stays static`,await page.evaluate(()=>fieldDraws)===reduced);
  await page.locator('[data-portal-card=lotus]').click();await page.waitForFunction(()=>document.querySelector('#portal-title').textContent==='清荷入梦');await page.getByRole('link',{name:'开始观展',exact:true}).click();await page.waitForURL('**/flower-detail.html?key=lotus');
  check(`${width}: return control is below header and topmost`,await page.locator('.detail-back').evaluate(e=>{const r=e.getBoundingClientRect(),h=document.querySelector('.site-header').getBoundingClientRect();return r.top>=h.bottom&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))}));
  await page.getByText('更多观看方式',{exact:true}).click();await page.getByRole('button',{name:'实体花卡',exact:true}).click();check(`${width}: disclosed original view works`,await page.locator('#detail-original').isVisible());
  await page.locator('#collect-btn').click();await page.goto(`${base}/collection.html`);await page.getByRole('link',{name:'备份与恢复花册',exact:false}).click();
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:'下载花册备份 JSON',exact:true}).click();const download=await promise,text=await readFile(await download.path(),'utf8'),data=JSON.parse(text);
  check(`${width}: downloaded backup contains active collection and browsing`,data.version===3&&data.data.collections[0].key==='lotus'&&data.data.recentViews[0].key==='lotus');
  const target=await browser.newContext({viewport:{width,height:844},acceptDownloads:true});const restore=await target.newPage();restore.on('pageerror',e=>errors.push(e.message));await restore.goto(`${base}/backup.html`);
  const choose=async(text,name='album.json')=>{await restore.locator('#backup-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)})};
  await choose(text);await restore.waitForFunction(()=>document.querySelector('.business-preview').textContent.includes('预检通过'));
  check(`${width}: preview does not write and commit needs consent`,await restore.evaluate(k=>localStorage.getItem(k)===null,key)&&await restore.getByRole('button',{name:'确认合并到本机花册',exact:true}).isDisabled());
  await restore.locator('#backup-consent').check();await restore.getByRole('button',{name:'确认合并到本机花册',exact:true}).click();
  await restore.getByRole('link',{name:'返回我的花册',exact:true}).click();await restore.reload();check(`${width}: restored album visibly survives reload`,await restore.locator('.collection-card h3').textContent()==='清荷入梦');
  await restore.getByRole('link',{name:'备份与恢复花册',exact:false}).click();await restore.getByRole('button',{name:'撤销最近一次导入',exact:true}).click();check(`${width}: undo restores empty target`,await restore.evaluate(k=>localStorage.getItem(k)===null,key));
  data.data.collections=[];await choose(JSON.stringify(data),'damaged.json');await restore.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('校验值不匹配'));check(`${width}: damaged import rejected with original data unchanged`,await restore.evaluate(k=>localStorage.getItem(k)===null,key));
  await target.close();
  if(width!==320){
   await page.emulateMedia({reducedMotion:'reduce'});
   for(const [name,path]of [['home',''],['detail','flower-detail.html?key=lotus'],['catalogue','catalogue.html'],['collection','collection.html'],['backup','backup.html']]){
    await page.goto(`${base}/${path}`);await page.evaluate(()=>document.fonts.ready);await page.locator('main').waitFor();
    // Let lazy images load by visiting the bottom, then return to the document top.
    await page.evaluate(async()=>{const images=[...document.images];for(const image of images) image.loading='eager';await Promise.all(images.map(image=>image.decode().catch(()=>{})));});
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(150);await page.evaluate(()=>scrollTo(0,0));
    check(`${width}/${name}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const file=name==='home'?(width===1440?'desktop.png':'mobile.png'):`${name}-${width}.png`;
    await page.screenshot({path:`${shots}/${file}`,fullPage:true});
   }
  }
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args)}});
 const page=await context.newPage();await page.goto(base);await page.waitForSelector('#portal-field[data-field-state=fallback]');await page.locator('[data-portal-card=leaves]').click();await page.waitForFunction(()=>document.querySelector('#portal-title').textContent==='花叶生辉');check('WebGL unavailable still allows work selection and entry',await page.locator('#portal-title').textContent()==='花叶生辉'&&await page.locator('.home-main-card [data-pearl] img').isVisible());await context.close();
 check('No uncaught browser errors',errors.length===0);
} catch(error){checks.push({name:'Exhibition workflow completed',pass:false,error:error.stack});console.error(error)}finally{await browser.close();await writeFile(`${output}/checks.json`,JSON.stringify({checks,errors,summary:{total:checks.length,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length}},null,2));}
console.log({total:checks.length,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length});if(checks.some(c=>!c.pass))process.exitCode=1;
