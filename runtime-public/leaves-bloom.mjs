/** New true 3D reconstruction of 花叶生辉 (芙蓉花图): an oblique branch,
 * violet-pink hibiscus, pointed five-lobed foliage and an upper-left bud.
 * Coordinates are card-width units, card XY, +Y up and +Z outward. */
import * as THREE from 'three';
export const LEAVES_BLOOM_SPEC=Object.freeze({
  version:'procedural-hibiscus-leaves-1',
  provenance:'New procedural interpretation of the original 花叶生辉 hibiscus illustration',
  units:'card-width',cardAspect:1255/881,cardPlane:'XY',outwardAxis:'+Z',
  root:Object.freeze([.333,-.594,.012]),flowerCenter:Object.freeze([.066,.01,.277]),
  petals:12,budPetals:3,leaves:6,leafShape:'five-lobed-palmate',
});
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const V=a=>new THREE.Vector3(...a);
const relative=a=>a.map((v,i)=>v-LEAVES_BLOOM_SPEC.root[i]);
const tube=(p,r,s=24,n=7)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(V)),s,r,n,false);
function merge(parts) {
  const p=[],n=[],ix=[];let offset=0;
  for(const g of parts){p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);for(const i of g.index.array)ix.push(i+offset);offset+=g.attributes.position.count;g.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setIndex(ix);return g;
}
function shell(positions,colors,indices){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.userData.solidBlade=true;return g;
}
function petal({length,width,reach=.060,bud=false,green=false}) {
  const rows=22,cols=12,n=(rows+1)*(cols+1),p=[],c=[],ix=[];
  const base=new THREE.Color(green?0x27b7a3:bud?0x913d9f:0xae45b0);
  const middle=new THREE.Color(green?0x66d1b3:0xdd7fd4);
  const rim=new THREE.Color(green?0xb7efd0:0xffc6e5),shade=new THREE.Color();
  for(let side=0;side<2;side++)for(let i=0;i<=rows;i++){
    const t=i/rows,bell=Math.pow(Math.max(0,Math.sin(Math.PI*t)),bud?.83:.50);
    const edgeWave=bud?1:1+.07*Math.sin(7*Math.PI*t+.5);
    const w=width*bell*edgeWave+.00022;
    for(let j=0;j<=cols;j++){
      const u=j/cols*2-1;
      const y=length*t+(bud?0:.011)*u*u*Math.sin(t*Math.PI*2);
      const z=reach*Math.sin(t*Math.PI*.61)+.010*(1-u*u)*bell-.012*u*u*bell;
      p.push(w*u+.008*Math.sin(t*Math.PI),y,z+(side?-1:1)*.0018);
      shade.copy(base).lerp(middle,smooth(.18,.95,t)*.75);
      const rimWeight=Math.max(smooth(.60,.96,Math.abs(u))*.88,smooth(.75,.99,t)*.92);
      shade.lerp(rim,rimWeight);if(side)shade.multiplyScalar(.79);c.push(shade.r,shade.g,shade.b);
    }
  }
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
    const a=i*(cols+1)+j,b=a+1,d=a+cols+1,e=d+1;ix.push(a,b,e,a,e,d,a+n,e+n,b+n,a+n,d+n,e+n);
  }
  const ring=[];for(let j=0;j<=cols;j++)ring.push(j);for(let i=1;i<=rows;i++)ring.push(i*(cols+1)+cols);for(let j=cols-1;j>=0;j--)ring.push(rows*(cols+1)+j);for(let i=rows-1;i>0;i--)ring.push(i*(cols+1));
  ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length];ix.push(a,a+n,b,b,a+n,b+n);});
  return shell(p,c,ix);
}
function leafPoint(f,angle,radius) {
  // A cusp at each tip, with rounded valleys between: palmate foliage, not stars.
  const contour=1-.39*Math.abs(Math.sin(2.5*(angle-Math.PI/2)));
  const r=radius*f*contour;
  return [r*Math.cos(angle),r*Math.sin(angle)*1.12,.027*f*f+.015*Math.sin(angle*3+.3)*f*f];
}
function palmateLeaf(radius) {
  const sectors=80,rings=7,p=[],c=[],ix=[],n=1+sectors*rings;
  const inner=new THREE.Color(0x23b6a5),outer=new THREE.Color(0xa6e8bf),shade=new THREE.Color();
  for(let side=0;side<2;side++){
    p.push(0,0,side?-.002:.002);shade.copy(inner);if(side)shade.multiplyScalar(.78);c.push(shade.r,shade.g,shade.b);
    for(let r=1;r<=rings;r++)for(let j=0;j<sectors;j++){
      const f=r/rings,angle=j/sectors*Math.PI*2,q=leafPoint(f,angle,radius);q[2]+=side?-.002:.002;p.push(...q);
      shade.copy(inner).lerp(outer,(.40+.50*Math.sin(angle+1.6))*f*.93);if(side)shade.multiplyScalar(.78);c.push(shade.r,shade.g,shade.b);
    }
  }
  for(let j=0;j<sectors;j++){
    const a=1+j,b=1+(j+1)%sectors;ix.push(0,a,b,n,b+n,a+n);
  }
  for(let r=0;r<rings-1;r++)for(let j=0;j<sectors;j++){
    const a=1+r*sectors+j,b=1+r*sectors+(j+1)%sectors,d=a+sectors,e=b+sectors;
    ix.push(a,d,e,a,e,b,a+n,e+n,d+n,a+n,b+n,e+n);
  }
  for(let j=0;j<sectors;j++){
    const a=1+(rings-1)*sectors+j,b=1+(rings-1)*sectors+(j+1)%sectors;ix.push(a,b,a+n,b,b+n,a+n);
  }
  return shell(p,c,ix);
}
export function createLeavesBloom(){
  const root=new THREE.Group();root.name='LeavesBloom.HibiscusPalmateBranch.Procedural';
  const plant=new THREE.Group();plant.name='PlantedShoot';plant.position.fromArray(LEAVES_BLOOM_SPEC.root);root.add(plant);
  const geometries=new Set(),materials=new Set(),moving=[];let disposed=false;
  const material=p=>{const m=new THREE.MeshPhysicalMaterial(p);materials.add(m);return m;};
  const petals=material({vertexColors:true,roughness:.40,metalness:0,clearcoat:.28,side:THREE.DoubleSide});
  const leaves=material({vertexColors:true,roughness:.43,metalness:.01,clearcoat:.32,side:THREE.DoubleSide});
  const stemMat=material({color:0x58cdb4,roughness:.46,clearcoat:.25});
  const veinMat=material({color:0xe1fad2,roughness:.55});
  const goldMat=material({color:0xffdc86,roughness:.41,metalness:.07});
  const centerMat=material({color:0x6cdcc0,roughness:.36,clearcoat:.5});
  function mesh(g,m,name,parent=plant){geometries.add(g);const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  const paths=[
    [[.333,-.594,.012],[.254,-.463,.063],[.123,-.327,.108],[-.023,-.160,.143],[-.073,.012,.186],[-.145,.226,.184],[-.214,.412,.189]],
    [[-.035,-.159,.145],[-.018,-.080,.218],[.066,.010,.277]],
    [[-.072,.02,.186],[.114,.149,.194],[.205,.279,.207]],
    [[-.024,-.174,.140],[-.116,-.065,.168],[-.177,-.040,.177]],
    [[-.021,-.188,.139],[-.074,-.246,.153],[-.130,-.286,.163]],
    [[-.124,.173,.185],[-.193,.243,.200],[-.251,.254,.201]],
    [[.17,-.382,.089],[.234,-.303,.140],[.276,-.215,.153]],
    [[.268,-.491,.044],[.197,-.459,.076],[.105,-.479,.090]],
  ];
  mesh(merge(paths.map((p,i)=>tube(p.map(relative),i===0?.0085:.0052,i===0?50:22,8))),stemMat,'DiagonalBranchAndSixLeafStalks');
  const leafSpecs=[
    {base:[.205,.279,.207],radius:.171,rotation:.17,delay:.29},
    {base:[-.130,-.286,.163],radius:.204,rotation:-.38,delay:.08},
    {base:[-.177,-.040,.177],radius:.085,rotation:.11,delay:.19},
    {base:[-.251,.254,.201],radius:.083,rotation:.41,delay:.33},
    {base:[.276,-.215,.153],radius:.079,rotation:-.43,delay:.16},
    {base:[.105,-.479,.090],radius:.072,rotation:.38,delay:.04},
  ];
  leafSpecs.forEach((l,i)=>{
    const group=new THREE.Group();group.name=`FiveLobedLeaf.${i}`;group.position.fromArray(relative(l.base));group.rotation.set(-.10*(i%2),.12*(i%2===0?1:-1),l.rotation);plant.add(group);moving.push({group,delay:l.delay,kind:'leaf'});
    mesh(palmateLeaf(l.radius),leaves,'SolidPalmateLeaf',group);
    const veins=[];
    for(let j=0;j<5;j++){
      const angle=Math.PI/2+j*Math.PI*2/5;
      const points=[0,.24,.51,.77,.97].map(f=>{const p=leafPoint(f,angle,l.radius);p[2]+=.004;return p;});
      veins.push(tube(points,.0012,14,5));
    }
    mesh(merge(veins),veinMat,'FiveRaisedPalmateVeins',group);
  });
  const flower=new THREE.Group();flower.name='LayeredLilacPinkHibiscus';flower.position.fromArray(relative(LEAVES_BLOOM_SPEC.flowerCenter));plant.add(flower);
  const rings=[{count:7,length:.195,width:.087,reach:.062,phase:.13,z:0,delay:.29},{count:5,length:.151,width:.071,reach:.092,phase:.50,z:.025,delay:.39}];
  rings.forEach((ring,k)=>{
    const geometry=petal(ring);
    for(let i=0;i<ring.count;i++){
      const azimuth=new THREE.Group();azimuth.rotation.z=i/ring.count*Math.PI*2+ring.phase;azimuth.position.z=ring.z;flower.add(azimuth);
      const pivot=new THREE.Group();azimuth.add(pivot);moving.push({group:pivot,delay:ring.delay+(i%3)*.023,kind:'petal'});
      const p=mesh(geometry,petals,`HibiscusPetal.${k}.${i}`,pivot);p.scale.set(1+.04*Math.sin(i*3.1),1+.04*Math.cos(i*2.1),1);
    }
  });
  const heart=mesh(new THREE.SphereGeometry(.028,20,12),centerMat,'MintHibiscusHeart',flower);heart.position.z=.136;heart.scale.z=.42;
  const ring=mesh(new THREE.TorusGeometry(.030,.005,8,30),goldMat,'HibiscusGoldHeartRing',flower);ring.position.z=.132;
  const filaments=[],anthers=[];
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2+.2,r=.068+(i%3)*.006;
    filaments.push(tube([[Math.cos(a)*.022,Math.sin(a)*.022,.118],[Math.cos(a)*r*.75,Math.sin(a)*r*.75,.150],[Math.cos(a)*r,Math.sin(a)*r,.153]],.0017,10,5));
    const g=new THREE.SphereGeometry(.007,9,7);g.translate(Math.cos(a)*r,Math.sin(a)*r,.153);anthers.push(g);
  }
  mesh(merge(filaments),goldMat,'TwelveHibiscusFilaments',flower);mesh(merge(anthers),goldMat,'TwelveHibiscusAnthers',flower);
  const bud=new THREE.Group();bud.name='UpperLeftClosedPinkBud';bud.position.fromArray(relative([-.214,.412,.189]));bud.rotation.z=.46;plant.add(bud);moving.push({group:bud,delay:.43,kind:'bud'});
  for(let i=0;i<3;i++){
    const p=mesh(petal({length:.139,width:.038,reach:.046,bud:true}),petals,`ClosedBudPetal.${i}`,bud);p.rotation.y=(i-1)*.85;p.position.z=i*.002;
  }
  for(let i=0;i<3;i++){
    const s=mesh(petal({length:.075,width:.021,reach:.037,bud:true,green:true}),leaves,`BudSepal.${i}`,bud);s.rotation.y=i/3*Math.PI*2;
  }
  function setGrowth(v){
    if(disposed)return;const t=Number.isFinite(v)?clamp(v):0;root.visible=t>0;const g=smooth(0,.84,t);
    plant.scale.set(.018+.982*g,.018+.982*g,.012+.988*g);
    for(const item of moving){const p=smooth(item.delay,item.kind==='petal'?1:.87,t);item.group.scale.setScalar(.006+.994*p);if(item.kind==='petal')item.group.rotation.x=(1-p)*.96;}
    root.userData.growth=t;root.updateMatrixWorld(true);
  }
  function dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.visible=false;root.userData.disposed=true;}
  Object.assign(root.userData,{spec:LEAVES_BLOOM_SPEC,setGrowth,dispose,disposed:false});setGrowth(1);return root;
}
export default createLeavesBloom;
