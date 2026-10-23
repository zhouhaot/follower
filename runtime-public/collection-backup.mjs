import {COLLECTION_KEY} from './collection-store.mjs';
import {CATALOGUE_VERSION,DataIssue,demand,fields,parseJSON,records,collectionRaw,isoDate,sha256} from './business-data.mjs';
import {createLocalTransaction} from './local-transaction.mjs';
export const BACKUP_FORMAT='zevth.collection-backup';
export const COLLECTION_JOURNAL_KEY='flowers-speak:collection-import-journal:v1';
async function documentFor(entries,now){const payload={format:BACKUP_FORMAT,version:2,catalogueVersion:CATALOGUE_VERSION,exportedAt:isoDate(now),records:records(entries)};return {...payload,sha256:await sha256(JSON.stringify(payload))}}
export async function decodeBackup(text){
 const value=parseJSON(text);
 if(value?.version===1&&!Object.hasOwn(value,'format')){fields(value,['version','entries']);return {entries:records(value.entries),migration:'候选收藏格式 v1 → 备份格式 v2'}}
 fields(value,['format','version','catalogueVersion','exportedAt','records','sha256']);demand(value.format===BACKUP_FORMAT&&value.version===2,'unsupported-version');demand(value.catalogueVersion===CATALOGUE_VERSION,'catalogue-mismatch');
 const payload={format:BACKUP_FORMAT,version:2,catalogueVersion:CATALOGUE_VERSION,exportedAt:isoDate(value.exportedAt),records:records(value.records)};
 demand(typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256)&&await sha256(JSON.stringify(payload))===value.sha256,'checksum-mismatch');return {entries:payload.records,migration:null};
}
/** Backups preserve historical claims; imports are labelled and never certify a scan. */
export function createCollectionBackup({getStorage=()=>globalThis.localStorage,now=()=>new Date().toISOString()}={}){
 const tx=createLocalTransaction({key:COLLECTION_KEY,journalKey:COLLECTION_JOURNAL_KEY,getStorage,now,validate:collectionRaw});let pending=null,serial=0,generation=0;
 function current(){return collectionRaw(tx.read())}
 return {
  current,
  async exportFile(){return JSON.stringify(await documentFor(current(),now()),null,2)},
  async preview(text){
   pending=null;const token=++generation,imported=await decodeBackup(text);demand(token===generation,'no-preview');const before=tx.read(),existing=collectionRaw(before),known=new Set(existing.map(row=>row.key));
   const added=imported.entries.filter(row=>!known.has(row.key)).map(row=>({...row,restoredFromBackup:true,restoredAt:isoDate(now())}));
   pending={id:++serial,before,next:JSON.stringify({version:1,entries:[...existing,...added]}),added:added.length};
   return Object.freeze({id:pending.id,existing:existing.length,incoming:imported.entries.length,added:added.length,duplicates:imported.entries.length-added.length,migration:imported.migration,titles:added.map(row=>row.key)});
  },
  commit(id){demand(pending&&pending.id===id,'no-preview');const p=pending;pending=null;demand(p.added>0,'no-preview');tx.commit(p.before,p.next);return {added:p.added}},
  undo(){pending=null;tx.undo();return current()},
  canUndo:()=>tx.canUndo(),
 };
}
