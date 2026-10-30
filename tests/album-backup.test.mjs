import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlowerAlbumBackup, decodeFlowerAlbum } from '../public/collection-backup-v2.mjs';
import { COLLECTION_KEY, createCollectionStoreV2 } from '../public/collection-store-v2.mjs';
import { createScanController } from '../public/scan-controller.mjs';
import { cardByKey } from '../public/cards.mjs';
const now = () => '2026-10-29T08:00:00.000Z';
function storage() { const map = new Map();return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) }; }
const storeFor = s => createCollectionStoreV2({getStorage:()=>s,eventTarget:null});
const backupFor = s => createFlowerAlbumBackup({getStorage:()=>s,now});

test('flower album export, preview, merge, readback and undo preserve all three record types', async () => {
 const s=storage(),store=storeFor(s);store.addCollection({key:'lotus',note:'原作'});store.recordEncounter({key:'peony',targetIndex:1,stableMs:1500,observationCount:9});store.recordView({key:'leaves'});
 const text=await backupFor(s).exportFile(),target=storage(),backup=backupFor(target),preview=await backup.preview(text);
 assert.equal(target.getItem(COLLECTION_KEY),null);assert.deepEqual(preview.counts,{collections:1,encounters:1,recentViews:1});
 backup.commit(preview.id);const data=storeFor(target).getData();assert.equal(data.collections[0].note,'原作');assert.equal(data.encounters[0].restoredFromBackup,true);assert.equal(data.recentViews[0].key,'leaves');
 assert.equal(backup.canUndo(),true);backup.undo();assert.equal(target.getItem(COLLECTION_KEY),null);
});
test('duplicates do not overwrite local records, import is idempotent',async()=>{
 const s=storage(),store=storeFor(s);store.addCollection({key:'lotus',note:'本机'});const backup=backupFor(s),text=await backup.exportFile(),p=await backup.preview(text);
 assert.equal(p.added,0);assert.throws(()=>backup.commit(p.id),/no-preview/);assert.equal(store.getData().collections[0].note,'本机');
});
test('damaged or future backup cannot alter stored data',async()=>{
 const s=storage();storeFor(s).addCollection({key:'lotus'});const backup=backupFor(s),text=await backup.exportFile(),before=s.getItem(COLLECTION_KEY),bad=JSON.parse(text);bad.data.collections=[];
 await assert.rejects(()=>backup.preview(JSON.stringify(bad)),/checksum-mismatch/);await assert.rejects(()=>decodeFlowerAlbum('{broken'),/invalid-json/);await assert.rejects(()=>decodeFlowerAlbum('{"version":99}'));
 assert.equal(s.getItem(COLLECTION_KEY),before);
});
test('legacy import can recover scans written after v2 migration, without overwriting v1',async()=>{
 const s=storage();storeFor(s).addCollection({key:'lotus'});const legacy=JSON.stringify({version:1,entries:[{key:'peony',recognizedAt:now(),method:'image-target',targetIndex:1}]});s.setItem('flowers-speak:cloud-candidate:collection:v1',legacy);
 const backup=backupFor(s),preview=await backup.preview(backup.legacyFile());backup.commit(preview.id);
 const data=storeFor(s).getData();assert.deepEqual(data.collections.map(r=>r.key),['lotus','peony']);assert.equal(data.collections[1].source,'legacy');assert.equal(data.encounters[0].restoredFromBackup,true);assert.equal(s.getItem('flowers-speak:cloud-candidate:collection:v1'),legacy);
});
test('changed data invalidates merge and undo rather than losing new records',async()=>{
 const source=storage();storeFor(source).addCollection({key:'lotus'});const text=await backupFor(source).exportFile(),s=storage(),backup=backupFor(s),preview=await backup.preview(text);
 storeFor(s).addCollection({key:'peony'});assert.throws(()=>backup.commit(preview.id),/conflict/);
 const next=await backup.preview(text);backup.commit(next.id);storeFor(s).recordView({key:'leaves'});assert.throws(()=>backup.undo(),/conflict/);assert.equal(storeFor(s).getData().recentViews[0].key,'leaves');
});
test('quota failure preserves records and a silent write cannot claim success',async()=>{
 const source=storage();storeFor(source).addCollection({key:'lotus'});const text=await backupFor(source).exportFile();
 for(const fail of [()=>{},()=>{throw Error('quota')}]){const s=storage(),backup=backupFor(s),p=await backup.preview(text);s.setItem=fail;assert.throws(()=>backup.commit(p.id));assert.equal(s.getItem(COLLECTION_KEY),null)}
});
test('real recognition controller writes v2 encounter without active collection',async()=>{
 const s=storage(),original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,value:s});
 let update,time=0;const controller=createScanController({card:cardByKey('lotus'),isSecureContext:()=>true,cameraAvailable:()=>true,requestCamera:async()=>({getTracks:()=>[]}),createTracker:async options=>{update=options.onTargetUpdate;return{start:async()=>{},dispose(){}}},now:()=>time});
 try{await controller.start();for(let i=0;i<9;i++){time=i*200;update({targetIndex:3,tracked:true,cardKey:'lotus'})}const data=storeFor(s).getData();assert.equal(controller.getState().state,'collected');assert.equal(data.encounters.length,1);assert.equal(data.collections.length,0);assert.equal(s.getItem('flowers-speak:cloud-candidate:collection:v1'),null)}finally{controller.cleanup();if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage}
});
