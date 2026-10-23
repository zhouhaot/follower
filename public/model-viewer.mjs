import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {cardByKey} from './cards.mjs';
import {HERO_EXHIBIT_SPEC,createExhibit,createExhibitEnvironment,setExhibitProgress} from './exhibit-scene.mjs';
import {HERO_HANDHELD_SPEC,clampProgress,configureHandheldCamera,createHandheldEnvironment,setHandheldProgress,applyHandheldMaterials} from './handheld-scene.mjs';
const METAL_MODEL='./assets/models/lotus-relief.glb';

function staticViewer(container,hero,card){
 container.classList.add('fallback-only');
 if(!hero){
  const note=container.closest('.preview-page')?.querySelector('.preview-title>p:last-child');
  if(note)note.textContent='静态效果图 · 可切换预览';
  container.setAttribute('aria-label',`${card.title}静态效果图，可用按钮切换花朵与原作`);
 }
 let current=hero?'relief':'bloom';
 return {setProgress(){},dispose(){},getView:()=>current,setView(view){
  if(view==='reset')return;
  if(view==='relief'&&card.key!=='lotus')return;
  current=view;
  const image=container.querySelector('.model-fallback');
  if(!image)return;
  const sources={bloom:[`./assets/renders/${card.key}-bloom.png`,`${card.title}立体花朵静态效果图`],relief:['./assets/renders/lotus-transparent.png','清荷入梦金属花卡静态效果图'],front:[card.target,`${card.title}原作正面`]};
  if(sources[view]){image.src=sources[view][0];image.alt=sources[view][1]}
 }};
}

