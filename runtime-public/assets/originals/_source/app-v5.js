import {createArt} from './art.js?v=20260913-pages';
import {readCollection,collect,KEY} from './collection.js?v=20260913-pages';
import {renderOrigins,openOrigin} from './origins.js?v=20260913-pages';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let cards=[],ids=[],selected=0,record={},current=null,token=0,lastMode='ar',soundOn=false,audioCtx,toastTimer,storage;
try{storage=localStorage}catch{storage=null}
const text=(id,value)=>{if($(id))$(id).textContent=value};
const status=(s,h='')=>{$('status').textContent=s;$('hint').textContent=h};
const loading=s=>{$('loading-message').textContent=s;$('loading').hidden=false};
function chime(){if(!soundOn||!audioCtx)return;[523.25,659.25,783.99,1046.5].forEach((f,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+i*.16;o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.06,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+1.4);o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+1.5)});}
function renderCollection(){
 const n=Object.keys(record).length;text('header-progress',`${n} / 5`);text('collection-progress',`已收集 ${n} / 5`);text('viewer-progress',`花卡图鉴 ${n} / 5`);if($('progress-fill'))$('progress-fill').style.width=`${n*20}%`;
 text('collection-message',n===5?'五花齐放。你的花卡图鉴已集齐！':`每识别一张花卡，就点亮一种花卉。${n?`还差 ${5-n} 张，就能集齐。`:''}`);
 $('collection')?.classList.toggle('complete',n===5);
 if(!$('collection-grid'))return;
 $('collection-grid').replaceChildren(...cards.map((c,i)=>{const el=document.createElement('article');el.className='collect-card'+(record[c.id]?' collected':'');el.dataset.card=c.id;el.innerHTML=`<button class="album-preview" aria-label="查看${c.name}文物原型"><img src="${c.target}" alt="${c.name}纹样" loading="lazy"><span class="stamp">${record[c.id]?'已收集 ✓':'待收集'}</span></button><h3>${c.name}</h3><span class="artifact-name">《${c.sourceName}》</span><p>${String(i+1).padStart(2,'0')} / ${c.keyword}</p><div class="album-actions"><button class="album-ar">看 AR ↗</button><a href="${c.image}" download="${c.name}-扫码AR卡片.png">保存卡片 ↧</a></div>`;el.querySelector('.album-preview').onclick=()=>openOrigin(c,()=>{select(i);begin('preview')});el.querySelector('.album-ar').onclick=()=>{select(i);begin('preview')};el.onclick=e=>{if(!e.target.closest('button,a'))openOrigin(c,()=>{select(i);begin('preview')})};return el}));
}
function select(i){selected=i;const c=cards[i];if($('hero-card')){$('hero-card').src=c.image;$('hero-card').alt=c.name+' AR 卡片'}text('card-caption',`${String(i+1).padStart(2,'0')} / 05 · ${c.name}`);text('hero-source',`纹样原型：${c.museum}《${c.sourceName}》`);if($('save-card')){$('save-card').href=c.image;$('save-card').download=c.name+'-扫码AR卡片.png'}$('card-picker')?.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));}
function markCollected(card){const result=collect(storage,record,card.id,ids);record=result.record;renderCollection();if(!result.persisted)text('storage-note','当前浏览器无法保存收集记录，本次收集仅在页面打开期间保留。');if(!result.fresh)return;clearTimeout(toastTimer);$('collect-toast').textContent=Object.keys(record).length===5?'✳ 五花齐放 · 已集齐全部花卡':`✳ 已收集「${card.name}」`;$('collect-toast').hidden=false;toastTimer=setTimeout(()=>$('collect-toast').hidden=true,4000);chime();}
function cleanup(){const s=current;current=null;if(!s)return;s.cancelled=true;clearTimeout(s.initTimer);clearTimeout(s.collectTimer);s.renderer?.setAnimationLoop(null);s.ar?.controller?.stopProcessVideo();s.stream?.getTracks().forEach(t=>t.stop());s.ar?.video?.srcObject?.getTracks().forEach(t=>t.stop());for(const a of s.arts||[])a?.dispose();s.renderer?.dispose();s.renderer?.forceContextLoss();if(s.resize)window.removeEventListener('resize',s.resize);s.ar?.video?.remove();}
function close(){token++;cleanup();clearTimeout(toastTimer);$('stage').replaceChildren();$('viewer').hidden=true;$('welcome').hidden=false;$('error').hidden=true;$('collect-toast').hidden=true;document.body.style.overflow='';delete document.documentElement.dataset.tracking;delete document.documentElement.dataset.card;}
function showError(err,id){if(id!==token)return;cleanup();$('loading').hidden=true;$('scan-guide').hidden=true;let msg='加载未完成，请检查网络后重试。微信内如无法打开相机，请在 Safari 或 Chrome 中打开。';if(['NotAllowedError','PermissionDeniedError'].includes(err?.name))msg='相机权限未开启。请在浏览器的网站设置中允许相机权限，再点击“重新尝试”。';else if(err?.name==='NotFoundError')msg='未找到可用相机。请使用带后置相机的手机，或返回查看动态预览。';else if(err?.name==='NotReadableError')msg='相机可能正在被其他应用使用。关闭占用相机的应用后重试。';else if(err?.message==='insecure')msg='相机需要 HTTPS 安全连接。请通过卡片二维码打开网站。';else if(err?.message==='unsupported')msg='此浏览器不支持相机访问，请使用手机 Safari 或 Chrome。';$('error-message').textContent=msg;$('error').hidden=false;console.error('AR experience:',err?.name||'',err?.message||err);}
async function begin(mode){
 if(!cards.length)return;close();lastMode=mode;const id=++token,state={arts:[],active:-1};current=state;$('welcome').hidden=true;$('viewer').hidden=false;document.body.style.overflow='hidden';$('viewer').classList.toggle('preview-mode',mode==='preview');$('mode-label').textContent=mode==='ar'?'五张花卡 · AR':cards[selected].name+' · 预览';$('replay').hidden=true;$('scan-guide').hidden=true;loading('正在准备花卡…');
 try{
  const THREE=await import('three');if(id!==token)return;let renderer,scene,camera,ar,root;
  if(mode==='preview'){
   renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});state.renderer=renderer;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;$('stage').appendChild(renderer.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,.01,30);root=new THREE.Group();root.rotation.set(-.18,.28,0);scene.add(root);
   state.resize=()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.position.z=camera.aspect<.7?3.5:2.7;camera.updateProjectionMatrix()};window.addEventListener('resize',state.resize);state.resize();
   let drag=false,x=0,y=0;renderer.domElement.addEventListener('pointerdown',e=>{drag=true;x=e.clientX;y=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;root.rotation.y=Math.max(-.85,Math.min(.85,root.rotation.y+(e.clientX-x)*.007));root.rotation.x=Math.max(-.65,Math.min(.65,root.rotation.x+(e.clientY-y)*.007));x=e.clientX;y=e.clientY});renderer.domElement.addEventListener('pointerup',()=>drag=false);renderer.domElement.addEventListener('pointercancel',()=>drag=false);
   const art=await createArt(THREE,root,cards[selected],true,reduced);if(id!==token){art.dispose();return}state.arts=[art];state.active=0;status(cards[selected].name+'，浮起在纸面之上。','拖动查看花卉层次。动态预览不计入收集。');$('replay').hidden=false;
  }else{
   if(!isSecureContext)throw Error('insecure');if(!navigator.mediaDevices?.getUserMedia)throw Error('unsupported');loading('正在准备五张花卡的识别数据…');
   const {MindARThree}=await import('./vendor/mindar-image-three.prod.js');if(id!==token)return;
   ar=new MindARThree({container:$('stage'),imageTargetSrc:'assets/five-flowers.mind',maxTrack:1,uiLoading:'no',uiScanning:'no',uiError:'no',warmupTolerance:3,missTolerance:8,filterMinCF:.001,filterBeta:.01});state.ar=ar;({renderer,scene,camera}=ar);state.renderer=renderer;renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
   // Preserve actual permission errors and stop any late camera permission response.
   ar._startVideo=async()=>{loading('请允许使用相机');const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});if(id!==token){stream.getTracks().forEach(t=>t.stop());throw Error('cancelled')}state.stream=stream;const v=document.createElement('video');ar.video=v;v.muted=true;v.autoplay=true;v.playsInline=true;v.style.cssText='position:absolute;top:0;left:0;z-index:0';$('stage').appendChild(v);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Camera timeout')),20000);v.onloadedmetadata=()=>{clearTimeout(timer);v.width=v.videoWidth;v.height=v.videoHeight;resolve()};v.onerror=()=>{clearTimeout(timer);reject(Error('Camera video error'))};v.srcObject=stream;v.play().catch(e=>{clearTimeout(timer);reject(e)})});loading('正在启动图像识别…')};
   for(let i=0;i<cards.length;i++){
    const card=cards[i],anchor=ar.addAnchor(i);const art=await createArt(THREE,anchor.group,card,false,reduced);if(id!==token){art.dispose();return}state.arts.push(art);
    anchor.onTargetFound=()=>{if(id!==token||state.cancelled)return;clearTimeout(state.collectTimer);state.active=i;document.documentElement.dataset.tracking='found';document.documentElement.dataset.card=card.id;$('scan-guide').hidden=true;$('mode-label').textContent=card.name+' · AR';status(card.name+'，开花了。',`《${card.sourceName}》 · 轻轻移动手机，查看花卉层次。`);$('replay').hidden=false;art.replay();state.collectTimer=setTimeout(()=>{if(id===token&&state.active===i&&!state.cancelled)markCollected(card)},650)};
    anchor.onTargetLost=()=>{if(id!==token||state.active!==i)return;clearTimeout(state.collectTimer);state.active=-1;document.documentElement.dataset.tracking='lost';delete document.documentElement.dataset.card;$('scan-guide').hidden=false;$('replay').hidden=true;$('mode-label').textContent='五张花卡 · AR';status('对准任意一张花卡','让完整图案进入画面，避免反光。可以继续扫描下一张。')};
   }
   state.initTimer=setTimeout(()=>showError(Error('AR startup timeout'),id),90000);await ar.start();clearTimeout(state.initTimer);if(id!==token||state.cancelled){ar.controller?.stopProcessVideo();ar.video?.srcObject?.getTracks().forEach(t=>t.stop());return}
   if(state.active<0){$('scan-guide').hidden=false;status('对准花卡，让花卉醒来','建议距离 20–40 厘米。识别后自动收集，可连续扫描五张花卡。')}
  }
  $('loading').hidden=true;for(const art of state.arts)art.replay();renderer.setAnimationLoop(now=>{if(state.active>=0)state.arts[state.active]?.update(now);renderer.render(scene,camera)});document.documentElement.dataset.experience=mode;
 }catch(err){showError(err,id)}
}
$('start')?.addEventListener('click',()=>begin('ar'));$('preview')?.addEventListener('click',()=>begin('preview'));$('close').onclick=close;$('cancel').onclick=close;$('error-back').onclick=close;$('retry').onclick=()=>begin(lastMode);$('replay').onclick=()=>{current?.arts[current.active]?.replay();chime()};
$('sound').onclick=async()=>{soundOn=!soundOn;try{if(soundOn){audioCtx??=new(window.AudioContext||window.webkitAudioContext)();await audioCtx.resume();chime()}}catch{soundOn=false}$('sound').textContent=`声音：${soundOn?'开':'关'}`;$('sound').setAttribute('aria-pressed',String(soundOn))};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('origin-dialog').open)close()});window.addEventListener('pagehide',close);document.addEventListener('visibilitychange',()=>{if(document.hidden&&current)close()});window.addEventListener('storage',e=>{if(e.key===KEY){record=readCollection(storage,ids);renderCollection()}});
try{
 const response=await fetch('cards.json?v=20260913-pages',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('cards unavailable');cards=await response.json();ids=cards.map(c=>c.id);record=readCollection(storage,ids);
 if($('card-picker'))$('card-picker').replaceChildren(...cards.map((c,i)=>{const b=document.createElement('button');b.textContent=c.name;b.setAttribute('aria-pressed',String(i===0));b.onclick=()=>select(i);return b}));
 renderCollection();renderOrigins(cards,i=>{select(i);begin('preview')});select(0);
 if($('start')){$('start').disabled=false;$('start').innerHTML='打开相机 · 扫描收集 <span aria-hidden="true">↗</span>'}if($('preview'))$('preview').disabled=false;
 const query=new URLSearchParams(location.search);if(query.get('ar')==='1'||document.body.dataset.page==='scan')begin('ar');else if(document.body.dataset.page==='collection'&&query.has('card')){const index=cards.findIndex(c=>c.id===query.get('card'));if(index>=0)openOrigin(cards[index],()=>{select(index);begin('preview')})}
 document.documentElement.dataset.ready='true';
}catch(e){if($('boot-error'))$('boot-error').hidden=false;text('start','加载未完成，请刷新重试');console.error(e)}


$('origin-dialog-close').onclick=()=>$('origin-dialog').close();$('origin-dialog').addEventListener('click',e=>{if(e.target===$('origin-dialog'))$('origin-dialog').close()});
