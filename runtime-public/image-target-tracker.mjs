/** Managed adapter around the exact public zevth.work MindAR target engine.
 * Camera ownership stays in scan-controller. No camera API is called here.
 */
import * as THREE from 'three';
import { createBloomFor, bloomAvailable } from './bloom-registry.mjs';
import { imageTargetFor, validateTargetDimensions } from './image-targets.mjs';

const TARGET_SRC = new URL('./assets/originals/five-flowers.mind', import.meta.url).href;

async function loadRuntime() {
  // Lazy loading keeps browser-only MindAR initialization out of collection/preview.
  await import('./assets/originals/_source/vendor/mindar-image-three.prod.js');
  const [{ C: ImageTargetController }, { O: OneEuroFilter }] = await Promise.all([
    import('./assets/originals/_source/vendor/controller-mGt1s8dJ.js'),
    import('./assets/originals/_source/vendor/ui-fBadYuor.js'),
  ]);
  return { ImageTargetController, OneEuroFilter };
}
const safely = (action) => { try { action(); } catch {} };

function abortError() { return new DOMException('Scan cancelled', 'AbortError'); }

function disposeTensors(object, seen = new Set()) {
  if (!object || typeof object !== 'object' || seen.has(object)) return;
  seen.add(object);
  if (object.dataId && Array.isArray(object.shape) && typeof object.dispose === 'function') { object.dispose(); return; }
  if (ArrayBuffer.isView(object) || object instanceof ArrayBuffer || object.nodeType) return;
  for (const value of Object.values(object)) disposeTensors(value, seen);
}

