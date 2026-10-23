import {createFrameRenderer} from './frame-renderer.mjs';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const studies=[...document.querySelectorAll('.material-study')];
const demoButton=document.querySelector('#demo-light');
const originalButton=document.querySelector('#original-toggle');
const resetButton=document.querySelector('#reset-material');
const notes=document.querySelector('#interaction-note');
const lifecycle=new AbortController();
const listen=(node,type,fn,options={})=>node.addEventListener(type,fn,{...options,signal:lifecycle.signal});
let original=false,disposed=false,demoId=null;
const views=[];
const clamp=value=>Math.max(-1,Math.min(1,value));

function updateControls(){
  const anyReady=views.some(view=>view.ready);
  originalButton.disabled=!anyReady;
  demoButton.disabled=!anyReady||original||reduced.matches;
  resetButton.disabled=!anyReady||original||reduced.matches;
  notes.textContent=reduced.matches?'已遵循“减少动态效果”：卡片保持静止，仍可比较材质与原图。':'移动指针或横向拖动卡面，让光掠过花瓣。聚焦卡片后也可使用方向键，按 Home 归正。';
}
function stopDemo(){
  if(demoId!==null)cancelAnimationFrame(demoId);demoId=null;
  demoButton.textContent='演示光影';
}
function neutral(){stopDemo();for(const view of views)view.reset();}
function startDemo(){
  if(original||reduced.matches||disposed)return;
  stopDemo();demoButton.textContent='重新演示';
  const start=performance.now();
  const step=now=>{
    if(document.hidden||disposed||original||reduced.matches||!views.some(view=>view.visible)){stopDemo();return;}
    const t=Math.min((now-start)/1800,1);
    // A single sweep, returning to neutral. No autonomous motion after it.
    const x=Math.sin(t*Math.PI*2)*0.86,y=Math.sin(t*Math.PI)*0.35;
    for(const view of views)view.set(x,y);
    if(t<1)demoId=requestAnimationFrame(step);else{demoId=null;neutral();}
  };
  demoId=requestAnimationFrame(step);
}
listen(demoButton,'click',startDemo);
listen(resetButton,'click',neutral);
listen(originalButton,'click',()=>{
  neutral();original=!original;document.body.classList.toggle('show-original',original);
  originalButton.setAttribute('aria-pressed',String(original));
  originalButton.textContent=original?'返回材质':'查看原图';
  for(const view of views){view.queue.cancel();view.report();if(!original)view.queue.request();}
  updateControls();
});
listen(reduced,'change',()=>{neutral();for(const view of views)view.report();updateControls();});
listen(document,'visibilitychange',()=>{
  if(document.hidden){neutral();for(const view of views)view.queue.cancel();}
  else for(const view of views)view.queue.request();
});

async function setup(){
  let createMaterialRenderer;
  try{({createMaterialRenderer}=await import('./card-material-renderer.mjs'));}
  catch{for(const study of studies)study.querySelector('.material-status').textContent='材质暂不可用，已保留原图。';return;}
  await Promise.allSettled(studies.map(async study=>{
    const card=study.querySelector('.specimen'),host=study.querySelector('.card-art'),status=study.querySelector('.material-status');
    let renderer=null,x=0,y=0,pointer=null,startX=0,startY=0,initialX=0,initialY=0;
    const view={ready:false,visible:true,queue:null,set,report,reset(){x=0;y=0;card.style.removeProperty('--rx');card.style.removeProperty('--ry');view.queue.request();}};views.push(view);
    function report(){status.textContent=!view.ready?(host.querySelector('img').naturalWidth?'材质暂不可用，已保留原图。':'原图加载失败，请刷新重试。'):original?'原图对照 · 未叠加材质效果':reduced.matches?'静态材质 · 已减少动态效果':'材质样稿 · 可转动观察';}
    function set(nextX,nextY){x=reduced.matches?0:clamp(nextX);y=reduced.matches?0:clamp(nextY);view.queue.request();}
    view.queue=createFrameRenderer(()=>{
      card.style.setProperty('--ry',`${x*13}deg`);card.style.setProperty('--rx',`${-y*10}deg`);
      renderer?.draw(x,y);
    },{canRender:()=>!disposed&&view.ready&&view.visible&&!document.hidden&&!original});
    function fail(){view.ready=false;view.queue.cancel();study.classList.remove('material-ready');card.style.removeProperty('--rx');card.style.removeProperty('--ry');report();updateControls();}
    const observer=new IntersectionObserver(([entry])=>{
      view.visible=entry.isIntersecting;
      if(view.visible)view.queue.request();else{x=0;y=0;view.queue.cancel();card.style.removeProperty('--rx');card.style.removeProperty('--ry');if(!views.some(v=>v.visible))stopDemo();}
    },{threshold:0.05});observer.observe(card);
    const resize=new ResizeObserver(()=>view.queue.request());resize.observe(host);
    view.dispose=()=>{observer.disconnect();resize.disconnect();view.queue.dispose();renderer?.dispose();};
    listen(card,'pointerdown',event=>{
      if(!view.ready||original||reduced.matches||event.button!==0||pointer!==null)return;
      stopDemo();pointer=event.pointerId;startX=event.clientX;startY=event.clientY;initialX=x;initialY=y;card.setPointerCapture(pointer);
    });
    listen(card,'pointermove',event=>{
      if(!view.ready||original||reduced.matches)return;
      if(pointer===event.pointerId){set(initialX+(event.clientX-startX)/140,initialY-(event.clientY-startY)/180);return;}
      if(event.pointerType!=='mouse'||pointer!==null)return;
      stopDemo();const box=study.querySelector('.card-stage').getBoundingClientRect();
      set((event.clientX-box.x-box.width/2)/150,-(event.clientY-box.y-box.height/2)/220);
    });
    function release(event){if(pointer!==event.pointerId)return;pointer=null;if(card.hasPointerCapture(event.pointerId))card.releasePointerCapture(event.pointerId);}
    listen(card,'pointerup',release);
    listen(card,'pointercancel',event=>{release(event);set(0,0);});
    listen(card,'lostpointercapture',()=>{pointer=null;});
    listen(card,'pointerleave',event=>{if(pointer===null&&event.pointerType==='mouse')set(0,0);});
    listen(card,'keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)||!view.ready||original||reduced.matches)return;
      event.preventDefault();stopDemo();
      if(event.key==='Home')set(0,0);
      else set(x+(event.key==='ArrowRight' ? .18 : event.key==='ArrowLeft' ? -.18 : 0),y+(event.key==='ArrowUp' ? .18 : event.key==='ArrowDown' ? -.18 : 0));
    });
    try{
      renderer=await createMaterialRenderer(host,{pearl:study.dataset.material==='pearl',onFailure:fail});
      if(disposed){view.dispose();return;}
      renderer.draw(0,0);view.ready=true;study.classList.add('material-ready');report();updateControls();
    }catch{fail();}
  }));
  updateControls();
}
listen(window,'pagehide',event=>{
  neutral();for(const view of views)view.queue.cancel();
  if(!event.persisted){disposed=true;for(const view of views)view.dispose();lifecycle.abort();}
});
listen(window,'pageshow',()=>{if(!disposed)for(const view of views)view.queue.request();});
setup();
