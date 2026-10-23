import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollectionBackup,decodeBackup,COLLECTION_JOURNAL_KEY} from '../public/collection-backup.mjs';
import {createCollectionStore,COLLECTION_KEY} from '../public/collection-store.mjs';
import {createVisitRoute,routeProgress,VISIT_ROUTE_KEY,ROUTE_JOURNAL_KEY,ROUTE_PRESETS} from '../public/visit-route.mjs';
import {MAX_BACKUP_BYTES,CATALOGUE_VERSION} from '../public/business-data.mjs';
const timestamp='2026-10-14T06:00:00.000Z';
const record=(key='lotus',targetIndex=3)=>({key,targetIndex,recognizedAt:timestamp,method:'image-target'});
const legacy=entries=>JSON.stringify({version:1,entries});
function memory(initial={}){const data=new Map(Object.entries(initial)),writes=[];return {data,writes,getItem:key=>data.get(key)??null,setItem(key,value){writes.push([key,value]);data.set(key,value)},removeItem(key){writes.push([key,null]);data.delete(key)}}}
const service=s=>createCollectionBackup({getStorage:()=>s,now:()=>timestamp});
const route=s=>createVisitRoute({getStorage:()=>s,now:()=>timestamp});
const code=expected=>error=>error.code===expected;

