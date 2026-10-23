/** New 3D reconstruction of 菊影流金: a hooked orange/gold pinwheel on a
 * right-rooted, sinuous turquoise branch. No image planes or external assets.
 * Card-width units; card XY, +Y up, +Z outward. Three.js r160. */
import * as THREE from 'three';

export const CHRYSANTHEMUM_BLOOM_SPEC = Object.freeze({
  version: 'procedural-chrysanthemum-1',
  provenance: 'New procedural interpretation of the original 菊影流金 illustration',
  units: 'card-width', cardAspect: 1228 / 875, cardPlane: 'XY', outwardAxis: '+Z',
  root: Object.freeze([0.333, -0.624, 0.012]),
  flowerCenter: Object.freeze([-0.02, 0.264, 0.244]),
  petals: 12, leafShape: 'deeply-lobed-acanthus', leaves: 5,
});
const clamp = v => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp((v-a)/(b-a)); return t*t*(3-2*t); };
const V = a => new THREE.Vector3(...a);
const relative = a => a.map((v,i) => v-CHRYSANTHEMUM_BLOOM_SPEC.root[i]);

// Every blade has two curved surfaces and a closed, finite-thickness rim.
function blade({ length, width, leaf = false, curl = 1, rows = 26, cols = 8 }) {
  const points = leaf
    ? [[0,0,0],[0.03,0.3,0.055],[-0.07,0.65,0.1],[-0.23,1,0.16]]
    : [[0,0,0],[0.02,0.30,0.06],[-0.12,0.65,0.13],[-0.36,0.91,0.23],[-0.63,0.88,0.29],[-0.67,0.66,0.35]];
  const curve = new THREE.CatmullRomCurve3(points.map(p => V([p[0]*length*curl,p[1]*length,p[2]*length])));
  const positions=[], colors=[], indices=[], n=(rows+1)*(cols+1);
  const orange=new THREE.Color(leaf ? 0x18aaa2 : 0xf56a40);
  const middle=new THREE.Color(leaf ? 0x5cd0be : 0xff9f5c);
  const edge=new THREE.Color(leaf ? 0xacf3d9 : 0xffe6a0), c=new THREE.Color();
  for(let side=0;side<2;side++) for(let i=0;i<=rows;i++) {
    const t=i/rows, p=curve.getPoint(t), tangent=curve.getTangent(t);
    const cross=new THREE.Vector3(tangent.y,-tangent.x,0).normalize();
    let bell=Math.pow(Math.max(0,Math.sin(Math.PI*t)),leaf ? 0.68 : 0.56);
    if(leaf) bell*=0.73+0.27*Math.cos(t*Math.PI*6-0.7);
    const w=width*bell+0.00025;
    for(let j=0;j<=cols;j++) {
      const u=j/cols*2-1, ridge=(1-u*u)*bell*(leaf ? 0.013 : 0.021);
      positions.push(p.x+cross.x*u*w,p.y+cross.y*u*w,p.z+ridge-u*u*bell*0.009+(side ? -1:1)*0.0017);
      c.copy(orange).lerp(middle,smooth(0.1,0.85,t)*0.7);
      c.lerp(edge,leaf ? smooth(0.58,1,Math.abs(u))*0.38 : Math.max(smooth(0.78,1,t),smooth(0.20,0.98,u)*0.94));
      if(side) c.multiplyScalar(0.79);
      colors.push(c.r,c.g,c.b);
    }
  }
  for(let i=0;i<rows;i++) for(let j=0;j<cols;j++) {
    const a=i*(cols+1)+j,b=a+1,d=a+cols+1,e=d+1;
    indices.push(a,b,e,a,e,d,a+n,e+n,b+n,a+n,d+n,e+n);
  }
  const ring=[];
  for(let j=0;j<=cols;j++) ring.push(j);
  for(let i=1;i<=rows;i++) ring.push(i*(cols+1)+cols);
  for(let j=cols-1;j>=0;j--) ring.push(rows*(cols+1)+j);
  for(let i=rows-1;i>0;i--) ring.push(i*(cols+1));
  ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length];indices.push(a,a+n,b,b,a+n,b+n);});
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.userData.solidBlade=true;
  return { geometry, curve };
}
const tube=(points,radius,segments=22,radial=7)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V)),segments,radius,radial,false);
function merge(parts) {
  const p=[],n=[],ix=[];let offset=0;
  for(const g of parts) {
    p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);
    for(const i of g.index.array) ix.push(i+offset);
    offset+=g.attributes.position.count;g.dispose();
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setIndex(ix);return g;
}

