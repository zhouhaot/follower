import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameRenderer} from '../public/frame-renderer.mjs';
function fixture() {
 const callbacks=new Map(),drawn=[];let sequence=0,value=0,visible=true;
 const queue=createFrameRenderer(()=>drawn.push(value),{
  requestFrame:callback=>{callbacks.set(++sequence,callback);return sequence;},
  cancelFrame:id=>callbacks.delete(id),canRender:()=>visible,
 });
 return {queue,callbacks,drawn,setValue:v=>value=v,setVisible:v=>visible=v,
  frame(){const batch=[...callbacks.values()];callbacks.clear();batch.forEach(callback=>callback());}};
}
test('dense input draws only the latest state once per frame and stops while idle',()=>{
 const f=fixture();for(let i=0;i<180;i++){f.setValue(i);f.queue.request();}
 assert.equal(f.callbacks.size,1);f.frame();assert.deepEqual(f.drawn,[179]);
 f.frame();assert.deepEqual(f.drawn,[179]);assert.equal(f.callbacks.size,0);
 f.setValue(180);f.queue.request();f.frame();assert.deepEqual(f.drawn,[179,180]);
});
test('hidden view never draws a pending frame and resumes on request',()=>{
 const f=fixture();f.queue.request();f.setVisible(false);f.frame();assert.deepEqual(f.drawn,[]);
 f.queue.request();assert.equal(f.callbacks.size,0);
 f.setVisible(true);f.queue.request();f.frame();assert.deepEqual(f.drawn,[0]);
});
test('cancellation and disposal release pending work, including a late callback',()=>{
 const f=fixture();f.queue.request();f.queue.cancel();assert.equal(f.callbacks.size,0);
 f.queue.request();const late=[...f.callbacks.values()][0];f.queue.dispose();f.queue.dispose();late();
 f.queue.request();assert.equal(f.callbacks.size,0);assert.deepEqual(f.drawn,[]);
});
