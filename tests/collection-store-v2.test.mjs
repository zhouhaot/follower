import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionStoreV2, COLLECTION_KEY, RECOVERY_KEY } from '../public/collection-store-v2.mjs';

function createMockStorage(initialData = {}) {
  const data = new Map(Object.entries(initialData));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear()
  };
}

test('v1 to v2 migration preserves legacy data', () => {
  const v1Data = JSON.stringify({
    version: 1,
    entries: [
      { key: 'lotus', recognizedAt: '2026-10-14T10:00:00.000Z', method: 'image-target', targetIndex: 3 },
      { key: 'peony', recognizedAt: '2026-10-14T11:00:00.000Z', method: 'image-target', targetIndex: 1 }
    ]
  });

  const storage = createMockStorage({ 'flowers-speak:cloud-candidate:collection:v1': v1Data });
  const store = createCollectionStoreV2({
    getStorage: () => storage,
    eventTarget: null
  });

  const data = store.getData();
  assert.equal(data.version, 2);
  assert.equal(data.collections.length, 2);
  assert.equal(data.encounters.length, 2);
  assert.equal(data.recentViews.length, 0);

  // 验证收藏标记为 legacy
  assert.equal(data.collections[0].source, 'legacy');
  assert.equal(data.collections[0].key, 'lotus');
  assert.equal(data.collections[0].collectedAt, '2026-10-14T10:00:00.000Z');

  // 验证相遇标记为 camera
  assert.equal(data.encounters[0].source, 'camera');
  assert.equal(data.encounters[0].key, 'lotus');
});

test('v2 migration is idempotent', () => {
  const v1Data = JSON.stringify({
    version: 1,
    entries: [{ key: 'lotus', recognizedAt: '2026-10-14T10:00:00.000Z', method: 'image-target', targetIndex: 3 }]
  });

  const storage = createMockStorage({ 'flowers-speak:cloud-candidate:collection:v1': v1Data });
  const store1 = createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });
  const data1 = store1.getData();

  // 第二次迁移应该读取已保存的 v2 数据
  const store2 = createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });
  const data2 = store2.getData();

  assert.deepEqual(data1, data2);
});

test('manual collection does not create duplicate', () => {
  const storage = createMockStorage();
  const store = createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });

  const result1 = store.addCollection({ key: 'lotus' });
  assert.equal(result1.saved, true);
  assert.equal(result1.alreadyCollected, false);

  const result2 = store.addCollection({ key: 'lotus' });
  assert.equal(result2.saved, true);
  assert.equal(result2.alreadyCollected, true);

  const data = store.getData();
  assert.equal(data.collections.length, 1);
  assert.equal(data.collections[0].source, 'manual');
});

test('encounter recording does not auto-collect', () => {
  const storage = createMockStorage();
  const store = createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });

  const result = store.recordEncounter({
    key: 'lotus',
    targetIndex: 3,
    stableMs: 1500,
    observationCount: 10
  });

  assert.equal(result.saved, true);
  assert.equal(result.alreadyRecorded, false);

  const data = store.getData();
  assert.equal(data.encounters.length, 1);
  assert.equal(data.collections.length, 0); // 没有自动收藏
});

test('remove collection keeps encounters and views', () => {
  const storage = createMockStorage();
  const store = createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });

  store.addCollection({ key: 'lotus' });
  store.recordEncounter({ key: 'lotus', targetIndex: 3, stableMs: 1500, observationCount: 10 });
  store.recordView({ key: 'lotus', source: 'detail' });

  const result = store.removeCollection('lotus');
  assert.equal(result.saved, true);

  const data = store.getData();
  assert.equal(data.collections.length, 0);
  assert.equal(data.encounters.length, 1); // 保留
  assert.equal(data.recentViews.length, 1); // 保留
});

test('recent views limited to 10 entries', () => {
  const storage = createMockStorage();
  const store = createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });

  const keys = ['lotus', 'peony', 'chrysanthemum', 'flowers', 'leaves'];
  // 记录每朵花2次以上，总共超过10次浏览
  for (let i = 0; i < 15; i++) {
    store.recordView({ key: keys[i % 5], source: 'detail' });
  }

  const data = store.getData();
  // 因为 recordView 会去重同 key，最终只有5条（每朵花最后一次浏览）
  assert.equal(data.recentViews.length, 5);
});

