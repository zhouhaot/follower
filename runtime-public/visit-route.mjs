import {CATALOGUE_VERSION,demand,fields,parseJSON,cardKeys,isoDate} from './business-data.mjs';
import {createLocalTransaction} from './local-transaction.mjs';
export const VISIT_ROUTE_KEY='flowers-speak:visit-route:v1';
export const ROUTE_JOURNAL_KEY='flowers-speak:visit-route-journal:v1';
export const ROUTE_PRESETS=Object.freeze([
 Object.freeze({id:'all',title:'依次看完五张花卡',keys:Object.freeze(['flowers','peony','chrysanthemum','lotus','leaves'])}),
 Object.freeze({id:'quiet',title:'从清荷到花叶',keys:Object.freeze(['lotus','chrysanthemum','leaves'])}),
]);
function decode(raw){if(raw===null)return null;const value=parseJSON(raw,4096);fields(value,['version','catalogueVersion','title','keys','visited','updatedAt']);demand(value.version===1,'unsupported-version');demand(value.catalogueVersion===CATALOGUE_VERSION,'catalogue-mismatch');demand(typeof value.title==='string'&&value.title.trim().length>0&&value.title.length<=60);const keys=cardKeys(value.keys),visited=cardKeys(value.visited,{allowEmpty:true});demand(visited.every(key=>keys.includes(key)),'invalid-cards');return {version:1,catalogueVersion:CATALOGUE_VERSION,title:value.title,keys,visited,updatedAt:isoDate(value.updatedAt)}}
export function routeProgress(route){const remaining=route?route.keys.filter(key=>!route.visited.includes(key)):[];return {total:route?.keys.length||0,viewed:route?.visited.length||0,next:remaining[0]||null,complete:!!route&&remaining.length===0}}
export function createVisitRoute({getStorage=()=>globalThis.localStorage,now=()=>new Date().toISOString()}={}){
 const tx=createLocalTransaction({key:VISIT_ROUTE_KEY,journalKey:ROUTE_JOURNAL_KEY,getStorage,now,validate:decode});
 function read(){return decode(tx.read())}
 function change(transform){const before=tx.read(),current=decode(before),next=transform(current);tx.commit(before,JSON.stringify({...next,version:1,catalogueVersion:CATALOGUE_VERSION,updatedAt:isoDate(now())}));return read()}
 return {
  read,
  save({keys,title='我的花卡导览'}){const valid=cardKeys(keys);demand(typeof title==='string'&&title.trim().length>0&&title.length<=60);return change(old=>({title:title.trim(),keys:valid,visited:(old?.visited||[]).filter(key=>valid.includes(key))}))},
  markViewed(key){return change(current=>{demand(current?.keys.includes(key),'invalid-cards');return {...current,visited:current.visited.includes(key)?current.visited:[...current.visited,key]}})},
  restart(){return change(current=>{demand(current);return {...current,visited:[]}})},
  undo(){tx.undo();return read()},canUndo:()=>tx.canUndo(),
 };
}