export function createChrysanthemumBloom() {
  const root=new THREE.Group();root.name='ChrysanthemumBloom.GoldenPinwheel.Procedural';
  const plant=new THREE.Group();plant.name='PlantedShoot';plant.position.fromArray(CHRYSANTHEMUM_BLOOM_SPEC.root);root.add(plant);
  const geometries=new Set(),materials=new Set(),moving=[];let disposed=false;
  const material=p=>{const m=new THREE.MeshPhysicalMaterial(p);materials.add(m);return m;};
  const petalMat=material({vertexColors:true,roughness:0.4,metalness:0.01,clearcoat:0.35,side:THREE.DoubleSide});
  const leafMat=material({vertexColors:true,roughness:0.43,metalness:0.01,clearcoat:0.36,side:THREE.DoubleSide});
  const stemMat=material({color:0x36c2b1,roughness:0.4,clearcoat:0.4});
  const veinMat=material({color:0xb5f1d5,roughness:0.55});
  const goldMat=material({color:0xffe29a,roughness:0.43,metalness:0.09});
  const centerMat=material({color:0x22b8ad,roughness:0.36,clearcoat:0.4});
  function mesh(g,m,name,parent=plant) {
    geometries.add(g);const obj=new THREE.Mesh(g,m);obj.name=name;obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;
  }
  const stem=[[.333,-.624,.012],[.216,-.543,.049],[.160,-.389,.091],[.163,-.192,.143],[.145,.027,.181],[-.020,.264,.244]];
  const leafSpecs=[
    {base:[.194,-.510,.065],length:.333,width:.095,angle:1.06,delay:.06},
    {base:[.155,-.274,.122],length:.330,width:.085,angle:1.00,delay:.14},
    {base:[.156,-.043,.166],length:.235,width:.075,angle:-.39,delay:.22},
    {base:[.160,-.380,.096],length:.183,width:.046,angle:-.95,delay:.1},
    {base:[.245,-.562,.04],length:.150,width:.032,angle:.15,delay:.02},
  ];
  const stems=[tube(stem.map(relative),.008,48,9)];
  leafSpecs.forEach((l,i)=>{
    const group=new THREE.Group();group.name=`LobedLeaf.${i}`;group.position.fromArray(relative(l.base));group.rotation.z=l.angle;plant.add(group);
    moving.push({group,delay:l.delay,kind:'leaf'});
    const {geometry,curve}=blade({length:l.length,width:l.width,leaf:true,rows:22,cols:10});
    mesh(geometry,leafMat,'DeeplyCutLeafBlade',group);
    const surface=(t,u=0)=>{
      const p=curve.getPoint(t), tangent=curve.getTangent(t),cross=new THREE.Vector3(tangent.y,-tangent.x,0).normalize();
      const bell=Math.pow(Math.sin(Math.PI*t),.68)*(.73+.27*Math.cos(t*Math.PI*6-.7)),w=l.width*bell+.00025;
      return [p.x+cross.x*u*w,p.y+cross.y*u*w,p.z+(1-u*u)*bell*.013-u*u*bell*.009+.0025];
    };
    const mid=[0,.2,.4,.6,.8,.98].map(t=>surface(t));
    const veins=[tube(mid,.0015,22,5)];
    for(const t of [.24,.47,.68]) for(const side of [-1,1]) {
      veins.push(tube([surface(t),surface(t+.06,side*.38),surface(t+.12,side*.76)],.0008,7,5));
    }
    mesh(merge(veins),veinMat,'RaisedPinnateVeins',group);
  });
  mesh(merge(stems),stemMat,'SinuousChrysanthemumStem');
  const flower=new THREE.Group();flower.name='TwelveHookedOrangeGoldPetals';flower.position.fromArray(relative(CHRYSANTHEMUM_BLOOM_SPEC.flowerCenter));plant.add(flower);
  // A single pinwheel, not the lotus's three cup-shaped rings.
  for(let i=0;i<12;i++) {
    const group=new THREE.Group();group.name=`HookedPetalPivot.${i}`;group.rotation.z=i*Math.PI/6+.14;group.position.z=(i%3)*.006;flower.add(group);
    const pivot=new THREE.Group();group.add(pivot);moving.push({group:pivot,delay:.25+(i%4)*.026,kind:'petal'});
    const length=.233+(i%3===0?.037:i%3===1?-.027:.007);
    mesh(blade({length,width:.046+(i%3)*.003,curl:.88+Math.sin(i*2.1)*.1}).geometry,petalMat,`HookedPetal.${i}`,pivot);
  }
  const center=mesh(new THREE.SphereGeometry(.030,20,12),centerMat,'TurquoiseOvalHeart',flower);
  center.position.z=.092;center.scale.set(1,.78,.47);
  const ring=mesh(new THREE.TorusGeometry(.030,.004,6,28),goldMat,'PaleGoldHeartRim',flower);ring.position.z=.088;ring.scale.y=.79;
  const filaments=[],anthers=[];
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6+.2,r=.060+(i%3)*.007;
    filaments.push(tube([[Math.cos(a)*.019,Math.sin(a)*.019,.085],[Math.cos(a)*r*.75,Math.sin(a)*r*.75,.119],[Math.cos(a)*r,Math.sin(a)*r,.124]],.0015,10,5));
    const g=new THREE.SphereGeometry(.0058,8,6);g.translate(Math.cos(a)*r,Math.sin(a)*r,.124);anthers.push(g);
  }
  mesh(merge(filaments),goldMat,'TwelveRadialFilaments',flower);mesh(merge(anthers),goldMat,'TwelveGoldenAnthers',flower);
  function setGrowth(v) {
    if(disposed)return;const t=Number.isFinite(v)?clamp(v):0;root.visible=t>0;
    const g=smooth(0,.82,t);plant.scale.set(.02+.98*g,.02+.98*g,.012+.988*g);
    for(const item of moving) {
      const p=smooth(item.delay,item.kind==='leaf'?.84:1,t);item.group.scale.setScalar(.007+.993*p);
      if(item.kind==='petal')item.group.rotation.x=(1-p)*1.02;
    }
    root.userData.growth=t;root.updateMatrixWorld(true);
  }
  function dispose() {if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.visible=false;root.userData.disposed=true;}
  Object.assign(root.userData,{spec:CHRYSANTHEMUM_BLOOM_SPEC,setGrowth,dispose,disposed:false});setGrowth(1);return root;
}
export default createChrysanthemumBloom;
