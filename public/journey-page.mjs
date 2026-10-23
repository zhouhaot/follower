import {cards,cardByKey} from './cards.mjs';
import {createVisitRoute,ROUTE_PRESETS,routeProgress} from './visit-route.mjs';
import {issueMessage} from './business-data.mjs';
import {element,action,link,paragraph,status} from './business-ui.mjs';
export function initJourneyPage(root){
 const store=createVisitRoute(),abort=new AbortController(),signal=abort.signal;let notice='',renderAbort;
 function run(task,message){try{task();notice=message;render()}catch(error){notice=issueMessage(error);render()}}
 function render(){
  renderAbort?.abort();renderAbort=new AbortController();const signal=renderAbort.signal;
  root.replaceChildren();const message=status();message.textContent=notice;root.append(message);
  let route;try{route=store.read()}catch(error){message.textContent=issueMessage(error);return}
  root.append(paragraph('“已看”仅记录你的参观进度，不申请相机权限，也不会增加扫描收藏。','business-note'));
  const progress=routeProgress(route),summary=element('section',undefined,{class:'business-summary','aria-label':'当前导览'});
  summary.append(element('h2',route?.title||'尚未开始导览'),paragraph(route?`已看 ${progress.viewed} / ${progress.total} 张${progress.complete?' · 已完成本条路线':''}`:'选择下面的建议路线，或自行安排顺序。'));
  if(progress.next)summary.append(link(`继续看：${cardByKey(progress.next).title}`,`work.html?card=${progress.next}`));
  if(route)summary.append(action('重新走这条路线',()=>run(()=>store.restart(),'已重置本条路线的已看进度。'),{signal}),action('撤销上一步',()=>run(()=>store.undo(),'已恢复上一步路线状态。'),{signal}));
  root.append(summary);
  const presets=element('div',undefined,{class:'business-actions'});for(const preset of ROUTE_PRESETS)presets.append(action(preset.title,()=>run(()=>store.save(preset),'路线已保存；重复花卡的已看进度会保留。'),{signal}));root.append(presets);
  const form=element('form',undefined,{class:'business-editor','aria-label':'自选路线'}),heading=element('h2','自选路线顺序');form.append(heading,paragraph('每个位置选择一张花卡；留空表示不安排，不能重复。'));
  const titleId='journey-title',title=element('input',undefined,{id:titleId,maxlength:60,value:route?.title||'我的花卡导览',required:true});form.append(element('label','路线名称',{for:titleId}),title);
  const selects=[];
  for(let i=0;i<5;i++){
   const id=`station-${i}`,row=element('div',undefined,{class:'business-field'}),select=element('select',undefined,{id});select.append(element('option','不安排',{value:''}));
   for(const card of cards)select.append(element('option',card.title,{value:card.key}));select.value=route?.keys[i]||'';selects.push(select);row.append(element('label',`第 ${i+1} 站`,{for:id}),select);form.append(row);
  }
  const submit=element('button','保存自选路线',{type:'submit',class:'pill-link'});form.append(submit);form.addEventListener('submit',event=>{event.preventDefault();run(()=>store.save({title:title.value,keys:selects.map(s=>s.value).filter(Boolean)}),'自选路线已保存。')},{signal});root.append(form);
  if(route){const list=element('ol',undefined,{class:'journey-list'});route.keys.forEach(key=>{const card=cardByKey(key),row=element('li');row.append(link(card.title,`work.html?card=${key}`),paragraph(route.visited.includes(key)?'已看':'待看'));if(!route.visited.includes(key))row.append(action(`标记已看：${card.title}`,()=>run(()=>store.markViewed(key),'已更新导览进度；未写入扫描收藏。'),{signal,className:'text-button'}));list.append(row)});root.append(list)}
 }
 render();const onStorage=event=>{if(event.key===null||event.key?.startsWith('flowers-speak:visit-route'))render()};window.addEventListener('storage',onStorage,{signal});return {dispose(){abort.abort();renderAbort?.abort()}};
}
export function initWorkJourney(card){
 const store=createVisitRoute(),root=element('section',undefined,{class:'business-work-route','aria-label':'本地导览进度'});document.querySelector('.work-info')?.insertBefore(root,document.querySelector('.next-work'));
 function render(){root.replaceChildren();try{const route=store.read();if(!route?.keys.includes(card.key)){root.append(link('安排我的参观路线','journey.html'));return}const p=routeProgress(route);root.append(element('h2','本地导览'),paragraph(`第 ${route.keys.indexOf(card.key)+1} 站 · 已看 ${p.viewed} / ${p.total}`));if(!route.visited.includes(card.key))root.append(action('标记这张已看',()=>{try{store.markViewed(card.key);render()}catch(error){root.append(paragraph(issueMessage(error),'business-status'))}}));else root.append(paragraph('此站已看；这不代表扫描识别。'));const next=routeProgress(store.read()).next;if(next)root.append(link(`下一站：${cardByKey(next).title}`,`work.html?card=${next}`));root.append(link('查看或调整路线','journey.html'))}catch(error){root.append(paragraph(issueMessage(error),'business-status'),link('查看导览状态','journey.html'))}}
 render();return {dispose(){root.remove()}};
}
