import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getHandFrameIndex,createHandSequence} from '../public/hand-sequence.mjs';
import {getHandheldState} from '../public/handheld-state.mjs';
const frames=Object.freeze(Array.from({length:32},(_,index)=>`./assets/hand-sequence/hand-${String(index).padStart(3,'0')}.webp`));
function harness(options={}){
 const created=[],changes=[],errors=[];
 const target={src:frames[0],alt:'',attributes:{'aria-hidden':'true'}};
 const imageFactory=()=>{
  const image={naturalWidth:720,naturalHeight:960,complete:false,onload:null,onerror:null,removed:false,decode:async()=>{}};
  image.removeAttribute=name=>{if(name==='src')image.removed=true;};created.push(image);return image;
 };
 const sequence=createHandSequence(options.targets||target,{frames,imageFactory,onFrame:frame=>changes.push(frame),onError:error=>errors.push(error),...options});
 const imageFor=index=>created.findLast(image=>image.src===frames[index]);
 const ready=async index=>{const image=imageFor(index);assert.ok(image,`Frame ${index} requested`);await image.onload?.();return image;};
 return {sequence,target,created,changes,errors,imageFor,ready};
}

test('uniform pose selection is exact, clamped and fully reversible with no elapsed time',()=>{
 for(const count of [1,24,32,40]){
  for(let index=0;index<count;index++)assert.equal(getHandFrameIndex(index/Math.max(1,count-1),count),index);
  assert.equal(getHandFrameIndex(-3,count),0);assert.equal(getHandFrameIndex(9,count),count-1);
  for(const bad of [NaN,Infinity,-Infinity,undefined,'1'])assert.equal(getHandFrameIndex(bad,count),0);
  const forward=Array.from({length:101},(_,index)=>getHandFrameIndex(index/100,count));
  const reverse=Array.from({length:101},(_,index)=>getHandFrameIndex((100-index)/100,count));
  assert.deepEqual(reverse,forward.reverse());
 }
 for(const count of [0,-1,1.5,NaN])assert.equal(getHandFrameIndex(.5,count),-1);
});

test('the hand completely opens before withdrawal or card lift, then ends in the fan',()=>{
 const closed=getHandheldState(0),open=getHandheldState(.30);
 assert.equal(closed.handOpen,0);assert.equal(open.handOpen,1);assert.equal(open.release,0);assert.equal(open.lift,0);assert.equal(open.turn,0);
 assert.ok(getHandheldState(.40).release>0);assert.ok(getHandheldState(.40).lift>0);
 assert.equal(getHandheldState(.78).turn,1);assert.equal(getHandheldState(.94).fan,1);assert.equal(getHandheldState(.98).spread,1);
 assert.deepEqual(getHandheldState(0),closed);
});

test('only the initial frame loads until decoded, followed by small adjacent prefetch',async()=>{
 const h=harness();assert.equal(h.created.length,1);assert.equal(h.target.src,frames[0]);assert.equal(h.sequence.getState().currentIndex,null);
 await h.ready(0);assert.equal(h.sequence.getState().currentIndex,0);assert.equal(h.created.length,2);assert.equal(h.imageFor(1).src,frames[1]);
 assert.equal(h.imageFor(2),undefined);assert.equal(h.changes.length,1);h.sequence.dispose();
});

test('a requested frame replaces the hand only after decode, with no stale intermediate pose',async()=>{
 const h=harness();await h.ready(0);h.sequence.setProgress(10/31);
 const tenth=h.imageFor(10);let finishDecode;tenth.decode=()=>new Promise(resolve=>{finishDecode=resolve});
 const pending=tenth.onload();assert.equal(h.target.src,frames[0]);h.sequence.setProgress(20/31);
 await h.ready(20);assert.equal(h.target.src,frames[20]);finishDecode();await pending;
 assert.equal(h.target.src,frames[20]);assert.deepEqual(h.changes.map(frame=>frame.index),[0,20]);
 assert.equal(tenth.removed,true);assert.ok(h.sequence.getState().cachedFrames<=5);h.sequence.dispose();
});

test('reverse scrolling chooses the same cached frame immediately and ignores invalid progress',async()=>{
 const h=harness();await h.ready(0);h.sequence.setProgress(1);await h.ready(31);assert.equal(h.target.src,frames[31]);
 for(const bad of [NaN,Infinity,-Infinity,undefined,'0'])h.sequence.setProgress(bad);
 assert.equal(h.target.src,frames[31]);h.sequence.setProgress(0);assert.equal(h.target.src,frames[0]);
 h.sequence.setProgress(1);assert.equal(h.target.src,frames[31]);assert.deepEqual(h.changes.map(frame=>frame.index),[0,31,0,31]);h.sequence.dispose();
});

