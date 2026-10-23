import * as THREE from 'three';

// Authored for this prototype. The artwork itself supplies the relief and foil
// masks; no replacement artwork or hand-drawn approximation is introduced.
import {vertexShader,fragmentShader} from './card-material-shaders.mjs';

export async function createMaterialRenderer(host,{pearl=false,onFailure=()=>{}}={}){
  const image=host.querySelector('img');
  let timer;
  await Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Artwork load timeout')),12000);})]).finally(()=>clearTimeout(timer));
  let renderer,geometry,material,texture;
  try{
    renderer=new THREE.WebGLRenderer({alpha:false,antialias:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    const textureImage=new Image();textureImage.src=image.currentSrc||image.src;await textureImage.decode();
    texture=new THREE.Texture(textureImage);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
    const uniforms={uArt:{value:texture},uTexel:{value:new THREE.Vector2(1/image.naturalWidth,1/image.naturalHeight)},uTilt:{value:new THREE.Vector2()},uPearl:{value:pearl?1:0}};
    material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader});
    geometry=new THREE.PlaneGeometry(2,2);
    const scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,material));
    const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;
    const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');host.append(canvas);
    let width=0,height=0,disposed=false,failed=false;
    function lost(event){event.preventDefault();failed=true;onFailure();}
    canvas.addEventListener('webglcontextlost',lost);
    return {
      draw(x,y){
        if(disposed||failed)return;
        const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
        if(width!==w||height!==h){width=w;height=h;renderer.setSize(w,h,false);}
        uniforms.uTilt.value.set(x,y);renderer.render(scene,camera);
      },
      dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lost);geometry.dispose();material.dispose();texture.dispose();renderer.dispose();canvas.remove();},
    };
  }catch(error){geometry?.dispose();material?.dispose();texture?.dispose();renderer?.dispose();renderer?.domElement.remove();throw error;}
}