/** Viewer availability never records a collection or proves physical tracking. */
export async function createViewer(container,{hero=false,interactive=false,cardKey='lotus'}={}){
 const card=cardByKey(cardKey);
 if(!card)throw new Error('Unknown card viewer');
 if(hero)return createHandheldViewer(container);
 let renderer;
 try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'})}
 catch{return staticViewer(container,hero,card)}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=hero?HERO_EXHIBIT_SPEC.exposure:1.18;
 renderer.shadowMap.enabled=hero;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.setAttribute('aria-hidden','true');
 container.append(renderer.domElement);
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(hero?HERO_EXHIBIT_SPEC.camera.verticalFov:34,1,.001,5);
 const baseCamera=hero?new THREE.Vector3(...HERO_EXHIBIT_SPEC.camera.position):new THREE.Vector3(.025,.01,.225);
 camera.position.copy(baseCamera);camera.lookAt(...(hero?HERO_EXHIBIT_SPEC.camera.target:[0,-.005,0]));
 const pmrem=new THREE.PMREMGenerator(renderer),room=hero?createExhibitEnvironment():new RoomEnvironment();
 const environment=pmrem.fromScene(room,.04);
 scene.environment=environment.texture;pmrem.dispose();room.dispose();
 const display=new THREE.Group();scene.add(display);
 const key=new THREE.SpotLight(hero?0xfff8ee:0xffffff,hero ? .12 :3.5,.9,hero ? .58 :.42,hero?.75:.6,hero?2:1.3);
 key.position.set(-.09,.19,.12);key.target.position.set(0,-.02,0);
 key.castShadow=hero;key.shadow.mapSize.set(1024,1024);key.shadow.bias=hero?-.000002:-.0002;
 if(hero){key.shadow.camera.near=.015;key.shadow.camera.far=.65;key.shadow.normalBias=.00006;}
 scene.add(key,key.target);
 const rim=new THREE.DirectionalLight(hero?0xebeff2:0xd0e5e2,hero ? .4 :1.2);rim.position.set(.1,.06,-.09);scene.add(rim);
 const fill=new THREE.DirectionalLight(0xffffff,hero ? .28 :1.1);fill.position.set(-.2,.04,.2);scene.add(fill);
 scene.add(new THREE.HemisphereLight(hero?0xe8e8e5:0xeff2ef,hero?0x181817:0x151d12,hero ? .18 :.7));
 let metal=null,flowerGroup=null,originalGroup=null,bloom=null,exhibit=null,currentView=hero?'relief':'bloom';
 try{
  if(hero||card.key==='lotus'){
   metal=(await new GLTFLoader().loadAsync(METAL_MODEL)).scene;
   metal.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.envMapIntensity=hero?HERO_EXHIBIT_SPEC.metalEnvironmentIntensity:2.1}});
   display.add(metal);metal.visible=hero;
  }
  if(hero){
   exhibit=createExhibit();display.add(exhibit.root);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(.6,.5),new THREE.ShadowMaterial({opacity:.23}));
   floor.rotation.x=-Math.PI/2;floor.position.y=HERO_EXHIBIT_SPEC.floorY;floor.receiveShadow=true;scene.add(floor);
  }else{
   const {createBloomFor}=await import('./bloom-registry.mjs');
   bloom=createBloomFor(card.key);bloom.scale.setScalar(.064);bloom.userData.setGrowth(1);
   const aspect=bloom.userData.spec?.cardAspect||1.42;
   const texture=await new THREE.TextureLoader().loadAsync(card.target);texture.colorSpace=THREE.SRGBColorSpace;
   const planeGeometry=new THREE.PlaneGeometry(.064,.064*aspect);
   const planeMaterial=new THREE.MeshStandardMaterial({map:texture,roughness:.68,metalness:0,side:THREE.DoubleSide});
   flowerGroup=new THREE.Group();flowerGroup.add(bloom);
   const printedBase=new THREE.Mesh(planeGeometry,planeMaterial);printedBase.position.z=-.0005;flowerGroup.add(printedBase);
   flowerGroup.rotation.y=-.28;flowerGroup.rotation.x=.06;display.add(flowerGroup);
   originalGroup=new THREE.Group();originalGroup.add(new THREE.Mesh(planeGeometry,planeMaterial));originalGroup.visible=false;display.add(originalGroup);
  }
 }catch(error){
  renderer.dispose();renderer.domElement.remove();environment.dispose();
  bloom?.userData.dispose?.();
  container.dataset.viewerError='asset-or-model-unavailable';
  return staticViewer(container,hero,card);
 }
 let disposed=false,fallback=null;
 function render(){if(!disposed)renderer.render(scene,camera)}
 const controls=interactive?new OrbitControls(camera,renderer.domElement):null;
 if(controls){controls.enableDamping=false;controls.enablePan=false;controls.minDistance=.11;controls.maxDistance=.38;controls.target.set(0,0,.007);controls.update();controls.addEventListener('change',render)}
 function resize(){const {width,height}=container.getBoundingClientRect();if(width<1||height<1)return;renderer.setSize(width,height,false);camera.aspect=width/height;if(hero){const {verticalFov,referenceAspect}=HERO_EXHIBIT_SPEC.camera;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(verticalFov)/2)*Math.max(1,referenceAspect/camera.aspect)));}camera.updateProjectionMatrix();render()}
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);resize();container.classList.add('model-ready');
 function setProgress(p){
  if(fallback)return fallback.setProgress(p);
  if(!hero||!Number.isFinite(p))return;
  setExhibitProgress(exhibit,display,metal,p);render();
 }
 function setView(view){
  if(fallback)return fallback.setView(view);
  if(view==='reset')view=currentView;
  if(view==='relief'&&!metal)return;
  if(!['bloom','front','relief'].includes(view))return;
  currentView=view;
  if(flowerGroup)flowerGroup.visible=view==='bloom';
  if(originalGroup)originalGroup.visible=view==='front';
  if(metal){metal.visible=view==='relief';metal.rotation.y=0}
  camera.position.copy(view==='front'?new THREE.Vector3(0,0,.225):baseCamera);
  display.rotation.set(0,0,0);controls?.target.set(0,0,.007);controls?.update();render();
 }
 // Explicit view buttons provide a keyboard alternative to drag and pinch.
 function adjustView({turn=0,zoom=1}={}){
  if(disposed||fallback||!controls||!Number.isFinite(turn)||!Number.isFinite(zoom)||zoom<=0)return;
  const offset=camera.position.clone().sub(controls.target);
  offset.applyAxisAngle(new THREE.Vector3(0,1,0),turn);
  offset.setLength(Math.max(controls.minDistance,Math.min(controls.maxDistance,offset.length()*zoom)));
  camera.position.copy(controls.target).add(offset);controls.update();render();
 }
 function dispose(){
  if(disposed)return;disposed=true;resizeObserver.disconnect();controls?.dispose();environment.dispose();
  bloom?.userData.dispose?.();
  const textures=new Set(),materials=new Set(),geometries=new Set();
  scene.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);for(const material of Array.isArray(obj.material)?obj.material:obj.material?[obj.material]:[]){materials.add(material);Object.values(material).forEach(t=>{if(t?.isTexture)textures.add(t)})}});
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer.dispose();renderer.domElement.remove();
 }
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();container.classList.remove('model-ready');dispose();fallback=staticViewer(container,hero,card)},{once:true});
 addEventListener('pagehide',event=>{if(!event.persisted)dispose()});
 return {setProgress,setView,adjustView,dispose,getView:()=>fallback?.getView()||currentView};
}

