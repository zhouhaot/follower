import test from 'node:test';
import assert from 'node:assert/strict';
import { createScanController, initScan } from '../public/scan-controller.mjs';
import { IMAGE_TARGETS, imageTargetFor, validateTargetDimensions } from '../public/image-targets.mjs';
import { createImageTargetTracker } from '../public/image-target-tracker.mjs';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createCollectionStore, COLLECTION_KEY } from '../public/collection-store.mjs';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const evidence = { key: 'lotus', source: 'image-target', targetIndex: 3, stableMs: 1200, observationCount: 10, recognizedAt: '2026-10-13T08:00:00.000Z' };
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function harness(overrides = {}) {
  let cameraRequests = 0, stopped = 0, disposed = 0, saved = 0, time = 0, callbacks;
  const states = [], evidenceLog = [];
  const track = { stop: () => stopped++ };
  const stream = { getTracks: () => [track] };
  const controller = createScanController({
    card: { key: 'lotus', targetIndex: 3, scanSupported: true },
    isSecureContext: () => true,
    cameraAvailable: () => true,
    requestCamera: async () => { cameraRequests++; return stream; },
    createTracker: async (options) => { callbacks = options; return { start: async () => {}, dispose: () => disposed++ }; },
    saveRecognition: (data) => { saved++; evidenceLog.push(data); return { saved: true }; },
    onState: (state) => states.push(state), now: () => time,
    ...overrides,
  });
  return { controller, stream, states, evidenceLog, trackerOptions: () => callbacks, update: (data, at) => { time = at; callbacks.onTargetUpdate(data); }, error: (error) => callbacks.onError(error), counts: () => ({ cameraRequests, stopped, disposed, saved }) };
}

