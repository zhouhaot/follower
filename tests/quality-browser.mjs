import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {cards} from '../public/cards.mjs';

const base=process.env.AUDIT_URL||'http://127.0.0.1:4173';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Isolated local test only');
const output=process.env.QUALITY_QA_OUTPUT||'reports/quality-current/core';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.AUDIT_CHROMIUM||process.platform==='darwin'?{executablePath:process.env.AUDIT_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const report={date:new Date().toISOString(),browser:browser.version(),checks:[],scope:'Desktop and mobile viewport simulation. Real audio decode/progress in Chromium; not a listening review, physical phone or camera test.'};
const check=(name,pass)=>{report.checks.push({name,pass:Boolean(pass)});console.log(`${pass?'PASS':'FAIL'} ${name}`);};
try {
  for(const width of [1280,390]) {
    const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
    await context.addInitScript(()=>{
      const NativeAudio=window.Audio;
      window.testAudio=[];
      window.Audio=class extends NativeAudio { constructor(...args){super(...args);window.testAudio.push(this);} };
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.goto(base);
    report.version=await page.evaluate(async()=>await (await fetch('./version.json')).json());
    delete report.version.files;
    await page.getByRole('link',{name:'开始观展',exact:true}).focus();
    check(`${width}: keyboard entry has visible focus`,await page.evaluate(()=>{const s=getComputedStyle(document.activeElement);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;}));
    await page.keyboard.press('Enter');
    await page.waitForURL('**/flower-detail.html?key=lotus');
    check(`${width}: no automatic audio request`,await page.evaluate(()=>testAudio.length===0));
    await page.locator('#audio-btn').click();
    await page.waitForFunction(()=>testAudio[0]?.currentTime>0&&!testAudio[0].paused);
    check(`${width}: actual MP3 decodes and advances`,(await page.locator('#audio-status').textContent()).includes('AI 合成语音'));
    await page.locator('#audio-btn').click();
    await page.waitForFunction(()=>document.querySelector('#audio-status').textContent.includes('已暂停'));
    check(`${width}: pause is reflected in UI and media`,await page.evaluate(()=>testAudio[0].paused)&&(await page.locator('#audio-status').textContent()).includes('已暂停'));
    await page.locator('#audio-btn').click();
    await page.waitForFunction(()=>!testAudio[0].paused);
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
    check(`${width}: cached-page exit pauses audio`,await page.evaluate(()=>testAudio[0].paused));
    await page.goto(`${base}/guide.html`);
    check(`${width}: guide agrees with enabled narration`,(await page.locator('main').textContent()).includes('清荷入梦提供 AI 合成设计解说')&&!(await page.locator('main').textContent()).includes('目前暂无配音'));
    for(const card of cards) {
      await page.goto(base);
      await page.locator(`.home-cards a.card-image[href="flower-detail.html?key=${card.key}"]`).click();
      await page.waitForURL(`**/flower-detail.html?key=${card.key}`);
      check(`${width}/${card.key}: matching title, artwork, story and narration`,await page.locator('h1').textContent()===card.title&&await page.locator('.flower-story p').textContent()===card.story&&await page.locator('#detail-artwork img').getAttribute('src')===card.artworkImage&&await page.locator('#audio-btn').count()===Number(card.audioAvailable));
      await page.reload();
      check(`${width}/${card.key}: refresh retains correct work`,await page.locator('h1').textContent()===card.title);
      await page.goBack();
      await page.waitForSelector('.home-cards');
      check(`${width}/${card.key}: browser back returns to exhibition`,new URL(page.url()).pathname==='/');
    }
    await page.goto(`${base}/flower-detail.html?key=lotus`);
    await page.locator('#collect-btn').click();
    await page.getByRole('link',{name:'到我的花册查看',exact:false}).click();
    await page.reload();
    check(`${width}: album survives reload`,await page.locator('.collection-card h3').textContent()==='清荷入梦');
    await page.evaluate(()=>document.fonts.ready);
    check(`${width}: album fits viewport`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`${output}/${width}-album.png`,fullPage:true});
    check(`${width}: normal journey has no console/page/HTTP errors`,errors.length===0);
    if(errors.length)report.errors=errors;
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.route('**/audio/*.mp3',r=>r.fulfill({status:503,body:'Simulated audio outage'}));
  await page.goto(`${base}/flower-detail.html?key=lotus`);
  await page.locator('#audio-btn').click();
  await page.waitForFunction(()=>document.querySelector('#audio-status').textContent.includes('音频加载失败'));
  check('Audio outage: explicit error, retry and transcript',await page.locator('#audio-btn').textContent()==='重试解说'&&await page.locator('.narration-transcript p').textContent()!== '');
  await page.unroute('**/audio/*.mp3');
  await page.locator('#audio-btn').click();
  await page.waitForFunction(()=>document.querySelector('#audio-status').textContent.includes('播放中'));
  check('Audio outage: retry recovers playback',await page.locator('#audio-btn').textContent()==='暂停解说');
  await page.route('**/assets/originals/lotus/artwork.png',r=>r.abort());
  await page.goto(`${base}/flower-detail.html?key=lotus`);
  await page.waitForFunction(()=>document.querySelector('#exhibit-status').textContent.includes('图片加载失败'));
  await page.locator('#collect-btn').click();
  check('Image outage: error is visible and story/collection still work',await page.locator('.flower-story p').textContent()===cards.find(c=>c.key==='lotus').story&&await page.locator('#collect-btn').textContent()==='已收藏');
  await page.screenshot({path:`${output}/390-image-error.png`,fullPage:true});
  await context.close();
} catch(error) {
  report.error=error.stack;
  check('Quality journey completed',false);
} finally {
  await browser.close();
  report.summary={total:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};
  await writeFile(`${output}/checks.json`,JSON.stringify(report,null,2)+'\n');
  console.log(report.summary);
}
if(report.summary.failed)process.exitCode=1;
