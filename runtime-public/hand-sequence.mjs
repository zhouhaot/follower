import {clampProgress} from './handheld-state.mjs';

/** Uniform skeletal samples: identical progress always selects an identical pose. */
export function getHandFrameIndex(progress,frameCount){
 if(!Number.isInteger(frameCount)||frameCount<1)return -1;
 return Math.round(clampProgress(progress)*(frameCount-1));
}

/**
 * Demand-driven decoded image sequence. Pass handOpen, not whole-page scroll progress.
 * Targets can be one IMG, multiple registered IMG layers, or a CANVAS.
 * Frames may be URLs, or {src, foreground} pairs with targets [base, foreground].
 * A complete pose is swapped atomically only after every layer is decoded.
 * Existing images remain the visual fallback until a requested frame is fully decoded.
 */
export function createHandSequence(target,{frames,reducedMotion=false,cacheSize=5,imageFactory,onFrame,onError,warmup=false,fetch:fetchFrame}={}){
 const targets=Array.isArray(target)?[...target]:[target];
 if(!targets.length||targets.some(item=>!item))throw new TypeError('A hand image or canvas is required');
 if(!Array.isArray(frames)||!frames.length)throw new TypeError('Hand frames are required');
 const sourceLayers=Object.freeze(frames.map(frame=>Object.freeze(
  typeof frame==='string'?[frame]:frame?.foreground===undefined?[frame?.src]:[frame?.src,frame.foreground]
 )));
 if(sourceLayers.some(layers=>layers.some(src=>typeof src!=='string'||!src.trim())))throw new TypeError('Each hand layer needs a source URL');
 const paired=sourceLayers.some(layers=>layers.length===2);
 if(paired&&(targets.length!==2||sourceLayers.some(layers=>layers.length!==2)))throw new TypeError('Paired hand frames require two targets and both sources in every pose');
 const sources=Object.freeze(sourceLayers.map(layers=>layers[0]));
 const limit=Number.isInteger(cacheSize)?Math.max(5,Math.min(12,cacheSize)):5;
 const owner=targets[0].ownerDocument,ImageClass=owner?.defaultView?.Image||globalThis.Image;
 const makeImage=imageFactory||(()=>new ImageClass());
 const windowTarget=owner?.defaultView||globalThis,connection=windowTarget.navigator?.connection;
 const fetchAsset=fetchFrame||windowTarget.fetch?.bind(windowTarget),Abort=windowTarget.AbortController||globalThis.AbortController;
 const cache=new Map();
 let disposed=false,reduced=Boolean(reducedMotion),requestedProgress=0,desired=0,current=null,clock=0;
 const canvasBuffers=new Map(),warmDone=new Set(),warming=new Map();
 let pageHidden=false;
 const warmURLs=[];
 if(warmup&&owner?.baseURI){
  try{
   const base=new URL(owner.baseURI);
   for(const source of sourceLayers.flat()){
    const url=new URL(source,base);
    if(['http:','https:'].includes(url.protocol)&&url.origin===base.origin&&!warmURLs.includes(url.href))warmURLs.push(url.href);
   }
  }catch{/* Without a verified same-origin base, network warmup stays disabled. */}
 }
 function stopWarmup(){for(const controller of warming.values())controller.abort();warming.clear();}
 function pumpWarmup(){
  if(!warmup||disposed||reduced||pageHidden||owner?.visibilityState==='hidden'||connection?.saveData||current===null||!fetchAsset||!Abort)return;
  while(warming.size<2){
   const url=warmURLs.find(source=>!warmDone.has(source)&&!warming.has(source));if(!url)return;
   const controller=new Abort();warming.set(url,controller);
   // Download compressed responses into normal HTTP cache, never decode all poses.
   Promise.resolve().then(()=>{
    if(controller.signal.aborted)return;
    return fetchAsset(url,{cache:'force-cache',credentials:'same-origin',mode:'same-origin',priority:'low',signal:controller.signal});
   }).then(async response=>{
    if(!response||controller.signal.aborted)return;
    if(!response.ok)throw new Error('Hand warmup unavailable');
    await response.arrayBuffer();
   }).catch(()=>{/* The image loader owns visible errors and retries. */}).finally(()=>{
    if(!controller.signal.aborted)warmDone.add(url);
    if(warming.get(url)===controller)warming.delete(url);
    pumpWarmup();
   });
  }
 }
 function onVisibility(){if(owner?.visibilityState==='hidden')stopWarmup();else pumpWarmup();}
 function onPageHide(){pageHidden=true;stopWarmup();}
 function onPageShow(){pageHidden=false;pumpWarmup();}
 function onConnection(){if(connection?.saveData)stopWarmup();else pumpWarmup();}
 if(warmup){
  owner?.addEventListener?.('visibilitychange',onVisibility);
  windowTarget.addEventListener?.('pagehide',onPageHide);windowTarget.addEventListener?.('pageshow',onPageShow);
  connection?.addEventListener?.('change',onConnection);
 }
 const notify=(callback,value)=>{try{callback?.(value)}catch{/* A reporting callback cannot break the visual controller. */}};
 const wanted=()=>new Set([0,current,desired,desired-1,desired+1].filter(index=>Number.isInteger(index)&&index>=0&&index<sources.length));
 function remove(index){
  const entry=cache.get(index);if(!entry)return;
  entry.cancelled=true;
  for(const image of entry.images){image.onload=null;image.onerror=null;if(entry.status==='loading')image.removeAttribute?.('src');}
  cache.delete(index);
 }
 function prune(){
  const keep=wanted();
  for(const [index,entry] of cache)if(entry.status==='loading'&&!keep.has(index))remove(index);
  if(cache.size<=limit)return;
  const removable=[...cache.entries()].filter(([index])=>!keep.has(index)).sort((a,b)=>a[1].used-b[1].used);
  while(cache.size>limit&&removable.length)remove(removable.shift()[0]);
 }
 function draw(entry){
  if(disposed||entry.cancelled||entry.index!==desired||entry.status!=='ready')return;
  try{
   // Validate and prepare all targets before changing any visible layer.
   const prepared=targets.map((element,layer)=>{
    const image=entry.images[paired?layer:0],source=sourceLayers[entry.index][paired?layer:0];
    if(typeof element.getContext!=='function')return {element,source};
    const context=element.getContext('2d');if(!context)throw new Error('Hand canvas unavailable');
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    if(!(width>0&&height>0))throw new Error('Hand image has no dimensions');
    let canvas=canvasBuffers.get(element);
    if(!canvas){canvas=(element.ownerDocument||owner)?.createElement('canvas');if(!canvas)throw new Error('Hand canvas unavailable');canvasBuffers.set(element,canvas);}
    canvas.width=width;canvas.height=height;
    const buffer=canvas.getContext('2d');if(!buffer)throw new Error('Hand canvas unavailable');
    buffer.drawImage(image,0,0,width,height);
    return {element,context,canvas,width,height};
   });
   // One synchronous commit; there is no await, fade, or intermediate painted pose.
   for(const {element,source,context,canvas,width,height} of prepared){
    if(context){
     if(element.width!==width)element.width=width;if(element.height!==height)element.height=height;
     context.clearRect(0,0,width,height);context.drawImage(canvas,0,0,width,height);
    }else element.src=source;
   }
   current=entry.index;entry.used=++clock;
   notify(onFrame,{index:current,source:sources[current],sources:sourceLayers[current],progress:current/Math.max(1,sources.length-1)});
   pumpWarmup();
  }catch{notify(onError,{index:entry.index,source:sources[entry.index],reason:'display-unavailable'});}
 }
 function prefetch(){
  if(disposed||reduced)return;
  for(const index of [desired-1,desired+1])if(index>=0&&index<sources.length)ensure(index);
 }
 function ensure(index){
  if(disposed||index<0||index>=sources.length)return;
  const existing=cache.get(index);
  if(existing){existing.used=++clock;return existing;}
  let images;
  try{images=sourceLayers[index].map((source,layer)=>makeImage({index,layer,source}));}
  catch{notify(onError,{index,source:sources[index],reason:'image-unavailable'});return;}
  const entry={index,images,status:'loading',cancelled:false,layers:images.map(()=> 'loading'),decoding:images.map(()=>false),used:++clock};cache.set(index,entry);prune();
  const active=()=>!disposed&&!entry.cancelled&&cache.get(index)===entry;
  function fail(layer){
   if(!active()||entry.status!=='loading')return;
   entry.status='failed';
   for(const image of images){image.onload=null;image.onerror=null;image.removeAttribute?.('src');}
   notify(onError,{index,layer,source:sourceLayers[index][layer],reason:'frame-unavailable'});
  }
  async function ready(layer){
   if(!active()||entry.decoding[layer]||entry.status!=='loading')return;entry.decoding[layer]=true;
   const image=images[layer];
   try{
    if(typeof image.decode==='function')await image.decode();
    if(!active()||entry.status!=='loading')return;
    if((image.naturalWidth||image.width)===0){fail(layer);return;}
    entry.layers[layer]='ready';image.onload=null;image.onerror=null;
    if(entry.layers.every(status=>status==='ready')){
     entry.status='ready';
     if(index===desired){draw(entry);prefetch();}prune();
    }
   }catch{fail(layer);}
  }
  for(let layer=0;layer<images.length;layer++){
   if(!active()||entry.status!=='loading')break;
   const image=images[layer];image.decoding='async';image.onload=()=>ready(layer);image.onerror=()=>fail(layer);
   try{image.src=sourceLayers[index][layer];if(image.complete&&(image.naturalWidth||image.width)>0)void ready(layer);}catch{fail(layer);}
  }
  return entry;
 }
 function select(){
  if(disposed)return;
  desired=getHandFrameIndex(reduced?0:requestedProgress,sources.length);prune();
  const entry=ensure(desired);
  if(entry?.status==='ready'){if(current!==desired)draw(entry);prefetch();}
  else if(current!==null)prefetch();
 }
 function setProgress(value){
  if(disposed||!Number.isFinite(value))return;
  requestedProgress=clampProgress(value);select();
 }
 function setReducedMotion(value){
  if(disposed)return;reduced=Boolean(value);
  if(reduced){stopWarmup();for(const [index,entry] of cache)if(index!==0&&entry.status==='loading')remove(index);}
  select();pumpWarmup();
 }
 function retry(){
  if(disposed)return;
  for(const [index,entry] of cache)if(entry.status==='failed')remove(index);
  select();
 }
 function dispose(){
  if(disposed)return;disposed=true;stopWarmup();
  owner?.removeEventListener?.('visibilitychange',onVisibility);
  windowTarget.removeEventListener?.('pagehide',onPageHide);windowTarget.removeEventListener?.('pageshow',onPageShow);
  connection?.removeEventListener?.('change',onConnection);
  for(const index of [...cache.keys()])remove(index);
  for(const canvas of canvasBuffers.values())canvas.width=canvas.height=0;canvasBuffers.clear();
 }
 function getState(){return {desiredIndex:desired,currentIndex:current,frameCount:sources.length,layerCount:paired?2:1,reducedMotion:reduced,disposed,cachedFrames:cache.size,warmingAssets:warming.size};}
 select();
 return {setProgress,setReducedMotion,retry,dispose,getState};
}
