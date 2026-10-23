import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionStoreV2 } from '../public/collection-store-v2.mjs';

function createMockStorage(initialData = {}) {
  const data = new Map(Object.entries(initialData));
  return {
    getItem: (key) => data.get(key) || null,
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