/** Hero-only viewer. The photograph and all fallback card faces remain independent HTML. */
async function createHandheldViewer(container){
 const mount=container.querySelector('.handheld-card-media')||container;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.001,5);
 let renderer,environment,environmentSource,pmrem,metal,resizeObserver;
 let disposed=false,failed=false,progress=0,shaderFailed=false;
 const windowTarget=container.ownerDocument?.defaultView||globalThis;
 const disposedObjects=new WeakSet();
 function disposeObject(root){
  if(!root||disposedObjects.has(root))return;disposedObjects.add(root);
  const textures=new Set(),materials=new Set(),geometries=new Set();
  root.traverse(object=>{
   if(object.isLight&&object.shadow)object.shadow.dispose();
   if(object.geometry)geometries.add(object.geometry);
   for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){
    materials.add(material);Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value)});
   }
  });
  textures.forEach(texture=>texture.dispose());materials.forEach(material=>material.dispose());geometries.forEach(geometry=>geometry.dispose());
 }
 function releaseGraphics(){
  resizeObserver?.disconnect();resizeObserver=null;
  windowTarget.removeEventListener?.('resize',resize);
  windowTarget.removeEventListener?.('pagehide',onPageHide);
  renderer?.domElement.removeEventListener('webglcontextlost',onContextLost);
  disposeObject(scene);environment?.dispose();environment=null;
  environmentSource?.dispose();environmentSource=null;pmrem?.dispose();pmrem=null;
  renderer?.dispose();renderer?.domElement.remove();renderer=null;
 }
 function useFallback(reason){
  if(disposed||failed)return;failed=true;
  container.classList.remove('model-ready');container.classList.add('fallback-only');
  container.dataset.viewerError=reason;
  releaseGraphics();
 }
 function render(){
  if(disposed||failed||!renderer||!metal)return;
  try{
   if(renderer.getContext().isContextLost()){useFallback('webgl-context-lost');return;}
   renderer.render(scene,camera);
   if(shaderFailed)useFallback('webgl-shader-unavailable');
  }catch{useFallback('webgl-render-unavailable');}
 }
 function resize(){
  if(disposed||failed||!renderer||!metal)return;
  const {width,height}=mount.getBoundingClientRect();
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)return;
  try{
   renderer.setSize(width,height,false);configureHandheldCamera(camera,width/height);render();
   if(!failed){container.classList.remove('fallback-only');container.classList.add('model-ready');}
  }catch{useFallback('webgl-resize-unavailable');}
 }
 function onContextLost(event){event.preventDefault();useFallback('webgl-context-lost');}
 function onPageHide(event){if(!event.persisted)dispose();}
 function setProgress(value){
  if(disposed||!Number.isFinite(value))return;
  progress=clampProgress(value);
  if(failed||!metal)return;
  setHandheldProgress(metal,progress);render();
 }
 function dispose(){
  if(disposed)return;disposed=true;releaseGraphics();
  // A detached/reinserted view must reveal its original usable HTML again.
  container.classList.remove('model-ready');
 }
 const api={setProgress,dispose,setView(){},getView:()=> 'relief'};
 try{
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.debug.onShaderError=()=>{shaderFailed=true};
  renderer.setPixelRatio(Math.min(windowTarget.devicePixelRatio||1,1.6));
  renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=HERO_HANDHELD_SPEC.exposure;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.style.pointerEvents='none';
  renderer.domElement.addEventListener('webglcontextlost',onContextLost);
  windowTarget.addEventListener?.('pagehide',onPageHide);
  // Broad image-based reflections are essential for the unchanged metallic PBR materials.
  pmrem=new THREE.PMREMGenerator(renderer);environmentSource=createHandheldEnvironment();
  environment=pmrem.fromScene(environmentSource,.04,.005,1);scene.environment=environment.texture;
  pmrem.dispose();pmrem=null;environmentSource.dispose();environmentSource=null;
  const key=new THREE.DirectionalLight(0xfff8ee,.95);
  key.position.set(-.15,.1905,.18);key.target.position.set(0,0,0);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.camera.near=.01;key.shadow.camera.far=.65;
  key.shadow.camera.left=key.shadow.camera.bottom=-.07;key.shadow.camera.right=key.shadow.camera.top=.07;
  key.shadow.bias=-.000002;key.shadow.normalBias=.000035;
  const fill=new THREE.DirectionalLight(0xedeef0,.22);fill.position.set(.17,.0355,.075);
  scene.add(key,key.target,fill,new THREE.HemisphereLight(0xe8e8e5,0x151515,.15));
  const loaded=(await new GLTFLoader().loadAsync(METAL_MODEL)).scene;
  if(disposed||failed){disposeObject(loaded);return api;}
  metal=loaded;metal.name='Unchanged independent handheld metal card';
  applyHandheldMaterials(metal);
  scene.add(metal);setHandheldProgress(metal,progress);mount.append(renderer.domElement);
  const Observer=windowTarget.ResizeObserver||globalThis.ResizeObserver;
  if(Observer){resizeObserver=new Observer(resize);resizeObserver.observe(mount);}
  else windowTarget.addEventListener?.('resize',resize,{passive:true});
  resize();
 }catch{useFallback(renderer?'asset-or-model-unavailable':'webgl-unavailable');}
 return api;
}
