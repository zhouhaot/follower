import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'reports/qa/business');await mkdir(output,{recursive:true});
const base=process.env.AUDIT_URL||'http://127.0.0.1:4173',key='flowers-speak:cloud-candidate:collection:v1';
const direct={key:'lotus',targetIndex:3,method:'image-target',recognizedAt:'2026-10-14T06:00:00.000Z'},imported={key:'peony',targetIndex:1,method:'image-target',recognizedAt:'2026-10-14T06:00:00.000Z'};
const original=JSON.stringify({version:1,entries:[direct]}),legacy=JSON.stringify({version:1,entries:[direct,imported]});
const report={date:new Date().toISOString(),scope:'Isolated background Chrome with synthetic records only; real user data and camera are untouched.',checks:[],errors:[]};
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name}`)};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844}]){
  const context=await browser.newContext({viewport,acceptDownloads:true});
  await context.addInitScript(({key,original})=>{
   if(!['http:','https:'].includes(location.protocol))return;
   if(!localStorage.getItem('qa:business-seeded')){localStorage.setItem(key,original);localStorage.setItem('qa:business-sentinel','preserved');localStorage.setItem('qa:business-seeded','yes')}
   window.__cameraCalls=0;window.__businessReads=[];window.__businessWrites=[];
   const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){window.__businessReads.push(k);return get.call(this,k)};Storage.prototype.setItem=function(k,v){window.__businessWrites.push(k);return set.call(this,k,v)};
   if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{window.__cameraCalls++;throw new Error('Hardware disabled in test')};
  },{key,original});
  const page=await context.newPage(),externalRequests=[];page.on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))externalRequests.push(request.url());if(request.method()!=='GET')externalRequests.push(request.method())});page.on('pageerror',e=>report.errors.push({width:viewport.width,message:e.message}));
  const raw=()=>page.evaluate(key=>localStorage.getItem(key),key);
  await page.goto(`${base}/guide.html`,{waitUntil:'networkidle'});await page.getByRole('link',{name:'安排我的本地导览',exact:true}).click();await page.waitForSelector('.business-editor');
  await page.getByRole('button',{name:'从清荷到花叶',exact:true}).click();await page.getByRole('link',{name:'继续看：清荷入梦',exact:true}).click();await page.waitForSelector('.business-work-route');
  await page.getByRole('button',{name:'标记这张已看',exact:true}).click();await page.reload({waitUntil:'networkidle'});await page.waitForSelector('.business-work-route');
  check(`${viewport.width}: detail action persists viewed progress`,await page.locator('.business-work-route').innerText().then(t=>t.includes('此站已看')));
  await page.getByRole('link',{name:'查看或调整路线',exact:true}).click();await page.waitForSelector('.business-editor');
  check(`${viewport.width}: next station resumes after reload`,await page.getByRole('link',{name:'继续看：菊影流金',exact:true}).count()===1);
  await page.getByRole('button',{name:'撤销上一步',exact:true}).click();check(`${viewport.width}: route progress undo`,await page.getByRole('link',{name:'继续看：清荷入梦',exact:true}).count()===1);
  await page.locator('#station-0').selectOption('lotus');await page.locator('#station-1').selectOption('lotus');await page.getByRole('button',{name:'保存自选路线',exact:true}).click();check(`${viewport.width}: duplicate route rejected`,(await page.locator('[role=status]').innerText()).includes('未知或重复'));
  const malicious='<img src=x onerror=window.__injected=true>';
  await page.locator('#journey-title').fill(malicious);await page.locator('#station-0').selectOption('lotus');await page.locator('#station-1').selectOption('peony');await page.locator('#station-2').selectOption('');await page.getByRole('button',{name:'保存自选路线',exact:true}).click();
  check(`${viewport.width}: route title rendered as literal text`,await page.locator('.business-summary h2').textContent()===malicious&&await page.locator('img[src=x]').count()===0&&await page.evaluate(()=>!window.__injected));
  check(`${viewport.width}: long plain-text route title stays in viewport`,await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1));
  check(`${viewport.width}: views never alter scan collection`,await raw()===original);
  await page.screenshot({path:path.join(output,`${viewport.width}-journey.png`),fullPage:true});
  await page.goto(`${base}/collection.html`,{waitUntil:'networkidle'});await page.getByRole('link',{name:'备份与恢复本机收藏',exact:true}).click();await page.waitForSelector('#backup-file');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下载收藏备份 JSON',exact:true}).click();const download=await downloadPromise;const downloaded=await download.path(),exported=JSON.parse(await readFile(downloaded,'utf8'));
  check(`${viewport.width}: actual JSON download`,exported.version===2&&exported.records.length===1&&exported.sha256.length===64);
  const choose=async(text,name='synthetic.json')=>{await page.locator('#backup-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForTimeout(80)};
  await choose(legacy,'<img src=x onerror=window.__injected=true>.json');
  await page.waitForFunction(()=>document.querySelector('.business-preview')?.textContent.includes('预检通过'));
  check(`${viewport.width}: import preflight is read-only`,await raw()===original&&await page.getByRole('button',{name:'确认合并到本机收藏',exact:true}).isDisabled());
  check(`${viewport.width}: filename is text, not markup`,await page.locator('img[src=x]').count()===0&&await page.evaluate(()=>!window.__injected));
  await page.screenshot({path:path.join(output,`${viewport.width}-backup-preview.png`),fullPage:true});
  await page.locator('#backup-consent').check();await page.getByRole('button',{name:'确认合并到本机收藏',exact:true}).click();
  let data=JSON.parse(await raw());check(`${viewport.width}: merged restore retains direct record and tags history`,data.entries.length===2&&data.entries[0].key==='lotus'&&!data.entries[0].restoredFromBackup&&data.entries[1].restoredFromBackup===true);
  await page.getByRole('link',{name:'返回我的收藏',exact:true}).click();check(`${viewport.width}: collection distinguishes restored record`,(await page.locator('.collection-grid').innerText()).includes('历史备份恢复 · 非本次识别'));
  await page.getByRole('link',{name:'备份与恢复本机收藏',exact:true}).click();await page.waitForSelector('#backup-file');await page.getByRole('button',{name:'撤销最近一次导入',exact:true}).click();check(`${viewport.width}: recovery survives navigation and restores original bytes`,await raw()===original);
  for(const [name,text,expected] of [['unsafe.json','{"version":1,"entries":[],"__proto__":{"polluted":true}}','不安全'],['large.json',' '.repeat(65537),'64 KB'],['future.json','{"format":"zevth.collection-backup","version":999}','版本'],['broken.json','{broken','JSON']]){
   await choose(text,name);check(`${viewport.width}: ${name} refused`,(await page.locator('[role=status]').innerText()).includes(expected)&&await raw()===original);
  }
  exported.records[0].recognizedAt='2026-10-13T06:00:00.000Z';await choose(JSON.stringify(exported),'tampered.json');check(`${viewport.width}: checksum mismatch refused`,(await page.locator('[role=status]').innerText()).includes('校验值不匹配')&&await raw()===original);
  await page.locator('#backup-file').setInputFiles({name:'invalid-utf8.json',mimeType:'application/json',buffer:Buffer.from([255,254])});await page.waitForTimeout(80);check(`${viewport.width}: invalid UTF-8 refused`,(await page.locator('[role=status]').innerText()).includes('JSON')&&await raw()===original);
  await choose(legacy);await page.waitForFunction(()=>document.querySelector('.business-preview')?.textContent.includes('预检通过'));await page.evaluate(({key,direct})=>localStorage.setItem(key,JSON.stringify({version:1,entries:[direct,{key:'flowers',targetIndex:0,method:'image-target',recognizedAt:direct.recognizedAt}]})),{key,direct});const external=await raw();await page.locator('#backup-consent').check();await page.getByRole('button',{name:'确认合并到本机收藏',exact:true}).click();check(`${viewport.width}: intervening data blocks confirmation`,(await page.locator('[role=status]').innerText()).includes('其他页面变化')&&await raw()===external);
  const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,camera:window.__cameraCalls,sentinelRead:window.__businessReads.includes('qa:business-sentinel'),sentinelWritten:window.__businessWrites.includes('qa:business-sentinel')}));
  check(`${viewport.width}: no overflow/camera/private-key access`,m.overflow<=1&&m.camera===0&&!m.sentinelRead&&!m.sentinelWritten,m);
  check(`${viewport.width}: no external request or file upload`,externalRequests.length===0,externalRequests);
  await page.keyboard.press('Tab');check(`${viewport.width}: visible keyboard focus`,await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return e.matches(':focus-visible')&&s.outlineStyle!=='none'}));
  await page.screenshot({path:path.join(output,`${viewport.width}-backup-result.png`),fullPage:true});await context.close();
 }
 const denied=await browser.newContext({viewport:{width:390,height:844}});await denied.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError')}});const p=await denied.newPage();await p.goto(`${base}/journey.html`,{waitUntil:'networkidle'});await p.waitForSelector('.business-editor');await p.getByRole('button',{name:'从清荷到花叶',exact:true}).click();check('Discarded storage shows failure instead of success',(await p.locator('[role=status]').innerText()).includes('存储不可用'));await denied.close();
 check('No uncaught errors',report.errors.length===0,report.errors);
}catch(error){check('Browser workflow completed',false,{error:String(error),stack:error.stack})}
finally{await browser.close();report.summary={total:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};await writeFile(path.join(output,'business-audit.json'),JSON.stringify(report,null,2));console.log('SUMMARY',JSON.stringify(report.summary));}
process.exitCode=report.summary.failed?1:0;
