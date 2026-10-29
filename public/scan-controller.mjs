import { recordEncounter, MIN_RECOGNITION_MS } from './collection-store-v2.mjs';
import { imageTargetFor } from './image-targets.mjs';
import { bloomAvailable } from './bloom-registry.mjs';

const ACTIVE = new Set(['requesting', 'loading', 'scanning', 'tracking', 'collected', 'recognized']);
const copyFor = (title) => ({
  idle: `点击「开启相机」后，浏览器才会请求相机权限。将${title}花卡完整放入画面。`,
  unavailable: '这张花卡的立体扫描体验尚未接入。你仍可查看花卡详情；预览不会计入图鉴。',
  insecure: '相机需要 HTTPS 安全连接。请使用安全链接打开此页，或先查看无需相机的预览。',
  unsupported: '当前浏览器无法使用相机。请用新版 Safari 或 Chrome 打开，或查看预览。',
  requesting: '请在浏览器提示中允许使用相机。不会录音，也不会上传相机画面。',
  loading: `相机已开启，正在加载${title}识别与立体模型…`,
  scanning: `将${title}花卡完整放入画面，保持平稳并避免反光。识别成功后，对应的立体花卉会从卡面升起。`,
  tracking: `已找到${title}纹样，请保持平稳，正在确认识别…`,
  collected: `${title}识别成功，已记入花册的扫描相遇。移动花卡，查看对应的三维花卉。`,
  recognized: `${title}识别成功，但浏览器未能保存相遇记录。`,
  denied: '相机权限未开启。请在浏览器的网站设置中允许相机，然后重试；也可以先查看预览。',
  error: '相机或识别暂时未能启动。请检查网络与相机占用后重试，或先查看预览。',
  stopped: '相机已关闭。点击「重新扫描」可再次开启。',
});

export function stopStream(stream) {
  for (const track of stream?.getTracks?.() ?? []) { try { track.stop(); } catch {} }
}

function cameraErrorState(error) {
  return error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError' || error?.name === 'SecurityError' ? 'denied' : 'error';
}

/** Testable state machine. Only start() initiates a camera request. */
export function createScanController({
  card,
  isSecureContext = () => globalThis.isSecureContext === true,
  cameraAvailable = () => Boolean(globalThis.navigator?.mediaDevices?.getUserMedia),
  graphicsAvailable = () => true,
  modelAvailable = bloomAvailable,
  requestCamera = () => globalThis.navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }),
  createTracker,
  saveRecognition = recordEncounter,
  onState = () => {},
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  startupTimeoutMs = 45000,
} = {}) {
  let state = 'idle';
  let detail = '';
  let epoch = 0;
  let stream = null;
  let tracker = null;
  let abort = null;
  let timer = null;
  let firstSeen = null;
  let lastSeen = null;
  let observations = 0;
  let recognitionRecorded = false;
  let recognitionMessage = '';
  let recognitionState = 'collected';
  let removeTrackListeners = () => {};
  let disposed = false;
  const target = imageTargetFor(card?.key);
  const title = target?.title || '所选花卡';
  const COPY = copyFor(title);
  const supported = Boolean(target && card?.targetIndex === target.index && card?.scanSupported === true && modelAvailable(card.key));
  function transition(next, message = '') {
    state = next; detail = message;
    onState({ state, message: message || COPY[state], active: ACTIVE.has(state) });
  }
  function resetEvidence() { firstSeen = null; lastSeen = null; observations = 0; }
  function release() {
    clearTimer(timer); timer = null;
    abort?.abort(); abort = null;
    try { tracker?.dispose?.(); } catch {}
    tracker = null;
    removeTrackListeners(); removeTrackListeners = () => {};
    stopStream(stream); stream = null;
    resetEvidence();
  }
  function cancel(next = 'stopped', message = '') { epoch++; release(); transition(next, message); }
  function targetUpdate(data, token) {
    if (disposed || token !== epoch || !ACTIVE.has(state) || state === 'requesting' || state === 'loading') return;
    if (data?.targetIndex !== target.index || (data.cardKey != null && data.cardKey !== target.key)) {
      resetEvidence();
      if (state === 'tracking') transition('scanning');
      return;
    }
    if (data.tracked !== true) {
      resetEvidence();
      transition('scanning', recognitionRecorded
        ? (recognitionState === 'collected' ? `花卡暂时离开画面。已记录的相遇会保留；重新对准${title}花卡即可继续观看。` : `花卡暂时离开画面。浏览器未能保存相遇记录；重新对准${title}花卡即可继续观看。`)
        : `花卡暂时离开画面，请重新对准${title}纹样。`);
      return;
    }
    const time = now();
    if (!Number.isFinite(time)) { resetEvidence(); return; }
    if (firstSeen === null || time < lastSeen || time - lastSeen > 650) { firstSeen = time; observations = 0; }
    lastSeen = time; observations++;
    if (recognitionRecorded) { if (state !== recognitionState) transition(recognitionState, recognitionMessage); return; }
    if (state !== 'tracking') transition('tracking');
    if (time - firstSeen < MIN_RECOGNITION_MS || observations < 8) return;
    let result;
    try { result = saveRecognition({ key: target.key, source: 'image-target', targetIndex: target.index, stableMs: time - firstSeen, observationCount: observations }); } catch { result = { saved: false }; }
    recognitionRecorded = true;
    recognitionState = result?.saved ? 'collected' : 'recognized';
    recognitionMessage = result?.saved ? COPY.collected : `${title}识别成功，对应的三维花卉已显示。浏览器未能保存相遇记录；此页面中的预览不会补记收集。`;
    transition(recognitionState, recognitionMessage);
  }
  async function start() {
    if (disposed || ACTIVE.has(state)) return;
    if (!supported) { transition('unavailable'); return; }
    if (!isSecureContext()) { transition('insecure'); return; }
    if (!cameraAvailable()) { transition('unsupported'); return; }
    if (!graphicsAvailable()) { transition('unsupported', '设备的三维显示暂不可用，无法开启识别。请检查浏览器的硬件加速设置，或先查看花卡预览。'); return; }
    const token = ++epoch;
    recognitionRecorded = false;
    resetEvidence();
    abort = new AbortController();
    const signal = abort.signal;
    transition('requesting');
    timer = setTimer(() => {
      if (token === epoch) cancel('error', '启动等待时间较长，相机已关闭。检查浏览器权限与网络后重试。');
    }, startupTimeoutMs);
    try {
      const acquired = await requestCamera();
      if (disposed || token !== epoch) { stopStream(acquired); return; }
      stream = acquired;
      const ended = () => { if (token === epoch && !disposed) cancel('error', '相机连接已中断。请检查相机权限后重试。'); };
      const tracks = stream?.getTracks?.() ?? [];
      tracks.forEach((track) => track.addEventListener?.('ended', ended));
      removeTrackListeners = () => tracks.forEach((track) => track.removeEventListener?.('ended', ended));
      transition('loading');
      const prepared = await createTracker({ cardKey: target.key, stream, signal, onTargetUpdate: (data) => targetUpdate(data, token), onError: (error) => {
        if (token === epoch && !disposed) cancel('error', error?.userMessage || COPY.error);
      } });
      if (disposed || token !== epoch) { prepared?.dispose?.(); return; }
      tracker = prepared;
      await tracker.start();
      if (disposed || token !== epoch) { prepared?.dispose?.(); return; }
      clearTimer(timer); timer = null;
      transition('scanning');
    } catch (error) {
      if (disposed || token !== epoch) return;
      cancel(cameraErrorState(error), error?.userMessage || '');
    }
  }
  if (!supported) transition('unavailable');
  else if (!isSecureContext()) transition('insecure');
  else if (!cameraAvailable()) transition('unsupported');
  else if (!graphicsAvailable()) transition('unsupported', '设备的三维显示暂不可用，无法开启识别。请检查浏览器的硬件加速设置，或先查看花卡预览。');
  else transition('idle');
  return {
    start,
    stop: () => { if (!disposed && !['unavailable', 'insecure', 'unsupported'].includes(state)) cancel('stopped'); },
    cleanup: () => { if (disposed) return; disposed = true; epoch++; release(); },
    getState: () => ({ state, message: detail || COPY[state], active: ACTIVE.has(state) }),
  };
}

