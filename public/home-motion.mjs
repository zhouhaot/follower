import {createFrameRenderer} from './frame-renderer.mjs';

/** A finite card-opening sequence, with input-driven tilt on desktop only. */
export function initHomeMotion() {
  const figure=document.querySelector('.home-featured');
  if(!figure)return;
  const fan=figure.querySelector('.home-card-fan');
  const display=figure.querySelector('.home-display');
  const replay=figure.querySelector('.home-replay');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover: hover) and (pointer: fine) and (min-width: 701px)');
  const events=new AbortController();
  let animations=[],disposed=false,inView=false,played=false,imageReady=false,bounds=null,tiltX=0,tiltY=0;
  const queue=createFrameRenderer(()=>{
    fan.style.setProperty('--tilt-x',`${tiltX.toFixed(2)}deg`);
    fan.style.setProperty('--tilt-y',`${tiltY.toFixed(2)}deg`);
  },{canRender:()=>!disposed&&!reduced.matches&&inView&&!document.hidden});
  function stop(){animations.forEach(animation=>animation.cancel());animations=[];}
  function reset(){queue.cancel();tiltX=tiltY=0;bounds=null;fan.style.removeProperty('--tilt-x');fan.style.removeProperty('--tilt-y');}
  function play(){
    if(disposed||!imageReady||reduced.matches||!inView||document.hidden)return;
    stop();reset();played=true;
    for(const element of fan.children){
      const finish=getComputedStyle(element).transform;
      const main=element.classList.contains('home-main-card');
      animations.push(element.animate([
        {transform:main?'translateY(7%) rotate(-3deg)':'translateX(0) translateY(8%) rotate(0deg)',opacity:main?1:.7},
        {transform:finish,opacity:main?1:.92},
      ],{duration:main?660:780,easing:'cubic-bezier(.16,1,.3,1)'}));
    }
  }
  function preferences(){
    replay.hidden=reduced.matches;
    if(reduced.matches||!fine.matches){stop();reset();}
  }
  const observer=new IntersectionObserver(entries=>{
    inView=entries[0].isIntersecting;
    if(!inView){stop();reset();return;}
    if(!played)play();
  },{threshold:.25});
  observer.observe(display);
  display.addEventListener('pointerenter',()=>{bounds=display.getBoundingClientRect();},{signal:events.signal});
  display.addEventListener('pointermove',event=>{
    if(!fine.matches||reduced.matches||event.pointerType==='touch'||!inView||document.hidden)return;
    bounds??=display.getBoundingClientRect();
    const x=Math.max(-1,Math.min(1,(event.clientX-bounds.left)/bounds.width*2-1));
    const y=Math.max(-1,Math.min(1,(event.clientY-bounds.top)/bounds.height*2-1));
    tiltX=-y*3;tiltY=x*5;queue.request();
  },{passive:true,signal:events.signal});
  display.addEventListener('pointerleave',reset,{signal:events.signal});
  replay.addEventListener('click',play,{signal:events.signal});
  reduced.addEventListener('change',preferences,{signal:events.signal});
  fine.addEventListener('change',preferences,{signal:events.signal});
  addEventListener('resize',reset,{passive:true,signal:events.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();reset();}},{signal:events.signal});
  addEventListener('pagehide',event=>{stop();reset();if(!event.persisted){disposed=true;observer.disconnect();events.abort();queue.dispose();}},{signal:events.signal});
  preferences();
  replay.disabled=true;
  Promise.all([...fan.querySelectorAll('img')].map(image=>image.decode().catch(()=>{}))).then(()=>{
    if(disposed)return;imageReady=true;replay.disabled=false;if(inView&&!played)play();
  });
  return {dispose(){disposed=true;stop();reset();observer.disconnect();events.abort();queue.dispose();}};
}
