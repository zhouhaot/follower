import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {B,bloomAvailable,createBloomFor} from '../public/bloom-registry.mjs';
import {cards} from '../public/cards.mjs';
const expected=['flowers','peony','chrysanthemum','lotus','leaves'];
test('five distinct geometric model constructors are bound to exact card keys',()=>{
 assert.deepEqual(Object.keys(B),expected);
 const signatures=[];
 for(const key of expected){
  assert.equal(bloomAvailable(key),true);
  const model=createBloomFor(key);
  assert.equal(model.userData.cardKey,key);
  assert.equal(model.isGroup,true);
  assert.equal(typeof model.userData.setGrowth,'function');
  assert.equal(typeof model.userData.dispose,'function');
  assert.equal(B[key].title,cards.find(c=>c.key===key).title);
  const hash=createHash('sha256');let meshes=0;
  model.traverse(object=>{if(object.isMesh){meshes++;assert.notEqual(object.geometry.type,'PlaneGeometry');const a=object.geometry.attributes.position?.array;if(a)hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}});
  assert.ok(meshes>10,`${key} must have real flower parts`);
  signatures.push(hash.digest('hex'));
  model.userData.dispose();
 }
 assert.equal(new Set(signatures).size,5,'models must not silently duplicate a shared lotus geometry');
});
test('unknown key never receives a substitute bloom',()=>{
 for(const key of [undefined,'','rose','__proto__','constructor']){assert.equal(bloomAvailable(key),false);assert.throws(()=>createBloomFor(key));}
});