/** Bind a single scan page, with opt-in camera and disposal on every exit path. */
export function initScan({ card, returnURL = './collection.html', document: doc = globalThis.document, window: win = globalThis.window } = {}) {
  const stage = doc.querySelector('#scan-stage');
  const status = doc.querySelector('#scan-status');
  const start = doc.querySelector('#start-scan');
  const retry = doc.querySelector('#retry-scan');
  const stop = doc.querySelector('#stop-scan');
  const back = doc.querySelector('#scan-back');
  const preview = doc.querySelector('#scan-preview');
  if (!stage || !status) throw new Error('Scan page is missing scan-stage or scan-status');
  if (back) back.href = returnURL;
  let graphicsReady;
  const graphicsAvailable = () => {
    if (graphicsReady !== undefined) return graphicsReady;
    try {
      const canvas = doc.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      graphicsReady = Boolean(gl);
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { graphicsReady = false; }
    return graphicsReady;
  };
  const controller = createScanController({
    card,
    graphicsAvailable,
    async createTracker(options) {
      const { createImageTargetTracker } = await import('./image-target-tracker.mjs');
      return createImageTargetTracker({ ...options, container: stage });
    },
    onState({ state, message, active }) {
      status.textContent = message;
      const placeholder = stage.querySelector?.('.scan-placeholder');
      if (placeholder) {
        placeholder.style.visibility = active ? 'hidden' : 'visible';
        const caption = placeholder.querySelector('span');
        if (caption) caption.textContent = ({ idle: '等待你开启相机', stopped: '相机已关闭', unavailable: '此款三维扫描尚未开放', unsupported: '设备暂不支持此扫描体验', insecure: '请使用安全连接', denied: '相机权限尚未开启', error: '请检查后重新尝试' })[state] || '';
      }
      stage.dataset.scanState = state;
      stage.setAttribute('aria-busy', String(state === 'requesting' || state === 'loading'));
      if (start) { start.hidden = state !== 'idle'; start.disabled = active; }
      if (retry) { retry.hidden = !['denied', 'error', 'stopped'].includes(state); retry.disabled = active; }
      if (stop) stop.hidden = !active;
    },
  });
  const listeners = [];
  const listen = (target, event, callback) => { target?.addEventListener(event, callback); listeners.push(() => target?.removeEventListener(event, callback)); };
  listen(start, 'click', () => controller.start());
  listen(retry, 'click', () => controller.start());
  listen(stop, 'click', () => controller.stop());
  // Do not prevent navigation: native links and browser history remain usable without JS.
  listen(back, 'click', () => controller.stop());
  listen(preview, 'click', () => controller.stop());
  listen(win, 'pagehide', () => controller.stop());
  listen(doc, 'visibilitychange', () => { if (doc.visibilityState === 'hidden') controller.stop(); });
  const cleanup = () => { listeners.splice(0).forEach((remove) => remove()); controller.cleanup(); };
  return { ...controller, cleanup };
}
