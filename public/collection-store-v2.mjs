import { imageTargetFor } from './image-targets.mjs';
import { collectionDataV2, DataIssue } from './business-data.mjs';

/** V2 storage with separated collections, encounters, and recent views */
export const COLLECTION_KEY = 'flowers-speak:cloud-candidate:collection:v2';
export const RECOVERY_KEY = `${COLLECTION_KEY}:recovery`;
export const MIN_RECOGNITION_MS = 1200;
export const MAX_RECENT_VIEWS = 10;

export function createCollectionStoreV2({
  getStorage = () => globalThis.localStorage,
  eventTarget = globalThis.window,
  legacyKey = 'flowers-speak:cloud-candidate:collection:v1'
} = {}) {
  const listeners = new Set();
  const snapshots = new WeakMap();
  let status = { kind: 'ready', code: null, recoverable: false };

  function mark(kind, code = null, recoverable = false) {
    status = { kind, code, recoverable };
  }

  function failure(error) {
    const reason = error instanceof DataIssue ? error.code : 'storage-unavailable';
    mark('error', reason);
    return { saved: false, reason };
  }

  function storage() {
    const value = getStorage();
    if (!value) throw new DataIssue('storage-unavailable');
    return value;
  }

  // Compare-before-write is best effort: localStorage is not a cross-tab transaction.
  function writeExact(s, raw, next, legacyRaw) {
    const serialized = JSON.stringify(next);
    collectionDataV2(serialized); // Never persist a value our reader cannot accept.
    if (s.getItem(COLLECTION_KEY) !== raw ||
        (legacyRaw !== undefined && s.getItem(legacyKey) !== legacyRaw)) {
      throw new DataIssue('conflict');
    }
    s.setItem(COLLECTION_KEY, serialized);
    if (s.getItem(COLLECTION_KEY) !== serialized) throw new DataIssue('storage-unavailable');
  }

  function remember(data, raw, writable, legacyRaw) {
    snapshots.set(data, { raw, writable, legacyRaw });
    return data;
  }

  function readLegacy(s) {
    const raw = s.getItem(legacyKey);
    if (raw === null) throw new DataIssue('no-legacy-data');
    // A legacy key must actually contain a v1 document, not a future schema.
    const data = collectionDataV2(raw);
    if (JSON.parse(raw).version !== 1) throw new DataIssue('unsupported-version');
    return { raw, data };
  }

  function getData() {
    try {
      const s = storage();
      const raw = s.getItem(COLLECTION_KEY);
      if (raw !== null) {
        try {
          const data = collectionDataV2(raw);
          mark('ready');
          return remember(data, raw, true);
        } catch (error) {
          // Never downgrade an unsupported version or a different catalogue.
          if (!['unsupported-version', 'catalogue-mismatch'].includes(error.code)) {
            try {
              const legacy = readLegacy(s);
              mark('legacy-preview', error.code || 'invalid-data', true);
              return remember(legacy.data, raw, false, legacy.raw);
            } catch { /* Keep the original v2 failure and all stored bytes. */ }
          }
          throw error;
        }
      }
      const legacyRaw = s.getItem(legacyKey);
      if (legacyRaw !== null) {
        const legacy = readLegacy(s);
        try {
          writeExact(s, null, legacy.data, legacy.raw);
          mark('ready');
          return remember(legacy.data, JSON.stringify(legacy.data), true);
        } catch (error) {
          mark('legacy-preview', error instanceof DataIssue ? error.code : 'storage-unavailable', true);
          return remember(legacy.data, null, false, legacy.raw);
        }
      }
      mark('ready');
      return remember(collectionDataV2(null), null, true);
    } catch (error) {
      failure(error);
      return null;
    }
  }

  function saveData(data) {
    try {
      const snapshot = snapshots.get(data);
      if (!snapshot?.writable) throw new DataIssue('recovery-required');
      writeExact(storage(), snapshot.raw, data);
      mark('ready');
      return true;
    } catch (error) {
      failure(error);
      return false;
    }
  }

  function recoverLegacy() {
    const wasPreview = status.kind === 'legacy-preview';
    const data = getData();
    if (wasPreview && status.kind === 'ready') {
      notify();
      return { saved: true };
    }
    const snapshot = data && snapshots.get(data);
    if (!snapshot || status.kind !== 'legacy-preview') {
      return { saved: false, reason: 'recovery-unavailable' };
    }
    try {
      const s = storage();
      if (s.getItem(COLLECTION_KEY) !== snapshot.raw || s.getItem(legacyKey) !== snapshot.legacyRaw) {
        throw new DataIssue('conflict');
      }
      if (snapshot.raw !== null) {
        const previous = s.getItem(RECOVERY_KEY);
        // Preserve the first recovery copy; never overwrite a different backup.
        if (previous !== null && previous !== snapshot.raw) throw new DataIssue('recovery-backup-exists');
        if (previous === null) s.setItem(RECOVERY_KEY, snapshot.raw);
        if (s.getItem(RECOVERY_KEY) !== snapshot.raw) throw new DataIssue('storage-unavailable');
      }
      writeExact(s, snapshot.raw, data, snapshot.legacyRaw);
      mark('ready');
      notify();
      return { saved: true };
    } catch (error) {
      return failure(error);
    }
  }

  function notify() {
    const data = getData();
    // Error transitions must also reach the UI, so a different tab cannot leave
    // stale successful state on screen after storage becomes unreadable.
    for (const listener of listeners) {
      try { listener(data); } catch { console.warn('花册视图更新失败，请刷新页面。'); }
    }
  }

  function canWrite(data) {
    return data && snapshots.get(data)?.writable;
  }

  function unavailable() {
    return { saved: false, reason: status.kind === 'legacy-preview' ? 'recovery-required' : status.code || 'storage-unavailable' };
  }

  function addCollection({ key, note = null }) {
    const target = imageTargetFor(key);
    if (!target) return { saved: false, reason: 'invalid-key' };

    const data = getData();
    if (!canWrite(data)) return unavailable();

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
    return unavailable();
  }

  function removeCollection(key) {
    const data = getData();
    if (!canWrite(data)) return unavailable();

    const index = data.collections.findIndex(c => c.key === key);
    if (index === -1) return { saved: true, notFound: true };

    data.collections.splice(index, 1);

    if (saveData(data)) {
      notify();
      return { saved: true };
    }
    return unavailable();
  }

  function recordEncounter({ key, targetIndex, stableMs, observationCount }) {
    const target = imageTargetFor(key);
    if (!target || targetIndex !== target.index ||
        !Number.isFinite(stableMs) || stableMs < MIN_RECOGNITION_MS ||
        !Number.isInteger(observationCount) || observationCount < 8) {
      return { saved: false, reason: 'unverified-recognition' };
    }

    const data = getData();
    if (!canWrite(data)) return unavailable();

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
    return unavailable();
  }

  function recordView({ key, source = 'detail' }) {
    const target = imageTargetFor(key);
    if (!target) return { saved: false, reason: 'invalid-key' };
    if (!['catalogue', 'detail', 'manual'].includes(source)) {
      return { saved: false, reason: 'invalid-source' };
    }

    const data = getData();
    if (!canWrite(data)) return unavailable();

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
    return unavailable();
  }

  const onStorage = (event) => {
    if ([COLLECTION_KEY, legacyKey, null].includes(event.key)) notify();
  };
  eventTarget?.addEventListener?.('storage', onStorage);

  return {
    getData,
    getStatus: () => ({ ...status }),
    recoverLegacy,
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
      return status.kind === 'ready';
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

export const getStatus = () => store.getStatus();
export const recoverLegacy = () => store.recoverLegacy();