test('recent views stores up to 10 different manual entries', () => {
  const storage = createMockStorage();
  const store = createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });

  const keys = ['lotus', 'peony', 'chrysanthemum', 'flowers', 'leaves'];
  // 第一轮：记录5朵花
  for (let i = 0; i < 5; i++) {
    store.recordView({ key: keys[i], source: 'detail' });
  }
  // 第二轮：再记录5次（不同source）
  for (let i = 0; i < 5; i++) {
    store.recordView({ key: keys[i], source: 'catalogue' });
  }

  const data = store.getData();
  // 因为同 key 会被更新到最前面，最终还是5条
  assert.equal(data.recentViews.length, 5);
});

test('recent view updates existing entry to front', () => {
  const storage = createMockStorage();
  const store = createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });

  store.recordView({ key: 'lotus', source: 'detail' });
  store.recordView({ key: 'peony', source: 'detail' });
  store.recordView({ key: 'lotus', source: 'catalogue' });

  const data = store.getData();
  assert.equal(data.recentViews.length, 2);
  assert.equal(data.recentViews[0].key, 'lotus');
  assert.equal(data.recentViews[0].source, 'catalogue');
  assert.equal(data.recentViews[1].key, 'peony');
});

test('weak recognition evidence is rejected', () => {
  const storage = createMockStorage();
  const store = createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });

  const result1 = store.recordEncounter({ key: 'lotus', targetIndex: 3, stableMs: 500, observationCount: 10 });
  assert.equal(result1.saved, false);
  assert.equal(result1.reason, 'unverified-recognition');

  const result2 = store.recordEncounter({ key: 'lotus', targetIndex: 3, stableMs: 1500, observationCount: 3 });
  assert.equal(result2.saved, false);
  assert.equal(result2.reason, 'unverified-recognition');

  const data = store.getData();
  assert.equal(data.encounters.length, 0);
});

test('collection with note preserves note text', () => {
  const storage = createMockStorage();
  const store = createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });

  const result = store.addCollection({ key: 'lotus', note: '在植物园看到的' });
  assert.equal(result.saved, true);

  const data = store.getData();
  assert.equal(data.collections[0].note, '在植物园看到的');
});

const LEGACY_KEY = 'flowers-speak:cloud-candidate:collection:v1';
const legacyRaw = JSON.stringify({ version: 1, entries: [
  { key: 'lotus', recognizedAt: '2026-10-14T10:00:00.000Z', method: 'image-target', targetIndex: 3 }
] });
const emptyRaw = JSON.stringify({ version: 2, catalogueVersion: 'five-flowers-20260913', collections: [], encounters: [], recentViews: [] });
const makeStore = storage => createCollectionStoreV2({ getStorage: () => storage, eventTarget: null });

test('corrupt v2 offers read-only legacy history without overwriting either source', () => {
  const storage = createMockStorage({ [LEGACY_KEY]: legacyRaw, [COLLECTION_KEY]: '{broken' });
  const store = makeStore(storage);
  assert.equal(store.getData().collections[0].source, 'legacy');
  assert.equal(store.getStatus().kind, 'legacy-preview');
  assert.equal(store.isStorageAvailable(), false);
  for (const result of [store.addCollection({ key: 'peony' }), store.removeCollection('lotus'),
    store.recordView({ key: 'peony' }), store.recordEncounter({ key: 'peony', targetIndex: 1, stableMs: 1500, observationCount: 10 })]) {
    assert.deepEqual(result, { saved: false, reason: 'recovery-required' });
  }
  assert.equal(storage.getItem(COLLECTION_KEY), '{broken');
  assert.equal(storage.getItem(LEGACY_KEY), legacyRaw);
});