test('load and decode failures retain the last safe frame and explicit retry recovers',async()=>{
 const h=harness();await h.ready(0);h.sequence.setProgress(.5);const wanted=getHandFrameIndex(.5,32);
 h.imageFor(wanted).onerror();assert.equal(h.target.src,frames[0]);assert.equal(h.errors.length,1);
 const count=h.created.length;h.sequence.setProgress(.5);assert.equal(h.created.length,count,'No uncontrolled automatic retry loop');
 h.sequence.retry();const replacement=h.imageFor(wanted);replacement.decode=async()=>{throw new Error('Decode failed')};await replacement.onload();
 assert.equal(h.target.src,frames[0]);assert.equal(h.errors.length,2);
 h.sequence.retry();await h.ready(wanted);assert.equal(h.target.src,frames[wanted]);h.sequence.dispose();
});

test('all layers switch together without changing existing accessibility attributes',async()=>{
 const targets=[{src:frames[0],alt:'',attributes:{'aria-hidden':'true'}},{src:frames[0],alt:'Hand detail',attributes:{role:'img'}}];
 const h=harness({targets});await h.ready(0);h.sequence.setProgress(1);await h.ready(31);
 assert.deepEqual(targets.map(target=>target.src),[frames[31],frames[31]]);
 assert.deepEqual(targets.map(target=>target.alt),['','Hand detail']);assert.deepEqual(targets.map(target=>target.attributes),[{'aria-hidden':'true'},{role:'img'}]);h.sequence.dispose();
});

test('reduced motion is the static first pose, with no adjacent preloads or hidden animation',async()=>{
 const h=harness({reducedMotion:true});h.sequence.setProgress(1);await h.ready(0);
 assert.equal(h.created.length,1);assert.equal(h.target.src,frames[0]);assert.equal(h.sequence.getState().desiredIndex,0);
 h.sequence.setReducedMotion(false);assert.equal(h.sequence.getState().desiredIndex,31);await h.ready(31);assert.equal(h.target.src,frames[31]);
 h.sequence.setReducedMotion(true);assert.equal(h.target.src,frames[0]);assert.equal(h.sequence.getState().reducedMotion,true);
 for(const image of h.created.filter(image=>image.src!==frames[0]))assert.ok(image.onload===null||image.removed);h.sequence.dispose();
});

test('disposal cancels pending loads, blocks late decodes and remains idempotent',async()=>{
 const h=harness();await h.ready(0);h.sequence.setProgress(.5);const image=h.imageFor(16);let finishDecode;
 image.decode=()=>new Promise(resolve=>{finishDecode=resolve});const pending=image.onload();
 h.sequence.dispose();h.sequence.dispose();finishDecode();await pending;
 assert.equal(h.target.src,frames[0]);assert.equal(h.sequence.getState().cachedFrames,0);assert.equal(h.sequence.getState().disposed,true);
 const count=h.created.length;h.sequence.setProgress(1);h.sequence.setReducedMotion(false);h.sequence.retry();assert.equal(h.created.length,count);assert.equal(h.changes.length,1);
});

test('frame inputs are copied and cache remains bounded during rapid scrubbing',async()=>{
 const mutable=[...frames],h=harness({frames:mutable});mutable[31]='different.webp';await h.ready(0);
 for(let i=1;i<32;i++){h.sequence.setProgress(i/31);await h.ready(i);assert.ok(h.sequence.getState().cachedFrames<=5);}
 assert.equal(h.target.src,frames[31]);assert.notEqual(h.target.src,mutable[31]);h.sequence.dispose();
});

test('canvas targets receive only decoded frames at the verified source dimensions',async()=>{
 const drawings=[],context={clearRect:(...args)=>drawings.push(['clear',...args]),drawImage:(...args)=>drawings.push(['draw',...args])};
 const buffer={width:0,height:0,getContext:()=>({drawImage(){}})};
 const target={width:0,height:0,getContext:()=>context,ownerDocument:{createElement:()=>buffer}};
 const h=harness({targets:target});assert.equal(drawings.length,0);await h.ready(0);
 assert.equal(target.width,720);assert.equal(target.height,960);assert.equal(drawings.length,2);
 assert.deepEqual(drawings[1].slice(2),[0,0,720,960]);h.sequence.dispose();assert.equal(buffer.width,0);
});