test('candidate collection ignores production and writes only isolated namespace', () => {
  const storage = memoryStorage({ flowers_speak_collection_v1: '["flowers","lotus"]' });
  const store = createCollectionStore({ getStorage: () => storage });
  assert.deepEqual(store.getCollection(), []);
  assert.equal(store.recordRecognition(evidence).saved, true);
  assert.equal(store.hasCollected('lotus'), true);
  assert.equal(storage.getItem('flowers_speak_collection_v1'), '["flowers","lotus"]');
  assert.equal(JSON.parse(storage.getItem(COLLECTION_KEY)).version, 1);
  assert.equal(store.recordRecognition(evidence).alreadyCollected, true);
  assert.equal(store.getCollection().length, 1);
});
test('preview, unknown card and insufficient tracking never collect', () => {
  const storage = memoryStorage();
  const store = createCollectionStore({ getStorage: () => storage });
  for (const patch of [{ source: 'preview' }, { key: 'unknown' }, { key: '__proto__' }, { key: 'peony' }, { targetIndex: 0 }, { stableMs: 1 }, { observationCount: 1 }]) {
    assert.equal(store.recordRecognition({ ...evidence, ...patch }).saved, false);
  }
  assert.deepEqual(store.getCollection(), []);
  assert.equal(storage.getItem(COLLECTION_KEY), null);
});
test('malformed and unsupported collection schema is safe', () => {
  const storage = memoryStorage();
  const store = createCollectionStore({ getStorage: () => storage });
  for (const raw of ['{', 'null', '[]', '{"version":99,"entries":[]}', '{"version":1,"entries":[null,{"key":"lotus","recognizedAt":"bad","method":"image-target","targetIndex":3}]}']) {
    storage.setItem(COLLECTION_KEY, raw); assert.deepEqual(store.getCollection(), []);
  }
});
test('blocked and silently failing storage does not claim saved', () => {
  const blocked = createCollectionStore({ getStorage() { throw new Error('Blocked'); } });
  assert.deepEqual(blocked.getCollection(), []);
  assert.equal(blocked.recordRecognition(evidence).reason, 'storage-unavailable');
  const noWrite = createCollectionStore({ getStorage: () => ({ getItem: () => null, setItem: () => {} }) });
  assert.equal(noWrite.recordRecognition(evidence).saved, false);
});
test('subscribers see one durable change and may unsubscribe', () => {
  const store = createCollectionStore({ getStorage: () => storage });
  const storage = memoryStorage();
  let called = 0;
  const unsubscribe = store.subscribeCollection((entries) => { called++; assert.equal(entries[0].key, 'lotus'); });
  store.recordRecognition(evidence); unsubscribe(); store.recordRecognition(evidence);
  assert.equal(called, 1);
});
test('initialization is camera opt-in and preview does not collect', () => {
  const h = harness();
  assert.equal(h.controller.getState().state, 'idle');
  assert.deepEqual(h.counts(), { cameraRequests: 0, stopped: 0, disposed: 0, saved: 0 });
  h.controller.cleanup();
});
test('security, support, and unavailable guards never request camera', async () => {
  for (const [overrides, expected] of [[{ isSecureContext: () => false }, 'insecure'], [{ cameraAvailable: () => false }, 'unsupported'], [{ graphicsAvailable: () => false }, 'unsupported'], [{ card: { key: 'unknown', targetIndex: 1, scanSupported: true } }, 'unavailable'], [{ card: { key: 'lotus', targetIndex: 0, scanSupported: true } }, 'unavailable'], [{ modelAvailable: () => false }, 'unavailable']]) {
    const h = harness(overrides); await h.controller.start();
    assert.equal(h.controller.getState().state, expected); assert.equal(h.counts().cameraRequests, 0); h.controller.cleanup();
  }
});
test('double start opens one camera; stop releases resources; retry works', async () => {
  const h = harness(); await Promise.all([h.controller.start(), h.controller.start()]);
  assert.equal(h.controller.getState().state, 'scanning'); assert.equal(h.counts().cameraRequests, 1);
  h.controller.stop(); assert.equal(h.counts().stopped, 1); assert.equal(h.counts().disposed, 1);
  await h.controller.start(); assert.equal(h.counts().cameraRequests, 2); h.controller.cleanup();
  assert.equal(h.counts().stopped, 2); assert.equal(h.counts().disposed, 2);
});
test('denied permission is explicit and retry recovers', async () => {
  let attempts = 0;
  const h = harness({ requestCamera: async () => { if (!attempts++) throw Object.assign(new Error('No'), { name: 'NotAllowedError' }); return { getTracks: () => [] }; } });
  await h.controller.start(); assert.equal(h.controller.getState().state, 'denied');
  await h.controller.start(); assert.equal(h.controller.getState().state, 'scanning'); h.controller.cleanup();
});
test('late permission after Back/cancel is closed without starting tracker', async () => {
  const pending = deferred();
  const h = harness({ requestCamera: () => pending.promise });
  const start = h.controller.start(); h.controller.stop(); pending.resolve(h.stream); await start;
  assert.equal(h.controller.getState().state, 'stopped'); assert.equal(h.counts().stopped, 1); assert.equal(h.counts().disposed, 0);
});
test('cancel while loading stops stream and disposes late tracker', async () => {
  const pending = deferred(); let lateDisposed = 0;
  const h = harness({ createTracker: () => pending.promise });
  const start = h.controller.start(); await Promise.resolve();
  assert.equal(h.controller.getState().state, 'loading'); h.controller.cleanup();
  pending.resolve({ start: async () => assert.fail('Must not start'), dispose: () => lateDisposed++ }); await start;
  assert.equal(h.counts().stopped, 1); assert.equal(lateDisposed, 1);
});
test('tracker/model load error closes camera and permits retry', async () => {
  const h = harness({ createTracker: async () => { throw new Error('Network failure'); } });
  await h.controller.start(); assert.equal(h.controller.getState().state, 'error'); assert.equal(h.counts().stopped, 1); h.controller.cleanup();
});
test('stable genuine lotus observations collect once; unknown targets never collect', async () => {
  const h = harness(); await h.controller.start();
  for (let i = 0; i < 20; i++) h.update({ targetIndex: 0, tracked: true }, i * 160);
  assert.equal(h.counts().saved, 0);
  for (let i = 0; i < 20; i++) h.update({ targetIndex: 3, tracked: true }, 5000 + i * 160);
  assert.equal(h.counts().saved, 1); assert.equal(h.controller.getState().state, 'collected'); h.controller.cleanup();
});
test('lost target and stale frame gaps reset recognition evidence', async () => {
  const h = harness(); await h.controller.start();
  for (let i = 0; i < 7; i++) h.update({ targetIndex: 3, tracked: true }, i * 160);
  h.update({ targetIndex: 3, tracked: false }, 1000);
  for (let i = 0; i < 7; i++) h.update({ targetIndex: 3, tracked: true }, 1100 + i * 160);
  assert.equal(h.counts().saved, 0);
  h.update({ targetIndex: 3, tracked: true }, 5000);
  assert.equal(h.counts().saved, 0); h.controller.cleanup();
});
test('no late callbacks after stop, and storage failure is disclosed', async () => {
  const h = harness({ saveRecognition: () => ({ saved: false }) }); await h.controller.start();
  for (let i = 0; i < 12; i++) h.update({ targetIndex: 3, tracked: true }, i * 160);
  assert.equal(h.controller.getState().state, 'recognized');
  assert.match(h.controller.getState().message, /未能保存/);
  h.update({ targetIndex: 3, tracked: false }, 2000);
  assert.match(h.controller.getState().message, /未能保存/);
  assert.doesNotMatch(h.controller.getState().message, /已完成的收集/);
  h.update({ targetIndex: 3, tracked: true }, 2200);
  assert.match(h.controller.getState().message, /未能保存/);
  h.controller.stop(); h.update({ targetIndex: 3, tracked: true }, 2500);
  assert.equal(h.controller.getState().state, 'stopped'); h.controller.cleanup();
});
test('startup timeout closes late camera and stale retry cannot alter new session', async () => {
  let timeout;
  const pending = deferred();
  const h = harness({ requestCamera: () => pending.promise, setTimer: (callback) => { timeout = callback; return 1; }, clearTimer: () => {} });
  const start = h.controller.start(); timeout(); assert.equal(h.controller.getState().state, 'error');
  pending.resolve(h.stream); await start; assert.equal(h.counts().stopped, 1); h.controller.cleanup();
});