test('explicit recovery verifies an exact backup and retains v1 before enabling writes', () => {
  const storage = createMockStorage({ [LEGACY_KEY]: legacyRaw, [COLLECTION_KEY]: '{broken' });
  const store = makeStore(storage);
  assert.deepEqual(store.recoverLegacy(), { saved: true });
  assert.equal(storage.getItem(RECOVERY_KEY), '{broken');
  assert.equal(storage.getItem(LEGACY_KEY), legacyRaw);
  assert.equal(store.getData().collections[0].key, 'lotus');
  assert.equal(store.getStatus().kind, 'ready');
  assert.equal(store.addCollection({ key: 'peony' }).saved, true);
  assert.equal(store.getCollections().length, 2);
});

test('invalid data without valid legacy stays unavailable instead of pretending to be empty', () => {
  for (const raw of ['{broken', '', 'null']) {
    const storage = createMockStorage({ [COLLECTION_KEY]: raw, [LEGACY_KEY]: '{invalid' });
    const store = makeStore(storage);
    assert.equal(store.getData(), null);
    assert.equal(store.getStatus().kind, 'error');
    assert.equal(store.getStatus().recoverable, false);
    assert.equal(store.addCollection({ key: 'lotus' }).saved, false);
    assert.equal(storage.getItem(COLLECTION_KEY), raw);
  }
});

test('unsupported versions and mismatched catalogues never downgrade to legacy', () => {
  for (const raw of [JSON.stringify({ ...JSON.parse(emptyRaw), version: 99 }),
    JSON.stringify({ ...JSON.parse(emptyRaw), catalogueVersion: 'future-catalogue' })]) {
    const storage = createMockStorage({ [COLLECTION_KEY]: raw, [LEGACY_KEY]: legacyRaw });
    const store = makeStore(storage);
    assert.equal(store.getData(), null);
    assert.equal(store.recoverLegacy().saved, false);
    assert.equal(storage.getItem(COLLECTION_KEY), raw);
    assert.equal(storage.getItem(RECOVERY_KEY), null);
  }
});

test('storage access denied returns an error state without throwing', () => {
  const store = createCollectionStoreV2({ getStorage() { throw new Error('denied'); }, eventTarget: null });
  assert.equal(store.getData(), null);
  assert.deepEqual(store.getStatus(), { kind: 'error', code: 'storage-unavailable', recoverable: false });
  assert.equal(store.addCollection({ key: 'lotus' }).saved, false);
});

test('silent write failure cannot claim a successful collection', () => {
  const storage = createMockStorage({ [COLLECTION_KEY]: emptyRaw });
  storage.setItem = () => {};
  const store = makeStore(storage);
  assert.deepEqual(store.addCollection({ key: 'lotus' }), { saved: false, reason: 'storage-unavailable' });
  assert.equal(storage.getItem(COLLECTION_KEY), emptyRaw);
  assert.deepEqual(store.getCollections(), []);
});

test('quota errors preserve existing records and report failure', () => {
  const storage = createMockStorage({ [COLLECTION_KEY]: emptyRaw });
  storage.setItem = () => { throw new DOMException('Quota', 'QuotaExceededError'); };
  const store = makeStore(storage);
  assert.equal(store.recordView({ key: 'lotus' }).saved, false);
  assert.equal(storage.getItem(COLLECTION_KEY), emptyRaw);
});

test('migration write failures expose legacy preview and can be retried after storage recovers', () => {
  const storage = createMockStorage({ [LEGACY_KEY]: legacyRaw });
  const set = storage.setItem;
  storage.setItem = () => {};
  const store = makeStore(storage);
  assert.equal(store.getData().collections[0].key, 'lotus');
  assert.equal(store.getStatus().kind, 'legacy-preview');
  assert.equal(storage.getItem(COLLECTION_KEY), null);
  assert.equal(store.addCollection({ key: 'peony' }).saved, false);
  storage.setItem = set;
  assert.deepEqual(store.recoverLegacy(), { saved: true });
  assert.equal(store.getData().collections.length, 1);
  assert.equal(storage.getItem(LEGACY_KEY), legacyRaw);
});

test('backup write failure prevents replacement of corrupt v2', () => {
  const storage = createMockStorage({ [LEGACY_KEY]: legacyRaw, [COLLECTION_KEY]: '{broken' });
  const set = storage.setItem;
  storage.setItem = (key, value) => { if (key !== RECOVERY_KEY) set(key, value); };
  assert.equal(makeStore(storage).recoverLegacy().saved, false);
  assert.equal(storage.getItem(COLLECTION_KEY), '{broken');
  assert.equal(storage.getItem(RECOVERY_KEY), null);
});

