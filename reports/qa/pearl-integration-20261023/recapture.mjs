import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:320,height:844},hasTouch:true,isMobile:true});const results=[];
for(const [name,url,selector] of [['home','/','.home-main-card [data-pearl]'],['detail','/flower-detail.html?key=lotus','#detail-pearl [data-pearl]']]){
 await page.goto(`http://127.0.0.1:4173${url}`);await page.evaluate(()=>document.fonts.ready);await page.locator(selector).scrollIntoViewIfNeeded();await page.waitForFunction(el=>el.dataset.pearlState==='ready',await page.locator(selector).elementHandle());
 if(name==='home'){for(const item of await page.locator('[data-pearl]').all()){await item.scrollIntoViewIfNeeded();await page.waitForFunction(el=>el.dataset.pearlState==='ready',await item.elementHandle());}}
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`.impeccable/review/pearl/320-${name}.png`,fullPage:true});await page.screenshot({path:`reports/qa/pearl-integration-20261023/final/320-${name}.png`,fullPage:true});
 results.push(await page.evaluate(name=>({name,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,nav:[...document.querySelectorAll('.glass-nav a')].map(e=>({text:e.textContent,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,height:e.getBoundingClientRect().height})),button:document.querySelector('#detail-pearl-original')?.textContent}),name));
}await browser.close();await writeFile('reports/qa/pearl-integration-20261023/recapture.json',JSON.stringify(results,null,2));console.log(results);
