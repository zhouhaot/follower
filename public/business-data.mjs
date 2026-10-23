import {cards} from './cards.mjs';
export const CATALOGUE_VERSION='five-flowers-20260913';
export const MAX_BACKUP_BYTES=65536;
export const CURRENT_DATA_VERSION=2;
const identities=new Map(cards.map(card=>[card.key,card.targetIndex]));
export class DataIssue extends Error{constructor(code){super(code);this.name='DataIssue';this.code=code;}}
export function demand(condition,code='invalid-data'){if(!condition)throw new DataIssue(code)}
export function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype}
export function fields(value,allowed){demand(plain(value));demand(Object.keys(value).every(key=>allowed.includes(key)),'unexpected-field')}
export function parseJSON(text,limit=MAX_BACKUP_BYTES){
 demand(typeof text==='string','invalid-file');demand(new TextEncoder().encode(text).length<=limit,'file-too-large');
 try{return JSON.parse(text,(key,value)=>{demand(!['__proto__','prototype','constructor'].includes(key),'unsafe-key');return value})}
 catch(error){if(error instanceof DataIssue)throw error;throw new DataIssue('invalid-json')}
}
export function isoDate(value){demand(typeof value==='string'&&value.length<=40&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value)),'invalid-date');return new Date(value).toISOString()}
export function cardKeys(value,{allowEmpty=false}={}){
 demand(Array.isArray(value)&&value.length<=5&&(allowEmpty||value.length>0),'invalid-cards');
 demand(value.every(key=>typeof key==='string'&&identities.has(key))&&new Set(value).size===value.length,'invalid-cards');return [...value];
}
export function records(value){
 demand(Array.isArray(value)&&value.length<=5,'invalid-records');const seen=new Set();
 return value.map(row=>{
  fields(row,['key','recognizedAt','method','targetIndex','restoredFromBackup','restoredAt']);
  demand(identities.has(row.key)&&!seen.has(row.key)&&row.targetIndex===identities.get(row.key)&&row.method==='image-target','invalid-records');seen.add(row.key);
  const clean={key:row.key,recognizedAt:isoDate(row.recognizedAt),method:'image-target',targetIndex:row.targetIndex};
  if(Object.hasOwn(row,'restoredFromBackup')||Object.hasOwn(row,'restoredAt')){demand(row.restoredFromBackup===true&&Object.hasOwn(row,'restoredAt'),'invalid-records');clean.restoredFromBackup=true;clean.restoredAt=isoDate(row.restoredAt)}
  return clean;
 });
}
export function collectionEntry(value){
 fields(value,['key','collectedAt','source','note']);
 demand(identities.has(value.key),'invalid-collection');
 demand(['manual','legacy','unknown'].includes(value.source),'invalid-collection');
 const clean={key:value.key,collectedAt:isoDate(value.collectedAt),source:value.source};
 if(value.note&&typeof value.note==='string'&&value.note.length<=500){clean.note=value.note}
 return clean;
}
export function encounterEntry(value){
 fields(value,['key','recognizedAt','method','targetIndex','source','restoredFromBackup','restoredAt']);
 demand(identities.has(value.key)&&value.targetIndex===identities.get(value.key),'invalid-encounter');
 demand(value.method==='image-target','invalid-encounter');
 demand(['camera','legacy','unknown'].includes(value.source),'invalid-encounter');
 const clean={key:value.key,recognizedAt:isoDate(value.recognizedAt),method:'image-target',targetIndex:value.targetIndex,source:value.source};
 if(Object.hasOwn(value,'restoredFromBackup')||Object.hasOwn(value,'restoredAt')){
  demand(value.restoredFromBackup===true&&Object.hasOwn(value,'restoredAt'),'invalid-encounter');
  clean.restoredFromBackup=true;clean.restoredAt=isoDate(value.restoredAt);
 }
 return clean;
}
export function recentViewEntry(value){
 fields(value,['key','viewedAt','source']);
 demand(identities.has(value.key),'invalid-view');
 demand(['catalogue','detail','manual'].includes(value.source),'invalid-view');
 return {key:value.key,viewedAt:isoDate(value.viewedAt),source:value.source};
}
export function collectionsV2(value){
 demand(Array.isArray(value)&&value.length<=5,'invalid-collections');
 const seen=new Set();
 return value.map(entry=>{
  const clean=collectionEntry(entry);
  demand(!seen.has(clean.key),'invalid-collections');
  seen.add(clean.key);
  return clean;
 });
}
export function encountersV2(value){
 demand(Array.isArray(value)&&value.length<=5,'invalid-encounters');
 const seen=new Set();
 return value.map(entry=>{
  const clean=encounterEntry(entry);
  demand(!seen.has(clean.key),'invalid-encounters');
  seen.add(clean.key);
  return clean;
 });
}
export function recentViewsV2(value){
 demand(Array.isArray(value)&&value.length<=10,'invalid-views');
 return value.map(entry=>recentViewEntry(entry));
}
export function collectionRaw(raw){
 if(raw===null)return [];
 const value=parseJSON(raw,4096);fields(value,['version','entries']);demand(value.version===1,'unsupported-version');return records(value.entries);
}
export function collectionDataV2(raw){
 if(raw===null)return {version:2,catalogueVersion:CATALOGUE_VERSION,collections:[],encounters:[],recentViews:[]};
 const value=parseJSON(raw,4096);
 if(value.version===1){
  fields(value,['version','entries']);
  const entries=records(value.entries);
  return {
   version:2,
   catalogueVersion:CATALOGUE_VERSION,
   collections:entries.map(e=>({key:e.key,collectedAt:e.recognizedAt,source:'legacy'})),
   encounters:entries.map(e=>({...e,source:'camera'})),
   recentViews:[]
  };
 }
 fields(value,['version','catalogueVersion','collections','encounters','recentViews']);
 demand(value.version===2,'unsupported-version');
 demand(value.catalogueVersion===CATALOGUE_VERSION,'catalogue-mismatch');
 return {
  version:2,
  catalogueVersion:CATALOGUE_VERSION,
  collections:collectionsV2(value.collections),
  encounters:encountersV2(value.encounters),
  recentViews:recentViewsV2(value.recentViews)
 };
}
export async function sha256(text){
 demand(Boolean(globalThis.crypto?.subtle),'checksum-unavailable');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function issueMessage(error){return ({'file-too-large':'文件超过 64 KB，未读取或保存。','invalid-file':'请选择 JSON 备份文件。','invalid-json':'文件不是有效 JSON，未修改本机数据。','unsafe-key':'文件包含不安全的字段，已拒绝。','unexpected-field':'文件含有无法识别的字段，已拒绝。','unsupported-version':'此数据版本暂不支持，原内容已保留。','catalogue-mismatch':'备份的卡牌目录版本不匹配，未导入。','checksum-mismatch':'备份校验值不匹配，文件可能不完整。','checksum-unavailable':'当前环境无法校验备份，请使用 localhost 或 HTTPS。','invalid-records':'收藏记录、卡牌身份或识别方式无效。','invalid-date':'记录时间格式无效。','invalid-cards':'路线中含有未知或重复花卡。','invalid-collection':'收藏记录格式或来源无效。','invalid-collections':'收藏列表包含重复或无效项。','invalid-encounter':'相遇记录格式或来源无效。','invalid-encounters':'相遇列表包含重复或无效项。','invalid-view':'浏览记录格式或来源无效。','invalid-views':'浏览记录列表无效。','storage-unavailable':'本地存储不可用，未宣称保存成功。','conflict':'数据已在其他页面变化，请重新预检。','no-preview':'请先选择文件并完成导入预检。','no-checkpoint':'当前没有可撤销的已保存操作。','rollback-failed':'保存未完成，自动恢复未获确认；恢复点仍保留，请勿继续导入。','invalid-data':'数据格式无效，原内容已保留。'})[error?.code]||'操作未完成，原内容已保留。'}
