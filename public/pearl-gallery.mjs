import {createFrameRenderer} from './frame-renderer.mjs';

/** Shared, lazy, input-driven pearl surfaces. No collection or navigation writes. */
export function initPearlGallery(root,{enabled=true,onState=()=>{}}={}){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController();
  const listen=(node,type,callback,options={})=>node.addEventListener(type,callback,{...options,signal:events.signal});
  const views=[...root.querySelectorAll('[data-pearl]')].map(element=>({element,image:element.querySelector('img'),canvas:element.querySelector('.pearl-canvas'),visible:false,ready:false,failed:false,x:0,y:0,drag:null}));
  const pending=new Set();let latest=null,renderer=null,loading=null,disposed=false,failed=false,demoId=null,idleId=null,bootReady=!('requestIdleCallback' in window);
  const clamp=value=>Math.max(-1,Math.min(1,value));
  const visible=view=>enabled&&view.visible&&!view.failed&&!document.hidden&&!disposed;
  const queue=createFrameRenderer(pump,{canRender:()=>bootReady&&enabled&&!disposed&&!failed&&!document.hidden&&views.some(visible)});
  function state(view,value){if(view.element.dataset.pearlState===value)return;view.element.dataset.pearlState=value;onState(value,view.element);}
  function request(view,priority=false){if(!view||view.failed||disposed)return;pending.add(view);if(priority)latest=view;queue.request();}
  function failAll(){failed=true;stopDemo();queue.cancel();for(const view of views){view.failed=true;view.ready=false;view.element.classList.remove('pearl-ready');state(view,'fallback');}renderer?.dispose();renderer=null;}
  function pump(){
    if(loading||failed||disposed)return;
    const view=latest&&pending.has(latest)&&visible(latest)?latest:[...pending].find(visible);
    if(!view)return;
    if(!renderer){
      loading=import('./pearl-renderer.mjs').then(({createPearlRenderer})=>{if(!disposed&&enabled&&!document.hidden&&views.some(visible))renderer=createPearlRenderer({onFailure:failAll});}).catch(failAll).finally(()=>{loading=null;queue.request();});return;
    }
    if(!renderer.has(view.image)){
      state(view,'loading');
      loading=renderer.prepare(view.image).catch(()=>{view.failed=true;pending.delete(view);state(view,'fallback');}).finally(()=>{loading=null;queue.request();});return;
    }
    try{
      if(renderer.draw(view.image,view.canvas,{x:view.x,y:view.y,cardKey:view.element.dataset.pearl})){
        view.element.style.setProperty('--pearl-x',`${-view.y*8}deg`);view.element.style.setProperty('--pearl-y',`${view.x*11}deg`);
        view.element.classList.add('pearl-ready');view.ready=true;state(view,'ready');
      }
    }catch{view.failed=true;view.element.classList.remove('pearl-ready');state(view,'fallback');}
    pending.delete(view);if(latest===view)latest=null;
    if([...pending].some(visible))queue.request();
  }
  function stopDemo(){if(demoId!==null)cancelAnimationFrame(demoId);demoId=null;}
  function set(view,x,y){view.x=reduced.matches?0:clamp(x);view.y=reduced.matches?0:clamp(y);request(view,true);}
  function reset(view){view.x=0;view.y=0;view.element.style.removeProperty('--pearl-x');view.element.style.removeProperty('--pearl-y');request(view);}
  function demo(element=views[0]?.element){
    const view=views.find(v=>v.element===element);if(!view||!visible(view)||!view.ready||reduced.matches)return;
    stopDemo();const start=performance.now();
    const step=now=>{if(!visible(view)||reduced.matches){stopDemo();return;}const t=Math.min((now-start)/1600,1);set(view,Math.sin(t*Math.PI*2)*.85,Math.sin(t*Math.PI)*.25);if(t<1)demoId=requestAnimationFrame(step);else{demoId=null;reset(view);}};
    demoId=requestAnimationFrame(step);
  }
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){const view=views.find(v=>v.element===entry.target);view.visible=entry.isIntersecting;if(view.visible)request(view);else{pending.delete(view);view.x=view.y=0;view.element.style.removeProperty('--pearl-x');view.element.style.removeProperty('--pearl-y');}}
    if(!views.some(visible)){stopDemo();queue.cancel();}
  },{threshold:.08});
  const resize=new ResizeObserver(entries=>{for(const entry of entries){const view=views.find(v=>v.canvas.parentElement===entry.target);if(view)request(view);}});
  for(const view of views){
    const {element}=view,action=element.closest('a')||element;let bounds=null,dragged=false;
    state(view,'static');observer.observe(element);resize.observe(view.canvas.parentElement);
    listen(element,'pointerenter',()=>{bounds=element.getBoundingClientRect();});
    listen(element,'pointerdown',event=>{
      if(event.button!==0||reduced.matches||!enabled||view.failed||view.drag)return;
      stopDemo();dragged=false;bounds=element.getBoundingClientRect();view.drag={id:event.pointerId,x:event.clientX,y:event.clientY,initialX:view.x,initialY:view.y};element.setPointerCapture(event.pointerId);
    });
    listen(element,'pointermove',event=>{
      if(reduced.matches||!visible(view))return;const drag=view.drag;
      if(drag&&event.pointerId===drag.id){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)>6||Math.abs(dy)>6)dragged=true;set(view,drag.initialX+dx/150,drag.initialY-dy/180);return;}
      if(event.pointerType!=='mouse'||drag)return;stopDemo();bounds??=element.getBoundingClientRect();set(view,((event.clientX-bounds.left)/bounds.width-.5)*1.7,-((event.clientY-bounds.top)/bounds.height-.5)*1.4);
    },{passive:true});
    function release(event){if(view.drag?.id!==event.pointerId)return;view.drag=null;if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId);}
    listen(element,'pointerup',release);listen(element,'pointercancel',event=>{release(event);reset(view);});listen(element,'lostpointercapture',()=>{view.drag=null;});
    listen(element,'pointerleave',event=>{bounds=null;if(event.pointerType==='mouse'&&!view.drag)reset(view);});
    listen(action,'click',event=>{if(dragged&&event.detail>0){event.preventDefault();event.stopPropagation();dragged=false;}},{capture:true});
    listen(action,'focus',()=>request(view,true));
    listen(action,'keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)||reduced.matches||!enabled||view.failed)return;
      event.preventDefault();stopDemo();if(event.key==='Home')reset(view);else set(view,view.x+(event.key==='ArrowRight'?.18:event.key==='ArrowLeft'?-.18:0),view.y+(event.key==='ArrowUp'?.18:event.key==='ArrowDown'?-.18:0));
    });
  }
  listen(reduced,'change',()=>{stopDemo();views.forEach(reset);});
  listen(window,'resize',()=>views.forEach(view=>request(view)),{passive:true});
  listen(document,'visibilitychange',()=>{stopDemo();if(document.hidden){queue.cancel();}else views.forEach(reset);});
  function dispose(){if(disposed)return;disposed=true;stopDemo();if(idleId!==null)cancelIdleCallback(idleId);queue.dispose();observer.disconnect();resize.disconnect();events.abort();renderer?.dispose();pending.clear();}
  listen(window,'pagehide',event=>{stopDemo();queue.cancel();if(!event.persisted)dispose();});
  listen(window,'pageshow',()=>{if(!disposed)views.forEach(view=>request(view));});
  // Art is visible immediately; enhancement waits until the browser has room.
  if('requestIdleCallback' in window){idleId=requestIdleCallback(()=>{idleId=null;if(disposed)return;bootReady=true;views.forEach(view=>request(view));},{timeout:500});}
  return {demo,reset(){stopDemo();views.forEach(reset);},setEnabled(value){if(enabled===value)return;enabled=value;stopDemo();if(!value){queue.cancel();}else views.forEach(reset);},dispose};
}
