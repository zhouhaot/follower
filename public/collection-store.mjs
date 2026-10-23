import { imageTargetFor } from './image-targets.mjs';
import { collectionRaw as validateStoredCollection } from './business-data.mjs';

/** Candidate-only progress. Production progress is never read or overwritten. */
export const COLLECTION_KEY = 'flowers-speak:cloud-candidate:collection:v1';
export const COLLECTION_VERSION = 1;
// Kept for existing candidate integrations; all new code uses imageTargetFor.
export const LOTUS_TARGET_INDEX = 3;
export const MIN_RECOGNITION_MS = 1200;

function decode(raw) {
  if (raw == null || typeof raw !== 'string' || raw.length > 4096) return [];
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== COLLECTION_VERSION || !Array.isArray(data.entries) || data.entries.length > 5) return [];
    const seen = new Set();
    return data.entries.filter((entry) => {
      const target = imageTargetFor(entry?.key);
      if (!entry || !target || entry.method !== 'image-target' ||
          entry.targetIndex !== target.index || typeof entry.recognizedAt !== 'string' ||
          !Number.isFinite(Date.parse(entry.recognizedAt)) || seen.has(entry.key)) return false;
      seen.add(entry.key);
      return true;
    }).map(({ key, recognizedAt, method, targetIndex, restoredFromBackup, restoredAt }) => ({ key, recognizedAt, method, targetIndex,
      ...(restoredFromBackup === true && typeof restoredAt === 'string' && Number.isFinite(Date.parse(restoredAt)) ? { restoredFromBackup: true, restoredAt } : {}) }));
  } catch { return []; }
}

export function createCollectionStore({ getStorage = () => globalThis.localStorage, eventTarget = globalThis.window } = {}) {
  const listeners = new Set();
  let lastStorageError = false;
  let unknownStoredFormat = false;
  function getCollection() {
    try {
      const storage = getStorage();
      if (!storage) { lastStorageError = true; return []; }
      const raw = storage.getItem(COLLECTION_KEY);
      unknownStoredFormat = false;
      try { validateStoredCollection(raw); } catch { unknownStoredFormat = true; }
      const entries = decode(raw);
      lastStorageError = false;
      return entries;
    } catch { lastStorageError = true; return []; }
  }
  function notify() {
    const entries = getCollection();
    for (const listener of listeners) { try { listener(entries); } catch {} }
  }
  function recordRecognition({ key, source, targetIndex, stableMs, observationCount, recognizedAt = new Date().toISOString() } = {}) {
    // Preview code does not import or call this. Reject weak/unrelated evidence as a second guard.
    const target = imageTargetFor(key);
    if (!target || source !== 'image-target' || targetIndex !== target.index ||
        !Number.isFinite(stableMs) || stableMs < MIN_RECOGNITION_MS ||
        !Number.isInteger(observationCount) || observationCount < 8 ||
        typeof recognizedAt !== 'string' || !Number.isFinite(Date.parse(recognizedAt))) {
      return { saved: false, reason: 'unverified-recognition' };
    }
    const entries = getCollection();
    if (lastStorageError) return { saved: false, reason: 'storage-unavailable' };
    if (unknownStoredFormat) return { saved: false, reason: 'unrecognized-stored-version' };
    if (entries.some((entry) => entry.key === key)) return { saved: true, alreadyCollected: true };
    entries.push({ key, recognizedAt, method: source, targetIndex });
    try {
      const storage = getStorage();
      storage.setItem(COLLECTION_KEY, JSON.stringify({ version: COLLECTION_VERSION, entries }));
      // Some embedded browser storage implementations silently discard writes.
      if (!decode(storage.getItem(COLLECTION_KEY)).some((entry) => entry.key === key)) throw new Error('Write not retained');
      lastStorageError = false;
      notify();
      return { saved: true, alreadyCollected: false };
    } catch { lastStorageError = true; return { saved: false, reason: 'storage-unavailable' }; }
  }
  const onStorage = (event) => { if (event.key === COLLECTION_KEY || event.key === null) notify(); };
  eventTarget?.addEventListener?.('storage', onStorage);
  return {
    getCollection,
    hasCollected: (key) => getCollection().some((entry) => entry.key === key),
    recordRecognition,
    subscribeCollection(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    isStorageAvailable() { getCollection(); return !lastStorageError; },
    dispose() { listeners.clear(); eventTarget?.removeEventListener?.('storage', onStorage); },
  };
}

const store = createCollectionStore();
export const getCollection = () => store.getCollection();
export const hasCollected = (key) => store.hasCollected(key);
export const subscribeCollection = (listener) => store.subscribeCollection(listener);
export const recordRecognition = (evidence) => store.recordRecognition(evidence);
export const isCollectionStorageAvailable = () => store.isStorageAvailable();