test('page-hide stops while preserving restart bindings; permanent cleanup removes listeners', async () => {
  class Element extends EventTarget {
    hidden = false; disabled = false; dataset = {}; attrs = {}; textContent = ''; href = '';
    setAttribute(key, value) { this.attrs[key] = value; }
  }
  const ids = ['scan-stage', 'scan-status', 'start-scan', 'retry-scan', 'stop-scan', 'scan-back', 'scan-preview'];
  const nodes = Object.fromEntries(ids.map((id) => [id, new Element()]));
  const doc = new EventTarget(); doc.querySelector = (selector) => nodes[selector.slice(1)];
  doc.createElement = () => ({ getContext: () => ({ getExtension: () => ({ loseContext() {} }) }) });
  const win = new EventTarget();
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const oldSecure = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');
  let cameraCalls = 0;
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => { cameraCalls++; throw Object.assign(new Error('Denied'), { name: 'NotAllowedError' }); } } } });
  try {
    const controller = initScan({ card: { key: 'lotus', targetIndex: 3, scanSupported: true }, document: doc, window: win, returnURL: './work.html?card=lotus' });
    assert.equal(cameraCalls, 0); assert.equal(nodes['scan-back'].href, './work.html?card=lotus');
    win.dispatchEvent(new Event('pagehide'));
    assert.equal(controller.getState().state, 'stopped'); assert.equal(nodes['retry-scan'].hidden, false);
    nodes['retry-scan'].dispatchEvent(new Event('click')); await Promise.resolve(); await Promise.resolve();
    assert.equal(cameraCalls, 1); assert.equal(controller.getState().state, 'denied');
    nodes['scan-preview'].dispatchEvent(new Event('click')); assert.equal(controller.getState().state, 'stopped');
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(controller.getState().state, 'stopped');
    nodes['scan-back'].dispatchEvent(new Event('click')); assert.equal(controller.getState().state, 'stopped');
    controller.cleanup(); nodes['retry-scan'].dispatchEvent(new Event('click')); await Promise.resolve();
    assert.equal(cameraCalls, 1);
  } finally {
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else delete globalThis.navigator;
    if (oldSecure) Object.defineProperty(globalThis, 'isSecureContext', oldSecure); else delete globalThis.isSecureContext;
  }
});