test('export v2 round-trips checksummed canonical records without a write',async()=>{
 const s=memory({[COLLECTION_KEY]:legacy([record()])}),backup=await service(s).exportFile(),decoded=await decodeBackup(backup);
 assert.deepEqual(decoded.entries,[record()]);assert.match(JSON.parse(backup).sha256,/^[a-f0-9]{64}$/);assert.equal(s.writes.length,0);
});
test('legacy v1 preflight migrates only on explicit merge and preserves existing bytes until confirmation',async()=>{
 const before=legacy([record()]),s=memory({[COLLECTION_KEY]:before,production_collection:'unchanged'}),b=service(s);
 const p=await b.preview(legacy([record('peony',1),record()]));assert.equal(p.added,1);assert.equal(p.duplicates,1);assert.match(p.migration,/v1/);assert.equal(s.getItem(COLLECTION_KEY),before);assert.equal(s.writes.length,0);
 b.commit(p.id);const rows=JSON.parse(s.getItem(COLLECTION_KEY)).entries;assert.deepEqual(rows[0],record());assert.equal(rows[1].restoredFromBackup,true);assert.equal(rows[1].restoredAt,timestamp);assert.equal(s.getItem('production_collection'),'unchanged');
 assert.ok(s.writes.every(([key])=>[COLLECTION_KEY,COLLECTION_JOURNAL_KEY].includes(key)));
});
test('undo restores exact prior raw serialization, including the no-data state',async()=>{
 for(const before of [null,'{ "version": 1, "entries": [] }']){const s=memory(before===null?{}:{[COLLECTION_KEY]:before}),b=service(s),p=await b.preview(legacy([record()]));b.commit(p.id);assert.equal(b.canUndo(),true);b.undo();assert.equal(s.getItem(COLLECTION_KEY),before);assert.equal(b.canUndo(),false)}
});
test('duplicate-only import is read-only and cannot create a new recovery point',async()=>{
 const before=legacy([record()]),s=memory({[COLLECTION_KEY]:before}),b=service(s),p=await b.preview(before);assert.equal(p.added,0);assert.throws(()=>b.commit(p.id),code('no-preview'));assert.equal(s.writes.length,0);
});
test('preflight and undo refuse to overwrite intervening records',async()=>{
 const s=memory(),b=service(s),p=await b.preview(legacy([record()]));const external=legacy([record('flowers',0)]);s.data.set(COLLECTION_KEY,external);assert.throws(()=>b.commit(p.id),code('conflict'));assert.equal(s.getItem(COLLECTION_KEY),external);
 const q=await b.preview(legacy([record()]));b.commit(q.id);const newer=legacy([record('flowers',0),record(),record('leaves',4)]);s.data.set(COLLECTION_KEY,newer);assert.throws(()=>b.undo(),code('conflict'));assert.equal(s.getItem(COLLECTION_KEY),newer);
});
test('recovery journal is saved before target; silent or throwing write failure restores original data',async()=>{
 for(const mode of ['silent','throw']){
  const before=legacy([record()]),s=memory({[COLLECTION_KEY]:before}),put=s.setItem.bind(s);let failed=false;
  s.setItem=(key,value)=>{if(key===COLLECTION_KEY&&!failed){failed=true;if(mode==='throw')throw Error('quota');return}put(key,value)};
  const b=service(s),p=await b.preview(legacy([record('peony',1)]));assert.throws(()=>b.commit(p.id),code('storage-unavailable'));assert.equal(s.getItem(COLLECTION_KEY),before);assert.equal(s.getItem(COLLECTION_JOURNAL_KEY),null);
  assert.equal(s.writes[0][0],COLLECTION_JOURNAL_KEY);
 }
});
test('failed recovery-point write cannot alter the collection',async()=>{
 const s=memory(),put=s.setItem.bind(s);let failed=false;s.setItem=(key,value)=>{if(key===COLLECTION_JOURNAL_KEY&&!failed){failed=true;throw Error('quota')}put(key,value)};
 const b=service(s),p=await b.preview(legacy([record()]));assert.throws(()=>b.commit(p.id),code('storage-unavailable'));assert.equal(s.getItem(COLLECTION_KEY),null);
});
test('a rollback that cannot be verified is reported without deleting its recovery journal',async()=>{
 const before=legacy([record()]),s=memory({[COLLECTION_KEY]:before}),put=s.setItem.bind(s);s.setItem=(key,value)=>{if(key===COLLECTION_KEY){s.data.set(key,'partial');throw Error('disk failure')}put(key,value)};
 const b=service(s),p=await b.preview(legacy([record('peony',1)]));assert.throws(()=>b.commit(p.id),code('rollback-failed'));assert.notEqual(s.getItem(COLLECTION_JOURNAL_KEY),null);assert.equal(s.getItem(COLLECTION_KEY),'partial');
});
test('change during journal creation is detected without rolling back another tab data',async()=>{
 const s=memory(),put=s.setItem.bind(s),external=legacy([record('flowers',0)]);s.setItem=(key,value)=>{put(key,value);if(key===COLLECTION_JOURNAL_KEY)s.data.set(COLLECTION_KEY,external)};
 const b=service(s),p=await b.preview(legacy([record()]));assert.throws(()=>b.commit(p.id),code('conflict'));assert.equal(s.getItem(COLLECTION_KEY),external);
});
test('unknown current versions and malformed journals are preserved',async()=>{
 for(const raw of ['{bad',JSON.stringify({version:99,entries:[]})]){const s=memory({[COLLECTION_KEY]:raw}),b=service(s);await assert.rejects(()=>b.preview(legacy([record()])));assert.equal(s.getItem(COLLECTION_KEY),raw);assert.equal(s.writes.length,0)}
 const badJournal=JSON.stringify({version:99}),s=memory({[COLLECTION_JOURNAL_KEY]:badJournal}),b=service(s),p=await b.preview(legacy([record()]));assert.throws(()=>b.commit(p.id));assert.equal(s.getItem(COLLECTION_JOURNAL_KEY),badJournal);assert.equal(s.getItem(COLLECTION_KEY),null);
});
test('corrupt restore-before payload is rejected rather than installed',async()=>{
 const after=legacy([record()]),journal=JSON.stringify({version:1,key:COLLECTION_KEY,before:'corrupt',after,createdAt:timestamp}),s=memory({[COLLECTION_KEY]:after,[COLLECTION_JOURNAL_KEY]:journal});assert.throws(()=>service(s).undo());assert.equal(s.getItem(COLLECTION_KEY),after);
});
test('checksum, catalogue and future-version failures do not produce a plan',async()=>{
 const source=service(memory({[COLLECTION_KEY]:legacy([record()])})),text=await source.exportFile();
 const a=JSON.parse(text);a.records[0].recognizedAt='2026-10-13T06:00:00.000Z';await assert.rejects(()=>decodeBackup(JSON.stringify(a)),code('checksum-mismatch'));
 a.version=3;await assert.rejects(()=>decodeBackup(JSON.stringify(a)),code('unsupported-version'));
 const c=JSON.parse(text);c.catalogueVersion='other';await assert.rejects(()=>decodeBackup(JSON.stringify(c)),code('catalogue-mismatch'));
});
test('unknown cards, duplicates, cross-card targets, fake methods and invalid dates are refused',async()=>{
 const cases=[[record('unknown',3)],[record(),record()],[record('lotus',1)],[{...record(),method:'preview'}],[{...record(),recognizedAt:'not-a-date'}],Array.from({length:6},()=>record()),[{...record(),url:'https://bad.invalid'}]];
 for(const entries of cases)await assert.rejects(()=>decodeBackup(legacy(entries)));
});
test('unsafe keys at any depth, excessive bytes, invalid JSON and top-level arrays are rejected',async()=>{
 for(const text of ['{"version":1,"entries":[],"__proto__":{"polluted":true}}','{"version":1,"entries":[{"constructor":{}}]}','[1,2]','{oops'])await assert.rejects(()=>decodeBackup(text));
 await assert.rejects(()=>decodeBackup(' '.repeat(MAX_BACKUP_BYTES+1)),code('file-too-large'));
 await assert.rejects(()=>decodeBackup('花'.repeat(MAX_BACKUP_BYTES/2)),code('file-too-large'));assert.equal({}.polluted,undefined);
});
test('superseded asynchronous preflight cannot commit stale content',async()=>{
 const s=memory(),b=service(s),results=await Promise.allSettled([b.preview(legacy([record()])),b.preview(legacy([record('peony',1)]))]);assert.equal(results[0].status,'rejected');assert.equal(results[1].status,'fulfilled');b.commit(results[1].value.id);assert.equal(JSON.parse(s.getItem(COLLECTION_KEY)).entries[0].key,'peony');
});
test('restored provenance survives existing store reads and later other-card recognition',async()=>{
 const s=memory(),b=service(s),p=await b.preview(legacy([record()]));b.commit(p.id);const existing=createCollectionStore({getStorage:()=>s,eventTarget:null});assert.equal(existing.getCollection()[0].restoredFromBackup,true);
 const saved=existing.recordRecognition({key:'peony',targetIndex:1,source:'image-target',stableMs:1300,observationCount:9,recognizedAt:timestamp});assert.equal(saved.saved,true);assert.equal(existing.getCollection().find(r=>r.key==='lotus').restoredFromBackup,true);existing.dispose();
});
test('existing recognition writer preserves unsupported stored versions',()=>{
 const raw=JSON.stringify({version:99,entries:[]}),s=memory({[COLLECTION_KEY]:raw}),store=createCollectionStore({getStorage:()=>s,eventTarget:null});const result=store.recordRecognition({key:'lotus',targetIndex:3,source:'image-target',stableMs:1300,observationCount:9});assert.equal(result.saved,false);assert.equal(s.getItem(COLLECTION_KEY),raw);store.dispose();
});
test('recognition cannot erase malformed or extended legacy records while adding a card',()=>{
 for(const row of [{...record(),targetIndex:2},{...record(),unexpected:'preserve this'},{...record(),restoredFromBackup:true,restoredAt:'broken'}]){
  const raw=legacy([row]),s=memory({[COLLECTION_KEY]:raw}),store=createCollectionStore({getStorage:()=>s,eventTarget:null});
  assert.equal(store.recordRecognition({key:'peony',targetIndex:1,source:'image-target',stableMs:1300,observationCount:9}).saved,false);assert.equal(s.getItem(COLLECTION_KEY),raw);store.dispose();
 }
});
test('route planning, explicit views, resume, completion and undo are independent from collection',()=>{
 const collection=legacy([record()]),s=memory({[COLLECTION_KEY]:collection}),a=route(s);a.save(ROUTE_PRESETS[1]);assert.equal(routeProgress(a.read()).next,'lotus');a.markViewed('lotus');assert.equal(route(s).read().visited[0],'lotus');a.markViewed('chrysanthemum');a.markViewed('leaves');assert.equal(routeProgress(a.read()).complete,true);a.undo();assert.equal(routeProgress(a.read()).next,'leaves');assert.equal(s.getItem(COLLECTION_KEY),collection);assert.ok(s.writes.every(([key])=>[VISIT_ROUTE_KEY,ROUTE_JOURNAL_KEY].includes(key)));
});
test('editing route order retains only relevant viewed cards and rejects invalid input',()=>{
 const s=memory(),a=route(s);a.save(ROUTE_PRESETS[0]);a.markViewed('lotus');a.markViewed('flowers');a.save({title:'自选',keys:['lotus','leaves']});assert.deepEqual(a.read().visited,['lotus']);
 const before=s.getItem(VISIT_ROUTE_KEY);for(const keys of [[],['lotus','lotus'],['unknown'],['__proto__']])assert.throws(()=>a.save({keys}));assert.throws(()=>a.save({keys:['lotus'],title:'x'.repeat(61)}));assert.equal(s.getItem(VISIT_ROUTE_KEY),before);a.restart();assert.deepEqual(a.read().visited,[]);
});
test('future/corrupt route data cannot be silently reset or migrated',()=>{
 for(const raw of ['{bad',JSON.stringify({version:99}),JSON.stringify({version:1,catalogueVersion:'other',title:'a',keys:['lotus'],visited:[],updatedAt:timestamp})]){const s=memory({[VISIT_ROUTE_KEY]:raw}),a=route(s);assert.throws(()=>a.read());assert.throws(()=>a.save(ROUTE_PRESETS[0]));assert.equal(s.getItem(VISIT_ROUTE_KEY),raw);assert.equal(s.writes.length,0)}
});
test('storage denial and discarded route writes never report saved progress',()=>{
 const unavailable=createVisitRoute({getStorage:()=>{throw Error('denied')}});assert.throws(()=>unavailable.read(),code('storage-unavailable'));
 const s=memory();s.setItem=()=>{};assert.throws(()=>route(s).save(ROUTE_PRESETS[0]),code('storage-unavailable'));assert.equal(s.getItem(VISIT_ROUTE_KEY),null);
});
