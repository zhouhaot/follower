import { COLLECTION_KEY } from './collection-store-v2.mjs';
import { COLLECTION_KEY as LEGACY_KEY } from './collection-store.mjs';
import { BACKUP_FORMAT, decodeBackup } from './collection-backup.mjs';
import { CATALOGUE_VERSION, collectionDataV2, demand, fields, isoDate, parseJSON, sha256 } from './business-data.mjs';
import { createLocalTransaction } from './local-transaction.mjs';

export const JOURNAL_KEY = `${COLLECTION_KEY}:import-journal`;
const groups = ['collections', 'encounters', 'recentViews'];

export async function decodeFlowerAlbum(text) {
  const value = parseJSON(text);
  if (value.version !== 3) {
    const legacy = await decodeBackup(text);
    return { data: collectionDataV2(JSON.stringify({ version: 1, entries: legacy.entries })), migration: '旧版扫描记录 → 花册，保留历史来源' };
  }
  fields(value, ['format', 'version', 'catalogueVersion', 'exportedAt', 'data', 'sha256']);
  demand(value.format === BACKUP_FORMAT, 'unsupported-version');
  demand(value.catalogueVersion === CATALOGUE_VERSION, 'catalogue-mismatch');
  isoDate(value.exportedAt);
  const { sha256: checksum, ...payload } = value;
  demand(typeof checksum === 'string' && checksum === await sha256(JSON.stringify(payload)), 'checksum-mismatch');
  demand(value.data?.version === 2, 'unsupported-version');
  return { data: collectionDataV2(JSON.stringify(value.data)), migration: null };
}

export function createFlowerAlbumBackup({ getStorage = () => globalThis.localStorage, now = () => new Date().toISOString() } = {}) {
  const tx = createLocalTransaction({ key: COLLECTION_KEY, journalKey: JOURNAL_KEY, getStorage, now, validate: collectionDataV2 });
  let pending = null, generation = 0;
  function read() {
    const before = tx.read();
    const legacy = before === null ? getStorage().getItem(LEGACY_KEY) : null;
    return { before, legacy, data: collectionDataV2(before ?? legacy) };
  }
  return {
    current: () => read().data,
    async exportFile() {
      const payload = { format: BACKUP_FORMAT, version: 3, catalogueVersion: CATALOGUE_VERSION, exportedAt: isoDate(now()), data: read().data };
      return JSON.stringify({ ...payload, sha256: await sha256(JSON.stringify(payload)) }, null, 2);
    },
    async preview(text) {
      pending = null;
      const id = ++generation;
      const imported = await decodeFlowerAlbum(text);
      demand(id === generation, 'no-preview');
      const snapshot = read(), data = snapshot.data, counts = {}, titles = [];
      for (const group of groups) {
        const known = new Set(data[group].map(row => row.key));
        const added = imported.data[group].filter(row => !known.has(row.key)).map(row => group === 'encounters'
          ? { ...row, restoredFromBackup: true, restoredAt: isoDate(now()) } : row);
        data[group].push(...added);
        counts[group] = added.length;
        titles.push(...added.map(row => row.key));
      }
      data.recentViews.sort((a, b) => b.viewedAt.localeCompare(a.viewedAt));
      data.recentViews = data.recentViews.slice(0, 10);
      const next = JSON.stringify(data);
      collectionDataV2(next);
      const added = Object.values(counts).reduce((a, b) => a + b, 0);
      const incoming = groups.reduce((sum, group) => sum + imported.data[group].length, 0);
      pending = { id, before: snapshot.before, legacy: snapshot.legacy, next, added };
      return { id, existing: groups.reduce((sum, group) => sum + data[group].length, 0) - added, incoming, added, duplicates: incoming - added, counts, titles: [...new Set(titles)], migration: imported.migration };
    },
    commit(id) {
      demand(pending && pending.id === id && pending.added > 0, 'no-preview');
      const selected = pending; pending = null;
      if (selected.before === null) demand(getStorage().getItem(LEGACY_KEY) === selected.legacy, 'conflict');
      tx.commit(selected.before, selected.next);
      return { added: selected.added };
    },
    undo() { generation++; pending = null; tx.undo(); return read().data; },
    canUndo: () => tx.canUndo(),
    legacyFile: () => getStorage().getItem(LEGACY_KEY),
  };
}