test('camera track ending unexpectedly closes tracker and permits retry', async () => {
  const track = new EventTarget(); let stopped = 0; track.stop = () => stopped++;
  const h = harness({ requestCamera: async () => ({ getTracks: () => [track] }) });
  await h.controller.start(); track.dispatchEvent(new Event('ended'));
  assert.equal(h.controller.getState().state, 'error'); assert.equal(stopped, 1); assert.equal(h.counts().disposed, 1);
  h.controller.cleanup(); track.dispatchEvent(new Event('ended')); assert.equal(stopped, 1);
});

test('verified target metadata agrees with manifest and all five original PNGs', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/assets/originals/assets.json', import.meta.url)));
  const dimensions = manifest.ar.compiledTargets.map(({ width, height }) => [width, height]);
  assert.equal(validateTargetDimensions(dimensions), true);
  assert.deepEqual(manifest.ar.targetOrder, Object.keys(IMAGE_TARGETS));
  for (const target of Object.values(IMAGE_TARGETS)) {
    const card = manifest.cards.find(({ id }) => id === target.key);
    assert.equal(card.targetIndex, target.index);
    assert.deepEqual(card.targetAsset.dimensions, { width: target.width, height: target.height });
    const image = await readFile(new URL('../public' + card.targetAsset.localPath, import.meta.url));
    assert.equal(image.readUInt32BE(16), target.width);
    assert.equal(image.readUInt32BE(20), target.height);
  }
  for (const key of ['__proto__', 'constructor', 'unknown', undefined, null, {}]) assert.equal(imageTargetFor(key), null);
});

test('all target dimensions are checked even when the corrupted entry is another card', () => {
  const dimensions = Object.values(IMAGE_TARGETS).map(({ width, height }) => [width, height]);
  for (const { index } of Object.values(IMAGE_TARGETS)) {
    const corrupt = structuredClone(dimensions); corrupt[index][0]++;
    assert.throws(() => validateTargetDimensions(corrupt), /Unexpected image target dataset/);
  }
  assert.throws(() => validateTargetDimensions(dimensions.slice(1)), /dataset/);
  assert.throws(() => validateTargetDimensions([...dimensions].reverse()), /dataset/);
  assert.throws(() => validateTargetDimensions(null), /dataset/);
});

test('existing version-one lotus records survive adding the other four verified cards', () => {
  const original = { key: 'lotus', recognizedAt: evidence.recognizedAt, method: 'image-target', targetIndex: 3 };
  const readKeys = [], writtenKeys = [];
  const storage = memoryStorage({ [COLLECTION_KEY]: JSON.stringify({ version: 1, entries: [original] }), flowers_speak_collection_v1: '["flowers","lotus"]' });
  const observed = { getItem(key) { readKeys.push(key); return storage.getItem(key); }, setItem(key, value) { writtenKeys.push(key); storage.setItem(key, value); } };
  const store = createCollectionStore({ getStorage: () => observed });
  for (const { key, index } of Object.values(IMAGE_TARGETS)) assert.equal(store.recordRecognition({ ...evidence, key, targetIndex: index }).saved, true);
  assert.equal(store.getCollection().length, 5);
  assert.deepEqual(store.getCollection()[0], original);
  assert.deepEqual([...new Set([...readKeys, ...writtenKeys])], [COLLECTION_KEY]);
  assert.equal(storage.getItem('flowers_speak_collection_v1'), '["flowers","lotus"]');
  assert.equal(JSON.parse(storage.getItem(COLLECTION_KEY)).version, 1);
});

test('all twenty cross-card evidence mismatches are refused without a storage write', () => {
  const storage = memoryStorage();
  const store = createCollectionStore({ getStorage: () => storage });
  for (const card of Object.values(IMAGE_TARGETS)) for (const other of Object.values(IMAGE_TARGETS)) {
    if (card.key === other.key) continue;
    assert.equal(store.recordRecognition({ ...evidence, key: card.key, targetIndex: other.index }).saved, false);
  }
  assert.equal(storage.getItem(COLLECTION_KEY), null);
});

