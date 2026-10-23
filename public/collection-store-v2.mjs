import { imageTargetFor } from './image-targets.mjs';
import { collectionDataV2, CATALOGUE_VERSION, CURRENT_DATA_VERSION } from './business-data.mjs';

/** V2 storage with separated collections, encounters, and recent views */
export const COLLECTION_KEY = 'flowers-speak:cloud-candidate:collection:v2';
export const MIN_RECOGNITION_MS = 1200;
export const MAX_RECENT_VIEWS = 10;

export function createCollectionStoreV2({
  getStorage = () => globalThis.localStorage,
  eventTarget = globalThis.window,
  legacyKey = 'flowers-speak:cloud-candidate:collection:v1'
} = {}) {
  const listeners = new Set();
  let lastStorageError = false;

  function getData() {
    try {
      const storage = getStorage();
      if (!storage) { lastStorageError = true; return null; }

      // 尝试读取 v2 数据
      let raw = storage.getItem(COLLECTION_KEY);

      // 如果 v2 不存在，尝试从 v1 迁移
      if (!raw) {
        const v1Raw = storage.getItem(legacyKey);
        if (v1Raw) {
          try {
            const migrated = collectionDataV2(v1Raw);
            // 保存迁移后的数据
            storage.setItem(COLLECTION_KEY, JSON.stringify(migrated));
            raw = storage.getItem(COLLECTION_KEY);
          } catch (e) {
            console.warn('V1 migration failed:', e);
          }
        }
      }

      const data = collectionDataV2(raw);
      lastStorageError = false;
      return data;
    } catch (e) {
      console.error('Failed to load collection data:', e);
      lastStorageError = true;
      return null;
    }
  }

  function saveData(data) {
    try {
      const storage = getStorage();
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(COLLECTION_KEY, JSON.stringify(data));
      // 验证写入
      const verification = storage.getItem(COLLECTION_KEY);
      if (!verification) throw new Error('Write not retained');
      lastStorageError = false;
      return true;
    } catch (e) {
      console.error('Failed to save collection data:', e);
      lastStorageError = true;
      return false;
    }
  }

  function notify() {
    const data = getData();
    if (!data) return;
    for (const listener of listeners) {
      try { listener(data); } catch (e) { console.error('Listener error:', e); }
    }
  }

  function addCollection({ key, note = null }) {
    const target = imageTargetFor(key);
    if (!target) return { saved: false, reason: 'invalid-key' };

    const data = getData();
    if (!data) return { saved: false, reason: 'storage-unavailable' };
    if (lastStorageError) return { saved: false, reason: 'storage-unavailable' };

    // 检查是否已收藏
    if (data.collections.some(c => c.key === key)) {
      return { saved: true, alreadyCollected: true };
    }

    // 添加收藏
    const collection = {
      key,
      collectedAt: new Date().toISOString(),
      source: 'manual'
    };
    if (note && typeof note === 'string' && note.length <= 500) {
      collection.note = note;
    }

    data.collections.push(collection);

    if (saveData(data)) {
      notify();
      return { saved: true, alreadyCollected: false };
    }
    return { saved: false, reason: 'storage-unavailable' };
  }

  function removeCollection(key) {
    const data = getData();
    if (!data) return { saved: false, reason: 'storage-unavailable' };

    const index = data.collections.findIndex(c => c.key === key);
    if (index === -1) return { saved: true, notFound: true };

    data.collections.splice(index, 1);

    if (saveData(data)) {
      notify();
      return { saved: true };
    }
    return { saved: false, reason: 'storage-unavailable' };
  }

  function recordEncounter({ key, targetIndex, stableMs, observationCount }) {
    const target = imageTargetFor(key);
    if (!target || targetIndex !== target.index ||
        !Number.isFinite(stableMs) || stableMs < MIN_RECOGNITION_MS ||
        !Number.isInteger(observationCount) || observationCount < 8) {
      return { saved: false, reason: 'unverified-recognition' };
    }

    const data = getData();
    if (!data) return { saved: false, reason: 'storage-unavailable' };
    if (lastStorageError) return { saved: false, reason: 'storage-unavailable' };

    // 检查是否已记录过相遇
    if (data.encounters.some(e => e.key === key)) {
      return { saved: true, alreadyRecorded: true };
    }

    // 记录相遇
    data.encounters.push({
      key,
      recognizedAt: new Date().toISOString(),
      method: 'image-target',
      targetIndex,
      source: 'camera'
    });

    if (saveData(data)) {
      notify();
      return { saved: true, alreadyRecorded: false };
    }
    return { saved: false, reason: 'storage-unavailable' };
  }

  function recordView({ key, source = 'detail' }) {
    const target = imageTargetFor(key);
    if (!target) return { saved: false, reason: 'invalid-key' };
    if (!['catalogue', 'detail', 'manual'].includes(source)) {
      return { saved: false, reason: 'invalid-source' };
    }

    const data = getData();
    if (!data) return { saved: false, reason: 'storage-unavailable' };

    // 移除旧的相同 key 的浏览记录
    data.recentViews = data.recentViews.filter(v => v.key !== key);

    // 添加新浏览记录到开头
    data.recentViews.unshift({
      key,
      viewedAt: new Date().toISOString(),
      source
    });

    // 限制最多保留 10 条
    if (data.recentViews.length > MAX_RECENT_VIEWS) {
      data.recentViews = data.recentViews.slice(0, MAX_RECENT_VIEWS);
    }

    if (saveData(data)) {
      notify();
      return { saved: true };
    }
    return { saved: false, reason: 'storage-unavailable' };
  }

  const onStorage = (event) => {
    if (event.key === COLLECTION_KEY || event.key === null) notify();
  };
  eventTarget?.addEventListener?.('storage', onStorage);

  return {
    getData,
    getCollections: () => getData()?.collections || [],
    getEncounters: () => getData()?.encounters || [],
    getRecentViews: () => getData()?.recentViews || [],
    hasCollected: (key) => getData()?.collections.some(c => c.key === key) || false,
    hasEncountered: (key) => getData()?.encounters.some(e => e.key === key) || false,
    addCollection,
    removeCollection,
    recordEncounter,
    recordView,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isStorageAvailable() {
      getData();
      return !lastStorageError;
    },
    dispose() {
      listeners.clear();
      eventTarget?.removeEventListener?.('storage', onStorage);
    },
  };
}

const store = createCollectionStoreV2();
export const getData = () => store.getData();
export const getCollections = () => store.getCollections();
export const getEncounters = () => store.getEncounters();
export const getRecentViews = () => store.getRecentViews();
export const hasCollected = (key) => store.hasCollected(key);
export const hasEncountered = (key) => store.hasEncountered(key);
export const addCollection = (params) => store.addCollection(params);
export const removeCollection = (key) => store.removeCollection(key);
export const recordEncounter = (evidence) => store.recordEncounter(evidence);
export const recordView = (params) => store.recordView(params);
export const subscribe = (listener) => store.subscribe(listener);
export const isStorageAvailable = () => store.isStorageAvailable();
