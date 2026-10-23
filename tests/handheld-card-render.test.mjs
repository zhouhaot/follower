import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PerspectiveCamera,Vector3} from 'three';

const root=new URL('../',import.meta.url);
const source=await readFile(new URL('public/assets/models/lotus-relief.glb',root));
const metadata=JSON.parse(await readFile(new URL('public/assets/renders/handheld-card.metadata.json',root),'utf8'));
const jsonLength=source.readUInt32LE(12);
const gltf=JSON.parse(source.subarray(20,20+jsonLength).toString('utf8'));
const binaryStart=20+jsonLength+8;
const createCamera=()=>{
 const c=metadata.camera;
 const camera=new PerspectiveCamera(c.vertical_fov_degrees,metadata.reference_aspect,.001,10);
 camera.position.set(...c.position);camera.lookAt(...c.target);camera.updateMatrixWorld();
 camera.projectionMatrix.elements[8]=c.projection_matrix_offsets[0];
 camera.projectionMatrix.elements[9]=c.projection_matrix_offsets[1];
 camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 return camera;
};
const normalized=(v,camera)=>{const p=new Vector3(...v).project(camera);return [(p.x+1)/2,(1-p.y)/2]};

test('handheld source GLB is the immutable supplied relief and original artwork',()=>{
 assert.equal(createHash('sha256').update(source).digest('hex'),'4d0b0e912d24dafb5186d62569a58729b34407352f11f871b960c593e4fd9ac3');
 assert.equal(metadata.source_glb_sha256,createHash('sha256').update(source).digest('hex'));
 assert.equal(metadata.source_geometry_changed,false);
 assert.equal(metadata.source_front_artwork_changed,false);
 assert.deepEqual(metadata.source_transform,{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
 assert(gltf.materials.some(m=>m.name.startsWith('FRONT')&&m.pbrMetallicRoughness.baseColorTexture));
 assert.equal(gltf.meshes.length,5);
});

test('CPU raster and independent WebGL camera agree on the bottom-edge hand contact',()=>{
 const c=metadata.camera;
 assert([...c.position,...c.target,c.vertical_fov_degrees,...c.projection_matrix_offsets].every(Number.isFinite));
 assert(c.vertical_fov_degrees>0&&c.vertical_fov_degrees<90);
 assert.equal(metadata.reference_aspect,.75);
 const contact=normalized(metadata.hand_contact.card_point_m,createCamera());
 assert(Math.abs(contact[0]-.5)<1e-6,`${contact[0]} should be at horizontal center`);
 assert(Math.abs(contact[1]-.73)<1e-6,`${contact[1]} should meet the hand at 73%`);
 assert(contact.every((v,i)=>Math.abs(v-metadata.hand_contact.normalized[i])<1e-6));
});

test('all supplied vertices stay finite and within the independently layerable card bounds',()=>{
 const camera=createCamera();
 const b=[Infinity,Infinity,-Infinity,-Infinity];
 let count=0;
 for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
  const accessor=gltf.accessors[primitive.attributes.POSITION];
  const view=gltf.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType,5126);assert.equal(accessor.type,'VEC3');
  for(let i=0;i<accessor.count;i++){
   const at=binaryStart+(view.byteOffset||0)+(accessor.byteOffset||0)+i*(view.byteStride||12);
   const vertex=[source.readFloatLE(at),source.readFloatLE(at+4),source.readFloatLE(at+8)];
   assert(vertex.every(Number.isFinite));
   const point=normalized(vertex,camera);assert(point.every(Number.isFinite));
   b[0]=Math.min(b[0],point[0]);b[1]=Math.min(b[1],point[1]);b[2]=Math.max(b[2],point[0]);b[3]=Math.max(b[3],point[1]);count++;
  }
 }
 assert(count>50000);
 assert(b[0]>.20&&b[2]<.81&&b[1]>.09&&b[3]<.75);
 for(let i=0;i<4;i++)assert(Math.abs(b[i]-metadata.card_bounds_normalized[i])<1e-5,`bound ${i}: ${b[i]} vs ${metadata.card_bounds_normalized[i]}`);
});

test('render presentation is a transparent card-only scene with restrained source-preserving materials',async()=>{
 const script=await readFile(new URL('scripts/render-handheld-card.py',root),'utf8');
 assert.equal(metadata.transparent,true);
 assert.equal(metadata.material_spec['01'].metalness,.88);
 assert(metadata.light_spec[0].position[0]<0&&metadata.light_spec[0].position[1]>0);
 assert.match(script,/material\.name\.startswith\('FRONT'\)/);
 assert.doesNotMatch(script,/bpy\.ops\.export_scene|bpy\.ops\.mesh\.primitive/);
 assert.match(script,/assert hashlib\.sha256\(SOURCE\.read_bytes\(\)\)\.hexdigest\(\) == EXPECTED_HASH/);
});