test('stored records reject cross-card target indices and preview methods while preserving valid entries', () => {
  for (const card of Object.values(IMAGE_TARGETS)) {
    const valid = { key: card.key, recognizedAt: evidence.recognizedAt, method: 'image-target', targetIndex: card.index };
    const invalid = Object.values(IMAGE_TARGETS).filter(({ key }) => key !== card.key).map(({ key }) => ({ ...valid, key }));
    const storage = memoryStorage({ [COLLECTION_KEY]: JSON.stringify({ version: 1, entries: [valid, ...invalid] }) });
    const store = createCollectionStore({ getStorage: () => storage });
    assert.deepEqual(store.getCollection(), [valid]);
    storage.setItem(COLLECTION_KEY, JSON.stringify({ version: 1, entries: [{ ...valid, method: 'preview' }] }));
    assert.deepEqual(store.getCollection(), []);
  }
});

test('every selected card binds its own tracker and records only its own stable evidence', async () => {
  for (const { key, index, title } of Object.values(IMAGE_TARGETS)) {
    const h = harness({ card: { key, targetIndex: index, scanSupported: true } });
    assert.equal(h.controller.getState().state, 'idle');
    assert.match(h.controller.getState().message, new RegExp(title));
    await h.controller.start();
    assert.equal(h.trackerOptions().cardKey, key);
    for (const other of Object.values(IMAGE_TARGETS)) if (other.key !== key) {
      for (let i = 0; i < 12; i++) h.update({ cardKey: other.key, targetIndex: other.index, tracked: true }, i * 160);
    }
    assert.equal(h.counts().saved, 0);
    for (let i = 0; i < 12; i++) h.update({ cardKey: key, targetIndex: index, tracked: true }, 5000 + i * 160);
    assert.equal(h.counts().saved, 1);
    assert.equal(h.evidenceLog[0].key, key); assert.equal(h.evidenceLog[0].targetIndex, index);
    assert.match(h.controller.getState().message, new RegExp(title));
    h.controller.cleanup();
  }
});

test('wrong-card events interrupt pending evidence; non-boolean tracking and invalid times do not collect', async () => {
  const h = harness(); await h.controller.start();
  for (let i = 0; i < 7; i++) h.update({ targetIndex: 3, tracked: true }, i * 160);
  h.update({ targetIndex: 1, tracked: true }, 1000);
  for (let i = 0; i < 7; i++) h.update({ targetIndex: 3, tracked: true }, 1100 + i * 160);
  assert.equal(h.counts().saved, 0);
  h.update({ cardKey: 'peony', targetIndex: 3, tracked: true }, 2200);
  for (let i = 0; i < 20; i++) h.update({ targetIndex: 3, tracked: 'true' }, 2300 + i * 160);
  assert.equal(h.counts().saved, 0);
  for (const at of [NaN, Infinity, -Infinity]) h.update({ targetIndex: 3, tracked: true }, at);
  assert.equal(h.counts().saved, 0); h.controller.cleanup();
});

/** These constructor tests use a deterministic runtime/renderer, not a real GPU
 * or image matcher. They verify integration wiring, the actual model factory,
 * selected-index restrictions, dimension rejection and cleanup ownership. */
