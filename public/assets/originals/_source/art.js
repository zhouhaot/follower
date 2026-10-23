export async function createArt(THREE,group,card,preview,reduced){
 const loader=new THREE.TextureLoader(),meshes=[],textures=new Set(),layers=[];
 const texture=async url=>{const t=await loader.loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;textures.add(t);return t};
 function add(map,depth,index,material){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,card.ratio),material||new THREE.MeshBasicMaterial({map,transparent:true,alphaTest:.02,side:THREE.DoubleSide,depthWrite:false}));m.renderOrder=index+1;group.add(m);meshes.push(m);if(depth!==null)layers.push({mesh:m,depth,index});return m}
 try{
  if(preview){const t=await texture(card.target);add(t,null,-1,new THREE.MeshBasicMaterial({map:t})).position.z=-.02}
  if(card.legacy){
   await Promise.all([['ornaments',.05],['greens',.14],['vase',.29],['blooms',.42],['details',.49]].map(async([name,depth],i)=>add(await texture(`assets/${name}.png`),depth,i)));
  }else{
   const t=await texture(card.target);
   const flower=card.id==='peony'?'ellipse(p,vec2(.50,.26),vec2(.28,.18))+ellipse(p,vec2(.34,.44),vec2(.16,.11))+ellipse(p,vec2(.65,.44),vec2(.16,.11))':card.id==='chrysanthemum'?'ellipse(p,vec2(.51,.30),vec2(.36,.27))':card.id==='lotus'?'ellipse(p,vec2(.5,.24),vec2(.26,.18))':'ellipse(p,vec2(.54,.47),vec2(.26,.21))';
   const flowerColor=card.id==='peony'?'step(diffuseColor.g*.94,diffuseColor.r)*step(diffuseColor.b*.85,diffuseColor.r)':card.id==='chrysanthemum'?'step(diffuseColor.g*.85,diffuseColor.r)*step(diffuseColor.b*1.12,diffuseColor.g)':card.id==='lotus'?'step(diffuseColor.r*.94,diffuseColor.b)*step(diffuseColor.g*.94,diffuseColor.b)':'step(diffuseColor.g*1.10,diffuseColor.r)*step(diffuseColor.g*1.10,diffuseColor.b)';
   const vaseColor=card.id==='peony'?'step(diffuseColor.g*.90,diffuseColor.r)*step(diffuseColor.b*1.08,diffuseColor.r)':'step(diffuseColor.g*.96,diffuseColor.b)';
   const vase=card.id==='peony'?'step(.565,p.y)*step(p.y,.94)*step(.30,p.x)*step(p.x,.70)':card.id==='lotus'?'step(.605,p.y)*step(p.y,.925)*step(.30,p.x)*step(p.x,.70)':'0.0';
   // Sample approved artwork unchanged; alpha masks separate its pixels into depth layers.
   for(let i=0;i<4;i++){
    const material=new THREE.MeshBasicMaterial({map:t,transparent:true,side:THREE.DoubleSide,depthWrite:false});
    material.onBeforeCompile=shader=>{
     shader.fragmentShader=shader.fragmentShader.replace('void main() {',`float ellipse(vec2 p,vec2 c,vec2 r){return 1.0-step(1.0,length((p-c)/r));}\nvoid main() {`);
     shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec2 p=vec2(vMapUv.x,1.0-vMapUv.y);
      float f=clamp(${flower},0.0,1.0)*(${flowerColor});
      float v=(${vase})*(${vaseColor})*(1.0-f);
      float center=step(.13,p.x)*step(p.x,.87)*step(.12,p.y)*step(p.y,.95);
      float rest=(1.0-f)*(1.0-v);
      float region=${['rest*(1.0-center)','rest*center','v','f'][i]};
      float bright=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));
      diffuseColor.a*=smoothstep(.018,.05,bright)*region;
      if(diffuseColor.a<.015)discard;`);
    };
    material.customProgramCacheKey=()=>card.id+'-layer-'+i;
    add(t,[.055,.16,.29,.43][i],i,material);
   }
  }
 }catch(e){dispose();throw e}
 let start=performance.now();
 function dispose(){for(const m of meshes){group.remove(m);m.geometry.dispose();m.material.dispose()}for(const t of textures)t.dispose()}
 return {dispose,replay(){start=performance.now()},update(now){for(const {mesh,depth,index} of layers){const age=(now-start)/1000;const progress=reduced?1:Math.max(0,Math.min(1,(age-index*.11)/1.4));const p=1-(1-progress)**3;mesh.position.z=.004+depth*p+(reduced?0:Math.sin(now*.0013+index)*.008*p);mesh.position.y=depth*.06*p;mesh.rotation.z=reduced?0:Math.sin(now*.0007+index)*.004*p;const s=1+(reduced?0:Math.sin(now*.0012+index)*.009*p);mesh.scale.set(s,s,1)}}};
}