export async function createImageTargetTracker({
  cardKey, container, stream, signal, onTargetUpdate = () => {}, onError = () => {},
  // Injection points exercise construction and disposal without claiming GPU or
  // physical recognition verification. The app always uses these real defaults.
  runtime: suppliedRuntime,
  document: doc = globalThis.document,
  window: win = globalThis.window,
  fetchAsset = globalThis.fetch,
  requestFrame = globalThis.requestAnimationFrame,
  cancelFrame = globalThis.cancelAnimationFrame,
  createRenderer = (options) => new THREE.WebGLRenderer(options),
} = {}) {
  const target = imageTargetFor(cardKey);
  if (!target || !bloomAvailable(cardKey)) throw new Error('Selected card has no geometric scan model');
  if (signal?.aborted) throw abortError();
  const { ImageTargetController, OneEuroFilter } = suppliedRuntime || await loadRuntime();
  if (signal?.aborted) throw abortError();
  const TARGET_INDEX = target.index;
  let disposed = false, running = false, frame = 0, controller = null, renderer = null, model = null;
  let trackedPose = null, seenFrames = 0, lastTracking = false, riseStart = 0;
  let resizeObserver = null, frameTimeout = null;
  const poseFilter = new OneEuroFilter({ minCutOff: 0.001, beta: 1000 });
  const reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const video = doc.createElement('video');
  video.autoplay = true; video.muted = true; video.playsInline = true;
  video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
  video.setAttribute('aria-hidden', 'true');
  Object.assign(video.style, { position: 'absolute', zIndex: '0', pointerEvents: 'none' });
  video.srcObject = stream;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const anchor = new THREE.Group();
  anchor.matrixAutoUpdate = false; anchor.visible = false;
  scene.add(anchor);
  const relief = new THREE.Group();
  anchor.add(relief);
  const postMatrix = new THREE.Matrix4();
  const lights = new THREE.HemisphereLight(0xfff5dc, 0x334941, 2.2);
  const keyLight = new THREE.DirectionalLight(0xffe7bb, 3.2);
  keyLight.position.set(-1, 2, 3);
  const fillLight = new THREE.DirectionalLight(0xd9f0e8, 1.1);
  fillLight.position.set(1, -1, 2);
  scene.add(lights, keyLight, fillLight);

  function dispose() {
    if (disposed) return;
    disposed = true; running = false;
    cancelFrame(frame); clearTimeout(frameTimeout);
    signal?.removeEventListener('abort', dispose);
    win.removeEventListener('resize', resize);
    video.removeEventListener('resize', resize);
    resizeObserver?.disconnect();
    // Resolve in-flight worker calls before terminating their worker.
    safely(() => controller?.stopProcessVideo?.());
    safely(() => controller?.workerMatchDone?.({ targetIndex: -1, modelViewTransform: null }));
    safely(() => controller?.workerTrackDone?.({ modelViewTransform: null }));
    safely(() => controller?.worker?.terminate());
    if (controller) {
      try { disposeTensors(controller.tracker); } catch {}
      try { disposeTensors(controller.cropDetector); } catch {}
      const pixelData = controller.inputLoader?.tempPixelHandle?.dataId;
      if (pixelData) { try { win.MINDAR.IMAGE.tf.backend().disposeData(pixelData); } catch {} }
    }
    try { model?.userData.dispose?.(); } catch {}
    safely(() => renderer?.setAnimationLoop(null));
    safely(() => renderer?.dispose()); safely(() => renderer?.forceContextLoss()); safely(() => renderer?.domElement.remove());
    safely(() => video.pause()); video.srcObject = null; video.remove();
  }
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) { dispose(); throw abortError(); }

  function resize() {
    if (disposed || !controller || !renderer || !video.videoWidth) return;
    const width = Math.max(container.clientWidth, 1), height = Math.max(container.clientHeight, 1);
    video.width = video.videoWidth; video.height = video.videoHeight;
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = width / height;
    const displayHeight = videoRatio > containerRatio ? height : width / videoRatio;
    const displayWidth = displayHeight * videoRatio;
    Object.assign(video.style, { top: `${(height - displayHeight) / 2}px`, left: `${(width - displayWidth) / 2}px`, width: `${displayWidth}px`, height: `${displayHeight}px` });
    const proj = controller.getProjectionMatrix();
    const inputRatio = controller.inputWidth / controller.inputHeight;
    const inputAdjust = inputRatio > containerRatio ? video.width / controller.inputWidth : video.height / controller.inputHeight;
    const projectionDisplayHeight = (inputRatio > containerRatio ? height : width / inputRatio) * inputAdjust;
    camera.fov = 2 * Math.atan((1 / proj[5]) * height / projectionDisplayHeight) * 180 / Math.PI;
    camera.near = proj[14] / (proj[10] - 1);
    camera.far = proj[14] / (proj[10] + 1);
    camera.aspect = containerRatio;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  async function loop() {
    if (!running || disposed) return;
    try {
      if (video.readyState < 2) { frame = requestFrame(loop); return; }
      const input = controller.inputLoader.loadInput(video);
      frameTimeout = setTimeout(() => {
        if (!disposed) { dispose(); onError(Object.assign(new Error('Tracking worker timeout'), { userMessage: '识别处理暂时没有响应，相机已关闭。请重新尝试。' })); }
      }, 12000);
      try {
        if (trackedPose) {
          trackedPose = await controller._trackAndUpdate(input, trackedPose, TARGET_INDEX);
        } else {
          const result = await controller._detectAndMatch(input, [TARGET_INDEX]);
          trackedPose = result.targetIndex === TARGET_INDEX ? result.modelViewTransform : null;
        }
      } finally { clearTimeout(frameTimeout); frameTimeout = null; input.dispose(); }
      if (!running || disposed) return;
      if (trackedPose) {
        seenFrames++;
        if (seenFrames >= 5) {
          if (!lastTracking) { riseStart = performance.now(); poseFilter.reset(); }
          lastTracking = true;
          anchor.visible = true;
          let worldMatrix = poseFilter.filter(Date.now(), controller.getWorldMatrix(trackedPose, TARGET_INDEX));
          if (video.width === controller.inputHeight && video.height === controller.inputWidth) worldMatrix = controller.getRotatedZ90Matrix(worldMatrix);
          anchor.matrix.fromArray(worldMatrix).multiply(postMatrix);
          const t = reducedMotion ? 1 : Math.min((performance.now() - riseStart) / 1100, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          model.userData.setGrowth(ease);
          onTargetUpdate({ cardKey, targetIndex: TARGET_INDEX, tracked: true });
        }
      } else {
        seenFrames = 0; anchor.visible = false;
        if (lastTracking) onTargetUpdate({ cardKey, targetIndex: TARGET_INDEX, tracked: false });
        lastTracking = false;
      }
      renderer.render(scene, camera);
      frame = requestFrame(loop);
    } catch (error) {
      if (!disposed) { dispose(); onError(error); }
    }
  }

  try {
    const readBuffer = async (url) => {
      const response = await fetchAsset(url, { signal });
      if (!response.ok) throw new Error(`Asset request failed: ${response.status} ${url}`);
      return response.arrayBuffer();
    };
    const buffers = Promise.all([readBuffer(TARGET_SRC)]);
    // Attach a handler immediately: metadata/permission cancellation can win this race.
    buffers.catch(() => {});
    container.append(video);
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        video.removeEventListener('loadedmetadata', loaded);
        video.removeEventListener('error', failed);
        signal?.removeEventListener('abort', cancelled);
        error ? reject(error) : resolve();
      };
      const loaded = () => { if (video.videoWidth) finish(); };
      const failed = () => finish(new Error('Camera video failed'));
      const cancelled = () => finish(abortError());
      video.addEventListener('loadedmetadata', loaded);
      video.addEventListener('error', failed);
      signal?.addEventListener('abort', cancelled, { once: true });
      video.play().then(loaded).catch(finish);
      loaded();
    });
    if (disposed) throw abortError();
    video.width = video.videoWidth; video.height = video.videoHeight;
    const [targetBuffer] = await buffers;
    if (disposed) throw abortError();
    controller = new ImageTargetController({ inputWidth: video.videoWidth, inputHeight: video.videoHeight, maxTrack: 1 });
    const workerFailure = () => { if (!disposed) { dispose(); onError(new Error('Tracking worker failed')); } };
    controller.worker.onerror = workerFailure; controller.worker.onmessageerror = workerFailure;
    const { dimensions } = controller.addImageTargetsFromBuffer(targetBuffer);
    validateTargetDimensions(dimensions);
    const [markerWidth, markerHeight] = dimensions[TARGET_INDEX];
    postMatrix.compose(new THREE.Vector3(markerWidth / 2, markerHeight / 2, 0), new THREE.Quaternion(), new THREE.Vector3(markerWidth, markerWidth, markerWidth));
    // A distinct geometric model per selected card. The separate scheme B
    // metal relief belongs exclusively to the hero/card preview.
    model = createBloomFor(cardKey);
    model.userData.setGrowth(0);
    relief.add(model);
    renderer = createRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', zIndex: '1', pointerEvents: 'none' });
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.addEventListener('webglcontextlost', () => { if (!disposed) { dispose(); onError(new Error('WebGL context lost')); } });
    container.append(renderer.domElement);
    win.addEventListener('resize', resize);
    video.addEventListener('resize', resize);
    if (win.ResizeObserver) { resizeObserver = new win.ResizeObserver(resize); resizeObserver.observe(container); }
    resize();
    controller.dummyRun(video);
    return {
      async start() { if (disposed) throw abortError(); if (running) return; running = true; frame = requestFrame(loop); },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