function trackerHarness({ dimensions = Object.values(IMAGE_TARGETS).map(({ width, height }) => [width, height]), rendererFailure = false, matchedIndex } = {}) {
  const stats = { videos: 0, renderers: 0, disposed: 0, workers: 0, dummy: 0, tensors: 0, stops: 0, detected: [], tracked: [], world: [], events: [], errors: [], models: [] };
  const children = new Set(); let frameCallback = null, controller;
  class Element extends EventTarget {
    style = {}; attrs = {}; videoWidth = 640; videoHeight = 960; readyState = 2;
    setAttribute(key, value) { this.attrs[key] = value; }
    play() { return Promise.resolve(); }
    pause() { stats.stops++; }
    remove() { children.delete(this); }
  }
  const video = new Element(), canvas = new Element();
  const doc = { createElement(kind) { assert.equal(kind, 'video'); stats.videos++; return video; } };
  const win = new EventTarget(); win.matchMedia = () => ({ matches: true });
  win.devicePixelRatio = 1;
  class ImageTargetController {
    constructor(options) {
      controller = this; Object.assign(this, options);
      this.worker = { terminate: () => stats.workers++ };
      this.inputLoader = { loadInput: () => ({ dispose: () => stats.tensors++ }) };
    }
    addImageTargetsFromBuffer(buffer) { assert.equal(buffer.byteLength, 1); return { dimensions }; }
    getProjectionMatrix() { return new THREE.PerspectiveCamera().projectionMatrix.elements; }
    dummyRun() { stats.dummy++; }
    stopProcessVideo() {}
    async _detectAndMatch(input, indices) { stats.detected.push(indices); return { targetIndex: matchedIndex ?? indices[0], modelViewTransform: [] }; }
    async _trackAndUpdate(input, pose, index) { stats.tracked.push(index); return pose; }
    getWorldMatrix(pose, index) { stats.world.push(index); return new THREE.Matrix4().elements; }
  }
  class OneEuroFilter { reset() {} filter(time, matrix) { return matrix; } }
  const options = {
    container: { clientWidth: 400, clientHeight: 600, append: (node) => children.add(node) },
    stream: { getTracks: () => [] }, document: doc, window: win,
    runtime: { ImageTargetController, OneEuroFilter },
    fetchAsset: async (url, { signal }) => { assert.match(url, /assets\/originals\/five-flowers\.mind$/); return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }; },
    requestFrame: (callback) => { frameCallback = callback; return 1; }, cancelFrame: () => { frameCallback = null; },
    createRenderer: () => {
      stats.renderers++; if (rendererFailure) throw new Error('WebGL disabled fixture');
      return { domElement: canvas, setPixelRatio() {}, setClearColor() {}, setSize() {}, setAnimationLoop() {}, forceContextLoss() {}, dispose() { stats.disposed++; }, render(scene) { const model = scene.children[0].children[0].children[0]; if (!stats.models.includes(model)) stats.models.push(model); } };
    },
    onTargetUpdate: (event) => stats.events.push(event), onError: (error) => stats.errors.push(error),
  };
  return { options, stats, children, video, canvas, getController: () => controller, tick: async () => { const callback = frameCallback; frameCallback = null; assert.ok(callback); await callback(); } };
}

test('real geometric model constructors integrate with the selected target for all five cards', async () => {
  for (const { key, index } of Object.values(IMAGE_TARGETS)) {
    const h = trackerHarness(); const tracker = await createImageTargetTracker({ ...h.options, cardKey: key });
    assert.equal(h.children.size, 2); assert.equal(h.stats.events.length, 0);
    await tracker.start(); for (let i = 0; i < 6; i++) await h.tick();
    assert.deepEqual(h.stats.detected, [[index]]);
    assert.ok(h.stats.tracked.every((value) => value === index));
    assert.ok(h.stats.events.length >= 1); assert.ok(h.stats.events.every((event) => event.cardKey === key && event.targetIndex === index));
    assert.equal(h.stats.models.length, 1); assert.equal(h.stats.models[0].isGroup, true);
    assert.equal(h.stats.models[0].userData.cardKey, key);
    assert.equal(typeof h.stats.models[0].userData.setGrowth, 'function');
    assert.equal(typeof h.stats.models[0].userData.dispose, 'function');
    let geometryDisposals = 0;
    h.stats.models[0].traverse((node) => { if (node.isMesh) node.geometry.addEventListener('dispose', () => geometryDisposals++); });
    tracker.dispose(); tracker.dispose();
    assert.ok(geometryDisposals > 0);
    assert.equal(h.children.size, 0); assert.equal(h.video.srcObject, null); assert.equal(h.stats.workers, 1); assert.equal(h.stats.disposed, 1);
    assert.equal(h.stats.tensors, 6);
    await assert.rejects(() => tracker.start(), { name: 'AbortError' });
  }
});