test('controller does not create animation loops, crossfades, storage writes or accessibility announcements',()=>{
 const source=readFileSync(new URL('../public/hand-sequence.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/requestAnimationFrame|setAnimationLoop|setInterval|setTimeout|Date\.now|performance\.now|localStorage|sessionStorage|\.opacity|aria-live|innerHTML/);
 assert.throws(()=>createHandSequence({}, {frames:[]}),TypeError);assert.throws(()=>createHandSequence({}, {frames:[null]}),TypeError);
 const target={src:frames[0]},errors=[];const sequence=createHandSequence(target,{frames,imageFactory:()=>{throw new Error('Image unavailable')},onError:error=>errors.push(error)});
 assert.equal(target.src,frames[0]);assert.equal(errors[0].reason,'image-unavailable');sequence.dispose();
});

const pairedFrames=Object.freeze(frames.map((src,index)=>Object.freeze({src,foreground:`./assets/hand-sequence/hand-foreground-${String(index).padStart(3,'0')}.webp`})));
function pairedHarness(options={}){
 const targets=[{src:pairedFrames[0].src,alt:''},{src:pairedFrames[0].foreground,alt:''}];
 const h=harness({targets,frames:pairedFrames,...options});
 const foregroundFor=index=>h.created.findLast(image=>image.src===pairedFrames[index].foreground);
 const pairReady=async index=>{await h.ready(index);await foregroundFor(index).onload?.();};
 return {...h,targets,foregroundFor,pairReady};
}

test('paired frames wait for both layers to decode before one atomic pose commit',async()=>{
 const h=pairedHarness();assert.equal(h.created.length,2);await h.pairReady(0);h.sequence.setProgress(10/31);
 await h.ready(10);assert.deepEqual(h.targets.map(image=>image.src),[pairedFrames[0].src,pairedFrames[0].foreground]);
 const front=h.foregroundFor(10);let complete;front.decode=()=>new Promise(resolve=>{complete=resolve});const pending=front.onload();
 assert.equal(h.sequence.getState().currentIndex,0);complete();await pending;
 assert.deepEqual(h.targets.map(image=>image.src),[pairedFrames[10].src,pairedFrames[10].foreground]);
 assert.deepEqual(h.changes.map(frame=>frame.index),[0,10]);assert.equal(h.sequence.getState().layerCount,2);h.sequence.dispose();
});

test('one failed layer holds both previous frames and retries as an entire pose pair',async()=>{
 const h=pairedHarness();await h.pairReady(0);h.sequence.setProgress(1);await h.ready(31);h.foregroundFor(31).onerror();
 assert.deepEqual(h.targets.map(image=>image.src),[pairedFrames[0].src,pairedFrames[0].foreground]);assert.equal(h.errors.at(-1).layer,1);
 h.sequence.retry();await h.foregroundFor(31).onload();assert.equal(h.sequence.getState().currentIndex,0);await h.ready(31);
 assert.deepEqual(h.targets.map(image=>image.src),[pairedFrames[31].src,pairedFrames[31].foreground]);h.sequence.dispose();
});

test('reverse paired poses remain identical and cache is bounded by five pose pairs',async()=>{
 const h=pairedHarness();await h.pairReady(0);h.sequence.setProgress(1);await h.pairReady(31);
 h.sequence.setProgress(0);assert.deepEqual(h.targets.map(image=>image.src),[pairedFrames[0].src,pairedFrames[0].foreground]);
 h.sequence.setProgress(1);assert.deepEqual(h.targets.map(image=>image.src),[pairedFrames[31].src,pairedFrames[31].foreground]);
 for(let index=1;index<15;index++){h.sequence.setProgress(index/31);await h.pairReady(index);assert.ok(h.sequence.getState().cachedFrames<=5);}
 h.sequence.dispose();
});

test('late paired decodes and disposal cannot produce mismatched foreground fingers',async()=>{
 const h=pairedHarness();await h.pairReady(0);h.sequence.setProgress(10/31);await h.ready(10);
 const oldFront=h.foregroundFor(10);let complete;oldFront.decode=()=>new Promise(resolve=>{complete=resolve});const pending=oldFront.onload();
 h.sequence.setProgress(20/31);await h.pairReady(20);complete();await pending;
 assert.deepEqual(h.targets.map(image=>image.src),[pairedFrames[20].src,pairedFrames[20].foreground]);
 h.sequence.setProgress(30/31);const last=h.foregroundFor(30);let finish;last.decode=()=>new Promise(resolve=>{finish=resolve});const lastPending=last.onload();
 await h.ready(30);h.sequence.dispose();finish();await lastPending;
 assert.deepEqual(h.targets.map(image=>image.src),[pairedFrames[20].src,pairedFrames[20].foreground]);assert.equal(h.sequence.getState().cachedFrames,0);
});

test('paired source objects are immutable snapshots and malformed pairs are rejected',async()=>{
 const mutable=pairedFrames.map(frame=>({...frame})),h=pairedHarness({frames:mutable});mutable[31].foreground='wrong.webp';await h.pairReady(0);h.sequence.setProgress(1);await h.pairReady(31);
 assert.equal(h.targets[1].src,pairedFrames[31].foreground);h.sequence.dispose();
 assert.throws(()=>createHandSequence({}, {frames:pairedFrames}),/two targets/);
 assert.throws(()=>createHandSequence([{},{}],{frames:[pairedFrames[0],frames[1]]}),/both sources/);
});

const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function warmHarness({paired=false,reducedMotion=false,saveData=false,foreign=false}={}){
 const events=new Map(),windowEvents=new Map(),connectionEvents=new Map(),requests=[];
 const connection={saveData,addEventListener:(name,fn)=>connectionEvents.set(name,fn),removeEventListener:name=>connectionEvents.delete(name)};
 const doc={baseURI:'https://candidate.example/index.html',visibilityState:'visible',addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
 doc.defaultView={AbortController,navigator:{connection},addEventListener:(name,fn)=>windowEvents.set(name,fn),removeEventListener:name=>windowEvents.delete(name)};
 const target={src:frames[0],ownerDocument:doc},front={src:pairedFrames[0].foreground,ownerDocument:doc};
 const fetch= (url,options)=>new Promise(resolve=>requests.push({url,options,resolve}));
 const chosenFrames=foreign?[...frames.slice(0,3),'https://elsewhere.example/other.webp']:paired?pairedFrames:frames;
 const h=harness({targets:paired?[target,front]:target,frames:chosenFrames,reducedMotion,warmup:true,fetch});
 const ready=async()=>{
  await h.ready(0);
  if(paired)await h.created.find(image=>image.src===pairedFrames[0].foreground).onload();
  await flush();
 };
 return {...h,ready,requests,doc,events,windowEvents,connection,connectionEvents};
}

test('optional cache warmup downloads at most two compressed assets concurrently without decoding the sequence',async()=>{
 const h=warmHarness({paired:true});assert.equal(h.requests.length,0);await h.ready();
 assert.equal(h.requests.length,2);assert.equal(h.sequence.getState().warmingAssets,2);
 assert.equal(h.created.length,4,'Only the selected pose and one neighbor are decoded');
 for(const request of h.requests){
  assert.equal(request.options.cache,'force-cache');assert.equal(request.options.credentials,'same-origin');assert.equal(request.options.mode,'same-origin');assert.equal(request.options.priority,'low');
  assert.equal(new URL(request.url).origin,'https://candidate.example');
 }
 h.requests[0].resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)});await flush();
 assert.equal(h.requests.length,3);assert.equal(h.sequence.getState().warmingAssets,2);assert.equal(h.created.length,4);
 h.sequence.dispose();assert.equal(h.sequence.getState().warmingAssets,0);assert.ok(h.requests.slice(1).every(request=>request.options.signal.aborted));
});