test('recovery never overwrites a different previous recovery copy', () => {
  const storage = createMockStorage({ [LEGACY_KEY]: legacyRaw, [COLLECTION_KEY]: '{broken', [RECOVERY_KEY]: 'prior-copy' });
  assert.deepEqual(makeStore(storage).recoverLegacy(), { saved: false, reason: 'recovery-backup-exists' });
  assert.equal(storage.getItem(COLLECTION_KEY), '{broken');
  assert.equal(storage.getItem(RECOVERY_KEY), 'prior-copy');
});

test('write failure during recovery retains the backup and the original value', () => {
  const storage = createMockStorage({ [LEGACY_KEY]: legacyRaw, [COLLECTION_KEY]: '{broken' });
  const set = storage.setItem;
  storage.setItem = (key, value) => { if (key !== COLLECTION_KEY) set(key, value); };
  assert.equal(makeStore(storage).recoverLegacy().saved, false);
  assert.equal(storage.getItem(COLLECTION_KEY), '{broken');
  assert.equal(storage.getItem(RECOVERY_KEY), '{broken');
});

test('intervening writes are detected before a collection replaces another tab data', () => {
  const storage = createMockStorage({ [COLLECTION_KEY]: emptyRaw });
  const other = JSON.stringify({ ...JSON.parse(emptyRaw), recentViews: [{ key: 'peony', viewedAt: '2026-10-14T10:00:00.000Z', source: 'detail' }] });
  const get = storage.getItem;
  let reads = 0;
  storage.getItem = key => {
    if (key === COLLECTION_KEY && ++reads === 2) storage.setItem(key, other);
    return get(key);
  };
  assert.deepEqual(makeStore(storage).addCollection({ key: 'lotus' }), { saved: false, reason: 'conflict' });
  assert.equal(storage.getItem(COLLECTION_KEY), other);
});

test('a recovery backup never authorizes overwriting a concurrent newer v2', () => {
  const storage = createMockStorage({ [LEGACY_KEY]: legacyRaw, [COLLECTION_KEY]: '{broken' });
  const set = storage.setItem;
  storage.setItem = (key, value) => {
    set(key, value);
    if (key === RECOVERY_KEY) set(COLLECTION_KEY, emptyRaw);
  };
  assert.deepEqual(makeStore(storage).recoverLegacy(), { saved: false, reason: 'conflict' });
  assert.equal(storage.getItem(COLLECTION_KEY), emptyRaw);
  assert.equal(storage.getItem(RECOVERY_KEY), '{broken');
});

test('oversized data is rejected before persistence instead of making the next read fail', () => {
  const storage = createMockStorage();
  const store = makeStore(storage);
  assert.equal(store.addCollection({ key: 'lotus', note: '荷'.repeat(500) }).saved, true);
  assert.equal(store.addCollection({ key: 'peony', note: '花'.repeat(500) }).saved, true);
  const before = storage.getItem(COLLECTION_KEY);
  assert.equal(store.addCollection({ key: 'leaves', note: '叶'.repeat(500) }).saved, false);
  assert.equal(storage.getItem(COLLECTION_KEY), before);
  assert.equal(store.getCollections().length, 2);
});

test('storage events notify listeners of errors and legacy changes, and dispose detaches', () => {
  const target = new EventTarget();
  const storage = createMockStorage({ [COLLECTION_KEY]: emptyRaw });
  const store = createCollectionStoreV2({ getStorage: () => storage, eventTarget: target });
  const received = [];
  store.subscribe(value => received.push(value));
  const emit = key => { const e = new Event('storage'); e.key = key; target.dispatchEvent(e); };
  storage.setItem(COLLECTION_KEY, '{broken');emit(COLLECTION_KEY);
  assert.equal(received[0], null);
  storage.setItem(LEGACY_KEY, legacyRaw);emit(LEGACY_KEY);
  assert.equal(received[1].collections[0].key, 'lotus');
  store.dispose();emit(COLLECTION_KEY);
  assert.equal(received.length, 2);
});