test('tracker rejects an unexpected matcher index for every selected card', async () => {
  for (const { key, index } of Object.values(IMAGE_TARGETS)) {
    const h = trackerHarness({ matchedIndex: (index + 1) % 5 });
    const tracker = await createImageTargetTracker({ ...h.options, cardKey: key });
    await tracker.start(); for (let i = 0; i < 9; i++) await h.tick();
    assert.equal(h.stats.events.length, 0); assert.equal(h.stats.tracked.length, 0);
    assert.ok(h.stats.detected.every((indices) => indices.length === 1 && indices[0] === index));
    tracker.dispose();
  }
});

test('constructor rejects every corrupted target dimension and disposes before rendering', async () => {
  for (const target of Object.values(IMAGE_TARGETS)) {
    const dimensions = Object.values(IMAGE_TARGETS).map(({ width, height }) => [width, height]); dimensions[target.index][1]++;
    const h = trackerHarness({ dimensions });
    await assert.rejects(() => createImageTargetTracker({ ...h.options, cardKey: 'lotus' }), /Unexpected image target dataset/);
    assert.equal(h.stats.renderers, 0); assert.equal(h.stats.workers, 1); assert.equal(h.children.size, 0); assert.equal(h.video.srcObject, null);
  }
});

test('unsupported cards and already-aborted startup cannot create tracking resources', async () => {
  const h = trackerHarness();
  for (const key of ['unknown', '__proto__', undefined]) await assert.rejects(() => createImageTargetTracker({ ...h.options, cardKey: key }), /no geometric scan model/);
  const signal = AbortSignal.abort();
  await assert.rejects(() => createImageTargetTracker({ ...h.options, cardKey: 'lotus', signal }), { name: 'AbortError' });
  assert.equal(h.stats.videos, 0); assert.equal(h.stats.renderers, 0);
});

test('renderer failure, context loss and cancellation dispose constructor-owned resources', async () => {
  const failed = trackerHarness({ rendererFailure: true });
  await assert.rejects(() => createImageTargetTracker({ ...failed.options, cardKey: 'lotus' }), /WebGL disabled/);
  assert.equal(failed.children.size, 0); assert.equal(failed.stats.workers, 1); assert.equal(failed.video.srcObject, null);
  const h = trackerHarness(), abort = new AbortController();
  const tracker = await createImageTargetTracker({ ...h.options, cardKey: 'lotus', signal: abort.signal });
  await tracker.start(); h.canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(h.stats.errors.length, 1); assert.equal(h.children.size, 0); assert.equal(h.stats.workers, 1);
  abort.abort(); tracker.dispose(); assert.equal(h.stats.workers, 1);
  const cancelled = trackerHarness(), abort2 = new AbortController();
  const tracker2 = await createImageTargetTracker({ ...cancelled.options, cardKey: 'peony', signal: abort2.signal });
  abort2.abort(); assert.equal(cancelled.children.size, 0); assert.equal(cancelled.stats.workers, 1);
  await assert.rejects(() => tracker2.start(), { name: 'AbortError' });
});

test('stale callbacks cannot collect or fail a new scan after retry', async () => {
  const h = harness(); await h.controller.start(); const old = h.trackerOptions();
  h.controller.stop(); await h.controller.start();
  for (let i = 0; i < 12; i++) old.onTargetUpdate({ targetIndex: 3, tracked: true });
  old.onError(new Error('Old worker failed'));
  assert.equal(h.counts().saved, 0); assert.equal(h.controller.getState().state, 'scanning');
  for (let i = 0; i < 12; i++) h.update({ targetIndex: 3, tracked: true }, i * 160);
  assert.equal(h.counts().saved, 1); h.controller.cleanup();
});

test('a thrown storage writer is disclosed without interrupting viewing or claiming persistence', async () => {
  const h = harness({ saveRecognition: () => { throw new Error('Storage failure'); } }); await h.controller.start();
  for (let i = 0; i < 12; i++) h.update({ targetIndex: 3, tracked: true }, i * 160);
  assert.equal(h.controller.getState().state, 'recognized'); assert.match(h.controller.getState().message, /未能保存/);
  assert.equal(h.counts().stopped, 0); h.controller.cleanup();
});