test('warmup pauses on hidden or pagehide, resumes visibly, and removes all listeners at disposal',async()=>{
 const h=warmHarness();await h.ready();h.doc.visibilityState='hidden';h.events.get('visibilitychange')();
 assert.ok(h.requests.every(request=>request.options.signal.aborted));assert.equal(h.sequence.getState().warmingAssets,0);
 h.doc.visibilityState='visible';h.events.get('visibilitychange')();await flush();assert.equal(h.requests.length,4);
 h.windowEvents.get('pagehide')();assert.ok(h.requests.every(request=>request.options.signal.aborted));
 h.windowEvents.get('pageshow')();await flush();assert.equal(h.requests.length,6);
 h.sequence.dispose();assert.equal(h.events.size,0);assert.equal(h.windowEvents.size,0);assert.equal(h.connectionEvents.size,0);
 const count=h.requests.length;for(const request of h.requests)request.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});await flush();assert.equal(h.requests.length,count);
});

test('reduced motion and Save-Data suppress network warming and abort an active warmup',async()=>{
 for(const setting of [{reducedMotion:true},{saveData:true}]){
  const h=warmHarness(setting);await h.ready();assert.equal(h.requests.length,0);h.sequence.dispose();
 }
 const h=warmHarness();await h.ready();h.connection.saveData=true;h.connectionEvents.get('change')();assert.ok(h.requests.every(request=>request.options.signal.aborted));
 h.connection.saveData=false;h.connectionEvents.get('change')();await flush();assert.equal(h.requests.length,4);
 h.sequence.setReducedMotion(true);assert.ok(h.requests.every(request=>request.options.signal.aborted));h.sequence.dispose();
});

test('warmup skips off-origin URLs and failed requests do not retry forever',async()=>{
 const h=warmHarness({foreign:true});await h.ready();
 h.requests[0].resolve({ok:false});h.requests[1].resolve({ok:false});await flush();assert.equal(h.requests.length,3);
 h.requests[2].resolve({ok:false});await flush();assert.equal(h.requests.length,3);
 assert.ok(h.requests.every(request=>new URL(request.url).origin==='https://candidate.example'));assert.equal(h.sequence.getState().warmingAssets,0);h.sequence.dispose();
});
