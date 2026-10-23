import * as THREE from 'three';
import {vertexShader,fragmentShader} from './card-material-shaders.mjs';

/** One offscreen WebGL renderer per gallery; visible cards retain 2D snapshots. */
export function createPearlRenderer({onFailure=()=>{}}={}){
  const renderer=new THREE.WebGLRenderer({alpha:false,antialias:false,powerPreference:'low-power'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(1);
  const uniforms={uArt:{value:null},uTexel:{value:new THREE.Vector2()},uTilt:{value:new THREE.Vector2()},uPearl:{value:1},uArtworkMask:{value:0}};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader});
  const geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,material));
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;
  const textures=new Map();let disposed=false,failed=false,width=0,height=0;
  const lost=event=>{event.preventDefault();if(!disposed){failed=true;onFailure();}};
  renderer.domElement.addEventListener('webglcontextlost',lost);
  function key(image){return image.currentSrc||image.src;}
  return {
    has(image){return textures.has(key(image));},
    async prepare(image){
      const url=key(image);if(textures.has(url)||disposed)return;
      const source=new Image();source.src=url;
      let timer;await Promise.race([source.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Artwork unavailable')),12000);})]).finally(()=>clearTimeout(timer));
      if(disposed)return;
      // Texture size follows the displayed work, not the print source's pixels.
      const scale=Math.min(1,1024/Math.max(source.naturalWidth,source.naturalHeight));
      const bitmap=document.createElement('canvas');bitmap.width=Math.round(source.naturalWidth*scale);bitmap.height=Math.round(source.naturalHeight*scale);
      const context=bitmap.getContext('2d');if(!context)throw new Error('Canvas unavailable');
      context.drawImage(source,0,0,bitmap.width,bitmap.height);
      const texture=new THREE.CanvasTexture(bitmap);texture.colorSpace=THREE.SRGBColorSpace;
      textures.set(url,texture);
      while(textures.size>3){const oldest=textures.keys().next().value;textures.get(oldest).dispose();textures.delete(oldest);}
    },
    draw(image,canvas,{x=0,y=0,cardKey='lotus'}={}){
      if(disposed||failed)return false;
      const texture=textures.get(key(image));if(!texture)return false;
      textures.delete(key(image));textures.set(key(image),texture);
      const host=canvas.parentElement,w=Math.round(host.clientWidth*Math.min(devicePixelRatio,1.5)),h=Math.round(host.clientHeight*Math.min(devicePixelRatio,1.5));
      if(!w||!h)return false;
      if(w!==width||h!==height){renderer.setSize(w,h,false);width=w;height=h;}
      uniforms.uArt.value=texture;uniforms.uTexel.value.set(1/texture.image.width,1/texture.image.height);uniforms.uTilt.value.set(x,y);uniforms.uArtworkMask.value=cardKey==='lotus'?0:1;
      renderer.render(scene,camera);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      // Copy in this call, before WebGL clears its non-preserved drawing buffer.
      const context=canvas.getContext('2d');if(!context)throw new Error('Snapshot unavailable');
      context.drawImage(renderer.domElement,0,0,w,h);return true;
    },
    dispose(){if(disposed)return;disposed=true;renderer.domElement.removeEventListener('webglcontextlost',lost);for(const texture of textures.values())texture.dispose();textures.clear();geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();},
  };
}
